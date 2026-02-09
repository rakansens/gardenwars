"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayerData } from "@/hooks/usePlayerData";
import { dungeonStages } from "@/data/dungeon";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import unitsData from "@/data/units";
import type { UnitDefinition, DungeonStageDefinition } from "@/data/types";
import RarityFrame from "@/components/ui/RarityFrame";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/layout/PageHeader";

const allUnits = unitsData as UnitDefinition[];
const playableUnits = allUnits.filter(u => !u.id.startsWith("enemy_") && !u.id.startsWith("boss_") && !u.isBoss);

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
    dungeon_1: "/assets/stages/easy_banner.webp",
    dungeon_2: "/assets/stages/normal_banner.webp",
    dungeon_3: "/assets/stages/extreme_banner.webp",
};

const stageGradients: Record<string, string> = {
    dungeon_1: "from-indigo-500 to-purple-700",
    dungeon_2: "from-amber-500 to-orange-700",
    dungeon_3: "from-red-600 to-red-900",
};

// DungeonGuard.ts と同じレアリティ別倍率（ステータス表示用）
const RARITY_MUL: Record<string, { damage: number; hp: number; range: number; speed: number }> = {
    N: { damage: 0.8, hp: 0.8, range: 0.85, speed: 1.0 },
    R: { damage: 1.0, hp: 1.0, range: 1.0, speed: 1.0 },
    SR: { damage: 1.3, hp: 1.3, range: 1.15, speed: 1.1 },
    SSR: { damage: 1.6, hp: 1.6, range: 1.3, speed: 1.2 },
    UR: { damage: 2.0, hp: 2.0, range: 1.5, speed: 1.3 },
};

const MAX_GUARDS = 5;

export default function DungeonPage() {
    const { t, language } = useLanguage();
    const { selectedTeam, unitInventory, isLoaded } = usePlayerData();
    const [playerUnit, setPlayerUnit] = useState<UnitDefinition | null>(null);
    const [guardUnits, setGuardUnits] = useState<UnitDefinition[]>([]);
    const [modalMode, setModalMode] = useState<"main" | "guard" | null>(null);
    const [initialized, setInitialized] = useState(false);

    // 初回ロード時にプレイヤーユニットとガードをセット
    if (isLoaded && !initialized) {
        setInitialized(true);
        // メインユニット
        let picked: UnitDefinition | undefined;
        if (selectedTeam.length > 0) {
            picked = playableUnits.find(u => u.id === selectedTeam[0]);
        }
        if (!picked) {
            const ownedIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
            picked = playableUnits.find(u => ownedIds.includes(u.id));
        }
        if (!picked) picked = playableUnits[0];
        if (picked) setPlayerUnit(picked);

        // ガード（チームの2番目以降、なければ自動選択）
        const guards: UnitDefinition[] = [];
        for (let i = 1; i < selectedTeam.length && guards.length < MAX_GUARDS; i++) {
            const u = playableUnits.find(pu => pu.id === selectedTeam[i]);
            if (u) guards.push(u);
        }
        if (guards.length === 0) {
            const ownedIds = Object.keys(unitInventory).filter(id => unitInventory[id] > 0);
            const owned = playableUnits.filter(u => ownedIds.includes(u.id) && u.id !== picked?.id);
            guards.push(...owned.slice(0, MAX_GUARDS));
        }
        setGuardUnits(guards);
    }

    // 全プレイアブルユニットを表示（所持ユニットを先頭に）
    const selectableUnits = [...playableUnits].sort((a, b) => {
        const aOwned = (unitInventory[a.id] ?? 0) > 0 ? 1 : 0;
        const bOwned = (unitInventory[b.id] ?? 0) > 0 ? 1 : 0;
        return bOwned - aOwned; // 所持ユニットを先にソート
    });

    const getUnitName = (unit: UnitDefinition) => {
        const translated = t(unit.id);
        return translated !== unit.id ? translated : unit.name;
    };

    const handleSelectUnit = (unit: UnitDefinition) => {
        if (modalMode === "main") {
            // メインユニットとして設定。ガードから外す
            setPlayerUnit(unit);
            setGuardUnits(prev => prev.filter(g => g.id !== unit.id));
        } else if (modalMode === "guard") {
            // ガードに追加（重複と上限チェック）
            if (guardUnits.length >= MAX_GUARDS) return;
            if (guardUnits.find(g => g.id === unit.id)) return;
            if (unit.id === playerUnit?.id) return;
            setGuardUnits(prev => [...prev, unit]);
        }
        setModalMode(null);
    };

    const removeGuard = (index: number) => {
        setGuardUnits(prev => prev.filter((_, i) => i !== index));
    };

    const buildStageUrl = (stageId: string) => {
        const unitParam = playerUnit?.id || "";
        const teamParam = guardUnits.map(g => g.id).join(",");
        return `/dungeon/${stageId}?unit=${unitParam}&team=${teamParam}`;
    };

    if (!isLoaded) {
        return <LoadingSpinner icon="🗡️" fullScreen />;
    }

    return (
        <main className="min-h-screen">
            <PageHeader
                title="🗡️ Dungeon"
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
                        {language === "ja" ? "ダンジョンを探索し、ガードを配置して敵を倒そう！" : "Explore the dungeon, place guards, and defeat enemies!"}
                    </p>
                </div>

                {/* ===== 編成セクション ===== */}
                <div className="max-w-4xl mx-auto mb-6">
                    <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 uppercase tracking-wider">
                        {language === "ja" ? "📋 編成" : "📋 Formation"}
                    </h2>

                    <div className="card">
                        {/* メインユニット */}
                        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-amber-200 dark:border-slate-700">
                            <div className="shrink-0">
                                {playerUnit ? (
                                    <RarityFrame
                                        unitId={playerUnit.id}
                                        unitName={getUnitName(playerUnit)}
                                        rarity={playerUnit.rarity}
                                        size="lg"
                                        baseUnitId={playerUnit.baseUnitId || playerUnit.atlasKey}
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-amber-400 flex items-center justify-center text-2xl">?</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                    {language === "ja" ? "メインユニット（逃げ役）" : "Main Unit (Dodger)"}
                                </p>
                                <h3 className="text-lg font-bold text-amber-950 dark:text-white truncate">
                                    {playerUnit ? getUnitName(playerUnit) : "—"}
                                </h3>
                                {playerUnit && (
                                    <div className="flex gap-3 mt-1 text-[11px]">
                                        <span className="text-red-500" title="HP">❤️ {Math.round(playerUnit.maxHp * 3.2)}</span>
                                        <span className="text-blue-500" title={language === "ja" ? "移動速度" : "Speed"}>💨 {Math.round(playerUnit.speed * 3.5)}</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setModalMode("main")}
                                className="btn btn-secondary text-xs px-3 py-1.5 shrink-0"
                            >
                                {language === "ja" ? "変更" : "Change"}
                            </button>
                        </div>

                        {/* ガード一覧 */}
                        <div>
                            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                                {language === "ja" ? `ガード（${guardUnits.length}/${MAX_GUARDS}）` : `Guards (${guardUnits.length}/${MAX_GUARDS})`}
                            </p>
                            <div className="flex gap-3 flex-wrap">
                                {guardUnits.map((guard, i) => {
                                    const mul = RARITY_MUL[guard.rarity] ?? RARITY_MUL.R;
                                    const atk = Math.round(guard.attackDamage * mul.damage);
                                    const hp = Math.round(guard.maxHp * 2.5 * mul.hp);
                                    const range = Math.min(250, Math.max(80, Math.round(guard.attackRange * mul.range)));
                                    const cd = Math.max(300, Math.round(guard.attackCooldownMs / mul.speed));
                                    const skill = guard.skill;
                                    return (
                                        <div key={`${guard.id}-${i}`} className="relative flex flex-col items-center">
                                            <RarityFrame
                                                unitId={guard.id}
                                                unitName={getUnitName(guard)}
                                                rarity={guard.rarity}
                                                size="md"
                                                baseUnitId={guard.baseUnitId || guard.atlasKey}
                                            />
                                            <button
                                                onClick={() => removeGuard(i)}
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
                                {guardUnits.length < MAX_GUARDS && (
                                    <button
                                        onClick={() => setModalMode("guard")}
                                        className="w-12 h-12 rounded-xl border-2 border-dashed border-amber-400 dark:border-amber-600 flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-xl self-start"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== ステージ一覧 ===== */}
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 uppercase tracking-wider">
                        {language === "ja" ? "🗺️ ステージ" : "🗺️ Stages"}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {dungeonStages.map((stage: DungeonStageDefinition) => {
                            const banner = stageBanners[stage.id];
                            const gradient = stageGradients[stage.id] || "from-indigo-500 to-purple-700";
                            const diff = stage.difficulty || "normal";

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
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${difficultyColors[diff]}`}>
                                                {difficultyLabels[diff]?.[language] || diff}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-2 left-3 text-white">
                                            <div className="text-xs opacity-80">STAGE</div>
                                            <div className="text-2xl font-bold drop-shadow-lg">🗡️</div>
                                        </div>
                                    </div>

                                    <h2 className="text-lg font-bold text-amber-950 dark:text-white mb-1">{stage.name}</h2>
                                    <p className="text-sm text-amber-900/70 dark:text-gray-400 mb-3">{stage.description}</p>

                                    <div className="flex gap-3 text-sm text-amber-700 dark:text-amber-400 flex-wrap">
                                        <span>🌊 {stage.totalWaves}{language === "ja" ? "波" : " waves"}</span>
                                        <span>🛡️ {language === "ja" ? "上限" : "Max"}: {stage.maxGuards}</span>
                                        <span>💰 {stage.reward.coins}G</span>
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
                            ? "メインユニットは逃げ回って経験値オーブを集めよう！ガードが敵を倒してくれる！"
                            : "Run around with your main unit to collect XP orbs! Guards will fight enemies for you!"}
                    </div>
                </div>
            </div>

            {/* ===== ユニット選択モーダル ===== */}
            <Modal isOpen={modalMode !== null} onClose={() => setModalMode(null)} size="lg">
                <div className="p-5">
                    <h2 className="text-xl font-bold text-amber-950 dark:text-white mb-1">
                        {modalMode === "main"
                            ? (language === "ja" ? "メインユニット選択" : "Select Main Unit")
                            : (language === "ja" ? "ガード追加" : "Add Guard")}
                    </h2>
                    <p className="text-sm text-amber-900/70 dark:text-gray-400 mb-4">
                        {modalMode === "main"
                            ? (language === "ja" ? "ダンジョンで操作するユニットを選ぼう" : "Choose a unit to control")
                            : (language === "ja" ? "ガードとして配置するユニットを追加" : "Add a unit as guard")}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                        {selectableUnits
                            .filter(u => {
                                if (modalMode === "guard") {
                                    if (u.id === playerUnit?.id) return false;
                                    if (guardUnits.find(g => g.id === u.id)) return false;
                                }
                                return true;
                            })
                            .map((unit) => {
                                const isSelected = modalMode === "main" && playerUnit?.id === unit.id;
                                const owned = (unitInventory[unit.id] ?? 0) > 0;
                                const mul = RARITY_MUL[unit.rarity] ?? RARITY_MUL.R;
                                return (
                                    <button
                                        key={unit.id}
                                        onClick={() => handleSelectUnit(unit)}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${isSelected
                                            ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30"
                                            : owned
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
                                            {modalMode === "main" ? (
                                                <span>❤️{Math.round(unit.maxHp * 3.2)} 💨{Math.round(unit.speed * 3.5)}</span>
                                            ) : (
                                                <span>⚔️{Math.round(unit.attackDamage * mul.damage)} 🎯{Math.min(250, Math.max(80, Math.round(unit.attackRange * mul.range)))}</span>
                                            )}
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
