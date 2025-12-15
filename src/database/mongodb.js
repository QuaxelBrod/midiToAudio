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
    // console.log('>>> DB: connect() called');
    if (db) {
        // console.log('>>> DB: Already connected, returning db');
        return db;
    }

    try {
        // console.log('>>> DB: accessing config.mongodb.uri');
        const uri = config.mongodb.uri;
        // console.log('>>> DB: URI length:', uri ? uri.length : 'undefined');
        // Mask password for logging if present
        const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
        // console.log('>>> DB: URI (masked):', maskedUri);

        // console.log('>>> DB: calling logger.info');
        logger.info({ uri: maskedUri }, 'Connecting to MongoDB...');

        // console.log('>>> DB: creating MongoClient');
        client = new MongoClient(uri, {
            // Simplified options based on successful test script
            maxPoolSize: 5,  // Reduced from 10
            // minPoolSize: 2, // REMOVED: This can cause hangs on startup if connections aren't immediate
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000, // Added explicit connect timeout
            socketTimeoutMS: 45000, // Added socket timeout
        });

        // Add Debug Listeners (Disabled for production)
        // client.on('connectionReady', (e) => console.log('>>> DB EVENT: connectionReady', e.connectionId));
        // client.on('connectionClosed', (e) => console.log('>>> DB EVENT: connectionClosed', e.connectionId, e.reason));
        // client.on('connectionCheckOutStarted', (e) => console.log('>>> DB EVENT: connectionCheckOutStarted'));
        // client.on('connectionCheckOutFailed', (e) => console.log('>>> DB EVENT: connectionCheckOutFailed', e.reason));
        // client.on('serverHeartbeatStarted', (e) => console.log('>>> DB EVENT: serverHeartbeatStarted', e.connectionId));
        // client.on('serverHeartbeatSucceeded', (e) => console.log('>>> DB EVENT: serverHeartbeatSucceeded', e.connectionId));
        // client.on('serverHeartbeatFailed', (e) => console.log('>>> DB EVENT: serverHeartbeatFailed', e.connectionId, e.failure));
        // console.log('>>> DB: Event listeners attached');

        // console.log('>>> DB: awaiting client.connect()');
        await client.connect();
        // console.log('>>> DB: client.connect() returned');

        db = client.db(config.mongodb.database);
        // console.log('>>> DB: db instance created');

        logger.info({ database: config.mongodb.database }, 'Connected to MongoDB');
        return db;
    } catch (error) {
        // console.error('>>> DB: ERROR in connect():', error.message);
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
