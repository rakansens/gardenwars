"use client";

import { useMemo } from "react";
import RarityFrame from "@/components/ui/RarityFrame";
import { MarketplaceListing } from "@/lib/supabase/marketplaceTypes";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";

interface ListingCardProps {
    listing: MarketplaceListing;
    onBuy?: () => void;
    onCancel?: () => void;
    onDetail?: () => void;
    onSellerClick?: (sellerId: string, sellerName: string) => void;
    currentCoins?: number;
    t: (key: string) => string;
}

export default function ListingCard({
    listing,
    onBuy,
    onCancel,
    onDetail,
    onSellerClick,
    currentCoins = 0,
    t,
}: ListingCardProps) {
    const unit = useMemo(() => {
        return (unitsData as UnitDefinition[]).find((u) => u.id === listing.unitId);
    }, [listing.unitId]);

    if (!unit) return null;

    const canAfford = currentCoins >= listing.totalPrice;
    const isExpiringSoon = new Date(listing.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000; // 24時間以内

    // 残り時間を計算
    const timeLeft = useMemo(() => {
        const diff = new Date(listing.expiresAt).getTime() - Date.now();
        if (diff <= 0) return t("listing_expired");
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        if (days > 0) return `${days}${t("days_left")}`;
        return `${hours}${t("hours_left")}`;
    }, [listing.expiresAt, t]);

    return (
        <div
            className={`
                relative bg-white rounded-xl shadow-md overflow-hidden
                border-2 transition-all duration-200
                ${listing.isOwn ? "border-blue-300 bg-blue-50/50" : "border-gray-200"}
                hover:shadow-lg hover:scale-[1.02]
                active:scale-[0.98]
            `}
            onClick={onDetail}
        >
            {/* 自分の出品バッジ */}
            {listing.isOwn && (
                <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-br-lg z-10">
                    {t("my_listing")}
                </div>
            )}

            {/* 期限切れ警告 */}
            {isExpiringSoon && !listing.isOwn && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10 animate-pulse">
                    {t("expiring_soon")}
                </div>
            )}

            <div className="p-3">
                {/* ユニット画像とレアリティ */}
                <div className="flex justify-center mb-2">
                    <RarityFrame
                        unitId={unit.id}
                        unitName={unit.name}
                        rarity={unit.rarity}
                        size="md"
                        showLabel={true}
                        count={listing.quantity}
                    />
                </div>

                {/* ユニット名 */}
                <h3 className="text-sm font-bold text-gray-800 text-center truncate mb-1">
                    {unit.name}
                </h3>

                {/* 出品者名 */}
                <div className="text-center mb-2">
                    <span className="text-xs text-gray-500">{t("seller")}: </span>
                    {onSellerClick && !listing.isOwn ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSellerClick(listing.sellerId, listing.sellerName);
                            }}
                            className="text-sm font-bold text-blue-600 hover:text-blue-400 hover:underline transition-colors"
                        >
                            {listing.sellerName}
                        </button>
                    ) : (
                        <span className="text-sm font-bold text-blue-600">{listing.sellerName}</span>
                    )}
                </div>

                {/* 価格 */}
                <div className="flex items-center justify-center gap-1 mb-2">
                    <span className="text-lg font-bold text-amber-600">
                        {listing.pricePerUnit.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">
                        {t("coins_per_unit")}
                    </span>
                </div>

                {/* 合計価格（複数の場合） */}
                {listing.quantity > 1 && (
                    <div className="text-center text-xs text-gray-600 mb-2">
                        {t("total")}: <span className="font-bold text-amber-600">{listing.totalPrice.toLocaleString()}</span> {t("coins")}
                    </div>
                )}

                {/* 残り時間 */}
                <div className={`text-center text-xs mb-3 ${isExpiringSoon ? "text-red-500 font-bold" : "text-gray-400"}`}>
                    {timeLeft}
                </div>

                {/* アクションボタン */}
                {listing.isOwn ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel?.();
                        }}
                        className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-all active:scale-95 text-sm"
                    >
                        {t("cancel_listing")}
                    </button>
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onBuy?.();
                        }}
                        disabled={!canAfford}
                        className={`
                            w-full py-2 font-bold rounded-lg transition-all text-sm
                            ${canAfford
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:scale-105 active:scale-95 shadow-md"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            }
                        `}
                    >
                        {canAfford ? t("buy_now") : t("not_enough_coins")}
                    </button>
                )}
            </div>
        </div>
    );
}
