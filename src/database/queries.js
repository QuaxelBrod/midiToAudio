import { getCollection } from './mongodb.js';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Gets MIDI documents from the database
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of documents to return
 * @param {number} options.skip - Number of documents to skip
 * @param {Object} options.filter - Additional filter criteria
 * @returns {Promise<Array>} Array of MIDI documents
 */
export async function getMidiDocuments({ limit = 10, skip = 0, filter = {} } = {}) {
    const collection = await getCollection();

    const query = { ...filter };

    // Add duplicate check filter if enabled
    if (config.processing.enableDuplicateCheck) {
        query['midiToAudioProcessing.status'] = { $ne: 'completed' };
    }

    const documents = await collection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();

    logger.debug({ count: documents.length, skip, limit }, 'Retrieved MIDI documents');
    return documents;
}

/**
 * Checks if a MIDI file has already been processed
 * @param {string} hash - MIDI file hash
 * @returns {Promise<boolean>} True if already processed
 */
export async function isAlreadyProcessed(hash) {
    const collection = await getCollection();

    const document = await collection.findOne({
        'midifile.hash': hash,
        'midiToAudioProcessing.status': 'completed',
    });

    return document !== null;
}

/**
 * Updates the processing status of a MIDI document
 * @param {string} hash - MIDI file hash
 * @param {string} status - Processing status ('processing', 'completed', 'failed')
 * @param {Object} metadata - Additional metadata to store
 * @returns {Promise<Object>} Update result
 */
export async function updateProcessingStatus(hash, status, metadata = {}) {
    const collection = await getCollection();

    const update = {
        $set: {
            'midiToAudioProcessing.status': status,
            'midiToAudioProcessing.lastUpdated': new Date(),
            ...Object.entries(metadata).reduce((acc, [key, value]) => {
                acc[`midiToAudioProcessing.${key}`] = value;
                return acc;
            }, {}),
        },
    };

    const result = await collection.updateOne(
        { 'midifile.hash': hash },
        update
    );

    logger.debug({ hash, status, matched: result.matchedCount }, 'Updated processing status');
    return result;
}

/**
 * Counts total MIDI documents matching filter
 * @param {Object} filter - Filter criteria
 * @returns {Promise<number>} Document count
 */
export async function countMidiDocuments(filter = {}) {
    const collection = await getCollection();

    const query = { ...filter };

    // Add duplicate check filter if enabled
    if (config.processing.enableDuplicateCheck) {
        query['midiToAudioProcessing.status'] = { $ne: 'completed' };
    }

    const count = await collection.countDocuments(query);
    logger.debug({ count, filter }, 'Counted MIDI documents');
    return count;
}

/**
 * Creates a cursor for streaming MIDI documents
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} MongoDB cursor
 */
export async function getMidiDocumentsCursor(filter = {}) {
    const collection = await getCollection();

    const query = { ...filter };

    // Add duplicate check filter if enabled
    if (config.processing.enableDuplicateCheck) {
        query['midiToAudioProcessing.status'] = { $ne: 'completed' };
    }

    return collection.find(query);
}
