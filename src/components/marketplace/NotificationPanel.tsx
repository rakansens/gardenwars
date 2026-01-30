"use client";

import { useMemo } from "react";
import { MarketplaceNotification } from "@/lib/supabase/marketplaceTypes";
import RarityFrame from "@/components/ui/RarityFrame";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";

interface NotificationPanelProps {
    notifications: MarketplaceNotification[];
    onClaim: (notificationId: string) => Promise<boolean>;
    isLoading?: boolean;
    t: (key: string) => string;
}

export default function NotificationPanel({
    notifications,
    onClaim,
    isLoading = false,
    t,
}: NotificationPanelProps) {
    if (notifications.length === 0 && !isLoading) {
        return (
            <div className="text-center py-8 text-gray-500">
                {t("no_notifications")}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {notifications.map((notification) => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClaim={onClaim}
                    t={t}
                />
            ))}
        </div>
    );
}

interface NotificationItemProps {
    notification: MarketplaceNotification;
    onClaim: (notificationId: string) => Promise<boolean>;
    t: (key: string) => string;
}

function NotificationItem({ notification, onClaim, t }: NotificationItemProps) {
    const unit = useMemo(() => {
        if (!notification.unitId) return null;
        return (unitsData as UnitDefinition[]).find((u) => u.id === notification.unitId);
    }, [notification.unitId]);

    const getIcon = () => {
        switch (notification.notificationType) {
            case "item_sold":
                return "💰";
            case "listing_expired":
                return "⏰";
            case "listing_cancelled":
                return "↩️";
            default:
                return "📬";
        }
    };

    const getTitle = () => {
        switch (notification.notificationType) {
            case "item_sold":
                return t("notification_item_sold");
            case "listing_expired":
                return t("notification_listing_expired");
            case "listing_cancelled":
                return t("notification_listing_cancelled");
            default:
                return t("notification");
        }
    };

    const getBgColor = () => {
        switch (notification.notificationType) {
            case "item_sold":
                return "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200";
            case "listing_expired":
                return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
            case "listing_cancelled":
                return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
            default:
                return "bg-white border-gray-200";
        }
    };

    const handleClaim = async () => {
        await onClaim(notification.id);
    };

    // 時間を人間が読める形式に
    const timeAgo = useMemo(() => {
        const diff = Date.now() - notification.createdAt.getTime();
        const minutes = Math.floor(diff / (60 * 1000));
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));

        if (minutes < 60) return `${minutes}${t("minutes_ago")}`;
        if (hours < 24) return `${hours}${t("hours_ago")}`;
        return `${days}${t("days_ago")}`;
    }, [notification.createdAt, t]);

    return (
        <div className={`p-4 rounded-xl border-2 ${getBgColor()}`}>
            <div className="flex items-start gap-3">
                {/* アイコン */}
                <div className="text-3xl">{getIcon()}</div>

                {/* コンテンツ */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-800">{getTitle()}</h4>
                        <span className="text-xs text-gray-400">{timeAgo}</span>
                    </div>

                    {/* ユニット情報 */}
                    {unit && (
                        <div className="flex items-center gap-2 mb-2">
                            <RarityFrame
                                unitId={unit.id}
                                unitName={unit.name}
                                rarity={unit.rarity}
                                size="xs"
                                showLabel={false}
                            />
                            <span className="text-sm text-gray-700">
                                {unit.name} x{notification.quantity}
                            </span>
                        </div>
                    )}

                    {/* 購入者名（売却の場合） */}
                    {notification.notificationType === "item_sold" && notification.buyerName && (
                        <div className="text-sm text-gray-600 mb-1">
                            {t("buyer")}: <span className="font-bold text-blue-600">{notification.buyerName}</span>
                        </div>
                    )}

                    {/* 獲得コイン（売却の場合） */}
                    {notification.notificationType === "item_sold" && notification.coinsEarned > 0 && (
                        <div className="text-sm text-amber-600 font-bold mb-2">
                            +{notification.coinsEarned.toLocaleString()} {t("coins")}
                        </div>
                    )}

                    {/* メッセージ */}
                    {notification.message && (
                        <p className="text-sm text-gray-600">{notification.message}</p>
                    )}
                </div>

                {/* 受け取るボタン */}
                <button
                    onClick={handleClaim}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg shadow hover:scale-105 transition-all active:scale-95 text-sm whitespace-nowrap"
                >
                    {notification.notificationType === "item_sold" ? t("claim_coins") : t("claim")}
                </button>
            </div>
        </div>
    );
}
