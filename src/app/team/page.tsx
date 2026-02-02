"use client";

import { useState, useCallback } from "react";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity, UnitRole } from "@/data/types";

// ロール別のアイコンと色
const roleConfig: Record<UnitRole, { icon: string; color: string }> = {
    tank: { icon: "🛡️", color: "text-slate-600 dark:text-slate-400" },
    attacker: { icon: "⚔️", color: "text-red-600 dark:text-red-400" },
    ranger: { icon: "🏹", color: "text-green-600 dark:text-green-400" },
    speedster: { icon: "💨", color: "text-cyan-600 dark:text-cyan-400" },
    flying: { icon: "🪽", color: "text-sky-600 dark:text-sky-400" },
    balanced: { icon: "⚖️", color: "text-gray-600 dark:text-gray-400" },
};
import RarityFrame from "@/components/ui/RarityFrame";
import UnitDetailModal from "@/components/ui/UnitDetailModal";
import VirtualizedGrid from "@/components/ui/VirtualizedGrid";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { hasAnimation } from "@/components/ui/UnitAnimationPreview";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useUnitDetailModal } from "@/hooks/useUnitDetailModal";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";

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
    return unitStatsCache.get(unit.id)?.spawnCooldown ?? DEFAULT_SPAWN_COOLDOWN[unit.rarity];
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

// ガチャ排出率の計算（事前計算してキャッシュ）
const rarityWeights: Record<Rarity, number> = { N: 50, R: 30, SR: 15, SSR: 3, UR: 1 };
const urUnits = gachaPool.filter(u => u.rarity === "UR");
const totalUrWeight = urUnits.reduce((sum, u) => sum + (u.gachaWeight ?? 1), 0);

// レアリティごとのユニット数を事前計算
const unitsCountByRarity: Record<Rarity, number> = {
    N: gachaPool.filter(u => u.rarity === "N").length,
    R: gachaPool.filter(u => u.rarity === "R").length,
    SR: gachaPool.filter(u => u.rarity === "SR").length,
    SSR: gachaPool.filter(u => u.rarity === "SSR").length,
    UR: gachaPool.filter(u => u.rarity === "UR").length,
};

// DropRate/DPS/SpawnCooldown/hasAnimationを事前計算してMapに格納
const unitStatsCache = new Map<string, {
    dropRate: number;
    dps: number;
    spawnCooldown: number;
    hasAnim: boolean;
}>();

allyUnits.forEach(unit => {
    // DropRate計算
    const baseRate = rarityWeights[unit.rarity];
    let dropRate: number;
    if (unit.rarity === "UR") {
        const unitWeight = unit.gachaWeight ?? 1;
        dropRate = (unitWeight / totalUrWeight) * baseRate;
    } else {
        dropRate = baseRate / unitsCountByRarity[unit.rarity];
    }

    // DPS計算
    const dps = unit.attackDamage * (1000 / unit.attackCooldownMs);

    // SpawnCooldown
    const spawnCooldown = unit.spawnCooldownMs ?? DEFAULT_SPAWN_COOLDOWN[unit.rarity];

    // Animation check
    const hasAnim = hasAnimation(unit.atlasKey || unit.id);

    unitStatsCache.set(unit.id, { dropRate, dps, spawnCooldown, hasAnim });
});

function getDropRate(unit: UnitDefinition): number {
    return unitStatsCache.get(unit.id)?.dropRate ?? 0;
}

function getUnitDPS(unit: UnitDefinition): number {
    return unitStatsCache.get(unit.id)?.dps ?? 0;
}

function getUnitHasAnimation(unit: UnitDefinition): boolean {
    return unitStatsCache.get(unit.id)?.hasAnim ?? false;
}

type SortKey = "none" | "hp" | "attack" | "range" | "speed" | "move" | "dps" | "cost" | "spawn" | "droprate" | "size";
type RoleFilter = "ALL" | UnitRole;
type SpecialFilter = "none" | "flying" | "area" | "animation";

export default function TeamPage() {
    const { selectedTeam, unitInventory, setTeam, isLoaded, activeLoadoutIndex, switchLoadout, loadouts } = usePlayerData();
    const { t } = useLanguage();
    const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
    const [specialFilter, setSpecialFilter] = useState<SpecialFilter>("none");
    const [sortBy, setSortBy] = useState<SortKey>("none");
    const { viewingUnit, openModal, closeModal } = useUnitDetailModal();

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
                    return getUnitDPS(b) - getUnitDPS(a);
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

    const roleTabs: { key: RoleFilter; label: string; icon: string; color: string }[] = [
        { key: "ALL", label: "ALL", icon: "🎯", color: "bg-gray-500" },
        { key: "tank", label: t("role_tank"), icon: "🛡️", color: "bg-slate-500" },
        { key: "attacker", label: t("role_attacker"), icon: "⚔️", color: "bg-red-500" },
        { key: "ranger", label: t("role_ranger"), icon: "🏹", color: "bg-green-500" },
        { key: "speedster", label: t("role_speedster"), icon: "💨", color: "bg-cyan-500" },
        { key: "flying", label: t("role_flying"), icon: "🪽", color: "bg-sky-500" },
        { key: "balanced", label: t("role_balanced"), icon: "⚖️", color: "bg-gray-400" },
    ];

    const specialTabs: { key: SpecialFilter; label: string; icon: string; color: string }[] = [
        { key: "none", label: t("sort_none"), icon: "📋", color: "bg-gray-500" },
        { key: "flying", label: t("flying"), icon: "🪽", color: "bg-sky-500" },
        { key: "area", label: t("attack_type_area"), icon: "💥", color: "bg-orange-500" },
        { key: "animation", label: "Anim", icon: "🎬", color: "bg-purple-500" },
    ];

    // フィルタリング処理
    const filteredUnits = allyUnits.filter(u => {
        // レアリティフィルター
        if (rarityFilter !== "ALL" && u.rarity !== rarityFilter) return false;
        // ロールフィルター
        if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
        // 特殊フィルター
        if (specialFilter === "flying" && !u.isFlying) return false;
        if (specialFilter === "area" && u.attackType !== "area") return false;
        if (specialFilter === "animation" && !getUnitHasAnimation(u)) return false;
        return true;
    });
    const MAX_TEAM_SIZE = 7;

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
        openModal(unit);
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

    const getUnitKey = useCallback((unit: UnitDefinition) => unit.id, []);

    const scrollToSection = useCallback((id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    const renderOwnedUnit = useCallback((unit: UnitDefinition) => {
        const isSelected = selectedTeam.includes(unit.id);
        const count = unitInventory[unit.id] || 0;
        const unitHasAnimation = getUnitHasAnimation(unit);
        const otherDeckIndex = getOtherDeckIndex(unit.id);
        const isInOtherDeck = otherDeckIndex !== null;
        const canAdd = !isSelected && !isInOtherDeck && validTeamCount < MAX_TEAM_SIZE;
        return (
            <div
                className={`unit-card relative h-full ${isSelected ? "selected" : ""}`}
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

                {/* ロールバッジ */}
                {unit.role && (
                    <div className={`absolute ${unitHasAnimation ? "top-6" : "-top-2"} -left-2 w-7 h-7 rounded-full ${
                        unit.role === 'tank' ? 'bg-slate-500' :
                        unit.role === 'attacker' ? 'bg-red-500' :
                        unit.role === 'ranger' ? 'bg-green-500' :
                        unit.role === 'speedster' ? 'bg-cyan-500' :
                        unit.role === 'flying' ? 'bg-sky-500' :
                        'bg-gray-500'
                    } text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10`} title={unit.role}>
                        {roleConfig[unit.role].icon}
                    </div>
                )}

                {/* 範囲攻撃バッジ */}
                {unit.attackType === 'area' && (
                    <div className="absolute -bottom-2 -left-2 w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10" title={`Area Attack (${unit.areaRadius}px)`}>
                        💥
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
                        size="lg"
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
                            <span className="text-gray-400 dark:text-gray-500">|</span>
                            <span className="text-gray-600 dark:text-gray-400" title={`${(unit.scale ?? 1).toFixed(1)}x`}>
                                {t(getSizeCategory(unit.scale ?? 1))}
                            </span>
                            {unit.role && (
                                <>
                                    <span className="text-gray-400 dark:text-gray-500">|</span>
                                    <span className={roleConfig[unit.role].color}>{roleConfig[unit.role].icon}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
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
                            <span className="font-bold">{getUnitDPS(unit).toFixed(1)}</span>
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
                        w-full mt-3 py-3 md:py-3.5 rounded-xl font-bold text-sm md:text-base transition-all min-h-[44px] active:scale-95
                        ${isSelected
                            ? "bg-red-500 hover:bg-red-600 text-white shadow-md"
                            : canAdd
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-md"
                                : isInOtherDeck
                                    ? "bg-orange-300 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 cursor-not-allowed"
                                    : "bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
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
    }, [selectedTeam, unitInventory, validTeamCount, t, handleUnitClick, handleToggleUnit, getOtherDeckIndex]);

    const renderUnownedUnit = useCallback((unit: UnitDefinition) => {
        const unitHasAnimation = getUnitHasAnimation(unit);
        return (
            <div
                className="unit-card relative h-full"
            >
                {/* アニメーションバッジ */}
                {unitHasAnimation && (
                    <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10" title="Has Animation">
                        🎬
                    </div>
                )}

                {/* ロールバッジ */}
                {unit.role && (
                    <div className={`absolute ${unitHasAnimation ? "top-6" : "-top-2"} -left-2 w-7 h-7 rounded-full ${
                        unit.role === 'tank' ? 'bg-slate-500' :
                        unit.role === 'attacker' ? 'bg-red-500' :
                        unit.role === 'ranger' ? 'bg-green-500' :
                        unit.role === 'speedster' ? 'bg-cyan-500' :
                        unit.role === 'flying' ? 'bg-sky-500' :
                        'bg-gray-500'
                    } text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10`} title={unit.role}>
                        {roleConfig[unit.role].icon}
                    </div>
                )}

                {/* 範囲攻撃バッジ */}
                {unit.attackType === 'area' && (
                    <div className="absolute -bottom-2 -left-2 w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10" title={`Area Attack (${unit.areaRadius}px)`}>
                        💥
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
                        size="lg"
                        showLabel={true}
                        baseUnitId={unit.baseUnitId}
                        grayscale={true}
                    />
                    <div className="mt-2 text-center">
                        <div className="font-medium text-sm text-gray-500 dark:text-gray-400">{unit.name}</div>
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
                            {unit.role && (
                                <>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-gray-400">{roleConfig[unit.role].icon}</span>
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
                            <span className="font-bold">{getUnitDPS(unit).toFixed(1)}</span>
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
                <div className="w-full mt-3 py-3 md:py-3.5 rounded-xl font-bold text-sm md:text-base bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-center min-h-[44px] flex items-center justify-center">
                    {t("not_owned")}
                </div>
            </div>
        );
    }, [t, handleUnitClick]);

    if (!isLoaded) {
        return <LoadingSpinner icon="🎖️" fullScreen />;
    }

    return (
        <main className="min-h-screen overscroll-contain">
            {/* スティッキーヘッダー */}
            <PageHeader
                title={t("team_title")}
                rightButton={{
                    href: "/stages",
                    label: t("to_stages"),
                    icon: "⚔️",
                }}
            />

            <div className="container px-4 md:px-8 pb-8">
                {/* セクションナビ */}
                <div className="sticky top-20 z-30 mb-6">
                    <div className="card flex items-center gap-2 overflow-x-auto whitespace-nowrap py-3">
                        <button
                            onClick={() => scrollToSection("team-section")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            📋 {t("team_members")}
                        </button>
                        <button
                            onClick={() => scrollToSection("filters-section")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            🧩 {t("filter")}
                        </button>
                        <button
                            onClick={() => scrollToSection("owned-section")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            ✅ {t("owned_units")}
                        </button>
                        <button
                            onClick={() => scrollToSection("unowned-section")}
                            className="btn btn-secondary text-xs md:text-sm py-2 px-3"
                        >
                            🔒 {t("unowned_units")}
                        </button>
                    </div>
                </div>

                {/* 現在の編成 */}
                <section id="team-section" className="mb-8 scroll-mt-28">
                    {/* ロードアウト切り替えタブ */}
                    <div className="flex items-center gap-4 mb-4">
                        <h2 className="text-xl font-bold">
                            📋 {t("team_members")} ({validTeamCount}/{MAX_TEAM_SIZE})
                        </h2>
                        <div className="flex gap-2 md:gap-3">
                            {[0, 1, 2].map((idx) => (
                                <button
                                    key={idx}
                                    onClick={() => switchLoadout(idx)}
                                    className={`
                                        px-4 py-2.5 md:px-6 md:py-3 rounded-xl font-bold text-sm md:text-base transition-all min-h-[44px]
                                        ${activeLoadoutIndex === idx
                                            ? "bg-orange-500 text-white shadow-lg scale-105"
                                            : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-slate-600 active:scale-95"
                                        }
                                    `}
                                >
                                    {idx === 0 ? "🅰️" : idx === 1 ? "🅱️" : "🅲"} Deck {idx + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 md:gap-4 flex-wrap">
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
                                        <div className="text-center relative w-full h-full flex flex-col items-center justify-center">
                                            {/* 解除アイコン */}
                                            <div className="absolute -top-1 -right-1 w-6 h-6 md:w-7 md:h-7 bg-red-500 rounded-full text-white text-sm md:text-base flex items-center justify-center shadow-md z-10 font-bold">
                                                ×
                                            </div>
                                            <RarityFrame
                                                unitId={unit.id}
                                                unitName={unit.name}
                                                rarity={unit.rarity}
                                                size="lg"
                                                showLabel={true}
                                                baseUnitId={unit.baseUnitId}
                                            />
                                            <div className="text-xs md:text-sm mt-1 font-medium truncate max-w-full px-1">{unit.name.slice(0, 6)}</div>
                                            <div className="text-xs md:text-sm text-amber-600 font-bold">¥{unit.cost}</div>
                                        </div>
                                    ) : (
                                        <span className="text-amber-400">+</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {/* 合計コスト表示 */}
                    <div className="mt-4 text-lg font-bold text-amber-700 dark:text-amber-400">
                        💰 {t("total_cost")}: ¥{getTotalCost()}
                    </div>
                </section>

                {/* フィルター全体 */}
                <section id="filters-section" className="mb-6 scroll-mt-28">
                    {/* レアリティフィルタータブ */}
                    <div className="mb-3">
                    <div className="flex gap-2 md:gap-3 flex-wrap">
                        {rarityTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setRarityFilter(tab.key)}
                                className={`
                                    px-4 py-2.5 md:px-5 md:py-3 rounded-xl font-bold text-sm md:text-base transition-all min-h-[44px]
                                    ${rarityFilter === tab.key
                                        ? `${tab.color} text-white shadow-lg scale-105`
                                        : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-slate-600 active:scale-95"
                                    }
                                `}
                            >
                                {tab.label}
                                <span className="ml-1.5 text-xs md:text-sm opacity-75">
                                    ({tab.key === "ALL"
                                        ? allyUnits.length
                                        : allyUnits.filter(u => u.rarity === tab.key).length})
                                </span>
                            </button>
                        ))}
                    </div>
                    </div>

                    {/* ロールフィルター */}
                    <div className="mb-3">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <span className="text-sm md:text-base font-bold text-gray-600 dark:text-gray-400">{t("role")}:</span>
                        {roleTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setRoleFilter(tab.key)}
                                className={`
                                    px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-sm md:text-base transition-all flex items-center gap-1 min-h-[40px] md:min-h-[44px]
                                    ${roleFilter === tab.key
                                        ? `${tab.color} text-white shadow-md scale-105`
                                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95"
                                    }
                                `}
                            >
                                <span>{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                    </div>

                    {/* 特殊フィルター */}
                    <div className="mb-4">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <span className="text-sm md:text-base font-bold text-gray-600 dark:text-gray-400">{t("filter")}:</span>
                        {specialTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setSpecialFilter(tab.key)}
                                className={`
                                    px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-sm md:text-base transition-all flex items-center gap-1 min-h-[40px] md:min-h-[44px]
                                    ${specialFilter === tab.key
                                        ? `${tab.color} text-white shadow-md scale-105`
                                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95"
                                    }
                                `}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                        {/* フィルタークリアボタン */}
                        {(roleFilter !== "ALL" || specialFilter !== "none") && (
                            <button
                                onClick={() => { setRoleFilter("ALL"); setSpecialFilter("none"); }}
                                className="px-3 py-2 rounded-xl text-sm transition-all bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 active:scale-95"
                            >
                                ✕ {t("clear_filter")}
                            </button>
                        )}
                    </div>
                    </div>

                    {/* ソートオプション */}
                    <div>
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <span className="text-sm md:text-base font-bold text-gray-600 dark:text-gray-400">{t("sort_by")}:</span>
                        {sortOptions.map(option => (
                            <button
                                key={option.key}
                                onClick={() => setSortBy(option.key)}
                                className={`
                                    px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-sm md:text-base transition-all flex items-center gap-1.5 min-h-[40px] md:min-h-[44px]
                                    ${sortBy === option.key
                                        ? "bg-blue-500 text-white shadow-md scale-105"
                                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95"
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
                    </div>
                </section>

                {/* 保有ユニット */}
                {(() => {
                    const ownedUnits = sortUnits(filteredUnits.filter(u => (unitInventory[u.id] || 0) > 0));
                    const unownedUnits = sortUnits(filteredUnits.filter(u => (unitInventory[u.id] || 0) === 0));

                    return (
                        <>
                            <section id="owned-section" className="mb-8 scroll-mt-28">
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-xl font-bold text-green-700 dark:text-green-400">✅ {t("owned_units")}</h2>
                                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded-full text-sm font-bold">
                                        {ownedUnits.length} {t("units_count")}
                                    </span>
                                </div>
                                {ownedUnits.length > 0 ? (
                                    <VirtualizedGrid
                                        items={ownedUnits}
                                        getItemKey={getUnitKey}
                                        columnConfig={{ default: 2, sm: 2, md: 3, lg: 4, xl: 5 }}
                                        rowHeight={420}
                                        gap={20}
                                        containerHeight={900}
                                        renderItem={renderOwnedUnit}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 rounded-lg">
                                        {t("no_owned_in_rarity")}
                                    </div>
                                )}
                            </section>

                            {/* 未保有ユニット */}
                            <section id="unowned-section" className="scroll-mt-28">
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-xl font-bold text-gray-500 dark:text-gray-400">🔒 {t("unowned_units")}</h2>
                                    <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 rounded-full text-sm font-bold">
                                        {unownedUnits.length} {t("units_count")}
                                    </span>
                                </div>
                                {unownedUnits.length > 0 ? (
                                    <div className="opacity-60">
                                        <VirtualizedGrid
                                            items={unownedUnits}
                                            getItemKey={getUnitKey}
                                            columnConfig={{ default: 2, sm: 2, md: 3, lg: 4, xl: 5 }}
                                            rowHeight={400}
                                            gap={20}
                                            containerHeight={850}
                                            renderItem={renderUnownedUnit}
                                        />
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-lg font-bold">
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
                    onClose={() => closeModal()}
                    onToggleTeam={() => handleToggleUnit(viewingUnit.id)}
                    dropRate={getDropRate(viewingUnit)}
                />
            )}
        </main>
    );
}
