"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import stagesData from "@/data/stages";
import unitsData from "@/data/units";
import type { StageDefinition, UnitDefinition, StageDifficulty } from "@/data/types";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";

const stages = stagesData as StageDefinition[];
const allUnits = unitsData as UnitDefinition[];

// 難易度タブ設定
const DIFFICULTY_TABS: { key: StageDifficulty | "all"; labelKey: string; icon: string; color: string }[] = [
    { key: "all", labelKey: "difficulty_all", icon: "📋", color: "bg-gray-500" },
    { key: "tutorial", labelKey: "difficulty_tutorial", icon: "🌱", color: "bg-green-400" },
    { key: "easy", labelKey: "difficulty_easy", icon: "⭐", color: "bg-blue-400" },
    { key: "normal", labelKey: "difficulty_normal", icon: "⭐⭐", color: "bg-yellow-500" },
    { key: "hard", labelKey: "difficulty_hard", icon: "⭐⭐⭐", color: "bg-orange-500" },
    { key: "extreme", labelKey: "difficulty_extreme", icon: "💀", color: "bg-red-600" },
    { key: "boss", labelKey: "difficulty_boss", icon: "👑", color: "bg-purple-600" },
    { key: "special", labelKey: "difficulty_special", icon: "✨", color: "bg-gradient-to-r from-pink-500 to-cyan-500" },
];

// ステージのテーマアイコン
const stageIcons: { [key: string]: string } = {
    tutorial_1: "🌱",
    tutorial_2: "🌿",
    tutorial_3: "🌻",
    stage_1: "🌿",
    stage_2: "🌲",
    stage_3: "🏜️",
    stage_4: "🌅",
    stage_5: "🦇",
    stage_6: "❄️",
    stage_7: "🌋",
    stage_8: "👿",
    stage_9: "🧟",
    stage_10: "💀",
    stage_11: "🔥",
    stage_12: "☠️",
    stage_13: "🥷",
    stage_14: "🛡️",
    stage_15: "👻",
    boss_stage_1: "🧑",
    boss_stage_2: "🎸",
    boss_stage_3: "👩",
    boss_stage_4: "💃",
    boss_stage_5: "🌙",
    stage_ur_rush: "⚔️",
    stage_sr_rush: "🔥",
};

// 敵の総数を計算
const getTotalEnemies = (stage: StageDefinition): number => {
    return stage.enemyWaves.reduce((sum, wave) => sum + wave.count, 0);
};

// ステージに出現する敵ユニットの種類を取得
const getUniqueEnemyUnits = (stage: StageDefinition): UnitDefinition[] => {
    const unitIds = [...new Set(stage.enemyWaves.map((w) => w.unitId))];
    return unitIds
        .map((id) => allUnits.find((u) => u.id === id))
        .filter((u): u is UnitDefinition => u !== undefined);
};

// 難易度に基づく星表示
const getDifficultyStars = (difficulty?: StageDifficulty): string => {
    switch (difficulty) {
        case "tutorial": return "🌱";
        case "easy": return "⭐";
        case "normal": return "⭐⭐";
        case "hard": return "⭐⭐⭐";
        case "extreme": return "💀💀💀";
        case "boss": return "👑";
        case "special": return "✨";
        default: return "⭐";
    }
};

export default function StagesPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const { clearedStages } = usePlayerData();
    const [selectedDifficulty, setSelectedDifficulty] = useState<StageDifficulty | "all">("all");

    const handleSelectStage = (stageId: string) => {
        router.push(`/battle/${stageId}`);
    };

    // 選択された難易度でフィルタ
    const filteredStages = selectedDifficulty === "all"
        ? stages
        : stages.filter(s => s.difficulty === selectedDifficulty);

    // 各難易度のステージ数をカウント
    const getClearCount = (difficulty: StageDifficulty | "all") => {
        const targetStages = difficulty === "all"
            ? stages
            : stages.filter(s => s.difficulty === difficulty);
        const cleared = targetStages.filter(s => clearedStages.includes(s.id)).length;
        return { cleared, total: targetStages.length };
    };

    return (
        <main className="min-h-screen p-4 md:p-8">
            {/* ヘッダー */}
            <div className="page-header mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold">{t("stage_select")}</h1>
                    <div className="flex items-center gap-2">
                        <LanguageSwitch />
                        <Link href="/team" className="btn btn-primary">
                            🎮 {t("team")}
                        </Link>
                    </div>
                </div>
            </div>

            {/* 難易度タブ */}
            <div className="mb-6 overflow-x-auto">
                <div className="flex gap-2 min-w-max pb-2">
                    {DIFFICULTY_TABS.map(tab => {
                        const { cleared, total } = getClearCount(tab.key);
                        const isSelected = selectedDifficulty === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setSelectedDifficulty(tab.key)}
                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                                    isSelected
                                        ? `${tab.color} text-white shadow-lg scale-105`
                                        : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                }`}
                            >
                                <span>{tab.icon}</span>
                                <span>{t(tab.labelKey)}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    isSelected ? "bg-white/30" : "bg-amber-200"
                                }`}>
                                    {cleared}/{total}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ステージ一覧 */}
            <div className="container">
                {filteredStages.length === 0 ? (
                    <div className="text-center py-12 text-amber-700">
                        <div className="text-4xl mb-4">🏜️</div>
                        <p>{t("no_stages_in_category")}</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredStages.map((stage) => {
                            const enemyUnits = getUniqueEnemyUnits(stage);
                            const isCleared = clearedStages.includes(stage.id);
                            return (
                                <div
                                    key={stage.id}
                                    className={`stage-card relative ${isCleared ? 'ring-2 ring-green-400' : ''}`}
                                    onClick={() => handleSelectStage(stage.id)}
                                >
                                    {/* クリアバッジ */}
                                    {isCleared && (
                                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                                            ✓ CLEAR
                                        </div>
                                    )}

                                    {/* ステージ番号とアイコン */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-amber-900/60">
                                            {stage.id}
                                        </span>
                                        <span className="text-2xl">
                                            {stageIcons[stage.id] || "🎮"}
                                        </span>
                                    </div>

                                    {/* ステージ名 */}
                                    <h2 className="text-xl font-bold mb-2 text-amber-950">
                                        {t(stage.name)}
                                    </h2>

                                    {/* 説明 */}
                                    <p className="text-amber-900/70 mb-3 text-sm">{t(stage.description)}</p>

                                    {/* 出現する敵ユニット */}
                                    <div className="mb-3">
                                        <div className="text-xs text-amber-800 mb-1">{t("encounter_units")}:</div>
                                        <div className="flex gap-1 flex-wrap">
                                            {enemyUnits.slice(0, 6).map((unit) => {
                                                const isBoss = unit.isBoss;
                                                return (
                                                    <div
                                                        key={unit.id}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${isBoss
                                                                ? 'bg-purple-900 border-2 border-purple-500'
                                                                : 'bg-red-100 border border-red-300'
                                                            }`}
                                                        title={isBoss ? "???" : unit.name}
                                                    >
                                                        {isBoss ? (
                                                            <span className="text-purple-300 font-bold">?</span>
                                                        ) : (
                                                            <Image
                                                                src={`/assets/sprites/${unit.baseUnitId || unit.id}.png`}
                                                                alt={unit.name}
                                                                width={24}
                                                                height={24}
                                                                className="object-contain"
                                                                style={{ transform: unit.flipSprite ? "scaleX(-1)" : "none" }}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {enemyUnits.length > 6 && (
                                                <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-700">
                                                    +{enemyUnits.length - 6}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 敵情報（コンパクト） */}
                                    <div className="bg-amber-100/50 rounded-lg p-2 mb-3 text-xs">
                                        <div className="flex justify-between">
                                            <span>👾 {getTotalEnemies(stage)}</span>
                                            <span>🌊 {stage.enemyWaves.length}</span>
                                            <span>🏰 {stage.enemyCastleHp}</span>
                                        </div>
                                    </div>

                                    {/* ドロップ（コンパクト） */}
                                    {stage.reward.drops && stage.reward.drops.length > 0 && (
                                        <div className="mb-3 flex gap-1 flex-wrap">
                                            {stage.reward.drops.slice(0, 3).map((drop) => {
                                                const unit = allUnits.find(u => u.id === drop.unitId);
                                                if (!unit) return null;
                                                return (
                                                    <div
                                                        key={drop.unitId}
                                                        className="flex items-center gap-1 bg-green-100 border border-green-300 rounded px-1 py-0.5"
                                                        title={`${unit.name} (${drop.rate}%)`}
                                                    >
                                                        <Image
                                                            src={`/assets/sprites/${unit.id}.png`}
                                                            alt={unit.name}
                                                            width={16}
                                                            height={16}
                                                            className="object-contain"
                                                        />
                                                        <span className="text-xs text-green-700">{drop.rate}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* 難易度と報酬 */}
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-amber-700">
                                            {getDifficultyStars(stage.difficulty)}
                                        </span>
                                        <span className="text-amber-700 font-bold">
                                            💰 {stage.reward.coins.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ヒント */}
            <div className="container mt-6">
                <div className="card text-center text-amber-900/70 text-sm">
                    {t("stage_hint")}
                </div>
            </div>
        </main>
    );
}
