"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getRankings, type RankingEntry, type RankingSortBy } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";

const allUnits = unitsData as UnitDefinition[];

type SortOption = RankingSortBy | "all";

const SORT_OPTIONS: { key: SortOption; labelKey: string; icon: string }[] = [
    { key: "all", labelKey: "ranking_all", icon: "🎴" },
    { key: "max_stage", labelKey: "ranking_max_stage", icon: "🏆" },
    { key: "total_wins", labelKey: "ranking_wins", icon: "⚔️" },
    { key: "max_win_streak", labelKey: "ranking_win_streak", icon: "🔥" },
    { key: "total_battles", labelKey: "ranking_battles", icon: "🎮" },
    { key: "collection_count", labelKey: "ranking_collection", icon: "📖" },
    { key: "ur_unit_count", labelKey: "ranking_ur_units", icon: "💎" },
    { key: "total_units", labelKey: "ranking_units", icon: "👥" },
    { key: "gacha_count", labelKey: "ranking_gacha", icon: "🎰" },
    { key: "garden_visits", labelKey: "ranking_garden", icon: "🌱" },
    { key: "stages_cleared", labelKey: "ranking_stages_cleared", icon: "✅" },
    { key: "total_coins", labelKey: "ranking_coins", icon: "💰" },
];

export default function RankingPage() {
    const { playerId } = useAuth();
    const { t } = useLanguage();
    const [rankings, setRankings] = useState<RankingEntry[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>("all");
    const [isLoading, setIsLoading] = useState(true);

    const isAllTab = sortBy === "all";
    const actualSortBy: RankingSortBy = isAllTab ? "max_stage" : sortBy;

    useEffect(() => {
        const fetchRankings = async () => {
            setIsLoading(true);
            try {
                const data = await getRankings(actualSortBy, 100, isAllTab);
                setRankings(data);
            } catch (err) {
                console.error("Failed to fetch rankings:", err);
            }
            setIsLoading(false);
        };

        fetchRankings();
    }, [sortBy, actualSortBy, isAllTab]);

    const currentSortOption = SORT_OPTIONS.find(opt => opt.key === sortBy);

    const formatValue = (entry: RankingEntry, key: SortOption): string => {
        const actualKey: RankingSortBy = key === "all" ? "max_stage" : key;
        const value = entry[actualKey];
        if (actualKey === "total_coins") {
            return value.toLocaleString();
        }
        return String(value);
    };

    const getRankStyle = (rank: number) => {
        if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-amber-500 text-black";
        if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-400 text-black";
        if (rank === 3) return "bg-gradient-to-r from-amber-600 to-orange-700 text-white";
        return "bg-gray-700 text-white";
    };

    return (
        <main className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-slate-900 to-slate-800">
            {/* ヘッダー */}
            <div className="page-header mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                        {t("ranking_title")}
                    </h1>
                    <div className="w-24" /> {/* スペーサー */}
                </div>
            </div>

            <div className="container max-w-4xl mx-auto">
                {/* ソート選択 */}
                <div className="mb-6">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {SORT_OPTIONS.map(option => (
                            <button
                                key={option.key}
                                onClick={() => setSortBy(option.key)}
                                className={`px-3 py-2 min-h-[44px] rounded-lg font-bold text-sm transition-all active:scale-95 ${
                                    sortBy === option.key
                                        ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg scale-105"
                                        : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                                }`}
                            >
                                {option.icon} {t(option.labelKey)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ランキングリスト */}
                <div className="bg-slate-800/50 rounded-2xl p-4 md:p-6 border border-slate-700">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin text-4xl mb-4">⏳</div>
                            <p className="text-gray-400">{t("loading")}</p>
                        </div>
                    ) : rankings.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🏜️</div>
                            <p className="text-gray-400">{t("ranking_no_data")}</p>
                            <p className="text-gray-500 text-sm mt-2">
                                {t("ranking_login_prompt")}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* ヘッダー - デッキタブでは簡略化 */}
                            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-gray-400 text-sm font-bold border-b border-slate-700">
                                <div className="col-span-1 text-center">#</div>
                                <div className={isAllTab ? "col-span-11" : "col-span-4"}>{t("ranking_player")}{isAllTab && " / 🎴 Deck"}</div>
                                {!isAllTab && (
                                    <>
                                        <div className="col-span-2 text-center">{currentSortOption?.icon} {currentSortOption && t(currentSortOption.labelKey)}</div>
                                        <div className="col-span-1 text-center">🏆</div>
                                        <div className="col-span-1 text-center">⚔️</div>
                                        <div className="col-span-1 text-center">📖</div>
                                        <div className="col-span-2 text-center">💰</div>
                                    </>
                                )}
                            </div>

                            {/* ランキング行 */}
                            {rankings.map((entry, index) => {
                                const rank = index + 1;
                                const isCurrentPlayer = entry.player_id === playerId;

                                return (
                                    <div
                                        key={entry.player_id}
                                        className={`grid grid-cols-12 gap-2 px-4 py-3 rounded-xl transition-all ${
                                            isCurrentPlayer
                                                ? "bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-2 border-blue-500"
                                                : "bg-slate-700/50 hover:bg-slate-700"
                                        }`}
                                    >
                                        {/* 順位 */}
                                        <div className="col-span-2 md:col-span-1 flex items-center justify-center">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankStyle(rank)}`}>
                                                {rank}
                                            </span>
                                        </div>

                                        {/* プレイヤー名 & ロードアウト */}
                                        <div className={`${isAllTab ? "col-span-10" : "col-span-6"} ${isAllTab ? "md:col-span-11" : "md:col-span-4"} flex flex-col justify-center`}>
                                            <span className="text-white font-bold truncate">
                                                {entry.player_name}
                                                {isCurrentPlayer && (
                                                    <span className="ml-2 text-xs text-blue-400">(You)</span>
                                                )}
                                            </span>
                                            {/* ロードアウトアイコン（Allタブのみ） */}
                                            {isAllTab && entry.selected_team && entry.selected_team.length > 0 && (
                                                <div className="flex gap-2 mt-2 flex-wrap">
                                                    {entry.selected_team.slice(0, 7).map((unitId, idx) => {
                                                        const unit = allUnits.find(u => u.id === unitId);
                                                        if (!unit) return null;
                                                        const baseId = unit.baseUnitId || unit.id;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className="w-12 h-12 md:w-14 md:h-14 rounded-lg border-2 border-slate-500 overflow-hidden bg-slate-800 shadow-md"
                                                                title={unit.name}
                                                            >
                                                                <Image
                                                                    src={`/assets/sprites/${baseId}.webp`}
                                                                    alt={unit.name}
                                                                    width={56}
                                                                    height={56}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* メイン値（PC）- デッキタブでは非表示 */}
                                        {!isAllTab && (
                                            <div className="hidden md:flex col-span-2 items-center justify-center">
                                                <span className="text-amber-400 font-bold text-lg">
                                                    {formatValue(entry, sortBy)}
                                                </span>
                                            </div>
                                        )}

                                        {/* サブ統計（PC）- デッキタブでは非表示 */}
                                        {!isAllTab && (
                                            <>
                                                <div className="hidden md:flex col-span-1 items-center justify-center text-gray-300 text-sm">
                                                    {entry.max_stage}
                                                </div>
                                                <div className="hidden md:flex col-span-1 items-center justify-center text-gray-300 text-sm">
                                                    {entry.total_wins}
                                                </div>
                                                <div className="hidden md:flex col-span-1 items-center justify-center text-gray-300 text-sm">
                                                    {entry.collection_count}
                                                </div>
                                                <div className="hidden md:flex col-span-2 items-center justify-center text-gray-300 text-sm">
                                                    {entry.total_coins.toLocaleString()}
                                                </div>
                                            </>
                                        )}

                                        {/* モバイル: メイン値 - デッキタブでは非表示 */}
                                        {!isAllTab && (
                                            <div className="col-span-4 md:hidden flex items-center justify-end">
                                                <span className="text-amber-400 font-bold">
                                                    {currentSortOption?.icon} {formatValue(entry, sortBy)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 注意書き */}
                <div className="mt-6 text-center text-gray-500 text-sm">
                    <p>{t("ranking_info_login")}</p>
                    <p className="mt-1">{t("ranking_info_auto_update")}</p>
                </div>
            </div>
        </main>
    );
}
