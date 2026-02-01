"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import unitsData from "@/data/units";
import type { Rarity, UnitDefinition } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { getSpritePath } from "@/lib/sprites";
import { ChessGame, ChessMove, ChessPieceType } from "@/lib/chess";
import Modal from "@/components/ui/Modal";
import RarityFrame from "@/components/ui/RarityFrame";

type PieceRole = "k" | "q" | "r" | "b" | "n" | "p";
type ChessAiLevel = "easy" | "normal" | "hard";

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

export default function ChessPage() {
  const { t } = useLanguage();
  const { selectedTeam, unitInventory, isLoaded } = usePlayerData();
  const gameRef = useRef<ChessGame>(new ChessGame());
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [legalMoves, setLegalMoves] = useState<ChessMove[]>([]);
  const [activeRole, setActiveRole] = useState<PieceRole | null>(null);
  const [pieceSkins, setPieceSkins] = useState<Record<PieceRole, PieceSkin> | null>(null);
  const [aiLevel, setAiLevel] = useState<ChessAiLevel>("normal");
  const [aiThinking, setAiThinking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
        const parsed = JSON.parse(stored) as Record<PieceRole, string>;
        const next: Record<PieceRole, PieceSkin> = {} as Record<PieceRole, PieceSkin>;
        let valid = true;
        for (const role of PIECE_ROLES) {
          const unitId = parsed[role.id];
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
    } catch {}

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

  const board = gameRef.current.getBoard();
  const status = gameRef.current.getStatus();
  const turn = gameRef.current.getTurn();
  const lastMove = gameRef.current.getLastMove();

  const legalMoveTargets = useMemo(() => {
    const map = new Map<string, ChessMove>();
    legalMoves.forEach((move) => {
      map.set(`${move.to.x}-${move.to.y}`, move);
    });
    return map;
  }, [legalMoves]);

  const handleSquareClick = (x: number, y: number) => {
    if (status.checkmate || status.stalemate) return;
    if (turn !== "w") return;
    const piece = board[y][x];
    if (selected) {
      const move = legalMoveTargets.get(`${x}-${y}`);
      if (move) {
        const promotion: ChessPieceType = "q";
        const result = gameRef.current.move(selected.x, selected.y, x, y, promotion);
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

  const handleReset = () => {
    gameRef.current.reset();
    setSelected(null);
    setLegalMoves([]);
    setVersion((v) => v + 1);
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
    if (status.checkmate || status.stalemate) return;
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
      } else {
        const values: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
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
      }

      gameRef.current.move(selectedMove.from.x, selectedMove.from.y, selectedMove.to.x, selectedMove.to.y);
      setSelected(null);
      setLegalMoves([]);
      setVersion((v) => v + 1);
      setAiThinking(false);
    }, aiLevel === "easy" ? 300 : aiLevel === "normal" ? 450 : 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [turn, aiLevel, status.checkmate, status.stalemate, version]);

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

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="btn btn-secondary text-sm py-2 px-3">
          ← {t("back_to_home")}
        </Link>
        <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">♟️ {t("menu_chess")}</h1>
        <button onClick={handleReset} className="btn btn-primary text-sm py-2 px-3">
          {t("chess_reset")}
        </button>
      </div>

      <div className="text-center mb-6 text-amber-900/70 dark:text-gray-400">
        <p>{t("chess_subtitle")}</p>
        <p className="text-sm mt-1">
          {turn === "w" ? t("chess_turn_white") : t("chess_turn_black")}
          {status.inCheck && !status.checkmate && ` • ${t("chess_check")}`}
          {aiThinking && turn === "b" && ` • ${t("chess_ai_thinking")}`}
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
        <div className="card">
          <div className="grid grid-cols-8 border-4 border-amber-200 rounded-2xl overflow-hidden shadow-lg">
            {board.map((row, y) =>
              row.map((piece, x) => {
                const isLight = (x + y) % 2 === 0;
                const isSelected = selected?.x === x && selected?.y === y;
                const legalMove = legalMoveTargets.has(`${x}-${y}`);
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
                    } ${isSelected ? "ring-4 ring-emerald-400" : ""} ${isLast ? "outline outline-2 outline-orange-300" : ""}`}
                  >
                    {legalMove && (
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
    </main>
  );
}
