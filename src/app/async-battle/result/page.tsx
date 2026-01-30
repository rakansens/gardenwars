"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { Suspense } from "react";

function AsyncBattleResultContent() {
    const searchParams = useSearchParams();
    const { t } = useLanguage();

    const win = searchParams.get("win") === "true";
    const opponentId = searchParams.get("opponent") || "";

    return (
        <main className="min-h-screen p-4 md:p-8 bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
            <div className="text-center">
                {/* 結果 */}
                <div className={`text-8xl mb-6 ${win ? "animate-bounce" : ""}`}>
                    {win ? "🏆" : "💀"}
                </div>

                <h1 className={`text-5xl md:text-6xl font-bold mb-4 ${win ? "text-amber-400" : "text-red-500"}`}>
                    {win ? t("async_victory") : t("async_defeat")}
                </h1>

                <p className="text-xl text-gray-400 mb-8">
                    {win
                        ? "You defeated your opponent!"
                        : "Better luck next time!"
                    }
                </p>

                {/* ボタン */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/async-battle"
                        className="btn bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-8 py-4 rounded-xl text-lg"
                    >
                        🔄 {t("async_battle_title")}
                    </Link>
                    <Link
                        href="/"
                        className="btn bg-slate-700 hover:bg-slate-600 text-white font-bold px-8 py-4 rounded-xl text-lg"
                    >
                        🏠 {t("back_to_home")}
                    </Link>
                </div>
            </div>
        </main>
    );
}

export default function AsyncBattleResultPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
            <AsyncBattleResultContent />
        </Suspense>
    );
}
