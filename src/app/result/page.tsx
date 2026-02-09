"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Suspense, useMemo } from "react";
import stages, { getNextStage } from "@/data/stages";
import { towerDefenseStages } from "@/data/tower-defense";
import { arenaStages } from "@/data/stages";
import allUnits from "@/data/units";
import type { StageDefinition, UnitDefinition } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSpritePath } from "@/lib/sprites";

const typedStages = stages as StageDefinition[];
const typedUnits = allUnits as UnitDefinition[];

interface DroppedUnit {
    unit: UnitDefinition;
    rate: number;
}

interface ValidationError {
    type: "coins" | "stage" | "general";
    message: string;
}

function validateParams(
    coinsParam: string | null,
    stageId: string | null,
    language: string
): ValidationError | null {
    // Validate coins is a valid positive number
    if (coinsParam !== null) {
        const coinsNum = Number(coinsParam);
        if (isNaN(coinsNum) || coinsNum < 0 || !Number.isFinite(coinsNum)) {
            return {
                type: "coins",
                message: language === "ja"
                    ? "不正なコイン数です"
                    : "Invalid coin amount"
            };
        }
    }

    // Validate stage exists (if provided and not default)
    if (stageId && stageId !== "stage_1") {
        const stageExists = typedStages.some(s => s.id === stageId);
        if (!stageExists) {
            return {
                type: "stage",
                message: language === "ja"
                    ? "存在しないステージです"
                    : "Stage does not exist"
            };
        }
    }

    return null;
}

// ゲームモード別のパス設定
type GameMode = "battle" | "tower-defense" | "arena";

function getModePaths(mode: GameMode) {
    switch (mode) {
        case "tower-defense":
            return { battlePrefix: "/tower-defense", stageSelect: "/tower-defense", label: "🏰 Tower Defense" };
        case "arena":
            return { battlePrefix: "/arena", stageSelect: "/arena", label: "🏟️ Arena" };
        case "battle":
        default:
            return { battlePrefix: "/battle", stageSelect: "/stages", label: "⚔️ Battle" };
    }
}

function ResultContent() {
    const searchParams = useSearchParams();
    const { t, language } = useLanguage();

    const win = searchParams.get("win") === "true";
    const coinsParam = searchParams.get("coins");
    const stageIdParam = searchParams.get("stage");
    const dropsParam = searchParams.get("drops") || "";
    const modeParam = (searchParams.get("mode") || "battle") as GameMode;

    // モード別パス
    const modePaths = useMemo(() => getModePaths(modeParam), [modeParam]);

    // Validate params
    const validationError = useMemo(() => {
        return validateParams(coinsParam, stageIdParam, language);
    }, [coinsParam, stageIdParam, language]);

    // Use validated values with safe defaults
    const coins = useMemo(() => {
        const num = Number(coinsParam || 0);
        return isNaN(num) || num < 0 ? 0 : num;
    }, [coinsParam]);

    const stageId = useMemo(() => {
        if (!stageIdParam) return "stage_1";
        // モードに応じたステージリストで検証
        if (modeParam === "tower-defense") {
            const exists = towerDefenseStages.some(s => s.id === stageIdParam);
            return exists ? stageIdParam : stageIdParam; // TDステージIDはそのまま通す
        }
        if (modeParam === "arena") {
            const exists = arenaStages.some(s => s.id === stageIdParam);
            return exists ? stageIdParam : stageIdParam;
        }
        const stageExists = typedStages.some(s => s.id === stageIdParam);
        return stageExists ? stageIdParam : "stage_1";
    }, [stageIdParam, modeParam]);

    // ドロップ情報をURLパラメータから復元（処理はbattleページで完了済み）
    const droppedUnits = useMemo<DroppedUnit[]>(() => {
        if (!dropsParam) return [];

        const stage = typedStages.find(s => s.id === stageId);
        const dropIds = dropsParam.split(',').filter(id => id);

        return dropIds.map(unitId => {
            const unit = typedUnits.find(u => u.id === unitId);
            const dropInfo = stage?.reward.drops?.find(d => d.unitId === unitId);
            return unit ? { unit, rate: dropInfo?.rate || 0 } : null;
        }).filter((d): d is DroppedUnit => d !== null);
    }, [dropsParam, stageId]);

    // 次のステージを取得（battleモードのみ）
    const nextStage = useMemo(() => {
        if (!win) return null;
        if (modeParam !== "battle") return null; // TD/Arenaは次ステージなし
        return getNextStage(stageId) || null;
    }, [win, stageId, modeParam]);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8 dark:bg-slate-900">
            {/* Validation error warning */}
            {validationError && (
                <div className="mb-6 p-4 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600 rounded-xl max-w-md w-full">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <span className="text-xl">⚠️</span>
                        <span className="font-bold">{validationError.message}</span>
                    </div>
                    <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                        {language === "ja"
                            ? "デフォルト値を使用しています"
                            : "Using default values"}
                    </p>
                </div>
            )}

            {/* 結果アイコン */}
            <div className="text-8xl mb-8 animate-bounce">
                {win ? "🏆" : "😿"}
            </div>

            {/* 結果テキスト */}
            <h1
                className={`text-5xl font-bold mb-4 ${win ? "text-yellow-400" : "text-red-500"
                    }`}
            >
                {win ? t("victory") : t("defeat")}
            </h1>

            {/* 報酬 */}
            {win && (
                <div className="card mb-6 dark:bg-slate-800 dark:border-amber-400/30">
                    <h2 className="text-2xl mb-4 dark:text-white">{t("result_rewards")}</h2>
                    <div className="flex items-center justify-center gap-2 text-3xl mb-4">
                        <span className="text-yellow-400">💰</span>
                        <span className="font-bold text-yellow-300">+{coins}</span>
                        <span className="text-gray-400">{t("coins")}</span>
                    </div>

                    {/* ドロップユニット */}
                    {droppedUnits.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-amber-300/30">
                            <h3 className="text-lg text-green-400 mb-3">{t("result_unit_drop")}</h3>
                            <div className="flex flex-wrap gap-3 justify-center">
                                {droppedUnits.map((drop, i) => (
                                    <div
                                        key={`${drop.unit.id}-${i}`}
                                        className="flex flex-col items-center bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-3 border-2 border-green-400/50 animate-pulse"
                                    >
                                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-green-100 dark:bg-green-900/50 mb-2 flex items-center justify-center">
                                            <Image
                                                src={getSpritePath(drop.unit.id, drop.unit.rarity)}
                                                alt={drop.unit.name}
                                                width={48}
                                                height={48}
                                                className="object-contain"
                                            />
                                        </div>
                                        <span className="text-white font-bold text-sm">{drop.unit.name}</span>
                                        <span className="text-green-300 text-xs">({drop.rate}%)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ドロップなし */}
                    {droppedUnits.length === 0 && (
                        <div className="mt-4 pt-4 border-t border-amber-300/30 text-gray-400 dark:text-gray-500 text-sm">
                            {t("result_no_drop")}
                        </div>
                    )}
                </div>
            )}

            {/* アクションボタン */}
            <div className="flex flex-col gap-4 w-full max-w-md">
                {/* 次のステージへ（勝利時かつbattleモードのみ） */}
                {win && nextStage && (
                    <Link
                        href={`${modePaths.battlePrefix}/${nextStage.id}`}
                        className="btn btn-primary text-center text-lg py-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 border-emerald-600 shadow-lg shadow-emerald-200/50"
                    >
                        ➡️ {t("result_next_stage")}
                    </Link>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        href={`${modePaths.battlePrefix}/${stageId}`}
                        className="btn btn-secondary text-center flex-1 text-lg py-4"
                    >
                        {t("result_retry")}
                    </Link>
                    <Link
                        href={modePaths.stageSelect}
                        className="btn btn-primary text-center flex-1 text-lg py-4"
                    >
                        {t("result_select_stage")}
                    </Link>
                </div>
            </div>

            {/* ホームへ */}
            <Link
                href="/"
                className="mt-8 btn btn-secondary"
            >
                {t("result_home")}
            </Link>

            {/* 励ましメッセージ */}
            {!win && (
                <p className="mt-8 text-gray-500 dark:text-gray-400 text-center">
                    {t("result_encourage")}<br />
                    {t("result_get_strong")}
                </p>
            )}
        </main>
    );
}

export default function ResultPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen flex items-center justify-center dark:bg-slate-900">
                    <div className="animate-spin text-4xl">⏳</div>
                </main>
            }
        >
            <ResultContent />
        </Suspense>
    );
}
