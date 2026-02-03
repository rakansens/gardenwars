// ============================================
// Chess Stages - Progressive Difficulty System
// ============================================

export type ChessAiLevel = 'easy' | 'normal' | 'hard' | 'expert';

export interface ChessStageDefinition {
  id: string;
  nameKey: string;           // i18n key for stage name
  descriptionKey: string;    // i18n key for description
  difficulty: ChessDifficulty;
  aiLevel: ChessAiLevel;
  aiDepth: number;           // Minimax search depth (1-5)
  timeLimitSeconds?: number; // Optional time limit per player
  reward: {
    coins: number;
  };
  specialRules?: {
    noUndo?: boolean;        // Disable undo button
    noCastling?: boolean;    // Disable castling
    noEnPassant?: boolean;   // Disable en passant
  };
}

export type ChessDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'master';

// Difficulty order for unlock progression
export const CHESS_DIFFICULTY_ORDER: ChessDifficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
  'master'
];

// Chess stages data
export const chessStages: ChessStageDefinition[] = [
  // ============================================
  // Beginner (6 stages) - Very easy, teaches basics
  // ============================================
  {
    id: 'chess_beginner_1',
    nameKey: 'chess_stage_beginner_1',
    descriptionKey: 'chess_stage_beginner_1_desc',
    difficulty: 'beginner',
    aiLevel: 'easy',
    aiDepth: 1,
    reward: { coins: 50 },
  },
  {
    id: 'chess_beginner_2',
    nameKey: 'chess_stage_beginner_2',
    descriptionKey: 'chess_stage_beginner_2_desc',
    difficulty: 'beginner',
    aiLevel: 'easy',
    aiDepth: 1,
    reward: { coins: 60 },
  },
  {
    id: 'chess_beginner_3',
    nameKey: 'chess_stage_beginner_3',
    descriptionKey: 'chess_stage_beginner_3_desc',
    difficulty: 'beginner',
    aiLevel: 'easy',
    aiDepth: 1,
    reward: { coins: 70 },
  },
  {
    id: 'chess_beginner_4',
    nameKey: 'chess_stage_beginner_4',
    descriptionKey: 'chess_stage_beginner_4_desc',
    difficulty: 'beginner',
    aiLevel: 'easy',
    aiDepth: 2,
    reward: { coins: 80 },
  },
  {
    id: 'chess_beginner_5',
    nameKey: 'chess_stage_beginner_5',
    descriptionKey: 'chess_stage_beginner_5_desc',
    difficulty: 'beginner',
    aiLevel: 'easy',
    aiDepth: 2,
    reward: { coins: 90 },
  },
  {
    id: 'chess_beginner_6',
    nameKey: 'chess_stage_beginner_6',
    descriptionKey: 'chess_stage_beginner_6_desc',
    difficulty: 'beginner',
    aiLevel: 'easy',
    aiDepth: 2,
    reward: { coins: 100 },
  },

  // ============================================
  // Intermediate (6 stages) - Normal difficulty
  // ============================================
  {
    id: 'chess_intermediate_1',
    nameKey: 'chess_stage_intermediate_1',
    descriptionKey: 'chess_stage_intermediate_1_desc',
    difficulty: 'intermediate',
    aiLevel: 'normal',
    aiDepth: 2,
    reward: { coins: 120 },
  },
  {
    id: 'chess_intermediate_2',
    nameKey: 'chess_stage_intermediate_2',
    descriptionKey: 'chess_stage_intermediate_2_desc',
    difficulty: 'intermediate',
    aiLevel: 'normal',
    aiDepth: 2,
    reward: { coins: 140 },
  },
  {
    id: 'chess_intermediate_3',
    nameKey: 'chess_stage_intermediate_3',
    descriptionKey: 'chess_stage_intermediate_3_desc',
    difficulty: 'intermediate',
    aiLevel: 'normal',
    aiDepth: 3,
    reward: { coins: 160 },
  },
  {
    id: 'chess_intermediate_4',
    nameKey: 'chess_stage_intermediate_4',
    descriptionKey: 'chess_stage_intermediate_4_desc',
    difficulty: 'intermediate',
    aiLevel: 'normal',
    aiDepth: 3,
    reward: { coins: 180 },
  },
  {
    id: 'chess_intermediate_5',
    nameKey: 'chess_stage_intermediate_5',
    descriptionKey: 'chess_stage_intermediate_5_desc',
    difficulty: 'intermediate',
    aiLevel: 'normal',
    aiDepth: 3,
    timeLimitSeconds: 600, // 10 minutes
    reward: { coins: 200 },
  },
  {
    id: 'chess_intermediate_6',
    nameKey: 'chess_stage_intermediate_6',
    descriptionKey: 'chess_stage_intermediate_6_desc',
    difficulty: 'intermediate',
    aiLevel: 'normal',
    aiDepth: 3,
    timeLimitSeconds: 600,
    reward: { coins: 220 },
  },

  // ============================================
  // Advanced (6 stages) - Hard difficulty
  // ============================================
  {
    id: 'chess_advanced_1',
    nameKey: 'chess_stage_advanced_1',
    descriptionKey: 'chess_stage_advanced_1_desc',
    difficulty: 'advanced',
    aiLevel: 'hard',
    aiDepth: 3,
    reward: { coins: 250 },
    specialRules: { noUndo: true },
  },
  {
    id: 'chess_advanced_2',
    nameKey: 'chess_stage_advanced_2',
    descriptionKey: 'chess_stage_advanced_2_desc',
    difficulty: 'advanced',
    aiLevel: 'hard',
    aiDepth: 3,
    reward: { coins: 280 },
    specialRules: { noUndo: true },
  },
  {
    id: 'chess_advanced_3',
    nameKey: 'chess_stage_advanced_3',
    descriptionKey: 'chess_stage_advanced_3_desc',
    difficulty: 'advanced',
    aiLevel: 'hard',
    aiDepth: 4,
    reward: { coins: 310 },
    specialRules: { noUndo: true },
  },
  {
    id: 'chess_advanced_4',
    nameKey: 'chess_stage_advanced_4',
    descriptionKey: 'chess_stage_advanced_4_desc',
    difficulty: 'advanced',
    aiLevel: 'hard',
    aiDepth: 4,
    timeLimitSeconds: 300, // 5 minutes
    reward: { coins: 340 },
    specialRules: { noUndo: true },
  },
  {
    id: 'chess_advanced_5',
    nameKey: 'chess_stage_advanced_5',
    descriptionKey: 'chess_stage_advanced_5_desc',
    difficulty: 'advanced',
    aiLevel: 'hard',
    aiDepth: 4,
    timeLimitSeconds: 300,
    reward: { coins: 370 },
    specialRules: { noUndo: true },
  },
  {
    id: 'chess_advanced_6',
    nameKey: 'chess_stage_advanced_6',
    descriptionKey: 'chess_stage_advanced_6_desc',
    difficulty: 'advanced',
    aiLevel: 'hard',
    aiDepth: 4,
    timeLimitSeconds: 300,
    reward: { coins: 400 },
    specialRules: { noUndo: true },
  },

  // ============================================
  // Master (4 stages) - Expert difficulty, ultimate challenge
  // ============================================
  {
    id: 'chess_master_1',
    nameKey: 'chess_stage_master_1',
    descriptionKey: 'chess_stage_master_1_desc',
    difficulty: 'master',
    aiLevel: 'expert',
    aiDepth: 4,
    timeLimitSeconds: 180, // 3 minutes
    reward: { coins: 500 },
    specialRules: { noUndo: true },
  },
  {
    id: 'chess_master_2',
    nameKey: 'chess_stage_master_2',
    descriptionKey: 'chess_stage_master_2_desc',
    difficulty: 'master',
    aiLevel: 'expert',
    aiDepth: 5,
    timeLimitSeconds: 180,
    reward: { coins: 600 },
    specialRules: { noUndo: true },
  },
  {
    id: 'chess_master_3',
    nameKey: 'chess_stage_master_3',
    descriptionKey: 'chess_stage_master_3_desc',
    difficulty: 'master',
    aiLevel: 'expert',
    aiDepth: 5,
    timeLimitSeconds: 120, // 2 minutes
    reward: { coins: 700 },
    specialRules: { noUndo: true },
  },
  {
    id: 'chess_master_4',
    nameKey: 'chess_stage_master_4',
    descriptionKey: 'chess_stage_master_4_desc',
    difficulty: 'master',
    aiLevel: 'expert',
    aiDepth: 5,
    timeLimitSeconds: 120,
    reward: { coins: 1000 },
    specialRules: { noUndo: true },
  },
];

// Get stages by difficulty
export function getChessStagesByDifficulty(difficulty: ChessDifficulty): ChessStageDefinition[] {
  return chessStages.filter(s => s.difficulty === difficulty);
}

// Get stage by ID
export function getChessStageById(stageId: string): ChessStageDefinition | undefined {
  return chessStages.find(s => s.id === stageId);
}

// Difficulty display info
export const CHESS_DIFFICULTY_INFO: Record<ChessDifficulty, {
  nameKey: string;
  icon: string;
  color: string;
  gradient: string;
}> = {
  beginner: {
    nameKey: 'chess_difficulty_beginner',
    icon: '🌱',
    color: '#4ade80',
    gradient: 'from-green-400 to-green-600',
  },
  intermediate: {
    nameKey: 'chess_difficulty_intermediate',
    icon: '⚔️',
    color: '#60a5fa',
    gradient: 'from-blue-400 to-blue-600',
  },
  advanced: {
    nameKey: 'chess_difficulty_advanced',
    icon: '🔥',
    color: '#f97316',
    gradient: 'from-orange-400 to-orange-600',
  },
  master: {
    nameKey: 'chess_difficulty_master',
    icon: '👑',
    color: '#a855f7',
    gradient: 'from-purple-400 to-purple-600',
  },
};

export default chessStages;
