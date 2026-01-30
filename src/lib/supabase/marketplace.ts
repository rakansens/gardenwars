import { supabase } from "./client";
import {
    DBMarketplaceListing,
    DBMarketplaceNotification,
    MarketplaceListing,
    MarketplaceNotification,
    ListingFilter,
    toFrontendListing,
    toFrontendNotification,
    DEFAULT_LISTING_DURATION_DAYS,
    LISTINGS_PAGE_SIZE,
} from "./marketplaceTypes";
import { getPlayerData, savePlayerData } from "./playerData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// ============================================
// Listing Functions
// ============================================

/**
 * 新規出品を作成
 * @returns 作成されたリスティングID、失敗時はnull
 */
export async function createListing(
    sellerId: string,
    unitId: string,
    quantity: number,
    pricePerUnit: number,
    expiresInDays: number = DEFAULT_LISTING_DURATION_DAYS
): Promise<string | null> {
    // プレイヤーのインベントリを確認
    const playerData = await getPlayerData(sellerId);
    if (!playerData) return null;

    const inventory = playerData.unit_inventory ?? {};
    const ownedCount = inventory[unitId] || 0;

    // 所持数チェック
    if (ownedCount < quantity) {
        console.error("Not enough units to list:", { ownedCount, requested: quantity });
        return null;
    }

    // インベントリからユニットを減算
    const newInventory = { ...inventory };
    newInventory[unitId] = ownedCount - quantity;
    if (newInventory[unitId] <= 0) {
        delete newInventory[unitId];
    }

    const inventoryUpdated = await savePlayerData(sellerId, {
        unit_inventory: newInventory,
    });

    if (!inventoryUpdated) {
        console.error("Failed to update inventory");
        return null;
    }

    // リスティングを作成
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { data, error } = await (supabase as AnySupabase)
        .from("marketplace_listings")
        .insert({
            seller_id: sellerId,
            unit_id: unitId,
            quantity,
            price_per_unit: pricePerUnit,
            expires_at: expiresAt.toISOString(),
        })
        .select("id")
        .single();

    if (error || !data) {
        console.error("Failed to create listing:", error);
        // ロールバック: インベントリを元に戻す
        await savePlayerData(sellerId, { unit_inventory: inventory });
        return null;
    }

    return data.id;
}

/**
 * アクティブなリスティング一覧を取得
 */
export async function getActiveListings(
    currentPlayerId?: string,
    filter: ListingFilter = {}
): Promise<MarketplaceListing[]> {
    const {
        sortBy = "newest",
        unitId,
        minPrice,
        maxPrice,
        excludeOwnListings = false,
        limit = LISTINGS_PAGE_SIZE,
        offset = 0,
    } = filter;

    let query = (supabase as AnySupabase)
        .from("marketplace_listings")
        .select(`
            *,
            players!marketplace_listings_seller_id_fkey(name)
        `)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString());

    // フィルター適用
    if (unitId) {
        query = query.eq("unit_id", unitId);
    }
    if (minPrice !== undefined) {
        query = query.gte("price_per_unit", minPrice);
    }
    if (maxPrice !== undefined) {
        query = query.lte("price_per_unit", maxPrice);
    }
    if (excludeOwnListings && currentPlayerId) {
        query = query.neq("seller_id", currentPlayerId);
    }

    // ソート適用
    switch (sortBy) {
        case "price_asc":
            query = query.order("price_per_unit", { ascending: true });
            break;
        case "price_desc":
            query = query.order("price_per_unit", { ascending: false });
            break;
        case "oldest":
            query = query.order("created_at", { ascending: true });
            break;
        case "newest":
        default:
            query = query.order("created_at", { ascending: false });
            break;
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error || !data) {
        // テーブルが存在しない場合はエラーを抑制
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
            console.warn("Marketplace tables not yet created. Run the migration SQL.");
        } else if (error) {
            console.error("Failed to get listings:", error.message || error);
        }
        return [];
    }

    return data.map((row: DBMarketplaceListing & { players?: { name: string } | null }) => {
        return toFrontendListing(
            {
                ...row,
                seller_name: row.players?.name,
            },
            currentPlayerId
        );
    });
}

/**
 * 自分の出品一覧を取得
 */
export async function getMyListings(
    playerId: string,
    includeInactive: boolean = false
): Promise<MarketplaceListing[]> {
    let query = (supabase as AnySupabase)
        .from("marketplace_listings")
        .select(`
            *,
            players!marketplace_listings_seller_id_fkey(name)
        `)
        .eq("seller_id", playerId)
        .order("created_at", { ascending: false });

    if (!includeInactive) {
        query = query.eq("status", "active");
    }

    const { data, error } = await query;

    if (error || !data) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
            console.warn("Marketplace tables not yet created. Run the migration SQL.");
        } else if (error) {
            console.error("Failed to get my listings:", error.message || error);
        }
        return [];
    }

    return data.map((row: DBMarketplaceListing & { players?: { name: string } | null }) => {
        return toFrontendListing(
            {
                ...row,
                seller_name: row.players?.name,
            },
            playerId
        );
    });
}

/**
 * 売却履歴を取得
 */
export async function getSoldHistory(
    playerId: string,
    limit: number = 50
): Promise<MarketplaceListing[]> {
    const { data, error } = await (supabase as AnySupabase)
        .from("marketplace_listings")
        .select(`
            *,
            players!marketplace_listings_seller_id_fkey(name),
            buyer:players!marketplace_listings_buyer_id_fkey(name)
        `)
        .eq("seller_id", playerId)
        .eq("status", "sold")
        .order("sold_at", { ascending: false })
        .limit(limit);

    if (error || !data) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
            console.warn("Marketplace tables not yet created. Run the migration SQL.");
        } else if (error) {
            console.error("Failed to get sold history:", error.message || error);
        }
        return [];
    }

    return data.map((row: DBMarketplaceListing & { players?: { name: string } | null; buyer?: { name: string } | null }) => {
        const listing = toFrontendListing(
            {
                ...row,
                seller_name: row.players?.name,
            },
            playerId
        );
        // 購入者名を追加
        return {
            ...listing,
            buyerName: row.buyer?.name || "Unknown",
        };
    });
}

/**
 * リスティングを購入
 */
export async function purchaseListing(
    buyerId: string,
    listingId: string
): Promise<boolean> {
    // リスティングを取得
    const { data: listing, error: listingError } = await (supabase as AnySupabase)
        .from("marketplace_listings")
        .select("*")
        .eq("id", listingId)
        .eq("status", "active")
        .single();

    if (listingError || !listing) {
        console.error("Listing not found or not active:", listingError);
        return false;
    }

    const dbListing = listing as DBMarketplaceListing;

    // 自分の出品は購入不可
    if (dbListing.seller_id === buyerId) {
        console.error("Cannot purchase own listing");
        return false;
    }

    // 期限切れチェック
    if (new Date(dbListing.expires_at!) < new Date()) {
        console.error("Listing has expired");
        return false;
    }

    // 購入者のコインを確認
    const buyerData = await getPlayerData(buyerId);
    if (!buyerData) return false;

    const buyerCoins = buyerData.coins ?? 0;
    if (buyerCoins < dbListing.total_price) {
        console.error("Not enough coins:", { have: buyerCoins, need: dbListing.total_price });
        return false;
    }

    // トランザクション: 購入者からコインを減算
    const buyerUpdated = await savePlayerData(buyerId, {
        coins: buyerCoins - dbListing.total_price,
    });

    if (!buyerUpdated) {
        console.error("Failed to deduct coins from buyer");
        return false;
    }

    // トランザクション: 購入者にユニットを追加
    const buyerInventory = buyerData.unit_inventory ?? {};
    const currentCount = buyerInventory[dbListing.unit_id] || 0;
    const newBuyerInventory = {
        ...buyerInventory,
        [dbListing.unit_id]: currentCount + dbListing.quantity,
    };

    const inventoryUpdated = await savePlayerData(buyerId, {
        unit_inventory: newBuyerInventory,
    });

    if (!inventoryUpdated) {
        console.error("Failed to add units to buyer");
        // ロールバック: コインを戻す
        await savePlayerData(buyerId, { coins: buyerCoins });
        return false;
    }

    // リスティングをsoldに更新
    const { error: updateError } = await (supabase as AnySupabase)
        .from("marketplace_listings")
        .update({
            status: "sold",
            sold_at: new Date().toISOString(),
            buyer_id: buyerId,
        })
        .eq("id", listingId);

    if (updateError) {
        console.error("Failed to update listing status:", updateError);
        // ロールバック: コインとインベントリを戻す
        await savePlayerData(buyerId, {
            coins: buyerCoins,
            unit_inventory: buyerInventory,
        });
        return false;
    }

    // 購入者の名前を取得
    const buyerName = buyerData.name || "Unknown";

    // 出品者への通知を作成
    await createNotification(
        dbListing.seller_id,
        listingId,
        "item_sold",
        `Your ${dbListing.unit_id} x${dbListing.quantity} was sold for ${dbListing.total_price} coins!`,
        dbListing.total_price,
        dbListing.unit_id,
        dbListing.quantity,
        buyerName
    );

    return true;
}

/**
 * 出品をキャンセル（ユニットをインベントリに戻す）
 */
export async function cancelListing(
    playerId: string,
    listingId: string
): Promise<boolean> {
    // リスティングを取得
    const { data: listing, error: listingError } = await (supabase as AnySupabase)
        .from("marketplace_listings")
        .select("*")
        .eq("id", listingId)
        .eq("seller_id", playerId)
        .eq("status", "active")
        .single();

    if (listingError || !listing) {
        console.error("Listing not found or not owned by player:", listingError);
        return false;
    }

    const dbListing = listing as DBMarketplaceListing;

    // プレイヤーのインベントリにユニットを戻す
    const playerData = await getPlayerData(playerId);
    if (!playerData) return false;

    const inventory = playerData.unit_inventory ?? {};
    const currentCount = inventory[dbListing.unit_id] || 0;
    const newInventory = {
        ...inventory,
        [dbListing.unit_id]: currentCount + dbListing.quantity,
    };

    const inventoryUpdated = await savePlayerData(playerId, {
        unit_inventory: newInventory,
    });

    if (!inventoryUpdated) {
        console.error("Failed to return units to inventory");
        return false;
    }

    // リスティングをcancelledに更新
    const { error: updateError } = await (supabase as AnySupabase)
        .from("marketplace_listings")
        .update({ status: "cancelled" })
        .eq("id", listingId);

    if (updateError) {
        console.error("Failed to cancel listing:", updateError);
        // ロールバック: インベントリを元に戻す
        await savePlayerData(playerId, { unit_inventory: inventory });
        return false;
    }

    return true;
}

// ============================================
// Notification Functions
// ============================================

/**
 * 通知を作成
 */
async function createNotification(
    playerId: string,
    listingId: string | null,
    notificationType: "item_sold" | "listing_expired" | "listing_cancelled",
    message: string,
    coinsEarned: number = 0,
    unitId: string | null = null,
    quantity: number = 0,
    buyerName: string | null = null
): Promise<boolean> {
    const { error } = await (supabase as AnySupabase)
        .from("marketplace_notifications")
        .insert({
            player_id: playerId,
            listing_id: listingId,
            notification_type: notificationType,
            message,
            coins_earned: coinsEarned,
            unit_id: unitId,
            quantity,
            buyer_name: buyerName,
        });

    if (error) {
        console.error("Failed to create notification:", error);
        return false;
    }

    return true;
}

/**
 * 未読通知を取得
 */
export async function getUnreadNotifications(
    playerId: string
): Promise<MarketplaceNotification[]> {
    const { data, error } = await (supabase as AnySupabase)
        .from("marketplace_notifications")
        .select("*")
        .eq("player_id", playerId)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

    if (error || !data) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
            console.warn("Marketplace tables not yet created. Run the migration SQL.");
        } else if (error) {
            console.error("Failed to get notifications:", error.message || error);
        }
        return [];
    }

    return data.map((row: DBMarketplaceNotification) =>
        toFrontendNotification(row)
    );
}

/**
 * 全ての通知を取得
 */
export async function getAllNotifications(
    playerId: string,
    limit: number = 50
): Promise<MarketplaceNotification[]> {
    const { data, error } = await (supabase as AnySupabase)
        .from("marketplace_notifications")
        .select("*")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !data) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
            console.warn("Marketplace tables not yet created. Run the migration SQL.");
        } else if (error) {
            console.error("Failed to get all notifications:", error.message || error);
        }
        return [];
    }

    return data.map((row: DBMarketplaceNotification) =>
        toFrontendNotification(row)
    );
}

/**
 * 通知を既読にする
 */
export async function markNotificationRead(
    notificationId: string
): Promise<boolean> {
    const { error } = await (supabase as AnySupabase)
        .from("marketplace_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

    return !error;
}

/**
 * 全通知を既読にする
 */
export async function markAllNotificationsRead(
    playerId: string
): Promise<boolean> {
    const { error } = await (supabase as AnySupabase)
        .from("marketplace_notifications")
        .update({ is_read: true })
        .eq("player_id", playerId)
        .eq("is_read", false);

    return !error;
}

/**
 * 通知を処理（コインを受け取り、既読にする）
 */
export async function claimNotification(
    playerId: string,
    notificationId: string
): Promise<boolean> {
    // 通知を取得
    const { data: notification, error: notifError } = await (supabase as AnySupabase)
        .from("marketplace_notifications")
        .select("*")
        .eq("id", notificationId)
        .eq("player_id", playerId)
        .eq("is_read", false)
        .single();

    if (notifError || !notification) {
        console.error("Notification not found:", notifError);
        return false;
    }

    const dbNotif = notification as DBMarketplaceNotification;

    // コインを追加（item_soldの場合）
    if (dbNotif.notification_type === "item_sold" && dbNotif.coins_earned) {
        const playerData = await getPlayerData(playerId);
        if (!playerData) return false;

        const currentCoins = playerData.coins ?? 0;
        const coinsUpdated = await savePlayerData(playerId, {
            coins: currentCoins + dbNotif.coins_earned,
        });

        if (!coinsUpdated) {
            console.error("Failed to add coins");
            return false;
        }
    }

    // 期限切れ・キャンセルの場合はユニットを返却
    if (
        (dbNotif.notification_type === "listing_expired" ||
            dbNotif.notification_type === "listing_cancelled") &&
        dbNotif.unit_id &&
        dbNotif.quantity
    ) {
        const playerData = await getPlayerData(playerId);
        if (!playerData) return false;

        const inventory = playerData.unit_inventory ?? {};
        const currentCount = inventory[dbNotif.unit_id] || 0;
        const newInventory = {
            ...inventory,
            [dbNotif.unit_id]: currentCount + dbNotif.quantity,
        };

        const inventoryUpdated = await savePlayerData(playerId, {
            unit_inventory: newInventory,
        });

        if (!inventoryUpdated) {
            console.error("Failed to return units");
            return false;
        }
    }

    // 通知を既読にする
    return markNotificationRead(notificationId);
}

/**
 * 未読通知数を取得
 */
export async function getUnreadNotificationCount(
    playerId: string
): Promise<number> {
    const { count, error } = await (supabase as AnySupabase)
        .from("marketplace_notifications")
        .select("*", { count: "exact", head: true })
        .eq("player_id", playerId)
        .eq("is_read", false);

    if (error) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
            console.warn("Marketplace tables not yet created. Run the migration SQL.");
        } else {
            console.error("Failed to get notification count:", error.message || error);
        }
        return 0;
    }

    return count || 0;
}
