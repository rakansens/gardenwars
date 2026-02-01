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
export type StageDifficulty = 'tutorial' | 'easy' | 'normal' | 'hard' | 'extreme' | 'boss' | 'special';

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
