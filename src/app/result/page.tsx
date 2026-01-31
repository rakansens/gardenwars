"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Suspense, useMemo } from "react";
import stages from "@/data/stages";
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

function ResultContent() {
    const searchParams = useSearchParams();
    const { t } = useLanguage();

    const win = searchParams.get("win") === "true";
    const coins = Number(searchParams.get("coins") || 0);
    const stageId = searchParams.get("stage") || "stage_1";
    const dropsParam = searchParams.get("drops") || "";

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

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8 dark:bg-slate-900">
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
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <Link
                    href={`/battle/${stageId}`}
                    className="btn btn-secondary text-center flex-1 text-lg py-4"
                >
                    {t("result_retry")}
                </Link>
                <Link
                    href="/stages"
                    className="btn btn-primary text-center flex-1 text-lg py-4"
                >
                    {t("result_select_stage")}
                </Link>
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
