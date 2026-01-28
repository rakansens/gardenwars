"use client";

import Image from "next/image";
import type { Rarity } from "@/data/types";

interface RarityFrameProps {
    unitId: string;
    unitName: string;
    rarity: Rarity;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
    count?: number;
}

// レアリティごとのスタイル定義
const rarityStyles: Record<Rarity, {
    border: string;
    bg: string;
    glow: string;
    label: string;
    labelBg: string;
    stars: string;
}> = {
    N: {
        border: "border-gray-400",
        bg: "bg-gradient-to-b from-gray-100 to-gray-200",
        glow: "",
        label: "N",
        labelBg: "bg-gray-500",
        stars: "⭐",
    },
    R: {
        border: "border-blue-400",
        bg: "bg-gradient-to-b from-blue-100 to-blue-200",
        glow: "shadow-lg shadow-blue-300/50",
        label: "R",
        labelBg: "bg-blue-500",
        stars: "⭐⭐",
    },
    SR: {
        border: "border-purple-400",
        bg: "bg-gradient-to-b from-purple-100 to-purple-200",
        glow: "shadow-lg shadow-purple-400/60",
        label: "SR",
        labelBg: "bg-purple-500",
        stars: "⭐⭐⭐",
    },
    SSR: {
        border: "border-amber-400",
        bg: "bg-gradient-to-b from-amber-100 via-yellow-100 to-orange-200",
        glow: "shadow-xl shadow-amber-400/70 animate-pulse",
        label: "SSR",
        labelBg: "bg-gradient-to-r from-amber-500 to-orange-500",
        stars: "🌟🌟🌟",
    },
};

const sizeClasses = {
    sm: {
        frame: "w-14 h-14",
        image: 40,
        labelText: "text-[8px]",
        countBadge: "w-5 h-5 text-[10px]",
    },
    md: {
        frame: "w-20 h-20",
        image: 56,
        labelText: "text-[10px]",
        countBadge: "w-6 h-6 text-xs",
    },
    lg: {
        frame: "w-24 h-24",
        image: 72,
        labelText: "text-xs",
        countBadge: "w-7 h-7 text-xs",
    },
};

export default function RarityFrame({
    unitId,
    unitName,
    rarity,
    size = "md",
    showLabel = true,
    count,
}: RarityFrameProps) {
    const style = rarityStyles[rarity];
    const sizeClass = sizeClasses[size];

    return (
        <div className="relative">
            {/* フレーム */}
            <div
                className={`
                    ${sizeClass.frame}
                    ${style.bg}
                    ${style.glow}
                    border-3 ${style.border}
                    rounded-xl
                    flex items-center justify-center
                    overflow-hidden
                    relative
                `}
            >
                {/* キャラ画像 */}
                <Image
                    src={`/assets/sprites/${unitId}.png`}
                    alt={unitName}
                    width={sizeClass.image}
                    height={sizeClass.image}
                    className="object-contain"
                />

                {/* レアリティラベル */}
                {showLabel && (
                    <div
                        className={`
                            absolute top-0 left-0
                            ${style.labelBg}
                            text-white font-bold
                            ${sizeClass.labelText}
                            px-1 py-0.5
                            rounded-br-lg
                        `}
                    >
                        {style.label}
                    </div>
                )}
            </div>

            {/* 所持個数バッジ */}
            {count !== undefined && (
                <div
                    className={`
                        absolute -top-1 -right-1
                        ${sizeClass.countBadge}
                        rounded-full
                        bg-amber-500 text-white
                        font-bold
                        flex items-center justify-center
                        border-2 border-white
                        shadow
                    `}
                >
                    {count}
                </div>
            )}
        </div>
    );
}

// ヘルパー関数をエクスポート
export function getRarityStars(rarity: Rarity): string {
    return rarityStyles[rarity].stars;
}

export function getRarityLabel(rarity: Rarity): string {
    return rarityStyles[rarity].label;
}

export function getRarityGradientClass(rarity: Rarity): string {
    switch (rarity) {
        case "SSR":
            return "from-amber-400 via-yellow-300 to-orange-400";
        case "SR":
            return "from-purple-400 to-pink-400";
        case "R":
            return "from-blue-400 to-cyan-400";
        default:
            return "from-gray-300 to-gray-400";
    }
}
