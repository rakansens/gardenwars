"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import stagesData, { getStagesByWorld } from "@/data/stages";
import unitsData from "@/data/units";
import type { StageDefinition, UnitDefinition, StageDifficulty, WorldId } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { getSpritePath } from "@/lib/sprites";
import { useStageUnlock } from "@/hooks/useStageUnlock";
import { usePlayerData } from "@/hooks/usePlayerData";
import WorldTabs from "@/components/WorldTabs";
import { getPlayerBattleStats, type PlayerBattleStats } from "@/lib/supabase";

const stages = stagesData as StageDefinition[];
const allUnits = unitsData as UnitDefinition[];

// 難易度タブ設定（順番が重要 - アンロック順）
const DIFFICULTY_TABS: {
    key: StageDifficulty;
    labelKey: string;
    subKey: string;
    icon: string;
    color: string;
    banner?: string;
    gradient: string;
    worldId: WorldId;
}[] = [
    // World 1 難易度
    { key: "tutorial", labelKey: "difficulty_tutorial", subKey: "difficulty_tutorial_sub", icon: "🌱", color: "bg-green-400", banner: "/assets/stages/tutorial_banner.webp", gradient: "from-green-400 to-emerald-600", worldId: "world1" },
    { key: "easy", labelKey: "difficulty_easy", subKey: "difficulty_easy_sub", icon: "🌲", color: "bg-blue-400", banner: "/assets/stages/easy_banner.webp", gradient: "from-green-500 to-teal-600", worldId: "world1" },
    { key: "normal", labelKey: "difficulty_normal", subKey: "difficulty_normal_sub", icon: "🌅", color: "bg-yellow-500", banner: "/assets/stages/normal_banner.webp", gradient: "from-orange-400 to-rose-500", worldId: "world1" },
    { key: "frozen", labelKey: "difficulty_frozen", subKey: "difficulty_frozen_sub", icon: "❄️", color: "bg-cyan-400", banner: "/assets/stages/frozen_banner.webp", gradient: "from-cyan-400 to-blue-600", worldId: "world1" },
    { key: "hard", labelKey: "difficulty_hard", subKey: "difficulty_hard_sub", icon: "🌑", color: "bg-orange-500", banner: "/assets/stages/hard_banner.webp", gradient: "from-purple-600 to-indigo-900", worldId: "world1" },
    { key: "extreme", labelKey: "difficulty_extreme", subKey: "difficulty_extreme_sub", icon: "🔥", color: "bg-red-600", banner: "/assets/stages/extreme_banner.webp", gradient: "from-red-600 to-red-900", worldId: "world1" },
    { key: "nightmare", labelKey: "difficulty_nightmare", subKey: "difficulty_nightmare_sub", icon: "💀", color: "bg-purple-900", banner: "/assets/stages/nightmare_banner.webp", gradient: "from-purple-900 to-black", worldId: "world1" },
    { key: "boss", labelKey: "difficulty_boss", subKey: "difficulty_boss_sub", icon: "🏰", color: "bg-purple-600", banner: "/assets/stages/boss_banner.webp", gradient: "from-purple-700 to-black", worldId: "world1" },
    { key: "special", labelKey: "difficulty_special", subKey: "difficulty_special_sub", icon: "✨", color: "bg-gradient-to-r from-pink-500 to-cyan-500", banner: "/assets/stages/special_banner.webp", gradient: "from-pink-400 via-purple-500 to-cyan-400", worldId: "world1" },
    // World 2 難易度
    { key: "purgatory", labelKey: "difficulty_purgatory", subKey: "difficulty_purgatory_sub", icon: "🔥", color: "bg-orange-700", banner: "/assets/stages/purgatory_banner.webp", gradient: "from-orange-700 to-red-900", worldId: "world2" },
    { key: "hellfire", labelKey: "difficulty_hellfire", subKey: "difficulty_hellfire_sub", icon: "🌋", color: "bg-red-700", banner: "/assets/stages/hellfire_banner.webp", gradient: "from-red-700 to-orange-900", worldId: "world2" },
    { key: "abyss", labelKey: "difficulty_abyss", subKey: "difficulty_abyss_sub", icon: "🕳️", color: "bg-purple-900", banner: "/assets/stages/abyss_banner.webp", gradient: "from-purple-900 to-gray-900", worldId: "world2" },
    { key: "inferno_boss", labelKey: "difficulty_inferno_boss", subKey: "difficulty_inferno_boss_sub", icon: "👹", color: "bg-red-900", banner: "/assets/stages/inferno_boss_banner.webp", gradient: "from-red-900 to-black", worldId: "world2" },
];

// ワールドごとの難易度タブを取得
const getDifficultyTabsByWorld = (worldId: WorldId) => {
    return DIFFICULTY_TABS.filter(tab => tab.worldId === worldId);
};

// ステージのテーマアイコン
const stageIcons: { [key: string]: string } = {
    tutorial_1: "🌱",
    tutorial_2: "🌿",
    tutorial_3: "🌻",
    // Easy (stage_1-3)
    stage_1: "🌿",
    stage_2: "🌲",
    stage_3: "🏜️",
    // Normal (stage_4-11)
    stage_4: "🌅",
    stage_5: "🦇",
    stage_6: "🌈",
    stage_7: "🌋",
    stage_8: "👿",
    stage_9: "🧟",
    stage_10: "💀",
    stage_11: "🔥",
    // Frozen (stage_12-17)
    stage_12: "❄️",
    stage_13: "🏔️",
    stage_14: "🌨️",
    stage_15: "🧊",
    stage_16: "⛄",
    stage_17: "🥶",
    // Hard (stage_18-21)
    stage_18: "🌑",
    stage_19: "☠️",
    stage_20: "🥷",
    stage_21: "🛡️",
    // Extreme (stage_22-26)
    stage_22: "🔥",
    stage_23: "🐕",
    stage_24: "🦅",
    stage_25: "🐺",
    stage_26: "☠️",
    // Nightmare (stage_27-32)
    stage_27: "👻",
    stage_28: "💀",
    stage_29: "🧟",
    stage_30: "👹",
    stage_31: "😈",
    stage_32: "☠️",
    // Boss stages
    boss_stage_1: "🧑",
    boss_stage_2: "🎸",
    boss_stage_3: "👩",
    boss_stage_4: "💃",
    boss_stage_5: "🌙",
    stage_ur_rush: "⚔️",
    stage_sr_rush: "🔥",
    // World 2 ステージ
    purgatory_1: "🔥",
    purgatory_2: "💨",
    purgatory_3: "💀",
    purgatory_4: "🌲",
    purgatory_boss: "👹",
    hellfire_1: "🌊",
    hellfire_2: "🌋",
    hellfire_3: "🔥",
    hellfire_4: "🏰",
    hellfire_boss: "👹",
    abyss_1: "🕳️",
    abyss_2: "🏚️",
    abyss_3: "⛓️",
    abyss_4: "🌀",
    abyss_boss: "👹",
    inferno_boss_1: "🏰",
    inferno_boss_2: "⚔️",
    inferno_boss_3: "🚪",
    inferno_boss_4: "⛪",
    inferno_boss_5: "👑",
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
        case "frozen": return "❄️❄️";
        case "hard": return "⭐⭐⭐";
        case "extreme": return "💀💀💀";
        case "nightmare": return "👻👻👻";
        case "boss": return "👑";
        case "special": return "✨";
        // World 2 難易度
        case "purgatory": return "🔥";
        case "hellfire": return "🔥🔥";
        case "abyss": return "🔥🔥🔥";
        case "inferno_boss": return "👹";
        default: return "⭐";
    }
};

export default function StagesPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const { playerId, status } = useAuth();
    const { clearedStages, isDifficultyUnlocked, isStageUnlocked, getClearCount } = useStageUnlock();
    const { currentWorld, setCurrentWorld } = usePlayerData();
    const [battleStats, setBattleStats] = useState<PlayerBattleStats | null>(null);

    // 現在のワールドをWorldIdとして取得
    const selectedWorld = (currentWorld || "world1") as WorldId;

    // 現在のワールドの難易度タブを取得
    const worldDifficultyTabs = getDifficultyTabsByWorld(selectedWorld);

    // 最初のタブをデフォルトに
    const [selectedDifficulty, setSelectedDifficulty] = useState<StageDifficulty>(
        worldDifficultyTabs[0]?.key || "tutorial"
    );

    useEffect(() => {
        const tabs = getDifficultyTabsByWorld(selectedWorld);
        const hasSelected = tabs.some(tab => tab.key === selectedDifficulty);
        if (!hasSelected) {
            setSelectedDifficulty(tabs[0]?.key || "tutorial");
        }
    }, [selectedWorld, selectedDifficulty]);

    // Fetch player battle stats
    useEffect(() => {
        const fetchStats = async () => {
            if (!playerId) return;
            try {
                const result = await getPlayerBattleStats(playerId);
                if (result.data) {
                    setBattleStats(result.data);
                }
            } catch (err) {
                console.error("Failed to fetch battle stats:", err);
            }
        };

        if (status === "authenticated" && playerId) {
            fetchStats();
        }
    }, [playerId, status]);

    const handleSelectStage = (stageId: string) => {
        router.push(`/battle/${stageId}`);
    };

    const handleSelectWorld = (worldId: WorldId) => {
        setCurrentWorld(worldId);
        // ワールド切り替え時は最初の難易度にリセット
        const tabs = getDifficultyTabsByWorld(worldId);
        setSelectedDifficulty(tabs[0]?.key || "tutorial");
    };

    // 現在のワールドのステージを取得
    const worldStages = getStagesByWorld(selectedWorld);

    // 選択された難易度でフィルタ
    const filteredStages = worldStages.filter(s => s.difficulty === selectedDifficulty);

    return (
        <main className="min-h-screen">
            <PageHeader
                title={t("stage_select")}
                rightButton={{
                    href: "/team",
                    label: t("team"),
                    icon: "🎮",
                }}
            />

            {/* ワールドタブ */}
            <WorldTabs
                selectedWorld={selectedWorld}
                onSelectWorld={handleSelectWorld}
            />

            {/* 戦績バー（コンパクト表示） */}
            {status === "authenticated" && battleStats && battleStats.total_battles > 0 && (
                <div className="container mb-4">
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-amber-800/80 dark:text-amber-200/80">
                        <span className="flex items-center gap-1">
                            ⚔️ <strong>{battleStats.total_battles}</strong> {t("battles") || "battles"}
                        </span>
                        <span className="flex items-center gap-1">
                            ✅ <strong>{battleStats.total_wins}</strong> {t("wins") || "wins"}
                        </span>
                        <span className="flex items-center gap-1">
                            📈 <strong>{Math.round((battleStats.total_wins / battleStats.total_battles) * 100)}%</strong>
                        </span>
                        {battleStats.win_streak > 0 && (
                            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                🔥 <strong>{battleStats.win_streak}</strong> {t("streak") || "streak"}
                            </span>
                        )}
                        {battleStats.max_win_streak > 0 && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                👑 <strong>{battleStats.max_win_streak}</strong> {t("best") || "best"}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* 難易度タブ - ビジュアルカード（横スクロール対応） */}
            <div className="mb-6 overflow-x-auto pb-2">
                <div className="flex gap-3 min-w-max px-4">
                    {worldDifficultyTabs.map(tab => {
                        const { cleared, total } = getClearCount(tab.key, selectedWorld);
                        const isSelected = selectedDifficulty === tab.key;
                        const isAllCleared = cleared === total && total > 0;
                        const isLocked = !isDifficultyUnlocked(tab.key, selectedWorld);
                        return (
                            <button
                                key={tab.key}
                                onClick={() => !isLocked && setSelectedDifficulty(tab.key)}
                                disabled={isLocked}
                                className={`relative overflow-hidden rounded-xl transition-all duration-300 flex-shrink-0 w-32 sm:w-36 ${
                                    isLocked
                                        ? "opacity-50 cursor-not-allowed grayscale"
                                        : isSelected
                                            ? "ring-4 ring-yellow-400 scale-105 shadow-2xl z-10"
                                            : "hover:scale-102 hover:shadow-lg opacity-80 hover:opacity-100"
                                }`}
                            >
                                {/* バナー画像背景 */}
                                <div className={`relative h-24 sm:h-28 w-full bg-gradient-to-br ${tab.gradient}`}>
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

                                    {/* ロックアイコン */}
                                    {isLocked && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                            <span className="text-3xl">🔒</span>
                                        </div>
                                    )}

                                    {/* クリア済みバッジ */}
                                    {isAllCleared && !isLocked && (
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
                    <div className="text-center py-12 text-amber-700 dark:text-amber-400">
                        <div className="text-4xl mb-4">🏜️</div>
                        <p>{t("no_stages_in_category")}</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredStages.map((stage) => {
                            const enemyUnits = getUniqueEnemyUnits(stage);
                            const isCleared = clearedStages.includes(stage.id);
                            const stageImage = stage.background?.image || `/assets/stages/${stage.id}.webp`;

                            // ステージのロック判定（共有フックを使用）
                            const isLocked = !isStageUnlocked(stage);

                            return (
                                <div
                                    key={stage.id}
                                    className={`stage-card relative overflow-hidden ${
                                        isLocked
                                            ? 'opacity-60 cursor-not-allowed'
                                            : isCleared
                                                ? 'ring-2 ring-green-400 cursor-pointer'
                                                : 'cursor-pointer'
                                    }`}
                                    onClick={() => !isLocked && handleSelectStage(stage.id)}
                                >
                                    {/* サムネイル画像 - ロック時も色を保持 */}
                                    <div className="relative h-32 -mx-4 -mt-4 mb-3 overflow-hidden">
                                        <Image
                                            src={stageImage}
                                            alt={t(stage.name)}
                                            fill
                                            className="object-cover"
                                        />
                                        <div className={`absolute inset-0 bg-gradient-to-t from-amber-50 dark:from-slate-800 via-transparent to-transparent ${isLocked ? 'bg-black/30' : ''}`} />

                                        {/* ロックオーバーレイ */}
                                        {isLocked && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                                <span className="text-4xl">🔒</span>
                                            </div>
                                        )}

                                        {/* クリアバッジ */}
                                        {isCleared && !isLocked && (
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

                                    {/* コンテンツ部分 - ロック時はグレースケール */}
                                    <div className={isLocked ? 'grayscale' : ''}>
                                        {/* ステージ名 */}
                                        <h2 className="text-xl font-bold mb-2 text-amber-950 dark:text-white">
                                            {t(stage.name)}
                                        </h2>

                                        {/* 説明 */}
                                        <p className="text-amber-900/70 dark:text-gray-400 mb-3 text-sm">{t(stage.description)}</p>

                                        {/* 出現する敵ユニット */}
                                        <div className="mb-3">
                                            <div className="text-xs text-amber-800 dark:text-gray-400 mb-1.5">{t("encounter_units")}:</div>
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
                                                                    src={getSpritePath(unit.baseUnitId || unit.id, unit.rarity)}
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
                                                    <div className="w-11 h-11 rounded-lg bg-amber-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-gray-300">
                                                        +{enemyUnits.length - 6}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 敵情報（コンパクト） */}
                                        <div className="bg-amber-200/70 dark:bg-slate-700/50 rounded-lg p-2 mb-3 text-xs text-amber-900 dark:text-gray-300 font-medium">
                                            <div className="flex justify-between">
                                                <span>👾 {getTotalEnemies(stage)}</span>
                                                <span>🌊 {stage.enemyWaves.length}</span>
                                                <span>🏰 {stage.enemyCastleHp}</span>
                                            </div>
                                        </div>

                                        {/* ドロップ報酬 */}
                                        {stage.reward.drops && stage.reward.drops.length > 0 && (
                                            <div className="mb-3">
                                                <div className="text-xs text-green-700 dark:text-green-400 mb-1.5">🎁 {t("drops")}:</div>
                                                <div className="flex gap-2 flex-wrap">
                                                    {stage.reward.drops.slice(0, 4).map((drop) => {
                                                        const unit = allUnits.find(u => u.id === drop.unitId);
                                                        if (!unit) return null;
                                                        return (
                                                            <div
                                                                key={drop.unitId}
                                                                className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/50 border-2 border-green-300 dark:border-green-700 rounded-lg px-2 py-1"
                                                                title={`${unit.name} (${drop.rate}%)`}
                                                            >
                                                                <div className="w-8 h-8 rounded bg-white dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                                                    <Image
                                                                        src={getSpritePath(unit.baseUnitId || unit.id, unit.rarity)}
                                                                        alt={unit.name}
                                                                        width={28}
                                                                        height={28}
                                                                        className="object-contain"
                                                                    />
                                                                </div>
                                                                <span className="text-sm font-bold text-green-700 dark:text-green-400">{drop.rate}%</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* 難易度と報酬 */}
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-amber-700 dark:text-amber-400">
                                                {getDifficultyStars(stage.difficulty)}
                                            </span>
                                            <span className="text-amber-700 dark:text-amber-400 font-bold">
                                                💰 {stage.reward.coins.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ヒント */}
            <div className="container mt-6">
                <div className="card text-center text-amber-900/70 dark:text-gray-400 text-sm">
                    {t("stage_hint")}
                </div>
            </div>
        </main>
    );
}
