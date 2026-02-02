/**
 * generate_ranged_white_bg.js - 白背景版の遠距離スプライト生成
 * 緑色のキャラクター用（エメラルドドラゴン、翡翠ドラゴン等）
 *
 * 使い方:
 *   node generate_ranged_white_bg.js <入力画像> <出力パス> [アタックスタイル]
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANOBANANAPRO_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';

async function generateRangedSpriteWhiteBg(inputImagePath, outputPath, attackStyle = 'auto') {
    const prompt = `Using this exact character design, create a sprite sheet for a LONG-RANGE attack animation.

CRITICAL: This is a GREEN-COLORED dragon character. Keep ALL the green colors in the character!

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with this EXACT layout:
- Total size: 1376 x 1920 pixels
- SOLID PURE WHITE background (#FFFFFF) - NOT green!

ROW 1 (y=0, height=384): 4 frames, each 344x384 pixels
  - Frame 1 (x=0): idle pose
  - Frame 2 (x=344): walk frame 1
  - Frame 3 (x=688): walk frame 2
  - Frame 4 (x=1032): walk frame 3

ROW 2-5: Attack frames - WIDE (1376x384 each)
This is an EMERALD DRAGON - generate a MAGICAL NATURE BREATH attack:
- attack_1: Dragon on LEFT, chest expanding, emerald energy and leaves gathering
- attack_2: MASSIVE GREEN EMERALD BREATH with vines, leaves, and nature energy BLASTING to the RIGHT edge!
- attack_3: Breath at FULL FORCE with swirling emerald crystals, leaves, flower petals on the RIGHT!
- attack_4: Breath dissipating with floating leaves, petals, and emerald sparkles

The attack should feature:
- Emerald green energy and crystals
- Vines and leaves intertwined in the breath
- Flower petals (pink/white) mixed in
- Nature magic aesthetic

The attack effect MUST:
- Start from the character on the LEFT
- Extend horizontally across the ENTIRE width of the frame
- Reach the RIGHT edge of the frame

Character must face RIGHT. Make the nature breath look POWERFUL and FAR-REACHING!

CRITICAL:
- Use PURE WHITE (#FFFFFF) background ONLY
- Do NOT use green background - the character IS green!
- Do NOT add any text labels. ONLY character and effect graphics.`;

    console.log('=== Ranged Sprite Generator (WHITE Background) ===');
    console.log('Input:', inputImagePath);
    console.log('Output:', outputPath);
    console.log('For green-colored characters');

    try {
        const imageBuffer = fs.readFileSync(inputImagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = inputImagePath.endsWith('.webp') ? 'image/webp' : 'image/png';

        console.log('Generating with WHITE background...');

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
        console.log('✅ Done! Saved to:', outputPath);
        console.log('Next: node remove_white.js', outputPath);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

// Usage
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log(`
Usage: node generate_ranged_white_bg.js <input_image> <output_path>

For green-colored characters that would be removed by green chroma key.
Uses WHITE background instead, then use remove_white.js to remove background.
`);
    process.exit(1);
}

generateRangedSpriteWhiteBg(args[0], args[1], args[2]);
