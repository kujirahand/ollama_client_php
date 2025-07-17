<?php
// Ollama APIクライアント

class OllamaClient {
    private $baseUrl;
    
    public function __construct($baseUrl = 'http://localhost:11434') {
        $this->baseUrl = rtrim($baseUrl, '/');
    }
    
    public function chat($model, $messages, $stream = false) {
        $url = $this->baseUrl . '/api/chat';
        
        // $messagesが文字列の場合は従来の形式に変換
        if (is_string($messages)) {
            $messages = [
                [
                    'role' => 'user',
                    'content' => $messages
                ]
            ];
        }
        
        $data = [
            'model' => $model,
            'messages' => $messages,
            'stream' => $stream
        ];
        
        if ($stream) {
            return $this->makeStreamRequest($url, $data);
        } else {
            return $this->makeRequest($url, $data);
        }
    }
    
    public function chatStream($model, $messages) {
        return $this->chat($model, $messages, true);
    }
    
    public function listModels() {
        $url = $this->baseUrl . '/api/tags';
        return $this->makeRequest($url, null, 'GET');
    }
    
    public function getModelInfo($model) {
        $url = $this->baseUrl . '/api/show';
        $data = ['name' => $model];
        return $this->makeRequest($url, $data);
    }
    
    public function pullModel($model) {
        $url = $this->baseUrl . '/api/pull';
        $data = ['name' => $model];
        return $this->makeRequest($url, $data);
    }
    
    private function makeStreamRequest($url, $data) {
        // ストリーミング用にPHPの実行時間制限を延長
        set_time_limit(300); // 5分
        
        // ストリーミング用のヘッダーを設定
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no'); // Nginxでのバッファリング無効
        
        // 出力バッファリングを無効にする
        while (ob_get_level()) {
            ob_end_clean();
        }
        
        $ch = curl_init();
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_WRITEFUNCTION => function($ch, $data) {
                // 各ストリーミングレスポンスを処理
                $lines = explode("\n", $data);
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (empty($line)) continue;
                    
                    $json = json_decode($line, true);
                    if ($json && isset($json['message']['content'])) {
                        echo $json['message']['content'];
                        if (ob_get_level() == 0) {
                            flush();
                        } else {
                            ob_flush();
                            flush();
                        }
                    }
                    
                    // 完了チェック
                    if ($json && isset($json['done']) && $json['done']) {
                        break;
                    }
                }
                return strlen($data);
            },
            CURLOPT_TIMEOUT => 180, // 3分タイムアウト
            CURLOPT_CONNECTTIMEOUT => 30, // 接続タイムアウト30秒
        ]);
        
        $result = curl_exec($ch);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new Exception("cURL Error: $error");
        }
        
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception("HTTP Error: $httpCode");
        }
        
        return true;
    }
    
    private function makeRequest($url, $data = null, $method = 'POST') {
        $ch = curl_init();
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 180, // 3分タイムアウト
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        ]);
        
        if ($method === 'POST' && $data !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new Exception("cURL Error: $error");
        }
        
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception("HTTP Error: $httpCode - $response");
        }
        
        return json_decode($response, true);
    }
    
    public function isConnected() {
        try {
            $this->listModels();
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
}
