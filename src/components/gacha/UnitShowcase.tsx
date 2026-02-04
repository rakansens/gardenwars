"use client";

import { useState, useMemo } from "react";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import { useLanguage } from "@/contexts/LanguageContext";

type ViewMode = "carousel" | "grid";

// ... imports

interface UnitShowcaseProps {
    title: string;
    icon?: string;
    units: UnitDefinition[];
    unitInventory: Record<string, number>;
    onUnitClick: (unit: UnitDefinition) => void;
    getDropRate?: (unit: UnitDefinition) => number;
    showRarityFilter?: boolean;
    showDropRate?: boolean;
    highlightNew?: boolean;
    colorTheme?: "purple" | "green" | "amber";
    groupByDate?: boolean; // NEW: Enable date grouping
}

export default function UnitShowcase({
    title,
    icon = "✨",
    units,
    unitInventory,
    onUnitClick,
    getDropRate,
    showRarityFilter = false,
    showDropRate = false,
    highlightNew = false,
    colorTheme = "purple",
    groupByDate = false,
}: UnitShowcaseProps) {
    const { t } = useLanguage();
    // Default to grid if grouping is enabled, otherwise carousel
    const [viewMode, setViewMode] = useState<ViewMode>(groupByDate ? "grid" : "carousel");
    const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");

    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gray-500" },
        { key: "N", label: "N", color: "bg-gray-400" },
        { key: "R", label: "R", color: "bg-blue-500" },
        { key: "SR", label: "SR", color: "bg-purple-500" },
        { key: "SSR", label: "SSR", color: "bg-amber-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

    // Filter by Rarity first
    const filteredByRarity = units.filter(u => rarityFilter === "ALL" || u.rarity === rarityFilter);

    // Grouping Logic
    const groupedUnits = useMemo(() => {
        if (!groupByDate) return { "ALL": filteredByRarity };

        const groups: Record<string, UnitDefinition[]> = {};

        filteredByRarity.forEach(unit => {
            const dateStr = unit.addedDate ? new Date(unit.addedDate).toLocaleDateString() : t("unknown_date");
            // Standardize key for sorting if needed, but for now using simple date string
            // A better approach might be YYYY-MM-DD for sorting keys, then display formatted
            const dateObj = unit.addedDate ? new Date(unit.addedDate) : new Date(0);
            const key = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

            if (!groups[key]) groups[key] = [];
            groups[key].push(unit);
        });

        return groups;
    }, [filteredByRarity, groupByDate, t]);

    // Sort groups by date descending
    const sortedGroupKeys = Object.keys(groupedUnits).sort((a, b) => b.localeCompare(a));

    // Formatting date helper
    const getGroupLabel = (dateKey: string) => {
        if (dateKey === "ALL") return "";
        const date = new Date(dateKey);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return t("date_today") || "Today";
        if (date.toDateString() === yesterday.toDateString()) return t("date_yesterday") || "Yesterday";

        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };


    // Theme definition (same as before)
    const themes = {
        purple: {
            bg: "bg-gradient-to-br from-purple-900 via-pink-900 to-indigo-900",
            border: "border-pink-400/50",
            title: "from-pink-300 via-purple-300 to-cyan-300",
            itemBg: "from-purple-800/60 to-pink-800/60",
            itemBorder: "border-pink-500/40 hover:border-pink-400",
            text: "text-pink-100",
        },
        green: {
            bg: "bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30",
            border: "border-green-400/50",
            title: "text-green-800 dark:text-green-300",
            itemBg: "from-green-100 to-emerald-200 dark:from-green-800/50 dark:to-emerald-800/50",
            itemBorder: "border-green-500/30 hover:border-green-400",
            text: "text-green-900 dark:text-green-100",
        },
        amber: {
            bg: "bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30",
            border: "border-amber-400/50",
            title: "text-amber-800 dark:text-amber-300",
            itemBg: "from-amber-100 to-orange-200 dark:from-amber-800/50 dark:to-orange-800/50",
            itemBorder: "border-amber-500/30 hover:border-amber-400",
            text: "text-amber-900 dark:text-amber-100",
        }
    };

    const currentTheme = themes[colorTheme];

    // Removed specific check for empty units here to allow empty groups handling if needed, 
    // but usually we rely on filtering.
    // if (units.length === 0) return null; 

    return (
        // REMOVED overflow-hidden to fix badge clipping
        <section className={`card mb-8 p-1 border-2 shadow-lg ${currentTheme.bg} ${currentTheme.border}`}>

            {/* Inner container to apply padding and manage layout */}
            <div className="p-3 sm:p-5">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xl font-bold flex items-center gap-2 ${colorTheme === "purple" ? "text-transparent bg-clip-text bg-gradient-to-r" : ""} ${currentTheme.title}`}>
                        <span>{icon}</span> {title} <span className="text-sm opacity-70">({units.length})</span>
                    </h3>

                    <div className="flex gap-1 bg-black/10 dark:bg-white/10 rounded-lg p-1">
                        {/* Only show view toggle if NOT grouping by date (grouping usually implies vertical list or specific layout) 
                         OR we can support both. For now, let's keep it simple. */}
                        {!groupByDate && (
                            <>
                                <button
                                    onClick={() => setViewMode("carousel")}
                                    className={`px-2 py-1 rounded text-xs transition-all ${viewMode === "carousel" ? "bg-white/90 text-black shadow-sm" : "text-current hover:bg-white/20"}`}
                                >
                                    ⟷
                                </button>
                                <button
                                    onClick={() => setViewMode("grid")}
                                    className={`px-2 py-1 rounded text-xs transition-all ${viewMode === "grid" ? "bg-white/90 text-black shadow-sm" : "text-current hover:bg-white/20"}`}
                                >
                                    ⊞
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Rarity Filter */}
                {showRarityFilter && (
                    <div className="flex gap-1.5 flex-wrap mb-4 overflow-x-auto pb-2 scrollbar-hide">
                        {rarityTabs.map(tab => {
                            // Count logic needs to be aware of grouping? No, just total count for that rarity
                            const count = units.filter(u => tab.key === "ALL" || u.rarity === tab.key).length;
                            if (count === 0 && tab.key !== "ALL") return null;

                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setRarityFilter(tab.key)}
                                    className={`
                                    px-3 py-1 rounded-full font-bold text-xs transition-all whitespace-nowrap
                                    ${rarityFilter === tab.key
                                            ? `${tab.color} text-white shadow-md scale-105 ring-2 ring-white/50`
                                            : "bg-white/50 dark:bg-black/30 text-gray-700 dark:text-gray-300 hover:bg-white/80"
                                        }
                                `}
                                >
                                    {tab.label} <span className="opacity-70">({count})</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Content Render Logic */}
                <div className="space-y-6">
                    {sortedGroupKeys.map(groupKey => {
                        const groupUnits = groupedUnits[groupKey];
                        if (groupUnits.length === 0) return null;

                        return (
                            <div key={groupKey}>
                                {groupByDate && (
                                    <h4 className={`text-sm font-bold mb-2 px-2 py-1 rounded inline-block ${currentTheme.title} bg-white/10`}>
                                        📅 {getGroupLabel(groupKey)}
                                    </h4>
                                )}

                                {viewMode === "carousel" ? (
                                    <div className="overflow-x-auto pb-6 -mx-2 px-2 scrollbar-hide pt-2">  {/* Added pt-2 for top badge clipping */}
                                        <div className="flex gap-3" style={{ width: 'max-content' }}>
                                            {groupUnits.map((unit: UnitDefinition) => {
                                                const rate = getDropRate ? getDropRate(unit) : 0;
                                                const isOwned = (unitInventory[unit.id] || 0) > 0;
                                                const count = unitInventory[unit.id] || 0;

                                                return (
                                                    <UnitShowcaseItem
                                                        key={unit.id}
                                                        unit={unit}
                                                        isOwned={isOwned}
                                                        count={count}
                                                        rate={rate}
                                                        showDropRate={showDropRate}
                                                        theme={currentTheme}
                                                        onClick={() => onUnitClick(unit)}
                                                        highlightNew={highlightNew && !!unit.addedDate}
                                                        mode="card"
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 pt-2 pl-2 pr-2"> {/* Added padding for badges */}
                                        {groupUnits.map((unit: UnitDefinition) => {
                                            const rate = getDropRate ? getDropRate(unit) : 0;
                                            const isOwned = (unitInventory[unit.id] || 0) > 0;
                                            const count = unitInventory[unit.id] || 0;

                                            return (
                                                <UnitShowcaseItem
                                                    key={unit.id}
                                                    unit={unit}
                                                    isOwned={isOwned}
                                                    count={count}
                                                    rate={rate}
                                                    showDropRate={showDropRate}
                                                    theme={currentTheme}
                                                    onClick={() => onUnitClick(unit)}
                                                    highlightNew={highlightNew && !!unit.addedDate}
                                                    mode="grid"
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filteredByRarity.length === 0 && (
                        <div className="py-8 text-center w-full opacity-60 italic">{t("no_units_found")}</div>
                    )}
                </div>

            </div>{/* End Inner Container */}
        </section>
    );
}


// Subcomponent for individual items
interface UnitShowcaseItemProps {
    unit: UnitDefinition;
    isOwned: boolean;
    count: number;
    rate: number;
    showDropRate: boolean;
    theme: any;
    onClick: () => void;
    highlightNew: boolean;
    mode: "card" | "grid";
}

function UnitShowcaseItem({
    unit, isOwned, count, rate, showDropRate, theme, onClick, highlightNew, mode
}: UnitShowcaseItemProps) {

    // Helper for recent check (simplified)
    const isVeryNew = highlightNew && (() => {
        if (!unit.addedDate) return false;
        const diff = (new Date().getTime() - new Date(unit.addedDate).getTime()) / (1000 * 3600 * 24);
        return diff <= 7;
    })();

    if (mode === "card") {
        return (
            <div
                className={`
                    relative flex-shrink-0 w-32 p-3 rounded-xl cursor-pointer transition-all
                    bg-gradient-to-br ${theme.itemBg}
                    border-2 ${theme.itemBorder}
                    hover:shadow-xl hover:scale-105 active:scale-95
                    ${isOwned ? "ring-2 ring-green-400/50" : "opacity-90 grayscale-[0.3]"}
                `}
                onClick={onClick}
            >
                {showDropRate && (
                    <div className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold z-10 ${rate < 0.05 ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white animate-pulse" : "bg-black/50 text-white backdrop-blur-md"}`}>
                        {rate.toFixed(2)}%
                    </div>
                )}

                {isOwned && (
                    <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center z-10 shadow-lg border border-white">
                        {count > 1 ? count : "✓"}
                    </div>
                )}

                {isVeryNew && (
                    <div className="absolute top-8 -right-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-l z-10 shadow animate-pulse">
                        NEW
                    </div>
                )}

                <div className="flex justify-center mb-2">
                    <RarityFrame unitId={unit.id} unitName={unit.name} rarity={unit.rarity} size="lg" showLabel={false} baseUnitId={unit.baseUnitId} grayscale={!isOwned} />
                </div>
                <div className={`text-xs text-center font-bold truncate ${theme.text}`}>{unit.name}</div>
            </div>
        );
    }

    // Grid Mode
    return (
        <div
            className={`
                relative p-2 rounded-xl cursor-pointer transition-all
                bg-gradient-to-br ${theme.itemBg}
                border ${theme.itemBorder}
                hover:shadow-lg hover:scale-105 active:scale-95
                ${!isOwned ? "opacity-70 grayscale" : ""}
            `}
            onClick={onClick}
        >
            {showDropRate && (
                <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[9px] font-bold z-10">
                    {rate.toFixed(1)}%
                </div>
            )}

            {isOwned && (
                <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center z-10 shadow border border-white">
                    {count > 1 ? count : "✓"}
                </div>
            )}

            <div className="flex justify-center">
                <RarityFrame unitId={unit.id} unitName={unit.name} rarity={unit.rarity} size="md" showLabel={false} baseUnitId={unit.baseUnitId} grayscale={!isOwned} />
            </div>
            <div className={`text-[10px] text-center font-medium truncate mt-1 ${theme.text}`}>{unit.name}</div>
        </div>
    );
}
