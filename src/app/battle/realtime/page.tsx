"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRealtime } from "@/hooks/useRealtime";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { RealtimeBattleHUD } from "./components/RealtimeBattleHUD";
import { LobbyRoom } from "@/lib/colyseus/client";
import allUnits from "@/data/units";
import { getSpritePath } from "@/lib/sprites";
import { getAsyncBattleHistory, type AsyncBattleResult } from "@/lib/supabase";

// ============================================
// Realtime Battle Page with Lobby
// ============================================

// Phaserは動的インポート（SSR回避）
const GameContainer = dynamic(() => import("./components/GameContainer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-amber-800 dark:text-amber-200">Loading game...</div>
    </div>
  ),
});

// ユニットIDから画像パスを取得
function getUnitImagePath(unitId: string): string {
  const def = allUnits.find(u => u.id === unitId);
  if (def) {
    return getSpritePath(unitId, def.rarity);
  }
  return "/assets/sprites/unknown.webp";
}

// Helper function for relative time
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ロビー画面コンポーネント
function LobbyView({
  rooms,
  isLoading,
  onRefresh,
  onQuickMatch,
  onCreateRoom,
  onJoinRoom,
  onBack,
  battleHistory,
  playerId,
}: {
  rooms: LobbyRoom[];
  isLoading: boolean;
  onRefresh: () => void;
  onQuickMatch: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onBack: () => void;
  battleHistory: AsyncBattleResult[];
  playerId: string | null;
}) {
  const { t } = useLanguage();
  const [showHistory, setShowHistory] = useState(true);

  return (
    <main className="min-h-screen flex flex-col items-center p-4 md:p-6">
      {/* タイトル */}
      <div className="text-center mt-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 drop-shadow-lg">
          ⚔️ {t("realtime_title") || "リアルタイム対戦"} ⚔️
        </h1>
        <p className="text-amber-700/70 dark:text-amber-300/70 mt-2">
          {t("realtime_subtitle") || "オンラインでリアルタイムバトル！"}
        </p>
      </div>

      {/* アクションボタン */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 w-full max-w-md">
        <button
          onClick={onQuickMatch}
          className="flex-1 btn btn-primary py-4 text-lg flex items-center justify-center gap-2"
        >
          <span className="text-2xl">🎮</span>
          <span>{t("realtime_quick_match") || "クイックマッチ"}</span>
        </button>
        <button
          onClick={onCreateRoom}
          className="flex-1 btn btn-secondary py-4 text-lg flex items-center justify-center gap-2"
        >
          <span className="text-2xl">➕</span>
          <span>{t("realtime_create_room") || "部屋を作成"}</span>
        </button>
      </div>

      {/* 待機中の部屋一覧 */}
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <span>📋</span> {t("realtime_waiting_rooms") || "待機中の部屋"}
          </h2>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-300 rounded-xl font-bold text-sm disabled:opacity-50 transition-all active:scale-95"
          >
            {isLoading ? `🔄 ${t("loading") || "更新中..."}` : `🔄 ${t("refresh") || "更新"}`}
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur rounded-2xl p-8 text-center shadow-lg border border-amber-200/50 dark:border-amber-700/30">
            <div className="text-4xl mb-4">🏠</div>
            <p className="text-amber-700 dark:text-amber-300 font-medium">
              {isLoading ? (t("loading") || "部屋を検索中...") : (t("realtime_no_rooms") || "現在待機中の部屋はありません")}
            </p>
            <p className="text-amber-600/60 dark:text-amber-400/60 text-sm mt-2">
              {t("realtime_no_rooms_hint") || "「部屋を作成」で対戦相手を待つか、「クイックマッチ」で自動マッチング！"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.roomId}
                className="bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-2xl p-4 flex items-center justify-between shadow-lg border border-amber-200/50 dark:border-amber-700/30 hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-4">
                  {/* ホスト名 */}
                  <div className="bg-gradient-to-br from-amber-400 to-orange-500 w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl shadow-md">
                    👤
                  </div>
                  <div>
                    <p className="font-bold text-amber-800 dark:text-amber-200">{room.hostName}</p>
                    <p className="text-amber-600/60 dark:text-amber-400/60 text-xs">
                      {new Date(room.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* デッキプレビュー */}
                  <div className="hidden sm:flex gap-1">
                    {room.hostDeckPreview.map((unitId, idx) => (
                      <div key={idx} className="w-10 h-10 rounded-lg overflow-hidden bg-amber-100 dark:bg-amber-900/50 shadow">
                        <Image
                          src={getUnitImagePath(unitId)}
                          alt={unitId}
                          width={40}
                          height={40}
                          className="object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/assets/sprites/unknown.webp";
                          }}
                        />
                      </div>
                    ))}
                    {/* シークレット部分 */}
                    {Array.from({ length: Math.max(0, 5 - room.hostDeckPreview.length) }).map((_, idx) => (
                      <div
                        key={`secret-${idx}`}
                        className="w-10 h-10 rounded-lg bg-amber-200/50 dark:bg-amber-800/50 flex items-center justify-center text-amber-500 dark:text-amber-400 font-bold shadow"
                      >
                        ?
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onJoinRoom(room.roomId)}
                  className="px-5 py-2 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95"
                >
                  {t("realtime_join") || "参加！"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* バトル履歴セクション */}
      {playerId && (
        <div className="w-full max-w-2xl mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full text-left mb-3"
          >
            <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <span>📜</span> {t("battle_history") || "Battle History"}
              {battleHistory.length > 0 && (
                <span className="text-sm font-normal text-amber-600/70 dark:text-amber-400/70">
                  ({battleHistory.length})
                </span>
              )}
            </h2>
            <span className="text-amber-600 dark:text-amber-400">
              {showHistory ? "▼" : "▶"}
            </span>
          </button>

          {showHistory && (
            battleHistory.length === 0 ? (
              <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur rounded-2xl p-6 text-center shadow-lg border border-amber-200/50 dark:border-amber-700/30">
                <div className="text-4xl mb-3">⚔️</div>
                <p className="text-amber-700 dark:text-amber-300 font-medium">
                  {t("no_battle_history") || "No battle history yet"}
                </p>
                <p className="text-amber-600/60 dark:text-amber-400/60 text-sm mt-2">
                  {t("realtime_history_hint") || "Your realtime battle results will appear here"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {battleHistory.map((battle) => {
                  const isAttacker = battle.attacker_id === playerId;
                  const won = (isAttacker && battle.winner === "attacker") || (!isAttacker && battle.winner === "defender");
                  const opponentName = isAttacker ? battle.defender_name : battle.attacker_name;
                  const opponentDeck = isAttacker ? battle.defender_deck : battle.attacker_deck;
                  const timeAgo = getTimeAgo(battle.created_at || "");

                  return (
                    <div
                      key={battle.id}
                      className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-xl p-3 border-l-4 ${
                        won
                          ? "border-green-500"
                          : "border-red-500"
                      } shadow`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg ${won ? "text-green-600" : "text-red-600"}`}>
                            {won ? "👑" : "💀"}
                          </span>
                          <span className="font-medium text-amber-800 dark:text-amber-200">
                            vs {opponentName}
                          </span>
                          <span className={`text-sm font-bold ${won ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {won ? (t("victory") || "Victory") : (t("defeat") || "Defeat")}
                          </span>
                        </div>
                        <span className="text-xs text-amber-600/60 dark:text-amber-400/60">
                          {timeAgo}
                        </span>
                      </div>

                      {/* Deck preview */}
                      <div className="flex gap-1 mt-2">
                        {(opponentDeck || []).slice(0, 5).map((unitId, idx) => (
                          <div
                            key={idx}
                            className="w-8 h-8 rounded-lg overflow-hidden bg-amber-100 dark:bg-amber-900/50 shadow"
                          >
                            <Image
                              src={getUnitImagePath(unitId)}
                              alt={unitId}
                              width={32}
                              height={32}
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* 戻るボタン */}
      <button
        onClick={onBack}
        className="mt-8 btn btn-secondary"
      >
        ← {t("back") || "戻る"}
      </button>
    </main>
  );
}

// 待機中画面コンポーネント
function WaitingView({
  playerName,
  roomId,
  onCancel,
}: {
  playerName: string;
  roomId: string | null;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-3xl p-8 md:p-12 shadow-2xl border border-amber-200/50 dark:border-amber-700/30 max-w-md w-full">
        {/* 部屋作成成功の表示 */}
        {roomId && (
          <div className="mb-6 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-2xl p-4 border border-green-300 dark:border-green-700">
            <div className="text-green-600 dark:text-green-400 font-bold mb-1 flex items-center justify-center gap-2">
              <span className="text-xl">✅</span> {t("realtime_room_created") || "部屋を作成しました！"}
            </div>
            <div className="text-green-700 dark:text-green-300 text-sm">
              Room ID: <span className="font-mono bg-green-200 dark:bg-green-800/50 px-2 py-0.5 rounded">{roomId.slice(0, 8)}</span>
            </div>
          </div>
        )}

        <div className="text-6xl mb-6 animate-bounce">⏳</div>
        <h1 className="text-2xl md:text-3xl font-bold text-amber-800 dark:text-amber-200 mb-4">
          {t("realtime_waiting") || "対戦相手を待っています..."}
        </h1>
        <p className="text-amber-600 dark:text-amber-400 mb-6">
          <span className="font-bold">{playerName}</span> {t("realtime_waiting_as") || "is waiting..."}
        </p>
        <div className="flex gap-2 justify-center mb-8">
          <div className="w-4 h-4 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: "0ms" }}></div>
          <div className="w-4 h-4 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: "150ms" }}></div>
          <div className="w-4 h-4 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: "300ms" }}></div>
        </div>
        <button
          onClick={onCancel}
          className="px-8 py-3 bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95"
        >
          {t("cancel") || "キャンセル"}
        </button>
      </div>
    </main>
  );
}

export default function RealtimeBattlePage() {
  const router = useRouter();
  const { selectedTeam, isLoaded } = usePlayerData();
  const { playerName, playerId, status } = useAuth();
  const { t } = useLanguage();
  const [state, actions] = useRealtime();
  const [mode, setMode] = useState<"lobby" | "connecting" | "waiting" | "game">("lobby");
  const [battleHistory, setBattleHistory] = useState<AsyncBattleResult[]>([]);
  const displayName = playerName || "Player";

  // ロビー画面を開いたら部屋一覧を取得
  useEffect(() => {
    if (mode === "lobby") {
      actions.fetchRooms();
    }
  }, [mode, actions]);

  // Fetch battle history (realtime battles only)
  useEffect(() => {
    const fetchHistory = async () => {
      if (!playerId || mode !== "lobby") return;
      try {
        // Only fetch realtime battle history
        const result = await getAsyncBattleHistory(playerId, 10, 'realtime');
        if (result.data) {
          setBattleHistory(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch battle history:", err);
      }
    };

    if (status === "authenticated" && playerId && mode === "lobby") {
      fetchHistory();
    }
  }, [playerId, status, mode]);

  // 接続状態に応じてモードを更新
  useEffect(() => {
    if (state.connectionStatus === "connecting") {
      setMode("connecting");
    } else if (state.connectionStatus === "waiting" && !state.opponent) {
      setMode("waiting");
    } else if (state.connectionStatus === "waiting" && state.opponent) {
      setMode("game");
    } else if (state.connectionStatus === "countdown" || state.connectionStatus === "playing" || state.connectionStatus === "finished") {
      setMode("game");
    } else if (state.connectionStatus === "disconnected" || state.connectionStatus === "error") {
      // エラーや切断時はロビーに戻る（自動接続しない）
      if (mode !== "lobby") {
        setMode("lobby");
      }
    }
  }, [state.connectionStatus, state.opponent, mode]);

  // 準備完了を送信（2人揃ったら自動で送信）
  useEffect(() => {
    if (state.connectionStatus === "waiting" && state.opponent && !state.myPlayer?.ready) {
      const timer = setTimeout(() => {
        actions.sendReady();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.connectionStatus, state.opponent, state.myPlayer?.ready, actions]);

  // クイックマッチ
  const handleQuickMatch = useCallback(async () => {
    try {
      await actions.quickMatch({
        displayName: displayName || "Player",
        deck: selectedTeam,
      });
    } catch (error) {
      console.error("Quick match failed:", error);
    }
  }, [actions, selectedTeam, displayName]);

  // 部屋を作成
  const handleCreateRoom = useCallback(async () => {
    try {
      await actions.createRoom({
        displayName: displayName || "Player",
        deck: selectedTeam,
      });
    } catch (error) {
      console.error("Create room failed:", error);
    }
  }, [actions, selectedTeam, displayName]);

  // 部屋に参加
  const handleJoinRoom = useCallback(async (roomId: string) => {
    try {
      await actions.joinRoom(roomId, {
        displayName: displayName || "Player",
        deck: selectedTeam,
      });
    } catch (error) {
      console.error("Join room failed:", error);
    }
  }, [actions, selectedTeam, displayName]);

  // キャンセル（ロビーに戻る）
  const handleCancel = useCallback(async () => {
    await actions.disconnect();
    setMode("lobby");
  }, [actions]);

  // 退出処理
  const handleLeave = useCallback(async () => {
    await actions.disconnect();
    router.push("/battle");
  }, [actions, router]);

  // ローディング中
  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⚔️</div>
          <p className="text-amber-700 dark:text-amber-300">Loading...</p>
        </div>
      </main>
    );
  }

  // デッキ未選択の場合
  if (selectedTeam.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-3xl p-8 shadow-2xl border border-amber-200/50 dark:border-amber-700/30 max-w-md">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-amber-800 dark:text-amber-200 mb-4">
            {t("realtime_deck_not_selected") || "デッキが選択されていません"}
          </h2>
          <p className="text-amber-600 dark:text-amber-400 mb-6">
            {t("realtime_deck_hint") || "対戦する前にユニットを編成してください"}
          </p>
          <button
            onClick={() => router.push("/team")}
            className="btn btn-primary py-3 px-8"
          >
            🎖️ {t("realtime_go_team") || "チーム編成へ"}
          </button>
        </div>
      </main>
    );
  }

  // ロビー画面
  if (mode === "lobby") {
    return (
      <LobbyView
        rooms={state.lobbyRooms}
        isLoading={state.isLoadingRooms}
        onRefresh={actions.fetchRooms}
        onQuickMatch={handleQuickMatch}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onBack={() => router.push("/battle")}
        battleHistory={battleHistory}
        playerId={playerId}
      />
    );
  }

  // 接続中
  if (mode === "connecting") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-3xl p-8 shadow-2xl border border-amber-200/50 dark:border-amber-700/30 max-w-md w-full">
          <h1 className="text-2xl font-bold text-amber-800 dark:text-amber-200 mb-6">
            ⚔️ {t("realtime_title") || "リアルタイム対戦"}
          </h1>
          <ConnectionStatus
            status={state.connectionStatus}
            error={state.error}
            onRetry={handleQuickMatch}
          />
          <button
            onClick={handleCancel}
            className="mt-6 px-6 py-2 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium transition-all"
          >
            {t("cancel") || "キャンセル"}
          </button>
        </div>
      </main>
    );
  }

  // 待機中（対戦相手を待っている）
  if (mode === "waiting") {
    return (
      <WaitingView
        playerName={displayName || "Player"}
        roomId={state.roomId}
        onCancel={handleCancel}
      />
    );
  }

  // ゲーム画面
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* HUD */}
      <RealtimeBattleHUD
        myPlayer={state.myPlayer}
        opponent={state.opponent}
        countdown={state.countdown}
        phase={state.phase}
        isWinner={state.isWinner}
        winReason={state.winReason}
        onLeave={handleLeave}
      />

      {/* ゲームコンテナ（動的インポート） */}
      {(state.connectionStatus === "playing" || state.connectionStatus === "waiting" || state.connectionStatus === "countdown") && (
        <GameContainer
          state={state}
          selectedTeam={selectedTeam}
          onSummon={actions.sendSummon}
          onUpgradeCost={actions.sendUpgradeCost}
          onSpeedVote={actions.sendSpeedVote}
        />
      )}

      {/* エラー表示 */}
      {state.error && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl shadow-xl z-50 font-medium">
          {state.error}
        </div>
      )}
    </div>
  );
}
