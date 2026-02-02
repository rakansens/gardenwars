'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { allies } from '@/data/units';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

// Phaserを使うコンポーネントはSSRを無効化
const SkillTestGame = dynamic(() => import('./SkillTestGame'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-gray-800 rounded border-2 border-amber-400">
      <div className="text-2xl animate-bounce">🎮 Loading...</div>
    </div>
  ),
});

export default function SkillTestPage() {
  const { language, t } = useLanguage();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('ur_jade_dragon');
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  // スキル持ちURユニットのみ
  const skillUnits = allies.filter(u => u.rarity === 'UR' && u.skill);

  // スキル名/説明を言語に応じて取得
  const getSkillName = (skill: { name: string; nameJa: string }) => language === 'ja' ? skill.nameJa : skill.name;
  const getSkillDesc = (skill: { description: string; descriptionJa: string }) => language === 'ja' ? skill.descriptionJa : skill.description;

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleLoaded = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">スキルエフェクト テスト</h1>
          <div className="flex gap-2">
            <Link href="/skill-check" className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
              スキル一覧
            </Link>
            <Link href="/" className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
              ホーム
            </Link>
          </div>
        </div>

        {/* ユニット選択 */}
        <div className="bg-black/30 rounded-lg p-4 mb-4">
          <label className="block text-sm mb-2">テストするユニットを選択:</label>
          <select
            value={selectedUnitId}
            onChange={(e) => {
              setSelectedUnitId(e.target.value);
              setIsLoading(true);
              setLogs([]);
            }}
            className="w-full px-4 py-2 rounded bg-gray-700 text-white"
          >
            {skillUnits.map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.skill?.icon} {unit.name} - {unit.skill && getSkillName(unit.skill)}
              </option>
            ))}
          </select>

          {/* 選択中のスキル情報 */}
          {skillUnits.find(u => u.id === selectedUnitId)?.skill && (
            <div className="mt-3 p-3 bg-purple-900/50 rounded">
              {(() => {
                const unit = skillUnits.find(u => u.id === selectedUnitId)!;
                const skill = unit.skill!;
                return (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{skill.icon}</span>
                      <span className="font-bold">{getSkillName(skill)}</span>
                      <span className="text-sm text-gray-400">({skill.name})</span>
                    </div>
                    <p className="text-sm text-gray-300">{getSkillDesc(skill)}</p>
                    <div className="text-xs text-gray-500 mt-1">
                      {t("skill_trigger")}: {t(`skill_trigger_${skill.trigger}`)}
                      {skill.triggerChance && ` | ${t("skill_chance")}: ${skill.triggerChance * 100}%`}
                      {skill.triggerIntervalMs && ` | ${t("skill_trigger_interval")}: ${skill.triggerIntervalMs / 1000}s`}
                      {skill.triggerThreshold && ` | ${t("skill_threshold")}: ${skill.triggerThreshold * 100}%`}
                      {skill.cooldownMs > 0 && ` | ${t("skill_cooldown")}: ${skill.cooldownMs / 1000}s`}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ゲーム画面 */}
        <div className="bg-black/30 rounded-lg p-4 mb-4">
          <SkillTestGame
            selectedUnitId={selectedUnitId}
            onLog={addLog}
            onLoaded={handleLoaded}
          />
          {isLoading && (
            <div className="text-center text-gray-400 mt-2">読み込み中...</div>
          )}
        </div>

        {/* 操作説明 */}
        <div className="bg-black/30 rounded-lg p-4 mb-4">
          <h3 className="font-bold mb-2">操作方法</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-800 p-2 rounded">
              <kbd className="bg-gray-600 px-2 py-1 rounded">SPACE</kbd>
              <span className="ml-2">味方ユニット追加</span>
            </div>
            <div className="bg-gray-800 p-2 rounded">
              <kbd className="bg-gray-600 px-2 py-1 rounded">E</kbd>
              <span className="ml-2">敵ユニット追加</span>
            </div>
            <div className="bg-gray-800 p-2 rounded">
              <kbd className="bg-gray-600 px-2 py-1 rounded">R</kbd>
              <span className="ml-2">リセット</span>
            </div>
          </div>
        </div>

        {/* ログ */}
        <div className="bg-black/30 rounded-lg p-4">
          <h3 className="font-bold mb-2">ログ</h3>
          <div className="bg-black/50 rounded p-2 h-40 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-500">ログなし</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-gray-300">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
