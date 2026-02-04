// ============================================
// Colyseus Client Type Definitions
// ============================================

/**
 * サーバーから同期される状態の型
 * (Schemaの構造を反映)
 */

export interface UnitState {
  instanceId: string;
  definitionId: string;
  side: 'player1' | 'player2';
  x: number;
  hp: number;
  maxHp: number;
  state: 'SPAWN' | 'WALK' | 'ATTACK_WINDUP' | 'ATTACK_COOLDOWN' | 'HITSTUN' | 'DIE';
  stateTimer: number;
  targetId: string;
  width?: number;  // ユニットの幅（サーバーから同期）
}

export interface PlayerState {
  odeyoId: string;
  sessionId: string;
  displayName: string;
  cost: number;
  maxCost: number;
  costLevel: number;
  castleHp: number;
  maxCastleHp: number;
  ready: boolean;
  deck: string[];
  side?: 'player1' | 'player2';
}

export interface BattleRoomState {
  phase: 'waiting' | 'countdown' | 'playing' | 'finished';
  gameTime: number;
  countdown: number;
  stageLength: number;
  players: Map<string, PlayerState>;
  units: Map<string, UnitState>;
  winnerId: string;
  winReason: string;
  gameSpeed?: number;
  speedVotes?: Record<string, boolean>;
}

/**
 * クライアントからサーバーへのメッセージ
 */
export type ClientMessage =
  | { type: 'ready' }
  | { type: 'summon'; unitId: string }
  | { type: 'upgrade_cost' };

/**
 * サーバーからクライアントへのメッセージ
 */
export interface ServerErrorMessage {
  code: string;
  message: string;
}

/**
 * ルーム参加オプション
 */
export interface JoinOptions {
  odeyoId?: string;
  displayName?: string;
  deck?: string[];
}

/**
 * ロビーに表示される部屋情報
 */
export interface LobbyRoom {
  roomId: string;
  hostName: string;
  hostDeckPreview: string[];  // 公開されているデッキの一部
  createdAt: number;
}

/**
 * 接続状態
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'lobby'       // ロビー画面
  | 'waiting'     // 部屋で対戦相手を待機中
  | 'countdown'
  | 'playing'
  | 'finished'
  | 'error';
