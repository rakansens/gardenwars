"use client";

import Link from "next/link";
import { arenaStages } from "@/data/stages";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArenaStageDefinition } from "@/data/types";

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

export default function ArenaSelectPage() {
    const { t, language } = useLanguage();

    return (
        <main className="min-h-screen p-4">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
                <Link href="/" className="btn btn-secondary text-sm py-2 px-3">
                    ← {t("back_to_home")}
                </Link>
                <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">🏟️ {t("menu_arena")}</h1>
                <div className="w-20"></div>
            </div>

            {/* 説明 */}
            <div className="text-center mb-6 text-amber-900/70 dark:text-gray-400">
                <p>{language === "ja" ? "5レーンで敵を迎え撃て！" : "Defend against enemies in 5 lanes!"}</p>
                <p className="text-sm mt-1">
                    {language === "ja"
                        ? "① レーンを選択 → ② ユニットをタップで配置"
                        : "① Select lane → ② Tap unit to deploy"}
                </p>
            </div>

            {/* ステージ一覧 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {arenaStages.map((stage: ArenaStageDefinition, index: number) => (
                    <Link
                        key={stage.id}
                        href={`/arena/${stage.id}`}
                        className="card hover:border-amber-400 hover:scale-105 transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-3xl">🏟️</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold text-white ${difficultyColors[stage.difficulty || "normal"]}`}>
                                {difficultyLabels[stage.difficulty || "normal"][language]}
                            </span>
                        </div>

                        <h2 className="text-lg font-bold text-amber-900 dark:text-white mb-1">
                            {t(stage.name) || `Arena ${index + 1}`}
                        </h2>

                        <p className="text-sm text-amber-800/70 dark:text-gray-400 mb-3">
                            {t(stage.description) || stage.description}
                        </p>

                        <div className="flex justify-between text-xs text-amber-700/60 dark:text-gray-500">
                            <span>🏰 {stage.enemyCastleHp} HP</span>
                            <span>💰 {stage.reward.coins}</span>
                        </div>
                    </Link>
                ))}
            </div>
        </main>
    );
}
