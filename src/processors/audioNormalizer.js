import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import config from '../config.js';
import { getTempFilePath, deleteTempFile } from '../utils/tempFiles.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ module: 'audioNormalizer' });

/**
 * Analyzes audio file to get current loudness statistics
 * @param {string} inputPath - Path to audio file
 * @returns {Promise<Object>} Loudness statistics
 */
async function analyzeLoudness(inputPath) {
    return new Promise((resolve, reject) => {
        let loudnessData = '';

        ffmpeg(inputPath)
            .audioFilters(`loudnorm=I=${config.audio.targetLUFS}:print_format=json`)
            .outputFormat('null')
            .on('stderr', (stderrLine) => {
                loudnessData += stderrLine + '\n';
            })
            .on('error', (error) => {
                logger.error({ error: error.message }, 'Loudness analysis failed');
                reject(new Error(`Loudness analysis failed: ${error.message}`));
            })
            .on('end', () => {
                try {
                    // Extract JSON from stderr output
                    const jsonMatch = loudnessData.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        throw new Error('Could not parse loudness data');
                    }

                    const stats = JSON.parse(jsonMatch[0]);
                    logger.debug({ stats }, 'Loudness analysis complete');
                    resolve(stats);
                } catch (error) {
                    reject(new Error(`Failed to parse loudness data: ${error.message}`));
                }
            })
            .save('-');
    });
}

/**
 * Normalizes audio to target LUFS using two-pass loudnorm
 * @param {string} inputPath - Path to input WAV file
 * @param {string} outputPath - Path to output normalized WAV file
 * @returns {Promise<Object>} Normalization result
 */
export async function normalizeAudio(inputPath, outputPath) {
    const startTime = Date.now();

    try {
        logger.info({ inputPath, targetLUFS: config.audio.targetLUFS }, 'Starting loudness analysis...');

        // First pass: analyze
        const stats = await analyzeLoudness(inputPath);

        const {
            input_i: inputIntegrated,
            input_tp: inputTruePeak,
            input_lra: inputLRA,
            input_thresh: inputThresh,
        } = stats;

        // Check for silence (input_i is -inf)
        if (inputIntegrated === '-inf' || parseFloat(inputIntegrated) <= -70) {
            logger.warn({ inputPath, stats }, 'Audio is silent or too quiet, skipping normalization');
            throw new Error('Audio is silent (Input Integrated: -inf)');
        }

        logger.info({
            currentLUFS: inputIntegrated,
            targetLUFS: config.audio.targetLUFS,
            truePeak: inputTruePeak,
        }, 'Applying normalization...');

        // Second pass: normalize with measured parameters
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .audioFilters(
                    `loudnorm=I=${config.audio.targetLUFS}:TP=-1.5:LRA=11:` +
                    `measured_I=${inputIntegrated}:` +
                    `measured_LRA=${inputLRA}:` +
                    `measured_TP=${inputTruePeak}:` +
                    `measured_thresh=${inputThresh}:` +
                    `linear=true:print_format=summary`
                )
                .audioCodec('pcm_s16le')
                .audioFrequency(config.audio.sampleRate)
                .audioChannels(2)
                .on('error', (error) => {
                    logger.error({ error: error.message }, 'Normalization failed');
                    reject(new Error(`Normalization failed: ${error.message}`));
                })
                .on('end', () => {
                    const duration = Date.now() - startTime;
                    logger.info({ duration, outputPath }, 'Normalization complete');
                    resolve();
                })
                .save(outputPath);
        });

        return {
            success: true,
            outputPath,
            originalLUFS: parseFloat(inputIntegrated),
            targetLUFS: config.audio.targetLUFS,
            duration: Date.now() - startTime,
        };
    } catch (error) {
        logger.error({ error: error.message, inputPath }, 'Audio normalization failed');
        throw error;
    }
}

/**
 * Gets audio file duration in seconds
 * @param {string} filePath - Path to audio file
 * @returns {Promise<number>} Duration in seconds
 */
export async function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(metadata.format.duration);
            }
        });
    });
}
