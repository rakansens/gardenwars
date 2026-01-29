"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from 'next/dynamic';
import { usePlayerData } from "@/hooks/usePlayerData";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import { eventBus, GameEvents } from "@/game/utils/EventBus";
import { useLanguage } from "@/contexts/LanguageContext";

const PhaserGame = dynamic(() => import('@/components/game/PhaserGame'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-[#87CEEB] flex items-center justify-center text-white">Loading Game Engine...</div>
});

const allUnits = unitsData as UnitDefinition[];
// 敵以外
const allyUnits = allUnits.filter(u => !u.id.startsWith("enemy_"));

export default function GardenPage() {
    const { unitInventory, selectedTeam, isLoaded } = usePlayerData();
    const { t } = useLanguage();
    const [gardenUnits, setGardenUnits] = useState<UnitDefinition[]>([]);
    const [ready, setReady] = useState(false);
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
    const [editUnits, setEditUnits] = useState<string[]>([]);

    // ... (logic from line 29-132 is unchanged so I won't repeat it all, but I need to substitute the whole function body or just the parts I touch. Since I am using replace_file_content, I need to match the block. I will replace the component body.)
    // Wait, replacing the whole body is risky if I miss something.
    // I will replace specific blocks.

    // Helper
    const getUnitName = (unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    };

    // Load initial units
    useEffect(() => {
        if (!isLoaded) return;

        // Try to load from localStorage
        const saved = localStorage.getItem('garden_selection');
        if (saved) {
            try {
                const savedIds = JSON.parse(saved) as string[];
                const validUnits = savedIds
                    .map(id => allUnits.find(u => u.id === id))
                    .filter((u): u is UnitDefinition => !!u);

                if (validUnits.length > 0) {
                    setGardenUnits(validUnits);
                    setReady(true);
                    return; // Loaded from save
                }
            } catch (e) {
                console.error("Failed to parse saved garden selection", e);
            }
        }

        // Auto-selection if no save
        autoPickUnits();
    }, [isLoaded, selectedTeam, unitInventory]);

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

        setGardenUnits(pickedUnits);
        setReady(true);
    };

    const openEditModal = () => {
        setEditUnits(gardenUnits.map(u => u.id));
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

        setGardenUnits(selectedDefs);
        localStorage.setItem('garden_selection', JSON.stringify(editUnits));
        setIsSelectModalOpen(false);
    };

    const handleAutoPickInModal = () => {
        localStorage.removeItem('garden_selection');
        autoPickUnits();
        setIsSelectModalOpen(false);
    };

    const handleFeed = (type: string) => {
        console.log('GardenPage: Emitting FEED', type);
        eventBus.emit(GameEvents.GARDEN_FEED, { type });
    };

    const handleClean = () => {
        console.log('GardenPage: Emitting CLEAN');
        eventBus.emit(GameEvents.GARDEN_CLEAN);
    };

    if (!isLoaded || !ready) {
        return <div className="min-h-screen bg-[#87CEEB] flex items-center justify-center text-white text-2xl font-bold">{t("loading")}</div>;
    }

    // Filter owned units for modal list
    const ownedUnitIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
    const ownedUnits = allUnits.filter(u => ownedUnitIds.includes(u.id));

    return (
        <main className="min-h-screen bg-[#87CEEB] relative overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
                <div className="pointer-events-auto">
                    <Link href="/" className="btn bg-white/50 hover:bg-white/80 text-green-900 border-green-500 font-bold">
                        {t("back_to_home")}
                    </Link>
                </div>
                <div className="bg-white/60 p-4 rounded-xl backdrop-blur-sm border-2 border-white/80 shadow-lg text-center">
                    <h1 className="text-2xl font-bold text-green-800">{t("garden_title")}</h1>
                    <p className="text-sm text-green-700 font-bold">{gardenUnits.length} {t("garden_hint")}</p>
                </div>
                <div className="pointer-events-auto">
                    <button
                        onClick={openEditModal}
                        className="btn bg-blue-500/80 hover:bg-blue-600 text-white border-blue-400 font-bold shadow-md"
                    >
                        {t("edit_garden")}
                    </button>
                </div>
            </div>

            {/* Phaser Game (Canvas) */}
            <div className="absolute inset-0 z-0">
                <PhaserGame
                    mode="garden"
                    gardenUnits={gardenUnits}
                />
            </div>

            {/* Action Bar */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4 z-10 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-4 bg-white/40 p-4 rounded-full backdrop-blur-md border-2 border-white/60 shadow-xl">
                    <div className="flex gap-2 mr-4 border-r-2 border-white/50 pr-4">
                        <button onClick={() => handleFeed('n_apple')} className="w-16 h-16 rounded-full bg-red-400 hover:bg-red-500 border-4 border-white shadow-lg flex items-center justify-center text-3xl transition-transform hover:scale-110 active:scale-95" title="Feed Apple">
                            🍎
                        </button>
                        <button onClick={() => handleFeed('n_carrot')} className="w-16 h-16 rounded-full bg-orange-400 hover:bg-orange-500 border-4 border-white shadow-lg flex items-center justify-center text-3xl transition-transform hover:scale-110 active:scale-95" title="Feed Carrot">
                            🥕
                        </button>
                        <button onClick={() => handleFeed('n_mushroom')} className="w-16 h-16 rounded-full bg-amber-700 hover:bg-amber-800 border-4 border-white shadow-lg flex items-center justify-center text-3xl transition-transform hover:scale-110 active:scale-95" title="Feed Mushroom">
                            🍄
                        </button>
                    </div>

                    <button onClick={handleClean} className="w-20 h-20 rounded-full bg-sky-500 hover:bg-sky-600 border-4 border-white shadow-lg flex items-center justify-center text-4xl transition-transform hover:scale-110 active:scale-95" title="Clean Garden">
                        🧹
                    </button>
                </div>
            </div>

            {/* Selection Modal */}
            {isSelectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border-4 border-green-500 rounded-3xl p-6 w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl relative">
                        <h2 className="text-2xl font-bold text-white mb-2 text-center">{t("select_garden_friends")}</h2>
                        <p className="text-center text-gray-400 mb-4">
                            {t("select_hint").replace("20", `${editUnits.length}/20`)}
                        </p>

                        {/* Unit Grid */}
                        <div className="flex-1 overflow-y-auto p-4 bg-black/30 rounded-xl mb-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 content-start">
                            {ownedUnits.map(unit => {
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
                                className="px-6 py-3 rounded-xl bg-orange-600/80 hover:bg-orange-600 text-white font-bold"
                            >
                                {t("auto_pick")}
                            </button>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsSelectModalOpen(false)}
                                    className="px-6 py-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-bold"
                                >
                                    {t("cancel")}
                                </button>
                                <button
                                    onClick={saveSelection}
                                    className="px-8 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-900/50"
                                >
                                    {t("save_selection")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
