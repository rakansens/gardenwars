# UR Unit Sprite Animation Workflow

This document outlines the workflow for converting UR unit static images into animated sprite sheets.

## Overview
UR units are being upgraded from static images to full sprite sheet animations (Idle, Walk, Attack).
The process involves AI-based sprite sheet generation, automated background removal, and code integration.

## Tools
- **AI Image Generator**: For creating sprite sheets via Image-to-Image or Text-to-Image.
- **remove_bg.js**: Custom Node.js script to remove solid white backgrounds.

## Workflow Steps

### 1. Sprite Sheet Generation
Generate a sprite sheet using the existing unit image as a reference (Image-to-Image) or using a detailed description (Text-to-Image).

**Settings:**
- **Resolution**: 1024x1024 (recommended)
- **Layout**: Grid (e.g., 4 columns x 4 rows)
- **Rows**:
  - Row 1: Idle (4 frames)
  - Row 2: Walk (4 frames)
  - Row 3: Attack (3-4 frames)
- **Background**: **Solid WHITE background** (Pure white `#FFFFFF` is best for the script).

**Prompt Example:**
> Sprite sheet of [Character Description]. Layout: a grid of frames. Row 1: Idle (4 frames) - Standing, breathing. Row 2: Walk (4 frames) - Moving forward. Row 3: Attack (3 frames) - Action pose. Background: Solid WHITE background. Style: Modern 2D game asset.

### 2. Background Removal
Run the background removal script on the generated image.

```bash
node remove_bg.js public/assets/sprites/ur_target_sheet.png
```
*Creates/Overwrites the file with transparent background.*

### 3. JSON Atlas Definition
Create a JSON file (e.g., `public/assets/sprites/ur_target_sheet.json`) defining the frames.
Standard 1024x1024 4x4 grid example (256x256 per frame):

```json
{
  "frames": [
    { "filename": "ur_target_idle_1.png", "frame": { "x": 0, "y": 0, "w": 256, "h": 256 }, ... },
    ...
    { "filename": "ur_target_walk_1.png", "frame": { "x": 0, "y": 256, "w": 256, "h": 256 }, ... },
    ...
    { "filename": "ur_target_attack_1.png", "frame": { "x": 0, "y": 512, "w": 256, "h": 256 }, ... }
  ],
  "meta": { "size": { "w": 1024, "h": 1024 }, "scale": "1" }
}
```

### 4. Code Integration

**BattleScene.ts**
- Load the atlas:
  ```typescript
  this.load.atlas('ur_target_atlas', '/assets/sprites/ur_target_sheet.png', '/assets/sprites/ur_target_sheet.json');
  ```
- Define animations:
  ```typescript
  this.anims.create({ key: 'ur_target_idle', frames: ..., frameRate: 6, repeat: -1 });
  ```

**units.json**
- Update the unit definition to use the atlas and animation keys:
  ```json
  "atlasKey": "ur_target_atlas",
  "animKeys": {
    "idle": "ur_target_idle",
    "walk": "ur_target_walk",
    "attack": "ur_target_attack",
    "die": "die"
  }
  ```

## Pending UR Units
Checking logic: Use existing images (`public/assets/sprites/ur_xxx.png`) as source for Image-to-Image generation.

- [x] **ur_knight** (Celestial Knight) - *Done (v3)*
- [x] **ur_mage** (Arcane Sorcerer) - *Done*
- [x] **ur_dark_lord** (Dark Lord) - *Done (New)*
- [ ] **ur_archer** (Divine Archer)
- [ ] **ur_tank** (Heavy Guardian)
- [ ] **ur_ninja** (Shadow Assassin)
- [ ] **ur_healer** (High Priestess)
- [ ] **ur_angel** (Divine Seraph)

## Note on Naming
Ensure consistency in naming to avoid "missing asset" errors.
- Image: `ur_name_sheet.png`
- Atlas Key: `ur_name_atlas`
- Anim Keys: `ur_name_idle`, `ur_name_walk`, etc.
