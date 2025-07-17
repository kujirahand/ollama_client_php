<?php
/**
 * Ollama Chat Client - Main Entry Point
 * 
 * このファイルは、アプリケーションのメインエントリーポイントです。
 * テンプレートシステムを使用して、HTMLを動的に生成します。
 */

// ライブラリの読み込み
require_once 'config.php';
require_once 'lib/template.php';

// セキュリティヘッダーの設定
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// エラー表示の設定（開発環境）
// 本番環境では ini_set('display_errors', 0); に変更
ini_set('display_errors', 1);
error_reporting(E_ALL);

// セッション開始
session_start();

try {
    // テンプレートエンジンの初期化
    $template = new TemplateEngine('templates');
    
    // URLパラメータから表示する画面を決定
    $page = $_GET['page'] ?? 'default';
    
    // 許可されているページのリスト
    $allowedPages = ['login', 'chat', 'models', 'user'];
    
    // デフォルトページまたは無効なページの場合はチャット画面を表示
    if ($page === 'default' || !in_array($page, $allowedPages)) {
        $page = 'chat';
    }
    
    // アプリケーション設定
    $config = [
        'title' => 'Ollama Chat Client',
        'app_version' => '1.0.0',
        'current_year' => date('Y'),
        'debug_mode' => false,
        'generated_at' => date('Y-m-d H:i:s'),
        'current_page' => $page
    ];
    
    // ユーザー情報
    $userInfo = [
        'is_logged_in' => isset($_SESSION['user_id']),
        'username' => $_SESSION['username'] ?? 'ゲスト',
        'user_id' => $_SESSION['user_id'] ?? null,
        'show_logout' => isset($_SESSION['user_id'])
    ];
    
    // デバイス情報
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $deviceInfo = [
        'is_mobile' => preg_match('/Mobile|Android|iPhone|iPad/', $userAgent),
        'user_agent' => $userAgent
    ];
    
    // テンプレート変数の設定
    $template->assignArray($config);
    $template->assignArray($userInfo);
    $template->assignArray($deviceInfo);
    
    // ページごとの設定
    switch ($page) {
        case 'login':
            $config['title'] = 'ログイン - Ollama Chat Client';
            $userInfo['show_logout'] = false;
            break;
        case 'models':
            $config['title'] = 'モデル設定 - Ollama Chat Client';
            break;
        case 'user':
            $config['title'] = 'ユーザー設定 - Ollama Chat Client';
            break;
        case 'chat':
        default:
            $config['title'] = 'チャット - Ollama Chat Client';
            break;
    }
    
    // 更新された設定を再度アサイン
    $template->assignArray($config);
    $template->assignArray($userInfo);
    
    // ページに応じたテンプレートを表示
    if ($page === 'login') {
        // ログイン画面の場合、ヘッダーのログアウトボタンを非表示にする
        echo $template->renderLayout('header.html', 'login.html', 'footer.html');
    } else {
        // その他の画面
        echo $template->renderLayout('header.html', $page . '.html', 'footer.html');
    }
    
} catch (Exception $e) {
    // エラーハンドリング
    http_response_code(500);
    if (ini_get('display_errors')) {
        echo '<h1>アプリケーションエラー</h1>';
        echo '<p>エラー: ' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . '</p>';
        echo '<p>ファイル: ' . htmlspecialchars($e->getFile(), ENT_QUOTES, 'UTF-8') . ':' . $e->getLine() . '</p>';
    } else {
        echo '<h1>システムエラー</h1><p>しばらく時間をおいてから再度お試しください。</p>';
    }
}
?>
