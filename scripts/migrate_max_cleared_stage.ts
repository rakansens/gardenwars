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

// ステージIDから進捗スコアを計算（ワールド順 + ステージ番号順）
// 難易度ではなく、実際のゲーム進行順を反映
function getStageScore(stageId: string): number {
    // World 3 (Underworld) stages: underworld_1, etc. - 最高優先度
    if (stageId.startsWith("underworld_")) {
        const num = parseInt(stageId.replace("underworld_", ""), 10) || 0;
        return 30000 + num;
    }

    // World 2 (Inferno) stages: inferno_1, inferno_2, etc.
    if (stageId.startsWith("inferno_")) {
        const num = parseInt(stageId.replace("inferno_", ""), 10) || 0;
        return 20000 + num;
    }

    // World 1 - Normal stages: stage_1, stage_2, etc.
    // これがメインの進行ライン
    if (stageId.startsWith("stage_")) {
        const num = parseInt(stageId.replace("stage_", ""), 10) || 0;
        return 10000 + num;
    }

    // Boss/Special/Tutorial は進行度としては低い（サイドコンテンツ）
    if (stageId.startsWith("boss_stage_")) {
        const num = parseInt(stageId.replace("boss_stage_", ""), 10) || 0;
        return 5000 + num;
    }

    if (stageId.startsWith("special_")) {
        const num = parseInt(stageId.replace("special_", ""), 10) || 0;
        return 4000 + num;
    }

    if (stageId.startsWith("tutorial_")) {
        const num = parseInt(stageId.replace("tutorial_", ""), 10) || 0;
        return 1000 + num;
    }

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
