"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* タイトル */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
          🐱 Garden Wars 🐱
        </h1>
        <p className="text-xl text-amber-900/80">
          にゃんこ軍団で敵を倒せ！
        </p>
      </div>

      {/* 猫のアスキーアート */}
      <div className="text-4xl mb-12 animate-bounce">
        🐈
      </div>

      {/* メニューボタン */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link href="/stages" className="btn btn-primary text-center text-xl py-4">
          ⚔️ ステージへ
        </Link>
        <Link href="/team" className="btn btn-secondary text-center text-xl py-4">
          🎖️ 編成
        </Link>
        <Link href="/gacha" className="btn btn-primary text-center text-xl py-4">
          🎰 ガチャ
        </Link>
      </div>

      {/* コイン表示 */}
      <div className="mt-12 card">
        <p className="text-lg">
          <span className="text-amber-600 mr-2">💰</span>
          所持コイン: <span className="font-bold text-amber-700">500</span>
        </p>
      </div>

      {/* フッター */}
      <footer className="mt-auto pt-12 text-amber-900/60 text-sm">
        MVP Version - Built with Next.js + Phaser 3
      </footer>
    </main>
  );
}
