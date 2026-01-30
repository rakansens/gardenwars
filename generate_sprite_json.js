const fs = require('fs');
const path = require('path');

// Generate sprite sheet JSON for a unit
function generateSpriteJson(unitId) {
    const json = {
        frames: {
            [`${unitId}_idle.png`]: {
                frame: { x: 0, y: 0, w: 344, h: 384 },
                sourceSize: { w: 344, h: 384 }
            },
            [`${unitId}_walk_1.png`]: {
                frame: { x: 344, y: 0, w: 344, h: 384 },
                sourceSize: { w: 344, h: 384 }
            },
            [`${unitId}_walk_2.png`]: {
                frame: { x: 688, y: 0, w: 344, h: 384 },
                sourceSize: { w: 344, h: 384 }
            },
            [`${unitId}_walk_3.png`]: {
                frame: { x: 1032, y: 0, w: 344, h: 384 },
                sourceSize: { w: 344, h: 384 }
            },
            [`${unitId}_attack_1.png`]: {
                frame: { x: 0, y: 384, w: 344, h: 384 },
                sourceSize: { w: 344, h: 384 }
            },
            [`${unitId}_attack_2.png`]: {
                frame: { x: 344, y: 384, w: 344, h: 384 },
                sourceSize: { w: 344, h: 384 }
            },
            [`${unitId}_attack_3.png`]: {
                frame: { x: 688, y: 384, w: 344, h: 384 },
                sourceSize: { w: 344, h: 384 }
            },
            [`${unitId}_attack_4.png`]: {
                frame: { x: 1032, y: 384, w: 344, h: 384 },
                sourceSize: { w: 344, h: 384 }
            }
        },
        meta: {
            image: `${unitId}_sheet.png`,
            size: { w: 1376, h: 768 }
        }
    };
    return json;
}

// Get all UR sprite sheets without JSON
const spritesDir = 'public/assets/sprites';
const files = fs.readdirSync(spritesDir);
const sheetFiles = files.filter(f => f.startsWith('ur_') && f.endsWith('_sheet.png'));

let generated = 0;
for (const sheetFile of sheetFiles) {
    const unitId = sheetFile.replace('_sheet.png', '');
    const jsonPath = path.join(spritesDir, `${unitId}_sheet.json`);

    if (!fs.existsSync(jsonPath)) {
        const json = generateSpriteJson(unitId);
        fs.writeFileSync(jsonPath, JSON.stringify(json, null, 4));
        console.log(`Generated: ${unitId}_sheet.json`);
        generated++;
    }
}

console.log(`\nTotal generated: ${generated} JSON files`);
