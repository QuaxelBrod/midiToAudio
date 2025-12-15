import { mkdirSync, existsSync, renameSync, statSync } from 'fs';
import { promises as fs } from 'fs';
import { createLogger } from '../utils/logger.js';
import { getTempFilePath, deleteTempFile } from '../utils/tempFiles.js';

const logger = createLogger({ module: 'fileWriter' });

/**
 * Ensures a directory exists, creating it recursively if needed
 * @param {string} dirPath - Directory path
 */
export function ensureDirectory(dirPath) {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        logger.debug({ dirPath }, 'Created directory');
    }
}

/**
 * Checks if a file exists
 * @param {string} filePath - File path
 * @returns {boolean} True if file exists
 */
export function fileExists(filePath) {
    return existsSync(filePath);
}

/**
 * Gets available disk space in bytes
 * @param {string} path - Path to check
 * @returns {Promise<number>} Available space in bytes
 */
export async function getAvailableSpace(path) {
    try {
        const stats = await fs.statfs(path);
        return stats.bavail * stats.bsize;
    } catch (error) {
        logger.warn({ error: error.message }, 'Could not determine available disk space');
        // Return a large number if we can't determine space
        return Number.MAX_SAFE_INTEGER;
    }
}

/**
 * Estimates required disk space for a file
 * @param {string} filePath - File to check
 * @returns {number} File size in bytes
 */
export function getFileSize(filePath) {
    try {
        const stats = statSync(filePath);
        return stats.size;
    } catch (error) {
        logger.warn({ error: error.message, filePath }, 'Could not get file size');
        return 0;
    }
}

/**
 * Writes a file atomically using temp file + rename
 * @param {string} sourcePath - Source file to copy
 * @param {string} targetPath - Final destination path
 * @returns {Promise<Object>} Write result
 */
export async function writeFileAtomic(sourcePath, targetPath) {
    const startTime = Date.now();

    try {
        // Check available disk space
        const fileSize = getFileSize(sourcePath);
        const availableSpace = await getAvailableSpace(targetPath);

        if (fileSize > availableSpace) {
            throw new Error(`Insufficient disk space. Required: ${fileSize}, Available: ${availableSpace}`);
        }

        // Ensure target directory exists
        const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
        ensureDirectory(targetDir);

        // Copy to temp file in target directory first
        const tempPath = getTempFilePath('.mp3.tmp');
        await fs.copyFile(sourcePath, tempPath);

        // Atomic rename with fallback for EXDEV (cross-device)
        try {
            renameSync(tempPath, targetPath);
        } catch (renameError) {
            if (renameError.code === 'EXDEV') {
                logger.debug({ targetPath }, 'Cross-device link detected, falling back to copy+delete');
                await fs.copyFile(tempPath, targetPath);
                await fs.unlink(tempPath); // Clean up temp file manually
            } else {
                throw renameError;
            }
        }

        const duration = Date.now() - startTime;
        logger.info({ targetPath, duration, size: fileSize }, 'File written successfully');

        return {
            success: true,
            path: targetPath,
            size: fileSize,
            duration,
        };
    } catch (error) {
        logger.error({ error: error.message, targetPath }, 'File write failed');
        // Ensure temp file cleanup if copy failed
        try {
            if (existsSync(targetPath)) {
                // If we failed after copy but before return, check integrity?
                // For now, assume if error was thrown, write is invalid.
            }
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
        throw error;
    }
}

/**
 * Deletes a file if it exists
 * @param {string} filePath - File to delete
 */
export async function deleteFile(filePath) {
    try {
        if (existsSync(filePath)) {
            await fs.unlink(filePath);
            logger.debug({ filePath }, 'Deleted file');
        }
    } catch (error) {
        logger.warn({ error: error.message, filePath }, 'Failed to delete file');
    }
}
