'use client';

import { useState } from 'react';
import { allies } from '@/data/units';
import { SKILL_DEFINITIONS } from '@/data/skills';
import UnitAnimationPreview from '@/components/ui/UnitAnimationPreview';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SkillCheckPage() {
  const { language, t } = useLanguage();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  // スキル名/説明を言語に応じて取得するヘルパー
  const getSkillName = (skill: { name: string; nameJa: string }) => language === 'ja' ? skill.nameJa : skill.name;
  const getSkillDesc = (skill: { description: string; descriptionJa: string }) => language === 'ja' ? skill.descriptionJa : skill.description;

  // URユニットのみ抽出
  const urUnits = allies.filter(u => u.rarity === 'UR');

  // スキル別にグループ化
  const skillGroups: Record<string, typeof urUnits> = {};
  const noSkillUnits: typeof urUnits = [];

  urUnits.forEach(unit => {
    if (unit.skill) {
      const skillId = unit.skill.id;
      if (!skillGroups[skillId]) {
        skillGroups[skillId] = [];
      }
      skillGroups[skillId].push(unit);
    } else {
      noSkillUnits.push(unit);
    }
  });

  // フィルタリング
  const filteredUnits = selectedSkill
    ? urUnits.filter(u => u.skill?.id === selectedSkill)
    : urUnits;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">URユニット スキル確認</h1>
          <Link href="/" className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
            戻る
          </Link>
        </div>

        {/* 統計 */}
        <div className="bg-black/30 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-yellow-400">{urUnits.length}</div>
              <div className="text-sm text-gray-400">URユニット総数</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-400">{urUnits.length - noSkillUnits.length}</div>
              <div className="text-sm text-gray-400">スキル付与済み</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-400">{noSkillUnits.length}</div>
              <div className="text-sm text-gray-400">スキルなし</div>
            </div>
          </div>
        </div>

        {/* コントロール */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* 表示モード切替 */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded ${viewMode === 'grid' ? 'bg-amber-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              グリッド表示
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded ${viewMode === 'table' ? 'bg-amber-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              テーブル表示
            </button>
          </div>

          {/* スキルフィルター */}
          <select
            value={selectedSkill || ''}
            onChange={(e) => setSelectedSkill(e.target.value || null)}
            className="px-4 py-2 rounded bg-gray-700 text-white"
          >
            <option value="">全スキル</option>
            {Object.entries(SKILL_DEFINITIONS).map(([id, skill]) => (
              <option key={id} value={id}>
                {skill.icon} {getSkillName(skill)} ({skillGroups[id]?.length || 0})
              </option>
            ))}
          </select>
        </div>

        {/* グリッド表示 */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredUnits.map(unit => (
              <div
                key={unit.id}
                className="bg-black/40 rounded-lg p-3 border border-yellow-500/30"
              >
                {/* アニメーションプレビュー */}
                <div className="flex justify-center mb-2">
                  <UnitAnimationPreview
                    unitId={unit.id}
                    width={150}
                    height={150}
                    compact={false}
                    defaultAnimation="attack"
                    backgroundColor={0x1a1a2e}
                  />
                </div>

                {/* ユニット情報 */}
                <div className="text-center">
                  <div className="text-yellow-400 font-bold text-sm">UR</div>
                  <div className="font-bold">{unit.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{unit.id}</div>
                </div>

                {/* スキル情報 */}
                {unit.skill ? (
                  <div className="mt-2 bg-purple-900/50 rounded p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{unit.skill.icon}</span>
                      <span className="font-bold text-sm">{getSkillName(unit.skill)}</span>
                    </div>
                    <div className="text-xs text-gray-300 mt-1">
                      {getSkillDesc(unit.skill)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t("skill_trigger")}: {t(`skill_trigger_${unit.skill.trigger}`)}
                      {unit.skill.triggerChance && ` (${unit.skill.triggerChance * 100}%)`}
                      {unit.skill.triggerIntervalMs && ` (${unit.skill.triggerIntervalMs / 1000}s)`}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 bg-red-900/30 rounded p-2 text-center text-red-400 text-sm">
                    {language === 'ja' ? 'スキルなし' : 'No skill'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* テーブル表示 */}
        {viewMode === 'table' && (
          <div className="bg-black/30 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-black/50">
                <tr>
                  <th className="px-4 py-2 text-left">プレビュー</th>
                  <th className="px-4 py-2 text-left">ユニット</th>
                  <th className="px-4 py-2 text-left">スキル</th>
                  <th className="px-4 py-2 text-left">効果</th>
                  <th className="px-4 py-2 text-left">発動条件</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.map((unit, i) => (
                  <tr key={unit.id} className={i % 2 === 0 ? 'bg-white/5' : ''}>
                    <td className="px-4 py-2">
                      <UnitAnimationPreview
                        unitId={unit.id}
                        width={80}
                        height={80}
                        compact={true}
                        defaultAnimation="idle"
                        transparentBackground={true}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-bold">{unit.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{unit.id}</div>
                    </td>
                    <td className="px-4 py-2">
                      {unit.skill ? (
                        <span className="flex items-center gap-1">
                          <span className="text-lg">{unit.skill.icon}</span>
                          <span>{getSkillName(unit.skill)}</span>
                        </span>
                      ) : (
                        <span className="text-red-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-300 max-w-xs">
                      {unit.skill ? getSkillDesc(unit.skill) : '-'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {unit.skill ? (
                        <>
                          <div>{unit.skill.trigger}</div>
                          {unit.skill.triggerChance && <div>確率: {unit.skill.triggerChance * 100}%</div>}
                          {unit.skill.triggerIntervalMs && <div>間隔: {unit.skill.triggerIntervalMs / 1000}秒</div>}
                          {unit.skill.triggerThreshold && <div>HP: {unit.skill.triggerThreshold * 100}%以下</div>}
                          {unit.skill.cooldownMs > 0 && <div>CD: {unit.skill.cooldownMs / 1000}秒</div>}
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* スキル別サマリー */}
        <h2 className="text-xl font-bold mb-4 mt-8">スキル別サマリー</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(SKILL_DEFINITIONS).map(([skillId, skill]) => {
            const units = skillGroups[skillId] || [];
            if (units.length === 0) return null;

            return (
              <div key={skillId} className="bg-black/30 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{skill.icon}</span>
                  <div>
                    <h3 className="font-bold">{getSkillName(skill)}</h3>
                    <p className="text-sm text-gray-400">{skill.name}</p>
                  </div>
                  <div className="ml-auto bg-amber-500/30 px-3 py-1 rounded-full text-sm">
                    {units.length} {language === 'ja' ? '体' : 'units'}
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-2">{getSkillDesc(skill)}</p>
                <div className="flex flex-wrap gap-1">
                  {units.map(u => (
                    <span key={u.id} className="text-xs bg-yellow-600/30 px-2 py-0.5 rounded">
                      {u.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
