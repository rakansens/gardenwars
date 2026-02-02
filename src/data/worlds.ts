import type { WorldDefinition } from "./types";

/**
 * ワールド定義
 * - World 1 (草原): デフォルト解放
 * - World 2 (火山): World 1のBoss全クリアで解放
 * - World 3 (氷河): World 2のBoss全クリアで解放
 */
export const worlds: WorldDefinition[] = [
    {
        id: "world1",
        nameKey: "world1_name",
        subtitleKey: "world1_subtitle",
        icon: "🌿",
        unlockedByDefault: true,
        gradient: "from-green-400 to-emerald-600",
        banner: "/assets/stages/tutorial_banner.webp",
    },
    {
        id: "world2",
        nameKey: "world2_name",
        subtitleKey: "world2_subtitle",
        icon: "🌋",
        unlockedByDefault: false,
        requiredBossStages: [
            "boss_stage_1",
            "boss_stage_2",
            "boss_stage_3",
            "boss_stage_4",
            "boss_stage_5",
        ],
        gradient: "from-orange-500 to-red-700",
        banner: "/assets/stages/extreme_banner.webp",
    },
    {
        id: "world3",
        nameKey: "world3_name",
        subtitleKey: "world3_subtitle",
        icon: "❄️",
        unlockedByDefault: false,
        // World 2のボスステージ（将来追加）が解放条件
        // 現時点ではWorld 2のボスが未実装のため、World 1のボス全クリア + World 2ボス全クリアを条件とする予定
        requiredBossStages: [], // World 2のボス追加時に更新
        gradient: "from-cyan-400 to-blue-700",
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
