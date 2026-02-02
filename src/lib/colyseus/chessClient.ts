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

class ChessClient {
  private client: Colyseus.Client;
  private room: Colyseus.Room | null = null;
  private reconnectionToken: string | null = null;

  constructor() {
    this.client = new Colyseus.Client(COLYSEUS_URL);
  }

  async fetchRooms(): Promise<ChessLobbyRoom[]> {
    try {
      const response = await fetch(`${getHttpUrl()}/chess/rooms`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      return data.rooms || [];
    } catch (error) {
      console.error("[Chess] Failed to fetch rooms:", error);
      return [];
    }
  }

  async quickMatch(options: ChessJoinOptions): Promise<Colyseus.Room> {
    this.room = await this.client.joinOrCreate("chess", {
      ...options,
      quickMatch: true,
    });
    this.reconnectionToken = this.room.reconnectionToken;
    return this.room;
  }

  async createRoom(options: ChessJoinOptions): Promise<Colyseus.Room> {
    this.room = await this.client.create("chess", {
      ...options,
      quickMatch: false,
    });
    this.reconnectionToken = this.room.reconnectionToken;
    return this.room;
  }

  async joinRoom(roomId: string, options: ChessJoinOptions): Promise<Colyseus.Room> {
    this.room = await this.client.joinById(roomId, options);
    this.reconnectionToken = this.room.reconnectionToken;
    return this.room;
  }

  async reconnect(): Promise<Colyseus.Room | null> {
    if (!this.reconnectionToken) return null;
    try {
      this.room = await this.client.reconnect(this.reconnectionToken);
      return this.room;
    } catch (error) {
      console.error("[Chess] Failed to reconnect:", error);
      this.reconnectionToken = null;
      return null;
    }
  }

  async leave(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.room = null;
      this.reconnectionToken = null;
    }
  }

  getRoom(): Colyseus.Room | null {
    return this.room;
  }

  clearRoom(): void {
    this.room = null;
    this.reconnectionToken = null;
  }

  sendMove(payload: { from: { x: number; y: number }; to: { x: number; y: number }; promotion?: string }): void {
    if (this.room) {
      this.room.send("move", payload);
    }
  }

  sendResign(): void {
    if (this.room) {
      this.room.send("resign");
    }
  }

  requestSync(): void {
    if (this.room) {
      this.room.send("sync_request");
    }
  }
}

export const chessClient = new ChessClient();
export { Colyseus };
