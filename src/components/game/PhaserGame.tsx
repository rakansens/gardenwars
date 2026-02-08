"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { StageDefinition, UnitDefinition, ArenaStageDefinition, SurvivalDifficulty, MathBattleStageDefinition, MathOperationType, TowerDefenseStageDefinition, DungeonStageDefinition } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { setGameLanguage } from "@/lib/gameTranslations";

// グローバルなゲームインスタンス参照（重複防止）
let globalPhaserGame: Phaser.Game | null = null;

// Properly destroy global Phaser instance with cleanup
function destroyGlobalPhaserGame(): void {
    if (globalPhaserGame) {
        console.log('[PhaserGame] Destroying existing game instance');
        try {
            // Prevent AudioContext errors by disabling pause on blur
            if (globalPhaserGame.sound) {
                globalPhaserGame.sound.pauseOnBlur = false;
            }
            globalPhaserGame.destroy(true);
        } catch (e) {
            console.warn('[PhaserGame] Error during destroy:', e);
        }
        globalPhaserGame = null;
    }
}

interface PhaserGameProps {
    mode?: 'battle' | 'garden' | 'arena' | 'survival' | 'math-battle' | 'tower-defense' | 'dungeon';
    // Battle props
    stage?: StageDefinition;
    team?: UnitDefinition[];
    allUnits?: UnitDefinition[];
    loadouts?: [UnitDefinition[], UnitDefinition[], UnitDefinition[]]; // 3つのデッキ
    activeLoadoutIndex?: number;
    onBattleEnd?: (win: boolean, coinsGained: number) => void;
    // Garden props
    gardenUnits?: UnitDefinition[]; // unitsだとallUnitsと混同するので明示的に
    gardenBackgroundId?: string; // 背景ID
    // Arena props
    arenaStage?: ArenaStageDefinition;
    // Survival props
    survivalPlayer?: UnitDefinition;
    survivalDifficulty?: SurvivalDifficulty;
    // Math Battle props
    mathBattleStage?: MathBattleStageDefinition;
    mathBattlePlayerUnit?: UnitDefinition;
    mathBattleEnemyUnit?: UnitDefinition;
    mathBattleOperationType?: MathOperationType;
    onMathBattleEnd?: (win: boolean, stars: number, coinsGained: number) => void;
    // Tower Defense props
    towerDefenseStage?: TowerDefenseStageDefinition;
    // Dungeon props
    dungeonStage?: DungeonStageDefinition;
    onDungeonEnd?: (win: boolean, coinsGained: number) => void;
}

export default function PhaserGame({
    mode = 'battle',
    stage,
    team,
    allUnits,
    loadouts,
    activeLoadoutIndex,
    onBattleEnd,
    gardenUnits,
    gardenBackgroundId,
    arenaStage,
    survivalPlayer,
    survivalDifficulty,
    mathBattleStage,
    mathBattlePlayerUnit,
    mathBattleEnemyUnit,
    mathBattleOperationType,
    onMathBattleEnd,
    towerDefenseStage,
    dungeonStage,
    onDungeonEnd,
}: PhaserGameProps) {
    const gameRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPortrait, setIsPortrait] = useState(false);
    const battleEndedRef = useRef(false);
    const initSeqRef = useRef(0);
    const { language } = useLanguage();

    // Set game language for Phaser scenes to access
    useEffect(() => {
        setGameLanguage(language);
    }, [language]);

    // 画面の向きをチェック
    useEffect(() => {
        const checkOrientation = () => {
            setIsPortrait(window.innerHeight > window.innerWidth);
        };
        checkOrientation();
        window.addEventListener("resize", checkOrientation);
        return () => window.removeEventListener("resize", checkOrientation);
    }, []);

    const handleBattleEnd = useCallback((win: boolean, coinsGained: number) => {
        if (mode !== 'battle' || !onBattleEnd) return;
        if (battleEndedRef.current) return;
        battleEndedRef.current = true;
        onBattleEnd(win, coinsGained);
    }, [onBattleEnd, mode]);

    const handleMathBattleEnd = useCallback((win: boolean, stars: number, coinsGained: number) => {
        if (mode !== 'math-battle' || !onMathBattleEnd) return;
        if (battleEndedRef.current) return;
        battleEndedRef.current = true;
        onMathBattleEnd(win, stars, coinsGained);
    }, [onMathBattleEnd, mode]);

    useEffect(() => {
        if (!gameRef.current) return;
        const initSeq = ++initSeqRef.current;
        let cancelled = false;

        // Store event listener references for cleanup
        let eventBusModule: { eventBus: any; GameEvents: any } | null = null;
        let storedHandleWin: ((...args: unknown[]) => void) | null = null;
        let storedHandleLose: (() => void) | null = null;

        // Properly destroy existing game instance before creating new one
        destroyGlobalPhaserGame();

        battleEndedRef.current = false;

        const initPhaser = async () => {
            const Phaser = (await import("phaser")).default;

            if (cancelled || initSeq !== initSeqRef.current) return;

            // モバイル対応
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            let SceneClass: any;
            let startKey: string;
            let startData: any;

            if (mode === 'math-battle') {
                const { MathBattleScene } = await import("@/game/scenes/MathBattleScene");
                SceneClass = MathBattleScene;
                startKey = "MathBattleScene";
                startData = {
                    stage: mathBattleStage,
                    playerUnit: mathBattlePlayerUnit,
                    enemyUnit: mathBattleEnemyUnit,
                    operationType: mathBattleOperationType,
                };

                // MathBattle用イベントリスナー
                eventBusModule = await import("@/game/utils/EventBus");
                const { eventBus, GameEvents } = eventBusModule;
                eventBus.removeAllListeners(GameEvents.MATH_BATTLE_WIN);
                eventBus.removeAllListeners(GameEvents.MATH_BATTLE_LOSE);

                storedHandleWin = (...args: unknown[]) => {
                    const result = args[0] as { stars?: number; reward?: { coins?: number } } | undefined;
                    handleMathBattleEnd(true, result?.stars || 1, result?.reward?.coins || 0);
                };
                storedHandleLose = () => {
                    handleMathBattleEnd(false, 0, 0);
                };
                eventBus.on(GameEvents.MATH_BATTLE_WIN, storedHandleWin);
                eventBus.on(GameEvents.MATH_BATTLE_LOSE, storedHandleLose);
            } else if (mode === 'tower-defense') {
                const { TowerDefenseScene } = await import("@/game/scenes/TowerDefenseScene");
                SceneClass = TowerDefenseScene;
                startKey = "TowerDefenseScene";
                startData = { stage: towerDefenseStage, team, allUnits };

                // TD用イベントリスナー
                eventBusModule = await import("@/game/utils/EventBus");
                const { eventBus, GameEvents } = eventBusModule;
                eventBus.removeAllListeners(GameEvents.TD_WIN);
                eventBus.removeAllListeners(GameEvents.TD_LOSE);

                storedHandleWin = (...args: unknown[]) => {
                    const result = args[0] as { reward?: { coins?: number } } | undefined;
                    handleBattleEnd(true, result?.reward?.coins || 0);
                };
                storedHandleLose = () => {
                    handleBattleEnd(false, 0);
                };
                eventBus.on(GameEvents.TD_WIN, storedHandleWin);
                eventBus.on(GameEvents.TD_LOSE, storedHandleLose);
            } else if (mode === 'dungeon') {
                const { DungeonScene } = await import("@/game/scenes/DungeonScene");
                SceneClass = DungeonScene;
                startKey = "DungeonScene";
                const fallbackPlayer = survivalPlayer
                    || team?.[0]
                    || (allUnits || []).find(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);
                startData = { player: fallbackPlayer, allUnits, team: team || [], stageData: dungeonStage, difficulty: survivalDifficulty };

                // Dungeon用イベントリスナー
                eventBusModule = await import("@/game/utils/EventBus");
                const { eventBus: dBus, GameEvents: dEvents } = eventBusModule;
                dBus.removeAllListeners(dEvents.DUNGEON_WIN);
                dBus.removeAllListeners(dEvents.DUNGEON_LOSE);

                storedHandleWin = (...args: unknown[]) => {
                    const coins = (args[0] as number) || 0;
                    if (onDungeonEnd) onDungeonEnd(true, coins);
                };
                storedHandleLose = (...args: unknown[]) => {
                    const coins = (args[0] as number) || 0;
                    if (onDungeonEnd) onDungeonEnd(false, coins);
                };
                dBus.on(dEvents.DUNGEON_WIN, storedHandleWin);
                dBus.on(dEvents.DUNGEON_LOSE, storedHandleLose);
            } else if (mode === 'garden') {
                const { GardenScene } = await import("@/game/scenes/GardenScene");
                SceneClass = GardenScene;
                startKey = "GardenScene";
                startData = { units: gardenUnits || [], backgroundId: gardenBackgroundId };
            } else if (mode === 'survival') {
                const { SurvivalScene } = await import("@/game/scenes/SurvivalScene");
                SceneClass = SurvivalScene;
                startKey = "SurvivalScene";
                const fallbackPlayer = survivalPlayer
                    || team?.[0]
                    || (allUnits || []).find(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);
                startData = { player: fallbackPlayer, allUnits, difficulty: survivalDifficulty };
            } else if (mode === 'arena') {
                const { ArenaScene } = await import("@/game/scenes/ArenaScene");
                SceneClass = ArenaScene;
                startKey = "ArenaScene";
                startData = { stage: arenaStage, team, allUnits };

                // Arena用イベントリスナー - store references for cleanup
                eventBusModule = await import("@/game/utils/EventBus");
                const { eventBus, GameEvents } = eventBusModule;
                eventBus.removeAllListeners(GameEvents.BATTLE_WIN);
                eventBus.removeAllListeners(GameEvents.BATTLE_LOSE);

                storedHandleWin = (...args: unknown[]) => {
                    const result = args[0] as { reward?: { coins?: number } } | undefined;
                    handleBattleEnd(true, result?.reward?.coins || 0);
                };
                storedHandleLose = () => {
                    handleBattleEnd(false, 0);
                };
                eventBus.on(GameEvents.BATTLE_WIN, storedHandleWin);
                eventBus.on(GameEvents.BATTLE_LOSE, storedHandleLose);
            } else {
                const { BattleScene } = await import("@/game/scenes/BattleScene");
                SceneClass = BattleScene;
                startKey = "BattleScene";
                startData = { stage, team, allUnits, loadouts, activeLoadoutIndex };

                // Battle用イベントリスナー - store references for cleanup
                eventBusModule = await import("@/game/utils/EventBus");
                const { eventBus, GameEvents } = eventBusModule;
                eventBus.removeAllListeners(GameEvents.BATTLE_WIN);
                eventBus.removeAllListeners(GameEvents.BATTLE_LOSE);

                storedHandleWin = (...args: unknown[]) => {
                    const result = args[0] as { coinsGained?: number } | undefined;
                    handleBattleEnd(true, result?.coinsGained || 0);
                };
                storedHandleLose = () => {
                    handleBattleEnd(false, 0);
                };
                eventBus.on(GameEvents.BATTLE_WIN, storedHandleWin);
                eventBus.on(GameEvents.BATTLE_LOSE, storedHandleLose);
            }

            // アリーナは縦長、算数バトルは小さめ、それ以外は横長
            const isArena = mode === 'arena';
            const isTD = mode === 'tower-defense';
            const isDungeon = mode === 'dungeon';
            const isMathBattle = mode === 'math-battle';
            const gameWidth = (isArena || isTD) ? 675 : (isDungeon ? 900 : (isMathBattle ? 800 : 1200));
            const gameHeight = (isArena || isTD) ? 1200 : (isDungeon ? 675 : (isMathBattle ? 600 : 675));

            const config: Phaser.Types.Core.GameConfig = {
                type: isMobile ? Phaser.CANVAS : Phaser.AUTO,
                parent: gameRef.current!,
                width: gameWidth,
                height: gameHeight,
                backgroundColor: mode === 'garden' ? "#87CEEB" : "#1a1a2e",
                scene: [SceneClass],
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                    expandParent: false,
                },
                input: {
                    activePointers: 3,
                    touch: { capture: true },
                },
                render: {
                    pixelArt: false,
                    antialias: true,
                },
            };

            globalPhaserGame = new Phaser.Game(config);
            globalPhaserGame.scene.start(startKey, startData);

            if (!cancelled && initSeq === initSeqRef.current) {
                setIsLoading(false);
            }
        };

        initPhaser();

        return () => {
            console.log('[PhaserGame] Cleanup');
            cancelled = true;

            // Clean up EventBus listeners with stored references
            if (eventBusModule && (storedHandleWin || storedHandleLose)) {
                const { eventBus, GameEvents } = eventBusModule;
                if (storedHandleWin) {
                    eventBus.off(GameEvents.BATTLE_WIN, storedHandleWin);
                    eventBus.off(GameEvents.MATH_BATTLE_WIN, storedHandleWin);
                    eventBus.off(GameEvents.TD_WIN, storedHandleWin);
                    eventBus.off(GameEvents.DUNGEON_WIN, storedHandleWin);
                }
                if (storedHandleLose) {
                    eventBus.off(GameEvents.BATTLE_LOSE, storedHandleLose);
                    eventBus.off(GameEvents.MATH_BATTLE_LOSE, storedHandleLose);
                    eventBus.off(GameEvents.TD_LOSE, storedHandleLose);
                    eventBus.off(GameEvents.DUNGEON_LOSE, storedHandleLose);
                }
            }

            // Destroy global Phaser game instance
            destroyGlobalPhaserGame();
        };
    }, [mode, stage, team, allUnits, gardenUnits, arenaStage, survivalPlayer, survivalDifficulty, handleBattleEnd, mathBattleStage, mathBattlePlayerUnit, mathBattleEnemyUnit, mathBattleOperationType, handleMathBattleEnd, towerDefenseStage, dungeonStage, onDungeonEnd]);

    return (
        <div className="relative w-full h-full">
            {/* ローディング表示 */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-10">
                    <div className="text-center">
                        <div className="text-4xl animate-bounce mb-4">🐱</div>
                        <p className="text-white text-xl">Loading...</p>
                    </div>
                </div>
            )}

            {/* 縦向き時の案内（モバイルのみ、アリーナ以外） */}
            {isPortrait && mode !== 'arena' && mode !== 'tower-defense' && mode !== 'dungeon' && (
                <div className="md:hidden absolute inset-0 flex items-center justify-center bg-black/90 z-50 p-6 text-center">
                    <div>
                        <div className="text-5xl mb-4 animate-spin-slow">📱🔄</div>
                        <h2 className="text-white text-2xl font-bold mb-2">横向きでプレイしよう！</h2>
                        <p className="text-gray-300">
                            画面を横にすると、バトルシーンが<br />
                            さらに大きく見やすくなります。
                        </p>
                    </div>
                </div>
            )}

            {/* ゲームコンテナ */}
            <div ref={gameRef} className="game-container w-full h-full" />
        </div>
    );
}
