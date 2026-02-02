"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface AudioSettings {
    masterVolume: number;  // 0-1
    bgmVolume: number;     // 0-1
    sfxVolume: number;     // 0-1
    isMuted: boolean;
    bgmEnabled: boolean;
    sfxEnabled: boolean;
}

interface AudioContextType extends AudioSettings {
    setMasterVolume: (volume: number) => void;
    setBgmVolume: (volume: number) => void;
    setSfxVolume: (volume: number) => void;
    toggleMute: () => void;
    setBgmEnabled: (enabled: boolean) => void;
    setSfxEnabled: (enabled: boolean) => void;
    // Calculated volumes for use in game
    getEffectiveBgmVolume: () => number;
    getEffectiveSfxVolume: () => number;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const STORAGE_KEY = "gardenwars_audio_settings";

const DEFAULT_SETTINGS: AudioSettings = {
    masterVolume: 1.0,
    bgmVolume: 0.5,
    sfxVolume: 0.7,
    isMuted: false,
    bgmEnabled: true,
    sfxEnabled: true,
};

export function AudioProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load settings from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setSettings({
                    ...DEFAULT_SETTINGS,
                    ...parsed,
                });
            }
        } catch (error) {
            console.warn("Failed to load audio settings:", error);
        }
        setIsLoaded(true);
    }, []);

    // Save settings to localStorage whenever they change
    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            // Also update global audio settings for Phaser access
            if (typeof window !== "undefined") {
                (window as any).__GARDENWARS_AUDIO_SETTINGS__ = {
                    masterVolume: settings.masterVolume,
                    bgmVolume: settings.bgmVolume,
                    sfxVolume: settings.sfxVolume,
                    isMuted: settings.isMuted,
                    bgmEnabled: settings.bgmEnabled,
                    sfxEnabled: settings.sfxEnabled,
                    effectiveBgmVolume: settings.isMuted || !settings.bgmEnabled ? 0 : settings.masterVolume * settings.bgmVolume,
                    effectiveSfxVolume: settings.isMuted || !settings.sfxEnabled ? 0 : settings.masterVolume * settings.sfxVolume,
                };
            }
        } catch (error) {
            console.warn("Failed to save audio settings:", error);
        }
    }, [settings, isLoaded]);

    const setMasterVolume = useCallback((volume: number) => {
        setSettings(prev => ({ ...prev, masterVolume: Math.max(0, Math.min(1, volume)) }));
    }, []);

    const setBgmVolume = useCallback((volume: number) => {
        setSettings(prev => ({ ...prev, bgmVolume: Math.max(0, Math.min(1, volume)) }));
    }, []);

    const setSfxVolume = useCallback((volume: number) => {
        setSettings(prev => ({ ...prev, sfxVolume: Math.max(0, Math.min(1, volume)) }));
    }, []);

    const toggleMute = useCallback(() => {
        setSettings(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }, []);

    const setBgmEnabled = useCallback((enabled: boolean) => {
        setSettings(prev => ({ ...prev, bgmEnabled: enabled }));
    }, []);

    const setSfxEnabled = useCallback((enabled: boolean) => {
        setSettings(prev => ({ ...prev, sfxEnabled: enabled }));
    }, []);

    const getEffectiveBgmVolume = useCallback(() => {
        if (settings.isMuted || !settings.bgmEnabled) return 0;
        return settings.masterVolume * settings.bgmVolume;
    }, [settings]);

    const getEffectiveSfxVolume = useCallback(() => {
        if (settings.isMuted || !settings.sfxEnabled) return 0;
        return settings.masterVolume * settings.sfxVolume;
    }, [settings]);

    return (
        <AudioContext.Provider
            value={{
                ...settings,
                setMasterVolume,
                setBgmVolume,
                setSfxVolume,
                toggleMute,
                setBgmEnabled,
                setSfxEnabled,
                getEffectiveBgmVolume,
                getEffectiveSfxVolume,
            }}
        >
            {children}
        </AudioContext.Provider>
    );
}

export function useAudio() {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error("useAudio must be used within an AudioProvider");
    }
    return context;
}

// Helper function to get audio settings from global (for use in Phaser scenes)
export function getGlobalAudioSettings(): {
    masterVolume: number;
    bgmVolume: number;
    sfxVolume: number;
    isMuted: boolean;
    bgmEnabled: boolean;
    sfxEnabled: boolean;
    effectiveBgmVolume: number;
    effectiveSfxVolume: number;
} {
    if (typeof window !== "undefined" && (window as any).__GARDENWARS_AUDIO_SETTINGS__) {
        return (window as any).__GARDENWARS_AUDIO_SETTINGS__;
    }
    // Return defaults if not available
    return {
        masterVolume: 1.0,
        bgmVolume: 0.5,
        sfxVolume: 0.7,
        isMuted: false,
        bgmEnabled: true,
        sfxEnabled: true,
        effectiveBgmVolume: 0.5,
        effectiveSfxVolume: 0.7,
    };
}

// Audio toggle button component
export function AudioToggleButton({ className = "", muteLabel = "Mute", unmuteLabel = "Unmute" }: { className?: string; muteLabel?: string; unmuteLabel?: string }) {
    const { isMuted, toggleMute } = useAudio();

    return (
        <button
            onClick={toggleMute}
            className={`px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-sm font-bold transition-colors ${className}`}
            title={isMuted ? unmuteLabel : muteLabel}
            aria-label={isMuted ? unmuteLabel : muteLabel}
        >
            {isMuted ? "🔇" : "🔊"}
        </button>
    );
}
