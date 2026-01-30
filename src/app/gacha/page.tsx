"use client";

import { useState } from "react";
import Link from "next/link";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame, { getRarityStars, getRarityGradientClass } from "@/components/ui/RarityFrame";
import GachaReveal from "@/components/ui/GachaReveal";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage } from "@/contexts/LanguageContext";

const allUnits = unitsData as UnitDefinition[];
// ガチャ対象はallyユニットのみ
const gachaPool = allUnits.filter((u) => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

const SINGLE_COST = 10;
const MULTI_COST = 90; // 10回で少しお得
const SUPER_MULTI_COST = 900; // 100回 (SSR大盛り⁉️)

export default function GachaPage() {
    const { coins, unitInventory, spendCoins, addUnits, addGachaHistory, gachaHistory, isLoaded } = usePlayerData();
    const { t } = useLanguage();
    const [results, setResults] = useState<UnitDefinition[]>([]);
    const [isRolling, setIsRolling] = useState(false);
    const [showReveal, setShowReveal] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [viewingUnit, setViewingUnit] = useState<UnitDefinition | null>(null);
    const [ownedRarityFilter, setOwnedRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [unownedRarityFilter, setUnownedRarityFilter] = useState<Rarity | "ALL">("ALL");

    // レアリティフィルタータブの定義
    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gray-500" },
        { key: "N", label: "N", color: "bg-gray-400" },
        { key: "R", label: "R", color: "bg-blue-500" },
        { key: "SR", label: "SR", color: "bg-purple-500" },
        { key: "SSR", label: "SSR", color: "bg-amber-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

    // ガチャを引く
    const rollGacha = (count: number) => {
        let cost = SINGLE_COST;
        if (count === 10) cost = MULTI_COST;
        if (count === 100) cost = SUPER_MULTI_COST;

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
            const unitIds = rolled.map(u => u.id);
            // ユニットをまとめて追加
            addUnits(unitIds);
            // 履歴に追加
            addGachaHistory(unitIds);
            setResults(rolled);
            setIsRolling(false);
            setShowReveal(true);
        }, 100);
    };

    // レアリティで重み付けしてランダム選択（URは個別重み）
    const pickRandomUnit = (): UnitDefinition => {
        // 基本レアリティ確率: N=50%, R=30%, SR=15%, SSR=3%, UR=1%(ベース)
        const rarityWeights = { N: 50, R: 30, SR: 15, SSR: 3, UR: 1 };

        // URユニットの合計重みを計算
        const urUnits = gachaPool.filter(u => u.rarity === "UR");
        const totalUrWeight = urUnits.reduce((sum, u) => sum + (u.gachaWeight ?? 1), 0);

        // 各ユニットの実効重みを計算
        const getUnitWeight = (unit: UnitDefinition): number => {
            if (unit.rarity === "UR") {
                // URの個別重み: (個別weight / 合計URweight) * URベース確率
                return ((unit.gachaWeight ?? 1) / totalUrWeight) * rarityWeights.UR;
            }
            // 他のレアリティは均等配分
            const unitsInRarity = gachaPool.filter(u => u.rarity === unit.rarity).length;
            return rarityWeights[unit.rarity] / unitsInRarity;
        };

        const totalWeight = gachaPool.reduce((sum, u) => sum + getUnitWeight(u), 0);
        let random = Math.random() * totalWeight;

        for (const unit of gachaPool) {
            random -= getUnitWeight(unit);
            if (random <= 0) return unit;
        }
        return gachaPool[0];
    };

    // ユニットの排出率を計算（%表示用）
    const getDropRate = (unit: UnitDefinition): number => {
        const rarityWeights = { N: 50, R: 30, SR: 15, SSR: 3, UR: 1 };

        if (unit.rarity === "UR") {
            const urUnits = gachaPool.filter(u => u.rarity === "UR");
            const totalUrWeight = urUnits.reduce((sum, u) => sum + (u.gachaWeight ?? 1), 0);
            return ((unit.gachaWeight ?? 1) / totalUrWeight) * rarityWeights.UR;
        }

        const unitsInRarity = gachaPool.filter(u => u.rarity === unit.rarity).length;
        return rarityWeights[unit.rarity] / unitsInRarity;
    };

    // カード演出完了時
    const handleRevealComplete = () => {
        setShowReveal(false);
        setResults([]);
    };

    // 日時フォーマット
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    // 履歴内のユニットをカウント
    const countRarityInHistory = (unitIds: string[]) => {
        const counts = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
        for (const id of unitIds) {
            const unit = allUnits.find(u => u.id === id);
            if (unit) counts[unit.rarity]++;
        }
        return counts;
    };

    if (!isLoaded) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl">{t("loading")}</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-4 md:p-8">
            {/* ヘッダー */}
            <div className="page-header mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold">{t("gacha_title")}</h1>
                    <div className="btn btn-primary pointer-events-none">
                        💰 {coins.toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="container max-w-2xl mx-auto">
                {/* ガチャマシン */}
                <div className="card text-center mb-8">
                    <h2 className="text-2xl font-bold mb-4 text-amber-950">
                        {t("gacha_machine_title")}
                    </h2>
                    <p className="text-amber-900/70 mb-6 whitespace-pre-line">
                        {t("gacha_machine_desc")}
                    </p>

                    {/* 排出率 */}
                    <div className="flex justify-center gap-2 mb-6 text-xs flex-wrap">
                        <span className="px-2 py-1 rounded bg-gray-200 text-gray-700">N: 50%</span>
                        <span className="px-2 py-1 rounded bg-blue-200 text-blue-700">R: 30%</span>
                        <span className="px-2 py-1 rounded bg-purple-200 text-purple-700">SR: 15%</span>
                        <span className="px-2 py-1 rounded bg-amber-200 text-amber-700">SSR: 3%</span>
                        <span className="px-2 py-1 rounded bg-gradient-to-r from-pink-200 to-cyan-200 text-purple-700 font-bold">UR: 1%</span>
                    </div>

                    {/* ガチャボタン */}
                    <div className="flex justify-center gap-6 flex-wrap">
                        {/* 1回ガチャ */}
                        <button
                            className={`flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-slate-700 to-slate-800 border-4 border-slate-500 shadow-xl transition-all hover:scale-105 hover:border-green-400 ${coins < SINGLE_COST || isRolling
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                            onClick={() => rollGacha(1)}
                            disabled={coins < SINGLE_COST || isRolling}
                        >
                            <img
                                src="/assets/ui/gacha_1pull.png"
                                alt={t("gacha_1pull")}
                                className="w-24 h-24 object-contain mb-2"
                            />
                            <div className="text-white font-bold text-lg">{t("gacha_1pull")}</div>
                            <div className="text-green-300 font-bold">💰 {SINGLE_COST}</div>
                        </button>

                        {/* 10連ガチャ */}
                        <button
                            className={`flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-purple-700 to-purple-900 border-4 border-purple-400 shadow-xl transition-all hover:scale-105 hover:border-pink-400 ${coins < MULTI_COST || isRolling
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                            onClick={() => rollGacha(10)}
                            disabled={coins < MULTI_COST || isRolling}
                        >
                            <img
                                src="/assets/ui/gacha_10pull.png"
                                alt={t("gacha_10pull")}
                                className="w-28 h-28 object-contain mb-2"
                            />
                            <div className="text-white font-bold text-lg">{t("gacha_10pull")}</div>
                            <div className="text-yellow-300 font-bold">💰 {MULTI_COST}</div>
                        </button>

                        {/* 100連ガチャ */}
                        <button
                            className={`flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-amber-600 via-orange-700 to-red-800 border-4 border-yellow-400 shadow-2xl transition-all hover:scale-105 ${coins < SUPER_MULTI_COST || isRolling
                                    ? "opacity-50 cursor-not-allowed"
                                    : "animate-pulse hover:animate-none"
                                }`}
                            onClick={() => rollGacha(100)}
                            disabled={coins < SUPER_MULTI_COST || isRolling}
                        >
                            <img
                                src="/assets/ui/gacha_100pull.png"
                                alt={t("gacha_100pull")}
                                className="w-32 h-32 object-contain mb-2"
                            />
                            <div className="text-white font-bold text-xl">{t("gacha_100pull")}</div>
                            <div className="text-yellow-200 font-bold text-lg">💰 {SUPER_MULTI_COST}</div>
                        </button>
                    </div>
                </div>

                {/* UR ユニットショーケース */}
                <div className="card mb-8 bg-gradient-to-br from-purple-900 via-pink-900 to-indigo-900 border-2 border-pink-400/50">
                    <h3 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-cyan-300 text-center">
                        ✨ {t("ur_showcase")} ✨
                    </h3>
                    <p className="text-pink-200/70 text-center text-sm mb-4">
                        {t("ur_showcase_desc")}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {gachaPool
                            .filter(u => u.rarity === "UR")
                            .sort((a, b) => (a.gachaWeight ?? 1) - (b.gachaWeight ?? 1))
                            .map((unit) => {
                                const rate = getDropRate(unit);
                                const isOwned = (unitInventory[unit.id] || 0) > 0;
                                return (
                                    <div
                                        key={unit.id}
                                        className={`
                                            relative p-2 rounded-xl cursor-pointer transition-all
                                            bg-gradient-to-br from-purple-800/50 to-pink-800/50
                                            border border-pink-500/30 hover:border-pink-400
                                            hover:scale-105 hover:shadow-lg hover:shadow-pink-500/20
                                            ${isOwned ? "" : "opacity-70"}
                                        `}
                                        onClick={() => setViewingUnit(unit)}
                                    >
                                        {/* 排出率バッジ */}
                                        <div className={`
                                            absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold z-10
                                            ${rate < 0.05 ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white animate-pulse" :
                                              rate < 0.08 ? "bg-pink-500 text-white" :
                                              "bg-purple-500 text-white"}
                                        `}>
                                            {rate.toFixed(2)}%
                                        </div>

                                        {/* 所持バッジ */}
                                        {isOwned && (
                                            <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center z-10">
                                                ✓
                                            </div>
                                        )}

                                        <div className="flex justify-center">
                                            <RarityFrame
                                                unitId={unit.id}
                                                unitName={unit.name}
                                                rarity={unit.rarity}
                                                size="sm"
                                                showLabel={false}
                                                baseUnitId={unit.baseUnitId}
                                                grayscale={!isOwned}
                                            />
                                        </div>
                                        <div className="text-[10px] text-center text-pink-100 truncate mt-1 font-medium">
                                            {unit.name}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* ガチャ履歴 */}
                <div className="card mb-8">
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <h3 className="text-xl font-bold text-amber-950">
                            {t("gacha_history")} ({gachaHistory.length})
                        </h3>
                        <span className="text-2xl">{showHistory ? '▲' : '▼'}</span>
                    </div>

                    {showHistory && (
                        <div className="mt-4 space-y-4 max-h-[500px] overflow-y-auto">
                            {gachaHistory.length === 0 ? (
                                <p className="text-amber-900/50 text-center py-4">{t("gacha_history_empty")}</p>
                            ) : (
                                gachaHistory.map((entry, index) => {
                                    const counts = countRarityInHistory(entry.unitIds);
                                    // ユニット情報を取得
                                    const units = entry.unitIds
                                        .map(id => allUnits.find(u => u.id === id))
                                        .filter((u): u is UnitDefinition => u !== undefined);

                                    return (
                                        <div
                                            key={`${entry.timestamp}-${index}`}
                                            className="p-3 bg-amber-50 rounded-lg border border-amber-200"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm text-amber-700 font-medium">
                                                    {formatDate(entry.timestamp)}
                                                </span>
                                                <span className="text-sm font-bold text-amber-900">
                                                    {entry.count === 1 ? t("gacha_count_1") : entry.count === 10 ? t("gacha_count_10") : t("gacha_count_100")}
                                                </span>
                                            </div>

                                            {/* キャラアイコン */}
                                            <div className="flex gap-1 flex-wrap mb-3">
                                                {units.map((unit, unitIndex) => (
                                                    <div
                                                        key={unitIndex}
                                                        className="w-10 h-10 cursor-pointer hover:scale-110 transition-transform"
                                                        onClick={() => setViewingUnit(unit)}
                                                    >
                                                        <RarityFrame
                                                            unitId={unit.id}
                                                            unitName={unit.name}
                                                            rarity={unit.rarity}
                                                            size="xs"
                                                            showLabel={false}
                                                            baseUnitId={unit.baseUnitId}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            {/* レアリティサマリー */}
                                            <div className="flex gap-2 flex-wrap text-xs">
                                                {counts.UR > 0 && (
                                                    <span className="px-2 py-1 rounded bg-gradient-to-r from-pink-400 to-cyan-400 text-white font-bold">
                                                        UR: {counts.UR}
                                                    </span>
                                                )}
                                                {counts.SSR > 0 && (
                                                    <span className="px-2 py-1 rounded bg-amber-400 text-white font-bold">
                                                        SSR: {counts.SSR}
                                                    </span>
                                                )}
                                                {counts.SR > 0 && (
                                                    <span className="px-2 py-1 rounded bg-purple-400 text-white">
                                                        SR: {counts.SR}
                                                    </span>
                                                )}
                                                {counts.R > 0 && (
                                                    <span className="px-2 py-1 rounded bg-blue-300 text-blue-800">
                                                        R: {counts.R}
                                                    </span>
                                                )}
                                                {counts.N > 0 && (
                                                    <span className="px-2 py-1 rounded bg-gray-300 text-gray-700">
                                                        N: {counts.N}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* 所持ユニット一覧 */}
                <div className="card mb-6">
                    <h3 className="text-xl font-bold mb-4 text-amber-950">
                        {t("gacha_owned_units")} ({gachaPool.filter(u => (unitInventory[u.id] || 0) > 0).length}/{gachaPool.length})
                    </h3>

                    {/* レアリティフィルター */}
                    <div className="flex gap-2 flex-wrap mb-4">
                        {rarityTabs.map(tab => {
                            const ownedInRarity = gachaPool.filter(u =>
                                (unitInventory[u.id] || 0) > 0 &&
                                (tab.key === "ALL" || u.rarity === tab.key)
                            ).length;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setOwnedRarityFilter(tab.key)}
                                    className={`
                                        px-3 py-1 rounded-lg font-bold text-sm transition-all
                                        ${ownedRarityFilter === tab.key
                                            ? `${tab.color} text-white shadow-md scale-105`
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                        }
                                    `}
                                >
                                    {tab.label}
                                    <span className="ml-1 text-xs opacity-75">({ownedInRarity})</span>
                                </button>
                            );
                        })}
                    </div>

                    {(() => {
                        const filteredOwned = gachaPool.filter(u =>
                            (unitInventory[u.id] || 0) > 0 &&
                            (ownedRarityFilter === "ALL" || u.rarity === ownedRarityFilter)
                        );

                        if (filteredOwned.length === 0) {
                            return (
                                <p className="text-amber-900/50 text-center py-4">{t("no_owned_in_rarity")}</p>
                            );
                        }

                        return (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {filteredOwned.map((unit) => {
                                    const count = unitInventory[unit.id] || 0;
                                    return (
                                        <div
                                            key={unit.id}
                                            className="relative p-2 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
                                            onClick={() => setViewingUnit(unit)}
                                        >
                                            <div className="flex justify-center">
                                                <RarityFrame
                                                    unitId={unit.id}
                                                    unitName={unit.name}
                                                    rarity={unit.rarity}
                                                    size="md"
                                                    showLabel={true}
                                                    count={count}
                                                    baseUnitId={unit.baseUnitId}
                                                />
                                            </div>
                                            <div className="text-xs text-center text-amber-950 truncate mt-1">
                                                {unit.name}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>

                {/* 未所持ユニット一覧 */}
                <div className="card">
                    <h3 className="text-xl font-bold mb-4 text-gray-600">
                        {t("unowned_units")} ({gachaPool.filter(u => (unitInventory[u.id] || 0) === 0).length})
                    </h3>

                    {/* レアリティフィルター */}
                    <div className="flex gap-2 flex-wrap mb-4">
                        {rarityTabs.map(tab => {
                            const unownedInRarity = gachaPool.filter(u =>
                                (unitInventory[u.id] || 0) === 0 &&
                                (tab.key === "ALL" || u.rarity === tab.key)
                            ).length;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setUnownedRarityFilter(tab.key)}
                                    className={`
                                        px-3 py-1 rounded-lg font-bold text-sm transition-all
                                        ${unownedRarityFilter === tab.key
                                            ? `${tab.color} text-white shadow-md scale-105`
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                        }
                                    `}
                                >
                                    {tab.label}
                                    <span className="ml-1 text-xs opacity-75">({unownedInRarity})</span>
                                </button>
                            );
                        })}
                    </div>

                    {(() => {
                        const filteredUnowned = gachaPool.filter(u =>
                            (unitInventory[u.id] || 0) === 0 &&
                            (unownedRarityFilter === "ALL" || u.rarity === unownedRarityFilter)
                        );

                        if (filteredUnowned.length === 0) {
                            return (
                                <p className="text-green-600 text-center py-4 font-bold">
                                    🎉 {unownedRarityFilter === "ALL" ? t("all_owned_in_rarity") : t("all_owned_in_rarity")}
                                </p>
                            );
                        }

                        return (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 opacity-60">
                                {filteredUnowned.map((unit) => (
                                    <div
                                        key={unit.id}
                                        className="relative p-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => setViewingUnit(unit)}
                                    >
                                        <div className="flex justify-center">
                                            <RarityFrame
                                                unitId={unit.id}
                                                unitName={unit.name}
                                                rarity={unit.rarity}
                                                size="md"
                                                showLabel={true}
                                                grayscale={true}
                                                baseUnitId={unit.baseUnitId}
                                            />
                                        </div>
                                        <div className="text-xs text-center text-gray-500 truncate mt-1">
                                            {unit.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* 編成へ */}
                <div className="mt-8 text-center">
                    <Link href="/team" className="btn btn-primary">
                        {t("gacha_to_team")}
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

            {/* ユニット詳細モーダル */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={(unitInventory[viewingUnit.id] || 0) > 0}
                    isInTeam={false}
                    onClose={() => setViewingUnit(null)}
                    onToggleTeam={() => {}}
                    dropRate={getDropRate(viewingUnit)}
                />
            )}
        </main>
    );
}

