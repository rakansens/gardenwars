import Phaser from 'phaser';

interface ProjectileConfig {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    damage: number;
    radius?: number;
    color?: number;
    glowColor?: number;
    lifeMs?: number;
    pierce?: number;
}

export class Projectile {
    public damage: number;
    public pierce: number;

    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private velocityX: number;
    private velocityY: number;
    private radius: number;
    private lifeMs: number;

    constructor(scene: Phaser.Scene, config: ProjectileConfig) {
        this.scene = scene;
        this.damage = config.damage;
        this.pierce = config.pierce ?? 1;
        this.velocityX = config.velocityX;
        this.velocityY = config.velocityY;
        this.radius = config.radius ?? 8;
        this.lifeMs = config.lifeMs ?? 2000;

        this.container = scene.add.container(config.x, config.y);
        this.container.setDepth(60);

        const color = config.color ?? 0xffcc00;
        const glowColor = config.glowColor ?? 0xffff88;

        const glow = scene.add.circle(0, 0, this.radius * 1.6, glowColor, 0.35);
        const core = scene.add.circle(0, 0, this.radius, color, 1);
        this.container.add([glow, core]);
    }

    update(delta: number): boolean {
        this.lifeMs -= delta;
        if (this.lifeMs <= 0) {
            this.destroy();
            return false;
        }

        const moveX = (this.velocityX * delta) / 1000;
        const moveY = (this.velocityY * delta) / 1000;
        this.container.x += moveX;
        this.container.y += moveY;
        return true;
    }

    get x(): number {
        return this.container.x;
    }

    get y(): number {
        return this.container.y;
    }

    getHitRadius(): number {
        return this.radius * 1.4;
    }

    destroy() {
        this.container.destroy();
    }
}
