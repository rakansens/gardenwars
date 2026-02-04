import { useLanguage } from "@/contexts/LanguageContext";
import Image from "next/image";

type FusionMode = 3 | 10;

interface FusionModeSelectorProps {
    currentMode: FusionMode;
    onChange: (mode: FusionMode) => void;
    disabled?: boolean;
}

export default function FusionModeSelector({
    currentMode,
    onChange,
    disabled = false
}: FusionModeSelectorProps) {
    const { t } = useLanguage();

    const modes: { value: FusionMode; titleKey: string; img: string }[] = [
        { value: 3, titleKey: "fusion_3_title", img: "/assets/ui/fusion_3slot.png" },
        { value: 10, titleKey: "fusion_10_title", img: "/assets/ui/fusion_main.png" }
    ];

    return (
        <div className="flex justify-center gap-4 sm:gap-6 mb-8 flex-wrap">
            {modes.map((mode) => {
                const isSelected = currentMode === mode.value;
                return (
                    <button
                        key={mode.value}
                        onClick={() => !disabled && onChange(mode.value)}
                        disabled={disabled}
                        className={`
                            relative flex flex-col items-center p-4 rounded-2xl transition-all duration-300 w-40 sm:w-48
                            ${disabled ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer hover:scale-105 active:scale-95"}
                            ${isSelected
                                ? mode.value === 10
                                    ? "bg-gradient-to-b from-amber-500/10 via-pink-600/10 to-purple-700/10 border-2 border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                                    : "bg-gradient-to-b from-purple-600/10 to-blue-600/10 border-2 border-purple-400 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                                : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                            }
                        `}
                    >
                        {/* Selected Indicator */}
                        {isSelected && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-xs font-bold px-3 py-1 rounded-full shadow-md text-gray-800 flex items-center gap-1">
                                <span className="text-green-500">✔</span> {t("selected")}
                            </div>
                        )}

                        <div className={`relative w-24 h-24 sm:w-28 sm:h-28 mb-3 transition-all duration-300 ${isSelected ? "scale-110 drop-shadow-xl" : "opacity-80 scale-90"}`}>
                            <Image
                                src={mode.img}
                                alt={t(mode.titleKey)}
                                fill
                                className="object-contain"
                            />
                        </div>

                        <div className={`font-bold text-lg text-center leading-tight ${isSelected ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                            {t(mode.titleKey)}
                        </div>

                        {mode.value === 10 && isSelected && (
                            <div className="absolute -right-2 -top-2 w-8 h-8 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full flex items-center justify-center text-white text-lg animate-bounce shadow-lg">
                                ✨
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
