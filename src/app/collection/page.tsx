"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import { hasAnimation } from "@/components/ui/UnitAnimationPreview";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみ（敵ユニット、ボスは除外）
const collectableUnits = allUnits.filter(
    (u) => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_")
);

// レアリティ順序
const rarityOrder: Rarity[] = ["N", "R", "SR", "SSR", "UR"];

export default function CollectionPage() {
    const { unitInventory, selectedTeam, setTeam, isLoaded } = usePlayerData();
    const { t } = useLanguage();
    const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [viewingUnit, setViewingUnit] = useState<UnitDefinition | null>(null);

    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gray-500" },
        { key: "N", label: "N", color: "bg-gray-400" },
        { key: "R", label: "R", color: "bg-blue-500" },
        { key: "SR", label: "SR", color: "bg-purple-500" },
        { key: "SSR", label: "SSR", color: "bg-amber-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

    // コレクション統計
    const stats = useMemo(() => {
        const total = collectableUnits.length;
        const collected = collectableUnits.filter(u => (unitInventory[u.id] || 0) > 0).length;

        // レアリティ別の統計
        const byRarity = rarityOrder.map(rarity => {
            const unitsOfRarity = collectableUnits.filter(u => u.rarity === rarity);
            const collectedOfRarity = unitsOfRarity.filter(u => (unitInventory[u.id] || 0) > 0).length;
            return {
                rarity,
                total: unitsOfRarity.length,
                collected: collectedOfRarity,
            };
        });

        return { total, collected, byRarity };
    }, [unitInventory]);

    const filteredUnits = rarityFilter === "ALL"
        ? collectableUnits
        : collectableUnits.filter(u => u.rarity === rarityFilter);

    // レアリティ順にソート
    const sortedUnits = [...filteredUnits].sort((a, b) => {
        const aIndex = rarityOrder.indexOf(a.rarity);
        const bIndex = rarityOrder.indexOf(b.rarity);
        if (aIndex !== bIndex) return bIndex - aIndex; // URが先
        return a.name.localeCompare(b.name);
    });

    const handleUnitClick = (unit: UnitDefinition) => {
        setViewingUnit(unit);
    };

    const handleToggleUnit = (unitId: string) => {
        if (selectedTeam.includes(unitId)) {
            setTeam(selectedTeam.filter((id) => id !== unitId));
        } else {
            if (selectedTeam.length < 8) {
                setTeam([...selectedTeam, unitId]);
            }
        }
    };

    if (!isLoaded) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl">{t("loading")}</div>
            </main>
        );
    }

    const progressPercent = stats.total > 0 ? Math.round((stats.collected / stats.total) * 100) : 0;

    return (
        <main className="min-h-screen p-4 md:p-8">
            {/* ヘッダー */}
            <div className="page-header mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold">{t("collection_title")}</h1>
                    <div className="flex items-center gap-2">
                        <LanguageSwitch />
                        <Link href="/team" className="btn btn-primary">
                            🎖️ {t("team")}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container">
                {/* コレクション進捗 */}
                <section className="mb-8 bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-amber-800">
                            📖 {t("collection_progress")}
                        </h2>
                        <div className="text-2xl font-bold text-amber-700">
                            {stats.collected} / {stats.total}
                        </div>
                    </div>

                    {/* プログレスバー */}
                    <div className="relative h-6 bg-amber-200 rounded-full overflow-hidden mb-4">
                        <div
                            className="absolute h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-amber-900">
                            {progressPercent}%
                        </div>
                    </div>

                    {/* レアリティ別進捗バー */}
                    <div className="space-y-2">
                        {stats.byRarity.map(({ rarity, total, collected }) => {
                            const percent = total > 0 ? Math.round((collected / total) * 100) : 0;
                            const isComplete = collected === total && total > 0;

                            // レアリティ別カラー
                            const barColors: Record<string, { bg: string; fill: string; text: string }> = {
                                N: { bg: "bg-gray-200", fill: "bg-gray-500", text: "text-gray-700" },
                                R: { bg: "bg-blue-100", fill: "bg-blue-500", text: "text-blue-700" },
                                SR: { bg: "bg-purple-100", fill: "bg-purple-500", text: "text-purple-700" },
                                SSR: { bg: "bg-amber-100", fill: "bg-gradient-to-r from-amber-400 to-yellow-500", text: "text-amber-700" },
                                UR: { bg: "bg-pink-100", fill: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500", text: "text-purple-700" },
                            };
                            const colors = barColors[rarity] || barColors.N;

                            return (
                                <div key={rarity} className="flex items-center gap-2">
                                    {/* レアリティラベル */}
                                    <div className={`w-10 text-sm font-bold text-center ${
                                        rarity === "UR" ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" :
                                        rarity === "SSR" ? "text-amber-600" :
                                        rarity === "SR" ? "text-purple-600" :
                                        rarity === "R" ? "text-blue-600" :
                                        "text-gray-600"
                                    }`}>
                                        {rarity}
                                    </div>

                                    {/* プログレスバー */}
                                    <div className={`flex-1 h-5 ${colors.bg} rounded-full overflow-hidden relative`}>
                                        <div
                                            className={`h-full ${colors.fill} transition-all duration-500 ${isComplete ? "animate-pulse" : ""}`}
                                            style={{ width: `${percent}%` }}
                                        />
                                        {/* コンプリートエフェクト */}
                                        {isComplete && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                        )}
                                    </div>

                                    {/* 数値 */}
                                    <div className={`w-16 text-xs font-bold text-right ${colors.text}`}>
                                        {collected}/{total}
                                        {isComplete && " ✨"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* レアリティフィルタータブ */}
                <section className="mb-6">
                    <div className="flex gap-2 flex-wrap">
                        {rarityTabs.map(tab => {
                            const tabUnits = tab.key === "ALL"
                                ? collectableUnits
                                : collectableUnits.filter(u => u.rarity === tab.key);
                            const collectedCount = tabUnits.filter(u => (unitInventory[u.id] || 0) > 0).length;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setRarityFilter(tab.key)}
                                    className={`
                                        px-4 py-2 rounded-lg font-bold text-sm transition-all
                                        ${rarityFilter === tab.key
                                            ? `${tab.color} text-white shadow-lg scale-105`
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                        }
                                    `}
                                >
                                    {tab.label}
                                    <span className="ml-1 text-xs opacity-75">
                                        ({collectedCount}/{tabUnits.length})
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* ユニットグリッド */}
                <section>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {sortedUnits.map((unit) => {
                            const isOwned = (unitInventory[unit.id] || 0) > 0;
                            const count = unitInventory[unit.id] || 0;
                            const unitHasAnimation = hasAnimation(unit.atlasKey || unit.id);

                            return (
                                <div
                                    key={unit.id}
                                    className={`
                                        relative bg-white rounded-xl p-3 shadow-md
                                        cursor-pointer hover:shadow-lg transition-all
                                        ${!isOwned ? "opacity-50 grayscale" : "hover:scale-105"}
                                    `}
                                    onClick={() => handleUnitClick(unit)}
                                >
                                    {/* 所持数バッジ */}
                                    {isOwned && (
                                        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10">
                                            {count > 99 ? "99+" : count}
                                        </div>
                                    )}

                                    {/* 未所持マーク */}
                                    {!isOwned && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl z-10 opacity-70">
                                            🔒
                                        </div>
                                    )}

                                    {/* アニメーションバッジ */}
                                    {unitHasAnimation && isOwned && (
                                        <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center border-2 border-white shadow z-10" title="Has Animation">
                                            🎬
                                        </div>
                                    )}

                                    <div className="flex justify-center">
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={unit.name}
                                            rarity={unit.rarity}
                                            size="md"
                                            showLabel={true}
                                            baseUnitId={unit.baseUnitId}
                                            grayscale={!isOwned}
                                        />
                                    </div>

                                    <div className="mt-2 text-center">
                                        <div className={`text-sm font-bold leading-tight min-h-[2.5rem] flex items-center justify-center ${!isOwned ? "text-gray-400" : ""}`}>
                                            {unit.name}
                                        </div>
                                        <div className={`text-xs font-bold mt-1 ${
                                            unit.rarity === "UR" ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" :
                                            unit.rarity === "SSR" ? "text-amber-600" :
                                            unit.rarity === "SR" ? "text-purple-600" :
                                            unit.rarity === "R" ? "text-blue-600" :
                                            "text-gray-500"
                                        }`}>
                                            {unit.rarity}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {sortedUnits.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            {t("no_units_in_filter")}
                        </div>
                    )}
                </section>

                {/* ヒント */}
                <section className="mt-8 text-center text-gray-500 text-sm">
                    <p>💡 {t("collection_hint")}</p>
                </section>
            </div>

            {/* 詳細モーダル */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={(unitInventory[viewingUnit.id] || 0) > 0}
                    isInTeam={selectedTeam.includes(viewingUnit.id)}
                    onClose={() => setViewingUnit(null)}
                    onToggleTeam={() => handleToggleUnit(viewingUnit.id)}
                />
            )}
        </main>
    );
}
