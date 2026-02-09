import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { eventBus, GameEvents } from '../utils/EventBus';
import type { UnitDefinition, TowerDefenseStageDefinition, TowerDefenseWaveConfig, Rarity } from '@/data/types';
import { getSkillById } from '@/data/skills';
import { getSpritePath } from '@/lib/sprites';

// ============================================
// Tower Defense Scene (2.5D Isometric)
// ============================================

interface TDSceneData {
    stage: TowerDefenseStageDefinition;
    team: UnitDefinition[];
    allUnits: UnitDefinition[];
}

// パス上の敵管理
interface PathEnemy {
    unit: Unit;
    pathIndex: number;      // 現在のウェイポイントインデックス
    progress: number;       // 現在のウェイポイント間の進捗 (0-1)
    baseSpeed: number;      // 基本スピード
    // スキルエフェクト状態
    slowFactor: number;     // 1.0 = 通常速度, 0.5 = 半減 etc.
    slowTimer: number;      // スロー残り時間(ms)
    burnDps: number;        // 継続ダメージ/秒
    burnTimer: number;      // 炎上残り時間(ms)
    hpBar?: Phaser.GameObjects.Graphics;
    slowTint?: Phaser.GameObjects.Rectangle; // スロー表示用
}

// 配置済みタワー管理
interface PlacedTower {
    unit: Unit;
    unitDefId: string;       // ユニットID（配置制限カウント用）
    baseCost: number;        // 配置時のコスト
    col: number;
    row: number;
    targetEnemy: PathEnemy | null;
    attackTimer: number;
    level: number;           // 1-3
    damageMultiplier: number; // レベルによるダメージ倍率
    rangeMultiplier: number;  // レベルによる射程倍率
    rangeCircle?: Phaser.GameObjects.Graphics;
    levelLabel?: Phaser.GameObjects.Text;  // ★表示
}

// 配置制限
const MAX_TOWERS_TOTAL = 8;
const MAX_SAME_UNIT = 2;

export class TowerDefenseScene extends Phaser.Scene {
    // データ
    private stageData!: TowerDefenseStageDefinition;
    private teamData: UnitDefinition[] = [];
    private allUnitsData: UnitDefinition[] = [];

    // ゲーム状態
    private gold: number = 0;
    private lives: number = 0;
    private currentWave: number = 0;
    private waveActive: boolean = false;
    private gameOver: boolean = false;
    private allWavesComplete: boolean = false;
    private gameSpeed: number = 1;

    // グリッド（create時に自動計算）
    private tileWidth: number = 70;
    private tileHeight: number = 40;
    private gridOffsetX: number = 0;
    private gridOffsetY: number = 80;
    private pathSet: Set<string> = new Set();

    // エンティティ
    private pathEnemies: PathEnemy[] = [];
    private towers: PlacedTower[] = [];
    private occupiedTiles: Set<string> = new Set();

    // Wave スポーン管理
    private waveSpawnTimers: { unitId: string; remaining: number; intervalMs: number; timer: number }[] = [];
    private waveTimer: number = 0;

    // UI
    private goldText!: Phaser.GameObjects.Text;
    private livesText!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;
    private towerCountText!: Phaser.GameObjects.Text;
    private startWaveButton!: Phaser.GameObjects.Container;
    private unitButtons: Phaser.GameObjects.Container[] = [];
    private selectedUnitId: string | null = null;
    private selectedHighlight: Phaser.GameObjects.Graphics | null = null;
    private tileHighlights: Phaser.GameObjects.Graphics | null = null;
    private rangePreview: Phaser.GameObjects.Graphics | null = null;
    private upgradePopup: Phaser.GameObjects.Container | null = null;

    // スピードボタン
    private speedButton!: Phaser.GameObjects.Container;

    // Wave情報テキスト
    private waveInfoText?: Phaser.GameObjects.Text;

    constructor() {
        super('TowerDefenseScene');
    }

    init(data: TDSceneData): void {
        this.stageData = data.stage;
        this.teamData = data.team || [];
        this.allUnitsData = data.allUnits || [];

        // リセット
        this.gold = this.stageData.startGold;
        this.lives = this.stageData.startLives;
        this.currentWave = 0;
        this.waveActive = false;
        this.gameOver = false;
        this.allWavesComplete = false;
        this.gameSpeed = 1;
        this.pathEnemies = [];
        this.towers = [];
        this.occupiedTiles = new Set();
        this.waveSpawnTimers = [];
        this.waveTimer = 0;
        this.selectedUnitId = null;
        this.unitButtons = [];

        // パスセット構築
        this.pathSet = new Set();
        for (const [c, r] of this.stageData.path) {
            this.pathSet.add(`${c},${r}`);
        }
    }

    preload(): void {
        // sfx ロード
        if (!this.cache.audio.exists('sfx_unit_spawn')) {
            this.load.audio('sfx_unit_spawn', '/assets/audio/sfx/unit_spawn.mp3');
        }

        // 全ユニットのアセットをロード（getSpritePath使用）
        const loadedKeys = new Set<string>();
        for (const unit of this.allUnitsData) {
            const spriteId = unit.baseUnitId || unit.id;
            if (loadedKeys.has(spriteId)) continue;
            loadedKeys.add(spriteId);

            // レアリティ判定（baseUnitIdがある場合は元ユニットのレアリティ使用）
            let rarity: Rarity | undefined = unit.rarity as Rarity;
            if (unit.baseUnitId) {
                const baseUnit = this.allUnitsData.find(u => u.id === unit.baseUnitId);
                if (baseUnit) rarity = baseUnit.rarity as Rarity;
            }

            const atlasKey = `${spriteId}_atlas`;
            if (!this.textures.exists(atlasKey)) {
                this.load.atlas(
                    atlasKey,
                    `/assets/sprites/sheets/${spriteId}_sheet.webp`,
                    `/assets/sprites/sheets/${spriteId}.json`
                );
            }
            if (!this.textures.exists(spriteId)) {
                this.load.image(spriteId, getSpritePath(spriteId, rarity));
            }
        }
    }

    create(): void {
        const { width, height } = this.scale;

        // タイルサイズを画面に合わせて自動計算
        const uiTopMargin = 45;
        const uiBottomMargin = 140;
        const availableHeight = height - uiTopMargin - uiBottomMargin;
        const availableWidth = width; // マージンなし（アイソメは自然に余白ができる）

        const gridCols = this.stageData.cols;
        const gridRows = this.stageData.rows;

        // アイソメトリック: 幅 = (cols + rows) * tw/2、高さ = (cols + rows) * th/2
        const isoRatio = 0.55;
        const span = gridCols + gridRows;

        const twByWidth = (availableWidth * 2) / span;
        const twByHeight = ((availableHeight * 2) / span) / isoRatio;

        // 幅と高さの制約の小さい方を使う（100%フィル）
        this.tileWidth = Math.min(twByWidth, twByHeight);
        this.tileHeight = this.tileWidth * isoRatio;

        // グリッドオフセット（中央揃え）
        this.gridOffsetX = width / 2;
        const gridTotalH = span * (this.tileHeight / 2);
        this.gridOffsetY = uiTopMargin + (availableHeight - gridTotalH) / 2;

        // 背景
        this.createBackground(width, height);

        // グリッド描画
        this.createGrid();

        // アニメーション生成
        this.createAnimations();

        // UI
        this.createTopUI(width);
        this.createUnitPanel(width, height);
        this.createStartWaveButton(width, height);
        this.createSpeedButton(width);

        // タイル クリック検出
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.gameOver) return;
            if (pointer.y > this.scale.height - 160) return; // UIパネル内は無視

            const tile = this.screenToTile(pointer.x, pointer.y);
            if (tile) {
                this.handleTileClick(tile.col, tile.row);
            }
        });
    }

    // ============================================
    // 描画ヘルパー
    // ============================================

    private isoToScreen(col: number, row: number): { x: number; y: number } {
        const x = this.gridOffsetX + (col - row) * (this.tileWidth / 2);
        const y = this.gridOffsetY + (col + row) * (this.tileHeight / 2);
        return { x, y };
    }

    private screenToTile(screenX: number, screenY: number): { col: number; row: number } | null {
        const rx = screenX - this.gridOffsetX;
        const ry = screenY - this.gridOffsetY;

        const col = Math.round((rx / (this.tileWidth / 2) + ry / (this.tileHeight / 2)) / 2);
        const row = Math.round((ry / (this.tileHeight / 2) - rx / (this.tileWidth / 2)) / 2);

        if (col < 0 || col >= this.stageData.cols || row < 0 || row >= this.stageData.rows) {
            return null;
        }
        return { col, row };
    }

    private createBackground(width: number, height: number): void {
        const bg = this.stageData.background;
        const groundColor = bg ? parseInt(bg.groundColor.replace('0x', ''), 16) : 0x3a5a2c;

        this.add.rectangle(width / 2, height / 2, width, height, groundColor);
    }

    private createGrid(): void {
        const graphics = this.add.graphics();
        const bg = this.stageData.background;
        const pathColorVal = bg ? parseInt(bg.pathColor.replace('0x', ''), 16) : 0x8B7355;
        const accentColorVal = bg ? parseInt((bg.accentColor || '0x4a7c23').replace('0x', ''), 16) : 0x4a7c23;

        for (let r = 0; r < this.stageData.rows; r++) {
            for (let c = 0; c < this.stageData.cols; c++) {
                const { x, y } = this.isoToScreen(c, r);
                const isPath = this.pathSet.has(`${c},${r}`);

                // 菱形タイル描画
                const hw = this.tileWidth / 2;
                const hh = this.tileHeight / 2;

                if (isPath) {
                    graphics.fillStyle(pathColorVal, 0.85);
                } else {
                    // 市松模様
                    const shade = (c + r) % 2 === 0 ? 0.7 : 0.6;
                    graphics.fillStyle(accentColorVal, shade);
                }

                graphics.beginPath();
                graphics.moveTo(x, y - hh);
                graphics.lineTo(x + hw, y);
                graphics.lineTo(x, y + hh);
                graphics.lineTo(x - hw, y);
                graphics.closePath();
                graphics.fillPath();

                // 枠線
                graphics.lineStyle(1, 0x000000, 0.15);
                graphics.beginPath();
                graphics.moveTo(x, y - hh);
                graphics.lineTo(x + hw, y);
                graphics.lineTo(x, y + hh);
                graphics.lineTo(x - hw, y);
                graphics.closePath();
                graphics.strokePath();
            }
        }

        // パス入口/出口マーカー
        const pathStart = this.stageData.path[0];
        const pathEnd = this.stageData.path[this.stageData.path.length - 1];

        const startPos = this.isoToScreen(pathStart[0], pathStart[1]);
        this.add.text(startPos.x, startPos.y - 18, '🚪', { fontSize: '20px' }).setOrigin(0.5);

        const endPos = this.isoToScreen(pathEnd[0], pathEnd[1]);
        this.add.text(endPos.x, endPos.y - 18, '🏠', { fontSize: '20px' }).setOrigin(0.5);

        // タイルハイライト用のGraphics
        this.tileHighlights = this.add.graphics();
    }

    private createAnimations(): void {
        const loadedKeys = new Set<string>();
        for (const unit of this.allUnitsData) {
            const spriteId = unit.baseUnitId || unit.id;
            if (loadedKeys.has(spriteId)) continue;
            loadedKeys.add(spriteId);

            const atlasKey = `${spriteId}_atlas`;
            if (!this.textures.exists(atlasKey)) continue;

            const frames = this.textures.get(atlasKey).getFrameNames();
            const motions = ['idle', 'walk', 'attack', 'die'];

            for (const motion of motions) {
                const animKey = `${spriteId}_${motion}`;
                if (this.anims.exists(animKey)) continue;

                const matchingFrames = frames
                    .filter(f => f.toLowerCase().includes(motion) || f.toLowerCase().includes(`_${motion}`))
                    .sort();

                if (matchingFrames.length > 0) {
                    this.anims.create({
                        key: animKey,
                        frames: matchingFrames.map(f => ({ key: atlasKey, frame: f })),
                        frameRate: motion === 'walk' ? 8 : 10,
                        repeat: (motion === 'walk' || motion === 'idle') ? -1 : 0,
                    });
                }
            }
        }
    }

    // ============================================
    // UI
    // ============================================

    private createTopUI(width: number): void {
        // 上部バー背景
        this.add.rectangle(width / 2, 30, width, 60, 0x000000, 0.6);

        this.livesText = this.add.text(20, 18, '', {
            fontSize: '22px', fontFamily: 'Arial', color: '#ff6b6b', fontStyle: 'bold',
        });

        this.goldText = this.add.text(160, 18, '', {
            fontSize: '22px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
        });

        // タワー数（中央）
        this.towerCountText = this.add.text(width / 2, 18, `🏗️0/${MAX_TOWERS_TOTAL}`, {
            fontSize: '18px', fontFamily: 'Arial', color: '#aaddff', fontStyle: 'bold',
        }).setOrigin(0.5, 0);

        // Wave表示（タワー数とボタンの間 — 右寄り）
        this.waveText = this.add.text(width * 0.72, 18, '', {
            fontSize: '20px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0);

        this.updateTopUI();
    }

    private updateTopUI(): void {
        this.livesText.setText(`🏠 ${this.lives}`);
        this.goldText.setText(`💰 ${this.gold}`);
        this.waveText.setText(`⚔️ ${this.currentWave}/${this.stageData.waves.length}`);
        if (this.towerCountText) {
            this.towerCountText.setText(`🏗️${this.towers.length}/${MAX_TOWERS_TOTAL}`);
        }
    }

    private createUnitPanel(width: number, height: number): void {
        // 下部パネル
        const panelY = height - 140;
        const panelBg = this.add.rectangle(width / 2, panelY + 70, width, 140, 0x1a1a2e, 0.92);
        panelBg.setDepth(100);

        // チームユニットボタン
        const btnSize = 72;
        const gap = 10;
        const totalWidth = this.teamData.length * (btnSize + gap) - gap;
        const startX = (width - totalWidth) / 2 + btnSize / 2;

        this.teamData.forEach((unitDef, i) => {
            const btnX = startX + i * (btnSize + gap);
            const btnY = panelY + 38;

            const container = this.add.container(btnX, btnY);
            container.setDepth(101);

            // 背景
            const bg = this.add.rectangle(0, 0, btnSize, btnSize, 0x2a2a4e, 0.9);
            bg.setStrokeStyle(2, 0x4a4a8e);
            container.add(bg);

            // ユニットアイコン
            const spriteId = unitDef.baseUnitId || unitDef.id;
            const atlasKey = `${spriteId}_atlas`;
            let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

            if (this.textures.exists(atlasKey)) {
                const frameNames = this.textures.get(atlasKey).getFrameNames();
                const idleFrame = frameNames.find(f => f.includes('idle')) || frameNames[0];
                icon = this.add.image(0, -5, atlasKey, idleFrame);
            } else if (this.textures.exists(spriteId)) {
                icon = this.add.image(0, -5, spriteId);
            } else {
                icon = this.add.image(0, -5, '__DEFAULT');
            }
            const iconScale = 42 / Math.max(icon.width, icon.height);
            icon.setScale(iconScale);
            container.add(icon);

            // コスト表示
            const placeCost = this.getPlaceCost(unitDef);
            const costLabel = this.add.text(0, 24, `💰${placeCost}`, {
                fontSize: '11px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
            }).setOrigin(0.5);
            container.add(costLabel);

            // スキル表示
            const skill = unitDef.skillId ? getSkillById(unitDef.skillId) : undefined;
            if (skill) {
                const skillLabel = this.add.text(0, 35, skill.icon || '✨', {
                    fontSize: '12px',
                }).setOrigin(0.5);
                container.add(skillLabel);
            }

            // インタラクション
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => {
                this.selectUnit(unitDef.id, i);
            });

            this.unitButtons.push(container);
        });
    }

    private selectUnit(unitId: string, buttonIndex: number): void {
        if (this.gameOver) return;

        const unitDef = this.teamData.find(u => u.id === unitId);
        if (!unitDef) return;

        const cost = this.getPlaceCost(unitDef);
        if (this.gold < cost) return;

        // すでに選択済みなら解除
        if (this.selectedUnitId === unitId) {
            this.selectedUnitId = null;
            this.clearTileHighlights();
            this.clearButtonHighlight();
            return;
        }

        this.selectedUnitId = unitId;
        this.highlightButton(buttonIndex);
        this.showPlaceableTiles();
    }

    private highlightButton(index: number): void {
        this.clearButtonHighlight();
        const btn = this.unitButtons[index];
        if (!btn) return;

        const highlight = this.add.graphics();
        highlight.lineStyle(3, 0x00ff88, 1);
        highlight.strokeRoundedRect(-38, -38, 76, 76, 6);
        btn.add(highlight);
        this.selectedHighlight = highlight;
    }

    private clearButtonHighlight(): void {
        if (this.selectedHighlight) {
            this.selectedHighlight.destroy();
            this.selectedHighlight = null;
        }
    }

    private showPlaceableTiles(): void {
        this.clearTileHighlights();
        if (!this.tileHighlights) return;

        const hw = this.tileWidth / 2;
        const hh = this.tileHeight / 2;

        for (let r = 0; r < this.stageData.rows; r++) {
            for (let c = 0; c < this.stageData.cols; c++) {
                const key = `${c},${r}`;
                if (this.pathSet.has(key) || this.occupiedTiles.has(key)) continue;

                const { x, y } = this.isoToScreen(c, r);
                this.tileHighlights.fillStyle(0x00ff88, 0.25);
                this.tileHighlights.beginPath();
                this.tileHighlights.moveTo(x, y - hh);
                this.tileHighlights.lineTo(x + hw, y);
                this.tileHighlights.lineTo(x, y + hh);
                this.tileHighlights.lineTo(x - hw, y);
                this.tileHighlights.closePath();
                this.tileHighlights.fillPath();
            }
        }
    }

    private clearTileHighlights(): void {
        this.tileHighlights?.clear();
    }

    private createStartWaveButton(width: number, height: number): void {
        const btnX = width / 2;
        const btnY = height - 170;

        const container = this.add.container(btnX, btnY);
        container.setDepth(110);

        const bg = this.add.rectangle(0, 0, 200, 42, 0xff6b35, 1);
        bg.setStrokeStyle(2, 0xffffff);
        container.add(bg);

        const label = this.add.text(0, 0, '⚔️ WAVE START', {
            fontSize: '18px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(label);

        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
            if (!this.waveActive && !this.gameOver && !this.allWavesComplete) {
                this.startNextWave();
            }
        });

        this.startWaveButton = container;
    }

    private createSpeedButton(width: number): void {
        const container = this.add.container(width - 50, 70);
        container.setDepth(110);

        const bg = this.add.rectangle(0, 0, 60, 28, 0x333355, 0.8);
        bg.setStrokeStyle(1, 0x666699);
        container.add(bg);

        const label = this.add.text(0, 0, '▶ x1', {
            fontSize: '13px', fontFamily: 'Arial', color: '#aaaaff', fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(label);

        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
            if (this.gameSpeed === 1) {
                this.gameSpeed = 2;
                label.setText('▶▶ x2');
            } else if (this.gameSpeed === 2) {
                this.gameSpeed = 3;
                label.setText('▶▶▶ x3');
            } else {
                this.gameSpeed = 1;
                label.setText('▶ x1');
            }
        });

        this.speedButton = container;
    }

    // ============================================
    // タイル操作
    // ============================================

    private handleTileClick(col: number, row: number): void {
        const key = `${col},${row}`;

        // アップグレードポップアップを閉じる
        this.closeUpgradePopup();

        // パス上は配置不可
        if (this.pathSet.has(key)) return;

        // 既に配置済み → アップグレード表示
        if (this.occupiedTiles.has(key)) {
            const existingTower = this.towers.find(t => t.col === col && t.row === row);
            if (existingTower) {
                this.showUpgradePopup(existingTower);
            }
            return;
        }

        if (!this.selectedUnitId) return;

        const unitDef = this.teamData.find(u => u.id === this.selectedUnitId);
        if (!unitDef) return;

        const cost = this.getPlaceCost(unitDef);
        if (this.gold < cost) return;

        // === 配置制限チェック ===
        // 合計上限
        if (this.towers.length >= MAX_TOWERS_TOTAL) return;
        // 同一ユニット上限
        const sameUnitCount = this.towers.filter(t => t.unitDefId === unitDef.id).length;
        if (sameUnitCount >= MAX_SAME_UNIT) return;

        // 配置実行
        this.gold -= cost;
        const newTower = this.placeTower(unitDef, col, row);
        this.occupiedTiles.add(key);
        this.updateTopUI();
        this.updateUnitButtonStates();

        // ハイライト更新
        this.showPlaceableTiles();

        // レンジプレビューは配置後自動表示しない（タワータップ時のみ）
    }

    private getPlaceCost(unitDef: UnitDefinition): number {
        // レアリティベースのTDコスト
        const costMap: Record<string, number> = {
            N: 30, R: 60, SR: 120, SSR: 200, UR: 350,
        };
        return costMap[unitDef.rarity] || 50;
    }

    private placeTower(unitDef: UnitDefinition, col: number, row: number): PlacedTower {
        const { x, y } = this.isoToScreen(col, row);

        const unit = new Unit(this, x, y + 5, unitDef, 'ally', 2000);
        unit.setDepth(y + 100);

        // タワーなので移動しない → SPAWN(IDLE的に使う)
        unit.setUnitState('SPAWN');

        // スケール調整 — タイルサイズに合わせて動的計算
        // ユニットの表示高さがtileHeight×1.6程度になるよう調整（多少はみ出しOK）
        const targetH = this.tileHeight * 1.6;
        const spriteH = unit.getBounds().height || 120;
        const towerScale = targetH / spriteH;
        unit.setScale(towerScale);

        // スキルアイコンをタワー足元に表示
        const skill = unitDef.skillId ? getSkillById(unitDef.skillId) : undefined;
        if (skill?.icon) {
            this.add.text(x, y + 8, skill.icon, {
                fontSize: '12px',
            }).setOrigin(0.5).setDepth(y + 99).setAlpha(0.7);
        }

        // レベル表示
        const levelLabel = this.add.text(x + 14, y - 28, '★1', {
            fontSize: '10px', fontFamily: 'Arial', color: '#ffdd00', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(y + 101);

        const tower: PlacedTower = {
            unit,
            unitDefId: unitDef.id,
            baseCost: this.getPlaceCost(unitDef),
            col,
            row,
            targetEnemy: null,
            attackTimer: 0,
            level: 1,
            damageMultiplier: 1.0,
            rangeMultiplier: 1.0,
            levelLabel,
        };
        this.towers.push(tower);

        // 配置エフェクト
        this.tweens.add({
            targets: unit,
            scaleX: { from: 0, to: unit.scaleX },
            scaleY: { from: 0, to: unit.scaleY },
            duration: 300,
            ease: 'Back.easeOut',
        });

        // タワータップでアップグレード/レンジ表示
        const hitW = 60;
        const hitH = 80;
        unit.setSize(hitW, hitH);
        unit.setInteractive(new Phaser.Geom.Rectangle(-hitW / 2, -hitH, hitW, hitH), Phaser.Geom.Rectangle.Contains);
        unit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            pointer.event.stopPropagation();
            this.showUpgradePopup(tower);
            this.showRangePreview(tower);
        });

        // 配置直後にレンジプレビュー表示（2秒後に自動消去）
        this.showRangePreview(tower, true);

        return tower;
    }

    // ============================================
    // Wave システム
    // ============================================

    private startNextWave(): void {
        this.currentWave++;
        if (this.currentWave > this.stageData.waves.length) {
            this.allWavesComplete = true;
            return;
        }

        this.waveActive = true;
        this.waveTimer = 0;
        const wave = this.stageData.waves[this.currentWave - 1];

        // スポーンタイマー設定
        this.waveSpawnTimers = [];
        for (const group of wave.enemies) {
            for (let i = 0; i < group.count; i++) {
                this.waveSpawnTimers.push({
                    unitId: group.unitId,
                    remaining: group.delayMs + i * group.intervalMs,
                    intervalMs: 0,
                    timer: 0,
                });
            }
        }

        // ボタン非表示
        this.startWaveButton.setVisible(false);
        this.updateTopUI();
    }

    private updateWaveSpawns(delta: number): void {
        if (!this.waveActive) return;

        const dt = delta * this.gameSpeed;

        const toRemove: number[] = [];
        for (let i = 0; i < this.waveSpawnTimers.length; i++) {
            this.waveSpawnTimers[i].remaining -= dt;
            if (this.waveSpawnTimers[i].remaining <= 0) {
                this.spawnEnemy(this.waveSpawnTimers[i].unitId);
                toRemove.push(i);
            }
        }

        // 完了したタイマー除去
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.waveSpawnTimers.splice(toRemove[i], 1);
        }

        // 全スポーン完了 + 全敵撃破 → Wave完了
        if (this.waveSpawnTimers.length === 0 && this.pathEnemies.length === 0) {
            this.onWaveComplete();
        }
    }

    private onWaveComplete(): void {
        this.waveActive = false;
        const wave = this.stageData.waves[this.currentWave - 1];
        if (wave?.goldBonus) {
            this.gold += wave.goldBonus;
        }

        if (this.currentWave >= this.stageData.waves.length) {
            this.allWavesComplete = true;
            this.onWin();
        } else if (this.currentWave >= 1) {
            // Wave 2以降は自動スタート（3秒カウントダウン）
            this.startWaveButton.setVisible(true);
            let countdown = 3;
            const label = this.startWaveButton.getAt(1) as Phaser.GameObjects.Text;
            label.setText(`⚔️ NEXT WAVE (${countdown}s)`);

            const timer = this.time.addEvent({
                delay: 1000,
                repeat: 2,
                callback: () => {
                    countdown--;
                    if (countdown <= 0) {
                        if (!this.waveActive && !this.gameOver && !this.allWavesComplete) {
                            this.startNextWave();
                        }
                    } else {
                        label.setText(`⚔️ NEXT WAVE (${countdown}s)`);
                    }
                },
            });
            // 手動で早くスタートした場合はタイマーをキャンセル
            this.startWaveButton.getAt(0).once('pointerdown', () => { timer.destroy(); });
        } else {
            // Wave 1はボタン手動
            this.startWaveButton.setVisible(true);
        }

        this.updateTopUI();
        this.updateUnitButtonStates();
    }

    // ============================================
    // 敵スポーン・移動
    // ============================================

    private spawnEnemy(unitId: string): void {
        const unitDef = this.allUnitsData.find(u => u.id === unitId);
        if (!unitDef) return;

        // パスの最初のタイル位置にスポーン
        const [startCol, startRow] = this.stageData.path[0];
        const { x, y } = this.isoToScreen(startCol, startRow);

        const unit = new Unit(this, x, y + 5, unitDef, 'enemy', 2000);
        unit.setDepth(y + 100);

        // スケール調整 — タイルサイズに合わせて動的計算
        const targetH = this.tileHeight * 1.4;
        const spriteH = unit.getBounds().height || 120;
        const enemyScale = targetH / spriteH;
        unit.setScale(enemyScale);

        // HPバー作成
        const hpBar = this.add.graphics();
        hpBar.setDepth(y + 200);

        const pathEnemy: PathEnemy = {
            unit,
            pathIndex: 0,
            progress: 0,
            baseSpeed: unitDef.speed,
            slowFactor: 1.0,
            slowTimer: 0,
            burnDps: 0,
            burnTimer: 0,
            hpBar,
        };

        this.pathEnemies.push(pathEnemy);
    }

    private updateEnemyMovement(delta: number): void {
        const dt = (delta / 1000) * this.gameSpeed;

        for (const enemy of this.pathEnemies) {
            if (enemy.unit.state === 'DIE') continue;
            if (enemy.unit.state === 'HITSTUN') continue;

            // === スロー・バーン更新 ===
            if (enemy.slowTimer > 0) {
                enemy.slowTimer -= delta * this.gameSpeed;
                if (enemy.slowTimer <= 0) {
                    enemy.slowFactor = 1.0;
                    enemy.slowTimer = 0;
                    // スロー表示解除
                    if (enemy.slowTint) {
                        enemy.slowTint.destroy();
                        enemy.slowTint = undefined;
                    }
                }
            }
            if (enemy.burnTimer > 0) {
                enemy.burnTimer -= delta * this.gameSpeed;
                const burnDmg = enemy.burnDps * dt;
                enemy.unit.hp -= burnDmg;
                // 0.5秒ごとにダメージ数字
                if (Math.floor((enemy.burnTimer + delta * this.gameSpeed) / 500) !== Math.floor(enemy.burnTimer / 500)) {
                    this.showDamageNumber(enemy.unit.x, enemy.unit.y - 25, Math.round(enemy.burnDps * 0.5), 0xff6600);
                }
                if (enemy.burnTimer <= 0) {
                    enemy.burnDps = 0;
                    enemy.burnTimer = 0;
                }
                if (enemy.unit.hp <= 0) {
                    enemy.unit.setUnitState('DIE');
                    this.gold += this.stageData.killGold;
                    this.updateTopUI();
                    this.updateUnitButtonStates();
                    continue;
                }
            }

            // パスに沿って移動
            if (enemy.pathIndex >= this.stageData.path.length - 1) {
                this.onEnemyReachEnd(enemy);
                continue;
            }

            const currentTile = this.stageData.path[enemy.pathIndex];
            const nextTile = this.stageData.path[enemy.pathIndex + 1];

            const currentPos = this.isoToScreen(currentTile[0], currentTile[1]);
            const nextPos = this.isoToScreen(nextTile[0], nextTile[1]);

            const dx = nextPos.x - currentPos.x;
            const dy = nextPos.y - currentPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // スロー適用
            const moveSpeed = (enemy.baseSpeed * 0.8 * enemy.slowFactor) / dist;

            enemy.progress += moveSpeed * dt;

            if (enemy.progress >= 1) {
                enemy.progress = 0;
                enemy.pathIndex++;

                if (enemy.pathIndex >= this.stageData.path.length - 1) {
                    this.onEnemyReachEnd(enemy);
                    continue;
                }
            }

            // 補間位置を計算
            const curTile = this.stageData.path[enemy.pathIndex];
            const nxtTile = this.stageData.path[Math.min(enemy.pathIndex + 1, this.stageData.path.length - 1)];
            const curPos = this.isoToScreen(curTile[0], curTile[1]);
            const nxtPos = this.isoToScreen(nxtTile[0], nxtTile[1]);

            const newX = curPos.x + (nxtPos.x - curPos.x) * enemy.progress;
            const newY = curPos.y + (nxtPos.y - curPos.y) * enemy.progress;

            enemy.unit.x = newX;
            enemy.unit.y = newY - 10;
            enemy.unit.setDepth(newY + 100);

            // Walk アニメーション
            if (enemy.unit.state === 'SPAWN') {
                enemy.unit.setUnitState('WALK');
            }

            // HPバー更新
            this.updateEnemyHpBar(enemy);

            // スロー表示更新
            if (enemy.slowTint) {
                enemy.slowTint.setPosition(enemy.unit.x, enemy.unit.y);
                enemy.slowTint.setDepth(enemy.unit.depth + 1);
            }
        }
    }

    private updateEnemyHpBar(enemy: PathEnemy): void {
        if (!enemy.hpBar) return;
        enemy.hpBar.clear();

        if (enemy.unit.state === 'DIE') return;
        if (enemy.unit.hp >= enemy.unit.maxHp) return; // フルHPは表示しない

        const barWidth = 30;
        const barHeight = 4;
        const x = enemy.unit.x - barWidth / 2;
        const y = enemy.unit.y - 35;
        const hpRatio = Math.max(0, enemy.unit.hp / enemy.unit.maxHp);

        // 背景
        enemy.hpBar.fillStyle(0x000000, 0.6);
        enemy.hpBar.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);

        // HP色（緑→黄→赤）
        let color = 0x00ff00;
        if (hpRatio < 0.3) color = 0xff0000;
        else if (hpRatio < 0.6) color = 0xffaa00;

        enemy.hpBar.fillStyle(color, 1);
        enemy.hpBar.fillRect(x, y, barWidth * hpRatio, barHeight);

        enemy.hpBar.setDepth(enemy.unit.depth + 2);
    }

    private onEnemyReachEnd(enemy: PathEnemy): void {
        this.lives--;
        this.updateTopUI();

        // 敵を除去
        enemy.unit.setUnitState('DIE');
        // HP バー・スロー表示即クリア
        enemy.hpBar?.clear();
        if (enemy.slowTint) {
            enemy.slowTint.destroy();
            enemy.slowTint = undefined;
        }

        // 敗北チェック
        if (this.lives <= 0) {
            this.onLose();
        }
    }

    // ============================================
    // タワー戦闘
    // ============================================

    private updateTowerCombat(delta: number): void {
        const dt = delta * this.gameSpeed;

        for (const tower of this.towers) {
            if (tower.unit.state === 'DIE') continue;

            tower.attackTimer -= dt;

            // ターゲット探索
            let target = tower.targetEnemy;

            // ターゲット無効化チェック
            if (target && (target.unit.state === 'DIE' || target.unit.hp <= 0)) {
                target = null;
                tower.targetEnemy = null;
            }

            // 新ターゲット探索
            if (!target) {
                target = this.findNearestEnemy(tower);
                tower.targetEnemy = target;
            }

            if (!target) {
                // IDLE状態を維持
                if (tower.unit.state !== 'SPAWN') {
                    // Nothing to attack
                }
                continue;
            }

            // 射程内チェック
            const dx = target.unit.x - tower.unit.x;
            const dy = target.unit.y - tower.unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // TD用にattackRangeをスケール（アップグレード反映）
            const range = tower.unit.definition.attackRange * 0.8 * tower.rangeMultiplier;

            if (dist > range) {
                tower.targetEnemy = null;
                continue;
            }

            // 攻撃可能チェック
            if (tower.attackTimer <= 0) {
                this.towerAttack(tower, target);
                tower.attackTimer = tower.unit.definition.attackCooldownMs;
            }
        }
    }

    private findNearestEnemy(tower: PlacedTower): PathEnemy | null {
        let nearest: PathEnemy | null = null;
        let minDist = Infinity;
        const range = tower.unit.definition.attackRange * 0.8 * tower.rangeMultiplier;

        for (const enemy of this.pathEnemies) {
            if (enemy.unit.state === 'DIE' || enemy.unit.hp <= 0) continue;

            const dx = enemy.unit.x - tower.unit.x;
            const dy = enemy.unit.y - tower.unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist && dist <= range) {
                minDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    private towerAttack(tower: PlacedTower, target: PathEnemy): void {
        const def = tower.unit.definition;

        // 攻撃アニメーション
        tower.unit.setUnitState('ATTACK_WINDUP');

        // ユニットの向きを敵に合わせる
        const sprite = tower.unit.list.find(
            child => child instanceof Phaser.GameObjects.Sprite || child instanceof Phaser.GameObjects.Image
        ) as Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | undefined;
        if (sprite) {
            sprite.setFlipX(target.unit.x < tower.unit.x);
        }

        // ダメージ適用（windupMs後）
        this.time.delayedCall(def.attackWindupMs * (1 / this.gameSpeed), () => {
            if (target.unit.state === 'DIE' || target.unit.hp <= 0) return;

            // === スキル判定 ===
            let damage = Math.round(def.attackDamage * tower.damageMultiplier);
            let isCrit = false;
            const skillId = def.skillId;
            const skill = skillId ? getSkillById(skillId) : undefined;

            if (skill) {
                switch (skill.id) {
                    case 'critical_strike': {
                        // 25%で2.5倍ダメージ
                        if (Math.random() < (skill.triggerChance || 0.25)) {
                            damage = Math.round(damage * 2.5);
                            isCrit = true;
                        }
                        break;
                    }
                    case 'frost_slow': {
                        // 攻撃で敵を50%減速(2秒)
                        target.slowFactor = 0.5;
                        target.slowTimer = 2000;
                        // スロー表示
                        if (!target.slowTint) {
                            target.slowTint = this.add.rectangle(
                                target.unit.x, target.unit.y, 24, 24, 0x88ccff, 0.4
                            );
                            target.slowTint.setDepth(target.unit.depth + 1);
                        }
                        this.showSkillEffect(target.unit.x, target.unit.y, '❄️');
                        break;
                    }
                    case 'burn': {
                        // 継続ダメージ（アップグレード反映）
                        const burnEffect = skill.effects?.[0];
                        const baseBurnDps = burnEffect?.value || 50;
                        target.burnDps = Math.round(baseBurnDps * tower.damageMultiplier);
                        target.burnTimer = burnEffect?.durationMs || 3000;
                        this.showSkillEffect(target.unit.x, target.unit.y, '🔥');
                        break;
                    }
                    case 'chain_lightning': {
                        // 3体まで60%ダメージ連鎖
                        const chainEffect = skill.effects?.[0];
                        const chainCount = chainEffect?.chainCount || 3;
                        const chainDmgRatio = chainEffect?.value || 0.6;
                        const chainRange = chainEffect?.range || 150;
                        this.applyChainLightning(target, tower, chainCount, chainDmgRatio, chainRange);
                        this.showSkillEffect(target.unit.x, target.unit.y, '⚡');
                        break;
                    }
                }
            }

            // ダメージ適用
            target.unit.hp -= damage;

            // ダメージ数値表示
            if (isCrit) {
                this.showDamageNumber(target.unit.x, target.unit.y - 30, damage, 0xff4444, true);
            } else {
                this.showDamageNumber(target.unit.x, target.unit.y - 30, damage);
            }

            // ヒットエフェクト
            this.showHitEffect(target.unit.x, target.unit.y);

            // 撃破チェック
            if (target.unit.hp <= 0) {
                target.unit.setUnitState('DIE');
                this.gold += this.stageData.killGold;
                this.updateTopUI();
                this.updateUnitButtonStates();
            }

            // クールダウンへ
            tower.unit.setUnitState('ATTACK_COOLDOWN');
            this.time.delayedCall(500, () => {
                if (tower.unit.state === 'ATTACK_COOLDOWN') {
                    tower.unit.setUnitState('SPAWN');
                }
            });
        });
    }

    // チェインライトニング: 攻撃対象から近い敵に連鎖ダメージ（距離順）
    private applyChainLightning(origin: PathEnemy, tower: PlacedTower, maxChain: number, dmgRatio: number, range: number): void {
        const baseDamage = tower.unit.definition.attackDamage;
        const chainDamage = Math.round(baseDamage * dmgRatio * tower.damageMultiplier);
        const hit = new Set<string>([origin.unit.instanceId]);
        let lastX = origin.unit.x;
        let lastY = origin.unit.y;
        let chainCount = 0;

        while (chainCount < maxChain) {
            // 距離順にソートして最も近い敵を選択
            let bestEnemy: PathEnemy | null = null;
            let bestDist = Infinity;

            for (const enemy of this.pathEnemies) {
                if (enemy.unit.state === 'DIE' || enemy.unit.hp <= 0) continue;
                if (hit.has(enemy.unit.instanceId)) continue;

                const dx = enemy.unit.x - lastX;
                const dy = enemy.unit.y - lastY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= range && dist < bestDist) {
                    bestDist = dist;
                    bestEnemy = enemy;
                }
            }

            if (!bestEnemy) break;

            // ライトニングビジュアル
            const line = this.add.graphics();
            line.lineStyle(2, 0xffff00, 0.9);
            line.beginPath();
            line.moveTo(lastX, lastY);
            line.lineTo(bestEnemy.unit.x, bestEnemy.unit.y);
            line.strokePath();
            line.setDepth(1500);
            this.tweens.add({
                targets: line,
                alpha: 0,
                duration: 400,
                onComplete: () => line.destroy(),
            });

            // ダメージ
            bestEnemy.unit.hp -= chainDamage;
            this.showDamageNumber(bestEnemy.unit.x, bestEnemy.unit.y - 30, chainDamage, 0xffff00);
            if (bestEnemy.unit.hp <= 0) {
                bestEnemy.unit.setUnitState('DIE');
                this.gold += this.stageData.killGold;
                this.updateTopUI();
            }

            hit.add(bestEnemy.unit.instanceId);
            lastX = bestEnemy.unit.x;
            lastY = bestEnemy.unit.y;
            chainCount++;
        }
    }

    private showDamageNumber(x: number, y: number, damage: number, color: number = 0xff4444, isCrit: boolean = false): void {
        const colorHex = `#${color.toString(16).padStart(6, '0')}`;
        const fontSize = isCrit ? '22px' : '16px';
        const prefix = isCrit ? '💥' : '-';
        const text = this.add.text(x, y, `${prefix}${damage}`, {
            fontSize, fontFamily: 'Arial', color: colorHex, fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(1000);

        this.tweens.add({
            targets: text,
            y: y - (isCrit ? 55 : 40),
            alpha: 0,
            scaleX: isCrit ? 1.3 : 1,
            scaleY: isCrit ? 1.3 : 1,
            duration: isCrit ? 1000 : 800,
            ease: 'Power2',
            onComplete: () => text.destroy(),
        });
    }

    private showHitEffect(x: number, y: number): void {
        const circle = this.add.circle(x, y, 8, 0xff4444, 0.8).setDepth(999);
        this.tweens.add({
            targets: circle,
            scaleX: 2.5,
            scaleY: 2.5,
            alpha: 0,
            duration: 300,
            onComplete: () => circle.destroy(),
        });
    }

    // スキルエフェクト (アイコン表示)
    private showSkillEffect(x: number, y: number, emoji: string): void {
        const text = this.add.text(x + 12, y - 15, emoji, {
            fontSize: '18px',
        }).setOrigin(0.5).setDepth(1100);

        this.tweens.add({
            targets: text,
            y: y - 45,
            alpha: 0,
            duration: 700,
            ease: 'Power2',
            onComplete: () => text.destroy(),
        });
    }

    // レンジプレビュー表示
    /** レンジの大きさに応じた色を取得 */
    private getRangeColor(range: number): number {
        if (range <= 80) return 0xff4444;       // 赤 — 近距離
        if (range <= 120) return 0xff8800;       // オレンジ — 中距離
        if (range <= 180) return 0x44aaff;       // 青 — 遠距離
        return 0xaa44ff;                         // 紫 — 超遠距離
    }

    private showRangePreview(tower: PlacedTower, autoHide: boolean = false): void {
        this.clearRangePreview();
        const range = tower.unit.definition.attackRange * 0.8 * tower.rangeMultiplier;
        const color = this.getRangeColor(range);

        this.rangePreview = this.add.graphics();

        // タイル単位でレンジ内のマスをハイライト
        const hw = this.tileWidth / 2;
        const hh = this.tileHeight / 2;
        for (let r = 0; r < this.stageData.rows; r++) {
            for (let c = 0; c < this.stageData.cols; c++) {
                const { x, y } = this.isoToScreen(c, r);
                const dx = x - tower.unit.x;
                const dy = y - tower.unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= range) {
                    this.rangePreview.fillStyle(color, 0.15);
                    this.rangePreview.beginPath();
                    this.rangePreview.moveTo(x, y - hh);
                    this.rangePreview.lineTo(x + hw, y);
                    this.rangePreview.lineTo(x, y + hh);
                    this.rangePreview.lineTo(x - hw, y);
                    this.rangePreview.closePath();
                    this.rangePreview.fillPath();
                }
            }
        }

        // 外周の円
        this.rangePreview.lineStyle(2, color, 0.5);
        this.rangePreview.strokeCircle(tower.unit.x, tower.unit.y, range);
        this.rangePreview.setDepth(50);

        if (autoHide) {
            this.time.delayedCall(2000, () => this.clearRangePreview());
        }
    }

    private clearRangePreview(): void {
        if (this.rangePreview) {
            this.rangePreview.destroy();
            this.rangePreview = null;
        }
    }

    // ============================================
    // アップグレードシステム
    // ============================================

    private showUpgradePopup(tower: PlacedTower): void {
        if (this.gameOver) return;
        this.closeUpgradePopup();
        this.showRangePreview(tower);

        if (tower.level >= 3) {
            // MAXレベルの場合はレンジのみ表示
            this.time.delayedCall(2000, () => this.clearRangePreview());
            return;
        }

        const upgradeCost = this.getUpgradeCost(tower);
        const canAfford = this.gold >= upgradeCost;
        const nextLevel = tower.level + 1;
        const nextDmg = Math.round(tower.unit.definition.attackDamage * (1 + nextLevel * 0.5 - 0.5));
        const currentDmg = Math.round(tower.unit.definition.attackDamage * tower.damageMultiplier);

        const container = this.add.container(tower.unit.x, tower.unit.y - 60);
        container.setDepth(2000);

        // 背景
        const popupWidth = 130;
        const popupHeight = 70;
        const bg = this.add.rectangle(0, 0, popupWidth, popupHeight, 0x1a1a2e, 0.95);
        bg.setStrokeStyle(2, canAfford ? 0x44ff88 : 0x666666);
        container.add(bg);

        // タイトル
        container.add(this.add.text(0, -24, `⬆️ Lv${nextLevel}`, {
            fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5));

        // ステータスプレビュー
        container.add(this.add.text(0, -8, `ATK: ${currentDmg}→${nextDmg}`, {
            fontSize: '11px', fontFamily: 'Arial', color: '#ff8888',
        }).setOrigin(0.5));

        // コストボタン
        const btnBg = this.add.rectangle(0, 16, 100, 26, canAfford ? 0x228833 : 0x444444, 0.9);
        btnBg.setStrokeStyle(1, canAfford ? 0x44ff88 : 0x666666);
        container.add(btnBg);

        const btnLabel = this.add.text(0, 16, `💰${upgradeCost}`, {
            fontSize: '13px', fontFamily: 'Arial', color: canAfford ? '#ffd700' : '#888888', fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(btnLabel);

        if (canAfford) {
            btnBg.setInteractive({ useHandCursor: true });
            btnBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                pointer.event.stopPropagation();
                this.upgradeTower(tower);
                this.closeUpgradePopup();
            });
        }

        // ポップアップアニメーション
        container.setAlpha(0);
        container.setScale(0.5);
        this.tweens.add({
            targets: container,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 200,
            ease: 'Back.easeOut',
        });

        this.upgradePopup = container;
    }

    private closeUpgradePopup(): void {
        if (this.upgradePopup) {
            this.upgradePopup.destroy();
            this.upgradePopup = null;
        }
        this.clearRangePreview();
    }

    private getUpgradeCost(tower: PlacedTower): number {
        // Lv2 = 50% of base, Lv3 = 100% of base
        if (tower.level === 1) return Math.round(tower.baseCost * 0.5);
        if (tower.level === 2) return tower.baseCost;
        return 0; // already max
    }

    private upgradeTower(tower: PlacedTower): void {
        if (tower.level >= 3) return;

        const cost = this.getUpgradeCost(tower);
        if (this.gold < cost) return;

        this.gold -= cost;
        tower.level++;

        // ステータス更新: ATK+50%, Range+20% per level
        tower.damageMultiplier = 1 + (tower.level - 1) * 0.5;  // 1.0 -> 1.5 -> 2.0
        tower.rangeMultiplier = 1 + (tower.level - 1) * 0.2;   // 1.0 -> 1.2 -> 1.4

        // レベル表示更新
        const stars = '★'.repeat(tower.level);
        if (tower.levelLabel) {
            tower.levelLabel.setText(stars);
            // レベル色
            if (tower.level === 2) tower.levelLabel.setColor('#88ff88');
            if (tower.level === 3) tower.levelLabel.setColor('#ff88ff');
        }

        // アップグレードエフェクト
        const effect = this.add.circle(tower.unit.x, tower.unit.y, 20, 0x44ff88, 0.7).setDepth(1500);
        this.tweens.add({
            targets: effect,
            scaleX: 3,
            scaleY: 3,
            alpha: 0,
            duration: 500,
            onComplete: () => effect.destroy(),
        });

        // ユニットスケールアップ（レベルに応じた固定比率）
        const targetScale = tower.unit.scaleX * 1.06;
        this.tweens.add({
            targets: tower.unit,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 300,
            ease: 'Elastic.easeOut',
        });

        this.showSkillEffect(tower.unit.x, tower.unit.y, `⬆️Lv${tower.level}`);

        this.updateTopUI();
        this.updateUnitButtonStates();
    }

    // ============================================
    // ゲーム終了
    // ============================================

    private onWin(): void {
        if (this.gameOver) return;
        this.gameOver = true;

        this.showResult('🎉 VICTORY!', 0xffd700);
        eventBus.emit(GameEvents.TD_WIN, {
            reward: { coins: this.stageData.reward.coins },
        });
    }

    private onLose(): void {
        if (this.gameOver) return;
        this.gameOver = true;

        this.showResult('💀 DEFEAT', 0xff4444);
        eventBus.emit(GameEvents.TD_LOSE);
    }

    private showResult(text: string, color: number): void {
        const { width, height } = this.scale;

        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
        overlay.setDepth(2000);

        const resultText = this.add.text(width / 2, height / 2 - 30, text, {
            fontSize: '48px', fontFamily: 'Arial', color: `#${color.toString(16).padStart(6, '0')}`,
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(2001);

        this.tweens.add({
            targets: resultText,
            scaleX: { from: 0.5, to: 1 },
            scaleY: { from: 0.5, to: 1 },
            duration: 600,
            ease: 'Back.easeOut',
        });
    }

    // ============================================
    // ユニットボタン状態更新
    // ============================================

    private updateUnitButtonStates(): void {
        this.teamData.forEach((unitDef, i) => {
            const btn = this.unitButtons[i];
            if (!btn) return;

            const cost = this.getPlaceCost(unitDef);
            const canAfford = this.gold >= cost;
            // 配置制限チェック
            const totalLimitReached = this.towers.length >= MAX_TOWERS_TOTAL;
            const sameUnitCount = this.towers.filter(t => t.unitDefId === unitDef.id).length;
            const unitLimitReached = sameUnitCount >= MAX_SAME_UNIT;
            const canPlace = canAfford && !totalLimitReached && !unitLimitReached;

            // 背景色変更
            const bg = btn.list[0] as Phaser.GameObjects.Rectangle;
            if (bg) {
                if (unitLimitReached) {
                    bg.setFillStyle(0x333333, 0.5); // グレーアウト
                } else {
                    bg.setFillStyle(canPlace ? 0x2a2a4e : 0x1a1a2e, canPlace ? 0.9 : 0.5);
                }
            }

            // アイコン透明度
            const icon = btn.list[1];
            if (icon) {
                (icon as Phaser.GameObjects.Image).setAlpha(canPlace ? 1 : 0.4);
            }
        });

        // タワーカウント更新
        if (this.towerCountText) {
            this.towerCountText.setText(`🏗️${this.towers.length}/${MAX_TOWERS_TOTAL}`);
        }
    }

    // ============================================
    // メインループ
    // ============================================

    update(_time: number, delta: number): void {
        if (this.gameOver) return;

        // Wave スポーン
        this.updateWaveSpawns(delta);

        // 敵移動
        this.updateEnemyMovement(delta);

        // タワー戦闘
        this.updateTowerCombat(delta);

        // 死亡ユニット除去
        this.cleanupDeadEnemies();

        // 深度ソート
        this.updateDepthSort();
    }

    private cleanupDeadEnemies(): void {
        for (let i = this.pathEnemies.length - 1; i >= 0; i--) {
            const enemy = this.pathEnemies[i];
            if (enemy.unit.state === 'DIE') {
                // フェードアウト後に除去
                if (enemy.unit.alpha <= 0.1) {
                    enemy.hpBar?.destroy();
                    enemy.slowTint?.destroy();
                    enemy.unit.destroy();
                    this.pathEnemies.splice(i, 1);
                } else {
                    enemy.unit.setAlpha(enemy.unit.alpha - 0.02);
                    // HPバーも非表示
                    enemy.hpBar?.clear();
                }
            }
        }
    }

    private updateDepthSort(): void {
        // 全ユニットをY座標でソート
        for (const enemy of this.pathEnemies) {
            enemy.unit.setDepth(enemy.unit.y + 100);
        }
        for (const tower of this.towers) {
            tower.unit.setDepth(tower.unit.y + 100);
        }
    }
}
