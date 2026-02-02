"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import ErrorBoundary from "@/components/ErrorBoundary";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
            <LanguageProvider>
                <ToastProvider>
                    <ErrorBoundary>
                        <AuthProvider>
                            {children}
                        </AuthProvider>
                    </ErrorBoundary>
                </ToastProvider>
            </LanguageProvider>
        </ThemeProvider>
    );
}
