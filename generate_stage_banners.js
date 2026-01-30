const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANOBANANAPRO_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';

const OUTPUT_DIR = path.join(__dirname, 'public/assets/stages');

// 難易度ごとのテーマ設定
const DIFFICULTY_THEMES = [
    {
        id: 'tutorial',
        name: '始まりの草原',
        prompt: `Create a game stage banner image. Theme: "Meadow of Dawn"
A beautiful peaceful meadow at sunrise. Soft golden morning light, gentle grass, small cute flowers, dewdrops sparkling.
Very calm and welcoming atmosphere for beginners. Fantasy game art style, vibrant colors.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the environment.`
    },
    {
        id: 'easy',
        name: '緑の森',
        prompt: `Create a game stage banner image. Theme: "Verdant Forest"
A lush green forest with sunlight filtering through trees. Friendly forest atmosphere, some colorful mushrooms, butterflies.
Pleasant adventure mood, not scary. Fantasy game art style, vibrant greens.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the environment.`
    },
    {
        id: 'normal',
        name: '夕暮れの丘',
        prompt: `Create a game stage banner image. Theme: "Sunset Hills"
Rolling hills at sunset. Beautiful orange and purple sky, silhouettes of distant mountains.
Adventurous and slightly challenging mood. Fantasy game art style, warm sunset colors.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the environment.`
    },
    {
        id: 'hard',
        name: '闇の渓谷',
        prompt: `Create a game stage banner image. Theme: "Shadow Valley"
A dark mysterious canyon with deep shadows. Purple and dark blue atmosphere, some eerie fog.
Dangerous and challenging mood, rocky cliffs. Dark fantasy game art style.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the environment.`
    },
    {
        id: 'extreme',
        name: '地獄の門',
        prompt: `Create a game stage banner image. Theme: "Gates of Inferno"
Hellish volcanic landscape with lava flows and fire. Massive dark gates with flames, apocalyptic sky.
Extremely dangerous atmosphere, red and black colors. Epic dark fantasy game art style.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the environment.`
    },
    {
        id: 'boss',
        name: '魔王の城',
        prompt: `Create a game stage banner image. Theme: "Demon Lord's Castle"
A massive dark castle on a cliff, lightning in the stormy sky. Gothic architecture, intimidating presence.
Final boss territory atmosphere, purple and black colors. Epic dark fantasy game art style.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the environment.`
    },
    {
        id: 'special',
        name: '虹の神殿',
        prompt: `Create a game stage banner image. Theme: "Rainbow Shrine"
A magical floating temple with rainbow light beams. Crystals, aurora, mystical energy.
Special and rare atmosphere, all rainbow colors sparkling. Fantasy game art style, ethereal and dreamy.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the environment.`
    }
];

async function generateBanner(theme) {
    const outputPath = path.join(OUTPUT_DIR, `${theme.id}_banner.png`);

    console.log(`\n=== Generating: ${theme.id} (${theme.name}) ===`);

    try {
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
                        parts: [{ text: theme.prompt }]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE"]
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Find image in response
        let imageData = null;
        if (data.candidates?.[0]?.content?.parts) {
            for (const part of data.candidates[0].content.parts) {
                if (part.inlineData?.mimeType?.startsWith('image/')) {
                    imageData = part.inlineData.data;
                    break;
                }
            }
        }

        if (!imageData) {
            console.log('Response:', JSON.stringify(data, null, 2));
            throw new Error('No image data in response');
        }

        const imageBuffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`✅ Saved: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`❌ Error generating ${theme.id}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('=== Stage Banner Generator ===\n');

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created directory: ${OUTPUT_DIR}`);
    }

    // Generate banners
    let successCount = 0;
    for (const theme of DIFFICULTY_THEMES) {
        const success = await generateBanner(theme);
        if (success) successCount++;

        // Rate limit delay
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log(`\n=== Complete: ${successCount}/${DIFFICULTY_THEMES.length} banners generated ===`);
}

main().catch(console.error);
