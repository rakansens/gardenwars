"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import playerData from "@/data/player.json";
import unitsData from "@/data/units.json";
import type { UnitDefinition, Rarity } from "@/data/types";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";
import RarityFrame from "@/components/ui/RarityFrame";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみ（enemy_で始まらない）
const allyUnits = allUnits.filter(u => !u.id.startsWith("enemy_"));

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

export default function FusionPage() {
    const { t } = useLanguage();
    const [ownedUnits, setOwnedUnits] = useState<Record<string, number>>({});
    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
    const [fusionResult, setFusionResult] = useState<UnitDefinition | null>(null);
    const [showVideo, setShowVideo] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // LocalStorageから読み込み
        const saved = localStorage.getItem("gardenwars_player");
        if (saved) {
            const data = JSON.parse(saved);
            // LocalStorageのownedUnitsはRecord<string, number>形式
            setOwnedUnits(data.ownedUnits || data.unitInventory || {});
        } else {
            // player.jsonのunitInventoryを使用
            setOwnedUnits(playerData.unitInventory);
        }
    }, []);

    // 所持しているユニットのリスト（1体以上）
    const availableUnits = allyUnits.filter(u => (ownedUnits[u.id] || 0) >= 1);

    // ユニット選択（クリックで追加/解除）
    const toggleUnit = (unitId: string) => {
        const owned = ownedUnits[unitId] || 0;
        const alreadySelected = selectedUnits.filter(id => id === unitId).length;

        // まだ追加できる場合（3体未満かつ所持数以内）
        if (selectedUnits.length < 3 && alreadySelected < owned) {
            setSelectedUnits(prev => [...prev, unitId]);
        } else if (alreadySelected > 0) {
            // 追加できない場合は解除
            const idx = selectedUnits.lastIndexOf(unitId);
            if (idx >= 0) {
                setSelectedUnits(prev => [...prev.slice(0, idx), ...prev.slice(idx + 1)]);
            }
        }
    };

    // フュージョン実行
    const executeFusion = () => {
        if (selectedUnits.length !== 3) return;

        // 選択されたユニットのレアリティ平均 → 結果レアリティ確率
        const selectedDefs = selectedUnits.map(id => allyUnits.find(u => u.id === id)!);
        const totalWeight = selectedDefs.reduce((sum, u) => sum + rarityWeights[u.rarity], 0);
        const avgWeight = totalWeight / 3;

        // 結果レアリティを決定
        let resultRarity: Rarity;
        const roll = Math.random() * 100;

        if (avgWeight >= 6) {
            // SSR素材が多い
            if (roll < 30) resultRarity = "SSR";
            else if (roll < 60) resultRarity = "SR";
            else if (roll < 85) resultRarity = "R";
            else resultRarity = "N";
        } else if (avgWeight >= 4) {
            // SR素材が多い
            if (roll < 15) resultRarity = "SSR";
            else if (roll < 45) resultRarity = "SR";
            else if (roll < 80) resultRarity = "R";
            else resultRarity = "N";
        } else if (avgWeight >= 2) {
            // R素材が多い
            if (roll < 5) resultRarity = "SSR";
            else if (roll < 20) resultRarity = "SR";
            else if (roll < 60) resultRarity = "R";
            else resultRarity = "N";
        } else {
            // N素材のみ
            if (roll < 2) resultRarity = "SSR";
            else if (roll < 8) resultRarity = "SR";
            else if (roll < 30) resultRarity = "R";
            else resultRarity = "N";
        }

        // そのレアリティからランダムに1体選択
        const candidates = allyUnits.filter(u => u.rarity === resultRarity);
        const resultUnit = candidates[Math.floor(Math.random() * candidates.length)];

        // 素材ユニットを消費
        const newOwned = { ...ownedUnits };
        selectedUnits.forEach(id => {
            newOwned[id] = (newOwned[id] || 1) - 1;
            if (newOwned[id] <= 0) delete newOwned[id];
        });

        // 結果ユニットを追加
        newOwned[resultUnit.id] = (newOwned[resultUnit.id] || 0) + 1;

        // LocalStorageに保存
        const saved = localStorage.getItem("gardenwars_player");
        const data = saved ? JSON.parse(saved) : { ...playerData };
        data.ownedUnits = newOwned;
        localStorage.setItem("gardenwars_player", JSON.stringify(data));

        setOwnedUnits(newOwned);
        setSelectedUnits([]);
        setFusionResult(resultUnit);
        setShowVideo(true);

        // 動画再生
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    };

    // 動画終了
    const handleVideoEnd = () => {
        setShowVideo(false);
    };

    // 選択中のユニット数（ユニットIDごと）
    const getSelectedCount = (unitId: string) => {
        return selectedUnits.filter(id => id === unitId).length;
    };

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

            {/* 説明 */}
            <div className="bg-amber-100 rounded-lg p-4 mb-6 text-center">
                <p className="text-amber-800">{t("fusion_desc")}</p>
            </div>

            {/* 選択スロット */}
            <div className="flex justify-center gap-4 mb-6">
                {[0, 1, 2].map(i => {
                    const unitId = selectedUnits[i];
                    const unitDef = unitId ? allyUnits.find(u => u.id === unitId) : null;
                    return (
                        <div
                            key={i}
                            className={`w-20 h-24 rounded-lg border-3 flex flex-col items-center justify-center ${unitDef ? rarityColors[unitDef.rarity] : "bg-amber-200 border-amber-700"
                                }`}
                        >
                            {unitDef ? (
                                <>
                                    <Image
                                        src={`/assets/sprites/${unitDef.id}.png`}
                                        alt={unitDef.name}
                                        width={48}
                                        height={48}
                                        className="object-contain"
                                    />
                                    <span className="text-xs mt-1 font-bold">{unitDef.name.slice(0, 5)}</span>
                                </>
                            ) : (
                                <span className="text-amber-600 text-3xl">?</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* フュージョンボタン */}
            <div className="text-center mb-6">
                <button
                    onClick={executeFusion}
                    disabled={selectedUnits.length !== 3}
                    className={`px-8 py-3 rounded-lg font-bold text-xl transition-all ${selectedUnits.length === 3
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                >
                    🔮 {t("fusion_execute")}
                </button>
            </div>

            {/* 所持ユニット一覧 */}
            <div className="bg-amber-50 rounded-lg p-4">
                <h2 className="text-lg font-bold mb-4">{t("select_materials")}</h2>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                    {availableUnits.map(unit => {
                        const owned = ownedUnits[unit.id] || 0;
                        const selected = getSelectedCount(unit.id);
                        const canSelect = selected < owned && selectedUnits.length < 3;

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
                                    src={`/assets/sprites/${unit.id}.png`}
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
                        src="/assets/videos/fusion.mp4"
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
                    <div className="bg-amber-50 rounded-xl p-8 text-center max-w-sm">
                        <h2 className="text-2xl font-bold mb-4">🎉 {t("fusion_result")}</h2>
                        <RarityFrame
                            unitId={fusionResult.id}
                            unitName={fusionResult.name}
                            rarity={fusionResult.rarity}
                            size="lg"
                        />
                        <div className="mt-4">
                            <span className={`text-sm font-bold px-2 py-1 rounded ${fusionResult.rarity === "SSR" ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" :
                                fusionResult.rarity === "SR" ? "bg-purple-500 text-white" :
                                    fusionResult.rarity === "R" ? "bg-blue-500 text-white" :
                                        "bg-gray-400 text-white"
                                }`}>
                                {fusionResult.rarity}
                            </span>
                        </div>
                        <p className="text-xl font-bold mt-2">{fusionResult.name}</p>
                        <button
                            onClick={() => setFusionResult(null)}
                            className="mt-6 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                        >
                            {t("ok")}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
