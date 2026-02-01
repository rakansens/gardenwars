import Phaser from 'phaser';
import { NetworkManager } from '../systems/NetworkManager';
import { getSpritePath, getSheetPath, ANIMATED_UNITS } from '@/lib/sprites';
import type { UnitState as NetworkUnitState } from '@/lib/colyseus/types';
import type { Rarity } from '@/data/types';
import { allies } from '@/data/units';

// ============================================
// RealtimeBattleScene - リアルタイム対戦用シーン
// ============================================

// ユニット定義の簡易版（サーバーから同期されるデータを補完）
interface UnitDefinition {
  id: string;
  name: string;
  rarity: Rarity;
  cost: number;
  scale?: number;
}

// シーン上のユニットエンティティ
interface RealtimeUnit {
  instanceId: string;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  lastX: number;  // 補間用
  targetX: number;
  hitstunTimer?: Phaser.Time.TimerEvent;
}

export interface RealtimeBattleSceneData {
  networkManager: NetworkManager;
  deck: string[];
  onSummon: (unitId: string) => void;
  onUpgradeCost: () => void;
}

export class RealtimeBattleScene extends Phaser.Scene {
  private networkManager!: NetworkManager;
  private deck: string[] = [];
  private onSummon!: (unitId: string) => void;
  private onUpgradeCost!: () => void;

  // エンティティ
  private units: Map<string, RealtimeUnit> = new Map();
  private allyCastle!: Phaser.GameObjects.Container;
  private enemyCastle!: Phaser.GameObjects.Container;
  private allyCastleHpBar!: Phaser.GameObjects.Rectangle;
  private enemyCastleHpBar!: Phaser.GameObjects.Rectangle;
  private ground!: Phaser.GameObjects.Rectangle;

  // UI
  private costText!: Phaser.GameObjects.Text;
  private costBarFill!: Phaser.GameObjects.Rectangle;
  private phaseText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;

  // ユニット定義マップ
  private unitDefinitions: Map<string, UnitDefinition> = new Map();

  // 定数
  private readonly GROUND_Y = 470;
  private stageLength = 1200;
  private readonly CASTLE_PADDING = 80;

  constructor() {
    super({ key: 'RealtimeBattleScene' });

    // ユニット定義をマップに格納
    allies.forEach(unit => {
      this.unitDefinitions.set(unit.id, {
        id: unit.id,
        name: unit.name,
        rarity: unit.rarity,
        cost: unit.cost,
        scale: unit.scale
      });
    });
  }

  init(data: RealtimeBattleSceneData) {
    this.networkManager = data.networkManager;
    this.deck = data.deck || [];
    this.onSummon = data.onSummon || (() => {});
    this.onUpgradeCost = data.onUpgradeCost || (() => {});

    // サーバーのステージ長を反映
    this.stageLength = this.networkManager?.getState().stageLength ?? 1200;

    // 前回のユニットをクリア
    this.units.clear();

    console.log("[RealtimeBattleScene] init with deck:", this.deck);
    console.log("[RealtimeBattleScene] networkManager:", this.networkManager ? 'OK' : 'MISSING!');
  }

  preload() {
    // 城スプライト
    this.load.image('castle_ally', getSpritePath('castle_ally'));
    this.load.image('castle_enemy', getSpritePath('castle_enemy'));

    // すべての味方ユニット画像をロード（相手のユニットも表示できるように）
    for (const [unitId, def] of this.unitDefinitions) {
      const rarity = def?.rarity || 'N';

      // 静止画
      if (!this.textures.exists(unitId)) {
        this.load.image(unitId, getSpritePath(unitId, rarity));
      }

      // アニメーションシート（リアルタイムでは主要なもののみ）
      if (ANIMATED_UNITS.includes(unitId as any) && this.deck.includes(unitId)) {
        const sheetPath = getSheetPath(unitId);
        this.load.atlas(`${unitId}_atlas`, sheetPath.image, sheetPath.json);
      }
    }
  }

  create() {
    const { width, height } = this.scale;

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, 0x87ceeb);

    // 地面
    this.ground = this.add.rectangle(this.stageLength / 2, height - 65, this.stageLength, 130, 0x3d2817);

    // 城を作成
    this.createCastles();

    // UI作成
    this.createUI();

    // カメラ設定
    this.cameras.main.setBounds(0, 0, this.stageLength, height);
    const maxScrollX = Math.max(0, this.stageLength - width);
    this.cameras.main.scrollX = maxScrollX / 2;

    // NetworkManagerイベントリスナー
    this.setupNetworkListeners();

    // カメラドラッグ
    this.setupCameraDrag();
  }

  private createCastles() {
    // 城の目標高さ（BattleSceneと同じ）
    const targetHeight = 250;
    const castlePositions = {
      player1: this.CASTLE_PADDING,
      player2: this.stageLength - this.CASTLE_PADDING,
    };

    // 味方城（player1 = 左）
    this.allyCastle = this.add.container(castlePositions.player1, this.GROUND_Y);
    const allySprite = this.add.image(0, 0, 'castle_ally');
    allySprite.setOrigin(0.5, 1);
    const allyScale = targetHeight / allySprite.height;
    allySprite.setScale(allyScale);
    this.allyCastle.add(allySprite);

    // 味方城HPバー
    const allyHpBg = this.add.rectangle(0, -allySprite.displayHeight - 20, 80, 10, 0x333333);
    this.allyCastleHpBar = this.add.rectangle(0, -allySprite.displayHeight - 20, 80, 10, 0x00ff00);
    this.allyCastle.add(allyHpBg);
    this.allyCastle.add(this.allyCastleHpBar);

    // 敵城（player2 = 右）
    this.enemyCastle = this.add.container(castlePositions.player2, this.GROUND_Y);
    const enemySprite = this.add.image(0, 0, 'castle_enemy');
    enemySprite.setOrigin(0.5, 1);
    const enemyScale = targetHeight / enemySprite.height;
    enemySprite.setScale(enemyScale);
    this.enemyCastle.add(enemySprite);

    // 敵城HPバー
    const enemyHpBg = this.add.rectangle(0, -enemySprite.displayHeight - 20, 80, 10, 0x333333);
    this.enemyCastleHpBar = this.add.rectangle(0, -enemySprite.displayHeight - 20, 80, 10, 0xff0000);
    this.enemyCastle.add(enemyHpBg);
    this.enemyCastle.add(this.enemyCastleHpBar);
  }

  private syncStageLength(nextLength: number) {
    if (!nextLength || nextLength === this.stageLength) return;
    this.stageLength = nextLength;
    if (this.ground) {
      this.ground.setSize(this.stageLength, this.ground.height);
      this.ground.x = this.stageLength / 2;
    }
    if (this.allyCastle) {
      this.allyCastle.x = this.CASTLE_PADDING;
    }
    if (this.enemyCastle) {
      this.enemyCastle.x = this.stageLength - this.CASTLE_PADDING;
    }
    const maxScrollX = Math.max(0, this.stageLength - this.scale.width);
    this.cameras.main.setBounds(0, 0, this.stageLength, this.scale.height);
    this.cameras.main.scrollX = Phaser.Math.Clamp(this.cameras.main.scrollX, 0, maxScrollX);
  }

  private createUI() {
    const { width, height } = this.scale;

    // コストパネル
    const panelX = 18;
    const panelY = 40;
    const panel = this.add.rectangle(panelX, panelY, 200, 50, 0xf8e7b6);
    panel.setOrigin(0, 0);
    panel.setStrokeStyle(3, 0x3b2a1a);
    panel.setScrollFactor(0);
    panel.setDepth(100);

    this.add.text(panelX + 12, panelY + 6, 'COST', {
      fontSize: '12px',
      color: '#4b2a10',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(101);

    // コストバー
    const costBarBg = this.add.rectangle(panelX + 12, panelY + 30, 130, 14, 0xd7bf8a);
    costBarBg.setOrigin(0, 0.5);
    costBarBg.setStrokeStyle(2, 0x3b2a1a);
    costBarBg.setScrollFactor(0);
    costBarBg.setDepth(101);

    this.costBarFill = this.add.rectangle(panelX + 12, panelY + 30, 0, 14, 0xffd45a);
    this.costBarFill.setOrigin(0, 0.5);
    this.costBarFill.setScrollFactor(0);
    this.costBarFill.setDepth(102);

    this.costText = this.add.text(panelX + 150, panelY + 30, '0/5', {
      fontSize: '14px',
      color: '#3b2a1a',
      fontStyle: 'bold',
    });
    this.costText.setOrigin(0, 0.5);
    this.costText.setScrollFactor(0);
    this.costText.setDepth(102);

    // フェーズ表示
    this.phaseText = this.add.text(width / 2, panelY, 'Waiting...', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.phaseText.setOrigin(0.5, 0);
    this.phaseText.setScrollFactor(0);
    this.phaseText.setDepth(100);

    // カウントダウン
    this.countdownText = this.add.text(width / 2, height / 2 - 50, '', {
      fontSize: '96px',
      color: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    });
    this.countdownText.setOrigin(0.5, 0.5);
    this.countdownText.setScrollFactor(0);
    this.countdownText.setDepth(200);
    this.countdownText.setVisible(false);

    // 召喚ボタン
    this.createSummonButtons();

    // コストアップグレードボタン
    this.createUpgradeButton();
  }

  private createSummonButtons() {
    const { height } = this.scale;
    const buttonY = height - 85;
    const buttonWidth = 90;
    const buttonHeight = 100;
    const startX = 100;
    const gap = 8;

    // 下部バー
    const bar = this.add.rectangle(this.scale.width / 2, height - 75, this.scale.width, 150, 0x6b4a2b, 0.95);
    bar.setScrollFactor(0);
    bar.setDepth(90);

    this.deck.forEach((unitId, index) => {
      const x = startX + index * (buttonWidth + gap);
      const def = this.unitDefinitions.get(unitId);

      // ボタン背景
      const bg = this.add.rectangle(x, buttonY, buttonWidth, buttonHeight, 0xf8e7b6);
      bg.setScrollFactor(0);
      bg.setDepth(100);
      bg.setInteractive({ useHandCursor: true });
      bg.setStrokeStyle(3, 0x3b2a1a);

      // ユニット画像
      if (this.textures.exists(unitId)) {
        const unitImg = this.add.image(x, buttonY - 15, unitId);
        unitImg.setScrollFactor(0);
        unitImg.setDepth(101);
        // サイズ調整
        const scale = Math.min(60 / unitImg.width, 60 / unitImg.height);
        unitImg.setScale(scale * (def?.scale || 1));
      }

      // ユニット名
      const nameText = this.add.text(x, buttonY + 28, def?.name?.slice(0, 8) || unitId.slice(0, 8), {
        fontSize: '10px',
        color: '#3b2a1a',
        fontStyle: 'bold',
      });
      nameText.setOrigin(0.5, 0.5);
      nameText.setScrollFactor(0);
      nameText.setDepth(101);

      // コスト表示
      const costBg = this.add.rectangle(x, buttonY + 43, 40, 16, 0xffcc00);
      costBg.setScrollFactor(0);
      costBg.setDepth(101);
      costBg.setStrokeStyle(1, 0x3b2a1a);

      const costText = this.add.text(x, buttonY + 43, `¥${def?.cost || 0}`, {
        fontSize: '10px',
        color: '#3b2a1a',
        fontStyle: 'bold',
      });
      costText.setOrigin(0.5, 0.5);
      costText.setScrollFactor(0);
      costText.setDepth(102);

      // クリックで召喚
      bg.on('pointerdown', () => {
        if (!this.networkManager.isPlaying()) return;
        this.onSummon(unitId);
      });

      bg.on('pointerover', () => bg.setFillStyle(0xfff3cf));
      bg.on('pointerout', () => bg.setFillStyle(0xf8e7b6));
    });
  }

  private createUpgradeButton() {
    const { height } = this.scale;
    const buttonY = height - 85;

    const btn = this.add.circle(this.scale.width - 60, buttonY, 30, 0xffe066);
    btn.setStrokeStyle(3, 0x3b2a1a);
    btn.setScrollFactor(0);
    btn.setDepth(100);
    btn.setInteractive({ useHandCursor: true });

    const text = this.add.text(this.scale.width - 60, buttonY, '⬆️', {
      fontSize: '24px',
    });
    text.setOrigin(0.5, 0.5);
    text.setScrollFactor(0);
    text.setDepth(101);

    btn.on('pointerdown', () => {
      if (!this.networkManager.isPlaying()) return;
      this.onUpgradeCost();
    });
  }

  private setupNetworkListeners() {
    if (!this.networkManager) {
      console.error('[RealtimeBattleScene] NetworkManager is not available!');
      return;
    }

    // フェーズ変更
    this.networkManager.on(NetworkManager.Events.PHASE_CHANGED, (phase: string) => {
      this.handlePhaseChange(phase);
    });

    // プレイヤー更新
    this.networkManager.on(NetworkManager.Events.PLAYER_UPDATED, () => {
      this.updatePlayerUI();
    });

    // ユニット追加
    this.networkManager.on(NetworkManager.Events.UNIT_ADDED, (unit: NetworkUnitState) => {
      this.createUnit(unit);
    });

    // ユニット更新
    this.networkManager.on(NetworkManager.Events.UNIT_UPDATED, (unit: NetworkUnitState) => {
      this.updateUnit(unit);
    });

    // ユニット削除
    this.networkManager.on(NetworkManager.Events.UNIT_REMOVED, (unit: NetworkUnitState) => {
      this.removeUnit(unit.instanceId);
    });

    // ゲーム終了
    this.networkManager.on(NetworkManager.Events.GAME_OVER, (isWinner: boolean, reason: string) => {
      this.handleGameOver(isWinner, reason);
    });
  }

  private handlePhaseChange(phase: string) {
    switch (phase) {
      case 'waiting':
        this.phaseText.setText('Waiting for opponent...');
        this.countdownText.setVisible(false);
        break;
      case 'countdown':
        this.phaseText.setText('Get Ready!');
        this.countdownText.setVisible(true);
        break;
      case 'playing':
        this.phaseText.setText('BATTLE!');
        this.countdownText.setVisible(false);
        this.time.delayedCall(1000, () => {
          this.phaseText.setVisible(false);
        });
        break;
      case 'finished':
        // handleGameOverで処理
        break;
    }
  }

  private updatePlayerUI() {
    const myPlayer = this.networkManager.getMyPlayer();
    const opponent = this.networkManager.getOpponent();

    if (myPlayer) {
      const ratio = myPlayer.maxCost > 0 ? myPlayer.cost / myPlayer.maxCost : 0;
      const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
      this.costBarFill.width = 130 * clampedRatio;
      this.costText.setText(`${Math.floor(Math.max(0, myPlayer.cost))}/${Math.max(0, myPlayer.maxCost)}`);

      // 自分の城HPバー更新
      const mySide = this.networkManager.getMySide();
      if (mySide === 'player1') {
        const hpRatio = myPlayer.maxCastleHp > 0 ? myPlayer.castleHp / myPlayer.maxCastleHp : 0;
        this.allyCastleHpBar.width = 80 * Phaser.Math.Clamp(hpRatio, 0, 1);
      } else if (mySide === 'player2') {
        const hpRatio = myPlayer.maxCastleHp > 0 ? myPlayer.castleHp / myPlayer.maxCastleHp : 0;
        this.enemyCastleHpBar.width = 80 * Phaser.Math.Clamp(hpRatio, 0, 1);
      }
    }

    if (opponent) {
      // 相手の城HPバー更新
      const mySide = this.networkManager.getMySide();
      if (mySide === 'player1') {
        const hpRatio = opponent.maxCastleHp > 0 ? opponent.castleHp / opponent.maxCastleHp : 0;
        this.enemyCastleHpBar.width = 80 * Phaser.Math.Clamp(hpRatio, 0, 1);
      } else if (mySide === 'player2') {
        const hpRatio = opponent.maxCastleHp > 0 ? opponent.castleHp / opponent.maxCastleHp : 0;
        this.allyCastleHpBar.width = 80 * Phaser.Math.Clamp(hpRatio, 0, 1);
      }
    }
  }

  private createUnit(unitState: NetworkUnitState) {
    if (this.units.has(unitState.instanceId)) return;

    const def = this.unitDefinitions.get(unitState.definitionId);
    const container = this.add.container(unitState.x, this.GROUND_Y);

    // スプライト
    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    const atlasKey = `${unitState.definitionId}_atlas`;

    if (this.textures.exists(atlasKey)) {
      sprite = this.add.sprite(0, 0, atlasKey, `${unitState.definitionId}_idle.png`);
    } else if (this.textures.exists(unitState.definitionId)) {
      sprite = this.add.image(0, 0, unitState.definitionId);
    } else if (this.textures.exists('cat_warrior')) {
      // フォールバック: cat_warrior
      sprite = this.add.image(0, 0, 'cat_warrior');
      console.warn(`[RealtimeBattleScene] Texture not found for ${unitState.definitionId}, using fallback`);
    } else {
      // 最終フォールバック: 矩形
      const graphics = this.add.graphics();
      graphics.fillStyle(0x888888, 1);
      graphics.fillRect(-30, -80, 60, 80);
      container.add(graphics);
      sprite = this.add.image(0, 0, '__DEFAULT') as any;
      sprite.setVisible(false);
    }

    const targetHeight = 120;
    const customScale = def?.scale ?? 1.0;
    const baseScale = (targetHeight / sprite.height) * customScale;
    sprite.setScale(baseScale);
    sprite.setOrigin(0.5, 1);

    // player2側のユニットは左向き
    if (unitState.side === 'player2') {
      sprite.setFlipX(true);
    }

    container.add(sprite);

    // HPバー
    const barY = -sprite.displayHeight - 10;
    const hpBarBg = this.add.rectangle(0, barY, 50, 6, 0x333333);
    const hpBar = this.add.rectangle(0, barY, 50, 6, 0x00ff00);
    container.add(hpBarBg);
    container.add(hpBar);

    // 名前
    const nameText = this.add.text(0, barY - 10, def?.name?.slice(0, 8) || '', {
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    nameText.setOrigin(0.5, 0.5);
    container.add(nameText);

    this.units.set(unitState.instanceId, {
      instanceId: unitState.instanceId,
      container,
      sprite,
      hpBar,
      hpBarBg,
      nameText,
      lastX: unitState.x,
      targetX: unitState.x,
    });
  }

  private updateUnit(unitState: NetworkUnitState) {
    const unit = this.units.get(unitState.instanceId);
    if (!unit) return;

    // 位置補間のターゲット更新
    unit.lastX = unit.container.x;
    unit.targetX = unitState.x;

    // HP更新
    const hpRatioRaw = unitState.maxHp > 0 ? unitState.hp / unitState.maxHp : 0;
    const hpRatio = Phaser.Math.Clamp(hpRatioRaw, 0, 1);
    unit.hpBar.width = 50 * hpRatio;

    // HP色
    if (hpRatio > 0.6) {
      unit.hpBar.setFillStyle(0x00ff00);
    } else if (hpRatio > 0.3) {
      unit.hpBar.setFillStyle(0xffff00);
    } else {
      unit.hpBar.setFillStyle(0xff0000);
    }

    // 状態に応じた見た目
    if (unitState.state === 'DIE') {
      unit.sprite.setAlpha(0.3);
    } else {
      unit.sprite.setAlpha(1);
    }

    if (unitState.state === 'HITSTUN') {
      if (!unit.hitstunTimer) {
        unit.sprite.setTint(0xff0000);
        unit.hitstunTimer = this.time.delayedCall(100, () => {
          unit.sprite.clearTint();
          unit.hitstunTimer = undefined;
        });
      }
    } else {
      if (unit.hitstunTimer) {
        unit.hitstunTimer.remove(false);
        unit.hitstunTimer = undefined;
      }
      unit.sprite.clearTint();
    }
  }

  private removeUnit(instanceId: string) {
    const unit = this.units.get(instanceId);
    if (!unit) return;

    // フェードアウト
    if (unit.hitstunTimer) {
      unit.hitstunTimer.remove(false);
      unit.hitstunTimer = undefined;
    }
    this.tweens.add({
      targets: unit.container,
      alpha: 0,
      y: unit.container.y + 20,
      duration: 500,
      onComplete: () => {
        unit.container.destroy();
        this.units.delete(instanceId);
      }
    });
  }

  private handleGameOver(isWinner: boolean, reason: string) {
    const { width, height } = this.scale;

    this.phaseText.setVisible(true);
    this.phaseText.setText(isWinner ? '🎉 VICTORY! 🎉' : '💀 DEFEAT 💀');
    this.phaseText.setY(height / 2 - 50);
    this.phaseText.setFontSize(48);
    this.phaseText.setColor(isWinner ? '#ffff00' : '#ff0000');

    const reasonText = this.add.text(width / 2, height / 2 + 20,
      reason === 'castle_destroyed' ? '城が破壊された！' : '相手が切断した',
      {
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      }
    );
    reasonText.setOrigin(0.5, 0.5);
    reasonText.setScrollFactor(0);
    reasonText.setDepth(200);
  }

  private setupCameraDrag() {
    let lastPointerX = 0;
    let isDragging = false;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < this.scale.height - 120) {
        isDragging = true;
        lastPointerX = pointer.x;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (isDragging && pointer.isDown) {
        const deltaX = lastPointerX - pointer.x;
        this.cameras.main.scrollX += deltaX;
        this.cameras.main.scrollX = Phaser.Math.Clamp(
          this.cameras.main.scrollX,
          0,
          Math.max(0, this.stageLength - this.scale.width)
        );
        lastPointerX = pointer.x;
      }
    });

    this.input.on('pointerup', () => {
      isDragging = false;
    });
  }

  update(time: number, delta: number) {
    // カウントダウン更新
    const state = this.networkManager.getState();
    if (state.stageLength && state.stageLength !== this.stageLength) {
      this.syncStageLength(state.stageLength);
    }
    if (state.phase === 'countdown') {
      this.countdownText.setText(String(state.countdown));
    }

    // ユニット位置の補間
    const lerpFactor = 0.2;
    this.units.forEach(unit => {
      const currentX = unit.container.x;
      const newX = Phaser.Math.Linear(currentX, unit.targetX, lerpFactor);
      unit.container.x = newX;
    });

    // プレイヤーUI更新
    this.updatePlayerUI();
  }

  shutdown() {
    // イベントリスナー削除
    this.networkManager.removeAllListeners();
    this.units.clear();
  }
}
