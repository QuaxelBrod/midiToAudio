import { renderMidiToWav } from './processors/midiRenderer.js';
import { normalizeAudio } from './processors/audioNormalizer.js';
import { encodeToMp3 } from './processors/mp3Encoder.js';
import { generateOutputPath, generateUniquePath } from './filesystem/pathGenerator.js';
import { writeFileAtomic, fileExists } from './filesystem/fileWriter.js';
import { updateProcessingStatus } from './database/queries.js';
import { getTempFilePath, deleteTempFile } from './utils/tempFiles.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger({ module: 'pipeline' });

/**
 * Processes a single MIDI document through the complete pipeline
 * @param {Object} document - MongoDB document containing MIDI data
 * @returns {Promise<Object>} Processing result
 */
export async function processMidiDocument(document) {
    const hash = document.midifile?.hash;

    if (!hash) {
        throw new Error('Document missing midifile.hash');
    }

    // Extract MIDI buffer - support different MongoDB formats
    let midiBuffer;

    if (document.midifile?.data) {
        const data = document.midifile.data;

        // String (base64, hex, or raw bytes) - MOST COMMON
        if (typeof data === 'string') {
            // Try latin1 first (raw bytes as string)
            midiBuffer = Buffer.from(data, 'latin1');

            // Validate: MIDI files start with "MThd" (0x4D546864)
            if (midiBuffer.length < 4 ||
                !(midiBuffer[0] === 0x4D && midiBuffer[1] === 0x54 &&
                    midiBuffer[2] === 0x68 && midiBuffer[3] === 0x64)) {
                // Try base64
                try {
                    midiBuffer = Buffer.from(data, 'base64');
                    if (midiBuffer.length < 4 ||
                        !(midiBuffer[0] === 0x4D && midiBuffer[1] === 0x54 &&
                            midiBuffer[2] === 0x68 && midiBuffer[3] === 0x64)) {
                        // Try hex
                        midiBuffer = Buffer.from(data, 'hex');
                    }
                } catch (error) {
                    logger.error({ hash, error: error.message }, 'Failed to decode MIDI string');
                    throw new Error('Failed to decode MIDI data string');
                }
            }
            logger.debug({ hash, bufferSize: midiBuffer.length }, 'Converted string to buffer');
        }
        // MongoDB Binary (BSON)
        else if (data.buffer && Buffer.isBuffer(data.buffer)) {
            midiBuffer = data.buffer;
        }
        // Direct Buffer
        else if (Buffer.isBuffer(data)) {
            midiBuffer = data;
        }
        // MongoDB Binary type with .value() method
        else if (typeof data.value === 'function') {
            midiBuffer = data.value();
        }
        // Uint8Array or similar
        else if (data.buffer instanceof ArrayBuffer) {
            midiBuffer = Buffer.from(data.buffer);
        }
        // Plain object with buffer property
        else if (data.buffer) {
            midiBuffer = Buffer.from(data.buffer);
        }
        else {
            logger.error({
                hash,
                dataType: typeof data,
                dataConstructor: data.constructor?.name,
            }, 'Unknown MIDI data format');
            throw new Error('Document midifile.data in unknown format');
        }
    }

    if (!midiBuffer || midiBuffer.length === 0) {
        throw new Error('Document missing midifile.data');
    }

    logger.info({ hash, bufferSize: midiBuffer.length }, 'Starting pipeline for MIDI document');
    const startTime = Date.now();

    // Update status to processing
    await updateProcessingStatus(hash, 'processing', {
        startedAt: new Date(),
    });

    let wavPath = null;
    let normalizedWavPath = null;
    let tempMp3Path = null;

    try {
        // Step 1: Render MIDI to WAV
        logger.info({ hash }, 'Step 1/4: Rendering MIDI to WAV');
        wavPath = getTempFilePath('.wav');
        await renderMidiToWav(Buffer.from(midiBuffer), wavPath);

        // Step 2: Normalize audio to -14 LUFS
        logger.info({ hash }, 'Step 2/4: Normalizing audio');
        normalizedWavPath = getTempFilePath('_normalized.wav');
        const normalizationResult = await normalizeAudio(wavPath, normalizedWavPath);

        // Step 3: Encode to MP3 with metadata
        logger.info({ hash }, 'Step 3/4: Encoding to MP3');
        tempMp3Path = getTempFilePath('.mp3');
        const encodingResult = await encodeToMp3(normalizedWavPath, tempMp3Path, document);

        // Step 4: Write to final destination
        logger.info({ hash }, 'Step 4/4: Writing to output directory');
        let outputPath = generateOutputPath(document, hash);

        // Handle collision by appending hash
        if (fileExists(outputPath)) {
            logger.warn({ hash, outputPath }, 'Output file already exists, using unique path');
            outputPath = generateUniquePath(outputPath, hash);
        }

        const writeResult = await writeFileAtomic(tempMp3Path, outputPath);

        // Update status to completed
        const totalDuration = Date.now() - startTime;
        await updateProcessingStatus(hash, 'completed', {
            completedAt: new Date(),
            outputPath,
            originalLUFS: normalizationResult.originalLUFS,
            targetLUFS: normalizationResult.targetLUFS,
            processingDuration: totalDuration,
            metadata: encodingResult.metadata,
        });

        logger.info({
            hash,
            outputPath,
            duration: totalDuration,
        }, 'Pipeline completed successfully');

        return {
            success: true,
            hash,
            outputPath,
            duration: totalDuration,
            metadata: encodingResult.metadata,
        };

    } catch (error) {
        logger.error({ hash, error: error.message }, 'Pipeline failed');

        // Update status to failed
        await updateProcessingStatus(hash, 'failed', {
            failedAt: new Date(),
            error: error.message,
        });

        throw error;

    } finally {
        // Cleanup temporary files
        if (wavPath) deleteTempFile(wavPath);
        if (normalizedWavPath) deleteTempFile(normalizedWavPath);
        if (tempMp3Path) deleteTempFile(tempMp3Path);
    }
}

/**
 * Processes a MIDI document with retry logic
 * @param {Object} document - MongoDB document
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<Object>} Processing result
 */
export async function processMidiDocumentWithRetry(document, maxRetries = 2) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await processMidiDocument(document);
        } catch (error) {
            lastError = error;

            if (attempt <= maxRetries) {
                const delay = attempt * 1000; // Exponential backoff
                logger.warn({
                    hash: document.midifile?.hash,
                    attempt,
                    maxRetries: maxRetries + 1,
                    delay,
                }, 'Retrying after error');

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}
