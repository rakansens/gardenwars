import * as Colyseus from "colyseus.js";
import type { JoinOptions, BattleRoomState, UnitState, PlayerState } from "./types";

// ============================================
// Colyseus Client Singleton
// ============================================

// Custom error class for Colyseus operations
export class ColyseusError extends Error {
  constructor(
    message: string,
    public code: string = "COLYSEUS_ERROR",
    public originalError?: unknown
  ) {
    super(message);
    this.name = "ColyseusError";
  }
}

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

// Result type for operations that can fail
export interface ColyseusResult<T> {
  data: T | null;
  error: string | null;
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
  async fetchRooms(): Promise<ColyseusResult<LobbyRoom[]>> {
    try {
      const response = await fetch(`${getHttpUrl()}/rooms`);
      if (!response.ok) {
        const errorMsg = `HTTP error: ${response.status}`;
        console.error("[Colyseus] Failed to fetch rooms:", errorMsg);
        return { data: [], error: errorMsg };
      }
      const data = await response.json();
      console.log("[Colyseus] Fetched rooms:", data.rooms?.length || 0);
      return { data: data.rooms || [], error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to fetch rooms";
      console.error("[Colyseus] Failed to fetch rooms:", error);
      return { data: [], error: errorMsg };
    }
  }

  /**
   * バトルルームに参加（クイックマッチ - 自動マッチング）
   */
  async joinBattle(options: JoinOptions): Promise<ColyseusResult<Colyseus.Room<BattleRoomState>>> {
    try {
      // joinOrCreate: 空いているルームに参加、なければ新規作成
      this.room = await this.client.joinOrCreate<BattleRoomState>("battle", {
        ...options,
        quickMatch: true
      });
      this.reconnectionToken = this.room.reconnectionToken;
      console.log("[Colyseus] Joined room (quick match):", this.room.roomId);
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to join battle";
      console.error("[Colyseus] Failed to join room:", error);
      return { data: null, error: errorMsg };
    }
  }

  /**
   * 新しい部屋を作成（ロビーで待機）
   */
  async createRoom(options: JoinOptions): Promise<ColyseusResult<Colyseus.Room<BattleRoomState>>> {
    try {
      // create: 必ず新規ルームを作成
      this.room = await this.client.create<BattleRoomState>("battle", {
        ...options,
        quickMatch: false
      });
      this.reconnectionToken = this.room.reconnectionToken;
      console.log("[Colyseus] Created room:", this.room.roomId);
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to create room";
      console.error("[Colyseus] Failed to create room:", error);
      return { data: null, error: errorMsg };
    }
  }

  /**
   * 特定の部屋に参加（ロビーから選択）
   */
  async joinRoom(roomId: string, options: JoinOptions): Promise<ColyseusResult<Colyseus.Room<BattleRoomState>>> {
    try {
      this.room = await this.client.joinById<BattleRoomState>(roomId, options);
      this.reconnectionToken = this.room.reconnectionToken;
      console.log("[Colyseus] Joined room by ID:", this.room.roomId);
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to join room";
      console.error("[Colyseus] Failed to join room by ID:", error);
      return { data: null, error: errorMsg };
    }
  }

  /**
   * 再接続を試みる
   */
  async reconnect(): Promise<ColyseusResult<Colyseus.Room<BattleRoomState>>> {
    if (!this.reconnectionToken) {
      console.warn("[Colyseus] No reconnection token available");
      return { data: null, error: "No reconnection token available" };
    }

    try {
      this.room = await this.client.reconnect<BattleRoomState>(this.reconnectionToken);
      console.log("[Colyseus] Reconnected to room:", this.room.roomId);
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to reconnect";
      console.error("[Colyseus] Failed to reconnect:", error);
      this.reconnectionToken = null;
      return { data: null, error: errorMsg };
    }
  }

  /**
   * ルームから退出
   */
  async leave(): Promise<{ success: boolean; error: string | null }> {
    try {
      if (this.room) {
        await this.room.leave();
        this.room = null;
        this.reconnectionToken = null;
      }
      return { success: true, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to leave room";
      console.error("[Colyseus] Failed to leave room:", error);
      return { success: false, error: errorMsg };
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
  sendReady(): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("ready");
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send ready";
      console.error("[Colyseus] Failed to send ready:", error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * ユニット召喚を送信
   */
  sendSummon(unitId: string): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("summon", { unitId });
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send summon";
      console.error("[Colyseus] Failed to send summon:", error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * コストアップグレードを送信
   */
  sendUpgradeCost(): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("upgrade_cost");
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send upgrade cost";
      console.error("[Colyseus] Failed to send upgrade cost:", error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 速度変更リクエストを送信（2x合意用）
   */
  sendSpeedVote(enabled: boolean): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("speed_vote", { enabled });
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send speed vote";
      console.error("[Colyseus] Failed to send speed vote:", error);
      return { success: false, error: errorMsg };
    }
  }
}

// シングルトンエクスポート
export const colyseusClient = new ColyseusClient();
export { Colyseus };
