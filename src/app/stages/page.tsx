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
const DIFFICULTY_TABS: {
    key: StageDifficulty | "all";
    labelKey: string;
    subKey: string;
    icon: string;
    color: string;
    banner?: string;
    gradient: string;
}[] = [
    { key: "all", labelKey: "difficulty_all", subKey: "", icon: "📋", color: "bg-gray-500", gradient: "from-gray-600 to-gray-800" },
    { key: "tutorial", labelKey: "difficulty_tutorial", subKey: "difficulty_tutorial_sub", icon: "🌱", color: "bg-green-400", banner: "/assets/stages/tutorial_banner.webp", gradient: "from-green-400 to-emerald-600" },
    { key: "easy", labelKey: "difficulty_easy", subKey: "difficulty_easy_sub", icon: "🌲", color: "bg-blue-400", banner: "/assets/stages/easy_banner.webp", gradient: "from-green-500 to-teal-600" },
    { key: "normal", labelKey: "difficulty_normal", subKey: "difficulty_normal_sub", icon: "🌅", color: "bg-yellow-500", banner: "/assets/stages/normal_banner.webp", gradient: "from-orange-400 to-rose-500" },
    { key: "hard", labelKey: "difficulty_hard", subKey: "difficulty_hard_sub", icon: "🌑", color: "bg-orange-500", banner: "/assets/stages/hard_banner.webp", gradient: "from-purple-600 to-indigo-900" },
    { key: "extreme", labelKey: "difficulty_extreme", subKey: "difficulty_extreme_sub", icon: "🔥", color: "bg-red-600", banner: "/assets/stages/extreme_banner.webp", gradient: "from-red-600 to-red-900" },
    { key: "boss", labelKey: "difficulty_boss", subKey: "difficulty_boss_sub", icon: "🏰", color: "bg-purple-600", banner: "/assets/stages/boss_banner.webp", gradient: "from-purple-700 to-black" },
    { key: "special", labelKey: "difficulty_special", subKey: "difficulty_special_sub", icon: "✨", color: "bg-gradient-to-r from-pink-500 to-cyan-500", banner: "/assets/stages/special_banner.webp", gradient: "from-pink-400 via-purple-500 to-cyan-400" },
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
    stage_16: "🐕",
    stage_17: "🦅",
    stage_18: "🐺",
    stage_19: "☠️",
    stage_20: "🔥",
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

            {/* 難易度タブ - ビジュアルカード */}
            <div className="mb-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {DIFFICULTY_TABS.map(tab => {
                        const { cleared, total } = getClearCount(tab.key);
                        const isSelected = selectedDifficulty === tab.key;
                        const isAllCleared = cleared === total && total > 0;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setSelectedDifficulty(tab.key)}
                                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                                    isSelected
                                        ? "ring-4 ring-yellow-400 scale-105 shadow-2xl z-10"
                                        : "hover:scale-102 hover:shadow-lg opacity-80 hover:opacity-100"
                                }`}
                            >
                                {/* バナー画像背景 */}
                                <div className={`relative h-24 sm:h-28 bg-gradient-to-br ${tab.gradient}`}>
                                    {tab.banner && (
                                        <Image
                                            src={tab.banner}
                                            alt={t(tab.labelKey)}
                                            fill
                                            className="object-cover opacity-80"
                                        />
                                    )}
                                    {/* オーバーレイ */}
                                    <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent`} />

                                    {/* クリア済みバッジ */}
                                    {isAllCleared && (
                                        <div className="absolute top-1 right-1 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                            ✓
                                        </div>
                                    )}

                                    {/* コンテンツ */}
                                    <div className="absolute inset-0 flex flex-col justify-end p-2">
                                        <div className="text-xl mb-0.5">{tab.icon}</div>
                                        <div className="text-white font-bold text-xs sm:text-sm leading-tight drop-shadow-lg">
                                            {t(tab.labelKey)}
                                        </div>
                                        {tab.subKey && (
                                            <div className="text-white/70 text-[10px] drop-shadow">
                                                {t(tab.subKey)}
                                            </div>
                                        )}
                                        <div className={`text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full inline-block w-fit ${
                                            isAllCleared ? "bg-green-500/80" : "bg-white/30"
                                        } text-white`}>
                                            {cleared}/{total}
                                        </div>
                                    </div>
                                </div>
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
                            const stageImage = stage.background?.image || `/assets/stages/${stage.id}.webp`;
                            return (
                                <div
                                    key={stage.id}
                                    className={`stage-card relative overflow-hidden ${isCleared ? 'ring-2 ring-green-400' : ''}`}
                                    onClick={() => handleSelectStage(stage.id)}
                                >
                                    {/* サムネイル画像 */}
                                    <div className="relative h-32 -mx-4 -mt-4 mb-3 overflow-hidden">
                                        <Image
                                            src={stageImage}
                                            alt={t(stage.name)}
                                            fill
                                            className="object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-amber-50 via-transparent to-transparent" />

                                        {/* クリアバッジ */}
                                        {isCleared && (
                                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                                                ✓ CLEAR
                                            </div>
                                        )}

                                        {/* ステージ番号とアイコン */}
                                        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                                            <span className="text-sm text-white drop-shadow-lg font-medium">
                                                {stage.id}
                                            </span>
                                            <span className="text-2xl drop-shadow-lg">
                                                {stageIcons[stage.id] || "🎮"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ステージ名 */}
                                    <h2 className="text-xl font-bold mb-2 text-amber-950">
                                        {t(stage.name)}
                                    </h2>

                                    {/* 説明 */}
                                    <p className="text-amber-900/70 mb-3 text-sm">{t(stage.description)}</p>

                                    {/* 出現する敵ユニット */}
                                    <div className="mb-3">
                                        <div className="text-xs text-amber-800 mb-1.5">{t("encounter_units")}:</div>
                                        <div className="flex gap-2 flex-wrap">
                                            {enemyUnits.slice(0, 6).map((unit) => {
                                                const isBoss = unit.isBoss;
                                                return (
                                                    <div
                                                        key={unit.id}
                                                        className={`w-11 h-11 rounded-lg flex items-center justify-center overflow-hidden ${isBoss
                                                                ? 'bg-purple-900 border-2 border-purple-500'
                                                                : 'bg-red-100 border-2 border-red-300'
                                                            }`}
                                                        title={isBoss ? "???" : unit.name}
                                                    >
                                                        {isBoss ? (
                                                            <span className="text-purple-300 font-bold text-lg">?</span>
                                                        ) : (
                                                            <Image
                                                                src={`/assets/sprites/${unit.baseUnitId || unit.id}.webp`}
                                                                alt={unit.name}
                                                                width={36}
                                                                height={36}
                                                                className="object-contain"
                                                                style={{ transform: unit.flipSprite ? "scaleX(-1)" : "none" }}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {enemyUnits.length > 6 && (
                                                <div className="w-11 h-11 rounded-lg bg-amber-200 flex items-center justify-center text-sm font-bold text-amber-700">
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

                                    {/* ドロップ報酬 */}
                                    {stage.reward.drops && stage.reward.drops.length > 0 && (
                                        <div className="mb-3">
                                            <div className="text-xs text-green-700 mb-1.5">🎁 {t("drops")}:</div>
                                            <div className="flex gap-2 flex-wrap">
                                                {stage.reward.drops.slice(0, 4).map((drop) => {
                                                    const unit = allUnits.find(u => u.id === drop.unitId);
                                                    if (!unit) return null;
                                                    return (
                                                        <div
                                                            key={drop.unitId}
                                                            className="flex items-center gap-1.5 bg-green-100 border-2 border-green-300 rounded-lg px-2 py-1"
                                                            title={`${unit.name} (${drop.rate}%)`}
                                                        >
                                                            <div className="w-8 h-8 rounded bg-white flex items-center justify-center overflow-hidden">
                                                                <Image
                                                                    src={`/assets/sprites/${unit.baseUnitId || unit.id}.webp`}
                                                                    alt={unit.name}
                                                                    width={28}
                                                                    height={28}
                                                                    className="object-contain"
                                                                />
                                                            </div>
                                                            <span className="text-sm font-bold text-green-700">{drop.rate}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
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
