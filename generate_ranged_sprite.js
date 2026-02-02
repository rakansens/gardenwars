/**
 * generate_ranged_sprite.js - 遠距離攻撃用スプライトシート生成
 *
 * 通常版との違い:
 * - idle/walkは通常サイズ (344x384)
 * - attackフレームは横に広い (1376x384) - 遠距離エフェクト用
 *
 * 出力仕様:
 *   - サイズ: 1376 x 1920 ピクセル
 *   - Row 1: idle, walk_1, walk_2, walk_3 (各344x384)
 *   - Row 2-5: attack_1〜4 (各1376x384、フル幅)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANOBANANAPRO_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';

async function generateRangedSprite(inputImagePath, outputPath) {
    const prompt = `Using this exact character design, create a sprite sheet for a LONG-RANGE attack animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with this EXACT layout:
- Total size: 1376 x 1920 pixels
- SOLID BRIGHT GREEN background (#00FF00) - chroma key green

ROW 1 (y=0, height=384): 4 frames, each 344x384 pixels
  - Frame 1 (x=0): idle pose
  - Frame 2 (x=344): walk frame 1
  - Frame 3 (x=688): walk frame 2
  - Frame 4 (x=1032): walk frame 3

ROW 2 (y=384, height=384): 1 WIDE frame, 1376x384 pixels
  - attack_1: Character on LEFT side, preparing to attack, energy gathering

ROW 3 (y=768, height=384): 1 WIDE frame, 1376x384 pixels
  - attack_2: Character on LEFT, FIRING a massive beam/breath/projectile that extends ALL THE WAY to the RIGHT edge!

ROW 4 (y=1152, height=384): 1 WIDE frame, 1376x384 pixels
  - attack_3: Character on LEFT, beam/projectile at FULL EXTENSION with explosion/impact effect on the RIGHT side!

ROW 5 (y=1536, height=384): 1 WIDE frame, 1376x384 pixels
  - attack_4: Character on LEFT, attack finishing, residual energy/particles across the frame

The attack effect (beam, breath, projectile, energy wave) must:
- Start from the character on the LEFT
- Extend horizontally across the ENTIRE width of the frame
- Reach the RIGHT edge of the frame
- Be spectacular and visually impressive!

Character must face RIGHT. Make the ranged attack look POWERFUL and FAR-REACHING!

CRITICAL: Do NOT add any text labels. ONLY character and effect graphics.`;

    console.log('=== Ranged Attack Sprite Generator ===');
    console.log('Input:', inputImagePath);
    console.log('Output:', outputPath);
    console.log('Layout: 1376x1920 (extended attack frames)');

    try {
        const imageBuffer = fs.readFileSync(inputImagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = inputImagePath.endsWith('.webp') ? 'image/webp' : 'image/png';

        console.log('Generating...');

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'x-goog-api-key': API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType, data: base64Image } },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: { responseModalities: ["IMAGE"] }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!imagePart) {
            console.log('Response:', JSON.stringify(data, null, 2));
            throw new Error('No image in response');
        }

        const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log('Done! Saved to:', outputPath);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

// Usage
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log(`
Usage: node generate_ranged_sprite.js <input_image> <output_path>

This generates a sprite sheet optimized for LONG-RANGE attacks:
- Row 1: idle + walk (normal 344x384 frames)
- Rows 2-5: attack frames (WIDE 1376x384 frames for ranged effects)

Output size: 1376 x 1920 pixels

Example:
  node generate_ranged_sprite.js ur_cosmic_dragon.webp ur_cosmic_dragon_ranged_sheet.png
`);
    process.exit(1);
}

generateRangedSprite(args[0], args[1]);
