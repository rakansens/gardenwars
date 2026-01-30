"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";
import {
    ListingCard,
    CreateListingModal,
    NotificationBadge,
    NotificationPanel,
} from "@/components/marketplace";
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import { ConfirmModal, SuccessModal } from "@/components/ui/Modal";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import type { MarketplaceListing, ListingFilter } from "@/lib/supabase/marketplaceTypes";

const allUnits = unitsData as UnitDefinition[];

type TabType = "browse" | "my_listings" | "history" | "notifications";
type SortType = ListingFilter["sortBy"];

export default function MarketplacePage() {
    const { t } = useLanguage();
    const { coins, unitInventory, isLoaded } = usePlayerData();
    const {
        listings,
        myListings,
        soldHistory,
        notifications,
        unreadCount,
        isLoading,
        isAuthenticated,
        refreshListings,
        refreshMyListings,
        refreshSoldHistory,
        refreshNotifications,
        refreshAll,
        createNewListing,
        buyListing,
        cancelMyListing,
        claimSoldNotification,
    } = useMarketplace();

    const [activeTab, setActiveTab] = useState<TabType>("browse");
    const [sortBy, setSortBy] = useState<SortType>("newest");
    const [filterRarity, setFilterRarity] = useState<Rarity | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterSeller, setFilterSeller] = useState<{ id: string; name: string } | null>(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewingUnit, setViewingUnit] = useState<UnitDefinition | null>(null);
    const [confirmBuy, setConfirmBuy] = useState<MarketplaceListing | null>(null);
    const [confirmCancel, setConfirmCancel] = useState<MarketplaceListing | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // フィルタリングとソート
    const filteredListings = useMemo(() => {
        let result = activeTab === "my_listings" ? myListings : listings;

        // 販売者フィルター
        if (filterSeller && activeTab === "browse") {
            result = result.filter((listing) => listing.sellerId === filterSeller.id);
        }

        // レアリティフィルター
        if (filterRarity !== "all") {
            result = result.filter((listing) => {
                const unit = allUnits.find((u) => u.id === listing.unitId);
                return unit?.rarity === filterRarity;
            });
        }

        // 検索フィルター
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter((listing) => {
                const unit = allUnits.find((u) => u.id === listing.unitId);
                if (!unit) return false;
                const unitName = t(unit.id) !== unit.id ? t(unit.id) : unit.name;
                return unitName.toLowerCase().includes(query);
            });
        }

        return result;
    }, [activeTab, listings, myListings, filterSeller, filterRarity, searchQuery, t]);

    // ソートを適用してリフレッシュ
    const handleSortChange = (newSort: SortType) => {
        setSortBy(newSort);
        refreshListings({ sortBy: newSort });
    };

    // 販売者フィルターをセット
    const handleSellerClick = (sellerId: string, sellerName: string) => {
        setFilterSeller({ id: sellerId, name: sellerName });
        setActiveTab("browse");
    };

    // 販売者フィルターをクリア
    const clearSellerFilter = () => {
        setFilterSeller(null);
    };

    // 購入処理
    const handleBuy = async () => {
        if (!confirmBuy) return;
        const success = await buyListing(confirmBuy.id);
        setConfirmBuy(null);
        if (success) {
            setSuccessMessage(t("purchase_complete"));
        }
    };

    // キャンセル処理
    const handleCancel = async () => {
        if (!confirmCancel) return;
        const success = await cancelMyListing(confirmCancel.id);
        setConfirmCancel(null);
        if (success) {
            setSuccessMessage(t("listing_cancelled_success"));
        }
    };

    // 出品処理
    const handleCreateListing = async (
        unitId: string,
        quantity: number,
        pricePerUnit: number
    ) => {
        const success = await createNewListing(unitId, quantity, pricePerUnit);
        if (success) {
            setSuccessMessage(t("listing_created"));
        }
        return success;
    };

    // 通知処理
    const handleClaimNotification = async (notificationId: string) => {
        const success = await claimSoldNotification(notificationId);
        if (success) {
            setSuccessMessage(t("claimed_success"));
        }
        return success;
    };

    // ローディング状態
    if (!isLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] text-white">
                <div className="text-xl animate-pulse">🏪 {t("loading")}</div>
            </div>
        );
    }

    // 未認証の場合
    if (!isAuthenticated) {
        return (
            <main className="min-h-screen bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f0f23] text-white">
                <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                    <div className="text-6xl mb-6">🔐</div>
                    <h1 className="text-2xl font-bold mb-4">{t("login_required")}</h1>
                    <p className="text-gray-400 mb-8">{t("marketplace_login_message")}</p>
                    <Link
                        href="/"
                        className="inline-block px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all"
                    >
                        {t("back_to_home")}
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f0f23] text-white">
            {/* ヘッダー */}
            <div className="sticky top-0 z-20 bg-gradient-to-b from-[#1a1a2e] to-[#1a1a2e]/95 backdrop-blur-md border-b border-white/10">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <Link href="/" className="btn btn-secondary text-sm">
                            ← {t("back_to_home")}
                        </Link>
                        <h1 className="text-xl md:text-2xl font-bold text-emerald-400 flex items-center gap-2">
                            🏪 {t("marketplace_title")}
                        </h1>
                        <div className="flex items-center gap-2">
                            <LanguageSwitch />
                            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2">
                                <span className="text-xl">💰</span>
                                <span className="text-lg">{coins.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* タブ */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <button
                        onClick={() => setActiveTab("browse")}
                        className={`
                            px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap
                            ${activeTab === "browse"
                                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                                : "bg-slate-800/50 text-gray-300 hover:bg-slate-700/50"
                            }
                        `}
                    >
                        🛍️ {t("browse_marketplace")}
                    </button>

                    {/* リフレッシュボタン */}
                    <button
                        onClick={refreshAll}
                        disabled={isLoading}
                        className={`
                            px-3 py-2 rounded-xl font-bold transition-all whitespace-nowrap
                            bg-slate-700/50 text-gray-300 hover:bg-slate-600/50 hover:text-white
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${isLoading ? "animate-spin" : ""}
                        `}
                        title={t("refresh")}
                    >
                        🔄
                    </button>
                    <button
                        onClick={() => setActiveTab("my_listings")}
                        className={`
                            px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap
                            ${activeTab === "my_listings"
                                ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg"
                                : "bg-slate-800/50 text-gray-300 hover:bg-slate-700/50"
                            }
                        `}
                    >
                        📦 {t("my_listings")}
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("history");
                            refreshSoldHistory();
                        }}
                        className={`
                            px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap
                            ${activeTab === "history"
                                ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg"
                                : "bg-slate-800/50 text-gray-300 hover:bg-slate-700/50"
                            }
                        `}
                    >
                        📜 {t("sold_history")}
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("notifications");
                            refreshNotifications();
                        }}
                        className={`
                            px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap relative
                            ${activeTab === "notifications"
                                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg"
                                : "bg-slate-800/50 text-gray-300 hover:bg-slate-700/50"
                            }
                        `}
                    >
                        🔔 {t("notifications")}
                        {unreadCount > 0 && (
                            <NotificationBadge count={unreadCount} className="absolute -top-1 -right-1" />
                        )}
                    </button>
                </div>

                {/* 通知タブ */}
                {activeTab === "notifications" && (
                    <NotificationPanel
                        notifications={notifications}
                        onClaim={handleClaimNotification}
                        isLoading={isLoading}
                        t={t}
                    />
                )}

                {/* 履歴タブ */}
                {activeTab === "history" && (
                    <div className="space-y-3">
                        {soldHistory.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">📜</div>
                                <p className="text-gray-400">{t("no_sold_history")}</p>
                            </div>
                        ) : (
                            soldHistory.map((listing) => {
                                const unit = allUnits.find((u) => u.id === listing.unitId);
                                if (!unit) return null;
                                return (
                                    <div
                                        key={listing.id}
                                        className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl p-4 border border-purple-500/30"
                                    >
                                        <div className="flex items-center gap-4">
                                            <RarityFrame
                                                unitId={unit.id}
                                                unitName={unit.name}
                                                rarity={unit.rarity}
                                                size="md"
                                                count={listing.quantity}
                                            />
                                            <div className="flex-1">
                                                <h3 className="font-bold text-white">{unit.name}</h3>
                                                <p className="text-sm text-gray-400">
                                                    x{listing.quantity} @ {listing.pricePerUnit.toLocaleString()} {t("coins_per_unit")}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-gray-500">{t("buyer")}:</span>
                                                    <span className="text-sm font-bold text-blue-400">{listing.buyerName || "Unknown"}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-amber-400">
                                                    +{listing.totalPrice.toLocaleString()} 💰
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {listing.soldAt ? new Date(listing.soldAt).toLocaleDateString() : ""}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ブラウズ / マイリスティングタブ */}
                {activeTab !== "notifications" && (
                    <>
                        {/* 販売者フィルター表示 */}
                        {filterSeller && activeTab === "browse" && (
                            <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 rounded-xl p-3 mb-4 border border-blue-500/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">👤</span>
                                    <span className="text-gray-300">{t("seller_filter")}:</span>
                                    <span className="font-bold text-blue-400">{filterSeller.name}</span>
                                </div>
                                <button
                                    onClick={clearSellerFilter}
                                    className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 rounded-lg text-sm transition-colors"
                                >
                                    ✕ {t("clear_filter")}
                                </button>
                            </div>
                        )}

                        {/* フィルター・検索 */}
                        <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 rounded-2xl p-4 mb-6 border border-white/10">
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* 検索 */}
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder={t("search_units")}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-700/50 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                {/* ソート */}
                                <select
                                    value={sortBy}
                                    onChange={(e) => handleSortChange(e.target.value as SortType)}
                                    className="px-4 py-2 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="newest">{t("sort_newest")}</option>
                                    <option value="oldest">{t("sort_oldest")}</option>
                                    <option value="price_asc">{t("sort_price_low")}</option>
                                    <option value="price_desc">{t("sort_price_high")}</option>
                                </select>

                                {/* レアリティフィルター */}
                                <select
                                    value={filterRarity}
                                    onChange={(e) => setFilterRarity(e.target.value as Rarity | "all")}
                                    className="px-4 py-2 bg-slate-700/50 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="all">{t("all_rarities")}</option>
                                    <option value="N">N</option>
                                    <option value="R">R</option>
                                    <option value="SR">SR</option>
                                    <option value="SSR">SSR</option>
                                    <option value="UR">UR</option>
                                </select>

                                {/* 出品ボタン */}
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95 whitespace-nowrap"
                                >
                                    ➕ {t("list_item")}
                                </button>
                            </div>
                        </div>

                        {/* リスティンググリッド */}
                        {isLoading ? (
                            <div className="text-center py-12">
                                <div className="text-xl animate-pulse">🔄 {t("loading")}</div>
                            </div>
                        ) : filteredListings.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">📭</div>
                                <p className="text-gray-400">
                                    {activeTab === "my_listings" ? t("no_my_listings") : t("no_listings")}
                                </p>
                                {activeTab === "my_listings" && (
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="mt-4 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all"
                                    >
                                        {t("create_first_listing")}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                {filteredListings.map((listing) => (
                                    <ListingCard
                                        key={listing.id}
                                        listing={listing}
                                        onBuy={() => setConfirmBuy(listing)}
                                        onCancel={() => setConfirmCancel(listing)}
                                        onDetail={() => {
                                            const unit = allUnits.find((u) => u.id === listing.unitId);
                                            if (unit) setViewingUnit(unit);
                                        }}
                                        onSellerClick={handleSellerClick}
                                        currentCoins={coins}
                                        t={t}
                                    />
                                ))}
                            </div>
                        )}

                        {/* 件数表示 */}
                        {filteredListings.length > 0 && (
                            <div className="mt-6 text-center text-gray-500 text-sm">
                                {filteredListings.length} {t("listings_found")}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 出品モーダル */}
            <CreateListingModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateListing}
                unitInventory={unitInventory}
                t={t}
            />

            {/* 購入確認モーダル */}
            {confirmBuy && (
                <ConfirmModal
                    isOpen={!!confirmBuy}
                    onClose={() => setConfirmBuy(null)}
                    onConfirm={handleBuy}
                    icon="🛒"
                    title={t("confirm_purchase")}
                    message={`${t("buy")} ${allUnits.find((u) => u.id === confirmBuy.unitId)?.name || confirmBuy.unitId} x${confirmBuy.quantity} ${t("for")} ${confirmBuy.totalPrice.toLocaleString()} ${t("coins")}?`}
                    confirmText={t("buy")}
                    cancelText={t("cancel")}
                    confirmColor="green"
                />
            )}

            {/* キャンセル確認モーダル */}
            {confirmCancel && (
                <ConfirmModal
                    isOpen={!!confirmCancel}
                    onClose={() => setConfirmCancel(null)}
                    onConfirm={handleCancel}
                    icon="↩️"
                    title={t("cancel_listing_confirm")}
                    message={t("cancel_listing_message")}
                    confirmText={t("confirm")}
                    cancelText={t("cancel")}
                    confirmColor="red"
                />
            )}

            {/* 成功モーダル */}
            {successMessage && (
                <SuccessModal
                    isOpen={!!successMessage}
                    onClose={() => setSuccessMessage(null)}
                    title={successMessage}
                />
            )}

            {/* ユニット詳細モーダル */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={!!unitInventory[viewingUnit.id]}
                    isInTeam={false}
                    onClose={() => setViewingUnit(null)}
                    onToggleTeam={() => { }}
                />
            )}
        </main>
    );
}
