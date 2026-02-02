"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import stagesData, { getStagesByWorld } from "@/data/stages";
import unitsData from "@/data/units";
import type { StageDefinition, UnitDefinition, StageDifficulty, WorldId } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";
import { getSpritePath } from "@/lib/sprites";
import { useStageUnlock } from "@/hooks/useStageUnlock";
import { usePlayerData } from "@/hooks/usePlayerData";
import WorldTabs from "@/components/WorldTabs";

const stages = stagesData as StageDefinition[];
const allUnits = unitsData as UnitDefinition[];

// エリアタブの設定
const AREA_TABS: {
    key: StageDifficulty | "all";
    labelKey: string;
    subKey: string;
    icon: string;
    gradient: string;
    banner: string;
}[] = [
    {
        key: "tutorial",
        labelKey: "difficulty_tutorial",
        subKey: "difficulty_tutorial_sub",
        icon: "🌱",
        gradient: "from-green-400 to-emerald-600",
        banner: "/assets/stages/tutorial_banner.webp",
    },
    {
        key: "easy",
        labelKey: "difficulty_easy",
        subKey: "difficulty_easy_sub",
        icon: "🌲",
        gradient: "from-green-500 to-teal-600",
        banner: "/assets/stages/easy_banner.webp",
    },
    {
        key: "normal",
        labelKey: "difficulty_normal",
        subKey: "difficulty_normal_sub",
        icon: "🌅",
        gradient: "from-orange-400 to-rose-500",
        banner: "/assets/stages/normal_banner.webp",
    },
    {
        key: "hard",
        labelKey: "difficulty_hard",
        subKey: "difficulty_hard_sub",
        icon: "🌑",
        gradient: "from-purple-600 to-indigo-900",
        banner: "/assets/stages/hard_banner.webp",
    },
    {
        key: "extreme",
        labelKey: "difficulty_extreme",
        subKey: "difficulty_extreme_sub",
        icon: "🔥",
        gradient: "from-red-600 to-red-900",
        banner: "/assets/stages/extreme_banner.webp",
    },
    {
        key: "boss",
        labelKey: "difficulty_boss",
        subKey: "difficulty_boss_sub",
        icon: "👑",
        gradient: "from-purple-700 to-black",
        banner: "/assets/stages/boss_banner.webp",
    },
    // World 2 エリア
    {
        key: "purgatory",
        labelKey: "difficulty_purgatory",
        subKey: "difficulty_purgatory_sub",
        icon: "🔥",
        gradient: "from-orange-700 to-red-900",
        banner: "/assets/stages/purgatory_banner.webp",
    },
    {
        key: "hellfire",
        labelKey: "difficulty_hellfire",
        subKey: "difficulty_hellfire_sub",
        icon: "🌋",
        gradient: "from-red-700 to-orange-900",
        banner: "/assets/stages/hellfire_banner.webp",
    },
    {
        key: "abyss",
        labelKey: "difficulty_abyss",
        subKey: "difficulty_abyss_sub",
        icon: "🕳️",
        gradient: "from-purple-900 to-gray-900",
        banner: "/assets/stages/abyss_banner.webp",
    },
    {
        key: "inferno_boss",
        labelKey: "difficulty_inferno_boss",
        subKey: "difficulty_inferno_boss_sub",
        icon: "👹",
        gradient: "from-red-900 to-black",
        banner: "/assets/stages/inferno_boss_banner.webp",
    },
];

// ステージのテーマアイコン
const stageIcons: { [key: string]: string } = {
    tutorial_1: "🌱",
    tutorial_2: "🌿",
    tutorial_3: "🌻",
    stage_1: "🌲",
    stage_2: "🌲",
    stage_3: "🌲",
    stage_4: "🌅",
    stage_5: "🌅",
    stage_6: "🌅",
    stage_7: "🌅",
    stage_8: "🌅",
    stage_9: "🌑",
    stage_10: "🌑",
    stage_11: "🌑",
    stage_12: "🌑",
    stage_13: "🌑",
    stage_14: "🌑",
    stage_15: "🌑",
    stage_16: "🔥",
    stage_17: "🔥",
    stage_18: "🔥",
    stage_19: "🔥",
    stage_20: "🔥",
    boss_stage_1: "👑",
    boss_stage_2: "🐉",
    boss_stage_3: "💀",
    boss_stage_4: "💃",
    boss_stage_5: "🌙",
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

// 難易度の星数
const difficultyStars: { [key: string]: number } = {
    tutorial: 1,
    easy: 2,
    normal: 3,
    hard: 4,
    extreme: 5,
    boss: 5,
    special: 5,
    // World 2
    purgatory: 6,
    hellfire: 7,
    abyss: 8,
    inferno_boss: 9,
};

// ステージに出現する敵ユニットの種類を取得
const getUniqueEnemyUnits = (stage: StageDefinition): UnitDefinition[] => {
    const unitIds = [...new Set(stage.enemyWaves.map((w) => w.unitId))];
    return unitIds
        .map((id) => allUnits.find((u) => u.id === id))
        .filter((u): u is UnitDefinition => u !== undefined);
};

// サムネイル画像のパスを取得
const getStageThumbnail = (stageId: string): string => {
    return `/assets/stages/${stageId}.webp`;
};

export default function WorldMapPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const { clearedStages, isDifficultyUnlocked, isStageUnlocked, getClearCount } = useStageUnlock();
    const { currentWorld, setCurrentWorld } = usePlayerData();
    const [selectedStage, setSelectedStage] = useState<StageDefinition | null>(null);
    const [activeArea, setActiveArea] = useState<StageDifficulty | "all">("tutorial");
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 現在のワールドをWorldIdとして取得
    const selectedWorld = (currentWorld || "world1") as WorldId;

    const handleSelectWorld = (worldId: WorldId) => {
        setCurrentWorld(worldId);
        setActiveArea("tutorial"); // ワールド切り替え時はエリアをリセット
    };

    // 現在のワールドのステージを取得
    const worldStages = getStagesByWorld(selectedWorld);

    // エリアに応じたステージをフィルタリング
    const filteredStages = useMemo(() => {
        if (activeArea === "all") return worldStages;
        return worldStages.filter((s) => s.difficulty === activeArea);
    }, [activeArea, worldStages]);

    // 進行度計算（現在のワールドのみ）
    const totalStages = worldStages.length;
    const clearedCount = worldStages.filter((s) => clearedStages.includes(s.id)).length;
    const progressPercent = totalStages > 0 ? Math.round((clearedCount / totalStages) * 100) : 0;

    // ステージ選択
    const handleSelectStage = (stage: StageDefinition) => {
        setSelectedStage(stage);
    };

    // バトル開始
    const handleStartBattle = () => {
        if (selectedStage) {
            router.push(`/battle/${selectedStage.id}`);
        }
    };

    // パネルを閉じる
    const closePanel = () => {
        setSelectedStage(null);
    };

    // エリア切り替え時にスクロールをリセット
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = 0;
        }
    }, [activeArea]);

    // 現在のエリアタブ情報を取得
    const currentAreaTab = AREA_TABS.find((tab) => tab.key === activeArea) || AREA_TABS[0];

    return (
        <main className="min-h-screen pb-32">
            <PageHeader title={`🗺️ ${t("world_map")}`}>
                <Link href="/stages" className="btn btn-secondary">
                    📋 {t("list")}
                </Link>
                <Link href="/team" className="btn btn-primary">
                    🎮 {t("team")}
                </Link>
            </PageHeader>

            {/* ワールドタブ */}
            <WorldTabs
                selectedWorld={selectedWorld}
                onSelectWorld={handleSelectWorld}
            />

            {/* プログレスバー */}
            <div className="card mb-4 p-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-amber-900">{t("worldmap_progress")}</span>
                    <span className="font-extrabold text-amber-600">
                        {t("worldmap_cleared").replace("{{cleared}}", String(clearedCount)).replace("{{total}}", String(totalStages))}
                    </span>
                </div>
                <div className="h-3 bg-amber-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* エリアタブ - ビジュアルカード */}
            <div className="mb-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                    {AREA_TABS.map((tab) => {
                        const areaStages = worldStages.filter((s) => s.difficulty === tab.key);
                        const areaClearedCount = areaStages.filter((s) => clearedStages.includes(s.id)).length;
                        const isActive = activeArea === tab.key;
                        const isAllCleared = areaClearedCount === areaStages.length && areaStages.length > 0;
                        const isLocked = !isDifficultyUnlocked(tab.key as StageDifficulty, selectedWorld);

                        return (
                            <button
                                key={tab.key}
                                onClick={() => !isLocked && setActiveArea(tab.key)}
                                disabled={isLocked}
                                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                                    isLocked
                                        ? "opacity-50 cursor-not-allowed grayscale"
                                        : isActive
                                            ? "ring-4 ring-yellow-400 scale-105 shadow-2xl z-10"
                                            : "hover:scale-102 hover:shadow-lg opacity-80 hover:opacity-100"
                                }`}
                            >
                                {/* バナー画像背景 */}
                                <div className={`relative h-20 sm:h-24 bg-gradient-to-br ${tab.gradient}`}>
                                    <Image
                                        src={tab.banner}
                                        alt={t(tab.labelKey)}
                                        fill
                                        className="object-cover opacity-80"
                                    />
                                    {/* オーバーレイ */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                                    {/* ロックアイコン */}
                                    {isLocked && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                            <span className="text-2xl">🔒</span>
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
                                        <div className="text-lg sm:text-xl mb-0.5">{tab.icon}</div>
                                        <div className="text-white font-bold text-[10px] sm:text-xs leading-tight drop-shadow-lg truncate">
                                            {t(tab.labelKey)}
                                        </div>
                                        <div className="text-white/70 text-[8px] sm:text-[10px] drop-shadow hidden sm:block">
                                            {t(tab.subKey)}
                                        </div>
                                        <div className={`text-[9px] sm:text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full inline-block w-fit ${
                                            isAllCleared ? "bg-green-500/80" : "bg-white/30"
                                        } text-white`}>
                                            {areaClearedCount}/{areaStages.length}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* メインマップコンテナ */}
            <div className="card p-0 overflow-hidden relative">
                {/* バナー背景 */}
                <div className="absolute top-0 left-0 right-0 h-28 overflow-hidden opacity-30">
                    <Image
                        src={currentAreaTab.banner}
                        alt={t(currentAreaTab.labelKey)}
                        fill
                        className="object-cover"
                        style={{
                            maskImage: "linear-gradient(to bottom, black 60%, transparent)",
                            WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent)",
                        }}
                    />
                </div>

                {/* デコレーション */}
                <div className="absolute top-4 left-[10%] text-4xl animate-float opacity-60 pointer-events-none">☁️</div>
                <div className="absolute top-8 right-[15%] text-3xl animate-float-delayed opacity-60 pointer-events-none">☁️</div>

                {/* マップスクロールエリア */}
                <div
                    ref={scrollContainerRef}
                    className="overflow-x-auto overflow-y-hidden px-6 py-8 relative"
                    style={{ scrollbarWidth: "thin", scrollbarColor: "#d4a76a #f6ead2" }}
                >
                    {/* SVGパス */}
                    <svg
                        className="absolute top-0 left-0 pointer-events-none"
                        style={{
                            width: `${Math.max(filteredStages.length * 160 + 100, 800)}px`,
                            height: "300px",
                        }}
                    >
                        {filteredStages.slice(0, -1).map((stage, i) => {
                            const x1 = 80 + i * 160;
                            const y1 = 120 + (i % 2 === 0 ? 0 : 50);
                            const x2 = 80 + (i + 1) * 160;
                            const y2 = 120 + ((i + 1) % 2 === 0 ? 0 : 50);
                            const isPathCleared = clearedStages.includes(stage.id);

                            return (
                                <path
                                    key={`path-${stage.id}`}
                                    d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 30} ${x2} ${y2}`}
                                    stroke={isPathCleared ? "#22c55e" : "#d4a76a"}
                                    strokeWidth="6"
                                    strokeDasharray={isPathCleared ? "none" : "12,8"}
                                    fill="none"
                                    strokeLinecap="round"
                                    opacity={isPathCleared ? "0.8" : "0.5"}
                                />
                            );
                        })}
                    </svg>

                    {/* ステージノード */}
                    <div
                        className="flex gap-8 relative z-10"
                        style={{ minWidth: `${filteredStages.length * 160}px`, paddingTop: "20px" }}
                    >
                        {filteredStages.map((stage, index) => {
                            const isCleared = clearedStages.includes(stage.id);
                            const unlocked = isStageUnlocked(stage);
                            const yOffset = index % 2 === 0 ? 0 : 50;
                            const isSelected = selectedStage?.id === stage.id;
                            const isBoss = stage.difficulty === "boss" || stage.isBossStage;
                            const stars = stage.difficulty ? difficultyStars[stage.difficulty] : 3;

                            return (
                                <div
                                    key={stage.id}
                                    className={`
                                        relative flex-shrink-0 w-36 cursor-pointer
                                        transition-all duration-300 ease-out
                                        ${unlocked ? "hover:-translate-y-3 hover:scale-105" : "opacity-50 cursor-not-allowed"}
                                        ${isSelected ? "-translate-y-3 scale-105" : ""}
                                    `}
                                    style={{ marginTop: `${yOffset + 30}px` }}
                                    onClick={() => unlocked && handleSelectStage(stage)}
                                >
                                    {/* ステージ番号バッジ - ロック時はグレースケール */}
                                    <div
                                        className={`
                                            absolute -top-3 left-1/2 -translate-x-1/2 z-20
                                            px-3 py-1 rounded-xl font-extrabold text-sm
                                            border-3 shadow-md
                                            ${!unlocked ? 'grayscale' : ''}
                                            ${isBoss
                                                ? "bg-gradient-to-r from-purple-400 to-violet-500 border-purple-700 text-white"
                                                : "bg-gradient-to-r from-amber-300 to-amber-400 border-amber-700 text-amber-900"
                                            }
                                        `}
                                    >
                                        {isBoss ? "👑 BOSS" : index + 1}
                                    </div>

                                    {/* クリアバッジ */}
                                    {isCleared && (
                                        <div className="absolute -top-2 right-2 z-30 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-extrabold px-2 py-1 rounded-lg border-2 border-white shadow-md">
                                            ✓ CLEAR
                                        </div>
                                    )}

                                    {/* サムネイル画像 - ロック時も色を保持 */}
                                    <div
                                        className={`
                                            relative w-32 h-20 mx-auto rounded-xl overflow-hidden
                                            border-4 shadow-lg
                                            ${isCleared
                                                ? "border-green-500 shadow-green-400/50"
                                                : isBoss
                                                    ? "border-purple-500 shadow-purple-400/50"
                                                    : "border-amber-600 shadow-amber-400/30"
                                            }
                                            ${isSelected ? "ring-4 ring-amber-400 ring-offset-2" : ""}
                                        `}
                                    >
                                        <Image
                                            src={getStageThumbnail(stage.id)}
                                            alt={t(stage.name)}
                                            fill
                                            className="object-cover"
                                        />

                                        {/* グラデーションオーバーレイ */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                                        {/* ステージアイコン */}
                                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-2xl drop-shadow-lg">
                                            {stageIcons[stage.id] || "🎮"}
                                        </span>

                                        {/* ロックオーバーレイ */}
                                        {!unlocked && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <span className="text-3xl">🔒</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* ステージ名 - ロック時はグレースケール */}
                                    <div className={`mt-2 text-center ${!unlocked ? 'grayscale' : ''}`}>
                                        <div
                                            suppressHydrationWarning
                                            className={`
                                                text-xs font-bold px-2 py-1 rounded-lg
                                                border-2 truncate
                                                ${isBoss
                                                    ? "bg-gradient-to-r from-purple-100 to-violet-100 border-purple-400 text-purple-900"
                                                    : "bg-white/90 border-amber-400 text-amber-900"
                                                }
                                            `}
                                        >
                                            {unlocked ? t(stage.name).replace(/^[🌱🌿🌻🌲🌅🌑🔥👑🐉💀💃🌙⚔️🔮]\s*/, "") : "???"}
                                        </div>
                                        <div className="text-amber-500 text-xs mt-1">
                                            {Array.from({ length: stars }).map((_, i) => (
                                                <span key={i}>⭐</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* スクロールヒント */}
                <div className="text-center text-amber-700 text-sm py-2 bg-gradient-to-t from-amber-100/80 to-transparent">
                    ← {t("scroll_hint")} →
                </div>
            </div>

            {/* 選択ステージ詳細パネル（下からスライド） */}
            <div
                className={`
                    fixed bottom-0 left-0 right-0 z-50
                    bg-gradient-to-t from-amber-100 to-amber-50
                    border-t-4 border-amber-600
                    shadow-[0_-10px_30px_rgba(0,0,0,0.2)]
                    transition-transform duration-300 ease-out
                    ${selectedStage ? "translate-y-0" : "translate-y-full"}
                `}
            >
                {selectedStage && (
                    <div className="p-4 md:p-6 max-w-5xl mx-auto">
                        {/* 閉じるボタン */}
                        <button
                            onClick={closePanel}
                            className="absolute top-3 right-4 text-2xl text-amber-700 hover:scale-125 transition-transform"
                        >
                            ✕
                        </button>

                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                            {/* サムネイル - 大きめに */}
                            <div className="relative w-full md:w-64 h-40 md:h-44 flex-shrink-0 rounded-xl overflow-hidden border-4 border-amber-600 shadow-lg">
                                <Image
                                    src={getStageThumbnail(selectedStage.id)}
                                    alt={t(selectedStage.name)}
                                    fill
                                    className="object-cover"
                                />
                            </div>

                            {/* ステージ情報 */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-3xl">{stageIcons[selectedStage.id] || "🎮"}</span>
                                    <h2 className="text-xl md:text-2xl font-extrabold text-amber-900 truncate">
                                        {t(selectedStage.name)}
                                    </h2>
                                </div>
                                <p className="text-amber-700 text-sm mb-3">{t(selectedStage.description)}</p>

                                {/* ステータス */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    <div className="flex items-center gap-1 bg-amber-200/70 px-3 py-1.5 rounded-lg text-sm font-bold text-amber-900">
                                        <span>👾</span>
                                        <span>{t("enemies")}:</span>
                                        <strong>{selectedStage.enemyWaves.reduce((sum, w) => sum + w.count, 0)}</strong>
                                    </div>
                                    <div className="flex items-center gap-1 bg-amber-200/70 px-3 py-1.5 rounded-lg text-sm font-bold text-amber-900">
                                        <span>🏰</span>
                                        <span>{t("enemy_castle_hp")}:</span>
                                        <strong>{selectedStage.enemyCastleHp}</strong>
                                    </div>
                                    <div className="flex items-center gap-1 bg-amber-200/70 px-3 py-1.5 rounded-lg text-sm font-bold text-amber-900">
                                        <span>💰</span>
                                        <span>{t("reward_coins")}:</span>
                                        <strong className="text-yellow-600">{selectedStage.reward.coins}</strong>
                                    </div>
                                </div>

                                {/* 敵ユニット表示 - 大きめアイコン */}
                                <div className="flex items-center gap-3 flex-wrap mb-3">
                                    <span className="text-sm text-red-700 font-bold">{t("encounter_units")}:</span>
                                    {getUniqueEnemyUnits(selectedStage).slice(0, 8).map((unit) => (
                                        <div
                                            key={unit.id}
                                            className="w-12 h-12 rounded-lg bg-red-100 border-2 border-red-300 flex items-center justify-center overflow-hidden"
                                            title={unit.name}
                                        >
                                            <Image
                                                src={getSpritePath(unit.baseUnitId || unit.id, unit.rarity)}
                                                alt={unit.name}
                                                width={40}
                                                height={40}
                                                className="object-contain"
                                                style={{ transform: unit.flipSprite ? "scaleX(-1)" : "none" }}
                                            />
                                        </div>
                                    ))}
                                    {getUniqueEnemyUnits(selectedStage).length > 8 && (
                                        <span className="text-sm text-red-600 font-bold">
                                            +{getUniqueEnemyUnits(selectedStage).length - 8}
                                        </span>
                                    )}
                                </div>

                                {/* ドロップ報酬表示 */}
                                {selectedStage.reward.drops && selectedStage.reward.drops.length > 0 && (
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-sm text-green-700 font-bold">🎁 {t("drops")}:</span>
                                        {selectedStage.reward.drops.map((drop) => {
                                            const unit = allUnits.find((u) => u.id === drop.unitId);
                                            if (!unit) return null;
                                            return (
                                                <div
                                                    key={drop.unitId}
                                                    className="flex items-center gap-2 bg-green-100 border-2 border-green-300 rounded-lg px-2 py-1"
                                                    title={unit.name}
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
                                                        <Image
                                                            src={getSpritePath(unit.baseUnitId || unit.id, unit.rarity)}
                                                            alt={unit.name}
                                                            width={36}
                                                            height={36}
                                                            className="object-contain"
                                                        />
                                                    </div>
                                                    <span className="text-sm text-green-800 font-bold">{drop.rate}%</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* アクションボタン */}
                            <div className="flex gap-3 w-full md:w-auto md:flex-col">
                                <button
                                    onClick={closePanel}
                                    className="flex-1 md:flex-none btn btn-secondary text-lg py-3"
                                >
                                    ✕ {t("close")}
                                </button>
                                <button
                                    onClick={handleStartBattle}
                                    className="flex-1 md:flex-none btn btn-primary text-xl font-extrabold px-8 py-3"
                                >
                                    ⚔️ {t("battle_start")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* CSSアニメーション用のスタイル */}
            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) translateX(0); }
                    50% { transform: translateY(-10px) translateX(10px); }
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                .animate-float-delayed {
                    animation: float 8s ease-in-out infinite;
                    animation-delay: -3s;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </main>
    );
}
