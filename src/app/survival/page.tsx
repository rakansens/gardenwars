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
const SURVIVAL_UNIT_KEY = "gardenwars_survival_unit";

export default function SurvivalPage() {
  const { t } = useLanguage();
  const { selectedTeam, unitInventory, isLoaded } = usePlayerData();
  const [playerUnit, setPlayerUnit] = useState<UnitDefinition | null>(null);
  const [difficulty, setDifficulty] = useState<SurvivalDifficulty | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      const storedId = localStorage.getItem(SURVIVAL_UNIT_KEY);
      if (storedId) {
        const storedUnit = playableUnits.find(u => u.id === storedId);
        if (storedUnit && (unitInventory[storedUnit.id] ?? 0) > 0) {
          setPlayerUnit(storedUnit);
          return;
        }
      }
    } catch {}

    if (playerUnit && playableUnits.some(u => u.id === playerUnit.id)) {
      if ((unitInventory[playerUnit.id] ?? 0) > 0) return;
    }

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

    const chosen = picked ?? null;
    setPlayerUnit(chosen);
    if (chosen) {
      try {
        localStorage.setItem(SURVIVAL_UNIT_KEY, chosen.id);
      } catch {}
    }
  }, [isLoaded, selectedTeam, unitInventory, playerUnit]);

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
      <main className="min-h-screen p-4 md:p-6">
        <div className="max-w-4xl mx-auto text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400">
            🧟 {t("survival_select_title")}
          </h1>
          <p className="text-sm text-amber-700/70 dark:text-amber-300/70 mt-2">
            {t("survival_select_desc")}
          </p>
        </div>

        {playerUnit && (
          <div className="max-w-4xl mx-auto mb-6 card flex flex-col sm:flex-row items-center gap-4">
            <RarityFrame
              unitId={playerUnit.id}
              unitName={getUnitName(playerUnit)}
              rarity={playerUnit.rarity}
              size="lg"
              baseUnitId={playerUnit.baseUnitId || playerUnit.atlasKey}
            />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold text-amber-700/70 dark:text-amber-300/70 mb-1">
                {t("survival_unit_select")}
              </p>
              <h2 className="text-xl font-bold text-amber-900 dark:text-white mb-1">
                {getUnitName(playerUnit)}
              </h2>
              <p className="text-sm text-amber-700/70 dark:text-slate-300/70">
                {t("survival_unit_select_desc")}
              </p>
            </div>
            <button onClick={() => setIsUnitModalOpen(true)} className="btn btn-primary text-sm">
              {t("survival_unit_change")}
            </button>
          </div>
        )}

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => setDifficulty(option.id)}
              className="card flex flex-col justify-between gap-4 text-left hover:shadow-xl transition-all active:scale-[0.99]"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm bg-gradient-to-br ${option.accent}`}
                >
                  {option.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-700/80 dark:text-amber-300/80 mb-1">
                    {option.title}
                  </p>
                  <h2 className="text-lg font-bold text-amber-900 dark:text-white">{option.title}</h2>
                  <p className="text-sm text-amber-700/70 dark:text-slate-300/70 mt-2">
                    {option.desc}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-amber-700/80 dark:text-slate-300/80">
                <span>{t("survival_select_hint")}</span>
                <span className="font-semibold text-amber-800">→</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center mt-8">
          <Link href="/" className="btn btn-secondary">
            ← {t("back_to_home")}
          </Link>
        </div>

        <Modal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} size="lg">
          <div className="p-5">
            <h2 className="text-xl font-bold text-amber-900 mb-2">{t("survival_unit_select")}</h2>
            <p className="text-sm text-amber-700/70 mb-4">{t("survival_unit_select_desc")}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectableUnits.map((unit) => {
                const isSelected = playerUnit?.id === unit.id;
                return (
                  <button
                    key={unit.id}
                    onClick={() => {
                      setPlayerUnit(unit);
                      try {
                        localStorage.setItem(SURVIVAL_UNIT_KEY, unit.id);
                      } catch {}
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
