"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import PageHeader from "@/components/layout/PageHeader";
import AreaCard from "@/components/math-battle/AreaCard";
import { mathBattleAreas } from "@/data/math-battle";
import { useMathBattleStore } from "@/store/mathBattleStore";

export default function MathBattlePage() {
  const { t } = useLanguage();
  const totalStars = useMathBattleStore(state => state.getTotalStars());

  return (
    <main className="min-h-screen">
      <PageHeader title={t('mathBattle.title')} backHref="/" />

      <div className="container">
        {/* 総合進行状況 */}
        <div className="card mb-6 text-center">
          <div className="text-sm font-semibold text-amber-700/70 dark:text-amber-300/70 mb-2">
            {t('mathBattle.totalStars')}
          </div>
          <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">
            ⭐ {totalStars}
          </div>
        </div>

        {/* 説明 */}
        <div className="card mb-6">
          <h2 className="text-lg font-bold text-amber-900 dark:text-white mb-3">
            📚 {t('mathBattle.howToPlay')}
          </h2>
          <ul className="text-amber-700/80 dark:text-slate-300/80 text-sm space-y-2">
            <li>• {t('mathBattle.rule1')}</li>
            <li>• {t('mathBattle.rule2')}</li>
            <li>• {t('mathBattle.rule3')}</li>
            <li>• {t('mathBattle.rule4')}</li>
          </ul>
        </div>

        {/* エリア一覧 */}
        <h2 className="text-xl font-bold text-amber-900 dark:text-white mb-4">
          🗺️ {t('mathBattle.selectArea')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mathBattleAreas.map(area => (
            <AreaCard key={area.id} area={area} />
          ))}
        </div>
      </div>
    </main>
  );
}
