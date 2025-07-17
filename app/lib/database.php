<?php
// データベース接続とテーブル作成

class Database {
    private $pdo;
    
    public function __construct($dbPath = 'private/data/ollama_chat.db') {
        try {
            $this->pdo = new PDO("sqlite:$dbPath");
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->createTables();
        } catch(PDOException $e) {
            die("データベース接続エラー: " . $e->getMessage());
        }
    }
    
    public function getPDO() {
        return $this->pdo;
    }
    
    private function createTables() {
        // SQLスキーマファイルのパス
        $schemaDir = __DIR__ . '/sql/';
        $schemaFiles = [
            'users.sql',
            'chat_history.sql',
            'prompt_templates.sql'
        ];
        
        // 各スキーマファイルを実行
        foreach ($schemaFiles as $file) {
            $filePath = $schemaDir . $file;
            if (file_exists($filePath)) {
                $sql = file_get_contents($filePath);
                if ($sql !== false) {
                    try {
                        $this->pdo->exec($sql);
                    } catch (PDOException $e) {
                        error_log("スキーマファイル実行エラー ($file): " . $e->getMessage());
                    }
                }
            } else {
                error_log("スキーマファイルが見つかりません: $filePath");
            }
        }
        
        // デフォルトデータを挿入
        $this->insertDefaultData();
    }
    
    private function insertDefaultData() {
        // デフォルトデータファイルのパス
        $defaultDataFile = __DIR__ . '/sql/default_data.sql';
        
        if (file_exists($defaultDataFile)) {
            $sql = file_get_contents($defaultDataFile);
            if ($sql !== false) {
                try {
                    $this->pdo->exec($sql);
                } catch (PDOException $e) {
                    error_log("デフォルトデータ挿入エラー: " . $e->getMessage());
                }
            }
        } else {
            // フォールバック: 従来の方法でデフォルトユーザーを作成
            $this->createDefaultUserFallback();
        }
    }
    
    private function createDefaultUserFallback() {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
        $stmt->execute(['admin']);
        
        if ($stmt->fetchColumn() == 0) {
            $salt = bin2hex(random_bytes(16));
            $password = 'admin123';
            $passwordHash = hash('sha256', $password . $salt);
            
            $stmt = $this->pdo->prepare("
                INSERT INTO users (username, password_hash, salt, default_model, ollama_url) 
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute(['admin', $passwordHash, $salt, 'llama3.2', 'http://localhost:11434']);
        }
    }
}
