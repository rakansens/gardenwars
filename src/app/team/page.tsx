"use client";

import Link from "next/link";
import unitsData from "@/data/units.json";
import type { UnitDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみフィルタ
const allyUnits = allUnits.filter((u) => !u.id.startsWith("enemy_"));

export default function TeamPage() {
    const { selectedTeam, unitInventory, setTeam, isLoaded } = usePlayerData();
    const { t } = useLanguage();

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
                    <h2 className="text-xl font-bold mb-4">
                        📋 {t("team_members")} ({selectedTeam.length}/{MAX_TEAM_SIZE})
                    </h2>
                    <div className="flex gap-4 flex-wrap">
                        {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
                            const unit = getSelectedTeamDefs()[index];
                            return (
                                <div
                                    key={index}
                                    className={`slot ${unit ? "filled" : ""}`}
                                    onClick={() => unit && handleToggleUnit(unit.id)}
                                >
                                    {unit ? (
                                        <div className="text-center">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {allyUnits.map((unit) => {
                            const isSelected = selectedTeam.includes(unit.id);
                            const count = unitInventory[unit.id] || 0;
                            return (
                                <div
                                    key={unit.id}
                                    className={`unit-card cursor-pointer relative ${isSelected ? "selected" : ""
                                        }`}
                                    onClick={() => handleToggleUnit(unit.id)}
                                >
                                    {/* 所持個数バッジ */}
                                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10">
                                        {count}
                                    </div>

                                    {/* アイコン */}
                                    <RarityFrame
                                        unitId={unit.id}
                                        unitName={unit.name}
                                        rarity={unit.rarity}
                                        size="md"
                                        showLabel={true}
                                        baseUnitId={unit.baseUnitId}
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
        </main>
    );
}
