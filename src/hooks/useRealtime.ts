"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { colyseusClient, Colyseus, LobbyRoom } from "@/lib/colyseus/client";
import type {
  PlayerState,
  UnitState,
  JoinOptions,
  ConnectionStatus,
  ServerErrorMessage
} from "@/lib/colyseus/types";

// ============================================
// useRealtime Hook - リアルタイム対戦用React Hook
// ============================================

export interface RealtimeState {
  connectionStatus: ConnectionStatus;
  error: string | null;
  phase: string;
  countdown: number;
  gameTime: number;
  stageLength: number;
  mySessionId: string | null;
  roomId: string | null;  // 現在の部屋ID
  mySide: 'player1' | 'player2' | null;
  myPlayer: PlayerState | null;
  opponent: PlayerState | null;
  units: UnitState[];
  winnerId: string | null;
  winReason: string | null;
  isWinner: boolean | null;
  gameSpeed: number;
  speedVotes: Record<string, boolean>;
  // ロビー関連
  lobbyRooms: LobbyRoom[];
  isLoadingRooms: boolean;
}

export interface RealtimeActions {
  // ロビー関連
  fetchRooms: () => Promise<void>;
  createRoom: (options: JoinOptions) => Promise<void>;
  joinRoom: (roomId: string, options: JoinOptions) => Promise<void>;
  // クイックマッチ（従来のconnect）
  quickMatch: (options: JoinOptions) => Promise<void>;
  disconnect: () => Promise<void>;
  sendReady: () => void;
  sendSummon: (unitId: string) => void;
  sendUpgradeCost: () => void;
  sendSpeedVote: (enabled: boolean) => void;
}

export function useRealtime(): [RealtimeState, RealtimeActions] {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("waiting");
  const [countdown, setCountdown] = useState<number>(3);
  const [gameTime, setGameTime] = useState<number>(0);
  const [stageLength, setStageLength] = useState<number>(1200);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [mySide, setMySide] = useState<'player1' | 'player2' | null>(null);
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const [units, setUnits] = useState<UnitState[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winReason, setWinReason] = useState<string | null>(null);
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [speedVotes, setSpeedVotes] = useState<Record<string, boolean>>({});
  // 部屋ID
  const [roomId, setRoomId] = useState<string | null>(null);
  // ロビー関連
  const [lobbyRooms, setLobbyRooms] = useState<LobbyRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);

  const roomRef = useRef<Colyseus.Room | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // プレイヤー情報の派生
  const myPlayer = mySessionId ? players.get(mySessionId) || null : null;
  const opponent = (() => {
    if (!mySessionId) return null;
    if (mySide) {
      const bySide = Array.from(players.values()).find(p =>
        p.sessionId !== mySessionId && p.side && p.side !== mySide
      );
      if (bySide) return bySide;
    }
    return Array.from(players.values()).find(p => p.sessionId !== mySessionId) || null;
  })();
  const isWinner = winnerId ? winnerId === mySessionId : null;

  const resetBattleState = useCallback((status: ConnectionStatus = "disconnected") => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setConnectionStatus(status);
    setError(null);
    setPhase("waiting");
    setCountdown(3);
    setGameTime(0);
    setStageLength(1200);
    setMySessionId(null);
    setRoomId(null);
    setMySide(null);
    setPlayers(new Map());
    setUnits([]);
    setWinnerId(null);
    setWinReason(null);
    setGameSpeed(1);
    setSpeedVotes({});
  }, []);

  const buildPlayerState = useCallback((p: any, existing?: PlayerState): PlayerState => {
    const deck = (() => {
      if (Array.isArray(p?.deck)) return p.deck;
      if (p?.deck && typeof p.deck.forEach === 'function') {
        const deckArray: string[] = [];
        p.deck.forEach((d: string) => deckArray.push(d));
        return deckArray;
      }
      return existing?.deck ?? [];
    })();

    return {
      odeyoId: p?.odeyoId || existing?.odeyoId || '',
      sessionId: p?.sessionId || existing?.sessionId || '',
      displayName: p?.displayName || existing?.displayName || 'Player',
      cost: typeof p?.cost === 'number' ? p.cost : (existing?.cost ?? 0),
      maxCost: typeof p?.maxCost === 'number' ? p.maxCost : (existing?.maxCost ?? 1000),
      costLevel: typeof p?.costLevel === 'number' ? p.costLevel : (existing?.costLevel ?? 1),
      castleHp: typeof p?.castleHp === 'number' ? p.castleHp : (existing?.castleHp ?? 5000),
      maxCastleHp: typeof p?.maxCastleHp === 'number' ? p.maxCastleHp : (existing?.maxCastleHp ?? 5000),
      ready: typeof p?.ready === 'boolean' ? p.ready : (existing?.ready ?? false),
      deck,
      side: p?.side === 'player1' || p?.side === 'player2' ? p.side : existing?.side
    };
  }, []);

  const scheduleErrorClear = useCallback(() => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setError(null);
      errorTimeoutRef.current = null;
    }, 3000);
  }, []);

  const commitMySide = useCallback((nextSide: 'player1' | 'player2', force = false) => {
    setMySide(prev => (force || !prev ? nextSide : prev));
  }, []);

  const updateMySideFromPlayers = useCallback((playersList: any[], sessionId: string) => {
    if (!Array.isArray(playersList)) return;
    const me = playersList.find(p => p?.sessionId === sessionId);
    if (me && (me.side === 'player1' || me.side === 'player2')) {
      commitMySide(me.side, true);
      return;
    }
    const index = playersList.findIndex(p => p?.sessionId === sessionId);
    if (index === 0) commitMySide('player1');
    else if (index === 1) commitMySide('player2');
  }, [commitMySide]);

  const setPlayersFromList = useCallback((playersList: any[], sessionId: string) => {
    if (!Array.isArray(playersList)) return;
    setPlayers(prev => {
      const next = new Map<string, PlayerState>();
      for (const p of playersList) {
        const sid = p?.sessionId;
        if (!sid) continue;
        const existing = prev.get(sid);
        const built = buildPlayerState(p, existing);
        if (built.sessionId) {
          next.set(built.sessionId, built);
        }
      }
      return next;
    });
    updateMySideFromPlayers(playersList, sessionId);
  }, [buildPlayerState, updateMySideFromPlayers]);

  const upsertPlayersFromList = useCallback((playersList: any[], sessionId: string) => {
    if (!Array.isArray(playersList)) return;
    setPlayers(prev => {
      const next = new Map(prev);
      for (const p of playersList) {
        const sid = p?.sessionId;
        if (!sid) continue;
        const existing = next.get(sid);
        const built = buildPlayerState(p, existing);
        if (built.sessionId) {
          next.set(built.sessionId, built);
        }
      }
      return next;
    });
    updateMySideFromPlayers(playersList, sessionId);
  }, [buildPlayerState, updateMySideFromPlayers]);

  const isDeltaSync = (message: any) => {
    return message?.delta === true || message?.isDelta === true || message?.syncType === 'delta';
  };

  const applyStageLength = useCallback((value: any) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      setStageLength(value);
    }
  }, []);

  const applyGameTime = useCallback((value: any) => {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      setGameTime(value);
    }
  }, []);

  // 接続
  const connect = useCallback(async (options: JoinOptions) => {
    resetBattleState("connecting");

    try {
      const result = await colyseusClient.joinBattle(options);
      if (result.error || !result.data) {
        throw new Error(result.error || "Failed to join room");
      }
      const room = result.data;
      roomRef.current = room;
      setMySessionId(room.sessionId);
      setConnectionStatus("waiting");

      const sessionId = room.sessionId;

      // 状態変更リスナー（onStateChange）
      // Note: スキーマ同期でrefIdエラーが出るため、明示的なメッセージを使用
      // onStateChangeは使用しない（phase_change, players_sync等で同期）
      /*
      room.onStateChange((state: any) => {
        try {
          // フェーズ
          if (state.phase) {
            setPhase(state.phase);
            if (['waiting', 'countdown', 'playing', 'finished'].includes(state.phase)) {
              setConnectionStatus(state.phase as ConnectionStatus);
            }
          }

          // カウントダウン
          if (typeof state.countdown === 'number') {
            setCountdown(state.countdown);
          }

          // ゲーム時間
          if (typeof state.gameTime === 'number') {
            setGameTime(state.gameTime);
          }

          // ステージ長
          if (typeof state.stageLength === 'number') {
            setStageLength(state.stageLength);
          }

          // 勝者
          if (state.winnerId) {
            setWinnerId(state.winnerId);
          }
          if (state.winReason) {
            setWinReason(state.winReason);
          }

          // プレイヤー（スキーマエラーを防ぐため安全に処理）
          // Note: プレイヤー情報は主にメッセージ経由で更新されるが、
          //       コストやHP更新のためにonStateChangeでも処理
          if (state.players && typeof state.players.forEach === 'function') {
            try {
              const newPlayers = new Map<string, PlayerState>();
              state.players.forEach((player: any, key: string) => {
                try {
                  const sid = player.sessionId || key;
                  const deckArray: string[] = [];
                  // deck配列を安全に処理
                  if (player.deck) {
                    if (typeof player.deck.forEach === 'function') {
                      player.deck.forEach((d: string) => deckArray.push(d));
                    } else if (Array.isArray(player.deck)) {
                      deckArray.push(...player.deck);
                    }
                  }
                  newPlayers.set(sid, {
                    odeyoId: player.odeyoId || '',
                    sessionId: sid,
                    displayName: player.displayName || 'Player',
                    cost: typeof player.cost === 'number' ? player.cost : 0,
                    maxCost: typeof player.maxCost === 'number' ? player.maxCost : 5,
                    costLevel: typeof player.costLevel === 'number' ? player.costLevel : 1,
                    castleHp: typeof player.castleHp === 'number' ? player.castleHp : 5000,
                    maxCastleHp: typeof player.maxCastleHp === 'number' ? player.maxCastleHp : 5000,
                    ready: player.ready || false,
                    deck: deckArray
                  });
                } catch (playerErr) {
                  console.warn("[useRealtime] Error processing player:", key, playerErr);
                }
              });
              if (newPlayers.size > 0) {
                setPlayers(newPlayers);
              }
            } catch (playersErr) {
              console.warn("[useRealtime] Error processing players:", playersErr);
            }
          }

          // ユニット
          if (state.units && typeof state.units.forEach === 'function') {
            try {
              const newUnits: UnitState[] = [];
              state.units.forEach((unit: any) => {
                try {
                  newUnits.push({
                    instanceId: unit.instanceId || '',
                    definitionId: unit.definitionId || '',
                    side: (unit.side as 'player1' | 'player2') || 'player1',
                    x: typeof unit.x === 'number' ? unit.x : 0,
                    hp: typeof unit.hp === 'number' ? unit.hp : 0,
                    maxHp: typeof unit.maxHp === 'number' ? unit.maxHp : 0,
                    state: (unit.state as UnitState['state']) || 'WALK',
                    stateTimer: typeof unit.stateTimer === 'number' ? unit.stateTimer : 0,
                    targetId: unit.targetId || ''
                  });
                } catch (unitErr) {
                  console.warn("[useRealtime] Error processing unit:", unitErr);
                }
              });
              setUnits(newUnits);
            } catch (unitsErr) {
              console.warn("[useRealtime] Error processing units:", unitsErr);
            }
          }
        } catch (err) {
          console.warn("[useRealtime] Error in onStateChange:", err);
        }
      });
      */

      // フェーズ変更メッセージ
      room.onMessage("phase_change", (message: any) => {
        console.log("[Realtime] Phase change:", message);
        if (message.phase) {
          setPhase(message.phase);
          if (['waiting', 'countdown', 'playing', 'finished'].includes(message.phase)) {
            setConnectionStatus(message.phase as ConnectionStatus);
          }
        }
        if (typeof message?.gameSpeed === 'number') {
          setGameSpeed(message.gameSpeed);
        }
        if (message?.speedVotes && typeof message.speedVotes === 'object') {
          setSpeedVotes(message.speedVotes);
        }
        if (message.mySide === 'player1' || message.mySide === 'player2') {
          commitMySide(message.mySide, true);
        }
        applyStageLength(message.stageLength);
        applyGameTime(message.gameTime);
        if (typeof message.countdown === 'number') {
          setCountdown(message.countdown);
        }
        if (message.winnerId) {
          setWinnerId(message.winnerId);
        }
        if (message.winReason) {
          setWinReason(message.winReason);
        }
      });

      // カウントダウン更新メッセージ
      room.onMessage("countdown_update", (message: any) => {
        console.log("[Realtime] Countdown update:", message);
        if (typeof message.countdown === 'number') {
          setCountdown(message.countdown);
        }
      });

      // プレイヤー参加メッセージ
      room.onMessage("player_joined", (message: any) => {
        console.log("[Realtime] Player joined message:", message);
        setPlayers(prev => {
          const newPlayers = new Map(prev);
          const built = buildPlayerState(message, newPlayers.get(message.sessionId));
          if (built.sessionId) {
            newPlayers.set(built.sessionId, built);
          }
          console.log("[Realtime] Players after join:", newPlayers.size);
          return newPlayers;
        });
        if (message.sessionId === sessionId && (message.side === 'player1' || message.side === 'player2')) {
          commitMySide(message.side, true);
        }
      });

      // 全プレイヤー情報メッセージ（参加時に受信）
      room.onMessage("all_players", (message: any) => {
        console.log("[Realtime] All players message:", message);
        setPlayersFromList(message.players, sessionId);
        applyStageLength(message.stageLength);
      });

      // ユニット召喚メッセージ
      room.onMessage("unit_spawned", (message: any) => {
        console.log("[Realtime] Unit spawned:", message);
        // units stateは units_sync で更新される
      });

      // ユニット同期メッセージ（毎ティック）
      room.onMessage("units_sync", (message: any) => {
        if (message.units && Array.isArray(message.units)) {
          const newUnits: UnitState[] = message.units.map((unit: any) => ({
            instanceId: unit.instanceId || '',
            definitionId: unit.definitionId || '',
            side: (unit.side as 'player1' | 'player2') || 'player1',
            x: typeof unit.x === 'number' ? unit.x : 0,
            hp: typeof unit.hp === 'number' ? unit.hp : 0,
            maxHp: typeof unit.maxHp === 'number' ? unit.maxHp : 0,
            state: (unit.state as UnitState['state']) || 'WALK',
            stateTimer: typeof unit.stateTimer === 'number' ? unit.stateTimer : 0,
            targetId: unit.targetId || ''
          }));
          setUnits(newUnits);
        }
        applyStageLength(message.stageLength);
        applyGameTime(message.gameTime);
      });

      // プレイヤー同期メッセージ（毎ティック）
      room.onMessage("players_sync", (message: any) => {
        if (message.players && Array.isArray(message.players)) {
          if (isDeltaSync(message)) {
            upsertPlayersFromList(message.players, sessionId);
          } else {
            setPlayersFromList(message.players, sessionId);
          }
          applyStageLength(message.stageLength);
        }
      });

      // 速度更新メッセージ（2x合意）
      room.onMessage("speed_update", (message: any) => {
        if (typeof message?.gameSpeed === 'number') {
          setGameSpeed(message.gameSpeed);
        }
        if (message?.speedVotes && typeof message.speedVotes === 'object') {
          setSpeedVotes(message.speedVotes);
        }
      });

      // エラーメッセージ
      room.onMessage("error", (message: ServerErrorMessage) => {
        // 空のエラーオブジェクトは無視
        if (!message || (!message.code && !message.message)) {
          console.warn("[Realtime] Received empty error message, ignoring");
          return;
        }

        const code = message.code || 'UNKNOWN';
        const msg = message.message || 'Unknown error';
        console.warn("[Realtime] Error:", code, msg);

        // クールダウンやコスト不足はUIに表示しない（ゲームプレイの一部）
        if (code === 'COOLDOWN' || code === 'INSUFFICIENT_COST' || code === 'GAME_NOT_PLAYING') {
          return;
        }

        setError(`${code}: ${msg}`);
        scheduleErrorClear();
      });

      // 切断ハンドラ
      room.onLeave((code: number) => {
        console.log("[Realtime] Left room with code:", code);
        colyseusClient.clearRoom();
        roomRef.current = null;
        resetBattleState("disconnected");
      });

    } catch (err) {
      console.error("[Realtime] Connection error:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnectionStatus("error");
    }
  }, [applyGameTime, applyStageLength, buildPlayerState, commitMySide, resetBattleState, scheduleErrorClear, setPlayersFromList, upsertPlayersFromList]);

  // 切断
  const disconnect = useCallback(async () => {
    await colyseusClient.leave();
    roomRef.current = null;
    resetBattleState("disconnected");
  }, [resetBattleState]);

  // アクション
  const sendReady = useCallback(() => {
    colyseusClient.sendReady();
  }, []);

  const sendSummon = useCallback((unitId: string) => {
    colyseusClient.sendSummon(unitId);
  }, []);

  const sendUpgradeCost = useCallback(() => {
    colyseusClient.sendUpgradeCost();
  }, []);

  const sendSpeedVote = useCallback((enabled: boolean) => {
    colyseusClient.sendSpeedVote(enabled);
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        colyseusClient.leave();
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, []);

  // ロビーの部屋一覧を取得
  const fetchRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const result = await colyseusClient.fetchRooms();
      setLobbyRooms(result.data || []);
    } catch (err) {
      console.error("[Realtime] Failed to fetch rooms:", err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  // ルームリスナー設定（共通化）
  const setupRoomListeners = useCallback((room: Colyseus.Room) => {
    const sessionId = room.sessionId;

    room.onMessage("phase_change", (message: any) => {
      if (message.phase) {
        setPhase(message.phase);
        if (['waiting', 'countdown', 'playing', 'finished'].includes(message.phase)) {
          setConnectionStatus(message.phase as ConnectionStatus);
        }
      }
      if (typeof message?.gameSpeed === 'number') {
        setGameSpeed(message.gameSpeed);
      }
      if (message?.speedVotes && typeof message.speedVotes === 'object') {
        setSpeedVotes(message.speedVotes);
      }
      if (message.mySide === 'player1' || message.mySide === 'player2') {
        commitMySide(message.mySide, true);
      }
      applyStageLength(message.stageLength);
      applyGameTime(message.gameTime);
      if (typeof message.countdown === 'number') setCountdown(message.countdown);
      if (message.winnerId) setWinnerId(message.winnerId);
      if (message.winReason) setWinReason(message.winReason);
    });

    room.onMessage("countdown_update", (message: any) => {
      if (typeof message.countdown === 'number') setCountdown(message.countdown);
    });

    room.onMessage("player_joined", (message: any) => {
      setPlayers(prev => {
        const newPlayers = new Map(prev);
        const built = buildPlayerState(message, newPlayers.get(message.sessionId));
        if (built.sessionId) {
          newPlayers.set(built.sessionId, built);
        }
        return newPlayers;
      });
      if (message.sessionId === sessionId && (message.side === 'player1' || message.side === 'player2')) {
        commitMySide(message.side, true);
      }
    });

    room.onMessage("all_players", (message: any) => {
      setPlayersFromList(message.players, sessionId);
      applyStageLength(message.stageLength);
    });

    room.onMessage("unit_spawned", () => {});

    room.onMessage("units_sync", (message: any) => {
      if (message.units && Array.isArray(message.units)) {
        const newUnits: UnitState[] = message.units.map((unit: any) => ({
          instanceId: unit.instanceId || '',
          definitionId: unit.definitionId || '',
          side: (unit.side as 'player1' | 'player2') || 'player1',
          x: typeof unit.x === 'number' ? unit.x : 0,
          hp: typeof unit.hp === 'number' ? unit.hp : 0,
          maxHp: typeof unit.maxHp === 'number' ? unit.maxHp : 0,
          state: (unit.state as UnitState['state']) || 'WALK',
          stateTimer: typeof unit.stateTimer === 'number' ? unit.stateTimer : 0,
          targetId: unit.targetId || ''
        }));
        setUnits(newUnits);
      }
      applyStageLength(message.stageLength);
      applyGameTime(message.gameTime);
    });

    room.onMessage("players_sync", (message: any) => {
      if (message.players && Array.isArray(message.players)) {
        if (isDeltaSync(message)) {
          upsertPlayersFromList(message.players, sessionId);
        } else {
          setPlayersFromList(message.players, sessionId);
        }
        applyStageLength(message.stageLength);
      }
    });

    room.onMessage("speed_update", (message: any) => {
      if (typeof message?.gameSpeed === 'number') {
        setGameSpeed(message.gameSpeed);
      }
      if (message?.speedVotes && typeof message.speedVotes === 'object') {
        setSpeedVotes(message.speedVotes);
      }
    });

    room.onMessage("error", (message: ServerErrorMessage) => {
      if (!message || (!message.code && !message.message)) return;
      const code = message.code || 'UNKNOWN';
      const msg = message.message || 'Unknown error';
      if (code === 'COOLDOWN' || code === 'INSUFFICIENT_COST' || code === 'GAME_NOT_PLAYING') return;
      setError(`${code}: ${msg}`);
      scheduleErrorClear();
    });

    room.onLeave((code: number) => {
      console.log("[Realtime] Left room with code:", code);
      colyseusClient.clearRoom();
      roomRef.current = null;
      resetBattleState("disconnected");
    });
  }, [applyGameTime, applyStageLength, buildPlayerState, commitMySide, resetBattleState, scheduleErrorClear, setPlayersFromList, upsertPlayersFromList]);

  // 新しい部屋を作成（ロビーで待機）- createRoomを使用
  const createRoom = useCallback(async (options: JoinOptions) => {
    resetBattleState("connecting");

    try {
      const result = await colyseusClient.createRoom(options);
      if (result.error || !result.data) {
        throw new Error(result.error || "Failed to create room");
      }
      const room = result.data;
      roomRef.current = room;
      setMySessionId(room.sessionId);
      setRoomId(room.roomId);
      setMySide('player1'); // 部屋を作った人はplayer1
      setConnectionStatus("waiting");

      // connectと同じリスナー設定が必要なので、connectを呼び出す代わりに
      // ここでリスナーを設定（connectのロジックを再利用するためリファクタリング推奨）
      // 暫定: createRoomではroomに直接リスナーを設定
      setupRoomListeners(room);
    } catch (err) {
      console.error("[Realtime] Create room error:", err);
      setError(err instanceof Error ? err.message : "Failed to create room");
      setConnectionStatus("error");
    }
  }, [resetBattleState, setupRoomListeners]);

  // 特定の部屋に参加（ロビーから選択）
  const joinRoom = useCallback(async (targetRoomId: string, options: JoinOptions) => {
    resetBattleState("connecting");

    try {
      const result = await colyseusClient.joinRoom(targetRoomId, options);
      if (result.error || !result.data) {
        throw new Error(result.error || "Failed to join room");
      }
      const room = result.data;
      roomRef.current = room;
      setMySessionId(room.sessionId);
      setRoomId(room.roomId);
      setMySide('player2'); // 参加した人はplayer2
      setConnectionStatus("waiting");

      setupRoomListeners(room);
    } catch (err) {
      console.error("[Realtime] Join room error:", err);
      setError(err instanceof Error ? err.message : "Failed to join room");
      setConnectionStatus("error");
    }
  }, [resetBattleState, setupRoomListeners]);

  const state: RealtimeState = {
    connectionStatus,
    error,
    phase,
    countdown,
    gameTime,
    stageLength,
    mySessionId,
    roomId,
    mySide,
    myPlayer,
    opponent,
    units,
    winnerId,
    winReason,
    isWinner,
    gameSpeed,
    speedVotes,
    lobbyRooms,
    isLoadingRooms
  };

  const actions: RealtimeActions = useMemo(() => ({
    fetchRooms,
    createRoom,
    joinRoom,
    quickMatch: connect,
    disconnect,
    sendReady,
    sendSummon,
    sendUpgradeCost,
    sendSpeedVote
  }), [fetchRooms, createRoom, joinRoom, connect, disconnect, sendReady, sendSummon, sendUpgradeCost, sendSpeedVote]);

  return [state, actions];
}
