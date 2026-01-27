"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { StageDefinition, UnitDefinition } from "@/data/types";

// Phaser関連のインポートはクライアントサイドでのみ行う

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
    const phaserGameRef = useRef<Phaser.Game | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const handleBattleEnd = useCallback((win: boolean, coinsGained: number) => {
        onBattleEnd(win, coinsGained);
    }, [onBattleEnd]);

    useEffect(() => {
        if (!gameRef.current || phaserGameRef.current) return;

        // 動的インポートでPhaserをロード（SSR回避）
        const initPhaser = async () => {
            const Phaser = (await import("phaser")).default;
            const { BattleScene } = await import("@/game/scenes/BattleScene");
            const { eventBus, GameEvents } = await import("@/game/utils/EventBus");

            // イベントリスナー設定
            const handleWin = (result: { coinsGained: number }) => {
                handleBattleEnd(true, result.coinsGained);
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

            phaserGameRef.current = new Phaser.Game(config);

            // シーンにデータを渡して開始
            phaserGameRef.current.scene.start("BattleScene", {
                stage,
                team,
                allUnits,
            });

            setIsLoading(false);

            // クリーンアップ関数を返すためのリファレンス保存
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
            cleanup?.();
            if (phaserGameRef.current) {
                phaserGameRef.current.destroy(true);
                phaserGameRef.current = null;
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
