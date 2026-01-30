import { removeBackground } from '@imgly/background-removal-node';
import { readFile, writeFile } from 'fs/promises';

const inputPath = process.argv[2];

if (!inputPath) {
    console.error('Usage: node remove_bg_ai.mjs <path_to_image>');
    process.exit(1);
}

async function processImage() {
    try {
        console.log(`Processing: ${inputPath}`);

        // Read the image file
        const imageBuffer = await readFile(inputPath);
        const blob = new Blob([imageBuffer], { type: 'image/png' });

        console.log('Running AI background removal... (this may take a moment)');

        // Remove background using AI
        const resultBlob = await removeBackground(blob);

        // Convert blob to buffer and save
        const arrayBuffer = await resultBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await writeFile(inputPath, buffer);

        console.log('Background removed successfully!');
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

processImage();
