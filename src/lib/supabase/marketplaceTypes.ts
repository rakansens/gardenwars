/**
 * Marketplace データベース型定義
 *
 * 命名規則:
 * - DB* : データベースのカラム名（snake_case）
 * - *   : フロントエンド用（camelCase）
 */

// ============================================
// データベース型（snake_case）
// ============================================

/**
 * marketplace_listings テーブル
 */
export interface DBMarketplaceListing {
    id: string;
    seller_id: string;
    unit_id: string;
    quantity: number;
    price_per_unit: number;
    total_price: number;  // Generated column
    status: 'active' | 'sold' | 'expired' | 'cancelled';
    created_at: string | null;
    expires_at: string | null;
    sold_at: string | null;
    buyer_id: string | null;
    updated_at: string | null;
}

/**
 * marketplace_notifications テーブル
 */
export interface DBMarketplaceNotification {
    id: string;
    player_id: string;
    listing_id: string | null;
    notification_type: 'item_sold' | 'listing_expired' | 'listing_cancelled';
    message: string | null;
    coins_earned: number | null;
    unit_id: string | null;
    quantity: number | null;
    is_read: boolean;
    created_at: string | null;
}

// ============================================
// フロントエンド型（camelCase）
// ============================================

/**
 * フロントエンドで使用するマーケットリスティング
 */
export interface MarketplaceListing {
    id: string;
    sellerId: string;
    sellerName: string;  // Joined from players table
    unitId: string;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
    status: 'active' | 'sold' | 'expired' | 'cancelled';
    createdAt: Date;
    expiresAt: Date;
    isOwn: boolean;  // Computed: is current player the seller
}

/**
 * フロントエンドで使用する通知
 */
export interface MarketplaceNotification {
    id: string;
    playerId: string;
    listingId: string | null;
    notificationType: 'item_sold' | 'listing_expired' | 'listing_cancelled';
    message: string;
    coinsEarned: number;
    unitId: string | null;
    quantity: number;
    isRead: boolean;
    createdAt: Date;
}

// ============================================
// リクエスト・レスポンス型
// ============================================

/**
 * 出品作成リクエスト
 */
export interface CreateListingRequest {
    unitId: string;
    quantity: number;
    pricePerUnit: number;
    expiresInDays?: number;  // デフォルト: 7日
}

/**
 * 購入リクエスト
 */
export interface PurchaseRequest {
    listingId: string;
}

/**
 * リスティング検索フィルター
 */
export interface ListingFilter {
    sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
    unitId?: string;
    minPrice?: number;
    maxPrice?: number;
    excludeOwnListings?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * マーケットプレイス統計
 */
export interface MarketplaceStats {
    activeListings: number;
    totalSales: number;
    averagePrice: number;
}

// ============================================
// 型変換ユーティリティ
// ============================================

/**
 * DBMarketplaceListing → MarketplaceListing 変換
 */
export function toFrontendListing(
    db: DBMarketplaceListing & { seller_name?: string },
    currentPlayerId?: string
): MarketplaceListing {
    return {
        id: db.id,
        sellerId: db.seller_id,
        sellerName: db.seller_name || 'Unknown',
        unitId: db.unit_id,
        quantity: db.quantity,
        pricePerUnit: db.price_per_unit,
        totalPrice: db.total_price,
        status: db.status,
        createdAt: new Date(db.created_at || Date.now()),
        expiresAt: new Date(db.expires_at || Date.now()),
        isOwn: currentPlayerId ? db.seller_id === currentPlayerId : false,
    };
}

/**
 * DBMarketplaceNotification → MarketplaceNotification 変換
 */
export function toFrontendNotification(
    db: DBMarketplaceNotification
): MarketplaceNotification {
    return {
        id: db.id,
        playerId: db.player_id,
        listingId: db.listing_id,
        notificationType: db.notification_type,
        message: db.message || '',
        coinsEarned: db.coins_earned || 0,
        unitId: db.unit_id,
        quantity: db.quantity || 0,
        isRead: db.is_read,
        createdAt: new Date(db.created_at || Date.now()),
    };
}

// ============================================
// 定数
// ============================================

/**
 * デフォルトの出品期間（日数）
 */
export const DEFAULT_LISTING_DURATION_DAYS = 7;

/**
 * 最小出品価格
 */
export const MIN_LISTING_PRICE = 1;

/**
 * 最大出品価格
 */
export const MAX_LISTING_PRICE = 999999;

/**
 * 一度にロードするリスティング数
 */
export const LISTINGS_PAGE_SIZE = 50;
