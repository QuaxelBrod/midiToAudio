#!/usr/bin/env node

import { runCli } from './cli.js';
import { validateConfig } from './config.js';
import { connect, disconnect } from './database/mongodb.js';
import { closeSynthesizer } from './processors/midiRenderer.js';
import { cleanupAllTempFiles } from './utils/tempFiles.js';
import logger from './utils/logger.js';


console.log('=== STARTING APP ===');
console.log('Node:', process.version);
console.log('CWD:', process.cwd());


/**
 * Main entry point
 */
async function main() {
    console.log('>>> Entering main()');
    try {
        // Validate configuration
        console.log('>>> Before validateConfig');
        logger.info('Validating configuration...');
        validateConfig();
        console.log('>>> After validateConfig - SUCCESS');

        // Connect to MongoDB
        console.log('>>> Before MongoDB connect');
        logger.info('Connecting to database...');
        await connect();
        console.log('>>> After MongoDB connect - SUCCESS');

        // Run CLI
        console.log('>>> Before runCli');
        await runCli();
        console.log('>>> After runCli - SUCCESS');

    } catch (error) {
        console.error('>>> CAUGHT ERROR:', error.message);
        logger.error({ error: error.message, stack: error.stack }, 'Application error');
        process.exit(1);
    } finally {
        // Cleanup
        console.log('>>> Cleanup starting');
        logger.info('Cleaning up resources...');
        await closeSynthesizer();
        await disconnect();
        cleanupAllTempFiles();
        console.log('>>> Cleanup done');
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
