"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { StageDefinition, UnitDefinition } from "@/data/types";

// グローバルなゲームインスタンス参照（重複防止）
let globalPhaserGame: Phaser.Game | null = null;

interface PhaserGameProps {
    stage: StageDefinition;
    team: UnitDefinition[];
    allUnits: UnitDefinition[];
    onBattleEnd: (win: boolean, coinsGained: number) => void;
}

export default function PhaserGame({
    stage,
    team,
    allUnits,
    onBattleEnd,
}: PhaserGameProps) {
    const gameRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const battleEndedRef = useRef(false);
    const initSeqRef = useRef(0);

    const handleBattleEnd = useCallback((win: boolean, coinsGained: number) => {
        // 重複呼び出し防止
        if (battleEndedRef.current) return;
        battleEndedRef.current = true;
        onBattleEnd(win, coinsGained);
    }, [onBattleEnd]);

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

        // バトル終了フラグをリセット
        battleEndedRef.current = false;

        // 動的インポートでPhaserをロード（SSR回避）
        const initPhaser = async () => {
            const Phaser = (await import("phaser")).default;
            const { BattleScene } = await import("@/game/scenes/BattleScene");
            const { eventBus, GameEvents } = await import("@/game/utils/EventBus");

            if (cancelled || initSeq !== initSeqRef.current) {
                return () => { };
            }

            // 既存のリスナーをクリア
            eventBus.removeAllListeners(GameEvents.BATTLE_WIN);
            eventBus.removeAllListeners(GameEvents.BATTLE_LOSE);

            // イベントリスナー設定
            const handleWin = (...args: unknown[]) => {
                const result = args[0] as { coinsGained?: number } | undefined;
                handleBattleEnd(true, result?.coinsGained || 0);
            };
            const handleLose = () => {
                handleBattleEnd(false, 0);
            };

            eventBus.on(GameEvents.BATTLE_WIN, handleWin);
            eventBus.on(GameEvents.BATTLE_LOSE, handleLose);

            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                parent: gameRef.current!,
                width: 1200,
                height: 675,
                backgroundColor: "#1a1a2e",
                scene: [BattleScene],
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
                render: {
                    pixelArt: false,
                    antialias: true,
                },
            };

            globalPhaserGame = new Phaser.Game(config);

            // シーンにデータを渡して開始
            globalPhaserGame.scene.start("BattleScene", {
                stage,
                team,
                allUnits,
            });

            if (!cancelled && initSeq === initSeqRef.current) {
                setIsLoading(false);
            }

            // クリーンアップ関数を返す
            return () => {
                eventBus.off(GameEvents.BATTLE_WIN, handleWin);
                eventBus.off(GameEvents.BATTLE_LOSE, handleLose);
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
    }, [stage, team, allUnits, handleBattleEnd]);

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

            {/* ゲームコンテナ */}
            <div ref={gameRef} className="game-container" />
        </div>
    );
}
