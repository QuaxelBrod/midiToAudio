#!/usr/bin/env node

import NodeID3 from 'node-id3';
import { readFileSync } from 'fs';

const filePath = process.argv[2];

if (!filePath) {
    console.error('Usage: node src/inspectMp3.js <path-to-mp3>');
    process.exit(1);
}

console.log(`\n=== MP3 Metadata Inspection ===\n`);
console.log(`File: ${filePath}\n`);

const tags = NodeID3.read(filePath);

if (!tags) {
    console.error('Failed to read ID3 tags');
    process.exit(1);
}

// Display standard tags
console.log('Standard Tags:');
console.log('  Artist:', tags.artist || 'N/A');
console.log('  Title:', tags.title || 'N/A');
console.log('  Album:', tags.album || 'N/A');
console.log('  Year:', tags.year || 'N/A');
console.log('  Genre:', tags.genre || 'N/A');
console.log('  Comment:', tags.comment?.text || 'N/A');

// Display custom user-defined tags
if (tags.userDefinedText && tags.userDefinedText.length > 0) {
    console.log('\nCustom MongoDB Tags:');
    tags.userDefinedText.forEach(tag => {
        if (tag.description === 'MONGODB_METADATA') {
            console.log(`  ${tag.description}:`);
            try {
                const metadata = JSON.parse(tag.value);
                console.log(JSON.stringify(metadata, null, 2).split('\n').map(line => '    ' + line).join('\n'));
            } catch (e) {
                console.log(`    ${tag.value}`);
            }
        } else {
            console.log(`  ${tag.description}: ${tag.value}`);
        }
    });
}

console.log('\n=== End Inspection ===\n');
