"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";
import { getSpritePath } from "@/lib/sprites";
import RarityFrame from "@/components/ui/RarityFrame";
import { usePlayerData } from "@/hooks/usePlayerData";
import { ConfirmModal } from "@/components/ui/Modal";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみ（enemy_で始まらない）かつボスではない
const allyUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

// レアリティの重み
const rarityWeights: Record<Rarity, number> = {
    N: 1,
    R: 2,
    SR: 4,
    SSR: 8,
    UR: 16,
};

// レアリティカラー
const rarityColors: Record<Rarity, string> = {
    N: "border-gray-400 bg-gray-100",
    R: "border-blue-400 bg-blue-100",
    SR: "border-purple-400 bg-purple-100",
    SSR: "border-amber-400 bg-gradient-to-b from-amber-100 to-orange-100",
    UR: "border-pink-400 bg-gradient-to-br from-pink-100 via-purple-100 to-cyan-100",
};

type FusionMode = 3 | 10;

export default function FusionPage() {
    const { t, language } = useLanguage();
    const { unitInventory, executeFusion, flushToSupabase } = usePlayerData();
    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
    const [fusionResult, setFusionResult] = useState<UnitDefinition | null>(null);
    const [showVideo, setShowVideo] = useState(false);
    const [fusionMode, setFusionMode] = useState<FusionMode>(3);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isFusing, setIsFusing] = useState(false);
    const [fusionError, setFusionError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // usePlayerDataから取得したインベントリを使用
    const ownedUnits = unitInventory;

    // モード変更時に選択をリセット
    const changeMode = (mode: FusionMode) => {
        setFusionMode(mode);
        setSelectedUnits([]);
    };

    // 所持しているユニットのリスト（1体以上）
    const availableUnits = allyUnits.filter(u => (ownedUnits[u.id] || 0) >= 1);

    // ユニット選択（クリックで追加/解除）
    const toggleUnit = (unitId: string) => {
        const owned = ownedUnits[unitId] || 0;
        const alreadySelected = selectedUnits.filter(id => id === unitId).length;

        // まだ追加できる場合（モード数未満かつ所持数以内）
        if (selectedUnits.length < fusionMode && alreadySelected < owned) {
            setSelectedUnits(prev => [...prev, unitId]);
        } else if (alreadySelected > 0) {
            // 追加できない場合は解除
            const idx = selectedUnits.lastIndexOf(unitId);
            if (idx >= 0) {
                setSelectedUnits(prev => [...prev.slice(0, idx), ...prev.slice(idx + 1)]);
            }
        }
    };

    // フュージョン確認モーダルを表示
    const handleFusionClick = () => {
        if (selectedUnits.length !== fusionMode || isFusing) return;
        setShowConfirmModal(true);
    };

    // フュージョン実行
    const handleFusion = async () => {
        if (selectedUnits.length !== fusionMode || isFusing) return;
        setIsFusing(true);
        setFusionError(null);

        try {
            // 選択されたユニットのレアリティ平均 → 結果レアリティ確率
            const selectedDefs = selectedUnits.map(id => allyUnits.find(u => u.id === id)!);
            const totalWeight = selectedDefs.reduce((sum, u) => sum + rarityWeights[u.rarity], 0);
            const avgWeight = totalWeight / fusionMode;

            // 結果レアリティを決定
            let resultRarity: Rarity;
            const roll = Math.random() * 100;

            if (fusionMode === 10) {
                // 10体モード: URが出やすい！
                if (avgWeight >= 8) {
                    // SSR以上が多い → UR高確率
                    if (roll < 30) resultRarity = "UR";
                    else if (roll < 70) resultRarity = "SSR";
                    else resultRarity = "SR";
                } else if (avgWeight >= 6) {
                    // SSRが多い
                    if (roll < 15) resultRarity = "UR";
                    else if (roll < 55) resultRarity = "SSR";
                    else resultRarity = "SR";
                } else if (avgWeight >= 4) {
                    // SR素材が多い
                    if (roll < 8) resultRarity = "UR";
                    else if (roll < 35) resultRarity = "SSR";
                    else if (roll < 75) resultRarity = "SR";
                    else resultRarity = "R";
                } else if (avgWeight >= 2) {
                    // R素材が多い
                    if (roll < 3) resultRarity = "UR";
                    else if (roll < 15) resultRarity = "SSR";
                    else if (roll < 45) resultRarity = "SR";
                    else if (roll < 80) resultRarity = "R";
                    else resultRarity = "N";
                } else {
                    // N素材が多い
                    if (roll < 1) resultRarity = "UR";
                    else if (roll < 5) resultRarity = "SSR";
                    else if (roll < 20) resultRarity = "SR";
                    else if (roll < 50) resultRarity = "R";
                    else resultRarity = "N";
                }
            } else {
                // 3体モード（従来のロジック）
                if (avgWeight >= 6) {
                    if (roll < 60) resultRarity = "SSR";
                    else resultRarity = "SR";
                } else if (avgWeight >= 4) {
                    if (roll < 20) resultRarity = "SSR";
                    else if (roll < 70) resultRarity = "SR";
                    else resultRarity = "R";
                } else if (avgWeight >= 2) {
                    if (roll < 5) resultRarity = "SSR";
                    else if (roll < 30) resultRarity = "SR";
                    else if (roll < 80) resultRarity = "R";
                    else resultRarity = "N";
                } else {
                    if (roll < 2) resultRarity = "SSR";
                    else if (roll < 8) resultRarity = "SR";
                    else if (roll < 30) resultRarity = "R";
                    else resultRarity = "N";
                }
            }

            // そのレアリティからランダムに1体選択
            const candidates = allyUnits.filter(u => u.rarity === resultRarity);
            const resultUnit = candidates[Math.floor(Math.random() * candidates.length)];

            // アトミック操作: 素材消費 + 結果追加を同時に実行
            // これにより素材だけ消費されて結果が得られないケースを防ぐ
            const success = executeFusion(selectedUnits, resultUnit.id);
            if (!success) {
                setFusionError(language === "ja" ? "素材が不足しています" : "Insufficient materials");
                setIsFusing(false);
                return; // 素材不足などで失敗
            }

            // Supabaseに即時保存
            await flushToSupabase();

            setSelectedUnits([]);
            setFusionResult(resultUnit);
            setShowVideo(true);

            // 動画再生
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play();
            }
        } catch (error) {
            console.error("Fusion error:", error);
            setFusionError(language === "ja" ? "フュージョンに失敗しました" : "Fusion failed");
            setIsFusing(false);
        }
    };

    // 動画終了
    const handleVideoEnd = () => {
        setShowVideo(false);
        setIsFusing(false);
    };

    // 選択中のユニット数（ユニットIDごと）
    const getSelectedCount = (unitId: string) => {
        return selectedUnits.filter(id => id === unitId).length;
    };

    // 動画ソース
    const videoSrc = fusionMode === 10 ? "/assets/videos/fusion_10x.mp4" : "/assets/videos/fusion.mp4";

    return (
        <main className="min-h-screen p-4">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <Link href="/" className="btn btn-secondary">
                    ← {t("back_to_home")}
                </Link>
                <h1 className="text-2xl font-bold">🔮 {t("fusion")}</h1>
                <LanguageSwitch />
            </div>

            {/* モード切替 */}
            <div className="flex justify-center gap-6 mb-6 flex-wrap">
                {/* 3体合成 */}
                <button
                    onClick={() => changeMode(3)}
                    className={`flex flex-col items-center p-4 rounded-2xl transition-all hover:scale-105 ${fusionMode === 3
                        ? "bg-gradient-to-b from-purple-600 to-pink-700 text-white shadow-xl scale-105 border-4 border-purple-300"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300 border-4 border-transparent"
                        }`}
                >
                    <img
                        src="/assets/ui/fusion_3slot.png"
                        alt={t("fusion_3_title")}
                        className="w-24 h-24 object-contain mb-2"
                    />
                    <div className="font-bold text-lg">{t("fusion_3_title")}</div>
                </button>

                {/* 10体超合成 */}
                <button
                    onClick={() => changeMode(10)}
                    className={`flex flex-col items-center p-4 rounded-2xl transition-all hover:scale-105 ${fusionMode === 10
                        ? "bg-gradient-to-b from-amber-500 via-pink-600 to-purple-700 text-white shadow-xl scale-105 border-4 border-yellow-300 animate-pulse"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300 border-4 border-transparent"
                        }`}
                >
                    <img
                        src="/assets/ui/fusion_main.png"
                        alt={t("fusion_10_title")}
                        className="w-28 h-28 object-contain mb-2"
                    />
                    <div className="font-bold text-lg">{t("fusion_10_title")}</div>
                </button>
            </div>

            {/* 説明 */}
            <div className={`rounded-lg p-4 mb-6 text-center ${fusionMode === 10 ? "bg-gradient-to-r from-amber-100 via-pink-100 to-purple-100" : "bg-amber-100"}`}>
                {fusionMode === 3 ? (
                    <p className="text-amber-800">{t("fusion_desc")}</p>
                ) : (
                    <div>
                        <p className="text-purple-800 font-bold text-lg">{t("fusion_10_mode")}</p>
                        <p className="text-pink-700 mt-1">{t("fusion_10_desc")}</p>
                        <p className="text-xs text-gray-600 mt-2">{t("fusion_10_hint")}</p>
                    </div>
                )}
            </div>

            {/* 選択スロット */}
            <div className="flex justify-center gap-2 mb-6 flex-wrap">
                {Array.from({ length: fusionMode }).map((_, i) => {
                    const unitId = selectedUnits[i];
                    const unitDef = unitId ? allyUnits.find(u => u.id === unitId) : null;
                    return (
                        <div
                            key={i}
                            onClick={() => {
                                // スロットにユニットがあればそのインデックスの要素を削除
                                if (unitId) {
                                    setSelectedUnits(prev => [...prev.slice(0, i), ...prev.slice(i + 1)]);
                                }
                            }}
                            className={`${fusionMode === 10 ? "w-14 h-16" : "w-20 h-24"} rounded-lg border-3 flex flex-col items-center justify-center transition-all ${unitDef
                                ? `${rarityColors[unitDef.rarity]} cursor-pointer hover:opacity-70 hover:scale-95 active:scale-90`
                                : fusionMode === 10 ? "bg-purple-200 border-purple-700" : "bg-amber-200 border-amber-700"
                                }`}
                            title={unitDef ? t("fusion_tap_remove") : ""}
                        >
                            {unitDef ? (
                                <div className="relative">
                                    <Image
                                        src={getSpritePath(unitDef.atlasKey || unitDef.baseUnitId || unitDef.id, unitDef.rarity)}
                                        alt={unitDef.name}
                                        width={fusionMode === 10 ? 32 : 48}
                                        height={fusionMode === 10 ? 32 : 48}
                                        className="object-contain"
                                    />
                                    {/* 解除マーク */}
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold shadow">
                                        ✕
                                    </div>
                                    {fusionMode === 3 && (
                                        <span className="text-xs mt-1 font-bold block text-center">{unitDef.name.slice(0, 5)}</span>
                                    )}
                                </div>
                            ) : (
                                <span className={`${fusionMode === 10 ? "text-purple-600 text-xl" : "text-amber-600 text-3xl"}`}>?</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 選択カウンター */}
            <div className="text-center mb-4">
                <span className={`text-lg font-bold ${selectedUnits.length === fusionMode ? "text-green-600" : "text-gray-600"}`}>
                    {selectedUnits.length} / {fusionMode}
                </span>
            </div>

            {/* フュージョンボタン */}
            <div className="text-center mb-6">
                <button
                    onClick={handleFusionClick}
                    disabled={selectedUnits.length !== fusionMode || isFusing}
                    className={`px-8 py-3 rounded-lg font-bold text-xl transition-all ${selectedUnits.length === fusionMode && !isFusing
                        ? fusionMode === 10
                            ? "bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 text-white hover:from-amber-600 hover:via-pink-600 hover:to-purple-700 shadow-lg animate-pulse"
                            : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                >
                    {isFusing ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin">⏳</span>
                            {t("processing")}
                        </span>
                    ) : (
                        fusionMode === 10 ? t("fusion_10_execute") : `🔮 ${t("fusion_execute")}`
                    )}
                </button>
            </div>

            {/* エラー表示 */}
            {fusionError && (
                <div className="text-center mb-6">
                    <div className="inline-block bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg">
                        <span className="mr-2">⚠️</span>
                        {fusionError}
                        <button
                            onClick={() => setFusionError(null)}
                            className="ml-3 text-red-500 hover:text-red-700 font-bold"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* 所持ユニット一覧 */}
            <div className="bg-amber-50 rounded-lg p-4">
                <h2 className="text-lg font-bold mb-4">{t("select_materials")}</h2>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                    {availableUnits.map(unit => {
                        const owned = ownedUnits[unit.id] || 0;
                        const selected = getSelectedCount(unit.id);
                        const canSelect = selected < owned && selectedUnits.length < fusionMode;

                        return (
                            <div
                                key={unit.id}
                                onClick={() => toggleUnit(unit.id)}
                                className={`relative cursor-pointer p-2 rounded-lg border-2 transition-all ${selected > 0
                                    ? "border-purple-500 bg-purple-50"
                                    : canSelect
                                        ? `${rarityColors[unit.rarity]} hover:opacity-80`
                                        : "border-gray-200 bg-gray-100 opacity-50"
                                    }`}
                            >
                                <Image
                                    src={getSpritePath(unit.atlasKey || unit.baseUnitId || unit.id, unit.rarity)}
                                    alt={unit.name}
                                    width={48}
                                    height={48}
                                    className="object-contain mx-auto"
                                />
                                <div className="text-center text-xs mt-1">{unit.name.slice(0, 4)}</div>
                                <div className="absolute top-1 right-1 bg-amber-500 text-white text-xs px-1 rounded">
                                    {owned}
                                </div>
                                {selected > 0 && (
                                    <div className="absolute top-1 left-1 bg-purple-500 text-white text-xs px-1 rounded">
                                        ×{selected}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {availableUnits.length === 0 && (
                    <p className="text-center text-gray-500 py-8">{t("no_units")}</p>
                )}
            </div>

            {/* フュージョン動画オーバーレイ */}
            {showVideo && (
                <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
                    <video
                        ref={videoRef}
                        src={videoSrc}
                        className="max-w-full max-h-full"
                        onEnded={handleVideoEnd}
                        autoPlay
                        muted
                        playsInline
                    />
                    <button
                        onClick={handleVideoEnd}
                        className="absolute top-4 right-4 text-white text-2xl hover:text-amber-400"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* 結果表示 */}
            {fusionResult && !showVideo && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-40 flex items-center justify-center">
                    <div className={`rounded-xl p-8 text-center max-w-sm ${fusionResult.rarity === "UR" ? "bg-gradient-to-br from-pink-100 via-purple-100 to-cyan-100" : "bg-amber-50"}`}>
                        <h2 className="text-2xl font-bold mb-4">
                            {fusionResult.rarity === "UR" ? t("fusion_jackpot") : `🎉 ${t("fusion_result")}`}
                        </h2>
                        <RarityFrame
                            unitId={fusionResult.id}
                            unitName={fusionResult.name}
                            rarity={fusionResult.rarity}
                            size="lg"
                        />
                        <div className="mt-4">
                            <span className={`text-sm font-bold px-2 py-1 rounded ${fusionResult.rarity === "UR" ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white animate-pulse" :
                                fusionResult.rarity === "SSR" ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" :
                                    fusionResult.rarity === "SR" ? "bg-purple-500 text-white" :
                                        fusionResult.rarity === "R" ? "bg-blue-500 text-white" :
                                            "bg-gray-400 text-white"
                                }`}>
                                {fusionResult.rarity}
                            </span>
                        </div>
                        <p className="text-xl font-bold mt-2">{fusionResult.name}</p>
                        <button
                            onClick={() => {
                                setFusionResult(null);
                                setIsFusing(false);
                            }}
                            className="mt-6 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                        >
                            {t("ok")}
                        </button>
                    </div>
                </div>
            )}

            {/* フュージョン確認モーダル */}
            <ConfirmModal
                isOpen={showConfirmModal}
                onClose={() => !isFusing && setShowConfirmModal(false)}
                onConfirm={() => {
                    setShowConfirmModal(false);
                    handleFusion();
                }}
                icon="🔮"
                title={t("confirm_fusion")}
                message={`${t("fusion_consume_units").replace("{count}", String(fusionMode))} ${t("fusion_warning")}`}
                confirmText={t("fusion_execute")}
                cancelText={t("cancel")}
                confirmColor="amber"
                isLoading={isFusing}
            />
        </main>
    );
}
