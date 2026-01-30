import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Database型を使用してSupabaseクライアントを作成
// これにより、DBクエリの型安全性が向上
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 便利な型エイリアス
export type DbPlayer = Database["public"]["Tables"]["players"]["Row"];
export type DbPlayerData = Database["public"]["Tables"]["player_data"]["Row"];
export type DbRankings = Database["public"]["Tables"]["rankings"]["Row"];
export type DbPlayerInsert = Database["public"]["Tables"]["players"]["Insert"];
export type DbPlayerDataInsert = Database["public"]["Tables"]["player_data"]["Insert"];
export type DbPlayerDataUpdate = Database["public"]["Tables"]["player_data"]["Update"];
