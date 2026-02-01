const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANOBANANAPRO_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';

const OUTPUT_DIR = path.join(__dirname, 'public/assets/backgrounds');

// ガーデン背景のテーマ設定
const GARDEN_THEMES = [
    {
        id: 'garden_main',
        name: 'メインガーデン背景',
        prompt: `Create a SINGLE game background image (NOT tiled, NOT repeated). Theme: "Magical Garden Paradise"

A beautiful enchanted garden scene for a pet simulation game. This should be ONE CONTINUOUS image, not a repeating pattern.

Scene composition (left to right):
- LEFT SIDE: A decorative bush or small tree
- CENTER: Open grassy area with scattered colorful flowers (pink, yellow, purple, white)
- RIGHT SIDE: Another decorative element like a hedge or flower bed
- BACKGROUND: Soft gradient sky with gentle sunlight rays coming from top

Style:
- Cartoon/fantasy game art style
- Vibrant bright colors
- Soft lighting with warm atmosphere
- Cute and welcoming feel

CRITICAL REQUIREMENTS:
- This is a SINGLE SCENE, NOT a tileable/repeating pattern
- NO repetition or mirroring within the image
- The composition should be unique from left to right
- Size: 1376 x 768 pixels (16:9 widescreen)
- NO text, NO characters, NO UI elements
- Just the garden environment as one continuous scene`
    },
    {
        id: 'garden_spring',
        name: '春のガーデン',
        prompt: `Create a SINGLE game background image (NOT tiled, NOT repeated). Theme: "Spring Cherry Blossom Garden"

A beautiful spring garden scene. This should be ONE CONTINUOUS image, not a repeating pattern.

Scene composition:
- LEFT SIDE: A cherry blossom tree with pink petals falling
- CENTER: Open grassy area with tulips and daffodils scattered
- RIGHT SIDE: A decorative white picket fence with climbing roses
- BACKGROUND: Soft blue sky with gentle pink tones, sunlight from upper right

Style: Cartoon/fantasy game art, soft pink and green palette, dreamy atmosphere

CRITICAL: SINGLE SCENE, NOT tileable. Size: 1376 x 768 pixels. NO text, NO characters.`
    },
    {
        id: 'garden_summer',
        name: '夏のガーデン',
        prompt: `Create a SINGLE game background image (NOT tiled, NOT repeated). Theme: "Sunny Summer Garden"

A vibrant summer garden scene. This should be ONE CONTINUOUS image, not a repeating pattern.

Scene composition:
- LEFT SIDE: Tall sunflowers and a wooden garden shed
- CENTER: Bright green lawn with colorful summer flowers, maybe a small pond
- RIGHT SIDE: A fruit tree (apple or orange) with a garden bench
- BACKGROUND: Bright blue sky with fluffy white clouds, strong warm sunlight

Style: Cartoon/fantasy game art, vivid bright colors, energetic cheerful mood

CRITICAL: SINGLE SCENE, NOT tileable. Size: 1376 x 768 pixels. NO text, NO characters.`
    },
    {
        id: 'garden_autumn',
        name: '秋のガーデン',
        prompt: `Create a SINGLE game background image (NOT tiled, NOT repeated). Theme: "Cozy Autumn Garden"

A warm autumn garden scene. This should be ONE CONTINUOUS image, not a repeating pattern.

Scene composition:
- LEFT SIDE: A maple tree with red and orange leaves, some falling
- CENTER: Grass covered with fallen leaves, pumpkins and chrysanthemums
- RIGHT SIDE: Hay bales and a scarecrow, harvest decorations
- BACKGROUND: Warm orange and golden sky, soft afternoon light

Style: Cartoon/fantasy game art, warm orange/red/gold palette, nostalgic cozy mood

CRITICAL: SINGLE SCENE, NOT tileable. Size: 1376 x 768 pixels. NO text, NO characters.`
    },
    {
        id: 'garden_winter',
        name: '冬のガーデン',
        prompt: `Create a SINGLE game background image (NOT tiled, NOT repeated). Theme: "Magical Winter Garden"

A peaceful snowy winter garden scene. This should be ONE CONTINUOUS image, not a repeating pattern.

Scene composition:
- LEFT SIDE: Snow-covered evergreen tree with fairy lights
- CENTER: Snowy ground with a frozen bird bath or small ice pond
- RIGHT SIDE: A cozy snowman and snow-covered bushes
- BACKGROUND: Soft purple/blue twilight sky, gentle snowflakes falling

Style: Cartoon/fantasy game art, cool blue/white/purple palette with warm light accents, magical peaceful mood

CRITICAL: SINGLE SCENE, NOT tileable. Size: 1376 x 768 pixels. NO text, NO characters.`
    }
];

async function generateBackground(theme) {
    const outputPath = path.join(OUTPUT_DIR, `${theme.id}.png`);

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

        // Also convert to webp
        console.log(`   Converting to webp...`);
        const webpPath = outputPath.replace('.png', '.webp');
        const { execSync } = require('child_process');
        try {
            execSync(`cwebp -q 90 "${outputPath}" -o "${webpPath}"`, { stdio: 'pipe' });
            console.log(`✅ WebP saved: ${webpPath}`);
        } catch (e) {
            console.log(`   ⚠️ cwebp not available, skipping webp conversion`);
        }

        return true;
    } catch (error) {
        console.error(`❌ Error generating ${theme.id}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('=== Garden Background Generator ===\n');

    // Get theme from command line argument
    const targetId = process.argv[2];

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created directory: ${OUTPUT_DIR}`);
    }

    // Filter themes if specific one requested
    let themes = GARDEN_THEMES;
    if (targetId) {
        themes = GARDEN_THEMES.filter(t => t.id === targetId || t.id === `garden_${targetId}`);
        if (themes.length === 0) {
            console.log(`Available themes:`);
            GARDEN_THEMES.forEach(t => console.log(`  - ${t.id} (${t.name})`));
            console.log(`\nUsage: node generate_garden_bg.js [theme_id]`);
            console.log(`Example: node generate_garden_bg.js garden_main`);
            return;
        }
    }

    // Generate backgrounds
    let successCount = 0;
    for (const theme of themes) {
        const success = await generateBackground(theme);
        if (success) successCount++;

        // Rate limit delay
        if (themes.length > 1) {
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    console.log(`\n=== Complete: ${successCount}/${themes.length} backgrounds generated ===`);
    console.log(`\nTo use the new background, update GardenScene.ts:`);
    console.log(`  this.load.image('bg_garden', '/assets/backgrounds/garden_main.webp');`);
}

main().catch(console.error);
