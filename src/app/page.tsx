"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import Modal, { SuccessModal, ConfirmModal } from "@/components/ui/Modal";
import unitsData from "@/data/units";
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
  const { t, language } = useLanguage();
  const { status, playerName, player, logout } = useAuth();
  const [paradeChars, setParadeChars] = useState<ParadeChar[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLogoutSuccess, setShowLogoutSuccess] = useState(false);

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
    { href: "/ranking", icon: "🏅", label: t("menu_ranking"), type: "secondary" },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center p-4 relative overflow-hidden">
      {/* 背景（グローバルCSSと同じ） */}

      {/* 言語切り替え & コイン & アカウント */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        {/* アカウントボタン */}
        {status === "authenticated" && playerName ? (
          <button
            onClick={() => setShowPinModal(true)}
            className="bg-green-500/90 text-white px-3 py-2 rounded-full font-bold shadow-lg flex items-center gap-1 text-sm hover:bg-green-600 transition-colors"
          >
            <span>👤</span>
            <span className="max-w-[60px] truncate">{playerName}</span>
          </button>
        ) : (
          <Link
            href="/auth"
            className="bg-blue-500/90 text-white px-3 py-2 rounded-full font-bold shadow-lg flex items-center gap-1 text-sm hover:bg-blue-600 transition-colors"
          >
            <span>🔑</span>
            <span>{language === "ja" ? "ログイン" : "Login"}</span>
          </Link>
        )}
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

      {/* PIN確認モーダル */}
      <Modal isOpen={showPinModal && !!player} onClose={() => setShowPinModal(false)} showCloseButton={false}>
        {player && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-green-700 mb-4 text-center">
              {language === "ja" ? "アカウント情報" : "Account Info"}
            </h2>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-gray-600 text-sm mb-1">
                {language === "ja" ? "なまえ" : "Name"}
              </p>
              <p className="text-lg font-bold text-gray-800">{playerName}</p>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 mb-4">
              <p className="text-amber-700 text-sm mb-2">
                {language === "ja" ? "あなたの ばんごう" : "Your Number"}
              </p>
              <div className="flex justify-center gap-1">
                {player.pin.split("").map((digit, i) => (
                  <div
                    key={i}
                    className="w-10 h-12 bg-gradient-to-b from-amber-400 to-amber-500 rounded-lg flex items-center justify-center text-2xl font-bold text-white shadow"
                  >
                    {digit}
                  </div>
                ))}
              </div>
              <p className="text-amber-600 text-xs mt-2 text-center">
                {language === "ja"
                  ? "べつの たんまつで この ばんごうを いれてね"
                  : "Enter this number on other devices"}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPinModal(false)}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all active:scale-95 min-h-[48px]"
              >
                {language === "ja" ? "とじる" : "Close"}
              </button>
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setShowLogoutConfirm(true);
                }}
                className="flex-1 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl transition-all active:scale-95 min-h-[48px]"
              >
                {language === "ja" ? "ログアウト" : "Logout"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ログアウト確認モーダル */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          logout();
          setShowLogoutSuccess(true);
        }}
        icon="👋"
        title={language === "ja" ? "ログアウトしますか？" : "Log out?"}
        message={language === "ja"
          ? "別の端末でプレイするときは、番号を覚えておいてね！"
          : "Remember your number to play on other devices!"}
        confirmText={language === "ja" ? "ログアウト" : "Log out"}
        cancelText={language === "ja" ? "やめる" : "Cancel"}
        confirmColor="red"
      />

      {/* ログアウト完了モーダル */}
      <SuccessModal
        isOpen={showLogoutSuccess}
        onClose={() => setShowLogoutSuccess(false)}
        icon="👋"
        title={language === "ja" ? "ログアウトしました" : "Logged out"}
        message={language === "ja" ? "またね！" : "See you again!"}
        buttonText="OK"
      />
    </main>
  );
}
