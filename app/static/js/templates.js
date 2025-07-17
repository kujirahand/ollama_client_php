// テンプレート管理関連の関数

let editingTemplateId = null;

async function loadTemplates() {
    try {
        const response = await fetch(getApiUrl('templates'));
        const result = await response.json();
        
        if (result.success) {
            displayTemplates(result.templates);
            updateTemplateSelect(result.templates);
        }
    } catch (error) {
        console.error('Templates load error:', error);
    }
}

function displayTemplates(templates) {
    const templateList = document.getElementById('templateList');
    if (!templateList) return;
    
    templateList.innerHTML = '';
    
    if (templates.length === 0) {
        templateList.innerHTML = '<p>テンプレートがありません。新規作成してください。</p>';
        return;
    }
    
    templates.forEach(template => {
        const templateDiv = document.createElement('div');
        templateDiv.className = 'template-item';
        
        templateDiv.innerHTML = `
            <div class="template-header">
                <div class="template-title">${template.title}</div>
                <div>
                    <button class="btn btn-secondary" onclick="editTemplate(${template.id})">編集</button>
                    <button class="btn btn-danger" onclick="deleteTemplate(${template.id})">削除</button>
                </div>
            </div>
            <div class="template-meta">
                対象モデル: ${template.target_model || 'すべて'} | 
                作成: ${new Date(template.created_at).toLocaleDateString('ja-JP')} | 
                更新: ${new Date(template.updated_at).toLocaleDateString('ja-JP')}
            </div>
            <div class="template-content">${template.content}</div>
        `;
        
        templateList.appendChild(templateDiv);
    });
}

function updateTemplateSelect(templates) {
    const select = document.getElementById('templateSelect');
    if (!select) return;
    
    // 最初のオプション以外をクリア
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.content;
        option.textContent = template.title;
        select.appendChild(option);
    });
}

function showTemplateForm() {
    const templateForm = document.getElementById('templateForm');
    const templateFormTitle = document.getElementById('templateFormTitle');
    const templateTitle = document.getElementById('templateTitle');
    const templateContent = document.getElementById('templateContent');
    const templateModel = document.getElementById('templateModel');
    
    if (templateForm) templateForm.style.display = 'block';
    if (templateFormTitle) templateFormTitle.textContent = '新しいテンプレート';
    if (templateTitle) templateTitle.value = '';
    if (templateContent) templateContent.value = '';
    if (templateModel) templateModel.value = '';
    editingTemplateId = null;
    // モデル一覧を読み込む
    loadModelsForTemplateForm();
}

// テンプレート作成フォーム用モデル一覧ロード
async function loadModelsForTemplateForm() {
    const select = document.getElementById('templateModel');
    if (!select) return;
    // 既存オプションをクリア
    select.innerHTML = '<option value="">すべてのモデル</option>';
    try {
        const response = await fetch(getApiUrl('models'));
        const result = await response.json();
        if (result.success && result.models) {
            result.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('モデル一覧取得エラー:', error);
    }
}

function cancelTemplate() {
    const templateForm = document.getElementById('templateForm');
    if (templateForm) templateForm.style.display = 'none';
    editingTemplateId = null;
}

async function saveTemplate() {
    const title = document.getElementById('templateTitle').value.trim();
    const content = document.getElementById('templateContent').value.trim();
    const targetModel = document.getElementById('templateModel').value;
    
    if (!title || !content) {
        alert('タイトルと内容を入力してください');
        return;
    }
    
    const data = { title, content, target_model: targetModel };
    let url = getApiUrl('templates');
    let method = 'POST';
    
    if (editingTemplateId) {
        data.id = editingTemplateId;
        method = 'PUT';
    }
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            cancelTemplate();
            await loadTemplates();
            alert(result.message);
        } else {
            alert('エラー: ' + result.message);
        }
    } catch (error) {
        alert('保存エラー: ' + error.message);
    }
}

async function editTemplate(id) {
    try {
        const response = await fetch(getApiUrl('templates'));
        const result = await response.json();
        
        if (result.success) {
            await loadModelsForTemplateForm();
            const template = result.templates.find(t => t.id == id);
            if (template) {
                const templateForm = document.getElementById('templateForm');
                const templateFormTitle = document.getElementById('templateFormTitle');
                const templateTitle = document.getElementById('templateTitle');
                const templateContent = document.getElementById('templateContent');
                const templateModel = document.getElementById('templateModel');
                
                if (templateForm) templateForm.style.display = 'block';
                if (templateFormTitle) templateFormTitle.textContent = 'テンプレート編集';
                if (templateTitle) templateTitle.value = template.title;
                if (templateContent) templateContent.value = template.content;
                if (templateModel) templateModel.value = template.target_model || '';
                editingTemplateId = id;
            }
        }
    } catch (error) {
        alert('テンプレート取得エラー: ' + error.message);
    }
}

async function deleteTemplate(id) {
    if (!confirm('このテンプレートを削除しますか？')) {
        return;
    }
    
    try {
        const response = await fetch(getApiUrl('templates'), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadTemplates();
            alert(result.message);
        } else {
            alert('エラー: ' + result.message);
        }
    } catch (error) {
        alert('削除エラー: ' + error.message);
    }
}

