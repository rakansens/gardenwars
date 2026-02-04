"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import unitsData from "@/data/units";
import type { UnitDefinition, Rarity, UnitRole } from "@/data/types";
import { hasAnimation } from "@/components/ui/UnitAnimationPreview";
import { usePlayerData } from "@/hooks/usePlayerData";
import { useUnitDetailModal } from "@/hooks/useUnitDetailModal";
import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";

// New Components
import TeamSidebar from "@/components/team/TeamSidebar";
import TeamFilters from "@/components/team/TeamFilters";
import UnitCollection from "@/components/team/UnitCollection";
import UnitDetailModal from "@/components/ui/UnitDetailModal";

// --- Configuration & Helpers (Extracted) ---

const roleConfig: Record<UnitRole, { icon: string; color: string; bgColor: string }> = {
    tank: { icon: "🛡️", color: "text-slate-600 dark:text-slate-400", bgColor: "bg-slate-500" },
    attacker: { icon: "⚔️", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500" },
    ranger: { icon: "🏹", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500" },
    speedster: { icon: "💨", color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-500" },
    flying: { icon: "🪽", color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-500" },
    balanced: { icon: "⚖️", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-500" },
};

const allUnits = unitsData as UnitDefinition[];
// Filter enemy/boss units
const allyUnits = allUnits.filter((u) => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);
const gachaPool = allyUnits;

const DEFAULT_SPAWN_COOLDOWN: Record<Rarity, number> = {
    N: 2000, R: 4000, SR: 8000, SSR: 12000, UR: 15000,
};

// --- Pre-calculations (Weights, Stats) ---
// Note: In a real app these might be in a utility file or hook.
const rarityWeights: Record<Rarity, number> = { N: 50, R: 30, SR: 15, SSR: 3, UR: 1 };
const urUnits = gachaPool.filter(u => u.rarity === "UR");
const totalUrWeight = urUnits.reduce((sum, u) => sum + (u.gachaWeight ?? 1), 0);
const unitsCountByRarity: Record<Rarity, number> = {
    N: gachaPool.filter(u => u.rarity === "N").length,
    R: gachaPool.filter(u => u.rarity === "R").length,
    SR: gachaPool.filter(u => u.rarity === "SR").length,
    SSR: gachaPool.filter(u => u.rarity === "SSR").length,
    UR: gachaPool.filter(u => u.rarity === "UR").length,
};

const unitStatsCache = new Map<string, { dropRate: number; dps: number; spawnCooldown: number; hasAnim: boolean; }>();

allyUnits.forEach(unit => {
    // DropRate
    const baseRate = rarityWeights[unit.rarity];
    let dropRate: number;
    if (unit.rarity === "UR") {
        const unitWeight = unit.gachaWeight ?? 1;
        dropRate = (unitWeight / totalUrWeight) * baseRate;
    } else {
        dropRate = baseRate / unitsCountByRarity[unit.rarity];
    }
    // DPS
    const dps = unit.attackDamage * (1000 / unit.attackCooldownMs);
    // SpawnCooldown
    const spawnCooldown = unit.spawnCooldownMs ?? DEFAULT_SPAWN_COOLDOWN[unit.rarity];
    // Animation
    const hasAnim = hasAnimation(unit.atlasKey || unit.id);

    unitStatsCache.set(unit.id, { dropRate, dps, spawnCooldown, hasAnim });
});

function getDropRate(unit: UnitDefinition) { return unitStatsCache.get(unit.id)?.dropRate ?? 0; }
function getUnitDPS(unit: UnitDefinition) { return unitStatsCache.get(unit.id)?.dps ?? 0; }
function getSpawnCooldown(unit: UnitDefinition) { return unitStatsCache.get(unit.id)?.spawnCooldown ?? DEFAULT_SPAWN_COOLDOWN[unit.rarity]; }
function getUnitHasAnimation(unit: UnitDefinition) { return unitStatsCache.get(unit.id)?.hasAnim ?? false; }

// --- Types ---
type SortKey = "none" | "hp" | "attack" | "range" | "speed" | "move" | "dps" | "cost" | "spawn" | "droprate" | "size";
type RoleFilter = "ALL" | UnitRole;

// --- Main Component ---

export default function TeamPage() {
    const { selectedTeam, unitInventory, setTeam, isLoaded, activeLoadoutIndex, switchLoadout, loadouts } = usePlayerData();
    const { t } = useLanguage();
    const { openModal, closeModal, viewingUnit } = useUnitDetailModal();

    // --- State ---
    const [rarityFilter, setRarityFilter] = useState<Rarity | "ALL">("ALL");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
    const [sortBy, setSortBy] = useState<SortKey>("none");
    const [unitTab, setUnitTab] = useState<"owned" | "unowned">("owned");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Layout State
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // --- Helpers ---
    const getUnitName = useCallback((unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    }, [t]);

    const getOtherDeckIndex = useCallback((unitId: string): number | null => {
        for (let i = 0; i < loadouts.length; i++) {
            if (i !== activeLoadoutIndex && loadouts[i].includes(unitId)) {
                return i + 1;
            }
        }
        return null;
    }, [activeLoadoutIndex, loadouts]);

    // --- Filtering & Sorting ---
    const filteredUnits = useMemo(() => allyUnits.filter(u => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!getUnitName(u).toLowerCase().includes(query) && !u.id.toLowerCase().includes(query)) return false;
        }
        if (rarityFilter !== "ALL" && u.rarity !== rarityFilter) return false;
        if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
        return true;
    }), [rarityFilter, roleFilter, searchQuery, getUnitName]);

    const sortUnits = useCallback((units: UnitDefinition[]): UnitDefinition[] => {
        if (sortBy === "none") return units;
        return [...units].sort((a, b) => {
            switch (sortBy) {
                case "hp": return b.maxHp - a.maxHp;
                case "attack": return b.attackDamage - a.attackDamage;
                case "range": return b.attackRange - a.attackRange;
                case "speed": return (1000 / a.attackCooldownMs) - (1000 / b.attackCooldownMs); // High AtkSpd first
                case "move": return b.speed - a.speed;
                case "dps": return getUnitDPS(b) - getUnitDPS(a);
                case "cost": return b.cost - a.cost;
                case "spawn": return getSpawnCooldown(a) - getSpawnCooldown(b); // Lower cooldown first
                case "droprate": return getDropRate(a) - getDropRate(b); // Rare first
                case "size": return (b.scale ?? 1) - (a.scale ?? 1);
                default: return 0;
            }
        });
    }, [sortBy]);

    const { ownedUnits, unownedUnits } = useMemo(() => {
        const owned: UnitDefinition[] = [];
        const unowned: UnitDefinition[] = [];
        for (const u of filteredUnits) {
            if ((unitInventory[u.id] || 0) > 0) owned.push(u);
            else unowned.push(u);
        }
        return {
            ownedUnits: sortUnits(owned),
            unownedUnits: sortUnits(unowned)
        };
    }, [filteredUnits, unitInventory, sortUnits]);


    // --- Team Management Logic ---
    const MAX_TEAM_SIZE = 7;
    const validTeamCount = selectedTeam.filter(id => allyUnits.some(u => u.id === id)).length;

    const handleToggleUnit = (unitId: string) => {
        const validTeam = selectedTeam.filter((id) => allyUnits.some((u) => u.id === id));
        if (validTeam.includes(unitId)) {
            setTeam(validTeam.filter((id) => id !== unitId));
        } else {
            if (validTeam.length < MAX_TEAM_SIZE) {
                setTeam([...validTeam, unitId]);
            }
        }
    };

    // --- Render ---

    return (
        <main className="min-h-screen overscroll-contain bg-slate-50 dark:bg-slate-900 pb-safe"> {/* Added bg color */}
            {/* Header */}
            <PageHeader
                title={t("team_title")}
                rightButton={{
                    href: "/stages",
                    label: t("to_stages"),
                    icon: "⚔️",
                }}
            />

            <div className="md:flex h-[calc(100vh-4rem)]"> {/* Content Container */}

                {/* Left Sidebar (Desktop) */}
                <TeamSidebar
                    selectedTeam={selectedTeam}
                    allyUnits={allyUnits}
                    activeLoadoutIndex={activeLoadoutIndex}
                    switchLoadout={switchLoadout}
                    onRemoveUnit={(id) => handleToggleUnit(id)}
                    MAX_TEAM_SIZE={MAX_TEAM_SIZE}
                    isMobile={false} // Hidden via CSS on mobile
                />

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-24 md:pb-8"> {/* Main scroll area */}

                        {/* Filters */}
                        <TeamFilters
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            rarityFilter={rarityFilter}
                            setRarityFilter={setRarityFilter}
                            roleFilter={roleFilter}
                            setRoleFilter={setRoleFilter}
                            sortBy={sortBy}
                            setSortBy={setSortBy}
                            activeCount={[
                                rarityFilter !== "ALL",
                                roleFilter !== "ALL",
                                sortBy !== "none",
                                searchQuery !== ""
                            ].filter(Boolean).length}
                        />

                        {/* Unit Grid */}
                        <UnitCollection
                            ownedUnits={ownedUnits}
                            unownedUnits={unownedUnits}
                            unitInventory={unitInventory}
                            selectedTeam={selectedTeam}
                            onToggleUnit={handleToggleUnit}
                            onUnitClick={openModal}
                            activeTab={unitTab}
                            setActiveTab={setUnitTab}
                            // Configs & Helpers to pass down
                            roleConfig={roleConfig}
                            getUnitDPS={getUnitDPS}
                            getOtherDeckIndex={getOtherDeckIndex}
                            getUnitHasAnimation={getUnitHasAnimation}
                            validTeamCount={validTeamCount}
                            MAX_TEAM_SIZE={MAX_TEAM_SIZE}
                            isLoaded={isLoaded}
                        />
                    </div>

                    {/* Mobile Bottom Deck (Sticky) */}
                    {isMobile && (
                        <TeamSidebar
                            selectedTeam={selectedTeam}
                            allyUnits={allyUnits} // Pass all needed props
                            activeLoadoutIndex={activeLoadoutIndex}
                            switchLoadout={switchLoadout}
                            onRemoveUnit={(id) => handleToggleUnit(id)}
                            MAX_TEAM_SIZE={MAX_TEAM_SIZE}
                            isMobile={true}
                        />
                    )}
                </div>
            </div>
            {/* Detail Modal */}
            {viewingUnit && (
                <UnitDetailModal
                    unit={viewingUnit}
                    isOwned={(unitInventory[viewingUnit.id] || 0) > 0}
                    isInTeam={selectedTeam.includes(viewingUnit.id)}
                    onToggleTeam={() => handleToggleUnit(viewingUnit.id)}
                    onClose={closeModal}
                />
            )}
        </main>
    );
}
