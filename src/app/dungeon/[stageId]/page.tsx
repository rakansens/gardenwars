"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import unitsData from "@/data/units";
import type { UnitDefinition, DungeonStageDefinition } from "@/data/types";
import { dungeonStages } from "@/data/dungeon";
import { usePlayerData } from "@/hooks/usePlayerData";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const PhaserGame = dynamic(() => import("@/components/game/PhaserGame"), { ssr: false });

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

export default function DungeonBattlePage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const stageId = params.stageId as string;
    const unitId = searchParams.get("unit");
    const { selectedTeam, isLoaded } = usePlayerData();

    const [stage, setStage] = useState<DungeonStageDefinition | null>(null);
    const [team, setTeam] = useState<UnitDefinition[]>([]);
    const [playerUnit, setPlayerUnit] = useState<UnitDefinition | null>(null);
    const [battleEnded, setBattleEnded] = useState(false);
    const [result, setResult] = useState<{ win: boolean; coins: number } | null>(null);
    const battleEndedRef = useRef(false);

    useEffect(() => {
        if (!isLoaded) return;

        const found = dungeonStages.find(s => s.id === stageId);
        if (!found) {
            router.push("/dungeon");
            return;
        }
        setStage(found);

        // メインユニット選択
        let mainUnit = unitId ? playableUnits.find(u => u.id === unitId) : undefined;
        if (!mainUnit && selectedTeam.length > 0) {
            mainUnit = playableUnits.find(u => u.id === selectedTeam[0]);
        }
        if (!mainUnit) mainUnit = playableUnits[0];
        setPlayerUnit(mainUnit || null);

        // チームをUnitDefinitionに変換
        const teamUnits = selectedTeam
            .map(id => allUnits.find(u => u.id === id))
            .filter((u): u is UnitDefinition => !!u);
        setTeam(teamUnits.length > 0 ? teamUnits : playableUnits.slice(0, 4));
    }, [stageId, router, selectedTeam, isLoaded, unitId]);

    const handleDungeonEnd = useCallback((win: boolean, coinsGained: number) => {
        if (battleEndedRef.current) return;
        battleEndedRef.current = true;
        setBattleEnded(true);
        setResult({ win, coins: coinsGained });

        setTimeout(() => {
            router.push(`/result?mode=dungeon&win=${win}&coins=${coinsGained}&stageId=${stageId}`);
        }, 3000);
    }, [router, stageId]);

    if (!isLoaded || !stage || !playerUnit) {
        return <LoadingSpinner icon="🏰" fullScreen />;
    }

    return (
        <main className="fixed inset-0 bg-[#0d0d1a] overflow-hidden">
            <div className="absolute top-0 right-0 p-2 sm:p-4 z-20 flex items-center gap-2 pointer-events-none">
                <div className="btn btn-primary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 shadow-lg border-2 border-white/20">
                    🏰 {stage.name}
                </div>
                <Link href="/dungeon" className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto">
                    ← 戻る
                </Link>
            </div>

            {battleEnded && result && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
                    <div className="text-center">
                        <p className={`text-4xl font-bold ${result.win ? "text-green-400" : "text-red-400"}`}>
                            {result.win ? "DUNGEON CLEAR!" : "GAME OVER"}
                        </p>
                        <p className="text-white/80 mt-4 text-lg">
                            💰 {result.coins}G 獲得
                        </p>
                        <p className="text-white/50 mt-2 text-sm">
                            リザルト画面へ移動中...
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full h-full flex items-center justify-center">
                <PhaserGame
                    mode="dungeon"
                    dungeonStage={stage}
                    survivalPlayer={playerUnit}
                    team={team}
                    allUnits={allUnits}
                    onDungeonEnd={handleDungeonEnd}
                />
            </div>
        </main>
    );
}
