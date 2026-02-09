"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import bossesData from "@/data/units/bosses.json";
import type { UnitDefinition } from "@/data/types";

const bosses = bossesData as UnitDefinition[];

// ボスのスプライトID一覧
const BOSS_SPRITE_IDS = [
    "boss_tutorial", "boss_easy", "boss_normal", "boss_frozen", "boss_hard",
    "boss_extreme", "boss_nightmare", "boss_purgatory", "boss_hellfire", "boss_abyss",
    "boss_inferno_1", "boss_inferno_2", "boss_inferno_3", "boss_inferno_4", "boss_inferno_final",
];

// Phaserシーンクラスを動的に作成する関数
function createBossDebugScene(Phaser: typeof import("phaser").default) {
    return class BossDebugScene extends Phaser.Scene {
        public bossSprite: Phaser.GameObjects.Sprite | null = null;
        private groundLine: Phaser.GameObjects.Line | null = null;
        private groundY: number = 0;
        private infoText: Phaser.GameObjects.Text | null = null;
        private flyingShadow: Phaser.GameObjects.Ellipse | null = null;

        constructor() {
            super({ key: "BossDebugScene" });
        }

        preload() {
            this.load.on("loaderror", (fileObj: Phaser.Loader.File) => {
                console.warn(`[BossDebug] Failed to load: ${fileObj.key}`);
            });

            // 全ボスのスプライトシートをロード
            for (const bossId of BOSS_SPRITE_IDS) {
                this.load.atlas(
                    `${bossId}_atlas`,
                    `/assets/sprites/sheets/${bossId}_sheet.webp`,
                    `/assets/sprites/sheets/${bossId}_sheet.json`
                );
            }

            // baseUnitIdボス用（味方スプライト流用系）
            const loaded = new Set<string>();
            for (const boss of bosses) {
                const baseId = boss.baseUnitId;
                if (baseId && !baseId.startsWith("boss_") && !loaded.has(baseId)) {
                    this.load.atlas(
                        `${baseId}_atlas`,
                        `/assets/sprites/sheets/${baseId}_sheet.webp`,
                        `/assets/sprites/sheets/${baseId}_sheet.json`
                    );
                    loaded.add(baseId);
                }
            }
        }

        create() {
            const { width, height } = this.scale;
            this.groundY = height * 0.75;

            // 背景
            this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

            // 地面
            this.add.rectangle(width / 2, this.groundY + 50, width, 100, 0x3d2817);

            // 地面ライン（赤いガイド線）
            const line = this.add.graphics();
            line.lineStyle(2, 0xff4444, 0.8);
            line.lineBetween(0, this.groundY, width, this.groundY);
            line.setDepth(100);

            // ガイド線ラベル
            this.add.text(10, this.groundY - 20, "▼ Ground Line (Unit Y anchor)", {
                fontSize: "12px",
                color: "#ff6666",
            }).setDepth(100);

            // 情報テキスト
            this.infoText = this.add.text(10, 10, "ボスを選択してください", {
                fontSize: "13px",
                color: "#ffffff",
                backgroundColor: "#000000aa",
                padding: { x: 8, y: 6 },
            });
            this.infoText.setDepth(100);

            // ボスアニメーションを登録
            this.createBossAnimations();

            // 最初のボスを表示
            if (bosses.length > 0) {
                this.showBoss(bosses[0], null);
            }
        }

        private createBossAnimations() {
            for (const bossId of BOSS_SPRITE_IDS) {
                const atlasKey = `${bossId}_atlas`;
                if (!this.textures.exists(atlasKey)) continue;

                if (!this.anims.exists(`${bossId}_walk`)) {
                    this.anims.create({
                        key: `${bossId}_walk`,
                        frames: [
                            { key: atlasKey, frame: `${bossId}_walk_1.png` },
                            { key: atlasKey, frame: `${bossId}_walk_2.png` },
                            { key: atlasKey, frame: `${bossId}_walk_3.png` },
                        ],
                        frameRate: 6,
                        repeat: -1,
                    });
                }
                if (!this.anims.exists(`${bossId}_idle`)) {
                    this.anims.create({
                        key: `${bossId}_idle`,
                        frames: [{ key: atlasKey, frame: `${bossId}_idle.png` }],
                        frameRate: 1,
                        repeat: -1,
                    });
                }
            }

            // baseUnitIdボス用アニメーション
            const done = new Set<string>();
            for (const boss of bosses) {
                const baseId = boss.baseUnitId;
                if (!baseId || baseId.startsWith("boss_") || done.has(baseId)) continue;
                done.add(baseId);
                const atlasKey = `${baseId}_atlas`;
                if (!this.textures.exists(atlasKey)) continue;

                if (!this.anims.exists(`${baseId}_idle`)) {
                    this.anims.create({
                        key: `${baseId}_idle`,
                        frames: [{ key: atlasKey, frame: `${baseId}_idle.png` }],
                        frameRate: 1,
                        repeat: -1,
                    });
                }
                if (!this.anims.exists(`${baseId}_walk`)) {
                    this.anims.create({
                        key: `${baseId}_walk`,
                        frames: [{ key: atlasKey, frame: `${baseId}_idle.png` }],
                        frameRate: 1,
                        repeat: -1,
                    });
                }
            }
        }

        showBoss(boss: UnitDefinition, offsetOverride: number | null) {
            // 前のスプライト・影を削除
            if (this.bossSprite) { this.bossSprite.destroy(); this.bossSprite = null; }
            if (this.flyingShadow) { this.flyingShadow.destroy(); this.flyingShadow = null; }

            const { width } = this.scale;
            const spriteUnitId = boss.baseUnitId || boss.id;
            const atlasKey = `${spriteUnitId}_atlas`;

            if (!this.textures.exists(atlasKey)) {
                this.updateInfoText(boss, 0, 0, "⚠️ Atlas not found!");
                return;
            }

            // Unit.ts と同じスケールロジック
            const initialFrame = `${spriteUnitId}_idle.png`;
            this.bossSprite = this.add.sprite(0, 0, atlasKey, initialFrame);

            const spriteHeight = this.bossSprite.height;
            const safeHeight = spriteHeight && spriteHeight > 0 ? spriteHeight : 100;
            const targetHeight = 120;
            const customScale = boss.scale ?? 1.0;
            let baseScale = (targetHeight / safeHeight) * customScale;
            const maxScale = boss.isBoss ? 10.0 : 5.0;
            baseScale = Math.max(0.1, Math.min(maxScale, baseScale));

            this.bossSprite.setScale(baseScale);
            this.bossSprite.setOrigin(0.5, 1);

            if (boss.flipSprite) {
                this.bossSprite.setFlipX(true);
            }

            // spriteOffsetY の適用（Unit.tsと同じロジック）
            const effectiveOffset = offsetOverride !== null ? offsetOverride : (boss.spriteOffsetY ?? 0);
            let spriteY = effectiveOffset;

            if (boss.isFlying) {
                spriteY -= 40;
            }

            this.bossSprite.setPosition(width / 2, this.groundY + spriteY);
            this.bossSprite.setDepth(50);

            // walkアニメーション再生
            const walkKey = `${spriteUnitId}_walk`;
            if (this.anims.exists(walkKey)) {
                this.bossSprite.play(walkKey, true);
            }

            // 飛行ボスの影
            if (boss.isFlying) {
                this.flyingShadow = this.add.ellipse(width / 2, this.groundY, 60, 20, 0x000000, 0.3);
                this.flyingShadow.setDepth(49);
            }

            this.updateInfoText(boss, effectiveOffset, baseScale, null);
        }

        private updateInfoText(boss: UnitDefinition, effectiveOffset: number, baseScale: number, error: string | null) {
            if (!this.infoText) return;

            const spriteUnitId = boss.baseUnitId || boss.id;
            const h = this.bossSprite?.height ?? 0;

            const lines = [
                `🏷️ ${boss.id} → ${boss.name}`,
                `📐 sprite: ${spriteUnitId} | frame: ${h}px`,
                `📏 scale: ${boss.scale} → baseScale: ${baseScale.toFixed(3)} → display: ${(h * baseScale).toFixed(0)}px`,
                `⬇️ spriteOffsetY: ${boss.spriteOffsetY ?? "(default 0)"} | effective: ${effectiveOffset}`,
                `✈️ flying: ${boss.isFlying ? "YES (-40)" : "no"}`,
            ];
            if (error) lines.push(`❌ ${error}`);

            this.infoText.setText(lines.join("\n"));
        }
    };
}

let debugPhaserGame: any = null; // Phaser.Game type only available at runtime

export default function BossDebugPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<any>(null);
    const [selectedBossIndex, setSelectedBossIndex] = useState(0);
    const [offsetValue, setOffsetValue] = useState(0);
    const [useCustomOffset, setUseCustomOffset] = useState(false);
    const [phaserReady, setPhaserReady] = useState(false);

    useEffect(() => {
        if (!containerRef.current || debugPhaserGame) return;

        let cancelled = false;

        const loadPhaser = async () => {
            const Phaser = (await import("phaser")).default;
            if (cancelled) return;

            const SceneClass = createBossDebugScene(Phaser);
            const scene = new SceneClass();
            sceneRef.current = scene;

            debugPhaserGame = new Phaser.Game({
                type: Phaser.AUTO,
                width: 900,
                height: 500,
                parent: containerRef.current!,
                backgroundColor: "#1a1a2e",
                scene: scene,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
            });

            // シーンのcreate完了をポーリングで待つ
            const readyCheck = setInterval(() => {
                if (cancelled) { clearInterval(readyCheck); return; }
                if (scene.bossSprite !== null) {
                    clearInterval(readyCheck);
                    setPhaserReady(true);
                }
            }, 200);
        };

        loadPhaser();

        return () => {
            cancelled = true;
            if (debugPhaserGame) {
                debugPhaserGame.destroy(true);
                debugPhaserGame = null;
            }
            sceneRef.current = null;
            setPhaserReady(false);
        };
    }, []);

    const switchBoss = useCallback(
        (index: number) => {
            setSelectedBossIndex(index);
            const boss = bosses[index];
            setOffsetValue(boss.spriteOffsetY ?? 0);
            setUseCustomOffset(false);
            if (sceneRef.current && phaserReady) {
                sceneRef.current.showBoss(boss, null);
            }
        },
        [phaserReady]
    );

    const updateOffset = useCallback(
        (value: number) => {
            setOffsetValue(value);
            setUseCustomOffset(true);
            if (sceneRef.current && phaserReady) {
                sceneRef.current.showBoss(bosses[selectedBossIndex], value);
            }
        },
        [selectedBossIndex, phaserReady]
    );

    const currentBoss = bosses[selectedBossIndex];

    return (
        <main className="min-h-screen bg-slate-950 text-white p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-amber-400">
                        🐛 Boss Sprite Debug
                    </h1>
                    <a
                        href="/"
                        className="text-sm px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition"
                    >
                        ← Home
                    </a>
                </div>

                {/* Phaser Canvas */}
                <div
                    ref={containerRef}
                    className="w-full rounded-xl overflow-hidden border-2 border-slate-700 mb-4"
                    style={{ maxWidth: 900, aspectRatio: "900/500" }}
                />

                {/* Controls */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Boss Selector */}
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                        <h2 className="text-sm font-bold text-slate-400 mb-3">ボス選択</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-1">
                            {bosses.map((boss, i) => (
                                <button
                                    key={boss.id}
                                    onClick={() => switchBoss(i)}
                                    className={`text-left p-2 rounded-lg text-xs transition-all ${i === selectedBossIndex
                                        ? "bg-amber-600 text-white ring-2 ring-amber-400"
                                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                        }`}
                                >
                                    <div className="font-bold truncate">{boss.name}</div>
                                    <div className="text-[10px] opacity-70 truncate">{boss.id}</div>
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        <span className="text-[9px] px-1 bg-black/30 rounded">
                                            s:{boss.scale}
                                        </span>
                                        {boss.isFlying && (
                                            <span className="text-[9px] px-1 bg-blue-600/50 rounded">✈️</span>
                                        )}
                                        {boss.spriteOffsetY !== undefined && (
                                            <span className="text-[9px] px-1 bg-green-600/50 rounded">
                                                Y:{boss.spriteOffsetY}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Offset Tuner */}
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                        <h2 className="text-sm font-bold text-slate-400 mb-3">Y オフセット調整</h2>

                        {currentBoss && (
                            <div className="space-y-4">
                                <div className="bg-slate-800 rounded-lg p-3">
                                    <div className="text-lg font-bold text-amber-300">{currentBoss.name}</div>
                                    <div className="text-xs text-slate-400">
                                        {currentBoss.id} | scale: {currentBoss.scale} |{" "}
                                        {currentBoss.isFlying ? "✈️ 飛行" : "🦶 地上"}
                                    </div>
                                </div>

                                {/* スライダー */}
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">
                                        JSONの値: <code className="text-green-400">{currentBoss.spriteOffsetY ?? "なし (0)"}</code>
                                        {useCustomOffset && <span className="text-amber-400 ml-2">→ プレビュー: {offsetValue}</span>}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min={-200}
                                            max={500}
                                            step={5}
                                            value={offsetValue}
                                            onChange={(e) => updateOffset(parseInt(e.target.value))}
                                            className="flex-1 accent-amber-500"
                                        />
                                        <input
                                            type="number"
                                            value={offsetValue}
                                            onChange={(e) => updateOffset(parseInt(e.target.value) || 0)}
                                            className="w-20 bg-slate-700 text-white text-center rounded px-2 py-1 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* ボタン */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setUseCustomOffset(false);
                                            setOffsetValue(currentBoss.spriteOffsetY ?? 0);
                                            if (sceneRef.current && phaserReady) {
                                                sceneRef.current.showBoss(currentBoss, null);
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition"
                                    >
                                        🔄 リセット
                                    </button>
                                    <button
                                        onClick={() => updateOffset(0)}
                                        className="px-3 py-1.5 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition"
                                    >
                                        0に戻す
                                    </button>
                                </div>

                                {/* コピー用コード */}
                                {useCustomOffset && offsetValue !== (currentBoss.spriteOffsetY ?? 0) && (
                                    <div className="bg-slate-800 rounded-lg p-3 border border-amber-600/50">
                                        <div className="text-xs text-amber-400 mb-1">📋 bosses.jsonに追加:</div>
                                        <code className="text-sm text-green-400 font-mono">
                                            &quot;spriteOffsetY&quot;: {offsetValue}
                                        </code>
                                    </div>
                                )}

                                {/* 全ボスのoffsetY一覧テーブル */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 mb-2">全ボス一覧</h3>
                                    <div className="max-h-[200px] overflow-y-auto text-xs border border-slate-700 rounded-lg">
                                        <table className="w-full">
                                            <thead className="sticky top-0 bg-slate-800">
                                                <tr className="text-left text-slate-500">
                                                    <th className="py-1.5 px-2">ID</th>
                                                    <th className="py-1.5 px-2">Scale</th>
                                                    <th className="py-1.5 px-2">OffsetY</th>
                                                    <th className="py-1.5 px-2">Fly</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bosses.map((b) => (
                                                    <tr
                                                        key={b.id}
                                                        className={`border-t border-slate-800 ${b.id === currentBoss.id ? "bg-amber-900/30" : "hover:bg-slate-800/50"
                                                            }`}
                                                    >
                                                        <td className="py-1 px-2 font-mono">{b.id}</td>
                                                        <td className="py-1 px-2">{b.scale}</td>
                                                        <td className="py-1 px-2">{b.spriteOffsetY ?? "-"}</td>
                                                        <td className="py-1 px-2">{b.isFlying ? "✈️" : "-"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
