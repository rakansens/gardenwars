"use client";

import type { UnitDefinition, UnitRole } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import TeamUnitCard from "./TeamUnitCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface UnitCollectionProps {
    ownedUnits: UnitDefinition[];
    unownedUnits: UnitDefinition[];
    unitInventory: Record<string, number>;
    selectedTeam: string[];
    onToggleUnit: (unitId: string) => void;
    onUnitClick: (unit: UnitDefinition) => void;
    activeTab: "owned" | "unowned";
    setActiveTab: (tab: "owned" | "unowned") => void;
    roleConfig: Record<UnitRole, { icon: string; color: string; bgColor: string }>;
    getUnitDPS: (unit: UnitDefinition) => number;
    getOtherDeckIndex: (unitId: string) => number | null;
    getUnitHasAnimation: (unit: UnitDefinition) => boolean;
    validTeamCount: number;
    MAX_TEAM_SIZE: number;
    isLoaded: boolean;
}

export default function UnitCollection({
    ownedUnits,
    unownedUnits,
    unitInventory,
    selectedTeam,
    onToggleUnit,
    onUnitClick,
    activeTab,
    setActiveTab,
    roleConfig,
    getUnitDPS,
    getOtherDeckIndex,
    getUnitHasAnimation,
    validTeamCount,
    MAX_TEAM_SIZE,
    isLoaded
}: UnitCollectionProps) {
    const { t } = useLanguage();

    const displayUnits = activeTab === "owned" ? ownedUnits : unownedUnits;

    if (!isLoaded) {
        return (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner icon="🛡️" />
            </div>
        );
    }

    return (
        <section className="flex flex-col flex-1 h-full">
            {/* Tabs */}
            <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                <button
                    onClick={() => setActiveTab("owned")}
                    className={`
                        flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                        ${activeTab === "owned"
                            ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm ring-1 ring-black/5"
                            : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                        }
                    `}
                >
                    ✅ {t("owned_units")}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === "owned" ? "bg-slate-100 dark:bg-slate-800" : "bg-slate-200 dark:bg-slate-800"}`}>
                        {ownedUnits.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("unowned")}
                    className={`
                        flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                        ${activeTab === "unowned"
                            ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm ring-1 ring-black/5"
                            : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                        }
                    `}
                >
                    🔒 {t("unowned_units")}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === "unowned" ? "bg-slate-100 dark:bg-slate-800" : "bg-slate-200 dark:bg-slate-800"}`}>
                        {unownedUnits.length}
                    </span>
                </button>
            </div>

            {/* Grid */}
            {displayUnits.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <div className="text-4xl mb-2">🤷‍♂️</div>
                    <div className="font-bold">{t("no_units_found")}</div>
                </div>
            ) : (
                <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 pb-24 md:pb-8">
                    {displayUnits.map(unit => {
                        const isSelected = selectedTeam.includes(unit.id);
                        const otherDeckIndex = getOtherDeckIndex(unit.id);
                        const isInOtherDeck = otherDeckIndex !== null;
                        // Logic for "canAdd":
                        // - If not selected
                        // - AND not in other deck
                        // - AND team is not full
                        const canAdd = !isSelected && !isInOtherDeck && validTeamCount < MAX_TEAM_SIZE;

                        return (
                            <div key={unit.id} className="h-full">
                                <TeamUnitCard
                                    unit={unit}
                                    isOwned={activeTab === "owned"}
                                    isSelected={isSelected}
                                    isInOtherDeck={isInOtherDeck}
                                    otherDeckIndex={otherDeckIndex}
                                    canAdd={canAdd}
                                    count={unitInventory[unit.id] || 0}
                                    onClick={() => onUnitClick(unit)}
                                    onToggle={() => onToggleUnit(unit.id)}
                                    roleConfig={roleConfig}
                                    getUnitDPS={getUnitDPS}
                                    hasAnimation={getUnitHasAnimation(unit)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
