"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import stagesData from "@/data/stages.json";
import unitsData from "@/data/units.json";
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
    const { selectedTeam, isLoaded } = usePlayerData();

    const [stage, setStage] = useState<StageDefinition | null>(null);
    const [team, setTeam] = useState<UnitDefinition[]>([]);
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
    }, [stageId, router, selectedTeam, isLoaded]);

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
                <div className="text-xl">{t("loading")}</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-4 flex flex-col">
            {/* ヘッダー */}
            <div className="mb-4 flex items-center justify-between gap-2">
                <Link href="/stages" className="btn btn-secondary text-sm py-2 px-3">
                    ← {t("back_to_stages")}
                </Link>
                <h1 className="text-lg md:text-xl font-bold truncate">{t(stage.name)}</h1>
                <div className="btn btn-primary pointer-events-none text-sm py-2 px-3">
                    🎮 {team.length}
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
                        <h2 className={`text-6xl font-bold mb-4 ${result.win ? "text-amber-400" : "text-red-600"}`}>
                            {result.win ? `🎉 ${t("victory")}` : `💀 ${t("defeat")}`}
                        </h2>
                        {result.win && (
                            <p className="text-2xl text-white">
                                +{result.coins} {t("coins")}!
                            </p>
                        )}
                        <p className="mt-4 text-amber-100/70">{t("loading")}</p>
                    </div>
                </div>
            )}

            {/* 操作説明 */}
            <div className="mt-4 text-center text-sm text-amber-900/60">
                💡 {t("stage_hint")}
            </div>
        </main>
    );
}
