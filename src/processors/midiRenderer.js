import { writeFileSync, readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import config from '../config.js';
import { getTempFilePath, deleteTempFile } from '../utils/tempFiles.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ module: 'midiRenderer' });

/**
 * Checks if fluidsynth is available on the system
 * @returns {Promise<boolean>}
 */
async function checkFluidSynthAvailable() {
    return new Promise((resolve) => {
        const process = spawn('which', ['fluidsynth']);
        process.on('close', (code) => {
            resolve(code === 0);
        });
        process.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * Renders MIDI data to WAV audio file using FluidSynth command-line
 * @param {Buffer} midiBuffer - MIDI file data
 * @param {string} outputPath - Path to save WAV file
 * @returns {Promise<Object>} Rendering result with duration and path
 */
export async function renderMidiToWav(midiBuffer, outputPath) {
    // Check if FluidSynth is available
    const hasFluidSynth = await checkFluidSynthAvailable();
    if (!hasFluidSynth) {
        throw new Error('FluidSynth is not installed. Please install it: brew install fluid-synth (macOS) or apt-get install fluidsynth (Linux)');
    }

    // Check if soundfont exists
    if (!existsSync(config.soundfont.path)) {
        throw new Error(`Soundfont not found: ${config.soundfont.path}`);
    }

    const midiPath = getTempFilePath('.mid');

    try {
        // Write MIDI buffer to temporary file
        writeFileSync(midiPath, midiBuffer);
        logger.debug({ midiPath, size: midiBuffer.length }, 'Wrote MIDI to temp file');

        // Render MIDI to audio using FluidSynth
        logger.info({ midiPath, outputPath }, 'Rendering MIDI to WAV with FluidSynth...');
        const startTime = Date.now();

        await new Promise((resolve, reject) => {
            // FluidSynth command: fluidsynth -F output.wav soundfont.sf2 input.mid
            // FluidSynth command: fluidsynth -F output.wav -a file -m file soundfont.sf2 input.mid
            const args = [
                '-F', outputPath,              // Fast render to file
                '-a', 'file',                  // Audio driver: file (no hardware)
                '-m', 'file',                  // MIDI driver: file (no hardware)
                '-g', '1.0',                   // Gain
                '-r', config.audio.sampleRate.toString(),  // Sample rate
                '-T', 'wav',                   // Output type
                '-q',                          // Quiet mode (no shell)
                config.soundfont.path,         // Soundfont
                midiPath                       // MIDI file
            ];

            logger.debug({ args }, 'Executing FluidSynth');

            const fluidsynth = spawn('fluidsynth', args);

            let stderr = '';

            fluidsynth.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            fluidsynth.on('close', (code, signal) => {
                if (code !== 0) {
                    const exitInfo = code !== null ? `code ${code}` : `signal ${signal}`;
                    logger.error({ code, signal, stderr }, 'FluidSynth failed');
                    reject(new Error(`FluidSynth failed with ${exitInfo}: ${stderr}`));
                } else {
                    const duration = Date.now() - startTime;
                    logger.info({ duration, outputPath }, 'MIDI rendered successfully');
                    resolve();
                }
            });

            fluidsynth.on('error', (error) => {
                logger.error({ error: error.message }, 'FluidSynth process error');
                reject(new Error(`FluidSynth process error: ${error.message}`));
            });
        });

        return {
            success: true,
            outputPath,
            duration: Date.now() - startTime,
        };
    } catch (error) {
        logger.error({ error: error.message, midiPath }, 'MIDI rendering failed');
        throw new Error(`MIDI rendering failed: ${error.message}`);
    } finally {
        // Cleanup temporary MIDI file
        deleteTempFile(midiPath);
    }
}

/**
 * Closes the synthesizer and releases resources
 * (Not needed for command-line FluidSynth, kept for compatibility)
 */
export async function closeSynthesizer() {
    logger.debug('Synthesizer cleanup (no-op for FluidSynth CLI)');
}
