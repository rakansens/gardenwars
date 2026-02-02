"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { AudioProvider } from "@/contexts/AudioContext";
import { NetworkProvider } from "@/contexts/NetworkContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/ui/OfflineBanner";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
            <LanguageProvider>
                <NetworkProvider>
                    <AudioProvider>
                        <ToastProvider>
                            <ErrorBoundary>
                                <AuthProvider>
                                    <OfflineBanner />
                                    {children}
                                </AuthProvider>
                            </ErrorBoundary>
                        </ToastProvider>
                    </AudioProvider>
                </NetworkProvider>
            </LanguageProvider>
        </ThemeProvider>
    );
}
