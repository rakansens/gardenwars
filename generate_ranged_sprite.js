/**
 * generate_ranged_sprite.js - 遠距離攻撃用スプライトシート生成
 *
 * 通常版との違い:
 * - idle/walkは通常サイズ (344x384)
 * - attackフレームは横に広い (1376x384) - 遠距離エフェクト用
 *
 * 使い方:
 *   node generate_ranged_sprite.js <入力画像> <出力パス> [アタックスタイル]
 *
 * アタックスタイル:
 *   - auto    : 画像を分析してキャラに最適な攻撃を自動生成（デフォルト）
 *   - beam    : ビーム/レーザー系
 *   - breath  : ブレス攻撃（ドラゴン等）
 *   - arrow   : 矢/投擲系
 *   - magic   : 魔法ビーム
 *   - slash   : 遠距離斬撃（剣気、衝撃波）
 *   - ice     : 氷結攻撃
 *   - fire    : 炎攻撃
 *   - water   : 水流攻撃
 *   - thunder : 雷撃
 *   - ninja   : 忍者（手裏剣、クナイの連射）
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

// 遠距離攻撃スタイル定義
const RANGED_ATTACK_STYLES = {
    beam: `DEVASTATING ENERGY BEAM attack that spans the ENTIRE width!
  - attack_1: Character on LEFT, energy core charging, particles gathering
  - attack_2: MASSIVE laser beam FIRING from character, extending ALL THE WAY to the RIGHT edge!
  - attack_3: Beam at FULL POWER, impact explosion on the RIGHT side with sparks and energy burst!
  - attack_4: Beam fading with residual energy particles across the entire frame`,

    breath: `POWERFUL BREATH attack that fills the frame!
  - attack_1: Character on LEFT, chest expanding, energy gathering in mouth
  - attack_2: MASSIVE breath attack (fire/ice/energy) BLASTING from mouth to the RIGHT edge!
  - attack_3: Breath at FULL FORCE, swirling energy and impact effects on the RIGHT!
  - attack_4: Breath dissipating with smoke and particles floating across the frame`,

    arrow: `RAPID PROJECTILE attack with multiple shots!
  - attack_1: Character on LEFT, drawing bow/aiming, arrow glowing with energy
  - attack_2: Arrow/projectile FLYING across the frame with bright trail to the RIGHT edge!
  - attack_3: Multiple projectiles in flight, impact explosion on the RIGHT side!
  - attack_4: Final arrow landing, impact sparkles across the frame`,

    magic: `SPECTACULAR MAGIC BEAM with arcane power!
  - attack_1: Character on LEFT, staff/wand raised, magic circles appearing, runes glowing
  - attack_2: BRILLIANT magic beam SHOOTING across to the RIGHT edge with sparkles and symbols!
  - attack_3: Magic at FULL POWER with swirling energy, stars, and explosion on the RIGHT!
  - attack_4: Magic fading with floating runes, sparkles, and lingering energy`,

    slash: `DEVASTATING RANGED SLASH with sword energy!
  - attack_1: Character on LEFT, sword raised high, energy gathering along the blade
  - attack_2: MASSIVE sword wave/energy arc FLYING across the frame to the RIGHT edge!
  - attack_3: Slash impact with shockwave explosion on the RIGHT, debris flying!
  - attack_4: Energy dissipating with floating slash marks and particles`,

    ice: `FREEZING ICE ATTACK that spans the frame!
  - attack_1: Character on LEFT, ice crystals forming, cold mist gathering
  - attack_2: ICE BEAM/BLIZZARD SHOOTING across to the RIGHT edge with snowflakes!
  - attack_3: Frozen explosion on the RIGHT with ice shards and crystalline burst!
  - attack_4: Ice settling with floating snowflakes and frost particles across the frame`,

    fire: `BLAZING FIRE ATTACK that engulfs the frame!
  - attack_1: Character on LEFT, flames igniting, heat waves rising
  - attack_2: MASSIVE FIRE BLAST shooting across to the RIGHT edge with intense flames!
  - attack_3: Fiery explosion on the RIGHT with sparks, embers flying across!
  - attack_4: Flames dying with lingering embers and smoke across the frame`,

    water: `POWERFUL WATER ATTACK spanning the frame!
  - attack_1: Character on LEFT, water swirling, wave gathering
  - attack_2: MASSIVE WATER CANNON/WAVE blasting across to the RIGHT edge!
  - attack_3: Tidal impact on the RIGHT with splash, bubbles, and aqua burst!
  - attack_4: Water settling with floating bubbles and mist across the frame`,

    thunder: `DEVASTATING THUNDER ATTACK across the frame!
  - attack_1: Character on LEFT, electricity crackling, storm clouds forming
  - attack_2: LIGHTNING BOLT/THUNDER BEAM striking across to the RIGHT edge!
  - attack_3: Electric explosion on the RIGHT with bright sparks and energy burst!
  - attack_4: Thunder fading with residual electricity and floating sparks`,

    ninja: `RAPID NINJA PROJECTILE attack!
  - attack_1: Character on LEFT in ninja pose, multiple shuriken/kunai appearing
  - attack_2: SHURIKEN BARRAGE flying across the frame in formation to the RIGHT!
  - attack_3: Multiple impacts on the RIGHT with metal clangs and spark effects!
  - attack_4: Final kunai landing, smoke and shadow effects across the frame`,

    default: `POWERFUL RANGED attack spanning the entire frame!
  - attack_1: Character on LEFT, energy gathering, preparing to attack
  - attack_2: MASSIVE attack effect shooting across to the RIGHT edge!
  - attack_3: Impact explosion on the RIGHT with particles and energy burst!
  - attack_4: Attack fading with residual effects across the frame`
};

async function generateRangedSprite(inputImagePath, outputPath, attackStyle = 'auto') {
    let prompt;

    if (attackStyle === 'auto') {
        // autoモード: 画像を分析してキャラに最適な遠距離攻撃を自動生成
        prompt = `Using this exact character design, create a sprite sheet for a LONG-RANGE attack animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

First, analyze the character and determine the MOST APPROPRIATE ranged attack type:
- Dragons/monsters → breath attack (fire, ice, energy)
- Mages/wizards → magic beam with runes and sparkles
- Archers/gunners → projectile attack (arrows, bullets)
- Knights/warriors → sword energy wave / ranged slash
- Ninja → shuriken/kunai barrage
- Ice characters → ice beam / blizzard
- Fire characters → fire blast
- Water characters → water cannon / wave
- Electric characters → thunder bolt / lightning
- Robots/mecha → laser beam

Create a sprite sheet with this EXACT layout:
- Total size: 1376 x 1920 pixels
- SOLID BRIGHT GREEN background (#00FF00) - chroma key green

ROW 1 (y=0, height=384): 4 frames, each 344x384 pixels
  - Frame 1 (x=0): idle pose
  - Frame 2 (x=344): walk frame 1
  - Frame 3 (x=688): walk frame 2
  - Frame 4 (x=1032): walk frame 3

ROW 2-5: Attack frames - WIDE (1376x384 each)
Generate attack frames that match this character's nature:
- attack_1: Character on LEFT side, preparing their signature attack
- attack_2: Character FIRING their attack - effect extends ALL THE WAY to the RIGHT edge!
- attack_3: Attack at FULL POWER with spectacular impact on the RIGHT side!
- attack_4: Attack finishing, residual effects across the entire frame

The attack effect MUST:
- Start from the character on the LEFT
- Extend horizontally across the ENTIRE width of the frame
- Reach the RIGHT edge of the frame
- Match the character's visual theme and personality

Character must face RIGHT. Make the ranged attack look POWERFUL and FAR-REACHING!

CRITICAL: Do NOT add any text labels. ONLY character and effect graphics.`;
    } else {
        const attackDesc = RANGED_ATTACK_STYLES[attackStyle] || RANGED_ATTACK_STYLES.default;
        prompt = `Using this exact character design, create a sprite sheet for a LONG-RANGE attack animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with this EXACT layout:
- Total size: 1376 x 1920 pixels
- SOLID BRIGHT GREEN background (#00FF00) - chroma key green

ROW 1 (y=0, height=384): 4 frames, each 344x384 pixels
  - Frame 1 (x=0): idle pose
  - Frame 2 (x=344): walk frame 1
  - Frame 3 (x=688): walk frame 2
  - Frame 4 (x=1032): walk frame 3

ROW 2-5: Attack frames - WIDE (1376x384 each)
${attackDesc}

The attack effect MUST:
- Start from the character on the LEFT
- Extend horizontally across the ENTIRE width of the frame
- Reach the RIGHT edge of the frame
- Be spectacular and visually impressive!

Character must face RIGHT. Make the ranged attack look POWERFUL and FAR-REACHING!

CRITICAL: Do NOT add any text labels. ONLY character and effect graphics.`;
    }

    console.log('=== Ranged Attack Sprite Generator ===');
    console.log('Input:', inputImagePath);
    console.log('Output:', outputPath);
    console.log('Style:', attackStyle);
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
Usage: node generate_ranged_sprite.js <input_image> <output_path> [attack_style]

Attack styles:
  - auto    : Analyze character and generate matching attack (default)
  - beam    : Energy beam / laser
  - breath  : Breath attack (dragons)
  - arrow   : Projectile / arrow attack
  - magic   : Magic beam with runes
  - slash   : Ranged sword slash / energy wave
  - ice     : Ice beam / blizzard
  - fire    : Fire blast
  - water   : Water cannon / wave
  - thunder : Lightning / thunder bolt
  - ninja   : Shuriken / kunai barrage

Output: 1376 x 1920 pixels sprite sheet

Example:
  node generate_ranged_sprite.js ur_dragon.webp ur_dragon_ranged.png auto
  node generate_ranged_sprite.js ur_frost_giant.webp ur_frost_giant_ranged.png slash
`);
    process.exit(1);
}

generateRangedSprite(args[0], args[1], args[2] || 'auto');
