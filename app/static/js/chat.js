// チャット関連の関数
let historyId = 0; // 履歴IDをグローバル変数として管理
const messageHistory = []; // メッセージ履歴を管理

// ページ固有の初期化関数
function initializeChatPage() {
    console.log('Initializing chat page...');
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
    
    console.log('Chat page initialization complete');
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
    console.log('sendMessage function called');
    const messageInput = document.getElementById('messageInput');
    const modelSelect = document.getElementById('modelSelect');
    const streamMode = document.getElementById('streamMode').checked;
    const message = messageInput.value.trim();
    const model = modelSelect.value;
    
    console.log('Message:', message);
    console.log('Model:', model);
    console.log('Stream mode:', streamMode);
    
    if (!message) {
        console.error('No message provided');
        alert('メッセージを入力してください');
        return;
    }
    
    if (!model) {
        console.error('No model selected');
        alert('モデルを選択してください');
        return;
    }
    
    // UI状態の更新
    const sendButton = document.getElementById('sendButton');
    const sendText = document.getElementById('sendText');
    const sendLoading = document.getElementById('sendLoading');
    
    console.log('UI elements found:', {
        sendButton: !!sendButton,
        sendText: !!sendText,
        sendLoading: !!sendLoading
    });
    
    sendButton.disabled = true;
    sendText.style.display = 'none';
    sendLoading.style.display = 'inline-block';
    
    // ユーザーメッセージを表示
    console.log('Adding user message to chat');
    addMessageToChat('user', message);
    messageInput.value = '';
    
    // アシスタントの応答用メッセージ要素を作成
    console.log('Creating assistant message element');
    const assistantMessageElement = createAssistantMessage();
    
    try {
        console.log('Attempting to send message, stream mode:', streamMode);
        if (streamMode) {
            console.log('Using streaming mode');
            await sendStreamingMessage(model, message, assistantMessageElement);
        } else {
            console.log('Using normal mode');
            await sendNormalMessage(model, message, assistantMessageElement);
        }
        console.log('Message sent successfully');
    } catch (error) {
        console.error('Error in sendMessage:', error);
        updateAssistantMessage(assistantMessageElement, 'ネットワークエラー: ' + error.message);
    } finally {
        console.log('Resetting UI state');
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
    console.log('sendStreamingMessage called with:', { model, message });
    let fullResponse = '';
    const contentElement = assistantMessageElement.querySelector('.message-content');
    
    // ストリーミング中のカーソル表示
    contentElement.classList.add('streaming-cursor');
    
    try {
        // チャット履歴を取得して文脈を構築
        console.log('Building message history...');
        const messages = await buildMessagesHistory(message);
        console.log('Message history built:', messages);
        
        // 3分のタイムアウトを設定
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分
        
        const requestUrl = getApiUrl('chat-stream');
        const requestBody = { 
            model, 
            messages,
            history_id: historyId // 新しい履歴を作成
        };
        
        console.log('Making streaming request to:', requestUrl);
        console.log('Request body:', requestBody);
        
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        console.log('Response received:', response.status, response.statusText);
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.status);
        }
        
        // 履歴IDを取得
        historyId = response.headers.get('X-History-ID');
        console.log('新しい履歴ID:', historyId);
        
        // EventSourceを使用してSSEを処理
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let buffer = '';
        let isDone = false;
        
        console.log('ストリーミング開始');
        
        while (!isDone) {
            const { done, value } = await reader.read();
            
            if (done) {
                console.log('ストリーミング: リーダー完了');
                break;
            }
            
            // 受信したデータをデコード
            const chunk = decoder.decode(value, { stream: true });
            // console.log('受信データ:', chunk);
            
            buffer += chunk;
            
            // イベントごとに処理
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';  // 最後の不完全なイベントをバッファに保持
            
            for (const event of events) {
                if (!event.trim() || !event.startsWith('data: ')) continue;
                
                try {
                    // データ部分を取得
                    const dataStr = event.substring(6).trim();
                    
                    // 終了マーカーのチェック
                    if (dataStr === '[DONE]') {
                        console.log('ストリーミング: [DONE]マーカー検出');
                        isDone = true;
                        continue;
                    }
                    
                    // JSONとしてパース
                    const eventData = JSON.parse(dataStr);
                    // console.log('パース済みデータ:', eventData);
                    
                    if (eventData.error) {
                        throw new Error(eventData.error);
                    }
                    
                    if (eventData.content !== undefined) {
                        fullResponse += eventData.content;
                        appendToAssistantMessage(assistantMessageElement, eventData.content);
                    }
                    
                    if (eventData.done === true) {
                        console.log('ストリーミング: doneフラグ検出');
                        isDone = true;
                    }
                } catch (e) {
                    console.error('イベント解析エラー:', e, event);
                }
            }
        }
        
        // ストリーミング完了、カーソルを削除
        contentElement.classList.remove('streaming-cursor');
        console.log('ストリーミング完了');
        
        // ストリーミング完了後、履歴を更新
        if (historyId) {
            await updateChatHistory(historyId, model, message, fullResponse);
        } else {
            await saveChatHistory(model, message, fullResponse);
        }
        
    } catch (error) {
        contentElement.classList.remove('streaming-cursor');
        console.error('ストリーミングエラー:', error);
        updateAssistantMessage(assistantMessageElement, 'エラー: ' + error.message);
        
        if (error.name === 'AbortError') {
            updateAssistantMessage(assistantMessageElement, 'タイムアウトしました（3分）');
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
        const response = await fetch(getApiUrl('save-chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                user_message: userMessage,
                llm_response: llmResponse,
                messages: [
                    { role: 'user', content: userMessage },
                    { role: 'assistant', content: llmResponse }
                ]
            })
        });
        
        const result = await response.json();
        return result.id;
    } catch (error) {
        console.error('履歴保存エラー:', error);
        return null;
    }
}

async function updateChatHistory(historyId, model, userMessage, llmResponse) {
    try {
        const response = await fetch(getApiUrl('save-chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history_id: historyId,
                model: model,
                user_message: userMessage,
                llm_response: llmResponse,
                messages: [
                    { role: 'user', content: userMessage },
                    { role: 'assistant', content: llmResponse }
                ]
            })
        });
        
        const result = await response.json();
        return result.id;
    } catch (error) {
        console.error('履歴更新エラー:', error);
        return null;
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
    console.log('buildMessagesHistory called with:', currentMessage);
    try {
        // 最近のチャット履歴を取得（最大10件の会話）
        console.log('Fetching chat history...');
        const url = getApiUrl('chat', { limit: 10 });
        console.log('Request URL:', url);
        
        const response = await fetch(url);
        console.log('History response status:', response.status);
        
        const result = await response.json();
        console.log('History result:', result);
        
        const messages = [];
        // 履歴がある場合は追加
        if (result.success && result.chats) {
            console.log('Adding', result.chats.length, 'chat history items');
            result.chats.forEach(chat => {
                messages.push({ role: 'user', content: chat.user_message });
                messages.push({ role: 'assistant', content: chat.llm_response });
            });
        } else {
            console.log('No chat history found or error:', result);
        }
        // 現在のメッセージを追加
        if (currentMessage) {
            console.log('Adding current message');
            messages.push({ role: 'user', content: currentMessage });
        }
        
        console.log('Final messages array:', messages);
        return messages;
    } catch (error) {
        console.error('履歴構築エラー:', error);
        // エラーの場合は現在のメッセージのみ返す
        const fallbackMessages = currentMessage ? [{ role: 'user', content: currentMessage }] : [];
        console.log('Returning fallback messages:', fallbackMessages);
        return fallbackMessages;
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
