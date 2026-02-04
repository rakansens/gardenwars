import { UnitDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import { useLanguage } from "@/contexts/LanguageContext";

interface FusionResultModalProps {
    result: UnitDefinition;
    onClose: () => void;
}

export default function FusionResultModal({ result, onClose }: FusionResultModalProps) {
    const { t } = useLanguage();
    const isUR = result.rarity === "UR";

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div
                className={`
                    relative w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl overflow-hidden
                    ${isUR
                        ? "bg-gradient-to-br from-pink-100 via-purple-100 to-cyan-100 border-4 border-pink-400"
                        : "bg-gradient-to-b from-white to-amber-50 border-4 border-amber-400"
                    }
                `}
            >
                {/* Background effects */}
                <div className="absolute inset-0 bg-[url('/assets/ui/pattern_dots.png')] opacity-10 pointer-events-none" />

                {/* Ray burst effect for UR */}
                {isUR && (
                    <div className="absolute -inset-[100%] animate-[spin_10s_linear_infinite] opacity-30 pointer-events-none bg-[conic-gradient(from_0deg,transparent_0deg,white_15deg,transparent_30deg,white_45deg,transparent_60deg,white_75deg,transparent_90deg,white_105deg,transparent_120deg,white_135deg,transparent_150deg,white_165deg,transparent_180deg,white_195deg,transparent_210deg,white_225deg,transparent_240deg,white_255deg,transparent_270deg,white_285deg,transparent_300deg,white_315deg,transparent_330deg,white_345deg,transparent_360deg)]" />
                )}

                <div className="relative z-10">
                    <h2 className={`text-3xl font-bold mb-6 drop-shadow-sm ${isUR ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500 animate-pulse" : "text-amber-600"}`}>
                        {isUR ? t("fusion_jackpot") : `🎉 ${t("fusion_result")}`}
                    </h2>

                    <div className="flex justify-center mb-6 scale-110">
                        <RarityFrame
                            unitId={result.id}
                            unitName={result.name}
                            rarity={result.rarity}
                            size="lg"
                        />
                    </div>

                    <div className="mb-4">
                        <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold shadow-md ${result.rarity === "UR" ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white animate-pulse" :
                                result.rarity === "SSR" ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" :
                                    result.rarity === "SR" ? "bg-purple-500 text-white" :
                                        result.rarity === "R" ? "bg-blue-500 text-white" :
                                            "bg-gray-400 text-white"
                            }`}>
                            {result.rarity}
                        </span>
                    </div>

                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-900 mb-8">
                        {result.name}
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg shadow-lg hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all"
                    >
                        {t("ok")}
                    </button>
                </div>
            </div>
        </div>
    );
}
