#!/usr/bin/env node

import { connect, disconnect } from './database/mongodb.js';
import { inspectFirstDocument } from './debug.js';
import { validateConfig } from './config.js';
import logger from './utils/logger.js';

async function main() {
    try {
        validateConfig();
        await connect();
        await inspectFirstDocument();
    } catch (error) {
        logger.error({ error: error.message }, 'Debug failed');
    } finally {
        await disconnect();
    }
}

main();
