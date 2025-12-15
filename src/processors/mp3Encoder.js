import ffmpeg from 'fluent-ffmpeg';
import NodeID3 from 'node-id3';
import { createLogger } from '../utils/logger.js';
import config from '../config.js';

const logger = createLogger({ module: 'mp3Encoder' });

/**
 * Extracts metadata for ID3 tags from MongoDB document
 * @param {Object} document - MongoDB document
 * @returns {Object} ID3 tag data
 */
function extractMetadata(document) {
    // Try different metadata sources in priority order
    const artist =
        document.redacted?.artist ||
        document.musicLLM?.artist ||
        document.musicbrainz?.top?.artist ||
        document.musicbrainz?.oldest?.artist ||
        'Unknown Artist';

    const title =
        document.redacted?.title ||
        document.musicLLM?.title ||
        document.musicbrainz?.top?.title ||
        document.musicbrainz?.oldest?.title ||
        (document.midifile?.fileName ? document.midifile.fileName.toString().replace(/\.mid$/i, '') : undefined) ||
        'Unknown Title';

    const album =
        document.redacted?.album ||
        document.musicLLM?.album ||
        document.musicbrainz?.top?.album ||
        document.musicbrainz?.oldest?.album ||
        'Unknown Album';

    // Extract year from firstReleaseDate
    let year;
    const releaseDate =
        document.musicbrainz?.top?.firstReleaseDate ||
        document.musicbrainz?.oldest?.firstReleaseDate;

    if (releaseDate) {
        const yearMatch = releaseDate.match(/(\d{4})/);
        year = yearMatch ? yearMatch[1] : undefined;
    }

    // Extract genre from tags
    const tags =
        document.redacted?.tags ||
        document.musicbrainz?.top?.tags ||
        document.musicbrainz?.oldest?.tags ||
        [];

    const genre = tags.length > 0 ? tags[0].name : undefined;

    // Build ID3 tags
    const id3Tags = {
        artist,
        title,
        album,
    };

    if (year) {
        id3Tags.year = year;
    }

    if (genre) {
        id3Tags.genre = genre;
    }

    // Add MongoDB reference information
    const mongoInfo = [];

    // Add MIDI hash
    if (document.midifile?.hash) {
        mongoInfo.push(`MIDI Hash: ${document.midifile.hash}`);
    }

    // Add MongoDB ObjectID
    if (document._id) {
        mongoInfo.push(`MongoDB ID: ${document._id.toString()}`);
    }

    // Add database info if available in config
    if (config.mongodb?.database && config.mongodb?.collection) {
        mongoInfo.push(`DB: ${config.mongodb.database}/${config.mongodb.collection}`);
    }

    // Combine all info in comment
    if (mongoInfo.length > 0) {
        id3Tags.comment = {
            language: 'eng',
            text: mongoInfo.join(' | '),
        };
    }

    // Add custom user-defined text frames (TXXX) for structured data
    id3Tags.userDefinedText = [];

    // MongoDB ObjectID as separate field
    if (document._id) {
        id3Tags.userDefinedText.push({
            description: 'MONGODB_ID',
            value: document._id.toString(),
        });
    }

    // MIDI hash as separate field
    if (document.midifile?.hash) {
        id3Tags.userDefinedText.push({
            description: 'MIDI_HASH',
            value: document.midifile.hash,
        });
    }

    // Add complete metadata as JSON (optional, can be disabled via config)
    if (config.mp3?.embedFullMetadata !== false) {
        const metadataSnapshot = {
            mongoId: document._id?.toString(),
            midiHash: document.midifile?.hash,
            fileName: document.midifile?.fileName,
            musicLLM: document.musicLLM,
            musicbrainz: {
                top: document.musicbrainz?.top ? {
                    artist: document.musicbrainz.top.artist,
                    title: document.musicbrainz.top.title,
                    firstReleaseDate: document.musicbrainz.top.firstReleaseDate,
                    tags: document.musicbrainz.top.tags,
                } : undefined,
            },
            redacted: document.redacted ? {
                artist: document.redacted.artist,
                title: document.redacted.title,
                album: document.redacted.album,
            } : undefined,
            processedAt: new Date().toISOString(),
        };

        id3Tags.userDefinedText.push({
            description: 'MONGODB_METADATA',
            value: JSON.stringify(metadataSnapshot),
        });
    }

    logger.debug({
        artist,
        title,
        album,
        year,
        genre,
        mongoId: document._id?.toString(),
        customFields: id3Tags.userDefinedText.length,
    }, 'Extracted metadata with MongoDB references');

    return id3Tags;
}

/**
 * Encodes WAV file to MP3 with ID3 tags
 * @param {string} inputPath - Path to input WAV file
 * @param {string} outputPath - Path to output MP3 file
 * @param {Object} document - MongoDB document for metadata
 * @returns {Promise<Object>} Encoding result
 */
export async function encodeToMp3(inputPath, outputPath, document) {
    const startTime = Date.now();

    try {
        logger.info({ inputPath, outputPath, bitrate: config.mp3.bitrate }, 'Encoding to MP3...');

        // Encode WAV to MP3
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .audioCodec('libmp3lame')
                .audioBitrate(config.mp3.bitrate)
                .audioQuality(config.mp3.quality)
                .audioChannels(2)
                .audioFrequency(config.audio.sampleRate)
                .on('error', (error) => {
                    logger.error({ error: error.message }, 'MP3 encoding failed');
                    reject(new Error(`MP3 encoding failed: ${error.message}`));
                })
                .on('end', () => {
                    logger.debug({ outputPath }, 'MP3 encoding complete');
                    resolve();
                })
                .save(outputPath);
        });

        // Extract and write ID3 tags
        const metadata = extractMetadata(document);
        const success = NodeID3.write(metadata, outputPath);

        if (!success) {
            logger.warn({ outputPath }, 'Failed to write ID3 tags');
        } else {
            logger.debug({ outputPath, metadata }, 'ID3 tags written successfully');
        }

        const duration = Date.now() - startTime;
        logger.info({ duration, outputPath }, 'MP3 encoding complete');

        return {
            success: true,
            outputPath,
            metadata,
            duration,
        };
    } catch (error) {
        logger.error({ error: error.message, inputPath }, 'MP3 encoding failed');
        throw error;
    }
}

/**
 * Verifies MP3 file integrity
 * @param {string} filePath - Path to MP3 file
 * @returns {Promise<Object>} Verification result
 */
export async function verifyMp3(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(new Error(`MP3 verification failed: ${err.message}`));
            } else {
                const isValid =
                    metadata.format.format_name.includes('mp3') &&
                    metadata.streams.length > 0;

                resolve({
                    valid: isValid,
                    duration: metadata.format.duration,
                    bitrate: metadata.format.bit_rate,
                });
            }
        });
    });
}
