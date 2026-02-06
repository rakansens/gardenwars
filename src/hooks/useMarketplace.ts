"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayerData } from "./usePlayerData";
import {
    MarketplaceListing,
    MarketplaceNotification,
    ListingFilter,
} from "@/lib/supabase/marketplaceTypes";
import {
    createListing,
    getActiveListings,
    getMyListings,
    getSoldHistory,
    purchaseListing,
    cancelListing,
    getUnreadNotifications,
    getAllNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    claimNotification,
    getUnreadNotificationCount,
} from "@/lib/supabase/marketplace";

/**
 * Result type for purchase operations with user-friendly error messages
 */
export interface PurchaseActionResult {
    success: boolean;
    error?: string;
    userMessage?: string;
}

/**
 * Result type for claim operations with user-friendly error messages
 */
export interface ClaimActionResult {
    success: boolean;
    error?: string;
    userMessage?: string;
}

export interface UseMarketplaceReturn {
    // State
    listings: MarketplaceListing[];
    myListings: MarketplaceListing[];
    soldHistory: MarketplaceListing[];
    notifications: MarketplaceNotification[];
    unreadCount: number;
    isLoading: boolean;
    isAuthenticated: boolean;
    isPurchasing: boolean;
    isClaiming: boolean;

    // Actions
    refreshListings: (filter?: ListingFilter, force?: boolean) => Promise<void>;
    refreshMyListings: () => Promise<void>;
    refreshSoldHistory: () => Promise<void>;
    refreshNotifications: () => Promise<void>;
    refreshAll: () => Promise<void>;
    createNewListing: (
        unitId: string,
        quantity: number,
        pricePerUnit: number,
        expiresInDays?: number
    ) => Promise<boolean>;
    buyListing: (listingId: string) => Promise<PurchaseActionResult>;
    cancelMyListing: (listingId: string) => Promise<boolean>;
    claimSoldNotification: (notificationId: string) => Promise<ClaimActionResult>;
    markNotificationAsRead: (notificationId: string) => Promise<boolean>;
    markAllNotificationsAsRead: () => Promise<boolean>;
}

/**
 * マーケットプレイス管理フック
 * usePlayerDataと連携してコイン・ユニット管理を行う
 */
export function useMarketplace(): UseMarketplaceReturn {
    const { status, playerId } = useAuth();
    const { unitInventory, coins, addUnit, removeUnit, addCoins, spendCoins } = usePlayerData();
    const isAuthenticated = status === "authenticated" && !!playerId;

    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
    const [soldHistory, setSoldHistory] = useState<MarketplaceListing[]>([]);
    const [notifications, setNotifications] = useState<MarketplaceNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);

    const lastFetchRef = useRef<number>(0);
    const FETCH_COOLDOWN = 5000; // 5秒のクールダウン

    // リスティング一覧を取得
    const refreshListings = useCallback(
        async (filter?: ListingFilter, force: boolean = false) => {
            if (!isAuthenticated || !playerId) return;

            const now = Date.now();
            if (!force && now - lastFetchRef.current < FETCH_COOLDOWN) return;
            lastFetchRef.current = now;

            setIsLoading(true);
            try {
                const data = await getActiveListings(playerId, {
                    excludeOwnListings: false,
                    ...filter,
                });
                setListings(data);
            } catch (error) {
                console.error("Failed to refresh listings:", error);
            } finally {
                setIsLoading(false);
            }
        },
        [isAuthenticated, playerId]
    );

    // 自分の出品一覧を取得（activeのみ）
    const refreshMyListings = useCallback(async () => {
        if (!isAuthenticated || !playerId) return;

        try {
            const data = await getMyListings(playerId, false);
            setMyListings(data);
        } catch (error) {
            console.error("Failed to refresh my listings:", error);
        }
    }, [isAuthenticated, playerId]);

    // 売却履歴を取得
    const refreshSoldHistory = useCallback(async () => {
        if (!isAuthenticated || !playerId) return;

        try {
            const data = await getSoldHistory(playerId);
            setSoldHistory(data);
        } catch (error) {
            console.error("Failed to refresh sold history:", error);
        }
    }, [isAuthenticated, playerId]);

    // 通知を取得
    const refreshNotifications = useCallback(async () => {
        if (!isAuthenticated || !playerId) return;

        try {
            const [notifs, count] = await Promise.all([
                getUnreadNotifications(playerId),
                getUnreadNotificationCount(playerId),
            ]);
            setNotifications(notifs);
            setUnreadCount(count);
        } catch (error) {
            console.error("Failed to refresh notifications:", error);
        }
    }, [isAuthenticated, playerId]);

    // 全てをリフレッシュ（手動リフレッシュボタン用）
    const refreshAll = useCallback(async () => {
        if (!isAuthenticated || !playerId) return;

        setIsLoading(true);
        try {
            // 各操作を順番に実行し、個別のエラーをキャッチ
            const results = await Promise.allSettled([
                refreshListings(undefined, true),
                refreshMyListings(),
                refreshSoldHistory(),
                refreshNotifications(),
            ]);

            // エラーがあった場合はログに記録
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const operations = ['refreshListings', 'refreshMyListings', 'refreshSoldHistory', 'refreshNotifications'];
                    console.error(`Failed to ${operations[index]}:`, result.reason);
                }
            });
        } catch (error) {
            console.error("Unexpected error in refreshAll:", error);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, playerId, refreshListings, refreshMyListings, refreshSoldHistory, refreshNotifications]);

    // 初回読み込み
    useEffect(() => {
        if (isAuthenticated && playerId) {
            const loadInitialData = async () => {
                try {
                    await Promise.all([
                        refreshListings(),
                        refreshMyListings(),
                        refreshNotifications(),
                    ]);
                } catch (error) {
                    console.error("Failed to load initial marketplace data:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            loadInitialData();
        } else {
            setIsLoading(false);
        }
    }, [isAuthenticated, playerId, refreshListings, refreshMyListings, refreshNotifications]);

    // 新規出品
    const createNewListing = useCallback(
        async (
            unitId: string,
            quantity: number,
            pricePerUnit: number,
            expiresInDays?: number
        ): Promise<boolean> => {
            if (!isAuthenticated || !playerId) return false;

            // ローカルでの所持数チェック
            const ownedCount = unitInventory[unitId] || 0;
            if (ownedCount < quantity) {
                console.error("Not enough units to list");
                return false;
            }

            try {
                const listingId = await createListing(
                    playerId,
                    unitId,
                    quantity,
                    pricePerUnit,
                    expiresInDays
                );

                if (listingId) {
                    // Supabaseで既にユニット削除が処理済み
                    // リスト更新でSupabaseから最新状態を取得（重複削除を避ける）
                    await Promise.all([refreshListings(undefined, true), refreshMyListings()]);
                    return true;
                }
                return false;
            } catch (error) {
                console.error("Failed to create listing:", error);
                return false;
            }
        },
        [isAuthenticated, playerId, unitInventory, removeUnit, refreshListings, refreshMyListings]
    );

    // 購入
    const buyListing = useCallback(
        async (listingId: string): Promise<PurchaseActionResult> => {
            if (!isAuthenticated || !playerId) {
                return { success: false, error: "not_authenticated", userMessage: "Please log in to purchase" };
            }

            // Prevent double-clicks
            if (isPurchasing) {
                return { success: false, error: "in_progress", userMessage: "Purchase already in progress" };
            }

            // リスティングを見つける
            const listing = listings.find((l) => l.id === listingId);
            if (!listing) {
                return { success: false, error: "not_found", userMessage: "Listing not found" };
            }

            // コイン残高チェック
            if (coins < listing.totalPrice) {
                return { success: false, error: "insufficient_coins", userMessage: "Not enough coins" };
            }

            // 自分の出品は購入不可
            if (listing.isOwn) {
                return { success: false, error: "own_listing", userMessage: "Cannot buy your own listing" };
            }

            setIsPurchasing(true);
            try {
                const result = await purchaseListing(playerId, listingId);

                if (result.success) {
                    // Supabaseで既にコイン減算・ユニット追加が処理済み
                    // ローカル状態も同期させる
                    spendCoins(listing.totalPrice);
                    addUnit(listing.unitId, listing.quantity);

                    // リスト更新でSupabaseから最新状態を取得（重複更新を避ける）
                    await refreshListings(undefined, true);
                    return { success: true };
                }

                // Map backend errors to user-friendly messages
                let userMessage = result.message || "Purchase failed";
                if (result.error === "already_sold") {
                    userMessage = "Sorry, this item was just purchased by another buyer. Please try a different listing.";
                } else if (result.error === "expired") {
                    userMessage = "This listing has expired.";
                } else if (result.error === "insufficient_coins") {
                    userMessage = "Not enough coins to complete this purchase.";
                }

                return { success: false, error: result.error, userMessage };
            } catch (error) {
                console.error("Failed to buy listing:", error);
                return { success: false, error: "exception", userMessage: "An unexpected error occurred. Please try again." };
            } finally {
                setIsPurchasing(false);
            }
        },
        [isAuthenticated, playerId, listings, coins, isPurchasing, spendCoins, addUnit, refreshListings]
    );

    // 出品キャンセル
    const cancelMyListing = useCallback(
        async (listingId: string): Promise<boolean> => {
            if (!isAuthenticated || !playerId) return false;

            // リスティングを見つける
            const listing = myListings.find((l) => l.id === listingId);
            if (!listing || !listing.isOwn) {
                console.error("Listing not found or not owned");
                return false;
            }

            try {
                const success = await cancelListing(playerId, listingId);

                if (success) {
                    // Supabaseで既にユニット返却が処理済み
                    // ローカル状態も同期させる
                    addUnit(listing.unitId, listing.quantity);

                    // リスト更新でSupabaseから最新状態を取得（重複追加を避ける）
                    await Promise.all([refreshListings(undefined, true), refreshMyListings()]);
                    return true;
                }
                return false;
            } catch (error) {
                console.error("Failed to cancel listing:", error);
                return false;
            }
        },
        [isAuthenticated, playerId, myListings, addUnit, refreshListings, refreshMyListings]
    );

    // 売却通知を受け取る（コインを獲得）
    const claimSoldNotification = useCallback(
        async (notificationId: string): Promise<ClaimActionResult> => {
            if (!isAuthenticated || !playerId) {
                return { success: false, error: "not_authenticated", userMessage: "Please log in to claim" };
            }

            // Prevent double-clicks
            if (isClaiming) {
                return { success: false, error: "in_progress", userMessage: "Claim already in progress" };
            }

            // 通知を見つける
            const notification = notifications.find((n) => n.id === notificationId);
            if (!notification) {
                return { success: false, error: "not_found", userMessage: "Notification not found" };
            }

            setIsClaiming(true);
            try {
                const result = await claimNotification(playerId, notificationId);

                if (result.success) {
                    // Supabaseで既にコイン追加・ユニット返却が処理済み

                    // ローカル状態も同期させる（重要な修正：これが無いとClaimしてもコインが増えたように見えない）
                    if (notification.notificationType === "item_sold" && notification.coinsEarned) {
                        addCoins(notification.coinsEarned);
                    } else if (
                        (notification.notificationType === "listing_expired" || notification.notificationType === "listing_cancelled") &&
                        notification.unitId &&
                        notification.quantity
                    ) {
                        addUnit(notification.unitId, notification.quantity);
                    }

                    // 通知更新でSupabaseから最新状態を取得（重複処理を避ける）
                    await refreshNotifications();
                    return { success: true };
                }

                // Map backend errors to user-friendly messages
                let userMessage = result.message || "Claim failed";
                if (result.error === "already_claimed") {
                    userMessage = "This notification has already been claimed.";
                }

                return { success: false, error: result.error, userMessage };
            } catch (error) {
                console.error("Failed to claim notification:", error);
                return { success: false, error: "exception", userMessage: "An unexpected error occurred. Please try again." };
            } finally {
                setIsClaiming(false);
            }
        },
        [isAuthenticated, playerId, notifications, isClaiming, addCoins, addUnit, refreshNotifications]
    );

    // 通知を既読にする
    const markNotificationAsRead = useCallback(
        async (notificationId: string): Promise<boolean> => {
            try {
                const success = await markNotificationRead(notificationId);
                if (success) {
                    await refreshNotifications();
                }
                return success;
            } catch (error) {
                console.error("Failed to mark notification as read:", error);
                return false;
            }
        },
        [refreshNotifications]
    );

    // 全通知を既読にする
    const markAllNotificationsAsRead = useCallback(async (): Promise<boolean> => {
        if (!isAuthenticated || !playerId) return false;

        try {
            const success = await markAllNotificationsRead(playerId);
            if (success) {
                await refreshNotifications();
            }
            return success;
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
            return false;
        }
    }, [isAuthenticated, playerId, refreshNotifications]);

    return {
        // State
        listings,
        myListings,
        soldHistory,
        notifications,
        unreadCount,
        isLoading,
        isAuthenticated,
        isPurchasing,
        isClaiming,

        // Actions
        refreshListings,
        refreshMyListings,
        refreshSoldHistory,
        refreshNotifications,
        refreshAll,
        createNewListing,
        buyListing,
        cancelMyListing,
        claimSoldNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
    };
}
