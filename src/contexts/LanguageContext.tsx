"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import enTranslations from "@/data/locales/en.json";
import jaTranslations from "@/data/locales/ja.json";

export type Language = "en" | "ja";

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
    en: enTranslations,
    ja: jaTranslations,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "gardenwars_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>("en");

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
        if (saved && (saved === "en" || saved === "ja")) {
            setLanguageState(saved);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(STORAGE_KEY, lang);
    };

    const t = (key: string): string => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}

// 言語切り替えボタンコンポーネント
export function LanguageSwitch() {
    const { language, setLanguage } = useLanguage();

    return (
        <button
            onClick={() => setLanguage(language === "en" ? "ja" : "en")}
            className="px-3 py-1 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-800 text-sm font-bold transition-colors"
        >
            {language === "en" ? "🇯🇵 日本語" : "🇺🇸 English"}
        </button>
    );
}
