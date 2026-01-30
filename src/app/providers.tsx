"use client";

import { ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <LanguageProvider>
            <AuthProvider>
                {children}
            </AuthProvider>
        </LanguageProvider>
    );
}
