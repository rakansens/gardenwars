import * as Colyseus from "colyseus.js";
import type { JoinOptions, BattleRoomState, UnitState, PlayerState } from "./types";

// ============================================
// Colyseus Client Singleton
// ============================================

// 環境変数からサーバーURLを取得
// Renderではポート番号を含めない！
const COLYSEUS_URL = process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:2567";
// REST API用のHTTP URL
const getHttpUrl = () => {
  const wsUrl = COLYSEUS_URL;
  return wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
};

// ロビーに表示される部屋情報
export interface LobbyRoom {
  roomId: string;
  hostName: string;
  hostDeckPreview: string[];  // 公開されているデッキの一部
  createdAt: number;
}

class ColyseusClient {
  private client: Colyseus.Client;
  private room: Colyseus.Room<BattleRoomState> | null = null;
  private reconnectionToken: string | null = null;

  constructor() {
    this.client = new Colyseus.Client(COLYSEUS_URL);
  }

  /**
   * ロビーの部屋一覧を取得
   */
  async fetchRooms(): Promise<LobbyRoom[]> {
    try {
      const response = await fetch(`${getHttpUrl()}/rooms`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      console.log("[Colyseus] Fetched rooms:", data.rooms?.length || 0);
      return data.rooms || [];
    } catch (error) {
      console.error("[Colyseus] Failed to fetch rooms:", error);
      return [];
    }
  }

  /**
   * バトルルームに参加（クイックマッチ - 自動マッチング）
   */
  async joinBattle(options: JoinOptions): Promise<Colyseus.Room<BattleRoomState>> {
    try {
      // joinOrCreate: 空いているルームに参加、なければ新規作成
      this.room = await this.client.joinOrCreate<BattleRoomState>("battle", {
        ...options,
        quickMatch: true
      });
      this.reconnectionToken = this.room.reconnectionToken;
      console.log("[Colyseus] Joined room (quick match):", this.room.roomId);
      return this.room;
    } catch (error) {
      console.error("[Colyseus] Failed to join room:", error);
      throw error;
    }
  }

  /**
   * 新しい部屋を作成（ロビーで待機）
   */
  async createRoom(options: JoinOptions): Promise<Colyseus.Room<BattleRoomState>> {
    try {
      // create: 必ず新規ルームを作成
      this.room = await this.client.create<BattleRoomState>("battle", {
        ...options,
        quickMatch: false
      });
      this.reconnectionToken = this.room.reconnectionToken;
      console.log("[Colyseus] Created room:", this.room.roomId);
      return this.room;
    } catch (error) {
      console.error("[Colyseus] Failed to create room:", error);
      throw error;
    }
  }

  /**
   * 特定の部屋に参加（ロビーから選択）
   */
  async joinRoom(roomId: string, options: JoinOptions): Promise<Colyseus.Room<BattleRoomState>> {
    try {
      this.room = await this.client.joinById<BattleRoomState>(roomId, options);
      this.reconnectionToken = this.room.reconnectionToken;
      console.log("[Colyseus] Joined room by ID:", this.room.roomId);
      return this.room;
    } catch (error) {
      console.error("[Colyseus] Failed to join room by ID:", error);
      throw error;
    }
  }

  /**
   * 再接続を試みる
   */
  async reconnect(): Promise<Colyseus.Room<BattleRoomState> | null> {
    if (!this.reconnectionToken) {
      console.warn("[Colyseus] No reconnection token available");
      return null;
    }

    try {
      this.room = await this.client.reconnect<BattleRoomState>(this.reconnectionToken);
      console.log("[Colyseus] Reconnected to room:", this.room.roomId);
      return this.room;
    } catch (error) {
      console.error("[Colyseus] Failed to reconnect:", error);
      this.reconnectionToken = null;
      return null;
    }
  }

  /**
   * ルームから退出
   */
  async leave(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.room = null;
      this.reconnectionToken = null;
    }
  }

  /**
   * 現在のルームを取得
   */
  getRoom(): Colyseus.Room<BattleRoomState> | null {
    return this.room;
  }

  /**
   * ローカルのルーム参照をクリア（ネットワーク呼び出しなし）
   */
  clearRoom(): void {
    this.room = null;
    this.reconnectionToken = null;
  }

  /**
   * 接続中かチェック
   */
  isConnected(): boolean {
    return this.room !== null;
  }

  // ============================================
  // Message Senders
  // ============================================

  /**
   * 準備完了を送信
   */
  sendReady(): void {
    if (this.room) {
      this.room.send("ready");
    }
  }

  /**
   * ユニット召喚を送信
   */
  sendSummon(unitId: string): void {
    if (this.room) {
      this.room.send("summon", { unitId });
    }
  }

  /**
   * コストアップグレードを送信
   */
  sendUpgradeCost(): void {
    if (this.room) {
      this.room.send("upgrade_cost");
    }
  }

  /**
   * 速度変更リクエストを送信（2x合意用）
   */
  sendSpeedVote(enabled: boolean): void {
    if (this.room) {
      this.room.send("speed_vote", { enabled });
    }
  }
}

// シングルトンエクスポート
export const colyseusClient = new ColyseusClient();
export { Colyseus };
