"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import type { UnitDefinition, Rarity, UnitRole } from "@/data/types";
import RarityFrame from "./RarityFrame";
import { useLanguage } from "@/contexts/LanguageContext";
import UnitAnimationPreview, { hasAnimation } from "./UnitAnimationPreview";
import { pushModal, popModal } from "@/lib/modalStack";

// --- Configuration ---

const roleConfig: Record<UnitRole, { icon: string; nameKey: string; color: string; bgColor: string; borderColor: string }> = {
    tank: { icon: "🛡️", nameKey: "role_tank", color: "text-slate-600 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-800", borderColor: "border-slate-200 dark:border-slate-700" },
    attacker: { icon: "⚔️", nameKey: "role_attacker", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-900/30", borderColor: "border-red-200 dark:border-red-800/50" },
    ranger: { icon: "🏹", nameKey: "role_ranger", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-900/30", borderColor: "border-green-200 dark:border-green-800/50" },
    speedster: { icon: "💨", nameKey: "role_speedster", color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-900/30", borderColor: "border-cyan-200 dark:border-cyan-800/50" },
    flying: { icon: "🪽", nameKey: "role_flying", color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-50 dark:bg-sky-900/30", borderColor: "border-sky-200 dark:border-sky-800/50" },
    balanced: { icon: "⚖️", nameKey: "role_balanced", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-50 dark:bg-gray-800", borderColor: "border-gray-200 dark:border-gray-700" },
};

const DEFAULT_SPAWN_COOLDOWN: Record<Rarity, number> = { N: 2000, R: 4000, SR: 8000, SSR: 12000, UR: 15000 };

function getSpawnCooldown(unit: UnitDefinition): number {
    return unit.spawnCooldownMs ?? DEFAULT_SPAWN_COOLDOWN[unit.rarity];
}

const rarityGradients: Record<Rarity, string> = {
    UR: "from-pink-500 via-purple-600 to-cyan-600",
    SSR: "from-amber-400 to-orange-500",
    SR: "from-purple-500 to-indigo-600",
    R: "from-blue-400 to-cyan-500",
    N: "from-slate-400 to-gray-500",
};

interface UnitDetailModalProps {
    unit: UnitDefinition;
    isOwned?: boolean; // Optional, default true if not provided (e.g. gacha preview)
    isInTeam?: boolean;
    onClose: () => void;
    onToggleTeam?: () => void;
    showTeamAction?: boolean;
    dropRate?: number;
}

export default function UnitDetailModal({
    unit,
    isOwned = true,
    isInTeam = false,
    onClose,
    onToggleTeam,
    showTeamAction = true,
    dropRate,
}: UnitDetailModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const { t, language } = useLanguage();
    const unitHasAnimation = hasAnimation(unit.atlasKey || unit.id);
    const [activeTab, setActiveTab] = useState<"info" | "skills" | "lore">("info");

    // --- Hooks ---
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key === "Escape") onClose();
    }, [onClose]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, handleKeyDown]);

    useEffect(() => {
        pushModal();
        return () => popModal();
    }, []);

    // --- Helpers ---
    const translatedName = t(unit.id);
    const unitName = translatedName !== unit.id ? translatedName : unit.name;
    const role = unit.role ? roleConfig[unit.role] : roleConfig.balanced;

    // DPS Calc
    const dps = unit.attackDamage * (1000 / unit.attackCooldownMs);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
            {/* Backdrop with Blur */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

            {/* Modal Container */}
            <div
                ref={modalRef}
                className="relative w-full max-w-4xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-200 border border-white/20 dark:border-slate-700/50"
            >
                {/* Header (Rarity Gradient) */}
                <div className={`relative h-24 sm:h-32 bg-gradient-to-br ${rarityGradients[unit.rarity]} flex items-center justify-between px-6 overflow-hidden`}>
                    {/* Decorative Patterns */}
                    <div className="absolute inset-0 opacity-10 bg-[url('/patterns/noise.png')] mix-blend-overlay" />
                    <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/10 to-transparent" />

                    <div className="relative z-10 flex items-center gap-4 text-white">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold opacity-90 tracking-wider flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded backdrop-blur-md bg-white/20 border border-white/30 text-xs shadow-sm`}>
                                    {unit.rarity}
                                </span>
                                {role && <span className="opacity-80 flex items-center gap-1"><span className="text-xs">{role.icon}</span> {t(role.nameKey)}</span>}
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-bold drop-shadow-md mt-1">{unitName}</h2>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="relative z-10 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95"
                    >
                        ✕
                    </button>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    <div className="flex flex-col md:flex-row h-full">

                        {/* Visual Column (Left) */}
                        <div className="w-full md:w-1/3 min-h-[300px] bg-slate-50/50 dark:bg-black/20 md:border-r border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center relative p-6">
                            {/* Backdrop Glow */}
                            <div className={`absolute w-40 h-40 rounded-full blur-3xl opacity-30 bg-gradient-to-r ${rarityGradients[unit.rarity]}`} />

                            <div className="relative z-10 transform hover:scale-105 transition-transform duration-500">
                                {unitHasAnimation ? (
                                    <UnitAnimationPreview
                                        unitId={unit.atlasKey || unit.id}
                                        width={240}
                                        height={240}
                                        defaultAnimation="attack"
                                        transparentBackground={true}
                                    />
                                ) : (
                                    <div className="scale-125">
                                        <RarityFrame unitId={unit.id} unitName={unitName} rarity={unit.rarity} size="xl" showLabel={false} baseUnitId={unit.baseUnitId} />
                                    </div>
                                )}
                            </div>

                            {/* Type/Range Tags */}
                            <div className="mt-8 flex gap-2 justify-center flex-wrap">
                                {unit.attackType === 'area' && (
                                    <span className="px-3 py-1 bg-orange-100/80 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-full border border-orange-200 dark:border-orange-800/50">
                                        💥 {t("attack_type_area")}
                                    </span>
                                )}
                                <span className="px-3 py-1 bg-indigo-100/80 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-full border border-indigo-200 dark:border-indigo-800/50">
                                    📏 Range: {unit.attackRange}
                                </span>
                            </div>
                        </div>

                        {/* Info Column (Right) */}
                        <div className="flex-1 p-4 md:p-8 flex flex-col gap-6">

                            {/* Key Stats Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <StatItem label={t("hp")} value={unit.maxHp.toLocaleString()} icon="❤️" colorClass="text-pink-500" />
                                <StatItem label={t("attack")} value={unit.attackDamage.toLocaleString()} icon="⚔️" colorClass="text-red-500" />
                                <StatItem label="DPS" value={(dps).toFixed(0)} icon="💥" colorClass="text-orange-500" />
                                <StatItem label={t("cost")} value={unit.cost} icon="💰" colorClass="text-amber-500" prefix="¥" />
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800" />

                            {/* Secondary Stats Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 text-sm">
                                <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-500 dark:text-slate-400 text-xs">{t("attack_speed")}</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{(1000 / unit.attackCooldownMs).toFixed(2)} /s</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-500 dark:text-slate-400 text-xs">{t("spawn_cooldown")}</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{(getSpawnCooldown(unit) / 1000).toFixed(1)}s</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-500 dark:text-slate-400 text-xs">{t("move_speed")}</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{unit.speed}</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-500 dark:text-slate-400 text-xs">{t("size")}</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 transform scale-75 origin-right">
                                        {unit.scale}x
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-500 dark:text-slate-400 text-xs">{t("range")}</span>
                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{unit.attackRange}</span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-500 dark:text-slate-400 text-xs">Knockback</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{unit.knockback}</span>
                                </div>
                                {unit.attackType === 'area' && (
                                    <div className="sm:col-span-3 flex justify-between items-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800/30">
                                        <span className="text-orange-600 dark:text-orange-400 text-xs font-bold">💥 {t("attack_type_area")}</span>
                                        <span className="font-semibold text-orange-600 dark:text-orange-400">Radius: {unit.areaRadius}</span>
                                    </div>
                                )}
                            </div>

                            {/* Skill Card (if exists) */}
                            {unit.skill && (
                                <div className={`
                                    rounded-xl p-4 border relative overflow-hidden flex flex-col gap-2
                                    ${unit.rarity === 'UR' ? 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}
                                `}>
                                    <div className="flex items-start gap-3 relative z-10">
                                        <div className="text-3xl filter drop-shadow-sm">{unit.skill.icon}</div>
                                        <div className="flex-1">
                                            <h4 className={`font-bold text-sm mb-1 ${unit.rarity === 'UR' ? 'text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {language === 'ja' ? unit.skill.nameJa : unit.skill.name}
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                                {language === 'ja' ? unit.skill.descriptionJa : unit.skill.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 flex flex-wrap gap-x-3 gap-y-1 pl-11">
                                        <span>
                                            {unit.skill.trigger === 'on_attack' && `${t("skill_trigger_on_attack")}${unit.skill.triggerChance ? ` (${(unit.skill.triggerChance * 100).toFixed(0)}%)` : ''}`}
                                            {unit.skill.trigger === 'on_spawn' && t("skill_trigger_on_spawn")}
                                            {unit.skill.trigger === 'passive' && t("skill_trigger_passive")}
                                            {unit.skill.trigger === 'hp_threshold' && `${t("skill_threshold")}: ${(unit.skill.triggerThreshold || 0) * 100}%`}
                                            {unit.skill.trigger === 'interval' && `${t("skill_trigger_interval")}: ${(unit.skill.triggerIntervalMs || 0) / 1000}s`}
                                        </span>
                                        {unit.skill.cooldownMs > 0 && <span>⏳ {(unit.skill.cooldownMs / 1000).toFixed(1)}s CD</span>}
                                    </div>
                                </div>
                            )}

                            {/* Gacha Rate (Contextual) */}
                            {dropRate !== undefined && (
                                <div className="mt-auto bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("drop_rate")}</p>
                                    <p className="text-lg font-bold text-pink-500">{dropRate.toFixed(3)}%</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sticky Footer Action Bar */}
                {showTeamAction && (
                    <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
                        {isOwned ? (
                            <button
                                onClick={() => {
                                    if (onToggleTeam) onToggleTeam();
                                    onClose();
                                }}
                                className={`
                                    w-full py-3.5 rounded-xl font-bold text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2
                                    ${isInTeam
                                        ? "bg-red-500 hover:bg-red-600 text-white shadow-red-200 dark:shadow-red-900/30"
                                        : "bg-green-500 hover:bg-green-600 text-white shadow-green-200 dark:shadow-green-900/30"
                                    }
                                `}
                            >
                                {isInTeam ? (
                                    <><span>➖</span> {t("remove_from_team")}</>
                                ) : (
                                    <><span>➕</span> {t("add_to_team")}</>
                                )}
                            </button>
                        ) : (
                            <div className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-center rounded-xl border border-slate-200 dark:border-slate-700">
                                🔒 {t("not_owned")}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-component for clean stats
function StatItem({ label, value, icon, colorClass, prefix = "" }: { label: string, value: string | number, icon: string, colorClass: string, prefix?: string }) {
    return (
        <div className="flex flex-col gap-1 items-start sm:items-center p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</span>
            <div className={`font-bold text-lg sm:text-xl ${colorClass} flex items-center gap-1`}>
                <span className="text-sm opacity-80">{icon}</span>
                {prefix}{value}
            </div>
        </div>
    );
}
