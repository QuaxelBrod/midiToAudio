import { MongoClient } from 'mongodb';
import config from '../config.js';
import logger from '../utils/logger.js';

let client = null;
let db = null;

/**
 * Connects to MongoDB
 * @returns {Promise<Object>} Database instance
 */
export async function connect() {
    if (db) {
        return db;
    }

    try {
        logger.info({ uri: config.mongodb.uri }, 'Connecting to MongoDB...');
        client = new MongoClient(config.mongodb.uri, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
        });

        await client.connect();
        db = client.db(config.mongodb.database);

        logger.info({ database: config.mongodb.database }, 'Connected to MongoDB');
        return db;
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to connect to MongoDB');
        throw error;
    }
}

/**
 * Gets the MIDI collection
 * @returns {Promise<Object>} MongoDB collection
 */
export async function getCollection() {
    const database = await connect();
    return database.collection(config.mongodb.collection);
}

/**
 * Closes the MongoDB connection
 */
export async function disconnect() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        logger.info('Disconnected from MongoDB');
    }
}

/**
 * Checks MongoDB connection health
 * @returns {Promise<boolean>} True if connected
 */
export async function healthCheck() {
    try {
        const database = await connect();
        await database.admin().ping();
        return true;
    } catch (error) {
        logger.error({ error: error.message }, 'MongoDB health check failed');
        return false;
    }
}

// Cleanup on process exit
process.on('exit', () => {
    if (client) {
        client.close();
    }
});
