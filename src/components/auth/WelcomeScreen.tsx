"use client";

import { useLanguage } from "@/contexts/LanguageContext";

interface WelcomeScreenProps {
    onNewPlayer: () => void;
    onExistingPlayer: () => void;
}

export function WelcomeScreen({ onNewPlayer, onExistingPlayer }: WelcomeScreenProps) {
    const { language } = useLanguage();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-200 via-green-100 to-amber-100 p-4">
            <div className="bg-white/90 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
                {/* Logo */}
                <div className="text-6xl mb-4">🌱</div>
                <h1 className="text-3xl font-bold text-green-700 mb-2">
                    Garden Wars
                </h1>
                <p className="text-gray-600 mb-8">
                    {language === "ja" ? "にゃんこ軍団で敵を倒せ！" : "Defeat enemies with cat army!"}
                </p>

                {/* Buttons */}
                <div className="flex flex-col gap-4">
                    <button
                        onClick={onNewPlayer}
                        className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xl font-bold rounded-2xl shadow-lg transform hover:scale-105 transition-all"
                    >
                        {language === "ja" ? "👋 はじめて" : "👋 New Player"}
                    </button>
                    <button
                        onClick={onExistingPlayer}
                        className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xl font-bold rounded-2xl shadow-lg transform hover:scale-105 transition-all"
                    >
                        {language === "ja" ? "🔑 つづきから" : "🔑 Continue"}
                    </button>
                </div>
            </div>
        </div>
    );
}
