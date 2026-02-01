"use client";

import { useEffect, useRef, useMemo } from "react";
import Phaser from "phaser";
import { RealtimeBattleScene } from "@/game/scenes/RealtimeBattleScene";
import { NetworkManager } from "@/game/systems/NetworkManager";
import type { RealtimeState } from "@/hooks/useRealtime";

// ============================================
// GameContainer - Phaserゲームのラッパー
// ============================================

interface Props {
  state: RealtimeState;
  selectedTeam: string[];
  onSummon: (unitId: string) => void;
  onUpgradeCost: () => void;
  onSpeedVote: (enabled: boolean) => void;
}

export default function GameContainer({ state, selectedTeam, onSummon, onUpgradeCost, onSpeedVote }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // NetworkManagerを同期的に作成（再作成しない）
  const networkManager = useMemo(() => new NetworkManager(), []);

  // クリーンアップ時にNetworkManagerをリセット
  useEffect(() => {
    return () => {
      networkManager.reset();
    };
  }, [networkManager]);

  // 状態をNetworkManagerに反映
  useEffect(() => {
    // セッション情報
    if (state.mySessionId) {
      networkManager.setSession(state.mySessionId, state.mySide);
    }

    // フェーズ
    networkManager.setPhase(state.phase);
    networkManager.setCountdown(state.countdown);
    networkManager.setGameTime(state.gameTime);
    networkManager.setStageLength(state.stageLength);
    networkManager.setGameSpeed(state.gameSpeed);
    networkManager.setSpeedVotes(state.speedVotes);

    // プレイヤー
    if (state.myPlayer) {
      networkManager.updatePlayer(state.myPlayer, true);
    }
    if (state.opponent) {
      networkManager.updatePlayer(state.opponent, false);
    }

    // ユニット
    const currentUnitIds = new Set(state.units.map(u => u.instanceId));

    // 既存ユニットの更新
    state.units.forEach(unit => {
      if (networkManager.getUnit(unit.instanceId)) {
        networkManager.updateUnit(unit);
      } else {
        networkManager.addUnit(unit);
      }
    });

    // 削除されたユニットを検知
    networkManager.getAllUnits().forEach(unit => {
      if (!currentUnitIds.has(unit.instanceId)) {
        networkManager.removeUnit(unit.instanceId);
      }
    });

    // 勝敗
    if (state.winnerId && state.winReason) {
      networkManager.setWinner(state.winnerId, state.winReason);
    }
  }, [state, networkManager]);

  // Phaserゲーム作成
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    // モバイル判定
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const config: Phaser.Types.Core.GameConfig = {
      type: isMobile ? Phaser.CANVAS : Phaser.AUTO,
      parent: containerRef.current,
      width: 1200,
      height: 675,
      backgroundColor: "#1a1a2e",
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: false,
      },
      input: {
        activePointers: 3,
        touch: { capture: true },
      },
      render: {
        pixelArt: false,
        antialias: true,
      },
      scene: [RealtimeBattleScene],
    };

    gameRef.current = new Phaser.Game(config);

    // シーン開始（ready前にイベントが発火するケースに備える）
    let started = false;
    const startScene = () => {
      if (started || !gameRef.current) return;
      started = true;
      gameRef.current.scene.start("RealtimeBattleScene", {
        networkManager,
        deck: selectedTeam,
        onSummon,
        onUpgradeCost,
        onSpeedVote,
      });
    };

    if (gameRef.current.isBooted) {
      startScene();
    } else {
      gameRef.current.events.once(Phaser.Core.Events.READY, startScene);
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [networkManager, selectedTeam, onSummon, onUpgradeCost, onSpeedVote]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center"
    />
  );
}
