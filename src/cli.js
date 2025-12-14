import { Command } from 'commander';
import logger from './utils/logger.js';
import { processBatch, validateBatchOptions } from './batchProcessor.js';
import config from './config.js';

const program = new Command();

program
    .name('midi-to-audio')
    .description('Convert MIDI files from MongoDB to normalized MP3 files')
    .version('1.0.0');

program
    .option('-l, --limit <number>', 'Maximum number of MIDI files to process', parseInt)
    .option('-c, --concurrency <number>', 'Number of parallel processes', parseInt, config.processing.concurrency)
    .option('-f, --filter <json>', 'MongoDB filter query as JSON string')
    .option('--dry-run', 'Simulate processing without writing files')
    .option('--stats-only', 'Show statistics without processing');

/**
 * Parses and validates CLI options
 * @param {Object} options - Raw CLI options
 * @returns {Object} Validated options
 */
function parseOptions(options) {
    const batchOptions = {
        limit: options.limit || null,
        concurrency: options.concurrency,
        filter: {},
    };

    // Parse filter if provided
    if (options.filter) {
        try {
            batchOptions.filter = JSON.parse(options.filter);
        } catch (error) {
            logger.error({ error: error.message }, 'Invalid filter JSON');
            throw new Error('Filter must be valid JSON');
        }
    }

    // Validate options
    validateBatchOptions(batchOptions);

    return {
        ...batchOptions,
        dryRun: options.dryRun || false,
        statsOnly: options.statsOnly || false,
    };
}

/**
 * Main CLI handler
 */
export async function runCli() {
    program.parse();
    const options = program.opts();

    try {
        logger.info({ options }, 'Starting MIDI to Audio converter');

        const parsedOptions = parseOptions(options);

        if (parsedOptions.dryRun) {
            logger.info('DRY RUN MODE - No files will be written');
            // In dry run, just validate configuration
            logger.info({
                config: {
                    mongodb: config.mongodb.uri,
                    soundfont: config.soundfont.path,
                    output: config.output.directory,
                }
            }, 'Configuration validated');
            return;
        }

        if (parsedOptions.statsOnly) {
            const { countMidiDocuments } = await import('./database/queries.js');
            const count = await countMidiDocuments(parsedOptions.filter);
            logger.info({ count, filter: parsedOptions.filter }, 'Statistics');
            return;
        }

        // Run batch processing
        const stats = await processBatch(parsedOptions);

        logger.info(stats, 'Processing completed');

        // Exit with error code if there were failures
        if (stats.failed > 0) {
            logger.warn({ failed: stats.failed }, 'Some documents failed to process');
            process.exit(1);
        }

    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Fatal error');
        process.exit(1);
    }
}

export default program;
