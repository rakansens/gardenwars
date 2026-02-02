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

export interface UseMarketplaceReturn {
    // State
    listings: MarketplaceListing[];
    myListings: MarketplaceListing[];
    soldHistory: MarketplaceListing[];
    notifications: MarketplaceNotification[];
    unreadCount: number;
    isLoading: boolean;
    isAuthenticated: boolean;

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
    buyListing: (listingId: string) => Promise<boolean>;
    cancelMyListing: (listingId: string) => Promise<boolean>;
    claimSoldNotification: (notificationId: string) => Promise<boolean>;
    markNotificationAsRead: (notificationId: string) => Promise<boolean>;
    markAllNotificationsAsRead: () => Promise<boolean>;
}

/**
 * マーケットプレイス管理フック
 * usePlayerDataと連携してコイン・ユニット管理を行う
 */
export function useMarketplace(): UseMarketplaceReturn {
    const { status, playerId } = useAuth();
    const { unitInventory, coins } = usePlayerData();
    const isAuthenticated = status === "authenticated" && !!playerId;

    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
    const [soldHistory, setSoldHistory] = useState<MarketplaceListing[]>([]);
    const [notifications, setNotifications] = useState<MarketplaceNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

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
        [isAuthenticated, playerId, unitInventory, refreshListings, refreshMyListings]
    );

    // 購入
    const buyListing = useCallback(
        async (listingId: string): Promise<boolean> => {
            if (!isAuthenticated || !playerId) return false;

            // リスティングを見つける
            const listing = listings.find((l) => l.id === listingId);
            if (!listing) {
                console.error("Listing not found");
                return false;
            }

            // コイン残高チェック
            if (coins < listing.totalPrice) {
                console.error("Not enough coins");
                return false;
            }

            // 自分の出品は購入不可
            if (listing.isOwn) {
                console.error("Cannot buy own listing");
                return false;
            }

            try {
                const success = await purchaseListing(playerId, listingId);

                if (success) {
                    // Supabaseで既にコイン減算・ユニット追加が処理済み
                    // リスト更新でSupabaseから最新状態を取得（重複更新を避ける）
                    await refreshListings(undefined, true);
                    return true;
                }
                return false;
            } catch (error) {
                console.error("Failed to buy listing:", error);
                return false;
            }
        },
        [isAuthenticated, playerId, listings, coins, refreshListings]
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
        [isAuthenticated, playerId, myListings, refreshListings, refreshMyListings]
    );

    // 売却通知を受け取る（コインを獲得）
    const claimSoldNotification = useCallback(
        async (notificationId: string): Promise<boolean> => {
            if (!isAuthenticated || !playerId) return false;

            // 通知を見つける
            const notification = notifications.find((n) => n.id === notificationId);
            if (!notification) {
                console.error("Notification not found");
                return false;
            }

            try {
                const success = await claimNotification(playerId, notificationId);

                if (success) {
                    // Supabaseで既にコイン追加・ユニット返却が処理済み
                    // 通知更新でSupabaseから最新状態を取得（重複処理を避ける）
                    await refreshNotifications();
                    return true;
                }
                return false;
            } catch (error) {
                console.error("Failed to claim notification:", error);
                return false;
            }
        },
        [isAuthenticated, playerId, notifications, refreshNotifications]
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
