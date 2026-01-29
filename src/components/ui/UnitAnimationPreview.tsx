"use client";

import { useEffect, useRef, useState } from "react";

// アニメーションが存在するユニットのリスト
export const ANIMATED_UNITS = [
    "cat_warrior",
    "corn_fighter",
    "penguin_boy",
    "cinnamon_girl",
    "nika",
    "lennon",
    "n_bee",
    "thunder_golem",
    "flame_knight",
    "ice_samurai",
    "shadow_assassin",
] as const;

export type AnimatedUnitId = (typeof ANIMATED_UNITS)[number];

export function hasAnimation(unitId: string): boolean {
    return ANIMATED_UNITS.includes(unitId as AnimatedUnitId);
}

interface UnitAnimationPreviewProps {
    unitId: string;
    width?: number;
    height?: number;
    /** コンパクトモード: ボタンなし、透明背景、自動idleアニメーション */
    compact?: boolean;
    /** コンパクトモード時のデフォルトアニメーション */
    defaultAnimation?: "idle" | "walk" | "attack";
    /** 背景色 (hex number e.g., 0x1a1a2e) */
    backgroundColor?: number;
    /** 背景を透明にする */
    transparentBackground?: boolean;
}

export default function UnitAnimationPreview({
    unitId,
    width = 200,
    height = 200,
    compact = false,
    defaultAnimation = "attack",
    backgroundColor = 0x1a1a2e,
    transparentBackground = false,
}: UnitAnimationPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentAnim, setCurrentAnim] = useState<"idle" | "walk" | "attack">(defaultAnimation);

    useEffect(() => {
        if (!containerRef.current || !hasAnimation(unitId)) return;

        let cancelled = false;

        const initPhaser = async () => {
            const Phaser = (await import("phaser")).default;

            if (cancelled) return;

            // 既存のゲームインスタンスを破棄
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }

            const bgColor = transparentBackground ? 0x000000 : backgroundColor;
            const bgAlpha = transparentBackground ? 0 : 1;

            class PreviewScene extends Phaser.Scene {
                private sprite!: Phaser.GameObjects.Sprite;
                private currentAnimation: string = "idle";

                constructor() {
                    super({ key: "PreviewScene" });
                }

                preload() {
                    // アトラスをロード
                    this.load.atlas(
                        `${unitId}_atlas`,
                        `/assets/sprites/${unitId}_sheet.png`,
                        `/assets/sprites/${unitId}_sheet.json`
                    );
                }

                create() {
                    const { width, height } = this.scale;

                    // 背景（透明でない場合のみ）
                    if (!transparentBackground) {
                        this.add.rectangle(width / 2, height / 2, width, height, bgColor);
                    }

                    // スプライトを作成
                    this.sprite = this.add.sprite(width / 2, height / 2, `${unitId}_atlas`);

                    // スケールを調整（新URキャラはスプライトが小さいので倍率UP）
                    const smallSpriteUnits = ["thunder_golem", "flame_knight", "ice_samurai", "shadow_assassin"];
                    const isSmallSprite = smallSpriteUnits.includes(unitId);
                    const baseScale = isSmallSprite ? (compact ? 0.35 : 0.55) : (compact ? 0.15 : 0.25);
                    this.sprite.setScale(baseScale);

                    // アニメーション作成
                    this.createAnimations();

                    // 最初のアニメーションを再生
                    this.playAnimation(defaultAnimation);

                    setIsLoading(false);
                }

                private createAnimations() {
                    const atlasKey = `${unitId}_atlas`;

                    // idle
                    if (!this.anims.exists(`${unitId}_idle`)) {
                        this.anims.create({
                            key: `${unitId}_idle`,
                            frames: [{ key: atlasKey, frame: `${unitId}_idle.png` }],
                            frameRate: 1,
                            repeat: -1,
                        });
                    }

                    // walk frames
                    const walkFrames: Phaser.Types.Animations.AnimationFrame[] = [];
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

                    // attack frames
                    const attackFrames: Phaser.Types.Animations.AnimationFrame[] = [];
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
                            frameRate: 8,
                            repeat: -1,
                        });
                    }
                }

                playAnimation(animType: "idle" | "walk" | "attack") {
                    const animKey = `${unitId}_${animType}`;
                    if (this.anims.exists(animKey)) {
                        this.sprite.play(animKey);
                        this.currentAnimation = animType;
                    } else if (animType !== "idle") {
                        // フォールバック: アニメーションがなければidleを再生
                        this.playAnimation("idle");
                    }
                }
            }

            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.CANVAS,
                parent: containerRef.current!,
                width,
                height,
                backgroundColor: transparentBackground ? "transparent" : `#${bgColor.toString(16).padStart(6, '0')}`,
                transparent: transparentBackground,
                scene: PreviewScene,
                scale: {
                    mode: Phaser.Scale.FIT,
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                },
                render: {
                    pixelArt: false,
                    antialias: true,
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
    }, [unitId, width, height, compact, defaultAnimation, backgroundColor, transparentBackground]);

    // アニメーション切り替え
    useEffect(() => {
        if (!gameRef.current) return;
        const scene = gameRef.current.scene.getScene("PreviewScene") as any;
        if (scene?.playAnimation) {
            scene.playAnimation(currentAnim);
        }
    }, [currentAnim]);

    if (!hasAnimation(unitId)) {
        return null;
    }

    // コンパクトモード: ボタンなし
    if (compact) {
        return (
            <div
                ref={containerRef}
                className="overflow-hidden"
                style={{ width, height }}
            >
                {isLoading && (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-lg animate-pulse">🎬</div>
                    </div>
                )}
            </div>
        );
    }

    // フルモード: ボタン付き
    return (
        <div className="flex flex-col items-center gap-3">
            {/* プレビューコンテナ */}
            <div
                ref={containerRef}
                className="rounded-xl overflow-hidden border-2 border-amber-400 shadow-lg"
                style={{ width, height }}
            >
                {isLoading && (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <div className="text-2xl animate-bounce">🎬</div>
                    </div>
                )}
            </div>

            {/* アニメーション切り替えボタン */}
            <div className="flex gap-2">
                {(["idle", "walk", "attack"] as const).map((anim) => (
                    <button
                        key={anim}
                        onClick={() => setCurrentAnim(anim)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${currentAnim === anim
                            ? "bg-amber-500 text-white shadow-md scale-105"
                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                    >
                        {anim === "idle" && "⏸️ Idle"}
                        {anim === "walk" && "🚶 Walk"}
                        {anim === "attack" && "⚔️ Attack"}
                    </button>
                ))}
            </div>
        </div>
    );
}

