"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";

interface GachaHistoryProps {
    history: {
        timestamp: number;
        count: number;
        unitIds: string[];
    }[];
    allUnits: UnitDefinition[];
    onUnitClick: (unit: UnitDefinition) => void;
}

interface HistoryEntryProps {
    entry: {
        timestamp: number;
        count: number;
        unitIds: string[];
    };
    allUnits: UnitDefinition[];
    onUnitClick: (unit: UnitDefinition) => void;
}

export default function GachaHistory({ history, allUnits, onUnitClick }: GachaHistoryProps) {
    const { t } = useLanguage();

    if (history.length === 0) {
        return (
            <div className="card text-center py-12">
                <div className="text-4xl mb-4">📭</div>
                <p className="text-amber-900/50 dark:text-amber-100/50 font-medium">{t("gacha_history_empty")}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {history.map((entry, index) => (
                <HistoryEntry
                    key={`${entry.timestamp}-${index}`}
                    entry={entry}
                    allUnits={allUnits}
                    onUnitClick={onUnitClick}
                />
            ))}
        </div>
    );
}

function HistoryEntry({ entry, allUnits, onUnitClick }: HistoryEntryProps) {
    const { t } = useLanguage();
    const [isExpanded, setIsExpanded] = useState(false);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const countRarityInHistory = (unitIds: string[]) => {
        const counts = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
        for (const id of unitIds) {
            const unit = allUnits.find(u => u.id === id);
            if (unit) counts[unit.rarity]++;
        }
        return counts;
    };

    const counts = countRarityInHistory(entry.unitIds);
    const units = entry.unitIds
        .map(id => allUnits.find(u => u.id === id))
        .filter((u): u is UnitDefinition => u !== undefined);

    const displayUnits = isExpanded ? units : units.slice(0, 10);
    const hiddenCount = units.length - displayUnits.length;

    return (
        <div className="card p-4 bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/30 transition-colors">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-200/50 dark:border-amber-800/50">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {formatDate(entry.timestamp)}
                </span>
                <span className="text-sm font-bold text-amber-900 dark:text-amber-100 bg-amber-200/50 dark:bg-amber-800/50 px-2 py-0.5 rounded">
                    {entry.count === 1 ? t("gacha_count_1") : entry.count === 10 ? t("gacha_count_10") : t("gacha_count_100")}
                </span>
            </div>

            {/* Units Grid */}
            <div className={`flex gap-2 flex-wrap mb-3 ${isExpanded ? "max-h-96 overflow-y-auto pr-1" : ""}`}>
                {displayUnits.map((unit, unitIndex) => (
                    <div
                        key={unitIndex}
                        className="w-10 h-10 cursor-pointer hover:scale-110 transition-transform relative group"
                        onClick={() => onUnitClick(unit)}
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
                {hiddenCount > 0 && (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 rounded-lg text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors border-2 border-dashed border-amber-300 dark:border-amber-700"
                    >
                        +{hiddenCount}
                    </button>
                )}
            </div>

            {/* Footer: Rarity Summary & Collapse Button */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap text-xs">
                    {counts.UR > 0 && (
                        <span className="px-2 py-0.5 rounded bg-gradient-to-r from-pink-500 to-cyan-500 text-white font-bold shadow-sm">
                            UR: {counts.UR}
                        </span>
                    )}
                    {counts.SSR > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-bold shadow-sm">
                            SSR: {counts.SSR}
                        </span>
                    )}
                    {counts.SR > 0 && (
                        <span className="px-2 py-0.5 rounded bg-purple-500 text-white shadow-sm">
                            SR: {counts.SR}
                        </span>
                    )}
                </div>

                {isExpanded && units.length > 10 && (
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                    >
                        {t("show_less")}
                    </button>
                )}
            </div>
        </div>
    );
}

