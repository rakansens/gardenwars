"use client";

import { useState } from "react";
import Link from "next/link";
import unitsData from "@/data/units.json";
import playerData from "@/data/player.json";
import type { UnitDefinition } from "@/data/types";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみフィルタ
const allyUnits = allUnits.filter((u) => !u.id.startsWith("enemy_"));

export default function TeamPage() {
    // 初期編成
    const [selectedTeam, setSelectedTeam] = useState<string[]>(
        playerData.selectedTeam
    );

    const MAX_TEAM_SIZE = 5;

    const handleToggleUnit = (unitId: string) => {
        if (selectedTeam.includes(unitId)) {
            // 解除
            setSelectedTeam(selectedTeam.filter((id) => id !== unitId));
        } else {
            // 追加（上限チェック）
            if (selectedTeam.length < MAX_TEAM_SIZE) {
                setSelectedTeam([...selectedTeam, unitId]);
            }
        }
    };

    const getSelectedTeamDefs = () => {
        return selectedTeam
            .map((id) => allyUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
    };

    return (
        <main className="min-h-screen p-8">
            {/* ヘッダー */}
            <div className="page-header mb-8">
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-blue-400 hover:text-blue-300">
                        ← ホームへ
                    </Link>
                    <h1 className="text-3xl font-bold">編成</h1>
                    <Link href="/stages" className="text-green-400 hover:text-green-300">
                        ステージへ →
                    </Link>
                </div>
            </div>

            <div className="container">
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
                                            <div className="text-2xl">🐱</div>
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
                            return (
                                <div
                                    key={unit.id}
                                    className={`unit-card cursor-pointer ${isSelected ? "selected" : ""
                                        }`}
                                    onClick={() => handleToggleUnit(unit.id)}
                                >
                                    {/* アイコン */}
                                    <div className="text-4xl mb-2">🐱</div>

                                    {/* 名前 */}
                                    <h3 className="font-bold text-white mb-2">{unit.name}</h3>

                                    {/* ステータス */}
                                    <div className="text-xs text-gray-400 space-y-1">
                                        <div>❤️ HP: {unit.maxHp}</div>
                                        <div>⚔️ 攻撃: {unit.attackDamage}</div>
                                        <div>📏 射程: {unit.attackRange}</div>
                                        <div className="text-yellow-400">💰 {unit.cost}</div>
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
