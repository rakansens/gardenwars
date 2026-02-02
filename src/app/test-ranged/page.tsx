"use client";

import { useEffect, useRef, useState } from "react";

export default function TestRangedPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const [currentAnim, setCurrentAnim] = useState<"idle" | "walk" | "attack">("idle");

    useEffect(() => {
        if (!containerRef.current) return;

        let cancelled = false;

        const initPhaser = async () => {
            const Phaser = (await import("phaser")).default;

            if (cancelled) return;

            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }

            class RangedPreviewScene extends Phaser.Scene {
                private sprite!: Phaser.GameObjects.Sprite;

                constructor() {
                    super({ key: "RangedPreviewScene" });
                }

                preload() {
                    // ランged用アトラスをロード
                    this.load.atlas(
                        "ur_cosmic_dragon_ranged",
                        "/assets/sprites/sheets/ur_cosmic_dragon_ranged_sheet.webp",
                        "/assets/sprites/sheets/ur_cosmic_dragon_ranged_sheet.json"
                    );
                }

                create() {
                    const { width, height } = this.scale;

                    // 背景
                    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

                    // スプライトを左寄りに配置（攻撃エフェクトが右に伸びるため）
                    this.sprite = this.add.sprite(150, height / 2, "ur_cosmic_dragon_ranged");
                    this.sprite.setScale(1.5);

                    // アニメーション作成
                    this.createAnimations();

                    // 最初はidle
                    this.playAnimation("idle");
                }

                private createAnimations() {
                    const atlasKey = "ur_cosmic_dragon_ranged";

                    // idle
                    if (!this.anims.exists("dragon_idle")) {
                        this.anims.create({
                            key: "dragon_idle",
                            frames: [{ key: atlasKey, frame: "ur_cosmic_dragon_idle.png" }],
                            frameRate: 1,
                            repeat: -1,
                        });
                    }

                    // walk
                    const walkFrames = [];
                    for (let i = 1; i <= 3; i++) {
                        walkFrames.push({ key: atlasKey, frame: `ur_cosmic_dragon_walk_${i}.png` });
                    }
                    if (walkFrames.length > 0 && !this.anims.exists("dragon_walk")) {
                        this.anims.create({
                            key: "dragon_walk",
                            frames: walkFrames,
                            frameRate: 8,
                            repeat: -1,
                        });
                    }

                    // attack (ranged - 広いフレーム)
                    const attackFrames = [];
                    for (let i = 1; i <= 4; i++) {
                        attackFrames.push({ key: atlasKey, frame: `ur_cosmic_dragon_attack_${i}.png` });
                    }
                    if (attackFrames.length > 0 && !this.anims.exists("dragon_attack")) {
                        this.anims.create({
                            key: "dragon_attack",
                            frames: attackFrames,
                            frameRate: 6,
                            repeat: -1,
                        });
                    }
                }

                playAnimation(animType: "idle" | "walk" | "attack") {
                    const animKey = `dragon_${animType}`;
                    if (this.anims.exists(animKey)) {
                        this.sprite.play(animKey);

                        // 攻撃時はスプライトの原点を左に調整（エフェクトが右に伸びるため）
                        if (animType === "attack") {
                            this.sprite.setOrigin(0.15, 0.5);
                        } else {
                            this.sprite.setOrigin(0.5, 0.5);
                        }
                    }
                }
            }

            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.CANVAS,
                parent: containerRef.current!,
                width: 900,
                height: 400,
                backgroundColor: "#1a1a2e",
                scene: RangedPreviewScene,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
            };

            gameRef.current = new Phaser.Game(config);
        };

        initPhaser();

        return () => {
            cancelled = true;
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    // アニメーション切り替え
    useEffect(() => {
        if (!gameRef.current) return;
        const scene = gameRef.current.scene.getScene("RangedPreviewScene") as any;
        if (scene?.playAnimation) {
            scene.playAnimation(currentAnim);
        }
    }, [currentAnim]);

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
            <h1 className="text-3xl font-bold text-white mb-4">
                🐉 Ranged Attack Test - ur_cosmic_dragon
            </h1>
            <p className="text-gray-400 mb-6">
                攻撃フレームが横に広い（880px）ので、ブレスが遠くまで届きます
            </p>

            {/* プレビューコンテナ */}
            <div
                ref={containerRef}
                className="rounded-xl overflow-hidden border-4 border-purple-500 shadow-2xl"
                style={{ width: 900, height: 400 }}
            />

            {/* アニメーション切り替えボタン */}
            <div className="flex gap-4 mt-6">
                {(["idle", "walk", "attack"] as const).map((anim) => (
                    <button
                        key={anim}
                        onClick={() => setCurrentAnim(anim)}
                        className={`px-6 py-3 rounded-lg text-lg font-bold transition-all ${
                            currentAnim === anim
                                ? "bg-purple-600 text-white shadow-lg scale-105"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                    >
                        {anim === "idle" && "⏸️ Idle"}
                        {anim === "walk" && "🚶 Walk"}
                        {anim === "attack" && "🔥 Attack (Ranged)"}
                    </button>
                ))}
            </div>

            <div className="mt-8 text-gray-500 text-sm">
                <p>フレームサイズ:</p>
                <p>• idle/walk: 220×190px (通常)</p>
                <p>• attack: 880×256px (横に広い！)</p>
            </div>
        </div>
    );
}
