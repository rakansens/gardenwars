"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from 'next/dynamic';
import { usePlayerData } from "@/hooks/usePlayerData";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { eventBus, GameEvents } from "@/game/utils/EventBus";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { incrementGardenVisits } from "@/lib/supabase";
import { GARDEN_BACKGROUNDS, type GardenBackgroundId } from "@/game/constants/gardenBackgrounds";
import { hasAnimation } from "@/lib/sprites";

const GARDEN_BG_KEY = "garden_background";

const PhaserGame = dynamic(() => import('@/components/game/PhaserGame'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-[#87CEEB] dark:bg-slate-800 flex items-center justify-center text-white">Loading Game Engine...</div>
});

const allUnits = unitsData as UnitDefinition[];
// 敵以外
const allyUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

export default function GardenPage() {
    const { unitInventory, selectedTeam, gardenUnits: savedGardenUnitIds, setGardenUnits: saveGardenUnits, isLoaded, addCoins, coins } = usePlayerData();
    const { t } = useLanguage();
    const { playerId } = useAuth();
    const [displayUnits, setDisplayUnits] = useState<UnitDefinition[]>([]);
    const [ready, setReady] = useState(false);
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
    const [editUnits, setEditUnits] = useState<string[]>([]);
    const [coinEffect, setCoinEffect] = useState(false);
    const [isBgSelectorOpen, setIsBgSelectorOpen] = useState(false);
    const [currentBgId, setCurrentBgId] = useState<GardenBackgroundId>('garden_main');
    const [modalRarityFilter, setModalRarityFilter] = useState<Rarity | "ALL" | "ANIMATED">("ALL");
    const [motionMode, setMotionMode] = useState<'normal' | 'attack'>('normal');

    // レアリティタブ設定
    const rarityTabs: { key: Rarity | "ALL" | "ANIMATED"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gradient-to-r from-gray-500 to-gray-600" },
        { key: "ANIMATED", label: "🎬", color: "bg-gradient-to-r from-emerald-400 to-teal-500" },
        { key: "N", label: "N", color: "bg-gradient-to-r from-gray-400 to-gray-500" },
        { key: "R", label: "R", color: "bg-gradient-to-r from-blue-400 to-blue-600" },
        { key: "SR", label: "SR", color: "bg-gradient-to-r from-purple-400 to-purple-600" },
        { key: "SSR", label: "SSR", color: "bg-gradient-to-r from-amber-400 to-yellow-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

    // 背景設定をローカルストレージから読み込み
    useEffect(() => {
        try {
            const saved = localStorage.getItem(GARDEN_BG_KEY);
            if (saved && GARDEN_BACKGROUNDS.some(bg => bg.id === saved)) {
                setCurrentBgId(saved as GardenBackgroundId);
            }
        } catch {}
    }, []);

    // 背景を変更
    const changeBackground = (bgId: GardenBackgroundId) => {
        setCurrentBgId(bgId);
        localStorage.setItem(GARDEN_BG_KEY, bgId);
        eventBus.emit(GameEvents.GARDEN_BG_CHANGE, { bgId });
        setIsBgSelectorOpen(false);
    };

    // Helper
    const getUnitName = (unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    };

    // Load initial units from usePlayerData
    useEffect(() => {
        if (!isLoaded) return;

        // Try to load from saved data (usePlayerData)
        if (savedGardenUnitIds && savedGardenUnitIds.length > 0) {
            const validUnits = savedGardenUnitIds
                .map(id => allUnits.find(u => u.id === id))
                .filter((u): u is UnitDefinition => !!u);

            if (validUnits.length > 0) {
                setDisplayUnits(validUnits);
                setReady(true);
                return; // Loaded from save
            }
        }

        // Auto-selection if no save
        autoPickUnits();
    }, [isLoaded, selectedTeam, unitInventory, savedGardenUnitIds]);

    // Track garden visits for ranking
    useEffect(() => {
        if (playerId && isLoaded) {
            incrementGardenVisits(playerId).catch(err => {
                console.warn("Failed to increment garden visits:", err);
            });
        }
    }, [playerId, isLoaded]);

    const autoPickUnits = () => {
        const pickedIds = new Set<string>();
        const pickedUnits: UnitDefinition[] = [];

        const addUnit = (id: string) => {
            if (pickedIds.has(id)) return;
            const def = allUnits.find(u => u.id === id);
            if (def) {
                pickedIds.add(id);
                pickedUnits.push(def);
            }
        };

        // 1. Team
        selectedTeam.forEach(id => addUnit(id));

        // 2. Owned (filter out enemies)
        const owned = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);

        // SSR/SR/UR priority
        const highRare = owned.filter(id => {
            const def = allUnits.find(u => u.id === id);
            return def && ['SR', 'SSR', 'UR'].includes(def.rarity);
        });
        highRare.sort(() => Math.random() - 0.5);
        highRare.forEach(id => {
            if (pickedUnits.length < 20) addUnit(id);
        });

        // 3. Others (shuffle)
        const others = owned.filter(id => !pickedIds.has(id));
        others.sort(() => Math.random() - 0.5);
        others.forEach(id => {
            if (pickedUnits.length < 20) addUnit(id);
        });

        setDisplayUnits(pickedUnits);
        // Also save to hook
        saveGardenUnits(pickedUnits.map(u => u.id));
        setReady(true);
    };

    const openEditModal = () => {
        setEditUnits(displayUnits.map(u => u.id));
        setIsSelectModalOpen(true);
    };

    const toggleUnitSelection = (id: string) => {
        if (editUnits.includes(id)) {
            setEditUnits(prev => prev.filter(uid => uid !== id));
        } else {
            if (editUnits.length >= 20) return; // Max limit
            setEditUnits(prev => [...prev, id]);
        }
    };

    const saveSelection = () => {
        const selectedDefs = editUnits
            .map(id => allUnits.find(u => u.id === id))
            .filter((u): u is UnitDefinition => !!u);

        setDisplayUnits(selectedDefs);
        // Save via usePlayerData hook (syncs to localStorage and Supabase)
        saveGardenUnits(editUnits);
        setIsSelectModalOpen(false);
    };

    const handleAutoPickInModal = () => {
        // フィルターされたレアリティ内でオートピック
        const ownedIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
        let candidates = allUnits.filter(u => ownedIds.includes(u.id));

        // フィルター適用
        if (modalRarityFilter === "ANIMATED") {
            // アニメーション有りキャラのみ
            candidates = candidates.filter(u => {
                const spriteId = u.baseUnitId || u.id;
                return hasAnimation(spriteId);
            });
        } else if (modalRarityFilter !== "ALL") {
            // レアリティフィルター
            candidates = candidates.filter(u => u.rarity === modalRarityFilter);
        }

        // シャッフルして最大20体選択
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, 20);

        setEditUnits(picked.map(u => u.id));
    };

    const showCoinEffect = () => {
        setCoinEffect(true);
        setTimeout(() => setCoinEffect(false), 600);
    };

    const handleFeed = (type: string) => {
        console.log('GardenPage: Emitting FEED', type);
        eventBus.emit(GameEvents.GARDEN_FEED, { type });
        // コイン報酬
        addCoins(1);
        showCoinEffect();
    };

    const handleClean = () => {
        console.log('GardenPage: Emitting CLEAN');
        eventBus.emit(GameEvents.GARDEN_CLEAN);
        // コイン報酬
        addCoins(1);
        showCoinEffect();
    };

    const toggleMotionMode = () => {
        const newMode = motionMode === 'normal' ? 'attack' : 'normal';
        setMotionMode(newMode);
        eventBus.emit(GameEvents.GARDEN_MOTION_MODE, { mode: newMode });
    };

    if (!isLoaded || !ready) {
        return (
            <div className="min-h-screen bg-[#87CEEB] dark:bg-slate-900">
                <LoadingSpinner icon="🌱" fullScreen />
            </div>
        );
    }

    // Filter owned units for modal list
    const ownedUnitIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
    const ownedUnits = allUnits.filter(u => ownedUnitIds.includes(u.id));

    // モーダル用にフィルター
    const filteredOwnedUnits = modalRarityFilter === "ALL"
        ? ownedUnits
        : modalRarityFilter === "ANIMATED"
            ? ownedUnits.filter(u => {
                const spriteId = u.baseUnitId || u.id;
                return hasAnimation(spriteId);
            })
            : ownedUnits.filter(u => u.rarity === modalRarityFilter);

    return (
        <main className="min-h-screen bg-[#87CEEB] dark:bg-slate-900 relative overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
                <div className="pointer-events-auto">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                </div>
                <div className="bg-white/60 dark:bg-slate-800/80 p-4 rounded-xl backdrop-blur-sm border-2 border-white/80 dark:border-slate-600 shadow-lg text-center">
                    <h1 className="text-2xl font-bold text-green-800 dark:text-green-300">{t("garden_title")}</h1>
                    <p className="text-sm text-green-700 dark:text-green-400 font-bold">{displayUnits.length} {t("garden_hint")}</p>
                    <div className="mt-2 flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                        <span>💰</span>
                        <span className={`transition-all ${coinEffect ? 'scale-125 text-green-500' : ''}`}>
                            {coins.toLocaleString()}
                        </span>
                        {coinEffect && <span className="text-green-500 text-sm animate-bounce">+1</span>}
                    </div>
                </div>
                <div className="pointer-events-auto flex gap-2">
                    <button
                        onClick={() => setIsBgSelectorOpen(true)}
                        className="btn bg-green-500/80 hover:bg-green-600 dark:bg-green-600/80 dark:hover:bg-green-500 text-white border-green-400 dark:border-green-500 font-bold shadow-md"
                        title={t("garden_change_bg")}
                    >
                        🎨
                    </button>
                    <button
                        onClick={openEditModal}
                        className="btn bg-blue-500/80 hover:bg-blue-600 dark:bg-blue-600/80 dark:hover:bg-blue-500 text-white border-blue-400 dark:border-blue-500 font-bold shadow-md"
                    >
                        {t("edit_garden")}
                    </button>
                </div>
            </div>

            {/* Phaser Game (Canvas) */}
            <div className="absolute inset-0 z-0">
                <PhaserGame
                    mode="garden"
                    gardenUnits={displayUnits}
                    gardenBackgroundId={currentBgId}
                />
            </div>

            {/* Action Bar */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4 z-10 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-4 bg-white/40 dark:bg-slate-800/60 p-4 rounded-full backdrop-blur-md border-2 border-white/60 dark:border-slate-600 shadow-xl">
                    <div className="flex gap-2 mr-4 border-r-2 border-white/50 dark:border-slate-600 pr-4">
                        <button onClick={() => handleFeed('n_apple')} className="w-16 h-16 rounded-full bg-red-400 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 border-4 border-white dark:border-slate-300 shadow-lg flex items-center justify-center text-3xl transition-transform hover:scale-110 active:scale-95" title="Feed Apple">
                            🍎
                        </button>
                        <button onClick={() => handleFeed('n_carrot')} className="w-16 h-16 rounded-full bg-orange-400 hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400 border-4 border-white dark:border-slate-300 shadow-lg flex items-center justify-center text-3xl transition-transform hover:scale-110 active:scale-95" title="Feed Carrot">
                            🥕
                        </button>
                        <button onClick={() => handleFeed('n_mushroom')} className="w-16 h-16 rounded-full bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500 border-4 border-white dark:border-slate-300 shadow-lg flex items-center justify-center text-3xl transition-transform hover:scale-110 active:scale-95" title="Feed Mushroom">
                            🍄
                        </button>
                    </div>

                    <button onClick={handleClean} className="w-20 h-20 rounded-full bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 border-4 border-white dark:border-slate-300 shadow-lg flex items-center justify-center text-4xl transition-transform hover:scale-110 active:scale-95" title="Clean Garden">
                        🧹
                    </button>

                    <div className="ml-4 border-l-2 border-white/50 dark:border-slate-600 pl-4">
                        <button
                            onClick={toggleMotionMode}
                            className={`w-16 h-16 rounded-full border-4 border-white dark:border-slate-300 shadow-lg flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95 ${
                                motionMode === 'attack'
                                    ? 'bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500 animate-pulse'
                                    : 'bg-indigo-400 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400'
                            }`}
                            title={motionMode === 'attack' ? t("garden_motion_normal") : t("garden_motion_attack")}
                        >
                            {motionMode === 'attack' ? '⚔️' : '😊'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Background Selector Modal */}
            {isBgSelectorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border-4 border-green-500 rounded-3xl p-6 w-full max-w-2xl shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-4 text-center">{t("garden_select_bg")}</h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                            {GARDEN_BACKGROUNDS.map(bg => (
                                <button
                                    key={bg.id}
                                    onClick={() => changeBackground(bg.id)}
                                    className={`relative aspect-video rounded-xl overflow-hidden border-4 transition-all hover:scale-105 ${
                                        currentBgId === bg.id
                                            ? 'border-green-400 shadow-[0_0_15px_#4ade80]'
                                            : 'border-slate-600 hover:border-slate-400'
                                    }`}
                                >
                                    <Image
                                        src={`/assets/backgrounds/${bg.id}.webp`}
                                        alt={bg.name}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 50vw, 33vw"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 px-2">
                                        <span className="text-white text-sm font-bold">{bg.name}</span>
                                    </div>
                                    {currentBgId === bg.id && (
                                        <div className="absolute top-2 right-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center">
                                            <span className="text-white text-sm">✓</span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-center">
                            <button
                                onClick={() => setIsBgSelectorOpen(false)}
                                className="btn btn-secondary"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Modal */}
            {isSelectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 p-2 sm:p-4 overflow-y-auto animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border-4 border-green-500 rounded-3xl p-4 sm:p-6 w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl relative my-2 sm:my-4">
                        <h2 className="text-2xl font-bold text-white mb-2 text-center">{t("select_garden_friends")}</h2>
                        <p className="text-center text-gray-400 mb-2">
                            {t("select_hint").replace("20", `${editUnits.length}/20`)}
                        </p>

                        {/* Rarity Filter Tabs */}
                        <div className="flex justify-center gap-1 sm:gap-2 mb-4 flex-wrap">
                            {rarityTabs.map(tab => {
                                const count = tab.key === "ALL"
                                    ? ownedUnits.length
                                    : tab.key === "ANIMATED"
                                        ? ownedUnits.filter(u => {
                                            const spriteId = u.baseUnitId || u.id;
                                            return hasAnimation(spriteId);
                                        }).length
                                        : ownedUnits.filter(u => u.rarity === tab.key).length;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setModalRarityFilter(tab.key)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                                            modalRarityFilter === tab.key
                                                ? `${tab.color} text-white shadow-lg scale-105`
                                                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                        }`}
                                    >
                                        {tab.label} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {/* Unit Grid */}
                        <div className="flex-1 overflow-y-auto p-4 bg-black/30 rounded-xl mb-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 content-start">
                            {filteredOwnedUnits.map(unit => {
                                const isSelected = editUnits.includes(unit.id);
                                return (
                                    <div
                                        key={unit.id}
                                        className={`relative cursor-pointer transition-all duration-100 ${isSelected ? 'scale-95' : 'hover:scale-105 opacity-60 hover:opacity-100'}`}
                                        onClick={() => toggleUnitSelection(unit.id)}
                                    >
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={getUnitName(unit)}
                                            rarity={unit.rarity}
                                            size="sm"
                                            showLabel={false}
                                            baseUnitId={unit.baseUnitId}
                                        />
                                        {isSelected && (
                                            <div className="absolute inset-0 border-4 border-green-500 rounded-lg shadow-[0_0_10px_#4caf50] pointer-events-none flex items-center justify-center bg-green-500/20">
                                                <span className="text-2xl font-bold drop-shadow-md">✓</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex justify-between gap-4">
                            <button
                                onClick={handleAutoPickInModal}
                                className="btn btn-secondary"
                            >
                                🔄 {t("auto_pick")}
                            </button>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsSelectModalOpen(false)}
                                    className="btn btn-secondary"
                                >
                                    {t("cancel")}
                                </button>
                                <button
                                    onClick={saveSelection}
                                    className="btn btn-primary"
                                >
                                    ✓ {t("save_selection")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
