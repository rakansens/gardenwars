"use client";

import { useState } from "react";
import Link from "next/link";
import unitsData from "@/data/units.json";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import { hasAnimation } from "@/components/ui/UnitAnimationPreview";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみフィルタ
const allyUnits = allUnits.filter((u) => !u.id.startsWith("enemy_"));

export default function TeamPage() {
    const { selectedTeam, unitInventory, setTeam, isLoaded, activeLoadoutIndex, switchLoadout } = usePlayerData();
    const { t } = useLanguage();
    const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [viewingUnit, setViewingUnit] = useState<UnitDefinition | null>(null);

    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gray-500" },
        { key: "N", label: "N", color: "bg-gray-400" },
        { key: "R", label: "R", color: "bg-blue-500" },
        { key: "SR", label: "SR", color: "bg-purple-500" },
        { key: "SSR", label: "SSR", color: "bg-amber-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

    const filteredUnits = rarityFilter === "ALL"
        ? allyUnits
        : allyUnits.filter(u => u.rarity === rarityFilter);
    const MAX_TEAM_SIZE = 8;

    const handleToggleUnit = (unitId: string) => {
        if (selectedTeam.includes(unitId)) {
            // 解除
            setTeam(selectedTeam.filter((id) => id !== unitId));
        } else {
            // 追加（上限チェック）
            if (selectedTeam.length < MAX_TEAM_SIZE) {
                setTeam([...selectedTeam, unitId]);
            }
        }
    };

    const handleUnitClick = (unit: UnitDefinition) => {
        setViewingUnit(unit);
    };

    const getSelectedTeamDefs = () => {
        return selectedTeam
            .map((id) => allyUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
    };

    // チームの合計コストを計算
    const getTotalCost = () => {
        return getSelectedTeamDefs().reduce((sum, unit) => sum + unit.cost, 0);
    };

    if (!isLoaded) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl">{t("loading")}</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-4 md:p-8">
            {/* ヘッダー */}
            <div className="page-header mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold">{t("team_title")}</h1>
                    <div className="flex items-center gap-2">
                        <LanguageSwitch />
                        <Link href="/stages" className="btn btn-primary">
                            ⚔️ {t("to_stages")}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container">
                {/* 現在の編成 */}
                <section className="mb-8">
                    {/* ロードアウト切り替えタブ */}
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-xl font-bold">
                            📋 {t("team_members")} ({selectedTeam.length}/{MAX_TEAM_SIZE})
                        </h2>
                        <div className="flex gap-2">
                            {[0, 1, 2].map((idx) => (
                                <button
                                    key={idx}
                                    onClick={() => switchLoadout(idx)}
                                    className={`
                                        px-4 py-2 rounded-lg font-bold text-sm transition-all
                                        ${activeLoadoutIndex === idx
                                            ? "bg-orange-500 text-white shadow-lg scale-105"
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                        }
                                    `}
                                >
                                    {idx === 0 ? "🅰️" : idx === 1 ? "🅱️" : "🅲"} Deck {idx + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
                            const unit = getSelectedTeamDefs()[index];
                            return (
                                <div
                                    key={index}
                                    className={`slot ${unit ? "filled cursor-pointer" : ""}`}
                                    onClick={() => unit && handleToggleUnit(unit.id)}
                                    title={unit ? `${t("click_to_remove") || "タップで解除"}` : undefined}
                                >
                                    {unit ? (
                                        <div className="text-center relative">
                                            {/* 解除アイコン */}
                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center shadow-md z-10">
                                                ×
                                            </div>
                                            <RarityFrame
                                                unitId={unit.id}
                                                unitName={unit.name}
                                                rarity={unit.rarity}
                                                size="sm"
                                                showLabel={true}
                                                baseUnitId={unit.baseUnitId}
                                            />
                                            <div className="text-xs mt-1">{unit.name.slice(0, 4)}</div>
                                            <div className="text-xs text-amber-600 font-bold">¥{unit.cost}</div>
                                        </div>
                                    ) : (
                                        <span>+</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {/* 合計コスト表示 */}
                    <div className="mt-4 text-lg font-bold text-amber-700">
                        💰 {t("total_cost")}: ¥{getTotalCost()}
                    </div>
                </section>

                {/* 所持ユニット */}
                <section>
                    <h2 className="text-xl font-bold mb-4">🎖️ {t("owned_units")}</h2>

                    {/* レアリティフィルタータブ */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                        {rarityTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setRarityFilter(tab.key)}
                                className={`
                                    px-4 py-2 rounded-lg font-bold text-sm transition-all
                                    ${rarityFilter === tab.key
                                        ? `${tab.color} text-white shadow-lg scale-105`
                                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }
                                `}
                            >
                                {tab.label}
                                <span className="ml-1 text-xs opacity-75">
                                    ({tab.key === "ALL"
                                        ? allyUnits.length
                                        : allyUnits.filter(u => u.rarity === tab.key).length})
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredUnits.map((unit) => {
                            const isSelected = selectedTeam.includes(unit.id);
                            const count = unitInventory[unit.id] || 0;
                            const unitHasAnimation = hasAnimation(unit.atlasKey || unit.id);
                            return (
                                <div
                                    key={unit.id}
                                    className={`unit-card cursor-pointer relative ${isSelected ? "selected" : ""
                                        }`}
                                    onClick={() => handleUnitClick(unit)}
                                >
                                    {/* 所持個数バッジ */}
                                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10">
                                        {count}
                                    </div>

                                    {/* アニメーションバッジ */}
                                    {unitHasAnimation && (
                                        <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10" title="Has Animation">
                                            🎬
                                        </div>
                                    )}

                                    {/* アイコン */}
                                    <RarityFrame
                                        unitId={unit.id}
                                        unitName={unit.name}
                                        rarity={unit.rarity}
                                        size="md"
                                        showLabel={true}
                                        baseUnitId={unit.baseUnitId}
                                        grayscale={count === 0}
                                    />

                                    {/* ユニット名 */}
                                    <div className="mt-2 text-center">
                                        <div className="font-medium text-sm">{unit.name}</div>
                                    </div>

                                    {/* ステータス */}
                                    <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                                        <div className="flex justify-between">
                                            <span>❤️ {t("hp")}:</span>
                                            <span className="font-bold">{unit.maxHp}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>⚔️ {t("attack")}:</span>
                                            <span className="font-bold">{unit.attackDamage}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>📏 {t("range")}:</span>
                                            <span className="font-bold">{unit.attackRange}</span>
                                        </div>
                                        <div className="flex justify-between text-amber-600">
                                            <span>💰 {t("cost")}:</span>
                                            <span className="font-bold">¥{unit.cost}</span>
                                        </div>
                                    </div>

                                    {/* 選択マーク */}
                                    {isSelected && (
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl">
                                            ✓
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* 詳細モーダル */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={(unitInventory[viewingUnit.id] || 0) > 0}
                    isInTeam={selectedTeam.includes(viewingUnit.id)}
                    onClose={() => setViewingUnit(null)}
                    onToggleTeam={() => handleToggleUnit(viewingUnit.id)}
                />
            )}
        </main>
    );
}
