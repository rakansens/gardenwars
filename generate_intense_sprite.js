const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANOBANANAPRO_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';

async function generateSprite(inputImagePath, outputPath) {
    const prompt = `Using this exact character design, create a sprite sheet animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with:
- 4 columns x 2 rows (8 frames total)
- Size: 1376 x 768 pixels
- Each frame: 344 x 384 pixels
- Transparent background (NO white, NO checkerboard)

Row 1: idle, walk_1, walk_2, walk_3
Row 2: POWERFUL MAGIC attack sequence with dramatic spell effects!
  - attack_1: Raising staff, gathering magical energy, glowing runes appear
  - attack_2: Full power magical blast with swirling energy and bright light
  - attack_3: Explosive impact with magical particles, stars, and arcane symbols
  - attack_4: Follow through with lingering magical sparkles and energy wisps

Character must face RIGHT. This is an ULTRA RARE wizard - make the attack animation SPECTACULAR with visible magic effects, glowing orbs, and mystical energy!

IMPORTANT: Do NOT add any text labels like "Idle", "Walk", "Attack" to the frames. The sprite sheet must contain ONLY the character graphics with NO text whatsoever.`;

    console.log('=== Generating Intense Attack Motion ===');
    console.log('Input:', inputImagePath);
    console.log('Output:', outputPath);

    try {
        const imageBuffer = fs.readFileSync(inputImagePath);
        const base64Image = imageBuffer.toString('base64');

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
                            { inlineData: { mimeType: 'image/png', data: base64Image } },
                            { text: prompt }
                        ]
                    }],
                    generationConfig: { responseModalities: ["IMAGE"] }
                })
            }
        );

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!imagePart) throw new Error('No image in response');

        const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log('Done!');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

generateSprite(process.argv[2], process.argv[3]);
