import pino from 'pino';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import config from '../config.js';

// Ensure log directory exists
try {
    mkdirSync(dirname(config.logging.file), { recursive: true });
} catch (error) {
    // Directory already exists or cannot be created
}

// Direct synchronous logger for debugging Docker issues
const logger = pino({
    level: config.logging.level || 'debug',
    // transport: { ... } // DISABLED for debugging
    // Use basic formatting or json
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
});

// If we are in docker, we just want stdout logs mostly
console.log('>>> LOGGER: Initialized in SYNC/DEBUG mode (no file writing)');

/**
 * Creates a child logger with additional context
 * @param {Object} bindings - Additional context to bind to logger
 * @returns {Object} Child logger
 */
export function createLogger(bindings) {
    return logger.child(bindings);
}

export default logger;
