"use client";

import { useState } from "react";
import { useUnitDetailModal } from "@/hooks/useUnitDetailModal";
import { usePlayerData } from "@/hooks/usePlayerData";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";

const allUnits = unitsData as UnitDefinition[];

const REFRESH_COST = 100;

// レアリティカラー（ライト/ダークテーマ対応）
const rarityColors: Record<Rarity, { border: string; bg: string; glow: string }> = {
    N: { border: "border-gray-400", bg: "from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800", glow: "" },
    R: { border: "border-blue-400", bg: "from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50", glow: "shadow-blue-500/20" },
    SR: { border: "border-purple-400", bg: "from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/50", glow: "shadow-purple-500/30" },
    SSR: { border: "border-amber-400", bg: "from-amber-50 to-orange-100 dark:from-amber-900/50 dark:to-orange-800/50", glow: "shadow-amber-500/40" },
    UR: { border: "border-pink-400", bg: "from-pink-50 via-purple-50 to-cyan-50 dark:from-pink-900/50 dark:via-purple-900/50 dark:to-cyan-900/50", glow: "shadow-pink-500/50" },
};

export default function ShopPage() {
    const { coins, shopItems, buyShopItem, refreshShop, spendCoins, isLoaded } = usePlayerData();
    const { t } = useLanguage();
    const { viewingUnit, openModal, closeModal } = useUnitDetailModal();
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [targetIndex, setTargetIndex] = useState<number>(-1);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [purchaseSuccess, setPurchaseSuccess] = useState(false);

    if (!isLoaded) {
        return <LoadingSpinner icon="🛒" fullScreen />;
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
            setPurchaseSuccess(true);
            setTimeout(() => {
                setPurchaseSuccess(false);
                setPurchaseModalOpen(false);
            }, 1000);
        }
    };

    const handleRefresh = () => {
        if (coins < REFRESH_COST) return;
        setIsRefreshing(true);
        spendCoins(REFRESH_COST);
        setTimeout(() => {
            refreshShop();
            setIsRefreshing(false);
        }, 500);
    };

    const targetItem = targetIndex !== -1 ? shopItems[targetIndex] : null;
    const targetUnit = targetItem ? allUnits.find(u => u.id === targetItem.unitId) : null;

    const getUnitName = (unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    };

    return (
        <main className="min-h-screen">
            <PageHeader title={`🛒 ${t("shop_title")}`}>
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 text-white">
                    <span className="text-xl">💰</span>
                    <span className="text-lg">{coins.toLocaleString()}</span>
                </div>
            </PageHeader>

            <div className="container">
                {/* リフレッシュセクション */}
                <div className="card mb-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                            <h2 className="text-lg font-bold mb-1">{t("shop_hint")}</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {shopItems.filter(i => !i.soldOut).length} / {shopItems.length} {t("available")}
                            </p>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={coins < REFRESH_COST || isRefreshing}
                            className={`
                                px-6 py-3 md:px-8 md:py-4 rounded-2xl font-bold text-base md:text-lg transition-all min-h-[52px]
                                flex items-center gap-2 active:scale-95
                                ${coins < REFRESH_COST || isRefreshing
                                    ? "bg-gray-300 dark:bg-slate-600 text-gray-500 cursor-not-allowed"
                                    : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:scale-105 shadow-lg"
                                }
                            `}
                        >
                            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
                            <span>{t("refresh_shop")}</span>
                            <span className="bg-black/20 px-2 py-0.5 rounded-lg text-sm">💰 {REFRESH_COST}</span>
                        </button>
                    </div>
                </div>

                {/* 商品グリッド */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                    {shopItems.map((item, index) => {
                        const unit = allUnits.find(u => u.id === item.unitId);
                        if (!unit) return null;
                        const unitName = getUnitName(unit);
                        const colors = rarityColors[unit.rarity];

                        return (
                            <div
                                key={item.uid}
                                className={`
                                    relative rounded-2xl border-3 transition-all duration-200 overflow-hidden
                                    ${item.soldOut
                                        ? "bg-gray-200 dark:bg-slate-700 border-gray-300 dark:border-slate-600 opacity-60 grayscale"
                                        : `bg-gradient-to-br ${colors.bg} ${colors.border} hover:scale-105 cursor-pointer shadow-lg ${colors.glow}`
                                    }
                                `}
                                onClick={() => handleItemClick(index)}
                            >
                                {/* 割引バッジ */}
                                {item.discount && !item.soldOut && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-xs px-2.5 py-1.5 rounded-bl-xl rounded-tr-xl z-10 shadow-lg">
                                        -{item.discount}%
                                    </div>
                                )}

                                {/* レアバッジ */}
                                {item.isRare && !item.soldOut && !item.discount && (
                                    <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold text-xs px-2.5 py-1.5 rounded-bl-xl rounded-tr-xl z-10 shadow-lg animate-pulse">
                                        RARE
                                    </div>
                                )}

                                {/* 売り切れオーバーレイ */}
                                {item.soldOut && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 z-10">
                                        <div className="bg-gray-600 px-4 py-2 rounded-xl text-white font-bold">
                                            {t("sold_out")}
                                        </div>
                                    </div>
                                )}

                                {/* コンテンツ */}
                                <div className="p-3 md:p-4">
                                    {/* ユニット画像 */}
                                    <div className="flex justify-center mb-2">
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={unitName}
                                            rarity={unit.rarity}
                                            size="md"
                                            showLabel={true}
                                            baseUnitId={unit.baseUnitId}
                                        />
                                    </div>

                                    {/* ステータス */}
                                    <div className="flex justify-center gap-3 mb-2 text-xs">
                                        <span className="bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-lg text-green-700 dark:text-green-400 font-bold">❤️ {unit.maxHp}</span>
                                        <span className="bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-lg text-red-700 dark:text-red-400 font-bold">⚔️ {unit.attackDamage}</span>
                                    </div>

                                    {/* 名前 */}
                                    <div className="text-center mb-2">
                                        <div className="text-sm font-bold truncate text-gray-800 dark:text-white">
                                            {unitName}
                                        </div>
                                    </div>

                                    {/* 価格 */}
                                    <div className={`
                                        text-center py-2 rounded-xl font-bold text-lg
                                        ${item.soldOut
                                            ? "bg-gray-300 dark:bg-slate-600 text-gray-500"
                                            : "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                                        }
                                    `}>
                                        💰 {item.price.toLocaleString()}
                                    </div>
                                </div>

                                {/* 詳細ボタン */}
                                <button
                                    className="absolute top-2 left-2 w-8 h-8 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-sm transition-colors shadow"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openModal(unit);
                                    }}
                                >
                                    🔍
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* ヒント */}
                <div className="mt-8 text-center text-gray-600 dark:text-gray-400 text-sm">
                    💡 ステージをクリアしてコインを集めよう！
                </div>
            </div>

            {/* 購入確認モーダル */}
            {purchaseModalOpen && targetItem && targetUnit && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="card border-4 border-amber-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden my-auto sm:my-4">
                        {/* 背景エフェクト */}
                        <div className="absolute -top-20 -left-20 w-60 h-60 bg-amber-500/10 blur-3xl rounded-full pointer-events-none"></div>
                        <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-orange-500/10 blur-3xl rounded-full pointer-events-none"></div>

                        {purchaseSuccess ? (
                            <div className="py-12">
                                <div className="text-6xl mb-4 animate-bounce">🎉</div>
                                <div className="text-2xl font-bold text-green-600">{t("purchase_success") || "購入完了！"}</div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold mb-4 relative z-10">{t("confirm_purchase")}</h2>

                                <div className="flex justify-center mb-4 relative z-10">
                                    <RarityFrame
                                        unitId={targetUnit.id}
                                        unitName={getUnitName(targetUnit)}
                                        rarity={targetUnit.rarity}
                                        size="xl"
                                        showLabel={true}
                                        baseUnitId={targetUnit.baseUnitId}
                                    />
                                </div>

                                <div className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2 relative z-10">
                                    {getUnitName(targetUnit)}
                                </div>

                                <div className="bg-amber-100 dark:bg-amber-900/30 rounded-2xl p-4 mb-6 relative z-10">
                                    <div className="text-amber-700 dark:text-amber-400 text-3xl font-bold">
                                        💰 {targetItem.price.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {t("balance")}: 💰 {coins.toLocaleString()} → {(coins - targetItem.price).toLocaleString()}
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-center relative z-10">
                                    <button
                                        onClick={() => setPurchaseModalOpen(false)}
                                        className="px-6 py-3 rounded-xl bg-gray-400 dark:bg-slate-600 hover:bg-gray-500 dark:hover:bg-slate-500 text-white font-bold transition-all active:scale-95 min-h-[48px]"
                                    >
                                        {t("cancel")}
                                    </button>
                                    <button
                                        onClick={handleBuy}
                                        disabled={coins < targetItem.price}
                                        className={`
                                            px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 min-h-[48px]
                                            ${coins < targetItem.price
                                                ? "bg-gray-300 dark:bg-slate-600 text-gray-500 cursor-not-allowed"
                                                : "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:scale-105"
                                            }
                                        `}
                                    >
                                        {coins < targetItem.price ? t("not_enough_coins") : t("buy")}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 詳細モーダル */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={false}
                    isInTeam={false}
                    onClose={() => closeModal()}
                    onToggleTeam={() => { }}
                />
            )}
        </main>
    );
}
