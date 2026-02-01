import Phaser from "phaser";
import type { UnitState, PlayerState } from "@/lib/colyseus/types";

// ============================================
// NetworkManager - Phaser用ネットワーク状態管理
// ============================================

export interface NetworkState {
  phase: string;
  countdown: number;
  gameTime: number;
  stageLength: number;
  mySessionId: string | null;
  mySide: 'player1' | 'player2' | null;
  myPlayer: PlayerState | null;
  opponent: PlayerState | null;
  units: Map<string, UnitState>;
  winnerId: string | null;
  winReason: string | null;
  gameSpeed: number;
  speedVotes: Map<string, boolean>;
}

export class NetworkManager extends Phaser.Events.EventEmitter {
  private state: NetworkState;

  // イベント定義
  static readonly Events = {
    PHASE_CHANGED: 'phase_changed',
    PLAYER_UPDATED: 'player_updated',
    UNIT_ADDED: 'unit_added',
    UNIT_UPDATED: 'unit_updated',
    UNIT_REMOVED: 'unit_removed',
    GAME_OVER: 'game_over'
  };

  constructor() {
    super();
    this.state = {
      phase: 'waiting',
      countdown: 3,
      gameTime: 0,
      stageLength: 1200,
      mySessionId: null,
      mySide: null,
      myPlayer: null,
      opponent: null,
      units: new Map(),
      winnerId: null,
      winReason: null,
      gameSpeed: 1,
      speedVotes: new Map()
    };
  }

  /**
   * セッション情報を設定
   */
  setSession(sessionId: string, mySide: 'player1' | 'player2' | null): void {
    this.state.mySessionId = sessionId;
    this.state.mySide = mySide;
  }

  /**
   * フェーズ更新
   */
  setPhase(phase: string): void {
    const oldPhase = this.state.phase;
    if (oldPhase === phase) return;
    this.state.phase = phase;
    this.emit(NetworkManager.Events.PHASE_CHANGED, phase, oldPhase);
  }

  /**
   * ゲーム時間更新
   */
  setGameTime(time: number): void {
    this.state.gameTime = time;
  }

  /**
   * カウントダウン更新
   */
  setCountdown(countdown: number): void {
    this.state.countdown = countdown;
  }

  /**
   * ステージ長更新
   */
  setStageLength(length: number): void {
    this.state.stageLength = length;
  }

  /**
   * ゲーム速度更新
   */
  setGameSpeed(speed: number): void {
    if (typeof speed === 'number' && speed > 0) {
      this.state.gameSpeed = speed;
    }
  }

  /**
   * 速度投票更新
   */
  setSpeedVotes(votes: Record<string, boolean> | Map<string, boolean>): void {
    if (votes instanceof Map) {
      this.state.speedVotes = new Map(votes);
      return;
    }
    const next = new Map<string, boolean>();
    if (votes && typeof votes === 'object') {
      Object.entries(votes).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          next.set(key, value);
        }
      });
    }
    this.state.speedVotes = next;
  }

  /**
   * プレイヤー情報更新
   */
  updatePlayer(player: PlayerState, isMyPlayer: boolean): void {
    if (isMyPlayer) {
      this.state.myPlayer = player;
    } else {
      this.state.opponent = player;
    }
    this.emit(NetworkManager.Events.PLAYER_UPDATED, player, isMyPlayer);
  }

  /**
   * ユニット追加
   */
  addUnit(unit: UnitState): void {
    this.state.units.set(unit.instanceId, unit);
    this.emit(NetworkManager.Events.UNIT_ADDED, unit);
  }

  /**
   * ユニット更新
   */
  updateUnit(unit: UnitState): void {
    this.state.units.set(unit.instanceId, unit);
    this.emit(NetworkManager.Events.UNIT_UPDATED, unit);
  }

  /**
   * ユニット削除
   */
  removeUnit(instanceId: string): void {
    const unit = this.state.units.get(instanceId);
    if (unit) {
      this.state.units.delete(instanceId);
      this.emit(NetworkManager.Events.UNIT_REMOVED, unit);
    }
  }

  /**
   * ゲーム終了
   */
  setWinner(winnerId: string, reason: string): void {
    if (this.state.winnerId === winnerId && this.state.winReason === reason) {
      return;
    }
    this.state.winnerId = winnerId;
    this.state.winReason = reason;
    const isWinner = winnerId === this.state.mySessionId;
    this.emit(NetworkManager.Events.GAME_OVER, isWinner, reason);
  }

  // ============================================
  // Getters
  // ============================================

  getState(): NetworkState {
    return this.state;
  }

  getPhase(): string {
    return this.state.phase;
  }

  getMyPlayer(): PlayerState | null {
    return this.state.myPlayer;
  }

  getOpponent(): PlayerState | null {
    return this.state.opponent;
  }

  getMySide(): 'player1' | 'player2' | null {
    return this.state.mySide;
  }

  getMySessionId(): string | null {
    return this.state.mySessionId;
  }

  getUnit(instanceId: string): UnitState | undefined {
    return this.state.units.get(instanceId);
  }

  getAllUnits(): UnitState[] {
    return Array.from(this.state.units.values());
  }

  getUnitsForSide(side: 'player1' | 'player2'): UnitState[] {
    return this.getAllUnits().filter(u => u.side === side);
  }

  getStageLength(): number {
    return this.state.stageLength;
  }

  getGameSpeed(): number {
    return this.state.gameSpeed;
  }

  getSpeedVotes(): Map<string, boolean> {
    return this.state.speedVotes;
  }

  isPlaying(): boolean {
    return this.state.phase === 'playing';
  }

  /**
   * リセット
   */
  reset(): void {
    this.state = {
      phase: 'waiting',
      countdown: 3,
      gameTime: 0,
      stageLength: 1200,
      mySessionId: null,
      mySide: null,
      myPlayer: null,
      opponent: null,
      units: new Map(),
      winnerId: null,
      winReason: null,
      gameSpeed: 1,
      speedVotes: new Map()
    };
  }
}
