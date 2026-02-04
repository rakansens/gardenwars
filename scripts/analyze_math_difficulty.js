/**
 * 算数バトルの難易度分析スクリプト
 * 4-8歳の子供向けにバランスを確認
 */

const fs = require('fs');
const path = require('path');

const stagesPath = path.join(__dirname, '../src/data/math-battle/stages.json');
const stages = JSON.parse(fs.readFileSync(stagesPath, 'utf8'));

console.log('\n=======================================================================');
console.log('           算数バトル難易度分析レポート');
console.log('           対象年齢: 4-8歳');
console.log('=======================================================================\n');

// 年齢別の目安
const ageGuidelines = {
    '4-5歳': {
        addition: { max: 5, description: '1+1〜5+5（合計10以下）' },
        subtraction: { max: 5, description: '5-1〜10-5' },
        multiplication: { max: 0, description: '未対応' },
        division: { max: 0, description: '未対応' }
    },
    '5-6歳': {
        addition: { max: 10, description: '1+1〜10+10（繰り上がりなし）' },
        subtraction: { max: 10, description: '10-1〜15-10' },
        multiplication: { max: 0, description: '概念理解のみ' },
        division: { max: 0, description: '未対応' }
    },
    '6-7歳': {
        addition: { max: 20, description: '繰り上がりあり、20+20まで' },
        subtraction: { max: 20, description: '繰り下がりあり' },
        multiplication: { max: 5, description: '2,3,4,5の段' },
        division: { max: 0, description: '概念理解のみ' }
    },
    '7-8歳': {
        addition: { max: 100, description: '2桁+2桁' },
        subtraction: { max: 100, description: '2桁-2桁' },
        multiplication: { max: 9, description: '九九（1-9の段）' },
        division: { max: 9, description: '九九の逆（割り切れる）' }
    }
};

console.log('【年齢別の目安】');
Object.entries(ageGuidelines).forEach(([age, ops]) => {
    console.log(`\n${age}:`);
    Object.entries(ops).forEach(([op, info]) => {
        if (info.max > 0) {
            console.log(`  ${op}: ${info.description}`);
        }
    });
});

console.log('\n\n-------------------------------------------------------------------');
console.log('                   現在のステージ難易度分析');
console.log('-------------------------------------------------------------------\n');

// 各エリアを分析
stages.areas.forEach(area => {
    console.log(`\n【${area.id.toUpperCase()}】${area.nameKey}`);
    console.log(`  必要スター: ${area.requiredStars}`);
    console.log(`  ステージ数: ${area.stages.length}`);
    console.log('');
    console.log('  Stage | 問題数 | 制限時間 | 数値範囲                    | 推定対象年齢');
    console.log('  ------|--------|----------|-----------------------------|-----------');

    area.stages.forEach((stage, i) => {
        const d = stage.difficulty;
        const range = `${d.minNum1}-${d.maxNum1} ${getOpSymbol(area.operationType)} ${d.minNum2}-${d.maxNum2}`;
        const maxResult = getMaxResult(area.operationType, d.maxNum1, d.maxNum2);
        const targetAge = estimateTargetAge(area.operationType, d.maxNum1, d.maxNum2, maxResult);
        const timePerQ = Math.round(stage.timeLimitMs / 1000 / stage.questionCount);

        const stageNum = String(i + 1).padStart(2);
        const qCount = String(stage.questionCount).padStart(2);
        const timeLimit = String(stage.timeLimitMs / 1000).padStart(3) + 's';

        console.log(`  ${stageNum}     | ${qCount}問   | ${timeLimit}     | ${range.padEnd(27)} | ${targetAge}`);
    });
});

function getOpSymbol(op) {
    switch(op) {
        case 'addition': return '+';
        case 'subtraction': return '-';
        case 'multiplication': return '×';
        case 'division': return '÷';
        default: return '?';
    }
}

function getMaxResult(op, max1, max2) {
    switch(op) {
        case 'addition': return max1 + max2;
        case 'subtraction': return max1; // 引く前の数
        case 'multiplication': return max1 * max2;
        case 'division': return max1 * max2; // 割られる数の最大
        default: return max1;
    }
}

function estimateTargetAge(op, max1, max2, maxResult) {
    if (op === 'addition') {
        if (max1 <= 5 && max2 <= 5) return '4-5歳 ✅';
        if (max1 <= 10 && max2 <= 10) return '5-6歳 ✅';
        if (max1 <= 20 && max2 <= 20) return '6-7歳 ✅';
        if (max1 <= 100 && max2 <= 100) return '7-8歳 ✅';
        if (max1 <= 200) return '8-9歳';
        return '9歳以上 ⚠️';
    }
    if (op === 'subtraction') {
        if (max1 <= 10) return '5-6歳 ✅';
        if (max1 <= 20) return '6-7歳 ✅';
        if (max1 <= 100) return '7-8歳 ✅';
        return '8歳以上 ⚠️';
    }
    if (op === 'multiplication') {
        if (max1 <= 5 && max2 <= 5) return '6-7歳 ✅';
        if (max1 <= 9 && max2 <= 9) return '7-8歳 ✅';
        if (max1 <= 12 && max2 <= 12) return '8歳';
        return '9歳以上 ⚠️';
    }
    if (op === 'division') {
        if (max1 <= 5 && max2 <= 5) return '7-8歳 ✅';
        if (max1 <= 9 && max2 <= 9) return '7-8歳 ✅';
        return '8歳以上 ⚠️';
    }
    return '不明';
}

console.log('\n\n-------------------------------------------------------------------');
console.log('                      問題点と改善提案');
console.log('-------------------------------------------------------------------\n');

console.log('【問題点】');
console.log('');
console.log('1. 足し算エリア:');
console.log('   - Stage 6で急に10-30+5-15に跳躍（5-6歳→8歳レベルにジャンプ）');
console.log('   - 1桁の練習ステージが5つしかない（4-6歳には少ない）');
console.log('   - 後半は3桁の足し算で8歳以上向け');
console.log('');
console.log('2. 引き算エリア:');
console.log('   - 必要スター30で、足し算を30%クリアしないと開放されない');
console.log('   - 1桁の引き算ステージがない');
console.log('');
console.log('3. 掛け算エリア:');
console.log('   - 必要スター60は適切');
console.log('   - 後半の2桁×1桁は8歳以上向け');
console.log('');
console.log('4. 割り算エリア:');
console.log('   - 必要スター100は適切');
console.log('   - 後半は8歳以上向け');
console.log('');

console.log('\n【改善提案（4-8歳向け）】');
console.log('');
console.log('1. 足し算エリアを拡充:');
console.log('   - 1-5の足し算: 8ステージ（4-5歳向け）');
console.log('   - 1-10の足し算: 6ステージ（5-6歳向け）');
console.log('   - 繰り上がり: 4ステージ（6-7歳向け）');
console.log('   - 2桁の足し算: 2ステージ（7-8歳向け）');
console.log('');
console.log('2. 制限時間の緩和:');
console.log('   - 4-5歳: 1問20秒以上');
console.log('   - 5-6歳: 1問15秒以上');
console.log('   - 6-7歳: 1問12秒以上');
console.log('   - 7-8歳: 1問10秒以上');
console.log('');
console.log('3. 問題数の調整:');
console.log('   - 4-5歳: 3-4問');
console.log('   - 5-6歳: 4-5問');
console.log('   - 6-7歳: 5-6問');
console.log('   - 7-8歳: 6-8問');
console.log('');

console.log('\n=======================================================================');
console.log('分析完了');
console.log('=======================================================================\n');
