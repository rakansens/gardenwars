"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import unitsData from "@/data/units";
import type { UnitDefinition, SurvivalDifficulty } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import RarityFrame from "@/components/ui/RarityFrame";
import Modal from "@/components/ui/Modal";

const PhaserGame = dynamic(() => import("@/components/game/PhaserGame"), { ssr: false });

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

export default function SurvivalPage() {
  const { t } = useLanguage();
  const { selectedTeam, unitInventory, isLoaded } = usePlayerData();
  const [playerUnit, setPlayerUnit] = useState<UnitDefinition | null>(null);
  const [difficulty, setDifficulty] = useState<SurvivalDifficulty | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    let picked: UnitDefinition | undefined;
    if (selectedTeam.length > 0) {
      picked = playableUnits.find(u => u.id === selectedTeam[0]);
    }

    if (!picked) {
      const ownedIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
      picked = playableUnits.find(u => ownedIds.includes(u.id));
    }

    if (!picked) {
      picked = playableUnits[0];
    }

    setPlayerUnit(picked ?? null);
  }, [isLoaded, selectedTeam, unitInventory]);

  const ownedUnits = playableUnits.filter((unit) => (unitInventory[unit.id] ?? 0) > 0);
  const selectableUnits = ownedUnits.length > 0 ? ownedUnits : playableUnits;

  const getUnitName = (unit: UnitDefinition) => {
    const translated = t(unit.id);
    return translated !== unit.id ? translated : unit.name;
  };

  if (!isLoaded || !playerUnit) {
    return <LoadingSpinner icon="🧟" fullScreen />;
  }

  if (!difficulty) {
    const options: { id: SurvivalDifficulty; icon: string; title: string; desc: string; accent: string }[] = [
      {
        id: "easy",
        icon: "🟢",
        title: t("survival_easy"),
        desc: t("survival_easy_desc"),
        accent: "from-emerald-400 to-teal-500",
      },
      {
        id: "normal",
        icon: "🟡",
        title: t("survival_normal"),
        desc: t("survival_normal_desc"),
        accent: "from-amber-400 to-orange-500",
      },
      {
        id: "hard",
        icon: "🔴",
        title: t("survival_hard"),
        desc: t("survival_hard_desc"),
        accent: "from-rose-500 to-red-600",
      },
    ];

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-slate-300 to-amber-400 drop-shadow-lg">
            🧟 {t("survival_select_title")} 🧟
          </h1>
          <p className="text-amber-700/70 dark:text-amber-300/70 mt-3">
            {t("survival_select_desc")}
          </p>
        </div>

        {playerUnit && (
          <div className="w-full max-w-4xl mb-6">
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-3xl p-4 md:p-6 shadow-xl border border-slate-200/60 dark:border-slate-700/40 flex flex-col sm:flex-row items-center gap-4">
              <RarityFrame
                unitId={playerUnit.id}
                unitName={getUnitName(playerUnit)}
                rarity={playerUnit.rarity}
                size="lg"
                baseUnitId={playerUnit.baseUnitId || playerUnit.atlasKey}
              />
              <div className="flex-1 text-center sm:text-left">
                <p className="text-slate-500 dark:text-slate-300 text-sm font-semibold tracking-wide">
                  {t("survival_unit_select")}
                </p>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">
                  {getUnitName(playerUnit)}
                </h2>
                <p className="text-sm text-slate-600/80 dark:text-slate-300/80">
                  {t("survival_unit_select_desc")}
                </p>
              </div>
              <button
                onClick={() => setIsUnitModalOpen(true)}
                className="btn btn-primary"
              >
                {t("survival_unit_change")}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 max-w-4xl w-full">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => setDifficulty(option.id)}
              className="flex-1 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-3xl p-6 md:p-8 text-left hover:shadow-2xl transition-all shadow-xl border border-slate-200/50 dark:border-slate-700/30 hover:scale-[1.02] active:scale-[0.98] group"
            >
              <div className={`bg-gradient-to-br ${option.accent} w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                {option.icon}
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                {option.title}
              </h2>
              <p className="text-slate-600/80 dark:text-slate-300/80 text-sm mb-4">
                {option.desc}
              </p>
              <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                <span className="mr-2">→</span>
                {t("survival_select_hint")}
              </div>
            </button>
          ))}
        </div>

        <Link href="/" className="mt-10 btn btn-secondary">
          ← {t("back_to_home")}
        </Link>

        <Modal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} size="lg">
          <div className="p-5">
            <h2 className="text-xl font-bold text-slate-800 mb-2">{t("survival_unit_select")}</h2>
            <p className="text-sm text-slate-600 mb-4">{t("survival_unit_select_desc")}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectableUnits.map((unit) => {
                const isSelected = playerUnit?.id === unit.id;
                return (
                  <button
                    key={unit.id}
                    onClick={() => {
                      setPlayerUnit(unit);
                      setIsUnitModalOpen(false);
                    }}
                    className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${
                      isSelected ? "border-amber-400 bg-amber-50" : "border-transparent hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <RarityFrame
                      unitId={unit.id}
                      unitName={getUnitName(unit)}
                      rarity={unit.rarity}
                      size="sm"
                      baseUnitId={unit.baseUnitId || unit.atlasKey}
                      count={unitInventory[unit.id]}
                    />
                    <span className="text-[11px] text-slate-600 line-clamp-2">{getUnitName(unit)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      </main>
    );
  }

  const difficultyLabel =
    difficulty === "easy"
      ? t("survival_easy")
      : difficulty === "hard"
        ? t("survival_hard")
        : t("survival_normal");

  return (
    <main className="fixed inset-0 bg-[#1a1a2e] overflow-hidden">
      <div className="absolute top-0 right-0 p-2 sm:p-4 z-20 flex items-center gap-2 pointer-events-none">
        <div className="btn btn-primary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 shadow-lg border-2 border-white/20">
          🧟 {difficultyLabel}
        </div>
        {playerUnit && (
          <div className="btn btn-secondary pointer-events-none text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3">
            🎮 {getUnitName(playerUnit)}
          </div>
        )}
        <button
          onClick={() => setDifficulty(null)}
          className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto"
        >
          {t("survival_change")}
        </button>
        <button
          onClick={() => {
            setDifficulty(null);
            setIsUnitModalOpen(true);
          }}
          className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto"
        >
          {t("survival_unit_change")}
        </button>
        <Link href="/" className="btn btn-secondary text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 pointer-events-auto">
          ← {t("back_to_home")}
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
