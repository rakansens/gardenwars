"use client";

import Link from "next/link";
import Image from "next/image";
import { towerDefenseStages } from "@/data/tower-defense";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TowerDefenseStageDefinition } from "@/data/types";
import PageHeader from "@/components/layout/PageHeader";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { getSpritePath } from "@/lib/sprites";

const allUnits = unitsData as UnitDefinition[];

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

// ステージごとの背景画像マッピング（既存ステージ画像を流用）
const stageBanners: Record<string, string> = {
    td_stage_1: "/assets/stages/easy_banner.webp",
    td_stage_2: "/assets/stages/normal_banner.webp",
    td_stage_3: "/assets/stages/extreme_banner.webp",
};

const stageGradients: Record<string, string> = {
    td_stage_1: "from-green-500 to-emerald-700",
    td_stage_2: "from-amber-500 to-orange-700",
    td_stage_3: "from-red-600 to-red-900",
};

// Wave内のユニークな敵ユニットを取得
const getUniqueEnemyUnits = (stage: TowerDefenseStageDefinition): UnitDefinition[] => {
    const unitIds = new Set<string>();
    for (const wave of stage.waves) {
        for (const group of wave.enemies) {
            unitIds.add(group.unitId);
        }
    }
    return Array.from(unitIds)
        .map(id => allUnits.find(u => u.id === id))
        .filter((u): u is UnitDefinition => u !== undefined);
};

// 総敵数カウント
const getTotalEnemies = (stage: TowerDefenseStageDefinition): number => {
    return stage.waves.reduce((sum, wave) =>
        sum + wave.enemies.reduce((wSum, group) => wSum + group.count, 0), 0
    );
};

export default function TowerDefenseSelectPage() {
    const { t, language } = useLanguage();

    return (
        <main className="min-h-screen">
            <PageHeader
                title={`🏰 Tower Defense`}
                rightButton={{
                    href: "/team",
                    label: t("team"),
                    icon: "🎮",
                }}
            />

            {/* 説明 */}
            <div className="container">
                <div className="text-center mb-6 text-amber-900/70 dark:text-gray-400">
                    <p className="text-lg font-medium">
                        {language === "ja" ? "仲間を配置して敵の侵攻を阻止せよ！" : "Place your allies to stop enemy invasion!"}
                    </p>
                    <p className="text-sm mt-1 opacity-80">
                        {language === "ja"
                            ? "① 仲間を選択 → ② マスに配置 → ③ Wave開始"
                            : "① Select unit → ② Place on tile → ③ Start wave"}
                    </p>
                </div>

                {/* ステージ一覧 */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
                    {towerDefenseStages.map((stage: TowerDefenseStageDefinition) => {
                        const enemyUnits = getUniqueEnemyUnits(stage);
                        const totalEnemies = getTotalEnemies(stage);
                        const banner = stageBanners[stage.id];
                        const gradient = stageGradients[stage.id] || "from-amber-500 to-orange-700";

                        return (
                            <Link
                                key={stage.id}
                                href={`/tower-defense/${stage.id}`}
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
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${difficultyColors[stage.difficulty || "normal"]}`}>
                                            {difficultyLabels[stage.difficulty || "normal"][language]}
                                        </span>
                                    </div>

                                    {/* ステージアイコン */}
                                    <div className="absolute bottom-2 left-3 text-white">
                                        <div className="text-xs opacity-80">STAGE</div>
                                        <div className="text-2xl font-bold drop-shadow-lg flex items-center gap-2">
                                            <span className="text-3xl">🏰</span>
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

                                {/* 敵ユニットプレビュー */}
                                <div className="mb-3">
                                    <div className="text-xs text-amber-800 dark:text-gray-400 mb-1.5">
                                        {language === "ja" ? "出現する敵:" : "Enemies:"}
                                    </div>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {enemyUnits.slice(0, 6).map((unit) => (
                                            <div
                                                key={unit.id}
                                                className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 flex items-center justify-center overflow-hidden"
                                                title={unit.name}
                                            >
                                                <Image
                                                    src={getSpritePath(unit.baseUnitId || unit.id, unit.rarity)}
                                                    alt={unit.name}
                                                    width={28}
                                                    height={28}
                                                    className="object-contain"
                                                />
                                            </div>
                                        ))}
                                        {enemyUnits.length > 6 && (
                                            <div className="w-9 h-9 rounded-lg bg-amber-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-gray-300">
                                                +{enemyUnits.length - 6}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ステータス */}
                                <div className="flex gap-3 text-sm text-amber-700 dark:text-amber-400">
                                    <span>🏠 {stage.startLives}</span>
                                    <span>👾 {totalEnemies}</span>
                                    <span>🌊 {stage.waves.length}</span>
                                    <span>💰 {stage.reward.coins}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* ヒント */}
                <div className="mt-6 max-w-4xl mx-auto">
                    <div className="card text-center text-amber-900/70 dark:text-gray-400 text-sm">
                        💡 {language === "ja"
                            ? "スキル持ちユニットを活用しよう！フロストスローで減速、チェインライトニングで範囲攻撃！"
                            : "Use units with skills! Frost Slow to decelerate, Chain Lightning for AoE damage!"}
                    </div>
                </div>
            </div>
        </main>
    );
}
