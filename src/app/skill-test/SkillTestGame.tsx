'use client';

import { useEffect, useRef } from 'react';

interface SkillTestGameProps {
  selectedUnitId: string;
  onLog: (msg: string) => void;
  onLoaded: () => void;
}

export default function SkillTestGame({ selectedUnitId, onLog, onLoaded }: SkillTestGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const initPhaser = async () => {
      const Phaser = (await import('phaser')).default;
      const { Unit, setUnitListGetters } = await import('@/game/entities/Unit');
      const { getSheetPath, hasAnimation } = await import('@/lib/sprites');
      const unitsModule = await import('@/data/units');

      if (cancelled) return;

      // 既存のゲームインスタンスを破棄
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }

      const unitDef = unitsModule.allies.find(u => u.id === selectedUnitId);
      if (!unitDef) return;

      class SkillTestScene extends Phaser.Scene {
        private allyUnits: InstanceType<typeof Unit>[] = [];
        private enemyUnits: InstanceType<typeof Unit>[] = [];
        private groundY: number = 350;
        private unitDef: any;

        constructor() {
          super({ key: 'SkillTestScene' });
          this.unitDef = unitDef;
        }

        preload() {
          // 選択したユニットのスプライトをロード
          if (hasAnimation(this.unitDef.id)) {
            const sheet = getSheetPath(this.unitDef.id);
            this.load.atlas(`${this.unitDef.id}_atlas`, sheet.image, sheet.json);
          }

          // ダミー敵用のスプライト
          const dummyUnits = ['n_slime', 'n_goblin', 'n_mushroom'];
          dummyUnits.forEach(id => {
            if (hasAnimation(id)) {
              const sheet = getSheetPath(id);
              this.load.atlas(`${id}_atlas`, sheet.image, sheet.json);
            }
          });

          // 効果音をロード
          this.load.audio('sfx_unit_spawn', '/assets/audio/sfx/unit_spawn.mp3');
          this.load.audio('sfx_unit_death', '/assets/audio/sfx/unit_death.mp3');
          this.load.audio('sfx_attack_hit', '/assets/audio/sfx/attack_hit.mp3');
          this.load.audio('sfx_attack_hit_sr', '/assets/audio/sfx/attack_hit_sr.mp3');
          this.load.audio('sfx_cannon_fire', '/assets/audio/sfx/cannon_fire.mp3');
        }

        create() {
          const { width, height } = this.scale;

          // 背景
          this.add.rectangle(width / 2, height / 2, width, height, 0x2d1b4e);
          this.add.rectangle(width / 2, height - 50, width, 100, 0x3d2817);

          // グラウンドライン
          this.add.line(0, this.groundY, 0, 0, width, 0, 0x666666).setOrigin(0);

          // ユニットリストゲッターを設定
          setUnitListGetters(
            () => this.allyUnits.filter(u => u.active),
            () => this.enemyUnits.filter(u => u.active)
          );

          // スキル情報表示
          if (this.unitDef.skill) {
            const skill = this.unitDef.skill;
            this.add.text(10, 10, `${skill.icon} ${skill.nameJa}`, {
              fontSize: '24px',
              color: '#ffdd00'
            });
            this.add.text(10, 40, skill.descriptionJa, {
              fontSize: '14px',
              color: '#cccccc'
            });
            this.add.text(10, 60, `発動: ${skill.trigger}`, {
              fontSize: '12px',
              color: '#888888'
            });
          }

          // 操作説明
          this.add.text(10, height - 30, '[SPACE] ユニット召喚  [E] 敵追加  [R] リセット', {
            fontSize: '14px',
            color: '#aaaaaa'
          });

          // キーボード入力
          this.input.keyboard?.on('keydown-SPACE', () => this.spawnAlly());
          this.input.keyboard?.on('keydown-E', () => this.spawnEnemy());
          this.input.keyboard?.on('keydown-R', () => this.resetScene());

          // 初期配置
          this.spawnAlly();
          this.time.delayedCall(500, () => {
            for (let i = 0; i < 3; i++) {
              this.spawnEnemy();
            }
          });

          onLoaded();
          onLog(`${this.unitDef.name} をロードしました`);
        }

        spawnAlly() {
          const unit = new Unit(
            this,
            150,
            this.groundY,
            this.unitDef,
            'ally',
            800
          );
          this.allyUnits.push(unit);
          onLog(`味方 ${this.unitDef.name} を召喚`);

          if (this.unitDef.skill) {
            onLog(`スキル: ${this.unitDef.skill.nameJa} (${this.unitDef.skill.trigger})`);
          }
        }

        spawnEnemy() {
          const enemyDefs = ['n_slime', 'n_goblin', 'n_mushroom'];
          const randomId = enemyDefs[Math.floor(Math.random() * enemyDefs.length)];
          const enemyDef = unitsModule.allies.find(u => u.id === randomId);

          if (enemyDef) {
            const x = 500 + Math.random() * 200;
            const tankEnemyDef = {
              ...enemyDef,
              maxHp: 5000,
              speed: 20,
            };
            const enemy = new Unit(
              this,
              x,
              this.groundY,
              tankEnemyDef,
              'enemy',
              800
            );
            this.enemyUnits.push(enemy);
            onLog(`敵 ${enemyDef.name} を召喚 (x=${Math.floor(x)})`);
          }
        }

        resetScene() {
          this.allyUnits.forEach(u => u.destroy());
          this.enemyUnits.forEach(u => u.destroy());
          this.allyUnits = [];
          this.enemyUnits = [];
          onLog('シーンをリセット');

          this.spawnAlly();
          this.time.delayedCall(500, () => {
            for (let i = 0; i < 3; i++) {
              this.spawnEnemy();
            }
          });
        }

        update(_time: number, delta: number) {
          this.allyUnits = this.allyUnits.filter(u => u.active);
          this.enemyUnits = this.enemyUnits.filter(u => u.active);

          (this as any).allyUnits = this.allyUnits;
          (this as any).enemyUnits = this.enemyUnits;

          this.allyUnits.forEach(unit => {
            unit.update(delta);
          });

          this.enemyUnits.forEach(unit => {
            unit.update(delta);
          });
        }
      }

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current!,
        width: 800,
        height: 400,
        backgroundColor: '#1a1a2e',
        scene: SkillTestScene,
        physics: {
          default: 'arcade',
          arcade: { debug: false }
        }
      };

      gameRef.current = new Phaser.Game(config);
    };

    initPhaser();

    return () => {
      cancelled = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [selectedUnitId, onLog, onLoaded]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded overflow-hidden border-2 border-amber-400"
      style={{ height: 400 }}
    />
  );
}
