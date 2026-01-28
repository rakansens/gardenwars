"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from 'next/dynamic';
import { usePlayerData } from "@/hooks/usePlayerData";
import unitsData from "@/data/units.json";
import type { UnitDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";

const PhaserGame = dynamic(() => import('@/components/game/PhaserGame'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-[#87CEEB] flex items-center justify-center text-white">Loading Game Engine...</div>
});

const allUnits = unitsData as UnitDefinition[];
// 敵以外
const allyUnits = allUnits.filter(u => !u.id.startsWith("enemy_"));

export default function GardenPage() {
    const { unitInventory, selectedTeam, isLoaded } = usePlayerData();
    const [gardenUnits, setGardenUnits] = useState<UnitDefinition[]>([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!isLoaded) return;

        // 庭に配置するユニットを選定 (最大20体)
        // 優先順位:
        // 1. 編成チーム (selectedTeam)
        // 2. 所持しているSSR/SR (高レア)
        // 3. その他所持ユニットからランダム

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

        // 2. Owned (filter out enemies just in case, though inventory should be allies)
        const owned = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);

        // SSR/SR/UR優先
        const highRare = owned.filter(id => {
            const def = allUnits.find(u => u.id === id);
            return def && ['SR', 'SSR', 'UR'].includes(def.rarity);
        });
        // シャッフル
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
    }, [isLoaded, selectedTeam, unitInventory]);

    if (!isLoaded || !ready) {
        return <div className="min-h-screen bg-[#87CEEB] flex items-center justify-center text-white text-2xl font-bold">Loading Garden...</div>;
    }

    return (
        <main className="min-h-screen bg-[#87CEEB] relative overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
                <div className="pointer-events-auto">
                    <Link href="/" className="btn bg-white/50 hover:bg-white/80 text-green-900 border-green-500 font-bold">
                        ← Home
                    </Link>
                </div>
                <div className="bg-white/60 p-4 rounded-xl backdrop-blur-sm border-2 border-white/80 shadow-lg text-center">
                    <h1 className="text-2xl font-bold text-green-800">🌱 Paradise Garden</h1>
                    <p className="text-sm text-green-700 font-bold">{gardenUnits.length} friends playing in the garden</p>
                </div>
                <div className="w-20"></div>
            </div>

            {/* Phaser Game (Canvas) */}
            <div className="absolute inset-0 z-0">
                <PhaserGame
                    mode="garden"
                    gardenUnits={gardenUnits}
                />
            </div>

            {/* Overlay hint */}
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-10">
                <p className="text-white font-bold drop-shadow-md bg-black/20 inline-block px-4 py-1 rounded-full backdrop-blur-sm">
                    Tap a friend to see them hop!
                </p>
            </div>
        </main>
    );
}
