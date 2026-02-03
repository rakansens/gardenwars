import * as Colyseus from "colyseus.js";

const COLYSEUS_URL = process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:2567";
const getHttpUrl = () => COLYSEUS_URL.replace("wss://", "https://").replace("ws://", "http://");

export interface TradeLobbyRoom {
  roomId: string;
  hostName: string;
  createdAt: number;
  hostId?: string;
}

export interface TradeJoinOptions {
  displayName?: string;
  playerId?: string;
  quickMatch?: boolean;
}

export interface TradeOfferPayload {
  units: Record<string, number>;
  coins: number;
}

export interface TradeResult<T> {
  data: T | null;
  error: string | null;
}

class TradeClient {
  private client: Colyseus.Client;
  private room: Colyseus.Room | null = null;
  private reconnectionToken: string | null = null;

  constructor() {
    this.client = new Colyseus.Client(COLYSEUS_URL);
  }

  async fetchRooms(): Promise<TradeResult<TradeLobbyRoom[]>> {
    try {
      const response = await fetch(`${getHttpUrl()}/trade/rooms`);
      if (!response.ok) {
        const errorMsg = `HTTP error: ${response.status}`;
        console.error("[Trade] Failed to fetch rooms:", errorMsg);
        return { data: [], error: errorMsg };
      }
      const data = await response.json();
      return { data: data.rooms || [], error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to fetch rooms";
      console.error("[Trade] Failed to fetch rooms:", error);
      return { data: [], error: errorMsg };
    }
  }

  async quickMatch(options: TradeJoinOptions): Promise<TradeResult<Colyseus.Room>> {
    try {
      this.room = await this.client.joinOrCreate("trade", {
        ...options,
        quickMatch: true,
      });
      this.reconnectionToken = this.room.reconnectionToken;
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to quick match";
      console.error("[Trade] Failed to quick match:", error);
      return { data: null, error: errorMsg };
    }
  }

  async createRoom(options: TradeJoinOptions): Promise<TradeResult<Colyseus.Room>> {
    try {
      this.room = await this.client.create("trade", {
        ...options,
        quickMatch: false,
      });
      this.reconnectionToken = this.room.reconnectionToken;
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to create room";
      console.error("[Trade] Failed to create room:", error);
      return { data: null, error: errorMsg };
    }
  }

  async joinRoom(roomId: string, options: TradeJoinOptions): Promise<TradeResult<Colyseus.Room>> {
    try {
      this.room = await this.client.joinById(roomId, options);
      this.reconnectionToken = this.room.reconnectionToken;
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to join room";
      console.error("[Trade] Failed to join room:", error);
      return { data: null, error: errorMsg };
    }
  }

  async reconnect(): Promise<TradeResult<Colyseus.Room>> {
    if (!this.reconnectionToken) {
      return { data: null, error: "No reconnection token available" };
    }
    try {
      this.room = await this.client.reconnect(this.reconnectionToken);
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to reconnect";
      console.error("[Trade] Failed to reconnect:", error);
      this.reconnectionToken = null;
      return { data: null, error: errorMsg };
    }
  }

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
      console.error("[Trade] Failed to leave room:", error);
      return { success: false, error: errorMsg };
    }
  }

  getRoom(): Colyseus.Room | null {
    return this.room;
  }

  clearRoom(): void {
    this.room = null;
    this.reconnectionToken = null;
  }

  sendOffer(payload: TradeOfferPayload): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("offer_update", payload);
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send offer";
      console.error("[Trade] Failed to send offer:", error);
      return { success: false, error: errorMsg };
    }
  }

  sendReady(ready: boolean): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("offer_ready", { ready });
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send ready";
      console.error("[Trade] Failed to send ready:", error);
      return { success: false, error: errorMsg };
    }
  }

  sendConfirm(): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("trade_confirm");
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to confirm trade";
      console.error("[Trade] Failed to confirm trade:", error);
      return { success: false, error: errorMsg };
    }
  }

  sendCancel(reason?: string): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("trade_cancel", { reason });
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to cancel trade";
      console.error("[Trade] Failed to cancel trade:", error);
      return { success: false, error: errorMsg };
    }
  }
}

export const tradeClient = new TradeClient();
export { Colyseus };
