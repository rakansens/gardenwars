"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { arenaStages } from "@/data/stages";
import unitsData from "@/data/units";
import type { ArenaStageDefinition, UnitDefinition } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";

// Phaserコンポーネントを動的インポート（SSR無効）
const PhaserGame = dynamic(
    () => import("@/components/game/PhaserGame"),
    { ssr: false }
);

const allUnits = unitsData as UnitDefinition[];

export default function ArenaBattlePage() {
    const router = useRouter();
    const params = useParams();
    const stageId = params.stageId as string;
    const { t } = useLanguage();
    const { selectedTeam, isLoaded, addCoins } = usePlayerData();

    const [stage, setStage] = useState<ArenaStageDefinition | null>(null);
    const [team, setTeam] = useState<UnitDefinition[]>([]);
    const [battleEnded, setBattleEnded] = useState(false);
    const [result, setResult] = useState<{ win: boolean; coins: number } | null>(null);

    useEffect(() => {
        if (!isLoaded) return;

        // ステージデータ取得
        const stageData = arenaStages.find((s) => s.id === stageId);
        if (!stageData) {
            router.push("/");
            return;
        }
        setStage(stageData);

        // 編成データ取得
        const teamDefs = selectedTeam
            .map((id) => allUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
        setTeam(teamDefs);
    }, [stageId, router, selectedTeam, isLoaded]);

    const handleBattleEnd = async (win: boolean, coinsGained: number) => {
        setBattleEnded(true);
        setResult({ win, coins: coinsGained });

        if (win) {
            addCoins(coinsGained);
        }

        // 3秒後にホームへ
        setTimeout(() => {
            router.push(`/result?win=${win}&coins=${coinsGained}&stage=${stageId}`);
        }, 3000);
    };

    if (!stage) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl">{t("loading")}</div>
            </main>
        );
    }

    return (
        <main className="fixed inset-0 bg-[#1a1a2e] overflow-hidden">
            {/* ヘッダー */}
            <div className="absolute top-0 left-0 w-full p-4 z-20 flex items-center justify-between pointer-events-none">
                <Link href="/" className="btn btn-secondary text-sm py-2 px-3 pointer-events-auto shadow-lg border-2 border-white/20">
                    ← {t("back")}
                </Link>
                <div className="btn btn-primary pointer-events-none text-sm py-2 px-3 shadow-lg border-2 border-white/20">
                    🏟️ Arena
                </div>
            </div>

            {/* ゲーム画面 */}
            <div className="w-full h-full flex items-center justify-center">
                <PhaserGame
                    mode="arena"
                    arenaStage={stage}
                    team={team}
                    allUnits={allUnits}
                    onBattleEnd={handleBattleEnd}
                />
            </div>

            {/* バトル終了オーバーレイ */}
            {battleEnded && result && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-in fade-in duration-500">
                    <div className="text-center p-8 bg-white/10 backdrop-blur-md rounded-3xl border-4 border-white/20 shadow-2xl">
                        <h2 className={`text-6xl font-bold mb-4 drop-shadow-lg ${result.win ? "text-amber-400" : "text-red-500"}`}>
                            {result.win ? `🎉 ${t("victory")}` : `💀 ${t("defeat")}`}
                        </h2>
                        {result.win && (
                            <p className="text-3xl text-white font-bold drop-shadow-md">
                                +{result.coins} {t("coins")}!
                            </p>
                        )}
                        <p className="mt-6 text-white/70 animate-pulse">{t("loading")}</p>
                    </div>
                </div>
            )}
        </main>
    );
}
