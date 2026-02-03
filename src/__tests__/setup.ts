import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
    savePlayerData: vi.fn().mockResolvedValue(true),
    getPlayerData: vi.fn().mockResolvedValue(null),
    toFrontendPlayerData: vi.fn(),
    toSupabaseSaveData: vi.fn((data) => data),
    syncRankingStats: vi.fn().mockResolvedValue(undefined),
    // Server Authority RPCs
    incrementBattleStatsRpc: vi.fn().mockResolvedValue({ success: true }),
    incrementGachaCountRpc: vi.fn().mockResolvedValue({ success: true }),
    incrementGardenVisitsRpc: vi.fn().mockResolvedValue({ success: true }),
    executeGardenRewardRpc: vi.fn().mockResolvedValue({ success: true, coins: 1000 }),
    INITIAL_COINS: 1000,
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
    useAuth: vi.fn(() => ({
        isAuthenticated: false,
        playerId: null,
        player: null,
    })),
}));

// Mock LanguageContext
vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: vi.fn(() => ({
        t: (key: string) => key,
        language: 'ja',
    })),
}));
