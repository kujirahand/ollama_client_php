#!/bin/bash

# ファイル整合性チェックスクリプト
JS_DIR="/Users/kujirahand/repos/ollama_client_php/app/static/js"

echo "=== JavaScript Files Integrity Check ==="
echo "Timestamp: $(date)"
echo ""

# チェックするファイルのリスト
files=("chat.js" "common.js" "models.js" "auth.js" "templates.js" "user.js")

for file in "${files[@]}"; do
    filepath="$JS_DIR/$file"
    if [ -f "$filepath" ]; then
        size=$(stat -f%z "$filepath")
        lines=$(wc -l < "$filepath")
        echo "$file: $size bytes, $lines lines"
        
        if [ "$size" -eq 0 ]; then
            echo "⚠️  WARNING: $file is empty!"
            
            # バックアップから復元を試行
            backup_file="$JS_DIR/${file}.backup2"
            if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
                echo "🔄 Restoring from backup: $backup_file"
                cp "$backup_file" "$filepath"
                echo "✅ Restored $file from backup"
            else
                echo "❌ No valid backup found for $file"
            fi
        fi
    else
        echo "$file: NOT FOUND"
    fi
done

echo ""
echo "=== Check Complete ==="
