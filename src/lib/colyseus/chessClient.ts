import * as Colyseus from "colyseus.js";

const COLYSEUS_URL = process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:2567";
const getHttpUrl = () => COLYSEUS_URL.replace("wss://", "https://").replace("ws://", "http://");

export interface ChessLobbyRoom {
  roomId: string;
  hostName: string;
  createdAt: number;
}

export interface ChessJoinOptions {
  displayName?: string;
  quickMatch?: boolean;
}

// Result type for operations that can fail
export interface ChessResult<T> {
  data: T | null;
  error: string | null;
}

class ChessClient {
  private client: Colyseus.Client;
  private room: Colyseus.Room | null = null;
  private reconnectionToken: string | null = null;

  constructor() {
    this.client = new Colyseus.Client(COLYSEUS_URL);
  }

  async fetchRooms(): Promise<ChessResult<ChessLobbyRoom[]>> {
    try {
      const response = await fetch(`${getHttpUrl()}/chess/rooms`);
      if (!response.ok) {
        const errorMsg = `HTTP error: ${response.status}`;
        console.error("[Chess] Failed to fetch rooms:", errorMsg);
        return { data: [], error: errorMsg };
      }
      const data = await response.json();
      return { data: data.rooms || [], error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to fetch rooms";
      console.error("[Chess] Failed to fetch rooms:", error);
      return { data: [], error: errorMsg };
    }
  }

  async quickMatch(options: ChessJoinOptions): Promise<ChessResult<Colyseus.Room>> {
    try {
      this.room = await this.client.joinOrCreate("chess", {
        ...options,
        quickMatch: true,
      });
      this.reconnectionToken = this.room.reconnectionToken;
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to quick match";
      console.error("[Chess] Failed to quick match:", error);
      return { data: null, error: errorMsg };
    }
  }

  async createRoom(options: ChessJoinOptions): Promise<ChessResult<Colyseus.Room>> {
    try {
      this.room = await this.client.create("chess", {
        ...options,
        quickMatch: false,
      });
      this.reconnectionToken = this.room.reconnectionToken;
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to create room";
      console.error("[Chess] Failed to create room:", error);
      return { data: null, error: errorMsg };
    }
  }

  async joinRoom(roomId: string, options: ChessJoinOptions): Promise<ChessResult<Colyseus.Room>> {
    try {
      this.room = await this.client.joinById(roomId, options);
      this.reconnectionToken = this.room.reconnectionToken;
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to join room";
      console.error("[Chess] Failed to join room:", error);
      return { data: null, error: errorMsg };
    }
  }

  async reconnect(): Promise<ChessResult<Colyseus.Room>> {
    if (!this.reconnectionToken) {
      return { data: null, error: "No reconnection token available" };
    }
    try {
      this.room = await this.client.reconnect(this.reconnectionToken);
      return { data: this.room, error: null };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to reconnect";
      console.error("[Chess] Failed to reconnect:", error);
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
      console.error("[Chess] Failed to leave room:", error);
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

  sendMove(payload: { from: { x: number; y: number }; to: { x: number; y: number }; promotion?: string }): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("move", payload);
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send move";
      console.error("[Chess] Failed to send move:", error);
      return { success: false, error: errorMsg };
    }
  }

  sendResign(): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("resign");
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to send resign";
      console.error("[Chess] Failed to send resign:", error);
      return { success: false, error: errorMsg };
    }
  }

  requestSync(): { success: boolean; error: string | null } {
    try {
      if (this.room) {
        this.room.send("sync_request");
        return { success: true, error: null };
      }
      return { success: false, error: "Not connected to room" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to request sync";
      console.error("[Chess] Failed to request sync:", error);
      return { success: false, error: errorMsg };
    }
  }
}

export const chessClient = new ChessClient();
export { Colyseus };
