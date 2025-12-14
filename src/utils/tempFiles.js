import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import config from '../config.js';
import logger from './logger.js';

// Track temporary files for cleanup
const tempFiles = new Set();

/**
 * Ensures temp directory exists
 */
export function ensureTempDirectory() {
    mkdirSync(config.output.tempDirectory, { recursive: true });
}

/**
 * Generates a unique temporary file path
 * @param {string} extension - File extension (e.g., '.mid', '.wav')
 * @returns {string} Temporary file path
 */
export function getTempFilePath(extension) {
    ensureTempDirectory();
    const filename = `${randomBytes(16).toString('hex')}${extension}`;
    const filepath = join(config.output.tempDirectory, filename);
    tempFiles.add(filepath);
    return filepath;
}

/**
 * Deletes a temporary file
 * @param {string} filepath - Path to temporary file
 */
export function deleteTempFile(filepath) {
    try {
        rmSync(filepath, { force: true });
        tempFiles.delete(filepath);
    } catch (error) {
        logger.warn({ filepath, error: error.message }, 'Failed to delete temp file');
    }
}

/**
 * Cleans up all tracked temporary files
 */
export function cleanupAllTempFiles() {
    let deletedCount = 0;
    for (const filepath of tempFiles) {
        try {
            rmSync(filepath, { force: true });
            tempFiles.delete(filepath);
            deletedCount++;
        } catch (error) {
            logger.warn({ filepath, error: error.message }, 'Failed to delete temp file during cleanup');
        }
    }
    logger.info({ deletedCount }, 'Cleaned up temporary files');
}

/**
 * Cleanup handler for process exit
 */
function exitHandler() {
    cleanupAllTempFiles();
}

// Register cleanup handlers
process.on('exit', exitHandler);
process.on('SIGINT', () => {
    logger.info('Received SIGINT, cleaning up...');
    cleanupAllTempFiles();
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, cleaning up...');
    cleanupAllTempFiles();
    process.exit(0);
});
