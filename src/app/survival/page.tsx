"use client";

import { useState } from "react";
import Link from "next/link";
import unitsData from "@/data/units";
import type { UnitDefinition, SurvivalDifficulty } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import RarityFrame from "@/components/ui/RarityFrame";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/layout/PageHeader";

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

const STORAGE_KEY = "survival_main_unit";

interface DifficultyOption {
  id: SurvivalDifficulty;
  icon: string;
  gradient: string;
  diffBadge: string;
}

const difficultyOptions: DifficultyOption[] = [
  { id: "easy", icon: "🌿", gradient: "from-emerald-500 to-teal-600", diffBadge: "bg-green-500" },
  { id: "normal", icon: "⚔️", gradient: "from-amber-500 to-orange-600", diffBadge: "bg-amber-500" },
  { id: "hard", icon: "💀", gradient: "from-red-600 to-red-900", diffBadge: "bg-red-600" },
];

const difficultyLabels: Record<SurvivalDifficulty, Record<string, string>> = {
  easy: { ja: "イージー", en: "Easy" },
  normal: { ja: "ノーマル", en: "Normal" },
  hard: { ja: "ハード", en: "Hard" },
};

const difficultyDescs: Record<SurvivalDifficulty, Record<string, string>> = {
  easy: { ja: "初心者向け。ゆっくりした敵の波が押し寄せる。", en: "For beginners. Slower enemy waves." },
  normal: { ja: "バランスの取れた難易度。敵が強くなる。", en: "Balanced difficulty. Enemies get stronger." },
  hard: { ja: "最高難易度。大量の強敵が襲いかかる！", en: "Hardest difficulty. Massive strong enemy waves!" },
};

const difficultyDetails: Record<SurvivalDifficulty, Record<string, string[]>> = {
  easy: { ja: ["👾 敵HP ×0.8", "🐢 敵速度 ×0.8", "⏱ スポーン 遅め"], en: ["👾 Enemy HP ×0.8", "🐢 Speed ×0.8", "⏱ Slow spawn"] },
  normal: { ja: ["👾 敵HP ×1.0", "🏃 敵速度 ×1.0", "⏱ スポーン 標準"], en: ["👾 Enemy HP ×1.0", "🏃 Speed ×1.0", "⏱ Normal spawn"] },
  hard: { ja: ["👾 敵HP ×1.5", "🏃‍♂️ 敵速度 ×1.3", "⏱ スポーン 猛烈"], en: ["👾 Enemy HP ×1.5", "🏃‍♂️ Speed ×1.3", "⏱ Fast spawn"] },
};

export default function SurvivalPage() {
  const { t, language } = useLanguage();
  const { selectedTeam, unitInventory, isLoaded } = usePlayerData();
  const [playerUnit, setPlayerUnit] = useState<UnitDefinition | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // 初回ロード（localStorage優先）
  if (isLoaded && !initialized) {
    setInitialized(true);
    let picked: UnitDefinition | undefined;

    // 1. localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) picked = playableUnits.find(u => u.id === saved);
    } catch { }
    // 2. selectedTeam
    if (!picked && selectedTeam.length > 0) {
      picked = playableUnits.find(u => u.id === selectedTeam[0]);
    }
    // 3. 所持ユニット
    if (!picked) {
      const ownedIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
      picked = playableUnits.find(u => ownedIds.includes(u.id));
    }
    if (!picked) picked = playableUnits[0];
    if (picked) setPlayerUnit(picked);
  }

  // 全プレイアブルユニット（所持優先ソート）
  const selectableUnits = [...playableUnits].sort((a, b) => {
    const aOwned = (unitInventory[a.id] ?? 0) > 0 ? 1 : 0;
    const bOwned = (unitInventory[b.id] ?? 0) > 0 ? 1 : 0;
    return bOwned - aOwned;
  });

  const getUnitName = (unit: UnitDefinition) => {
    const translated = t(unit.id);
    return translated !== unit.id ? translated : unit.name;
  };

  const handleSelectUnit = (unit: UnitDefinition) => {
    setPlayerUnit(unit);
    try { localStorage.setItem(STORAGE_KEY, unit.id); } catch { }
    setIsUnitModalOpen(false);
  };

  const buildUrl = (diff: SurvivalDifficulty) => {
    const unitParam = playerUnit?.id || "";
    return `/survival/${diff}?unit=${unitParam}`;
  };

  if (!isLoaded) {
    return <LoadingSpinner icon="🧟" fullScreen />;
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title="🧟 Survival"
        rightButton={{
          href: "/team",
          label: t("team"),
          icon: "🎮",
        }}
      />

      <div className="container">
        {/* 説明 */}
        <div className="text-center mb-6 text-amber-900/70 dark:text-gray-400">
          <p className="text-lg font-medium">
            {language === "ja" ? "次々と襲い来る敵を倒して生き残れ！" : "Survive waves of enemies!"}
          </p>
        </div>

        {/* ===== 編成セクション ===== */}
        <div className="max-w-4xl mx-auto mb-6">
          <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 uppercase tracking-wider">
            {language === "ja" ? "📋 編成" : "📋 Formation"}
          </h2>

          <div className="card">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {playerUnit ? (
                  <RarityFrame
                    unitId={playerUnit.id}
                    unitName={getUnitName(playerUnit)}
                    rarity={playerUnit.rarity}
                    size="lg"
                    baseUnitId={playerUnit.baseUnitId || playerUnit.atlasKey}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-amber-400 flex items-center justify-center text-2xl">?</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  {language === "ja" ? "プレイヤーユニット" : "Player Unit"}
                </p>
                <h3 className="text-lg font-bold text-amber-950 dark:text-white truncate">
                  {playerUnit ? getUnitName(playerUnit) : "—"}
                </h3>
                {playerUnit && (
                  <div className="flex gap-3 mt-1 text-[11px]">
                    <span className="text-red-500" title="HP">❤️ {Math.round(playerUnit.maxHp * 3.2)}</span>
                    <span className="text-blue-500" title={language === "ja" ? "移動速度" : "Speed"}>💨 {Math.round(playerUnit.speed * 3.5)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsUnitModalOpen(true)}
                className="btn btn-secondary text-xs px-3 py-1.5 shrink-0"
              >
                {language === "ja" ? "変更" : "Change"}
              </button>
            </div>
          </div>
        </div>

        {/* ===== 難易度選択 ===== */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 uppercase tracking-wider">
            {language === "ja" ? "🗺️ 難易度" : "🗺️ Difficulty"}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {difficultyOptions.map((option) => {
              const label = difficultyLabels[option.id]?.[language] || option.id;
              const desc = difficultyDescs[option.id]?.[language] || "";
              const details = difficultyDetails[option.id]?.[language] || [];

              return (
                <Link
                  key={option.id}
                  href={buildUrl(option.id)}
                  className="card relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all"
                >
                  {/* バナー */}
                  <div className="relative h-28 -mx-4 -mt-4 mb-3 overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${option.gradient}`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-50 dark:from-slate-800 via-transparent to-transparent" />
                    <div className="absolute top-3 right-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${option.diffBadge}`}>
                        {label}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-3 text-white">
                      <div className="text-3xl drop-shadow-lg">{option.icon}</div>
                    </div>
                  </div>

                  <h2 className="text-lg font-bold text-amber-950 dark:text-white mb-1">{label}</h2>
                  <p className="text-sm text-amber-900/70 dark:text-gray-400 mb-3">{desc}</p>

                  <div className="flex gap-2 text-[11px] text-amber-700 dark:text-amber-400 flex-wrap">
                    {details.map((d, i) => (
                      <span key={i} className="bg-amber-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{d}</span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ヒント */}
        <div className="mt-6 max-w-4xl mx-auto">
          <div className="card text-center text-amber-900/70 dark:text-gray-400 text-sm">
            💡 {language === "ja"
              ? "敵を倒すとXPオーブが出現！集めてレベルアップしよう！"
              : "Defeat enemies to spawn XP orbs! Collect them to level up!"}
          </div>
        </div>
      </div>

      {/* ===== ユニット選択モーダル ===== */}
      <Modal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} size="lg">
        <div className="p-5">
          <h2 className="text-xl font-bold text-amber-950 dark:text-white mb-1">
            {language === "ja" ? "ユニット選択" : "Select Unit"}
          </h2>
          <p className="text-sm text-amber-900/70 dark:text-gray-400 mb-4">
            {language === "ja" ? "サバイバルで操作するユニットを選ぼう" : "Choose a unit to control"}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {selectableUnits.map((unit) => {
              const isSelected = playerUnit?.id === unit.id;
              const owned = (unitInventory[unit.id] ?? 0) > 0;
              return (
                <button
                  key={unit.id}
                  onClick={() => handleSelectUnit(unit)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${isSelected
                    ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30"
                    : owned
                      ? "border-transparent hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      : "border-transparent opacity-60 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
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
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">{getUnitName(unit)}</span>
                  <div className="text-[8px] text-amber-700/60 dark:text-gray-500 leading-snug">
                    <span>❤️{Math.round(unit.maxHp * 3.2)} 💨{Math.round(unit.speed * 3.5)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </main>
  );
}
