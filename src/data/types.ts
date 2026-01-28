// ============================================
// Garden Wars - Game Data Types
// ============================================

/**
 * レアリティ
 */
export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR';

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
  };
  isBossStage?: boolean;      // ボスステージか
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
