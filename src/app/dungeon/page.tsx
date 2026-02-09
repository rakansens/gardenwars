"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { dungeonStages } from "@/data/dungeon";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import unitsData from "@/data/units";
import type { UnitDefinition, DungeonStageDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/layout/PageHeader";

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

const difficultyColors: Record<string, string> = {
    easy: "bg-green-500",
    normal: "bg-blue-500",
    hard: "bg-orange-500",
    extreme: "bg-red-500",
};

const difficultyLabels: Record<string, { ja: string; en: string }> = {
    easy: { ja: "初級", en: "Easy" },
    normal: { ja: "中級", en: "Normal" },
    hard: { ja: "上級", en: "Hard" },
    extreme: { ja: "極限", en: "Extreme" },
};

const stageBanners: Record<string, string> = {
    dungeon_1: "/assets/stages/easy_banner.webp",
    dungeon_2: "/assets/stages/normal_banner.webp",
    dungeon_3: "/assets/stages/extreme_banner.webp",
};

const stageGradients: Record<string, string> = {
    dungeon_1: "from-indigo-500 to-purple-700",
    dungeon_2: "from-amber-500 to-orange-700",
    dungeon_3: "from-red-600 to-red-900",
};

export default function DungeonPage() {
    const { t, language } = useLanguage();
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

    if (!isLoaded) {
        return <LoadingSpinner icon="🗡️" fullScreen />;
    }

    return (
        <main className="min-h-screen">
            <PageHeader
                title="🗡️ Dungeon"
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
                        {language === "ja" ? "ダンジョンを探索し、ガードを配置して敵を倒そう！" : "Explore the dungeon, place guards, and defeat enemies!"}
                    </p>
                    <p className="text-sm mt-1 opacity-80">
                        {language === "ja"
                            ? "① メインユニットで逃げ回る → ② ガードを配置 → ③ 敵を殲滅"
                            : "① Dodge with main unit → ② Place guards → ③ Eliminate enemies"}
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
                            <p className="text-xs font-semibold text-amber-800/70 dark:text-amber-300/70 mb-1">
                                {language === "ja" ? "メインユニット" : "Main Unit"}
                            </p>
                            <h2 className="text-xl font-bold text-amber-950 dark:text-white mb-1">
                                {getUnitName(playerUnit)}
                            </h2>
                            <p className="text-sm text-amber-900/70 dark:text-slate-300/70">
                                {language === "ja" ? "ダンジョンの主役を選ぼう" : "Choose your dungeon hero"}
                            </p>
                        </div>
                        <button onClick={() => setIsUnitModalOpen(true)} className="btn btn-primary text-sm">
                            {language === "ja" ? "変更" : "Change"}
                        </button>
                    </div>
                )}

                {/* ステージ一覧 */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
                    {dungeonStages.map((stage: DungeonStageDefinition) => {
                        const banner = stageBanners[stage.id];
                        const gradient = stageGradients[stage.id] || "from-indigo-500 to-purple-700";
                        const diff = stage.difficulty || "normal";

                        return (
                            <Link
                                key={stage.id}
                                href={`/dungeon/${stage.id}?unit=${playerUnit?.id || ""}`}
                                className="card relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all"
                            >
                                {/* バナー画像 */}
                                <div className="relative h-36 -mx-4 -mt-4 mb-3 overflow-hidden">
                                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
                                        {banner && (
                                            <Image
                                                src={banner}
                                                alt={stage.name}
                                                fill
                                                className="object-cover opacity-60"
                                            />
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-amber-50 dark:from-slate-800 via-transparent to-transparent" />

                                    {/* 難易度バッジ */}
                                    <div className="absolute top-3 right-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${difficultyColors[diff]}`}>
                                            {difficultyLabels[diff]?.[language] || diff}
                                        </span>
                                    </div>

                                    {/* ステージアイコン */}
                                    <div className="absolute bottom-2 left-3 text-white">
                                        <div className="text-xs opacity-80">STAGE</div>
                                        <div className="text-2xl font-bold drop-shadow-lg flex items-center gap-2">
                                            <span className="text-3xl">🗡️</span>
                                        </div>
                                    </div>
                                </div>

                                {/* コンテンツ */}
                                <h2 className="text-lg font-bold text-amber-950 dark:text-white mb-1">
                                    {stage.name}
                                </h2>
                                <p className="text-sm text-amber-900/70 dark:text-gray-400 mb-3">
                                    {stage.description}
                                </p>

                                {/* ステータス */}
                                <div className="flex gap-3 text-sm text-amber-700 dark:text-amber-400 flex-wrap">
                                    <span>🌊 {stage.totalWaves}{language === "ja" ? "波" : " waves"}</span>
                                    <span>🛡️ {language === "ja" ? "上限" : "Max"}: {stage.maxGuards}</span>
                                    <span>💰 {stage.reward.coins}G</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* ヒント */}
                <div className="mt-6 max-w-4xl mx-auto">
                    <div className="card text-center text-amber-900/70 dark:text-gray-400 text-sm">
                        💡 {language === "ja"
                            ? "メインユニットは逃げ回って経験値オーブを集めよう！ガードが敵を倒してくれる！"
                            : "Run around with your main unit to collect XP orbs! Guards will fight enemies for you!"}
                    </div>
                </div>
            </div>

            {/* ユニット選択モーダル */}
            <Modal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} size="lg">
                <div className="p-5">
                    <h2 className="text-xl font-bold text-amber-950 dark:text-white mb-2">
                        {language === "ja" ? "ユニット選択" : "Select Unit"}
                    </h2>
                    <p className="text-sm text-amber-900/70 dark:text-gray-400 mb-4">
                        {language === "ja" ? "ダンジョンの主役を選ぼう" : "Choose your dungeon hero"}
                    </p>
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
                                    className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${isSelected ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30" : "border-transparent hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
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
                                    <span className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">{getUnitName(unit)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Modal>
        </main>
    );
}
