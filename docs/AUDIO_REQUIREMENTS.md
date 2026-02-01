# Audio Requirements - Garden Wars

音声アセット生成のための要件とAIプロンプト集

## 概要

### ファイル形式
- **フォーマット**: MP3 または OGG（Phaser.js対応）
- **サンプルレート**: 44100Hz
- **ビットレート**:
  - 効果音: 128-192kbps
  - BGM: 192-256kbps
- **ボリューム**: -3dB ~ -6dB（クリッピング防止）
- **保存先**: `public/assets/audio/`

### ディレクトリ構造
```
public/assets/audio/
├── bgm/
│   ├── battle.mp3
│   ├── victory.mp3
│   └── defeat.mp3
├── sfx/
│   ├── attack_hit.mp3
│   ├── unit_spawn.mp3
│   ├── unit_death.mp3
│   ├── cannon_fire.mp3
│   ├── quiz_correct.mp3
│   ├── quiz_wrong.mp3
│   ├── button_click.mp3
│   ├── cooldown_ready.mp3
│   ├── level_up.mp3
│   └── cost_upgrade.mp3
```

---

## BGM（バックグラウンド音楽）

### 1. battle.mp3 - バトルBGM

**用途**: 戦闘中のメインループ音楽

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 60-120秒 |
| ループ | シームレスループ必須 |
| テンポ | 120-140 BPM |
| キー | マイナーキー推奨 |

**ゲームコンテキスト**:
- にゃんこ大戦争風のタワーディフェンス
- かわいいキャラクター vs 敵軍
- 緊張感がありつつもポップな雰囲気

**AIプロンプト (Suno/Udio)**:
```
Upbeat chiptune battle music for a cute tower defense mobile game.
Mix of 8-bit retro sounds with modern electronic beats.
Energetic but not aggressive, playful tension.
Loop-friendly structure with clear intro and seamless loop point.
120-140 BPM, minor key with occasional major lifts.
Instruments: chip leads, synth bass, electronic drums, pizzicato strings.
Style: Battle Cats, Clash Royale, cute but intense.
```

**代替プロンプト（日本語対応AI用）**:
```
かわいいタワーディフェンスゲームのバトルBGM。
チップチューンとエレクトロニックの融合。
緊張感がありつつもポップでキャッチー。
ループ可能な構成。120-140BPM。
にゃんこ大戦争のような雰囲気。
```

---

### 2. victory.mp3 - 勝利BGM

**用途**: 敵の城を破壊して勝利した時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 8-15秒 |
| ループ | 不要（ワンショット） |
| テンポ | 130-150 BPM |
| キー | メジャーキー |

**ゲームコンテキスト**:
- 「勝利！」テキストと共に再生
- 報酬コイン表示中
- 達成感、喜び、祝福感

**AIプロンプト**:
```
Victory fanfare for a cute mobile game.
Triumphant, celebratory, and joyful.
Brass fanfare with sparkle sounds and uplifting synths.
8-15 seconds, building to a satisfying conclusion.
Major key, energetic tempo around 140 BPM.
Style: Mario victory, level complete celebration.
```

---

### 3. defeat.mp3 - 敗北BGM

**用途**: 味方の城が破壊されて敗北した時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 6-10秒 |
| ループ | 不要（ワンショット） |
| テンポ | 60-80 BPM |
| キー | マイナーキー |

**ゲームコンテキスト**:
- 「敗北...」テキストと共に再生
- 悲しいが、重すぎない（リトライ促進）
- かわいいゲームなので深刻すぎない

**AIプロンプト**:
```
Game over jingle for a cute mobile game.
Sad but not depressing, encouraging retry.
Descending melody with soft synths and gentle piano.
6-10 seconds, melancholic but hopeful ending.
Minor key, slow tempo around 70 BPM.
Keep it light - this is a cute game, not dramatic.
```

---

## 効果音（SFX）

### 4. attack_hit.mp3 - 攻撃ヒット

**用途**: ユニットが敵に攻撃をヒットさせた時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.2-0.4秒 |
| 同時再生 | 対応必須（複数ユニット同時攻撃） |
| バリエーション | 将来的にレアリティ別追加可能 |

**ゲームコンテキスト**:
- 頻繁に再生される（最重要SE）
- 満足感のあるヒット感
- 連続再生でも不快にならない

**AIプロンプト**:
```
Punchy hit sound effect for a cute game.
Satisfying impact, not violent or harsh.
Soft "bop" or "thwack" sound.
0.2-0.3 seconds, clean attack and quick decay.
Cartoony, like hitting something soft but solid.
```

**手動作成の場合**:
- ベース: パンチ音 + ソフトなインパクト音
- レイヤー: 高音のアクセント（キラッ）
- 処理: 軽いリバーブ、コンプレッション

---

### 5. unit_spawn.mp3 - ユニット召喚

**用途**: 味方ユニットが召喚された時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.3-0.5秒 |
| 特徴 | 上昇感、ポップ感 |

**ゲームコンテキスト**:
- コスト消費してユニット出現
- スケールアニメーション（0→1）と同期
- ポジティブなフィードバック

**AIプロンプト**:
```
Magical spawn sound effect for a cute game.
Upward "pop" or "poof" with sparkle.
Summoning magic feel, light and positive.
0.3-0.5 seconds.
Like a character appearing in a puff of magic smoke.
```

---

### 6. unit_death.mp3 - ユニット死亡

**用途**: ユニットがHPゼロで消滅した時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.3-0.5秒 |
| 特徴 | 消滅感、フェードアウト感 |

**ゲームコンテキスト**:
- フェードアウトアニメーション（500ms）と同期
- 味方・敵両方に使用
- 悲しすぎない、かわいい消滅音

**AIプロンプト**:
```
Cute defeat/poof sound effect.
Character disappearing in a cloud.
Descending tone with soft "poof" texture.
0.3-0.5 seconds.
Not sad, more like cartoon disappearing.
Like a bubble popping or soft deflation.
```

---

### 7. cannon_fire.mp3 - キャノン発射

**用途**: 必殺技（キャノン）発射時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.8-1.2秒 |
| 特徴 | インパクト大、爆発感 |

**ゲームコンテキスト**:
- 20秒チャージ後の必殺技
- 画面全体にシェイク + 衝撃波エフェクト
- 敵全体にダメージ
- 最も派手なSE

**AIプロンプト**:
```
Powerful cannon explosion for a mobile game.
Big impact with boom and shockwave.
Starts with a quick charge-up whoosh, then massive explosion.
0.8-1.2 seconds total.
Impactful but not harsh, game-appropriate loudness.
Mix of bass boom, mid crackle, and high sizzle.
```

---

### 8. quiz_correct.mp3 - クイズ正解

**用途**: 掛け算クイズに正解した時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.3-0.5秒 |
| 特徴 | 明るい、達成感 |

**ゲームコンテキスト**:
- 「✅ OK!」表示と同期
- 正解の喜び、ポジティブ強化
- 学習ゲーム要素のフィードバック

**AIプロンプト**:
```
Correct answer chime for educational game.
Bright, happy, and rewarding.
Ascending notes or pleasant ding.
0.3-0.5 seconds.
Clear and positive feedback sound.
Like a quiz show correct answer bell.
```

---

### 9. quiz_wrong.mp3 - クイズ不正解

**用途**: 掛け算クイズに不正解した時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.3-0.5秒 |
| 特徴 | 間違い感、でも優しい |

**ゲームコンテキスト**:
- 「❌ {正解}」表示と同期
- 間違いを知らせるが、落ち込ませない
- 子供向けなので厳しすぎない

**AIプロンプト**:
```
Wrong answer buzzer for educational game.
Gentle "wrong" indicator, not harsh or punishing.
Low tone buzz or descending notes.
0.3-0.5 seconds.
Informative but encouraging to try again.
Softer than a game show buzzer.
```

---

### 10. button_click.mp3 - UIクリック

**用途**: ボタンやUI要素をタップした時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.1-0.15秒 |
| 特徴 | 軽い、レスポンシブ |

**ゲームコンテキスト**:
- 全てのUIボタンで使用
- 頻繁に再生される
- 邪魔にならない、心地よい

**AIプロンプト**:
```
Soft UI click sound for mobile game.
Light, subtle, and satisfying.
Quick tap or soft click.
0.1 seconds or less.
Not intrusive, pleasant feedback.
Like a gentle button press.
```

---

### 11. cooldown_ready.mp3 - クールダウン完了

**用途**: ユニットのクールダウンが終わって召喚可能になった時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.2-0.3秒 |
| 特徴 | 準備完了、注目 |

**ゲームコンテキスト**:
- ボタンがアクティブになった瞬間
- プレイヤーへの「使えるよ」通知
- 目立ちすぎず、気づける程度

**AIプロンプト**:
```
Ready/available notification chime.
Subtle "ding" indicating something is ready.
Light and attention-grabbing but not loud.
0.2-0.3 seconds.
Like a gentle notification or ready indicator.
```

---

### 12. level_up.mp3 - 城レベルアップ

**用途**: コストアップグレードで城がレベルアップした時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.5-0.8秒 |
| 特徴 | 達成感、成長感 |

**ゲームコンテキスト**:
- 「🏰 LEVEL UP!」テキスト表示
- 城のスケールアップアニメーション
- マイルストーン達成の喜び

**AIプロンプト**:
```
Level up fanfare for mobile game.
Achievement and growth feeling.
Ascending notes with sparkle/shimmer.
0.5-0.8 seconds.
Celebratory but not too long.
Like reaching a milestone or power-up acquired.
```

---

### 13. cost_upgrade.mp3 - コストアップグレード

**用途**: コストアップグレードボタンを押して強化した時

**技術要件**:
| 項目 | 値 |
|------|-----|
| 長さ | 0.3-0.4秒 |
| 特徴 | 購入感、強化感 |

**ゲームコンテキスト**:
- リソース消費して強化
- 購入/投資のフィードバック
- ポジティブな確認音

**AIプロンプト**:
```
Purchase/upgrade confirmation sound.
Satisfying "cha-ching" or power-up feel.
Quick confirmation with positive tone.
0.3-0.4 seconds.
Like buying something or upgrading equipment.
Coin sound mixed with upgrade shimmer.
```

---

## 将来の拡張

### レアリティ別攻撃音（オプション）
| レアリティ | 特徴 |
|-----------|------|
| N | 軽い、シンプル |
| R | 少し重い |
| SR | エコー追加 |
| SSR | キラキラ追加 |
| UR | 壮大、複層 |

### ユニットタイプ別（オプション）
| タイプ | 攻撃音 |
|--------|--------|
| 戦士 | 斬撃音 |
| 魔法 | 魔法詠唱音 |
| 弓 | 矢の飛翔音 |
| ヒーラー | 回復音 |

### アンビエント（オプション）
- 戦場の環境音（風、遠くの戦闘音）
- コスト回復のチャリン音（微小）

---

## 生成ツール推奨

| ツール | 用途 | URL |
|--------|------|-----|
| **Suno** | BGM生成 | https://suno.ai |
| **Udio** | BGM生成 | https://udio.com |
| **ElevenLabs** | 効果音 | https://elevenlabs.io/sound-effects |
| **Freesound** | 無料素材 | https://freesound.org |
| **JSFXR/ChipTone** | レトロSE | https://sfxr.me |

---

## チェックリスト

### 最小構成（9ファイル）
- [ ] bgm/battle.mp3
- [ ] bgm/victory.mp3
- [ ] bgm/defeat.mp3
- [ ] sfx/attack_hit.mp3
- [ ] sfx/unit_spawn.mp3
- [ ] sfx/unit_death.mp3
- [ ] sfx/cannon_fire.mp3
- [ ] sfx/quiz_correct.mp3
- [ ] sfx/quiz_wrong.mp3

### 推奨追加（4ファイル）
- [ ] sfx/button_click.mp3
- [ ] sfx/cooldown_ready.mp3
- [ ] sfx/level_up.mp3
- [ ] sfx/cost_upgrade.mp3

---

## 実装メモ

Phaser.jsでの音声読み込み例:
```typescript
// preload
this.load.audio('battle_bgm', '/assets/audio/bgm/battle.mp3');
this.load.audio('attack_hit', '/assets/audio/sfx/attack_hit.mp3');

// play
this.sound.play('attack_hit', { volume: 0.5 });
this.sound.play('battle_bgm', { loop: true, volume: 0.3 });
```
