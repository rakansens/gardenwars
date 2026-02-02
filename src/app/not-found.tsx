"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NotFound() {
    const { t } = useLanguage();

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
            {/* Cute illustration */}
            <div className="text-9xl mb-6 animate-bounce">
                🌻
            </div>

            {/* Error code */}
            <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-red-500 mb-4">
                404
            </div>

            {/* Message */}
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 text-center">
                {t("page_not_found")}
            </h1>

            <p className="text-gray-600 dark:text-gray-400 text-center mb-8 max-w-md">
                {t("page_not_found_message")}
            </p>

            {/* Decorative elements */}
            <div className="flex items-center gap-4 text-4xl mb-8 opacity-60">
                <span className="animate-pulse">🌸</span>
                <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>🌿</span>
                <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>🍄</span>
                <span className="animate-pulse" style={{ animationDelay: "0.6s" }}>🌷</span>
            </div>

            {/* Home button */}
            <Link
                href="/"
                className="btn btn-primary text-lg py-4 px-8 flex items-center gap-2 transition-all duration-200 hover:scale-105"
            >
                <span>🏠</span>
                <span>{t("back_to_home")}</span>
            </Link>

            {/* Additional helpful links */}
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
                <Link
                    href="/stages"
                    className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                    <span>⚔️</span>
                    {t("stage_select")}
                </Link>
                <Link
                    href="/gacha"
                    className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >
                    <span>🎰</span>
                    {t("gacha")}
                </Link>
                <Link
                    href="/team"
                    className="text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                >
                    <span>🎖️</span>
                    {t("team")}
                </Link>
            </div>
        </main>
    );
}
