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

    // HP設定（ボスは問題数に応じてHP増加）
    this.playerMaxHp = 100;
    this.playerHp = 100;
    const baseEnemyHp = this.stageData.isBoss ? 150 : 100;
    this.enemyMaxHp = baseEnemyHp;
    this.enemyHp = baseEnemyHp;

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
      const imagePath = getSpritePath(baseId);
      if (!this.textures.exists(atlasKey)) {
        this.load.image(atlasKey, imagePath);
      }
    }
  }

  create() {
    // 背景
    this.cameras.main.setBackgroundColor('#2d5a27');

    // 地面
    this.add.rectangle(
      this.SCREEN_WIDTH / 2,
      this.SCREEN_HEIGHT - 50,
      this.SCREEN_WIDTH,
      100,
      0x8b4513
    );

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
    this.timerText = this.add.text(this.SCREEN_WIDTH / 2, 50, '', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private createQuestionArea() {
    // 問題カウンター
    this.questionCountText = this.add.text(this.SCREEN_WIDTH / 2, 100, '', {
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
    const groundY = 280;

    // プレイヤースプライト（左側）
    const playerAtlas = this.playerUnitData.atlasKey || this.playerUnitData.id;
    const playerBaseId = this.playerUnitData.baseUnitId || this.playerUnitData.id;

    if (this.textures.exists(playerAtlas)) {
      this.playerSprite = this.add.sprite(150, groundY, playerAtlas);

      if (hasAnimation(playerBaseId)) {
        this.setupAnimation(this.playerSprite, playerAtlas, this.playerUnitData);
        // アニメーション再生を試みる（失敗しても無視）
        this.safePlayAnimation(this.playerSprite, `${playerAtlas}_idle`);
      }

      // スケールを小さめに（画面800x600に対して適切なサイズ）
      const scale = (this.playerUnitData.scale || 1) * 0.08;
      this.playerSprite.setScale(scale);
      this.playerSprite.setOrigin(0.5, 1);
    }

    // 敵スプライト（右側）
    const enemyAtlas = this.enemyUnitData.atlasKey || this.enemyUnitData.id;
    const enemyBaseId = this.enemyUnitData.baseUnitId || this.enemyUnitData.id;

    if (this.textures.exists(enemyAtlas)) {
      this.enemySprite = this.add.sprite(this.SCREEN_WIDTH - 150, groundY, enemyAtlas);

      if (hasAnimation(enemyBaseId)) {
        this.setupAnimation(this.enemySprite, enemyAtlas, this.enemyUnitData);
        // アニメーション再生を試みる（失敗しても無視）
        this.safePlayAnimation(this.enemySprite, `${enemyAtlas}_idle`);
      }

      // ボスは少し大きめ、通常敵は標準サイズ
      const scale = (this.enemyUnitData.scale || 1) * (this.stageData.isBoss ? 0.12 : 0.08);
      this.enemySprite.setScale(scale);
      this.enemySprite.setOrigin(0.5, 1);
      // 敵は左向きにする
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
        }
      }
    } catch {
      // アニメーション再生に失敗しても無視（静止画として表示）
    }
  }

  private setupAnimation(sprite: Phaser.GameObjects.Sprite, atlasKey: string, unit: UnitDefinition) {
    const animKeys = unit.animKeys || { idle: 'idle', walk: 'walk', attack: 'attack', die: 'die' };

    const animations = [
      { key: `${atlasKey}_idle`, frames: animKeys.idle, repeat: -1, frameRate: 8 },
      { key: `${atlasKey}_walk`, frames: animKeys.walk, repeat: -1, frameRate: 10 },
      { key: `${atlasKey}_attack`, frames: animKeys.attack, repeat: 0, frameRate: 12 },
    ];

    if (animKeys.die) {
      animations.push({ key: `${atlasKey}_die`, frames: animKeys.die, repeat: 0, frameRate: 8 });
    }

    animations.forEach(anim => {
      if (!this.anims.exists(anim.key)) {
        try {
          this.anims.create({
            key: anim.key,
            frames: this.anims.generateFrameNames(atlasKey, {
              prefix: `${anim.frames}_`,
              start: 0,
              end: this.getFrameCount(atlasKey, anim.frames) - 1,
              zeroPad: 0,
            }),
            frameRate: anim.frameRate,
            repeat: anim.repeat,
          });
        } catch {
          // フレームがない場合は無視
        }
      }
    });
  }

  private getFrameCount(atlasKey: string, animName: string): number {
    const texture = this.textures.get(atlasKey);
    if (!texture) return 4;

    let count = 0;
    for (let i = 0; i < 20; i++) {
      if (texture.has(`${animName}_${i}`)) {
        count++;
      } else {
        break;
      }
    }
    return count || 4;
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
    if (this.currentQuestionIndex >= this.questions.length) {
      // 全問終了 → 勝利
      this.endBattle(true);
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

    // アニメーション再生を試みる
    let animPlayed = false;
    if (hasAnimation(baseId)) {
      try {
        const attackAnimKey = `${atlasKey}_attack`;
        if (this.anims.exists(attackAnimKey)) {
          const anim = this.anims.get(attackAnimKey);
          if (anim && anim.frames && anim.frames.length > 0) {
            sprite.play(attackAnimKey);
            animPlayed = true;
            sprite.once('animationcomplete', () => {
              this.safePlayAnimation(sprite, `${atlasKey}_idle`);
            });
          }
        }
      } catch {
        // アニメーション再生失敗
      }
    }

    if (!animPlayed) {
      // 簡易アニメーション（スプライト移動）
      const originalX = sprite.x;
      const targetX = isPlayer ? sprite.x + 50 : sprite.x - 50;

      this.tweens.add({
        targets: sprite,
        x: targetX,
        duration: 100,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => {
          sprite.x = originalX;
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
