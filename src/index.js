#!/usr/bin/env node

import { runCli } from './cli.js';
import { validateConfig } from './config.js';
import { connect, disconnect } from './database/mongodb.js';
import { closeSynthesizer } from './processors/midiRenderer.js';
import { cleanupAllTempFiles } from './utils/tempFiles.js';
import logger from './utils/logger.js';

/**
 * Main entry point
 */
async function main() {
    try {
        // Validate configuration
        logger.info('Validating configuration...');
        validateConfig();

        // Connect to MongoDB
        logger.info('Connecting to database...');
        await connect();

        // Run CLI
        await runCli();

    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Application error');
        process.exit(1);
    } finally {
        // Cleanup
        logger.info('Cleaning up resources...');
        await closeSynthesizer();
        await disconnect();
        cleanupAllTempFiles();
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled promise rejection');
    process.exit(1);
});

// Run
main();
