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
 * ワールド選択タブコンポーネント（大きな親タブスタイル）
 * stages/page.tsx と worldmap/page.tsx で共通使用
 */
export default function WorldTabs({ selectedWorld, onSelectWorld }: WorldTabsProps) {
    const { t } = useLanguage();
    const { isWorldUnlocked, getWorldProgress } = useWorldUnlock();

    return (
        <div className="mb-6">
            {/* セクションラベル */}
            <div className="text-center mb-2">
                <span className="text-xs font-bold text-amber-700/60 dark:text-amber-400/60 uppercase tracking-wider">
                    🌍 Select World
                </span>
            </div>

            {/* ワールドタブ - 大きな親タブスタイル */}
            <div className="flex gap-3 justify-center px-2">
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
                            className={`
                                relative overflow-hidden transition-all duration-300
                                flex-1 max-w-[280px]
                                ${isSelected
                                    ? "rounded-t-2xl rounded-b-none"
                                    : "rounded-2xl"
                                }
                                ${isLocked
                                    ? "opacity-50 cursor-not-allowed grayscale"
                                    : isSelected
                                        ? "shadow-2xl z-10 scale-[1.02]"
                                        : "hover:shadow-lg opacity-70 hover:opacity-100"
                                }
                            `}
                        >
                            {/* バナー画像背景 */}
                            <div className={`
                                relative bg-gradient-to-br ${world.gradient}
                                ${isSelected ? "h-32 sm:h-36" : "h-20 sm:h-24"}
                                transition-all duration-300
                            `}>
                                {world.banner && (
                                    <Image
                                        src={world.banner}
                                        alt={t(world.nameKey)}
                                        fill
                                        className={`object-cover ${isSelected ? "opacity-80" : "opacity-50"}`}
                                    />
                                )}

                                {/* オーバーレイ */}
                                <div className={`absolute inset-0 ${
                                    isSelected
                                        ? "bg-gradient-to-t from-black/80 via-black/30 to-transparent"
                                        : "bg-gradient-to-t from-black/70 via-black/40 to-black/20"
                                }`} />

                                {/* 選択インジケーター */}
                                {isSelected && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400" />
                                )}

                                {/* ロックオーバーレイ */}
                                {isLocked && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                        <div className="text-center">
                                            <span className="text-4xl">🔒</span>
                                            <p className="text-white/80 text-[10px] mt-1 px-2">
                                                {t("world_locked")}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* クリア済みバッジ */}
                                {isAllCleared && !isLocked && (
                                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                                        ✓ Complete
                                    </div>
                                )}

                                {/* コンテンツ */}
                                <div className="absolute inset-0 flex flex-col justify-end p-3">
                                    <div className={`flex items-center gap-2 ${isSelected ? "mb-1" : ""}`}>
                                        <span className={`${isSelected ? "text-3xl sm:text-4xl" : "text-2xl"}`}>
                                            {world.icon}
                                        </span>
                                        <div>
                                            <div className={`text-white font-bold drop-shadow-lg ${
                                                isSelected ? "text-lg sm:text-xl" : "text-sm sm:text-base"
                                            }`}>
                                                {t(world.nameKey)}
                                            </div>
                                            <div className={`text-white/70 drop-shadow ${
                                                isSelected ? "text-sm" : "text-[10px] sm:text-xs"
                                            }`}>
                                                {t(world.subtitleKey)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 進捗バー（選択時のみ表示） */}
                                    {isSelected && !isLocked && (
                                        <div className="mt-2">
                                            <div className="flex justify-between text-[10px] text-white/80 mb-1">
                                                <span>Progress</span>
                                                <span>{cleared}/{total} ({Math.round(cleared/total*100) || 0}%)</span>
                                            </div>
                                            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${(cleared/total*100) || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* 非選択時の進捗 */}
                                    {!isSelected && !isLocked && (
                                        <div className="text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full bg-white/20 text-white w-fit">
                                            {cleared}/{total}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* 選択中のワールドの下線 */}
            <div className="flex justify-center px-2">
                <div className="flex gap-3 max-w-[calc(280px*3+1.5rem)]" style={{ width: '100%' }}>
                    {worlds.map((world) => {
                        const isSelected = selectedWorld === world.id;
                        return (
                            <div
                                key={world.id}
                                className={`flex-1 max-w-[280px] h-1 rounded-b-full transition-all duration-300 ${
                                    isSelected
                                        ? "bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400"
                                        : "bg-transparent"
                                }`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
