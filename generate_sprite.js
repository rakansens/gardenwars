const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANOBANANAPRO_API_KEY;
const MODEL = 'gemini-3-pro-image-preview'; // Nano Banana Pro

async function generateSprite(inputImagePath, outputPath) {
    const prompt = `Using this exact character design, create a sprite sheet animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with:
- 4 columns x 2 rows (8 frames total)
- Size: 1376 x 768 pixels
- Each frame: 344 x 384 pixels
- Transparent background (NO white, NO checkerboard visible)

Row 1: idle, walk_1, walk_2, walk_3
Row 2: attack_1, attack_2, attack_3, attack_4

Character must face RIGHT. Keep the exact same character design from the reference image.
Remove any text labels like "ULTRA RARE" or "FROST GIGANT".`;

    console.log('=== Nano Banana Pro Image-to-Image ===');
    console.log('Input:', inputImagePath);
    console.log('Output:', outputPath);
    console.log('Model:', MODEL);

    try {
        const imageBuffer = fs.readFileSync(inputImagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = 'image/png';

        console.log('Sending Image-to-Image request...');

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
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Image
                                }
                            },
                            {
                                text: prompt
                            }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE"]
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error: ${response.status} - ${error}`);
        }

        const data = await response.json();

        const candidates = data.candidates;
        if (!candidates || candidates.length === 0) {
            console.log('Full response:', JSON.stringify(data, null, 2));
            throw new Error('No candidates in response');
        }

        const parts = candidates[0].content?.parts;
        if (!parts) {
            console.log('Full response:', JSON.stringify(data, null, 2));
            throw new Error('No parts in response');
        }

        const imagePart = parts.find(p => p.inlineData);
        if (!imagePart) {
            console.log('Response parts:', JSON.stringify(parts, null, 2));
            throw new Error('No image in response');
        }

        const imageData = imagePart.inlineData.data;
        const buffer = Buffer.from(imageData, 'base64');

        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, buffer);
        console.log('Done! Saved to:', outputPath);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node generate_sprite.js <input_image> <output_path>');
    process.exit(1);
}

generateSprite(args[0], args[1]);
