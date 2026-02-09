"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RANGED_SPRITE_UNITS, getSheetPath, hasRangedSprite } from "@/lib/sprites";

// ユニット情報の型
interface RangedUnitInfo {
    id: string;
    label: string;
}

// RANGED_SPRITE_UNITS から一覧を作成
const rangedUnits: RangedUnitInfo[] = RANGED_SPRITE_UNITS.map((id) => ({
    id,
    label: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

type AnimType = "idle" | "walk" | "attack";

// Phaserシーンクラス
function createRangedDebugScene(Phaser: typeof import("phaser").default) {
    return class RangedDebugScene extends Phaser.Scene {
        public unitSprite: Phaser.GameObjects.Sprite | null = null;
        private groundY: number = 0;
        private infoText: Phaser.GameObjects.Text | null = null;
        private frameSizeText: Phaser.GameObjects.Text | null = null;
        private groundGraphics: Phaser.GameObjects.Graphics | null = null;
        private originMarker: Phaser.GameObjects.Arc | null = null;
        private currentUnitId: string = "";
        private currentAnim: AnimType = "idle";
        private useOriginFix: boolean = true;

        constructor() {
            super({ key: "RangedDebugScene" });
        }

        preload() {
            this.load.on("loaderror", (fileObj: any) => {
                console.warn(`[RangedDebug] Failed to load: ${fileObj.key}`);
            });

            // 全rangedユニットのスプライトシートをロード
            for (const unitId of RANGED_SPRITE_UNITS) {
                const sheetPath = getSheetPath(unitId);
                this.load.atlas(`${unitId}_atlas`, sheetPath.image, sheetPath.json);
            }
        }

        create() {
            const { width, height } = this.scale;
            this.groundY = height * 0.70;

            // 背景
            this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

            // 地面
            this.add.rectangle(width / 2, this.groundY + 75, width, 150, 0x3d2817);

            // 地面ライン
            this.groundGraphics = this.add.graphics();
            this.groundGraphics.lineStyle(2, 0xff4444, 0.8);
            this.groundGraphics.lineBetween(0, this.groundY, width, this.groundY);
            this.groundGraphics.setDepth(100);

            // ガイド線ラベル
            this.add.text(10, this.groundY - 20, "▼ Ground Line (Unit Y anchor)", {
                fontSize: "12px",
                color: "#ff6666",
            }).setDepth(100);

            // キャラ位置マーカー（中央縦線）
            const centerLine = this.add.graphics();
            centerLine.lineStyle(1, 0x44ff44, 0.4);
            centerLine.lineBetween(width / 2, 0, width / 2, height);
            centerLine.setDepth(99);

            this.add.text(width / 2 + 5, 10, "▼ Unit X Position", {
                fontSize: "10px",
                color: "#44ff44aa",
            }).setDepth(99);

            // 情報テキスト
            this.infoText = this.add.text(10, 10, "ユニットを選択してください", {
                fontSize: "13px",
                color: "#ffffff",
                backgroundColor: "#000000aa",
                padding: { x: 8, y: 6 },
            });
            this.infoText.setDepth(100);

            // フレームサイズテキスト（右下）
            this.frameSizeText = this.add.text(width - 10, height - 10, "", {
                fontSize: "11px",
                color: "#88aaff",
                backgroundColor: "#000000aa",
                padding: { x: 6, y: 4 },
                align: "right",
            });
            this.frameSizeText.setOrigin(1, 1);
            this.frameSizeText.setDepth(100);

            // 原点マーカー
            this.originMarker = this.add.circle(0, 0, 5, 0xff00ff, 0.8);
            this.originMarker.setDepth(101);
            this.originMarker.setVisible(false);

            // アニメーション作成
            this.createAllAnimations();

            // 最初のユニットを表示
            if (rangedUnits.length > 0) {
                this.showUnit(rangedUnits[0].id, "idle", true);
            }
        }

        private createAllAnimations() {
            for (const unitId of RANGED_SPRITE_UNITS) {
                const atlasKey = `${unitId}_atlas`;
                if (!this.textures.exists(atlasKey)) continue;

                // idle
                if (!this.anims.exists(`${unitId}_idle`)) {
                    this.anims.create({
                        key: `${unitId}_idle`,
                        frames: [{ key: atlasKey, frame: `${unitId}_idle.png` }],
                        frameRate: 1,
                        repeat: -1,
                    });
                }

                // walk
                const walkFrames: any[] = [];
                for (let i = 1; i <= 4; i++) {
                    const frame = this.textures.getFrame(atlasKey, `${unitId}_walk_${i}.png`);
                    if (frame) {
                        walkFrames.push({ key: atlasKey, frame: `${unitId}_walk_${i}.png` });
                    }
                }
                if (walkFrames.length > 0 && !this.anims.exists(`${unitId}_walk`)) {
                    this.anims.create({
                        key: `${unitId}_walk`,
                        frames: walkFrames,
                        frameRate: 8,
                        repeat: -1,
                    });
                }

                // attack
                const attackFrames: any[] = [];
                for (let i = 1; i <= 4; i++) {
                    const frame = this.textures.getFrame(atlasKey, `${unitId}_attack_${i}.png`);
                    if (frame) {
                        attackFrames.push({ key: atlasKey, frame: `${unitId}_attack_${i}.png` });
                    }
                }
                if (attackFrames.length > 0 && !this.anims.exists(`${unitId}_attack`)) {
                    this.anims.create({
                        key: `${unitId}_attack`,
                        frames: attackFrames,
                        frameRate: 6,
                        repeat: -1,
                    });
                }
            }
        }

        showUnit(unitId: string, animType: AnimType, originFix: boolean) {
            if (this.unitSprite) { this.unitSprite.destroy(); this.unitSprite = null; }

            this.currentUnitId = unitId;
            this.currentAnim = animType;
            this.useOriginFix = originFix;

            const { width } = this.scale;
            const atlasKey = `${unitId}_atlas`;

            if (!this.textures.exists(atlasKey)) {
                this.updateInfoText(unitId, 0, 0, 0, "⚠️ Atlas not found!");
                return;
            }

            const initialFrame = `${unitId}_idle.png`;
            this.unitSprite = this.add.sprite(width / 2, this.groundY, atlasKey, initialFrame);

            // Unit.tsと同じスケールロジック
            const spriteHeight = this.unitSprite.height;
            const safeHeight = spriteHeight && spriteHeight > 0 ? spriteHeight : 100;
            const targetHeight = 120;
            const baseScale = targetHeight / safeHeight;
            this.unitSprite.setScale(baseScale);
            this.unitSprite.setOrigin(0.5, 1);
            this.unitSprite.setDepth(50);

            // アニメーション再生
            this.playAnim(animType, originFix);
        }

        playAnim(animType: AnimType, originFix: boolean) {
            if (!this.unitSprite) return;

            this.currentAnim = animType;
            this.useOriginFix = originFix;

            const animKey = `${this.currentUnitId}_${animType}`;
            if (this.anims.exists(animKey)) {
                this.unitSprite.play(animKey, true);
            }

            // フレームサイズを取得
            const frame = this.unitSprite.frame;
            const frameW = frame?.width ?? 0;
            const frameH = frame?.height ?? 0;

            // idle/walkのフレームサイズを取得（比較用）
            const idleFrame = this.textures.getFrame(`${this.currentUnitId}_atlas`, `${this.currentUnitId}_idle.png`);
            const idleW = idleFrame?.width ?? 0;
            const idleH = idleFrame?.height ?? 0;

            // origin.x 調整
            if (animType === "attack" && originFix) {
                // 攻撃フレームでキャラ位置を維持するためoriginを左寄りに
                // キャラ本体はフレーム左端のidleW幅にいる
                const originX = frameW > 0 ? (idleW / 2) / frameW : 0.5;
                this.unitSprite.setOrigin(originX, 1);
            } else {
                this.unitSprite.setOrigin(0.5, 1);
            }

            // 原点マーカー更新
            if (this.originMarker && this.unitSprite) {
                const bx = this.unitSprite.x;
                const by = this.unitSprite.y;
                this.originMarker.setPosition(bx, by);
                this.originMarker.setVisible(true);
            }

            // フレームサイズ表示
            if (this.frameSizeText) {
                const widthRatio = idleW > 0 ? (frameW / idleW).toFixed(1) : "?";
                this.frameSizeText.setText([
                    `📐 Current Frame: ${frameW}x${frameH}`,
                    `📏 Idle Frame: ${idleW}x${idleH}`,
                    `📊 Width Ratio: ${widthRatio}x`,
                    `🎯 Origin: (${this.unitSprite.originX.toFixed(3)}, ${this.unitSprite.originY.toFixed(1)})`,
                ].join("\n"));
            }

            this.updateInfoText(
                this.currentUnitId,
                frameW, frameH,
                this.unitSprite.scaleX,
                null
            );
        }

        private updateInfoText(unitId: string, fw: number, fh: number, scale: number, error: string | null) {
            if (!this.infoText) return;

            const lines = [
                `🏷️ ${unitId}`,
                `🎬 anim: ${this.currentAnim} | originFix: ${this.useOriginFix ? "ON ✅" : "OFF ❌"}`,
                `📐 frame: ${fw}x${fh} | scale: ${scale.toFixed(3)}`,
                `📏 display: ${(fw * scale).toFixed(0)}x${(fh * scale).toFixed(0)}px`,
            ];
            if (error) lines.push(`❌ ${error}`);

            this.infoText.setText(lines.join("\n"));
        }
    };
}

let debugPhaserGame: any = null;

export default function RangedDebugPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<any>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [currentAnim, setCurrentAnim] = useState<AnimType>("idle");
    const [originFix, setOriginFix] = useState(true);
    const [phaserReady, setPhaserReady] = useState(false);
    const [filterText, setFilterText] = useState("");

    useEffect(() => {
        if (!containerRef.current || debugPhaserGame) return;

        let cancelled = false;

        const loadPhaser = async () => {
            const Phaser = (await import("phaser")).default;
            if (cancelled) return;

            const SceneClass = createRangedDebugScene(Phaser);
            const scene = new SceneClass();
            sceneRef.current = scene;

            debugPhaserGame = new Phaser.Game({
                type: Phaser.AUTO,
                width: 1100,
                height: 500,
                parent: containerRef.current!,
                backgroundColor: "#1a1a2e",
                scene: scene,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
            });

            const readyCheck = setInterval(() => {
                if (cancelled) { clearInterval(readyCheck); return; }
                if (scene.unitSprite !== null) {
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

    const switchUnit = useCallback(
        (index: number) => {
            setSelectedIndex(index);
            setCurrentAnim("idle");
            if (sceneRef.current && phaserReady) {
                sceneRef.current.showUnit(rangedUnits[index].id, "idle", originFix);
            }
        },
        [phaserReady, originFix]
    );

    const switchAnim = useCallback(
        (anim: AnimType) => {
            setCurrentAnim(anim);
            if (sceneRef.current && phaserReady) {
                sceneRef.current.playAnim(anim, originFix);
            }
        },
        [phaserReady, originFix]
    );

    const toggleOriginFix = useCallback(() => {
        const newVal = !originFix;
        setOriginFix(newVal);
        if (sceneRef.current && phaserReady) {
            sceneRef.current.playAnim(currentAnim, newVal);
        }
    }, [originFix, currentAnim, phaserReady]);

    const filteredUnits = filterText
        ? rangedUnits.filter((u) => u.id.includes(filterText.toLowerCase()))
        : rangedUnits;

    const currentUnit = rangedUnits[selectedIndex];

    return (
        <main className="min-h-screen bg-slate-950 text-white p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-cyan-400">
                        🔫 Ranged Sprite Debug
                    </h1>
                    <div className="flex gap-2">
                        <a
                            href="/debug/bosses"
                            className="text-sm px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition"
                        >
                            🐛 Boss Debug
                        </a>
                        <a
                            href="/"
                            className="text-sm px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition"
                        >
                            ← Home
                        </a>
                    </div>
                </div>

                {/* Phaser Canvas */}
                <div
                    ref={containerRef}
                    className="w-full rounded-xl overflow-hidden border-2 border-slate-700 mb-4"
                    style={{ maxWidth: 1100, aspectRatio: "1100/500" }}
                />

                {/* Controls */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Unit Selector */}
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                        <h2 className="text-sm font-bold text-slate-400 mb-2">ユニット選択</h2>
                        <input
                            type="text"
                            placeholder="フィルタ..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="w-full bg-slate-800 text-white rounded px-3 py-1.5 text-sm mb-2 border border-slate-600 focus:border-cyan-500 outline-none"
                        />
                        <div className="grid grid-cols-2 gap-1.5 max-h-[350px] overflow-y-auto pr-1">
                            {filteredUnits.map((unit) => {
                                const realIndex = rangedUnits.findIndex((u) => u.id === unit.id);
                                return (
                                    <button
                                        key={unit.id}
                                        onClick={() => switchUnit(realIndex)}
                                        className={`text-left p-1.5 rounded text-xs transition-all ${realIndex === selectedIndex
                                            ? "bg-cyan-600 text-white ring-2 ring-cyan-400"
                                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                            }`}
                                    >
                                        <div className="font-bold truncate text-[11px]">{unit.label}</div>
                                        <div className="text-[9px] opacity-60 truncate">{unit.id}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Animation Controls */}
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                        <h2 className="text-sm font-bold text-slate-400 mb-3">アニメーション制御</h2>

                        {currentUnit && (
                            <div className="space-y-4">
                                <div className="bg-slate-800 rounded-lg p-3">
                                    <div className="text-lg font-bold text-cyan-300">{currentUnit.label}</div>
                                    <div className="text-xs text-slate-400">{currentUnit.id}</div>
                                </div>

                                {/* アニメーション切り替えボタン */}
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">アニメーション</label>
                                    <div className="flex gap-2">
                                        {(["idle", "walk", "attack"] as const).map((anim) => (
                                            <button
                                                key={anim}
                                                onClick={() => switchAnim(anim)}
                                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all ${currentAnim === anim
                                                    ? anim === "attack"
                                                        ? "bg-red-600 text-white ring-2 ring-red-400"
                                                        : "bg-cyan-600 text-white ring-2 ring-cyan-400"
                                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                                    }`}
                                            >
                                                {anim === "idle" && "⏸️ Idle"}
                                                {anim === "walk" && "🚶 Walk"}
                                                {anim === "attack" && "⚔️ Attack"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Origin Fix トグル */}
                                <div className="bg-slate-800 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-bold text-amber-300">
                                            🎯 Origin Fix（位置ずれ補正）
                                        </label>
                                        <button
                                            onClick={toggleOriginFix}
                                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${originFix
                                                ? "bg-green-600 text-white"
                                                : "bg-red-600 text-white"
                                                }`}
                                        >
                                            {originFix ? "ON ✅" : "OFF ❌"}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        OFF: 攻撃時にorigin(0.5,1)のまま → キャラが左にずれる<br />
                                        ON: 攻撃時にorigin(~0.125,1)に調整 → キャラ位置を維持
                                    </p>
                                </div>

                                {/* 説明 */}
                                <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/50">
                                    <div className="text-xs text-blue-300 font-bold mb-1">📝 問題の説明</div>
                                    <p className="text-[10px] text-blue-200/80 leading-relaxed">
                                        攻撃フレーム(880px)はidle/walkフレーム(220px)の4倍幅。
                                        原点(0.5)のままだとキャラ本体が左にずれて
                                        攻撃エフェクトだけが見える状態に。
                                        Origin Fix をON/OFFで比較できます。
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Unit List */}
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                        <h2 className="text-sm font-bold text-slate-400 mb-2">
                            全Rangedユニット ({rangedUnits.length}体)
                        </h2>
                        <div className="max-h-[350px] overflow-y-auto text-xs border border-slate-700 rounded-lg">
                            <table className="w-full">
                                <thead className="sticky top-0 bg-slate-800">
                                    <tr className="text-left text-slate-500">
                                        <th className="py-1.5 px-2">#</th>
                                        <th className="py-1.5 px-2">ID</th>
                                        <th className="py-1.5 px-2">Rarity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rangedUnits.map((u, i) => (
                                        <tr
                                            key={u.id}
                                            className={`border-t border-slate-800 cursor-pointer ${i === selectedIndex ? "bg-cyan-900/30" : "hover:bg-slate-800/50"
                                                }`}
                                            onClick={() => switchUnit(i)}
                                        >
                                            <td className="py-1 px-2 text-slate-500">{i + 1}</td>
                                            <td className="py-1 px-2 font-mono">{u.id}</td>
                                            <td className="py-1 px-2">
                                                {u.id.startsWith("ur_") ? (
                                                    <span className="text-purple-400 font-bold">UR</span>
                                                ) : u.id.startsWith("ssr_") ? (
                                                    <span className="text-yellow-400 font-bold">SSR</span>
                                                ) : u.id.startsWith("sr_") ? (
                                                    <span className="text-blue-400 font-bold">SR</span>
                                                ) : u.id.startsWith("r_") ? (
                                                    <span className="text-green-400 font-bold">R</span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
