"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

// ============================================
// Battle Selection Page
// ============================================

export default function BattlePage() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6">
      {/* タイトル */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 drop-shadow-lg animate-pulse">
          ⚔️ {t("battle_select_title") || "バトルモード選択"} ⚔️
        </h1>
        <p className="text-amber-700/70 dark:text-amber-300/70 mt-3">
          {t("battle_select_desc") || "対戦モードを選んでください"}
        </p>
      </div>

      {/* モード選択カード */}
      <div className="flex flex-col md:flex-row gap-4 max-w-4xl w-full">
        {/* 非同期対戦 */}
        <button
          onClick={() => router.push("/async-battle")}
          className="flex-1 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-3xl p-6 md:p-8 text-left hover:shadow-2xl transition-all shadow-xl border border-blue-200/50 dark:border-blue-700/30 hover:scale-[1.02] active:scale-[0.98] group"
        >
          <div className="bg-gradient-to-br from-blue-400 to-indigo-500 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg mb-4 group-hover:scale-110 transition-transform">
            🤖
          </div>
          <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-2">
            {t("battle_async_title") || "非同期対戦"}
          </h2>
          <p className="text-blue-600/70 dark:text-blue-400/70 text-sm mb-4">
            {t("battle_async_desc") || "他プレイヤーのチームとAI対戦。いつでも挑戦可能！"}
          </p>
          <div className="flex items-center text-blue-500 dark:text-blue-400 text-sm font-medium">
            <span className="mr-2">→</span>
            {t("battle_async_hint") || "プレイヤーがオフラインでもOK"}
          </div>
        </button>

        {/* リアルタイム対戦 */}
        <button
          onClick={() => router.push("/battle/realtime")}
          className="flex-1 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-3xl p-6 md:p-8 text-left hover:shadow-2xl transition-all shadow-xl border border-orange-200/50 dark:border-orange-700/30 hover:scale-[1.02] active:scale-[0.98] group"
        >
          <div className="bg-gradient-to-br from-orange-400 to-red-500 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg mb-4 group-hover:scale-110 transition-transform">
            ⚔️
          </div>
          <h2 className="text-2xl font-bold text-orange-700 dark:text-orange-300 mb-2">
            {t("battle_realtime_title") || "リアルタイム対戦"}
          </h2>
          <p className="text-orange-600/70 dark:text-orange-400/70 text-sm mb-4">
            {t("battle_realtime_desc") || "オンラインで他プレイヤーとリアルタイム1vs1バトル！"}
          </p>
          <div className="flex items-center text-orange-500 dark:text-orange-400 text-sm font-medium">
            <span className="mr-2">→</span>
            {t("battle_realtime_hint") || "ロビーで対戦相手を探そう"}
          </div>
        </button>
      </div>

      {/* 戻るボタン */}
      <button
        onClick={() => router.push("/")}
        className="mt-10 px-6 py-3 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-all"
      >
        ← {t("back_to_home") || "ホームに戻る"}
      </button>
    </main>
  );
}
