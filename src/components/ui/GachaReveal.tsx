"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { UnitDefinition, Rarity } from "@/data/types";
import { getRarityStars, getRarityGradientClass } from "@/components/ui/RarityFrame";
import RarityFrame from "@/components/ui/RarityFrame";

interface GachaRevealProps {
    results: UnitDefinition[];
    onComplete: () => void;
}

// レアリティごとのエフェクト設定
const rarityEffects: Record<Rarity, {
    bgClass: string;
    cardBorder: string;
    glowColor: string;
}> = {
    N: {
        bgClass: "bg-gradient-to-b from-gray-600 to-gray-800",
        cardBorder: "border-gray-400",
        glowColor: "",
    },
    R: {
        bgClass: "bg-gradient-to-b from-blue-600 to-blue-900",
        cardBorder: "border-blue-400",
        glowColor: "shadow-lg shadow-blue-400/70",
    },
    SR: {
        bgClass: "bg-gradient-to-b from-purple-600 to-purple-900",
        cardBorder: "border-purple-400",
        glowColor: "shadow-lg shadow-purple-400/80",
    },
    SSR: {
        bgClass: "bg-gradient-to-b from-amber-500 via-yellow-500 to-orange-600",
        cardBorder: "border-yellow-300",
        glowColor: "shadow-xl shadow-yellow-400",
    },
};

export default function GachaReveal({ results, onComplete }: GachaRevealProps) {
    const isMulti = results.length > 1;
    const [phase, setPhase] = useState<"video" | "results">("video");
    const videoRef = useRef<HTMLVideoElement>(null);

    // 動画終了時の処理
    const handleVideoEnd = () => {
        setPhase("results");
    };

    // スキップ
    const handleSkip = () => {
        setPhase("results");
    };

    // 動画再生フェーズ
    if (phase === "video") {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <video
                    ref={videoRef}
                    src={isMulti ? "/assets/videos/gacha_multi.mp4" : "/assets/videos/gacha_single.mp4"}
                    autoPlay
                    playsInline
                    onEnded={handleVideoEnd}
                    className="max-w-full max-h-full object-contain"
                />

                {/* スキップボタン */}
                <button
                    onClick={handleSkip}
                    className="absolute bottom-8 right-8 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg transition-colors"
                >
                    スキップ →
                </button>
            </div>
        );
    }

    // 結果表示フェーズ
    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-amber-100 to-amber-200 flex flex-col items-center justify-center p-4 overflow-y-auto">
            {/* タイトル */}
            <h2 className="text-3xl font-bold text-amber-950 mb-6">
                🎉 ガチャ結果 🎉
            </h2>

            {/* カード一覧 */}
            <div className={`grid ${isMulti ? "grid-cols-5" : "grid-cols-1"} gap-4 mb-8 max-w-3xl`}>
                {results.map((unit, index) => {
                    const effect = rarityEffects[unit.rarity];

                    return (
                        <div
                            key={index}
                            className={`
                                bg-gradient-to-br ${getRarityGradientClass(unit.rarity)}
                                rounded-xl p-3 text-center
                                shadow-xl ${effect.glowColor}
                                transform transition-all duration-300
                                hover:scale-105
                                animate-card-pop
                            `}
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            {/* レアリティ */}
                            <div className="text-sm mb-1">{getRarityStars(unit.rarity)}</div>

                            {/* キャラ画像 */}
                            <div className="flex justify-center mb-2">
                                <RarityFrame
                                    unitId={unit.id}
                                    unitName={unit.name}
                                    rarity={unit.rarity}
                                    size={isMulti ? "md" : "lg"}
                                    showLabel={false}
                                />
                            </div>

                            {/* 名前 */}
                            <div className="font-bold text-sm text-white drop-shadow">
                                {unit.name}
                            </div>

                            {/* レアリティラベル */}
                            <div className="mt-1 text-xs font-bold text-white/80">
                                {unit.rarity}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* OKボタン */}
            <button
                onClick={onComplete}
                className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xl font-bold rounded-xl border-4 border-green-300 shadow-lg hover:scale-105 transition-transform"
            >
                OK
            </button>

            <style jsx>{`
                @keyframes card-pop {
                    0% {
                        opacity: 0;
                        transform: scale(0.5) rotateY(180deg);
                    }
                    50% {
                        transform: scale(1.1) rotateY(0deg);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) rotateY(0deg);
                    }
                }
                .animate-card-pop {
                    animation: card-pop 0.5s ease-out forwards;
                    opacity: 0;
                }
            `}</style>
        </div>
    );
}
