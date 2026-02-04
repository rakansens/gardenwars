import Phaser from 'phaser';
import { eventBus, GameEvents } from '../utils/EventBus';
import { generateQuestions, getQuestionText } from '../systems/MathQuestionGenerator';
import { getSpritePath, getSheetPath, hasAnimation } from '@/lib/sprites';
import { getSfxVolume } from '@/lib/audioHelper';
import { getGameLanguage } from '@/lib/gameTranslations';
import type { MathBattleStageDefinition, MathQuestion, UnitDefinition, MathOperationType } from '@/data/types';

// MathBattle専用の翻訳
const MATH_BATTLE_TRANSLATIONS = {
  en: {
    player: 'Player',
    question: 'Question',
    victory: 'Victory!',
    defeat: 'Defeat...',
    missCount: 'Misses',
    time: 'Time',
  },
  ja: {
    player: 'プレイヤー',
    question: '問題',
    victory: '勝利！',
    defeat: '敗北...',
    missCount: 'ミス',
    time: '時間',
  },
};

function getMathBattleText(key: keyof typeof MATH_BATTLE_TRANSLATIONS.en): string {
  const lang = getGameLanguage() === 'ja' ? 'ja' : 'en';
  return MATH_BATTLE_TRANSLATIONS[lang][key];
}

// ステージ番号から背景画像パスを取得
function getStageBackgroundPath(stageNumber: number, isBoss: boolean): string {
  if (isBoss) {
    // ボスステージ用画像 (2-5の範囲でサイクル)
    const bossIndex = ((stageNumber - 1) % 4) + 2;
    return `/assets/stages/boss_stage_${bossIndex}.webp`;
  }
  // 通常ステージ用画像 (1-20の範囲でサイクル)
  const stageIndex = ((stageNumber - 1) % 20) + 1;
  return `/assets/stages/stage_${stageIndex}.webp`;
}

// ============================================
// MathBattleScene - 算数バトルシーン
// ============================================

export interface MathBattleSceneData {
  stage: MathBattleStageDefinition;
  playerUnit: UnitDefinition;
  enemyUnit: UnitDefinition;
  operationType: MathOperationType;
}

type BattleStatus = 'ready' | 'countdown' | 'playing' | 'win' | 'lose';

export class MathBattleScene extends Phaser.Scene {
  // ゲームデータ
  private stageData!: MathBattleStageDefinition;
  private playerUnitData!: UnitDefinition;
  private enemyUnitData!: UnitDefinition;
  private operationType!: MathOperationType;

  // ゲーム状態
  private status: BattleStatus = 'ready';
  private questions: MathQuestion[] = [];
  private currentQuestionIndex: number = 0;
  private playerHp: number = 100;
  private playerMaxHp: number = 100;
  private enemyHp: number = 100;
  private enemyMaxHp: number = 100;
  private missCount: number = 0;
  private timeRemaining: number = 0;
  private totalTime: number = 0;
  private timerEvent?: Phaser.Time.TimerEvent;

  // スプライト
  private playerSprite?: Phaser.GameObjects.Sprite;
  private enemySprite?: Phaser.GameObjects.Sprite;

  // UI要素
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBarBg!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBarBg!: Phaser.GameObjects.Rectangle;
  private timerText!: Phaser.GameObjects.Text;
  private questionText!: Phaser.GameObjects.Text;
  private questionCountText!: Phaser.GameObjects.Text;
  private choiceButtons: Phaser.GameObjects.Container[] = [];
  private countdownText?: Phaser.GameObjects.Text;
  private resultContainer?: Phaser.GameObjects.Container;

  // 背景画像
  private backgroundImage?: Phaser.GameObjects.Image;
  private backgroundKey: string = '';

  // 定数
  private readonly SCREEN_WIDTH = 800;
  private readonly SCREEN_HEIGHT = 600;
  private readonly PLAYER_DAMAGE = 20; // 不正解時のプレイヤーダメージ
  private readonly ENEMY_DAMAGE_BASE = 20; // 正解時の敵ダメージ基本値

  constructor() {
    super({ key: 'MathBattleScene' });
  }

  init(data: MathBattleSceneData) {
    this.stageData = data.stage;
    this.playerUnitData = data.playerUnit;
    this.enemyUnitData = data.enemyUnit;
    this.operationType = data.operationType;

    // 状態リセット
    this.status = 'ready';
    this.currentQuestionIndex = 0;
    this.missCount = 0;
    this.totalTime = 0;

    // HP設定
    // 敵HPは問題数×ダメージで計算（全問正解で敵を倒せるように）
    // ボスは+1問分のHPを追加
    this.playerMaxHp = 100;
    this.playerHp = 100;
    const baseEnemyHp = this.stageData.questionCount * this.ENEMY_DAMAGE_BASE;
    const bossBonus = this.stageData.isBoss ? this.ENEMY_DAMAGE_BASE : 0;
    this.enemyMaxHp = baseEnemyHp + bossBonus;
    this.enemyHp = this.enemyMaxHp;

    // 問題生成
    this.questions = generateQuestions(
      this.operationType,
      this.stageData.difficulty,
      this.stageData.questionCount
    );
  }

  preload() {
    // 効果音をロード
    this.load.audio('correct', '/assets/audio/sfx/correct.mp3');
    this.load.audio('wrong', '/assets/audio/sfx/wrong.mp3');
    this.load.audio('hit', '/assets/audio/sfx/hit.mp3');
    this.load.audio('win', '/assets/audio/sfx/win.mp3');
    this.load.audio('lose', '/assets/audio/sfx/lose.mp3');

    // 背景画像をロード
    const bgPath = getStageBackgroundPath(this.stageData.stageNumber, this.stageData.isBoss);
    this.backgroundKey = `bg_stage_${this.stageData.stageNumber}`;
    if (!this.textures.exists(this.backgroundKey)) {
      this.load.image(this.backgroundKey, bgPath);
    }

    // プレイヤーユニットのスプライトをロード
    this.loadUnitSprite(this.playerUnitData);
    // 敵ユニットのスプライトをロード
    this.loadUnitSprite(this.enemyUnitData);
  }

  private loadUnitSprite(unit: UnitDefinition) {
    const atlasKey = unit.atlasKey || unit.id;
    const baseId = unit.baseUnitId || unit.id;

    if (hasAnimation(baseId)) {
      const sheetPath = getSheetPath(baseId);
      if (!this.textures.exists(atlasKey)) {
        this.load.atlas(atlasKey, sheetPath.image, sheetPath.json);
      }
    } else {
      // ボスのbaseUnitIdはbossesフォルダにある
      let imagePath: string;
      if (unit.isBoss && unit.baseUnitId) {
        imagePath = `/assets/sprites/bosses/${unit.baseUnitId}.webp`;
      } else {
        // 通常ユニット・敵はgetSpritePathでrarityを渡す
        imagePath = getSpritePath(baseId, unit.rarity);
      }
      if (!this.textures.exists(atlasKey)) {
        this.load.image(atlasKey, imagePath);
      }
    }
  }

  create() {
    // 背景画像を表示
    if (this.textures.exists(this.backgroundKey)) {
      this.backgroundImage = this.add.image(
        this.SCREEN_WIDTH / 2,
        this.SCREEN_HEIGHT / 2,
        this.backgroundKey
      );
      // 画面全体を覆うようにスケール
      const scaleX = this.SCREEN_WIDTH / this.backgroundImage.width;
      const scaleY = this.SCREEN_HEIGHT / this.backgroundImage.height;
      const scale = Math.max(scaleX, scaleY);
      this.backgroundImage.setScale(scale);
      this.backgroundImage.setDepth(-10);

      // 暗いオーバーレイを追加して見やすくする
      const overlay = this.add.rectangle(
        this.SCREEN_WIDTH / 2,
        this.SCREEN_HEIGHT / 2,
        this.SCREEN_WIDTH,
        this.SCREEN_HEIGHT,
        0x000000,
        0.3
      );
      overlay.setDepth(-9);
    } else {
      // フォールバック: 単色背景
      this.cameras.main.setBackgroundColor('#2d5a27');
    }

    // 地面（半透明にして背景を活かす）
    const ground = this.add.rectangle(
      this.SCREEN_WIDTH / 2,
      this.SCREEN_HEIGHT - 50,
      this.SCREEN_WIDTH,
      100,
      0x000000,
      0.4
    );
    ground.setDepth(-8);

    // UIを作成
    this.createHpBars();
    this.createTimer();
    this.createQuestionArea();
    this.createSprites();

    // カウントダウン開始
    this.startCountdown();
  }

  private createHpBars() {
    const barWidth = 150;
    const barHeight = 20;
    const yPos = 50;

    // プレイヤーHPバー（左側）
    this.playerHpBarBg = this.add.rectangle(100, yPos, barWidth, barHeight, 0x333333);
    this.playerHpBar = this.add.rectangle(100, yPos, barWidth, barHeight, 0x44ff44);

    // プレイヤーラベル
    this.add.text(100, yPos - 25, getMathBattleText('player'), {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 敵HPバー（右側）
    this.enemyHpBarBg = this.add.rectangle(this.SCREEN_WIDTH - 100, yPos, barWidth, barHeight, 0x333333);
    this.enemyHpBar = this.add.rectangle(this.SCREEN_WIDTH - 100, yPos, barWidth, barHeight, 0xff4444);

    // 敵ラベル
    this.add.text(this.SCREEN_WIDTH - 100, yPos - 25, this.enemyUnitData.name, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  private createTimer() {
    // ヘッダーと重ならないように下に配置
    this.timerText = this.add.text(this.SCREEN_WIDTH / 2, 90, '', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private createQuestionArea() {
    // 問題カウンター（タイマーの下）
    this.questionCountText = this.add.text(this.SCREEN_WIDTH / 2, 130, '', {
      fontSize: '18px',
      color: '#cccccc',
    }).setOrigin(0.5);

    // 問題テキスト
    this.questionText = this.add.text(this.SCREEN_WIDTH / 2, 380, '', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 選択肢ボタン（4つ）
    this.createChoiceButtons();
  }

  private createChoiceButtons() {
    const buttonWidth = 150;
    const buttonHeight = 60;
    const spacing = 20;
    const startX = (this.SCREEN_WIDTH - (buttonWidth * 4 + spacing * 3)) / 2 + buttonWidth / 2;
    const yPos = 480;

    for (let i = 0; i < 4; i++) {
      const x = startX + i * (buttonWidth + spacing);
      const container = this.add.container(x, yPos);

      const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x4488cc, 1)
        .setStrokeStyle(3, 0xffffff);
      const text = this.add.text(0, 0, '', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      container.add([bg, text]);
      container.setSize(buttonWidth, buttonHeight);
      container.setInteractive({ useHandCursor: true });

      container.on('pointerover', () => {
        if (this.status === 'playing') {
          bg.setFillStyle(0x66aaee);
        }
      });

      container.on('pointerout', () => {
        if (this.status === 'playing') {
          bg.setFillStyle(0x4488cc);
        }
      });

      container.on('pointerdown', () => {
        if (this.status === 'playing') {
          this.handleAnswer(i);
        }
      });

      this.choiceButtons.push(container);
    }
  }

  private createSprites() {
    // スプライトを問題エリアより上に配置（HPバーの下、問題の上）
    // 巨大キャラでも見えるように下げる（元: 280）
    const groundY = 340;
    // スプライトが上に伸びすぎないように最大高さを制限
    const maxSpriteHeight = 230; // groundY(340) - minTop(110) = 230

    // プレイヤースプライト（左側）
    const playerAtlas = this.playerUnitData.atlasKey || this.playerUnitData.id;
    const playerBaseId = this.playerUnitData.baseUnitId || this.playerUnitData.id;

    if (this.textures.exists(playerAtlas)) {
      // 初期フレームをidleに設定
      const playerIdleFrame = `${playerBaseId}_idle.png`;
      const texture = this.textures.get(playerAtlas);
      const initialFrame = texture?.has(playerIdleFrame) ? playerIdleFrame : undefined;

      this.playerSprite = this.add.sprite(150, groundY, playerAtlas, initialFrame);

      if (hasAnimation(playerBaseId)) {
        this.setupAnimation(this.playerSprite, playerAtlas, this.playerUnitData);
        // idleアニメーション再生を試みる（失敗しても無視）
        this.safePlayAnimation(this.playerSprite, `${playerAtlas}_idle`);
      }

      // スケール（目標の高さに合わせて動的計算 + ユニットのscale倍率を適用）
      const isAnimated = hasAnimation(playerBaseId);
      const targetHeight = isAnimated ? 150 : 120; // 目標の表示高さ
      const spriteHeight = this.playerSprite.height;
      const customScale = this.playerUnitData.scale ?? 1.0; // ユニット固有のスケール倍率
      const baseScale = spriteHeight > 0 ? targetHeight / spriteHeight : 0.35;
      let finalScale = baseScale * customScale;
      // 巨大キャラでも画面内に収まるようにスケールを制限
      const actualHeight = spriteHeight * finalScale;
      if (actualHeight > maxSpriteHeight) {
        finalScale = maxSpriteHeight / spriteHeight;
      }
      this.playerSprite.setScale(finalScale);
      this.playerSprite.setOrigin(0.5, 1);
    }

    // 敵スプライト（右側）
    const enemyAtlas = this.enemyUnitData.atlasKey || this.enemyUnitData.id;
    const enemyBaseId = this.enemyUnitData.baseUnitId || this.enemyUnitData.id;

    if (this.textures.exists(enemyAtlas)) {
      // 初期フレームをidleに設定
      const enemyIdleFrame = `${enemyBaseId}_idle.png`;
      const texture = this.textures.get(enemyAtlas);
      const initialFrame = texture?.has(enemyIdleFrame) ? enemyIdleFrame : undefined;

      this.enemySprite = this.add.sprite(this.SCREEN_WIDTH - 150, groundY, enemyAtlas, initialFrame);

      if (hasAnimation(enemyBaseId)) {
        this.setupAnimation(this.enemySprite, enemyAtlas, this.enemyUnitData);
        // idleアニメーション再生を試みる（失敗しても無視）
        this.safePlayAnimation(this.enemySprite, `${enemyAtlas}_idle`);
      }

      // スケール（目標の高さに合わせて動的計算 + ユニットのscale倍率を適用、ボスは大きめ）
      const isAnimated = hasAnimation(enemyBaseId);
      const baseTargetHeight = this.stageData.isBoss ? 180 : 120;
      const targetHeight = isAnimated ? baseTargetHeight * 1.2 : baseTargetHeight;
      const spriteHeight = this.enemySprite.height;
      const customScale = this.enemyUnitData.scale ?? 1.0; // ユニット固有のスケール倍率
      const baseScale = spriteHeight > 0 ? targetHeight / spriteHeight : 0.15;
      let finalScale = baseScale * customScale;
      // 巨大キャラでも画面内に収まるようにスケールを制限
      const actualHeight = spriteHeight * finalScale;
      if (actualHeight > maxSpriteHeight) {
        finalScale = maxSpriteHeight / spriteHeight;
      }
      this.enemySprite.setScale(finalScale);
      this.enemySprite.setOrigin(0.5, 1);
      // 敵は左向きにする
      // flipSprite=true: 敵スプライトは既に左向きで描画 → 反転不要
      // flipSprite=false/undefined: 右向きスプライト → 反転して左向きに
      this.enemySprite.setFlipX(!this.enemyUnitData.flipSprite);
    }
  }

  // アニメーション再生を安全に行う（エラーを無視）
  private safePlayAnimation(sprite: Phaser.GameObjects.Sprite, animKey: string) {
    try {
      if (this.anims.exists(animKey)) {
        const anim = this.anims.get(animKey);
        if (anim && anim.frames && anim.frames.length > 0) {
          sprite.play(animKey);
          return;
        }
      }
      // アニメーションがない場合、idleフレームを直接表示
      if (animKey.endsWith('_idle')) {
        const atlasKey = sprite.texture.key;
        const baseId = atlasKey; // atlasKeyがbaseIdと同じ
        const idleFrame = `${baseId}_idle.png`;
        if (this.textures.get(atlasKey)?.has(idleFrame)) {
          sprite.setFrame(idleFrame);
        }
      }
    } catch {
      // アニメーション再生に失敗しても無視（静止画として表示）
    }
  }

  private setupAnimation(sprite: Phaser.GameObjects.Sprite, atlasKey: string, unit: UnitDefinition) {
    const baseId = unit.baseUnitId || unit.id;
    const animKeys = unit.animKeys || { idle: 'idle', walk: 'walk', attack: 'attack', die: 'die' };

    const animations = [
      { key: `${atlasKey}_idle`, animType: animKeys.idle, repeat: -1, frameRate: 8, isSingleFrame: true },
      { key: `${atlasKey}_walk`, animType: animKeys.walk, repeat: -1, frameRate: 10, isSingleFrame: false },
      { key: `${atlasKey}_attack`, animType: animKeys.attack, repeat: 0, frameRate: 12, isSingleFrame: false },
    ];

    if (animKeys.die) {
      animations.push({ key: `${atlasKey}_die`, animType: animKeys.die, repeat: 0, frameRate: 8, isSingleFrame: false });
    }

    const texture = this.textures.get(atlasKey);
    if (!texture) return;

    animations.forEach(anim => {
      if (!this.anims.exists(anim.key)) {
        try {
          // 単一フレームの場合（例: cat_warrior_idle.png）
          const singleFrameName = `${baseId}_${anim.animType}.png`;
          if (anim.isSingleFrame && texture.has(singleFrameName)) {
            this.anims.create({
              key: anim.key,
              frames: [{ key: atlasKey, frame: singleFrameName }],
              frameRate: anim.frameRate,
              repeat: anim.repeat,
            });
            return;
          }

          // 複数フレームの場合（例: cat_warrior_attack_1.png, cat_warrior_attack_2.png...）
          const frameCount = this.getFrameCount(atlasKey, baseId, anim.animType);
          if (frameCount > 0) {
            const frames: Phaser.Types.Animations.AnimationFrame[] = [];
            for (let i = 1; i <= frameCount; i++) {
              frames.push({ key: atlasKey, frame: `${baseId}_${anim.animType}_${i}.png` });
            }
            this.anims.create({
              key: anim.key,
              frames: frames,
              frameRate: anim.frameRate,
              repeat: anim.repeat,
            });
          }
        } catch {
          // フレームがない場合は無視
        }
      }
    });
  }

  private getFrameCount(atlasKey: string, baseId: string, animType: string): number {
    const texture = this.textures.get(atlasKey);
    if (!texture) return 0;

    let count = 0;
    // フレーム名形式: {baseId}_{animType}_{n}.png (1から始まる)
    for (let i = 1; i <= 20; i++) {
      if (texture.has(`${baseId}_${animType}_${i}.png`)) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private startCountdown() {
    this.status = 'countdown';

    this.countdownText = this.add.text(this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2, '3', {
      fontSize: '120px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    let count = 3;

    const showCount = () => {
      if (this.countdownText) {
        this.countdownText.setText(count === 0 ? 'START!' : String(count));
        this.countdownText.setAlpha(1);
        this.countdownText.setScale(1.5);

        this.tweens.add({
          targets: this.countdownText,
          scale: 1,
          alpha: 0,
          duration: 800,
          ease: 'Power2',
          onComplete: () => {
            if (count > 0) {
              count--;
              this.time.delayedCall(200, showCount);
            } else {
              this.countdownText?.destroy();
              this.countdownText = undefined;
              this.startBattle();
            }
          },
        });
      }
    };

    showCount();
  }

  private startBattle() {
    this.status = 'playing';

    // ステージ全体のタイマーを開始（1回だけ）
    this.timeRemaining = this.stageData.timeLimitMs;
    this.updateTimerDisplay();

    this.timerEvent = this.time.addEvent({
      delay: 100,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true,
    });

    this.showQuestion();
  }

  private showQuestion() {
    // バトルが既に終了している場合は何もしない
    if (this.status === 'win' || this.status === 'lose') {
      return;
    }

    if (this.currentQuestionIndex >= this.questions.length) {
      // 全問終了 → 敵HPで勝敗判定
      // 敵を倒していれば勝利、そうでなければ敗北
      const isWin = this.enemyHp <= 0;
      this.endBattle(isWin);
      return;
    }

    const question = this.questions[this.currentQuestionIndex];

    // 問題テキストを更新
    this.questionCountText.setText(
      `${getMathBattleText('question')} ${this.currentQuestionIndex + 1}/${this.questions.length}`
    );
    this.questionText.setText(getQuestionText(question));

    // 選択肢を更新
    question.choices.forEach((choice, i) => {
      const container = this.choiceButtons[i];
      const text = container.getAt(1) as Phaser.GameObjects.Text;
      const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
      text.setText(String(choice));
      bg.setFillStyle(0x4488cc);
      container.setAlpha(1);
      container.setInteractive();
    });
    // タイマーはstartBattle()で既に開始済み（ステージ全体で1つ）
  }

  private updateTimer() {
    this.timeRemaining -= 100;
    this.totalTime += 100;
    this.updateTimerDisplay();

    if (this.timeRemaining <= 0) {
      // 時間切れ → 敗北
      this.timerEvent?.destroy();
      this.timerEvent = undefined;
      this.endBattle(false);
    }
  }

  private updateTimerDisplay() {
    const seconds = Math.ceil(this.timeRemaining / 1000);
    this.timerText.setText(String(seconds));

    // 残り時間が少ないと赤くなる
    if (seconds <= 3) {
      this.timerText.setColor('#ff4444');
    } else {
      this.timerText.setColor('#ffffff');
    }

    // イベント発火
    eventBus.emit(GameEvents.MATH_BATTLE_TIMER, this.timeRemaining);
  }

  private handleAnswer(choiceIndex: number) {
    // バトル中以外は無視（終了後の誤操作防止）
    if (this.status !== 'playing') {
      return;
    }

    // タイマーはステージ全体で継続（stopしない）

    const question = this.questions[this.currentQuestionIndex];
    const isCorrect = choiceIndex >= 0 && question.choices[choiceIndex] === question.answer;

    // 選択肢を無効化
    this.choiceButtons.forEach(btn => btn.disableInteractive());

    if (isCorrect) {
      this.onCorrectAnswer(choiceIndex);
    } else {
      this.onWrongAnswer(choiceIndex);
    }
  }

  private onCorrectAnswer(choiceIndex: number) {
    // 正解の効果音
    this.playSound('correct');

    // ボタンを緑に
    const container = this.choiceButtons[choiceIndex];
    const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
    bg.setFillStyle(0x44ff44);

    // プレイヤー攻撃アニメーション
    this.playAttackAnimation(this.playerSprite, true);

    // 敵にダメージ
    const damage = this.ENEMY_DAMAGE_BASE;
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    this.updateHpBars();

    // ダメージエフェクト
    this.showDamageEffect(this.enemySprite, damage);

    // 敵HP確認
    if (this.enemyHp <= 0) {
      this.time.delayedCall(500, () => this.endBattle(true));
      return;
    }

    // 次の問題へ
    this.time.delayedCall(800, () => {
      this.currentQuestionIndex++;
      this.showQuestion();
    });

    eventBus.emit(GameEvents.MATH_BATTLE_ANSWER, { correct: true, question: this.currentQuestionIndex });
  }

  private onWrongAnswer(choiceIndex: number) {
    // 不正解の効果音
    this.playSound('wrong');

    this.missCount++;

    // 正解を表示
    const question = this.questions[this.currentQuestionIndex];
    question.choices.forEach((choice, i) => {
      const container = this.choiceButtons[i];
      const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
      if (choice === question.answer) {
        bg.setFillStyle(0x44ff44);
      } else if (i === choiceIndex) {
        bg.setFillStyle(0xff4444);
      }
    });

    // 敵攻撃アニメーション
    this.playAttackAnimation(this.enemySprite, false);

    // プレイヤーにダメージ
    this.playerHp = Math.max(0, this.playerHp - this.PLAYER_DAMAGE);
    this.updateHpBars();

    // ダメージエフェクト
    this.showDamageEffect(this.playerSprite, this.PLAYER_DAMAGE);

    // プレイヤーHP確認
    if (this.playerHp <= 0) {
      this.time.delayedCall(500, () => this.endBattle(false));
      return;
    }

    // 次の問題へ
    this.time.delayedCall(1000, () => {
      this.currentQuestionIndex++;
      this.showQuestion();
    });

    eventBus.emit(GameEvents.MATH_BATTLE_ANSWER, { correct: false, question: this.currentQuestionIndex });
  }

  private playAttackAnimation(sprite: Phaser.GameObjects.Sprite | undefined, isPlayer: boolean) {
    if (!sprite) return;

    const atlasKey = isPlayer
      ? (this.playerUnitData.atlasKey || this.playerUnitData.id)
      : (this.enemyUnitData.atlasKey || this.enemyUnitData.id);

    const baseId = isPlayer
      ? (this.playerUnitData.baseUnitId || this.playerUnitData.id)
      : (this.enemyUnitData.baseUnitId || this.enemyUnitData.id);

    const originalX = sprite.x;
    const moveDistance = isPlayer ? 80 : -80;

    // 攻撃開始時にスプライトを明るくする
    sprite.setTint(0xffffff);
    this.tweens.add({
      targets: sprite,
      alpha: { from: 1.0, to: 0.8 },  // フラッシュ効果（alpha > 1.0は無効なので修正）
      duration: 100,
      yoyo: true,
    });

    // アニメーション再生を試みる
    let animPlayed = false;
    if (hasAnimation(baseId)) {
      try {
        const attackAnimKey = `${atlasKey}_attack`;
        if (this.anims.exists(attackAnimKey)) {
          const anim = this.anims.get(attackAnimKey);
          if (anim && anim.frames && anim.frames.length > 0) {
            // 前に踏み込んでから攻撃アニメーション
            this.tweens.add({
              targets: sprite,
              x: originalX + moveDistance,
              duration: 150,
              ease: 'Power2',
              onComplete: () => {
                sprite.play(attackAnimKey);
                sprite.once('animationcomplete', () => {
                  // 元の位置に戻る
                  this.tweens.add({
                    targets: sprite,
                    x: originalX,
                    duration: 150,
                    ease: 'Power2',
                    onComplete: () => {
                      sprite.clearTint();
                      this.safePlayAnimation(sprite, `${atlasKey}_idle`);
                    },
                  });
                });
              },
            });
            animPlayed = true;
          }
        }
      } catch {
        // アニメーション再生失敗
      }
    }

    if (!animPlayed) {
      // 簡易アニメーション（前に突進して戻る）
      this.tweens.add({
        targets: sprite,
        x: originalX + moveDistance,
        duration: 120,
        ease: 'Power2',
        yoyo: true,
        hold: 50,
        onComplete: () => {
          sprite.x = originalX;
          sprite.clearTint();
        },
      });
    }
  }

  private showDamageEffect(sprite: Phaser.GameObjects.Sprite | undefined, damage: number) {
    if (!sprite) return;

    // ダメージ数値表示
    const damageText = this.add.text(sprite.x, sprite.y - 100, `-${damage}`, {
      fontSize: '32px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: damageText,
      y: damageText.y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => damageText.destroy(),
    });

    // ヒットエフェクト（点滅）
    this.tweens.add({
      targets: sprite,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 2,
    });

    this.playSound('hit');
  }

  private updateHpBars() {
    const barWidth = 150;

    // プレイヤーHPバー
    const playerHpPercent = this.playerHp / this.playerMaxHp;
    this.playerHpBar.width = barWidth * playerHpPercent;
    this.playerHpBar.x = 100 - (barWidth * (1 - playerHpPercent)) / 2;

    // 敵HPバー
    const enemyHpPercent = this.enemyHp / this.enemyMaxHp;
    this.enemyHpBar.width = barWidth * enemyHpPercent;
    this.enemyHpBar.x = (this.SCREEN_WIDTH - 100) + (barWidth * (1 - enemyHpPercent)) / 2;

    eventBus.emit(GameEvents.MATH_BATTLE_HP_CHANGE, {
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
      enemyHp: this.enemyHp,
      enemyMaxHp: this.enemyMaxHp,
    });
  }

  private endBattle(win: boolean) {
    // 既に終了している場合は何もしない（重複呼び出し防止）
    if (this.status === 'win' || this.status === 'lose') {
      return;
    }

    this.status = win ? 'win' : 'lose';

    // タイマー停止
    this.timerEvent?.destroy();
    this.timerEvent = undefined;

    // 効果音
    this.playSound(win ? 'win' : 'lose');

    // 結果表示
    this.showResult(win);

    // 星評価を計算（ミス数に応じて）
    let stars = 3;
    if (this.missCount >= 3) stars = 1;
    else if (this.missCount >= 1) stars = 2;

    // イベント発火
    if (win) {
      eventBus.emit(GameEvents.MATH_BATTLE_WIN, {
        stageId: this.stageData.id,
        stars,
        missCount: this.missCount,
        totalTime: this.totalTime,
        reward: this.stageData.reward,
      });
    } else {
      eventBus.emit(GameEvents.MATH_BATTLE_LOSE, {
        stageId: this.stageData.id,
        missCount: this.missCount,
        totalTime: this.totalTime,
      });
    }
  }

  private showResult(win: boolean) {
    // 問題エリアを隠す
    this.questionText.setVisible(false);
    this.questionCountText.setVisible(false);
    this.choiceButtons.forEach(btn => btn.setVisible(false));
    this.timerText.setVisible(false);

    // 結果コンテナ
    this.resultContainer = this.add.container(this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2);

    // 背景
    const bg = this.add.rectangle(0, 0, 400, 300, 0x000000, 0.8)
      .setStrokeStyle(3, win ? 0xffcc00 : 0xff4444);

    // タイトル
    const title = this.add.text(0, -100, win
      ? getMathBattleText('victory')
      : getMathBattleText('defeat'), {
      fontSize: '48px',
      color: win ? '#ffcc00' : '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 星評価（勝利時のみ）
    let starsDisplay: Phaser.GameObjects.Text | undefined;
    if (win) {
      let stars = 3;
      if (this.missCount >= 3) stars = 1;
      else if (this.missCount >= 1) stars = 2;

      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      starsDisplay = this.add.text(0, -40, starStr, {
        fontSize: '40px',
        color: '#ffcc00',
      }).setOrigin(0.5);
    }

    // 統計
    const stats = this.add.text(0, 20, [
      `${getMathBattleText('missCount')}: ${this.missCount}`,
      `${getMathBattleText('time')}: ${(this.totalTime / 1000).toFixed(1)}s`,
    ].join('\n'), {
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    // 報酬（勝利時のみ）
    let rewardText: Phaser.GameObjects.Text | undefined;
    if (win) {
      rewardText = this.add.text(0, 80, `+${this.stageData.reward.coins} coins`, {
        fontSize: '24px',
        color: '#ffcc00',
        fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    // コンテナに追加
    const children: Phaser.GameObjects.GameObject[] = [bg, title, stats];
    if (starsDisplay) children.push(starsDisplay);
    if (rewardText) children.push(rewardText);
    this.resultContainer.add(children);

    // アニメーション
    this.resultContainer.setScale(0);
    this.tweens.add({
      targets: this.resultContainer,
      scale: 1,
      duration: 300,
      ease: 'Back.out',
    });
  }

  private playSound(key: string) {
    const volume = getSfxVolume();
    if (volume > 0 && this.cache.audio.exists(key)) {
      this.sound.play(key, { volume });
    }
  }

  shutdown() {
    // タイマー停止
    this.timerEvent?.destroy();
    this.timerEvent = undefined;

    // Tweensをすべて停止
    this.tweens.killAll();

    // Timer eventsをすべて停止
    this.time.removeAllEvents();

    // コンテナをクリア
    this.choiceButtons = [];
  }

  update() {
    // 特に毎フレーム更新は不要
  }
}
