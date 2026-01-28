"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "ja";

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
    en: {
        // Common
        "home": "Home",
        "back_to_home": "← Home",
        "loading": "Loading...",
        "ok": "OK",
        "skip": "Skip",
        "next": "Next",
        "coins": "Coins",

        // Home
        "game_title": "🐱 Garden Wars 🐱",
        "game_subtitle": "Lead your cat army to victory!",
        "menu_stages": "⚔️ Stages",
        "menu_team": "🎖️ Team",
        "menu_gacha": "🎰 Gacha",
        "owned_coins": "Owned Coins",

        // Stages
        "stage_select": "Stage Select",
        "stage": "Stage",
        "enemies": "Enemies",
        "waves": "Waves",
        "enemy_castle_hp": "Enemy Castle",
        "ally_castle_hp": "Your Castle",
        "reward": "Reward",
        "difficulty": "Difficulty",
        "stage_hint": "💡 Tap a stage to start battle! Prepare your team first!",
        "encounter_units": "Enemy Units",

        // Stage names
        "stage_1_name": "Grassland Battle",
        "stage_1_desc": "Your first battlefield. Repel the enemy attack!",
        "stage_2_name": "Forest Encounter",
        "stage_2_desc": "Wolves appeared! Watch out for tough enemies!",
        "stage_3_name": "Desert Showdown",
        "stage_3_desc": "Hordes are coming! Hold the line!",
        "stage_4_name": "Sunset Hill",
        "stage_4_desc": "Settle this before sundown!",
        "stage_5_name": "Dark Cave",
        "stage_5_desc": "Enemies lurking in darkness! Stay alert!",
        "stage_6_name": "Snowfield Battle",
        "stage_6_desc": "Battle in the frozen land. Watch your HP!",
        "stage_7_name": "Volcano Fortress",
        "stage_7_desc": "Final showdown in scorching heat! Give it your all!",
        "stage_8_name": "Demon Castle",
        "stage_8_desc": "The strongest enemy awaits! Seize victory!",
        "stage_9_name": "Zombie Rush",
        "stage_9_desc": "⚠️ EXTREME! Endless hordes of enemies!",
        "stage_10_name": "Nightmare Abyss",
        "stage_10_desc": "💀 INSANE! SSR bosses everywhere!",
        "stage_11_name": "Boss Rush",
        "stage_11_desc": "🔥 HELL! Non-stop boss battles!",
        "stage_12_name": "IMPOSSIBLE",
        "stage_12_desc": "☠️ DEATH! 200+ enemies. Good luck.",
        "boss_stage_1_name": "🧑 BOSS: Giant Man",
        "boss_stage_1_desc": "🦍 MEGA BOSS! Defeat the giant!",
        "boss_stage_2_name": "🎸 BOSS: BigLemmon",
        "boss_stage_2_desc": "🔥 LEGENDARY! A massive rockstar!",
        "boss_stage_3_name": "👩 BOSS: BIGMAM",
        "boss_stage_3_desc": "☠️ ULTIMATE! The final nightmare!",
        "boss_stage_4_name": "💃 BOSS: My name is NIKA!!",
        "boss_stage_4_desc": "🔥 LEGENDARY! She's coming for you!",
        "boss_stage_5_name": "🌙 BOSS: MOOOOONA",
        "boss_stage_5_desc": "💜 ULTIMATE! The moon goddess awakens!",

        // Team
        "team": "Team",
        "team_title": "Team Setup",
        "team_members": "Deployment",
        "total_cost": "Total Cost",
        "to_stages": "Stages",
        "pull_gacha": "🎰 Pull Gacha",
        "deployment_members": "📋 Deployment",
        "owned_units": "Owned Units",
        "hp": "HP",
        "attack": "ATK",
        "range": "Range",
        "cost": "Cost",
        "selected": "✓ Selected",
        "ready_to_deploy": "⚔️ Ready to Deploy!",

        // Gacha
        "gacha": "🎰 Gacha",
        "unit_gacha": "🌟 Unit Gacha 🌟",
        "gacha_desc": "Spend coins to get new units! Same units stack for future fusion.",
        "single_pull": "Single Pull",
        "multi_pull": "10-Pull",
        "owned_units_gacha": "📦 Owned Units",
        "go_to_team": "📋 Go to Team",
        "gacha_result": "🎉 Gacha Result 🎉",
        "rates": "Rates",

        // Battle
        "victory": "Victory!",
        "defeat": "Defeat...",
        "reward_coins": "Reward",
        "back_to_stages": "Back to Stages",
        "retry": "Retry",

        // World Map
        "world_map": "World Map",
        "list": "List",
        "scroll_hint": "Scroll to explore",
        "battle_start": "Battle!",
        "close": "Close",
        "drops": "Drop Rewards",

        // Fusion
        "fusion": "Fusion",
        "fusion_desc": "Select 3 units to fuse! Higher rarity materials give better results!",
        "fusion_execute": "FUSE!",
        "fusion_result": "Fusion Complete!",
        "select_materials": "📦 Select Materials",
        "no_units": "No units available. Get some from Gacha first!",

        // Unit names
        "cat_warrior": "Cat Warrior",
        "cat_tank": "Tank Cat",
        "cat_archer": "Archer Cat",
        "cat_mage": "Mage Cat",
        "cat_ninja": "Ninja Cat",
        "ice_flower": "Ice Flower",
        "corn_fighter": "Corn",
        "block_slime": "Block",
        "sunflower": "Sunflower",
        "watermelon": "Watermelon",
        "corn_kid": "Corn Kid",
        "ribbon_girl": "Ribbon",
        "penguin_boy": "Penguin",
        "cinnamon_girl": "Yumemi",
        "enemy_dog": "Dog",
        "enemy_wolf": "Wolf",
        "enemy_crow": "Crow",
    },
    ja: {
        // Common
        "home": "ホーム",
        "back_to_home": "← ホームへ",
        "loading": "読み込み中...",
        "ok": "OK",
        "skip": "スキップ",
        "next": "次へ",
        "coins": "コイン",

        // Home
        "game_title": "🐱 Garden Wars 🐱",
        "game_subtitle": "にゃんこ軍団で敵を倒せ！",
        "menu_stages": "⚔️ ステージへ",
        "menu_team": "🎖️ 編成",
        "menu_gacha": "🎰 ガチャ",
        "owned_coins": "所持コイン",

        // Stages
        "stage_select": "ステージ選択",
        "stage": "ステージ",
        "enemies": "敵の数",
        "waves": "Wave",
        "enemy_castle_hp": "敵城HP",
        "ally_castle_hp": "自城HP",
        "reward": "報酬",
        "difficulty": "難易度",
        "stage_hint": "💡 ステージをタップしてバトル開始！編成を整えてから挑もう！",
        "encounter_units": "出現する敵",

        // Stage names
        "stage_1_name": "草原の戦い",
        "stage_1_desc": "はじめての戦場。敵の攻撃を退けよう！",
        "stage_2_name": "森の遭遇戦",
        "stage_2_desc": "オオカミが現れた！強敵に注意！",
        "stage_3_name": "荒野の決戦",
        "stage_3_desc": "大群が押し寄せる！持ちこたえろ！",
        "stage_4_name": "夕焼けの丘",
        "stage_4_desc": "日が暮れる前に決着をつけろ！",
        "stage_5_name": "暗闘の洞窟",
        "stage_5_desc": "暗闇から襲いかかる敵！油断するな！",
        "stage_6_name": "雪原の激戦",
        "stage_6_desc": "凍える大地での戦い。体力に注意！",
        "stage_7_name": "火山の要塞",
        "stage_7_desc": "灼熱の地での最終決戦！全力で挑め！",
        "stage_8_name": "魔王の城",
        "stage_8_desc": "最強の敵が待ち構える！勝利をつかめ！",
        "stage_9_name": "ゾンビラッシュ",
        "stage_9_desc": "⚠️ 激ムズ！敵の大群が止まらない！",
        "stage_10_name": "悪夢の深淵",
        "stage_10_desc": "💀 狂気級！SSRボスが大量出現！",
        "stage_11_name": "ボスラッシュ",
        "stage_11_desc": "🔥 地獄級！ボス連戦を生き延びろ！",
        "stage_12_name": "絶対不可能",
        "stage_12_desc": "☠️ 死神級！敵200体以上。健闘を祈る。",
        "boss_stage_1_name": "🧑 BOSS: Giant Man",
        "boss_stage_1_desc": "🦍 超巨大ボス！巨人を倒せ！",
        "boss_stage_2_name": "🎸 BOSS: BigLemmon",
        "boss_stage_2_desc": "🔥 伝説級！巨大ロックスターを倒せ！",
        "boss_stage_3_name": "👩 BOSS: BIGMAM",
        "boss_stage_3_desc": "☠️ 究極！最後の悪夢に挑め！",
        "boss_stage_4_name": "💃 BOSS: My name is NIKA!!",
        "boss_stage_4_desc": "🔥 伝説級！彼女が来るぞ！",
        "boss_stage_5_name": "🌙 BOSS: MOOOOONA",
        "boss_stage_5_desc": "💜 究極！月の女神が目覚める！",

        // Team
        "team": "編成",
        "team_title": "チーム編成",
        "team_members": "出撃メンバー",
        "total_cost": "合計コスト",
        "to_stages": "ステージへ",
        "pull_gacha": "🎰 ガチャを引く",
        "deployment_members": "📋 出撃メンバー",
        "owned_units": "所持ユニット",
        "hp": "HP",
        "attack": "攻撃",
        "range": "射程",
        "cost": "コスト",
        "selected": "✓ 選択中",
        "ready_to_deploy": "⚔️ 出撃準備完了！",

        // Gacha
        "gacha": "🎰 ガチャ",
        "unit_gacha": "🌟 ユニットガチャ 🌟",
        "gacha_desc": "コインを使って新しいユニットをゲット！同じユニットは複数所持でき、今後フュージョンに使用できます。",
        "single_pull": "1回ガチャ",
        "multi_pull": "10連ガチャ",
        "owned_units_gacha": "📦 所持ユニット",
        "go_to_team": "📋 編成へ",
        "gacha_result": "🎉 ガチャ結果 🎉",
        "rates": "排出率",

        // Battle
        "victory": "勝利！",
        "defeat": "敗北...",
        "reward_coins": "報酬",
        "back_to_stages": "ステージへ戻る",
        "retry": "リトライ",

        // World Map
        "world_map": "ワールドマップ",
        "list": "リスト",
        "scroll_hint": "横スクロールで探索",
        "battle_start": "出撃！",
        "close": "閉じる",
        "drops": "ドロップ報酬",

        "fusion": "フュージョン",
        "fusion_desc": "3体のユニットを選んで合成！レアリティが高いほど良いユニットが生まれやすい！",
        "fusion_execute": "合成する！",
        "fusion_result": "合成完了！",
        "select_materials": "📦 素材を選択",
        "no_units": "ユニットがありません。ガチャで手に入れよう！",

        // Unit names
        "cat_warrior": "ネコ戦士",
        "cat_tank": "タンクネコ",
        "cat_archer": "弓ネコ",
        "cat_mage": "魔法ネコ",
        "cat_ninja": "忍者ネコ",
        "ice_flower": "氷花",
        "corn_fighter": "コーン",
        "block_slime": "ブロック",
        "sunflower": "ひまわり",
        "watermelon": "スイカ",
        "corn_kid": "コーンキ",
        "ribbon_girl": "リボン",
        "penguin_boy": "ペンギン",
        "cinnamon_girl": "ユメミ",
        "enemy_dog": "敵イヌ",
        "enemy_wolf": "敵オオカミ",
        "enemy_crow": "敵カラス",
    },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "gardenwars_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>("en");

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
        if (saved && (saved === "en" || saved === "ja")) {
            setLanguageState(saved);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(STORAGE_KEY, lang);
    };

    const t = (key: string): string => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}

// 言語切り替えボタンコンポーネント
export function LanguageSwitch() {
    const { language, setLanguage } = useLanguage();

    return (
        <button
            onClick={() => setLanguage(language === "en" ? "ja" : "en")}
            className="px-3 py-1 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-800 text-sm font-bold transition-colors"
        >
            {language === "en" ? "🇯🇵 日本語" : "🇺🇸 English"}
        </button>
    );
}
