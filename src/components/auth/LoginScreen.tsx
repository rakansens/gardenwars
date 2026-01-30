"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PinPad } from "./PinPad";

interface LoginScreenProps {
    onLogin: (pin: string) => Promise<{ success: boolean; error?: string }>;
    onBack: () => void;
}

export function LoginScreen({ onLogin, onBack }: LoginScreenProps) {
    const { language } = useLanguage();
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handlePinComplete = async (pin: string) => {
        setIsLoading(true);
        setError("");

        const result = await onLogin(pin);

        setIsLoading(false);

        if (!result.success) {
            setError(result.error || (language === "ja" ? "ばんごうが ちがうよ" : "Invalid number"));
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-200 via-green-100 to-amber-100 p-4">
            <div className="bg-white/90 rounded-3xl shadow-2xl p-8 max-w-sm w-full">
                <button
                    onClick={onBack}
                    disabled={isLoading}
                    className="text-gray-500 hover:text-gray-700 mb-4 disabled:opacity-50"
                >
                    ← {language === "ja" ? "もどる" : "Back"}
                </button>

                <h2 className="text-2xl font-bold text-green-700 text-center mb-6">
                    {language === "ja" ? "ばんごうを いれてね" : "Enter your number"}
                </h2>

                <PinPad onComplete={handlePinComplete} disabled={isLoading} />

                {error && (
                    <p className="text-red-500 text-center mt-4 animate-pulse">{error}</p>
                )}

                {isLoading && (
                    <p className="text-green-600 text-center mt-4">
                        {language === "ja" ? "まってね..." : "Please wait..."}
                    </p>
                )}
            </div>
        </div>
    );
}
