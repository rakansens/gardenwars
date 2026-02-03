import type { MathQuestion, MathOperationType } from '@/data/types';

// ============================================
// MathQuestionGenerator - 算数問題生成システム
// ============================================

export interface DifficultyConfig {
  minNum1: number;
  maxNum1: number;
  minNum2: number;
  maxNum2: number;
}

/**
 * 乱数生成（min以上max以下の整数）
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 配列をシャッフル
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 不正解の選択肢を生成（正解と被らないように）
 */
function generateWrongChoices(correctAnswer: number, count: number): number[] {
  const wrongChoices: Set<number> = new Set();
  const range = Math.max(10, Math.abs(correctAnswer) * 0.5); // 正解の50%か10の大きい方

  let attempts = 0;
  while (wrongChoices.size < count && attempts < 100) {
    // 正解の近くの値を生成
    const offset = randomInt(-Math.ceil(range), Math.ceil(range));
    const wrong = correctAnswer + offset;

    // 正解と重複せず、負の数にならない（引き算以外）
    if (wrong !== correctAnswer && wrong >= 0 && !wrongChoices.has(wrong)) {
      wrongChoices.add(wrong);
    }
    attempts++;
  }

  // 足りない場合は順番に追加
  let fallback = 1;
  while (wrongChoices.size < count) {
    const candidate = correctAnswer + fallback;
    if (!wrongChoices.has(candidate) && candidate >= 0) {
      wrongChoices.add(candidate);
    }
    fallback = fallback > 0 ? -fallback : -fallback + 1;
  }

  return Array.from(wrongChoices);
}

/**
 * 足し算の問題を生成
 */
function generateAddition(config: DifficultyConfig): MathQuestion {
  const num1 = randomInt(config.minNum1, config.maxNum1);
  const num2 = randomInt(config.minNum2, config.maxNum2);
  const answer = num1 + num2;
  const wrongChoices = generateWrongChoices(answer, 3);
  const choices = shuffleArray([answer, ...wrongChoices]);

  return {
    num1,
    num2,
    operation: 'addition',
    answer,
    choices,
  };
}

/**
 * 引き算の問題を生成（答えが0以上になるように）
 */
function generateSubtraction(config: DifficultyConfig): MathQuestion {
  let num1 = randomInt(config.minNum1, config.maxNum1);
  let num2 = randomInt(config.minNum2, config.maxNum2);

  // num1 >= num2 を保証（答えが負にならないように）
  if (num1 < num2) {
    [num1, num2] = [num2, num1];
  }

  const answer = num1 - num2;
  const wrongChoices = generateWrongChoices(answer, 3);
  const choices = shuffleArray([answer, ...wrongChoices]);

  return {
    num1,
    num2,
    operation: 'subtraction',
    answer,
    choices,
  };
}

/**
 * 掛け算の問題を生成
 */
function generateMultiplication(config: DifficultyConfig): MathQuestion {
  const num1 = randomInt(config.minNum1, config.maxNum1);
  const num2 = randomInt(config.minNum2, config.maxNum2);
  const answer = num1 * num2;
  const wrongChoices = generateWrongChoices(answer, 3);
  const choices = shuffleArray([answer, ...wrongChoices]);

  return {
    num1,
    num2,
    operation: 'multiplication',
    answer,
    choices,
  };
}

/**
 * 割り算の問題を生成（割り切れる問題のみ）
 */
function generateDivision(config: DifficultyConfig): MathQuestion {
  // 割り切れる問題を作成するため、まず掛け算を作ってから逆算
  const divisor = randomInt(Math.max(1, config.minNum2), config.maxNum2);
  const quotient = randomInt(config.minNum1, config.maxNum1);
  const num1 = divisor * quotient; // 被除数
  const num2 = divisor; // 除数
  const answer = quotient;

  const wrongChoices = generateWrongChoices(answer, 3);
  const choices = shuffleArray([answer, ...wrongChoices]);

  return {
    num1,
    num2,
    operation: 'division',
    answer,
    choices,
  };
}

/**
 * 四則混合の問題を生成
 */
function generateMixed(config: DifficultyConfig): MathQuestion {
  const operations: MathOperationType[] = ['addition', 'subtraction', 'multiplication', 'division'];
  const operation = operations[randomInt(0, operations.length - 1)];

  switch (operation) {
    case 'addition':
      return generateAddition(config);
    case 'subtraction':
      return generateSubtraction(config);
    case 'multiplication':
      return generateMultiplication(config);
    case 'division':
      return generateDivision(config);
    default:
      return generateAddition(config);
  }
}

/**
 * 指定された演算タイプの問題を生成
 */
export function generateQuestion(
  operationType: MathOperationType,
  config: DifficultyConfig
): MathQuestion {
  switch (operationType) {
    case 'addition':
      return generateAddition(config);
    case 'subtraction':
      return generateSubtraction(config);
    case 'multiplication':
      return generateMultiplication(config);
    case 'division':
      return generateDivision(config);
    case 'mixed':
      return generateMixed(config);
    default:
      return generateAddition(config);
  }
}

/**
 * 複数の問題を生成
 */
export function generateQuestions(
  operationType: MathOperationType,
  config: DifficultyConfig,
  count: number
): MathQuestion[] {
  const questions: MathQuestion[] = [];
  for (let i = 0; i < count; i++) {
    questions.push(generateQuestion(operationType, config));
  }
  return questions;
}

/**
 * 演算記号を取得
 */
export function getOperationSymbol(operation: MathOperationType): string {
  switch (operation) {
    case 'addition':
      return '+';
    case 'subtraction':
      return '-';
    case 'multiplication':
      return '×';
    case 'division':
      return '÷';
    default:
      return '+';
  }
}

/**
 * 問題テキストを取得
 */
export function getQuestionText(question: MathQuestion): string {
  const symbol = getOperationSymbol(question.operation);
  return `${question.num1} ${symbol} ${question.num2} = ?`;
}
