"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAudio, AudioToggleButton } from "@/contexts/AudioContext";
import Modal, { SuccessModal, ConfirmModal } from "@/components/ui/Modal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { getSpritePath } from "@/lib/sprites";

const allUnits = unitsData as UnitDefinition[];
// ガチャ対象ユニット（コレクション対象）
const collectableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

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
  const { status, playerName, player, logout, updateName } = useAuth();
  const { isMuted, masterVolume, bgmVolume, sfxVolume, bgmEnabled, sfxEnabled, setMasterVolume, setBgmVolume, setSfxVolume, setBgmEnabled, setSfxEnabled } = useAudio();
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [paradeChars, setParadeChars] = useState<ParadeChar[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLogoutSuccess, setShowLogoutSuccess] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showNameSuccess, setShowNameSuccess] = useState(false);
  const [showNameConfirm, setShowNameConfirm] = useState(false);

  const handleEditName = () => {
    setEditedName(playerName || "");
    setNameError("");
    setIsEditingName(true);
  };

  // 名前保存前の確認を表示
  const handleSaveNameClick = () => {
    if (!editedName.trim()) {
      setNameError(language === "ja" ? "名前を入力してください" : "Please enter a name");
      return;
    }
    if (editedName.trim().length > 20) {
      setNameError(language === "ja" ? "名前は20文字以内にしてください" : "Name must be 20 characters or less");
      return;
    }
    // 同じ名前の場合は変更不要
    if (editedName.trim() === playerName) {
      setIsEditingName(false);
      return;
    }
    setShowNameConfirm(true);
  };

  const handleSaveName = async () => {
    setIsUpdatingName(true);
    const result = await updateName(editedName.trim());
    setIsUpdatingName(false);

    if (result.success) {
      setIsEditingName(false);
      setShowPinModal(false);
      setShowNameSuccess(true);
    } else {
      setNameError(result.error || (language === "ja" ? "変更に失敗しました" : "Failed to update"));
    }
  };

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

  // パレードアニメーション - store interval reference for proper cleanup
  useEffect(() => {
    if (paradeChars.length === 0) return;

    const intervalId = setInterval(() => {
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

    return () => {
      clearInterval(intervalId);
    };
  }, [paradeChars.length]);

  // カテゴリ別メニュー
  const menuCategories = {
    main: {
      title: language === "ja" ? "メインゲーム" : "Main Game",
      items: [
        { href: "/stages", icon: "⚔️", label: t("menu_stages") },
      ],
    },
    battle: {
      title: language === "ja" ? "バトルモード" : "Battle Modes",
      items: [
        { href: "/worldmap", icon: "🗺️", label: t("world_map") },
        { href: "/battle", icon: "🤖", label: t("menu_battle") },
      ],
    },
    minigames: {
      title: language === "ja" ? "ミニゲーム" : "Mini Games",
      items: [
        { href: "/arena", icon: "🏟️", label: t("menu_arena") },
        { href: "/survival", icon: "🧟", label: t("menu_survival") },
        { href: "/chess", icon: "♟️", label: t("menu_chess") },
        { href: "/garden", icon: "🌱", label: t("menu_garden") },
      ],
    },
    units: {
      title: language === "ja" ? "ユニット" : "Units",
      items: [
        { href: "/gacha", icon: "🎰", label: t("menu_gacha") },
        { href: "/team", icon: "🎖️", label: t("menu_team") },
        { href: "/collection", icon: "📖", label: t("menu_collection") },
        { href: "/fusion", icon: "🔮", label: t("fusion") },
      ],
    },
    shop: {
      title: language === "ja" ? "ショップ" : "Shop",
      items: [
        { href: "/shop", icon: "🛒", label: t("menu_shop") },
        { href: "/marketplace", icon: "🏪", label: t("menu_marketplace") },
      ],
    },
    other: {
      title: language === "ja" ? "その他" : "Other",
      items: [
        { href: "/ranking", icon: "🏅", label: t("menu_ranking") },
      ],
    },
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-4 relative overflow-hidden">
      {/* 背景（グローバルCSSと同じ） */}

      {/* 言語切り替え & コイン & アカウント */}
      <div className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center gap-1 md:gap-2 z-20">
        {/* アカウントボタン */}
        {status === "authenticated" && playerName ? (
          <button
            onClick={() => setShowPinModal(true)}
            className="btn btn-primary text-xs md:text-sm py-1.5 px-2 md:py-2 md:px-3"
          >
            <span>👤</span>
            <span className="hidden md:inline max-w-[60px] truncate">{playerName}</span>
          </button>
        ) : (
          <Link
            href="/auth"
            className="btn btn-secondary text-xs md:text-sm py-1.5 px-2 md:py-2 md:px-3"
          >
            <span>🔑</span>
            <span className="hidden md:inline">{language === "ja" ? "ログイン" : "Login"}</span>
          </Link>
        )}
        <div className="bg-amber-500/90 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-bold shadow-lg flex items-center gap-1">
          <span>💰</span>
          <span>{isLoaded ? coins.toLocaleString() : "---"}</span>
        </div>
        <div className="bg-purple-500/90 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-bold shadow-lg flex items-center gap-1">
          <span>📖</span>
          <span>{isLoaded ? `${Object.keys(unitInventory).filter(id => unitInventory[id] > 0).length}/${collectableUnits.length}` : "---"}</span>
        </div>
        <LanguageSwitch />
        <ThemeToggle />
        {/* Audio Toggle - click to mute/unmute, long press for settings */}
        <button
          onClick={() => setShowAudioSettings(true)}
          className="px-2 py-1 md:px-3 md:py-1.5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-sm font-bold transition-colors"
          title={language === "ja" ? "オーディオ設定" : "Audio Settings"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* タイトル */}
      <div className="text-center mt-8 mb-6 relative">
        <h1 className="text-5xl md:text-6xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 drop-shadow-lg animate-pulse">
          {t("game_title")}
        </h1>
        <p className="text-lg text-amber-800/80 dark:text-amber-200/80 font-medium">
          {t("game_subtitle")}
        </p>
        {/* 装飾 */}
        <div className="absolute -top-4 -left-8 text-3xl animate-bounce">✨</div>
        <div className="absolute -top-2 -right-6 text-2xl animate-spin" style={{ animationDuration: '3s' }}>⭐</div>
      </div>

      {/* カテゴリ別メニュー */}
      <div className="w-full max-w-3xl px-2 mb-6 space-y-4">
        {/* メインゲーム＆ランキング */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <Link
            href="/stages"
            className="btn btn-primary py-5 flex flex-col items-center justify-center transition-all duration-200 hover:scale-[1.02] shadow-lg"
          >
            <span className="text-3xl mb-1">⚔️</span>
            <span className="text-lg font-bold">{t("menu_stages")}</span>
            <span className="text-xs opacity-80">{menuCategories.main.title}</span>
          </Link>
          <Link
            href="/ranking"
            className="btn btn-primary py-5 flex flex-col items-center justify-center transition-all duration-200 hover:scale-[1.02] shadow-lg"
          >
            <span className="text-3xl mb-1">🏅</span>
            <span className="text-lg font-bold">{t("menu_ranking")}</span>
          </Link>
        </div>

        {/* バトルモード＆ショップ（2列） */}
        <div className="grid grid-cols-2 gap-3">
          {/* バトルモード */}
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-3 shadow-md">
            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 px-1">
              🎮 {menuCategories.battle.title}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {menuCategories.battle.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="btn btn-secondary flex flex-col items-center justify-center py-3 transition-all duration-200 hover:scale-105"
                >
                  <span className="text-2xl mb-1">{item.icon}</span>
                  <span className="text-xs text-center">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* ショップ */}
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-3 shadow-md">
            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 px-1">
              💰 {menuCategories.shop.title}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {menuCategories.shop.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="btn btn-secondary flex flex-col items-center justify-center py-3 transition-all duration-200 hover:scale-105"
                >
                  <span className="text-2xl mb-1">{item.icon}</span>
                  <span className="text-xs text-center">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ユニット管理 */}
        <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-3 shadow-md">
          <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 px-1">
            👥 {menuCategories.units.title}
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {menuCategories.units.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="btn btn-secondary flex flex-col items-center justify-center py-3 transition-all duration-200 hover:scale-105"
              >
                <span className="text-2xl mb-1">{item.icon}</span>
                <span className="text-xs text-center">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ミニゲーム */}
        <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-3 shadow-md">
          <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 px-1">
            🎯 {menuCategories.minigames.title}
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {menuCategories.minigames.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="btn btn-secondary flex flex-col items-center justify-center py-3 transition-all duration-200 hover:scale-105"
              >
                <span className="text-2xl mb-1">{item.icon}</span>
                <span className="text-xs text-center">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

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
        {paradeChars.map((char) => {
          const unit = allUnits.find(u => u.id === char.unitId);
          return (
            <div
              key={char.id}
              className="absolute bottom-10 transition-all duration-100"
              style={{
                left: `${char.x}%`,
                transform: `scaleX(${char.direction}) scale(${char.scale})`,
              }}
            >
              <Image
                src={getSpritePath(char.unitId, unit?.rarity)}
                alt="parade character"
                width={48}
                height={48}
                className="object-contain drop-shadow-md"
              />
            </div>
          );
        })}

        {/* パレード説明（ユニットが少ない場合） */}
        {paradeChars.length === 0 && isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-amber-700/60 dark:text-amber-400/60 text-sm">
            ガチャでユニットを入手するとここに表示！
          </div>
        )}
      </div>

      {/* フッター */}
      <footer className="text-amber-900/40 dark:text-amber-100/40 text-xs py-2">
        Garden Wars MVP - Next.js + Phaser 3
      </footer>

      {/* PIN確認モーダル */}
      <Modal isOpen={showPinModal && !!player} onClose={() => { setShowPinModal(false); setIsEditingName(false); }} showCloseButton={false}>
        {player && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-green-700 dark:text-green-400 mb-4 text-center">
              {language === "ja" ? "アカウント情報" : "Account Info"}
            </h2>

            {/* 名前セクション */}
            <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 mb-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                {language === "ja" ? "なまえ" : "Name"}
              </p>
              {isEditingName ? (
                <div>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => {
                      setEditedName(e.target.value);
                      setNameError("");
                    }}
                    maxLength={20}
                    className="w-full px-3 py-2 border-2 border-green-300 dark:border-green-600 rounded-lg text-lg font-bold text-gray-800 dark:text-white dark:bg-slate-600 focus:outline-none focus:border-green-500"
                    autoFocus
                  />
                  {nameError && (
                    <p className="text-red-500 text-xs mt-1">{nameError}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="flex-1 btn btn-secondary text-sm py-2 disabled:opacity-50"
                      disabled={isUpdatingName}
                    >
                      {language === "ja" ? "キャンセル" : "Cancel"}
                    </button>
                    <button
                      onClick={handleSaveNameClick}
                      className="flex-1 btn btn-primary text-sm py-2 disabled:opacity-50"
                      disabled={isUpdatingName}
                    >
                      {isUpdatingName
                        ? (language === "ja" ? "保存中..." : "Saving...")
                        : (language === "ja" ? "保存" : "Save")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{playerName}</p>
                  <button
                    onClick={handleEditName}
                    className="btn btn-secondary text-sm py-1 px-3"
                  >
                    ✏️ {language === "ja" ? "変更" : "Edit"}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 mb-4">
              <p className="text-amber-700 dark:text-amber-400 text-sm mb-2">
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
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-2 text-center">
                {language === "ja"
                  ? "べつの たんまつで この ばんごうを いれてね"
                  : "Enter this number on other devices"}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowPinModal(false); setIsEditingName(false); }}
                className="flex-1 btn btn-secondary"
              >
                {language === "ja" ? "とじる" : "Close"}
              </button>
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setIsEditingName(false);
                  setShowLogoutConfirm(true);
                }}
                className="flex-1 btn btn-secondary text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
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

      {/* 名前変更完了モーダル */}
      <SuccessModal
        isOpen={showNameSuccess}
        onClose={() => setShowNameSuccess(false)}
        icon="✨"
        title={language === "ja" ? "名前を変更しました" : "Name Updated"}
        message={language === "ja" ? "新しい名前でプレイしよう！" : "Play with your new name!"}
        buttonText="OK"
      />

      {/* 名前変更確認モーダル */}
      <ConfirmModal
        isOpen={showNameConfirm}
        onClose={() => setShowNameConfirm(false)}
        onConfirm={handleSaveName}
        icon="✏️"
        title={language === "ja" ? "名前を変更しますか？" : "Change name?"}
        message={
          language === "ja"
            ? `「${playerName}」から「${editedName.trim()}」に変更します。`
            : `Change from "${playerName}" to "${editedName.trim()}"?`
        }
        confirmText={language === "ja" ? "変更する" : "Change"}
        cancelText={language === "ja" ? "キャンセル" : "Cancel"}
        confirmColor="green"
      />

      {/* オーディオ設定モーダル */}
      <Modal isOpen={showAudioSettings} onClose={() => setShowAudioSettings(false)} showCloseButton={false}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-4 text-center flex items-center justify-center gap-2">
            🔊 {language === "ja" ? "オーディオ設定" : "Audio Settings"}
          </h2>

          {/* Master Volume */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
              {language === "ja" ? "マスター音量" : "Master Volume"}: {Math.round(masterVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume * 100}
              onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* BGM Volume */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                BGM: {Math.round(bgmVolume * 100)}%
              </label>
              <button
                onClick={() => setBgmEnabled(!bgmEnabled)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  bgmEnabled
                    ? "bg-green-500 text-white"
                    : "bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400"
                }`}
              >
                {bgmEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={bgmVolume * 100}
              onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
              disabled={!bgmEnabled}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
            />
          </div>

          {/* SFX Volume */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {language === "ja" ? "効果音" : "SFX"}: {Math.round(sfxVolume * 100)}%
              </label>
              <button
                onClick={() => setSfxEnabled(!sfxEnabled)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  sfxEnabled
                    ? "bg-green-500 text-white"
                    : "bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400"
                }`}
              >
                {sfxEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVolume * 100}
              onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
              disabled={!sfxEnabled}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
            />
          </div>

          {/* Mute indicator */}
          {isMuted && (
            <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm p-2 rounded-lg text-center mb-4">
              {language === "ja" ? "全ての音声がミュートされています" : "All audio is muted"}
            </div>
          )}

          <button
            onClick={() => setShowAudioSettings(false)}
            className="w-full btn btn-primary"
          >
            {language === "ja" ? "閉じる" : "Close"}
          </button>
        </div>
      </Modal>
    </main>
  );
}
