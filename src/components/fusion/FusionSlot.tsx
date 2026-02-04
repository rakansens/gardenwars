import Image from "next/image";
import { getSpritePath } from "@/lib/sprites";
import { UnitDefinition, Rarity } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface FusionSlotProps {
    unit: UnitDefinition | null;
    onClick: () => void;
    size?: "sm" | "md";
    index: number;
}

const rarityColors: Record<Rarity, string> = {
    N: "border-gray-400 bg-gray-100",
    R: "border-blue-400 bg-blue-100",
    SR: "border-purple-400 bg-purple-100",
    SSR: "border-amber-400 bg-gradient-to-b from-amber-100 to-orange-100",
    UR: "border-pink-400 bg-gradient-to-br from-pink-100 via-purple-100 to-cyan-100",
};

export default function FusionSlot({ unit, onClick, size = "md", index }: FusionSlotProps) {
    const { t } = useLanguage();

    // Size classes
    const containerClasses = size === "sm" ? "w-14 h-16 sm:w-16 sm:h-20" : "w-20 h-24 sm:w-24 sm:h-28";
    const imgSize = size === "sm" ? 32 : 48;

    return (
        <div
            onClick={onClick}
            className={`
                relative flex flex-col items-center justify-center rounded-xl transition-all duration-200 cursor-pointer
                ${containerClasses}
                ${unit
                    ? `${rarityColors[unit.rarity]} border-2 shadow-sm hover:scale-105 active:scale-95`
                    : "bg-white/10 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:bg-white/20 hover:border-gray-400"
                }
            `}
            title={unit ? t("fusion_tap_remove") : t("select_materials")}
        >
            {unit ? (
                <>
                    <div className="relative z-10 animate-bounce-short">
                        <Image
                            src={getSpritePath(unit.atlasKey || unit.baseUnitId || unit.id, unit.rarity)}
                            alt={unit.name}
                            width={imgSize}
                            height={imgSize}
                            className="object-contain drop-shadow-md"
                        />
                    </div>
                    {/* Remove Badge */}
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md z-20 hover:bg-red-600 transition-colors">
                        ✕
                    </div>
                    {size === "md" && (
                        <span className="text-[10px] sm:text-xs mt-1 font-bold block text-center truncate w-full px-1 text-gray-700">
                            {unit.name.slice(0, 6)}
                        </span>
                    )}
                </>
            ) : (
                <div className="flex flex-col items-center justify-center opacity-40">
                    <span className="text-2xl font-bold text-gray-400 mb-1">{index + 1}</span>
                    <span className="text-xs text-gray-400 font-medium hidden sm:block">Select</span>
                </div>
            )}
        </div>
    );
}
