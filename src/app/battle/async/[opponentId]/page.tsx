"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import unitsData from "@/data/units";
import type { StageDefinition, UnitDefinition } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayerData, getPlayerName, saveAsyncBattleResult } from "@/lib/supabase";

// Phaserコンポーネントを動的インポート（SSR無効）
const PhaserGame = dynamic(
    () => import("@/components/game/PhaserGame"),
    { ssr: false }
);

const allUnits = unitsData as UnitDefinition[];
// プレイヤーが使用可能なユニット（ボス除外）
const playableUnits = allUnits.filter(u => !u.id.startsWith("boss_") && !u.isBoss);

// 相手のデッキからステージデータを生成（AI対戦モード）
function createAsyncStage(opponentDeck: string[], opponentName: string): StageDefinition {
    return {
        id: "async_battle",
        name: `VS ${opponentName}`,
        description: "Player vs Player Battle",
        difficulty: "normal",
        length: 1200,
        baseCastleHp: 5000,
        enemyCastleHp: 5000,
        enemyWaves: [],  // AI対戦モードではWaveは使わない
        // AI対戦モード: 相手のデッキをAIが操作
        aiDeck: opponentDeck,
        aiStrategy: 'balanced',
        reward: {
            coins: 100,
        },
        background: {
            skyColor: "#87CEEB",
            groundColor: "#228B22",
            image: "/assets/stages/stage_1.webp",
        },
    };
}

interface OpponentData {
    name: string;
    deck: string[];
}

export default function AsyncBattlePage() {
    const router = useRouter();
    const params = useParams();
    const opponentId = params.opponentId as string;
    const { t } = useLanguage();
    const { playerId } = useAuth();
    const { selectedTeam, isLoaded, loadouts, activeLoadoutIndex, addCoins } = usePlayerData();

    const [opponent, setOpponent] = useState<OpponentData | null>(null);
    const [stage, setStage] = useState<StageDefinition | null>(null);
    const [team, setTeam] = useState<UnitDefinition[]>([]);
    const [loadoutDefs, setLoadoutDefs] = useState<[UnitDefinition[], UnitDefinition[], UnitDefinition[]]>([[], [], []]);
    const [battleEnded, setBattleEnded] = useState(false);
    const [result, setResult] = useState<{ win: boolean; coins: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [battleStartTime, setBattleStartTime] = useState<number>(0);

    // 相手のデータを取得
    useEffect(() => {
        const fetchOpponent = async () => {
            if (!opponentId) return;

            try {
                // プレイヤーデータとプレイヤー名を並行取得
                const [playerData, playerName] = await Promise.all([
                    getPlayerData(opponentId),
                    getPlayerName(opponentId),
                ]);

                if (playerData && playerData.selected_team && playerData.selected_team.length > 0) {
                    setOpponent({
                        name: playerName || "Unknown",
                        deck: playerData.selected_team,
                    });
                } else {
                    // デッキがない場合は戻る
                    router.push("/async-battle");
                }
            } catch (err) {
                console.error("Failed to fetch opponent:", err);
                router.push("/async-battle");
            }
            setIsLoading(false);
        };

        fetchOpponent();
    }, [opponentId, router]);

    // ステージとチームを設定
    useEffect(() => {
        if (!isLoaded || !opponent) return;

        // ステージデータを生成
        const asyncStage = createAsyncStage(opponent.deck, opponent.name);
        setStage(asyncStage);

        // 編成データ取得（ボス除外）
        const teamDefs = selectedTeam
            .map((id) => playableUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
        setTeam(teamDefs);

        // 全ロードアウトを変換（ボス除外）
        const convertedLoadouts: [UnitDefinition[], UnitDefinition[], UnitDefinition[]] = [
            (loadouts[0] || []).map(id => playableUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
            (loadouts[1] || []).map(id => playableUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
            (loadouts[2] || []).map(id => playableUnits.find(u => u.id === id)).filter((u): u is UnitDefinition => u !== undefined),
        ];
        setLoadoutDefs(convertedLoadouts);

        // バトル開始時間を記録
        setBattleStartTime(Date.now());
    }, [isLoaded, opponent, selectedTeam, loadouts]);

    const handleBattleEnd = async (win: boolean, coinsGained: number) => {
        setBattleEnded(true);
        setResult({ win, coins: coinsGained });

        // 勝利時のコイン報酬を実際に付与
        if (win && coinsGained > 0) {
            addCoins(coinsGained);
        }

        const battleDuration = Math.floor((Date.now() - battleStartTime) / 1000);

        // 非同期バトル結果を保存
        if (playerId && opponent) {
            try {
                await saveAsyncBattleResult({
                    attacker_id: playerId,
                    defender_id: opponentId,
                    attacker_deck: selectedTeam,
                    defender_deck: opponent.deck,
                    winner: win ? 'attacker' : 'defender',
                    attacker_castle_hp: win ? 1 : 0, // 簡易的
                    defender_castle_hp: win ? 0 : 1,
                    attacker_kills: 0, // TODO: 実際のキル数を取得
                    defender_kills: 0,
                    battle_duration: battleDuration,
                });
            } catch (err) {
                console.error("Failed to save async battle result:", err);
            }
        }

        // 3秒後に結果ページへ
        setTimeout(() => {
            router.push(`/async-battle/result?win=${win}&opponent=${opponentId}`);
        }, 3000);
    };

    if (isLoading || !stage || !opponent) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-xl text-white">{t("loading")}</div>
            </main>
        );
    }

    return (
        <main className="fixed inset-0 bg-[#1a1a2e] overflow-hidden">
            {/* ヘッダー - スマホ対応: 右上に配置 */}
            <div className="absolute top-0 right-0 p-2 sm:p-4 z-20 flex items-center gap-2 pointer-events-none">
                <div className="btn bg-red-500 text-white pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 shadow-lg border-2 border-white/20">
                    🆚 <span className="hidden sm:inline">VS {opponent.name}</span><span className="sm:hidden">{opponent.name.slice(0, 6)}</span>
                </div>
                <Link href="/async-battle" className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto">
                    ← <span className="hidden sm:inline">{t("back")}</span>
                </Link>
            </div>

            {/* ゲーム画面 */}
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

            {/* バトル終了オーバーレイ */}
            {battleEnded && result && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-in fade-in duration-500">
                    <div className="text-center p-8 bg-white/10 backdrop-blur-md rounded-3xl border-4 border-white/20 shadow-2xl">
                        <h2 className={`text-6xl font-bold mb-4 drop-shadow-lg ${result.win ? "text-amber-400" : "text-red-500"}`}>
                            {result.win ? `🎉 ${t("async_victory")}` : `💀 ${t("async_defeat")}`}
                        </h2>
                        <p className="text-2xl text-white/80">
                            VS {opponent.name}
                        </p>
                        <p className="mt-6 text-white/70 animate-pulse">{t("loading")}</p>
                    </div>
                </div>
            )}
        </main>
    );
}
