"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
    registerPlayer,
    loginWithPIN,
    updatePlayerName,
    type FullPlayerData,
    type LocalStorageData,
} from "@/lib/supabase";

const PIN_STORAGE_KEY = "gardenwars_pin";
const PLAYER_DATA_STORAGE_KEY = "gardenwars_player";
const CLEARED_STAGES_KEY = "clearedStages";
const GARDEN_SELECTION_KEY = "garden_selection";

// Read existing localStorage data for migration
function getLocalStorageData(): LocalStorageData | undefined {
    if (typeof window === "undefined") return undefined;

    try {
        const saved = localStorage.getItem(PLAYER_DATA_STORAGE_KEY);

        // Also read from separate keys
        let clearedStages: string[] | undefined;
        let gardenUnits: string[] | undefined;

        try {
            const clearedStagesRaw = localStorage.getItem(CLEARED_STAGES_KEY);
            if (clearedStagesRaw) {
                const parsed = JSON.parse(clearedStagesRaw);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
                    clearedStages = parsed;
                } else {
                    console.warn("clearedStages has invalid structure, skipping");
                }
            }
        } catch (e) {
            console.warn("Failed to parse clearedStages from localStorage:", e);
        }

        try {
            const gardenRaw = localStorage.getItem(GARDEN_SELECTION_KEY);
            if (gardenRaw) {
                const parsed = JSON.parse(gardenRaw);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
                    gardenUnits = parsed;
                } else {
                    console.warn("gardenUnits has invalid structure, skipping");
                }
            }
        } catch (e) {
            console.warn("Failed to parse gardenUnits from localStorage:", e);
        }

        if (saved) {
            const parsed = JSON.parse(saved);

            // Validate parsed data structure
            const isValidCoins = typeof parsed.coins === "number" || parsed.coins === undefined;
            const isValidInventory = parsed.unitInventory === undefined ||
                (typeof parsed.unitInventory === "object" && parsed.unitInventory !== null);
            const isValidTeam = parsed.selectedTeam === undefined || Array.isArray(parsed.selectedTeam);
            const isValidLoadouts = parsed.loadouts === undefined || Array.isArray(parsed.loadouts);

            if (!isValidCoins || !isValidInventory || !isValidTeam || !isValidLoadouts) {
                console.warn("Player data has invalid structure, skipping migration");
                return undefined;
            }

            // Only migrate if there's meaningful data
            const hasData =
                (parsed.coins && parsed.coins > 0) ||
                (parsed.unitInventory && Object.keys(parsed.unitInventory).length > 0) ||
                (parsed.selectedTeam && parsed.selectedTeam.length > 0) ||
                (clearedStages && clearedStages.length > 0) ||
                (gardenUnits && gardenUnits.length > 0);

            if (hasData) {
                return {
                    coins: parsed.coins,
                    unitInventory: parsed.unitInventory,
                    selectedTeam: parsed.selectedTeam,
                    loadouts: parsed.loadouts,
                    activeLoadoutIndex: parsed.activeLoadoutIndex,
                    shopItems: parsed.shopItems,
                    clearedStages: clearedStages,
                    gardenUnits: gardenUnits,
                };
            }
        } else if (clearedStages || gardenUnits) {
            // Even if main data is empty, migrate cleared stages and garden if they exist
            return {
                clearedStages,
                gardenUnits,
            };
        }
    } catch (e) {
        console.error("Failed to read localStorage for migration:", e);
    }
    return undefined;
}

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

interface AuthContextType {
    status: AuthStatus;
    player: FullPlayerData | null;
    playerId: string | null;
    playerName: string | null;
    register: (name: string) => Promise<{ success: boolean; pin?: string; error?: string; migrated?: boolean }>;
    login: (pin: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    refreshPlayer: () => Promise<void>;
    updateName: (newName: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>("loading");
    const [player, setPlayer] = useState<FullPlayerData | null>(null);

    // Check for existing PIN on mount
    useEffect(() => {
        const checkExistingPIN = async () => {
            let storedPIN: string | null = null;
            try {
                storedPIN = localStorage.getItem(PIN_STORAGE_KEY);
            } catch (e) {
                console.error("localStorage access failed:", e);
                setStatus("unauthenticated");
                return;
            }

            if (!storedPIN) {
                setStatus("unauthenticated");
                return;
            }

            try {
                const playerData = await loginWithPIN(storedPIN);
                if (playerData) {
                    setPlayer(playerData);
                    setStatus("authenticated");
                } else {
                    // loginWithPIN returned null without throwing = PIN is genuinely invalid
                    // (e.g., player deleted, PIN changed)
                    console.warn("Auto-login: PIN not found in database, removing stored PIN");
                    try { localStorage.removeItem(PIN_STORAGE_KEY); } catch { }
                    setStatus("unauthenticated");
                }
            } catch (err) {
                // Network error, Supabase timeout, etc. = transient failure
                // DO NOT remove PIN — it may still be valid, retry on next page load
                console.error("Auto-login failed (transient error, keeping PIN for retry):", err);
                setStatus("unauthenticated");
            }
        };

        checkExistingPIN();
    }, []);

    // Register new player (with localStorage data migration)
    const register = useCallback(async (name: string): Promise<{ success: boolean; pin?: string; error?: string; migrated?: boolean }> => {
        if (!name.trim()) {
            return { success: false, error: "名前を入力してください" };
        }

        if (name.length > 20) {
            return { success: false, error: "名前は20文字以内にしてください" };
        }

        try {
            // Check for existing localStorage data to migrate
            const localData = getLocalStorageData();
            const hasMigrationData = localData !== undefined;

            // Register with optional migration data
            const result = await registerPlayer(name.trim(), localData);
            localStorage.setItem(PIN_STORAGE_KEY, result.pin);
            setPlayer(result.player);
            setStatus("authenticated");
            return { success: true, pin: result.pin, migrated: hasMigrationData };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "登録に失敗しました";
            return { success: false, error: errorMessage };
        }
    }, []);

    // Login with PIN
    const login = useCallback(async (pin: string): Promise<{ success: boolean; error?: string }> => {
        if (pin.length !== 6) {
            return { success: false, error: "6桁の番号を入力してください" };
        }

        try {
            const playerData = await loginWithPIN(pin);
            if (playerData) {
                localStorage.setItem(PIN_STORAGE_KEY, pin);
                setPlayer(playerData);
                setStatus("authenticated");
                return { success: true };
            } else {
                return { success: false, error: "番号が見つかりません" };
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "ログインに失敗しました";
            return { success: false, error: errorMessage };
        }
    }, []);

    // Logout
    const logout = useCallback(() => {
        localStorage.removeItem(PIN_STORAGE_KEY);
        setPlayer(null);
        setStatus("unauthenticated");
    }, []);

    // Refresh player data
    const refreshPlayer = useCallback(async () => {
        let storedPIN: string | null = null;
        try {
            storedPIN = localStorage.getItem(PIN_STORAGE_KEY);
        } catch {
            return;
        }
        if (!storedPIN) return;

        try {
            const playerData = await loginWithPIN(storedPIN);
            if (playerData) {
                setPlayer(playerData);
            }
        } catch (err) {
            console.error("Failed to refresh player data:", err);
        }
    }, []);

    // Update player name
    const updateName = useCallback(async (newName: string): Promise<{ success: boolean; error?: string }> => {
        if (!player) {
            return { success: false, error: "ログインしていません" };
        }

        const trimmedName = newName.trim();
        if (!trimmedName) {
            return { success: false, error: "名前を入力してください" };
        }

        if (trimmedName.length > 20) {
            return { success: false, error: "名前は20文字以内にしてください" };
        }

        try {
            const success = await updatePlayerName(player.id, trimmedName);
            if (success) {
                // Update local state
                setPlayer(prev => prev ? { ...prev, name: trimmedName } : null);
                return { success: true };
            } else {
                return { success: false, error: "名前の変更に失敗しました" };
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "名前の変更に失敗しました";
            return { success: false, error: errorMessage };
        }
    }, [player]);

    return (
        <AuthContext.Provider
            value={{
                status,
                player,
                playerId: player?.id || null,
                playerName: player?.name || null,
                register,
                login,
                logout,
                refreshPlayer,
                updateName,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
