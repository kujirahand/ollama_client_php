<?php
// ユーザー認証クラス

class Auth {
    private $db;
    
    public function __construct($database) {
        $this->db = $database->getPDO();
        session_start();
    }
    
    public function login($username, $password) {
        $stmt = $this->db->prepare("SELECT id, username, password_hash, salt FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user && hash('sha256', $password . $user['salt']) === $user['password_hash']) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            return true;
        }
        
        return false;
    }
    
    public function logout() {
        session_destroy();
    }
    
    public function isLoggedIn() {
        return isset($_SESSION['user_id']);
    }
    
    public function getUserId() {
        return $_SESSION['user_id'] ?? null;
    }
    
    public function getUsername() {
        return $_SESSION['username'] ?? null;
    }
    
    public function register($username, $password) {
        // ユーザー名の重複チェック
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
        $stmt->execute([$username]);
        
        if ($stmt->fetchColumn() > 0) {
            return false; // ユーザー名が既に存在
        }
        
        $salt = bin2hex(random_bytes(16));
        $passwordHash = hash('sha256', $password . $salt);
        
        $stmt = $this->db->prepare("
            INSERT INTO users (username, password_hash, salt, default_model, ollama_url, system_prompt) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        return $stmt->execute([$username, $passwordHash, $salt, 'llama3.2', 'http://localhost:11434', '']);
    }
    
    public function updateUser($userId, $username, $defaultModel, $ollamaUrl, $newPassword = null, $systemPrompt = null) {
        if ($newPassword) {
            $salt = bin2hex(random_bytes(16));
            $passwordHash = hash('sha256', $newPassword . $salt);
            
            $stmt = $this->db->prepare("
                UPDATE users 
                SET username = ?, default_model = ?, ollama_url = ?, password_hash = ?, salt = ?, system_prompt = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ");
            
            return $stmt->execute([$username, $defaultModel, $ollamaUrl, $passwordHash, $salt, $systemPrompt, $userId]);
        } else {
            $stmt = $this->db->prepare("
                UPDATE users 
                SET username = ?, default_model = ?, ollama_url = ?, system_prompt = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            ");
            
            return $stmt->execute([$username, $defaultModel, $ollamaUrl, $systemPrompt, $userId]);
        }
    }
    
    public function getUser($userId) {
        $stmt = $this->db->prepare("SELECT id, username, default_model, ollama_url, system_prompt FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
