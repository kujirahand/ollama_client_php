// モデル管理関連の関数

// ページ固有の初期化関数
function initializeModelPage() {
    checkAuthStatus();
    checkOllamaStatus();
    loadModels();
}

async function loadModels() {
    try {
        const response = await fetch(getApiUrl('models'));
        const result = await response.json();
        
        if (result.success) {
            window.availableModels = result.models; // グローバルに保存
            updateModelSelects(result.models);
            displayModels(result.models);
            return result.models;
        } else {
            console.error('Models load error:', result.message);
            return [];
        }
    } catch (error) {
        console.error('Models load error:', error);
        return [];
    }
}

function updateModelSelects(models) {
    const selects = ['modelSelect', 'templateModel', 'settingsDefaultModel'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        
        // 最初のオプション以外をクリア
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            select.appendChild(option);
        });
        
        // モデル選択の復元ロジック
        if (selectId === 'modelSelect') {
            // チャット画面のモデル選択: 保存された選択 > デフォルトモデル > 最初の利用可能なモデル
            const savedModel = getSelectedModel();
            const defaultModel = currentUser?.default_model;
            
            let targetModel = null;
            
            // 保存されたモデルが利用可能かチェック
            if (savedModel && models.find(m => m.name === savedModel)) {
                targetModel = savedModel;
            }
            // デフォルトモデルが利用可能かチェック
            else if (defaultModel && models.find(m => m.name === defaultModel)) {
                targetModel = defaultModel;
            }
            // 最初の利用可能なモデルを選択
            else if (models.length > 0) {
                targetModel = models[0].name;
            }
            
            if (targetModel) {
                select.value = targetModel;
                saveSelectedModel(targetModel); // 選択を保存
            }
        } else if (selectId === 'settingsDefaultModel') {
            // 設定画面のデフォルトモデル選択
            if (currentUser?.default_model) {
                select.value = currentUser.default_model;
            }
        } else {
            // その他のセレクト（templateModel）は前の値を復元
            if (currentValue) {
                select.value = currentValue;
            }
        }
    });
}

function displayModels(models) {
    const modelList = document.getElementById('modelList');
    if (!modelList) return;
    
    modelList.innerHTML = '';
    
    models.forEach(model => {
        const modelCard = document.createElement('div');
        modelCard.className = 'model-card';
        
        const sizeText = model.size ? formatBytes(model.size) : '不明';
        const isDefault = currentUser && currentUser.default_model === model.name;
        
        modelCard.innerHTML = `
            <div class="model-name">${model.name} ${isDefault ? '⭐' : ''}</div>
            <div class="model-size">サイズ: ${sizeText}</div>
            <div class="model-size">更新: ${new Date(model.modified_at).toLocaleDateString('ja-JP')}</div>
            <div class="model-actions">
                <button class="btn btn-small" onclick="setDefaultModel('${model.name}')" ${isDefault ? 'disabled' : ''}>
                    ${isDefault ? 'デフォルト' : 'デフォルトに設定'}
                </button>
                <button class="btn btn-secondary btn-small" onclick="showModelInfo('${model.name}')">
                    詳細表示
                </button>
            </div>
        `;
        
        modelList.appendChild(modelCard);
    });
}

// デフォルトモデルを設定する関数
async function setDefaultModel(modelName) {
    if (!currentUser) {
        showAlert('ログインが必要です', 'error');
        return;
    }
    
    try {
        const response = await fetch(getApiUrl('user'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser.username,
                default_model: modelName,
                ollama_url: currentUser.ollama_url
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // ユーザー情報を更新
            currentUser.default_model = modelName;
            
            // ローカルストレージにも保存
            saveSelectedModel(modelName);
            
            // チャット画面のモデル選択を更新
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                modelSelect.value = modelName;
            }
            
            // 設定画面のデフォルトモデル選択も更新
            const settingsDefaultModel = document.getElementById('settingsDefaultModel');
            if (settingsDefaultModel) {
                settingsDefaultModel.value = modelName;
            }
            
            // モデル一覧を再描画
            await loadModels();
            
            // 成功メッセージを表示
            showAlert(`「${modelName}」をデフォルトモデルに設定しました`, 'success');
        } else {
            showAlert('デフォルトモデルの設定に失敗しました: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Default model setting error:', error);
        showAlert('デフォルトモデルの設定中にエラーが発生しました', 'error');
    }
}

async function showModelInfo(modelName) {
    try {
        const response = await fetch(getApiUrl('model-info'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const infoElement = document.getElementById('modelInfoContent');
            const containerElement = document.getElementById('modelInfo');
            
            if (infoElement && containerElement) {
                infoElement.textContent = JSON.stringify(result.modelinfo, null, 2);
                containerElement.style.display = 'block';
            }
        } else {
            showAlert('モデル情報の取得に失敗しました: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Model info error:', error);
        showAlert('モデル情報の取得中にエラーが発生しました', 'error');
    }
}

function hideModelInfo() {
    const containerElement = document.getElementById('modelInfo');
    if (containerElement) {
        containerElement.style.display = 'none';
    }
}
