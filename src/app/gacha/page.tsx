"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame, { getRarityStars, getRarityGradientClass } from "@/components/ui/RarityFrame";
import GachaReveal from "@/components/ui/GachaReveal";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import UnitCard from "@/components/ui/UnitCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useUnitDetailModal } from "@/hooks/useUnitDetailModal";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { incrementGachaCount } from "@/lib/supabase";
import { secureRandom } from "@/lib/secureRandom";

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
    const [openSections, setOpenSections] = useState({
        machine: true,
        ur: true,
        history: false,
        newUnits: true,
        owned: true,
        unowned: true,
    });
    const { viewingUnit, openModal, closeModal } = useUnitDetailModal();
    const [ownedRarityFilter, setOwnedRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [unownedRarityFilter, setUnownedRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [newRarityFilter, setNewRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [urViewMode, setUrViewMode] = useState<"carousel" | "grid">("carousel");
    const [newViewMode, setNewViewMode] = useState<"carousel" | "grid">("carousel");

    const scrollToSection = useCallback((id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    // NEWユニット判定（addedDateがあるユニット）
    const isNewUnit = (unit: UnitDefinition): boolean => {
        return !!unit.addedDate;
    };

    // 1週間以内に追加されたかどうか（バッジ用）
    const isRecentlyAdded = (unit: UnitDefinition): boolean => {
        if (!unit.addedDate) return false;
        const addedDate = new Date(unit.addedDate);
        const now = new Date();
        const diffDays = (now.getTime() - addedDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
    };

    // NEWユニット一覧（追加日が新しい順）- memoized to avoid recomputation
    const newUnits = useMemo(() => gachaPool
        .filter(u => isNewUnit(u))
        .sort((a, b) => {
            const dateA = new Date(a.addedDate || "2000-01-01").getTime();
            const dateB = new Date(b.addedDate || "2000-01-01").getTime();
            return dateB - dateA;
        }), []);

    // 日付ごとにグループ化
    const unitsByDate = useMemo(() => {
        const groups = new Map<string, UnitDefinition[]>();
        newUnits.forEach(unit => {
            const date = unit.addedDate || "unknown";
            if (!groups.has(date)) {
                groups.set(date, []);
            }
            groups.get(date)!.push(unit);
        });
        // 日付の降順でソート
        return Array.from(groups.entries()).sort((a, b) => {
            if (a[0] === "unknown") return 1;
            if (b[0] === "unknown") return -1;
            return new Date(b[0]).getTime() - new Date(a[0]).getTime();
        });
    }, [newUnits]);

    // レアリティフィルタータブの定義
    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gray-500" },
        { key: "N", label: "N", color: "bg-gray-400" },
        { key: "R", label: "R", color: "bg-blue-500" },
        { key: "SR", label: "SR", color: "bg-purple-500" },
        { key: "SSR", label: "SSR", color: "bg-amber-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

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
            await flushToSupabase();

            // ランキング用ガチャ回数カウント（エラーハンドリング付き）
            if (playerId) {
                try {
                    await incrementGachaCount(playerId, count);
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
    };

    // 日時フォーマット
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    // 履歴内のユニットをカウント
    const countRarityInHistory = (unitIds: string[]) => {
        const counts = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
        for (const id of unitIds) {
            const unit = allUnits.find(u => u.id === id);
            if (unit) counts[unit.rarity]++;
        }
        return counts;
    };

    if (!isLoaded) {
        return <LoadingSpinner icon="🎰" fullScreen />;
    }

    return (
        <main className="min-h-screen">
            <PageHeader
                title={t("gacha_title")}
                showLanguageSwitch={false}
            >
                <div className="flex items-center gap-2">
                    {isSyncing && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 border border-blue-400/50 rounded-lg text-blue-600 dark:text-blue-300 text-sm">
                            <span className="animate-spin text-sm">⏳</span>
                            <span className="hidden sm:inline">{t("saving") || "Saving..."}</span>
                        </div>
                    )}
                    <div className="btn btn-primary pointer-events-none">
                        💰 {coins.toLocaleString()}
                    </div>
                </div>
            </PageHeader>

            <div className="container max-w-2xl mx-auto">
                {/* セクションナビ */}
                <div className="sticky top-20 z-30 mb-6">
                    <div className="card flex items-center gap-2 overflow-x-auto whitespace-nowrap py-3">
                        <button
                            onClick={() => scrollToSection("gacha-machine")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            🎰 {t("gacha_machine_title")}
                        </button>
                        <button
                            onClick={() => scrollToSection("ur-showcase")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            ✨ {t("ur_showcase")}
                        </button>
                        <button
                            onClick={() => scrollToSection("gacha-history")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            🗂️ {t("gacha_history")}
                        </button>
                        {unitsByDate.length > 0 && (
                            <button
                                onClick={() => scrollToSection("gacha-new")}
                                className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                            >
                                🆕 {t("gacha_new_units")}
                            </button>
                        )}
                        <button
                            onClick={() => scrollToSection("gacha-owned")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            ✅ {t("gacha_owned_units")}
                        </button>
                        <button
                            onClick={() => scrollToSection("gacha-unowned")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            🔒 {t("unowned_units")}
                        </button>
                    </div>
                </div>

                {/* ガチャマシン */}
                <section id="gacha-machine" className="card text-center mb-8 scroll-mt-28">
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setOpenSections((prev) => ({ ...prev, machine: !prev.machine }))}
                    >
                        <h2 className="text-2xl font-bold text-amber-950">
                            {t("gacha_machine_title")}
                        </h2>
                        <span className="text-2xl">{openSections.machine ? "▲" : "▼"}</span>
                    </div>
                    {openSections.machine && (
                        <>
                            <p className="text-amber-900/70 mb-6 whitespace-pre-line mt-4">
                                {t("gacha_machine_desc")}
                            </p>

                            {/* 排出率 */}
                            <div className="flex justify-center gap-2 mb-6 text-xs flex-wrap">
                                <span className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300">N: 51%</span>
                                <span className="px-2 py-1 rounded bg-blue-200 text-blue-700">R: 30%</span>
                                <span className="px-2 py-1 rounded bg-purple-200 text-purple-700">SR: 15%</span>
                                <span className="px-2 py-1 rounded bg-amber-200 text-amber-700">SSR: 1%</span>
                                <span className="px-2 py-1 rounded bg-gradient-to-r from-pink-200 to-cyan-200 text-purple-700 font-bold">UR: 1%</span>
                            </div>

                            {/* ガチャボタン */}
                            <div className="flex justify-center gap-6 flex-wrap">
                                {/* 1回ガチャ */}
                                <button
                                    className={`flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-slate-700 to-slate-800 border-4 border-slate-500 shadow-xl transition-all hover:scale-105 hover:border-green-400 ${coins < SINGLE_COST || isRolling || showReveal
                                            ? "opacity-50 cursor-not-allowed"
                                            : ""
                                        }`}
                                    onClick={() => rollGacha(1)}
                                    disabled={coins < SINGLE_COST || isRolling || showReveal}
                                >
                                    <Image
                                        src="/assets/ui/gacha_1pull.png"
                                        alt={t("gacha_1pull")}
                                        width={96}
                                        height={96}
                                        className="object-contain mb-2"
                                        loading="lazy"
                                    />
                                    <div className="text-white font-bold text-lg">{t("gacha_1pull")}</div>
                                    <div className="text-green-300 font-bold">💰 {SINGLE_COST}</div>
                                </button>

                                {/* 10連ガチャ */}
                                <button
                                    className={`flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-purple-700 to-purple-900 border-4 border-purple-400 shadow-xl transition-all hover:scale-105 hover:border-pink-400 ${coins < MULTI_COST || isRolling || showReveal
                                            ? "opacity-50 cursor-not-allowed"
                                            : ""
                                        }`}
                                    onClick={() => rollGacha(10)}
                                    disabled={coins < MULTI_COST || isRolling || showReveal}
                                >
                                    <Image
                                        src="/assets/ui/gacha_10pull.png"
                                        alt={t("gacha_10pull")}
                                        width={112}
                                        height={112}
                                        className="object-contain mb-2"
                                        loading="lazy"
                                    />
                                    <div className="text-white font-bold text-lg">{t("gacha_10pull")}</div>
                                    <div className="text-yellow-300 font-bold">💰 {MULTI_COST}</div>
                                </button>

                                {/* 100連ガチャ */}
                                <button
                                    className={`flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-amber-600 via-orange-700 to-red-800 border-4 border-yellow-400 shadow-2xl transition-all hover:scale-105 ${coins < SUPER_MULTI_COST || isRolling || showReveal
                                            ? "opacity-50 cursor-not-allowed"
                                            : "animate-pulse hover:animate-none"
                                        }`}
                                    onClick={() => rollGacha(100)}
                                    disabled={coins < SUPER_MULTI_COST || isRolling || showReveal}
                                >
                                    <Image
                                        src="/assets/ui/gacha_100pull.png"
                                        alt={t("gacha_100pull")}
                                        width={128}
                                        height={128}
                                        className="object-contain mb-2"
                                        loading="lazy"
                                    />
                                    <div className="text-white font-bold text-xl">{t("gacha_100pull")}</div>
                                    <div className="text-yellow-200 font-bold text-lg">💰 {SUPER_MULTI_COST}</div>
                                </button>
                            </div>
                        </>
                    )}
                </section>

                {/* UR ユニットショーケース */}
                <section
                    id="ur-showcase"
                    className="card mb-8 bg-gradient-to-br from-purple-900 via-pink-900 to-indigo-900 border-2 border-pink-400/50 overflow-hidden scroll-mt-28"
                >
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setOpenSections((prev) => ({ ...prev, ur: !prev.ur }))}
                    >
                        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-cyan-300">
                            ✨ {t("ur_showcase")} ✨
                        </h3>
                        <span className="text-2xl text-pink-200">{openSections.ur ? "▲" : "▼"}</span>
                    </div>
                    {openSections.ur && (
                        <>
                            <div className="flex items-center justify-between mt-3 mb-2">
                                <div className="flex-1" />
                                <div className="flex-1 flex justify-end">
                                    <div className="flex gap-1 bg-purple-800/50 rounded-lg p-1">
                                        <button
                                            onClick={() => setUrViewMode("carousel")}
                                            className={`px-2 py-1 rounded text-xs transition-all ${urViewMode === "carousel" ? "bg-pink-500 text-white" : "text-pink-300 hover:bg-purple-700"}`}
                                        >
                                            ⟷
                                        </button>
                                        <button
                                            onClick={() => setUrViewMode("grid")}
                                            className={`px-2 py-1 rounded text-xs transition-all ${urViewMode === "grid" ? "bg-pink-500 text-white" : "text-pink-300 hover:bg-purple-700"}`}
                                        >
                                            ⊞
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <p className="text-pink-200/70 text-center text-sm mb-3">
                                {t("ur_showcase_desc")}
                            </p>

                            {urViewMode === "carousel" ? (
                        <>
                            <p className="text-pink-300/50 text-center text-xs mb-3">{t("gacha_swipe_hint")}</p>
                            <div className="overflow-x-auto pt-3 pb-4 -mx-4 px-4 scrollbar-hide">
                                <div className="flex gap-4" style={{ width: 'max-content' }}>
                                    {gachaPool
                                        .filter(u => u.rarity === "UR")
                                        .sort((a, b) => (a.gachaWeight ?? 1) - (b.gachaWeight ?? 1))
                                        .map((unit) => {
                                            const rate = getDropRate(unit);
                                            const isOwned = (unitInventory[unit.id] || 0) > 0;
                                            return (
                                                <div
                                                    key={unit.id}
                                                    className={`
                                                        relative flex-shrink-0 w-36 p-3 rounded-2xl cursor-pointer transition-all
                                                        bg-gradient-to-br from-purple-800/60 to-pink-800/60
                                                        border-2 border-pink-500/40 hover:border-pink-400
                                                        hover:shadow-xl hover:shadow-pink-500/30
                                                        ${isOwned ? "ring-2 ring-green-400/50" : "opacity-80"}
                                                    `}
                                                    onClick={() => openModal(unit)}
                                                >
                                                    <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-bold z-10 ${rate < 0.05 ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white animate-pulse" : "bg-purple-500 text-white"}`}>
                                                        {rate.toFixed(2)}%
                                                    </div>
                                                    {isOwned && (
                                                        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center z-10 shadow-lg">✓</div>
                                                    )}
                                                    {unit.isFlying && (
                                                        <div className="absolute top-8 -left-2 w-6 h-6 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center z-10 shadow-lg">🪽</div>
                                                    )}
                                                    <div className="flex justify-center mb-2">
                                                        <RarityFrame unitId={unit.id} unitName={unit.name} rarity={unit.rarity} size="lg" showLabel={false} baseUnitId={unit.baseUnitId} grayscale={!isOwned} />
                                                    </div>
                                                    <div className="text-sm text-center text-pink-100 font-bold truncate">{unit.name}</div>
                                                    <div className="mt-2 text-[10px] text-pink-200/60 text-center space-y-0.5">
                                                        <div>HP: {unit.maxHp.toLocaleString()}</div>
                                                        <div>ATK: {unit.attackDamage}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {gachaPool
                                .filter(u => u.rarity === "UR")
                                .sort((a, b) => (a.gachaWeight ?? 1) - (b.gachaWeight ?? 1))
                                .map((unit) => {
                                    const rate = getDropRate(unit);
                                    const isOwned = (unitInventory[unit.id] || 0) > 0;
                                    return (
                                        <div
                                            key={unit.id}
                                            className={`relative p-2 rounded-xl cursor-pointer transition-all bg-gradient-to-br from-purple-800/50 to-pink-800/50 border border-pink-500/30 hover:border-pink-400 hover:scale-105 ${isOwned ? "" : "opacity-70"}`}
                                            onClick={() => openModal(unit)}
                                        >
                                            <div className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold z-10 ${rate < 0.05 ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white animate-pulse" : "bg-purple-500 text-white"}`}>
                                                {rate.toFixed(2)}%
                                            </div>
                                            {isOwned && (
                                                <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center z-10">✓</div>
                                            )}
                                            {unit.isFlying && (
                                                <div className={`absolute ${isOwned ? "-bottom-1" : "-top-2"} -left-2 w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] flex items-center justify-center z-10`}>🪽</div>
                                            )}
                                            <div className="flex justify-center">
                                                <RarityFrame unitId={unit.id} unitName={unit.name} rarity={unit.rarity} size="sm" showLabel={false} baseUnitId={unit.baseUnitId} grayscale={!isOwned} />
                                            </div>
                                            <div className="text-[10px] text-center text-pink-100 truncate mt-1 font-medium">{unit.name}</div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                        </>
                    )}
                </section>

                {/* ガチャ履歴 */}
                <section id="gacha-history" className="card mb-8 scroll-mt-28">
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setOpenSections((prev) => ({ ...prev, history: !prev.history }))}
                    >
                        <h3 className="text-xl font-bold text-amber-950">
                            {t("gacha_history")} ({gachaHistory.length})
                        </h3>
                        <span className="text-2xl">{openSections.history ? '▲' : '▼'}</span>
                    </div>

                    {openSections.history && (
                        <div className="mt-4 space-y-4 max-h-[500px] overflow-y-auto">
                            {gachaHistory.length === 0 ? (
                                <p className="text-amber-900/50 text-center py-4">{t("gacha_history_empty")}</p>
                            ) : (
                                gachaHistory.map((entry, index) => {
                                    const counts = countRarityInHistory(entry.unitIds);
                                    // ユニット情報を取得
                                    const units = entry.unitIds
                                        .map(id => allUnits.find(u => u.id === id))
                                        .filter((u): u is UnitDefinition => u !== undefined);

                                    return (
                                        <div
                                            key={`${entry.timestamp}-${index}`}
                                            className="p-3 bg-amber-50 rounded-lg border border-amber-200"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm text-amber-700 font-medium">
                                                    {formatDate(entry.timestamp)}
                                                </span>
                                                <span className="text-sm font-bold text-amber-900">
                                                    {entry.count === 1 ? t("gacha_count_1") : entry.count === 10 ? t("gacha_count_10") : t("gacha_count_100")}
                                                </span>
                                            </div>

                                            {/* キャラアイコン */}
                                            <div className="flex gap-1 flex-wrap mb-3">
                                                {units.map((unit, unitIndex) => (
                                                    <div
                                                        key={unitIndex}
                                                        className="w-10 h-10 cursor-pointer hover:scale-110 transition-transform"
                                                        onClick={() => openModal(unit)}
                                                    >
                                                        <RarityFrame
                                                            unitId={unit.id}
                                                            unitName={unit.name}
                                                            rarity={unit.rarity}
                                                            size="xs"
                                                            showLabel={false}
                                                            baseUnitId={unit.baseUnitId}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            {/* レアリティサマリー */}
                                            <div className="flex gap-2 flex-wrap text-xs">
                                                {counts.UR > 0 && (
                                                    <span className="px-2 py-1 rounded bg-gradient-to-r from-pink-400 to-cyan-400 text-white font-bold">
                                                        UR: {counts.UR}
                                                    </span>
                                                )}
                                                {counts.SSR > 0 && (
                                                    <span className="px-2 py-1 rounded bg-amber-400 text-white font-bold">
                                                        SSR: {counts.SSR}
                                                    </span>
                                                )}
                                                {counts.SR > 0 && (
                                                    <span className="px-2 py-1 rounded bg-purple-400 text-white">
                                                        SR: {counts.SR}
                                                    </span>
                                                )}
                                                {counts.R > 0 && (
                                                    <span className="px-2 py-1 rounded bg-blue-300 text-blue-800">
                                                        R: {counts.R}
                                                    </span>
                                                )}
                                                {counts.N > 0 && (
                                                    <span className="px-2 py-1 rounded bg-gray-300 text-gray-700">
                                                        N: {counts.N}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </section>

                {/* NEWユニット一覧（日付ごとにグループ化） */}
                {unitsByDate.length > 0 && (
                    <section
                        id="gacha-new"
                        className="card mb-6 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-400/50 scroll-mt-28"
                    >
                        <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setOpenSections((prev) => ({ ...prev, newUnits: !prev.newUnits }))}
                        >
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-green-500 text-white text-sm font-bold">
                                    📅 UPDATE
                                </span>
                                <h3 className="text-xl font-bold text-green-800 dark:text-green-300">
                                    {t("gacha_new_units")} ({newUnits.length})
                                </h3>
                            </div>
                            <span className="text-2xl text-green-700">{openSections.newUnits ? "▲" : "▼"}</span>
                        </div>

                        {openSections.newUnits && (
                            <>
                                <div className="flex items-center justify-between mt-4 mb-4">
                                    <div className="flex-1" />
                                    <div className="flex-1 flex justify-end">
                                        <div className="flex gap-1 bg-green-700/50 rounded-lg p-1">
                                            <button
                                                onClick={() => setNewViewMode("carousel")}
                                                className={`px-2 py-1 rounded text-xs transition-all ${newViewMode === "carousel" ? "bg-green-500 text-white" : "text-green-200 hover:bg-green-600"}`}
                                            >
                                                ⟷
                                            </button>
                                            <button
                                                onClick={() => setNewViewMode("grid")}
                                                className={`px-2 py-1 rounded text-xs transition-all ${newViewMode === "grid" ? "bg-green-500 text-white" : "text-green-200 hover:bg-green-600"}`}
                                            >
                                                ⊞
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* レアリティフィルター */}
                                <div className="flex gap-2 flex-wrap mb-4">
                                    {rarityTabs.map(tab => {
                                        const newInRarity = newUnits.filter(u =>
                                            tab.key === "ALL" || u.rarity === tab.key
                                        ).length;
                                        if (newInRarity === 0 && tab.key !== "ALL") return null;
                                        return (
                                            <button
                                                key={tab.key}
                                                onClick={() => setNewRarityFilter(tab.key)}
                                                className={`
                                                    px-3 py-1 rounded-lg font-bold text-sm transition-all
                                                    ${newRarityFilter === tab.key
                                                        ? `${tab.color} text-white shadow-md scale-105`
                                                        : "bg-white/70 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-600"
                                                    }
                                                `}
                                            >
                                                {tab.label}
                                                <span className="ml-1 text-xs opacity-75">({newInRarity})</span>
                                            </button>
                                        );
                                    })}
                                </div>

                        {/* 日付ごとのグループ表示 */}
                        <div className="space-y-6">
                            {unitsByDate.map(([date, units]) => {
                                const filteredUnits = units.filter(u => newRarityFilter === "ALL" || u.rarity === newRarityFilter);
                                if (filteredUnits.length === 0) return null;

                                // 日付フォーマット
                                const dateLabel = date === "unknown" ? t("gacha_date_unknown") : (() => {
                                    const d = new Date(date);
                                    const now = new Date();
                                    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                                    if (diffDays === 0) return t("gacha_date_today");
                                    if (diffDays === 1) return t("gacha_date_yesterday");
                                    if (diffDays <= 7) return t("gacha_date_days_ago").replace("{{days}}", String(diffDays));
                                    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                                })();

                                const isRecent = date !== "unknown" && (() => {
                                    const d = new Date(date);
                                    const now = new Date();
                                    const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
                                    return diffDays <= 7;
                                })();

                                return (
                                    <div key={date} className="border-t border-green-300/50 pt-4 first:border-0 first:pt-0">
                                        {/* 日付ヘッダー */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${isRecent ? "bg-green-500 text-white animate-pulse" : "bg-green-700/30 text-green-800 dark:text-green-300"}`}>
                                                {dateLabel}
                                            </span>
                                            <span className="text-sm text-green-600 dark:text-green-400">
                                                {t("gacha_units_added").replace("{{count}}", String(filteredUnits.length))}
                                            </span>
                                        </div>

                                        {newViewMode === "carousel" ? (
                                            <div className="overflow-x-auto pt-3 pb-2 -mx-4 px-4 scrollbar-hide">
                                                <div className="flex gap-3" style={{ width: 'max-content' }}>
                                                    {filteredUnits.map((unit) => {
                                                        const count = unitInventory[unit.id] || 0;
                                                        const isOwned = count > 0;
                                                        const rarityColors: Record<string, string> = {
                                                            UR: "from-purple-600/60 to-pink-600/60 border-pink-400/50",
                                                            SSR: "from-amber-500/60 to-orange-600/60 border-amber-400/50",
                                                            SR: "from-purple-500/60 to-indigo-600/60 border-purple-400/50",
                                                            R: "from-blue-400/60 to-cyan-500/60 border-blue-400/50",
                                                            N: "from-gray-400/60 to-slate-500/60 border-gray-400/50",
                                                        };
                                                        return (
                                                            <div
                                                                key={unit.id}
                                                                className={`
                                                                    relative flex-shrink-0 w-32 p-2 rounded-xl cursor-pointer transition-all
                                                                    bg-gradient-to-br ${rarityColors[unit.rarity] || rarityColors.N}
                                                                    border-2 hover:shadow-xl hover:scale-105
                                                                    ${isOwned ? "ring-2 ring-green-400/50" : "opacity-80"}
                                                                `}
                                                                onClick={() => openModal(unit)}
                                                            >
                                                                {isRecent && (
                                                                    <div className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold z-10 bg-green-500 text-white animate-pulse shadow-lg">
                                                                        NEW
                                                                    </div>
                                                                )}
                                                                {isOwned && (
                                                                    <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center z-10 shadow-lg">{count}</div>
                                                                )}
                                                                <div className="flex justify-center mb-1">
                                                                    <RarityFrame unitId={unit.id} unitName={unit.name} rarity={unit.rarity} size="md" showLabel={false} baseUnitId={unit.baseUnitId} grayscale={!isOwned} />
                                                                </div>
                                                                <div className="text-xs text-center text-white font-bold truncate drop-shadow-md">{unit.name}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                                {filteredUnits.map((unit) => {
                                                    const count = unitInventory[unit.id] || 0;
                                                    const isOwned = count > 0;
                                                    return (
                                                        <div
                                                            key={unit.id}
                                                            className={`
                                                                relative p-1.5 rounded-lg cursor-pointer transition-all
                                                                hover:bg-green-200/50 dark:hover:bg-green-800/30
                                                                ${!isOwned ? "opacity-70" : ""}
                                                            `}
                                                            onClick={() => openModal(unit)}
                                                        >
                                                            {isRecent && (
                                                                <div className="absolute -top-1 -right-1 px-1 py-0.5 rounded-full bg-green-500 text-white text-[8px] font-bold z-10">
                                                                    NEW
                                                                </div>
                                                            )}
                                                            {isOwned && (
                                                                <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center z-10">
                                                                    {count}
                                                                </div>
                                                            )}
                                                            <div className="flex justify-center">
                                                                <RarityFrame
                                                                    unitId={unit.id}
                                                                    unitName={unit.name}
                                                                    rarity={unit.rarity}
                                                                    size="sm"
                                                                    showLabel={false}
                                                                    baseUnitId={unit.baseUnitId}
                                                                    grayscale={!isOwned}
                                                                />
                                                            </div>
                                                            <div className={`text-[10px] text-center truncate mt-0.5 ${isOwned ? "text-green-900 dark:text-green-200" : "text-gray-500"}`}>
                                                                {unit.name}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                            </>
                        )}
                    </section>
                )}

                {/* 所持ユニット一覧 */}
                <section id="gacha-owned" className="card mb-6 scroll-mt-28">
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setOpenSections((prev) => ({ ...prev, owned: !prev.owned }))}
                    >
                        <h3 className="text-xl font-bold text-amber-950">
                            {t("gacha_owned_units")} ({gachaPool.filter(u => (unitInventory[u.id] || 0) > 0).length}/{gachaPool.length})
                        </h3>
                        <span className="text-2xl">{openSections.owned ? "▲" : "▼"}</span>
                    </div>

                    {openSections.owned && (
                        <>
                            {/* レアリティフィルター */}
                            <div className="flex gap-2 flex-wrap mb-4 mt-4">
                                {rarityTabs.map(tab => {
                                    const ownedInRarity = gachaPool.filter(u =>
                                        (unitInventory[u.id] || 0) > 0 &&
                                        (tab.key === "ALL" || u.rarity === tab.key)
                                    ).length;
                                    return (
                                        <button
                                            key={tab.key}
                                            onClick={() => setOwnedRarityFilter(tab.key)}
                                            className={`
                                                px-3 py-1 rounded-lg font-bold text-sm transition-all
                                                ${ownedRarityFilter === tab.key
                                                    ? `${tab.color} text-white shadow-md scale-105`
                                                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-slate-600"
                                                }
                                            `}
                                        >
                                            {tab.label}
                                            <span className="ml-1 text-xs opacity-75">({ownedInRarity})</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {(() => {
                                const filteredOwned = gachaPool.filter(u =>
                                    (unitInventory[u.id] || 0) > 0 &&
                                    (ownedRarityFilter === "ALL" || u.rarity === ownedRarityFilter)
                                );

                                if (filteredOwned.length === 0) {
                                    return (
                                        <p className="text-amber-900/50 text-center py-4">{t("no_owned_in_rarity")}</p>
                                    );
                                }

                                return (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                        {filteredOwned.map((unit) => {
                                            const count = unitInventory[unit.id] || 0;
                                            return (
                                                <div
                                                    key={unit.id}
                                                    className="relative p-2 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
                                                    onClick={() => openModal(unit)}
                                                >
                                                    <div className="flex justify-center">
                                                        <RarityFrame
                                                            unitId={unit.id}
                                                            unitName={unit.name}
                                                            rarity={unit.rarity}
                                                            size="md"
                                                            showLabel={true}
                                                            count={count}
                                                            baseUnitId={unit.baseUnitId}
                                                        />
                                                    </div>
                                                    <div className="text-xs text-center text-amber-950 truncate mt-1">
                                                        {unit.name}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </section>

                {/* 未所持ユニット一覧 */}
                <section id="gacha-unowned" className="card scroll-mt-28">
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setOpenSections((prev) => ({ ...prev, unowned: !prev.unowned }))}
                    >
                        <h3 className="text-xl font-bold text-gray-600 dark:text-gray-400">
                            {t("unowned_units")} ({gachaPool.filter(u => (unitInventory[u.id] || 0) === 0).length})
                        </h3>
                        <span className="text-2xl">{openSections.unowned ? "▲" : "▼"}</span>
                    </div>

                    {openSections.unowned && (
                        <>
                            {/* レアリティフィルター */}
                            <div className="flex gap-2 flex-wrap mb-4 mt-4">
                                {rarityTabs.map(tab => {
                                    const unownedInRarity = gachaPool.filter(u =>
                                        (unitInventory[u.id] || 0) === 0 &&
                                        (tab.key === "ALL" || u.rarity === tab.key)
                                    ).length;
                                    return (
                                        <button
                                            key={tab.key}
                                            onClick={() => setUnownedRarityFilter(tab.key)}
                                            className={`
                                                px-3 py-1 rounded-lg font-bold text-sm transition-all
                                                ${unownedRarityFilter === tab.key
                                                    ? `${tab.color} text-white shadow-md scale-105`
                                                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-slate-600"
                                                }
                                            `}
                                        >
                                            {tab.label}
                                            <span className="ml-1 text-xs opacity-75">({unownedInRarity})</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {(() => {
                                const filteredUnowned = gachaPool.filter(u =>
                                    (unitInventory[u.id] || 0) === 0 &&
                                    (unownedRarityFilter === "ALL" || u.rarity === unownedRarityFilter)
                                );

                                if (filteredUnowned.length === 0) {
                                    return (
                                        <p className="text-green-600 text-center py-4 font-bold">
                                            🎉 {unownedRarityFilter === "ALL" ? t("all_owned_in_rarity") : t("all_owned_in_rarity")}
                                        </p>
                                    );
                                }

                                return (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 opacity-60">
                                        {filteredUnowned.map((unit) => (
                                            <div
                                                key={unit.id}
                                                className="relative p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                onClick={() => openModal(unit)}
                                            >
                                                <div className="flex justify-center">
                                                    <RarityFrame
                                                        unitId={unit.id}
                                                        unitName={unit.name}
                                                        rarity={unit.rarity}
                                                        size="md"
                                                        showLabel={true}
                                                        grayscale={true}
                                                        baseUnitId={unit.baseUnitId}
                                                    />
                                                </div>
                                                <div className="text-xs text-center text-gray-500 dark:text-gray-500 truncate mt-1">
                                                    {unit.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </section>

                {/* 編成へ */}
                <div className="mt-8 text-center">
                    <Link href="/team" className="btn btn-primary">
                        {t("gacha_to_team")}
                    </Link>
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
                    onToggleTeam={() => {}}
                    dropRate={getDropRate(viewingUnit)}
                />
            )}
        </main>
    );
}
