"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import stagesData from "@/data/stages.json";
import unitsData from "@/data/units.json";
import playerData from "@/data/player.json";
import type { StageDefinition, UnitDefinition } from "@/data/types";

// Phaserコンポーネントを動的インポート（SSR無効）
const PhaserGame = dynamic(
    () => import("@/components/game/PhaserGame"),
    { ssr: false }
);

const allStages = stagesData as StageDefinition[];
const allUnits = unitsData as UnitDefinition[];

export default function BattlePage() {
    const router = useRouter();
    const params = useParams();
    const stageId = params.stageId as string;

    const [stage, setStage] = useState<StageDefinition | null>(null);
    const [team, setTeam] = useState<UnitDefinition[]>([]);
    const [battleEnded, setBattleEnded] = useState(false);
    const [result, setResult] = useState<{ win: boolean; coins: number } | null>(null);

    useEffect(() => {
        // ステージデータ取得
        const stageData = allStages.find((s) => s.id === stageId);
        if (!stageData) {
            router.push("/stages");
            return;
        }
        setStage(stageData);

        // 編成データ取得（チームのユニット定義）
        const teamDefs = playerData.selectedTeam
            .map((id) => allUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
        setTeam(teamDefs);
    }, [stageId, router]);

    const handleBattleEnd = (win: boolean, coinsGained: number) => {
        setBattleEnded(true);
        setResult({ win, coins: coinsGained });

        // 3秒後にリザルト画面へ
        setTimeout(() => {
            router.push(`/result?win=${win}&coins=${coinsGained}&stage=${stageId}`);
        }, 3000);
    };

    if (!stage) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Loading...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-4 flex flex-col">
            {/* ヘッダー */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <Link href="/stages" className="text-blue-400 text-sm hover:text-blue-300">
                        ← ステージ選択に戻る
                    </Link>
                </div>
                <h1 className="text-xl font-bold">{stage.name}</h1>
                <div className="text-sm text-gray-400">
                    編成: {team.length}体
                </div>
            </div>

            {/* ゲーム画面 */}
            <div className="flex-1 flex items-center justify-center">
                <PhaserGame
                    stage={stage}
                    team={team}
                    allUnits={allUnits}
                    onBattleEnd={handleBattleEnd}
                />
            </div>

            {/* バトル終了オーバーレイ */}
            {battleEnded && result && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="text-center">
                        <h2 className={`text-6xl font-bold mb-4 ${result.win ? "text-yellow-400" : "text-red-500"}`}>
                            {result.win ? "🎉 勝利！" : "💀 敗北..."}
                        </h2>
                        {result.win && (
                            <p className="text-2xl text-white">
                                +{result.coins} コイン獲得！
                            </p>
                        )}
                        <p className="mt-4 text-gray-400">リザルト画面へ移動中...</p>
                    </div>
                </div>
            )}

            {/* 操作説明 */}
            <div className="mt-4 text-center text-sm text-gray-500">
                💡 下のボタンでユニットを召喚！ドラッグでカメラ移動
            </div>
        </main>
    );
}
