"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import unitsData from "@/data/units.json";
import playerDataInitial from "@/data/player.json";
import type { UnitDefinition } from "@/data/types";

const allUnits = unitsData as UnitDefinition[];
// ガチャ対象はallyユニットのみ
const gachaPool = allUnits.filter((u) => !u.id.startsWith("enemy_"));

const SINGLE_COST = 100;
const MULTI_COST = 900; // 10回で少しお得

export default function GachaPage() {
    const [coins, setCoins] = useState(playerDataInitial.coins);
    const [inventory, setInventory] = useState<{ [key: string]: number }>(
        playerDataInitial.unitInventory || {}
    );
    const [results, setResults] = useState<UnitDefinition[]>([]);
    const [isRolling, setIsRolling] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // ガチャを引く
    const rollGacha = (count: number) => {
        const cost = count === 1 ? SINGLE_COST : MULTI_COST;
        if (coins < cost) return;

        setIsRolling(true);
        setCoins(coins - cost);

        // ランダムにユニットを選ぶ
        const rolled: UnitDefinition[] = [];
        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * gachaPool.length);
            rolled.push(gachaPool[randomIndex]);
        }

        // 演出用の遅延
        setTimeout(() => {
            // インベントリを更新
            const newInventory = { ...inventory };
            for (const unit of rolled) {
                newInventory[unit.id] = (newInventory[unit.id] || 0) + 1;
            }
            setInventory(newInventory);
            setResults(rolled);
            setIsRolling(false);
            setShowResults(true);
        }, 1500);
    };

    const closeResults = () => {
        setShowResults(false);
        setResults([]);
    };

    // レアリティに基づいた色（コスト基準）
    const getRarityColor = (cost: number) => {
        if (cost >= 150) return "from-purple-400 to-pink-400"; // レア
        if (cost >= 100) return "from-yellow-400 to-orange-400"; // アンコモン
        return "from-gray-300 to-gray-400"; // コモン
    };

    const getRarityLabel = (cost: number) => {
        if (cost >= 150) return "⭐⭐⭐";
        if (cost >= 100) return "⭐⭐";
        return "⭐";
    };

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
                        💰 {coins}
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
                            const count = inventory[unit.id] || 0;
                            return (
                                <div
                                    key={unit.id}
                                    className={`relative p-2 rounded-lg border-2 ${count > 0
                                            ? "border-amber-600 bg-amber-50"
                                            : "border-gray-300 bg-gray-100 opacity-50"
                                        }`}
                                >
                                    <div className="w-12 h-12 mx-auto mb-1">
                                        <Image
                                            src={`/assets/sprites/${unit.id}.png`}
                                            alt={unit.name}
                                            width={48}
                                            height={48}
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="text-xs text-center text-amber-950 truncate">
                                        {unit.name}
                                    </div>
                                    {/* 所持個数 */}
                                    <div
                                        className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${count > 0
                                                ? "bg-amber-500 text-white"
                                                : "bg-gray-400 text-white"
                                            }`}
                                    >
                                        {count}
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

            {/* ローディング */}
            {isRolling && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="text-6xl animate-bounce mb-4">🎰</div>
                        <p className="text-2xl text-white font-bold">ガチャ中...</p>
                    </div>
                </div>
            )}

            {/* 結果表示 */}
            {showResults && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
                    onClick={closeResults}
                >
                    <div
                        className="bg-gradient-to-b from-amber-100 to-amber-200 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto border-4 border-amber-600"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-bold text-center mb-4 text-amber-950">
                            🎉 ガチャ結果 🎉
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                            {results.map((unit, index) => (
                                <div
                                    key={`${unit.id}-${index}`}
                                    className={`bg-gradient-to-br ${getRarityColor(
                                        unit.cost
                                    )} rounded-xl p-3 text-center shadow-lg`}
                                >
                                    <div className="text-xs mb-1">{getRarityLabel(unit.cost)}</div>
                                    <div className="w-16 h-16 mx-auto mb-2 bg-white rounded-lg p-1">
                                        <Image
                                            src={`/assets/sprites/${unit.id}.png`}
                                            alt={unit.name}
                                            width={56}
                                            height={56}
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="font-bold text-sm text-white drop-shadow">
                                        {unit.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            className="btn btn-primary w-full"
                            onClick={closeResults}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
