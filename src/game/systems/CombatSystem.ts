import type { Unit } from '../entities/Unit';
import type { Castle } from '../entities/Castle';

// ============================================
// CombatSystem - 戦闘ロジック管理
// ============================================

export class CombatSystem {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * ターゲット割り当てと城への攻撃処理
     */
    update(
        allyUnits: Unit[],
        enemyUnits: Unit[],
        allyCastle: Castle,
        enemyCastle: Castle
    ): void {
        // 味方ユニットのターゲット割り当て
        for (const ally of allyUnits) {
            if (ally.isDead()) continue;

            // 既存ターゲットが有効ならスキップ
            if (ally.target && !ally.target.isDead() && ally.isInRange(ally.target)) {
                continue;
            }

            // 新しいターゲットを探す
            ally.target = this.findTarget(ally, enemyUnits);

            // 敵がいなければ城を攻撃（射程内の場合）
            if (!ally.target && this.isInRangeOfCastle(ally, enemyCastle)) {
                this.attackCastle(ally, enemyCastle);
            }
        }

        // 敵ユニットのターゲット割り当て
        for (const enemy of enemyUnits) {
            if (enemy.isDead()) continue;

            // 既存ターゲットが有効ならスキップ
            if (enemy.target && !enemy.target.isDead() && enemy.isInRange(enemy.target)) {
                continue;
            }

            // 新しいターゲットを探す
            enemy.target = this.findTarget(enemy, allyUnits);

            // 味方がいなければ城を攻撃（射程内の場合）
            if (!enemy.target && this.isInRangeOfCastle(enemy, allyCastle)) {
                this.attackCastle(enemy, allyCastle);
            }
        }
    }

    /**
     * 最も近い敵を探す
     */
    private findTarget(attacker: Unit, enemies: Unit[]): Unit | null {
        let closest: Unit | null = null;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if (enemy.isDead()) continue;

            const distance = Math.abs(attacker.getX() - enemy.getX());

            // 攻撃者の前方にいる敵のみ
            const isInFront = attacker.side === 'ally'
                ? enemy.getX() > attacker.getX()
                : enemy.getX() < attacker.getX();

            if (isInFront && distance < minDistance && distance <= attacker.definition.attackRange) {
                minDistance = distance;
                closest = enemy;
            }
        }

        return closest;
    }

    /**
     * 城が射程内かチェック
     */
    private isInRangeOfCastle(unit: Unit, castle: Castle): boolean {
        const distance = Math.abs(unit.getX() - castle.getX());
        return distance <= unit.definition.attackRange;
    }

    /**
     * 城への攻撃（状態がATTACK_COOLDOWNのとき実行）
     */
    private attackCastle(unit: Unit, castle: Castle): void {
        // ユニットがATTACK_WINDUP状態の終了タイミングで城にダメージ
        // 実際のダメージ処理はUnit側で行うが、城への攻撃は特別処理
        if (unit.state === 'WALK') {
            // 城をターゲットとしてマーク（nullのまま攻撃状態に移行）
            unit.target = null;
        }
    }

    /**
     * 城への直接ダメージ（ユニットがATTACK中に呼び出される）
     */
    public dealDamageToCastle(attacker: Unit, castle: Castle): void {
        castle.takeDamage(attacker.definition.attackDamage);
    }
}
