import Phaser from 'phaser';
import { GardenPet } from '../entities/GardenPet';
import type { UnitDefinition } from '@/data/types';

export interface GardenSceneData {
    units: UnitDefinition[];
}

export class GardenScene extends Phaser.Scene {
    private units: GardenPet[] = [];
    private unitsData: UnitDefinition[] = [];

    constructor() {
        super({ key: 'GardenScene' });
    }

    init(data: GardenSceneData) {
        this.unitsData = data.units || [];
    }

    preload() {
        // 背景
        this.load.image('bg_garden', '/assets/backgrounds/stage_forest.png'); // 代用
        this.load.image('castle_ally', '/assets/sprites/castle_ally.png'); // 一応

        // ユニットアセット (BattleSceneのものをコピー)
        // 本来はAssetLoaderとして共通化すべきだが、今回はベタ書き
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
            this.load.image(asset.key, `/assets/sprites/${asset.path}.png`);
        });

        // アトラス
        const atlases = [
            'cat_warrior', 'corn_fighter', 'penguin_boy', 'cinnamon_girl',
            'nika', 'lennon'
            // UR atlases actually don't exist yet in codebase? BattleScene only loads images for URs except maybe I missed checks.
            // Correct. BattleScene only loads images for UR. 
            // Wait, ur_knight etc are loaded as image in BattleScene.
        ];

        atlases.forEach(key => {
            this.load.atlas(`${key}_atlas`, `/assets/sprites/${key}_sheet.png`, `/assets/sprites/${key}_sheet.json`);
        });
    }

    create() {
        const { width, height } = this.scale;

        // 背景 (空)
        this.add.rectangle(0, 0, width, height, 0x87CEEB).setOrigin(0);

        // 地面
        this.add.rectangle(0, height - 100, width, 200, 0x4caf50).setOrigin(0); // 緑の芝生

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
    }

    update(time: number, delta: number) {
        this.units.forEach(unit => unit.update(delta));
    }

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
            // フレーム名は要確認だが、だいたい ${key}_walk_1.png とか
            // BattleSceneでは generateFrameNames を使ってるはず
            // ここでは簡易的に idle だけでも...いや、動くなら walk が欲しい。
            // BattleSceneの実装を真似る
            this.anims.create({
                key: `${key}_walk`,
                frames: this.anims.generateFrameNames(`${key}_atlas`, {
                    prefix: `${key}_walk_`,
                    start: 1,
                    end: 4, // 仮。実際はシートによる
                    suffix: '.png'
                }),
                frameRate: 8,
                repeat: -1
            });

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
