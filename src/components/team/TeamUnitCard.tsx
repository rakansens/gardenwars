"use client";

import type { UnitDefinition, UnitRole } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import { useLanguage } from "@/contexts/LanguageContext";

interface TeamUnitCardProps {
    unit: UnitDefinition;
    isOwned: boolean;
    isSelected: boolean;
    isInOtherDeck: boolean;
    otherDeckIndex: number | null;
    canAdd: boolean;
    count: number;
    onClick: () => void;
    onToggle: () => void;
    roleConfig: Record<UnitRole, { icon: string; color: string; bgColor: string }>;
    getUnitDPS: (unit: UnitDefinition) => number;
    hasAnimation: boolean;
}

export default function TeamUnitCard({
    unit,
    isOwned,
    isSelected,
    isInOtherDeck,
    otherDeckIndex,
    canAdd,
    count,
    onClick,
    onToggle,
    roleConfig,
    getUnitDPS,
    hasAnimation
}: TeamUnitCardProps) {
    const { t } = useLanguage();

    // Size helper
    const getSizeCategory = (scale: number): string => {
        if (scale <= 0.85) return "size_tiny";
        if (scale <= 1.1) return "size_small";
        if (scale <= 1.4) return "size_medium";
        if (scale <= 1.8) return "size_large";
        if (scale <= 2.5) return "size_huge";
        return "size_giant";
    };

    return (
        <div
            onClick={onClick}
            className={`
            relative flex flex-col h-full rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer
            ${isSelected
                    ? "ring-4 ring-green-500 shadow-xl scale-[1.02] z-10 bg-white dark:bg-slate-800"
                    : isInOtherDeck
                        ? "opacity-90 grayscale-[0.2] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        : !isOwned
                            ? "opacity-60 grayscale bg-gray-100 dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700"
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600"
                }
        `}>
            {/* Status Overlays */}
            {isInOtherDeck && (
                <div className="absolute top-0 right-0 left-0 bg-orange-500 text-white text-[10px] font-bold text-center py-0.5 z-20">
                    IN DECK {otherDeckIndex}
                </div>
            )}

            {/* Upper Content - Clickable for details */}
            <div className="p-3 pb-0 flex-1">
                <div className="relative flex justify-center mb-3 mt-2">
                    {/* Badges */}
                    {isOwned && count > 1 && (
                        <div className="absolute -top-1 -right-1 min-w-[24px] h-6 px-1 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-slate-800 shadow z-10">
                            ×{count}
                        </div>
                    )}

                    {hasAnimation && (
                        <div className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-slate-800 shadow z-10" title="Has Animation">
                            🎬
                        </div>
                    )}

                    {unit.role && (
                        <div className={`absolute ${hasAnimation ? "top-7" : "-top-1"} -left-1 w-7 h-7 rounded-full ${roleConfig[unit.role].bgColor} text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-slate-800 shadow z-10`} title={unit.role}>
                            {roleConfig[unit.role].icon}
                        </div>
                    )}

                    <RarityFrame
                        unitId={unit.id}
                        unitName={unit.name}
                        rarity={unit.rarity}
                        size="xl"
                        showLabel={false}
                        baseUnitId={unit.baseUnitId}
                        grayscale={!isOwned}
                    />
                </div>

                {/* Info */}
                <div className="text-center mb-2">
                    <div className="font-bold text-sm truncate px-1 text-slate-800 dark:text-slate-200">{unit.name}</div>

                    {/* Tags */}
                    <div className="flex items-center justify-center gap-1.5 mt-1 text-[10px]">
                        <span className={`font-black px-1.5 py-0.5 rounded ${unit.rarity === "UR" ? "bg-gradient-to-r from-pink-500/10 to-cyan-500/10 text-pink-600 dark:text-pink-400" :
                            unit.rarity === "SSR" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                                "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            }`}>
                            {unit.rarity}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-500 dark:text-slate-400">
                            {t(getSizeCategory(unit.scale ?? 1))}
                        </span>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400 mb-2 px-1">
                    <div className="flex justify-between">
                        <span>❤️ {t("hp")}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{unit.maxHp}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>⚔️ {t("attack")}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{unit.attackDamage}</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                        <span>💥 DPS</span>
                        <span className="font-bold">{getUnitDPS(unit).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-blue-500">
                        <span>🏃 SP</span>
                        <span className="font-bold">{unit.speed}</span>
                    </div>
                    <div className="flex justify-between text-amber-600 dark:text-amber-500 col-span-2 bg-amber-50 dark:bg-amber-900/10 rounded px-1.5 py-0.5 mt-0.5">
                        <span className="flex items-center gap-1">💰 {t("cost")}</span>
                        <span className="font-bold">¥{unit.cost}</span>
                    </div>
                </div>
            </div>

            {/* Action Button */}
            <div className="p-3 pt-0 mt-auto z-10">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                    disabled={!isOwned || (!isSelected && !canAdd)}
                    className={`
                        w-full py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 border
                        ${isSelected
                            ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                            : !isOwned
                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                : isInOtherDeck
                                    ? "bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 cursor-not-allowed"
                                    : canAdd
                                        ? "bg-green-500 text-white border-green-600 shadow-md hover:bg-green-600 hover:shadow-lg hover:-translate-y-0.5"
                                        : "bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed"
                        }
                    `}
                >
                    {!isOwned ? (
                        <span className="flex items-center justify-center gap-1">🔒 {t("not_owned")}</span>
                    ) : isSelected ? (
                        <span className="flex items-center justify-center gap-1">✖ {t("remove_quick")}</span>
                    ) : isInOtherDeck ? (
                        <span className="flex items-center justify-center gap-1">⚠️ Deck {otherDeckIndex}</span>
                    ) : canAdd ? (
                        <span className="flex items-center justify-center gap-1">➕ {t("add_quick")}</span>
                    ) : (
                        <span className="flex items-center justify-center gap-1">🚫 {t("team_full")}</span>
                    )}
                </button>
            </div>
        </div>
    );
}
