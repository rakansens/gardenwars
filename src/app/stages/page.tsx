"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import stagesData from "@/data/stages.json";
import type { StageDefinition } from "@/data/types";

const stages = stagesData as StageDefinition[];

export default function StagesPage() {
    const router = useRouter();

    const handleSelectStage = (stageId: string) => {
        router.push(`/battle/${stageId}`);
    };

    return (
        <main className="min-h-screen p-8">
            {/* ヘッダー */}
            <div className="page-header mb-8">
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-blue-400 hover:text-blue-300">
                        ← ホームへ
                    </Link>
                    <h1 className="text-3xl font-bold">ステージ選択</h1>
                    <Link href="/team" className="text-yellow-400 hover:text-yellow-300">
                        編成 →
                    </Link>
                </div>
            </div>

            {/* ステージ一覧 */}
            <div className="container">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {stages.map((stage, index) => (
                        <div
                            key={stage.id}
                            className="stage-card"
                            onClick={() => handleSelectStage(stage.id)}
                        >
                            {/* ステージ番号 */}
                            <div className="text-sm text-gray-400 mb-2">
                                Stage {index + 1}
                            </div>

                            {/* ステージ名 */}
                            <h2 className="text-2xl font-bold mb-2 text-white">
                                {stage.name}
                            </h2>

                            {/* 説明 */}
                            <p className="text-gray-400 mb-4">{stage.description}</p>

                            {/* 情報 */}
                            <div className="flex justify-between text-sm">
                                <span className="text-blue-400">
                                    🏰 敵城HP: {stage.enemyCastleHp}
                                </span>
                                <span className="text-yellow-400">
                                    💰 報酬: {stage.reward.coins}
                                </span>
                            </div>

                            {/* Wave数 */}
                            <div className="mt-4 text-sm text-gray-500">
                                Wave数: {stage.enemyWaves.length}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ヒント */}
            <div className="container mt-8">
                <div className="card text-center text-gray-400">
                    💡 ステージをタップしてバトル開始！
                </div>
            </div>
        </main>
    );
}
