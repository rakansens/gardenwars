"use client";

import { useState, useRef } from "react";
import type { UnitDefinition, Rarity } from "@/data/types";
import { getRarityStars, getRarityGradientClass } from "@/components/ui/RarityFrame";
import RarityFrame from "@/components/ui/RarityFrame";

interface GachaRevealProps {
    results: UnitDefinition[];
    onComplete: () => void;
}

// レアリティごとの裏面カラー
const rarityBackColors: Record<Rarity, string> = {
    N: "from-gray-500 to-gray-700 border-gray-400",
    R: "from-blue-500 to-blue-700 border-blue-400",
    SR: "from-purple-500 to-purple-700 border-purple-400",
    SSR: "from-amber-400 to-orange-600 border-yellow-300",
    UR: "from-pink-400 via-purple-500 to-cyan-400 border-pink-300",
};

// レアリティごとの演出設定
const rarityEffects: Record<Rarity, {
    glowColor: string;
    bgEffect: string;
    flipDuration: number;
    particles: string;
    sound: string;
}> = {
    N: {
        glowColor: "",
        bgEffect: "bg-black/80",
        flipDuration: 0.4,
        particles: "",
        sound: "normal"
    },
    R: {
        glowColor: "shadow-lg shadow-blue-400/70",
        bgEffect: "bg-gradient-to-b from-blue-900/90 to-black/90",
        flipDuration: 0.5,
        particles: "particles-blue",
        sound: "rare"
    },
    SR: {
        glowColor: "shadow-lg shadow-purple-400/80",
        bgEffect: "bg-gradient-to-b from-purple-900/90 to-black/90",
        flipDuration: 0.6,
        particles: "particles-purple",
        sound: "super"
    },
    SSR: {
        glowColor: "shadow-2xl shadow-yellow-400",
        bgEffect: "bg-gradient-to-b from-amber-900/90 via-orange-900/90 to-black/90",
        flipDuration: 0.8,
        particles: "particles-rainbow",
        sound: "legendary"
    },
    UR: {
        glowColor: "shadow-2xl shadow-pink-400 ring-4 ring-pink-300/50",
        bgEffect: "bg-gradient-to-b from-pink-900/90 via-purple-900/90 to-black/90",
        flipDuration: 1.0,
        particles: "particles-rainbow",
        sound: "legendary"
    },
};

export default function GachaReveal({ results, onComplete }: GachaRevealProps) {
    const isMulti = results.length > 1;
    const [phase, setPhase] = useState<"video" | "cards" | "single">("video");
    const [revealedCards, setRevealedCards] = useState<boolean[]>(results.map(() => false));
    const [currentSingleIndex, setCurrentSingleIndex] = useState<number>(0);
    const videoRef = useRef<HTMLVideoElement>(null);

    // 動画終了時の処理
    const handleVideoEnd = () => {
        if (isMulti) {
            setPhase("cards");
        } else {
            setCurrentSingleIndex(0);
            setPhase("single");
        }
    };

    // スキップ
    const handleSkip = () => {
        if (isMulti) {
            setPhase("cards");
        } else {
            setCurrentSingleIndex(0);
            setPhase("single");
        }
    };

    // カードをクリックして連続めくり開始
    const handleStartReveal = () => {
        const firstUnrevealed = revealedCards.findIndex(r => !r);
        if (firstUnrevealed !== -1) {
            setCurrentSingleIndex(firstUnrevealed);
            setPhase("single");
        }
    };

    // 個別表示から次へ（連続めくり）
    const handleSingleNext = () => {
        const newRevealed = [...revealedCards];
        newRevealed[currentSingleIndex] = true;
        setRevealedCards(newRevealed);

        const nextUnrevealed = newRevealed.findIndex((r, i) => !r && i > currentSingleIndex);

        if (nextUnrevealed !== -1) {
            setCurrentSingleIndex(nextUnrevealed);
        } else {
            setPhase("cards");
        }
    };

    const allRevealed = revealedCards.every(r => r);

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
                <button
                    onClick={handleSkip}
                    className="absolute bottom-8 right-8 px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg transition-colors"
                >
                    スキップ →
                </button>
            </div>
        );
    }

    // 個別カード表示フェーズ（レアリティ別演出）
    if (phase === "single") {
        const unit = results[currentSingleIndex];
        const effect = rarityEffects[unit.rarity];
        const isSSR = unit.rarity === "SSR";
        const isSR = unit.rarity === "SR";

        return (
            <div
                className={`fixed inset-0 z-50 ${effect.bgEffect} flex items-center justify-center cursor-pointer overflow-hidden`}
                onClick={handleSingleNext}
            >
                {/* 背景パーティクル */}
                {effect.particles && (
                    <div className={`absolute inset-0 ${effect.particles}`} />
                )}

                {/* SSR: 光の放射 */}
                {isSSR && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="ssr-burst" />
                        <div className="ssr-glow" />
                    </div>
                )}

                {/* SR: 紫の輝き */}
                {isSR && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="sr-glow" />
                    </div>
                )}

                {/* 進捗表示 */}
                <div className="absolute top-8 text-white/70 text-lg z-10">
                    {currentSingleIndex + 1} / {results.length}
                </div>

                {/* フリップカード */}
                <div className="flip-card-container z-10" key={currentSingleIndex}>
                    <div
                        className="flip-card"
                        style={{
                            animation: `flip ${effect.flipDuration}s ease-out forwards`,
                        }}
                    >
                        {/* カード裏面 */}
                        <div className="flip-card-back">
                            <div className={`w-52 h-72 bg-gradient-to-br ${rarityBackColors[unit.rarity]} rounded-xl border-4 flex items-center justify-center`}>
                                <div className="text-center">
                                    <span className="text-5xl">❓</span>
                                    <div className="mt-2 text-white/80 font-bold">{unit.rarity}</div>
                                </div>
                            </div>
                        </div>

                        {/* カード表面 */}
                        <div className="flip-card-front">
                            <div className={`
                                w-52 h-72 bg-gradient-to-br ${getRarityGradientClass(unit.rarity)}
                                rounded-xl p-4 text-center
                                shadow-2xl ${effect.glowColor}
                                border-4 border-white/50
                                flex flex-col items-center justify-center
                                ${isSSR ? "animate-ssr-shine" : ""}
                            `}>
                                {/* レアリティ星 */}
                                <div className={`text-xl mb-2 ${isSSR ? "animate-pulse" : ""}`}>
                                    {getRarityStars(unit.rarity)}
                                </div>

                                {/* キャラ画像 */}
                                <div className="mb-3">
                                    <RarityFrame
                                        unitId={unit.id}
                                        unitName={unit.name}
                                        rarity={unit.rarity}
                                        size="xl"
                                        showLabel={false}
                                    />
                                </div>

                                {/* 名前 */}
                                <div className={`font-bold text-lg text-white drop-shadow-lg ${isSSR ? "animate-bounce" : ""}`}>
                                    {unit.name}
                                </div>

                                {/* レアリティラベル */}
                                <div className={`mt-2 px-3 py-1 rounded-full text-sm font-bold text-white ${isSSR ? "bg-gradient-to-r from-yellow-400 to-orange-400 animate-pulse" : "bg-white/30"
                                    }`}>
                                    {unit.rarity}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* テキスト */}
                <div className={`absolute bottom-12 text-lg animate-pulse z-10 ${isSSR ? "text-yellow-300" : "text-white/70"}`}>
                    {isSSR ? "🌟 SUPER RARE! 🌟" : "👆 タップして次へ"}
                </div>

                <style jsx>{`
                    .flip-card-container {
                        perspective: 1000px;
                    }
                    .flip-card {
                        position: relative;
                        width: 208px;
                        height: 288px;
                        transform-style: preserve-3d;
                    }
                    .flip-card-front, .flip-card-back {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        backface-visibility: hidden;
                    }
                    .flip-card-back {
                        transform: rotateY(0deg);
                    }
                    .flip-card-front {
                        transform: rotateY(180deg);
                    }
                    @keyframes flip {
                        0% { transform: rotateY(0deg); }
                        100% { transform: rotateY(180deg); }
                    }

                    /* SSR 演出 */
                    .ssr-burst {
                        width: 400px;
                        height: 400px;
                        background: conic-gradient(from 0deg, transparent, rgba(255, 215, 0, 0.3), transparent, rgba(255, 165, 0, 0.3), transparent);
                        animation: ssr-rotate 3s linear infinite;
                    }
                    @keyframes ssr-rotate {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .ssr-glow {
                        position: absolute;
                        width: 300px;
                        height: 300px;
                        background: radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, transparent 70%);
                        animation: ssr-pulse 1.5s ease-in-out infinite;
                    }
                    @keyframes ssr-pulse {
                        0%, 100% { transform: scale(1); opacity: 0.6; }
                        50% { transform: scale(1.2); opacity: 1; }
                    }
                    .animate-ssr-shine {
                        animation: ssr-shine 2s ease-in-out infinite;
                    }
                    @keyframes ssr-shine {
                        0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
                        50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 165, 0, 0.5); }
                    }

                    /* SR 演出 */
                    .sr-glow {
                        width: 250px;
                        height: 250px;
                        background: radial-gradient(circle, rgba(147, 51, 234, 0.4) 0%, transparent 70%);
                        animation: sr-pulse 2s ease-in-out infinite;
                    }
                    @keyframes sr-pulse {
                        0%, 100% { transform: scale(1); opacity: 0.5; }
                        50% { transform: scale(1.1); opacity: 0.8; }
                    }

                    /* パーティクル */
                    .particles-rainbow {
                        background-image: 
                            radial-gradient(circle at 20% 30%, rgba(255, 0, 0, 0.3) 2px, transparent 2px),
                            radial-gradient(circle at 80% 20%, rgba(255, 165, 0, 0.3) 2px, transparent 2px),
                            radial-gradient(circle at 40% 70%, rgba(255, 255, 0, 0.3) 2px, transparent 2px),
                            radial-gradient(circle at 60% 50%, rgba(0, 255, 0, 0.3) 2px, transparent 2px),
                            radial-gradient(circle at 30% 90%, rgba(0, 0, 255, 0.3) 2px, transparent 2px),
                            radial-gradient(circle at 70% 80%, rgba(128, 0, 128, 0.3) 2px, transparent 2px);
                        background-size: 100px 100px;
                        animation: particles-float 4s ease-in-out infinite;
                    }
                    .particles-purple {
                        background-image: 
                            radial-gradient(circle at 25% 25%, rgba(147, 51, 234, 0.3) 2px, transparent 2px),
                            radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.3) 2px, transparent 2px);
                        background-size: 80px 80px;
                        animation: particles-float 5s ease-in-out infinite;
                    }
                    .particles-blue {
                        background-image: 
                            radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.2) 2px, transparent 2px),
                            radial-gradient(circle at 70% 70%, rgba(96, 165, 250, 0.2) 2px, transparent 2px);
                        background-size: 100px 100px;
                        animation: particles-float 6s ease-in-out infinite;
                    }
                    @keyframes particles-float {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-20px); }
                    }
                `}</style>
            </div>
        );
    }

    // カード一覧表示フェーズ
    return (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-amber-100 to-amber-200 flex flex-col items-center justify-center p-4 overflow-y-auto">
            <h2 className="text-2xl font-bold text-amber-950 mb-4">
                {allRevealed ? "🎉 ガチャ結果 🎉" : "🎁 タップしてカードを開こう！"}
            </h2>

            <div
                className={`grid ${isMulti ? "grid-cols-5" : "grid-cols-1"} gap-3 mb-6 max-w-3xl ${!allRevealed ? "cursor-pointer" : ""}`}
                onClick={!allRevealed ? handleStartReveal : undefined}
            >
                {results.map((unit, index) => {
                    const isRevealed = revealedCards[index];
                    const effect = rarityEffects[unit.rarity];

                    return (
                        <div
                            key={index}
                            className={`
                                w-20 h-28 rounded-xl
                                transform transition-all duration-200
                                ${isRevealed
                                    ? `bg-gradient-to-br ${getRarityGradientClass(unit.rarity)} ${effect.glowColor} border-white/50`
                                    : `bg-gradient-to-br ${rarityBackColors[unit.rarity]}`
                                }
                                border-3
                                flex flex-col items-center justify-center
                                shadow-lg
                            `}
                        >
                            {isRevealed ? (
                                <>
                                    <RarityFrame
                                        unitId={unit.id}
                                        unitName={unit.name}
                                        rarity={unit.rarity}
                                        size="sm"
                                        showLabel={false}
                                    />
                                    <div className="text-xs text-white font-bold mt-1 truncate w-full text-center px-1">
                                        {unit.name.slice(0, 4)}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center">
                                    <span className="text-2xl">❓</span>
                                    <div className="text-xs text-white/80 font-bold mt-1">{unit.rarity}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {allRevealed && (
                <button
                    onClick={onComplete}
                    className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xl font-bold rounded-xl border-4 border-green-300 shadow-lg hover:scale-105 transition-transform"
                >
                    OK
                </button>
            )}
        </div>
    );
}
