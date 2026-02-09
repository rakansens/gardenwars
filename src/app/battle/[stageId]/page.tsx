"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import stagesData from "@/data/stages";
import unitsData from "@/data/units";
import type { StageDefinition, UnitDefinition } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useAuth } from "@/contexts/AuthContext";
import { incrementBattleStatsRpc } from "@/lib/supabase";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// ドロップ処理用のユーティリティ
function processDrops(stage: StageDefinition, allUnits: UnitDefinition[]): string[] {
    if (!stage.reward.drops) return [];

    const droppedIds: string[] = [];
    stage.reward.drops.forEach(drop => {
        const roll = Math.random() * 100;
        if (roll < drop.rate) {
            const unit = allUnits.find(u => u.id === drop.unitId);
            if (unit) {
                droppedIds.push(unit.id);
            }
        }
    });
    return droppedIds;
}

// Phaserコンポーネントを動的インポート（SSR無効）
const PhaserGame = dynamic(
    () => import("@/components/game/PhaserGame"),
    { ssr: false }
);

const allStages = stagesData as StageDefinition[];
const allUnits = unitsData as UnitDefinition[];
// プレイヤーが使用可能なユニット（ボス除外）
const playableUnits = allUnits.filter(u => !u.id.startsWith("boss_") && !u.isBoss);

export default function BattlePage() {
    const router = useRouter();
    const params = useParams();
    const stageId = params.stageId as string;
    const { t } = useLanguage();
    const { playerId } = useAuth();
    const { selectedTeam, isLoaded, refreshShop, loadouts, activeLoadoutIndex, executeBattleReward, flushToSupabase } = usePlayerData();

    const [stage, setStage] = useState<StageDefinition | null>(null);
    const [team, setTeam] = useState<UnitDefinition[]>([]);
    const [loadoutDefs, setLoadoutDefs] = useState<[UnitDefinition[], UnitDefinition[], UnitDefinition[]]>([[], [], []]);
    const [battleEnded, setBattleEnded] = useState(false);
    const [result, setResult] = useState<{ win: boolean; coins: number } | null>(null);
    const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [stageNotFound, setStageNotFound] = useState(false);

    // Clean up navigation timer on unmount
    useEffect(() => {
        return () => {
            if (navigationTimerRef.current) {
                clearTimeout(navigationTimerRef.current);
                navigationTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        // プレイヤーデータがロードされるまで待つ
        if (!isLoaded) return;

        // ステージデータ取得
        const stageData = allStages.find((s) => s.id === stageId);
        if (!stageData) {
            setStageNotFound(true);
            // Show error message briefly before redirecting
            setTimeout(() => {
                router.push("/stages");
            }, 2000);
            return;
        }
        setStage(stageData);

        // 編成データ取得（チームのユニット定義、ボス除外）
        // Deep compare check to prevent Phaser reload
        const newTeamDefs = selectedTeam
            .map((id) => playableUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);

        const currentTeamIds = team.map(u => u.id).sort().join(',');
        const newTeamIds = newTeamDefs.map(u => u.id).sort().join(',');

        if (currentTeamIds !== newTeamIds && newTeamDefs.length > 0) {
            setTeam(newTeamDefs);
        } else if (team.length === 0 && newTeamDefs.length > 0) {
            setTeam(newTeamDefs); // Initial set
        }

        // 全ロードアウトを変換（ボス除外）
        // Deep compare loadouts
        const convertedLoadouts: [UnitDefinition[], UnitDefinition[], UnitDefinition[]] = [
            (loadouts[0] || []).map(id => playableUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
            (loadouts[1] || []).map(id => playableUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
            (loadouts[2] || []).map(id => playableUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
        ];

        // Simple check: compare lengths and first item IDs as a heuristic, or full stringify
        // Since this is for loadouts (context menu), it's less critical than 'team' for main gameplay, 
        // but still good to stabilize. PhaserGame depends on 'loadouts' prop.
        const currentLoadoutsSig = JSON.stringify(loadoutDefs.map(d => d.map(u => u.id)));
        const newLoadoutsSig = JSON.stringify(convertedLoadouts.map(d => d.map(u => u.id)));

        if (currentLoadoutsSig !== newLoadoutsSig) {
            setLoadoutDefs(convertedLoadouts);
        }
    }, [stageId, router, selectedTeam, loadouts, isLoaded]);

    const handleBattleEnd = async (win: boolean, coinsGained: number) => {
        setBattleEnded(true);
        setResult({ win, coins: coinsGained });

        let droppedUnitIds: string[] = [];

        // ステージ番号を抽出 (stage_5 -> 5)
        const stageNumMatch = stageId.match(/stage_(\d+)/);
        const stageNum = stageNumMatch ? parseInt(stageNumMatch[1], 10) : undefined;

        // バトル統計を記録（認証済みの場合のみ）- サーバー権威モード
        if (playerId) {
            incrementBattleStatsRpc(playerId, win, stageNum, stageId).catch(err => {
                console.error("Failed to update battle stats:", err);
            });
        }

        if (win && stage) {
            // ドロップ処理
            droppedUnitIds = processDrops(stage, allUnits);

            // アトミック操作: コイン + ステージクリア + ドロップを同時に実行
            // これにより報酬の一部だけ反映されるケースを防ぐ
            // サーバー権威モード: 認証済みユーザーはサーバーで処理
            await executeBattleReward(coinsGained, stageId, droppedUnitIds);

            // Ensure rewards are persisted to Supabase before navigation
            await flushToSupabase();

            refreshShop();
        }

        // 3秒後にリザルト画面へ（ドロップ情報を渡す）
        // Clear any existing timer before setting a new one
        if (navigationTimerRef.current) {
            clearTimeout(navigationTimerRef.current);
        }
        navigationTimerRef.current = setTimeout(() => {
            const dropsParam = droppedUnitIds.length > 0 ? `&drops=${droppedUnitIds.join(',')}` : '';
            router.push(`/result?win=${win}&coins=${coinsGained}&stage=${stageId}&mode=battle${dropsParam}`);
        }, 3000);
    };

    // Show error message when stage is not found
    if (stageNotFound) {
        return (
            <main className="fixed inset-0 bg-[#1a1a2e] flex flex-col items-center justify-center">
                <div className="text-center p-8">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-red-400 mb-2">
                        {t("stage_not_found") || "Stage not found"}
                    </h1>
                    <p className="text-white/70 mb-4">
                        {t("redirecting_to_stages") || "Redirecting to stage select..."}
                    </p>
                    <div className="animate-spin text-2xl">⏳</div>
                </div>
            </main>
        );
    }

    if (!stage) {
        return <LoadingSpinner icon="⚔️" fullScreen />;
    }

    return (
        <main className="fixed inset-0 bg-[#1a1a2e] overflow-hidden">
            {/* ヘッダー (オーバーレイ) - スマホ対応: Backボタンを右上に */}
            <div className="absolute top-0 right-0 p-2 sm:p-4 z-20 flex items-center gap-2 pointer-events-none">
                <div className="btn btn-primary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 shadow-lg border-2 border-white/20">
                    🎮 {team.length}
                </div>
                <Link href="/stages" className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto">
                    ← <span className="hidden sm:inline">{t("back_to_stages")}</span>
                </Link>
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
