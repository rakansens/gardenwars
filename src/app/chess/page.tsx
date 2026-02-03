"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import unitsData from "@/data/units";
import type { Rarity, UnitDefinition } from "@/data/types";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useChessStageUnlock } from "@/hooks/useChessStageUnlock";
import { getSpritePath } from "@/lib/sprites";
import { ChessGame, ChessMove, ChessPieceType } from "@/lib/chess";
import { chessClient, ChessLobbyRoom, Colyseus } from "@/lib/colyseus/chessClient";
import { getChessStageById, type ChessStageDefinition, type ChessAiLevel as StageAiLevel } from "@/data/chess-stages";
import Modal from "@/components/ui/Modal";
import RarityFrame from "@/components/ui/RarityFrame";

type PieceRole = "k" | "q" | "r" | "b" | "n" | "p";
type ChessAiLevel = "easy" | "normal" | "hard" | "expert";
type ChessMode = "cpu" | "online" | "stage";
type ChessConnectionStatus = "lobby" | "connecting" | "waiting" | "playing" | "finished" | "error";

interface ChessPlayerInfo {
  sessionId: string;
  displayName: string;
  side: "w" | "b";
}

interface ChessMovePayload {
  from: { x: number; y: number };
  to: { x: number; y: number };
  promotion?: ChessPieceType;
}

interface PieceSkin {
  unitId: string;
  rarity: Rarity;
  baseUnitId?: string;
}

const STORAGE_KEY = "gardenwars_chess_piece_skins";
const AI_LEVEL_KEY = "gardenwars_chess_ai_level";
const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter((u) => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

const PIECE_ROLES: { id: PieceRole; labelKey: string }[] = [
  { id: "k", labelKey: "chess_piece_king" },
  { id: "q", labelKey: "chess_piece_queen" },
  { id: "r", labelKey: "chess_piece_rook" },
  { id: "b", labelKey: "chess_piece_bishop" },
  { id: "n", labelKey: "chess_piece_knight" },
  { id: "p", labelKey: "chess_piece_pawn" },
];

function ChessContent() {
  const { t } = useLanguage();
  const { showError, showSuccess } = useToast();
  const { playerName } = useAuth();
  const { selectedTeam, unitInventory, isLoaded, addCoins } = usePlayerData();
  const { clearChessStage, clearedChessStages } = useChessStageUnlock();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameRef = useRef<ChessGame>(new ChessGame());
  const roomRef = useRef<Colyseus.Room | null>(null);
  const serverMovesRef = useRef<ChessMovePayload[]>([]);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [legalMoves, setLegalMoves] = useState<ChessMove[]>([]);
  const [activeRole, setActiveRole] = useState<PieceRole | null>(null);
  const [pieceSkins, setPieceSkins] = useState<Record<PieceRole, PieceSkin> | null>(null);
  const [aiLevel, setAiLevel] = useState<ChessAiLevel>("normal");
  const [aiThinking, setAiThinking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [mode, setMode] = useState<ChessMode>("cpu");
  const [connectionStatus, setConnectionStatus] = useState<ChessConnectionStatus>("lobby");
  const [rooms, setRooms] = useState<ChessLobbyRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [mySide, setMySide] = useState<"w" | "b" | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<ChessPlayerInfo[]>([]);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlineWinner, setOnlineWinner] = useState<"w" | "b" | null>(null);
  const [onlineWinReason, setOnlineWinReason] = useState<string | null>(null);
  const [awaitingServer, setAwaitingServer] = useState(false);

  // Stage mode states
  const [currentStage, setCurrentStage] = useState<ChessStageDefinition | null>(null);
  const [stageTimeRemaining, setStageTimeRemaining] = useState<number | null>(null);
  const [stageResult, setStageResult] = useState<"win" | "lose" | "timeout" | null>(null);
  const [showStageResult, setShowStageResult] = useState(false);

  const displayName = playerName?.trim() || "Player";

  // Load stage from URL parameters
  useEffect(() => {
    const stageId = searchParams.get("stageId");
    if (stageId) {
      const stage = getChessStageById(stageId);
      if (stage) {
        setCurrentStage(stage);
        setMode("stage");
        setAiLevel(stage.aiLevel);
        if (stage.timeLimitSeconds) {
          setStageTimeRemaining(stage.timeLimitSeconds);
        }
        // Reset game for stage
        gameRef.current.reset();
        setSelected(null);
        setLegalMoves([]);
        setPendingPromotion(null);
        setVersion((v) => v + 1);
        setStageResult(null);
        setShowStageResult(false);
      }
    }
  }, [searchParams]);

  // Stage timer effect
  useEffect(() => {
    if (mode !== "stage" || !currentStage?.timeLimitSeconds || stageTimeRemaining === null) return;
    if (stageResult) return; // Game already ended

    const interval = setInterval(() => {
      setStageTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(interval);
          // Time's up - player loses
          setStageResult("timeout");
          setShowStageResult(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, currentStage, stageTimeRemaining, stageResult]);

  // Detect stage end (checkmate/stalemate)
  useEffect(() => {
    if (mode !== "stage" || !currentStage) return;
    const status = gameRef.current.getStatus();

    if (status.checkmate) {
      // Checkmate - determine winner
      const turn = gameRef.current.getTurn();
      if (turn === "b") {
        // Black to move but in checkmate = White wins = Player wins
        setStageResult("win");
        // Mark stage as cleared and give reward
        const alreadyCleared = clearedChessStages.includes(currentStage.id);
        clearChessStage(currentStage.id, alreadyCleared ? 0 : currentStage.reward.coins);
        if (!alreadyCleared) {
          showSuccess(`+${currentStage.reward.coins} ${t("coins")}`);
        }
      } else {
        // White to move but in checkmate = Black wins = Player loses
        setStageResult("lose");
      }
      setShowStageResult(true);
    } else if (status.stalemate) {
      // Stalemate = draw = lose for stage purposes
      setStageResult("lose");
      setShowStageResult(true);
    }
  }, [version, mode, currentStage, clearChessStage, clearedChessStages, showSuccess, t]);

  const ownedUnits = useMemo(
    () => playableUnits.filter((unit) => (unitInventory[unit.id] ?? 0) > 0),
    [unitInventory]
  );

  const selectableUnits = ownedUnits.length > 0 ? ownedUnits : playableUnits;

  const getUnitName = (unit: UnitDefinition) => {
    const translated = t(unit.id);
    return translated !== unit.id ? translated : unit.name;
  };

  useEffect(() => {
    if (!isLoaded) return;

    try {
      const storedLevel = localStorage.getItem(AI_LEVEL_KEY) as ChessAiLevel | null;
      if (storedLevel === "easy" || storedLevel === "normal" || storedLevel === "hard") {
        setAiLevel(storedLevel);
      }
    } catch {}

    let initial: Record<PieceRole, PieceSkin> | null = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate parsed data structure
        if (typeof parsed !== "object" || parsed === null) {
          console.warn("Invalid chess piece skins data structure, using defaults");
        } else {
          const next: Record<PieceRole, PieceSkin> = {} as Record<PieceRole, PieceSkin>;
          let valid = true;
          for (const role of PIECE_ROLES) {
            const unitId = parsed[role.id];
            if (typeof unitId !== "string") {
              valid = false;
              break;
            }
            const unitDef = playableUnits.find((u) => u.id === unitId);
            if (!unitDef || (unitInventory[unitId] ?? 0) <= 0) {
              valid = false;
              break;
            }
            next[role.id] = {
              unitId: unitDef.id,
              rarity: unitDef.rarity,
              baseUnitId: unitDef.baseUnitId || unitDef.atlasKey,
            };
          }
          if (valid) initial = next;
        }
      }
    } catch (e) {
      console.warn("Failed to parse chess piece skins from localStorage:", e);
    }

    if (!initial) {
      const candidates: UnitDefinition[] = [];
      selectedTeam.forEach((id) => {
        const unit = playableUnits.find((u) => u.id === id);
        if (unit) candidates.push(unit);
      });
      ownedUnits.forEach((unit) => {
        if (!candidates.some((c) => c.id === unit.id)) candidates.push(unit);
      });
      playableUnits.forEach((unit) => {
        if (!candidates.some((c) => c.id === unit.id)) candidates.push(unit);
      });

      const fallback = candidates.length > 0 ? candidates : playableUnits;
      const next: Record<PieceRole, PieceSkin> = {} as Record<PieceRole, PieceSkin>;
      PIECE_ROLES.forEach((role, index) => {
        const unit = fallback[index % fallback.length];
        next[role.id] = {
          unitId: unit.id,
          rarity: unit.rarity,
          baseUnitId: unit.baseUnitId || unit.atlasKey,
        };
      });
      initial = next;
    }

    setPieceSkins(initial);
  }, [isLoaded, selectedTeam, ownedUnits, unitInventory]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_LEVEL_KEY, aiLevel);
    } catch {}
  }, [aiLevel]);

  useEffect(() => {
    if (!pieceSkins) return;
    try {
      const payload: Record<PieceRole, string> = {} as Record<PieceRole, string>;
      PIECE_ROLES.forEach((role) => {
        payload[role.id] = pieceSkins[role.id].unitId;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [pieceSkins]);

  const resetLocalGame = useCallback(() => {
    gameRef.current.reset();
    setSelected(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    setVersion((v) => v + 1);
  }, []);

  const applyServerMoves = useCallback((moves: ChessMovePayload[]) => {
    gameRef.current.reset();
    for (const move of moves) {
      const result = gameRef.current.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promotion ?? "q");
      if (!result.ok) break;
    }
    setAwaitingServer(false);
    setSelected(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    setVersion((v) => v + 1);
  }, []);

  const applyServerMove = useCallback((move: ChessMovePayload) => {
    const result = gameRef.current.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promotion ?? "q");
    if (!result.ok) {
      chessClient.requestSync();
      return;
    }
    setAwaitingServer(false);
    setSelected(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    setVersion((v) => v + 1);
  }, []);

  const resetOnlineState = useCallback((status: ChessConnectionStatus = "lobby") => {
    setConnectionStatus(status);
    setRoomId(null);
    setMySide(null);
    setMySessionId(null);
    setOnlinePlayers([]);
    setOnlineError(null);
    setOnlineWinner(null);
    setOnlineWinReason(null);
    setAwaitingServer(false);
    serverMovesRef.current = [];
  }, []);

  const fetchOnlineRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    const result = await chessClient.fetchRooms();
    setRooms(result.data || []);
    if (result.error) {
      showError(result.error);
    }
    setIsLoadingRooms(false);
  }, [showError]);

  const attachRoom = useCallback(
    (room: Colyseus.Room) => {
      roomRef.current = room;
      setRoomId(room.roomId);
      setMySessionId(room.sessionId);
      setConnectionStatus("waiting");
      setOnlineError(null);
      setOnlineWinner(null);
      setOnlineWinReason(null);
      setMySide(null);
      setOnlinePlayers([]);
      setAwaitingServer(false);
      serverMovesRef.current = [];
      resetLocalGame();

      room.onMessage("assign", (message: any) => {
        if (message?.side === "w" || message?.side === "b") {
          setMySide(message.side);
        }
      });

      room.onMessage("all_players", (message: any) => {
        if (Array.isArray(message?.players)) {
          setOnlinePlayers(
            message.players.map((player: ChessPlayerInfo) => {
              if (player.sessionId === room.sessionId) {
                return { ...player, displayName };
              }
              return player;
            })
          );
        }
      });

      room.onMessage("player_joined", (message: any) => {
        if (!message?.sessionId) return;
        setOnlinePlayers((prev) => {
          const next = prev.filter((p) => p.sessionId !== message.sessionId);
          next.push({
            sessionId: message.sessionId,
            displayName: message.sessionId === room.sessionId ? displayName : message.displayName || "Player",
            side: message.side,
          });
          return next;
        });
      });

      room.onMessage("player_left", (message: any) => {
        if (!message?.sessionId) return;
        setOnlinePlayers((prev) => prev.filter((p) => p.sessionId !== message.sessionId));
      });

      room.onMessage("sync", (message: any) => {
        const moves = Array.isArray(message?.moves) ? message.moves : [];
        serverMovesRef.current = moves;
        applyServerMoves(moves);
        if (message?.phase === "playing") {
          setConnectionStatus("playing");
        }
      });

      room.onMessage("game_start", () => {
        setConnectionStatus("playing");
      });

      room.onMessage("move", (message: any) => {
        if (!message?.from || !message?.to) return;
        const move: ChessMovePayload = {
          from: message.from,
          to: message.to,
          promotion: message.promotion,
        };
        serverMovesRef.current = [...serverMovesRef.current, move];
        applyServerMove(move);
      });

      room.onMessage("game_over", (message: any) => {
        setConnectionStatus("finished");
        setOnlineWinner(message?.winnerSide ?? null);
        setOnlineWinReason(message?.reason ?? null);
      });

      room.onMessage("error", (message: any) => {
        if (!message || (!message.code && !message.message)) return;
        const code = message.code || "ERROR";
        const msg = message.message || "";
        setAwaitingServer(false);
        setOnlineError(`${code}${msg ? `: ${msg}` : ""}`);
      });

      room.onLeave(() => {
        chessClient.clearRoom();
        roomRef.current = null;
        resetOnlineState("lobby");
      });
    },
    [applyServerMove, applyServerMoves, displayName, resetLocalGame, resetOnlineState]
  );

  const handleQuickMatch = useCallback(async () => {
    setConnectionStatus("connecting");
    const result = await chessClient.quickMatch({ displayName });
    if (result.error || !result.data) {
      console.error("[Chess] Quick match failed:", result.error);
      setOnlineError(result.error || "Connection failed");
      showError(result.error || "Connection failed");
      setConnectionStatus("error");
      return;
    }
    attachRoom(result.data);
  }, [attachRoom, displayName, showError]);

  const handleCreateRoom = useCallback(async () => {
    setConnectionStatus("connecting");
    const result = await chessClient.createRoom({ displayName });
    if (result.error || !result.data) {
      console.error("[Chess] Create room failed:", result.error);
      setOnlineError(result.error || "Connection failed");
      showError(result.error || "Connection failed");
      setConnectionStatus("error");
      return;
    }
    attachRoom(result.data);
  }, [attachRoom, displayName, showError]);

  const handleJoinRoom = useCallback(
    async (targetRoomId: string) => {
      setConnectionStatus("connecting");
      const result = await chessClient.joinRoom(targetRoomId, { displayName });
      if (result.error || !result.data) {
        console.error("[Chess] Join room failed:", result.error);
        setOnlineError(result.error || "Connection failed");
        showError(result.error || "Connection failed");
        setConnectionStatus("error");
        return;
      }
      attachRoom(result.data);
    },
    [attachRoom, displayName, showError]
  );

  const handleResign = useCallback(() => {
    chessClient.sendResign();
  }, []);

  const disconnectOnline = useCallback(async () => {
    await chessClient.leave();
    roomRef.current = null;
    resetOnlineState("lobby");
  }, [resetOnlineState]);

  useEffect(() => {
    if (mode !== "online") return;
    fetchOnlineRooms();
  }, [mode, fetchOnlineRooms]);

  useEffect(() => {
    if (mode === "online") {
      setAiThinking(false);
      return;
    }
    if (roomRef.current) {
      chessClient.leave();
      roomRef.current = null;
    }
    resetOnlineState("lobby");
    resetLocalGame();
  }, [mode, resetOnlineState, resetLocalGame]);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        chessClient.leave();
      }
    };
  }, []);

  const board = gameRef.current.getBoard();
  const status = gameRef.current.getStatus();
  const turn = gameRef.current.getTurn();
  const lastMove = gameRef.current.getLastMove();
  const isOnline = mode === "online";
  const isStage = mode === "stage";
  const isInMatch = mode === "cpu" || mode === "stage" || connectionStatus === "playing" || connectionStatus === "finished";
  const canInteract =
    mode === "cpu" || mode === "stage"
      ? turn === "w" && !stageResult
      : connectionStatus === "playing" && !!mySide && mySide === turn && !awaitingServer;
  const opponent = isOnline ? onlinePlayers.find((player) => player.side !== mySide) || null : null;

  const legalMoveTargets = useMemo(() => {
    const map = new Map<string, ChessMove>();
    legalMoves.forEach((move) => {
      map.set(`${move.to.x}-${move.to.y}`, move);
    });
    return map;
  }, [legalMoves]);

  const handleSquareClick = (x: number, y: number) => {
    if (status.checkmate || status.stalemate) return;
    if (connectionStatus === "finished") return;
    if (stageResult) return; // Stage already ended
    if (!canInteract) return;
    if (pendingPromotion) return;
    const piece = board[y][x];
    if (selected) {
      const move = legalMoveTargets.get(`${x}-${y}`);
      if (move) {
        // Check if this is a pawn promotion
        if (move.promotion) {
          setPendingPromotion({ from: { x: selected.x, y: selected.y }, to: { x, y } });
          return;
        }
        if (mode === "online") {
          chessClient.sendMove({ from: { x: selected.x, y: selected.y }, to: { x, y } });
          setAwaitingServer(true);
          setSelected(null);
          setLegalMoves([]);
          return;
        }
        const result = gameRef.current.move(selected.x, selected.y, x, y);
        if (result.ok) {
          setSelected(null);
          setLegalMoves([]);
          setVersion((v) => v + 1);
          return;
        }
      }
    }

    if (piece && piece.color === turn) {
      setSelected({ x, y });
      setLegalMoves(gameRef.current.getLegalMovesFrom(x, y));
    } else {
      setSelected(null);
      setLegalMoves([]);
    }
  };

  const handlePromotion = (pieceType: ChessPieceType) => {
    if (!pendingPromotion) return;
    if (mode === "online") {
      chessClient.sendMove({
        from: { ...pendingPromotion.from },
        to: { ...pendingPromotion.to },
        promotion: pieceType,
      });
      setAwaitingServer(true);
      setSelected(null);
      setLegalMoves([]);
    } else {
      const result = gameRef.current.move(
        pendingPromotion.from.x,
        pendingPromotion.from.y,
        pendingPromotion.to.x,
        pendingPromotion.to.y,
        pieceType
      );
      if (result.ok) {
        setSelected(null);
        setLegalMoves([]);
        setVersion((v) => v + 1);
      }
    }
    setPendingPromotion(null);
  };

  const handleUndo = () => {
    // Undo twice to undo both player and AI move
    if (mode !== "cpu" && mode !== "stage") return;
    // Check if undo is disabled for stage mode
    if (mode === "stage" && currentStage?.specialRules?.noUndo) return;
    if (gameRef.current.canUndo()) {
      gameRef.current.undo();
      if (gameRef.current.canUndo() && gameRef.current.getTurn() === "b") {
        gameRef.current.undo();
      }
      setSelected(null);
      setLegalMoves([]);
      setVersion((v) => v + 1);
    }
  };

  const handleReset = () => {
    if (mode !== "cpu" && mode !== "stage") return;
    gameRef.current.reset();
    setSelected(null);
    setLegalMoves([]);
    setVersion((v) => v + 1);
    // Reset stage state
    if (mode === "stage" && currentStage?.timeLimitSeconds) {
      setStageTimeRemaining(currentStage.timeLimitSeconds);
    }
    setStageResult(null);
    setShowStageResult(false);
  };

  const getPieceSymbol = (type: PieceRole, color: "w" | "b") => {
    const whiteSymbols: Record<PieceRole, string> = {
      k: "♔",
      q: "♕",
      r: "♖",
      b: "♗",
      n: "♘",
      p: "♙",
    };
    const blackSymbols: Record<PieceRole, string> = {
      k: "♚",
      q: "♛",
      r: "♜",
      b: "♝",
      n: "♞",
      p: "♟",
    };
    return color === "w" ? whiteSymbols[type] : blackSymbols[type];
  };

  useEffect(() => {
    if (mode !== "cpu" && mode !== "stage") return;
    if (status.checkmate || status.stalemate) return;
    if (stageResult) return; // Stage ended
    if (turn !== "b") return;

    let cancelled = false;
    setAiThinking(true);
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const moves = gameRef.current.getAllLegalMoves("b");
      if (moves.length === 0) {
        setAiThinking(false);
        return;
      }

      let selectedMove = moves[0];
      const values: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

      if (aiLevel === "easy") {
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
      } else if (aiLevel === "normal") {
        const values: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
        let bestScore = -Infinity;
        for (const move of moves) {
          const clone = gameRef.current.clone();
          clone.move(move.from.x, move.from.y, move.to.x, move.to.y);
          let score = 0;
          const board = clone.getBoard();
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              const piece = board[y][x];
              if (!piece) continue;
              const value = values[piece.type] ?? 0;
              score += piece.color === "b" ? value : -value;
            }
          }
          if (move.capture) score += 40;
          if (score > bestScore) {
            bestScore = score;
            selectedMove = move;
          }
        }
      } else if (aiLevel === "hard") {
        // 2-ply search for hard level
        let bestScore = -Infinity;
        for (const move of moves) {
          const clone = gameRef.current.clone();
          clone.move(move.from.x, move.from.y, move.to.x, move.to.y);
          const replyMoves = clone.getAllLegalMoves("w");
          if (replyMoves.length === 0) {
            const cloneStatus = clone.getStatus();
            const score = cloneStatus.checkmate ? 100000 : 0;
            if (score > bestScore) {
              bestScore = score;
              selectedMove = move;
            }
            continue;
          }
          let worstScore = Infinity;
          for (const reply of replyMoves) {
            const replyClone = clone.clone();
            replyClone.move(reply.from.x, reply.from.y, reply.to.x, reply.to.y);
            let score = 0;
            const board = replyClone.getBoard();
            for (let y = 0; y < 8; y++) {
              for (let x = 0; x < 8; x++) {
                const piece = board[y][x];
                if (!piece) continue;
                const value = values[piece.type] ?? 0;
                score += piece.color === "b" ? value : -value;
              }
            }
            if (score < worstScore) worstScore = score;
          }
          if (worstScore > bestScore) {
            bestScore = worstScore;
            selectedMove = move;
          }
        }
      } else if (aiLevel === "expert") {
        // 3-ply minimax for expert level
        let bestScore = -Infinity;
        for (const move of moves) {
          const clone = gameRef.current.clone();
          clone.move(move.from.x, move.from.y, move.to.x, move.to.y);
          const score = minimax(clone, 2, false, -Infinity, Infinity, values);
          if (score > bestScore) {
            bestScore = score;
            selectedMove = move;
          }
        }
      }

      gameRef.current.move(selectedMove.from.x, selectedMove.from.y, selectedMove.to.x, selectedMove.to.y);
      setSelected(null);
      setLegalMoves([]);
      setVersion((v) => v + 1);
      setAiThinking(false);
    }, aiLevel === "easy" ? 300 : aiLevel === "normal" ? 450 : aiLevel === "hard" ? 600 : 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [turn, aiLevel, status.checkmate, status.stalemate, version, mode, stageResult]);

  // Minimax helper for expert AI
  function minimax(
    game: ChessGame,
    depth: number,
    isMaximizing: boolean,
    alpha: number,
    beta: number,
    values: Record<string, number>
  ): number {
    if (depth === 0) {
      let score = 0;
      const board = game.getBoard();
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const piece = board[y][x];
          if (!piece) continue;
          const value = values[piece.type] ?? 0;
          score += piece.color === "b" ? value : -value;
        }
      }
      return score;
    }

    const status = game.getStatus();
    if (status.checkmate) {
      return isMaximizing ? -100000 - depth : 100000 + depth;
    }
    if (status.stalemate) return 0;

    const moves = game.getAllLegalMoves(isMaximizing ? "b" : "w");
    if (moves.length === 0) return 0;

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        const clone = game.clone();
        clone.move(move.from.x, move.from.y, move.to.x, move.to.y);
        const score = minimax(clone, depth - 1, false, alpha, beta, values);
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const move of moves) {
        const clone = game.clone();
        clone.move(move.from.x, move.from.y, move.to.x, move.to.y);
        const score = minimax(clone, depth - 1, true, alpha, beta, values);
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minScore;
    }
  }

  if (!isLoaded || !pieceSkins) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">♟️ Loading...</div>
      </main>
    );
  }

  const getPieceSkin = (type: PieceRole) => pieceSkins[type];

  const getMovePattern = (type: PieceRole): boolean[][] => {
    const empty = () => Array(5).fill(null).map(() => Array(5).fill(false));
    const patterns: Record<PieceRole, boolean[][]> = {
      k: (() => {
        const p = empty();
        p[1][1] = p[1][2] = p[1][3] = true;
        p[2][1] = p[2][3] = true;
        p[3][1] = p[3][2] = p[3][3] = true;
        return p;
      })(),
      q: (() => {
        const p = empty();
        for (let i = 0; i < 5; i++) { p[2][i] = true; p[i][2] = true; p[i][i] = true; p[i][4-i] = true; }
        return p;
      })(),
      r: (() => {
        const p = empty();
        for (let i = 0; i < 5; i++) { p[2][i] = true; p[i][2] = true; }
        return p;
      })(),
      b: (() => {
        const p = empty();
        for (let i = 0; i < 5; i++) { p[i][i] = true; p[i][4-i] = true; }
        return p;
      })(),
      n: (() => {
        const p = empty();
        p[0][1] = p[0][3] = true;
        p[1][0] = p[1][4] = true;
        p[3][0] = p[3][4] = true;
        p[4][1] = p[4][3] = true;
        return p;
      })(),
      p: (() => {
        const p = empty();
        p[1][2] = true;
        p[0][2] = true;
        p[1][1] = true;
        p[1][3] = true;
        return p;
      })(),
    };
    return patterns[type];
  };

  const PieceMoveGrid = ({ type }: { type: PieceRole }) => {
    const pattern = getMovePattern(type);
    return (
      <div className="grid grid-cols-5 gap-0.5 w-20 h-20">
        {pattern.map((row, y) =>
          row.map((canMove, x) => {
            const isCenter = x === 2 && y === 2;
            return (
              <div
                key={`${x}-${y}`}
                className={`w-3.5 h-3.5 rounded-sm ${
                  isCenter
                    ? "bg-amber-500 flex items-center justify-center"
                    : canMove
                    ? "bg-emerald-400"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                {isCenter && <span className="text-[8px] text-white font-bold">{getPieceSymbol(type, "w")}</span>}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const formatSide = (side?: "w" | "b" | null) => {
    if (side === "w") return t("chess_online_side_white");
    if (side === "b") return t("chess_online_side_black");
    return "-";
  };

  const onlineResultLabel =
    connectionStatus === "finished"
      ? onlineWinReason === "stalemate"
        ? t("chess_online_result_draw")
        : onlineWinner
        ? onlineWinner === mySide
          ? t("chess_online_result_win")
          : t("chess_online_result_lose")
        : t("chess_online_result_draw")
      : null;

  const onlineStatusLabel =
    connectionStatus === "playing"
      ? t("chess_online_status_playing")
      : connectionStatus === "finished"
      ? t("chess_online_status_finished")
      : t("chess_online_status_waiting");

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <Link href={isStage ? "/chess/stages" : "/"} className="btn btn-secondary text-sm py-2 px-3">
          ← {isStage ? t("back") : t("back_to_home")}
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            ♟️ {isStage && currentStage ? t(currentStage.nameKey) : t("menu_chess")}
          </h1>
          {isStage && stageTimeRemaining !== null && (
            <div className={`text-lg font-mono ${stageTimeRemaining <= 30 ? "text-red-500 animate-pulse" : "text-gray-600"}`}>
              ⏱️ {formatTime(stageTimeRemaining)}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {mode === "cpu" || mode === "stage" ? (
            <>
              {!(isStage && currentStage?.specialRules?.noUndo) && (
                <button
                  onClick={handleUndo}
                  disabled={!gameRef.current.canUndo() || turn === "b" || !!stageResult}
                  className="btn btn-secondary text-sm py-2 px-3 disabled:opacity-40"
                >
                  ↩ {t("chess_undo")}
                </button>
              )}
              <button
                onClick={handleReset}
                className="btn btn-primary text-sm py-2 px-3"
                disabled={!!stageResult && isStage}
              >
                {t("chess_reset")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleResign}
                disabled={connectionStatus !== "playing"}
                className="btn btn-secondary text-sm py-2 px-3 disabled:opacity-40"
              >
                {t("chess_online_resign")}
              </button>
              <button onClick={disconnectOnline} className="btn btn-primary text-sm py-2 px-3">
                {t("chess_online_leave")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stage Mode Banner (only show in free play mode) */}
      {!isStage && (
        <div className="max-w-4xl mx-auto mb-4">
          <Link
            href="/chess/stages"
            className="card block w-full hover:scale-[1.02] transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎯</span>
                <div>
                  <h3 className="font-bold text-lg text-amber-900 dark:text-white">{t("chess_stage_mode")}</h3>
                  <p className="text-sm text-amber-700/70 dark:text-gray-400">{t("chess_difficulty_beginner_desc")}</p>
                </div>
              </div>
              <div className="btn btn-primary py-2 px-4">
                <span>{t("play")} →</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      <div className="max-w-4xl mx-auto mb-6 card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-amber-900 dark:text-white">{t("chess_mode_title")}</h2>
            <p className="text-sm text-amber-700/70 dark:text-slate-300/70">{t("chess_mode_desc")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
            <button
              onClick={() => setMode("cpu")}
              className={`btn ${mode === "cpu" || mode === "stage" ? "btn-primary" : "btn-secondary"} text-sm`}
            >
              {t("chess_mode_cpu")}
            </button>
            <button
              onClick={() => setMode("online")}
              className={`btn ${mode === "online" ? "btn-primary" : "btn-secondary"} text-sm`}
            >
              {t("chess_mode_online")}
            </button>
          </div>
        </div>
      </div>

      {isInMatch && (
        <div className="text-center mb-6 text-amber-900/70 dark:text-gray-400">
          <p>{t("chess_subtitle")}</p>
          <p className="text-sm mt-1">
            {turn === "w" ? t("chess_turn_white") : t("chess_turn_black")}
            {status.inCheck && !status.checkmate && ` • ${t("chess_check")}`}
            {mode === "cpu" && aiThinking && turn === "b" && ` • ${t("chess_ai_thinking")}`}
          </p>
        </div>
      )}

      {isOnline && !isInMatch && (
        <div className="max-w-4xl mx-auto space-y-4">
          {onlineError && (
            <div className="card border border-rose-200 bg-rose-50 text-rose-700">{onlineError}</div>
          )}

          {connectionStatus === "waiting" || connectionStatus === "connecting" ? (
            <div className="card text-center space-y-3">
              <div className="text-4xl">⏳</div>
              <div className="text-lg font-bold text-amber-900">{t("chess_online_waiting")}</div>
              <p className="text-sm text-amber-700/70">
                {displayName} {t("chess_online_waiting_as")}
              </p>
              {roomId && (
                <p className="text-xs text-amber-700/60">
                  {t("chess_online_room_created")} ID:{" "}
                  <span className="font-mono bg-amber-100 px-2 py-0.5 rounded">{roomId.slice(0, 8)}</span>
                </p>
              )}
              <button onClick={disconnectOnline} className="btn btn-secondary text-sm">
                {t("chess_online_leave")}
              </button>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-amber-900 dark:text-white">{t("chess_online_title")}</h2>
                    <p className="text-sm text-amber-700/70 dark:text-slate-300/70">{t("chess_online_subtitle")}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={handleQuickMatch} className="btn btn-primary text-sm">
                      {t("chess_online_quick_match")}
                    </button>
                    <button onClick={handleCreateRoom} className="btn btn-secondary text-sm">
                      {t("chess_online_create_room")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200">
                    {t("chess_online_waiting_rooms")}
                  </h2>
                  <button
                    onClick={fetchOnlineRooms}
                    disabled={isLoadingRooms}
                    className="px-3 py-2 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-300 rounded-xl font-bold text-xs disabled:opacity-50 transition-all"
                  >
                    {isLoadingRooms ? `🔄 ${t("loading")}` : `🔄 ${t("refresh")}`}
                  </button>
                </div>

                {rooms.length === 0 ? (
                  <div className="text-center text-sm text-amber-700/70 py-6">
                    <p>{t("chess_online_no_rooms")}</p>
                    <p className="text-xs mt-1">{t("chess_online_no_rooms_hint")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rooms.map((room) => (
                      <div
                        key={room.roomId}
                        className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3"
                      >
                        <div>
                          <p className="font-bold text-amber-900">{room.hostName}</p>
                          <p className="text-xs text-amber-700/60">
                            {new Date(room.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <button onClick={() => handleJoinRoom(room.roomId)} className="btn btn-primary text-xs">
                          {t("chess_online_join")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {isInMatch && (
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
          <div className="card">
            <div className="grid grid-cols-8 border-4 border-amber-200 rounded-2xl overflow-hidden shadow-lg">
              {board.map((row, y) =>
                row.map((piece, x) => {
                  const isLight = (x + y) % 2 === 0;
                  const isSelected = selected?.x === x && selected?.y === y;
                  const moveData = legalMoveTargets.get(`${x}-${y}`);
                  const legalMove = !!moveData;
                  const isCapture = moveData?.capture || moveData?.enPassant;
                  const isLast =
                    lastMove &&
                    ((lastMove.from.x === x && lastMove.from.y === y) ||
                      (lastMove.to.x === x && lastMove.to.y === y));

                  return (
                    <button
                      key={`${x}-${y}-${version}`}
                      onClick={() => handleSquareClick(x, y)}
                      className={`relative aspect-square flex items-center justify-center transition-colors ${
                        isLight ? "bg-amber-100/80" : "bg-amber-300/70"
                      } ${isSelected ? "ring-4 ring-emerald-400" : ""} ${isLast ? "outline outline-2 outline-orange-300" : ""} ${
                        isCapture ? "ring-4 ring-rose-500 bg-rose-200/50" : ""
                      }`}
                    >
                      {legalMove && !isCapture && (
                        <div className="absolute w-3 h-3 rounded-full bg-emerald-500/80" />
                      )}
                      {piece && (
                        <div className="relative">
                          <img
                            src={getSpritePath(
                              getPieceSkin(piece.type as PieceRole).baseUnitId || getPieceSkin(piece.type as PieceRole).unitId,
                              getPieceSkin(piece.type as PieceRole).rarity
                            )}
                            alt={piece.type}
                            className={`w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow ${
                              piece.color === "b" ? "grayscale brightness-75 contrast-125" : ""
                            }`}
                            style={piece.color === "b" ? { transform: "scaleX(-1)" } : undefined}
                          />
                          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white/90 text-amber-900 text-sm font-bold flex items-center justify-center shadow">
                            {getPieceSymbol(piece.type as PieceRole, piece.color)}
                          </span>
                          {isCapture && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-rose-600 bg-white/90 px-1 rounded">
                              ⚔️
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {(status.checkmate || status.stalemate) && (
              <div className="mt-4 text-center text-sm font-semibold text-rose-600">
                {status.checkmate ? t("chess_checkmate") : t("chess_stalemate")}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {mode === "online" ? (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-amber-800 dark:text-white">{t("chess_mode_online")}</h2>
                    <p className="text-sm text-amber-700/70 dark:text-slate-300/70">{t("chess_online_subtitle")}</p>
                  </div>
                  <span className="text-2xl">🌐</span>
                </div>
                <div className="space-y-1 text-sm text-amber-800/80 dark:text-slate-300/80">
                  <div className="flex items-center justify-between">
                    <span>{t("chess_online_you")}</span>
                    <span>
                      {displayName} ({formatSide(mySide)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("chess_online_opponent")}</span>
                    <span>
                      {opponent?.displayName || "?"} ({formatSide(opponent?.side)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("chess_online_status")}</span>
                    <span>{onlineStatusLabel}</span>
                  </div>
                </div>
                {onlineResultLabel && (
                  <div className="mt-3 text-sm font-semibold text-rose-600">{onlineResultLabel}</div>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-amber-800 dark:text-white">{t("chess_ai_level")}</h2>
                    <p className="text-sm text-amber-700/70 dark:text-slate-300/70">{t("chess_ai_level_desc")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["easy", "normal", "hard"] as ChessAiLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setAiLevel(level)}
                      className={`btn ${aiLevel === level ? "btn-primary" : "btn-secondary"} text-xs py-2`}
                    >
                      {t(`chess_ai_${level}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-amber-800 dark:text-white">{t("chess_piece_set")}</h2>
                  <p className="text-sm text-amber-700/70 dark:text-slate-300/70">{t("chess_piece_set_desc")}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {PIECE_ROLES.map((role) => {
                  const skin = getPieceSkin(role.id);
                  return (
                    <button
                      key={role.id}
                      onClick={() => setActiveRole(role.id)}
                      className="unit-card flex flex-col items-center gap-2 hover:scale-[1.02]"
                    >
                      <RarityFrame
                        unitId={skin.unitId}
                        unitName={getUnitName(playableUnits.find((u) => u.id === skin.unitId) || playableUnits[0])}
                        rarity={skin.rarity}
                        size="sm"
                        baseUnitId={skin.baseUnitId}
                      />
                      <span className="text-xs text-amber-900/80">{t(role.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <button
                onClick={() => setShowHelp(true)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <h2 className="text-lg font-bold text-amber-800 dark:text-white">{t("chess_help")}</h2>
                  <p className="text-sm text-amber-700/70 dark:text-slate-300/70">{t("chess_help_desc")}</p>
                </div>
                <span className="text-2xl">❓</span>
              </button>
            </div>

            <div className="card text-sm text-amber-800/80 dark:text-slate-300/80">
              <p className="font-semibold text-amber-900 dark:text-white mb-2">{t("chess_hint_title")}</p>
              <p>{t("chess_hint_body")}</p>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={!!activeRole} onClose={() => setActiveRole(null)} size="lg">
        <div className="p-5">
          <h2 className="text-xl font-bold text-amber-900 mb-2">{t("chess_select_unit")}</h2>
          <p className="text-sm text-amber-700/70 mb-4">{t("chess_select_unit_desc")}</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {selectableUnits.map((unit) => {
              const isSelected = activeRole ? pieceSkins[activeRole].unitId === unit.id : false;
              return (
                <button
                  key={unit.id}
                  onClick={() => {
                    if (!activeRole) return;
                    setPieceSkins((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        [activeRole]: {
                          unitId: unit.id,
                          rarity: unit.rarity,
                          baseUnitId: unit.baseUnitId || unit.atlasKey,
                        },
                      };
                    });
                    setActiveRole(null);
                  }}
                  className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${
                    isSelected ? "border-amber-400 bg-amber-50" : "border-transparent hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <RarityFrame
                    unitId={unit.id}
                    unitName={getUnitName(unit)}
                    rarity={unit.rarity}
                    size="sm"
                    baseUnitId={unit.baseUnitId || unit.atlasKey}
                    count={unitInventory[unit.id]}
                  />
                  <span className="text-[11px] text-slate-600 line-clamp-2">{getUnitName(unit)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal isOpen={showHelp} onClose={() => setShowHelp(false)} size="lg">
        <div className="p-5">
          <h2 className="text-xl font-bold text-amber-900 dark:text-white mb-2">{t("chess_help")}</h2>
          <p className="text-sm text-amber-700/70 dark:text-slate-300/70 mb-4">{t("chess_help_desc")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {PIECE_ROLES.map((role) => (
              <div key={role.id} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getPieceSymbol(role.id, "w")}</span>
                  <span className="font-semibold text-amber-900 dark:text-white">{t(role.labelKey)}</span>
                </div>
                <PieceMoveGrid type={role.id} />
                <p className="text-xs text-center text-amber-800/80 dark:text-slate-300/80">
                  {t(`chess_move_${role.id === "k" ? "king" : role.id === "q" ? "queen" : role.id === "r" ? "rook" : role.id === "b" ? "bishop" : role.id === "n" ? "knight" : "pawn"}`)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400 mr-2" />
              = {t("chess_hint_body")}
            </p>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!pendingPromotion} onClose={() => setPendingPromotion(null)} size="sm">
        <div className="p-5">
          <h2 className="text-xl font-bold text-amber-900 dark:text-white mb-4 text-center">{t("chess_promotion_title")}</h2>
          <div className="grid grid-cols-4 gap-3">
            {(["q", "r", "b", "n"] as const).map((pieceType) => {
              const skin = getPieceSkin(pieceType);
              return (
                <button
                  key={pieceType}
                  onClick={() => handlePromotion(pieceType)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="relative">
                    <img
                      src={getSpritePath(skin.baseUnitId || skin.unitId, skin.rarity)}
                      alt={pieceType}
                      className="w-12 h-12 object-contain"
                    />
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white/90 text-amber-900 text-sm font-bold flex items-center justify-center shadow">
                      {getPieceSymbol(pieceType, "w")}
                    </span>
                  </div>
                  <span className="text-xs text-amber-900/80 dark:text-slate-300">
                    {t(PIECE_ROLES.find((r) => r.id === pieceType)?.labelKey || "")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Stage Result Modal */}
      <Modal isOpen={showStageResult && !!stageResult} onClose={() => {}} size="md">
        <div className="p-6 text-center">
          {stageResult === "win" ? (
            <>
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">{t("chess_victory")}</h2>
              <p className="text-lg text-gray-600 mb-4">{t("chess_stage_cleared")}</p>
              {currentStage && !clearedChessStages.includes(currentStage.id) && (
                <div className="bg-yellow-100 rounded-lg p-3 mb-4">
                  <span className="text-yellow-800 font-bold">+{currentStage.reward.coins} 🪙</span>
                </div>
              )}
            </>
          ) : stageResult === "timeout" ? (
            <>
              <div className="text-6xl mb-4">⏰</div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">{t("chess_time_up")}</h2>
              <p className="text-lg text-gray-600 mb-4">{t("chess_defeat")}</p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">😢</div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">{t("chess_defeat")}</h2>
              <p className="text-lg text-gray-600 mb-4">{t("result_encourage")}</p>
            </>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setShowStageResult(false);
                handleReset();
              }}
              className="btn btn-secondary px-6 py-3"
            >
              🔄 {t("retry")}
            </button>
            <button
              onClick={() => router.push("/chess/stages")}
              className="btn btn-primary px-6 py-3"
            >
              📋 {t("result_select_stage")}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}

export default function ChessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="animate-spin text-4xl">♟️</div>
        </main>
      }
    >
      <ChessContent />
    </Suspense>
  );
}
