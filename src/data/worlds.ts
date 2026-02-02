import type { WorldDefinition } from "./types";

/**
 * ワールド定義
 * - 地球 (Earth): デフォルト解放
 * - 地獄 (Inferno): 地球のBoss全クリアで解放
 * - 冥界 (Underworld): 地獄のBoss全クリアで解放
 */
export const worlds: WorldDefinition[] = [
    {
        id: "world1",
        nameKey: "world1_name",
        subtitleKey: "world1_subtitle",
        icon: "🌍",
        unlockedByDefault: true,
        gradient: "from-green-400 to-emerald-600",
        banner: "/assets/stages/tutorial_banner.webp",
    },
    {
        id: "world2",
        nameKey: "world2_name",
        subtitleKey: "world2_subtitle",
        icon: "🔥",
        unlockedByDefault: false,
        requiredBossStages: [
            "boss_stage_1",
            "boss_stage_2",
            "boss_stage_3",
            "boss_stage_4",
            "boss_stage_5",
        ],
        gradient: "from-orange-500 to-red-700",
        banner: "/assets/stages/inferno_boss_banner.webp",
    },
    {
        id: "world3",
        nameKey: "world3_name",
        subtitleKey: "world3_subtitle",
        icon: "💀",
        unlockedByDefault: false,
        // 地獄のボスステージ全クリアで解放
        requiredBossStages: [
            "inferno_boss_1",
            "inferno_boss_2",
            "inferno_boss_3",
            "inferno_boss_4",
            "inferno_boss_5",
        ],
        gradient: "from-purple-600 to-gray-900",
        banner: "/assets/stages/hard_banner.webp",
    },
];

/**
 * ワールドIDからワールド定義を取得
 */
export function getWorldById(worldId: string): WorldDefinition | undefined {
    return worlds.find((w) => w.id === worldId);
}

/**
 * デフォルトワールドを取得
 */
export function getDefaultWorld(): WorldDefinition {
    return worlds[0];
}

export default worlds;
