"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "./RarityFrame";
import { useLanguage } from "@/contexts/LanguageContext";
import UnitAnimationPreview, { hasAnimation } from "./UnitAnimationPreview";

// レアリティ別デフォルト召喚クールダウン
const DEFAULT_SPAWN_COOLDOWN: Record<Rarity, number> = {
    N: 2000,
    R: 4000,
    SR: 8000,
    SSR: 12000,
    UR: 15000,
};

function getSpawnCooldown(unit: UnitDefinition): number {
    return unit.spawnCooldownMs ?? DEFAULT_SPAWN_COOLDOWN[unit.rarity];
}

// サイズカテゴリを取得
function getSizeCategory(scale: number): { key: string; emoji: string } {
    if (scale <= 0.85) return { key: "size_tiny", emoji: "🐜" };
    if (scale <= 1.1) return { key: "size_small", emoji: "🐱" };
    if (scale <= 1.4) return { key: "size_medium", emoji: "🐕" };
    if (scale <= 1.8) return { key: "size_large", emoji: "🦁" };
    if (scale <= 2.5) return { key: "size_huge", emoji: "🐘" };
    return { key: "size_giant", emoji: "🦕" };
}

interface UnitDetailModalProps {
    unit: UnitDefinition;
    isOwned: boolean;
    isInTeam: boolean;
    onClose: () => void;
    onToggleTeam: () => void;
    dropRate?: number; // ガチャ排出率（%）
}

export default function UnitDetailModal({
    unit,
    isOwned,
    isInTeam,
    onClose,
    onToggleTeam,
    dropRate,
}: UnitDetailModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();
    const unitHasAnimation = hasAnimation(unit.atlasKey || unit.id);
    const [activeTab, setActiveTab] = useState<"stats" | "animation">("stats");

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    // Prevent scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, []);

    const imageId = unit.atlasKey || unit.baseUnitId || unit.id;
    const translatedName = t(unit.id);
    const unitName = translatedName !== unit.id ? translatedName : unit.name;

    return (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/70 p-2 sm:p-4 overflow-y-auto transition-opacity animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform transition-transform animate-in zoom-in-95 duration-200 my-auto sm:my-4"
            >
                {/* Header / Background */}
                <div className="relative h-32 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <div className="absolute top-4 right-4">
                        <button
                            onClick={onClose}
                            className="bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    {/* Badges in header */}
                    <div className="absolute top-4 left-4 flex gap-2">
                        {unitHasAnimation && (
                            <div className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                🎬 Animated
                            </div>
                        )}
                        {unit.isFlying && (
                            <div className="bg-sky-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                🪽 {t("flying")}
                            </div>
                        )}
                    </div>
                    <h2 className="text-3xl font-bold text-white drop-shadow-md mt-4">{unitName}</h2>
                </div>

                {/* Content */}
                <div className="px-6 py-4 -mt-12 flex flex-col items-center">
                    {/* Character Large Image - アニメーション対応キャラはPhaserで表示 */}
                    <div className="relative mb-4">
                        {unitHasAnimation ? (
                            <div className="relative">
                                {/* レアリティフレーム（背景として） */}
                                <div
                                    className={`
                                        w-[150px] h-[150px] rounded-2xl flex items-center justify-center relative overflow-hidden
                                        ${unit.rarity === 'SSR' ? 'bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-400 shadow-lg shadow-amber-200/50' : ''}
                                        ${unit.rarity === 'SR' ? 'bg-gradient-to-br from-purple-200 via-purple-300 to-purple-400 shadow-lg shadow-purple-200/50' : ''}
                                        ${unit.rarity === 'R' ? 'bg-gradient-to-br from-blue-200 via-blue-300 to-blue-400 shadow-lg shadow-blue-200/50' : ''}
                                        ${unit.rarity === 'N' ? 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400' : ''}
                                        ${unit.rarity === 'UR' ? 'bg-gradient-to-br from-pink-300 via-purple-400 to-cyan-400 shadow-lg shadow-purple-300/50' : ''}
                                    `}
                                    style={{
                                        border: unit.rarity === 'UR' ? '3px solid transparent' : unit.rarity === 'SSR' ? '3px solid #d4a018' : unit.rarity === 'SR' ? '3px solid #9333ea' : unit.rarity === 'R' ? '3px solid #3b82f6' : '3px solid #9ca3af',
                                        backgroundClip: 'padding-box',
                                    }}
                                >
                                    {/* レアリティラベル */}
                                    <span
                                        className={`
                                            absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-md z-10
                                            ${unit.rarity === 'UR' ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white' : ''}
                                            ${unit.rarity === 'SSR' ? 'bg-amber-500 text-white' : ''}
                                            ${unit.rarity === 'SR' ? 'bg-purple-500 text-white' : ''}
                                            ${unit.rarity === 'R' ? 'bg-blue-500 text-white' : ''}
                                            ${unit.rarity === 'N' ? 'bg-gray-500 text-white' : ''}
                                        `}
                                    >
                                        {unit.rarity}
                                    </span>
                                    {/* アニメーションプレビュー */}
                                    <UnitAnimationPreview
                                        unitId={unit.atlasKey || unit.id}
                                        width={140}
                                        height={140}
                                        compact={true}
                                        defaultAnimation="attack"
                                        transparentBackground={true}
                                    />
                                </div>
                            </div>
                        ) : (
                            <RarityFrame
                                unitId={unit.id}
                                unitName={unitName}
                                rarity={unit.rarity}
                                size="xl"
                                showLabel={true}
                                baseUnitId={unit.baseUnitId}
                            />
                        )}
                    </div>

                    {/* Tabs - Only show if unit has animation */}
                    {unitHasAnimation && (
                        <div className="flex gap-2 mb-4 w-full">
                            <button
                                onClick={() => setActiveTab("stats")}
                                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === "stats"
                                    ? "bg-amber-500 text-white shadow-md"
                                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }`}
                            >
                                📊 Stats
                            </button>
                            <button
                                onClick={() => setActiveTab("animation")}
                                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === "animation"
                                    ? "bg-purple-500 text-white shadow-md"
                                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }`}
                            >
                                🎬 Animation
                            </button>
                        </div>
                    )}

                    {/* Stats Tab */}
                    {activeTab === "stats" && (
                        <div className="grid grid-cols-2 gap-3 w-full mb-6">
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">{t("hp")}</div>
                                <div className="text-lg font-bold text-gray-800">❤️ {unit.maxHp}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">{t("attack")}</div>
                                <div className="text-lg font-bold text-gray-800">⚔️ {unit.attackDamage}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">DPS</div>
                                <div className="text-lg font-bold text-red-500">💥 {(unit.attackDamage * (1000 / unit.attackCooldownMs)).toFixed(1)}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">{t("range")}</div>
                                <div className="text-lg font-bold text-indigo-600">📏 {unit.attackRange}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">{t("attack_speed")}</div>
                                <div className="text-lg font-bold text-orange-500">⏱️ {(1000 / unit.attackCooldownMs).toFixed(1)}/s</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">{t("move_speed")}</div>
                                <div className="text-lg font-bold text-blue-500">🏃 {unit.speed}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">{t("cost")}</div>
                                <div className="text-lg font-bold text-amber-600">💰 ¥{unit.cost}</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">{t("spawn_cooldown")}</div>
                                <div className="text-lg font-bold text-purple-500">⏰ {(getSpawnCooldown(unit) / 1000).toFixed(1)}s</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">{t("size")}</div>
                                <div className="text-lg font-bold text-emerald-600">
                                    {getSizeCategory(unit.scale ?? 1).emoji} {t(getSizeCategory(unit.scale ?? 1).key)}
                                </div>
                            </div>
                            {unit.isFlying && (
                                <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-lg p-3 border border-sky-200">
                                    <div className="text-xs text-sky-600 mb-1">{t("flying")}</div>
                                    <div className="text-lg font-bold text-sky-500">🪽 Yes</div>
                                </div>
                            )}
                            {dropRate !== undefined && (
                                <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg p-3 border border-pink-200">
                                    <div className="text-xs text-pink-600 mb-1">{t("drop_rate")}</div>
                                    <div className={`text-lg font-bold ${
                                        dropRate < 0.1 ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" :
                                        dropRate < 0.3 ? "text-pink-500" :
                                        "text-purple-500"
                                    }`}>
                                        🎰 {dropRate < 0.1 ? dropRate.toFixed(3) : dropRate.toFixed(2)}%
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Animation Tab */}
                    {activeTab === "animation" && unitHasAnimation && (
                        <div className="w-full mb-6 flex flex-col items-center">
                            <UnitAnimationPreview
                                unitId={unit.atlasKey || unit.id}
                                width={220}
                                height={220}
                                defaultAnimation="attack"
                            />
                        </div>
                    )}

                    {/* Action Button */}
                    <div className="w-full">
                        {isOwned ? (
                            <button
                                onClick={() => {
                                    onToggleTeam();
                                    onClose();
                                }}
                                className={`w-full py-3 rounded-xl font-bold text-lg shadow-md transition-all active:scale-95 ${isInTeam
                                    ? "bg-red-500 hover:bg-red-600 text-white border-b-4 border-red-700"
                                    : "bg-green-500 hover:bg-green-600 text-white border-b-4 border-green-700"
                                    }`}
                            >
                                {isInTeam ? t("remove_from_team") : t("add_to_team")}
                            </button>
                        ) : (
                            <div className="w-full py-3 bg-gray-200 text-gray-500 font-bold text-center rounded-xl">
                                {t("not_owned")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
