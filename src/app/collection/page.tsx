"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import { hasAnimation } from "@/components/ui/UnitAnimationPreview";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useUnitDetailModal } from "@/hooks/useUnitDetailModal";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみ（敵ユニット、ボスは除外）
const collectableUnits = allUnits.filter(
    (u) => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_")
);

// サイズカテゴリを取得
function getSizeCategory(scale: number): string {
    if (scale <= 0.85) return "size_tiny";
    if (scale <= 1.1) return "size_small";
    if (scale <= 1.4) return "size_medium";
    if (scale <= 1.8) return "size_large";
    if (scale <= 2.5) return "size_huge";
    return "size_giant";
}

// レアリティ順序
const rarityOrder: Rarity[] = ["N", "R", "SR", "SSR", "UR"];

// レアリティカラー設定
const rarityConfig: Record<Rarity, { bg: string; border: string; text: string; gradient: string }> = {
    N: { bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-600", gradient: "from-gray-400 to-gray-500" },
    R: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-600", gradient: "from-blue-400 to-blue-600" },
    SR: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-600", gradient: "from-purple-400 to-purple-600" },
    SSR: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-600", gradient: "from-amber-400 to-yellow-500" },
    UR: { bg: "bg-gradient-to-br from-pink-50 via-purple-50 to-cyan-50", border: "border-pink-300", text: "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500", gradient: "from-pink-500 via-purple-500 to-cyan-500" },
};

export default function CollectionPage() {
    const { unitInventory, selectedTeam, setTeam, isLoaded } = usePlayerData();
    const { t } = useLanguage();
    const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
    const { viewingUnit, openModal, closeModal } = useUnitDetailModal();
    const [showOwnedOnly, setShowOwnedOnly] = useState(false);

    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string; icon: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gradient-to-r from-gray-500 to-gray-600", icon: "📋" },
        { key: "N", label: "N", color: "bg-gradient-to-r from-gray-400 to-gray-500", icon: "⚪" },
        { key: "R", label: "R", color: "bg-gradient-to-r from-blue-400 to-blue-600", icon: "🔵" },
        { key: "SR", label: "SR", color: "bg-gradient-to-r from-purple-400 to-purple-600", icon: "🟣" },
        { key: "SSR", label: "SSR", color: "bg-gradient-to-r from-amber-400 to-yellow-500", icon: "🟡" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500", icon: "💎" },
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

    const filteredUnits = useMemo(() => {
        let units = rarityFilter === "ALL"
            ? collectableUnits
            : collectableUnits.filter(u => u.rarity === rarityFilter);

        if (showOwnedOnly) {
            units = units.filter(u => (unitInventory[u.id] || 0) > 0);
        }

        return units;
    }, [rarityFilter, showOwnedOnly, unitInventory]);

    // レアリティ順にソート
    const sortedUnits = [...filteredUnits].sort((a, b) => {
        const aIndex = rarityOrder.indexOf(a.rarity);
        const bIndex = rarityOrder.indexOf(b.rarity);
        if (aIndex !== bIndex) return bIndex - aIndex; // URが先
        return a.name.localeCompare(b.name);
    });

    const handleUnitClick = (unit: UnitDefinition) => {
        openModal(unit);
    };

    const handleToggleUnit = (unitId: string) => {
        if (selectedTeam.includes(unitId)) {
            setTeam(selectedTeam.filter((id) => id !== unitId));
        } else {
            if (selectedTeam.length < 7) {
                setTeam([...selectedTeam, unitId]);
            }
        }
    };

    if (!isLoaded) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl animate-pulse">📖 {t("loading")}</div>
            </main>
        );
    }

    const progressPercent = stats.total > 0 ? Math.round((stats.collected / stats.total) * 100) : 0;

    return (
        <main className="min-h-screen p-4 md:p-6 lg:p-8 bg-gradient-to-b from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
            {/* ヘッダー */}
            <div className="page-header mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                        📖 {t("collection_title")}
                    </h1>
                    <div className="flex items-center gap-2">
                        <LanguageSwitch />
                        <Link href="/team" className="btn btn-primary">
                            🎖️ {t("team")}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* コレクション進捗カード */}
                <section className="mb-6 bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-6 shadow-lg border-2 border-amber-200 dark:border-slate-700">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-amber-800 flex items-center gap-2">
                                🏆 {t("collection_progress")}
                            </h2>
                            <p className="text-sm text-amber-600 mt-1">
                                {stats.collected === stats.total ? "🎉 コンプリート！" : `あと ${stats.total - stats.collected} 体！`}
                            </p>
                        </div>
                        <div className="text-3xl md:text-4xl font-bold text-amber-700">
                            {stats.collected} <span className="text-xl text-amber-500">/ {stats.total}</span>
                        </div>
                    </div>

                    {/* メインプログレスバー */}
                    <div className="relative h-8 bg-amber-100 rounded-full overflow-hidden mb-6 shadow-inner">
                        <div
                            className="absolute h-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 transition-all duration-700 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center text-base font-bold text-amber-900">
                            {progressPercent}%
                        </div>
                    </div>

                    {/* レアリティ別進捗 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {stats.byRarity.map(({ rarity, total, collected }) => {
                            const percent = total > 0 ? Math.round((collected / total) * 100) : 0;
                            const isComplete = collected === total && total > 0;
                            const config = rarityConfig[rarity];

                            return (
                                <div
                                    key={rarity}
                                    className={`${config.bg} ${config.border} border-2 rounded-xl p-3 transition-all ${isComplete ? "ring-2 ring-green-400" : ""}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-bold text-lg ${config.text}`}>{rarity}</span>
                                        <span className={`text-sm font-bold ${config.text}`}>
                                            {collected}/{total}
                                            {isComplete && " ✨"}
                                        </span>
                                    </div>
                                    <div className="h-3 bg-white/50 rounded-full overflow-hidden shadow-inner">
                                        <div
                                            className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* フィルターセクション */}
                <section className="mb-6 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md border border-amber-100 dark:border-slate-700">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        {/* レアリティタブ */}
                        <div className="flex gap-2 md:gap-3 flex-wrap">
                            {rarityTabs.map(tab => {
                                const tabUnits = tab.key === "ALL"
                                    ? collectableUnits
                                    : collectableUnits.filter(u => u.rarity === tab.key);
                                const collectedCount = tabUnits.filter(u => (unitInventory[u.id] || 0) > 0).length;
                                const isSelected = rarityFilter === tab.key;

                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setRarityFilter(tab.key)}
                                        className={`
                                            px-3 py-2 md:px-4 md:py-2.5 rounded-xl font-bold text-sm md:text-base transition-all min-h-[44px]
                                            flex items-center gap-1.5 active:scale-95
                                            ${isSelected
                                                ? `${tab.color} text-white shadow-lg scale-105`
                                                : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                                            }
                                        `}
                                    >
                                        <span>{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isSelected ? "bg-white/30" : "bg-gray-200 dark:bg-slate-600"}`}>
                                            {collectedCount}/{tabUnits.length}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 所持のみ表示トグル */}
                        <button
                            onClick={() => setShowOwnedOnly(!showOwnedOnly)}
                            className={`
                                px-4 py-2.5 rounded-xl font-bold text-sm transition-all min-h-[44px]
                                flex items-center gap-2 active:scale-95
                                ${showOwnedOnly
                                    ? "bg-green-500 text-white shadow-md"
                                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                                }
                            `}
                        >
                            {showOwnedOnly ? "✅" : "👁️"} {t("owned_only") || "所持のみ"}
                        </button>
                    </div>
                </section>

                {/* ユニットグリッド */}
                <section className="mb-8">
                    {sortedUnits.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                            {sortedUnits.map((unit) => {
                                const isOwned = (unitInventory[unit.id] || 0) > 0;
                                const count = unitInventory[unit.id] || 0;
                                const unitHasAnimation = hasAnimation(unit.atlasKey || unit.id);
                                const config = rarityConfig[unit.rarity];

                                return (
                                    <div
                                        key={unit.id}
                                        className={`
                                            relative rounded-2xl p-3 md:p-4 shadow-md
                                            cursor-pointer transition-all duration-200
                                            ${isOwned
                                                ? `bg-white dark:bg-slate-800 border-2 ${config.border} hover:scale-105 hover:shadow-xl`
                                                : "bg-gray-100 dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-700 opacity-60 grayscale"
                                            }
                                        `}
                                        onClick={() => handleUnitClick(unit)}
                                    >
                                        {/* 所持数バッジ */}
                                        {isOwned && (
                                            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-green-500 text-white text-sm font-bold flex items-center justify-center border-2 border-white shadow-lg z-10">
                                                {count > 99 ? "99+" : count}
                                            </div>
                                        )}

                                        {/* 未所持マーク */}
                                        {!isOwned && (
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl z-10 opacity-60">
                                                🔒
                                            </div>
                                        )}

                                        {/* アニメーションバッジ */}
                                        {unitHasAnimation && isOwned && (
                                            <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-purple-500 text-white text-sm flex items-center justify-center border-2 border-white shadow-lg z-10">
                                                🎬
                                            </div>
                                        )}

                                        {/* 飛行バッジ */}
                                        {unit.isFlying && isOwned && (
                                            <div className={`absolute ${unitHasAnimation ? "top-6" : "-top-2"} -left-2 w-8 h-8 rounded-full bg-sky-500 text-white text-sm flex items-center justify-center border-2 border-white shadow-lg z-10`}>
                                                🪽
                                            </div>
                                        )}

                                        <div className="flex justify-center mb-2">
                                            <RarityFrame
                                                unitId={unit.id}
                                                unitName={unit.name}
                                                rarity={unit.rarity}
                                                size="lg"
                                                showLabel={true}
                                                baseUnitId={unit.baseUnitId}
                                                grayscale={!isOwned}
                                            />
                                        </div>

                                        <div className="text-center">
                                            <div className={`text-sm font-bold leading-tight min-h-[2.5rem] flex items-center justify-center ${!isOwned ? "text-gray-400" : ""}`}>
                                                {unit.name}
                                            </div>
                                            <div className="flex items-center justify-center gap-1 mt-1 text-xs flex-wrap">
                                                <span className={`font-bold ${config.text}`}>
                                                    {unit.rarity}
                                                </span>
                                                <span className="text-gray-400 dark:text-gray-500">|</span>
                                                <span className={isOwned ? "text-gray-600 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}>
                                                    {t(getSizeCategory(unit.scale ?? 1))}
                                                </span>
                                                {unit.isFlying && (
                                                    <>
                                                        <span className="text-gray-400 dark:text-gray-500">|</span>
                                                        <span className={isOwned ? "text-sky-500" : "text-gray-400 dark:text-gray-500"}>
                                                            {t("flying")}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-md">
                            <div className="text-5xl mb-4">🔍</div>
                            <p className="text-gray-500 dark:text-gray-500 text-lg">{t("no_units_in_filter")}</p>
                        </div>
                    )}
                </section>

                {/* ヒント */}
                <section className="text-center text-amber-700 text-sm bg-amber-100/50 rounded-xl p-4">
                    💡 {t("collection_hint")}
                </section>
            </div>

            {/* 詳細モーダル */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={(unitInventory[viewingUnit.id] || 0) > 0}
                    isInTeam={selectedTeam.includes(viewingUnit.id)}
                    onClose={() => closeModal()}
                    onToggleTeam={() => handleToggleUnit(viewingUnit.id)}
                />
            )}
        </main>
    );
}
