import { getCollection } from './database/mongodb.js';
import logger from './utils/logger.js';

/**
 * Debug utility to inspect MongoDB document structure
 * @param {string} hash - MIDI file hash to inspect
 */
export async function inspectMidiDocument(hash) {
    const collection = await getCollection();
    const document = await collection.findOne({ 'midifile.hash': hash });

    if (!document) {
        logger.error({ hash }, 'Document not found');
        return;
    }

    logger.info({ hash }, 'Inspecting MIDI document structure:');

    console.log('\n=== MIDI Document Structure ===\n');
    console.log('Top-level keys:', Object.keys(document));

    if (document.midifile) {
        console.log('\nmidifile keys:', Object.keys(document.midifile));

        if (document.midifile.data) {
            const data = document.midifile.data;
            console.log('\nmidifile.data:');
            console.log('  - Type:', typeof data);
            console.log('  - Constructor:', data.constructor?.name);
            console.log('  - Keys:', Object.keys(data));
            console.log('  - Is Buffer:', Buffer.isBuffer(data));

            if (data.buffer) {
                console.log('\nmidifile.data.buffer:');
                console.log('  - Type:', typeof data.buffer);
                console.log('  - Constructor:', data.buffer?.constructor?.name);
                console.log('  - Is Buffer:', Buffer.isBuffer(data.buffer));
                console.log('  - Length:', data.buffer?.length);
            }

            if (typeof data.value === 'function') {
                console.log('\nmidifile.data has .value() method');
                const value = data.value();
                console.log('  - value() Type:', typeof value);
                console.log('  - value() Constructor:', value?.constructor?.name);
                console.log('  - value() Is Buffer:', Buffer.isBuffer(value));
                console.log('  - value() Length:', value?.length);
            }
        }
    }

    console.log('\n=== End Structure ===\n');
}

/**
 * Runs inspection on the first MIDI document
 */
export async function inspectFirstDocument() {
    const collection = await getCollection();
    const document = await collection.findOne({});

    if (!document) {
        logger.error('No documents found in collection');
        return;
    }

    const hash = document.midifile?.hash;
    if (hash) {
        await inspectMidiDocument(hash);
    } else {
        logger.error('First document has no midifile.hash');
    }
}
