"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { Rarity, UnitRole } from "@/data/types";
import { useState } from "react";

type SortKey = "none" | "hp" | "attack" | "range" | "speed" | "move" | "dps" | "cost" | "spawn" | "droprate" | "size";
type RoleFilter = "ALL" | UnitRole;

interface TeamFiltersProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    rarityFilter: Rarity | "ALL";
    setRarityFilter: (r: Rarity | "ALL") => void;
    roleFilter: RoleFilter;
    setRoleFilter: (r: RoleFilter) => void;
    sortBy: SortKey;
    setSortBy: (s: SortKey) => void;
    activeCount: number;
}

export default function TeamFilters({
    searchQuery,
    setSearchQuery,
    rarityFilter,
    setRarityFilter,
    roleFilter,
    setRoleFilter,
    sortBy,
    setSortBy,
    activeCount
}: TeamFiltersProps) {
    const { t } = useLanguage();
    const [isExpanded, setIsExpanded] = useState(true);

    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-slate-500" },
        { key: "N", label: "N", color: "bg-slate-400" },
        { key: "R", label: "R", color: "bg-blue-500" },
        { key: "SR", label: "SR", color: "bg-purple-500" },
        { key: "SSR", label: "SSR", color: "bg-amber-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

    const roleTabs: { key: RoleFilter; label: string; icon: string; color: string }[] = [
        { key: "ALL", label: "ALL", icon: "🎯", color: "bg-slate-500" },
        { key: "tank", label: t("role_tank"), icon: "🛡️", color: "bg-slate-500" },
        { key: "attacker", label: t("role_attacker"), icon: "⚔️", color: "bg-red-500" },
        { key: "ranger", label: t("role_ranger"), icon: "🏹", color: "bg-green-500" },
        { key: "speedster", label: t("role_speedster"), icon: "💨", color: "bg-cyan-500" },
        { key: "flying", label: t("role_flying"), icon: "🪽", color: "bg-sky-500" },
        { key: "balanced", label: t("role_balanced"), icon: "⚖️", color: "bg-slate-400" },
    ];

    const sortOptions: { key: SortKey; label: string; icon: string }[] = [
        { key: "none", label: t("sort_none"), icon: "📋" },
        { key: "hp", label: t("hp"), icon: "❤️" },
        { key: "attack", label: t("attack"), icon: "⚔️" },
        { key: "dps", label: "DPS", icon: "💥" },
        { key: "range", label: t("range"), icon: "📏" },
        { key: "speed", label: t("attack_speed"), icon: "⏱️" },
        { key: "move", label: t("move_speed"), icon: "🏃" },
        { key: "cost", label: t("cost"), icon: "💰" },
        { key: "spawn", label: t("spawn_cooldown"), icon: "⏰" },
        { key: "droprate", label: t("drop_rate"), icon: "🎰" },
        { key: "size", label: t("size"), icon: "📐" },
    ];

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-4 transition-all">
            {/* Header toggle */}
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-1 rounded-lg">🔍</span>
                    {t("filter")} / {t("sort_by")}
                    {activeCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-500 text-white font-bold animate-pulse">
                            {activeCount}
                        </span>
                    )}
                </h3>
                <div className={`transform transition-transform duration-200 text-slate-400 ${isExpanded ? "rotate-90" : ""}`}>
                    ▶
                </div>
            </div>

            {/* Expanded Content */}
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="p-3 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-700/50 mt-2">

                    {/* Search & Sort Row */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-3">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`🔍 ${t("search_unit_name")}...`}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all outline-none font-medium placeholder-slate-400"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                🔍
                            </div>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Sort */}
                        <div className="min-w-[160px]">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortKey)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-amber-400 outline-none font-bold text-slate-700 dark:text-slate-300 appearance-none cursor-pointer"
                                style={{ backgroundImage: 'none' }}
                            >
                                {sortOptions.map(opt => (
                                    <option key={opt.key} value={opt.key}>
                                        {opt.icon} {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Rarity & Role Filters */}
                    <div className="space-y-3">
                        {/* Rarity */}
                        <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-1 scrollbar-hide">
                            <span className="text-xs font-bold text-slate-400 flex items-center mr-1">Rarity:</span>
                            {rarityTabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setRarityFilter(tab.key)}
                                    className={`
                                        px-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap border
                                        ${rarityFilter === tab.key
                                            ? `${tab.color} text-white border-transparent shadow-md scale-105`
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                                        }
                                    `}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Role */}
                        <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-1 scrollbar-hide">
                            <span className="text-xs font-bold text-slate-400 flex items-center mr-1">Role:</span>
                            {roleTabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setRoleFilter(tab.key)}
                                    className={`
                                        pl-2 pr-3 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap border flex items-center gap-1.5
                                        ${roleFilter === tab.key
                                            ? `${tab.color} text-white border-transparent shadow-md scale-105`
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                                        }
                                    `}
                                >
                                    <span>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
