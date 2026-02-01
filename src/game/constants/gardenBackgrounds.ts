// ガーデン背景の定義（Phaserに依存しない）

export const GARDEN_BACKGROUNDS = [
    { id: 'garden_main', name: '🌳 メイン', nameKey: 'bg_main' },
    { id: 'garden_spring', name: '🌸 春', nameKey: 'bg_spring' },
    { id: 'garden_summer', name: '🌻 夏', nameKey: 'bg_summer' },
    { id: 'garden_autumn', name: '🍂 秋', nameKey: 'bg_autumn' },
    { id: 'garden_winter', name: '❄️ 冬', nameKey: 'bg_winter' },
] as const;

export type GardenBackgroundId = typeof GARDEN_BACKGROUNDS[number]['id'];
