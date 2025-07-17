// ユーザー設定関連の関数

// ページ固有の初期化関数
function initializeUserPage() {
    checkAuthStatus();
    checkOllamaStatus();
    loadUserSettings();
    // 設定画面でもモデル一覧が必要
    loadModels().then(() => {
        // モデル選択肢を設定画面のセレクトボックスに追加
        populateSettingsModelSelect();
    });
}

async function loadUserSettings() {
    if (!currentUser) return;
    
    const settingsUsername = document.getElementById('settingsUsername');
    const settingsOllamaUrl = document.getElementById('settingsOllamaUrl');
    
    if (settingsUsername) settingsUsername.value = currentUser.username;
    if (settingsOllamaUrl) settingsOllamaUrl.value = currentUser.ollama_url;
    
    // デフォルトモデルを設定
    const defaultModelSelect = document.getElementById('settingsDefaultModel');
    const chatModelSelect = document.getElementById('modelSelect');
    
    if (currentUser.default_model) {
        // 設定画面のデフォルトモデル選択
        if (defaultModelSelect) {
            const option = defaultModelSelect.querySelector(`option[value="${currentUser.default_model}"]`);
            if (option) {
                defaultModelSelect.value = currentUser.default_model;
            }
        }
        
        // チャット画面のモデル選択も更新
        if (chatModelSelect) {
            const option = chatModelSelect.querySelector(`option[value="${currentUser.default_model}"]`);
            if (option) {
                chatModelSelect.value = currentUser.default_model;
            }
        }
    }
}

// 設定画面のモデル選択肢を更新
function populateSettingsModelSelect() {
    const settingsModelSelect = document.getElementById('settingsDefaultModel');
    if (!settingsModelSelect || !window.availableModels) {
        return;
    }
    
    // 既存のオプションをクリア（最初のデフォルトオプションは残す）
    const defaultOption = settingsModelSelect.querySelector('option[value=""]');
    settingsModelSelect.innerHTML = '';
    if (defaultOption) {
        settingsModelSelect.appendChild(defaultOption);
    } else {
        settingsModelSelect.innerHTML = '<option value="">選択してください</option>';
    }
    
    // モデル一覧を追加
    window.availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        settingsModelSelect.appendChild(option);
    });
}

async function saveSettings() {
    const username = document.getElementById('settingsUsername').value.trim();
    const defaultModel = document.getElementById('settingsDefaultModel').value;
    const ollamaUrl = document.getElementById('settingsOllamaUrl').value.trim();
    const newPassword = document.getElementById('settingsNewPassword').value;
    
    if (!username) {
        showMessage('settingsMessage', 'ユーザー名を入力してください', 'error');
        return;
    }
    
    if (!ollamaUrl) {
        showMessage('settingsMessage', 'Ollama URLを入力してください', 'error');
        return;
    }
    
    const data = {
        username,
        default_model: defaultModel,
        ollama_url: ollamaUrl
    };
    
    if (newPassword) {
        if (newPassword.length < 6) {
            showMessage('settingsMessage', 'パスワードは6文字以上で入力してください', 'error');
            return;
        }
        data.new_password = newPassword;
    }
    
    try {
        const response = await fetch(getApiUrl('user'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('settingsMessage', result.message, 'success');
            
            // ユーザー情報を更新
            currentUser.username = username;
            currentUser.default_model = defaultModel;
            currentUser.ollama_url = ollamaUrl;
            
            const usernameElement = document.getElementById('username');
            if (usernameElement) usernameElement.textContent = username;
            
            // パスワードフィールドをクリア
            const settingsNewPassword = document.getElementById('settingsNewPassword');
            if (settingsNewPassword) settingsNewPassword.value = '';
            
            // チャット画面のモデル選択を更新し、ローカルストレージにも保存
            const chatModelSelect = document.getElementById('modelSelect');
            if (chatModelSelect && defaultModel) {
                chatModelSelect.value = defaultModel;
                saveSelectedModel(defaultModel); // ローカルストレージに保存
            }
            
            // Ollama接続状態を再確認
            setTimeout(checkOllamaStatus, 1000);
        } else {
            showMessage('settingsMessage', result.message, 'error');
        }
    } catch (error) {
        showMessage('settingsMessage', '設定保存エラー: ' + error.message, 'error');
    }
}

async function showInitialSetupFromSettings() {
    try {
        await loadModelsForInitialSetup();
        const initialOllamaUrl = document.getElementById('initialOllamaUrl');
        const initialDefaultModel = document.getElementById('initialDefaultModel');
        const initialSetupModal = document.getElementById('initialSetupModal');
        
        if (initialOllamaUrl) initialOllamaUrl.value = currentUser.ollama_url || 'http://localhost:11434';
        if (initialDefaultModel) initialDefaultModel.value = currentUser.default_model || '';
        if (initialSetupModal) initialSetupModal.style.display = 'block';
    } catch (error) {
        showMessage('settingsMessage', '初回設定画面の表示エラー: ' + error.message, 'error');
    }
}
