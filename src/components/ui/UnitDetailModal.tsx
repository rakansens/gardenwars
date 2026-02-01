"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { UnitDefinition, Rarity, UnitRole } from "@/data/types";
import RarityFrame from "./RarityFrame";
import { useLanguage } from "@/contexts/LanguageContext";
import UnitAnimationPreview, { hasAnimation } from "./UnitAnimationPreview";

// ロール別のアイコンと色
const roleConfig: Record<UnitRole, { icon: string; color: string; bgColor: string }> = {
    tank: { icon: "🛡️", color: "text-slate-600", bgColor: "from-slate-50 to-slate-100 border-slate-200" },
    attacker: { icon: "⚔️", color: "text-red-600", bgColor: "from-red-50 to-red-100 border-red-200" },
    ranger: { icon: "🏹", color: "text-green-600", bgColor: "from-green-50 to-green-100 border-green-200" },
    speedster: { icon: "💨", color: "text-cyan-600", bgColor: "from-cyan-50 to-cyan-100 border-cyan-200" },
    flying: { icon: "🪽", color: "text-sky-600", bgColor: "from-sky-50 to-sky-100 border-sky-200" },
    balanced: { icon: "⚖️", color: "text-gray-600", bgColor: "from-gray-50 to-gray-100 border-gray-200" },
};

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

// レアリティ別のグラデーション色
const rarityGradients: Record<Rarity, string> = {
    UR: "from-pink-400 via-purple-500 to-cyan-500",
    SSR: "from-amber-400 to-orange-500",
    SR: "from-purple-400 to-indigo-500",
    R: "from-blue-400 to-cyan-500",
    N: "from-gray-400 to-slate-500",
};

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 overflow-y-auto transition-opacity animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl transform transition-transform animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className={`relative h-16 bg-gradient-to-r ${rarityGradients[unit.rarity]} flex items-center justify-between px-6`}>
                    <div className="flex items-center gap-3">
                        <span className={`
                            text-sm font-bold px-3 py-1 rounded-lg shadow-md
                            ${unit.rarity === 'UR' ? 'bg-white/30 text-white' : 'bg-white/90 text-gray-800'}
                        `}>
                            {unit.rarity}
                        </span>
                        <h2 className="text-2xl font-bold text-white drop-shadow-md">{unitName}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {unitHasAnimation && (
                            <div className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                🎬
                            </div>
                        )}
                        {unit.role && (
                            <div className="bg-white/30 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                                {roleConfig[unit.role].icon}
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors ml-2"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content - Horizontal Layout */}
                <div className="flex flex-col md:flex-row">
                    {/* Left: Large Image */}
                    <div className={`
                        flex-shrink-0 w-full md:w-72 p-6 flex flex-col items-center justify-center
                        bg-gradient-to-br ${unit.rarity === 'UR' ? 'from-pink-50 via-purple-50 to-cyan-50' :
                            unit.rarity === 'SSR' ? 'from-amber-50 to-orange-50' :
                            unit.rarity === 'SR' ? 'from-purple-50 to-indigo-50' :
                            unit.rarity === 'R' ? 'from-blue-50 to-cyan-50' : 'from-gray-50 to-slate-50'}
                    `}>
                        {unitHasAnimation ? (
                            <div className="relative">
                                <div
                                    className={`
                                        w-[200px] h-[200px] rounded-2xl flex items-center justify-center relative overflow-hidden
                                        ${unit.rarity === 'SSR' ? 'bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-400 shadow-lg shadow-amber-200/50' : ''}
                                        ${unit.rarity === 'SR' ? 'bg-gradient-to-br from-purple-200 via-purple-300 to-purple-400 shadow-lg shadow-purple-200/50' : ''}
                                        ${unit.rarity === 'R' ? 'bg-gradient-to-br from-blue-200 via-blue-300 to-blue-400 shadow-lg shadow-blue-200/50' : ''}
                                        ${unit.rarity === 'N' ? 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400' : ''}
                                        ${unit.rarity === 'UR' ? 'bg-gradient-to-br from-pink-300 via-purple-400 to-cyan-400 shadow-lg shadow-purple-300/50' : ''}
                                    `}
                                    style={{
                                        border: unit.rarity === 'UR' ? '4px solid transparent' : unit.rarity === 'SSR' ? '4px solid #d4a018' : unit.rarity === 'SR' ? '4px solid #9333ea' : unit.rarity === 'R' ? '4px solid #3b82f6' : '4px solid #9ca3af',
                                        backgroundClip: 'padding-box',
                                    }}
                                >
                                    <UnitAnimationPreview
                                        unitId={unit.atlasKey || unit.id}
                                        width={180}
                                        height={180}
                                        compact={true}
                                        defaultAnimation="attack"
                                        transparentBackground={true}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="transform scale-150">
                                <RarityFrame
                                    unitId={unit.id}
                                    unitName={unitName}
                                    rarity={unit.rarity}
                                    size="xl"
                                    showLabel={false}
                                    baseUnitId={unit.baseUnitId}
                                />
                            </div>
                        )}

                        {/* Tabs under image - Only show if unit has animation */}
                        {unitHasAnimation && (
                            <div className="flex gap-2 mt-4 w-full max-w-[200px]">
                                <button
                                    onClick={() => setActiveTab("stats")}
                                    className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${activeTab === "stats"
                                        ? "bg-amber-500 text-white shadow-md"
                                        : "bg-white text-gray-600 hover:bg-gray-100"
                                        }`}
                                >
                                    📊 Stats
                                </button>
                                <button
                                    onClick={() => setActiveTab("animation")}
                                    className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${activeTab === "animation"
                                        ? "bg-purple-500 text-white shadow-md"
                                        : "bg-white text-gray-600 hover:bg-gray-100"
                                        }`}
                                >
                                    🎬 Anim
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Stats */}
                    <div className="flex-1 p-4 md:p-6 bg-gray-50 flex flex-col">
                        {activeTab === "stats" ? (
                            <>
                                <div className="grid grid-cols-2 gap-2 flex-1">
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">{t("hp")}</div>
                                        <div className="text-base font-bold text-gray-800">❤️ {unit.maxHp.toLocaleString()}</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">{t("attack")}</div>
                                        <div className="text-base font-bold text-gray-800">⚔️ {unit.attackDamage}</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">DPS</div>
                                        <div className="text-base font-bold text-red-500">💥 {(unit.attackDamage * (1000 / unit.attackCooldownMs)).toFixed(1)}</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">{t("range")}</div>
                                        <div className="text-base font-bold text-indigo-600">📏 {unit.attackRange}</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">{t("attack_speed")}</div>
                                        <div className="text-base font-bold text-orange-500">⏱️ {(1000 / unit.attackCooldownMs).toFixed(1)}/s</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">{t("move_speed")}</div>
                                        <div className="text-base font-bold text-blue-500">🏃 {unit.speed}</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">{t("cost")}</div>
                                        <div className="text-base font-bold text-amber-600">💰 ¥{unit.cost}</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">{t("spawn_cooldown")}</div>
                                        <div className="text-base font-bold text-purple-500">⏰ {(getSpawnCooldown(unit) / 1000).toFixed(1)}s</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                        <div className="text-[10px] text-gray-500 mb-0.5">{t("size")}</div>
                                        <div className="text-base font-bold text-emerald-600">
                                            {getSizeCategory(unit.scale ?? 1).emoji} {t(getSizeCategory(unit.scale ?? 1).key)}
                                        </div>
                                    </div>
                                    {unit.role && (
                                        <div className={`bg-gradient-to-br ${roleConfig[unit.role].bgColor} rounded-lg p-2.5 border shadow-sm`}>
                                            <div className={`text-[10px] ${roleConfig[unit.role].color} mb-0.5`}>{t("role")}</div>
                                            <div className={`text-base font-bold ${roleConfig[unit.role].color}`}>
                                                {roleConfig[unit.role].icon} {t(`role_${unit.role}`)}
                                            </div>
                                        </div>
                                    )}
                                    {unit.attackType === 'area' && (
                                        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-2.5 border border-orange-200 shadow-sm">
                                            <div className="text-[10px] text-orange-600 mb-0.5">{t("attack_type")}</div>
                                            <div className="text-base font-bold text-orange-500">
                                                💥 {t("attack_type_area")} ({unit.areaRadius}px)
                                            </div>
                                        </div>
                                    )}
                                    {dropRate !== undefined ? (
                                        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg p-2.5 border border-pink-200 shadow-sm">
                                            <div className="text-[10px] text-pink-600 mb-0.5">{t("drop_rate")}</div>
                                            <div className={`text-base font-bold ${
                                                dropRate < 0.1 ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" :
                                                dropRate < 0.3 ? "text-pink-500" :
                                                "text-purple-500"
                                            }`}>
                                                🎰 {dropRate < 0.1 ? dropRate.toFixed(3) : dropRate.toFixed(2)}%
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                                            <div className="text-[10px] text-gray-500 mb-0.5">Knockback</div>
                                            <div className="text-base font-bold text-gray-600">💨 {unit.knockback}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Button */}
                                <div className="mt-4">
                                    {isOwned ? (
                                        <button
                                            onClick={() => {
                                                onToggleTeam();
                                                onClose();
                                            }}
                                            className={`w-full py-3 rounded-xl font-bold text-base shadow-md transition-all active:scale-95 ${isInTeam
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
                            </>
                        ) : (
                            /* Animation Tab */
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <UnitAnimationPreview
                                    unitId={unit.atlasKey || unit.id}
                                    width={250}
                                    height={250}
                                    defaultAnimation="attack"
                                />
                                {/* Action Button */}
                                <div className="mt-4 w-full">
                                    {isOwned ? (
                                        <button
                                            onClick={() => {
                                                onToggleTeam();
                                                onClose();
                                            }}
                                            className={`w-full py-3 rounded-xl font-bold text-base shadow-md transition-all active:scale-95 ${isInTeam
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
