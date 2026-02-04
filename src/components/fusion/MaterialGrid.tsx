import { UnitDefinition } from "@/data/types";
import UnitCard from "@/components/ui/UnitCard";
import { useLanguage } from "@/contexts/LanguageContext";

interface MaterialGridProps {
    units: UnitDefinition[];
    ownedUnits: Record<string, number>;
    selectedUnits: string[];
    onToggleUnit: (unitId: string) => void;
    maxSelectable: number;
}

export default function MaterialGrid({
    units,
    ownedUnits,
    selectedUnits,
    onToggleUnit,
    maxSelectable
}: MaterialGridProps) {
    const { t } = useLanguage();

    // Helper to get selected count for a specific unit ID
    const getSelectedCount = (unitId: string) => {
        return selectedUnits.filter(id => id === unitId).length;
    };

    if (units.length === 0) {
        return (
            <div className="bg-amber-50/50 dark:bg-gray-800/50 rounded-xl p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-gray-500 dark:text-gray-400 text-lg">{t("no_units")}</p>
            </div>
        );
    }

    return (
        <div className="bg-amber-50/80 dark:bg-gray-800/80 rounded-2xl p-6 shadow-inner backdrop-blur-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <span>📦</span> {t("select_materials")}
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
                {units.map(unit => {
                    const owned = ownedUnits[unit.id] || 0;
                    const selected = getSelectedCount(unit.id);
                    // Can select if we haven't reached max global selection AND we have more of this unit than already selected
                    const canSelect = selectedUnits.length < maxSelectable && selected < owned;
                    const isFullySelected = selected >= owned;

                    return (
                        <div key={unit.id} className="relative group">
                            {/* Selection Overlay Badge */}
                            {selected > 0 && (
                                <div className="absolute -top-2 -left-2 z-20 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-white dark:border-gray-700 transform transition-transform scale-100 animate-bounce-short">
                                    ×{selected}
                                </div>
                            )}

                            <div
                                className={`transition-all duration-200 ${selected > 0 ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-amber-50 dark:ring-offset-gray-800 rounded-lg transform scale-105" : ""
                                    } ${!canSelect && !selected ? "opacity-50 grayscale" : ""}`}
                            >
                                <UnitCard
                                    unit={unit}
                                    variant="grid"
                                    isOwned={true}
                                    ownedCount={owned}
                                    onClick={() => onToggleUnit(unit.id)}
                                    // Make it look "disabled" or "dimmed" if we can't select more and haven't selected any
                                    grayscale={isFullySelected}
                                />
                            </div>

                            {/* Click feedback overlay */}
                            <div
                                className="absolute inset-0 rounded-lg pointer-events-none transition-colors duration-200 group-active:bg-purple-500/10"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
