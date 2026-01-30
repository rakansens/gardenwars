"use client";

import { useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import RarityFrame from "@/components/ui/RarityFrame";
import unitsData from "@/data/units";
import type { UnitDefinition } from "@/data/types";
import { MIN_LISTING_PRICE, MAX_LISTING_PRICE } from "@/lib/supabase/marketplaceTypes";

interface CreateListingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (unitId: string, quantity: number, pricePerUnit: number) => Promise<boolean>;
    unitInventory: Record<string, number>;
    t: (key: string) => string;
}

export default function CreateListingModal({
    isOpen,
    onClose,
    onSubmit,
    unitInventory,
    t,
}: CreateListingModalProps) {
    const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [pricePerUnit, setPricePerUnit] = useState(100);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 出品可能なユニット一覧
    const availableUnits = useMemo(() => {
        const units: (UnitDefinition & { count: number })[] = [];
        const allUnits = unitsData as UnitDefinition[];

        for (const [unitId, count] of Object.entries(unitInventory)) {
            if (count <= 0) continue;
            const unit = allUnits.find((u) => u.id === unitId);
            if (unit && !unit.id.startsWith("enemy_") && !unit.id.startsWith("boss_")) {
                units.push({ ...unit, count });
            }
        }

        // レアリティ順でソート（UR > SSR > SR > R > N）
        const rarityOrder = { UR: 5, SSR: 4, SR: 3, R: 2, N: 1 };
        return units.sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);
    }, [unitInventory]);

    const selectedUnitData = useMemo(() => {
        if (!selectedUnit) return null;
        return availableUnits.find((u) => u.id === selectedUnit);
    }, [selectedUnit, availableUnits]);

    const maxQuantity = selectedUnitData?.count || 1;
    const totalPrice = quantity * pricePerUnit;

    // 推奨価格を計算
    const suggestedPrice = useMemo(() => {
        if (!selectedUnitData) return 100;
        switch (selectedUnitData.rarity) {
            case "N": return 30;
            case "R": return 150;
            case "SR": return 700;
            case "SSR": return 4000;
            case "UR": return 15000;
            default: return 100;
        }
    }, [selectedUnitData]);

    const handleSubmit = async () => {
        if (!selectedUnit || quantity <= 0 || pricePerUnit <= 0) {
            setError(t("invalid_input"));
            return;
        }

        if (pricePerUnit < MIN_LISTING_PRICE || pricePerUnit > MAX_LISTING_PRICE) {
            setError(t("price_out_of_range"));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const success = await onSubmit(selectedUnit, quantity, pricePerUnit);
            if (success) {
                onClose();
                // リセット
                setSelectedUnit(null);
                setQuantity(1);
                setPricePerUnit(100);
            } else {
                setError(t("listing_failed"));
            }
        } catch {
            setError(t("listing_failed"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
            setSelectedUnit(null);
            setQuantity(1);
            setPricePerUnit(100);
            setError(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="lg">
            <div className="p-4 sm:p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
                    {t("create_listing")}
                </h2>

                {/* ステップ1: ユニット選択 */}
                {!selectedUnit ? (
                    <div>
                        <p className="text-sm text-gray-600 mb-3">{t("select_unit_to_list")}</p>

                        {availableUnits.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                {t("no_units_to_list")}
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[300px] overflow-y-auto">
                                {availableUnits.map((unit) => (
                                    <button
                                        key={unit.id}
                                        onClick={() => {
                                            setSelectedUnit(unit.id);
                                            // 推奨価格をセット
                                            const suggested = (() => {
                                                switch (unit.rarity) {
                                                    case "N": return 30;
                                                    case "R": return 150;
                                                    case "SR": return 700;
                                                    case "SSR": return 4000;
                                                    case "UR": return 15000;
                                                    default: return 100;
                                                }
                                            })();
                                            setPricePerUnit(suggested);
                                        }}
                                        className="flex flex-col items-center p-1 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={unit.name}
                                            rarity={unit.rarity}
                                            size="sm"
                                            count={unit.count}
                                        />
                                        <span className="text-xs mt-1 truncate max-w-full text-gray-700">
                                            {unit.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* ステップ2: 詳細設定 */
                    <div>
                        {/* 選択中のユニット */}
                        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                            <RarityFrame
                                unitId={selectedUnitData!.id}
                                unitName={selectedUnitData!.name}
                                rarity={selectedUnitData!.rarity}
                                size="md"
                            />
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-800">{selectedUnitData!.name}</h3>
                                <p className="text-sm text-gray-500">
                                    {t("owned")}: {maxQuantity}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedUnit(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                {t("change")}
                            </button>
                        </div>

                        {/* 数量 */}
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                {t("quantity")}
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-xl text-gray-700"
                                    disabled={quantity <= 1}
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        setQuantity(Math.min(maxQuantity, Math.max(1, val)));
                                    }}
                                    min={1}
                                    max={maxQuantity}
                                    className="w-20 h-10 text-center border rounded-lg font-bold text-lg text-gray-800 bg-white"
                                />
                                <button
                                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                                    className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-xl text-gray-700"
                                    disabled={quantity >= maxQuantity}
                                >
                                    +
                                </button>
                                <button
                                    onClick={() => setQuantity(maxQuantity)}
                                    className="px-3 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm text-gray-700"
                                >
                                    {t("max")}
                                </button>
                            </div>
                        </div>

                        {/* 価格 */}
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                {t("price_per_unit")} ({t("coins")})
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={pricePerUnit}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || MIN_LISTING_PRICE;
                                        setPricePerUnit(Math.min(MAX_LISTING_PRICE, Math.max(MIN_LISTING_PRICE, val)));
                                    }}
                                    min={MIN_LISTING_PRICE}
                                    max={MAX_LISTING_PRICE}
                                    className="flex-1 h-10 px-3 border rounded-lg font-bold text-lg text-gray-800 bg-white"
                                />
                                <button
                                    onClick={() => setPricePerUnit(suggestedPrice)}
                                    className="px-3 h-10 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm whitespace-nowrap"
                                >
                                    {t("suggested")}: {suggestedPrice}
                                </button>
                            </div>
                        </div>

                        {/* 合計 */}
                        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-700 font-bold">{t("total_price")}:</span>
                                <span className="text-2xl font-bold text-amber-600">
                                    {totalPrice.toLocaleString()} {t("coins")}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {t("listing_duration_info")}
                            </p>
                        </div>

                        {/* エラー表示 */}
                        {error && (
                            <div className="p-3 bg-red-100 text-red-700 rounded-lg mb-4 text-sm">
                                {error}
                            </div>
                        )}

                        {/* ボタン */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all active:scale-95"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? t("listing_in_progress") : t("list_item")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
