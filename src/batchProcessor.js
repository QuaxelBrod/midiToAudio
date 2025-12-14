import { getMidiDocumentsCursor, countMidiDocuments } from './database/queries.js';
import { processMidiDocumentWithRetry } from './pipeline.js';
import { createLogger } from './utils/logger.js';
import config from './config.js';

const logger = createLogger({ module: 'batchProcessor' });

/**
 * Statistics for batch processing
 */
class ProcessingStats {
    constructor() {
        this.total = 0;
        this.processed = 0;
        this.successful = 0;
        this.failed = 0;
        this.startTime = Date.now();
        this.errors = [];
    }

    recordSuccess() {
        this.processed++;
        this.successful++;
    }

    recordFailure(error) {
        this.processed++;
        this.failed++;
        this.errors.push(error);
    }

    getProgress() {
        return this.total > 0 ? (this.processed / this.total * 100).toFixed(2) : 0;
    }

    getDuration() {
        return Date.now() - this.startTime;
    }

    getRate() {
        const durationSeconds = this.getDuration() / 1000;
        return durationSeconds > 0 ? (this.processed / durationSeconds).toFixed(2) : 0;
    }

    getSummary() {
        return {
            total: this.total,
            processed: this.processed,
            successful: this.successful,
            failed: this.failed,
            progress: `${this.getProgress()}%`,
            duration: this.getDuration(),
            rate: `${this.getRate()} docs/sec`,
        };
    }
}

/**
 * Processes MIDI documents in batches with concurrency control
 * @param {Object} options - Processing options
 * @param {number} options.limit - Maximum number of documents to process
 * @param {Object} options.filter - MongoDB filter query
 * @param {number} options.concurrency - Number of parallel processes
 * @returns {Promise<Object>} Processing statistics
 */
export async function processBatch({
    limit = null,
    filter = {},
    concurrency = config.processing.concurrency
} = {}) {
    const stats = new ProcessingStats();

    try {
        // Count total documents
        stats.total = limit || await countMidiDocuments(filter);
        logger.info({
            total: stats.total,
            concurrency,
            filter,
        }, 'Starting batch processing');

        // Get cursor for streaming
        const cursor = await getMidiDocumentsCursor(filter);
        if (limit) {
            cursor.limit(limit);
        }

        // Process documents with concurrency control using Promise pool
        const activePromises = new Set();

        for await (const document of cursor) {
            // Process document
            const promise = (async () => {
                try {
                    const result = await processMidiDocumentWithRetry(document);
                    stats.recordSuccess();

                    logger.info({
                        hash: result.hash,
                        progress: stats.getProgress(),
                        processed: stats.processed,
                        total: stats.total,
                    }, 'Document processed successfully');

                    // Log progress every 10 documents
                    if (stats.processed % 10 === 0) {
                        logger.info(stats.getSummary(), 'Progress update');
                    }

                    return result;
                } catch (error) {
                    const hash = document.midifile?.hash || 'unknown';
                    stats.recordFailure({ hash, error: error.message });

                    logger.error({
                        hash,
                        error: error.message,
                        progress: stats.getProgress(),
                    }, 'Document processing failed');
                }
            })();

            // Add to active promises
            activePromises.add(promise);
            promise.finally(() => activePromises.delete(promise));

            // Wait if we've reached concurrency limit
            if (activePromises.size >= concurrency) {
                await Promise.race(activePromises);
            }
        }

        // Wait for all remaining promises to complete
        await Promise.all(activePromises);

        const summary = stats.getSummary();
        logger.info(summary, 'Batch processing completed');

        return summary;

    } catch (error) {
        logger.error({ error: error.message }, 'Batch processing error');
        throw error;
    }
}

/**
 * Validates batch processing options
 * @param {Object} options - Options to validate
 * @throws {Error} if options are invalid
 */
export function validateBatchOptions(options) {
    if (options.limit !== null && (options.limit < 1 || !Number.isInteger(options.limit))) {
        throw new Error('Limit must be a positive integer or null');
    }

    if (options.concurrency < 1 || options.concurrency > 20) {
        throw new Error('Concurrency must be between 1 and 20');
    }

    if (options.filter && typeof options.filter !== 'object') {
        throw new Error('Filter must be an object');
    }
}
