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
        const enemyBossAlive = this.hasAliveBoss(enemyUnits);
        const allyBossAlive = this.hasAliveBoss(allyUnits);

        // 味方ユニットのターゲット割り当て
        for (const ally of allyUnits) {
            if (ally.isDead()) continue;

            // 既存ターゲットが有効ならスキップ
            if (ally.target && !ally.target.isDead() && ally.isInRange(ally.target)) {
                ally.castleTarget = null;
                continue;
            }

            // 新しいターゲットを探す
            ally.target = this.findTarget(ally, enemyUnits);

            // 敵がいなければ城を攻撃（射程内の場合）
            // 重要: ボス生存中は城をターゲットしない（ボスが城の前にいるため、城を通り越して攻撃してしまう問題を防ぐ）
            if (!ally.target && !enemyBossAlive && this.isInRangeOfCastle(ally, enemyCastle)) {
                ally.castleTarget = enemyCastle;
            } else {
                ally.castleTarget = null;
            }
        }

        // 敵ユニットのターゲット割り当て
        for (const enemy of enemyUnits) {
            if (enemy.isDead()) continue;

            // 既存ターゲットが有効ならスキップ
            if (enemy.target && !enemy.target.isDead() && enemy.isInRange(enemy.target)) {
                enemy.castleTarget = null;
                continue;
            }

            // 新しいターゲットを探す
            enemy.target = this.findTarget(enemy, allyUnits);

            // 味方がいなければ城を攻撃（射程内の場合）
            // 重要: ボス生存中ガード（対戦モードでボス召喚がある場合用）
            if (!enemy.target && !allyBossAlive && this.isInRangeOfCastle(enemy, allyCastle)) {
                enemy.castleTarget = allyCastle;
            } else {
                enemy.castleTarget = null;
            }
        }
    }

    /**
     * 生存しているボスがいるかチェック
     */
    private hasAliveBoss(units: Unit[]): boolean {
        return units.some(u => u.definition.isBoss && !u.isDead());
    }

    /**
     * 最も近い敵を探す
     * 修正: 中心距離ではなく、相手の「端（Edge）」との距離で計算
     * これにより、巨大なボス（中心が遠い）に対しても正しく射程判定が行われる
     */
    private findTarget(attacker: Unit, enemies: Unit[]): Unit | null {
        let closestInFront: Unit | null = null;
        let minDistanceFront = Infinity;
        let closestAny: Unit | null = null;
        let minDistanceAny = Infinity;

        const attackerX = attacker.getX();
        const attackRange = attacker.definition.attackRange;

        for (const enemy of enemies) {
            if (enemy.isDead()) continue;

            const enemyX = enemy.getX(); // 中心座標
            const enemyWidth = enemy.getWidth(); // 表示幅
            const enemyHalfWidth = enemyWidth / 2;

            // 敵の「自分に近い側の端」の座標を計算
            let enemyEdgeX = enemyX;
            if (attackerX < enemyX) {
                // 敵が右にいる場合、敵の左端
                enemyEdgeX = enemyX - enemyHalfWidth;
            } else {
                // 敵が左にいる場合、敵の右端
                enemyEdgeX = enemyX + enemyHalfWidth;
            }

            // 距離計算（絶対値）
            const distanceToEdge = Math.abs(attackerX - enemyEdgeX);

            // 射程チェック（エッジまでの距離で判定）
            if (distanceToEdge > attackRange) continue;

            // 攻撃者の前方にいる敵のみ
            const isInFront = attacker.side === 'ally'
                ? enemyX > attackerX // X座標の単純比較（中心点基準で十分）
                : enemyX < attackerX;

            if (isInFront) {
                if (distanceToEdge < minDistanceFront) {
                    minDistanceFront = distanceToEdge;
                    closestInFront = enemy;
                }
            }

            // 全方向（背後含む）の最短も記録（前方優先が見つからない場合のバックアップ）
            if (distanceToEdge < minDistanceAny) {
                minDistanceAny = distanceToEdge;
                closestAny = enemy;
            }
        }

        // 前方に敵がいれば優先、いなければ背後も含めて最も近い敵
        return closestInFront ?? closestAny;
    }

    /**
     * 城が射程内かチェック
     */
    private isInRangeOfCastle(unit: Unit, castle: Castle): boolean {
        const distance = Math.abs(unit.getX() - castle.getX());
        return distance <= unit.definition.attackRange;
    }

}
