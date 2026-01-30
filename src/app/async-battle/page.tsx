"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { getAsyncOpponents, type AsyncOpponent } from "@/lib/supabase";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";

const allUnits = unitsData as UnitDefinition[];

export default function AsyncBattlePage() {
    const router = useRouter();
    const { playerId, status } = useAuth();
    const { t } = useLanguage();
    const { selectedTeam, isLoaded } = usePlayerData();
    const [opponents, setOpponents] = useState<AsyncOpponent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOpponent, setSelectedOpponent] = useState<AsyncOpponent | null>(null);

    // Fetch opponents
    useEffect(() => {
        const fetchOpponents = async () => {
            if (!playerId) return;
            setIsLoading(true);
            try {
                const data = await getAsyncOpponents(playerId, 20);
                setOpponents(data);
            } catch (err) {
                console.error("Failed to fetch opponents:", err);
            }
            setIsLoading(false);
        };

        if (status === "authenticated" && playerId) {
            fetchOpponents();
        } else if (status === "unauthenticated") {
            setIsLoading(false);
        }
    }, [playerId, status]);

    const handleChallenge = (opponent: AsyncOpponent) => {
        if (selectedTeam.length === 0) {
            alert(t("async_no_team"));
            return;
        }
        // Navigate to async battle page
        router.push(`/battle/async/${opponent.player_id}`);
    };

    const refreshOpponents = async () => {
        if (!playerId) return;
        setIsLoading(true);
        const data = await getAsyncOpponents(playerId, 20);
        setOpponents(data);
        setIsLoading(false);
    };

    // Not logged in
    if (status === "unauthenticated") {
        return (
            <main className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-slate-900 to-slate-800">
                <div className="page-header mb-6">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                </div>
                <div className="container max-w-4xl mx-auto">
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🔒</div>
                        <p className="text-gray-400 text-xl">{t("login_required")}</p>
                        <p className="text-gray-500 mt-2">{t("async_login_message")}</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-slate-900 to-slate-800">
            {/* Header */}
            <div className="page-header mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                        ⚔️ {t("async_battle_title")}
                    </h1>
                    <button
                        onClick={refreshOpponents}
                        className="btn btn-secondary"
                        disabled={isLoading}
                    >
                        🔄 {t("refresh")}
                    </button>
                </div>
            </div>

            <div className="container max-w-4xl mx-auto">
                {/* My Team Display */}
                <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-700">
                    <h2 className="text-lg font-bold text-white mb-3">{t("async_my_team")}</h2>
                    {selectedTeam.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-gray-400">{t("async_no_team")}</p>
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
                                        className="w-12 h-12 rounded-lg border-2 border-blue-500 overflow-hidden bg-slate-800"
                                        title={unit.name}
                                    >
                                        <Image
                                            src={`/assets/sprites/${baseId}.webp`}
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
                <div className="bg-slate-800/50 rounded-2xl p-4 md:p-6 border border-slate-700">
                    <h2 className="text-lg font-bold text-white mb-4">{t("async_select_opponent")}</h2>

                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin text-4xl mb-4">⏳</div>
                            <p className="text-gray-400">{t("loading")}</p>
                        </div>
                    ) : opponents.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🏜️</div>
                            <p className="text-gray-400">{t("async_no_opponents")}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {opponents.map((opponent) => (
                                <div
                                    key={opponent.player_id}
                                    className="bg-slate-700/50 hover:bg-slate-700 rounded-xl p-4 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        {/* Opponent Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-white font-bold text-lg">
                                                    {opponent.player_name}
                                                </span>
                                                <span className="text-amber-400 text-sm">
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
                                                            className="w-10 h-10 rounded border border-slate-500 overflow-hidden bg-slate-800"
                                                            title={unit.name}
                                                        >
                                                            <Image
                                                                src={`/assets/sprites/${baseId}.webp`}
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

                {/* Info */}
                <div className="mt-6 text-center text-gray-500 text-sm">
                    <p>{t("async_info")}</p>
                </div>
            </div>
        </main>
    );
}
