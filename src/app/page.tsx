"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";
import unitsData from "@/data/units.json";
import type { UnitDefinition } from "@/data/types";

const allUnits = unitsData as UnitDefinition[];

// パレード用のキャラ
interface ParadeChar {
  id: string;
  unitId: string;
  x: number;
  speed: number;
  direction: 1 | -1;
  scale: number;
}

export default function Home() {
  const { coins, unitInventory, isLoaded } = usePlayerData();
  const { t } = useLanguage();
  const [paradeChars, setParadeChars] = useState<ParadeChar[]>([]);

  // 所持ユニットからパレードキャラを生成
  useEffect(() => {
    if (!isLoaded) return;

    const ownedUnitIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
    const validUnits = ownedUnitIds
      .map(id => allUnits.find(u => u.id === id))
      .filter((u): u is UnitDefinition =>
        u !== undefined && !u.id.startsWith("enemy_") && !u.id.startsWith("boss_")
      );

    // 最大10体、ランダムに選択
    const shuffled = [...validUnits].sort(() => Math.random() - 0.5).slice(0, 10);

    const chars: ParadeChar[] = shuffled.map((unit, i) => ({
      id: `parade-${i}`,
      unitId: unit.baseUnitId || unit.id,
      x: Math.random() * 100,
      speed: 15 + Math.random() * 25,
      direction: Math.random() > 0.5 ? 1 : -1,
      scale: 0.8 + Math.random() * 0.4,
    }));

    setParadeChars(chars);
  }, [isLoaded, unitInventory]);

  // パレードアニメーション
  useEffect(() => {
    if (paradeChars.length === 0) return;

    const interval = setInterval(() => {
      setParadeChars(prev => prev.map(char => {
        let newX = char.x + (char.speed * char.direction * 0.05);
        let newDirection = char.direction;

        // 画面端で折り返し
        if (newX > 105) {
          newX = 105;
          newDirection = -1;
        } else if (newX < -5) {
          newX = -5;
          newDirection = 1;
        }

        return { ...char, x: newX, direction: newDirection };
      }));
    }, 50);

    return () => clearInterval(interval);
  }, [paradeChars.length]);

  const menuItems = [
    { href: "/stages", icon: "⚔️", label: t("menu_stages"), type: "primary" },
    { href: "/worldmap", icon: "🗺️", label: t("world_map"), type: "primary" },
    { href: "/team", icon: "🎖️", label: t("menu_team"), type: "secondary" },
    { href: "/collection", icon: "📖", label: t("menu_collection"), type: "secondary" },
    { href: "/gacha", icon: "🎰", label: t("menu_gacha"), type: "primary" },
    { href: "/shop", icon: "🛒", label: t("menu_shop"), type: "secondary" },
    { href: "/fusion", icon: "🔮", label: t("fusion"), type: "secondary" },
    { href: "/garden", icon: "🌱", label: t("menu_garden"), type: "primary" },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center p-4 relative overflow-hidden">
      {/* 背景（グローバルCSSと同じ） */}

      {/* 言語切り替え & コイン */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
        <div className="bg-amber-500/90 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
          <span className="text-lg">💰</span>
          <span>{isLoaded ? coins.toLocaleString() : "---"}</span>
        </div>
        <LanguageSwitch />
      </div>

      {/* タイトル */}
      <div className="text-center mt-8 mb-6 relative">
        <h1 className="text-5xl md:text-6xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 drop-shadow-lg animate-pulse">
          {t("game_title")}
        </h1>
        <p className="text-lg text-amber-800/80 font-medium">
          {t("game_subtitle")}
        </p>
        {/* 装飾 */}
        <div className="absolute -top-4 -left-8 text-3xl animate-bounce">✨</div>
        <div className="absolute -top-2 -right-6 text-2xl animate-spin" style={{ animationDuration: '3s' }}>⭐</div>
      </div>

      {/* メニューグリッド */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl px-2 mb-6">
        {menuItems.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              btn ${item.type === "primary" ? "btn-primary" : "btn-secondary"}
              flex flex-col items-center justify-center
              transition-all duration-200
              hover:scale-105
              ${index === 0 ? "md:col-span-2 py-6" : "py-4"}
            `}
          >
            <span className="text-3xl mb-1">{item.icon}</span>
            <span className="text-sm md:text-base text-center">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* キャラパレードエリア */}
      <div className="relative w-full h-24 mt-auto mb-4 overflow-hidden">
        {/* 地面 */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-green-600 to-green-400 rounded-t-3xl" />
        <div className="absolute bottom-8 left-0 right-0 h-4 bg-gradient-to-t from-green-400/50 to-transparent" />

        {/* 草のデコレーション */}
        <div className="absolute bottom-6 left-[10%] text-2xl">🌿</div>
        <div className="absolute bottom-6 left-[30%] text-xl">🌸</div>
        <div className="absolute bottom-6 left-[50%] text-2xl">🌻</div>
        <div className="absolute bottom-6 left-[70%] text-xl">🌷</div>
        <div className="absolute bottom-6 left-[90%] text-2xl">🌿</div>

        {/* パレードキャラ */}
        {paradeChars.map((char) => (
          <div
            key={char.id}
            className="absolute bottom-10 transition-all duration-100"
            style={{
              left: `${char.x}%`,
              transform: `scaleX(${char.direction}) scale(${char.scale})`,
            }}
          >
            <Image
              src={`/assets/sprites/${char.unitId}.png`}
              alt="parade character"
              width={48}
              height={48}
              className="object-contain drop-shadow-md"
            />
          </div>
        ))}

        {/* パレード説明（ユニットが少ない場合） */}
        {paradeChars.length === 0 && isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-amber-700/60 text-sm">
            ガチャでユニットを入手するとここに表示！
          </div>
        )}
      </div>

      {/* フッター */}
      <footer className="text-amber-900/40 text-xs py-2">
        Garden Wars MVP - Next.js + Phaser 3
      </footer>
    </main>
  );
}
