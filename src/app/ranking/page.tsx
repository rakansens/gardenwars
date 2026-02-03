"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getRankings, getAllBattleHistory, type RankingEntry, type RankingSortBy, type AsyncBattleResult, type BattleType } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { getSpritePath } from "@/lib/sprites";
import { getStageProgressInfo } from "@/data/stages";
import { getWorldById } from "@/data/worlds";

const allUnits = unitsData as UnitDefinition[];

type MainTab = "rankings" | "history";
type SortOption = RankingSortBy | "all";
type HistoryFilter = "all" | BattleType;

/**
 * ステージ進捗を表示用にフォーマット
 */
function formatStageProgress(
    stageId: string | null,
    t: (key: string) => string
): { icon: string; text: string; stageName: string } | null {
    if (!stageId) return null;

    const progressInfo = getStageProgressInfo(stageId);
    if (!progressInfo) return null;

    const world = getWorldById(progressInfo.worldId);
    if (!world) return null;

    const worldName = t(world.nameKey);
    const stageName = t(progressInfo.nameKey) || `Stage ${progressInfo.stageIndex}`;

    return {
        icon: world.icon,
        text: `${worldName} ${progressInfo.stageIndex}/${progressInfo.totalStages}`,
        stageName: stageName,
    };
}

/**
 * バトル時間をフォーマット
 */
function formatBattleDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 相対時間をフォーマット
 */
function formatRelativeTime(dateStr: string, t: (key: string) => string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("just_now") || "just now";
    if (diffMins < 60) return `${diffMins}${t("minutes_ago") || "m ago"}`;
    if (diffHours < 24) return `${diffHours}${t("hours_ago") || "h ago"}`;
    return `${diffDays}${t("days_ago") || "d ago"}`;
}

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
    const { showError } = useToast();

    // Main tab state
    const [mainTab, setMainTab] = useState<MainTab>("rankings");

    // Rankings state
    const [rankings, setRankings] = useState<RankingEntry[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>("all");
    const [isLoadingRankings, setIsLoadingRankings] = useState(true);

    // Battle history state
    const [battleHistory, setBattleHistory] = useState<AsyncBattleResult[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

    const isAllTab = sortBy === "all";
    const actualSortBy: RankingSortBy = isAllTab ? "max_stage" : sortBy;

    // Fetch rankings
    useEffect(() => {
        if (mainTab !== "rankings") return;

        const fetchRankings = async () => {
            setIsLoadingRankings(true);
            try {
                const result = await getRankings(actualSortBy, 100, isAllTab);
                setRankings(result.data);
                if (result.error) {
                    showError(result.error);
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "Failed to fetch rankings";
                console.error("Failed to fetch rankings:", err);
                showError(errorMsg);
            }
            setIsLoadingRankings(false);
        };

        fetchRankings();
    }, [mainTab, sortBy, actualSortBy, isAllTab, showError]);

    // Fetch battle history
    useEffect(() => {
        if (mainTab !== "history") return;

        const fetchHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const battleType = historyFilter === "all" ? undefined : historyFilter;
                const result = await getAllBattleHistory(100, battleType);
                setBattleHistory(result.data);
                if (result.error) {
                    showError(result.error);
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "Failed to fetch battle history";
                console.error("Failed to fetch battle history:", err);
                showError(errorMsg);
            }
            setIsLoadingHistory(false);
        };

        fetchHistory();
    }, [mainTab, historyFilter, showError]);

    const currentSortOption = SORT_OPTIONS.find(opt => opt.key === sortBy);

    const formatValue = (entry: RankingEntry, key: SortOption): string => {
        const actualKey: RankingSortBy = key === "all" ? "max_stage" : key;

        if (actualKey === "max_stage") {
            const progress = formatStageProgress(entry.max_cleared_stage_id, t);
            if (progress) {
                return `${progress.icon} ${progress.text}`;
            }
            return String(entry.max_stage);
        }

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
        return "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white";
    };

    return (
        <main className="min-h-screen">
            <PageHeader
                title={t("ranking_title")}
                showLanguageSwitch={false}
            />

            <div className="container max-w-4xl mx-auto">
                {/* メインタブ */}
                <div className="mb-6">
                    <div className="flex gap-2 justify-center">
                        <button
                            onClick={() => setMainTab("rankings")}
                            className={`px-6 py-3 rounded-xl font-bold text-lg transition-all active:scale-95 ${
                                mainTab === "rankings"
                                    ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg"
                                    : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
                            }`}
                        >
                            🏆 {t("ranking_tab") || "Rankings"}
                        </button>
                        <button
                            onClick={() => setMainTab("history")}
                            className={`px-6 py-3 rounded-xl font-bold text-lg transition-all active:scale-95 ${
                                mainTab === "history"
                                    ? "bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-lg"
                                    : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
                            }`}
                        >
                            ⚔️ {t("battle_history_tab") || "Battle History"}
                        </button>
                    </div>
                </div>

                {/* Rankings Tab */}
                {mainTab === "rankings" && (
                    <>
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
                                                : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
                                        }`}
                                    >
                                        {option.icon} {t(option.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ランキングリスト */}
                        <div className="bg-white/80 dark:bg-slate-800/50 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-slate-700">
                            {isLoadingRankings ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin text-4xl mb-4">⏳</div>
                                    <p className="text-gray-600 dark:text-gray-400">{t("loading")}</p>
                                </div>
                            ) : rankings.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-4">🏜️</div>
                                    <p className="text-gray-600 dark:text-gray-400">{t("ranking_no_data")}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* ヘッダー */}
                                    <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 text-sm font-bold border-b border-gray-200 dark:border-slate-700">
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
                                        const stageProgress = formatStageProgress(entry.max_cleared_stage_id, t);

                                        return (
                                            <div
                                                key={entry.player_id}
                                                className={`grid grid-cols-12 gap-2 px-4 py-3 rounded-xl transition-all ${
                                                    isCurrentPlayer
                                                        ? "bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 border-2 border-blue-500"
                                                        : "bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-700"
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
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-gray-800 dark:text-white font-bold truncate">
                                                            {entry.player_name}
                                                            {isCurrentPlayer && (
                                                                <span className="ml-2 text-xs text-blue-500 dark:text-blue-400">(You)</span>
                                                            )}
                                                        </span>
                                                        {stageProgress && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                                                {stageProgress.icon} {stageProgress.text}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isAllTab && entry.selected_team && entry.selected_team.length > 0 && (
                                                        <div className="flex gap-2 mt-2 flex-wrap">
                                                            {entry.selected_team.slice(0, 7).map((unitId, idx) => {
                                                                const unit = allUnits.find(u => u.id === unitId);
                                                                if (!unit) return null;
                                                                const baseId = unit.baseUnitId || unit.id;
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className="w-12 h-12 md:w-14 md:h-14 rounded-lg border-2 border-gray-400 dark:border-slate-500 overflow-hidden bg-gray-100 dark:bg-slate-800 shadow-md"
                                                                        title={unit.name}
                                                                    >
                                                                        <Image
                                                                            src={getSpritePath(baseId, unit.rarity)}
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

                                                {/* メイン値（PC） */}
                                                {!isAllTab && (
                                                    <div className="hidden md:flex col-span-2 flex-col items-center justify-center">
                                                        <span className="text-amber-500 dark:text-amber-400 font-bold text-lg">
                                                            {formatValue(entry, sortBy)}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* サブ統計（PC） */}
                                                {!isAllTab && (
                                                    <>
                                                        <div className="hidden md:flex col-span-1 items-center justify-center text-gray-600 dark:text-gray-300 text-sm">
                                                            {stageProgress ? stageProgress.icon : entry.max_stage}
                                                        </div>
                                                        <div className="hidden md:flex col-span-1 items-center justify-center text-gray-600 dark:text-gray-300 text-sm">
                                                            {entry.total_wins}
                                                        </div>
                                                        <div className="hidden md:flex col-span-1 items-center justify-center text-gray-600 dark:text-gray-300 text-sm">
                                                            {entry.collection_count}
                                                        </div>
                                                        <div className="hidden md:flex col-span-2 items-center justify-center text-gray-600 dark:text-gray-300 text-sm">
                                                            {entry.total_coins.toLocaleString()}
                                                        </div>
                                                    </>
                                                )}

                                                {/* モバイル: メイン値 */}
                                                {!isAllTab && (
                                                    <div className="col-span-4 md:hidden flex flex-col items-end justify-center">
                                                        <span className="text-amber-500 dark:text-amber-400 font-bold">
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
                    </>
                )}

                {/* Battle History Tab */}
                {mainTab === "history" && (
                    <div className="bg-white/80 dark:bg-slate-800/50 rounded-2xl p-4 md:p-6 border border-gray-200 dark:border-slate-700">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                ⚔️ {t("recent_battles") || "Recent Battles"}
                            </h2>
                            {/* サブタブ: バトルタイプ選択 */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setHistoryFilter("all")}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                                        historyFilter === "all"
                                            ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300"
                                    }`}
                                >
                                    🎮 {t("all") || "All"}
                                </button>
                                <button
                                    onClick={() => setHistoryFilter("async")}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                                        historyFilter === "async"
                                            ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300"
                                    }`}
                                >
                                    🤖 {t("async_battle") || "Async"}
                                </button>
                                <button
                                    onClick={() => setHistoryFilter("realtime")}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                                        historyFilter === "realtime"
                                            ? "bg-gradient-to-r from-red-500 to-orange-600 text-white"
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300"
                                    }`}
                                >
                                    ⚡ {t("realtime_battle") || "Realtime"}
                                </button>
                            </div>
                        </div>

                        {isLoadingHistory ? (
                            <div className="text-center py-12">
                                <div className="animate-spin text-4xl mb-4">⏳</div>
                                <p className="text-gray-600 dark:text-gray-400">{t("loading")}</p>
                            </div>
                        ) : battleHistory.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🏜️</div>
                                <p className="text-gray-600 dark:text-gray-400">{t("no_battle_history") || "No battle history yet"}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {battleHistory.map((battle) => {
                                    const isAttackerWinner = battle.winner === 'attacker';
                                    const isCurrentPlayerAttacker = battle.attacker_id === playerId;
                                    const isCurrentPlayerDefender = battle.defender_id === playerId;
                                    const isCurrentPlayerInvolved = isCurrentPlayerAttacker || isCurrentPlayerDefender;
                                    const currentPlayerWon = (isCurrentPlayerAttacker && isAttackerWinner) || (isCurrentPlayerDefender && !isAttackerWinner);

                                    return (
                                        <div
                                            key={battle.id}
                                            className={`rounded-xl p-4 transition-all ${
                                                isCurrentPlayerInvolved
                                                    ? currentPlayerWon
                                                        ? "bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-500"
                                                        : "bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 border-2 border-red-500"
                                                    : "bg-gray-100 dark:bg-slate-700/50"
                                            }`}
                                        >
                                            {/* バトル情報 */}
                                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                                {/* Attacker */}
                                                <div className={`flex-1 ${isAttackerWinner ? "order-1" : "order-2 md:order-1"}`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {isAttackerWinner && <span className="text-xl">👑</span>}
                                                        <span className={`font-bold ${isAttackerWinner ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}>
                                                            {battle.attacker_name}
                                                            {isCurrentPlayerAttacker && <span className="ml-1 text-xs text-blue-500">(You)</span>}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {battle.attacker_deck.slice(0, 5).map((unitId, idx) => {
                                                            const unit = allUnits.find(u => u.id === unitId);
                                                            if (!unit) return null;
                                                            const baseId = unit.baseUnitId || unit.id;
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className="w-8 h-8 rounded border border-gray-400 dark:border-slate-500 overflow-hidden bg-gray-200 dark:bg-slate-800"
                                                                    title={unit.name}
                                                                >
                                                                    <Image
                                                                        src={getSpritePath(baseId, unit.rarity)}
                                                                        alt={unit.name}
                                                                        width={32}
                                                                        height={32}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* VS */}
                                                <div className="flex items-center justify-center px-4 order-1 md:order-2">
                                                    <span className="text-2xl font-bold text-gray-400">VS</span>
                                                </div>

                                                {/* Defender */}
                                                <div className={`flex-1 text-right ${!isAttackerWinner ? "order-1" : "order-2 md:order-3"}`}>
                                                    <div className="flex items-center justify-end gap-2 mb-2">
                                                        <span className={`font-bold ${!isAttackerWinner ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}>
                                                            {battle.defender_name}
                                                            {isCurrentPlayerDefender && <span className="ml-1 text-xs text-blue-500">(You)</span>}
                                                        </span>
                                                        {!isAttackerWinner && <span className="text-xl">👑</span>}
                                                    </div>
                                                    <div className="flex gap-1 flex-wrap justify-end">
                                                        {battle.defender_deck.slice(0, 5).map((unitId, idx) => {
                                                            const unit = allUnits.find(u => u.id === unitId);
                                                            if (!unit) return null;
                                                            const baseId = unit.baseUnitId || unit.id;
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className="w-8 h-8 rounded border border-gray-400 dark:border-slate-500 overflow-hidden bg-gray-200 dark:bg-slate-800"
                                                                    title={unit.name}
                                                                >
                                                                    <Image
                                                                        src={getSpritePath(baseId, unit.rarity)}
                                                                        alt={unit.name}
                                                                        width={32}
                                                                        height={32}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* バトル詳細 */}
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
                                                {/* バトルタイプバッジ */}
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    battle.battle_type === "realtime"
                                                        ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
                                                        : "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                                                }`}>
                                                    {battle.battle_type === "realtime" ? "⚡ Realtime" : "🤖 Async"}
                                                </span>
                                                <span>⏱️ {formatBattleDuration(battle.battle_duration)}</span>
                                                <span>💀 {battle.attacker_kills} - {battle.defender_kills}</span>
                                                <span className="ml-auto">{formatRelativeTime(battle.created_at || "", t)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 注意書き */}
                <div className="mt-6 text-center text-gray-500 dark:text-gray-500 text-sm">
                    <p>{t("ranking_info_login")}</p>
                    <p className="mt-1">{t("ranking_info_auto_update")}</p>
                </div>
            </div>
        </main>
    );
}
