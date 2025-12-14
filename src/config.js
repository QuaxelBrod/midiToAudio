import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Application configuration loaded from environment variables
 */
const config = {
  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'midi_database',
    collection: process.env.MONGODB_COLLECTION || 'midi_collection',
  },

  // Soundfont Configuration
  soundfont: {
    path: process.env.SOUNDFONT_PATH || join(projectRoot, 'soundfont.sf2'),
  },

  // Output Configuration
  output: {
    directory: process.env.OUTPUT_DIRECTORY || join(projectRoot, 'output'),
    tempDirectory: process.env.TEMP_DIRECTORY || join(projectRoot, 'temp'),
  },

  // Audio Processing
  audio: {
    targetLUFS: parseFloat(process.env.TARGET_LUFS) || -14,
    sampleRate: parseInt(process.env.SAMPLE_RATE) || 44100,
    bitDepth: parseInt(process.env.BIT_DEPTH) || 16,
  },

  // MP3 Encoding
  mp3: {
    bitrate: parseInt(process.env.MP3_BITRATE) || 320,
    quality: parseInt(process.env.MP3_QUALITY) || 0, // 0 = best, 9 = worst
    embedFullMetadata: process.env.MP3_EMBED_FULL_METADATA !== 'false', // default: true
  },

  // Processing Configuration
  processing: {
    batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    concurrency: parseInt(process.env.CONCURRENCY) || 4,
    enableDuplicateCheck: process.env.ENABLE_DUPLICATE_CHECK !== 'false',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || join(projectRoot, 'logs', 'app.log'),
  },
};

/**
 * Validates the configuration
 * @throws {Error} if configuration is invalid
 */
export function validateConfig() {
  const errors = [];

  // Check MongoDB URI
  if (!config.mongodb.uri) {
    errors.push('MONGODB_URI is required');
  }

  // Check Soundfont exists
  if (!existsSync(config.soundfont.path)) {
    errors.push(`Soundfont file not found: ${config.soundfont.path}`);
  }

  // Validate audio parameters
  if (config.audio.targetLUFS > 0 || config.audio.targetLUFS < -70) {
    errors.push('TARGET_LUFS must be between -70 and 0');
  }

  if (config.audio.sampleRate < 8000 || config.audio.sampleRate > 192000) {
    errors.push('SAMPLE_RATE must be between 8000 and 192000');
  }

  if (![8, 16, 24, 32].includes(config.audio.bitDepth)) {
    errors.push('BIT_DEPTH must be 8, 16, 24, or 32');
  }

  // Validate MP3 parameters
  if (config.mp3.bitrate < 64 || config.mp3.bitrate > 320) {
    errors.push('MP3_BITRATE must be between 64 and 320');
  }

  if (config.mp3.quality < 0 || config.mp3.quality > 9) {
    errors.push('MP3_QUALITY must be between 0 and 9');
  }

  // Validate processing parameters
  if (config.processing.concurrency < 1) {
    errors.push('CONCURRENCY must be at least 1');
  }

  if (config.processing.batchSize < 1) {
    errors.push('BATCH_SIZE must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export default config;
