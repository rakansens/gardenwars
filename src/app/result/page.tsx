"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ResultContent() {
    const searchParams = useSearchParams();

    const win = searchParams.get("win") === "true";
    const coins = Number(searchParams.get("coins") || 0);
    const stageId = searchParams.get("stage") || "stage_1";

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8">
            {/* 結果アイコン */}
            <div className="text-8xl mb-8 animate-bounce">
                {win ? "🏆" : "😿"}
            </div>

            {/* 結果テキスト */}
            <h1
                className={`text-5xl font-bold mb-4 ${win ? "text-yellow-400" : "text-red-500"
                    }`}
            >
                {win ? "勝利！" : "敗北..."}
            </h1>

            {/* 報酬 */}
            {win && (
                <div className="card mb-8">
                    <h2 className="text-2xl mb-4">🎁 獲得報酬</h2>
                    <div className="flex items-center justify-center gap-2 text-3xl">
                        <span className="text-yellow-400">💰</span>
                        <span className="font-bold text-yellow-300">+{coins}</span>
                        <span className="text-gray-400">コイン</span>
                    </div>
                </div>
            )}

            {/* アクションボタン */}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <Link
                    href={`/battle/${stageId}`}
                    className="btn btn-secondary text-center flex-1 text-lg py-4"
                >
                    🔄 リトライ
                </Link>
                <Link
                    href="/stages"
                    className="btn btn-primary text-center flex-1 text-lg py-4"
                >
                    📋 ステージ選択
                </Link>
            </div>

            {/* ホームへ */}
            <Link
                href="/"
                className="mt-8 btn btn-secondary"
            >
                🏠 ホームへ戻る
            </Link>

            {/* 励ましメッセージ */}
            {!win && (
                <p className="mt-8 text-gray-500 text-center">
                    編成を見直して再チャレンジ！<br />
                    強いユニットを揃えよう 💪
                </p>
            )}
        </main>
    );
}

export default function ResultPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen flex items-center justify-center">
                    <div className="text-xl">Loading...</div>
                </main>
            }
        >
            <ResultContent />
        </Suspense>
    );
}
