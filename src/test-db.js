import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env explicitly
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') }); // Try loading from root if running from src
dotenv.config(); // Try default location

async function testConnection() {
    const uri = process.env.MONGODB_URI;

    console.log('--- MongoDB Connection Test ---');
    console.log(`URI defined: ${uri ? 'YES' : 'NO'}`);

    if (!uri) {
        console.error('❌ MONGODB_URI is missing in environment!');
        process.exit(1);
    }

    // Mask credentials for logging
    console.log(`Target: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);

    const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('✅ Connection to Server: SUCCESS');

        const dbName = process.env.MONGODB_DATABASE || 'mididb';
        const db = client.db(dbName);

        // Simple command to verify auth and read permissions
        const ping = await db.command({ ping: 1 });
        console.log('✅ Database Ping: SUCCESS', ping);

        console.log('--- Test Passed ---');
    } catch (err) {
        console.error('❌ Connection FAILED');
        console.error('Name:', err.name);
        console.error('Message:', err.message);

        if (err.message.includes('ECONNREFUSED')) {
            console.error('\nHINT: The server is not reachable. Check IP and Port.');
            console.error('      If using "localhost", remember that localhost inside Docker is the container itself.');
            console.error('      Use the host IP (e.g. 192.168.178.29) or host.docker.internal.');
        }
    } finally {
        await client.close();
    }
}

testConnection();
