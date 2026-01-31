"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
            <LanguageProvider>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    );
}
