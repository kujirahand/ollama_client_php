// 認証関連の関数
async function login(nextPage) {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showMessage('loginMessage', 'ユーザー名とパスワードを入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch(getApiUrl('login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('success!! logined')
            showMessage('loginMessage', result.message, 'success');
            window.location.href = getPageUrl(nextPage || 'chat');
        } else {
            showMessage('loginMessage', result.message, 'error');
        }
    } catch (error) {
        showMessage('loginMessage', 'ログインエラー: ' + error.message, 'error');
    }
}

async function register() {
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    
    if (!username || !password) {
        showMessage('registerMessage', 'ユーザー名とパスワードを入力してください', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('registerMessage', 'パスワードは6文字以上で入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch(getApiUrl('register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('registerMessage', result.message, 'success');
            setTimeout(() => {
                // 新規登録後は自動ログインして初回設定を表示
                document.getElementById('loginUsername').value = username;
                document.getElementById('loginPassword').value = password;
                showLogin();
                setTimeout(() => {
                    login();
                }, 500);
            }, 1000);
        } else {
            showMessage('registerMessage', result.message, 'error');
        }
    } catch (error) {
        showMessage('registerMessage', '登録エラー: ' + error.message, 'error');
    }
}

async function logout() {
    try {
        await fetch(getApiUrl('logout'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        currentUser = null;
        window.location.href = 'index.php?page=login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'index.php?page=login';
    }
}

async function checkAuthStatus() {
    try {
        const response = await fetch(getApiUrl('user'));
        const result = await response.json();
        
        if (result.success) {
            currentUser = result.user;
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                usernameElement.textContent = currentUser.username;
            }
            return true;
        } else {
            window.location.href = getPageUrl('login');
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = getPageUrl('login');
    }
    return false;
}

function needsInitialSetup() {
    // デフォルトモデルが設定されていない場合は初回設定が必要
    return !currentUser.default_model || currentUser.default_model === '';
}

async function showInitialSetup() {
    // まずモデル一覧を取得
    try {
        await loadModelsForInitialSetup();
        document.getElementById('initialOllamaUrl').value = currentUser.ollama_url || 'http://localhost:11434';
        document.getElementById('initialSetupModal').style.display = 'flex';
    } catch (error) {
        console.error('初回設定の表示エラー:', error);
        showMessage('initialSetupMessage', 'モデル一覧の取得に失敗しました', 'error');
    }
}

async function loadModelsForInitialSetup() {
    try {
        const response = await fetch(getApiUrl('models'));
        const result = await response.json();
        
        const select = document.getElementById('initialDefaultModel');
        select.innerHTML = '<option value="">モデルを選択してください...</option>';
        
        if (result.success && result.models) {
            result.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('モデル読み込みエラー:', error);
    }
}

async function saveInitialSetup() {
    const defaultModel = document.getElementById('initialDefaultModel').value;
    const ollamaUrl = document.getElementById('initialOllamaUrl').value;
    
    if (!defaultModel) {
        showMessage('initialSetupMessage', 'デフォルトモデルを選択してください', 'error');
        return;
    }
    
    try {
        const response = await fetch(getApiUrl('user'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                default_model: defaultModel,
                ollama_url: ollamaUrl
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('initialSetupMessage', '設定を保存しました', 'success');
            currentUser.default_model = defaultModel;
            currentUser.ollama_url = ollamaUrl;
            
            setTimeout(() => {
                document.getElementById('initialSetupModal').style.display = 'none';
                initializeMainApp();
            }, 1000);
        } else {
            showMessage('initialSetupMessage', result.message || '設定の保存に失敗しました', 'error');
        }
    } catch (error) {
        showMessage('initialSetupMessage', '設定保存エラー: ' + error.message, 'error');
    }
}

async function skipInitialSetup() {
    document.getElementById('initialSetupModal').style.display = 'none';
    await initializeMainApp();
}

async function initializeMainApp() {
    await loadUserSettings();
    loadChatHistory();
    console.log('initializeMainApp called');
    if (typeof initializeChatPage === 'function') {
        initializeChatPage();
    }
    // ログイン画面を非表示、メイン画面を表示
    window.location.href = 'index.php?page=chat';
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    if (loginScreen && registerScreen) {
        loginScreen.style.display = 'block';
        registerScreen.style.display = 'none';
    }
}

function showRegister() {
    const loginScreen = document.getElementById('loginScreen');
    const registerScreen = document.getElementById('registerScreen');
    if (loginScreen && registerScreen) {
        loginScreen.style.display = 'none';
        registerScreen.style.display = 'block';
    }
}
