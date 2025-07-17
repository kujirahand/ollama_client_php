-- デフォルトユーザーの作成
-- パスワード: admin123 (ソルト込み)
INSERT OR IGNORE INTO users (
    username, 
    password_hash, 
    salt, 
    default_model, 
    ollama_url
) VALUES (
    'admin',
    '612682276a6fb03bcc7347ae9e1b4925d534279f74d3e38f74703246bb2e8c4c',
    'ollama_salt_2024',
    '',
    'http://localhost:11434'
);
