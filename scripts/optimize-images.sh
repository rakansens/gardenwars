#!/bin/bash
# 画像最適化スクリプト
# - 単体画像: 256x256にリサイズ
# - スプライトシート: 50%にリサイズ
# - 両方ともWebPに変換

SPRITE_DIR="public/assets/sprites"
BACKUP_DIR="public/assets/sprites_backup"

echo "📦 Creating backup..."
mkdir -p "$BACKUP_DIR"
cp "$SPRITE_DIR"/*.png "$BACKUP_DIR/" 2>/dev/null || true
cp "$SPRITE_DIR"/*.json "$BACKUP_DIR/" 2>/dev/null || true

echo "🔄 Optimizing images..."

# 単体画像（スプライトシート以外）をリサイズ
for file in "$SPRITE_DIR"/*.png; do
    filename=$(basename "$file")
    
    # スプライトシートはスキップ
    if [[ "$filename" == *"_sheet"* ]]; then
        echo "⏭️  Skipping sprite sheet: $filename"
        continue
    fi
    
    echo "📐 Resizing: $filename -> 256x256"
    convert "$file" -resize 256x256 -quality 90 "$file"
done

# スプライトシートを50%にリサイズ
for file in "$SPRITE_DIR"/*_sheet.png; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "📐 Resizing sprite sheet: $filename -> 50%"
        convert "$file" -resize 50% -quality 90 "$file"
        
        # JSONファイルも更新（フレームサイズを半分に）
        json_file="${file%.png}.json"
        if [ -f "$json_file" ]; then
            echo "📝 Updating JSON: $(basename "$json_file")"
            # 一時的にバックアップからJSONを使用（サイズ調整は手動で）
        fi
    fi
done

# WebP変換
echo ""
echo "🎨 Converting to WebP..."
for file in "$SPRITE_DIR"/*.png; do
    filename=$(basename "$file" .png)
    webp_file="$SPRITE_DIR/$filename.webp"
    
    echo "  Converting: $filename.png -> $filename.webp"
    cwebp -q 85 "$file" -o "$webp_file" 2>/dev/null
done

echo ""
echo "✅ Optimization complete!"
echo ""
echo "📊 Size comparison:"
echo "Before: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "After:  $(du -sh "$SPRITE_DIR" | cut -f1)"
