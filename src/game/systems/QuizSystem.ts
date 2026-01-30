import Phaser from 'phaser';

export interface QuizCallbacks {
    canStartQuiz: () => boolean;
    canAffordCost: (cost: number) => boolean;
    isOnCooldown: (unitId: string) => boolean;
    onCorrectAnswer: (unitId: string, cost: number) => void;
    onSkipQuiz: (unitId: string) => void;
}

export class QuizSystem {
    private scene: Phaser.Scene;
    private callbacks: QuizCallbacks;

    // クイズ状態
    private quizActive: boolean = false;
    private quizContainer!: Phaser.GameObjects.Container;
    private quizQuestion!: Phaser.GameObjects.Text;
    private quizButtons: Phaser.GameObjects.Container[] = [];
    private quizCorrectAnswer: number = 0;
    private pendingUnitId: string | null = null;
    private pendingUnitCost: number = 0;

    // 算数モード
    private mathModeEnabled: boolean = false;

    constructor(scene: Phaser.Scene, callbacks: QuizCallbacks) {
        this.scene = scene;
        this.callbacks = callbacks;
    }

    isActive(): boolean {
        return this.quizActive;
    }

    isMathModeEnabled(): boolean {
        return this.mathModeEnabled;
    }

    setMathModeEnabled(enabled: boolean) {
        this.mathModeEnabled = enabled;
    }

    toggleMathMode(): boolean {
        this.mathModeEnabled = !this.mathModeEnabled;
        return this.mathModeEnabled;
    }

    startQuiz(unitId: string, cost: number) {
        if (!this.callbacks.canStartQuiz() || this.quizActive) return;

        // クールダウンチェック
        if (this.callbacks.isOnCooldown(unitId)) {
            return;
        }

        // コストチェック
        if (!this.callbacks.canAffordCost(cost)) {
            return;
        }

        // 算数モードがOFFの場合、またはコスト100以下: クイズなし、即座に召喚
        if (!this.mathModeEnabled || cost <= 100) {
            this.callbacks.onSkipQuiz(unitId);
            return;
        }

        // クイズ開始
        this.quizActive = true;
        this.pendingUnitId = unitId;
        this.pendingUnitCost = cost;

        let a: number, b: number, questionText: string;

        if (cost >= 1000) {
            // コスト1000以上: 2桁の掛け算または割り算
            const useDivision = Phaser.Math.Between(0, 1) === 0;
            if (useDivision) {
                b = Phaser.Math.Between(2, 9);
                const result = Phaser.Math.Between(2, 12);
                a = b * result;
                this.quizCorrectAnswer = result;
                questionText = `${a} ÷ ${b} = ?`;
            } else {
                a = Phaser.Math.Between(10, 25);
                b = Phaser.Math.Between(2, 5);
                this.quizCorrectAnswer = a * b;
                questionText = `${a} × ${b} = ?`;
            }
        } else if (cost >= 200) {
            // コスト200〜999: 掛け算（1桁×1桁）
            a = Phaser.Math.Between(2, 9);
            b = Phaser.Math.Between(2, 9);
            this.quizCorrectAnswer = a * b;
            questionText = `${a} × ${b} = ?`;
        } else {
            // コスト101〜199: 足し算（一桁＋一桁）
            a = Phaser.Math.Between(1, 9);
            b = Phaser.Math.Between(1, 9);
            this.quizCorrectAnswer = a + b;
            questionText = `${a} + ${b} = ?`;
        }

        const choices = this.generateChoices(this.quizCorrectAnswer, cost >= 200);
        this.showQuizUI(questionText, choices);
    }

    private generateChoices(correct: number, isMultiplication: boolean): number[] {
        const choices: Set<number> = new Set([correct]);
        const range = isMultiplication ? 15 : 5;

        while (choices.size < 4) {
            let wrong = correct + Phaser.Math.Between(-range, range);
            if (wrong <= 0) wrong = Phaser.Math.Between(1, correct + range);
            if (wrong !== correct) {
                choices.add(wrong);
            }
        }

        return Phaser.Utils.Array.Shuffle(Array.from(choices));
    }

    private showQuizUI(questionText: string, choices: number[]) {
        const { width, height } = this.scene.scale;

        this.quizContainer = this.scene.add.container(0, 0);
        this.quizContainer.setScrollFactor(0);
        this.quizContainer.setDepth(300);

        // 背景オーバーレイ
        const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this.quizContainer.add(overlay);

        // パネル背景
        const panelW = 260;
        const panelH = 220;
        const panelY = height / 2 - 80;
        const panel = this.scene.add.rectangle(width / 2, panelY, panelW, panelH, 0xfff8e7);
        panel.setStrokeStyle(4, 0x3b2a1a);
        this.quizContainer.add(panel);

        // タイトル
        const titleY = panelY - 80;
        const title = this.scene.add.text(width / 2, titleY, '🧮 Quiz!', {
            fontSize: '20px',
            color: '#3b2a1a',
            fontStyle: 'bold',
        });
        title.setOrigin(0.5, 0.5);
        this.quizContainer.add(title);

        // 問題
        const questionY = panelY - 50;
        this.quizQuestion = this.scene.add.text(width / 2, questionY, questionText, {
            fontSize: '28px',
            color: '#2d6a4f',
            fontStyle: 'bold',
        });
        this.quizQuestion.setOrigin(0.5, 0.5);
        this.quizContainer.add(this.quizQuestion);

        // 選択肢ボタン（2x2）
        this.quizButtons = [];
        const btnSize = 50;
        const btnGap = 10;
        const startX = width / 2 - btnSize - btnGap / 2;
        const startY = panelY - 10;

        choices.forEach((choice, index) => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            const bx = startX + col * (btnSize + btnGap) + btnSize / 2;
            const by = startY + row * (btnSize + btnGap) + btnSize / 2;

            const btnContainer = this.scene.add.container(bx, by);

            const btnBg = this.scene.add.rectangle(0, 0, btnSize, btnSize, 0xffe066);
            btnBg.setStrokeStyle(3, 0x3b2a1a);
            btnBg.setInteractive({ useHandCursor: true });
            btnContainer.add(btnBg);

            const btnText = this.scene.add.text(0, 0, `${choice}`, {
                fontSize: '20px',
                color: '#3b2a1a',
                fontStyle: 'bold',
            });
            btnText.setOrigin(0.5, 0.5);
            btnContainer.add(btnText);

            btnBg.on('pointerdown', () => {
                this.answerQuiz(choice);
            });

            btnBg.on('pointerover', () => btnBg.setFillStyle(0xfff3cf));
            btnBg.on('pointerout', () => btnBg.setFillStyle(0xffe066));

            this.quizContainer.add(btnContainer);
            this.quizButtons.push(btnContainer);
        });
    }

    private answerQuiz(answer: number) {
        const correct = answer === this.quizCorrectAnswer;
        const { width, height } = this.scene.scale;
        const panelY = height / 2 - 80;

        if (correct) {
            const successText = this.scene.add.text(width / 2, panelY + 85, '✅ OK!', {
                fontSize: '24px',
                color: '#2d6a4f',
                fontStyle: 'bold',
            });
            successText.setOrigin(0.5, 0.5);
            successText.setScrollFactor(0);
            successText.setDepth(301);
            this.quizContainer.add(successText);

            // 召喚実行
            if (this.pendingUnitId) {
                this.callbacks.onCorrectAnswer(this.pendingUnitId, this.pendingUnitCost);
            }
        } else {
            const failText = this.scene.add.text(width / 2, panelY + 85, `❌ ${this.quizCorrectAnswer}`, {
                fontSize: '24px',
                color: '#c1121f',
                fontStyle: 'bold',
            });
            failText.setOrigin(0.5, 0.5);
            failText.setScrollFactor(0);
            failText.setDepth(301);
            this.quizContainer.add(failText);
        }

        this.scene.time.delayedCall(correct ? 400 : 800, () => {
            this.closeQuiz();
        });
    }

    private closeQuiz() {
        if (this.quizContainer) {
            this.quizContainer.destroy();
        }
        this.quizActive = false;
        this.pendingUnitId = null;
        this.pendingUnitCost = 0;
        this.quizButtons = [];
    }

    destroy() {
        this.closeQuiz();
    }
}
