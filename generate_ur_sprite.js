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

    nature: `BOTANICAL FURY attack sequence with primal plant power!
  - attack_1: Vines and roses swirling, thorns extending, petals gathering
  - attack_2: MASSIVE rose storm / thorn barrage with petal hurricane
  - attack_3: Explosive bloom with thorns, petals, and nature energy burst
  - attack_4: Flowers settling, vines retracting with floating petals`,

    beast: `FEROCIOUS PRIMAL attack sequence with raw power!
  - attack_1: Crouching, muscles tensing, primal energy crackling
  - attack_2: DEVASTATING claw strike / bite with energy trails
  - attack_3: Savage impact with shockwave and primal roar effect
  - attack_4: Landing pose with residual wild energy`,

    magic: `SPECTACULAR ARCANE attack sequence with mystical power!
  - attack_1: Raising staff, gathering magical energy, glowing runes appear
  - attack_2: Full power magical blast with swirling energy and bright light
  - attack_3: Explosive impact with magical particles, stars, and arcane symbols
  - attack_4: Follow through with lingering magical sparkles and energy wisps`,

    default: `POWERFUL attack sequence with dramatic effects!
  - attack_1: Wind up / preparation pose with energy gathering
  - attack_2: Full power strike with visible energy effects
  - attack_3: Impact moment with particles, sparks, and shockwave
  - attack_4: Follow through with lingering effects`
};

async function generateSprite(inputImagePath, outputPath, attackStyle = 'default') {
    const attackDesc = ATTACK_STYLES[attackStyle] || ATTACK_STYLES.default;

    const prompt = `Using this exact character design, create a sprite sheet animation.

IMPORTANT: Keep the SAME character design, colors, and style from the input image.

Create a sprite sheet with:
- 4 columns x 2 rows (8 frames total)
- Size: 1376 x 768 pixels
- Each frame: 344 x 384 pixels
- Transparent background (NO white, NO checkerboard)

Row 1: idle, walk_1, walk_2, walk_3
Row 2: ${attackDesc}

Character must face RIGHT. This is an ULTRA RARE unit - make the attack animation SPECTACULAR and EPIC!

CRITICAL: Do NOT add any text labels. NO "Idle", "Walk", "Attack" text. ONLY character graphics.`;

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
  mech     - Robots, mechs, gundams (lasers, cannons, explosions)
  knight   - Sword warriors (blade slashes, energy arcs)
  paladin  - Holy warriors (divine light, sacred power)
  nature   - Plant/flower units (vines, petals, thorns)
  beast    - Animals, monsters (claws, fangs, primal power)
  magic    - Wizards, mages (spells, arcane energy)
  default  - Generic powerful attack

Examples:
  node generate_ur_sprite.js ur_botanical_gundam.webp ur_botanical_gundam_sheet.png mech
  node generate_ur_sprite.js ur_golden_paladin.webp ur_golden_paladin_sheet.png paladin
`);
    process.exit(1);
}

generateSprite(args[0], args[1], args[2] || 'default');
