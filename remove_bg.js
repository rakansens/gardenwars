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

        const image = await Jimp.read(inputPath);
        console.log(`Image Size: ${image.bitmap.width}x${image.bitmap.height}`);

        // Target colors to remove (white and checkerboard grays)
        const targetColors = [
            { r: 255, g: 255, b: 255 }, // Pure white
            { r: 204, g: 204, b: 204 }, // Light gray (checkerboard)
            { r: 153, g: 153, b: 153 }, // Medium gray (checkerboard)
            { r: 192, g: 192, b: 192 }, // Silver gray
            { r: 128, g: 128, b: 128 }, // Gray
            { r: 169, g: 169, b: 169 }, // Dark gray
            { r: 211, g: 211, b: 211 }, // Light gray variant
            { r: 238, g: 238, b: 238 }, // Very light gray
            { r: 221, g: 221, b: 221 }, // Another light gray
            { r: 170, g: 170, b: 170 }, // Checkerboard gray variant
            { r: 85, g: 85, b: 85 },    // Dark checkerboard
        ];

        const threshold = 30;

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];

            // Check if pixel is grayscale (R ≈ G ≈ B) with wider tolerance
            const colorDiff = Math.max(
                Math.abs(red - green),
                Math.abs(green - blue),
                Math.abs(red - blue)
            );
            const isGrayscale = colorDiff < 25; // Wider tolerance for color variation
            const avgColor = (red + green + blue) / 3;
            const isCheckerboardGray = isGrayscale && avgColor >= 60 && avgColor <= 255;

            // Catch near-white pixels
            const isNearWhite = red > 230 && green > 230 && blue > 230;

            // Catch near-gray pixels (slight color tint allowed)
            const isNearGray = colorDiff < 35 && avgColor >= 100 && avgColor <= 230;

            let minDist = Infinity;
            for (const targetColor of targetColors) {
                const dist = Math.sqrt(
                    Math.pow(red - targetColor.r, 2) +
                    Math.pow(green - targetColor.g, 2) +
                    Math.pow(blue - targetColor.b, 2)
                );
                if (dist < minDist) minDist = dist;
            }

            if (minDist < threshold || isCheckerboardGray || isNearWhite || isNearGray) {
                this.bitmap.data[idx + 3] = 0; // Set Alpha to 0
            }
        });

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
