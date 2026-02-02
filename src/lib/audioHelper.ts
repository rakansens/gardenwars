// Audio helper utilities for Phaser scenes
// Reads settings from the global window object set by AudioContext

export interface AudioSettings {
    masterVolume: number;
    bgmVolume: number;
    sfxVolume: number;
    isMuted: boolean;
    bgmEnabled: boolean;
    sfxEnabled: boolean;
    effectiveBgmVolume: number;
    effectiveSfxVolume: number;
}

const DEFAULT_SETTINGS: AudioSettings = {
    masterVolume: 1.0,
    bgmVolume: 0.5,
    sfxVolume: 0.7,
    isMuted: false,
    bgmEnabled: true,
    sfxEnabled: true,
    effectiveBgmVolume: 0.5,
    effectiveSfxVolume: 0.7,
};

/**
 * Get current audio settings from the global window object
 * This is used by Phaser scenes to read React state
 */
export function getAudioSettings(): AudioSettings {
    if (typeof window !== "undefined" && (window as any).__GARDENWARS_AUDIO_SETTINGS__) {
        return (window as any).__GARDENWARS_AUDIO_SETTINGS__;
    }
    return DEFAULT_SETTINGS;
}

/**
 * Get effective BGM volume (considers master volume, mute state, and BGM enabled)
 * @param baseVolume - The base volume for this specific sound (0-1)
 * @returns The final volume to use
 */
export function getBgmVolume(baseVolume: number = 1.0): number {
    const settings = getAudioSettings();
    if (settings.isMuted || !settings.bgmEnabled) return 0;
    return baseVolume * settings.masterVolume * settings.bgmVolume;
}

/**
 * Get effective SFX volume (considers master volume, mute state, and SFX enabled)
 * @param baseVolume - The base volume for this specific sound (0-1)
 * @returns The final volume to use
 */
export function getSfxVolume(baseVolume: number = 1.0): number {
    const settings = getAudioSettings();
    if (settings.isMuted || !settings.sfxEnabled) return 0;
    return baseVolume * settings.masterVolume * settings.sfxVolume;
}

/**
 * Check if BGM should be playing
 */
export function isBgmEnabled(): boolean {
    const settings = getAudioSettings();
    return !settings.isMuted && settings.bgmEnabled;
}

/**
 * Check if SFX should be playing
 */
export function isSfxEnabled(): boolean {
    const settings = getAudioSettings();
    return !settings.isMuted && settings.sfxEnabled;
}

/**
 * Check if all audio is muted
 */
export function isAudioMuted(): boolean {
    return getAudioSettings().isMuted;
}
