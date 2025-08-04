// Constants
const API_BASE_PATH = 'api.php';

// Global variables
let currentUser = null;
let chatHistory = [];

// ローカルストレージのキー
const STORAGE_KEYS = {
    SELECTED_MODEL: 'ollama_selected_model',
    STREAM_MODE: 'ollama_stream_mode'
};

// API URL helper function
function getApiUrl(action, params = {}) {
    const url = new URL(API_BASE_PATH, window.location.origin + window.location.pathname);
    url.searchParams.set('action', action);
    
    // 追加パラメータがある場合は追加
    Object.keys(params).forEach(key => {
        url.searchParams.set(key, params[key]);
    });
    
    return url.toString();
}

function getPageUrl(page, params = {}) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('page', page);
    
    // 追加パラメータがある場合は追加
    Object.keys(params).forEach(key => {
        url.searchParams.set(key, params[key]);
    });
    
    return url.toString();
}

// ローカルストレージ管理関数
function saveSelectedModel(modelName) {
    if (modelName) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelName);
    }
}

function getSelectedModel() {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
}

function saveStreamMode(enabled) {
    localStorage.setItem(STORAGE_KEYS.STREAM_MODE, enabled.toString());
}

function getStreamMode() {
    const saved = localStorage.getItem(STORAGE_KEYS.STREAM_MODE);
    return saved === null ? true : saved === 'true'; // デフォルトはtrue
}

// モデル一覧を読み込む
async function loadModels() {
    try {
        const response = await fetch(getApiUrl('models'));
        const result = await response.json();
        
        if (result.success && result.models) {
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                // 現在の選択値を保存
                const currentValue = modelSelect.value;
                
                // オプションをクリア（最初のオプション以外）
                modelSelect.innerHTML = '<option value="">モデルを選択...</option>';
                
                // モデルをオプションとして追加
                result.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = model.name;
                    modelSelect.appendChild(option);
                });
                
                // 保存されているモデルまたは前の選択値を復元
                const savedModel = getSelectedModel() || currentValue;
                if (savedModel && modelSelect.querySelector(`option[value="${savedModel}"]`)) {
                    modelSelect.value = savedModel;
                } else if (currentUser && currentUser.default_model) {
                    // デフォルトモデルが設定されている場合
                    const defaultOption = modelSelect.querySelector(`option[value="${currentUser.default_model}"]`);
                    if (defaultOption) {
                        modelSelect.value = currentUser.default_model;
                        saveSelectedModel(currentUser.default_model);
                    }
                }
                
                console.log('モデル一覧を読み込みました:', result.models.length, '個');
            }
        } else {
            console.error('モデル読み込みエラー:', result.message);
        }
    } catch (error) {
        console.error('モデル読み込みエラー:', error);
    }
}

// デバッグ用関数
function debugStorage() {
    console.log('=== ローカルストレージの状態 ===');
    console.log('選択中のモデル:', getSelectedModel());
    console.log('ストリーミングモード:', getStreamMode());
    console.log('================');
}

// 保存された設定を読み込む
function loadStoredSettings() {
    debugStorage();
    
    // ストリーミングモードの復元
    const streamMode = getStreamMode();
    const streamModeCheckbox = document.getElementById('streamMode');
    if (streamModeCheckbox) {
        streamModeCheckbox.checked = streamMode;
    }
}

// DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', function() {
    // 現在のページを取得
    const urlParams = new URLSearchParams(window.location.search);
    const currentPage = urlParams.get('page') || 'chat';
    
    // ページごとの初期化
    switch(currentPage) {
        case 'login':
            // ログイン画面の初期化 - 特別な処理は不要
            break;
        case 'models':
            // モデル画面の初期化
            checkAuth().then(isAuthenticated => {
                if (isAuthenticated) {
                    // ページ固有の初期化関数が存在すれば呼び出し
                    if (typeof initializeModelPage === 'function') {
                        initializeModelPage();
                    }
                } else {
                    window.location.href = 'index.php?page=login';
                }
            });
            break;
        case 'user':
            // ユーザー設定画面の初期化
            checkAuth().then(isAuthenticated => {
                if (isAuthenticated) {
                    // ページ固有の初期化関数が存在すれば呼び出し
                    if (typeof initializeUserPage === 'function') {
                        initializeUserPage();
                    }
                } else {
                    window.location.href = 'index.php?page=login';
                }
            });
            break;
        case 'chat':
        default:
            // チャット画面の初期化
            checkAuth().then(isAuthenticated => {
                if (isAuthenticated) {
                    // ページ固有の初期化関数が存在すれば呼び出し
                    if (typeof initializeChatPage === 'function') {
                        initializeChatPage();
                    }
                } else {
                    window.location.href = 'index.php?page=login';
                }
            });
            break;
    }
    
    // 共通の初期化処理
    initializeCommonElements();
});

// 共通要素の初期化
function initializeCommonElements() {
    // ストリーミングモードの設定を復元
    const streamModeCheckbox = document.getElementById('streamMode');
    if (streamModeCheckbox) {
        streamModeCheckbox.checked = getStreamMode();
        // チェックボックスの変更を監視
        streamModeCheckbox.addEventListener('change', function() {
            saveStreamMode(this.checked);
        });
    }
    
    // モデル選択の変更を監視
    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', function() {
            saveSelectedModel(this.value);
        });
    }
    
    // 初回設定モーダルの外側クリックを無効化
    const initialSetupModal = document.getElementById('initialSetupModal');
    if (initialSetupModal) {
        initialSetupModal.addEventListener('click', function(event) {
            if (event.target === this) {
                // 外側クリックでは閉じない（初回設定は重要なので）
                event.preventDefault();
            }
        });
    }
}

// 認証状態をチェックする関数
async function checkAuth() {
    console.log('Checking authentication...');
    try {
        const response = await fetch('api.php?action=user');
        console.log('Auth check response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Auth check data:', data);
            const isAuthenticated = data.success && data.user;
            console.log('Is authenticated:', isAuthenticated);
            return isAuthenticated;
        }
        console.log('Auth check failed - response not ok');
        return false;
    } catch (error) {
        console.error('認証チェックエラー:', error);
        return false;
    }
}

// メッセージ表示関数
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    
    setTimeout(() => {
        element.innerHTML = '';
    }, 5000);
}

// アラート表示関数
function showAlert(message, type = 'info') {
    // 既存のアラートを削除
    const existingAlert = document.querySelector('.alert-popup');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // 新しいアラートを作成
    const alert = document.createElement('div');
    alert.className = `alert-popup alert-${type}`;
    alert.textContent = message;
    
    document.body.appendChild(alert);
    
    // アニメーション後に自動削除
    setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 300);
    }, 3000);
}

// Ollama status check
async function checkOllamaStatus() {
    try {
        const response = await fetch(getApiUrl('ollama-status'));
        const data = await response.json();
        
        const statusElement = document.getElementById('ollamaStatus');
        const indicatorElement = document.getElementById('statusIndicator');
        
        if (statusElement && indicatorElement) {
            if (data.success && data.available) {
                statusElement.textContent = '接続中';
                indicatorElement.className = 'status-indicator online';
            } else {
                statusElement.textContent = '切断';
                indicatorElement.className = 'status-indicator offline';
            }
        }
    } catch (error) {
        console.error('Ollama status check failed:', error);
        const statusElement = document.getElementById('ollamaStatus');
        const indicatorElement = document.getElementById('statusIndicator');
        
        if (statusElement && indicatorElement) {
            statusElement.textContent = 'エラー';
            indicatorElement.className = 'status-indicator offline';
        }
    }
}

// ユーティリティ関数
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// タブ表示関数（従来の方式）
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Hide all nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
        targetTab.classList.add('active');
        event.target.classList.add('active');
        
        // Load tab-specific data
        if (tabName === 'templates') {
            loadTemplates();
        } else if (tabName === 'chat') {
            // チャットタブに戻る時にデフォルトモデルを確認
            ensureDefaultModelSelected();
        }
    }
}
