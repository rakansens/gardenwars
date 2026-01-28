"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { StageDefinition, UnitDefinition } from "@/data/types";

// グローバルなゲームインスタンス参照（重複防止）
let globalPhaserGame: Phaser.Game | null = null;

interface PhaserGameProps {
    mode?: 'battle' | 'garden';
    // Battle props
    stage?: StageDefinition;
    team?: UnitDefinition[];
    allUnits?: UnitDefinition[];
    onBattleEnd?: (win: boolean, coinsGained: number) => void;
    // Garden props
    gardenUnits?: UnitDefinition[]; // unitsだとallUnitsと混同するので明示的に
}

export default function PhaserGame({
    mode = 'battle',
    stage,
    team,
    allUnits,
    onBattleEnd,
    gardenUnits,
}: PhaserGameProps) {
    const gameRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPortrait, setIsPortrait] = useState(false);
    const battleEndedRef = useRef(false);
    const initSeqRef = useRef(0);

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

    useEffect(() => {
        if (!gameRef.current) return;
        const initSeq = ++initSeqRef.current;
        let cancelled = false;

        // 既存のゲームインスタンスを破棄
        if (globalPhaserGame) {
            console.log('[PhaserGame] Destroying existing game instance');
            globalPhaserGame.destroy(true);
            globalPhaserGame = null;
        }

        battleEndedRef.current = false;

        const initPhaser = async () => {
            const Phaser = (await import("phaser")).default;

            if (cancelled || initSeq !== initSeqRef.current) return () => { };

            // モバイル対応
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            let SceneClass: any;
            let startKey: string;
            let startData: any;

            if (mode === 'garden') {
                const { GardenScene } = await import("@/game/scenes/GardenScene");
                SceneClass = GardenScene;
                startKey = "GardenScene";
                startData = { units: gardenUnits || [] };
            } else {
                const { BattleScene } = await import("@/game/scenes/BattleScene");
                SceneClass = BattleScene;
                startKey = "BattleScene";
                startData = { stage, team, allUnits };

                // Battle用イベントリスナー
                const { eventBus, GameEvents } = await import("@/game/utils/EventBus");
                eventBus.removeAllListeners(GameEvents.BATTLE_WIN);
                eventBus.removeAllListeners(GameEvents.BATTLE_LOSE);

                const handleWin = (...args: unknown[]) => {
                    const result = args[0] as { coinsGained?: number } | undefined;
                    handleBattleEnd(true, result?.coinsGained || 0);
                };
                const handleLose = () => {
                    handleBattleEnd(false, 0);
                };
                eventBus.on(GameEvents.BATTLE_WIN, handleWin);
                eventBus.on(GameEvents.BATTLE_LOSE, handleLose);
            }

            const config: Phaser.Types.Core.GameConfig = {
                type: isMobile ? Phaser.CANVAS : Phaser.AUTO,
                parent: gameRef.current!,
                width: 1200,
                height: 675,
                backgroundColor: mode === 'garden' ? "#87CEEB" : "#1a1a2e",
                scene: [SceneClass],
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                    expandParent: true,
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

            return () => {
                if (mode === 'battle') {
                    // EventBus cleanup could go here if we imported it
                }
            };
        };

        let cleanup: (() => void) | undefined;
        initPhaser().then((cleanupFn) => {
            cleanup = cleanupFn;
        });

        return () => {
            console.log('[PhaserGame] Cleanup');
            cancelled = true;
            cleanup?.();
            if (globalPhaserGame) {
                globalPhaserGame.destroy(true);
                globalPhaserGame = null;
            }
        };
    }, [mode, stage, team, allUnits, gardenUnits, handleBattleEnd]);

    return (
        <div className="relative">
            {/* ローディング表示 */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-10">
                    <div className="text-center">
                        <div className="text-4xl animate-bounce mb-4">🐱</div>
                        <p className="text-white text-xl">Loading...</p>
                    </div>
                </div>
            )}

            {/* 縦向き時の案内（モバイルのみ） */}
            {isPortrait && (
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
            <div ref={gameRef} className="game-container" />
        </div>
    );
}
