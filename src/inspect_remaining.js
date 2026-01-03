
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DATABASE || 'midi_database';
const collectionName = process.env.MONGODB_COLLECTION || 'midi_collection';

async function inspectRemaining() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Find docs that are NOT completed and NOT failed
        // This corresponds to the "Remaining" count we suspect (approx 535)
        const query = {
            'midiToAudioProcessing.status': { $nin: ['completed', 'failed'] }
        };

        const count = await collection.countDocuments(query);
        console.log(`Found ${count} remaining documents (not completed, not failed).`);

        if (count > 0) {
            console.log('Inspecting first 5 documents...');
            const docs = await collection.find(query).limit(5).toArray();

            docs.forEach((doc, index) => {
                console.log(`\n--- Document ${index + 1} ---`);
                console.log(`_id: ${doc._id}`);
                console.log(`midifile.hash: ${doc.midifile?.hash}`);
                console.log(`midifile.data exists: ${!!doc.midifile?.data}`);
                if (doc.midifile?.data) {
                    console.log(`midifile.data type: ${typeof doc.midifile.data}`);
                    if (Buffer.isBuffer(doc.midifile.data)) console.log(`midifile.data length: ${doc.midifile.data.length}`);
                }
                console.log(`processing status: ${doc.midiToAudioProcessing?.status}`);
                console.log(`midiToAudioProcessing:`, doc.midiToAudioProcessing);
            });
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

inspectRemaining();
