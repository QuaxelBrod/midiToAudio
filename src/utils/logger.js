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

/**
 * Creates a Pino logger instance
 */
const logger = pino({
    level: config.logging.level,
    transport: {
        targets: [
            {
                target: 'pino-pretty',
                level: config.logging.level,
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            },
            {
                target: 'pino/file',
                level: config.logging.level,
                options: {
                    destination: config.logging.file,
                    mkdir: true,
                },
            },
        ],
    },
});

// Remove temp debug logging
// console.log('>>> LOGGER: Initialized in SYNC/DEBUG mode (no file writing)');

/**
 * Creates a child logger with additional context
 * @param {Object} bindings - Additional context to bind to logger
 * @returns {Object} Child logger
 */
export function createLogger(bindings) {
    return logger.child(bindings);
}

export default logger;
