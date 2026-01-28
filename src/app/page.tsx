"use client";

import Link from "next/link";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";

export default function Home() {
  const { coins, isLoaded } = usePlayerData();
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* 言語切り替え */}
      <div className="absolute top-4 right-4">
        <LanguageSwitch />
      </div>

      {/* タイトル */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
          {t("game_title")}
        </h1>
        <p className="text-xl text-amber-900/80">
          {t("game_subtitle")}
        </p>
      </div>

      {/* 猫のアスキーアート */}
      <div className="text-4xl mb-12 animate-bounce">
        🐈
      </div>

      {/* メニューボタン */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link href="/stages" className="btn btn-primary text-center text-xl py-4">
          {t("menu_stages")}
        </Link>
        <Link href="/worldmap" className="btn btn-primary text-center text-xl py-4 bg-gradient-to-r from-sky-400 to-green-400 border-sky-300">
          🗺️ {t("world_map")}
        </Link>
        <Link href="/team" className="btn btn-secondary text-center text-xl py-4">
          {t("menu_team")}
        </Link>
        <Link href="/gacha" className="btn btn-primary text-center text-xl py-4">
          {t("menu_gacha")}
        </Link>
        <Link href="/shop" className="btn btn-secondary text-center text-xl py-4 bg-gradient-to-r from-pink-500 to-red-500 border-pink-400 text-white shadow-lg animate-pulse hover:animate-none">
          🛒 ショップ
        </Link>
        <Link href="/garden" className="btn btn-primary text-center text-xl py-4 bg-gradient-to-r from-green-400 to-teal-500 border-green-300 text-white">
          🌱 ガーデン
        </Link>
        <Link href="/fusion" className="btn btn-secondary text-center text-xl py-4">
          🔮 {t("fusion")}
        </Link>
      </div>

      {/* コイン表示 */}
      <div className="mt-12 card">
        <p className="text-lg">
          <span className="text-amber-600 mr-2">💰</span>
          {t("owned_coins")}: <span className="font-bold text-amber-700">{isLoaded ? coins.toLocaleString() : "---"}</span>
        </p>
      </div>

      {/* フッター */}
      <footer className="mt-auto pt-12 text-amber-900/60 text-sm">
        MVP Version - Built with Next.js + Phaser 3
      </footer>
    </main>
  );
}
