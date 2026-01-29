const fs = require('fs');
const { Jimp } = require('jimp');

// Usage: node remove_bg.js <path_to_image>

const inputPath = process.argv[2];

if (!inputPath) {
    console.error('Please provide an image path.');
    process.exit(1);
}

async function processImage() {
    try {
        console.log(`Processing: ${inputPath}`);

        // Read the image
        const image = await Jimp.read(inputPath);

        console.log(`Image Size: ${image.bitmap.width}x${image.bitmap.height}`);

        // Sample the top-left pixel to get the background color
        // Assuming the background is solid and uniform, and starts at (0,0)
        // Or we can assume it's pure white (0xFFFFFFFF) as per instructions.

        // Let's assume white.
        const targetColor = { r: 255, g: 255, b: 255, a: 255 };

        // Or sample:
        // const bgColor = Jimp.intToRGBA(image.getPixelColor(0, 0));
        // console.log(`Background color detected: R=${bgColor.r}, G=${bgColor.g}, B=${bgColor.b}`);

        // Use a threshold/distance for similarity
        const threshold = 10; // 0-255 distance

        // Scan every pixel
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            const alpha = this.bitmap.data[idx + 3];

            // Calculate distance from white
            // Simple Euclidean or Manhattan distance
            const dist = Math.sqrt(
                Math.pow(red - targetColor.r, 2) +
                Math.pow(green - targetColor.g, 2) +
                Math.pow(blue - targetColor.b, 2)
            );

            // If it's close to white, make it transparent
            if (dist < threshold) {
                this.bitmap.data[idx + 3] = 0; // Set Alpha to 0
            }
        });

        // Write back to the same file (overwrite)
        // Need to wait for write to finish. Jimp write uses callback.
        await new Promise((resolve, reject) => {
            image.write(inputPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('Background removed successfully.');

    } catch (err) {
        console.error('Error processing image:', err);
    }
}

processImage();
