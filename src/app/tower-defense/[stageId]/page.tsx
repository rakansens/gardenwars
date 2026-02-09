"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { towerDefenseStages } from "@/data/tower-defense";
import unitsData from "@/data/units";
import type { TowerDefenseStageDefinition, UnitDefinition } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// 横向き検出フック
function useIsLandscape() {
    const [isLandscape, setIsLandscape] = useState(false);
    useEffect(() => {
        const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);
    return isLandscape;
}

// Phaserコンポーネントを動的インポート（SSR無効）
const PhaserGame = dynamic(
    () => import("@/components/game/PhaserGame"),
    { ssr: false }
);

const allUnits = unitsData as UnitDefinition[];
// プレイヤーが使用可能なユニット（ボス除外）
const playableUnits = allUnits.filter(u => !u.id.startsWith("boss_") && !u.isBoss);

const STORAGE_KEY = "td_team";

export default function TowerDefenseBattlePage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const stageId = params.stageId as string;
    const teamParam = searchParams.get("team");
    const { t } = useLanguage();
    const { selectedTeam, isLoaded } = usePlayerData();
    const isLandscape = useIsLandscape();

    const [stage, setStage] = useState<TowerDefenseStageDefinition | null>(null);
    const [team, setTeam] = useState<UnitDefinition[]>([]);
    const [battleEnded, setBattleEnded] = useState(false);
    const [result, setResult] = useState<{ win: boolean; coins: number } | null>(null);

    useEffect(() => {
        if (!isLoaded) return;

        // ステージデータ取得
        const stageData = towerDefenseStages.find((s) => s.id === stageId);
        if (!stageData) {
            router.push("/tower-defense");
            return;
        }
        setStage(stageData);

        // 編成優先順位: URLパラメータ → localStorage → selectedTeam → フォールバック
        let newTeamDefs: UnitDefinition[] = [];

        // 1. URLパラメータ（選択ページから遷移時）
        if (teamParam) {
            newTeamDefs = teamParam.split(",")
                .map(id => playableUnits.find(u => u.id === id))
                .filter((u): u is UnitDefinition => !!u);
        }

        // 2. localStorage
        if (newTeamDefs.length === 0) {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const ids = JSON.parse(saved) as string[];
                    newTeamDefs = ids
                        .map(id => playableUnits.find(u => u.id === id))
                        .filter((u): u is UnitDefinition => !!u);
                }
            } catch { }
        }

        // 3. selectedTeam
        if (newTeamDefs.length === 0) {
            newTeamDefs = selectedTeam
                .map((id) => playableUnits.find((u) => u.id === id))
                .filter((u): u is UnitDefinition => u !== undefined);
        }

        // 4. フォールバック: 先頭4ユニット
        if (newTeamDefs.length === 0) {
            newTeamDefs = playableUnits.slice(0, 4);
        }

        setTeam(newTeamDefs);
    }, [stageId, router, selectedTeam, isLoaded, teamParam]);

    const battleEndedRef = useRef(false);

    const handleBattleEnd = async (win: boolean, coinsGained: number) => {
        // 重複呼び出し防止
        if (battleEndedRef.current) return;
        battleEndedRef.current = true;

        setBattleEnded(true);
        setResult({ win, coins: coinsGained });

        // 3秒後にリザルトへ
        setTimeout(() => {
            router.push(`/result?win=${win}&coins=${coinsGained}&stage=${stageId}`);
        }, 3000);
    };

    if (!stage) {
        return <LoadingSpinner icon="🏰" fullScreen />;
    }

    return (
        <main className="fixed inset-0 bg-[#1a1a2e] overflow-hidden">
            {/* ヘッダー - 右上に配置 */}
            <div className="absolute top-0 right-0 p-2 sm:p-4 z-20 flex items-center gap-2 pointer-events-none">
                <div className="btn btn-primary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 shadow-lg border-2 border-white/20">
                    🏰 <span className="hidden sm:inline">TD</span>
                </div>
                <Link href="/tower-defense" className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto shadow-lg border-2 border-white/20 opacity-70 hover:opacity-100">
                    <span className="sm:hidden">←</span>
                    <span className="hidden sm:inline">← {t("back")}</span>
                </Link>
            </div>

            {/* スマホ横向き時の案内 */}
            {isLandscape && (
                <div className="md:hidden absolute inset-0 flex items-center justify-center bg-black/90 z-50 p-6 text-center">
                    <div>
                        <div className="text-5xl mb-4 animate-bounce">📱↕️</div>
                        <h2 className="text-white text-2xl font-bold mb-2">縦向きでプレイしよう！</h2>
                        <p className="text-gray-300">
                            タワーディフェンスは縦画面に<br />
                            最適化されています。
                        </p>
                    </div>
                </div>
            )}

            {/* ゲーム画面 */}
            <div className="w-full h-full flex items-center justify-center">
                <PhaserGame
                    mode="tower-defense"
                    towerDefenseStage={stage}
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
