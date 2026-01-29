"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import stages from "@/data/stages.json";
import allUnits from "@/data/units.json";
import type { StageDefinition, UnitDefinition } from "@/data/types";
import { usePlayerData } from "@/hooks/usePlayerData";

const typedStages = stages as StageDefinition[];
const typedUnits = allUnits as UnitDefinition[];

interface DroppedUnit {
    unit: UnitDefinition;
    rate: number;
}

function ResultContent() {
    const searchParams = useSearchParams();
    const { addUnit, isLoaded } = usePlayerData();

    const win = searchParams.get("win") === "true";
    const coins = Number(searchParams.get("coins") || 0);
    const stageId = searchParams.get("stage") || "stage_1";

    const [droppedUnits, setDroppedUnits] = useState<DroppedUnit[]>([]);
    const [processed, setProcessed] = useState(false);

    // ドロップ処理 & ステージクリア保存
    useEffect(() => {
        if (!win || processed || !isLoaded) return;

        // ステージクリア保存
        try {
            const clearedStages = JSON.parse(localStorage.getItem("clearedStages") || "[]");
            if (!clearedStages.includes(stageId)) {
                clearedStages.push(stageId);
                localStorage.setItem("clearedStages", JSON.stringify(clearedStages));
            }
        } catch (e) {
            console.error("Failed to save cleared stages", e);
        }

        // コイン加算はbattleページで実施済み

        // ドロップ処理
        const stage = typedStages.find(s => s.id === stageId);
        if (!stage?.reward.drops) {
            setProcessed(true);
            return;
        }

        const drops: DroppedUnit[] = [];
        stage.reward.drops.forEach(drop => {
            const roll = Math.random() * 100;
            if (roll < drop.rate) {
                const unit = typedUnits.find(u => u.id === drop.unitId);
                if (unit) {
                    drops.push({ unit, rate: drop.rate });
                    // usePlayerData経由でユニット追加
                    addUnit(unit.id, 1);
                }
            }
        });

        setDroppedUnits(drops);
        setProcessed(true);
    }, [win, stageId, processed, isLoaded, addUnit]);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8">
            {/* 結果アイコン */}
            <div className="text-8xl mb-8 animate-bounce">
                {win ? "🏆" : "😿"}
            </div>

            {/* 結果テキスト */}
            <h1
                className={`text-5xl font-bold mb-4 ${win ? "text-yellow-400" : "text-red-500"
                    }`}
            >
                {win ? "勝利！" : "敗北..."}
            </h1>

            {/* 報酬 */}
            {win && (
                <div className="card mb-6">
                    <h2 className="text-2xl mb-4">🎁 獲得報酬</h2>
                    <div className="flex items-center justify-center gap-2 text-3xl mb-4">
                        <span className="text-yellow-400">💰</span>
                        <span className="font-bold text-yellow-300">+{coins}</span>
                        <span className="text-gray-400">コイン</span>
                    </div>

                    {/* ドロップユニット */}
                    {droppedUnits.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-amber-300/30">
                            <h3 className="text-lg text-green-400 mb-3">✨ ユニットドロップ！</h3>
                            <div className="flex flex-wrap gap-3 justify-center">
                                {droppedUnits.map((drop, i) => (
                                    <div
                                        key={`${drop.unit.id}-${i}`}
                                        className="flex flex-col items-center bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-3 border-2 border-green-400/50 animate-pulse"
                                    >
                                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-green-100 mb-2 flex items-center justify-center">
                                            <Image
                                                src={`/assets/sprites/${drop.unit.id}.png`}
                                                alt={drop.unit.name}
                                                width={48}
                                                height={48}
                                                className="object-contain"
                                            />
                                        </div>
                                        <span className="text-white font-bold text-sm">{drop.unit.name}</span>
                                        <span className="text-green-300 text-xs">({drop.rate}%)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ドロップなし */}
                    {droppedUnits.length === 0 && processed && (
                        <div className="mt-4 pt-4 border-t border-amber-300/30 text-gray-400 text-sm">
                            ユニットドロップなし...次は運がいいかも！
                        </div>
                    )}
                </div>
            )}

            {/* アクションボタン */}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <Link
                    href={`/battle/${stageId}`}
                    className="btn btn-secondary text-center flex-1 text-lg py-4"
                >
                    🔄 リトライ
                </Link>
                <Link
                    href="/stages"
                    className="btn btn-primary text-center flex-1 text-lg py-4"
                >
                    📋 ステージ選択
                </Link>
            </div>

            {/* ホームへ */}
            <Link
                href="/"
                className="mt-8 btn btn-secondary"
            >
                🏠 ホームへ戻る
            </Link>

            {/* 励ましメッセージ */}
            {!win && (
                <p className="mt-8 text-gray-500 text-center">
                    編成を見直して再チャレンジ！<br />
                    強いユニットを揃えよう 💪
                </p>
            )}
        </main>
    );
}

export default function ResultPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin text-4xl">⏳</div>
                </main>
            }
        >
            <ResultContent />
        </Suspense>
    );
}
