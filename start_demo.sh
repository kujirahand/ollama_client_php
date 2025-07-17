#!/bin/bash

# Ollama Chat Client Demo Startup Script

SCRIPT_PATH=$(dirname "$0")
SCRIPT_DIR=$(cd "$SCRIPT_PATH" && pwd)

echo "🚀 Ollama Chat Client for PHP - Demo Setup"
echo "=========================================="

# PHPの確認
echo "📋 Checking PHP..."
if ! command -v php &> /dev/null; then
    echo "❌ PHP is not installed. Please install PHP 7.4 or higher."
    exit 1
fi

PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1-2)
echo "✅ PHP $PHP_VERSION detected"

# SQLite拡張の確認
echo "📋 Checking SQLite extension..."
if ! php -m | grep -q sqlite3; then
    echo "❌ SQLite3 extension is not available. Please install php-sqlite3."
    exit 1
fi
echo "✅ SQLite3 extension available"

# cURL拡張の確認
echo "📋 Checking cURL extension..."
if ! php -m | grep -q curl; then
    echo "❌ cURL extension is not available. Please install php-curl."
    exit 1
fi
echo "✅ cURL extension available"

echo ""
echo "🎯 Starting PHP built-in server..."
echo "📁 Document root: $(pwd)/app"
echo "🌐 Server URL: http://localhost:8080"
echo ""
echo "🔑 Default login credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "⚠️  Make sure Ollama is running on http://localhost:11434"
echo "   You can check with: curl http://localhost:11434/api/tags"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# PHPビルトインサーバーを起動
cd $SCRIPT_DIR/app
php -S localhost:8080
