"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import GachaReveal from "@/components/ui/GachaReveal";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useUnitDetailModal } from "@/hooks/useUnitDetailModal";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { incrementGachaCountRpc } from "@/lib/supabase";
import { secureRandom } from "@/lib/secureRandom";

// Components
import GachaMachine from "@/components/gacha/GachaMachine";
import GachaTabs from "@/components/gacha/GachaTabs";
import UnitShowcase from "@/components/gacha/UnitShowcase";
import GachaHistory from "@/components/gacha/GachaHistory";

const allUnits = unitsData as UnitDefinition[];
// ガチャ対象はallyユニットのみ
const gachaPool = allUnits.filter((u) => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

const SINGLE_COST = 100;
const MULTI_COST = 900; // 10回で少しお得
const SUPER_MULTI_COST = 9000; // 100回 (SSR大盛り⁉️)

// 事前計算: レアリティ別ユニット数とドロップレート
const rarityWeightsConst = { N: 51, R: 30, SR: 15, SSR: 1, UR: 0.33 } as const;
const unitsCountByRarity: Record<Rarity, number> = {
    N: gachaPool.filter(u => u.rarity === "N").length,
    R: gachaPool.filter(u => u.rarity === "R").length,
    SR: gachaPool.filter(u => u.rarity === "SR").length,
    SSR: gachaPool.filter(u => u.rarity === "SSR").length,
    UR: gachaPool.filter(u => u.rarity === "UR").length,
};

// ドロップレートのキャッシュ
const dropRateCache = new Map<string, number>();
gachaPool.forEach(unit => {
    const countByRarity = unitsCountByRarity[unit.rarity];
    const rate = countByRarity > 0 ? rarityWeightsConst[unit.rarity] / countByRarity : 0;
    dropRateCache.set(unit.id, rate);
});

// ガチャ用の重み計算キャッシュ
const unitWeightCache = new Map<string, number>();
gachaPool.forEach(unit => {
    const countByRarity = unitsCountByRarity[unit.rarity];
    unitWeightCache.set(unit.id, countByRarity > 0 ? rarityWeightsConst[unit.rarity] / countByRarity : 0);
});
const totalGachaWeight = Array.from(unitWeightCache.values()).reduce((sum, w) => sum + w, 0);

export default function GachaPage() {
    const { coins, unitInventory, executeGacha, addGachaHistory, gachaHistory, isLoaded, flushToSupabase } = usePlayerData();
    const { t } = useLanguage();
    const { playerId } = useAuth();
    const [results, setResults] = useState<UnitDefinition[]>([]);
    const [isRolling, setIsRolling] = useState(false);
    const [showReveal, setShowReveal] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Tabs state
    const [activeTab, setActiveTab] = useState("machine");

    const { viewingUnit, openModal, closeModal } = useUnitDetailModal();

    // NEWユニット判定（addedDateがあるユニット）
    const isNewUnit = (unit: UnitDefinition): boolean => {
        return !!unit.addedDate;
    };

    // NEWユニット一覧（追加日が新しい順）- memoized to avoid recomputation
    const newUnits = useMemo(() => gachaPool
        .filter(u => isNewUnit(u))
        .sort((a, b) => {
            const dateA = new Date(a.addedDate || "2000-01-01").getTime();
            const dateB = new Date(b.addedDate || "2000-01-01").getTime();
            return dateB - dateA;
        }), []);

    // ガチャを引く
    const rollGacha = async (count: number) => {
        // ダブルクリック防止 - 最初にチェック
        if (isRolling) return;

        let cost = SINGLE_COST;
        if (count === 10) cost = MULTI_COST;
        if (count === 100) cost = SUPER_MULTI_COST;

        if (coins < cost) return;

        setIsRolling(true);

        try {
            // ランダムにユニットを選ぶ（レアリティで重み付け）
            const rolled: UnitDefinition[] = [];
            for (let i = 0; i < count; i++) {
                const unit = pickRandomUnit();
                rolled.push(unit);
            }
            const unitIds = rolled.map(u => u.id);

            // アトミック操作: コイン消費 + ユニット追加を同時に実行
            // これによりブラウザが閉じられてもデータ損失を防ぐ
            // サーバー権威モード: 認証済みユーザーはサーバーで処理
            const success = await executeGacha(cost, unitIds);
            if (!success) {
                return; // finally will still run
            }

            // 履歴に追加
            addGachaHistory(unitIds);

            // 重要: ガチャ結果を即座にSupabaseに保存（デバウンスをバイパス）
            // これによりブラウザが閉じられてもデータが失われない
            setIsSyncing(true);
            await flushToSupabase();
            setIsSyncing(false);

            // ランキング用ガチャ回数カウント（サーバー権威モード）
            if (playerId) {
                try {
                    await incrementGachaCountRpc(playerId, count);
                } catch (err) {
                    console.error("Failed to increment gacha count:", err);
                    // ランキング更新失敗してもガチャ自体は続行
                }
            }

            // 結果を即座に設定（setTimeoutではなく同期的に）
            // これにより状態更新の競合を防ぐ
            setResults(rolled);
            setShowReveal(true);
        } catch (error) {
            console.error("Gacha error:", error);
        } finally {
            setIsRolling(false); // Always reset
        }
    };

    // レアリティで重み付けしてランダム選択（キャッシュ済み重みを使用）
    // セキュリティ向上: crypto.getRandomValues()を使用
    const pickRandomUnit = (): UnitDefinition => {
        if (gachaPool.length === 0) {
            throw new Error("Gacha pool is empty");
        }
        // Use cryptographically secure random for gacha picks
        let random = secureRandom() * totalGachaWeight;

        for (const unit of gachaPool) {
            random -= unitWeightCache.get(unit.id) ?? 0;
            if (random <= 0) return unit;
        }
        return gachaPool[0];
    };

    // ユニットの排出率を計算（キャッシュから取得）
    const getDropRate = (unit: UnitDefinition): number => {
        return dropRateCache.get(unit.id) ?? 0;
    };

    // カード演出完了時
    const handleRevealComplete = () => {
        setShowReveal(false);
        setResults([]);
        setActiveTab("history"); // Switch to history after pull
    };

    if (!isLoaded) {
        return <LoadingSpinner icon="🎰" fullScreen />;
    }

    const tabs = [
        { id: "machine", label: t("gacha_machine_title"), icon: "🎰" },
        { id: "showcase", label: t("ur_showcase"), icon: "✨" },
        { id: "history", label: t("gacha_history"), icon: "🗂️" },
        { id: "gallery", label: t("gacha_owned_units"), icon: "✅" },
    ];

    return (
        <main className="min-h-screen pb-24">
            <PageHeader
                title={t("gacha_title")}
                showLanguageSwitch={false}
            >
                <div className="flex items-center gap-2">
                    {isSyncing && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 border border-blue-400/50 rounded-lg text-blue-600 dark:text-blue-300 text-sm">
                            <span className="animate-spin text-sm">⏳</span>
                        </div>
                    )}
                    <div className="btn btn-primary pointer-events-none">
                        💰 {coins.toLocaleString()}
                    </div>
                </div>
            </PageHeader>

            <div className="container max-w-4xl mx-auto pt-6 px-4">
                <GachaTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

                <div className="min-h-[60vh]">
                    {activeTab === "machine" && (
                        <div className="animate-slide-in-right">
                            <GachaMachine
                                coins={coins}
                                isRolling={isRolling}
                                onRoll={rollGacha}
                                SINGLE_COST={SINGLE_COST}
                                MULTI_COST={MULTI_COST}
                                SUPER_MULTI_COST={SUPER_MULTI_COST}
                            />

                            {/* Short preview of new units below machine */}
                            <UnitShowcase
                                title={t("gacha_new_units")}
                                icon="🆕"
                                units={newUnits}
                                unitInventory={unitInventory}
                                onUnitClick={openModal}
                                colorTheme="green"
                                highlightNew
                                showRarityFilter={true}
                                groupByDate={true}
                            />
                        </div>
                    )}

                    {activeTab === "showcase" && (
                        <div className="animate-slide-in-right space-y-8">
                            <UnitShowcase
                                title={t("ur_showcase")}
                                icon="✨"
                                units={gachaPool.filter(u => u.rarity === "UR").sort((a, b) => (a.gachaWeight ?? 1) - (b.gachaWeight ?? 1))}
                                unitInventory={unitInventory}
                                onUnitClick={openModal}
                                getDropRate={getDropRate}
                                showDropRate
                                colorTheme="purple"
                            />
                            <UnitShowcase
                                title="SSR Showcase"
                                icon="🌟"
                                units={gachaPool.filter(u => u.rarity === "SSR")}
                                unitInventory={unitInventory}
                                onUnitClick={openModal}
                                getDropRate={getDropRate}
                                colorTheme="amber"
                            />
                        </div>
                    )}

                    {activeTab === "history" && (
                        <div className="animate-slide-in-right">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-amber-950 dark:text-amber-100">
                                <span className="text-2xl">🗂️</span> {t("gacha_history_title")} ({gachaHistory.length})
                            </h3>
                            <GachaHistory
                                history={gachaHistory}
                                allUnits={allUnits}
                                onUnitClick={openModal}
                            />
                        </div>
                    )}

                    {activeTab === "gallery" && (
                        <div className="animate-slide-in-right space-y-8">
                            <UnitShowcase
                                title={t("gacha_owned_units")}
                                icon="✅"
                                units={gachaPool}
                                unitInventory={unitInventory}
                                onUnitClick={openModal}
                                showRarityFilter
                                colorTheme="green"
                            />
                            <div className="text-center mt-8">
                                <Link href="/team" className="btn btn-primary inline-flex items-center gap-2">
                                    ⚔️ {t("gacha_to_team")}
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* カード演出 */}
            {showReveal && (
                <GachaReveal
                    results={results}
                    onComplete={handleRevealComplete}
                    dropRates={results.map(u => getDropRate(u))}
                />
            )}

            {/* ユニット詳細モーダル */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={(unitInventory[viewingUnit.id] || 0) > 0}
                    isInTeam={false}
                    onClose={() => closeModal()}
                    onToggleTeam={() => { }}
                    dropRate={getDropRate(viewingUnit)}
                />
            )}
        </main>
    );
}
