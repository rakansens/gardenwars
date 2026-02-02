const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANOBANANAPRO_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';

const OUTPUT_DIR = path.join(__dirname, 'public/assets/stages');

// World 2: 地獄 (Inferno) のエリアテーマ設定
const WORLD2_THEMES = {
    banners: [
        {
            id: 'purgatory_banner',
            name: '煉獄エリアバナー',
            prompt: `Create a game stage banner image. Theme: "Purgatory - Entrance to Hell"
A desolate wasteland at the entrance of the underworld. Cracked scorched earth, dead twisted trees, dark red sky with smoke clouds.
The atmosphere is ominous but not yet full inferno - this is the first circle of hell. Embers floating in the air, distant flames on the horizon.
Dark fantasy game art style, muted reds, browns, and grays.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the hellish environment.`
        },
        {
            id: 'hellfire_banner',
            name: '業火エリアバナー',
            prompt: `Create a game stage banner image. Theme: "Hellfire - Sea of Flames"
An intense volcanic hellscape with rivers of flowing lava. Massive geysers of fire erupting from the ground.
The sky is completely red-orange with ash clouds. Jagged obsidian rocks, lava waterfalls, intense heat distortion.
This is the peak of fiery hell. Epic dark fantasy game art style, intense oranges, reds, and blacks.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the infernal environment.`
        },
        {
            id: 'abyss_banner',
            name: '深淵エリアバナー',
            prompt: `Create a game stage banner image. Theme: "The Abyss - Depths of Darkness"
The deepest pit of hell, an endless dark void with only faint purple and blue ethereal flames.
Floating rocky platforms over infinite darkness, ghostly wisps of energy, ancient demonic architecture crumbling.
Cold and empty yet terrifying atmosphere. Dark fantasy game art style, deep purples, blacks, and cold blues.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the abyssal environment.`
        },
        {
            id: 'inferno_boss_banner',
            name: '地獄ボスエリアバナー',
            prompt: `Create a game stage banner image. Theme: "Throne of the Inferno Lord"
The ultimate boss arena in hell - a massive dark throne room with pillars of fire.
Giant demonic architecture, a throne made of obsidian and flames, volcanic eruptions in the background.
The most intimidating and epic location in the underworld. Maximum intensity, awe-inspiring scale.
Epic dark fantasy game art style, dramatic lighting, reds, blacks, and gold accents.
Aspect ratio: 16:9 landscape banner format (800x300 pixels ideal).
NO text, NO characters, just the throne environment.`
        }
    ],
    stages: [
        // Purgatory stages (5)
        {
            id: 'purgatory_1',
            name: '煉獄の門',
            prompt: `Create a side-scrolling game stage background. Theme: "Gates of Purgatory"
The entrance to the underworld. Massive dark iron gates, scorched earth, dying vegetation.
Dark red sky with storm clouds, occasional lightning. Ominous but just the beginning.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'purgatory_2',
            name: '灰の荒野',
            prompt: `Create a side-scrolling game stage background. Theme: "Ash Wasteland"
A vast gray wasteland covered in volcanic ash. Dead trees, cracked ground, ash falling like snow.
Distant volcanoes smoking on the horizon. Desolate and hopeless atmosphere.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'purgatory_3',
            name: '骸骨の道',
            prompt: `Create a side-scrolling game stage background. Theme: "Path of Bones"
A road made of ancient bones and skulls. Dark rocky terrain, eerie green torches lighting the way.
Mist rolling along the ground, faint ghostly glow. Unsettling but atmospheric.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'purgatory_4',
            name: '呪われた森',
            prompt: `Create a side-scrolling game stage background. Theme: "Cursed Dead Forest"
A forest of completely dead, twisted black trees. Branches like claws reaching for the red sky.
Pools of dark liquid, poisonous mist, occasional ember. Creepy haunted forest in hell.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'purgatory_5',
            name: '煉獄の番人',
            prompt: `Create a side-scrolling game stage background. Theme: "Purgatory Guardian's Arena"
A circular arena surrounded by iron spikes and dark flames. Boss battle arena atmosphere.
Ancient demonic statues, ritual circles on the ground, intense red lighting.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        // Hellfire stages (5)
        {
            id: 'hellfire_1',
            name: '溶岩の川',
            prompt: `Create a side-scrolling game stage background. Theme: "Rivers of Lava"
A landscape dominated by flowing rivers of bright orange lava. Rocky black islands, steam and heat.
The sky is orange-red with volcanic ash clouds. Hot and dangerous atmosphere.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'hellfire_2',
            name: '噴火口',
            prompt: `Create a side-scrolling game stage background. Theme: "Volcanic Crater"
Inside an active volcanic crater. Bubbling lava pools, geysers of fire, falling magma rocks.
Extreme heat, everything glowing red-orange. Maximum volcanic intensity.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'hellfire_3',
            name: '炎の迷宮',
            prompt: `Create a side-scrolling game stage background. Theme: "Labyrinth of Flames"
A maze of burning walls and pillars of fire. Hellish architecture, trapped between flames.
Fire tornados in the distance, the ground itself is red hot. Nowhere is safe.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'hellfire_4',
            name: '黒曜石の砦',
            prompt: `Create a side-scrolling game stage background. Theme: "Obsidian Fortress"
A fortress made entirely of black obsidian, surrounded by lava moats. Dark and imposing.
Flames burning on the walls, sharp angular architecture. Demonic military stronghold.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'hellfire_5',
            name: '業火の王',
            prompt: `Create a side-scrolling game stage background. Theme: "Hellfire King's Court"
An open throne area with massive pillars of solid fire. The floor is cracked with lava beneath.
A grand demonic court, intimidating and powerful. Boss arena with maximum fire.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        // Abyss stages (5)
        {
            id: 'abyss_1',
            name: '虚無の入口',
            prompt: `Create a side-scrolling game stage background. Theme: "Entrance to the Void"
The transition from fire to darkness. Flames fade into cold purple mist and endless dark.
Floating platforms over a bottomless pit, eerie silence. Unsettling emptiness.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'abyss_2',
            name: '浮遊する廃墟',
            prompt: `Create a side-scrolling game stage background. Theme: "Floating Ruins"
Ancient demonic temple ruins floating in an endless dark void. Purple and blue ethereal flames.
Broken chains hanging in the air, mysterious glowing symbols. Otherworldly and ancient.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'abyss_3',
            name: '魂の牢獄',
            prompt: `Create a side-scrolling game stage background. Theme: "Prison of Souls"
Massive cages and cells suspended in the dark void. Ghostly blue-white wisps trapped within.
Cold iron chains, soul energy flowing like rivers. Tragic and terrifying.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'abyss_4',
            name: '忘却の螺旋',
            prompt: `Create a side-scrolling game stage background. Theme: "Spiral of Oblivion"
A spiraling descent into ultimate darkness. Reality warping, geometric impossibilities.
Purple lightning, fragmented reality, the fabric of existence breaking down.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'abyss_5',
            name: '深淵の支配者',
            prompt: `Create a side-scrolling game stage background. Theme: "Ruler of the Abyss Arena"
The deepest point of the abyss. A platform of pure darkness surrounded by void.
Cosmic horror elements, stars dying in the background, ultimate emptiness. Final abyss boss area.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        // Inferno Boss stages (5)
        {
            id: 'inferno_boss_1',
            name: '地獄の玉座',
            prompt: `Create a side-scrolling game stage background. Theme: "Hell's Throne Room Approach"
The path to the ultimate throne. Grand demonic architecture, pillars of hellfire, red carpet of flames.
Epic scale, intimidating power. The ultimate challenge begins.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'inferno_boss_2',
            name: '魔王の試練',
            prompt: `Create a side-scrolling game stage background. Theme: "Demon Lord's Trial"
A deadly gauntlet chamber. Spinning blades of fire, crushing walls, death traps.
Ancient demonic test for those who seek the throne. Terrifying obstacle course.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'inferno_boss_3',
            name: '七つの門',
            prompt: `Create a side-scrolling game stage background. Theme: "The Seven Gates"
Seven massive demonic gates in sequence, each more terrifying than the last.
Different elemental flames - red, blue, green, purple, black, white, and gold.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'inferno_boss_4',
            name: '絶望の祭壇',
            prompt: `Create a side-scrolling game stage background. Theme: "Altar of Despair"
A massive sacrificial altar surrounded by eternal flames. Demonic symbols everywhere.
The penultimate boss arena, maximum intensity before the final battle.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        },
        {
            id: 'inferno_boss_5',
            name: '地獄の支配者',
            prompt: `Create a side-scrolling game stage background. Theme: "Throne of the Inferno Sovereign"
THE final boss arena. The ultimate throne of hell, burning with all colors of hellfire.
Maximum epic scale, ultimate power, the final challenge. Crown jewel of the underworld.
Fantasy game art style, horizontal scrolling format (1920x1080). NO text, NO characters.`
        }
    ]
};

async function generateImage(theme, type = 'stage') {
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

        // Convert to webp
        const webpPath = outputPath.replace('.png', '.webp');
        const { execSync } = require('child_process');
        try {
            execSync(`cwebp -q 90 "${outputPath}" -o "${webpPath}"`, { stdio: 'pipe' });
            console.log(`✅ WebP saved: ${webpPath}`);
            // Remove PNG after successful webp conversion
            fs.unlinkSync(outputPath);
            console.log(`   Removed PNG, keeping WebP only`);
        } catch (e) {
            console.log(`   ⚠️ cwebp not available, keeping PNG`);
        }

        return true;
    } catch (error) {
        console.error(`❌ Error generating ${theme.id}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('=== World 2 (Inferno) Image Generator ===\n');

    const args = process.argv.slice(2);
    const mode = args[0] || 'all'; // 'banners', 'stages', 'all', or specific id

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created directory: ${OUTPUT_DIR}`);
    }

    let themes = [];

    if (mode === 'banners') {
        themes = WORLD2_THEMES.banners;
        console.log('Generating banners only...');
    } else if (mode === 'stages') {
        themes = WORLD2_THEMES.stages;
        console.log('Generating stages only...');
    } else if (mode === 'all') {
        themes = [...WORLD2_THEMES.banners, ...WORLD2_THEMES.stages];
        console.log('Generating all images...');
    } else {
        // Specific ID
        const allThemes = [...WORLD2_THEMES.banners, ...WORLD2_THEMES.stages];
        themes = allThemes.filter(t => t.id === mode || t.id.includes(mode));
        if (themes.length === 0) {
            console.log('Available themes:');
            console.log('\nBanners:');
            WORLD2_THEMES.banners.forEach(t => console.log(`  - ${t.id}`));
            console.log('\nStages:');
            WORLD2_THEMES.stages.forEach(t => console.log(`  - ${t.id}`));
            console.log('\nUsage: node generate_world2_images.js [banners|stages|all|<specific_id>]');
            return;
        }
    }

    // Generate images
    let successCount = 0;
    for (let i = 0; i < themes.length; i++) {
        const theme = themes[i];
        console.log(`\n[${i + 1}/${themes.length}]`);
        const success = await generateImage(theme);
        if (success) successCount++;

        // Rate limit delay (3 seconds between requests)
        if (i < themes.length - 1) {
            console.log('   Waiting 3 seconds for rate limit...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    console.log(`\n=== Complete: ${successCount}/${themes.length} images generated ===`);
    console.log(`\nImages saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
