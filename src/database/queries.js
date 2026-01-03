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
 * Updates the processing status of a MIDI document by ID
 * @param {Object} id - MongoDB document ID
 * @param {string} status - Processing status ('processing', 'completed', 'failed')
 * @param {Object} metadata - Additional metadata to store
 * @returns {Promise<Object>} Update result
 */
export async function updateProcessingStatusById(id, status, metadata = {}) {
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
        { _id: id },
        update
    );

    logger.debug({ id, status, matched: result.matchedCount }, 'Updated processing status by ID');
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

    // Exclude failed items if retry is disabled
    if (!config.processing.retryFailed) {
        // If we already have a status filter, we need to be careful not to overwrite it blindly.
        // But usually duplicate check sets $ne: completed.
        // We want status NOT IN ['completed', 'failed'] effectively.

        if (query['midiToAudioProcessing.status']) {
            // If existing filter is $ne: completed, we change it to $nin: [completed, failed]
            // Simply verifying common case.
            if (query['midiToAudioProcessing.status'].$ne === 'completed') {
                delete query['midiToAudioProcessing.status'].$ne;
                query['midiToAudioProcessing.status'].$nin = ['completed', 'failed'];
            } else {
                // Fallback for complex queries: add failed to exclusion if possible or just set it
                // For now, simple approach: $ne failed. BUT combining multiple ne is tricky in simple syntax without $and
                // Let's use $nin for both if duplicate check is on.
            }
        } else {
            query['midiToAudioProcessing.status'] = { $ne: 'failed' };
        }
    }

    // Simplification for reliability:
    const statusExclusions = [];
    if (config.processing.enableDuplicateCheck) statusExclusions.push('completed');
    if (!config.processing.retryFailed) statusExclusions.push('failed');

    if (statusExclusions.length > 0) {
        query['midiToAudioProcessing.status'] = { $nin: statusExclusions };
    }

    return collection.find(query);
}
