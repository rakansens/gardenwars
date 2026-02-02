"use client";

import Image from "next/image";
import worlds from "@/data/worlds";
import type { WorldId } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorldUnlock } from "@/hooks/useWorldUnlock";

interface WorldTabsProps {
    selectedWorld: WorldId;
    onSelectWorld: (worldId: WorldId) => void;
}

/**
 * ワールド選択タブコンポーネント
 * stages/page.tsx と worldmap/page.tsx で共通使用
 */
export default function WorldTabs({ selectedWorld, onSelectWorld }: WorldTabsProps) {
    const { t } = useLanguage();
    const { isWorldUnlocked, getWorldProgress } = useWorldUnlock();

    return (
        <div className="mb-4">
            <div className="flex gap-2 sm:gap-3 justify-center">
                {worlds.map((world) => {
                    const { cleared, total } = getWorldProgress(world.id);
                    const isSelected = selectedWorld === world.id;
                    const isAllCleared = cleared === total && total > 0;
                    const isLocked = !isWorldUnlocked(world.id);

                    return (
                        <button
                            key={world.id}
                            onClick={() => !isLocked && onSelectWorld(world.id)}
                            disabled={isLocked}
                            className={`relative overflow-hidden rounded-xl transition-all duration-300 flex-1 max-w-[180px] ${
                                isLocked
                                    ? "opacity-50 cursor-not-allowed grayscale"
                                    : isSelected
                                        ? "ring-4 ring-yellow-400 scale-105 shadow-2xl z-10"
                                        : "hover:scale-102 hover:shadow-lg opacity-80 hover:opacity-100"
                            }`}
                        >
                            {/* バナー画像背景 */}
                            <div className={`relative h-20 sm:h-24 bg-gradient-to-br ${world.gradient}`}>
                                {world.banner && (
                                    <Image
                                        src={world.banner}
                                        alt={t(world.nameKey)}
                                        fill
                                        className="object-cover opacity-60"
                                    />
                                )}
                                {/* オーバーレイ */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                                {/* ロックアイコン */}
                                {isLocked && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                        <div className="text-center">
                                            <span className="text-3xl">🔒</span>
                                            <p className="text-white/80 text-[9px] mt-1 px-2">
                                                {t("world_locked")}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* クリア済みバッジ */}
                                {isAllCleared && !isLocked && (
                                    <div className="absolute top-1 right-1 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                        ✓
                                    </div>
                                )}

                                {/* コンテンツ */}
                                <div className="absolute inset-0 flex flex-col justify-end p-2">
                                    <div className="text-2xl sm:text-3xl mb-0.5">{world.icon}</div>
                                    <div className="text-white font-bold text-xs sm:text-sm leading-tight drop-shadow-lg">
                                        {t(world.nameKey)}
                                    </div>
                                    <div className="text-white/70 text-[10px] sm:text-xs drop-shadow">
                                        {t(world.subtitleKey)}
                                    </div>
                                    <div className={`text-[9px] sm:text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full inline-block w-fit ${
                                        isAllCleared ? "bg-green-500/80" : "bg-white/30"
                                    } text-white`}>
                                        {cleared}/{total}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
