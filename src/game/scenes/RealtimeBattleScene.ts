import Phaser from 'phaser';
import { NetworkManager } from '../systems/NetworkManager';
import { getSpritePath, getSheetPath, ANIMATED_UNITS } from '@/lib/sprites';
import type { UnitState as NetworkUnitState } from '@/lib/colyseus/types';
import type { Rarity } from '@/data/types';

// レアリティ別デフォルトクールダウン時間（ミリ秒）
const COOLDOWN_BY_RARITY: Record<Rarity, number> = {
  N: 2000,
  R: 4000,
  SR: 8000,
  SSR: 12000,
  UR: 15000,
};
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
  spawnCooldownMs?: number;
}

function getSpawnCooldown(unit: UnitDefinition): number {
  return unit.spawnCooldownMs ?? COOLDOWN_BY_RARITY[unit.rarity];
}

// シーン上のユニットエンティティ
interface RealtimeUnit {
  instanceId: string;
  definitionId: string;
  side: 'player1' | 'player2';
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  lastX: number;  // 補間用
  targetX: number;
  lastHp: number;
  lastState?: NetworkUnitState['state'];
  hitstunTimer?: Phaser.Time.TimerEvent;
  deathTimer?: Phaser.Time.TimerEvent;
  isRemoving?: boolean;
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
  private allyCastleSprite!: Phaser.GameObjects.Image;
  private enemyCastleSprite!: Phaser.GameObjects.Image;
  private ground!: Phaser.GameObjects.Rectangle;
  private summonUi?: Phaser.GameObjects.Container;

  // UI
  private costText!: Phaser.GameObjects.Text;
  private costBarFill!: Phaser.GameObjects.Rectangle;
  private phaseText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private costUpBtnBg!: Phaser.GameObjects.Arc;
  private costUpBtnText!: Phaser.GameObjects.Text;
  private costUpBtnCostText!: Phaser.GameObjects.Text;
  private costUpBtnZone!: Phaser.GameObjects.Zone;
  private costUpPulse?: Phaser.Tweens.Tween;
  private bgm?: Phaser.Sound.BaseSound;
  private summonButtons: {
    unitId: string;
    cost: number;
    rarity: Rarity;
    bg: Phaser.GameObjects.Rectangle;
    icon?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    nameText: Phaser.GameObjects.Text;
    costTag: Phaser.GameObjects.Rectangle;
    costText: Phaser.GameObjects.Text;
    originalColor: number;
    cooldownOverlay: Phaser.GameObjects.Rectangle;
    cooldownText: Phaser.GameObjects.Text;
    cooldownDuration: number;
    buttonHeight: number;
  }[] = [];
  private unitCooldowns: Map<string, number> = new Map();
  private pendingAtlasLoads: Map<string, string> = new Map();
  private atlasLoadInFlight = false;

  // ユニット定義マップ
  private unitDefinitions: Map<string, UnitDefinition> = new Map();

  // 定数
  private readonly GROUND_Y = 470;
  private stageLength = 1200;
  private readonly CASTLE_PADDING = 80;
  private deckKey = '';
  private lastAllyCastleHp?: number;
  private lastEnemyCastleHp?: number;

  private readonly COST_UPGRADE_COSTS = [500, 1200, 2500, 4500, 8000, 12000, 20000];

  constructor() {
    super({ key: 'RealtimeBattleScene' });

    // ユニット定義をマップに格納
    allies.forEach(unit => {
      this.unitDefinitions.set(unit.id, {
        id: unit.id,
        name: unit.name,
        rarity: unit.rarity,
        cost: unit.cost,
        scale: unit.scale,
        spawnCooldownMs: unit.spawnCooldownMs,
      });
    });
  }

  init(data: RealtimeBattleSceneData) {
    this.networkManager = data.networkManager;
    this.deck = data.deck || [];
    this.deckKey = this.deck.join('|');
    this.onSummon = data.onSummon || (() => {});
    this.onUpgradeCost = data.onUpgradeCost || (() => {});

    // サーバーのステージ長を反映
    this.stageLength = this.networkManager?.getState().stageLength ?? 1200;

    // 前回のユニットをクリア
    this.units.clear();
    this.unitCooldowns.clear();

    console.log("[RealtimeBattleScene] init with deck:", this.deck);
    console.log("[RealtimeBattleScene] networkManager:", this.networkManager ? 'OK' : 'MISSING!');
  }

  preload() {
    // BGM
    this.load.audio('battle_bgm_1', '/assets/audio/bgm/battle_1.mp3');
    this.load.audio('battle_bgm_2', '/assets/audio/bgm/battle_2.mp3');
    this.load.audio('boss_bgm_1', '/assets/audio/bgm/boss_1.mp3');
    this.load.audio('boss_bgm_2', '/assets/audio/bgm/boss_2.mp3');
    this.load.audio('boss_bgm_3', '/assets/audio/bgm/boss_3.mp3');
    this.load.audio('victory_bgm', '/assets/audio/bgm/victory.mp3');
    this.load.audio('defeat_bgm', '/assets/audio/bgm/defeat.mp3');

    // 効果音
    this.load.audio('sfx_unit_spawn', '/assets/audio/sfx/unit_spawn.mp3');
    this.load.audio('sfx_unit_death', '/assets/audio/sfx/unit_death.mp3');
    this.load.audio('sfx_attack_hit', '/assets/audio/sfx/attack_hit.mp3');
    this.load.audio('sfx_attack_hit_sr', '/assets/audio/sfx/attack_hit_sr.mp3');
    this.load.audio('sfx_cannon_fire', '/assets/audio/sfx/cannon_fire.mp3');
    this.load.audio('sfx_cost_upgrade', '/assets/audio/sfx/cost_upgrade.mp3');

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
    // 既に進行中のフェーズを反映（BGM/表示の取りこぼし防止）
    this.handlePhaseChange(this.networkManager.getPhase());

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
    this.allyCastleSprite = this.add.image(0, 0, 'castle_ally');
    this.allyCastleSprite.setOrigin(0.5, 1);
    const allyScale = targetHeight / this.allyCastleSprite.height;
    this.allyCastleSprite.setScale(allyScale);
    this.allyCastle.add(this.allyCastleSprite);

    // 味方城HPバー
    const allyHpBg = this.add.rectangle(0, -this.allyCastleSprite.displayHeight - 20, 80, 10, 0x333333);
    this.allyCastleHpBar = this.add.rectangle(0, -this.allyCastleSprite.displayHeight - 20, 80, 10, 0x00ff00);
    this.allyCastle.add(allyHpBg);
    this.allyCastle.add(this.allyCastleHpBar);

    // 敵城（player2 = 右）
    this.enemyCastle = this.add.container(castlePositions.player2, this.GROUND_Y);
    this.enemyCastleSprite = this.add.image(0, 0, 'castle_enemy');
    this.enemyCastleSprite.setOrigin(0.5, 1);
    const enemyScale = targetHeight / this.enemyCastleSprite.height;
    this.enemyCastleSprite.setScale(enemyScale);
    this.enemyCastle.add(this.enemyCastleSprite);

    // 敵城HPバー
    const enemyHpBg = this.add.rectangle(0, -this.enemyCastleSprite.displayHeight - 20, 80, 10, 0x333333);
    this.enemyCastleHpBar = this.add.rectangle(0, -this.enemyCastleSprite.displayHeight - 20, 80, 10, 0xff0000);
    this.enemyCastle.add(enemyHpBg);
    this.enemyCastle.add(this.enemyCastleHpBar);
  }

  private layoutUnitVisuals(
    unit: RealtimeUnit,
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    def?: UnitDefinition
  ) {
    const targetHeight = 120;
    const customScale = def?.scale ?? 1.0;
    const baseScale = (targetHeight / sprite.height) * customScale;
    sprite.setScale(baseScale);
    sprite.setOrigin(0.5, 1);

    if (unit.side === 'player2') {
      sprite.setFlipX(true);
    }

    const barY = -sprite.displayHeight - 10;
    unit.hpBarBg.setY(barY);
    unit.hpBar.setY(barY);
    unit.nameText.setY(barY - 10);
  }

  private queueAtlasForUnit(unitId: string) {
    if (!ANIMATED_UNITS.includes(unitId as any)) return;
    const atlasKey = `${unitId}_atlas`;
    if (this.textures.exists(atlasKey) || this.pendingAtlasLoads.has(atlasKey)) return;
    this.pendingAtlasLoads.set(atlasKey, unitId);
  }

  private flushPendingAtlasLoads() {
    if (this.pendingAtlasLoads.size === 0 || this.atlasLoadInFlight) return;
    const batch = Array.from(this.pendingAtlasLoads.entries());
    this.pendingAtlasLoads.clear();
    batch.forEach(([atlasKey, unitId]) => {
      if (this.textures.exists(atlasKey)) return;
      const sheetPath = getSheetPath(unitId);
      this.load.atlas(atlasKey, sheetPath.image, sheetPath.json);
    });
    this.atlasLoadInFlight = true;
    this.load.once('complete', () => {
      this.atlasLoadInFlight = false;
      this.units.forEach(unit => {
        this.tryUpgradeUnitSprite(unit);
      });
      this.flushPendingAtlasLoads();
    });
    this.load.start();
  }

  private ensureUnitAnimations(unitId: string) {
    const atlasKey = `${unitId}_atlas`;
    if (!this.textures.exists(atlasKey)) return;

    const texture = this.textures.get(atlasKey);
    const idleFrame = `${unitId}_idle.png`;
    const idleKey = `${unitId}_idle`;
    if (texture.has(idleFrame) && !this.anims.exists(idleKey)) {
      this.anims.create({
        key: idleKey,
        frames: [{ key: atlasKey, frame: idleFrame }],
        frameRate: 1,
        repeat: -1,
      });
    }

    const buildFrames = (prefix: string, max: number) => {
      const frames: { key: string; frame: string }[] = [];
      for (let i = 1; i <= max; i += 1) {
        const frame = `${unitId}_${prefix}_${i}.png`;
        if (texture.has(frame)) {
          frames.push({ key: atlasKey, frame });
        }
      }
      return frames;
    };

    const walkKey = `${unitId}_walk`;
    if (!this.anims.exists(walkKey)) {
      const walkFrames = buildFrames('walk', 4);
      if (walkFrames.length >= 2) {
        this.anims.create({
          key: walkKey,
          frames: walkFrames,
          frameRate: 8,
          repeat: -1,
        });
      }
    }

    const attackKey = `${unitId}_attack`;
    if (!this.anims.exists(attackKey)) {
      const attackFrames = buildFrames('attack', 4);
      if (attackFrames.length >= 1) {
        this.anims.create({
          key: attackKey,
          frames: attackFrames,
          frameRate: 10,
          repeat: 0,
        });
      }
    }
  }

  private playUnitAnimationForState(unit: RealtimeUnit, state: NetworkUnitState['state']) {
    if (!(unit.sprite instanceof Phaser.GameObjects.Sprite)) return;
    const unitId = unit.definitionId;
    this.ensureUnitAnimations(unitId);

    const sprite = unit.sprite;
    const idleKey = `${unitId}_idle`;
    const walkKey = `${unitId}_walk`;
    const attackKey = `${unitId}_attack`;

    if (state !== 'HITSTUN' && sprite.anims.isPaused) {
      sprite.anims.resume();
    }

    const playIfExists = (key: string) => {
      if (!this.anims.exists(key)) return false;
      if (sprite.anims.currentAnim?.key === key) return true;
      sprite.play(key, true);
      return true;
    };

    switch (state) {
      case 'ATTACK_WINDUP':
      case 'ATTACK_COOLDOWN':
        if (!playIfExists(attackKey)) {
          playIfExists(idleKey);
        }
        break;
      case 'WALK':
        if (!playIfExists(walkKey)) {
          playIfExists(idleKey);
        }
        break;
      case 'SPAWN':
      case 'HITSTUN':
      case 'DIE':
      default:
        playIfExists(idleKey);
        break;
    }

    if (state === 'HITSTUN') {
      sprite.anims.pause();
    }
    if (state === 'DIE') {
      sprite.anims.stop();
    }
  }

  private applyStateVisuals(unit: RealtimeUnit, state: NetworkUnitState['state']) {
    if (state === 'DIE') {
      unit.sprite.setAlpha(0.3);
    } else {
      unit.sprite.setAlpha(1);
    }

    if (state === 'HITSTUN') {
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

  private playSfx(key: string, volume = 0.3) {
    if (!this.cache.audio.exists(key)) return;
    this.sound.play(key, { volume });
  }

  private getHitSfxKey(unitId: string) {
    const rarity = this.unitDefinitions.get(unitId)?.rarity;
    if (rarity === 'SR' || rarity === 'SSR' || rarity === 'UR') {
      return 'sfx_attack_hit_sr';
    }
    return 'sfx_attack_hit';
  }

  private tryUpgradeUnitSprite(unit: RealtimeUnit) {
    const unitId = unit.definitionId;
    const atlasKey = `${unitId}_atlas`;
    if (!this.textures.exists(atlasKey)) return;

    const texture = this.textures.get(atlasKey);
    const idleFrame = `${unitId}_idle.png`;
    if (!texture.has(idleFrame)) return;

    if (unit.sprite instanceof Phaser.GameObjects.Sprite && unit.sprite.texture.key === atlasKey) {
      this.ensureUnitAnimations(unitId);
      if (unit.lastState) {
        this.playUnitAnimationForState(unit, unit.lastState);
        this.applyStateVisuals(unit, unit.lastState);
      }
      return;
    }

    const newSprite = this.add.sprite(0, 0, atlasKey, idleFrame);
    const oldSprite = unit.sprite;
    unit.container.remove(oldSprite, true);
    unit.sprite = newSprite;
    unit.container.addAt(newSprite, 0);
    const def = this.unitDefinitions.get(unitId);
    this.layoutUnitVisuals(unit, newSprite, def);
    this.ensureUnitAnimations(unitId);
    if (unit.lastState) {
      this.playUnitAnimationForState(unit, unit.lastState);
      this.applyStateVisuals(unit, unit.lastState);
    }
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
    if (this.summonUi) {
      this.summonUi.destroy(true);
    }
    this.summonButtons = [];
    const summonUi = this.add.container(0, 0);
    this.summonUi = summonUi;

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
    summonUi.add(bar);

    this.deck.forEach((unitId, index) => {
      const x = startX + index * (buttonWidth + gap);
      const def = this.unitDefinitions.get(unitId);
      if (!def) return;
      const uiItems: Phaser.GameObjects.GameObject[] = [];

      // ボタン背景
      const bg = this.add.rectangle(x, buttonY, buttonWidth, buttonHeight, 0xf8e7b6);
      bg.setScrollFactor(0);
      bg.setDepth(100);
      bg.setInteractive({ useHandCursor: true });
      bg.setStrokeStyle(3, 0x3b2a1a);
      uiItems.push(bg);

      // ユニット画像
      let unitImg: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | undefined;
      if (this.textures.exists(unitId)) {
        unitImg = this.add.image(x, buttonY - 15, unitId);
        unitImg.setScrollFactor(0);
        unitImg.setDepth(101);
        // サイズ調整
        const scale = Math.min(60 / unitImg.width, 60 / unitImg.height);
        unitImg.setScale(scale * (def?.scale || 1));
        uiItems.push(unitImg);
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
      uiItems.push(nameText);

      // コスト表示
      const costTag = this.add.rectangle(x, buttonY + 43, 40, 16, 0xffcc00);
      costTag.setScrollFactor(0);
      costTag.setDepth(101);
      costTag.setStrokeStyle(1, 0x3b2a1a);
      uiItems.push(costTag);

      const costText = this.add.text(x, buttonY + 43, `¥${def?.cost || 0}`, {
        fontSize: '10px',
        color: '#3b2a1a',
        fontStyle: 'bold',
      });
      costText.setOrigin(0.5, 0.5);
      costText.setScrollFactor(0);
      costText.setDepth(102);
      uiItems.push(costText);

      // クールダウンオーバーレイ
      const cooldownOverlay = this.add.rectangle(x, buttonY - buttonHeight / 2 + 2, buttonWidth - 4, buttonHeight - 4, 0x000000, 0.75);
      cooldownOverlay.setOrigin(0.5, 0);
      cooldownOverlay.setScrollFactor(0);
      cooldownOverlay.setDepth(105);
      cooldownOverlay.setVisible(false);
      uiItems.push(cooldownOverlay);

      const cooldownText = this.add.text(x, buttonY - 10, '', {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      });
      cooldownText.setOrigin(0.5, 0.5);
      cooldownText.setScrollFactor(0);
      cooldownText.setDepth(106);
      cooldownText.setVisible(false);
      uiItems.push(cooldownText);

      this.summonButtons.push({
        unitId,
        cost: def.cost,
        rarity: def.rarity,
        bg,
        icon: unitImg,
        nameText,
        costTag,
        costText,
        originalColor: 0xf8e7b6,
        cooldownOverlay,
        cooldownText,
        cooldownDuration: getSpawnCooldown(def),
        buttonHeight,
      });

      // クリックで召喚
      bg.on('pointerdown', () => {
        if (!this.networkManager.isPlaying()) return;
        const myPlayer = this.networkManager.getMyPlayer();
        if (!myPlayer) return;
        const remainingCooldown = this.unitCooldowns.get(unitId) ?? 0;
        if (remainingCooldown > 0) return;
        if (myPlayer.cost < def.cost) return;
        this.unitCooldowns.set(unitId, getSpawnCooldown(def));
        this.playSfx('sfx_unit_spawn', 0.3);
        this.onSummon(unitId);
        this.updateSummonButtonsUI();
      });

      bg.on('pointerover', () => bg.setFillStyle(0xfff3cf));
      bg.on('pointerout', () => bg.setFillStyle(0xf8e7b6));

      summonUi.add(uiItems);
    });

    this.updateSummonButtonsUI();
  }

  private createUpgradeButton() {
    const { height } = this.scale;
    const buttonY = height - 85;
    const buttonX = this.scale.width - 60;
    const radius = 30;

    this.costUpBtnBg = this.add.circle(buttonX, buttonY, radius, 0xffe066);
    this.costUpBtnBg.setStrokeStyle(3, 0x3b2a1a);
    this.costUpBtnBg.setScrollFactor(0);
    this.costUpBtnBg.setDepth(100);

    this.costUpBtnText = this.add.text(buttonX, buttonY - 4, '⬆️', {
      fontSize: '24px',
    });
    this.costUpBtnText.setOrigin(0.5, 0.5);
    this.costUpBtnText.setScrollFactor(0);
    this.costUpBtnText.setDepth(101);

    this.costUpBtnCostText = this.add.text(buttonX, buttonY + 16, '¥0', {
      fontSize: '10px',
      color: '#3b2a1a',
      fontStyle: 'bold',
    });
    this.costUpBtnCostText.setOrigin(0.5, 0.5);
    this.costUpBtnCostText.setScrollFactor(0);
    this.costUpBtnCostText.setDepth(101);

    this.costUpBtnZone = this.add.zone(buttonX, buttonY, radius * 2 + 10, radius * 2 + 10);
    this.costUpBtnZone.setScrollFactor(0);
    this.costUpBtnZone.setDepth(102);
    this.costUpBtnZone.setInteractive({ useHandCursor: true });

    this.costUpBtnZone.on('pointerdown', () => {
      if (!this.networkManager.isPlaying()) return;
      const myPlayer = this.networkManager.getMyPlayer();
      if (!myPlayer) return;
      const levelIndex = Math.max(0, myPlayer.costLevel - 1);
      const upgradeCost = this.COST_UPGRADE_COSTS[levelIndex];
      if (upgradeCost === undefined || myPlayer.cost < upgradeCost) return;
      this.playSfx('sfx_cost_upgrade', 0.3);
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
      this.syncDeckFromPlayer();
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
        this.startBattleBgm();
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

      const levelIndex = Math.max(0, myPlayer.costLevel - 1);
      const upgradeCost = this.COST_UPGRADE_COSTS[levelIndex];
      if (upgradeCost === undefined) {
        this.costUpBtnCostText.setText('MAX');
        this.costUpBtnBg.setFillStyle(0xd7bf8a);
        this.costUpBtnZone.disableInteractive();
        if (this.costUpPulse) {
          this.costUpPulse.stop();
          this.costUpPulse = undefined;
        }
      } else {
        this.costUpBtnCostText.setText(`¥${upgradeCost}`);
        const canUpgrade = myPlayer.cost >= upgradeCost;
        this.costUpBtnBg.setFillStyle(canUpgrade ? 0xffe066 : 0xd7bf8a);
        if (canUpgrade) {
          this.costUpBtnZone.setInteractive({ useHandCursor: true });
          if (!this.costUpPulse) {
            this.costUpPulse = this.tweens.add({
              targets: [this.costUpBtnBg, this.costUpBtnText, this.costUpBtnCostText],
              scaleX: 1.1,
              scaleY: 1.1,
              duration: 400,
              yoyo: true,
              repeat: -1,
            });
          }
        } else {
          this.costUpBtnZone.disableInteractive();
          if (this.costUpPulse) {
            this.costUpPulse.stop();
            this.costUpPulse = undefined;
            this.costUpBtnBg.setScale(1);
            this.costUpBtnText.setScale(1);
            this.costUpBtnCostText.setScale(1);
          }
        }
      }

      // 自分の城HPバー更新
      const mySide = this.networkManager.getMySide();
      if (mySide === 'player1') {
        const hpRatio = myPlayer.maxCastleHp > 0 ? myPlayer.castleHp / myPlayer.maxCastleHp : 0;
        this.allyCastleHpBar.width = 80 * Phaser.Math.Clamp(hpRatio, 0, 1);
        this.lastAllyCastleHp = this.updateCastleDamage(
          this.allyCastle,
          this.allyCastleSprite,
          this.lastAllyCastleHp,
          myPlayer.castleHp
        );
      } else if (mySide === 'player2') {
        const hpRatio = myPlayer.maxCastleHp > 0 ? myPlayer.castleHp / myPlayer.maxCastleHp : 0;
        this.enemyCastleHpBar.width = 80 * Phaser.Math.Clamp(hpRatio, 0, 1);
        this.lastEnemyCastleHp = this.updateCastleDamage(
          this.enemyCastle,
          this.enemyCastleSprite,
          this.lastEnemyCastleHp,
          myPlayer.castleHp
        );
      }
    }

    if (opponent) {
      // 相手の城HPバー更新
      const mySide = this.networkManager.getMySide();
      if (mySide === 'player1') {
        const hpRatio = opponent.maxCastleHp > 0 ? opponent.castleHp / opponent.maxCastleHp : 0;
        this.enemyCastleHpBar.width = 80 * Phaser.Math.Clamp(hpRatio, 0, 1);
        this.lastEnemyCastleHp = this.updateCastleDamage(
          this.enemyCastle,
          this.enemyCastleSprite,
          this.lastEnemyCastleHp,
          opponent.castleHp
        );
      } else if (mySide === 'player2') {
        const hpRatio = opponent.maxCastleHp > 0 ? opponent.castleHp / opponent.maxCastleHp : 0;
        this.allyCastleHpBar.width = 80 * Phaser.Math.Clamp(hpRatio, 0, 1);
        this.lastAllyCastleHp = this.updateCastleDamage(
          this.allyCastle,
          this.allyCastleSprite,
          this.lastAllyCastleHp,
          opponent.castleHp
        );
      }
    }
  }

  private updateCooldowns(delta: number) {
    if (!this.networkManager.isPlaying()) return;
    if (this.unitCooldowns.size === 0) return;
    for (const [unitId, cooldown] of this.unitCooldowns.entries()) {
      if (cooldown > 0) {
        this.unitCooldowns.set(unitId, Math.max(0, cooldown - delta));
      }
    }
  }

  private updateSummonButtonsUI() {
    const myPlayer = this.networkManager.getMyPlayer();
    const currentCost = myPlayer ? myPlayer.cost : 0;
    const now = this.time.now;

    this.summonButtons.forEach(btn => {
      const remainingCooldown = this.unitCooldowns.get(btn.unitId) ?? 0;
      const isOnCooldown = remainingCooldown > 0;
      const canAfford = currentCost >= btn.cost;
      const canSummon = canAfford && !isOnCooldown;

      if (isOnCooldown && btn.cooldownDuration > 0) {
        const remainingSec = Math.ceil(remainingCooldown / 1000);
        const progress = remainingCooldown / btn.cooldownDuration;
        const maxHeight = btn.buttonHeight - 4;
        btn.cooldownOverlay.setVisible(true);
        btn.cooldownOverlay.height = maxHeight * progress;
        const alpha = 0.3 + (progress * 0.45);
        btn.cooldownOverlay.setAlpha(alpha);
        btn.cooldownText.setVisible(true);
        btn.cooldownText.setText(`${remainingSec}s`);
        if (remainingSec <= 1) {
          btn.cooldownText.setAlpha(now % 200 < 100 ? 1 : 0.5);
        } else {
          btn.cooldownText.setAlpha(1);
        }
      } else {
        btn.cooldownOverlay.setVisible(false);
        btn.cooldownText.setVisible(false);
      }

      if (canSummon) {
        btn.bg.setFillStyle(btn.originalColor);
        btn.bg.setAlpha(1);
        if (btn.icon) {
          btn.icon.clearTint();
          btn.icon.setAlpha(1);
        }
      } else {
        btn.bg.setFillStyle(0x888888);
        btn.bg.setAlpha(0.8);
        if (btn.icon) {
          btn.icon.setTint(0x555555);
          btn.icon.setAlpha(0.7);
        }
      }
    });
  }

  private createUnit(unitState: NetworkUnitState) {
    if (this.units.has(unitState.instanceId)) return;

    const def = this.unitDefinitions.get(unitState.definitionId);
    const container = this.add.container(unitState.x, this.GROUND_Y);

    // スプライト
    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    const atlasKey = `${unitState.definitionId}_atlas`;

    this.queueAtlasForUnit(unitState.definitionId);
    this.flushPendingAtlasLoads();

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

    const realtimeUnit: RealtimeUnit = {
      instanceId: unitState.instanceId,
      definitionId: unitState.definitionId,
      side: unitState.side,
      container,
      sprite,
      hpBar,
      hpBarBg,
      nameText,
      lastX: unitState.x,
      targetX: unitState.x,
      lastHp: unitState.hp,
      lastState: unitState.state,
    };

    this.layoutUnitVisuals(realtimeUnit, sprite, def);

    this.units.set(unitState.instanceId, realtimeUnit);

    this.ensureUnitAnimations(unitState.definitionId);
    this.playUnitAnimationForState(realtimeUnit, unitState.state);

  }

  private updateUnit(unitState: NetworkUnitState) {
    const unit = this.units.get(unitState.instanceId);
    if (!unit) return;

    if ((unitState.hp <= 0 || unitState.state === 'DIE') && !unit.isRemoving && !unit.deathTimer) {
      if (unit.lastState !== 'DIE') {
        this.playSfx('sfx_unit_death', 0.3);
      }
      unit.deathTimer = this.time.delayedCall(200, () => {
        this.removeUnit(unitState.instanceId);
      });
    }

    // 位置補間のターゲット更新
    unit.lastX = unit.container.x;
    unit.targetX = unitState.x;

    // HP更新
    const hpRatioRaw = unitState.maxHp > 0 ? unitState.hp / unitState.maxHp : 0;
    const hpRatio = Phaser.Math.Clamp(hpRatioRaw, 0, 1);
    unit.hpBar.width = 50 * hpRatio;

    if (unitState.hp < unit.lastHp) {
      const damage = Math.max(0, unit.lastHp - unitState.hp);
      if (damage > 0) {
        this.playSfx(this.getHitSfxKey(unit.definitionId), 0.25);
        this.showDamageNumber(unit.container.x, unit.container.y - unit.sprite.displayHeight - 20, damage);
      }
    }
    unit.lastHp = unitState.hp;

    // HP色
    if (hpRatio > 0.6) {
      unit.hpBar.setFillStyle(0x00ff00);
    } else if (hpRatio > 0.3) {
      unit.hpBar.setFillStyle(0xffff00);
    } else {
      unit.hpBar.setFillStyle(0xff0000);
    }

    // 状態に応じた見た目
    const prevState = unit.lastState;
    unit.lastState = unitState.state;
    if (prevState !== unitState.state) {
      this.playUnitAnimationForState(unit, unitState.state);
    }
    this.applyStateVisuals(unit, unitState.state);
  }

  private removeUnit(instanceId: string) {
    const unit = this.units.get(instanceId);
    if (!unit || unit.isRemoving) return;
    unit.isRemoving = true;

    // フェードアウト
    if (unit.hitstunTimer) {
      unit.hitstunTimer.remove(false);
      unit.hitstunTimer = undefined;
    }
    if (unit.deathTimer) {
      unit.deathTimer.remove(false);
      unit.deathTimer = undefined;
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

  private showDamageNumber(x: number, y: number, damage: number) {
    const text = this.add.text(x, y, `-${damage}`, {
      fontSize: '16px',
      color: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    });
    text.setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => text.destroy(),
    });
  }

  private updateCastleDamage(
    castle: Phaser.GameObjects.Container,
    sprite: Phaser.GameObjects.Image,
    prevHp: number | undefined,
    nextHp: number
  ): number {
    if (typeof prevHp === 'number' && nextHp < prevHp) {
      const damage = prevHp - nextHp;
      if (damage > 0) {
        this.playSfx('sfx_attack_hit', 0.25);
        this.tweens.add({
          targets: sprite,
          scaleX: sprite.scaleX * 0.9,
          scaleY: sprite.scaleY * 0.9,
          duration: 100,
          yoyo: true,
        });
        sprite.setTint(0xff0000);
        this.time.delayedCall(100, () => {
          sprite.clearTint();
        });
        this.showDamageNumber(castle.x, castle.y - sprite.displayHeight - 50, damage);
      }
    }
    return nextHp;
  }

  private handleGameOver(isWinner: boolean, reason: string) {
    const { width, height } = this.scale;

    // BGM停止して結果BGM再生
    this.bgm?.stop();
    const resultBgmKey = isWinner ? 'victory_bgm' : 'defeat_bgm';
    if (this.cache.audio.exists(resultBgmKey)) {
      const resultBgm = this.sound.add(resultBgmKey, { volume: 0.5 });
      resultBgm.play();
    }

    this.phaseText.setVisible(true);
    this.phaseText.setText(isWinner ? '🎉 勝利！' : '💀 敗北...');
    this.phaseText.setY(height / 2 - 50);
    this.phaseText.setFontSize(52);
    this.phaseText.setColor(isWinner ? '#ffff00' : '#ff0000');

    const opponentName = this.networkManager.getOpponent()?.displayName || 'Opponent';
    const resultDetail = this.add.text(width / 2, height / 2 + 6,
      `${opponentName}に${isWinner ? '勝ちました' : '負けました'}`,
      {
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      }
    );
    resultDetail.setOrigin(0.5, 0.5);
    resultDetail.setScrollFactor(0);
    resultDetail.setDepth(200);

    const reasonText = this.add.text(width / 2, height / 2 + 46,
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

  private startBattleBgm() {
    if (this.bgm) return;
    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        if (this.networkManager.isPlaying()) {
          this.startBattleBgm();
        }
      });
      return;
    }
    const bgmKey = Math.random() < 0.5 ? 'battle_bgm_1' : 'battle_bgm_2';
    if (this.cache.audio.exists(bgmKey)) {
      this.bgm = this.sound.add(bgmKey, { loop: true, volume: 0.3 });
      this.bgm.play();
    }
  }

  private syncDeckFromPlayer() {
    const myPlayer = this.networkManager.getMyPlayer();
    if (!myPlayer || !Array.isArray(myPlayer.deck)) return;
    const nextDeck = myPlayer.deck.filter(Boolean);
    const nextKey = nextDeck.join('|');
    if (nextKey === this.deckKey) return;
    this.deck = nextDeck;
    this.deckKey = nextKey;
    this.createSummonButtons();
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

    // クールダウン更新 & ボタンUI更新
    this.updateCooldowns(delta);
    this.updateSummonButtonsUI();
  }

  shutdown() {
    // イベントリスナー削除
    this.networkManager.removeAllListeners();
    this.units.clear();
    this.bgm?.stop();
  }
}
