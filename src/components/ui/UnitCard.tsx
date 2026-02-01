"use client";

import { memo } from "react";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "./RarityFrame";

// レアリティ別のカード背景色
const rarityCardColors: Record<Rarity, string> = {
    UR: "from-purple-600/60 to-pink-600/60 border-pink-400/50",
    SSR: "from-amber-500/60 to-orange-600/60 border-amber-400/50",
    SR: "from-purple-500/60 to-indigo-600/60 border-purple-400/50",
    R: "from-blue-400/60 to-cyan-500/60 border-blue-400/50",
    N: "from-gray-400/60 to-slate-500/60 border-gray-400/50",
};

interface UnitCardProps {
    unit: UnitDefinition;
    onClick?: () => void;
    // 表示バリアント
    variant?: "carousel" | "grid" | "compact";
    // バッジ表示
    badge?: {
        type: "new" | "rate" | "count" | "custom";
        value?: string | number;
        position?: "top-left" | "top-right";
    };
    // 所持状態
    isOwned?: boolean;
    ownedCount?: number;
    // 追加表示
    showStats?: boolean;
    grayscale?: boolean;
}

/**
 * 共通ユニットカードコンポーネント（React.memoで最適化）
 *
 * 使用例:
 * - ガチャURカルーセル: variant="carousel" badge={{ type: "rate", value: "0.02%" }} showStats
 * - NEWセクション: variant="carousel" badge={{ type: "new" }} showStats
 * - グリッド表示: variant="grid" ownedCount={3}
 * - コンパクト表示: variant="compact"
 */
const UnitCard = memo(function UnitCard({
    unit,
    onClick,
    variant = "grid",
    badge,
    isOwned = true,
    ownedCount,
    showStats = false,
    grayscale = false,
}: UnitCardProps) {
    const isCarousel = variant === "carousel";
    const isCompact = variant === "compact";

    // バッジの位置とスタイル
    const getBadgeStyle = () => {
        if (!badge) return null;

        const position = badge.position === "top-left" ? "-top-2 -left-2" : "-top-2 -right-2";

        switch (badge.type) {
            case "new":
                return (
                    <div className={`absolute ${position} px-2 py-1 rounded-full text-xs font-bold z-10 bg-green-500 text-white animate-pulse shadow-lg`}>
                        NEW
                    </div>
                );
            case "rate":
                const rate = typeof badge.value === "number" ? badge.value : parseFloat(badge.value || "0");
                const isUltraRare = rate < 0.05;
                return (
                    <div className={`absolute ${position} px-2 py-1 rounded-full text-xs font-bold z-10 shadow-lg ${isUltraRare ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white animate-pulse" : "bg-purple-500 text-white"}`}>
                        {typeof badge.value === "number" ? `${badge.value.toFixed(2)}%` : badge.value}
                    </div>
                );
            case "count":
                return (
                    <div className={`absolute ${position} w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center z-10 shadow-lg`}>
                        {badge.value}
                    </div>
                );
            case "custom":
                return (
                    <div className={`absolute ${position} px-2 py-1 rounded-full text-xs font-bold z-10 bg-gray-700 text-white shadow-lg`}>
                        {badge.value}
                    </div>
                );
            default:
                return null;
        }
    };

    // カルーセル（大きめカード）
    if (isCarousel) {
        return (
            <div
                className={`
                    relative flex-shrink-0 w-36 p-3 rounded-2xl cursor-pointer transition-all
                    bg-gradient-to-br ${rarityCardColors[unit.rarity]}
                    border-2 hover:shadow-xl hover:scale-105
                    ${isOwned ? "ring-2 ring-green-400/50" : "opacity-80"}
                `}
                onClick={onClick}
            >
                {/* メインバッジ（右上） */}
                {badge && getBadgeStyle()}

                {/* 所持チェック（左上） */}
                {isOwned && !badge?.position?.includes("left") && (
                    <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center z-10 shadow-lg">
                        {ownedCount !== undefined ? ownedCount : "✓"}
                    </div>
                )}

                {/* 飛行バッジ */}
                {unit.isFlying && (
                    <div className="absolute top-8 -left-2 w-6 h-6 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center z-10 shadow-lg">
                        🪽
                    </div>
                )}

                <div className="flex justify-center mb-2">
                    <RarityFrame
                        unitId={unit.id}
                        unitName={unit.name}
                        rarity={unit.rarity}
                        size="lg"
                        showLabel={false}
                        baseUnitId={unit.baseUnitId}
                        grayscale={grayscale || !isOwned}
                    />
                </div>
                <div className="text-sm text-center text-white font-bold truncate drop-shadow-md">
                    {unit.name}
                </div>

                {/* ステータス表示 */}
                {showStats && (
                    <div className="mt-2 text-[10px] text-white/70 text-center space-y-0.5">
                        <div>HP: {unit.maxHp.toLocaleString()}</div>
                        <div>ATK: {unit.attackDamage}</div>
                    </div>
                )}
            </div>
        );
    }

    // コンパクト（小さいアイコン）
    if (isCompact) {
        return (
            <div
                className={`relative cursor-pointer transition-transform hover:scale-110 ${grayscale || !isOwned ? "opacity-70" : ""}`}
                onClick={onClick}
            >
                {badge && getBadgeStyle()}
                <RarityFrame
                    unitId={unit.id}
                    unitName={unit.name}
                    rarity={unit.rarity}
                    size="sm"
                    showLabel={false}
                    baseUnitId={unit.baseUnitId}
                    grayscale={grayscale || !isOwned}
                />
            </div>
        );
    }

    // グリッド（デフォルト）
    return (
        <div
            className={`
                relative p-2 rounded-lg cursor-pointer transition-all
                hover:bg-gray-100 dark:hover:bg-gray-800
                ${!isOwned ? "opacity-70" : ""}
            `}
            onClick={onClick}
        >
            {/* バッジ */}
            {badge && getBadgeStyle()}

            {/* 所持数バッジ */}
            {ownedCount !== undefined && ownedCount > 0 && (
                <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center z-10">
                    {ownedCount}
                </div>
            )}

            <div className="flex justify-center">
                <RarityFrame
                    unitId={unit.id}
                    unitName={unit.name}
                    rarity={unit.rarity}
                    size="md"
                    showLabel={true}
                    baseUnitId={unit.baseUnitId}
                    grayscale={grayscale || !isOwned}
                />
            </div>
            <div className={`text-xs text-center truncate mt-1 ${isOwned ? "text-gray-900 dark:text-gray-200" : "text-gray-500"}`}>
                {unit.name}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // カスタム比較関数: 重要なプロパティのみ比較して不要な再レンダリングを防止
    return prevProps.unit.id === nextProps.unit.id
        && prevProps.isOwned === nextProps.isOwned
        && prevProps.ownedCount === nextProps.ownedCount
        && prevProps.variant === nextProps.variant
        && prevProps.grayscale === nextProps.grayscale
        && prevProps.badge?.type === nextProps.badge?.type
        && prevProps.badge?.value === nextProps.badge?.value;
});

export default UnitCard;
