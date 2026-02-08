"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { dungeonStages } from "@/data/dungeon";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import unitsData from "@/data/units";
import type { UnitDefinition, DungeonStageDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import Modal from "@/components/ui/Modal";

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

export default function DungeonPage() {
    const { t } = useLanguage();
    const { selectedTeam, unitInventory, isLoaded } = usePlayerData();
    const [playerUnit, setPlayerUnit] = useState<UnitDefinition | null>(null);
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

    // 初回ロード時にプレイヤーユニットをセット
    if (isLoaded && !playerUnit) {
        let picked: UnitDefinition | undefined;
        if (selectedTeam.length > 0) {
            picked = playableUnits.find(u => u.id === selectedTeam[0]);
        }
        if (!picked) {
            const ownedIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
            picked = playableUnits.find(u => ownedIds.includes(u.id));
        }
        if (!picked) picked = playableUnits[0];
        if (picked) setPlayerUnit(picked);
    }

    const ownedUnits = playableUnits.filter(u => (unitInventory[u.id] ?? 0) > 0);
    const selectableUnits = ownedUnits.length > 0 ? ownedUnits : playableUnits;

    const getUnitName = (unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    };

    const getDifficultyStyle = (diff: string) => {
        switch (diff) {
            case "easy": return "from-emerald-400 to-teal-500";
            case "normal": return "from-amber-400 to-orange-500";
            case "hard": return "from-rose-500 to-red-600";
            default: return "from-slate-400 to-slate-500";
        }
    };

    const getDifficultyIcon = (diff: string) => {
        switch (diff) {
            case "easy": return "🟢";
            case "normal": return "🟡";
            case "hard": return "🔴";
            default: return "⚪";
        }
    };

    if (!isLoaded) {
        return <LoadingSpinner icon="🏰" fullScreen />;
    }

    return (
        <main className="min-h-screen p-4 md:p-6">
            <div className="max-w-4xl mx-auto text-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400">
                    🏰 ダンジョン
                </h1>
                <p className="text-sm text-purple-700/70 dark:text-purple-300/70 mt-2">
                    ダンジョンを探索し、ガードを配置して敵を倒そう！
                </p>
            </div>

            {/* プレイヤーユニット選択 */}
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
                        <p className="text-xs font-semibold text-purple-700/70 dark:text-purple-300/70 mb-1">
                            メインユニット
                        </p>
                        <h2 className="text-xl font-bold text-purple-900 dark:text-white mb-1">
                            {getUnitName(playerUnit)}
                        </h2>
                        <p className="text-sm text-purple-700/70 dark:text-slate-300/70">
                            ダンジョンの主役を選ぼう
                        </p>
                    </div>
                    <button onClick={() => setIsUnitModalOpen(true)} className="btn btn-primary text-sm">
                        変更
                    </button>
                </div>
            )}

            {/* ステージリスト */}
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
                {dungeonStages.map((stage) => (
                    <Link
                        key={stage.id}
                        href={`/dungeon/${stage.id}?unit=${playerUnit?.id || ""}`}
                        className="card flex flex-col justify-between gap-4 text-left hover:shadow-xl transition-all active:scale-[0.99]"
                    >
                        <div className="flex items-start gap-4">
                            <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm bg-gradient-to-br ${getDifficultyStyle(stage.difficulty)}`}
                            >
                                {getDifficultyIcon(stage.difficulty)}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-purple-900 dark:text-white">
                                    {stage.name}
                                </h2>
                                <p className="text-sm text-purple-700/70 dark:text-slate-300/70 mt-1">
                                    {stage.description}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-purple-700/80 dark:text-slate-300/80">
                            <span>💰 報酬: {stage.reward.coins}G</span>
                            <span>🛡️ ガード上限: {stage.maxGuards}</span>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="flex justify-center mt-8">
                <Link href="/" className="btn btn-secondary">
                    ← ホームに戻る
                </Link>
            </div>

            <Modal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} size="lg">
                <div className="p-5">
                    <h2 className="text-xl font-bold text-purple-900 mb-2">ユニット選択</h2>
                    <p className="text-sm text-purple-700/70 mb-4">ダンジョンの主役を選ぼう</p>
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
                                    className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${isSelected ? "border-purple-400 bg-purple-50" : "border-transparent hover:border-slate-300 hover:bg-slate-50"
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
