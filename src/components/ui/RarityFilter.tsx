"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { Rarity } from "@/data/types";

export type RarityFilterValue = Rarity | "ALL";

interface RarityTab {
  key: RarityFilterValue;
  label: string;
  color: string;
  icon?: string;
}

const DEFAULT_TABS: RarityTab[] = [
  { key: "ALL", label: "ALL", color: "bg-gradient-to-r from-gray-500 to-gray-600", icon: "📋" },
  { key: "N", label: "N", color: "bg-gradient-to-r from-gray-400 to-gray-500", icon: "⚪" },
  { key: "R", label: "R", color: "bg-gradient-to-r from-blue-400 to-blue-600", icon: "🔵" },
  { key: "SR", label: "SR", color: "bg-gradient-to-r from-purple-400 to-purple-600", icon: "🟣" },
  { key: "SSR", label: "SSR", color: "bg-gradient-to-r from-amber-400 to-amber-600", icon: "🟡" },
  { key: "UR", label: "UR", color: "bg-gradient-to-r from-rose-400 to-rose-600", icon: "🔴" },
];

// コンパクト版（アイコンなし）
const COMPACT_TABS: RarityTab[] = [
  { key: "ALL", label: "ALL", color: "bg-gray-500" },
  { key: "N", label: "N", color: "bg-gray-400" },
  { key: "R", label: "R", color: "bg-blue-500" },
  { key: "SR", label: "SR", color: "bg-purple-500" },
  { key: "SSR", label: "SSR", color: "bg-amber-500" },
  { key: "UR", label: "UR", color: "bg-rose-500" },
];

export interface RarityFilterProps {
  value: RarityFilterValue;
  onChange: (value: RarityFilterValue) => void;
  /** 各レアリティのカウントを表示する場合に指定 */
  counts?: Partial<Record<RarityFilterValue, { total: number; collected?: number }>>;
  /** コンパクト表示（アイコンなし、小さいサイズ） */
  compact?: boolean;
  /** 表示するレアリティを制限 */
  rarities?: RarityFilterValue[];
  /** カスタムクラス */
  className?: string;
}

export default function RarityFilter({
  value,
  onChange,
  counts,
  compact = false,
  rarities,
  className = "",
}: RarityFilterProps) {
  const { t } = useLanguage();

  const baseTabs = compact ? COMPACT_TABS : DEFAULT_TABS;
  const tabs = rarities
    ? baseTabs.filter(tab => rarities.includes(tab.key))
    : baseTabs;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 overflow-x-auto pb-1 ${className}`}>
        {tabs.map(tab => {
          const isSelected = value === tab.key;
          const count = counts?.[tab.key];

          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`
                px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all whitespace-nowrap min-h-[32px]
                ${isSelected
                  ? `${tab.color} text-white shadow-md`
                  : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 active:scale-95"
                }
              `}
            >
              {tab.label}
              {count && (
                <span className="ml-1 opacity-80">
                  {count.collected !== undefined
                    ? `${count.collected}/${count.total}`
                    : count.total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {tabs.map(tab => {
        const isSelected = value === tab.key;
        const count = counts?.[tab.key];

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`
              px-3 py-2 md:px-4 md:py-2.5 rounded-xl font-bold text-sm md:text-base transition-all min-h-[44px]
              flex items-center gap-1.5 active:scale-95
              ${isSelected
                ? `${tab.color} text-white shadow-lg scale-105`
                : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-slate-600"
              }
            `}
          >
            {tab.icon && <span className="text-base">{tab.icon}</span>}
            <span>{tab.label}</span>
            {count && (
              <span className={`text-xs ${isSelected ? 'opacity-90' : 'opacity-70'}`}>
                ({count.collected !== undefined
                  ? `${count.collected}/${count.total}`
                  : count.total})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
