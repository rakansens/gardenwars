/**
 * remove_white.js - 白背景(#FFFFFF)を透過に変換
 * 緑色のキャラクター用（エメラルドドラゴン、翡翠ドラゴン等）
 *
 * 使い方:
 *   node remove_white.js <入力画像> [出力パス]
 */

const sharp = require('sharp');
const path = require('path');

async function removeWhiteBackground(inputPath, outputPath) {
    const image = sharp(inputPath);
    const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const threshold = 250; // White threshold (250-255 is considered white)

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // If pixel is white or near-white, make it transparent
        if (r >= threshold && g >= threshold && b >= threshold) {
            pixels[i + 3] = 0; // Set alpha to 0
        }
    }

    await sharp(Buffer.from(pixels), {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4
        }
    })
    .png()
    .toFile(outputPath);

    console.log(`✅ White background removed: ${outputPath}`);
}

// CLI
const inputPath = process.argv[2];
const outputPath = process.argv[3] || inputPath.replace('.png', '_nobg.png');

if (!inputPath) {
    console.log('Usage: node remove_white.js <input.png> [output.png]');
    process.exit(1);
}

removeWhiteBackground(inputPath, outputPath).catch(console.error);
