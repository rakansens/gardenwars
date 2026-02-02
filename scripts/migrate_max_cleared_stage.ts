/**
 * 既存プレイヤーの max_cleared_stage_id をマイグレーションするスクリプト
 *
 * 実行方法: npx ts-node scripts/migrate_max_cleared_stage.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// .env.local を読み込む
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ステージの優先順位を定義（ワールド順 + 難易度順 + ステージ番号）
const WORLD_ORDER: Record<string, number> = {
    "world1": 1,
    "world2": 2,
    "world3": 3,
};

const DIFFICULTY_ORDER: Record<string, number> = {
    "tutorial": 1,
    "easy": 2,
    "normal": 3,
    "hard": 4,
    "extreme": 5,
    "boss": 6,
    "special": 7,
    "inferno": 8,
};

// ステージIDから優先度スコアを計算
function getStageScore(stageId: string): number {
    // World 2 (Inferno) stages: inferno_1, inferno_2, etc.
    if (stageId.startsWith("inferno_")) {
        const num = parseInt(stageId.replace("inferno_", ""), 10) || 0;
        return WORLD_ORDER["world2"] * 10000 + DIFFICULTY_ORDER["inferno"] * 100 + num;
    }

    // World 3 (Underworld) stages: underworld_1, etc.
    if (stageId.startsWith("underworld_")) {
        const num = parseInt(stageId.replace("underworld_", ""), 10) || 0;
        return WORLD_ORDER["world3"] * 10000 + 100 + num;
    }

    // Boss stages: boss_stage_1, etc.
    if (stageId.startsWith("boss_stage_")) {
        const num = parseInt(stageId.replace("boss_stage_", ""), 10) || 0;
        return WORLD_ORDER["world1"] * 10000 + DIFFICULTY_ORDER["boss"] * 100 + num;
    }

    // Special stages: special_1, etc.
    if (stageId.startsWith("special_")) {
        const num = parseInt(stageId.replace("special_", ""), 10) || 0;
        return WORLD_ORDER["world1"] * 10000 + DIFFICULTY_ORDER["special"] * 100 + num;
    }

    // Tutorial stages: tutorial_1, etc.
    if (stageId.startsWith("tutorial_")) {
        const num = parseInt(stageId.replace("tutorial_", ""), 10) || 0;
        return WORLD_ORDER["world1"] * 10000 + DIFFICULTY_ORDER["tutorial"] * 100 + num;
    }

    // Normal stages: stage_1, stage_2, etc.
    if (stageId.startsWith("stage_")) {
        const num = parseInt(stageId.replace("stage_", ""), 10) || 0;
        // Determine difficulty based on stage number
        let difficulty = "easy";
        if (num <= 5) difficulty = "easy";
        else if (num <= 10) difficulty = "normal";
        else if (num <= 15) difficulty = "hard";
        else difficulty = "extreme";

        return WORLD_ORDER["world1"] * 10000 + DIFFICULTY_ORDER[difficulty] * 100 + num;
    }

    // Unknown stage format
    return 0;
}

// クリア済みステージから最高ステージを取得
function getHighestStage(clearedStages: string[]): string | null {
    if (!clearedStages || clearedStages.length === 0) return null;

    let highestStage: string | null = null;
    let highestScore = -1;

    for (const stageId of clearedStages) {
        const score = getStageScore(stageId);
        if (score > highestScore) {
            highestScore = score;
            highestStage = stageId;
        }
    }

    return highestStage;
}

async function migrate() {
    console.log("🚀 Starting migration of max_cleared_stage_id...\n");

    // 1. 全プレイヤーデータを取得
    const { data: playerDataList, error: fetchError } = await supabase
        .from("player_data")
        .select("player_id, cleared_stages");

    if (fetchError) {
        console.error("Failed to fetch player data:", fetchError);
        process.exit(1);
    }

    if (!playerDataList || playerDataList.length === 0) {
        console.log("No player data found.");
        return;
    }

    console.log(`Found ${playerDataList.length} players to process.\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const playerData of playerDataList) {
        const playerId = playerData.player_id;
        const clearedStages = (playerData.cleared_stages as string[]) || [];

        if (!playerId) {
            skipped++;
            continue;
        }

        const highestStage = getHighestStage(clearedStages);

        if (!highestStage) {
            console.log(`  ⏭️  ${playerId.slice(0, 8)}... - No cleared stages`);
            skipped++;
            continue;
        }

        // 2. rankingsテーブルを更新
        const { error: updateError } = await supabase
            .from("rankings")
            .update({ max_cleared_stage_id: highestStage })
            .eq("player_id", playerId);

        if (updateError) {
            console.error(`  ❌ ${playerId.slice(0, 8)}... - Update failed:`, updateError.message);
            errors++;
        } else {
            console.log(`  ✅ ${playerId.slice(0, 8)}... - ${highestStage}`);
            updated++;
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log("=".repeat(50));
    console.log("\n🎉 Migration complete!");
}

migrate().catch(console.error);
