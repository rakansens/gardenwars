"use client";

import type { PlayerState } from "@/lib/colyseus/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  myPlayer: PlayerState | null;
  opponent: PlayerState | null;
  countdown: number;
  phase: string;
  isWinner: boolean | null;
  winReason: string | null;
  onLeave: () => void;
}

export function RealtimeBattleHUD({
  myPlayer,
  opponent,
  countdown,
  phase,
  isWinner,
  winReason,
  onLeave,
}: Props) {
  const { t } = useLanguage();

  if (phase === "waiting") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
        <div className="text-center p-8 bg-gray-800 rounded-xl">
          <div className="text-3xl mb-4 animate-bounce">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            {t("battle_waiting_for_opponent")}
          </h2>
          <p className="text-gray-400 mb-6">
            {t("battle_waiting_message")}
          </p>
          <button
            onClick={onLeave}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 pointer-events-none">
        <div className="text-center">
          <div className="text-8xl font-bold text-yellow-400 animate-pulse drop-shadow-lg">
            {countdown}
          </div>
          <p className="text-2xl text-white mt-4">GET READY!</p>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
        <div className="text-center p-8 bg-gray-800 rounded-xl">
          <div className="text-6xl mb-4">
            {isWinner ? "🎉" : "💀"}
          </div>
          <h2 className={`text-4xl font-bold mb-4 ${isWinner ? "text-yellow-400" : "text-red-500"}`}>
            {isWinner ? t("victory") : t("defeat")}
          </h2>
          <p className="text-gray-300 mb-6">
            {winReason === "castle_destroyed" ? t("battle_castle_destroyed") : t("battle_opponent_disconnected")}
          </p>
          <button
            onClick={onLeave}
            className="btn btn-secondary text-xl"
          >
            ← {t("back")}
          </button>
        </div>
      </div>
    );
  }

  // 対戦中のHUD
  return (
    <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
      <div className="flex justify-between items-start p-4">
        {/* 自分の情報 */}
        <div className="bg-blue-900/80 rounded-lg p-3 pointer-events-auto">
          <div className="text-blue-300 text-sm">YOU</div>
          <div className="text-white font-bold">{myPlayer?.displayName || "Player"}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-green-400">🏰</span>
            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{
                  width: `${myPlayer && myPlayer.maxCastleHp > 0
                    ? Math.min(100, Math.max(0, (myPlayer.castleHp / myPlayer.maxCastleHp) * 100))
                    : 0}%`,
                }}
              />
            </div>
            <span className="text-white text-xs">
              {myPlayer?.castleHp || 0}
            </span>
          </div>
        </div>

        {/* VS */}
        <div className="text-2xl font-bold text-white bg-black/50 px-4 py-2 rounded-lg">
          VS
        </div>

        {/* 相手の情報 */}
        <div className="bg-red-900/80 rounded-lg p-3 pointer-events-auto text-right">
          <div className="text-red-300 text-sm">ENEMY</div>
          <div className="text-white font-bold">{opponent?.displayName || "Opponent"}</div>
          <div className="flex items-center gap-2 mt-1 justify-end">
            <span className="text-white text-xs">
              {opponent?.castleHp || 0}
            </span>
            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-300"
                style={{
                  width: `${opponent && opponent.maxCastleHp > 0
                    ? Math.min(100, Math.max(0, (opponent.castleHp / opponent.maxCastleHp) * 100))
                    : 0}%`,
                }}
              />
            </div>
            <span className="text-red-400">🏰</span>
          </div>
        </div>
      </div>
    </div>
  );
}
