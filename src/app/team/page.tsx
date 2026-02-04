"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity, UnitRole } from "@/data/types";
import { SKILL_DEFINITIONS } from "@/data/skills";

// ロール別のアイコンと色（テキスト色とバッジ背景色の両方）
const roleConfig: Record<UnitRole, { icon: string; color: string; bgColor: string }> = {
    tank: { icon: "🛡️", color: "text-slate-600 dark:text-slate-400", bgColor: "bg-slate-500" },
    attacker: { icon: "⚔️", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500" },
    ranger: { icon: "🏹", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500" },
    speedster: { icon: "💨", color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-500" },
    flying: { icon: "🪽", color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-500" },
    balanced: { icon: "⚖️", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-500" },
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
    const { t, language } = useLanguage();
    const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
    const [specialFilter, setSpecialFilter] = useState<SpecialFilter>("none");
    const [skillFilter, setSkillFilter] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortKey>("none");
    const [unitTab, setUnitTab] = useState<"owned" | "unowned">("owned");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isTeamExpanded, setIsTeamExpanded] = useState(true); // チームアコーディオン状態
    const [isFilterExpanded, setIsFilterExpanded] = useState(true); // フィルターアコーディオン状態
    const { viewingUnit, openModal, closeModal } = useUnitDetailModal();

    // スマホ判定（768px以下）- スマホではVirtualizedGridを使わない
    const [isMobile, setIsMobile] = useState(false);
    // グリッドコンテナの高さ（動的計算）
    const [gridHeight, setGridHeight] = useState(800);

    useEffect(() => {
        const updateLayout = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // ヘッダー(64px) + タブ(60px) + フィルター(推定) + padding
            const headerOffset = mobile ? 180 : 160;
            const availableHeight = window.innerHeight - headerOffset;
            setGridHeight(Math.max(400, availableHeight));
        };
        updateLayout();
        window.addEventListener("resize", updateLayout);
        return () => window.removeEventListener("resize", updateLayout);
    }, []);

    // フィルター展開状態が変わったら高さを再計算
    useEffect(() => {
        // オフセットを少し小さくして、より多くのカードを表示
        const headerOffset = isMobile ? 150 : (isFilterExpanded ? 240 : 120);
        const availableHeight = window.innerHeight - headerOffset;
        setGridHeight(Math.max(400, availableHeight));
    }, [isFilterExpanded, isMobile]);

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

    const sortUnits = useCallback((units: UnitDefinition[]): UnitDefinition[] => {
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
    }, [sortBy]);

    const rarityTabs: { key: Rarity | "ALL"; label: string; color: string }[] = [
        { key: "ALL", label: "ALL", color: "bg-gray-500" },
        { key: "N", label: "N", color: "bg-gray-400" },
        { key: "R", label: "R", color: "bg-blue-500" },
        { key: "SR", label: "SR", color: "bg-purple-500" },
        { key: "SSR", label: "SSR", color: "bg-amber-500" },
        { key: "UR", label: "UR", color: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500" },
    ];

    // Memoize rarity counts to avoid repeated filtering in render
    const rarityUnitCounts = useMemo(() => {
        const counts: Record<Rarity | "ALL", number> = {
            ALL: allyUnits.length,
            N: 0, R: 0, SR: 0, SSR: 0, UR: 0
        };
        for (const u of allyUnits) {
            counts[u.rarity]++;
        }
        return counts;
    }, []);

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

    // スキルフィルタータブ（UR/SSRユニット向け）
    const skillTabs = Object.entries(SKILL_DEFINITIONS).map(([id, skill]) => ({
        key: id,
        label: language === 'ja' ? skill.nameJa : skill.name,
        icon: skill.icon,
        color: "bg-purple-500"
    }));

    // ユニット名取得（翻訳対応）
    const getUnitName = useCallback((unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    }, [t]);

    // フィルタリング処理
    const filteredUnits = useMemo(() => allyUnits.filter(u => {
        // 検索フィルター
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const unitName = getUnitName(u).toLowerCase();
            const unitId = u.id.toLowerCase();
            if (!unitName.includes(query) && !unitId.includes(query)) return false;
        }
        // レアリティフィルター
        if (rarityFilter !== "ALL" && u.rarity !== rarityFilter) return false;
        // ロールフィルター
        if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
        // 特殊フィルター
        if (specialFilter === "flying" && !u.isFlying) return false;
        if (specialFilter === "area" && u.attackType !== "area") return false;
        if (specialFilter === "animation" && !getUnitHasAnimation(u)) return false;
        // スキルフィルター（UR/SSR対象）
        if (skillFilter && u.skill?.id !== skillFilter) return false;
        return true;
    }), [rarityFilter, roleFilter, specialFilter, skillFilter, searchQuery, getUnitName]);

    // Memoize owned/unowned unit lists to avoid repeated filtering
    const { ownedUnits, unownedUnits } = useMemo(() => {
        const owned: UnitDefinition[] = [];
        const unowned: UnitDefinition[] = [];
        for (const u of filteredUnits) {
            if ((unitInventory[u.id] || 0) > 0) {
                owned.push(u);
            } else {
                unowned.push(u);
            }
        }
        return {
            ownedUnits: sortUnits(owned),
            unownedUnits: sortUnits(unowned)
        };
    }, [filteredUnits, unitInventory, sortUnits]);

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
                    <div className={`absolute ${unitHasAnimation ? "top-6" : "-top-2"} -left-2 w-7 h-7 rounded-full ${roleConfig[unit.role].bgColor} text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10`} title={unit.role}>
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
                    <div className={`absolute ${unitHasAnimation ? "top-6" : "-top-2"} -left-2 w-7 h-7 rounded-full ${roleConfig[unit.role].bgColor} text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow z-10`} title={unit.role}>
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

            {/* ========== モバイル用デッキ（md未満で表示） ========== */}
            <div className="md:hidden sticky top-16 z-30 w-full bg-gradient-to-b from-amber-50 via-amber-50 to-transparent dark:from-slate-900 dark:via-slate-900 px-3 py-2">
                <div className="card p-2">
                    <div className="flex items-center gap-2">
                        {/* ロードアウト */}
                        <div className="flex gap-1">
                            {[0, 1, 2].map((idx) => (
                                <button
                                    key={idx}
                                    onClick={() => switchLoadout(idx)}
                                    className={`w-7 h-7 rounded font-bold text-xs ${activeLoadoutIndex === idx ? "bg-orange-500 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-500"}`}
                                >
                                    {idx === 0 ? "A" : idx === 1 ? "B" : "C"}
                                </button>
                            ))}
                        </div>
                        {/* デッキスロット（横並び・スクロール） */}
                        <div className="flex gap-1.5 flex-1 overflow-x-auto pb-1">
                            {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
                                const unit = getSelectedTeamDefs()[index];
                                return (
                                    <div
                                        key={index}
                                        onClick={() => unit && handleToggleUnit(unit.id)}
                                        className={`w-11 h-11 flex-shrink-0 rounded-lg flex items-center justify-center ${unit ? "cursor-pointer" : "bg-slate-200 dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-600"}`}
                                    >
                                        {unit ? (
                                            <div className="relative w-full h-full">
                                                <RarityFrame unitId={unit.id} unitName={unit.name} rarity={unit.rarity} size="sm" baseUnitId={unit.baseUnitId} />
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">×</div>
                                            </div>
                                        ) : (
                                            <span className="text-amber-400 text-sm">+</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* コスト */}
                        <div className="text-amber-600 dark:text-amber-400 text-xs font-bold whitespace-nowrap">
                            {validTeamCount}/{MAX_TEAM_SIZE}<br/>💰¥{getTotalCost()}
                        </div>
                    </div>
                </div>
            </div>

            {/* サイドバーレイアウト（md以上で2カラム） */}
            <div className="md:flex">
                {/* ========== 左サイドバー: デッキ（md以上で表示） ========== */}
                <aside className="hidden md:flex flex-col w-32 lg:w-36 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-2 overflow-y-auto">
                    {/* デッキヘッダー */}
                    <div className="text-center mb-2">
                        <span className="font-bold text-slate-700 dark:text-white text-sm">📋 {t("team_members")}</span>
                        <div className="text-amber-600 dark:text-amber-400 text-xs font-bold">
                            {validTeamCount}/{MAX_TEAM_SIZE} • 💰¥{getTotalCost()}
                        </div>
                    </div>

                    {/* ロードアウト切り替え */}
                    <div className="flex justify-center gap-1 mb-3">
                        {[0, 1, 2].map((idx) => (
                            <button
                                key={idx}
                                onClick={() => switchLoadout(idx)}
                                className={`
                                    w-8 h-8 rounded-lg font-bold text-xs transition-all
                                    ${activeLoadoutIndex === idx
                                        ? "bg-orange-500 text-white shadow-md"
                                        : "bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                                    }
                                `}
                            >
                                {idx === 0 ? "🅰️" : idx === 1 ? "🅱️" : "🅲"}
                            </button>
                        ))}
                    </div>

                    {/* デッキスロット（縦並び） */}
                    <div className="space-y-2 flex-1">
                        {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
                            const unit = getSelectedTeamDefs()[index];
                            return (
                                <div
                                    key={index}
                                    onClick={() => unit && handleToggleUnit(unit.id)}
                                    className={`
                                        aspect-square rounded-xl flex items-center justify-center cursor-pointer transition-all
                                        ${unit
                                            ? "bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 hover:scale-105"
                                            : "bg-slate-200 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600"
                                        }
                                    `}
                                    title={unit ? `${unit.name} - ${t("click_to_remove")}` : undefined}
                                >
                                    {unit ? (
                                        <div className="relative w-full h-full p-1">
                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center z-10 font-bold shadow">×</div>
                                            <RarityFrame
                                                unitId={unit.id}
                                                unitName={unit.name}
                                                rarity={unit.rarity}
                                                size="md"
                                                baseUnitId={unit.baseUnitId}
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 text-center">
                                                <span className="text-[10px] bg-black/60 text-amber-400 px-1 rounded font-bold">¥{unit.cost}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-amber-400 text-xl">+</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* ========== 右メイン: ユニット一覧 ========== */}
                <div className="flex-1 min-w-0 px-3 md:px-6 pb-8">
                    <section id="units-section" className="pt-3 md:pt-4">
                    {/* タブ切り替え */}
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setUnitTab("owned")}
                            className={`
                                flex-1 py-3 px-4 rounded-xl font-bold text-base transition-all min-h-[48px]
                                ${unitTab === "owned"
                                    ? "bg-green-500 text-white shadow-lg"
                                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                                }
                            `}
                        >
                            ✅ {t("owned_units")}
                            <span className="ml-2 px-2 py-0.5 rounded-full text-sm bg-white/20">
                                {ownedUnits.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setUnitTab("unowned")}
                            className={`
                                flex-1 py-3 px-4 rounded-xl font-bold text-base transition-all min-h-[48px]
                                ${unitTab === "unowned"
                                    ? "bg-gray-500 text-white shadow-lg"
                                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                                }
                            `}
                        >
                            🔒 {t("unowned_units")}
                            <span className="ml-2 px-2 py-0.5 rounded-full text-sm bg-white/20">
                                {unownedUnits.length}
                            </span>
                        </button>
                    </div>

                    {/* フィルター・ソート（アコーディオン） */}
                    <div className="card p-3 mb-4">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                🔍 {t("filter")} / {t("sort_by")}
                                {/* アクティブなフィルター数を表示 */}
                                {(rarityFilter !== "ALL" || roleFilter !== "ALL" || specialFilter !== "none" || skillFilter !== null || sortBy !== "none" || searchQuery) && (
                                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-500 text-white">
                                        {[
                                            rarityFilter !== "ALL",
                                            roleFilter !== "ALL",
                                            specialFilter !== "none",
                                            skillFilter !== null,
                                            sortBy !== "none",
                                            searchQuery !== ""
                                        ].filter(Boolean).length}
                                    </span>
                                )}
                            </h3>
                            <button
                                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                                className={`
                                    px-3 py-1.5 rounded-lg font-bold text-xs transition-all min-h-[32px]
                                    flex items-center gap-1
                                    ${isFilterExpanded
                                        ? "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                                        : "bg-blue-500 text-white shadow-md"
                                    }
                                `}
                                aria-label={isFilterExpanded ? t("collapse") : t("expand")}
                            >
                                <span className="transition-transform duration-200" style={{ transform: isFilterExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                                    ▼
                                </span>
                                <span className="hidden sm:inline">{isFilterExpanded ? t("collapse") : t("expand")}</span>
                            </button>
                        </div>

                        {/* フィルター内容（アコーディオン） */}
                        <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                isFilterExpanded ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
                            }`}
                        >
                            <div className="space-y-2">
                                {/* 検索 */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={t("search_units")}
                                        className="w-full px-3 py-2 pl-9 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* レアリティ */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                    {rarityTabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => {
                                                setRarityFilter(tab.key);
                                                if (tab.key !== "UR" && tab.key !== "SSR" && tab.key !== "ALL") setSkillFilter(null);
                                            }}
                                            className={`
                                                px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap min-h-[32px]
                                                ${rarityFilter === tab.key
                                                    ? `${tab.color} text-white shadow-md`
                                                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 active:scale-95"
                                                }
                                            `}
                                        >
                                            {tab.label}
                                            <span className="ml-1 text-xs opacity-75">({rarityUnitCounts[tab.key]})</span>
                                        </button>
                                    ))}
                                </div>

                                {/* ロール */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{t("role")}:</span>
                                    {roleTabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setRoleFilter(tab.key)}
                                            className={`
                                                px-2 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 whitespace-nowrap min-h-[32px]
                                                ${roleFilter === tab.key
                                                    ? `${tab.color} text-white shadow-md`
                                                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 active:scale-95"
                                                }
                                            `}
                                        >
                                            <span>{tab.icon}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* 特殊フィルター */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{t("filter")}:</span>
                                    {specialTabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setSpecialFilter(tab.key)}
                                            className={`
                                                px-2 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 whitespace-nowrap min-h-[32px]
                                                ${specialFilter === tab.key
                                                    ? `${tab.color} text-white shadow-md`
                                                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 active:scale-95"
                                                }
                                            `}
                                        >
                                            <span>{tab.icon}</span>
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}
                                    {(roleFilter !== "ALL" || specialFilter !== "none" || skillFilter !== null) && (
                                        <button
                                            onClick={() => { setRoleFilter("ALL"); setSpecialFilter("none"); setSkillFilter(null); }}
                                            className="px-2 py-1.5 rounded-lg text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 active:scale-95"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* スキルフィルター */}
                                {(rarityFilter === "UR" || rarityFilter === "SSR" || rarityFilter === "ALL") && (
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{t("skill")}:</span>
                                        <button
                                            onClick={() => setSkillFilter(null)}
                                            className={`
                                                px-2 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 whitespace-nowrap min-h-[32px]
                                                ${skillFilter === null
                                                    ? "bg-gray-500 text-white shadow-md"
                                                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 active:scale-95"
                                                }
                                            `}
                                        >
                                            📋
                                        </button>
                                        {skillTabs.map(tab => {
                                            const skillUnitCount = allyUnits.filter(u => u.skill?.id === tab.key).length;
                                            return (
                                                <button
                                                    key={tab.key}
                                                    onClick={() => setSkillFilter(tab.key)}
                                                    className={`
                                                        px-2 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 whitespace-nowrap min-h-[32px]
                                                        ${skillFilter === tab.key
                                                            ? `${tab.color} text-white shadow-md`
                                                            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 active:scale-95"
                                                        }
                                                    `}
                                                >
                                                    <span>{tab.icon}</span>
                                                    <span className="text-xs opacity-75">({skillUnitCount})</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* ソート */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-gray-200 dark:border-slate-600 pt-2">
                                    <span className="text-xs font-bold text-blue-500 dark:text-blue-400">{t("sort_by")}:</span>
                                    {sortOptions.map(option => (
                                        <button
                                            key={option.key}
                                            onClick={() => setSortBy(option.key)}
                                            className={`
                                                px-2 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 whitespace-nowrap min-h-[32px]
                                                ${sortBy === option.key
                                                    ? "bg-blue-500 text-white shadow-md"
                                                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 active:scale-95"
                                                }
                                            `}
                                        >
                                            <span>{option.icon}</span>
                                            {sortBy === option.key && option.key !== "none" && <span>↓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 保有ユニット */}
                    {unitTab === "owned" && (
                        ownedUnits.length > 0 ? (
                            isMobile ? (
                                <div className="grid grid-cols-2 gap-3 pt-6">
                                    {ownedUnits.map((unit) => (
                                        <div key={unit.id}>{renderOwnedUnit(unit)}</div>
                                    ))}
                                </div>
                            ) : (
                                <VirtualizedGrid
                                    items={ownedUnits}
                                    getItemKey={getUnitKey}
                                    columnConfig={{ default: 2, sm: 2, md: 3, lg: 4, xl: 5 }}
                                    rowHeight={420}
                                    gap={20}
                                    containerHeight={gridHeight}
                                    renderItem={renderOwnedUnit}
                                />
                            )
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 rounded-lg">
                                {t("no_owned_in_rarity")}
                            </div>
                        )
                    )}

                    {/* 未保有ユニット */}
                    {unitTab === "unowned" && (
                        unownedUnits.length > 0 ? (
                            <div className="opacity-70">
                                {isMobile ? (
                                    <div className="grid grid-cols-2 gap-3 pt-6">
                                        {unownedUnits.map((unit) => (
                                            <div key={unit.id}>{renderUnownedUnit(unit)}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <VirtualizedGrid
                                        items={unownedUnits}
                                        getItemKey={getUnitKey}
                                        columnConfig={{ default: 2, sm: 2, md: 3, lg: 4, xl: 5 }}
                                        rowHeight={400}
                                        gap={20}
                                        containerHeight={gridHeight}
                                        renderItem={renderUnownedUnit}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-lg font-bold">
                                {t("all_owned_in_rarity")}
                            </div>
                        )
                    )}
                    </section>
                </div>
                {/* /右メイン */}
            </div>
            {/* /サイドバーレイアウト */}

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
