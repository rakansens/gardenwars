import type { Rarity } from '@/data/types';

/**
 * ユニットIDとレアリティからスプライトパスを取得
 * 新しいフォルダ構造:
 * - /assets/sprites/allies/{rarity}/{id}.webp - 味方ユニット
 * - /assets/sprites/enemies/{id}.webp - 敵ユニット
 * - /assets/sprites/bosses/{id}.webp - ボス
 * - /assets/sprites/common/{id}.webp - 城など共通アセット
 * - /assets/sprites/sheets/{id}_sheet.webp - スプライトシート
 */
export function getSpritePath(id: string, rarity?: Rarity): string {
    if (id.startsWith('enemy_')) {
        return `/assets/sprites/enemies/${id}.webp`;
    }
    if (id.startsWith('boss_')) {
        return `/assets/sprites/bosses/${id}.webp`;
    }
    if (id.startsWith('castle_')) {
        return `/assets/sprites/common/${id}.webp`;
    }
    // 味方ユニットはレアリティ別フォルダ
    if (rarity) {
        return `/assets/sprites/allies/${rarity}/${id}.webp`;
    }
    // レアリティ不明の場合はフォールバック
    return `/assets/sprites/sheets/${id}`;
}

/**
 * スプライトシートのパスを取得
 */
export function getSheetPath(id: string): { image: string; json: string } {
    return {
        image: `/assets/sprites/sheets/${id}_sheet.webp`,
        json: `/assets/sprites/sheets/${id}_sheet.json`
    };
}
