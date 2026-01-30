"use client";

import { useState } from "react";
import Link from "next/link";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import { hasAnimation } from "@/components/ui/UnitAnimationPreview";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";

const allUnits = unitsData as UnitDefinition[];
// 味方ユニットのみフィルタ
const allyUnits = allUnits.filter((u) => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

// ガチャプール（味方ユニットのみ）
const gachaPool = allyUnits;

// レアリティ別デフォルト召喚クールダウン
const DEFAULT_SPAWN_COOLDOWN: Record<Rarity, number> = {
    N: 2000,
    R: 4000,
    SR: 8000,
    SSR: 12000,
    UR: 15000,
};

function getSpawnCooldown(unit: UnitDefinition): number {
    return unit.spawnCooldownMs ?? DEFAULT_SPAWN_COOLDOWN[unit.rarity];
}

// サイズカテゴリを取得
function getSizeCategory(scale: number): string {
    if (scale <= 0.85) return "size_tiny";
    if (scale <= 1.1) return "size_small";
    if (scale <= 1.4) return "size_medium";
    if (scale <= 1.8) return "size_large";
    if (scale <= 2.5) return "size_huge";
    return "size_giant";
}

// ガチャ排出率の計算
const rarityWeights: Record<Rarity, number> = { N: 50, R: 30, SR: 15, SSR: 3, UR: 1 };
const urUnits = gachaPool.filter(u => u.rarity === "UR");
const totalUrWeight = urUnits.reduce((sum, u) => sum + (u.gachaWeight ?? 1), 0);

function getDropRate(unit: UnitDefinition): number {
    const baseRate = rarityWeights[unit.rarity];
    if (unit.rarity === "UR") {
        const unitWeight = unit.gachaWeight ?? 1;
        return (unitWeight / totalUrWeight) * baseRate;
    }
    const unitsInRarity = gachaPool.filter(u => u.rarity === unit.rarity).length;
    return baseRate / unitsInRarity;
}

type SortKey = "none" | "hp" | "attack" | "range" | "speed" | "move" | "dps" | "cost" | "spawn" | "droprate" | "size";

export default function TeamPage() {
    const { selectedTeam, unitInventory, setTeam, isLoaded, activeLoadoutIndex, switchLoadout, loadouts } = usePlayerData();
    const { t } = useLanguage();
    const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [sortBy, setSortBy] = useState<SortKey>("none");
    const [viewingUnit, setViewingUnit] = useState<UnitDefinition | null>(null);

    // 他のデッキにユニットが含まれているかチェック
    const getOtherDeckIndex = (unitId: string): number | null => {
        for (let i = 0; i < loadouts.length; i++) {
            if (i !== activeLoadoutIndex && loadouts[i].includes(unitId)) {
                return i + 1; // 1-indexed for display
            }
        }
        return null;
    };

    const sortOptions: { key: SortKey; label: string; icon: string }[] = [
        { key: "none", label: t("sort_none"), icon: "📋" },
        { key: "hp", label: t("hp"), icon: "❤️" },
        { key: "attack", label: t("attack"), icon: "⚔️" },
        { key: "dps", label: "DPS", icon: "💥" },
        { key: "range", label: t("range"), icon: "📏" },
        { key: "speed", label: t("attack_speed"), icon: "⏱️" },
        { key: "move", label: t("move_speed"), icon: "🏃" },
        { key: "cost", label: t("cost"), icon: "💰" },
        { key: "spawn", label: t("spawn_cooldown"), icon: "⏰" },
        { key: "droprate", label: t("drop_rate"), icon: "🎰" },
        { key: "size", label: t("size"), icon: "📐" },
    ];

    const sortUnits = (units: UnitDefinition[]): UnitDefinition[] => {
        if (sortBy === "none") return units;

        return [...units].sort((a, b) => {
            switch (sortBy) {
                case "hp":
                    return b.maxHp - a.maxHp;
                case "attack":
                    return b.attackDamage - a.attackDamage;
                case "range":
                    return b.attackRange - a.attackRange;
                case "speed":
                    // Sort by attacks per second (higher = faster, should be first)
                    const atkSpeedA = 1000 / a.attackCooldownMs;
                    const atkSpeedB = 1000 / b.attackCooldownMs;
                    return atkSpeedB - atkSpeedA;
                case "move":
                    return b.speed - a.speed;
                case "dps":
                    const dpsA = a.attackDamage * (1000 / a.attackCooldownMs);
                    const dpsB = b.attackDamage * (1000 / b.attackCooldownMs);
                    return dpsB - dpsA;
                case "cost":
                    return b.cost - a.cost;
                case "spawn":
                    // 召喚クールダウン短い順（早く召喚できる順）
                    return getSpawnCooldown(a) - getSpawnCooldown(b);
                case "droprate":
                    // ドロップレート低い順（レア順）
                    return getDropRate(a) - getDropRate(b);
                case "size":
                    // サイズ大きい順
                    return (b.scale ?? 1) - (a.scale ?? 1);
                default:
                    return 0;
            }
        });
    };

    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gray-500" },
        { key: "N", label: "N", color: "bg-gray-400" },
        { key: "R", label: "R", color: "bg-blue-500" },
        { key: "SR", label: "SR", color: "bg-purple-500" },
        { key: "SSR", label: "SSR", color: "bg-amber-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

    const filteredUnits = rarityFilter === "ALL"
        ? allyUnits
        : allyUnits.filter(u => u.rarity === rarityFilter);
    const MAX_TEAM_SIZE = 8;

    const handleToggleUnit = (unitId: string) => {
        // 有効なIDのみをフィルタリング（無効なIDを削除）
        const validTeam = selectedTeam.filter((id) => allyUnits.some((u) => u.id === id));

        if (validTeam.includes(unitId)) {
            // 解除
            setTeam(validTeam.filter((id) => id !== unitId));
        } else {
            // 追加（上限チェック - 有効なユニット数でチェック）
            if (validTeam.length < MAX_TEAM_SIZE) {
                setTeam([...validTeam, unitId]);
            }
        }
    };

    const handleUnitClick = (unit: UnitDefinition) => {
        setViewingUnit(unit);
    };

    const getSelectedTeamDefs = () => {
        return selectedTeam
            .map((id) => allyUnits.find((u) => u.id === id))
            .filter((u): u is UnitDefinition => u !== undefined);
    };

    // 有効なチームメンバー数（存在するユニットのみカウント）
    const validTeamCount = getSelectedTeamDefs().length;

    // チームの合計コストを計算
    const getTotalCost = () => {
        return getSelectedTeamDefs().reduce((sum, unit) => sum + unit.cost, 0);
    };

    if (!isLoaded) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="text-xl">{t("loading")}</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen p-4 md:p-8">
            {/* ヘッダー */}
            <div className="page-header mb-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <Link href="/" className="btn btn-secondary">
                        ← {t("back_to_home")}
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold">{t("team_title")}</h1>
                    <div className="flex items-center gap-2">
                        <LanguageSwitch />
                        <Link href="/stages" className="btn btn-primary">
                            ⚔️ {t("to_stages")}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container">
                {/* 現在の編成 */}
                <section className="mb-8">
                    {/* ロードアウト切り替えタブ */}
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-xl font-bold">
                            📋 {t("team_members")} ({validTeamCount}/{MAX_TEAM_SIZE})
                        </h2>
                        <div className="flex gap-2">
                            {[0, 1, 2].map((idx) => (
                                <button
                                    key={idx}
                                    onClick={() => switchLoadout(idx)}
                                    className={`
                                        px-4 py-2 rounded-lg font-bold text-sm transition-all
                                        ${activeLoadoutIndex === idx
                                            ? "bg-orange-500 text-white shadow-lg scale-105"
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                        }
                                    `}
                                >
                                    {idx === 0 ? "🅰️" : idx === 1 ? "🅱️" : "🅲"} Deck {idx + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
                            const unit = getSelectedTeamDefs()[index];
                            return (
                                <div
                                    key={index}
                                    className={`slot ${unit ? "filled cursor-pointer" : ""}`}
                                    onClick={() => unit && handleToggleUnit(unit.id)}
                                    title={unit ? `${t("click_to_remove") || "タップで解除"}` : undefined}
                                >
                                    {unit ? (
                                        <div className="text-center relative">
                                            {/* 解除アイコン */}
                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center shadow-md z-10">
                                                ×
                                            </div>
                                            <RarityFrame
                                                unitId={unit.id}
                                                unitName={unit.name}
                                                rarity={unit.rarity}
                                                size="sm"
                                                showLabel={true}
                                                baseUnitId={unit.baseUnitId}
                                            />
                                            <div className="text-xs mt-1">{unit.name.slice(0, 4)}</div>
                                            <div className="text-xs text-amber-600 font-bold">¥{unit.cost}</div>
                                        </div>
                                    ) : (
                                        <span>+</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {/* 合計コスト表示 */}
                    <div className="mt-4 text-lg font-bold text-amber-700">
                        💰 {t("total_cost")}: ¥{getTotalCost()}
                    </div>
                </section>

                {/* レアリティフィルタータブ */}
                <section className="mb-4">
                    <div className="flex gap-2 flex-wrap">
                        {rarityTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setRarityFilter(tab.key)}
                                className={`
                                    px-4 py-2 rounded-lg font-bold text-sm transition-all
                                    ${rarityFilter === tab.key
                                        ? `${tab.color} text-white shadow-lg scale-105`
                                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    }
                                `}
                            >
                                {tab.label}
                                <span className="ml-1 text-xs opacity-75">
                                    ({tab.key === "ALL"
                                        ? allyUnits.length
                                        : allyUnits.filter(u => u.rarity === tab.key).length})
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* ソートオプション */}
                <section className="mb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-600">{t("sort_by")}:</span>
                        {sortOptions.map(option => (
                            <button
                                key={option.key}
                                onClick={() => setSortBy(option.key)}
                                className={`
                                    px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1
                                    ${sortBy === option.key
                                        ? "bg-blue-500 text-white shadow-md scale-105"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }
                                `}
                            >
                                <span>{option.icon}</span>
                                <span>{option.label}</span>
                                {sortBy === option.key && option.key !== "none" && (
                                    <span className="text-xs">↓</span>
                                )}
                            </button>
                        ))}
                    </div>
                </section>

                {/* 保有ユニット */}
                {(() => {
                    const ownedUnits = sortUnits(filteredUnits.filter(u => (unitInventory[u.id] || 0) > 0));
                    const unownedUnits = sortUnits(filteredUnits.filter(u => (unitInventory[u.id] || 0) === 0));

                    return (
                        <>
                            <section className="mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-xl font-bold text-green-700">✅ {t("owned_units")}</h2>
                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                                        {ownedUnits.length} {t("units_count")}
                                    </span>
                                </div>
                                {ownedUnits.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {ownedUnits.map((unit) => {
                                            const isSelected = selectedTeam.includes(unit.id);
                                            const count = unitInventory[unit.id] || 0;
                                            const unitHasAnimation = hasAnimation(unit.atlasKey || unit.id);
                                            const otherDeckIndex = getOtherDeckIndex(unit.id);
                                            const isInOtherDeck = otherDeckIndex !== null;
                                            const canAdd = !isSelected && !isInOtherDeck && validTeamCount < MAX_TEAM_SIZE;
                                            return (
                                                <div
                                                    key={unit.id}
                                                    className={`unit-card relative ${isSelected ? "selected" : ""}`}
                                                >
                                                    {/* 所持個数バッジ */}
                                                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10">
                                                        {count}
                                                    </div>

                                                    {/* アニメーションバッジ */}
                                                    {unitHasAnimation && (
                                                        <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10" title="Has Animation">
                                                            🎬
                                                        </div>
                                                    )}

                                                    {/* 飛行バッジ */}
                                                    {unit.isFlying && (
                                                        <div className={`absolute ${unitHasAnimation ? "-bottom-2" : "-top-2"} -left-2 w-7 h-7 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10`} title="Flying Unit">
                                                            🪽
                                                        </div>
                                                    )}

                                                    {/* クリックで詳細表示エリア */}
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={() => handleUnitClick(unit)}
                                                    >
                                                        <RarityFrame
                                                            unitId={unit.id}
                                                            unitName={unit.name}
                                                            rarity={unit.rarity}
                                                            size="md"
                                                            showLabel={true}
                                                            baseUnitId={unit.baseUnitId}
                                                        />
                                                        <div className="mt-2 text-center">
                                                            <div className="font-medium text-sm">{unit.name}</div>
                                                            <div className="flex items-center justify-center gap-1 mt-1 text-xs">
                                                                <span className={`font-bold ${
                                                                    unit.rarity === "UR" ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" :
                                                                    unit.rarity === "SSR" ? "text-amber-600" :
                                                                    unit.rarity === "SR" ? "text-purple-600" :
                                                                    unit.rarity === "R" ? "text-blue-600" :
                                                                    "text-gray-500"
                                                                }`}>
                                                                    {unit.rarity}
                                                                </span>
                                                                <span className="text-gray-400">|</span>
                                                                <span className="text-gray-600" title={`${(unit.scale ?? 1).toFixed(1)}x`}>
                                                                    {t(getSizeCategory(unit.scale ?? 1))}
                                                                </span>
                                                                {unit.isFlying && (
                                                                    <>
                                                                        <span className="text-gray-400">|</span>
                                                                        <span className="text-sky-500">{t("flying")}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                                                            <div className="flex justify-between">
                                                                <span>❤️ {t("hp")}:</span>
                                                                <span className="font-bold">{unit.maxHp}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>⚔️ {t("attack")}:</span>
                                                                <span className="font-bold">{unit.attackDamage}</span>
                                                            </div>
                                                            <div className="flex justify-between text-red-500">
                                                                <span>💥 DPS:</span>
                                                                <span className="font-bold">{(unit.attackDamage * (1000 / unit.attackCooldownMs)).toFixed(1)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>📏 {t("range")}:</span>
                                                                <span className="font-bold">{unit.attackRange}</span>
                                                            </div>
                                                            <div className="flex justify-between text-orange-500">
                                                                <span>⏱️ {t("attack_speed")}:</span>
                                                                <span className="font-bold">{(1000 / unit.attackCooldownMs).toFixed(1)}/s</span>
                                                            </div>
                                                            <div className="flex justify-between text-blue-500">
                                                                <span>🏃 {t("move_speed")}:</span>
                                                                <span className="font-bold">{unit.speed}</span>
                                                            </div>
                                                            <div className="flex justify-between text-amber-600">
                                                                <span>💰 {t("cost")}:</span>
                                                                <span className="font-bold">¥{unit.cost}</span>
                                                            </div>
                                                            <div className="flex justify-between text-purple-500">
                                                                <span>⏰ {t("spawn_cooldown")}:</span>
                                                                <span className="font-bold">{(getSpawnCooldown(unit) / 1000).toFixed(1)}s</span>
                                                            </div>
                                                            <div className={`flex justify-between ${getDropRate(unit) < 0.1 ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" : "text-pink-500"}`}>
                                                                <span className={getDropRate(unit) < 0.1 ? "text-pink-500" : ""}>🎰 {t("drop_rate")}:</span>
                                                                <span className="font-bold">{getDropRate(unit) < 0.1 ? getDropRate(unit).toFixed(3) : getDropRate(unit).toFixed(2)}%</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 追加/削除ボタン */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleUnit(unit.id);
                                                        }}
                                                        disabled={!isSelected && !canAdd}
                                                        className={`
                                                            w-full mt-2 py-2 rounded-lg font-bold text-sm transition-all
                                                            ${isSelected
                                                                ? "bg-red-500 hover:bg-red-600 text-white"
                                                                : canAdd
                                                                    ? "bg-green-500 hover:bg-green-600 text-white"
                                                                    : isInOtherDeck
                                                                        ? "bg-orange-300 text-orange-700 cursor-not-allowed"
                                                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                                            }
                                                        `}
                                                    >
                                                        {isSelected
                                                            ? t("remove_quick")
                                                            : isInOtherDeck
                                                                ? `📦 ${t("in_deck")} ${otherDeckIndex}`
                                                                : canAdd
                                                                    ? t("add_quick")
                                                                    : t("team_full")}
                                                    </button>

                                                    {/* 選択マーク */}
                                                    {isSelected && (
                                                        <div className="absolute top-12 left-1/2 -translate-x-1/2 text-4xl pointer-events-none">
                                                            ✓
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                                        {t("no_owned_in_rarity")}
                                    </div>
                                )}
                            </section>

                            {/* 未保有ユニット */}
                            <section>
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-xl font-bold text-gray-500">🔒 {t("unowned_units")}</h2>
                                    <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm font-bold">
                                        {unownedUnits.length} {t("units_count")}
                                    </span>
                                </div>
                                {unownedUnits.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 opacity-60">
                                        {unownedUnits.map((unit) => {
                                            const unitHasAnimation = hasAnimation(unit.atlasKey || unit.id);
                                            return (
                                                <div
                                                    key={unit.id}
                                                    className="unit-card relative"
                                                >
                                                    {/* アニメーションバッジ */}
                                                    {unitHasAnimation && (
                                                        <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10" title="Has Animation">
                                                            🎬
                                                        </div>
                                                    )}

                                                    {/* 飛行バッジ */}
                                                    {unit.isFlying && (
                                                        <div className={`absolute ${unitHasAnimation ? "-bottom-2" : "-top-2"} -left-2 w-7 h-7 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10`} title="Flying Unit">
                                                            🪽
                                                        </div>
                                                    )}

                                                    {/* クリックで詳細表示エリア */}
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={() => handleUnitClick(unit)}
                                                    >
                                                        <RarityFrame
                                                            unitId={unit.id}
                                                            unitName={unit.name}
                                                            rarity={unit.rarity}
                                                            size="md"
                                                            showLabel={true}
                                                            baseUnitId={unit.baseUnitId}
                                                            grayscale={true}
                                                        />
                                                        <div className="mt-2 text-center">
                                                            <div className="font-medium text-sm text-gray-500">{unit.name}</div>
                                                            <div className="flex items-center justify-center gap-1 mt-1 text-xs">
                                                                <span className={`font-bold ${
                                                                    unit.rarity === "UR" ? "text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" :
                                                                    unit.rarity === "SSR" ? "text-amber-600" :
                                                                    unit.rarity === "SR" ? "text-purple-600" :
                                                                    unit.rarity === "R" ? "text-blue-600" :
                                                                    "text-gray-500"
                                                                }`}>
                                                                    {unit.rarity}
                                                                </span>
                                                                <span className="text-gray-300">|</span>
                                                                <span className="text-gray-400" title={`${(unit.scale ?? 1).toFixed(1)}x`}>
                                                                    {t(getSizeCategory(unit.scale ?? 1))}
                                                                </span>
                                                                {unit.isFlying && (
                                                                    <>
                                                                        <span className="text-gray-300">|</span>
                                                                        <span className="text-gray-400">{t("flying")}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-1 text-xs text-gray-400 space-y-0.5">
                                                            <div className="flex justify-between">
                                                                <span>❤️ {t("hp")}:</span>
                                                                <span className="font-bold">{unit.maxHp}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>⚔️ {t("attack")}:</span>
                                                                <span className="font-bold">{unit.attackDamage}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>💥 DPS:</span>
                                                                <span className="font-bold">{(unit.attackDamage * (1000 / unit.attackCooldownMs)).toFixed(1)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>📏 {t("range")}:</span>
                                                                <span className="font-bold">{unit.attackRange}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>⏱️ {t("attack_speed")}:</span>
                                                                <span className="font-bold">{(1000 / unit.attackCooldownMs).toFixed(1)}/s</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>🏃 {t("move_speed")}:</span>
                                                                <span className="font-bold">{unit.speed}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>💰 {t("cost")}:</span>
                                                                <span className="font-bold">¥{unit.cost}</span>
                                                            </div>
                                                            <div className={`flex justify-between ${getDropRate(unit) < 0.1 ? "text-pink-400" : "text-pink-400"}`}>
                                                                <span>🎰 {t("drop_rate")}:</span>
                                                                <span className="font-bold">{getDropRate(unit) < 0.1 ? getDropRate(unit).toFixed(3) : getDropRate(unit).toFixed(2)}%</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 未保有表示 */}
                                                    <div className="w-full mt-2 py-2 rounded-lg font-bold text-sm bg-gray-200 text-gray-500 text-center">
                                                        {t("not_owned")}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-green-600 bg-green-50 rounded-lg font-bold">
                                        {t("all_owned_in_rarity")}
                                    </div>
                                )}
                            </section>
                        </>
                    );
                })()}
            </div>

            {/* 詳細モーダル */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={(unitInventory[viewingUnit.id] || 0) > 0}
                    isInTeam={selectedTeam.includes(viewingUnit.id)}
                    onClose={() => setViewingUnit(null)}
                    onToggleTeam={() => handleToggleUnit(viewingUnit.id)}
                    dropRate={getDropRate(viewingUnit)}
                />
            )}
        </main>
    );
}
