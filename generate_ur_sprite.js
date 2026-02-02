/**
 * generate_ur_sprite.js - UR/SSRスプライトシート生成スクリプト
 *
 * 用途: キャラクター画像からアニメーションスプライトシートを生成
 *
 * 使い方:
 *   node generate_ur_sprite.js <入力画像> <出力パス> [アタックスタイル]
 *
 * アタックスタイル:
 *   - auto    : 画像を分析してキャラに最適な攻撃を自動生成（推奨）
 *   - mech    : ロボット、メカ（レーザー、爆発）
 *   - knight  : 剣士（剣斬撃、エネルギーアーク）
 *   - paladin : 聖騎士（神聖光、聖なる力）
 *   - ninja   : 忍者（手裏剣、クナイ、影分身）
 *   - beast   : 動物（爪、牙、野性の力）
 *   - magic   : 魔法使い（魔法、アーケインエネルギー）
 *   - dancer  : ダンサー（優雅な回転、キック）
 *   - gunner  : 射撃系（銃、弓、投擲）
 *   - water   : 水属性（波、泡、水流）
 *   - fire    : 炎属性（炎、爆発、熱波）
 *   - ice     : 氷属性（氷柱、吹雪、凍結）
 *   - rider   : 騎乗系（突撃、マウント攻撃）
 *   - food    : 食べ物系（投げる、はじける）
 *   - cute    : かわいい系（ハート、星、キラキラ）
 *   - default : 汎用
 *
 * 例:
 *   node generate_ur_sprite.js input.webp output.png auto    # 自動判定（推奨）
 *   node generate_ur_sprite.js input.webp output.png knight  # 剣士スタイル
 *
 * 出力仕様:
 *   - サイズ: 1376 x 768 ピクセル
 *   - グリッド: 4列 x 2行（8フレーム）
 *   - 背景: クロマキーグリーン（#00FF00）
 *
 * 次のステップ:
 *   node remove_green.js <出力パス>  # 背景除去
 *   cwebp -q 90 <PNG> -o <WebP>      # WebP変換
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANOBANANAPRO_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';

// キャラタイプ別のアタックモーション定義
const ATTACK_STYLES = {
    mech: `DEVASTATING MECH attack sequence with explosive firepower!
  - attack_1: Weapons systems activating, energy charging, targeting lock
  - attack_2: MASSIVE laser beam / cannon blast with bright energy trail
  - attack_3: Explosive impact with shockwaves, sparks, and debris
  - attack_4: Smoke clearing, systems cooling with residual energy`,

    knight: `HEROIC SWORD attack sequence with legendary power!
  - attack_1: Drawing sword, battle stance, blade glowing with energy
  - attack_2: POWERFUL overhead slash with energy arc trailing the blade
  - attack_3: Impact explosion with light burst and energy shockwave
  - attack_4: Follow through pose with lingering blade glow`,

    paladin: `DIVINE HOLY attack sequence with radiant power!
  - attack_1: Raising holy weapon, golden light gathering, halo appearing
  - attack_2: BRILLIANT divine strike with holy light beams and sacred symbols
  - attack_3: Purifying explosion with golden particles and angelic feathers
  - attack_4: Blessed afterglow with floating light orbs`,

    ninja: `SWIFT SHADOW attack sequence with deadly precision!
  - attack_1: Crouching in shadow, kunai/shuriken appearing, eyes glowing
  - attack_2: RAPID shuriken barrage / kunai slash with shadow trails
  - attack_3: Shadow clone explosion with smoke and afterimages
  - attack_4: Landing in stealth pose with fading shadows`,

    beast: `FEROCIOUS PRIMAL attack sequence with raw power!
  - attack_1: Crouching, muscles tensing, primal energy crackling
  - attack_2: DEVASTATING claw strike / bite with energy trails
  - attack_3: Savage impact with shockwave and primal roar effect
  - attack_4: Landing pose with residual wild energy`,

    magic: `SPECTACULAR ARCANE attack sequence with mystical power!
  - attack_1: Raising staff/wand, gathering magical energy, glowing runes appear
  - attack_2: Full power magical blast with swirling energy and bright light
  - attack_3: Explosive impact with magical particles, stars, and arcane symbols
  - attack_4: Follow through with lingering magical sparkles and energy wisps`,

    dancer: `GRACEFUL PERFORMANCE attack sequence with elegant power!
  - attack_1: Elegant pose, ribbons/energy swirling, preparing to spin
  - attack_2: BEAUTIFUL pirouette with energy ribbons and sparkles trailing
  - attack_3: Finishing pose with burst of stars, hearts, or petals
  - attack_4: Graceful bow with lingering sparkles and floating particles`,

    gunner: `PRECISION RANGED attack sequence with deadly accuracy!
  - attack_1: Aiming weapon, energy charging, crosshairs appearing
  - attack_2: POWERFUL shot/arrow with bright projectile trail
  - attack_3: Impact explosion with sparks and energy burst
  - attack_4: Recoil pose with smoke/steam dissipating`,

    water: `FLOWING AQUA attack sequence with oceanic power!
  - attack_1: Water swirling around, bubbles forming, wave gathering
  - attack_2: MASSIVE water wave / hydro blast with splashing droplets
  - attack_3: Tidal impact with spray, bubbles, and aqua energy burst
  - attack_4: Water settling with floating bubbles and mist`,

    fire: `BLAZING INFERNO attack sequence with burning fury!
  - attack_1: Flames igniting, heat waves rising, ember particles
  - attack_2: EXPLOSIVE fire blast / flame breath with intense heat trail
  - attack_3: Fiery explosion with sparks, embers, and smoke
  - attack_4: Flames dying down with lingering embers and heat shimmer`,

    ice: `FROZEN BLIZZARD attack sequence with crystalline power!
  - attack_1: Ice crystals forming, cold mist gathering, frost spreading
  - attack_2: PIERCING ice shard barrage / blizzard blast with snowflakes
  - attack_3: Frozen explosion with ice shards and crystalline burst
  - attack_4: Ice settling with floating snowflakes and frost particles`,

    rider: `CHARGING MOUNT attack sequence with combined power!
  - attack_1: Mount rearing up, rider preparing, energy building
  - attack_2: THUNDERING charge attack with speed lines and impact force
  - attack_3: Collision impact with dust, sparks, and shockwave
  - attack_4: Triumphant pose with mount, dust settling`,

    food: `TASTY CHAOS attack sequence with delicious destruction!
  - attack_1: Food items appearing, preparing to throw, energy swirling
  - attack_2: EXPLOSIVE food barrage with splashing and bouncing items
  - attack_3: Messy impact with splatter effects and food particles
  - attack_4: Satisfied pose with floating food particles settling`,

    cute: `ADORABLE ASSAULT attack sequence with overwhelming cuteness!
  - attack_1: Cute pose, hearts and stars gathering, sparkly aura
  - attack_2: DAZZLING heart/star burst with rainbow energy
  - attack_3: Explosion of hearts, stars, flowers, and sparkles
  - attack_4: Victory pose with floating hearts and twinkling stars`,

    default: `POWERFUL attack sequence with dramatic effects!
  - attack_1: Wind up / preparation pose with energy gathering
  - attack_2: Full power strike with visible energy effects
  - attack_3: Impact moment with particles, sparks, and shockwave
  - attack_4: Follow through with lingering effects`
};

async function generateSprite(inputImagePath, outputPath, attackStyle = 'default') {
    let prompt;

    if (attackStyle === 'auto') {
        // autoモード: 画像を分析してキャラに最適な攻撃を自動生成
        prompt = `Using this exact character design, create a sprite sheet animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with:
- 4 columns x 2 rows (8 frames total)
- Size: 1376 x 768 pixels
- Each frame: 344 x 384 pixels
- SOLID BRIGHT GREEN background (#00FF00) - chroma key green for easy removal

Row 1: idle, walk_1, walk_2, walk_3

Row 2 (Attack Animation): ANALYZE this character carefully and create an attack animation that PERFECTLY MATCHES the character's theme, appearance, and personality:
- If the character holds a weapon (sword, staff, gun, etc.) - use that weapon in the attack
- If the character is food-themed (fruit, vegetable, drink) - attack by throwing/splashing related items
- If the character is an animal - use natural animal attacks (claws, bite, charge)
- If the character is cute/kawaii - use hearts, stars, sparkles
- If the character has elemental features (fire, water, ice) - use that element
- If the character is a dancer/ballerina - use graceful spinning attacks
- If the character rides something - use a charging attack with the mount
- If the character has wings - use aerial swooping attacks
- If the character is tea/coffee themed - splash hot liquid
- If the character is a ninja - use shuriken/kunai/shadow techniques
- Make the attack animation MATCH what this specific character would naturally do!

  - attack_1: Preparation pose - gathering energy/power appropriate to this character
  - attack_2: Main attack action - SPECTACULAR move that fits this character's theme
  - attack_3: Impact moment - explosion/burst effect matching the character's style
  - attack_4: Follow through - landing/recovery with lingering effects

Character must face RIGHT. This is an ULTRA RARE unit - make the attack animation SPECTACULAR and EPIC!

CRITICAL: Do NOT add any text labels. NO "Idle", "Walk", "Attack" text. ONLY character graphics.`;
    } else {
        // 固定スタイルモード
        const attackDesc = ATTACK_STYLES[attackStyle] || ATTACK_STYLES.default;
        prompt = `Using this exact character design, create a sprite sheet animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with:
- 4 columns x 2 rows (8 frames total)
- Size: 1376 x 768 pixels
- Each frame: 344 x 384 pixels
- SOLID BRIGHT GREEN background (#00FF00) - chroma key green for easy removal

Row 1: idle, walk_1, walk_2, walk_3
Row 2: ${attackDesc}

Character must face RIGHT. This is an ULTRA RARE unit - make the attack animation SPECTACULAR and EPIC!

CRITICAL: Do NOT add any text labels. NO "Idle", "Walk", "Attack" text. ONLY character graphics.`;
    }

    console.log('=== UR Sprite Generator (Intense Attack) ===');
    console.log('Input:', inputImagePath);
    console.log('Output:', outputPath);
    console.log('Attack Style:', attackStyle);

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
Usage: node generate_ur_sprite.js <input_image> <output_path> [attack_style]

Attack Styles:
  auto     - 🌟 RECOMMENDED! Auto-analyze character and generate matching attack
  mech     - Robots, mechs, gundams (lasers, cannons, explosions)
  knight   - Sword warriors (blade slashes, energy arcs)
  paladin  - Holy warriors (divine light, sacred power)
  ninja    - Ninjas (shuriken, kunai, shadow techniques)
  beast    - Animals, monsters (claws, fangs, primal power)
  magic    - Wizards, mages (spells, arcane energy)
  dancer   - Dancers, ballerinas (graceful spins, elegant kicks)
  gunner   - Ranged attackers (guns, bows, projectiles)
  water    - Water/aquatic (waves, bubbles, hydro blasts)
  fire     - Fire/flame (inferno, embers, explosions)
  ice      - Ice/frost (blizzard, ice shards, freezing)
  rider    - Mount riders (charging attacks with mount)
  food     - Food-themed (throwing food, splashing)
  cute     - Kawaii characters (hearts, stars, sparkles)
  default  - Generic powerful attack

Examples:
  node generate_ur_sprite.js input.webp output.png auto     # 🌟 Auto-detect best style
  node generate_ur_sprite.js input.webp output.png knight   # Sword warrior style
  node generate_ur_sprite.js input.webp output.png cute     # Kawaii style
`);
    process.exit(1);
}

generateSprite(args[0], args[1], args[2] || 'auto');
