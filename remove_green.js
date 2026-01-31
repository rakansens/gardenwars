/**
 * remove_green.js - クロマキー（緑背景）除去スクリプト
 *
 * 用途: スプライトシートの緑背景（#00FF00）を透明化
 *
 * 使い方:
 *   node remove_green.js <画像パス>
 *
 * 例:
 *   node remove_green.js public/assets/sprites/sheets/ssr_frost_empress_sheet.png
 *
 * 注意:
 * - AI背景除去（remove_bg.js）は白いキャラクターの顔が消える可能性があるため、
 *   このスクリプトを使用してください
 * - generate_ur_sprite.js で緑背景で生成した画像に対して使用します
 */

const sharp = require('sharp');
const fs = require('fs');

async function removeGreen(inputPath) {
    console.log('Processing:', inputPath);

    const image = sharp(inputPath);
    const metadata = await image.metadata();
    console.log('Image Size:', metadata.width + 'x' + metadata.height);

    // Get raw pixel data
    const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Process each pixel
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Detect green screen (high green, low red and blue)
        // Allow some tolerance for anti-aliasing
        if (g > 200 && r < 150 && b < 150 && g > r + 50 && g > b + 50) {
            // Make transparent
            data[i + 3] = 0;
        }
        // Semi-transparent for edge pixels (anti-aliasing)
        else if (g > 150 && r < 180 && b < 180 && g > r + 30 && g > b + 30) {
            // Calculate how "green" this pixel is
            const greenness = (g - Math.max(r, b)) / g;
            if (greenness > 0.2) {
                data[i + 3] = Math.floor(255 * (1 - greenness));
            }
        }
    }

    // Save result
    await sharp(data, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4
        }
    })
    .png()
    .toFile(inputPath);

    console.log('Done!');
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node remove_green.js <image_path>');
    process.exit(1);
}

removeGreen(args[0]).catch(console.error);
