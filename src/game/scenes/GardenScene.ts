import Phaser from 'phaser';
import { GardenPet } from '../entities/GardenPet';
import type { UnitDefinition } from '@/data/types';
import { eventBus, GameEvents } from '../utils/EventBus';

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
        // 背景
        this.load.image('bg_garden', '/assets/backgrounds/stage_forest.png'); // 代用
        this.load.image('castle_ally', '/assets/sprites/castle_ally.webp'); // 一応

        // ユニットアセット
        const assetList = [
            { key: 'cat_warrior', path: 'cat_warrior' },
            { key: 'cat_tank', path: 'cat_tank' },
            { key: 'cat_archer', path: 'cat_archer' },
            { key: 'cat_mage', path: 'cat_mage' },
            { key: 'cat_ninja', path: 'cat_ninja' },
            { key: 'ice_flower', path: 'ice_flower' },
            { key: 'corn_fighter', path: 'corn_fighter' },
            { key: 'block_slime', path: 'block_slime' },
            { key: 'sunflower', path: 'sunflower' },
            { key: 'watermelon', path: 'watermelon' },
            { key: 'corn_kid', path: 'corn_kid' },
            { key: 'ribbon_girl', path: 'ribbon_girl' },
            { key: 'penguin_boy', path: 'penguin_boy' },
            { key: 'cinnamon_girl', path: 'cinnamon_girl' },
            { key: 'enemy_dog', path: 'enemy_dog' },
            { key: 'enemy_wolf', path: 'enemy_wolf' },
            { key: 'enemy_crow', path: 'enemy_crow' },
            { key: 'nika', path: 'nika' },
            { key: 'lennon', path: 'lennon' },
            // UR
            { key: 'ur_knight', path: 'ur_knight' },
            { key: 'ur_mage', path: 'ur_mage' },
            { key: 'ur_archer', path: 'ur_archer' },
            { key: 'ur_tank', path: 'ur_tank' },
            { key: 'ur_ninja', path: 'ur_ninja' },
            { key: 'ur_healer', path: 'ur_healer' },
            { key: 'ur_dragon', path: 'ur_dragon' },
            { key: 'ur_spirit', path: 'ur_spirit' },
            { key: 'ur_phoenix', path: 'ur_phoenix' },
            { key: 'ur_golem', path: 'ur_golem' },
            { key: 'ur_angel', path: 'ur_angel' },
            // R vegetables
            { key: 'r_tomato', path: 'r_tomato' },
            { key: 'r_pepper', path: 'r_pepper' },
            { key: 'r_broccoli', path: 'r_broccoli' },
            { key: 'r_eggplant', path: 'r_eggplant' },
            { key: 'r_cherry', path: 'r_cherry' },
            { key: 'r_lemon', path: 'r_lemon' },
            { key: 'r_radish', path: 'r_radish' },
            // N vegetables
            { key: 'n_mushroom', path: 'n_mushroom' },
            { key: 'n_apple', path: 'n_apple' },
            { key: 'n_carrot', path: 'n_carrot' },
            { key: 'n_pumpkin', path: 'n_pumpkin' },
            { key: 'n_acorn', path: 'n_acorn' },
            { key: 'n_strawberry', path: 'n_strawberry' },
            { key: 'n_onion', path: 'n_onion' },
            { key: 'n_grape', path: 'n_grape' },
        ];

        assetList.forEach(asset => {
            this.load.image(asset.key, `/assets/sprites/${asset.path}.webp`);
        });

        // アトラス
        const atlases = [
            'cat_warrior', 'corn_fighter', 'penguin_boy', 'cinnamon_girl',
            'nika', 'lennon'
        ];

        atlases.forEach(key => {
            this.load.atlas(`${key}_atlas`, `/assets/sprites/${key}_sheet.webp`, `/assets/sprites/${key}_sheet.json`);
        });
    }

    create() {
        const { width, height } = this.scale;

        // 背景 (空)
        this.add.rectangle(0, 0, width, height, 0x87CEEB).setOrigin(0);

        // 地面
        this.add.rectangle(0, height - 100, width, 200, 0x4caf50).setOrigin(0); // 緑の芝生

        // Groups
        this.foodGroup = this.add.group();
        this.poopGroup = this.add.group();

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
        // Destroy all poop
        const poops = this.poopGroup.getChildren();
        if (poops.length === 0) return;

        this.tweens.add({
            targets: poops,
            alpha: 0,
            scale: 0,
            duration: 500,
            onComplete: () => {
                this.poopGroup.clear(true, true);
            }
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
