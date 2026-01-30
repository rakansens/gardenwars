"use client";

import { useLanguage } from "@/contexts/LanguageContext";

interface WelcomeBackScreenProps {
    playerName: string;
    onContinue: () => void;
    onSwitchPlayer: () => void;
}

export function WelcomeBackScreen({ playerName, onContinue, onSwitchPlayer }: WelcomeBackScreenProps) {
    const { language } = useLanguage();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-200 via-green-100 to-amber-100 p-4">
            <div className="bg-white/90 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
                {/* Welcome back */}
                <div className="text-5xl mb-4">👋</div>
                <h2 className="text-2xl font-bold text-green-700 mb-2">
                    {language === "ja" ? "おかえり、" : "Welcome back,"}
                </h2>
                <p className="text-3xl font-bold text-amber-600 mb-6">
                    {playerName}！
                </p>

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onContinue}
                        className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xl font-bold rounded-2xl shadow-lg transform hover:scale-105 transition-all"
                    >
                        🎮 {language === "ja" ? "つづける" : "Continue"}
                    </button>
                    <button
                        onClick={onSwitchPlayer}
                        className="w-full py-3 px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-2xl transition-colors"
                    >
                        🔄 {language === "ja" ? "べつの ひと" : "Switch Player"}
                    </button>
                </div>
            </div>
        </div>
    );
}
