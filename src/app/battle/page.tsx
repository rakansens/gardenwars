"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";

// ============================================
// Battle Selection Page - Premium Modern Style
// ============================================

const BATTLE_MODES = [
  {
    key: "async",
    icon: "🤖",
    gradient: "from-emerald-500 to-teal-600",
    bgPattern: "from-emerald-400/20 to-teal-500/20",
    accentColor: "emerald",
    href: "/async-battle",
  },
  {
    key: "realtime",
    icon: "⚔️",
    gradient: "from-rose-500 to-red-600",
    bgPattern: "from-rose-400/20 to-red-500/20",
    accentColor: "rose",
    href: "/battle/realtime",
  },
] as const;

export default function BattlePage() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <main className="min-h-screen">
      <PageHeader
        title={t("battle_select_title") || "バトルモード選択"}
      />

      <div className="container max-w-4xl mx-auto px-4">
        {/* Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden mb-8 h-36 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-red-600" />
          <div className="absolute inset-0 bg-[url('/assets/ui/battle_bg.webp')] bg-cover bg-center opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 p-5 flex flex-col justify-end">
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl drop-shadow-lg">⚔️</span>
                <div>
                  <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                    {t("battle_select_title") || "バトルモード選択"}
                  </h2>
                  <p className="text-white/80 text-sm">
                    {t("battle_select_desc") || "対戦モードを選んでください"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Battle Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BATTLE_MODES.map((mode) => (
            <div
              key={mode.key}
              onClick={() => router.push(mode.href)}
              className="card group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
            >
              {/* Gradient accent top */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${mode.gradient}`} />

              {/* Background glow */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${mode.bgPattern} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative p-5 pt-6">
                {/* Icon + Title */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-amber-900 dark:text-white mb-1">
                      {t(`battle_${mode.key}_title`) || (mode.key === "async" ? "非同期対戦" : "リアルタイム対戦")}
                    </h2>
                    <p className="text-sm text-amber-700/70 dark:text-slate-300/70 leading-relaxed">
                      {t(`battle_${mode.key}_desc`) || (mode.key === "async"
                        ? "他プレイヤーのチームとAI対戦。いつでも挑戦可能！"
                        : "オンラインで他プレイヤーとリアルタイム1vs1バトル！"
                      )}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-xs text-amber-700/60 dark:text-slate-400">
                    {t(`battle_${mode.key}_hint`) || (mode.key === "async"
                      ? "プレイヤーがオフラインでもOK"
                      : "ロビーで対戦相手を探そう"
                    )}
                  </span>
                  <div className={`flex items-center gap-1.5 bg-gradient-to-r ${mode.gradient} text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300`}>
                    {t(`battle_${mode.key}_start`) || (mode.key === "async" ? "はじめる" : "ロビーへ")}
                    <span className="text-sm">→</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-8 mb-6">
          <div className="card text-center">
            <div className="text-sm text-amber-900/60 dark:text-slate-400">
              💡 {t("battle_tip") || "チームを編成してからバトルに挑もう！"}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
