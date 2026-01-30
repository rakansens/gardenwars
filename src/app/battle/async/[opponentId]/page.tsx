"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import unitsData from "@/data/units";
import type { StageDefinition, UnitDefinition, WaveConfig } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayerData, saveAsyncBattleResult } from "@/lib/supabase";

// Phaserコンポーネントを動的インポート（SSR無効）
const PhaserGame = dynamic(
    () => import("@/components/game/PhaserGame"),
    { ssr: false }
);

const allUnits = unitsData as UnitDefinition[];

// 相手のデッキからステージデータを生成
function createAsyncStage(opponentDeck: string[], opponentName: string): StageDefinition {
    // 相手のユニットをWave形式に変換
    // AIのように間隔を空けてユニットを出す
    const enemyWaves: WaveConfig[] = [];

    opponentDeck.forEach((unitId, index) => {
        const unit = allUnits.find(u => u.id === unitId);
        if (!unit) return;

        // 各ユニットを複数回出す（AIが繰り返し出撃するイメージ）
        const spawnTimes = [
            2000 + index * 1500,      // 最初の出撃
            15000 + index * 2000,     // 2回目
            30000 + index * 2500,     // 3回目
            50000 + index * 3000,     // 4回目
        ];

        spawnTimes.forEach(time => {
            enemyWaves.push({
                unitId: unitId,
                count: 1,
                timeMs: time,
                intervalMs: 0,
            });
        });
    });

    // 時間順にソート
    enemyWaves.sort((a, b) => a.timeMs - b.timeMs);

    return {
        id: "async_battle",
        name: `VS ${opponentName}`,
        description: "Player vs Player Battle",
        difficulty: "normal",
        length: 800,
        baseCastleHp: 5000,
        enemyCastleHp: 5000,
        enemyWaves,
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
    const { selectedTeam, isLoaded, loadouts, activeLoadoutIndex } = usePlayerData();

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
                const playerData = await getPlayerData(opponentId);
                if (playerData && playerData.selected_team && playerData.selected_team.length > 0) {
                    // プレイヤー名を取得するために別途クエリが必要だが、
                    // シンプルにするためIDの一部を使う
                    setOpponent({
                        name: `Player`,
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

        // 編成データ取得
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

        // バトル開始時間を記録
        setBattleStartTime(Date.now());
    }, [isLoaded, opponent, selectedTeam, loadouts]);

    const handleBattleEnd = async (win: boolean, coinsGained: number) => {
        setBattleEnded(true);
        setResult({ win, coins: coinsGained });

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
            {/* ヘッダー */}
            <div className="absolute top-0 left-0 w-full p-4 z-20 flex items-center justify-between pointer-events-none">
                <Link href="/async-battle" className="btn btn-secondary text-sm py-2 px-3 pointer-events-auto shadow-lg border-2 border-white/20">
                    ← {t("back")}
                </Link>
                <div className="btn bg-red-500 text-white pointer-events-none text-sm py-2 px-3 shadow-lg border-2 border-white/20">
                    🆚 VS {opponent.name}
                </div>
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
