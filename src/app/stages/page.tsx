"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import stagesData, { getStagesByWorld } from "@/data/stages";
import unitsData from "@/data/units";
import worlds from "@/data/worlds";
import type { StageDefinition, UnitDefinition, StageDifficulty, WorldId } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/layout/PageHeader";
import { getSpritePath } from "@/lib/sprites";
import { useStageUnlock } from "@/hooks/useStageUnlock";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useWorldUnlock } from "@/hooks/useWorldUnlock";
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
    stage_1: "🌿",
    stage_2: "🌲",
    stage_3: "🏜️",
    stage_4: "🌅",
    stage_5: "🦇",
    stage_6: "🌈",
    stage_7: "🌋",
    stage_8: "👿",
    stage_9: "🧟",
    stage_10: "💀",
    stage_11: "🔥",
    stage_12: "❄️",
    stage_13: "🏔️",
    stage_14: "🌨️",
    stage_15: "🧊",
    stage_16: "⛄",
    stage_17: "🥶",
    stage_18: "🌑",
    stage_19: "☠️",
    stage_20: "🥷",
    stage_21: "🛡️",
    stage_22: "🔥",
    stage_23: "🐕",
    stage_24: "🦅",
    stage_25: "🐺",
    stage_26: "☠️",
    stage_27: "👻",
    stage_28: "💀",
    stage_29: "🧟",
    stage_30: "👹",
    stage_31: "😈",
    stage_32: "☠️",
    boss_stage_1: "🧑",
    boss_stage_2: "🎸",
    boss_stage_3: "👩",
    boss_stage_4: "💃",
    boss_stage_5: "🌙",
    stage_ur_rush: "⚔️",
    stage_sr_rush: "🔥",
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

export default function StagesPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const { playerId, status } = useAuth();
    const { clearedStages, isDifficultyUnlocked, isStageUnlocked, getClearCount } = useStageUnlock();
    const { currentWorld, setCurrentWorld } = usePlayerData();
    const { isWorldUnlocked, getWorldProgress } = useWorldUnlock();
    const [battleStats, setBattleStats] = useState<PlayerBattleStats | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // 現在のワールドをWorldIdとして取得
    const selectedWorld = (currentWorld || "world1") as WorldId;

    // 現在のワールドの難易度タブを取得
    const worldDifficultyTabs = getDifficultyTabsByWorld(selectedWorld);

    // 最初のタブをデフォルトに
    const [selectedDifficulty, setSelectedDifficulty] = useState<StageDifficulty>(
        worldDifficultyTabs[0]?.key || "tutorial"
    );

    // 現在選択中のエリア情報
    const selectedAreaTab = DIFFICULTY_TABS.find(tab => tab.key === selectedDifficulty && tab.worldId === selectedWorld);

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
        const tabs = getDifficultyTabsByWorld(worldId);
        setSelectedDifficulty(tabs[0]?.key || "tutorial");
    };

    const handleSelectDifficulty = (difficulty: StageDifficulty) => {
        setSelectedDifficulty(difficulty);
        setIsSidebarOpen(false); // モバイルでサイドバーを閉じる
    };

    // 現在のワールドのステージを取得
    const worldStages = getStagesByWorld(selectedWorld);

    // 選択された難易度でフィルタ
    const filteredStages = worldStages.filter(s => s.difficulty === selectedDifficulty);

    // 次にプレイすべきステージ（未クリアの最初のステージ）
    const nextStage = filteredStages.find(stage => !clearedStages.includes(stage.id) && isStageUnlocked(stage));

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

            {/* モバイル用サイドバートグル */}
            <div className="lg:hidden container mb-4">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="w-full card flex items-center justify-between p-4"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{selectedAreaTab?.icon}</span>
                        <div>
                            <div className="font-bold text-amber-900 dark:text-white">
                                {t(selectedAreaTab?.labelKey || "")}
                            </div>
                            <div className="text-xs text-amber-700 dark:text-slate-400">
                                {t(selectedAreaTab?.subKey || "")}
                            </div>
                        </div>
                    </div>
                    <span className="text-xl">{isSidebarOpen ? "✕" : "☰"}</span>
                </button>
            </div>

            <div className="container flex gap-6">
                {/* サイドバー */}
                <div className={`
                    fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto
                    ${isSidebarOpen ? "block" : "hidden lg:block"}
                `}>
                    {/* オーバーレイ（モバイル用） */}
                    <div
                        className="fixed inset-0 bg-black/50 lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />

                    {/* サイドバー本体 */}
                    <div className="
                        fixed lg:sticky top-0 lg:top-20 left-0 h-full lg:h-auto
                        w-80 max-w-[85vw] lg:max-w-none
                        bg-white dark:bg-slate-800 lg:bg-transparent
                        overflow-y-auto lg:overflow-visible
                        z-50 lg:z-auto
                        lg:w-72 flex-shrink-0
                    ">
                        <div className="card lg:bg-white/90 lg:dark:bg-slate-800/90 backdrop-blur p-4 lg:rounded-2xl">
                            {/* モバイル用閉じるボタン */}
                            <div className="lg:hidden flex justify-between items-center mb-4 pb-3 border-b border-amber-200 dark:border-slate-600">
                                <span className="font-bold text-amber-900 dark:text-white">ステージ選択</span>
                                <button onClick={() => setIsSidebarOpen(false)} className="text-2xl">✕</button>
                            </div>

                            {/* ワールド選択 */}
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                                    <span>🌍</span> {t("world_select") || "ワールド選択"}
                                </h3>
                                <div className="space-y-3">
                                    {worlds.map((world) => {
                                        const { cleared, total } = getWorldProgress(world.id);
                                        const isSelected = selectedWorld === world.id;
                                        const isLocked = !isWorldUnlocked(world.id);

                                        return (
                                            <button
                                                key={world.id}
                                                onClick={() => !isLocked && handleSelectWorld(world.id)}
                                                disabled={isLocked}
                                                className={`
                                                    relative w-full rounded-xl h-24 overflow-hidden transition-all
                                                    ${isSelected ? "ring-4 ring-yellow-400 shadow-xl scale-[1.02]" : ""}
                                                    ${isLocked ? "opacity-50 cursor-not-allowed grayscale" : "hover:shadow-lg hover:scale-[1.01]"}
                                                `}
                                            >
                                                {/* 背景 */}
                                                <div className={`absolute inset-0 bg-gradient-to-br ${world.gradient}`}>
                                                    {world.banner && (
                                                        <Image
                                                            src={world.banner}
                                                            alt={t(world.nameKey)}
                                                            fill
                                                            className="object-cover opacity-60"
                                                        />
                                                    )}
                                                </div>
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                                                {/* ロックオーバーレイ */}
                                                {isLocked && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                                        <div className="text-center">
                                                            <span className="text-3xl">🔒</span>
                                                            <p className="text-white/80 text-xs mt-1">Coming Soon</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* コンテンツ */}
                                                <div className="absolute inset-0 p-3 flex flex-col justify-end">
                                                    <div className="flex items-end justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-2xl">{world.icon}</span>
                                                            <div className="text-left">
                                                                <div className="text-white font-bold drop-shadow-lg">
                                                                    {t(world.nameKey)}
                                                                </div>
                                                                <div className="text-white/70 text-xs">
                                                                    {t(world.subtitleKey)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!isLocked && (
                                                            <div className="bg-white/20 backdrop-blur px-2 py-1 rounded-lg">
                                                                <div className="text-sm font-bold text-white">
                                                                    {cleared}/{total}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* エリア選択 */}
                            <div>
                                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                                    <span>🗺️</span> {t("area_select") || "エリア選択"}
                                </h3>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                    {worldDifficultyTabs.map(tab => {
                                        const { cleared, total } = getClearCount(tab.key, selectedWorld);
                                        const isSelected = selectedDifficulty === tab.key;
                                        const isAllCleared = cleared === total && total > 0;
                                        const isLocked = !isDifficultyUnlocked(tab.key, selectedWorld);

                                        return (
                                            <button
                                                key={tab.key}
                                                onClick={() => !isLocked && handleSelectDifficulty(tab.key)}
                                                disabled={isLocked}
                                                className={`
                                                    relative w-full rounded-xl h-16 overflow-hidden transition-all
                                                    ${isSelected ? "ring-4 ring-yellow-400 shadow-lg" : ""}
                                                    ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:translate-x-1"}
                                                `}
                                            >
                                                {/* 背景 */}
                                                <div className={`absolute inset-0 bg-gradient-to-r ${tab.gradient}`}>
                                                    {tab.banner && (
                                                        <Image
                                                            src={tab.banner}
                                                            alt={t(tab.labelKey)}
                                                            fill
                                                            className="object-cover opacity-50"
                                                        />
                                                    )}
                                                </div>
                                                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />

                                                {/* ロックオーバーレイ */}
                                                {isLocked && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-between px-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl grayscale">{tab.icon}</span>
                                                            <div className="text-left">
                                                                <div className="text-sm font-bold text-white/60">{t(tab.labelKey)}</div>
                                                                <div className="text-xs text-white/40">{t("area_locked") || "前のエリアをクリア"}</div>
                                                            </div>
                                                        </div>
                                                        <span className="text-xl">🔒</span>
                                                    </div>
                                                )}

                                                {/* コンテンツ */}
                                                {!isLocked && (
                                                    <div className="absolute inset-0 p-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-2xl drop-shadow">{tab.icon}</span>
                                                            <div className="text-left">
                                                                <div className="text-sm font-bold text-white drop-shadow">
                                                                    {t(tab.labelKey)}
                                                                </div>
                                                                <div className="text-xs text-white/70">
                                                                    {t(tab.subKey)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className={`
                                                            text-xs font-bold px-2 py-1 rounded-full shadow
                                                            ${isAllCleared
                                                                ? "bg-green-500 text-white"
                                                                : "bg-white/20 backdrop-blur text-white"
                                                            }
                                                        `}>
                                                            {isAllCleared ? `${cleared}/${total} ✓` : `${cleared}/${total}`}
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* メインコンテンツ */}
                <div className="flex-1 min-w-0">
                    {/* エリアヘッダーバナー */}
                    {selectedAreaTab && (
                        <div className="relative rounded-2xl overflow-hidden mb-6 h-36 shadow-xl">
                            <div className={`absolute inset-0 bg-gradient-to-br ${selectedAreaTab.gradient}`}>
                                {selectedAreaTab.banner && (
                                    <Image
                                        src={selectedAreaTab.banner}
                                        alt={t(selectedAreaTab.labelKey)}
                                        fill
                                        className="object-cover opacity-60"
                                    />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                            <div className="absolute inset-0 p-5 flex flex-col justify-end">
                                <div className="flex items-end justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-4xl drop-shadow-lg">{selectedAreaTab.icon}</span>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                                                {t(selectedAreaTab.labelKey)}
                                            </h2>
                                            <p className="text-white/80 text-sm">
                                                {t(selectedAreaTab.subKey)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-white/20 backdrop-blur px-4 py-2 rounded-xl">
                                        <div className="text-2xl font-bold text-white">
                                            {getClearCount(selectedDifficulty, selectedWorld).cleared}/
                                            {getClearCount(selectedDifficulty, selectedWorld).total}
                                        </div>
                                        <div className="text-xs text-white/80">{t("stages_cleared") || "ステージクリア"}</div>
                                    </div>
                                </div>
                                {/* 進捗バー */}
                                <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-400 to-green-400 rounded-full transition-all"
                                        style={{
                                            width: `${(getClearCount(selectedDifficulty, selectedWorld).cleared / getClearCount(selectedDifficulty, selectedWorld).total * 100) || 0}%`
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 戦績バー（コンパクト表示） */}
                    {status === "authenticated" && battleStats && battleStats.total_battles > 0 && (
                        <div className="mb-4">
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
                            </div>
                        </div>
                    )}

                    {/* ステージ一覧 */}
                    {filteredStages.length === 0 ? (
                        <div className="text-center py-12 text-amber-700 dark:text-amber-400">
                            <div className="text-4xl mb-4">🏜️</div>
                            <p>{t("no_stages_in_category")}</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {filteredStages.map((stage) => {
                                const enemyUnits = getUniqueEnemyUnits(stage);
                                const isCleared = clearedStages.includes(stage.id);
                                const stageImage = stage.background?.image || `/assets/stages/${stage.id}.webp`;
                                const isLocked = !isStageUnlocked(stage);
                                const isNext = nextStage?.id === stage.id;

                                return (
                                    <div
                                        key={stage.id}
                                        className={`
                                            card relative overflow-hidden transition-all
                                            ${isNext ? "ring-4 ring-yellow-400 shadow-xl md:col-span-2" : ""}
                                            ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:-translate-y-1 hover:shadow-lg"}
                                            ${isCleared && !isNext ? "ring-2 ring-green-400" : ""}
                                        `}
                                        onClick={() => !isLocked && handleSelectStage(stage.id)}
                                    >
                                        {/* サムネイル画像 */}
                                        <div className={`relative ${isNext ? "h-40" : "h-32"} -mx-4 -mt-4 mb-3 overflow-hidden`}>
                                            <Image
                                                src={stageImage}
                                                alt={t(stage.name)}
                                                fill
                                                className="object-cover transition-transform group-hover:scale-105"
                                            />
                                            <div className={`absolute inset-0 bg-gradient-to-t from-amber-50 dark:from-slate-800 via-transparent to-transparent ${isLocked ? "bg-black/30" : ""}`} />

                                            {/* ロックオーバーレイ */}
                                            {isLocked && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                                    <span className="text-4xl">🔒</span>
                                                </div>
                                            )}

                                            {/* バッジ */}
                                            {isNext && !isLocked && (
                                                <div className="absolute top-3 left-3 bg-amber-500 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg animate-pulse z-10">
                                                    ⭐ NEXT!
                                                </div>
                                            )}
                                            {isCleared && !isLocked && !isNext && (
                                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                                                    ✓ CLEAR
                                                </div>
                                            )}

                                            {/* ステージ番号 */}
                                            <div className="absolute bottom-2 left-3 text-white">
                                                <div className="text-xs opacity-80">STAGE</div>
                                                <div className={`${isNext ? "text-3xl" : "text-xl"} font-bold drop-shadow-lg`}>
                                                    {stage.id.replace(/[^0-9]/g, '') || stageIcons[stage.id] || "?"}
                                                </div>
                                            </div>
                                            <span className={`absolute bottom-2 right-3 ${isNext ? "text-4xl" : "text-2xl"} drop-shadow-lg`}>
                                                {stageIcons[stage.id] || "🎮"}
                                            </span>
                                        </div>

                                        {/* コンテンツ */}
                                        <div className={isLocked ? "grayscale" : ""}>
                                            <h2 className={`${isNext ? "text-xl" : "text-lg"} font-bold mb-1 text-amber-950 dark:text-white`}>
                                                {t(stage.name)}
                                            </h2>
                                            <p className="text-amber-900/70 dark:text-gray-400 mb-3 text-sm">
                                                {t(stage.description)}
                                            </p>

                                            {/* 敵ユニット（NEXT以外はコンパクト表示） */}
                                            {isNext ? (
                                                <div className="mb-3">
                                                    <div className="text-xs text-amber-800 dark:text-gray-400 mb-1.5">{t("encounter_units")}:</div>
                                                    <div className="flex gap-2 flex-wrap">
                                                        {enemyUnits.slice(0, 6).map((unit) => {
                                                            const isBoss = unit.isBoss;
                                                            return (
                                                                <div
                                                                    key={unit.id}
                                                                    className={`w-11 h-11 rounded-lg flex items-center justify-center overflow-hidden ${
                                                                        isBoss ? "bg-purple-900 border-2 border-purple-500" : "bg-red-100 border-2 border-red-300"
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
                                            ) : null}

                                            {/* 敵情報 */}
                                            <div className="flex gap-4 text-sm text-amber-700 dark:text-amber-400 mb-3">
                                                <span>👾 {getTotalEnemies(stage)}</span>
                                                <span>🌊 {stage.enemyWaves.length}</span>
                                                <span>💰 {stage.reward.coins.toLocaleString()}</span>
                                            </div>

                                            {/* ドロップ報酬（NEXT時のみ） */}
                                            {isNext && stage.reward.drops && stage.reward.drops.length > 0 && (
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

                                            {/* バトル開始ボタン（NEXT時のみ） */}
                                            {isNext && !isLocked && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectStage(stage.id);
                                                    }}
                                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition"
                                                >
                                                    ⚔️ {t("battle_start") || "バトル開始"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ヒント */}
                    <div className="mt-6">
                        <div className="card text-center text-amber-900/70 dark:text-gray-400 text-sm">
                            {t("stage_hint")}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
