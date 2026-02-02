/**
 * Game-specific translations for Phaser scenes
 * Since Phaser doesn't have access to React context, we use a global window variable
 */

type GameTranslations = {
  paused: string;
  pause_resume: string;
  pause_quit: string;
  pause_keyboard_hint: string;
};

const translations: Record<string, GameTranslations> = {
  en: {
    paused: "PAUSED",
    pause_resume: "Resume",
    pause_quit: "Quit",
    pause_keyboard_hint: "Press ESC or Space to resume",
  },
  ja: {
    paused: "一時停止",
    pause_resume: "再開",
    pause_quit: "やめる",
    pause_keyboard_hint: "ESCまたはSpaceで再開",
  }
};

export function getGameTranslation(key: keyof GameTranslations, language: string = 'en'): string {
  const lang = language === 'ja' ? 'ja' : 'en';
  return translations[lang][key] || translations['en'][key] || key;
}

// Global accessor for Phaser scenes
export function setGameLanguage(language: string): void {
  if (typeof window !== 'undefined') {
    (window as unknown as { __GAME_LANGUAGE__: string }).__GAME_LANGUAGE__ = language;
  }
}

export function getGameLanguage(): string {
  if (typeof window !== 'undefined') {
    return (window as unknown as { __GAME_LANGUAGE__?: string }).__GAME_LANGUAGE__ || 'en';
  }
  return 'en';
}
