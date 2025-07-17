<?php
// 実行時間制限を3分に設定
set_time_limit(180);
ini_set('max_execution_time', 180);

require_once 'config.php';
require_once 'lib/database.php';
require_once 'lib/auth.php';
require_once 'lib/ollama_client.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$database = new Database();
$auth = new Auth($database);

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    switch ($action) {
        case 'login':
            if ($method === 'POST') {
                $username = $input['username'] ?? '';
                $password = $input['password'] ?? '';
                
                if ($auth->login($username, $password)) {
                    echo json_encode(['success' => true, 'message' => 'ログイン成功']);
                } else {
                    echo json_encode(['success' => false, 'message' => 'ユーザー名またはパスワードが間違っています']);
                }
            }
            break;
            
        case 'logout':
            if ($method === 'POST') {
                $auth->logout();
                echo json_encode(['success' => true, 'message' => 'ログアウトしました']);
            }
            break;
            
        case 'register':
            if ($method === 'POST') {
                $username = $input['username'] ?? '';
                $password = $input['password'] ?? '';
                
                if ($auth->register($username, $password)) {
                    echo json_encode(['success' => true, 'message' => 'ユーザー登録が完了しました']);
                } else {
                    echo json_encode(['success' => false, 'message' => 'ユーザー名が既に存在します']);
                }
            }
            break;
            
        case 'user':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            if ($method === 'GET') {
                $user = $auth->getUser($auth->getUserId());
                echo json_encode(['success' => true, 'user' => $user]);
            } elseif ($method === 'PUT') {
                $username = $input['username'] ?? '';
                $defaultModel = $input['default_model'] ?? '';
                $ollamaUrl = $input['ollama_url'] ?? '';
                $newPassword = $input['new_password'] ?? null;
                $systemPrompt = $input['system_prompt'] ?? '';
                
                if ($auth->updateUser($auth->getUserId(), $username, $defaultModel, $ollamaUrl, $newPassword, $systemPrompt)) {
                    echo json_encode(['success' => true, 'message' => 'ユーザー情報を更新しました']);
                } else {
                    echo json_encode(['success' => false, 'message' => '更新に失敗しました']);
                }
            }
            break;
            
        case 'chat':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            if ($method === 'POST') {
                $model = $input['model'] ?? '';
                $message = $input['message'] ?? '';
                $messages = $input['messages'] ?? null;
                $stream = $input['stream'] ?? false;
                $userId = $auth->getUserId();
                
                // ユーザー情報取得（Ollama URL取得のため）
                $user = $auth->getUser($userId);
                $ollamaClient = new OllamaClient($user['ollama_url']);
                
                // messages配列が指定されている場合はそれを使用、そうでなければ従来の形式
                $chatInput = $messages ?? $message;
                
                try {
                    if ($stream) {
                        // ストリーミングモード
                        $ollamaClient->chatStream($model, $chatInput, $user['system_prompt'] ?? '');
                        
                        // ストリーミング完了後、履歴に保存するために一度通常のチャットを実行
                        // (実際の実装では、ストリーミング中に受信したデータを蓄積して保存する方が良い)
                        exit;
                    } else {
                        // 通常モード
                        $response = $ollamaClient->chat($model, $chatInput, false, $user['system_prompt'] ?? '');
                        $llmResponse = $response['message']['content'] ?? '';
                        
                        // 最新のユーザーメッセージを取得（履歴保存用）
                        $userMessage = '';
                        if (is_array($chatInput)) {
                            // messages配列から最後のuserメッセージを取得
                            for ($i = count($chatInput) - 1; $i >= 0; $i--) {
                                if ($chatInput[$i]['role'] === 'user') {
                                    $userMessage = $chatInput[$i]['content'];
                                    break;
                                }
                            }
                        } else {
                            $userMessage = $chatInput;
                        }
                        
                        // チャット履歴を保存
                        $pdo = $database->getPDO();
                        $stmt = $pdo->prepare("
                            INSERT INTO chat_history (user_id, model_name, user_message, llm_response) 
                            VALUES (?, ?, ?, ?)
                        ");
                        $stmt->execute([$userId, $model, $userMessage, $llmResponse]);
                        
                        echo json_encode([
                            'success' => true, 
                            'response' => $llmResponse,
                            'id' => $pdo->lastInsertId()
                        ]);
                    }
                } catch (Exception $e) {
                    echo json_encode(['success' => false, 'message' => 'チャットエラー: ' . $e->getMessage()]);
                }
            } elseif ($method === 'GET') {
                // チャット履歴取得
                $userId = $auth->getUserId();
                $limit = $_GET['limit'] ?? 50;
                
                $pdo = $database->getPDO();
                $stmt = $pdo->prepare("
                    SELECT * FROM chat_history 
                    WHERE user_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT ?
                ");
                $stmt->execute([$userId, $limit]);
                $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                echo json_encode(['success' => true, 'history' => array_reverse($history)]);
            }
            break;
            
        case 'models':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            if ($method === 'GET') {
                $user = $auth->getUser($auth->getUserId());
                $ollamaClient = new OllamaClient($user['ollama_url']);
                
                try {
                    $models = $ollamaClient->listModels();
                    echo json_encode(['success' => true, 'models' => $models['models'] ?? []]);
                } catch (Exception $e) {
                    echo json_encode(['success' => false, 'message' => 'モデル取得エラー: ' . $e->getMessage()]);
                }
            }
            break;
            
        case 'model-info':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            if ($method === 'POST') {
                $model = $input['model'] ?? '';
                $user = $auth->getUser($auth->getUserId());
                $ollamaClient = new OllamaClient($user['ollama_url']);
                
                try {
                    $info = $ollamaClient->getModelInfo($model);
                    echo json_encode(['success' => true, 'info' => $info]);
                } catch (Exception $e) {
                    echo json_encode(['success' => false, 'message' => 'モデル情報取得エラー: ' . $e->getMessage()]);
                }
            }
            break;
            
        case 'chat-stream':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            if ($method === 'POST') {
                // ストリーミング用に実行時間制限をさらに延長
                set_time_limit(300); // 5分
                
                $model = $input['model'] ?? '';
                $message = $input['message'] ?? '';
                $messages = $input['messages'] ?? null;
                $userId = $auth->getUserId();
                
                // ユーザー情報取得（Ollama URL取得のため）
                $user = $auth->getUser($userId);
                $ollamaClient = new OllamaClient($user['ollama_url']);
                
                // messages配列が指定されている場合はそれを使用、そうでなければ従来の形式
                $chatInput = $messages ?? $message;
                
                try {
                    // ストリーミングモードで実行
                    $ollamaClient->chatStream($model, $chatInput, $user['system_prompt'] ?? '');
                } catch (Exception $e) {
                    echo "エラー: " . $e->getMessage();
                }
            }
            break;
            
        case 'save-chat':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            if ($method === 'POST') {
                $model = $input['model'] ?? '';
                $userMessage = $input['user_message'] ?? '';
                $llmResponse = $input['llm_response'] ?? '';
                $userId = $auth->getUserId();
                
                try {
                    // チャット履歴を保存
                    $pdo = $database->getPDO();
                    $stmt = $pdo->prepare("
                        INSERT INTO chat_history (user_id, model_name, user_message, llm_response) 
                        VALUES (?, ?, ?, ?)
                    ");
                    $stmt->execute([$userId, $model, $userMessage, $llmResponse]);
                    
                    echo json_encode([
                        'success' => true, 
                        'message' => 'チャット履歴を保存しました',
                        'id' => $pdo->lastInsertId()
                    ]);
                } catch (Exception $e) {
                    echo json_encode(['success' => false, 'message' => '保存エラー: ' . $e->getMessage()]);
                }
            }
            break;
            
        case 'templates':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            $userId = $auth->getUserId();
            $pdo = $database->getPDO();
            
            if ($method === 'GET') {
                $stmt = $pdo->prepare("SELECT * FROM prompt_templates WHERE user_id = ? ORDER BY updated_at DESC");
                $stmt->execute([$userId]);
                $templates = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'templates' => $templates]);
                
            } elseif ($method === 'POST') {
                $title = $input['title'] ?? '';
                $content = $input['content'] ?? '';
                $targetModel = $input['target_model'] ?? '';
                
                $stmt = $pdo->prepare("
                    INSERT INTO prompt_templates (user_id, title, content, target_model) 
                    VALUES (?, ?, ?, ?)
                ");
                
                if ($stmt->execute([$userId, $title, $content, $targetModel])) {
                    echo json_encode(['success' => true, 'message' => 'テンプレートを保存しました', 'id' => $pdo->lastInsertId()]);
                } else {
                    echo json_encode(['success' => false, 'message' => '保存に失敗しました']);
                }
                
            } elseif ($method === 'PUT') {
                $id = $input['id'] ?? '';
                $title = $input['title'] ?? '';
                $content = $input['content'] ?? '';
                $targetModel = $input['target_model'] ?? '';
                
                $stmt = $pdo->prepare("
                    UPDATE prompt_templates 
                    SET title = ?, content = ?, target_model = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ? AND user_id = ?
                ");
                
                if ($stmt->execute([$title, $content, $targetModel, $id, $userId])) {
                    echo json_encode(['success' => true, 'message' => 'テンプレートを更新しました']);
                } else {
                    echo json_encode(['success' => false, 'message' => '更新に失敗しました']);
                }
                
            } elseif ($method === 'DELETE') {
                $id = $input['id'] ?? '';
                
                $stmt = $pdo->prepare("DELETE FROM prompt_templates WHERE id = ? AND user_id = ?");
                
                if ($stmt->execute([$id, $userId])) {
                    echo json_encode(['success' => true, 'message' => 'テンプレートを削除しました']);
                } else {
                    echo json_encode(['success' => false, 'message' => '削除に失敗しました']);
                }
            }
            break;
            
        case 'ollama-status':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'need to be logged in']);
                break;
            }
            if ($method === 'GET') {
                $user = $auth->getUser($auth->getUserId());
                $ollamaClient = new OllamaClient($user['ollama_url']);

                $isConnected = $ollamaClient->isConnected();
                echo json_encode([
                    'success' => true,
                    'available' => $isConnected, // ←ここをavailableに
                    'url' => $user['ollama_url']
                ]);
            }
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'エンドポイントが見つかりません']);
            break;
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'サーバーエラー: ' . $e->getMessage()]);
}
