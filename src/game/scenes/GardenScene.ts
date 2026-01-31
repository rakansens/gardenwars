import Phaser from 'phaser';
import { GardenPet } from '../entities/GardenPet';
import type { UnitDefinition, Rarity } from '@/data/types';
import { eventBus, GameEvents } from '../utils/EventBus';

// スプライトパスを取得するユーティリティ
function getSpritePath(id: string, rarity?: Rarity): string {
    if (id.startsWith('enemy_')) {
        return `/assets/sprites/enemies/${id}.webp`;
    }
    if (id.startsWith('boss_')) {
        return `/assets/sprites/bosses/${id}.webp`;
    }
    if (id.startsWith('castle_')) {
        return `/assets/sprites/common/${id}.webp`;
    }
    if (rarity) {
        return `/assets/sprites/allies/${rarity}/${id}.webp`;
    }
    return `/assets/sprites/sheets/${id}`;
}

function getSheetPath(id: string): { image: string; json: string } {
    return {
        image: `/assets/sprites/sheets/${id}_sheet.webp`,
        json: `/assets/sprites/sheets/${id}_sheet.json`
    };
}

export interface GardenSceneData {
    units: UnitDefinition[];
}

export class GardenScene extends Phaser.Scene {
    private units: GardenPet[] = [];
    private unitsData: UnitDefinition[] = [];

    // Public for pets to access
    public foodGroup!: Phaser.GameObjects.Group;
    public poopGroup!: Phaser.GameObjects.Group;

    constructor() {
        super({ key: 'GardenScene' });
    }

    init(data: GardenSceneData) {
        this.unitsData = data.units || [];
    }

    preload() {
        // 背景 - 森のステージ画像を使用
        this.load.image('bg_garden', '/assets/stages/stage_1.webp');
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

        // アニメーションシートをロード
        const unitsWithSheets = [
            'cat_warrior', 'corn_fighter', 'penguin_boy', 'cinnamon_girl',
            'nika', 'lennon'
        ];

        const loadedSheets = new Set<string>();
        for (const unit of this.unitsData) {
            const spriteId = unit.baseUnitId || unit.atlasKey || unit.id;
            if (unitsWithSheets.includes(spriteId) && !loadedSheets.has(spriteId)) {
                const sheetPath = getSheetPath(spriteId);
                this.load.atlas(`${spriteId}_atlas`, sheetPath.image, sheetPath.json);
                loadedSheets.add(spriteId);
            }
        }
    }

    create() {
        const { width, height } = this.scale;

        // 背景画像をタイル表示
        const bgTexture = this.textures.get('bg_garden');
        if (bgTexture && bgTexture.key !== '__MISSING') {
            const bg = this.add.tileSprite(0, 0, width, height, 'bg_garden');
            bg.setOrigin(0, 0);
            bg.setTileScale(0.5); // 適度なスケール
        } else {
            // フォールバック: 空と地面
            this.add.rectangle(0, 0, width, height, 0x87CEEB).setOrigin(0);
            this.add.rectangle(0, height - 100, width, 200, 0x4caf50).setOrigin(0);
        }

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

        eventBus.on(GameEvents.GARDEN_FEED, this.handleFeed as any);
        eventBus.on(GameEvents.GARDEN_CLEAN, this.handleClean);

        console.log('GardenScene: Listeners attached');

        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            console.log('GardenScene: Shutdown');
            eventBus.off(GameEvents.GARDEN_FEED, this.handleFeed as any);
            eventBus.off(GameEvents.GARDEN_CLEAN, this.handleClean);
        });
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
