"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import { usePlayerData } from "@/hooks/usePlayerData";
import { getAsyncOpponents, getAsyncBattleHistory, type AsyncOpponent, type AsyncBattleResult } from "@/lib/supabase";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { getSpritePath } from "@/lib/sprites";

const allUnits = unitsData as UnitDefinition[];

// Helper function for relative time
function getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Skeleton card for loading state
function OpponentSkeleton() {
    return (
        <div className="bg-gray-100 dark:bg-slate-700/50 rounded-xl p-4 animate-pulse">
            <div className="flex items-center justify-between gap-4">
                {/* Opponent Info Skeleton */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-6 w-32 bg-gray-300 dark:bg-slate-600 rounded"></div>
                        <div className="h-4 w-20 bg-gray-200 dark:bg-slate-600 rounded"></div>
                    </div>
                    {/* Deck Skeleton */}
                    <div className="flex gap-1 flex-wrap">
                        {[...Array(5)].map((_, idx) => (
                            <div
                                key={idx}
                                className="w-10 h-10 rounded border border-gray-300 dark:border-slate-500 bg-gray-200 dark:bg-slate-600"
                            />
                        ))}
                    </div>
                </div>
                {/* Button Skeleton */}
                <div className="w-24 h-12 bg-gray-300 dark:bg-slate-600 rounded-xl"></div>
            </div>
        </div>
    );
}

export default function AsyncBattlePage() {
    const router = useRouter();
    const { playerId, status } = useAuth();
    const { t } = useLanguage();
    const { showError } = useToast();
    const { selectedTeam, isLoaded } = usePlayerData();
    const [opponents, setOpponents] = useState<AsyncOpponent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOpponent, setSelectedOpponent] = useState<AsyncOpponent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [battleHistory, setBattleHistory] = useState<AsyncBattleResult[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(true);

    // Fetch opponents
    useEffect(() => {
        const fetchOpponents = async () => {
            if (!playerId) return;
            setIsLoading(true);
            setError(null);
            try {
                const result = await getAsyncOpponents(playerId, 20);
                setOpponents(result.data);
                if (result.error) {
                    setError(result.error);
                    showError(result.error);
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "Failed to fetch opponents";
                console.error("Failed to fetch opponents:", err);
                setError(errorMsg);
                showError(errorMsg);
            }
            setIsLoading(false);
        };

        if (status === "authenticated" && playerId) {
            fetchOpponents();
        } else if (status === "unauthenticated") {
            setIsLoading(false);
        }
    }, [playerId, status, showError]);

    // Fetch battle history (async battles only)
    useEffect(() => {
        const fetchHistory = async () => {
            if (!playerId) return;
            setHistoryLoading(true);
            try {
                // Only fetch async battle history
                const result = await getAsyncBattleHistory(playerId, 10, 'async');
                if (result.data) {
                    setBattleHistory(result.data);
                }
            } catch (err) {
                console.error("Failed to fetch battle history:", err);
            }
            setHistoryLoading(false);
        };

        if (status === "authenticated" && playerId) {
            fetchHistory();
        }
    }, [playerId, status]);

    const handleChallenge = (opponent: AsyncOpponent) => {
        if (selectedTeam.length === 0) {
            showError(t("async_no_team"));
            return;
        }
        // Navigate to async battle page
        router.push(`/battle/async/${opponent.player_id}`);
    };

    const refreshOpponents = async () => {
        if (!playerId) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await getAsyncOpponents(playerId, 20);
            setOpponents(result.data);
            if (result.error) {
                setError(result.error);
                showError(result.error);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to fetch opponents";
            setError(errorMsg);
            showError(errorMsg);
        }
        setIsLoading(false);
    };

    // Not logged in
    if (status === "unauthenticated") {
        return (
            <main className="min-h-screen">
                <PageHeader
                    title={`⚔️ ${t("async_battle_title")}`}
                    showLanguageSwitch={false}
                />
                <div className="container max-w-4xl mx-auto px-4 md:px-8">
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🔒</div>
                        <p className="text-gray-600 dark:text-gray-400 text-xl">{t("login_required")}</p>
                        <p className="text-gray-500 dark:text-gray-500 mt-2">{t("async_login_message")}</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen">
            <PageHeader
                title={`⚔️ ${t("async_battle_title")}`}
                showLanguageSwitch={false}
            >
                <button
                    onClick={refreshOpponents}
                    className="btn btn-secondary"
                    disabled={isLoading}
                >
                    🔄 {t("refresh")}
                </button>
            </PageHeader>

            <div className="container max-w-4xl mx-auto">
                {/* My Team Display */}
                <div className="bg-white/80 dark:bg-slate-800/50 rounded-2xl p-4 mb-6 border border-gray-300 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3">{t("async_my_team")}</h2>
                    {selectedTeam.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-gray-600 dark:text-gray-400">{t("async_no_team")}</p>
                            <Link href="/team" className="btn btn-primary mt-2">
                                {t("menu_team")}
                            </Link>
                        </div>
                    ) : (
                        <div className="flex gap-2 flex-wrap">
                            {selectedTeam.map((unitId, idx) => {
                                const unit = allUnits.find(u => u.id === unitId);
                                if (!unit) return null;
                                const baseId = unit.baseUnitId || unit.id;
                                return (
                                    <div
                                        key={idx}
                                        className="w-12 h-12 rounded-lg border-2 border-blue-500 overflow-hidden bg-gray-200 dark:bg-slate-800"
                                        title={unit.name}
                                    >
                                        <Image
                                            src={getSpritePath(baseId, unit.rarity)}
                                            alt={unit.name}
                                            width={48}
                                            height={48}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Opponent List */}
                <div className="bg-white/80 dark:bg-slate-800/50 rounded-2xl p-4 md:p-6 border border-gray-300 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t("async_select_opponent")}</h2>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(4)].map((_, idx) => (
                                <OpponentSkeleton key={idx} />
                            ))}
                        </div>
                    ) : opponents.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🏜️</div>
                            <p className="text-gray-600 dark:text-gray-400">{t("async_no_opponents")}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {opponents.map((opponent) => (
                                <div
                                    key={opponent.player_id}
                                    className="bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl p-4 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        {/* Opponent Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-gray-800 dark:text-white font-bold text-lg">
                                                    {opponent.player_name}
                                                </span>
                                                <span className="text-amber-600 dark:text-amber-400 text-sm">
                                                    🏆 Stage {opponent.max_stage}
                                                </span>
                                            </div>
                                            {/* Opponent Deck */}
                                            <div className="flex gap-1 flex-wrap">
                                                {opponent.selected_team.slice(0, 7).map((unitId, idx) => {
                                                    const unit = allUnits.find(u => u.id === unitId);
                                                    if (!unit) return null;
                                                    const baseId = unit.baseUnitId || unit.id;
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="w-10 h-10 rounded border border-gray-400 dark:border-slate-500 overflow-hidden bg-gray-200 dark:bg-slate-800"
                                                            title={unit.name}
                                                        >
                                                            <Image
                                                                src={getSpritePath(baseId, unit.rarity)}
                                                                alt={unit.name}
                                                                width={40}
                                                                height={40}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Challenge Button */}
                                        <button
                                            onClick={() => handleChallenge(opponent)}
                                            className="btn bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg"
                                            disabled={selectedTeam.length === 0}
                                        >
                                            ⚔️ {t("async_challenge")}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Battle History Section */}
                <div className="bg-white/80 dark:bg-slate-800/50 rounded-2xl p-4 md:p-6 border border-gray-300 dark:border-slate-700 mt-6">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center justify-between w-full text-left"
                    >
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                            📜 {t("battle_history") || "Battle History"}
                        </h2>
                        <span className="text-gray-500 dark:text-gray-400 text-xl">
                            {showHistory ? "▼" : "▶"}
                        </span>
                    </button>

                    {showHistory && (
                        <div className="mt-4">
                            {historyLoading ? (
                                <div className="space-y-2">
                                    {[...Array(3)].map((_, idx) => (
                                        <div key={idx} className="h-16 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                                    ))}
                                </div>
                            ) : battleHistory.length === 0 ? (
                                <div className="text-center py-6">
                                    <div className="text-4xl mb-2">🏟️</div>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        {t("no_battle_history") || "No battle history yet"}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {battleHistory.map((battle) => {
                                        const isAttacker = battle.attacker_id === playerId;
                                        const won = (isAttacker && battle.winner === "attacker") || (!isAttacker && battle.winner === "defender");
                                        const opponentName = isAttacker ? battle.defender_name : battle.attacker_name;
                                        const opponentDeck = isAttacker ? battle.defender_deck : battle.attacker_deck;
                                        const myDeck = isAttacker ? battle.attacker_deck : battle.defender_deck;
                                        const timeAgo = getTimeAgo(battle.created_at || "");

                                        return (
                                            <div
                                                key={battle.id}
                                                className={`rounded-xl p-4 border-2 ${
                                                    won
                                                        ? "bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600"
                                                        : "bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600"
                                                }`}
                                            >
                                                {/* Result badge */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${
                                                        won
                                                            ? "bg-green-500 text-white"
                                                            : "bg-red-500 text-white"
                                                    }`}>
                                                        {won ? "🏆" : "💔"} {won ? (t("victory") || "Victory") : (t("defeat") || "Defeat")}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                                            isAttacker
                                                                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                                                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                        }`}>
                                                            {isAttacker ? "⚔️ " + (t("attacker") || "Attacker") : "🛡️ " + (t("defender") || "Defender")}
                                                        </span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {timeAgo}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Battle matchup */}
                                                <div className="flex items-center gap-3">
                                                    {/* My side */}
                                                    <div className={`flex-1 p-2 rounded-lg ${won ? "bg-green-100 dark:bg-green-800/30" : "bg-gray-100 dark:bg-slate-700/50"}`}>
                                                        <div className="flex items-center gap-1 mb-1">
                                                            {won && <span className="text-yellow-500">👑</span>}
                                                            <span className="text-sm font-bold text-gray-800 dark:text-white">
                                                                {t("you") || "You"}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-0.5">
                                                            {(myDeck || []).slice(0, 5).map((unitId, idx) => {
                                                                const unit = allUnits.find(u => u.id === unitId);
                                                                if (!unit) return null;
                                                                const baseId = unit.baseUnitId || unit.id;
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className="w-6 h-6 rounded border border-blue-400 dark:border-blue-500 overflow-hidden bg-gray-200 dark:bg-slate-800"
                                                                        title={unit.name}
                                                                    >
                                                                        <Image
                                                                            src={getSpritePath(baseId, unit.rarity)}
                                                                            alt={unit.name}
                                                                            width={24}
                                                                            height={24}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* VS */}
                                                    <div className="text-gray-400 dark:text-gray-500 font-bold text-sm">
                                                        VS
                                                    </div>

                                                    {/* Opponent side */}
                                                    <div className={`flex-1 p-2 rounded-lg ${!won ? "bg-red-100 dark:bg-red-800/30" : "bg-gray-100 dark:bg-slate-700/50"}`}>
                                                        <div className="flex items-center gap-1 mb-1">
                                                            {!won && <span className="text-yellow-500">👑</span>}
                                                            <span className="text-sm font-bold text-gray-800 dark:text-white">
                                                                {opponentName}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-0.5">
                                                            {(opponentDeck || []).slice(0, 5).map((unitId, idx) => {
                                                                const unit = allUnits.find(u => u.id === unitId);
                                                                if (!unit) return null;
                                                                const baseId = unit.baseUnitId || unit.id;
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className="w-6 h-6 rounded border border-gray-400 dark:border-slate-500 overflow-hidden bg-gray-200 dark:bg-slate-800"
                                                                        title={unit.name}
                                                                    >
                                                                        <Image
                                                                            src={getSpritePath(baseId, unit.rarity)}
                                                                            alt={unit.name}
                                                                            width={24}
                                                                            height={24}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="mt-6 text-center text-gray-500 dark:text-gray-500 text-sm">
                    <p>{t("async_info")}</p>
                </div>
            </div>
        </main>
    );
}
