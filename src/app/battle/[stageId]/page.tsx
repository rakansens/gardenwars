"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import stagesData from "@/data/stages.json";
import unitsData from "@/data/units";
import type { StageDefinition, UnitDefinition } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";

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
    const { t } = useLanguage();
    const { selectedTeam, isLoaded, refreshShop, loadouts, activeLoadoutIndex, addCoins } = usePlayerData();

    const [stage, setStage] = useState<StageDefinition | null>(null);
    const [team, setTeam] = useState<UnitDefinition[]>([]);
    const [loadoutDefs, setLoadoutDefs] = useState<[UnitDefinition[], UnitDefinition[], UnitDefinition[]]>([[], [], []]);
    const [battleEnded, setBattleEnded] = useState(false);
    const [result, setResult] = useState<{ win: boolean; coins: number } | null>(null);

    useEffect(() => {
        // プレイヤーデータがロードされるまで待つ
        if (!isLoaded) return;

        // ステージデータ取得
        const stageData = allStages.find((s) => s.id === stageId);
        if (!stageData) {
            router.push("/stages");
            return;
        }
        setStage(stageData);

        // 編成データ取得（チームのユニット定義）
        const teamDefs = selectedTeam
            .map((id) => allUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
        setTeam(teamDefs);

        // 全ロードアウトを変換
        const convertedLoadouts: [UnitDefinition[], UnitDefinition[], UnitDefinition[]] = [
            (loadouts[0] || []).map(id => allUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
            (loadouts[1] || []).map(id => allUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
            (loadouts[2] || []).map(id => allUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
        ];
        setLoadoutDefs(convertedLoadouts);
    }, [stageId, router, selectedTeam, loadouts, isLoaded]);

    const handleBattleEnd = (win: boolean, coinsGained: number) => {
        setBattleEnded(true);
        setResult({ win, coins: coinsGained });

        if (win) {
            // コイン加算（usePlayerData経由で状態管理）
            addCoins(coinsGained);
            refreshShop();
        }

        // 3秒後にリザルト画面へ
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
            {/* ヘッダー (オーバーレイ) */}
            <div className="absolute top-0 left-0 w-full p-4 z-20 flex items-center justify-between pointer-events-none">
                <Link href="/stages" className="btn btn-secondary text-sm py-2 px-3 pointer-events-auto shadow-lg border-2 border-white/20">
                    ← {t("back_to_stages")}
                </Link>
                <div className="btn btn-primary pointer-events-none text-sm py-2 px-3 shadow-lg border-2 border-white/20">
                    🎮 {team.length}
                </div>
            </div>

            {/* ゲーム画面 (フルスクリーン) */}
            <div className="w-full h-full flex items-center justify-center">
                <PhaserGame
                    stage={stage}
                    team={team}
                    allUnits={allUnits}
                    loadouts={loadoutDefs}
                    activeLoadoutIndex={activeLoadoutIndex}
                    onBattleEnd={handleBattleEnd}
                />
            </div>

            {/* 操作説明 (オーバーレイ・下部) */}
            <div className="absolute bottom-2 w-full text-center text-xs text-white/30 pointer-events-none z-10">
                💡 {t("stage_hint")}
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
