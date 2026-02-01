import Phaser from 'phaser';
import { GardenPet } from '../entities/GardenPet';
import type { UnitDefinition, Rarity } from '@/data/types';
import { eventBus, GameEvents } from '../utils/EventBus';
import { getSpritePath, getSheetPath, ANIMATED_UNITS } from '@/lib/sprites';
import { GARDEN_BACKGROUNDS, type GardenBackgroundId } from '../constants/gardenBackgrounds';

// Re-export for convenience
export { GARDEN_BACKGROUNDS, type GardenBackgroundId };

export interface GardenSceneData {
    units: UnitDefinition[];
    backgroundId?: GardenBackgroundId;
}

export class GardenScene extends Phaser.Scene {
    private units: GardenPet[] = [];
    private unitsData: UnitDefinition[] = [];
    private currentBgId: GardenBackgroundId = 'garden_main';
    private bgImage?: Phaser.GameObjects.Image;
    private isSceneReady = false;
    private currentMotionMode: 'normal' | 'attack' = 'normal';

    // Public for pets to access
    public foodGroup!: Phaser.GameObjects.Group;
    public poopGroup!: Phaser.GameObjects.Group;

    constructor() {
        super({ key: 'GardenScene' });
    }

    init(data: GardenSceneData) {
        this.unitsData = data.units || [];
        this.currentBgId = data.backgroundId || 'garden_main';
        this.isSceneReady = false;
    }

    preload() {
        // 全ての背景画像をロード
        GARDEN_BACKGROUNDS.forEach(bg => {
            this.load.image(bg.id, `/assets/backgrounds/${bg.id}.webp`);
        });
        this.load.image('castle_ally', getSpritePath('castle_ally'));

        // ガーデンに表示するユニットのスプライトをロード
        const loadedSprites = new Set<string>();
        for (const unit of this.unitsData) {
            const spriteId = unit.baseUnitId || unit.atlasKey || unit.id;
            if (!loadedSprites.has(spriteId)) {
                this.load.image(spriteId, getSpritePath(spriteId, unit.rarity));
                loadedSprites.add(spriteId);
            }
            if (unit.id !== spriteId && !loadedSprites.has(unit.id)) {
                this.load.image(unit.id, getSpritePath(spriteId, unit.rarity));
                loadedSprites.add(unit.id);
            }
        }

        // アニメーションシートをロード（共有リストを使用）
        const loadedSheets = new Set<string>();
        for (const unit of this.unitsData) {
            const spriteId = unit.baseUnitId || unit.atlasKey || unit.id;
            if (ANIMATED_UNITS.includes(spriteId as any) && !loadedSheets.has(spriteId)) {
                const sheetPath = getSheetPath(spriteId);
                this.load.atlas(`${spriteId}_atlas`, sheetPath.image, sheetPath.json);
                loadedSheets.add(spriteId);
            }
        }
    }

    create() {
        const { width, height } = this.scale;

        // 背景画像を表示
        this.setBackground(this.currentBgId);

        // Groups - 明示的に初期化
        this.foodGroup = this.add.group({ runChildUpdate: false });
        this.poopGroup = this.add.group({ runChildUpdate: false });

        // アニメーション作成 (BattleSceneと同じロジックが必要だが簡易的に)
        this.createAnimations();

        // ユニット配置
        this.unitsData.forEach((def, index) => {
            // ランダムな位置
            const x = Phaser.Math.Between(100, width - 100);
            const y = Phaser.Math.Between(height - 150, height - 50); // 奥行きを持たせる

            const pet = new GardenPet(this, x, y, def, width);
            this.units.push(pet);
        });

        // Event Listeners
        // Need to bind context since EventBus doesn't take context arg
        this.handleFeed = this.handleFeed.bind(this);
        this.handleClean = this.handleClean.bind(this);
        this.handleBgChange = this.handleBgChange.bind(this);
        this.handleMotionMode = this.handleMotionMode.bind(this);

        eventBus.on(GameEvents.GARDEN_FEED, this.handleFeed as any);
        eventBus.on(GameEvents.GARDEN_CLEAN, this.handleClean);
        eventBus.on(GameEvents.GARDEN_BG_CHANGE, this.handleBgChange as any);
        eventBus.on(GameEvents.GARDEN_MOTION_MODE, this.handleMotionMode as any);

        this.isSceneReady = true;
        console.log('GardenScene: Listeners attached, scene ready');

        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            console.log('GardenScene: Shutdown');
            this.isSceneReady = false;
            eventBus.off(GameEvents.GARDEN_FEED, this.handleFeed as any);
            eventBus.off(GameEvents.GARDEN_CLEAN, this.handleClean);
            eventBus.off(GameEvents.GARDEN_BG_CHANGE, this.handleBgChange as any);
            eventBus.off(GameEvents.GARDEN_MOTION_MODE, this.handleMotionMode as any);
        });
    }

    private setBackground(bgId: GardenBackgroundId) {
        // シーンが破棄されている場合は何もしない
        if (!this.add || !this.scale) return;

        const { width, height } = this.scale;

        // 既存の背景を削除
        if (this.bgImage) {
            this.bgImage.destroy();
            this.bgImage = undefined;
        }

        const bgTexture = this.textures.get(bgId);
        if (bgTexture && bgTexture.key !== '__MISSING') {
            this.bgImage = this.add.image(width / 2, height / 2, bgId);
            // キャンバスにフィットするようにスケール調整
            const scaleX = width / this.bgImage.width;
            const scaleY = height / this.bgImage.height;
            const scale = Math.max(scaleX, scaleY);
            this.bgImage.setScale(scale);
            this.bgImage.setDepth(-1); // 最背面に
        }
        // フォールバックは初回のcreate()でのみ使用するため、ここでは省略

        this.currentBgId = bgId;
    }

    private handleBgChange(args: unknown) {
        // シーンが準備完了していない場合は何もしない
        if (!this.isSceneReady) return;

        const data = args as { bgId: GardenBackgroundId };
        if (data?.bgId && GARDEN_BACKGROUNDS.some(bg => bg.id === data.bgId)) {
            this.setBackground(data.bgId);
        }
    }

    private handleMotionMode(args: unknown) {
        if (!this.isSceneReady) return;

        const data = args as { mode: 'normal' | 'attack' };
        if (data?.mode && (data.mode === 'normal' || data.mode === 'attack')) {
            this.currentMotionMode = data.mode;
            // Notify all pets
            this.units.forEach(pet => pet.setMotionMode(data.mode));
        }
    }

    private handleFeed(args: unknown) {
        console.log('GardenScene: handleFeed received', args);
        try {
            if (!this.foodGroup) return;

            const data = args as { type: string };
            const { width, height } = this.scale;
            const x = Phaser.Math.Between(50, width - 50);
            const yStart = -50;
            const yEnd = Phaser.Math.Between(height - 150, height - 50);

            // Map food type to Emoji
            const emojiMap: Record<string, string> = {
                'n_apple': '🍎',
                'n_carrot': '🥕',
                'n_mushroom': '🍄'
            };
            const type = (data && data.type) ? data.type : 'n_apple';
            // If data.type is undefined, loop above defaults to apple.
            const emoji = emojiMap[type] || '🍎';

            // Use Text instead of Image
            const food = this.add.text(x, yStart, emoji, { fontSize: '48px' });
            food.setOrigin(0.5);
            this.foodGroup.add(food);

            // Fall animation
            this.tweens.add({
                targets: food,
                y: yEnd,
                duration: 1000,
                ease: 'Bounce.Out'
            });
        } catch (e) {
            console.error('GardenScene: Error in handleFeed', e);
        }
    }

    private handleClean() {
        console.log('GardenScene: handleClean');

        // poopGroupが存在するか確認
        if (!this.poopGroup) {
            console.warn('GardenScene: poopGroup not initialized');
            return;
        }

        // うんちのみを取得（foodGroupは触らない）
        const poops = this.poopGroup.getChildren().filter(obj => obj.active);
        console.log('GardenScene: Found', poops.length, 'poops to clean');

        if (poops.length === 0) {
            // うんちがない場合も掃除エフェクトは表示
            const text = this.add.text(this.scale.width / 2, this.scale.height / 2, "✨", {
                fontSize: '48px',
            }).setOrigin(0.5);
            this.tweens.add({
                targets: text,
                y: text.y - 50,
                alpha: 0,
                duration: 800,
                onComplete: () => text.destroy()
            });
            return;
        }

        // 各うんちを個別に処理（より確実に）
        poops.forEach((poop) => {
            this.tweens.add({
                targets: poop,
                alpha: 0,
                scale: 0,
                duration: 500,
                onComplete: () => {
                    if (poop && poop.active) {
                        poop.destroy();
                    }
                }
            });
        });

        // Visual feedback text
        const text = this.add.text(this.scale.width / 2, this.scale.height / 2, "CLEAN!", {
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#00af00',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: text.y - 100,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });
    }

    // Called by pets
    public spawnPoop(x: number, y: number) {
        // Use emoji instead of asset
        const poop = this.add.text(x, y, '💩', { fontSize: '32px' });
        poop.setOrigin(0.5);
        this.poopGroup.add(poop);
    }

    update(time: number, delta: number) {
        this.units.forEach(unit => unit.update(delta));
    }

    // ... createAnimations ...

    createAnimations() {
        // 主要キャラのアニメーション定義
        const anims = [
            'cat_warrior', 'corn_fighter', 'penguin_boy', 'cinnamon_girl', 'nika', 'lennon'
        ];

        anims.forEach(key => {
            // idle
            this.anims.create({
                key: `${key}_idle`,
                frames: [{ key: `${key}_atlas`, frame: `${key}_idle.png` }],
                frameRate: 10,
                repeat: -1
            });
            // walk
            // Only create walk animation if frames exist (cat_warrior only in current set)
            if (key === 'cat_warrior') {
                this.anims.create({
                    key: `${key}_walk`,
                    frames: this.anims.generateFrameNames(`${key}_atlas`, {
                        prefix: `${key}_walk_`,
                        start: 1,
                        end: 4,
                        suffix: '.png'
                    }),
                    frameRate: 8,
                    repeat: -1
                });
            }

            this.anims.create({
                key: `${key}_attack`,
                frames: this.anims.generateFrameNames(`${key}_atlas`, {
                    prefix: `${key}_attack_`,
                    start: 1,
                    end: 4,
                    suffix: '.png'
                }),
                frameRate: 12,
                repeat: 0
            });
        });
    }
}
