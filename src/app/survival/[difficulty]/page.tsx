"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import unitsData from "@/data/units";
import type { UnitDefinition, SurvivalDifficulty } from "@/data/types";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage } from "@/contexts/LanguageContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const PhaserGame = dynamic(() => import("@/components/game/PhaserGame"), { ssr: false });

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

const VALID_DIFFICULTIES: SurvivalDifficulty[] = ["easy", "normal", "hard"];
const difficultyLabels: Record<SurvivalDifficulty, Record<string, string>> = {
    easy: { ja: "イージー", en: "Easy" },
    normal: { ja: "ノーマル", en: "Normal" },
    hard: { ja: "ハード", en: "Hard" },
};

export default function SurvivalBattlePage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { t, language } = useLanguage();
    const { selectedTeam, isLoaded } = usePlayerData();

    const diffParam = params.difficulty as string;
    const unitId = searchParams.get("unit");

    const [playerUnit, setPlayerUnit] = useState<UnitDefinition | null>(null);
    const [difficulty, setDifficulty] = useState<SurvivalDifficulty | null>(null);

    useEffect(() => {
        if (!isLoaded) return;

        // 難易度チェック
        if (!VALID_DIFFICULTIES.includes(diffParam as SurvivalDifficulty)) {
            router.push("/survival");
            return;
        }
        setDifficulty(diffParam as SurvivalDifficulty);

        // ユニット選択
        let mainUnit = unitId ? playableUnits.find(u => u.id === unitId) : undefined;
        if (!mainUnit) {
            try {
                const saved = localStorage.getItem("survival_main_unit");
                if (saved) mainUnit = playableUnits.find(u => u.id === saved);
            } catch { }
        }
        if (!mainUnit && selectedTeam.length > 0) {
            mainUnit = playableUnits.find(u => u.id === selectedTeam[0]);
        }
        if (!mainUnit) mainUnit = playableUnits[0];
        setPlayerUnit(mainUnit || null);
    }, [diffParam, unitId, router, selectedTeam, isLoaded]);

    const getUnitName = (unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    };

    if (!isLoaded || !difficulty || !playerUnit) {
        return <LoadingSpinner icon="🧟" fullScreen />;
    }

    const label = difficultyLabels[difficulty]?.[language] || difficulty;

    return (
        <main className="fixed inset-0 bg-[#1a1a2e] overflow-hidden">
            <div className="absolute top-0 right-0 p-2 sm:p-4 z-20 flex items-center gap-2 pointer-events-none">
                <div className="btn btn-primary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 shadow-lg border-2 border-white/20">
                    🧟 {label}
                </div>
                {playerUnit && (
                    <div className="btn btn-secondary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3">
                        🎮 {getUnitName(playerUnit)}
                    </div>
                )}
                <Link href="/survival" className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto">
                    ← {language === "ja" ? "戻る" : "Back"}
                </Link>
            </div>

            <div className="absolute top-0 left-0 p-2 sm:p-4 z-20 pointer-events-none">
                <div className="text-white/80 text-xs sm:text-sm bg-black/40 rounded-full px-3 py-1">
                    {t("survival_hint")}
                </div>
            </div>

            <div className="w-full h-full flex items-center justify-center">
                <PhaserGame
                    mode="survival"
                    survivalPlayer={playerUnit}
                    survivalDifficulty={difficulty}
                    allUnits={allUnits}
                />
            </div>
        </main>
    );
}
