import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import type { StageDefinition, UnitDefinition } from '@/data/types';

// ============================================
// Phaser Game 初期化
// ============================================

export interface GameConfig {
    parent: HTMLElement;
    width: number;
    height: number;
    stage: StageDefinition;
    team: UnitDefinition[];
    allUnits: UnitDefinition[];
}

export function createGame(config: GameConfig): Phaser.Game {
    const phaserConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: config.parent,
        width: config.width,
        height: config.height,
        backgroundColor: '#1a1a2e',
        scene: [BattleScene],
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { x: 0, y: 0 },
                debug: false,
            },
        },
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: {
            pixelArt: false,
            antialias: true,
        },
    };

    const game = new Phaser.Game(phaserConfig);

    // シーンにデータを渡して開始
    game.scene.start('BattleScene', {
        stage: config.stage,
        team: config.team,
        allUnits: config.allUnits,
    });

    return game;
}
