"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import Image from "next/image";

interface GachaMachineProps {
    coins: number;
    isRolling: boolean;
    onRoll: (count: number) => void;
    SINGLE_COST: number;
    MULTI_COST: number;
    SUPER_MULTI_COST: number;
}

export default function GachaMachine({
    coins,
    isRolling,
    onRoll,
    SINGLE_COST,
    MULTI_COST,
    SUPER_MULTI_COST,
}: GachaMachineProps) {
    const { t } = useLanguage();

    return (
        <div className="card text-center mb-8 relative overflow-hidden bg-gradient-to-b from-amber-50 to-amber-100 dark:from-slate-800 dark:to-slate-900 border-4 border-amber-200 dark:border-slate-700 shadow-xl">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-400 via-purple-500 to-cyan-400 opacity-50"></div>

            <div className="py-8 px-4">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 mb-2 drop-shadow-sm">
                    {t("gacha_machine_title")}
                </h2>
                <p className="text-amber-900/70 dark:text-amber-100/70 mb-8 whitespace-pre-line max-w-lg mx-auto leading-relaxed">
                    {t("gacha_machine_desc")}
                </p>

                {/* 排出率 */}
                <div className="flex justify-center gap-3 mb-10 flex-wrap">
                    <Badge color="bg-gray-200 dark:bg-slate-700" textColor="text-gray-700 dark:text-gray-300">N: 51%</Badge>
                    <Badge color="bg-blue-100 dark:bg-blue-900/50" textColor="text-blue-700 dark:text-blue-300">R: 30%</Badge>
                    <Badge color="bg-purple-100 dark:bg-purple-900/50" textColor="text-purple-700 dark:text-purple-300">SR: 15%</Badge>
                    <Badge color="bg-amber-100 dark:bg-amber-900/50" textColor="text-amber-700 dark:text-amber-300">SSR: 1%</Badge>
                    <Badge
                        color="bg-gradient-to-r from-pink-100 to-cyan-100 dark:from-pink-900/30 dark:to-cyan-900/30"
                        textColor="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-cyan-600 dark:from-pink-400 dark:to-cyan-400 font-extrabold"
                    >
                        UR: 1%
                    </Badge>
                </div>

                {/* ガチャボタン */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {/* 1回ガチャ */}
                    <GachaButton
                        title={t("gacha_1pull")}
                        cost={SINGLE_COST}
                        imageSrc="/assets/ui/gacha_1pull.png"
                        colors="from-slate-700 to-slate-800 border-slate-500 hover:border-green-400"
                        disabled={coins < SINGLE_COST || isRolling}
                        onClick={() => onRoll(1)}
                    />

                    {/* 10連ガチャ */}
                    <GachaButton
                        title={t("gacha_10pull")}
                        cost={MULTI_COST}
                        imageSrc="/assets/ui/gacha_10pull.png"
                        colors="from-purple-700 to-purple-900 border-purple-400 hover:border-pink-400"
                        disabled={coins < MULTI_COST || isRolling}
                        onClick={() => onRoll(10)}
                        recommended
                    />

                    {/* 100連ガチャ */}
                    <GachaButton
                        title={t("gacha_100pull")}
                        cost={SUPER_MULTI_COST}
                        imageSrc="/assets/ui/gacha_100pull.png"
                        colors="from-amber-600 via-orange-700 to-red-800 border-yellow-400 hover:border-yellow-200"
                        disabled={coins < SUPER_MULTI_COST || isRolling}
                        onClick={() => onRoll(100)}
                        special
                    />
                </div>
            </div>
        </div>
    );
}

function Badge({ children, color, textColor }: { children: React.ReactNode, color: string, textColor: string }) {
    return (
        <span className={`px-3 py-1.5 rounded-full text-sm font-bold shadow-sm ${color} ${textColor}`}>
            {children}
        </span>
    );
}

interface GachaButtonProps {
    title: string;
    cost: number;
    imageSrc: string;
    colors: string;
    disabled: boolean;
    onClick: () => void;
    recommended?: boolean;
    special?: boolean;
}

function GachaButton({ title, cost, imageSrc, colors, disabled, onClick, recommended, special }: GachaButtonProps) {
    return (
        <button
            className={`
        group relative flex flex-col items-center p-6 rounded-2xl 
        bg-gradient-to-b ${colors} border-4 shadow-xl 
        transition-all duration-300 transform
        ${disabled
                    ? "opacity-50 cursor-not-allowed grayscale"
                    : "hover:scale-105 hover:shadow-2xl active:scale-95"
                }
        ${special && !disabled ? "animate-pulse hover:animate-none ring-4 ring-yellow-400/30" : ""}
      `}
            onClick={onClick}
            disabled={disabled}
        >
            {recommended && !disabled && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-10 animate-bounce">
                    RECOMMENDED
                </div>
            )}

            <div className="relative mb-4 w-24 h-24 transition-transform group-hover:-translate-y-2 duration-300">
                <Image
                    src={imageSrc}
                    alt={title}
                    fill
                    className="object-contain drop-shadow-lg"
                    loading="lazy"
                />
            </div>

            <div className="text-white font-bold text-xl mb-1 drop-shadow-md">{title}</div>
            <div className={`font-bold text-lg flex items-center gap-1 ${special ? "text-yellow-200" : "text-green-300"}`}>
                <span>💰</span>
                <span>{cost.toLocaleString()}</span>
            </div>

            {!disabled && (
                <div className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
            )}
        </button>
    );
}
