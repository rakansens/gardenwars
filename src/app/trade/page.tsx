"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { useToast } from "@/contexts/ToastContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useUnitDetailModal } from "@/hooks/useUnitDetailModal";
import { getTradeHistory, type TradeHistoryEntry } from "@/lib/supabase";
import { tradeClient, Colyseus, type TradeLobbyRoom, type TradeOfferPayload } from "@/lib/colyseus/tradeClient";

const allUnits = unitsData as UnitDefinition[];
const tradableUnits = allUnits.filter(
  (unit) => !unit.id.startsWith("enemy_") && !unit.id.startsWith("boss_") && !unit.isBoss
);

const rarityOrder: Record<Rarity, number> = {
  UR: 0,
  SSR: 1,
  SR: 2,
  R: 3,
  N: 4,
};
const rarityFilters: Array<Rarity | "ALL"> = ["ALL", "UR", "SSR", "SR", "R", "N"];

type TradeStatus = "lobby" | "connecting" | "waiting" | "trading" | "finished" | "error";

interface TradePlayerInfo {
  sessionId: string;
  displayName: string;
  playerId?: string;
}

interface TradeCompleteInfo {
  message?: string;
}

const emptyOffer: TradeOfferPayload = { units: {}, coins: 0 };

export default function TradePage() {
  const { t, language } = useLanguage();
  const { status, playerId, playerName } = useAuth();
  const { isOnline } = useNetwork();
  const { showError, showWarning, showSuccess } = useToast();
  const { viewingUnit, openModal, closeModal } = useUnitDetailModal();
  const {
    coins,
    unitInventory,
    isLoaded,
    addUnit,
    removeUnit,
    addCoins,
  } = usePlayerData();

  const [connectionStatus, setConnectionStatus] = useState<TradeStatus>("lobby");
  const [rooms, setRooms] = useState<TradeLobbyRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [players, setPlayers] = useState<TradePlayerInfo[]>([]);
  const [myOffer, setMyOffer] = useState<TradeOfferPayload>(emptyOffer);
  const [theirOffer, setTheirOffer] = useState<TradeOfferPayload>(emptyOffer);
  const [readyStates, setReadyStates] = useState<Record<string, boolean>>({});
  const [tradeComplete, setTradeComplete] = useState<TradeCompleteInfo | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");

  const roomRef = useRef<Colyseus.Room | null>(null);
  const myReadyRef = useRef(false);
  const tradeCompleteRef = useRef(false);
  const myOfferRef = useRef<TradeOfferPayload>(emptyOffer);
  const theirOfferRef = useRef<TradeOfferPayload>(emptyOffer);
  const isLoadedRef = useRef(isLoaded);
  const unitInventoryRef = useRef(unitInventory);
  const coinsRef = useRef(coins);
  const offerSyncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthenticated = status === "authenticated" && playerId;
  const displayName = playerName || (language === "ja" ? "プレイヤー" : "Player");

  const myReady = mySessionId ? !!readyStates[mySessionId] : false;
  const opponent = useMemo(() => players.find((p) => p.sessionId !== mySessionId) || null, [players, mySessionId]);
  const opponentReady = opponent ? !!readyStates[opponent.sessionId] : false;

  const unitMap = useMemo(() => new Map(tradableUnits.map((unit) => [unit.id, unit])), []);

  useEffect(() => {
    myReadyRef.current = myReady;
  }, [myReady]);

  useEffect(() => {
    myOfferRef.current = myOffer;
  }, [myOffer]);

  useEffect(() => {
    theirOfferRef.current = theirOffer;
  }, [theirOffer]);

  useEffect(() => {
    isLoadedRef.current = isLoaded;
  }, [isLoaded]);

  useEffect(() => {
    unitInventoryRef.current = unitInventory;
  }, [unitInventory]);

  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  const resetTradeState = useCallback((statusOverride: TradeStatus = "lobby") => {
    setConnectionStatus(statusOverride);
    setRoomId(null);
    setMySessionId(null);
    setPlayers([]);
    setMyOffer(emptyOffer);
    setTheirOffer(emptyOffer);
    setReadyStates({});
    setTradeComplete(null);
    setError(null);
    tradeCompleteRef.current = false;
  }, []);

  const normalizeOffer = useCallback((payload: any): TradeOfferPayload => {
    const coinsValue = typeof payload?.coins === "number" && Number.isFinite(payload.coins) ? payload.coins : 0;
    const unitsValue: Record<string, number> = {};
    if (payload?.units && typeof payload.units === "object") {
      Object.entries(payload.units as Record<string, unknown>).forEach(([unitId, count]) => {
        const numeric = typeof count === "number" ? Math.max(0, Math.floor(count)) : 0;
        if (numeric > 0) unitsValue[unitId] = numeric;
      });
    }
    return { units: unitsValue, coins: Math.max(0, Math.floor(coinsValue)) };
  }, []);

  const applyServerSnapshot = useCallback(
    (nextCoins: number, nextInventory: Record<string, number>) => {
      const currentInventory = unitInventoryRef.current || {};
      const allIds = new Set([
        ...Object.keys(currentInventory),
        ...Object.keys(nextInventory || {}),
      ]);

      allIds.forEach((unitId) => {
        const currentCount = Math.max(0, Number(currentInventory[unitId] || 0));
        const nextCount = Math.max(0, Number(nextInventory?.[unitId] || 0));
        if (nextCount > currentCount) {
          addUnit(unitId, nextCount - currentCount);
        } else if (nextCount < currentCount) {
          removeUnit(unitId, currentCount - nextCount);
        }
      });

      const currentCoins = Number(coinsRef.current || 0);
      const safeNextCoins = Number.isFinite(nextCoins) ? Math.floor(nextCoins) : currentCoins;
      const coinDelta = safeNextCoins - currentCoins;
      if (coinDelta !== 0) {
        addCoins(coinDelta);
      }
    },
    [addCoins, addUnit, removeUnit]
  );

  const applyPlayers = useCallback(
    (list: TradePlayerInfo[]) => {
      setPlayers(list);
      if (list.length >= 2) {
        setConnectionStatus("trading");
      } else if (roomRef.current) {
        setConnectionStatus("waiting");
      }
    },
    []
  );

  const attachRoom = useCallback(
    (room: Colyseus.Room) => {
      roomRef.current = room;
      setRoomId(room.roomId);
      setMySessionId(room.sessionId);
      setConnectionStatus("waiting");
      setTradeComplete(null);
      setError(null);
      setPlayers([]);
      setMyOffer(emptyOffer);
      setTheirOffer(emptyOffer);
      setReadyStates({});

      room.onMessage("all_players", (message: any) => {
        if (!Array.isArray(message?.players)) return;
        const next = message.players
          .filter((player: any) => player?.sessionId)
          .map((player: any) => ({
            sessionId: String(player.sessionId),
            displayName: player.displayName || player.name || "Player",
            playerId: player.playerId || player.id,
          }));
        applyPlayers(next);
      });

      room.onMessage("player_joined", (message: any) => {
        if (!message?.sessionId) return;
        setPlayers((prev) => {
          const next = prev.filter((p) => p.sessionId !== message.sessionId);
          next.push({
            sessionId: String(message.sessionId),
            displayName: message.displayName || message.name || "Player",
            playerId: message.playerId || message.id,
          });
          if (next.length >= 2) setConnectionStatus("trading");
          else if (roomRef.current) setConnectionStatus("waiting");
          return next;
        });
      });

      room.onMessage("player_left", (message: any) => {
        if (!message?.sessionId) return;
        setPlayers((prev) => {
          const next = prev.filter((p) => p.sessionId !== message.sessionId);
          if (next.length >= 2) setConnectionStatus("trading");
          else if (roomRef.current) setConnectionStatus("waiting");
          return next;
        });
      });

      room.onMessage("offer_update", (message: any) => {
        const offerPayload = message?.offer ?? message;
        const sessionId = message?.sessionId;
        if (sessionId && sessionId === room.sessionId) return;
        setTheirOffer(normalizeOffer(offerPayload));
      });

      room.onMessage("ready_update", (message: any) => {
        if (message?.readyStates && typeof message.readyStates === "object") {
          setReadyStates(message.readyStates as Record<string, boolean>);
          return;
        }
        if (!message?.sessionId) return;
        setReadyStates((prev) => ({
          ...prev,
          [String(message.sessionId)]: !!message.ready,
        }));
      });

      room.onMessage("trade_complete", (message: any) => {
        setConnectionStatus("finished");
        setTradeComplete({ message: message?.message });

        let appliedServerResult = false;
        const result = message?.result;
        if (result?.success && playerId) {
          const directPlayer = result.player;
          const playerA = result.player_a;
          const playerB = result.player_b;
          const me =
            directPlayer?.player_id === playerId
              ? directPlayer
              : playerA?.player_id === playerId
              ? playerA
              : playerB?.player_id === playerId
              ? playerB
              : null;
          if (me && me.unit_inventory) {
            applyServerSnapshot(me.coins ?? 0, me.unit_inventory as Record<string, number>);
            appliedServerResult = true;
          }
        }

        if (!tradeCompleteRef.current && isLoadedRef.current && !appliedServerResult) {
          const removeUnits = myOfferRef.current.units;
          const addUnits = theirOfferRef.current.units;
          Object.entries(removeUnits).forEach(([unitId, count]) => {
            if (count > 0) removeUnit(unitId, count);
          });
          Object.entries(addUnits).forEach(([unitId, count]) => {
            if (count > 0) addUnit(unitId, count);
          });
          const coinsDelta = (theirOfferRef.current.coins || 0) - (myOfferRef.current.coins || 0);
          if (coinsDelta !== 0) {
            addCoins(coinsDelta);
          }
        }

        tradeCompleteRef.current = true;
        showSuccess(t("trade_complete") || "Trade complete!");
      });

      room.onMessage("trade_cancelled", (message: any) => {
        const reason = message?.reason ? ` ${message.reason}` : "";
        showWarning((t("trade_cancelled") || "Trade cancelled") + reason);
        tradeClient.leave();
        roomRef.current = null;
        resetTradeState("lobby");
      });

      room.onMessage("error", (message: any) => {
        if (!message || (!message.code && !message.message)) return;
        const msg = `${message.code || "ERROR"}${message.message ? `: ${message.message}` : ""}`;
        setError(msg);
        showError(msg);
      });

      room.onLeave(() => {
        tradeClient.clearRoom();
        roomRef.current = null;
        resetTradeState("lobby");
      });
    },
    [
      addCoins,
      addUnit,
      applyServerSnapshot,
      applyPlayers,
      normalizeOffer,
      playerId,
      removeUnit,
      resetTradeState,
      showError,
      showSuccess,
      showWarning,
      t,
    ]
  );

  const fetchRooms = useCallback(async () => {
    if (!isOnline) {
      showWarning(t("offline_action_blocked") || "Cannot complete action while offline");
      return;
    }
    setIsLoadingRooms(true);
    const result = await tradeClient.fetchRooms();
    setRooms(result.data || []);
    if (result.error) {
      showError(result.error);
    }
    setIsLoadingRooms(false);
  }, [isOnline, showError, showWarning, t]);

  const fetchTradeHistory = useCallback(async () => {
    if (!playerId) return;
    if (!isOnline) {
      showWarning(t("offline_action_blocked") || "Cannot complete action while offline");
      return;
    }
    setIsLoadingHistory(true);
    setHistoryError(null);
    const result = await getTradeHistory(playerId, 12);
    if (result.error) {
      setHistoryError(result.error);
    } else {
      setTradeHistory(result.data || []);
    }
    setIsLoadingHistory(false);
  }, [isOnline, playerId, showWarning, t]);

  const handleQuickMatch = useCallback(async () => {
    if (!isOnline) {
      showWarning(t("offline_action_blocked") || "Cannot complete action while offline");
      return;
    }
    setConnectionStatus("connecting");
    const result = await tradeClient.quickMatch({ displayName, playerId: playerId || undefined });
    if (result.error || !result.data) {
      const msg = result.error || "Connection failed";
      setError(msg);
      showError(msg);
      setConnectionStatus("error");
      return;
    }
    attachRoom(result.data);
  }, [attachRoom, displayName, isOnline, playerId, showError, showWarning, t]);

  const handleCreateRoom = useCallback(async () => {
    if (!isOnline) {
      showWarning(t("offline_action_blocked") || "Cannot complete action while offline");
      return;
    }
    setConnectionStatus("connecting");
    const result = await tradeClient.createRoom({ displayName, playerId: playerId || undefined });
    if (result.error || !result.data) {
      const msg = result.error || "Connection failed";
      setError(msg);
      showError(msg);
      setConnectionStatus("error");
      return;
    }
    attachRoom(result.data);
  }, [attachRoom, displayName, isOnline, playerId, showError, showWarning, t]);

  const handleJoinRoom = useCallback(
    async (targetRoomId: string) => {
      if (!isOnline) {
        showWarning(t("offline_action_blocked") || "Cannot complete action while offline");
        return;
      }
      setConnectionStatus("connecting");
      const result = await tradeClient.joinRoom(targetRoomId, { displayName, playerId: playerId || undefined });
      if (result.error || !result.data) {
        const msg = result.error || "Connection failed";
        setError(msg);
        showError(msg);
        setConnectionStatus("error");
        return;
      }
      attachRoom(result.data);
    },
    [attachRoom, displayName, isOnline, playerId, showError, showWarning, t]
  );

  const handleLeave = useCallback(async () => {
    await tradeClient.leave();
    roomRef.current = null;
    resetTradeState("lobby");
  }, [resetTradeState]);

  const clearReadyIfNeeded = useCallback(() => {
    if (!mySessionId || !myReadyRef.current) return;
    setReadyStates((prev) => ({ ...prev, [mySessionId]: false }));
    tradeClient.sendReady(false);
  }, [mySessionId]);

  const adjustOfferUnit = useCallback(
    (unitId: string, delta: number) => {
      if (myReadyRef.current) return;
      const ownedCount = unitInventory[unitId] || 0;
      if (ownedCount <= 0) return;
      clearReadyIfNeeded();
      setMyOffer((prev) => {
        const current = prev.units[unitId] || 0;
        const nextCount = Math.max(0, Math.min(ownedCount, current + delta));
        const nextUnits = { ...prev.units };
        if (nextCount <= 0) {
          delete nextUnits[unitId];
        } else {
          nextUnits[unitId] = nextCount;
        }
        return { ...prev, units: nextUnits };
      });
    },
    [clearReadyIfNeeded, unitInventory]
  );

  const handleCoinsChange = useCallback(
    (value: number) => {
      if (myReadyRef.current) return;
      clearReadyIfNeeded();
      const nextCoins = Math.max(0, Math.min(coins, Math.floor(value)));
      setMyOffer((prev) => ({ ...prev, coins: nextCoins }));
    },
    [clearReadyIfNeeded, coins]
  );

  const handleClearOffer = useCallback(() => {
    if (myReadyRef.current) return;
    clearReadyIfNeeded();
    setMyOffer(emptyOffer);
  }, [clearReadyIfNeeded]);

  const toggleReady = useCallback(() => {
    if (!mySessionId) return;
    const next = !readyStates[mySessionId];
    setReadyStates((prev) => ({ ...prev, [mySessionId]: next }));
    tradeClient.sendReady(next);
  }, [mySessionId, readyStates]);

  const sendOfferToServer = useCallback(() => {
    tradeClient.sendOffer(myOffer);
  }, [myOffer]);

  useEffect(() => {
    if (!roomRef.current) return;
    if (offerSyncTimeout.current) {
      clearTimeout(offerSyncTimeout.current);
    }
    offerSyncTimeout.current = setTimeout(() => {
      sendOfferToServer();
    }, 150);
    return () => {
      if (offerSyncTimeout.current) {
        clearTimeout(offerSyncTimeout.current);
      }
    };
  }, [myOffer, sendOfferToServer]);

  useEffect(() => {
    if (connectionStatus !== "lobby") return;
    fetchRooms();
  }, [connectionStatus, fetchRooms]);

  useEffect(() => {
    if (connectionStatus !== "lobby" || !playerId) return;
    fetchTradeHistory();
  }, [connectionStatus, fetchTradeHistory, playerId]);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        tradeClient.leave();
      }
    };
  }, []);

  const ownedUnits = useMemo(() => {
    return tradableUnits
      .filter((unit) => (unitInventory[unit.id] || 0) > 0)
      .sort((a, b) => {
        const rarityDiff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
        if (rarityDiff !== 0) return rarityDiff;
        return a.name.localeCompare(b.name);
      });
  }, [unitInventory]);

  const getUnitName = useCallback(
    (unit: UnitDefinition) => {
      const localized = t(unit.id);
      return localized !== unit.id ? localized : unit.name;
    },
    [t]
  );

  const offerUnitsList = useCallback(
    (offer: TradeOfferPayload) => {
      return Object.entries(offer.units)
        .map(([unitId, count]) => ({
          unit: unitMap.get(unitId),
          unitId,
          count,
        }))
        .filter((item) => item.unit && item.count > 0)
        .sort((a, b) => {
          const rarityDiff = rarityOrder[a.unit!.rarity] - rarityOrder[b.unit!.rarity];
          if (rarityDiff !== 0) return rarityDiff;
          return a.unit!.name.localeCompare(b.unit!.name);
        });
    },
    [unitMap]
  );

  const historyUnitsList = useCallback(
    (units: Record<string, number>) => {
      return Object.entries(units || {})
        .map(([unitId, count]) => ({
          unit: unitMap.get(unitId),
          unitId,
          count,
        }))
        .filter((item) => item.count > 0)
        .sort((a, b) => {
          if (!a.unit || !b.unit) return a.unitId.localeCompare(b.unitId);
          const rarityDiff = rarityOrder[a.unit.rarity] - rarityOrder[b.unit.rarity];
          if (rarityDiff !== 0) return rarityDiff;
          return a.unit.name.localeCompare(b.unit.name);
        });
    },
    [unitMap]
  );

  const formatHistoryTime = useCallback(
    (createdAt: string) => {
      const timestamp = new Date(createdAt).getTime();
      if (!Number.isFinite(timestamp)) return createdAt;
      const diffMs = Date.now() - timestamp;
      const minutes = Math.max(0, Math.floor(diffMs / 60000));
      if (minutes < 60) return `${minutes}${t("minutes_ago") || "m ago"}`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}${t("hours_ago") || "h ago"}`;
      const days = Math.floor(hours / 24);
      return `${days}${t("days_ago") || "d ago"}`;
    },
    [t]
  );

  const myOfferList = offerUnitsList(myOffer);
  const theirOfferList = offerUnitsList(theirOffer);
  const bothReady = myReady && opponentReady;

  const isViewingOwned = viewingUnit ? (unitInventory[viewingUnit.id] || 0) > 0 : false;

  const filteredOwnedUnits = useMemo(() => {
    let result = ownedUnits;
    if (rarityFilter !== "ALL") {
      result = result.filter((unit) => unit.rarity === rarityFilter);
    }
    const query = unitSearch.trim().toLowerCase();
    if (query) {
      result = result.filter((unit) => getUnitName(unit).toLowerCase().includes(query));
    }
    return result;
  }, [ownedUnits, rarityFilter, unitSearch, getUnitName]);

  const offerLocked = myReady || connectionStatus === "finished";

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen p-4">
        <PageHeader title={`🤝 ${t("trade_title") || "Trade"}`} backHref="/" />
        <div className="card max-w-xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-2">{t("login_required") || "Login Required"}</h2>
          <p className="text-amber-700/80 dark:text-amber-300/80 mb-4">{t("trade_login_message") || "Please log in to trade with other players."}</p>
          <Link href="/auth" className="btn btn-primary">
            🔑 {t("login") || "Login"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <PageHeader title={`🤝 ${t("trade_title") || "Trade"}`} backHref="/" />

      {!isOnline && (
        <div className="card mb-4 border-amber-300 bg-amber-50 dark:bg-amber-900/30">
          <p className="text-amber-800 dark:text-amber-200 font-semibold">
            ⚠️ {t("offline_action_blocked") || "Cannot complete action while offline"}
          </p>
        </div>
      )}

      {connectionStatus === "lobby" && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-amber-800 dark:text-amber-200">{t("trade_lobby_title") || "Trade Lobby"}</h2>
              <p className="text-amber-700/80 dark:text-amber-300/80">
                {t("trade_lobby_subtitle") || "Make real-time offers to online players."}
              </p>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button onClick={handleQuickMatch} className="btn btn-primary flex-1">
                🎯 {t("trade_quick_match") || "Quick Match"}
              </button>
              <button onClick={handleCreateRoom} className="btn btn-secondary flex-1">
                ➕ {t("trade_create_room") || "Create Room"}
              </button>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <input
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder={t("trade_join_placeholder") || "Enter room ID"}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-white/80 dark:bg-slate-800/80"
              />
              <button
                onClick={() => joinRoomId.trim() && handleJoinRoom(joinRoomId.trim())}
                className="btn btn-primary"
              >
                🔗 {t("trade_join") || "Join"}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                📋 {t("trade_waiting_rooms") || "Waiting Rooms"}
              </h3>
              <button
                onClick={fetchRooms}
                disabled={isLoadingRooms}
                className="btn btn-secondary w-full sm:w-auto text-sm py-2 px-5 disabled:opacity-50"
              >
                {isLoadingRooms ? `🔄 ${t("loading") || "Loading"}` : `🔄 ${t("refresh") || "Refresh"}`}
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-6 text-amber-700/80 dark:text-amber-300/80">
                <p className="text-lg font-semibold">{t("trade_no_rooms") || "No rooms available"}</p>
                <p className="text-sm mt-2">{t("trade_no_rooms_hint") || "Create a room to wait for a trade partner."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((room) => (
                  <div
                    key={room.roomId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-amber-200/60 dark:border-amber-700/40"
                  >
                    <div>
                      <p className="font-bold text-amber-800 dark:text-amber-200">{room.hostName}</p>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                        {new Date(room.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(room.roomId)}
                      className="btn btn-primary text-sm py-2 px-4"
                    >
                      {t("trade_offer") || "Offer"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                  📜 {t("trade_history") || "Trade History"}
                </h3>
                <p className="text-sm text-amber-600/70 dark:text-amber-300/70">
                  {t("trade_history_hint") || "Your recent trades will appear here."}
                </p>
              </div>
              <button
                onClick={fetchTradeHistory}
                disabled={isLoadingHistory}
                className="btn btn-secondary w-full sm:w-auto text-sm py-2 px-5 disabled:opacity-50"
              >
                {isLoadingHistory ? `🔄 ${t("loading") || "Loading"}` : `🔄 ${t("refresh") || "Refresh"}`}
              </button>
            </div>

            {historyError && (
              <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-3">{historyError}</p>
            )}

            {tradeHistory.length === 0 ? (
              <div className="text-center py-6 text-amber-700/80 dark:text-amber-300/80">
                <p className="text-lg font-semibold">{t("trade_history_empty") || "No trades yet"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tradeHistory.map((entry) => {
                  const isPlayerA = entry.player_a_id === playerId;
                  const opponentName = isPlayerA ? entry.player_b_name : entry.player_a_name;
                  const myUnits = isPlayerA ? entry.offer_a_units : entry.offer_b_units;
                  const theirUnits = isPlayerA ? entry.offer_b_units : entry.offer_a_units;
                  const myCoins = isPlayerA ? entry.offer_a_coins : entry.offer_b_coins;
                  const theirCoins = isPlayerA ? entry.offer_b_coins : entry.offer_a_coins;
                  const myUnitList = historyUnitsList(myUnits);
                  const theirUnitList = historyUnitsList(theirUnits);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-amber-200/60 dark:border-amber-700/40 bg-white/70 dark:bg-slate-800/70 p-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                          {t("you") || "You"} ↔ {opponentName}
                        </p>
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                          {formatHistoryTime(entry.created_at)}
                        </p>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-amber-50/70 dark:bg-slate-900/40 p-3">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-200 mb-2">
                            🎁 {t("trade_your_offer") || "Your Offer"}
                          </p>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-amber-600/80 dark:text-amber-300/80">💰 {t("trade_offer_coins") || "Coins"}</span>
                            <span className="font-bold text-amber-900 dark:text-amber-100">{myCoins.toLocaleString()}</span>
                          </div>
                          {myUnitList.length === 0 ? (
                            <p className="text-xs text-amber-500/70">{t("trade_offer_empty") || "No units selected"}</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {myUnitList.map(({ unit, unitId, count }) =>
                                unit ? (
                                  <button
                                    key={unitId}
                                    type="button"
                                    onClick={() => openModal(unit)}
                                    className="flex items-center gap-2 rounded-lg border border-amber-200/60 dark:border-amber-700/40 bg-white/70 dark:bg-slate-800/60 px-2 py-1"
                                  >
                                    <RarityFrame
                                      unitId={unitId}
                                      unitName={getUnitName(unit)}
                                      rarity={unit.rarity}
                                      baseUnitId={unit.baseUnitId || unit.atlasKey}
                                      size="sm"
                                      showLabel={false}
                                      count={count}
                                    />
                                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-100">
                                      {getUnitName(unit)}
                                    </span>
                                  </button>
                                ) : (
                                  <div
                                    key={unitId}
                                    className="px-2 py-1 rounded-lg border border-amber-200/60 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-200"
                                  >
                                    {unitId} x{count}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                        <div className="rounded-xl bg-amber-50/70 dark:bg-slate-900/40 p-3">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-200 mb-2">
                            🤝 {t("trade_their_offer") || "Their Offer"}
                          </p>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-amber-600/80 dark:text-amber-300/80">💰 {t("trade_offer_coins") || "Coins"}</span>
                            <span className="font-bold text-amber-900 dark:text-amber-100">{theirCoins.toLocaleString()}</span>
                          </div>
                          {theirUnitList.length === 0 ? (
                            <p className="text-xs text-amber-500/70">{t("trade_offer_empty") || "No units selected"}</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {theirUnitList.map(({ unit, unitId, count }) =>
                                unit ? (
                                  <button
                                    key={unitId}
                                    type="button"
                                    onClick={() => openModal(unit)}
                                    className="flex items-center gap-2 rounded-lg border border-amber-200/60 dark:border-amber-700/40 bg-white/70 dark:bg-slate-800/60 px-2 py-1"
                                  >
                                    <RarityFrame
                                      unitId={unitId}
                                      unitName={getUnitName(unit)}
                                      rarity={unit.rarity}
                                      baseUnitId={unit.baseUnitId || unit.atlasKey}
                                      size="sm"
                                      showLabel={false}
                                      count={count}
                                    />
                                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-100">
                                      {getUnitName(unit)}
                                    </span>
                                  </button>
                                ) : (
                                  <div
                                    key={unitId}
                                    className="px-2 py-1 rounded-lg border border-amber-200/60 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-200"
                                  >
                                    {unitId} x{count}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {connectionStatus !== "lobby" && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm text-amber-600/70 dark:text-amber-400/70">{t("trade_room") || "Trade Room"}</p>
                <p className="font-mono text-lg text-amber-800 dark:text-amber-200">
                  {roomId ? roomId.slice(0, 12) : "-"}
                </p>
                <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                  {opponent
                    ? `${t("trade_opponent") || "Opponent"}: ${opponent.displayName}`
                    : t("trade_waiting_for_opponent") || "Waiting for opponent..."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleLeave} className="btn btn-secondary text-sm py-2 px-4">
                  {t("trade_leave") || "Leave"}
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 font-semibold">{error}</p>
            )}
          </div>


          <div className="card border-amber-200/80 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-slate-800/70 dark:to-slate-900/70">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${myReady ? "bg-emerald-500" : "bg-amber-400"}`} />
                <div>
                  <p className="text-xs text-amber-600/80 dark:text-amber-300/70">{t("you") || "You"}</p>
                  <p className={`font-bold ${myReady ? "text-emerald-600" : "text-amber-700 dark:text-amber-200"}`}>
                    {myReady ? t("trade_ready") || "Ready" : t("trade_not_ready") || "Not Ready"}
                  </p>
                </div>
              </div>
              <div className={`text-2xl ${bothReady ? "animate-pulse" : ""}`}>🤝</div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${opponentReady ? "bg-emerald-500" : "bg-amber-400"}`} />
                <div>
                  <p className="text-xs text-amber-600/80 dark:text-amber-300/70">
                    {opponent?.displayName || t("trade_opponent") || "Opponent"}
                  </p>
                  <p className={`font-bold ${opponentReady ? "text-emerald-600" : "text-amber-700 dark:text-amber-200"}`}>
                    {opponentReady ? t("trade_ready") || "Ready" : t("trade_waiting") || "Waiting"}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-sm font-semibold text-amber-700 dark:text-amber-200">
              {bothReady
                ? `✅ ${t("trade_ready") || "Ready"}`
                : opponent
                ? `⏳ ${t("trade_waiting") || "Waiting"}`
                : `⏳ ${t("trade_waiting_for_opponent") || "Waiting for opponent..."}`}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`card ${myReady ? "border-emerald-300 ring-2 ring-emerald-200/70" : "border-amber-200/60"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                  🎁 {t("trade_your_offer") || "Your Offer"}
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                    myReady
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200/60"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {myReady ? `✅ ${t("trade_ready") || "Ready"}` : `⏳ ${t("trade_not_ready") || "Not Ready"}`}
                </span>
              </div>
              {myReady && (
                <div className="mt-2 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 inline-flex items-center gap-2">
                  🔒 {t("trade_locked") || "Locked"}
                </div>
              )}
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700/80 dark:text-amber-300/80 flex items-center gap-2">
                    <span>💰</span>
                    {t("trade_offer_coins") || "Coins"}
                  </span>
                  <span className="font-bold text-amber-900 dark:text-amber-100">{myOffer.coins.toLocaleString()}</span>
                </div>
                <div>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mb-2">{t("trade_offer_units") || "Units"}</p>
                  {myOfferList.length === 0 ? (
                    <p className="text-sm text-amber-500/70">{t("trade_offer_empty") || "No units selected"}</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {myOfferList.map(({ unit, unitId, count }) => (
                        <button
                          key={unitId}
                          type="button"
                          onClick={() => openModal(unit!)}
                          className="relative flex items-center gap-3 rounded-xl border border-amber-200/60 dark:border-amber-700/40 bg-white/70 dark:bg-slate-800/60 px-3 py-2 text-left cursor-pointer hover:shadow-md transition-shadow"
                        >
                          <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                            {t("trade_offer_tag") || "OFFER"}
                          </span>
                          <RarityFrame
                            unitId={unitId}
                            unitName={getUnitName(unit!)}
                            rarity={unit!.rarity}
                            baseUnitId={unit!.baseUnitId || unit!.atlasKey}
                            size="lg"
                            showLabel={false}
                            count={count}
                          />
                          <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-100">
                              {getUnitName(unit!)}
                            </p>
                            <p className="text-xs text-amber-600/70 dark:text-amber-300/70">x{count}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={toggleReady}
                  disabled={!opponent || connectionStatus === "finished"}
                  className={`btn ${myReady ? "btn-secondary" : "btn-primary"} text-sm py-2 px-4 disabled:opacity-50`}
                >
                  {myReady ? `↩ ${t("trade_unready") || "Unready"}` : `✅ ${t("trade_ready") || "Ready"}`}
                </button>
                <button
                  onClick={handleClearOffer}
                  disabled={offerLocked}
                  className="btn btn-secondary text-sm py-2 px-4 disabled:opacity-50"
                >
                  {t("trade_clear_offer") || "Clear Offer"}
                </button>
              </div>
            </div>

            <div className={`card ${opponentReady ? "border-emerald-300 ring-2 ring-emerald-200/70" : "border-amber-200/60"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                  🤝 {t("trade_their_offer") || "Their Offer"}
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                    opponentReady
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200/60"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {opponentReady ? `✅ ${t("trade_ready") || "Ready"}` : `⏳ ${t("trade_waiting") || "Waiting"}`}
                </span>
              </div>
              {opponentReady && (
                <div className="mt-2 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 inline-flex items-center gap-2">
                  🔒 {t("trade_locked") || "Locked"}
                </div>
              )}
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700/80 dark:text-amber-300/80 flex items-center gap-2">
                    <span>💰</span>
                    {t("trade_offer_coins") || "Coins"}
                  </span>
                  <span className="font-bold text-amber-900 dark:text-amber-100">{theirOffer.coins.toLocaleString()}</span>
                </div>
                <div>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mb-2">{t("trade_offer_units") || "Units"}</p>
                  {theirOfferList.length === 0 ? (
                    <p className="text-sm text-amber-500/70">{t("trade_offer_empty") || "No units selected"}</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {theirOfferList.map(({ unit, unitId, count }) => (
                        <button
                          key={unitId}
                          type="button"
                          onClick={() => openModal(unit!)}
                          className="relative flex items-center gap-3 rounded-xl border border-amber-200/60 dark:border-amber-700/40 bg-white/70 dark:bg-slate-800/60 px-3 py-2 text-left cursor-pointer hover:shadow-md transition-shadow"
                        >
                          <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                            {t("trade_offer_tag") || "OFFER"}
                          </span>
                          <RarityFrame
                            unitId={unitId}
                            unitName={getUnitName(unit!)}
                            rarity={unit!.rarity}
                            baseUnitId={unit!.baseUnitId || unit!.atlasKey}
                            size="lg"
                            showLabel={false}
                            count={count}
                          />
                          <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-100">
                              {getUnitName(unit!)}
                            </p>
                            <p className="text-xs text-amber-600/70 dark:text-amber-300/70">x{count}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">{t("trade_builder") || "Build Offer"}</h3>
                <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                  {t("trade_builder_hint") || "Select units and coins to include in your offer."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-700/80 dark:text-amber-300/80">{t("balance") || "Balance"}</span>
                <span className="font-bold text-amber-900 dark:text-amber-100">{coins.toLocaleString()}</span>
              </div>
            </div>
            {myReady && (
              <div className="mt-3 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 inline-flex items-center gap-2">
                🔒 {t("trade_locked") || "Locked"}
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm font-semibold text-amber-800 dark:text-amber-200">{t("trade_offer_coins") || "Coins"}</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={coins}
                  value={myOffer.coins}
                  disabled={offerLocked}
                  onChange={(e) => handleCoinsChange(Number(e.target.value))}
                  className="w-40 px-3 py-2 rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-white/90 dark:bg-slate-800/90"
                />
                <span className="text-xs text-amber-600/70 dark:text-amber-400/70">/ {coins.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">{t("trade_select_units") || "Select Units"}</h4>
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
                <input
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder={t("search_units") || "Search units..."}
                  className="flex-1 px-4 py-2 rounded-xl border-2 border-amber-200 dark:border-amber-700 bg-white/90 dark:bg-slate-800/90 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {rarityFilters.map((rarity) => {
                    const isActive = rarityFilter === rarity;
                    return (
                      <button
                        key={rarity}
                        onClick={() => setRarityFilter(rarity)}
                        className={`px-3 py-1 rounded-full border-2 text-xs font-bold transition-colors ${
                          isActive
                            ? "bg-amber-300 border-amber-400 text-amber-900"
                            : "bg-white/80 dark:bg-slate-800/80 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-200"
                        }`}
                      >
                        {rarity === "ALL" ? t("all_rarities") || "All" : rarity}
                      </button>
                    );
                  })}
                </div>
              </div>
              {ownedUnits.length === 0 ? (
                <p className="text-sm text-amber-500/70">{t("trade_no_units") || "You do not have tradable units yet."}</p>
              ) : filteredOwnedUnits.length === 0 ? (
                <p className="text-sm text-amber-500/70">{t("trade_no_units_match") || "No units match the filters."}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredOwnedUnits.map((unit) => {
                    const ownedCount = unitInventory[unit.id] || 0;
                    const offerCount = myOffer.units[unit.id] || 0;
                    return (
                      <div key={unit.id} className={`unit-card ${offerCount > 0 ? "selected" : ""}`}>
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openModal(unit)}
                            className="flex flex-col items-center gap-2 text-left"
                          >
                            <RarityFrame
                              unitId={unit.id}
                              unitName={getUnitName(unit)}
                              rarity={unit.rarity}
                              baseUnitId={unit.baseUnitId || unit.atlasKey}
                              size="md"
                              count={ownedCount}
                            />
                            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200 text-center line-clamp-1">
                              {getUnitName(unit)}
                            </span>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => adjustOfferUnit(unit.id, -1)}
                              disabled={offerLocked || offerCount <= 0}
                              className="px-2 py-1 rounded-lg border-2 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-200 disabled:opacity-40"
                            >
                              -
                            </button>
                            <span className="text-sm font-bold text-amber-800 dark:text-amber-200">{offerCount}</span>
                            <button
                              onClick={() => adjustOfferUnit(unit.id, 1)}
                              disabled={offerLocked || offerCount >= ownedCount}
                              className="px-2 py-1 rounded-lg border-2 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-200 disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingUnit && (
        <UnitDetailModal
          unit={viewingUnit}
          isOwned={isViewingOwned}
          isInTeam={false}
          onClose={closeModal}
          onToggleTeam={() => {}}
          showTeamAction={false}
        />
      )}

      {/* トレード完了モーダル */}
      {connectionStatus === "finished" && tradeComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* オーバーレイ */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* モーダルコンテンツ */}
          <div className="relative bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/90 dark:to-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 animate-slide-in-right border-4 border-emerald-400">
            {/* 成功アイコン */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200/60 dark:shadow-emerald-900/60">
                <span className="text-4xl">✅</span>
              </div>
            </div>

            {/* タイトル */}
            <h2 className="text-2xl font-bold text-center text-emerald-700 dark:text-emerald-300 mb-2">
              {t("trade_success_title") || "Trade Complete!"}
            </h2>
            <p className="text-center text-emerald-600/80 dark:text-emerald-400/80 mb-6">
              {t("trade_success_message") || "Your trade was completed successfully"}
            </p>

            {/* 交換内容サマリー */}
            <div className="space-y-4 mb-6">
              {/* 渡したもの */}
              <div className="rounded-xl bg-rose-50/80 dark:bg-rose-900/30 p-4 border border-rose-200/60 dark:border-rose-700/40">
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-2">
                  <span>📤</span> {t("trade_you_gave") || "You Gave"}
                </p>
                {myOffer.coins > 0 && (
                  <p className="text-sm text-rose-600 dark:text-rose-400 mb-1">
                    💰 {myOffer.coins.toLocaleString()} {t("trade_offer_coins") || "Coins"}
                  </p>
                )}
                {myOfferList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {myOfferList.map(({ unit, unitId, count }) => (
                      <span
                        key={unitId}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/70 dark:bg-slate-800/70 text-xs font-semibold text-rose-800 dark:text-rose-200"
                      >
                        {unit ? getUnitName(unit) : unitId} ×{count}
                      </span>
                    ))}
                  </div>
                ) : myOffer.coins === 0 ? (
                  <p className="text-sm text-rose-500/70">{t("trade_no_items") || "None"}</p>
                ) : null}
              </div>

              {/* もらったもの */}
              <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/30 p-4 border border-emerald-200/60 dark:border-emerald-700/40">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-2">
                  <span>📥</span> {t("trade_you_received") || "You Received"}
                </p>
                {theirOffer.coins > 0 && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">
                    💰 {theirOffer.coins.toLocaleString()} {t("trade_offer_coins") || "Coins"}
                  </p>
                )}
                {theirOfferList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {theirOfferList.map(({ unit, unitId, count }) => (
                      <span
                        key={unitId}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/70 dark:bg-slate-800/70 text-xs font-semibold text-emerald-800 dark:text-emerald-200"
                      >
                        {unit ? getUnitName(unit) : unitId} ×{count}
                      </span>
                    ))}
                  </div>
                ) : theirOffer.coins === 0 ? (
                  <p className="text-sm text-emerald-500/70">{t("trade_no_items") || "None"}</p>
                ) : null}
              </div>
            </div>

            {/* ロビーに戻るボタン */}
            <button
              onClick={handleLeave}
              className="w-full btn btn-primary py-3 text-lg font-bold"
            >
              🏠 {t("trade_back_to_lobby") || "Back to Lobby"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
