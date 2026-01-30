"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface RegisterScreenProps {
    onRegister: (name: string) => Promise<{ success: boolean; pin?: string; error?: string; migrated?: boolean }>;
    onBack: () => void;
}

type Step = "name" | "pin" | "complete";

export function RegisterScreen({ onRegister, onBack }: RegisterScreenProps) {
    const { language } = useLanguage();
    const [step, setStep] = useState<Step>("name");
    const [name, setName] = useState("");
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [dataMigrated, setDataMigrated] = useState(false);

    const handleSubmitName = async () => {
        if (!name.trim()) {
            setError(language === "ja" ? "名前を入力してね" : "Please enter your name");
            return;
        }

        setIsLoading(true);
        setError("");

        const result = await onRegister(name);

        setIsLoading(false);

        if (result.success && result.pin) {
            setPin(result.pin);
            setDataMigrated(result.migrated || false);
            setStep("pin");
        } else {
            setError(result.error || (language === "ja" ? "エラーが発生しました" : "An error occurred"));
        }
    };

    const handleComplete = () => {
        setStep("complete");
    };

    // Step 1: Name input
    if (step === "name") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-200 via-green-100 to-amber-100 p-4">
                <div className="bg-white/90 rounded-3xl shadow-2xl p-8 max-w-sm w-full">
                    <button
                        onClick={onBack}
                        className="text-gray-500 hover:text-gray-700 mb-4"
                    >
                        ← {language === "ja" ? "もどる" : "Back"}
                    </button>

                    <h2 className="text-2xl font-bold text-green-700 text-center mb-6">
                        {language === "ja" ? "なまえを いれてね" : "Enter your name"}
                    </h2>

                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={language === "ja" ? "なまえ" : "Name"}
                        maxLength={20}
                        className="w-full p-4 text-xl border-2 border-green-300 rounded-xl focus:border-green-500 focus:outline-none text-center mb-4"
                        autoFocus
                    />

                    {error && (
                        <p className="text-red-500 text-center mb-4">{error}</p>
                    )}

                    <button
                        onClick={handleSubmitName}
                        disabled={isLoading || !name.trim()}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xl font-bold rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading
                            ? (language === "ja" ? "まってね..." : "Please wait...")
                            : (language === "ja" ? "つぎへ" : "Next")}
                    </button>
                </div>
            </div>
        );
    }

    // Step 2: Show PIN
    if (step === "pin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-200 via-green-100 to-amber-100 p-4">
                <div className="bg-white/90 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
                    <div className="text-5xl mb-4">✨</div>

                    <h2 className="text-2xl font-bold text-green-700 mb-2">
                        {language === "ja" ? "あなたの ばんごうは..." : "Your number is..."}
                    </h2>

                    {/* PIN Display */}
                    <div className="flex justify-center gap-2 my-6">
                        {pin.split("").map((digit, i) => (
                            <div
                                key={i}
                                className="w-12 h-14 bg-gradient-to-b from-amber-400 to-amber-500 rounded-xl flex items-center justify-center text-3xl font-bold text-white shadow-lg"
                            >
                                {digit}
                            </div>
                        ))}
                    </div>

                    {dataMigrated && (
                        <div className="bg-green-50 rounded-xl p-4 mb-4">
                            <p className="text-green-700 text-sm font-bold">
                                ✅ {language === "ja" ? "データを ひきつぎました！" : "Data migrated!"}
                            </p>
                            <p className="text-green-600 text-xs mt-1">
                                {language === "ja"
                                    ? "いままでの データが クラウドに ほぞんされたよ"
                                    : "Your existing data has been saved to the cloud"}
                            </p>
                        </div>
                    )}

                    <div className="bg-amber-50 rounded-xl p-4 mb-6">
                        <p className="text-amber-700 text-sm">
                            📸 {language === "ja" ? "スクショ してね！" : "Take a screenshot!"}
                        </p>
                        <p className="text-amber-600 text-xs mt-1">
                            {language === "ja"
                                ? "べつの たんまつで あそぶとき この ばんごうが ひつようだよ"
                                : "You'll need this number to play on other devices"}
                        </p>
                    </div>

                    <button
                        onClick={handleComplete}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xl font-bold rounded-2xl shadow-lg transition-all"
                    >
                        {language === "ja" ? "はじめる！" : "Start!"}
                    </button>
                </div>
            </div>
        );
    }

    // Step 3: Complete (will redirect)
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-200 via-green-100 to-amber-100 p-4">
            <div className="bg-white/90 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
                <div className="text-5xl mb-4">🎉</div>
                <p className="text-xl text-green-700">
                    {language === "ja" ? "ようこそ！" : "Welcome!"}
                </p>
            </div>
        </div>
    );
}
