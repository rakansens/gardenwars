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
    <main className="min-h-screen p-4 md:p-6">
      {/* タイトル */}
      <div className="max-w-4xl mx-auto text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400">
          ⚔️ {t("battle_select_title") || "バトルモード選択"}
        </h1>
        <p className="text-sm text-amber-700/70 dark:text-amber-300/70 mt-2">
          {t("battle_select_desc") || "対戦モードを選んでください"}
        </p>
      </div>

      {/* モード選択カード */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 非同期対戦 */}
        <div className="card flex flex-col justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-2xl shadow-sm">
              🤖
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-300/80 mb-1">
                {t("battle_async_title") || "非同期対戦"}
              </p>
              <h2 className="text-xl font-bold text-amber-900 dark:text-white">
                {t("battle_async_title") || "非同期対戦"}
              </h2>
              <p className="text-sm text-amber-700/70 dark:text-slate-300/70 mt-2">
                {t("battle_async_desc") || "他プレイヤーのチームとAI対戦。いつでも挑戦可能！"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-amber-700/80 dark:text-slate-300/80">
            <span>{t("battle_async_hint") || "プレイヤーがオフラインでもOK"}</span>
            <button onClick={() => router.push("/async-battle")} className="btn btn-primary text-xs">
              {t("battle_async_start") || "はじめる"}
            </button>
          </div>
        </div>

        {/* リアルタイム対戦 */}
        <div className="card flex flex-col justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-2xl shadow-sm">
              ⚔️
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-700/80 dark:text-rose-300/80 mb-1">
                {t("battle_realtime_title") || "リアルタイム対戦"}
              </p>
              <h2 className="text-xl font-bold text-amber-900 dark:text-white">
                {t("battle_realtime_title") || "リアルタイム対戦"}
              </h2>
              <p className="text-sm text-amber-700/70 dark:text-slate-300/70 mt-2">
                {t("battle_realtime_desc") || "オンラインで他プレイヤーとリアルタイム1vs1バトル！"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-amber-700/80 dark:text-slate-300/80">
            <span>{t("battle_realtime_hint") || "ロビーで対戦相手を探そう"}</span>
            <button onClick={() => router.push("/battle/realtime")} className="btn btn-primary text-xs">
              {t("battle_realtime_start") || "ロビーへ"}
            </button>
          </div>
        </div>
      </div>

      {/* 戻るボタン */}
      <div className="flex justify-center mt-8">
        <button onClick={() => router.push("/")} className="btn btn-secondary">
          ← {t("back_to_home") || "ホームに戻る"}
        </button>
      </div>
    </main>
  );
}
