"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UnitDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";

interface TeamSidebarProps {
    selectedTeam: string[];
    allyUnits: UnitDefinition[];
    activeLoadoutIndex: number;
    switchLoadout: (index: number) => void;
    onRemoveUnit: (unitId: string) => void;
    MAX_TEAM_SIZE: number;
    isMobile?: boolean;
}

export default function TeamSidebar({
    selectedTeam,
    allyUnits,
    activeLoadoutIndex,
    switchLoadout,
    onRemoveUnit,
    MAX_TEAM_SIZE,
    isMobile = false
}: TeamSidebarProps) {
    const { t } = useLanguage();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const getSelectedTeamDefs = () => {
        return selectedTeam
            .map((id) => allyUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
    };

    const validTeamCount = getSelectedTeamDefs().length;

    const getTotalCost = () => {
        return getSelectedTeamDefs().reduce((sum, unit) => sum + unit.cost, 0);
    };

    // Mobile View (Bottom Sticky) - Two-Row Layout
    if (isMobile) {
        return (
            <div className="md:hidden sticky bottom-0 z-30 w-full bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-700 px-3 pt-2 pb-2 pb-safe">
                {/* Top Row: Loadout Switcher + Stats */}
                <div className="flex items-center justify-between mb-1.5">
                    <div className="flex gap-1">
                        {[0, 1, 2].map((idx) => (
                            <button
                                key={idx}
                                onClick={() => switchLoadout(idx)}
                                className={`w-8 h-7 rounded-md font-bold text-xs transition-all ${activeLoadoutIndex === idx
                                    ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-300"
                                    : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-slate-600"
                                    }`}
                            >
                                {idx === 0 ? "A" : idx === 1 ? "B" : "C"}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        {isMounted ? (
                            <>
                                <span className={`${validTeamCount === MAX_TEAM_SIZE ? "text-green-600" : ""}`}>
                                    {validTeamCount}/{MAX_TEAM_SIZE}
                                </span>
                                <span className="text-amber-600">¥{getTotalCost()}</span>
                            </>
                        ) : (
                            <span className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></span>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Deck Slots (Horizontal Scroll) */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                    {isMounted ? Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
                        const unit = getSelectedTeamDefs()[index];
                        return (
                            <div
                                key={index}
                                onClick={() => unit && onRemoveUnit(unit.id)}
                                className={`
                                    relative w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center border-2 transition-all overflow-hidden
                                    ${unit
                                        ? "bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 border-white dark:border-slate-500 shadow-sm cursor-pointer active:scale-95"
                                        : "bg-slate-50 dark:bg-slate-800 border-dashed border-slate-300 dark:border-slate-700"
                                    }
                                `}
                            >
                                {unit ? (
                                    <>
                                        <div className="scale-[0.6]">
                                            <RarityFrame unitId={unit.id} unitName={unit.name} rarity={unit.rarity} size="sm" showLabel={false} baseUnitId={unit.baseUnitId} />
                                        </div>
                                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-bl-md text-white text-[8px] flex items-center justify-center z-10">×</div>
                                    </>
                                ) : (
                                    <span className="text-slate-300 dark:text-slate-600 text-sm font-bold">+</span>
                                )}
                            </div>
                        );
                    }) : (
                        // Mobile Skeleton
                        Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => (
                            <div key={index} className="w-10 h-10 flex-shrink-0 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        ))
                    )}
                </div>
            </div>
        );
    }

    // Desktop View (Left Sidebar)
    return (
        <aside className="hidden md:flex flex-col w-40 lg:w-48 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 overflow-y-auto custom-scrollbar">

            {/* Header */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <div className="text-center mb-2">
                    <h2 className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider mb-1">
                        {t("team_members")}
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold">
                        {isMounted ? (
                            <>
                                <span className={`px-1.5 py-0.5 rounded-full ${validTeamCount === MAX_TEAM_SIZE ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                                    {validTeamCount}/{MAX_TEAM_SIZE}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    💰 ¥{getTotalCost()}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="w-10 h-5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></span>
                                <span className="w-12 h-5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></span>
                            </>
                        )}
                    </div>
                </div>

                {/* Loadout Switcher */}
                <div className="flex justify-center gap-1">
                    {[0, 1, 2].map((idx) => (
                        <button
                            key={idx}
                            onClick={() => switchLoadout(idx)}
                            className={`
                                flex-1 py-1.5 rounded-lg font-bold text-xs transition-all border
                                ${activeLoadoutIndex === idx
                                    ? "bg-amber-500 border-amber-600 text-white shadow-md relative top-[1px]"
                                    : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600"
                                }
                            `}
                        >
                            {idx === 0 ? "Set A" : idx === 1 ? "Set B" : "Set C"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Deck Slots */}
            <div className="p-2 space-y-1 flex-1">
                {isMounted ? Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
                    const unit = getSelectedTeamDefs()[index];
                    return (
                        <div
                            key={index}
                            onClick={() => unit && onRemoveUnit(unit.id)}
                            className={`
                                relative h-12 lg:h-14 rounded-lg flex items-center justify-center transition-all group
                                ${unit
                                    ? "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 cursor-pointer hover:shadow-md hover:scale-[1.02] border-2 border-white dark:border-slate-500"
                                    : "bg-slate-100/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700"
                                }
                            `}
                        >
                            {unit ? (
                                <div className="relative w-full h-full p-1">
                                    {/* Remove Badge (Hidden by default, shown on hover) */}
                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center z-10 font-bold shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                        ×
                                    </div>

                                    <div className="flex items-center justify-center h-full">
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={unit.name}
                                            rarity={unit.rarity}
                                            size="sm"
                                            showLabel={false}
                                            baseUnitId={unit.baseUnitId}
                                        />
                                    </div>

                                    {/* Cost Label */}
                                    <div className="absolute bottom-1 left-0 right-0 text-center">
                                        <span className="text-[10px] bg-black/70 text-amber-400 px-1.5 py-0.5 rounded-full font-bold backdrop-blur-sm">
                                            ¥{unit.cost}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                    <span className="text-lg font-bold">+</span>
                                    <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Slot {index + 1}</span>
                                </div>
                            )}
                        </div>
                    );
                }) : (
                    // Desktop Skeleton
                    Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => (
                        <div key={index} className="h-12 lg:h-14 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))
                )}
            </div>

            <div className="p-4 text-center text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                {t("click_to_remove")}
            </div>
        </aside>
    );
}
