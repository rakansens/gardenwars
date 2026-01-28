"use client";

import { useState } from "react";
import Link from "next/link";
import unitsData from "@/data/units.json";
import type { UnitDefinition } from "@/data/types";
import RarityFrame, { getRarityStars, getRarityGradientClass } from "@/components/ui/RarityFrame";
import GachaReveal from "@/components/ui/GachaReveal";
import { usePlayerData } from "@/hooks/usePlayerData";

const allUnits = unitsData as UnitDefinition[];
// ガチャ対象はallyユニットのみ
const gachaPool = allUnits.filter((u) => !u.id.startsWith("enemy_"));

const SINGLE_COST = 100;
const MULTI_COST = 900; // 10回で少しお得

export default function GachaPage() {
    const { coins, unitInventory, spendCoins, addUnits, isLoaded } = usePlayerData();
    const [results, setResults] = useState<UnitDefinition[]>([]);
    const [isRolling, setIsRolling] = useState(false);
    const [showReveal, setShowReveal] = useState(false);

    // ガチャを引く
    const rollGacha = (count: number) => {
        const cost = count === 1 ? SINGLE_COST : MULTI_COST;
        if (coins < cost) return;

        setIsRolling(true);

        // コインを消費
        spendCoins(cost);

        // ランダムにユニットを選ぶ（レアリティで重み付け）
        const rolled: UnitDefinition[] = [];
        for (let i = 0; i < count; i++) {
            const unit = pickRandomUnit();
            rolled.push(unit);
        }

        // カード演出開始
        setTimeout(() => {
            // ユニットをまとめて追加
            addUnits(rolled.map(u => u.id));
            setResults(rolled);
            setIsRolling(false);
            setShowReveal(true);
        }, 100);
    };

    // レアリティで重み付けしてランダム選択
    const pickRandomUnit = (): UnitDefinition => {
        const weights = { N: 50, R: 30, SR: 15, SSR: 5 };
        const totalWeight = gachaPool.reduce((sum, u) => sum + weights[u.rarity], 0);
        let random = Math.random() * totalWeight;

        for (const unit of gachaPool) {
            random -= weights[unit.rarity];
            if (random <= 0) return unit;
        }
        return gachaPool[0];
    };

    // カード演出完了時
    const handleRevealComplete = () => {
        setShowReveal(false);
        setResults([]);
    };

    if (!isLoaded) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl">読み込み中...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-8">
            {/* ヘッダー */}
            <div className="page-header mb-8">
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-amber-700 hover:text-amber-600">
                        ← ホームへ
                    </Link>
                    <h1 className="text-3xl font-bold">🎰 ガチャ</h1>
                    <div className="text-amber-700 font-bold">
                        💰 {coins.toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="container max-w-2xl mx-auto">
                {/* ガチャマシン */}
                <div className="card text-center mb-8">
                    <h2 className="text-2xl font-bold mb-4 text-amber-950">
                        🌟 ユニットガチャ 🌟
                    </h2>
                    <p className="text-amber-900/70 mb-6">
                        コインを使って新しいユニットをゲット！
                        <br />
                        同じユニットは複数所持でき、今後フュージョンに使用できます。
                    </p>

                    {/* 排出率 */}
                    <div className="flex justify-center gap-2 mb-6 text-xs">
                        <span className="px-2 py-1 rounded bg-gray-200 text-gray-700">N: 50%</span>
                        <span className="px-2 py-1 rounded bg-blue-200 text-blue-700">R: 30%</span>
                        <span className="px-2 py-1 rounded bg-purple-200 text-purple-700">SR: 15%</span>
                        <span className="px-2 py-1 rounded bg-amber-200 text-amber-700">SSR: 5%</span>
                    </div>

                    {/* ガチャボタン */}
                    <div className="flex justify-center gap-4 flex-wrap">
                        <button
                            className={`btn btn-primary text-lg px-6 py-4 ${coins < SINGLE_COST || isRolling
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                                }`}
                            onClick={() => rollGacha(1)}
                            disabled={coins < SINGLE_COST || isRolling}
                        >
                            <div>1回ガチャ</div>
                            <div className="text-sm">💰 {SINGLE_COST}</div>
                        </button>

                        <button
                            className={`btn btn-secondary text-lg px-6 py-4 ${coins < MULTI_COST || isRolling
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                                }`}
                            onClick={() => rollGacha(10)}
                            disabled={coins < MULTI_COST || isRolling}
                        >
                            <div>10連ガチャ</div>
                            <div className="text-sm">💰 {MULTI_COST}</div>
                        </button>
                    </div>
                </div>

                {/* 所持ユニット一覧 */}
                <div className="card">
                    <h3 className="text-xl font-bold mb-4 text-amber-950">
                        📦 所持ユニット
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {gachaPool.map((unit) => {
                            const count = unitInventory[unit.id] || 0;
                            return (
                                <div
                                    key={unit.id}
                                    className={`relative p-2 rounded-lg ${count > 0 ? "" : "opacity-40"
                                        }`}
                                >
                                    <div className="flex justify-center">
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={unit.name}
                                            rarity={unit.rarity}
                                            size="md"
                                            showLabel={true}
                                            count={count}
                                        />
                                    </div>
                                    <div className="text-xs text-center text-amber-950 truncate mt-1">
                                        {unit.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 編成へ */}
                <div className="mt-8 text-center">
                    <Link href="/team" className="btn btn-primary">
                        📋 編成へ
                    </Link>
                </div>
            </div>

            {/* カード演出 */}
            {showReveal && (
                <GachaReveal
                    results={results}
                    onComplete={handleRevealComplete}
                />
            )}
        </main>
    );
}
