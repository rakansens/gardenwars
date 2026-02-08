// ============================================
// Garden Wars - Game Data Types
// ============================================

/**
 * レアリティ
 */
export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR';

/**
 * ユニットロール
 */
export type UnitRole = 'tank' | 'attacker' | 'ranger' | 'speedster' | 'flying' | 'balanced';

/**
 * 攻撃タイプ
 */
export type AttackType = 'single' | 'area' | 'piercing';

/**
 * ステージ難易度
 */
export type StageDifficulty = 'tutorial' | 'easy' | 'normal' | 'hard' | 'extreme' | 'nightmare' | 'frozen' | 'boss' | 'special' | 'purgatory' | 'hellfire' | 'abyss' | 'inferno_boss';

/**
 * ワールドID
 */
export type WorldId = 'world1' | 'world2' | 'world3';

/**
 * ワールド定義
 */
export interface WorldDefinition {
  id: WorldId;
  nameKey: string;
  subtitleKey: string;
  icon: string;
  unlockedByDefault: boolean;
  requiredBossStages?: string[];  // 解放に必要なボスステージID
  gradient: string;
  banner?: string;
}

/**
 * ユニット定義（マスターデータ）
 */
export interface UnitDefinition {
  id: string;
  name: string;
  rarity: Rarity;             // レアリティ
  cost: number;
  maxHp: number;
  speed: number;              // pixels per second
  attackDamage: number;
  attackRange: number;        // pixels
  attackCooldownMs: number;   // 攻撃後のクールダウン時間
  attackWindupMs: number;     // ダメージ発生までのモーション時間
  spawnCooldownMs?: number;   // 召喚クールダウン時間（省略時はレアリティ別デフォルト）
  gachaWeight?: number;       // ガチャ排出重み（URのみ、0.1〜1.0、省略時は1.0）
  addedDate?: string;         // 追加日（YYYY-MM-DD形式、NEWタブ表示用）
  knockback: number;          // 与えるノックバック距離
  scale?: number;             // スプライトのスケール倍率（オプション）
  atlasKey: string;
  animKeys: {
    idle: string;
    walk: string;
    attack: string;
    die?: string;
  };
  // 敵ユニット用：味方ユニットのスプライトを流用する場合
  baseUnitId?: string;        // ベースとなる味方ユニットID
  flipSprite?: boolean;       // スプライトを左右反転するか
  isBoss?: boolean;           // ボスユニットか
  isFlying?: boolean;         // 飛行ユニットか（近接攻撃を受けにくい等の特性）
  bossAoe?: BossAoeConfig;    // ボス範囲攻撃設定（ボスのみ）
  role?: UnitRole;            // ユニットロール
  attackType?: AttackType;    // 攻撃タイプ（デフォルト: single）
  areaRadius?: number;        // 範囲攻撃の半径（attackType: area時）
  skillId?: string;           // スキルID（JSON定義用、実行時にskillに解決）
  skill?: UnitSkill;          // スキル（URユニット用）
}

/**
 * ボス範囲攻撃設定
 */
export interface BossAoeConfig {
  enabled: boolean;              // 範囲攻撃有効化
  hpThreshold: number;           // 発動HP閾値（0.5 = 50%以下）
  probability: number;           // 発動確率（0.3 = 30%）
  damage: number;                // 範囲攻撃ダメージ
  range: number;                 // 攻撃範囲（pixels）
  cooldownMs: number;            // 範囲攻撃後の追加クールダウン
  knockback: number;             // ノックバック
}

/**
 * Wave（敵出現）設定
 */
export interface WaveConfig {
  timeMs: number;             // ステージ開始からの出現時間
  unitId: string;
  count: number;              // 出現数
  intervalMs: number;         // 複数体の出現間隔
}

/**
 * ステージ定義
 */
export interface UnitDrop {
  unitId: string;
  rate: number; // 0-100のドロップ率
}

export interface StageDefinition {
  id: string;
  name: string;
  description: string;
  difficulty?: StageDifficulty; // 難易度カテゴリ
  worldId?: WorldId;           // 所属ワールド（省略時はworld1）
  length: number;             // 敵城までの距離（pixels）
  baseCastleHp: number;       // 味方城HP
  enemyCastleHp: number;      // 敵城HP
  enemyWaves: WaveConfig[];
  reward: {
    coins: number;
    drops?: UnitDrop[];       // ユニットドロップ設定
  };
  background?: {
    skyColor: string;         // 空の色（16進数）
    groundColor: string;      // 地面の色（16進数）
    cloudColor?: string;      // 雲の色（オプション）
    image?: string;           // 背景画像パス（オプション）
  };
  isBossStage?: boolean;      // ボスステージか
  // AI対戦モード（aiDeckが設定されている場合、WaveではなくAIがユニットを出撃）
  aiDeck?: string[];          // AIのデッキ（ユニットID配列）
  aiStrategy?: 'aggressive' | 'balanced' | 'defensive';  // AI戦略
}

/**
 * プレイヤー状態
 */
export interface PlayerState {
  ownedUnits: string[];       // 所持ユニットID一覧（後方互換用）
  unitInventory: { [unitId: string]: number };  // ユニット所持個数
  selectedTeam: string[];     // 編成中のユニットID（最大5体）
  coins: number;
}

/**
 * バトル結果
 */
export interface BattleResult {
  stageId: string;
  win: boolean;
  coinsGained: number;
  timestamp: number;
}

/**
 * ユニット状態（状態機械）
 */
export type UnitState =
  | 'SPAWN'
  | 'WALK'
  | 'ATTACK_WINDUP'
  | 'ATTACK_COOLDOWN'
  | 'HITSTUN'
  | 'DIE';

/**
 * ユニット所属
 */
export type UnitSide = 'ally' | 'enemy';

/**
 * 城の所属
 */
export type CastleSide = 'ally' | 'enemy';

/**
 * ゲーム状態
 */
export type GameState =
  | 'LOADING'
  | 'PLAYING'
  | 'PAUSED'
  | 'WIN'
  | 'LOSE';

/**
 * コストゲージ状態
 */
export interface CostGaugeState {
  current: number;
  max: number;
  regenRate: number;          // per second
}

/**
 * ランタイムユニットデータ（バトル中）
 */
export interface RuntimeUnitData {
  instanceId: string;
  definitionId: string;
  side: UnitSide;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: UnitState;
  stateTimer: number;
  target: string | null;      // ターゲットのinstanceId
}

// ============================================
// Arena Mode Types (5レーン制タワーディフェンス)
// ============================================

/**
 * アリーナのレーン番号 (0-4)
 */
export type LaneIndex = 0 | 1 | 2 | 3 | 4;

/**
 * アリーナ用Wave設定
 */
export interface ArenaWaveConfig {
  timeMs: number;             // ステージ開始からの出現時間
  unitId: string;
  lane: LaneIndex | 'random'; // 出現レーン（0-4またはランダム）
  count: number;              // 出現数
  intervalMs: number;         // 複数体の出現間隔
}

/**
 * アリーナステージ定義
 */
export interface ArenaStageDefinition {
  id: string;
  name: string;
  description: string;
  difficulty?: StageDifficulty;
  laneCount: 5;               // 常に5レーン
  arenaHeight: number;        // 縦の長さ（pixels）
  baseCastleHp: number;       // 味方城HP
  enemyCastleHp: number;      // 敵城HP
  enemyWaves: ArenaWaveConfig[];
  reward: {
    coins: number;
    drops?: UnitDrop[];
  };
  background?: {
    color: string;            // 背景色
    image?: string;           // 背景画像パス（オプション）
  };
}

// ============================================
// Survival Mode Types
// ============================================

export interface SurvivalWeaponLevel {
  damage?: number;
  cooldownMs?: number;
  cooldownMultiplier?: number;
  count?: number;
  speed?: number;
  spread?: number;
  radius?: number;
  bladeCount?: number;
  rotationSpeed?: number;
  moveSpeedPct?: number;
  healPerSecond?: number;
}

export interface SurvivalWeaponDefinition {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'passive';
  maxLevel: number;
  levels: SurvivalWeaponLevel[];
}

export interface SurvivalEnemyPool {
  startMs: number;
  unitIds: string[];
}

export interface SurvivalSpawnConfig {
  baseIntervalMs: number;
  minIntervalMs: number;
  intervalDecayPerMinute: number;
  extraSpawnChancePerMinute: number;
}

export interface SurvivalScalingConfig {
  hpPerMinute: number;
  damagePerMinute: number;
  speedPerMinute: number;
}

export interface SurvivalBossConfig {
  intervalMs: number;
  unitIds: string[];
  baseHpFactor: number;
  baseDamageFactor: number;
  baseSpeedFactor: number;
  hpPerMinute: number;
  damagePerMinute: number;
}

export interface SurvivalWavesConfig {
  spawn: SurvivalSpawnConfig;
  scaling: SurvivalScalingConfig;
  enemyPools: SurvivalEnemyPool[];
  boss: SurvivalBossConfig;
}

export type SurvivalDifficulty = 'easy' | 'normal' | 'hard';

// ============================================
// Skill System Types
// ============================================

/**
 * スキル発動トリガー
 */
export type SkillTrigger =
  | 'on_spawn'        // 召喚時に1回発動
  | 'on_attack'       // 攻撃時に発動（確率判定あり）
  | 'on_hit'          // 被弾時に発動
  | 'on_kill'         // 敵撃破時に発動
  | 'hp_threshold'    // HP閾値到達時（1回のみ）
  | 'interval'        // 一定間隔で自動発動
  | 'passive';        // 常時発動（バフ系）

/**
 * スキル効果タイプ
 */
export type SkillEffectType =
  // 時間操作系
  | 'time_stop'       // 時間停止
  | 'time_slow'       // スロー
  | 'haste'           // 加速

  // ダメージ系
  | 'damage_modifier' // ダメージ倍率
  | 'critical'        // クリティカル
  | 'dot'             // 継続ダメージ
  | 'chain'           // 連鎖ダメージ

  // 防御系
  | 'shield'          // シールド
  | 'damage_reduction'// ダメージ軽減
  | 'invincible'      // 無敵
  | 'last_stand'      // 致死ダメージを1回耐える

  // 回復系
  | 'heal'            // HP回復（即時）
  | 'regen'           // HP継続回復

  // 状態異常系
  | 'stun'            // スタン
  | 'freeze'          // 凍結
  | 'burn';           // 炎上

/**
 * スキル効果対象
 */
export type SkillTarget =
  | 'self'            // 自分のみ
  | 'single_enemy'    // 単体敵（攻撃対象）
  | 'all_enemies'     // 全敵
  | 'area_enemies'    // 範囲内敵
  | 'single_ally'     // 単体味方
  | 'all_allies'      // 全味方
  | 'area_allies';    // 範囲内味方

/**
 * スキル効果定義
 */
export interface SkillEffect {
  type: SkillEffectType;
  target: SkillTarget;
  value: number;               // 効果値
  durationMs?: number;         // 効果持続時間
  range?: number;              // 効果範囲（area_* の場合）
  chainCount?: number;         // chain: 連鎖回数
}

/**
 * スキル定義
 */
export interface UnitSkill {
  id: string;
  name: string;
  nameJa: string;
  description: string;
  descriptionJa: string;

  // 発動条件
  trigger: SkillTrigger;
  triggerChance?: number;      // 発動確率 (0.0-1.0)
  triggerThreshold?: number;   // HP閾値 (0.0-1.0)
  triggerIntervalMs?: number;  // 発動間隔

  // クールダウン
  cooldownMs: number;

  // 効果
  effects: SkillEffect[];

  // ビジュアル
  icon: string;                // アイコン絵文字
  effectColor: number;         // エフェクト色（0xRRGGBB）
}

/**
 * ランタイムスキル状態
 */
export interface SkillRuntimeState {
  skillId: string;
  cooldownRemaining: number;
  intervalTimer: number;       // interval用タイマー
  triggered: boolean;          // hp_threshold等の1回限りトリガー用
}

/**
 * ステータス効果（バフ/デバフ）
 */
export interface StatusEffect {
  id: string;
  type: SkillEffectType;
  value: number;
  remainingMs: number;
  sourceUnitId: string;
  icon: string;
}

// ============================================
// Math Battle Types (算数バトルモード)
// ============================================

/**
 * 演算タイプ
 */
export type MathOperationType = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';

/**
 * 算数バトルエリアID
 */
export type MathBattleAreaId = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';

/**
 * 算数バトルエリア定義
 */
export interface MathBattleAreaDefinition {
  id: MathBattleAreaId;
  nameKey: string;           // 翻訳キー
  icon: string;              // 絵文字アイコン
  operationType: MathOperationType;
  requiredStars: number;     // アンロックに必要な累計星数
  coverImage?: string;       // カバー画像パス
  stages: MathBattleStageDefinition[];
}

/**
 * 算数バトルステージ定義
 */
export interface MathBattleStageDefinition {
  id: string;
  nameKey: string;           // 翻訳キー
  areaId: MathBattleAreaId;
  stageNumber: number;       // エリア内のステージ番号
  isBoss: boolean;           // ボスステージか
  questionCount: number;     // 問題数
  timeLimitMs: number;       // 1問あたりの制限時間（ミリ秒）
  difficulty: {
    minNum1: number;         // 最小の数1
    maxNum1: number;         // 最大の数1
    minNum2: number;         // 最小の数2
    maxNum2: number;         // 最大の数2
  };
  enemyId: string;           // 敵ユニットID
  reward: {
    coins: number;
  };
}

/**
 * 算数問題
 */
export interface MathQuestion {
  num1: number;
  num2: number;
  operation: MathOperationType;
  answer: number;
  choices: number[];         // 4つの選択肢
}

/**
 * 算数バトル進行状態（永続化用）
 */
export interface MathBattleProgress {
  stageResults: {
    [stageId: string]: {
      cleared: boolean;
      stars: number;         // 1-3
      bestTime?: number;     // 最速クリアタイム（ミリ秒）
    };
  };
  totalStars: number;        // 累計星数
}

/**
 * 算数バトルゲーム状態（ランタイム）
 */
export interface MathBattleGameState {
  status: 'ready' | 'countdown' | 'playing' | 'win' | 'lose';
  currentQuestionIndex: number;
  totalQuestions: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  missCount: number;
  timeRemaining: number;     // 現在の問題の残り時間（ミリ秒）
  totalTime: number;         // 経過時間（ミリ秒）
}

// ============================================
// Tower Defense Mode Types (2.5Dタワーディフェンス)
// ============================================

/**
 * タワーディフェンス Wave設定
 */
export interface TowerDefenseWaveConfig {
  waveNumber: number;           // Wave番号（1始まり）
  enemies: {
    unitId: string;             // 敵ユニットID
    count: number;              // 出現数
    intervalMs: number;         // スポーン間隔（ミリ秒）
    delayMs: number;            // Wave開始からの遅延（ミリ秒）
  }[];
  goldBonus?: number;           // Wave突破ボーナスゴールド
}

/**
 * タワーディフェンス ステージ定義
 */
export interface TowerDefenseStageDefinition {
  id: string;
  name: string;
  description: string;
  difficulty?: StageDifficulty;
  cols: number;                 // グリッド列数
  rows: number;                 // グリッド行数
  path: [number, number][];     // パス座標 [col, row] の配列
  waves: TowerDefenseWaveConfig[];
  startLives: number;           // 初期ライフ
  startGold: number;            // 初期ゴールド
  killGold: number;             // 敵撃破ゴールド（基本値）
  reward: {
    coins: number;
    drops?: UnitDrop[];
  };
  background?: {
    groundColor: string;
    pathColor: string;
    accentColor?: string;
  };
}

// ============================================
// ダンジョンモード
// ============================================
export interface DungeonStageDefinition {
  id: string;
  name: string;
  description: string;
  difficulty: StageDifficulty;
  startGold: number;            // 初期ゴールド
  killGold: number;             // 敵撃破ゴールド
  goldPerSecond: number;        // 毎秒ゴールド獲得
  maxGuards: number;            // 配置上限
  maxSameUnit: number;          // 同一ユニット上限
  totalWaves: number;           // 総ウェーブ数
  wavePauseMs: number;          // ウェーブ間休憩（ms）
  baseEnemiesPerWave: number;   // 基本敵数/ウェーブ
  reward: {
    coins: number;
  };
}

