/**
 * 算数バトルのロケールファイルを更新
 * 25ステージ対応（4-8歳向け）
 */

const fs = require('fs');
const path = require('path');

const jaPath = path.join(__dirname, '../src/data/locales/ja.json');
const enPath = path.join(__dirname, '../src/data/locales/en.json');

let ja = JSON.parse(fs.readFileSync(jaPath, 'utf8'));
let en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

console.log('\n=======================================================================');
console.log('           算数バトル ロケール更新');
console.log('=======================================================================\n');

// ============================================
// 日本語ロケール
// ============================================

const jaStages = {
    // 足し算（25ステージ）- 4-8歳向け
    "mathBattle.stages.add1": "🌱 はじめての足し算 (1〜3)",
    "mathBattle.stages.add2": "🌱 どんぐり拾い (1〜3)",
    "mathBattle.stages.add3": "🌱 きのこの道 (1〜4)",
    "mathBattle.stages.add4": "🌱 花畑で数えよう (1〜4)",
    "mathBattle.stages.add5": "🌼 お花を足そう (1〜5)",
    "mathBattle.stages.add6": "🌼 カエルの池 (1〜5)",
    "mathBattle.stages.add7": "🌼 てんとう虫の丘 (2〜5)",
    "mathBattle.stages.add8": "🌼 ちょうちょの森 (3〜5)",
    "mathBattle.stages.add9": "🌻 ひまわり畑 (1〜6)",
    "mathBattle.stages.add10": "🌻 わんこの広場 (1〜7)",
    "mathBattle.stages.add11": "🌻 トマトの丘 (1〜8)",
    "mathBattle.stages.add12": "🌻 果物屋さん (1〜9)",
    "mathBattle.stages.add13": "🌻 お菓子の国 (2〜9)",
    "mathBattle.stages.add14": "🌻 数字の王国 (1〜10)",
    "mathBattle.stages.add15": "🏠 くりあがりの丘 (5〜12)",
    "mathBattle.stages.add16": "🏠 学校の階段 (8〜15)",
    "mathBattle.stages.add17": "🏠 おつかい計算 (10〜18)",
    "mathBattle.stages.add18": "🏠 お小遣い帳 (10〜20)",
    "mathBattle.stages.add19": "🏠 買い物名人 (10〜20)",
    "mathBattle.stages.add20": "🏰 2けたの入口 (15〜30)",
    "mathBattle.stages.add21": "🏰 計算チャレンジ (20〜40)",
    "mathBattle.stages.add22": "🏰 暗算マスター (25〜50)",
    "mathBattle.stages.add23": "🏰 算数博士 (30〜60)",
    "mathBattle.stages.add24": "🏰 足し算王 (40〜80)",

    // 引き算（25ステージ）
    "mathBattle.stages.sub1": "🍎 りんごをあげよう (3〜5)",
    "mathBattle.stages.sub2": "🍎 おやつを分けよう (4〜6)",
    "mathBattle.stages.sub3": "🍎 飴を配ろう (5〜7)",
    "mathBattle.stages.sub4": "🍎 クッキー計算 (5〜8)",
    "mathBattle.stages.sub5": "🍬 お菓子の引き算 (6〜9)",
    "mathBattle.stages.sub6": "🍬 数を減らそう (6〜10)",
    "mathBattle.stages.sub7": "🍬 いくつ残る？ (7〜10)",
    "mathBattle.stages.sub8": "🍬 10からの引き算 (8〜10)",
    "mathBattle.stages.sub9": "🌈 くりさがりの丘 (10〜12)",
    "mathBattle.stages.sub10": "🌈 チャレンジ引き算 (10〜14)",
    "mathBattle.stages.sub11": "🌈 ステップアップ (11〜15)",
    "mathBattle.stages.sub12": "🌈 計算名人への道 (12〜16)",
    "mathBattle.stages.sub13": "🌈 引き算道場 (13〜18)",
    "mathBattle.stages.sub14": "🌈 暗算チャレンジ (14〜18)",
    "mathBattle.stages.sub15": "🌈 20までマスター (15〜20)",
    "mathBattle.stages.sub16": "🌈 引き算王への道 (15〜20)",
    "mathBattle.stages.sub17": "🏆 2けたの入口 (20〜30)",
    "mathBattle.stages.sub18": "🏆 大きな引き算 (25〜40)",
    "mathBattle.stages.sub19": "🏆 計算チャレンジ (30〜50)",
    "mathBattle.stages.sub20": "🏆 暗算マスター (35〜60)",
    "mathBattle.stages.sub21": "🏆 算数博士 (40〜70)",
    "mathBattle.stages.sub22": "🏆 引き算達人 (50〜80)",
    "mathBattle.stages.sub23": "🏆 計算王 (60〜90)",
    "mathBattle.stages.sub24": "🏆 引き算マスター (70〜99)",

    // 掛け算（25ステージ）
    "mathBattle.stages.mul1": "🔢 2のだんを覚えよう (2×1〜5)",
    "mathBattle.stages.mul2": "🔢 2のだんマスター (2×1〜9)",
    "mathBattle.stages.mul3": "🔢 3のだんに挑戦 (3×1〜5)",
    "mathBattle.stages.mul4": "🔢 3のだんマスター (3×1〜9)",
    "mathBattle.stages.mul5": "🔢 4のだんに挑戦 (4×1〜5)",
    "mathBattle.stages.mul6": "🔢 4のだんマスター (4×1〜9)",
    "mathBattle.stages.mul7": "🔢 5のだんに挑戦 (5×1〜5)",
    "mathBattle.stages.mul8": "🔢 5のだんマスター (5×1〜9)",
    "mathBattle.stages.mul9": "🔢 2〜5のだん復習 (2〜5×)",
    "mathBattle.stages.mul10": "🔢 2〜5のだん完璧 (2〜5×)",
    "mathBattle.stages.mul11": "⭐ 6のだんに挑戦 (6×1〜9)",
    "mathBattle.stages.mul12": "⭐ 7のだんに挑戦 (7×1〜9)",
    "mathBattle.stages.mul13": "⭐ 8のだんに挑戦 (8×1〜9)",
    "mathBattle.stages.mul14": "⭐ 9のだんに挑戦 (9×1〜9)",
    "mathBattle.stages.mul15": "⭐ 九九マスター (2〜9×)",
    "mathBattle.stages.mul16": "⭐ 九九ランダム (3〜9×)",
    "mathBattle.stages.mul17": "⭐ 九九スピード (4〜9×)",
    "mathBattle.stages.mul18": "⭐ 九九チャレンジ (5〜9×)",
    "mathBattle.stages.mul19": "⭐ 九九達人 (6〜9×)",
    "mathBattle.stages.mul20": "⭐ 九九王 (7〜9×)",
    "mathBattle.stages.mul21": "👑 九九完全制覇 (全て)",
    "mathBattle.stages.mul22": "👑 九九スペシャル (全て)",
    "mathBattle.stages.mul23": "👑 掛け算マスター (全て)",
    "mathBattle.stages.mul24": "👑 掛け算チャンピオン (全て)",

    // 割り算（25ステージ）
    "mathBattle.stages.div1": "🍕 2でわろう (÷2)",
    "mathBattle.stages.div2": "🍕 2でわるマスター (÷2)",
    "mathBattle.stages.div3": "🍕 3でわろう (÷3)",
    "mathBattle.stages.div4": "🍕 3でわるマスター (÷3)",
    "mathBattle.stages.div5": "🍕 4でわろう (÷4)",
    "mathBattle.stages.div6": "🍕 4でわるマスター (÷4)",
    "mathBattle.stages.div7": "🍕 5でわろう (÷5)",
    "mathBattle.stages.div8": "🍕 5でわるマスター (÷5)",
    "mathBattle.stages.div9": "🍕 2〜5でわる (÷2〜5)",
    "mathBattle.stages.div10": "🍕 2〜5完璧 (÷2〜5)",
    "mathBattle.stages.div11": "🎯 6でわろう (÷6)",
    "mathBattle.stages.div12": "🎯 7でわろう (÷7)",
    "mathBattle.stages.div13": "🎯 8でわろう (÷8)",
    "mathBattle.stages.div14": "🎯 9でわろう (÷9)",
    "mathBattle.stages.div15": "🎯 わり算マスター (÷2〜9)",
    "mathBattle.stages.div16": "🎯 わり算ランダム (÷3〜9)",
    "mathBattle.stages.div17": "🎯 わり算スピード (÷4〜9)",
    "mathBattle.stages.div18": "🎯 わり算チャレンジ (÷5〜9)",
    "mathBattle.stages.div19": "🎯 わり算達人 (÷6〜9)",
    "mathBattle.stages.div20": "🎯 わり算王 (÷7〜9)",
    "mathBattle.stages.div21": "🏅 わり算完全制覇 (全て)",
    "mathBattle.stages.div22": "🏅 わり算スペシャル (全て)",
    "mathBattle.stages.div23": "🏅 わり算博士 (全て)",
    "mathBattle.stages.div24": "🏅 わり算チャンピオン (全て)",

    // ミックス（25ステージ）
    "mathBattle.stages.mix1": "🎮 四則の入口 (1〜5)",
    "mathBattle.stages.mix2": "🎮 計算ミックス (1〜6)",
    "mathBattle.stages.mix3": "🎮 何の計算？ (1〜7)",
    "mathBattle.stages.mix4": "🎮 ランダム計算 (1〜8)",
    "mathBattle.stages.mix5": "🎮 計算チャレンジ (1〜9)",
    "mathBattle.stages.mix6": "🎮 四則マスター (2〜9)",
    "mathBattle.stages.mix7": "🎮 計算道場 (3〜9)",
    "mathBattle.stages.mix8": "🎮 暗算スピード (4〜9)",
    "mathBattle.stages.mix9": "🎮 計算達人 (5〜9)",
    "mathBattle.stages.mix10": "🎮 四則王 (6〜9)",
    "mathBattle.stages.mix11": "🌟 応用ミックス (1〜9)",
    "mathBattle.stages.mix12": "🌟 計算バトル (2〜9)",
    "mathBattle.stages.mix13": "🌟 算数ヒーロー (5〜15)",
    "mathBattle.stages.mix14": "🌟 計算ファイター (5〜20)",
    "mathBattle.stages.mix15": "🌟 算数チャンピオン (10〜25)",
    "mathBattle.stages.mix16": "🌟 計算マスター (10〜30)",
    "mathBattle.stages.mix17": "🌟 暗算名人 (15〜40)",
    "mathBattle.stages.mix18": "🌟 算数博士 (20〜50)",
    "mathBattle.stages.mix19": "🌟 計算王 (25〜60)",
    "mathBattle.stages.mix20": "🌟 四則達人 (30〜70)",
    "mathBattle.stages.mix21": "🏆 チャレンジ1 (35〜80)",
    "mathBattle.stages.mix22": "🏆 チャレンジ2 (40〜90)",
    "mathBattle.stages.mix23": "🏆 チャレンジ3 (45〜99)",
    "mathBattle.stages.mix24": "🏆 最終試練 (50〜99)"
};

// ============================================
// 英語ロケール
// ============================================

const enStages = {
    // Addition (25 stages) - For ages 4-8
    "mathBattle.stages.add1": "🌱 First Addition (1-3)",
    "mathBattle.stages.add2": "🌱 Acorn Collecting (1-3)",
    "mathBattle.stages.add3": "🌱 Mushroom Path (1-4)",
    "mathBattle.stages.add4": "🌱 Flower Field (1-4)",
    "mathBattle.stages.add5": "🌼 Add Flowers (1-5)",
    "mathBattle.stages.add6": "🌼 Frog Pond (1-5)",
    "mathBattle.stages.add7": "🌼 Ladybug Hill (2-5)",
    "mathBattle.stages.add8": "🌼 Butterfly Forest (3-5)",
    "mathBattle.stages.add9": "🌻 Sunflower Field (1-6)",
    "mathBattle.stages.add10": "🌻 Puppy Park (1-7)",
    "mathBattle.stages.add11": "🌻 Tomato Hill (1-8)",
    "mathBattle.stages.add12": "🌻 Fruit Shop (1-9)",
    "mathBattle.stages.add13": "🌻 Candy Land (2-9)",
    "mathBattle.stages.add14": "🌻 Number Kingdom (1-10)",
    "mathBattle.stages.add15": "🏠 Carry Over Hill (5-12)",
    "mathBattle.stages.add16": "🏠 School Stairs (8-15)",
    "mathBattle.stages.add17": "🏠 Shopping Math (10-18)",
    "mathBattle.stages.add18": "🏠 Piggy Bank (10-20)",
    "mathBattle.stages.add19": "🏠 Shopping Pro (10-20)",
    "mathBattle.stages.add20": "🏰 Two Digits (15-30)",
    "mathBattle.stages.add21": "🏰 Math Challenge (20-40)",
    "mathBattle.stages.add22": "🏰 Mental Math (25-50)",
    "mathBattle.stages.add23": "🏰 Math Expert (30-60)",
    "mathBattle.stages.add24": "🏰 Addition King (40-80)",

    // Subtraction (25 stages)
    "mathBattle.stages.sub1": "🍎 Share Apples (3-5)",
    "mathBattle.stages.sub2": "🍎 Share Snacks (4-6)",
    "mathBattle.stages.sub3": "🍎 Give Candy (5-7)",
    "mathBattle.stages.sub4": "🍎 Cookie Math (5-8)",
    "mathBattle.stages.sub5": "🍬 Candy Subtraction (6-9)",
    "mathBattle.stages.sub6": "🍬 Take Away (6-10)",
    "mathBattle.stages.sub7": "🍬 How Many Left? (7-10)",
    "mathBattle.stages.sub8": "🍬 From Ten (8-10)",
    "mathBattle.stages.sub9": "🌈 Borrow Hill (10-12)",
    "mathBattle.stages.sub10": "🌈 Subtraction Challenge (10-14)",
    "mathBattle.stages.sub11": "🌈 Step Up (11-15)",
    "mathBattle.stages.sub12": "🌈 Road to Expert (12-16)",
    "mathBattle.stages.sub13": "🌈 Subtraction Dojo (13-18)",
    "mathBattle.stages.sub14": "🌈 Mental Challenge (14-18)",
    "mathBattle.stages.sub15": "🌈 Master to 20 (15-20)",
    "mathBattle.stages.sub16": "🌈 Road to King (15-20)",
    "mathBattle.stages.sub17": "🏆 Two Digits (20-30)",
    "mathBattle.stages.sub18": "🏆 Big Subtraction (25-40)",
    "mathBattle.stages.sub19": "🏆 Math Challenge (30-50)",
    "mathBattle.stages.sub20": "🏆 Mental Master (35-60)",
    "mathBattle.stages.sub21": "🏆 Math Expert (40-70)",
    "mathBattle.stages.sub22": "🏆 Subtraction Pro (50-80)",
    "mathBattle.stages.sub23": "🏆 Calculation King (60-90)",
    "mathBattle.stages.sub24": "🏆 Subtraction Master (70-99)",

    // Multiplication (25 stages)
    "mathBattle.stages.mul1": "🔢 Learn 2 Times (2×1-5)",
    "mathBattle.stages.mul2": "🔢 Master 2 Times (2×1-9)",
    "mathBattle.stages.mul3": "🔢 Try 3 Times (3×1-5)",
    "mathBattle.stages.mul4": "🔢 Master 3 Times (3×1-9)",
    "mathBattle.stages.mul5": "🔢 Try 4 Times (4×1-5)",
    "mathBattle.stages.mul6": "🔢 Master 4 Times (4×1-9)",
    "mathBattle.stages.mul7": "🔢 Try 5 Times (5×1-5)",
    "mathBattle.stages.mul8": "🔢 Master 5 Times (5×1-9)",
    "mathBattle.stages.mul9": "🔢 Review 2-5 (2-5×)",
    "mathBattle.stages.mul10": "🔢 Perfect 2-5 (2-5×)",
    "mathBattle.stages.mul11": "⭐ Try 6 Times (6×1-9)",
    "mathBattle.stages.mul12": "⭐ Try 7 Times (7×1-9)",
    "mathBattle.stages.mul13": "⭐ Try 8 Times (8×1-9)",
    "mathBattle.stages.mul14": "⭐ Try 9 Times (9×1-9)",
    "mathBattle.stages.mul15": "⭐ Times Master (2-9×)",
    "mathBattle.stages.mul16": "⭐ Random Tables (3-9×)",
    "mathBattle.stages.mul17": "⭐ Speed Tables (4-9×)",
    "mathBattle.stages.mul18": "⭐ Times Challenge (5-9×)",
    "mathBattle.stages.mul19": "⭐ Times Expert (6-9×)",
    "mathBattle.stages.mul20": "⭐ Times King (7-9×)",
    "mathBattle.stages.mul21": "👑 Complete Master (All)",
    "mathBattle.stages.mul22": "👑 Times Special (All)",
    "mathBattle.stages.mul23": "👑 Multiplication Master (All)",
    "mathBattle.stages.mul24": "👑 Times Champion (All)",

    // Division (25 stages)
    "mathBattle.stages.div1": "🍕 Divide by 2 (÷2)",
    "mathBattle.stages.div2": "🍕 Master ÷2 (÷2)",
    "mathBattle.stages.div3": "🍕 Divide by 3 (÷3)",
    "mathBattle.stages.div4": "🍕 Master ÷3 (÷3)",
    "mathBattle.stages.div5": "🍕 Divide by 4 (÷4)",
    "mathBattle.stages.div6": "🍕 Master ÷4 (÷4)",
    "mathBattle.stages.div7": "🍕 Divide by 5 (÷5)",
    "mathBattle.stages.div8": "🍕 Master ÷5 (÷5)",
    "mathBattle.stages.div9": "🍕 Divide 2-5 (÷2-5)",
    "mathBattle.stages.div10": "🍕 Perfect 2-5 (÷2-5)",
    "mathBattle.stages.div11": "🎯 Divide by 6 (÷6)",
    "mathBattle.stages.div12": "🎯 Divide by 7 (÷7)",
    "mathBattle.stages.div13": "🎯 Divide by 8 (÷8)",
    "mathBattle.stages.div14": "🎯 Divide by 9 (÷9)",
    "mathBattle.stages.div15": "🎯 Division Master (÷2-9)",
    "mathBattle.stages.div16": "🎯 Random Division (÷3-9)",
    "mathBattle.stages.div17": "🎯 Speed Division (÷4-9)",
    "mathBattle.stages.div18": "🎯 Division Challenge (÷5-9)",
    "mathBattle.stages.div19": "🎯 Division Expert (÷6-9)",
    "mathBattle.stages.div20": "🎯 Division King (÷7-9)",
    "mathBattle.stages.div21": "🏅 Complete Master (All)",
    "mathBattle.stages.div22": "🏅 Division Special (All)",
    "mathBattle.stages.div23": "🏅 Division Doctor (All)",
    "mathBattle.stages.div24": "🏅 Division Champion (All)",

    // Mixed (25 stages)
    "mathBattle.stages.mix1": "🎮 Four Ops Start (1-5)",
    "mathBattle.stages.mix2": "🎮 Calculation Mix (1-6)",
    "mathBattle.stages.mix3": "🎮 Which Operation? (1-7)",
    "mathBattle.stages.mix4": "🎮 Random Calc (1-8)",
    "mathBattle.stages.mix5": "🎮 Calc Challenge (1-9)",
    "mathBattle.stages.mix6": "🎮 Four Ops Master (2-9)",
    "mathBattle.stages.mix7": "🎮 Math Dojo (3-9)",
    "mathBattle.stages.mix8": "🎮 Mental Speed (4-9)",
    "mathBattle.stages.mix9": "🎮 Calc Expert (5-9)",
    "mathBattle.stages.mix10": "🎮 Four Ops King (6-9)",
    "mathBattle.stages.mix11": "🌟 Applied Mix (1-9)",
    "mathBattle.stages.mix12": "🌟 Calc Battle (2-9)",
    "mathBattle.stages.mix13": "🌟 Math Hero (5-15)",
    "mathBattle.stages.mix14": "🌟 Calc Fighter (5-20)",
    "mathBattle.stages.mix15": "🌟 Math Champion (10-25)",
    "mathBattle.stages.mix16": "🌟 Calc Master (10-30)",
    "mathBattle.stages.mix17": "🌟 Mental Pro (15-40)",
    "mathBattle.stages.mix18": "🌟 Math Doctor (20-50)",
    "mathBattle.stages.mix19": "🌟 Calc King (25-60)",
    "mathBattle.stages.mix20": "🌟 Four Ops Pro (30-70)",
    "mathBattle.stages.mix21": "🏆 Challenge 1 (35-80)",
    "mathBattle.stages.mix22": "🏆 Challenge 2 (40-90)",
    "mathBattle.stages.mix23": "🏆 Challenge 3 (45-99)",
    "mathBattle.stages.mix24": "🏆 Final Trial (50-99)"
};

// 更新を適用
Object.assign(ja, jaStages);
Object.assign(en, enStages);

// 保存
fs.writeFileSync(jaPath, JSON.stringify(ja, null, 2));
fs.writeFileSync(enPath, JSON.stringify(en, null, 2));

console.log('【更新内容】');
console.log('');
console.log('日本語ロケール: ' + Object.keys(jaStages).length + ' キーを更新');
console.log('英語ロケール: ' + Object.keys(enStages).length + ' キーを更新');
console.log('');
console.log('エリア別ステージ名:');
console.log('  足し算: 🌱4-5歳 → 🌼 → 🌻5-6歳 → 🏠6-7歳 → 🏰7-8歳');
console.log('  引き算: 🍎簡単 → 🍬 → 🌈くりさがり → 🏆2けた');
console.log('  掛け算: 🔢2-5の段 → ⭐6-9の段 → 👑九九マスター');
console.log('  割り算: 🍕÷2-5 → 🎯÷6-9 → 🏅わり算マスター');
console.log('  ミックス: 🎮基本 → 🌟応用 → 🏆チャレンジ');
console.log('');
console.log('=======================================================================');
console.log('ロケール更新完了!');
console.log('=======================================================================\n');
