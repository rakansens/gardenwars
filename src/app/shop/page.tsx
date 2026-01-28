"use client";

import { useState } from "react";
import Link from "next/link";
import { usePlayerData } from "@/hooks/usePlayerData";
import unitsData from "@/data/units.json";
import type { UnitDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";

const allUnits = unitsData as UnitDefinition[];

export default function ShopPage() {
    const { coins, shopItems, buyShopItem, isLoaded } = usePlayerData();
    const [viewingUnit, setViewingUnit] = useState<UnitDefinition | null>(null);
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [targetIndex, setTargetIndex] = useState<number>(-1);

    if (!isLoaded) {
        return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
    }

    const handleItemClick = (index: number) => {
        const item = shopItems[index];
        if (item.soldOut) return;
        setTargetIndex(index);
        setPurchaseModalOpen(true);
    };

    const handleBuy = () => {
        if (targetIndex === -1) return;
        const success = buyShopItem(targetIndex);
        if (success) {
            // Success Effect?
            alert("購入しました！");
            setPurchaseModalOpen(false);
        } else {
            alert("コインが足りません！");
        }
    };

    const targetItem = targetIndex !== -1 ? shopItems[targetIndex] : null;
    const targetUnit = targetItem ? allUnits.find(u => u.id === targetItem.unitId) : null;

    return (
        <main className="min-h-screen p-4 pb-24 bg-[#1a1a2e] text-white">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#1a1a2e]/90 z-20 p-2 backdrop-blur-sm border-b border-white/10">
                <Link href="/" className="btn btn-secondary text-sm">
                    ← ホーム
                </Link>
                <h1 className="text-2xl font-bold text-amber-400">🛒 フラッシュセール</h1>
                <div className="btn btn-primary pointer-events-none">
                    💰 {coins.toLocaleString()}
                </div>
            </div>

            {/* Hint */}
            <div className="text-center text-sm text-gray-400 mb-6">
                ステージクリアでラインナップが更新されます！<br />
                今だけの限定価格を見逃すな！
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-w-6xl mx-auto">
                {shopItems.map((item, index) => {
                    const unit = allUnits.find(u => u.id === item.unitId);
                    if (!unit) return null;

                    return (
                        <div
                            key={item.uid}
                            className={`relative p-2 rounded-xl border-2 transition-transform duration-200 
                                ${item.soldOut
                                    ? "bg-gray-800 border-gray-700 opacity-50 grayscale"
                                    : "bg-gradient-to-br from-indigo-900 to-slate-900 border-indigo-500 hover:scale-105 cursor-pointer shadow-lg"
                                }
                            `}
                            onClick={() => handleItemClick(index)}
                        >
                            {/* Discount Badge */}
                            {item.discount && !item.soldOut && (
                                <div className="absolute -top-3 -right-3 bg-red-600 text-white font-bold text-xs px-2 py-1 rounded-full z-10 animate-bounce">
                                    {item.discount}% OFF
                                </div>
                            )}

                            {/* Rare Badge */}
                            {item.isRare && !item.soldOut && !item.discount && (
                                <div className="absolute -top-3 -right-3 bg-amber-500 text-white font-bold text-xs px-2 py-1 rounded-full z-10">
                                    RARE!
                                </div>
                            )}

                            {/* Unit Icon */}
                            <div className="flex justify-center mb-2">
                                <RarityFrame
                                    unitId={unit.id}
                                    unitName={unit.name}
                                    rarity={unit.rarity}
                                    size="md"
                                    showLabel={false}
                                />
                            </div>

                            {/* Info */}
                            <div className="text-center">
                                <div className="text-xs font-bold truncate mb-1 text-indigo-100">
                                    {unit.name}
                                </div>
                                <div className={`text-sm font-bold ${item.soldOut ? "text-gray-500" : "text-amber-300"}`}>
                                    {item.soldOut ? "SOLD OUT" : `💰 ${item.price}`}
                                </div>
                            </div>

                            {/* Detail Button (Small trigger area) */}
                            <button
                                className="absolute top-1 left-1 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs hover:bg-white/30"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingUnit(unit);
                                }}
                            >
                                🔍
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Purchase Modal */}
            {purchaseModalOpen && targetItem && targetUnit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-slate-900 border-4 border-amber-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
                        {/* Background Glare */}
                        <div className="absolute -top-20 -left-20 w-60 h-60 bg-amber-500/20 blur-3xl rounded-full pointer-events-none"></div>

                        <h2 className="text-2xl font-bold mb-4 text-white">購入確認</h2>

                        <div className="flex justify-center mb-6">
                            <RarityFrame
                                unitId={targetUnit.id}
                                unitName={targetUnit.name}
                                rarity={targetUnit.rarity}
                                size="xl"
                                showLabel={true}
                            />
                        </div>

                        <div className="text-amber-300 text-3xl font-bold mb-6">
                            💰 {targetItem.price}
                        </div>

                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => setPurchaseModalOpen(false)}
                                className="px-6 py-3 rounded-xl bg-gray-600 font-bold hover:bg-gray-500 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleBuy}
                                disabled={coins < targetItem.price}
                                className={`px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition-transform hover:scale-105 
                                    ${coins < targetItem.price
                                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                        : "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                                    }`
                                }
                            >
                                {coins < targetItem.price ? "コイン不足" : "購入する"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={false}
                    isInTeam={false}
                    onClose={() => setViewingUnit(null)}
                    onToggleTeam={() => { }}
                />
            )}
        </main>
    );
}
