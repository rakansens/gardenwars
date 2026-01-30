"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    // SSR中は何も表示しない
    if (!mounted) {
        return (
            <button className="p-2 rounded-lg bg-amber-100 w-10 h-10">
                <span className="text-xl opacity-0">🌙</span>
            </button>
        );
    }

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-amber-100 dark:bg-slate-700 hover:bg-amber-200 dark:hover:bg-slate-600 transition-colors"
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
            {theme === "light" ? (
                <span className="text-xl">🌙</span>
            ) : (
                <span className="text-xl">☀️</span>
            )}
        </button>
    );
}
