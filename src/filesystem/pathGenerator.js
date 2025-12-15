import { join, dirname } from 'path';
import config from '../config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ module: 'pathGenerator' });

/**
 * Sanitizes a string for use in file paths
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizePathComponent(str) {
    if (!str || typeof str !== 'string') {
        return 'Unknown';
    }

    return str
        // Remove or replace invalid filesystem characters
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
        // Remove leading/trailing dots and spaces
        .replace(/^[\s.]+|[\s.]+$/g, '')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        // Limit length
        .substring(0, 200)
        // Fallback if empty after sanitization
        || 'Unknown';
}

/**
 * Extracts artist name from document with fallback strategy
 * @param {Object} document - MongoDB document
 * @returns {string} Artist name
 */
function extractArtist(document) {
    return (
        document.musicLLM?.artist ||
        document.musicbrainz?.top?.artist ||
        document.redacted?.artist ||
        document.musicbrainz?.oldest?.artist ||
        'Unknown Artist'
    );
}

/**
 * Extracts album name from document with fallback strategy
 * @param {Object} document - MongoDB document
 * @returns {string} Album name
 */
function extractAlbum(document) {
    return (
        document.musicLLM?.album ||
        document.redacted?.album ||
        document.redacted?.release ||
        'Unknown Album'
    );
}

/**
 * Extracts title from document with fallback strategy
 * @param {Object} document - MongoDB document
 * @returns {string} Title
 */
function extractTitle(document) {
    return (
        document.musicLLM?.title ||
        document.musicbrainz?.top?.title ||
        document.redacted?.title ||
        document.musicbrainz?.oldest?.title ||
        (document.midifile?.fileName ? document.midifile.fileName.toString().replace(/\.mid$/i, '') : undefined) ||
        'Unknown Title'
    );
}

/**
 * Generates an output file path for an MP3 file based on metadata
 * @param {Object} document - MongoDB document
 * @param {string} hash - MIDI file hash for collision avoidance
 * @returns {string} Full output path
 */
export function generateOutputPath(document, hash) {
    const artist = sanitizePathComponent(extractArtist(document));
    const album = sanitizePathComponent(extractAlbum(document));
    const title = sanitizePathComponent(extractTitle(document));

    // Build path: Artist/Album/Title.mp3
    const relativePath = join(artist, album, `${title}.mp3`);
    const fullPath = join(config.output.directory, relativePath);

    logger.debug({ artist, album, title, fullPath }, 'Generated output path');
    return fullPath;
}

/**
 * Generates a unique output path to avoid collisions
 * @param {string} basePath - Base output path
 * @param {string} hash - MIDI hash for uniqueness
 * @returns {string} Unique output path
 */
export function generateUniquePath(basePath, hash) {
    // If collision occurs, append hash suffix
    const ext = '.mp3';
    const pathWithoutExt = basePath.slice(0, -ext.length);
    const shortHash = hash.substring(0, 8);
    const uniquePath = `${pathWithoutExt}_${shortHash}${ext}`;

    logger.debug({ basePath, uniquePath }, 'Generated unique path with hash suffix');
    return uniquePath;
}

/**
 * Gets the directory path from a file path
 * @param {string} filePath - Full file path
 * @returns {string} Directory path
 */
export function getDirectoryPath(filePath) {
    return dirname(filePath);
}
