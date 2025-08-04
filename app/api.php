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
        case 'hello':
            // シンプルな動作確認用API
            $response = [
                'success' => true,
                'message' => 'Hello, API is working!',
                'timestamp' => date('Y-m-d H:i:s'),
                'method' => $method,
                'request_info' => [
                    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
                    'input' => $input
                ]
            ];
            
            echo json_encode($response);
            break;
            
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
                
                if ($message == '/clear') {
                    // チャット履歴を削除せずに、クリアメッセージだけを追加
                    $pdo = $database->getPDO();
                    
                    // モデルが空の場合はユーザーのデフォルトモデルを使用
                    if (empty($model)) {
                        $user = $auth->getUser($userId);
                        $model = $user['default_model'] ?? 'unknown';
                    }
                    
                    // コマンド自体を履歴に追加
                    $stmt = $pdo->prepare("
                        INSERT INTO chat_history (user_id, model, messages) 
                        VALUES (?, ?, ?)
                    ");
                    $clearMessage = json_encode([
                        ['role' => 'user', 'content' => $message],
                        ['role' => 'assistant', 'content' => 'チャット履歴をクリアしました']
                    ]);
                    $stmt->execute([$userId, $model, $clearMessage]);
                    
                    echo json_encode(['success' => true, 'message' => 'チャット履歴をクリアしました', 'response' => 'チャット履歴をクリアしました']);
                    exit;
                }

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
                        
                        // メッセージ履歴用の配列を準備
                        $messagesHistory = [];
                        
                        // history_idが指定されていれば既存の履歴を取得して追加
                        $historyId = $input['history_id'] ?? null;
                        $existingMessages = [];
                        
                        if ($historyId) {
                            // 既存の履歴があれば取得
                            $stmt = $pdo->prepare("SELECT messages FROM chat_history WHERE id = ? AND user_id = ?");
                            $stmt->execute([$historyId, $userId]);
                            $result = $stmt->fetch(PDO::FETCH_ASSOC);
                            
                            if ($result && !empty($result['messages'])) {
                                $existingMessages = json_decode($result['messages'], true) ?? [];
                                $messagesHistory = $existingMessages;
                            }
                        }
                        
                        // 新しいメッセージを追加
                        if (is_array($chatInput)) {
                            // 既にmessages形式の場合はそのまま追加
                            $messagesHistory = array_merge($messagesHistory, $chatInput);
                        } else {
                            // 文字列の場合はuser roleとして追加
                            $messagesHistory[] = ['role' => 'user', 'content' => $chatInput];
                        }
                        
                        // アシスタントの応答を追加
                        $messagesHistory[] = ['role' => 'assistant', 'content' => $llmResponse];
                        
                        // チャット履歴を保存
                        $pdo = $database->getPDO();
                        
                        if ($historyId) {
                            // 既存の履歴を更新
                            $stmt = $pdo->prepare("
                                UPDATE chat_history 
                                SET model = ?, messages = ?, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ? AND user_id = ?
                            ");
                            $messagesJson = json_encode($messagesHistory);
                            $stmt->execute([$model, $messagesJson, $historyId, $userId]);
                            
                            $id = $historyId;
                        } else {
                            // 新規履歴を作成
                            $stmt = $pdo->prepare("
                                INSERT INTO chat_history (user_id, model, messages) 
                                VALUES (?, ?, ?)
                            ");
                            $messagesJson = json_encode($messagesHistory);
                            $stmt->execute([$userId, $model, $messagesJson]);
                            
                            $id = $pdo->lastInsertId();
                        }
                        
                        echo json_encode([
                            'success' => true, 
                            'response' => $llmResponse,
                            'id' => $id
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
                
                // messages フィールドを JSON からデコード
                foreach ($history as &$entry) {
                    if (isset($entry['messages'])) {
                        $entry['messages'] = json_decode($entry['messages'], true);
                    }
                }
                
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
                $historyId = $input['history_id'] ?? null;
                $userId = $auth->getUserId();
                
                // ユーザー情報取得（Ollama URL取得のため）
                $user = $auth->getUser($userId);
                $ollamaClient = new OllamaClient($user['ollama_url']);
                
                // messages配列が指定されている場合はそれを使用、そうでなければ従来の形式
                $chatInput = $messages ?? $message;
                
                try {
                    // 新規に履歴を作成するかどうか
                    $createNewHistory = ($historyId === 'new' || $historyId === null);
                    $pdo = $database->getPDO();
                    
                    if ($createNewHistory) {
                        // 新規の履歴を作成
                        // メッセージ履歴用の配列を準備
                        $messagesHistory = [];
                        
                        // ユーザーのメッセージを追加
                        if (is_array($chatInput)) {
                            // 既にmessages形式の場合はそのまま追加
                            $messagesHistory = $chatInput;
                        } else {
                            // 文字列の場合はuser roleとして追加
                            $messagesHistory[] = ['role' => 'user', 'content' => $chatInput];
                        }
                        
                        // 空のassistant応答を追加（ストリーミング用）
                        $messagesHistory[] = ['role' => 'assistant', 'content' => ''];
                        
                        $stmt = $pdo->prepare("
                            INSERT INTO chat_history (user_id, model, messages) 
                            VALUES (?, ?, ?)
                        ");
                        $messagesJson = json_encode($messagesHistory);
                        $stmt->execute([$userId, $model, $messagesJson]);
                        
                        // 新しい履歴IDをクライアントに送信
                        $newId = $pdo->lastInsertId();
                        header('X-History-ID: ' . $newId);
                    } else if ($historyId) {
                        // 既存の履歴IDをクライアントに送信
                        header('X-History-ID: ' . $historyId);
                    }
                    
                    // ストリーミングモードで実行
                    $ollamaClient->chatStream($model, $chatInput, $user['system_prompt'] ?? '');
                    
                    // ストリーミングが完了した後はPHPの実行が終了するため、ここに到達しません
                    
                } catch (Exception $e) {
                    // Server-Sent Events形式でエラーを送信
                    header('Content-Type: text/event-stream');
                    header('Cache-Control: no-cache');
                    header('Connection: keep-alive');
                    echo "data: " . json_encode(['error' => $e->getMessage()]) . "\n\n";
                    echo "data: [DONE]\n\n";
                    flush();
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
                $historyId = $input['history_id'] ?? null;
                $messagesArray = $input['messages'] ?? null;
                $userId = $auth->getUserId();
                
                try {
                    // チャット履歴を保存または更新
                    $pdo = $database->getPDO();
                    
                    // メッセージ配列の処理
                    if ($messagesArray) {
                        // 既に配列が提供されている場合はそれを使用
                        $messagesJson = json_encode($messagesArray);
                    } else {
                        // user_messageとllm_responseから配列を構築
                        $messagesJson = json_encode([
                            ['role' => 'user', 'content' => $userMessage],
                            ['role' => 'assistant', 'content' => $llmResponse]
                        ]);
                    }
                    
                    if ($historyId) {
                        // 既存の履歴を更新
                        $stmt = $pdo->prepare("
                            UPDATE chat_history 
                            SET model = ?, messages = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ? AND user_id = ?
                        ");
                        $stmt->execute([$model, $messagesJson, $historyId, $userId]);
                        $id = $historyId;
                    } else {
                        // 新規履歴を作成
                        $stmt = $pdo->prepare("
                            INSERT INTO chat_history (user_id, model, messages) 
                            VALUES (?, ?, ?)
                        ");
                        $stmt->execute([$userId, $model, $messagesJson]);
                        $id = $pdo->lastInsertId();
                    }
                    
                    echo json_encode([
                        'success' => true, 
                        'message' => 'チャット履歴を保存しました',
                        'id' => $id
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
            
        case 'delete-chat-history':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            if ($method === 'POST') {
                $historyId = $input['history_id'] ?? null;
                $userId = $auth->getUserId();
                
                if (!$historyId) {
                    echo json_encode(['success' => false, 'message' => '履歴IDが指定されていません']);
                    break;
                }
                
                try {
                    $pdo = $database->getPDO();
                    $stmt = $pdo->prepare("DELETE FROM chat_history WHERE id = ? AND user_id = ?");
                    $stmt->execute([$historyId, $userId]);
                    
                    if ($stmt->rowCount() > 0) {
                        echo json_encode(['success' => true, 'message' => '履歴を削除しました']);
                    } else {
                        echo json_encode(['success' => false, 'message' => '履歴が見つからないか、削除権限がありません']);
                    }
                } catch (Exception $e) {
                    echo json_encode(['success' => false, 'message' => '削除エラー: ' . $e->getMessage()]);
                }
            }
            break;
            
        case 'delete-all-chat-history':
            if (!$auth->isLoggedIn()) {
                echo json_encode(['success' => false, 'message' => 'ログインが必要です']);
                break;
            }
            
            if ($method === 'POST') {
                $userId = $auth->getUserId();
                
                try {
                    $pdo = $database->getPDO();
                    $stmt = $pdo->prepare("DELETE FROM chat_history WHERE user_id = ?");
                    $stmt->execute([$userId]);
                    
                    echo json_encode(['success' => true, 'message' => '全ての履歴を削除しました', 'count' => $stmt->rowCount()]);
                } catch (Exception $e) {
                    echo json_encode(['success' => false, 'message' => '削除エラー: ' . $e->getMessage()]);
                }
            }
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'エンドポイントが見つかりません']);
            break;
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'サーバーエラー: ' . $e->getMessage()]);
}
