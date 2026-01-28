"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import stagesData from "@/data/stages.json";
import unitsData from "@/data/units.json";
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

// 難易度を計算（星の数）
const getDifficulty = (index: number): string => {
    const stars = Math.min(5, Math.ceil((index + 1) / 1.5));
    return "⭐".repeat(stars);
};

export default function StagesPage() {
    const router = useRouter();
    const { t } = useLanguage();

    const handleSelectStage = (stageId: string) => {
        router.push(`/battle/${stageId}`);
    };

    return (
        <main className="min-h-screen p-8">
            {/* ヘッダー */}
            <div className="page-header mb-8">
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-amber-700 hover:text-amber-600">
                        {t("back_to_home")}
                    </Link>
                    <h1 className="text-3xl font-bold">{t("stage_select")}</h1>
                    <div className="flex items-center gap-3">
                        <LanguageSwitch />
                        <Link href="/team" className="text-amber-700 hover:text-amber-600">
                            {t("team")} →
                        </Link>
                    </div>
                </div>
            </div>

            {/* ステージ一覧 */}
            <div className="container">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {stages.map((stage, index) => {
                        const enemyUnits = getUniqueEnemyUnits(stage);

                        return (
                            <div
                                key={stage.id}
                                className="stage-card"
                                onClick={() => handleSelectStage(stage.id)}
                            >
                                {/* ステージ番号とアイコン */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-amber-900/60">
                                        {t("stage")} {index + 1}
                                    </span>
                                    <span className="text-2xl">
                                        {stageIcons[stage.id] || "🎮"}
                                    </span>
                                </div>

                                {/* ステージ名 */}
                                <h2 className="text-2xl font-bold mb-2 text-amber-950">
                                    {t(stage.name)}
                                </h2>

                                {/* 説明 */}
                                <p className="text-amber-900/70 mb-4 text-sm">{t(stage.description)}</p>

                                {/* 出現する敵ユニット */}
                                <div className="mb-4">
                                    <div className="text-xs text-amber-800 mb-2">{t("encounter_units")}:</div>
                                    <div className="flex gap-2 flex-wrap">
                                        {enemyUnits.map((unit) => (
                                            <div
                                                key={unit.id}
                                                className="w-10 h-10 rounded-lg bg-red-100 border-2 border-red-300 flex items-center justify-center overflow-hidden"
                                                title={unit.name}
                                            >
                                                <Image
                                                    src={`/assets/sprites/${unit.baseUnitId || unit.id}.png`}
                                                    alt={unit.name}
                                                    width={32}
                                                    height={32}
                                                    className="object-contain"
                                                    style={{ transform: unit.flipSprite ? "scaleX(-1)" : "none" }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 敵情報 */}
                                <div className="bg-amber-100/50 rounded-lg p-3 mb-4">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="flex items-center gap-1">
                                            <span className="text-red-500">👾</span>
                                            <span className="text-amber-800">
                                                {t("enemies")}: <strong>{getTotalEnemies(stage)}</strong>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-purple-500">🌊</span>
                                            <span className="text-amber-800">
                                                {t("waves")}: <strong>{stage.enemyWaves.length}</strong>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-blue-500">🏰</span>
                                            <span className="text-amber-800">
                                                {t("enemy_castle_hp")}: <strong>{stage.enemyCastleHp}</strong>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-green-500">🛡️</span>
                                            <span className="text-amber-800">
                                                {t("ally_castle_hp")}: <strong>{stage.baseCastleHp}</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* 難易度と報酬 */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-amber-700">
                                        {getDifficulty(index)}
                                    </span>
                                    <span className="text-amber-700 font-bold">
                                        💰 {stage.reward.coins}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ヒント */}
            <div className="container mt-8">
                <div className="card text-center text-amber-900/70">
                    {t("stage_hint")}
                </div>
            </div>
        </main>
    );
}
