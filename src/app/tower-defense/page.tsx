"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { towerDefenseStages } from "@/data/tower-defense";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import type { TowerDefenseStageDefinition, UnitDefinition } from "@/data/types";
import PageHeader from "@/components/layout/PageHeader";
import RarityFrame from "@/components/ui/RarityFrame";
import Modal from "@/components/ui/Modal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import unitsData from "@/data/units";
import { getSpritePath } from "@/lib/sprites";

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

const MAX_TEAM = 5;
const STORAGE_KEY = "td_team";

// レアリティ倍率（ステータス表示用）
const RARITY_MUL: Record<string, { damage: number; hp: number; range: number; speed: number }> = {
    N: { damage: 0.8, hp: 0.8, range: 0.85, speed: 1.0 },
    R: { damage: 1.0, hp: 1.0, range: 1.0, speed: 1.0 },
    SR: { damage: 1.3, hp: 1.3, range: 1.15, speed: 1.1 },
    SSR: { damage: 1.6, hp: 1.6, range: 1.3, speed: 1.2 },
    UR: { damage: 2.0, hp: 2.0, range: 1.5, speed: 1.3 },
};

const difficultyColors: Record<string, string> = {
    easy: "bg-green-500",
    normal: "bg-blue-500",
    hard: "bg-orange-500",
    extreme: "bg-red-500",
};

const difficultyLabels: Record<string, { ja: string; en: string }> = {
    easy: { ja: "初級", en: "Easy" },
    normal: { ja: "中級", en: "Normal" },
    hard: { ja: "上級", en: "Hard" },
    extreme: { ja: "極限", en: "Extreme" },
};

const stageBanners: Record<string, string> = {
    td_stage_1: "/assets/stages/easy_banner.webp",
    td_stage_2: "/assets/stages/normal_banner.webp",
    td_stage_3: "/assets/stages/extreme_banner.webp",
};

const stageGradients: Record<string, string> = {
    td_stage_1: "from-green-500 to-emerald-700",
    td_stage_2: "from-amber-500 to-orange-700",
    td_stage_3: "from-red-600 to-red-900",
};

// Wave内のユニークな敵ユニットを取得
const getUniqueEnemyUnits = (stage: TowerDefenseStageDefinition): UnitDefinition[] => {
    const unitIds = new Set<string>();
    for (const wave of stage.waves) {
        for (const group of wave.enemies) {
            unitIds.add(group.unitId);
        }
    }
    return Array.from(unitIds)
        .map(id => allUnits.find(u => u.id === id))
        .filter((u): u is UnitDefinition => u !== undefined);
};

// 総敵数カウント
const getTotalEnemies = (stage: TowerDefenseStageDefinition): number => {
    return stage.waves.reduce((sum, wave) =>
        sum + wave.enemies.reduce((wSum, group) => wSum + group.count, 0), 0
    );
};

export default function TowerDefenseSelectPage() {
    const { t, language } = useLanguage();
    const { selectedTeam, unitInventory, isLoaded } = usePlayerData();
    const [teamUnits, setTeamUnits] = useState<UnitDefinition[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // 初回ロード（localStorage優先）
    if (isLoaded && !initialized) {
        setInitialized(true);
        let team: UnitDefinition[] = [];

        // 1. localStorage
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const ids = JSON.parse(saved) as string[];
                team = ids
                    .map(id => playableUnits.find(u => u.id === id))
                    .filter((u): u is UnitDefinition => !!u);
            }
        } catch { }

        // 2. selectedTeam フォールバック
        if (team.length === 0 && selectedTeam.length > 0) {
            team = selectedTeam
                .map(id => playableUnits.find(u => u.id === id))
                .filter((u): u is UnitDefinition => !!u)
                .slice(0, MAX_TEAM);
        }

        // 3. 所持ユニットから自動選択
        if (team.length === 0) {
            const ownedIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
            const owned = playableUnits.filter(u => ownedIds.includes(u.id));
            team = owned.slice(0, MAX_TEAM);
        }

        // 4. 最終フォールバック
        if (team.length === 0) {
            team = playableUnits.slice(0, 3);
        }

        setTeamUnits(team);
    }

    // 全プレイアブルユニット（所持優先ソート）
    const selectableUnits = [...playableUnits].sort((a, b) => {
        const aOwned = (unitInventory[a.id] ?? 0) > 0 ? 1 : 0;
        const bOwned = (unitInventory[b.id] ?? 0) > 0 ? 1 : 0;
        return bOwned - aOwned;
    });

    const getUnitName = (unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    };

    // localStorage に編成を保存
    const saveTeam = (team: UnitDefinition[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(team.map(u => u.id)));
        } catch { }
    };

    const handleAddUnit = (unit: UnitDefinition) => {
        if (teamUnits.length >= MAX_TEAM) return;
        if (teamUnits.find(u => u.id === unit.id)) return;
        const newTeam = [...teamUnits, unit];
        setTeamUnits(newTeam);
        saveTeam(newTeam);
        setIsModalOpen(false);
    };

    const removeUnit = (index: number) => {
        const newTeam = teamUnits.filter((_, i) => i !== index);
        setTeamUnits(newTeam);
        saveTeam(newTeam);
    };

    const buildStageUrl = (stageId: string) => {
        const teamParam = teamUnits.map(u => u.id).join(",");
        return `/tower-defense/${stageId}?team=${teamParam}`;
    };

    if (!isLoaded) {
        return <LoadingSpinner icon="🏰" fullScreen />;
    }

    return (
        <main className="min-h-screen">
            <PageHeader
                title="🏰 Tower Defense"
                rightButton={{
                    href: "/team",
                    label: t("team"),
                    icon: "🎮",
                }}
            />

            <div className="container">
                {/* 説明 */}
                <div className="text-center mb-6 text-amber-900/70 dark:text-gray-400">
                    <p className="text-lg font-medium">
                        {language === "ja" ? "仲間を配置して敵の侵攻を阻止せよ！" : "Place your allies to stop enemy invasion!"}
                    </p>
                    <p className="text-sm mt-1 opacity-80">
                        {language === "ja"
                            ? "① 仲間を選択 → ② マスに配置 → ③ Wave開始"
                            : "① Select unit → ② Place on tile → ③ Start wave"}
                    </p>
                </div>

                {/* ===== 編成セクション ===== */}
                <div className="max-w-4xl mx-auto mb-6">
                    <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 uppercase tracking-wider">
                        {language === "ja" ? `📋 編成（${teamUnits.length}/${MAX_TEAM}）` : `📋 Formation (${teamUnits.length}/${MAX_TEAM})`}
                    </h2>

                    <div className="card">
                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3">
                            {language === "ja" ? "タワーユニット" : "Tower Units"}
                        </p>
                        <div className="flex gap-3 flex-wrap">
                            {teamUnits.map((unit, i) => {
                                const mul = RARITY_MUL[unit.rarity] ?? RARITY_MUL.R;
                                const atk = Math.round(unit.attackDamage * mul.damage);
                                const hp = Math.round(unit.maxHp * 2.5 * mul.hp);
                                const range = Math.min(250, Math.max(80, Math.round(unit.attackRange * mul.range)));
                                const cd = Math.max(300, Math.round(unit.attackCooldownMs / mul.speed));
                                const skill = unit.skill;
                                return (
                                    <div key={`${unit.id}-${i}`} className="relative flex flex-col items-center">
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={getUnitName(unit)}
                                            rarity={unit.rarity}
                                            size="md"
                                            baseUnitId={unit.baseUnitId || unit.atlasKey}
                                        />
                                        <button
                                            onClick={() => removeUnit(i)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shadow"
                                        >
                                            ✕
                                        </button>
                                        <div className="mt-1.5 text-[9px] text-center leading-tight text-amber-900/70 dark:text-gray-400 space-y-0.5">
                                            <div className="flex gap-1.5 justify-center">
                                                <span title="ATK">⚔️{atk}</span>
                                                <span title="Range">🎯{range}</span>
                                            </div>
                                            <div className="flex gap-1.5 justify-center">
                                                <span title="HP">❤️{hp}</span>
                                                <span title="Cooldown">{(cd / 1000).toFixed(1)}s</span>
                                            </div>
                                            {skill && (
                                                <div className="text-[8px] text-purple-600 dark:text-purple-400" title={skill.name}>
                                                    {skill.icon || "✨"} {skill.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {teamUnits.length < MAX_TEAM && (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="w-12 h-12 rounded-xl border-2 border-dashed border-amber-400 dark:border-amber-600 flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-xl self-start"
                                >
                                    +
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== ステージ一覧 ===== */}
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 uppercase tracking-wider">
                        {language === "ja" ? "🗺️ ステージ" : "🗺️ Stages"}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {towerDefenseStages.map((stage: TowerDefenseStageDefinition) => {
                            const enemyUnits = getUniqueEnemyUnits(stage);
                            const totalEnemies = getTotalEnemies(stage);
                            const banner = stageBanners[stage.id];
                            const gradient = stageGradients[stage.id] || "from-amber-500 to-orange-700";

                            return (
                                <Link
                                    key={stage.id}
                                    href={buildStageUrl(stage.id)}
                                    className="card relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all"
                                >
                                    {/* バナー */}
                                    <div className="relative h-36 -mx-4 -mt-4 mb-3 overflow-hidden">
                                        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
                                            {banner && (
                                                <Image
                                                    src={banner}
                                                    alt={stage.name}
                                                    fill
                                                    className="object-cover opacity-60"
                                                />
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-amber-50 dark:from-slate-800 via-transparent to-transparent" />
                                        <div className="absolute top-3 right-3">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${difficultyColors[stage.difficulty || "normal"]}`}>
                                                {difficultyLabels[stage.difficulty || "normal"][language]}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-2 left-3 text-white">
                                            <div className="text-xs opacity-80">STAGE</div>
                                            <div className="text-2xl font-bold drop-shadow-lg">🏰</div>
                                        </div>
                                    </div>

                                    <h2 className="text-lg font-bold text-amber-950 dark:text-white mb-1">{stage.name}</h2>
                                    <p className="text-sm text-amber-900/70 dark:text-gray-400 mb-3">{stage.description}</p>

                                    {/* 敵ユニットプレビュー */}
                                    <div className="mb-3">
                                        <div className="text-xs text-amber-800 dark:text-gray-400 mb-1.5">
                                            {language === "ja" ? "出現する敵:" : "Enemies:"}
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {enemyUnits.slice(0, 6).map((unit) => (
                                                <div
                                                    key={unit.id}
                                                    className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 flex items-center justify-center overflow-hidden"
                                                    title={unit.name}
                                                >
                                                    <Image
                                                        src={getSpritePath(unit.baseUnitId || unit.id, unit.rarity)}
                                                        alt={unit.name}
                                                        width={28}
                                                        height={28}
                                                        className="object-contain"
                                                    />
                                                </div>
                                            ))}
                                            {enemyUnits.length > 6 && (
                                                <div className="w-9 h-9 rounded-lg bg-amber-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-gray-300">
                                                    +{enemyUnits.length - 6}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ステータス */}
                                    <div className="flex gap-3 text-sm text-amber-700 dark:text-amber-400">
                                        <span>🏠 {stage.startLives}</span>
                                        <span>👾 {totalEnemies}</span>
                                        <span>🌊 {stage.waves.length}</span>
                                        <span>💰 {stage.reward.coins}</span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* ヒント */}
                <div className="mt-6 max-w-4xl mx-auto">
                    <div className="card text-center text-amber-900/70 dark:text-gray-400 text-sm">
                        💡 {language === "ja"
                            ? "スキル持ちユニットを活用しよう！フロストスローで減速、チェインライトニングで範囲攻撃！"
                            : "Use units with skills! Frost Slow to decelerate, Chain Lightning for AoE damage!"}
                    </div>
                </div>
            </div>

            {/* ===== ユニット選択モーダル ===== */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
                <div className="p-5">
                    <h2 className="text-xl font-bold text-amber-950 dark:text-white mb-1">
                        {language === "ja" ? "ユニット追加" : "Add Unit"}
                    </h2>
                    <p className="text-sm text-amber-900/70 dark:text-gray-400 mb-4">
                        {language === "ja" ? "タワーとして配置するユニットを追加" : "Add a unit to place as tower"}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                        {selectableUnits
                            .filter(u => !teamUnits.find(t => t.id === u.id))
                            .map((unit) => {
                                const owned = (unitInventory[unit.id] ?? 0) > 0;
                                const mul = RARITY_MUL[unit.rarity] ?? RARITY_MUL.R;
                                return (
                                    <button
                                        key={unit.id}
                                        onClick={() => handleAddUnit(unit)}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${owned
                                                ? "border-transparent hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                : "border-transparent opacity-60 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                            }`}
                                    >
                                        <RarityFrame
                                            unitId={unit.id}
                                            unitName={getUnitName(unit)}
                                            rarity={unit.rarity}
                                            size="sm"
                                            baseUnitId={unit.baseUnitId || unit.atlasKey}
                                            count={unitInventory[unit.id]}
                                        />
                                        <span className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">{getUnitName(unit)}</span>
                                        <div className="text-[8px] text-amber-700/60 dark:text-gray-500 leading-snug">
                                            <span>⚔️{Math.round(unit.attackDamage * mul.damage)} 🎯{Math.min(250, Math.max(80, Math.round(unit.attackRange * mul.range)))}</span>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </div>
            </Modal>
        </main>
    );
}
