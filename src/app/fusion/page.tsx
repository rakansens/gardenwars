"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { ConfirmModal } from "@/components/ui/Modal";
import RarityFilter, { type RarityFilterValue } from "@/components/ui/RarityFilter";
import PageHeader from "@/components/layout/PageHeader";

// New modular components
import FusionModeSelector from "@/components/fusion/FusionModeSelector";
import FusionSlot from "@/components/fusion/FusionSlot";
import MaterialGrid from "@/components/fusion/MaterialGrid";
import FusionResultModal from "@/components/fusion/FusionResultModal";

const allUnits = unitsData as UnitDefinition[];
// Only ally units, not bosses
const allyUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

// Rarity weights
const rarityWeights: Record<Rarity, number> = {
    N: 1,
    R: 2,
    SR: 4,
    SSR: 8,
    UR: 16,
};

type FusionMode = 3 | 10;

export default function FusionPage() {
    const { t, language } = useLanguage();
    const { unitInventory, executeFusion, flushToSupabase } = usePlayerData();
    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
    const [fusionResult, setFusionResult] = useState<UnitDefinition | null>(null);
    const [showVideo, setShowVideo] = useState(false);
    const [fusionMode, setFusionMode] = useState<FusionMode>(3);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isFusing, setIsFusing] = useState(false);
    const [fusionError, setFusionError] = useState<string | null>(null);
    const [rarityFilter, setRarityFilter] = useState<RarityFilterValue>("ALL");
    const videoRef = useRef<HTMLVideoElement>(null);

    // Initial pool of units owned (count >= 1)
    const ownedUnitsPool = useMemo(() =>
        allyUnits.filter(u => (unitInventory[u.id] || 0) >= 1),
        [unitInventory]
    );

    // Filter units based on rarity selection
    const availableUnits = useMemo(() => {
        if (rarityFilter === "ALL") return ownedUnitsPool;
        return ownedUnitsPool.filter(u => u.rarity === rarityFilter);
    }, [ownedUnitsPool, rarityFilter]);

    const changeMode = (mode: FusionMode) => {
        setFusionMode(mode);
        setSelectedUnits([]);
    };

    const toggleUnit = (unitId: string) => {
        const owned = unitInventory[unitId] || 0;

        setSelectedUnits(prev => {
            const alreadySelectedCount = prev.filter(id => id === unitId).length;
            const isFull = prev.length >= fusionMode;
            const reachedOwnedLimit = alreadySelectedCount >= owned;

            // Logic:
            // If we can add (not full AND have stock), Add.
            // Else if we have this unit selected, Remove one instance.
            // Using functional state update guarantees 'prev' is fresh, creating an atomic check-and-update.

            if (!isFull && !reachedOwnedLimit) {
                return [...prev, unitId];
            } else if (alreadySelectedCount > 0) {
                // Remove the last instance of this unit (standard toggle behavior)
                // If the user meant "add", but couldn't, we probably shouldn't remove?
                // But standard simple checkbox behavior is toggle. 
                // However, detailed cards usually imply "Select to Add" and "Deselect to Remove".
                // If I click a card that I already have 1 selected (and I own 5), I expect +1.
                // If I click and I'm FULL, I expect nothing (or error shake).
                // But previously we implemented: "Remove if clicked again". 
                // Let's stick to: "If can add, Add. Else if already selected, Remove". 
                // This covers the "Remove" case nicely while prioritizing "Add".

                const idx = prev.lastIndexOf(unitId);
                if (idx >= 0) {
                    return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
                }
            }
            return prev;
        });
    };

    // Auto Pick Logic
    const handleAutoPick = () => {
        const slotsNeeded = fusionMode - selectedUnits.length;
        if (slotsNeeded <= 0) return;

        let candidates: string[] = [];
        availableUnits.forEach(u => {
            const owned = unitInventory[u.id] || 0;
            const alreadySelected = selectedUnits.filter(id => id === u.id).length;
            const availableCount = owned - alreadySelected;
            for (let i = 0; i < availableCount; i++) candidates.push(u.id);
        });

        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        const toAdd = candidates.slice(0, slotsNeeded);

        setSelectedUnits(prev => {
            // Redundant safety check inside functional update
            const space = fusionMode - prev.length;
            if (space <= 0) return prev;
            const actualAdd = toAdd.slice(0, space);
            return [...prev, ...actualAdd];
        });
    };

    const handleClear = () => {
        setSelectedUnits([]);
    };

    const handleFusionClick = () => {
        if (selectedUnits.length !== fusionMode || isFusing) return;
        setShowConfirmModal(true);
    };

    const handleFusion = async () => {
        // Double check limit before executing
        if (selectedUnits.length !== fusionMode || isFusing) return;

        setIsFusing(true);
        setFusionError(null);

        try {
            // Calculate weights
            const selectedDefs = selectedUnits.map(id => allyUnits.find(u => u.id === id)!);
            const totalWeight = selectedDefs.reduce((sum, u) => sum + rarityWeights[u.rarity], 0);
            const avgWeight = totalWeight / fusionMode;

            // Determine Result Rarity
            let resultRarity: Rarity;
            const roll = Math.random() * 100;

            if (fusionMode === 10) {
                // 10x Mode Weights
                if (avgWeight >= 8) {
                    if (roll < 30) resultRarity = "UR";
                    else if (roll < 70) resultRarity = "SSR";
                    else resultRarity = "SR";
                } else if (avgWeight >= 6) {
                    if (roll < 15) resultRarity = "UR";
                    else if (roll < 55) resultRarity = "SSR";
                    else resultRarity = "SR";
                } else if (avgWeight >= 4) {
                    if (roll < 8) resultRarity = "UR";
                    else if (roll < 35) resultRarity = "SSR";
                    else if (roll < 75) resultRarity = "SR";
                    else resultRarity = "R";
                } else if (avgWeight >= 2) {
                    if (roll < 3) resultRarity = "UR";
                    else if (roll < 15) resultRarity = "SSR";
                    else if (roll < 45) resultRarity = "SR";
                    else if (roll < 80) resultRarity = "R";
                    else resultRarity = "N";
                } else {
                    if (roll < 1) resultRarity = "UR";
                    else if (roll < 5) resultRarity = "SSR";
                    else if (roll < 20) resultRarity = "SR";
                    else if (roll < 50) resultRarity = "R";
                    else resultRarity = "N";
                }
            } else {
                // 3x Mode Weights
                if (avgWeight >= 6) {
                    if (roll < 60) resultRarity = "SSR";
                    else resultRarity = "SR";
                } else if (avgWeight >= 4) {
                    if (roll < 20) resultRarity = "SSR";
                    else if (roll < 70) resultRarity = "SR";
                    else resultRarity = "R";
                } else if (avgWeight >= 2) {
                    if (roll < 5) resultRarity = "SSR";
                    else if (roll < 30) resultRarity = "SR";
                    else if (roll < 80) resultRarity = "R";
                    else resultRarity = "N";
                } else {
                    if (roll < 2) resultRarity = "SSR";
                    else if (roll < 8) resultRarity = "SR";
                    else if (roll < 30) resultRarity = "R";
                    else resultRarity = "N";
                }
            }

            // Pick random unit of determined rarity
            const candidates = allyUnits.filter(u => u.rarity === resultRarity);
            const resultUnit = candidates[Math.floor(Math.random() * candidates.length)];

            // Execute Fusion (Supabase)
            const success = await executeFusion(selectedUnits, resultUnit.id);
            if (!success) {
                setFusionError(language === "ja" ? "素材が不足しています" : "Insufficient materials");
                setIsFusing(false);
                return;
            }

            await flushToSupabase();

            setSelectedUnits([]);
            setFusionResult(resultUnit);
            setShowVideo(true);

            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play();
            }
        } catch (error) {
            console.error("Fusion error:", error);
            setFusionError(language === "ja" ? "フュージョンに失敗しました" : "Fusion failed");
            setIsFusing(false);
        }
    };

    const handleVideoEnd = () => {
        setShowVideo(false);
        setIsFusing(false);
    };

    const videoSrc = fusionMode === 10 ? "/assets/videos/fusion_10x.mp4" : "/assets/videos/fusion.mp4";
    const canExecute = selectedUnits.length === fusionMode && !isFusing;

    return (
        <main className="min-h-screen pb-20 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 transition-colors">
            <PageHeader title={`🔮 ${t("fusion")}`} backHref="/" />

            <div className="container max-w-5xl mx-auto px-4">

                {/* Mode Selector */}
                <FusionModeSelector
                    currentMode={fusionMode}
                    onChange={changeMode}
                    disabled={selectedUnits.length > 0} // Disable mode change if units are selected to prevent confusion
                />

                {/* Info Box */}
                <div className={`
                    rounded-xl p-4 mb-8 text-center shadow-sm border border-white/50 backdrop-blur-sm
                    ${fusionMode === 10
                        ? "bg-gradient-to-r from-amber-100/50 via-pink-100/50 to-purple-100/50 dark:from-amber-900/30 dark:via-pink-900/30 dark:to-purple-900/30"
                        : "bg-amber-100/50 dark:bg-amber-900/30"
                    }
                `}>
                    {fusionMode === 3 ? (
                        <p className="text-amber-800 dark:text-amber-200 font-medium">{t("fusion_desc")}</p>
                    ) : (
                        <div>
                            <p className="text-purple-800 dark:text-purple-300 font-bold text-lg mb-1">{t("fusion_10_mode")}</p>
                            <p className="text-pink-700 dark:text-pink-300">{t("fusion_10_desc")}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t("fusion_10_hint")}</p>
                        </div>
                    )}
                </div>

                {/* Slots Area */}
                <div className="bg-white/40 dark:bg-black/20 rounded-2xl p-6 sm:p-8 mb-8 backdrop-blur-md shadow-lg border border-white/20">
                    <div className="flex justify-center gap-3 sm:gap-4 flex-wrap mb-6">
                        {Array.from({ length: fusionMode }).map((_, i) => {
                            const unitId = selectedUnits[i];
                            const unitDef = unitId ? allyUnits.find(u => u.id === unitId) : null;
                            return (
                                <FusionSlot
                                    key={i}
                                    index={i}
                                    unit={unitDef || null}
                                    size={fusionMode === 10 ? "sm" : "md"}
                                    onClick={() => {
                                        if (unitId) {
                                            // Remove at index
                                            setSelectedUnits(prev => [...prev.slice(0, i), ...prev.slice(i + 1)]);
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* Progress & Execute */}
                    <div className="flex flex-col items-center gap-4">
                        <div className={`text-lg font-bold transition-colors ${canExecute ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                            {selectedUnits.length} / {fusionMode} {t("selected")}
                        </div>

                        <button
                            onClick={handleFusionClick}
                            disabled={!canExecute}
                            className={`
                                group relative px-10 py-4 rounded-full font-bold text-xl transition-all duration-300 shadow-xl
                                ${canExecute
                                    ? fusionMode === 10
                                        ? "bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 hover:scale-105 hover:shadow-pink-500/30 text-white animate-pulse-slow"
                                        : "bg-gradient-to-r from-purple-500 to-pink-500 hover:scale-105 hover:shadow-purple-500/30 text-white"
                                    : "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                                }
                            `}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {isFusing ? (
                                    <>
                                        <span className="animate-spin">⏳</span> {t("processing")}
                                    </>
                                ) : (
                                    <>
                                        {fusionMode === 10 ? "⚡ " + t("fusion_10_execute") : "🔮 " + t("fusion_execute")}
                                    </>
                                )}
                            </span>
                            {canExecute && <div className="absolute inset-0 rounded-full bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                    </div>

                    {/* Error Display */}
                    {fusionError && (
                        <div className="mt-6 text-center animate-shake">
                            <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg">
                                <span>⚠️</span>
                                {fusionError}
                                <button
                                    onClick={() => setFusionError(null)}
                                    className="ml-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-200 dark:hover:bg-red-800"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls: Filter & Auto Pick */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    <RarityFilter
                        value={rarityFilter}
                        onChange={setRarityFilter}
                        compact={true} // Use compact to save space
                    />

                    <div className="flex gap-2">
                        <button
                            onClick={handleClear}
                            disabled={selectedUnits.length === 0}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-md transition-all
                                ${selectedUnits.length === 0
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-white text-red-500 hover:bg-red-50 border border-red-200"
                                }
                            `}
                        >
                            <span>🗑️</span>
                            {t("clear") || "Clear"}
                        </button>

                        <button
                            onClick={handleAutoPick}
                            disabled={selectedUnits.length >= fusionMode}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-md transition-all
                                ${selectedUnits.length >= fusionMode
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:scale-105"
                                }
                            `}
                        >
                            <span>🪄</span>
                            {fusionMode === 10 ? "Auto Pick" : "Auto Pick"}
                        </button>
                    </div>
                </div>

                {/* Material Grid */}
                <MaterialGrid
                    units={availableUnits}
                    ownedUnits={unitInventory}
                    selectedUnits={selectedUnits}
                    onToggleUnit={toggleUnit}
                    maxSelectable={fusionMode}
                />
            </div>

            {/* Video Overlay */}
            {showVideo && (
                <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center animate-fade-in">
                    <video
                        ref={videoRef}
                        src={videoSrc}
                        className="w-full h-full object-contain"
                        onEnded={handleVideoEnd}
                        autoPlay
                        muted // Muted for autoplay policy, though user might want sound. 
                        playsInline
                    />
                    <button
                        onClick={handleVideoEnd}
                        className="absolute top-8 right-8 text-white/50 hover:text-white text-4xl font-bold transition-colors z-[101]"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Result Modal */}
            {fusionResult && !showVideo && (
                <FusionResultModal
                    result={fusionResult}
                    onClose={() => {
                        setFusionResult(null);
                        setIsFusing(false);
                    }}
                />
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => !isFusing && setShowConfirmModal(false)}
                onConfirm={() => {
                    setShowConfirmModal(false);
                    handleFusion();
                }}
                icon="🔮"
                title={t("confirm_fusion")}
                message={`${t("fusion_consume_units").replace("{count}", String(fusionMode))} ${t("fusion_warning")}`}
                confirmText={t("fusion_execute")}
                cancelText={t("cancel")}
                confirmColor={fusionMode === 10 ? "pink" : "purple"}
                isLoading={isFusing}
            />
        </main>
    );
}
