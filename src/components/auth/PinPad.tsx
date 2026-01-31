"use client";

import { useState, useCallback } from "react";

interface PinPadProps {
    onComplete: (pin: string) => void;
    disabled?: boolean;
}

export function PinPad({ onComplete, disabled = false }: PinPadProps) {
    const [pin, setPin] = useState<string>("");

    const handleNumber = useCallback((num: string) => {
        if (disabled || pin.length >= 6) return;

        const newPin = pin + num;
        setPin(newPin);

        if (newPin.length === 6) {
            onComplete(newPin);
        }
    }, [pin, disabled, onComplete]);

    const handleDelete = useCallback(() => {
        if (disabled) return;
        setPin((prev) => prev.slice(0, -1));
    }, [disabled]);

    const handleClear = useCallback(() => {
        if (disabled) return;
        setPin("");
    }, [disabled]);

    return (
        <div className="flex flex-col items-center gap-4">
            {/* PIN Display */}
            <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className={`w-10 h-12 border-2 rounded-lg flex items-center justify-center text-2xl font-bold transition-all ${
                            pin[i]
                                ? "border-green-500 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400"
                                : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-400 dark:text-gray-500"
                        }`}
                    >
                        {pin[i] || "·"}
                    </div>
                ))}
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2 mt-4">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleNumber(num)}
                        disabled={disabled || pin.length >= 6}
                        className="w-16 h-16 text-2xl font-bold rounded-xl bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800/50 active:bg-amber-300 dark:active:bg-amber-700/50 text-amber-800 dark:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        {num}
                    </button>
                ))}
                <button
                    onClick={handleClear}
                    disabled={disabled || pin.length === 0}
                    className="w-16 h-16 text-sm font-bold rounded-xl bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 active:bg-gray-400 dark:active:bg-slate-400 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                    クリア
                </button>
                <button
                    onClick={() => handleNumber("0")}
                    disabled={disabled || pin.length >= 6}
                    className="w-16 h-16 text-2xl font-bold rounded-xl bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800/50 active:bg-amber-300 dark:active:bg-amber-700/50 text-amber-800 dark:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    disabled={disabled || pin.length === 0}
                    className="w-16 h-16 text-xl font-bold rounded-xl bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800/50 active:bg-red-300 dark:active:bg-red-700/50 text-red-700 dark:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                    ←
                </button>
            </div>
        </div>
    );
}
