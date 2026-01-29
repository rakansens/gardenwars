"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import stagesData from "@/data/stages.json";
import unitsData from "@/data/units";
import type { StageDefinition, UnitDefinition } from "@/data/types";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";

const stages = stagesData as StageDefinition[];
const allUnits = unitsData as UnitDefinition[];

// ステージのテーマアイコン
const stageIcons: { [key: string]: string } = {
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
    boss_stage_1: "🧑",
    boss_stage_2: "🎸",
    boss_stage_3: "👩",
    boss_stage_4: "💃",
    boss_stage_5: "🌙",
};

// ステージに出現する敵ユニットの種類を取得
const getUniqueEnemyUnits = (stage: StageDefinition): UnitDefinition[] => {
    const unitIds = [...new Set(stage.enemyWaves.map((w) => w.unitId))];
    return unitIds
        .map((id) => allUnits.find((u) => u.id === id))
        .filter((u): u is UnitDefinition => u !== undefined);
};

// ボスステージのボスユニットを取得
const getBossUnit = (stage: StageDefinition): UnitDefinition | undefined => {
    const bossWave = stage.enemyWaves.find(w => {
        const unit = allUnits.find(u => u.id === w.unitId);
        return unit?.isBoss;
    });
    if (!bossWave) return undefined;
    return allUnits.find(u => u.id === bossWave.unitId);
};

export default function WorldMapPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [clearedStages, setClearedStages] = useState<string[]>([]);
    const [selectedStage, setSelectedStage] = useState<StageDefinition | null>(null);

    useEffect(() => {
        try {
            const cleared = JSON.parse(localStorage.getItem("clearedStages") || "[]");
            setClearedStages(cleared);
        } catch {
            setClearedStages([]);
        }
    }, []);

    const handleSelectStage = (stageId: string) => {
        router.push(`/battle/${stageId}`);
    };

    const isUnlocked = (index: number) => {
        if (index === 0) return true;
        return clearedStages.includes(stages[index - 1].id);
    };

    // 通常ステージとボスステージを分離
    const normalStages = stages.filter(s => !s.id.startsWith('boss_'));
    const bossStages = stages.filter(s => s.id.startsWith('boss_'));

    return (
        <main className="min-h-screen p-4 md:p-8">
            {/* ヘッダー */}
            <div className="page-header mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold">🗺️ {t("world_map")}</h1>
                    <div className="flex items-center gap-2">
                        <LanguageSwitch />
                        <Link href="/stages" className="btn btn-secondary">
                            📋 {t("list")}
                        </Link>
                        <Link href="/team" className="btn btn-primary">
                            🎮 {t("team")}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container">
                {/* ワールドマップ（横スクロール） */}
                <div className="card overflow-x-auto mb-8">
                    <h2 className="text-xl font-bold mb-4 text-amber-900">🌍 {t("stage_select")}</h2>
                    <div className="relative min-w-max pb-4" style={{ minHeight: '200px' }}>

                        {/* 道のパス（SVG） */}
                        <svg
                            className="absolute top-0 left-0 pointer-events-none z-0"
                            style={{ width: `${normalStages.length * 100 + 50}px`, height: '180px' }}
                        >
                            {normalStages.slice(0, -1).map((stage, i) => {
                                const x1 = 50 + i * 100;
                                const y1 = 70 + (i % 2 === 0 ? 0 : 40);
                                const x2 = 50 + (i + 1) * 100;
                                const y2 = 70 + ((i + 1) % 2 === 0 ? 0 : 40);
                                const isPathCleared = clearedStages.includes(stage.id);

                                return (
                                    <path
                                        key={`path-${i}`}
                                        d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 20} ${x2} ${y2}`}
                                        stroke={isPathCleared ? "#22c55e" : "#d4a76a"}
                                        strokeWidth="4"
                                        strokeDasharray={isPathCleared ? "none" : "8,6"}
                                        fill="none"
                                        strokeLinecap="round"
                                        opacity="0.6"
                                    />
                                );
                            })}
                        </svg>

                        {/* 通常ステージノード */}
                        <div className="relative flex items-start gap-0 pl-6" style={{ minWidth: `${normalStages.length * 100}px` }}>
                            {normalStages.map((stage, index) => {
                                const isCleared = clearedStages.includes(stage.id);
                                const unlocked = isUnlocked(index);
                                const yOffset = index % 2 === 0 ? 0 : 40;

                                return (
                                    <div
                                        key={stage.id}
                                        className="relative flex-shrink-0"
                                        style={{
                                            marginTop: `${yOffset + 30}px`,
                                            width: '100px'
                                        }}
                                    >
                                        {/* ステージノード */}
                                        <button
                                            onClick={() => unlocked && setSelectedStage(stage)}
                                            disabled={!unlocked}
                                            className={`
                                                relative w-16 h-16 rounded-full mx-auto
                                                bg-gradient-to-b from-amber-200 to-amber-400
                                                border-4 border-amber-600
                                                flex flex-col items-center justify-center
                                                transition-all duration-200
                                                ${unlocked ? 'hover:scale-110 cursor-pointer shadow-lg hover:shadow-xl' : 'opacity-40 cursor-not-allowed grayscale'}
                                                ${isCleared ? 'ring-4 ring-green-400 ring-offset-2 ring-offset-amber-100' : ''}
                                                ${selectedStage?.id === stage.id ? 'scale-110 ring-4 ring-amber-500' : ''}
                                            `}
                                        >
                                            <span className="text-2xl">{stageIcons[stage.id] || "🎮"}</span>
                                            <span className="absolute -bottom-1 text-[10px] font-bold text-white bg-amber-700 px-1.5 rounded-full">
                                                {index + 1}
                                            </span>

                                            {/* クリアマーク */}
                                            {isCleared && (
                                                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow border-2 border-white">
                                                    ✓
                                                </div>
                                            )}

                                            {/* ロックマーク */}
                                            {!unlocked && (
                                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                                    <span className="text-xl">🔒</span>
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="text-center text-amber-700 text-sm mt-2">
                        ← {t("scroll_hint")} →
                    </div>
                </div>

                {/* ボスステージ専用エリア */}
                <div className="card bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200 border-4 border-amber-500">
                    <h2 className="text-xl font-bold text-amber-900 mb-4 text-center">👑 BOSS STAGES 👑</h2>
                    <div className="flex gap-6 justify-center flex-wrap">
                        {bossStages.map((stage, bossIndex) => {
                            const isCleared = clearedStages.includes(stage.id);
                            const unlocked = bossIndex === 0 || clearedStages.includes(bossStages[bossIndex - 1]?.id);
                            const bossUnit = getBossUnit(stage);

                            return (
                                <div key={stage.id} className="flex flex-col items-center">
                                    <button
                                        onClick={() => unlocked && setSelectedStage(stage)}
                                        disabled={!unlocked}
                                        className={`
                                            relative w-16 h-16 rounded-full
                                            bg-gradient-to-b from-purple-300 to-purple-500
                                            border-4 border-purple-600
                                            flex flex-col items-center justify-center
                                            transition-all duration-200 overflow-hidden
                                            ${unlocked ? 'hover:scale-110 cursor-pointer shadow-lg hover:shadow-xl' : 'opacity-40 cursor-not-allowed grayscale'}
                                            ${isCleared ? 'ring-4 ring-green-400' : ''}
                                            ${selectedStage?.id === stage.id ? 'scale-110 ring-4 ring-yellow-400' : ''}
                                        `}
                                    >
                                        {/* ボスユニットのシルエット */}
                                        {bossUnit ? (
                                            <Image
                                                src={`/assets/sprites/${bossUnit.baseUnitId || bossUnit.id}.png`}
                                                alt="???"
                                                width={40}
                                                height={40}
                                                className="object-contain"
                                                style={{
                                                    filter: "brightness(0) drop-shadow(0 0 2px #9333ea)"
                                                }}
                                            />
                                        ) : (
                                            <span className="text-2xl">{stageIcons[stage.id] || "👑"}</span>
                                        )}

                                        {isCleared && (
                                            <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                                                ✓
                                            </div>
                                        )}

                                        {!unlocked && (
                                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                                <span className="text-lg">🔒</span>
                                            </div>
                                        )}
                                    </button>
                                    <span className="text-xs text-amber-800 mt-2 font-bold text-center max-w-20 truncate">
                                        {t(stage.name).replace(/.*BOSS: ?/, '')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 選択中のステージ詳細モーダル */}
            {selectedStage && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedStage(null)}
                >
                    <div
                        className="bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl p-6 max-w-md w-full shadow-2xl border-4 border-amber-400"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ステージヘッダー */}
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border-4 border-amber-600 flex items-center justify-center">
                                <span className="text-3xl">{stageIcons[selectedStage.id] || "🎮"}</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-amber-900">{t(selectedStage.name)}</h2>
                                <p className="text-amber-700 text-sm">{t(selectedStage.description)}</p>
                            </div>
                        </div>

                        {/* 敵ユニット表示 */}
                        <div className="mb-4">
                            <div className="text-xs text-red-700 mb-2 font-bold">👾 {t("encounter_units")}:</div>
                            <div className="flex gap-2 flex-wrap">
                                {getUniqueEnemyUnits(selectedStage).map((unit) => {
                                    const isBoss = unit.isBoss;
                                    return (
                                        <div
                                            key={unit.id}
                                            className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ${isBoss
                                                    ? 'bg-purple-900 border-2 border-purple-500'
                                                    : 'bg-red-100 border-2 border-red-300'
                                                }`}
                                            title={isBoss ? "???" : unit.name}
                                        >
                                            {isBoss ? (
                                                <div className="relative w-full h-full flex items-center justify-center">
                                                    <Image
                                                        src={`/assets/sprites/${unit.baseUnitId || unit.id}.png`}
                                                        alt="???"
                                                        width={32}
                                                        height={32}
                                                        className="object-contain"
                                                        style={{
                                                            transform: unit.flipSprite ? "scaleX(-1)" : "none",
                                                            filter: "brightness(0) drop-shadow(0 0 3px #a855f7)"
                                                        }}
                                                    />
                                                    <span className="absolute text-lg font-bold text-purple-300">?</span>
                                                </div>
                                            ) : (
                                                <Image
                                                    src={`/assets/sprites/${unit.baseUnitId || unit.id}.png`}
                                                    alt={unit.name}
                                                    width={32}
                                                    height={32}
                                                    className="object-contain"
                                                    style={{ transform: unit.flipSprite ? "scaleX(-1)" : "none" }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ステージ情報 */}
                        <div className="bg-amber-50 rounded-lg p-4 mb-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <span>👾</span>
                                    <span className="text-amber-800">
                                        {t("enemies")}: <strong>{selectedStage.enemyWaves.reduce((sum, w) => sum + w.count, 0)}</strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>🏰</span>
                                    <span className="text-amber-800">
                                        {t("enemy_castle_hp")}: <strong>{selectedStage.enemyCastleHp}</strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>💰</span>
                                    <span className="text-amber-800">
                                        {t("reward_coins")}: <strong className="text-yellow-600">{selectedStage.reward.coins}</strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>🛡️</span>
                                    <span className="text-amber-800">
                                        {t("ally_castle_hp")}: <strong>{selectedStage.baseCastleHp}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ドロップ情報 */}
                        {selectedStage.reward.drops && selectedStage.reward.drops.length > 0 && (
                            <div className="mb-4">
                                <div className="text-xs text-green-700 mb-2 font-bold">🎁 {t("drops")}:</div>
                                <div className="flex gap-2 flex-wrap">
                                    {selectedStage.reward.drops.map((drop) => {
                                        const unit = allUnits.find(u => u.id === drop.unitId);
                                        if (!unit) return null;
                                        return (
                                            <div
                                                key={drop.unitId}
                                                className="flex items-center gap-1 bg-green-100 border border-green-300 rounded-lg px-2 py-1"
                                            >
                                                <div className="w-6 h-6 rounded overflow-hidden flex items-center justify-center bg-white">
                                                    <Image
                                                        src={`/assets/sprites/${unit.baseUnitId || unit.id}.png`}
                                                        alt={unit.name}
                                                        width={20}
                                                        height={20}
                                                        className="object-contain"
                                                    />
                                                </div>
                                                <span className="text-xs text-green-800 font-bold">{drop.rate}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* アクションボタン */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedStage(null)}
                                className="flex-1 btn btn-secondary"
                            >
                                ✕ {t("close")}
                            </button>
                            <button
                                onClick={() => handleSelectStage(selectedStage.id)}
                                className="flex-1 btn btn-primary text-lg font-bold"
                            >
                                ⚔️ {t("battle_start")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
