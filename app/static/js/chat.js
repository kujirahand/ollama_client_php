// チャット関連の関数

// ページ固有の初期化関数
function initializeChatPage() {
    checkAuthStatus();
    checkOllamaStatus();
    loadStoredSettings();
    loadModels();
    loadTemplates();
    loadChatHistory();

    // チャットエリアのリサイズ
    resizeChatArea();
    window.addEventListener('resize', resizeChatArea);

    // チェック間隔を延長（30秒）
    setInterval(checkOllamaStatus, 30000);

    // デフォルトモデルの選択状態を確認
    setTimeout(() => {
        ensureDefaultModelSelected();
    }, 1000);
}

// 画面サイズに合わせて.chat-areaの高さを調整
function resizeChatArea() {
    const chatArea = document.querySelector('.chat-area');
    const mainApp = document.getElementById('mainApp');
    const controls = document.querySelector('.chat-controls');
    const inputArea = document.querySelector('.input-area');
    if (!chatArea || !mainApp || !controls || !inputArea) return;

    // mainAppの高さからコントロール・入力欄・余白を引く
    const mainHeight = mainApp.clientHeight;
    const controlsHeight = controls.offsetHeight;
    const inputHeight = inputArea.offsetHeight;
    const margin = 150; // 余白分
    const newHeight = Math.max(mainHeight - controlsHeight - inputHeight - margin, 200);
    chatArea.style.height = newHeight + 'px';
}

async function ensureDefaultModelSelected() {
    if (!currentUser || !currentUser.default_model) {
        return;
    }
    
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) {
        return;
    }
    
    // 保存されているモデルまたはデフォルトモデルを選択
    const savedModel = getSelectedModel() || currentUser.default_model;
    
    // セレクトボックスにオプションが存在するかチェック
    const option = modelSelect.querySelector(`option[value="${savedModel}"]`);
    if (option) {
        modelSelect.value = savedModel;
        saveSelectedModel(savedModel); // ローカルストレージにも保存
        console.log('デフォルトモデルを選択:', savedModel);
    } else {
        console.warn('デフォルトモデルが見つかりません:', savedModel);
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const modelSelect = document.getElementById('modelSelect');
    const streamMode = document.getElementById('streamMode').checked;
    const message = messageInput.value.trim();
    const model = modelSelect.value;
    
    if (!message) {
        alert('メッセージを入力してください');
        return;
    }
    
    if (!model) {
        alert('モデルを選択してください');
        return;
    }
    
    // UI状態の更新
    const sendButton = document.getElementById('sendButton');
    const sendText = document.getElementById('sendText');
    const sendLoading = document.getElementById('sendLoading');
    
    sendButton.disabled = true;
    sendText.style.display = 'none';
    sendLoading.style.display = 'inline-block';
    
    // ユーザーメッセージを表示
    addMessageToChat('user', message);
    messageInput.value = '';
    
    // アシスタントの応答用メッセージ要素を作成
    const assistantMessageElement = createAssistantMessage();
    
    try {
        if (streamMode) {
            await sendStreamingMessage(model, message, assistantMessageElement);
        } else {
            await sendNormalMessage(model, message, assistantMessageElement);
        }
    } catch (error) {
        updateAssistantMessage(assistantMessageElement, 'ネットワークエラー: ' + error.message);
    } finally {
        // UI状態をリセット
        sendButton.disabled = false;
        sendText.style.display = 'inline';
        sendLoading.style.display = 'none';
    }
}

function createAssistantMessage() {
    const chatArea = document.getElementById('chatArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    messageDiv.innerHTML = `
        <div class="message-header">
            🤖 Assistant
            <button class="copy-btn" onclick="copyMessage(this)">コピー</button>
        </div>
        <div class="message-content"></div>
    `;
    
    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
    
    return messageDiv;
}

function updateAssistantMessage(messageElement, content) {
    const contentElement = messageElement.querySelector('.message-content');
    contentElement.textContent = content;
    
    // スクロールを最下部に
    const chatArea = document.getElementById('chatArea');
    chatArea.scrollTop = chatArea.scrollHeight;
}

function appendToAssistantMessage(messageElement, chunk) {
    const contentElement = messageElement.querySelector('.message-content');
    contentElement.textContent += chunk;
    
    // スクロールを最下部に
    const chatArea = document.getElementById('chatArea');
    chatArea.scrollTop = chatArea.scrollHeight;
}

async function sendStreamingMessage(model, message, assistantMessageElement) {
    let fullResponse = '';
    const contentElement = assistantMessageElement.querySelector('.message-content');
    
    // ストリーミング中のカーソル表示
    contentElement.classList.add('streaming-cursor');
    
    try {
        // チャット履歴を取得して文脈を構築
        const messages = await buildMessagesHistory(message);
        
        // 3分のタイムアウトを設定
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分
        
        const response = await fetch(getApiUrl('chat-stream'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            appendToAssistantMessage(assistantMessageElement, chunk);
        }
        
        // ストリーミング完了、カーソルを削除
        contentElement.classList.remove('streaming-cursor');
        
        // ストリーミング完了後、履歴に保存
        await saveChatHistory(model, message, fullResponse);
        
    } catch (error) {
        contentElement.classList.remove('streaming-cursor');
        if (error.name === 'AbortError') {
            updateAssistantMessage(assistantMessageElement, 'タイムアウトしました（3分）');
        } else {
            updateAssistantMessage(assistantMessageElement, 'エラーが発生しました: ' + error.message);
        }
        throw error;
    }
}

async function sendNormalMessage(model, message, assistantMessageElement) {
    try {
        // チャット履歴を取得して文脈を構築
        const messages = await buildMessagesHistory(message);
        
        const response = await fetch(getApiUrl('chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages })
        });
        
        const result = await response.json();
        // ...existing code...
    } catch (error) {
        // ...existing code...
    }
}
async function saveChatHistory(model, userMessage, llmResponse) {
    try {
        await fetch(getApiUrl('save-chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                user_message: userMessage,
                llm_response: llmResponse
            })
        });
    } catch (error) {
        console.error('履歴保存エラー:', error);
    }
}

function addMessageToChat(role, content) {
    const chatArea = document.getElementById('chatArea');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const header = role === 'user' ? '👤 You' : '🤖 Assistant';
    const copyButton = role === 'assistant' ? '<button class="copy-btn" onclick="copyMessage(this)">コピー</button>' : '';
    
    messageDiv.innerHTML = `
        <div class="message-header">${header}${copyButton}</div>
        <div class="message-content">${content}</div>
    `;
    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function copyMessage(button) {
    const messageContent = button.closest('.message').querySelector('.message-content').textContent;
    navigator.clipboard.writeText(messageContent).then(() => {
        button.textContent = 'コピー済み';
        setTimeout(() => {
            button.textContent = 'コピー';
        }, 2000);
    });
}

async function loadChatHistory() {
    try {
        const response = await fetch(getApiUrl('chat', { limit: 20 }));
        const result = await response.json();
        
        if (result.success && result.chats) {
            const chatArea = document.getElementById('chatArea');
            
            // 初期メッセージ以外をクリア
            const messages = chatArea.querySelectorAll('.message:not(.assistant:first-child)');
            messages.forEach(msg => msg.remove());
            
            // チャット履歴を表示（時系列順）
            result.chats.forEach(chat => {
                addMessageToChat('user', chat.user_message);
                addMessageToChat('assistant', chat.llm_response);
            });
        }
    } catch (error) {
        console.error('チャット履歴の読み込みエラー:', error);
    }
}

function clearChat() {
    if (confirm('チャット履歴を削除しますか？')) {
        const chatArea = document.getElementById('chatArea');
        const messages = chatArea.querySelectorAll('.message:not(.assistant:first-child)');
        messages.forEach(msg => msg.remove());
    }
}

function handleKeyDown(event) {
    // IME入力中は無視
    if (event.isComposing) {
        return;
    }
    
    if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function handleCompositionStart(event) {
    event.target.isComposing = true;
}

function handleCompositionEnd(event) {
    event.target.isComposing = false;
}

async function buildMessagesHistory(currentMessage) {
    try {
        // 最近のチャット履歴を取得（最大10件の会話）
        const response = await fetch(getApiUrl('chat', { limit: 10 }));
        const result = await response.json();
        const messages = [];
        // 履歴がある場合は追加
        if (result.success && result.chats) {
            result.chats.forEach(chat => {
                messages.push({ role: 'user', content: chat.user_message });
                messages.push({ role: 'assistant', content: chat.llm_response });
            });
        }
        // 現在のメッセージを追加
        if (currentMessage) {
            messages.push({ role: 'user', content: currentMessage });
        }
        return messages;
    } catch (error) {
        console.error('履歴構築エラー:', error);
        // エラーの場合は現在のメッセージのみ返す
        return currentMessage ? [{ role: 'user', content: currentMessage }] : [];
    }
}

async function insertTemplate() {
    const templateSelect = document.getElementById('templateSelect');
    const messageInput = document.getElementById('messageInput');
    
    if (templateSelect && messageInput) {
        const selectedTemplate = templateSelect.value;
        if (selectedTemplate) {
            messageInput.value = selectedTemplate;
            templateSelect.value = ''; // 選択をクリア
        }
    }
}
