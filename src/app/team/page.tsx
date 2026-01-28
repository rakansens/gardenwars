"use client";

import { useEffect } from "react";
import Link from "next/link";
import unitsData from "@/data/units.json";
import type { UnitDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import { usePlayerData } from "@/hooks/usePlayerData";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみフィルタ
const allyUnits = allUnits.filter((u) => !u.id.startsWith("enemy_"));

export default function TeamPage() {
    const { selectedTeam, unitInventory, setTeam, isLoaded } = usePlayerData();

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

    if (!isLoaded) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl">読み込み中...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-8">
            {/* ヘッダー */}
            <div className="page-header mb-8">
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-amber-700 hover:text-amber-600">
                        ← ホームへ
                    </Link>
                    <h1 className="text-3xl font-bold">編成</h1>
                    <Link href="/stages" className="text-amber-700 hover:text-amber-600">
                        ステージへ →
                    </Link>
                </div>
            </div>

            <div className="container">
                {/* ガチャへのリンク */}
                <div className="mb-6 text-center">
                    <Link href="/gacha" className="btn btn-secondary">
                        🎰 ガチャを引く
                    </Link>
                </div>
                {/* 現在の編成 */}
                <section className="mb-8">
                    <h2 className="text-xl font-bold mb-4">
                        📋 出撃メンバー ({selectedTeam.length}/{MAX_TEAM_SIZE})
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
                                            />
                                            <div className="text-xs mt-1">{unit.name.slice(0, 4)}</div>
                                        </div>
                                    ) : (
                                        <span>+</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 所持ユニット */}
                <section>
                    <h2 className="text-xl font-bold mb-4">🎖️ 所持ユニット</h2>
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
                                    <div className="mx-auto mb-2 flex items-center justify-center">
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={unit.name}
                                            rarity={unit.rarity}
                                            size="lg"
                                            showLabel={true}
                                        />
                                    </div>

                                    {/* 名前 */}
                                    <h3 className="font-bold text-amber-950 mb-2">{unit.name}</h3>

                                    {/* ステータス */}
                                    <div className="text-xs text-amber-900/70 space-y-1">
                                        <div>❤️ HP: {unit.maxHp}</div>
                                        <div>⚔️ 攻撃: {unit.attackDamage}</div>
                                        <div>📏 射程: {unit.attackRange}</div>
                                        <div className="text-amber-700">💰 {unit.cost}</div>
                                    </div>

                                    {/* 選択状態 */}
                                    {isSelected && (
                                        <div className="mt-2 text-xs text-yellow-400 font-bold">
                                            ✓ 選択中
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 出撃ボタン */}
                <div className="mt-8 text-center">
                    <Link
                        href="/stages"
                        className={`btn btn-primary text-xl px-8 py-4 ${selectedTeam.length === 0
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                            }`}
                    >
                        ⚔️ 出撃準備完了！
                    </Link>
                </div>
            </div>
        </main>
    );
}
