/**
 * CRM AI 智能工作台 — 前端应用
 *
 * 功能：多视图切换、流式对话、数据看板、客户卡片、知识库搜索、API 设置
 * 架构：单页应用 (SPA)，通过 fetch + ReadableStream 与后端 SSE 接口通信
 */

// ============================================================
// 设置面板 — API Key / Base URL / Model
// ============================================================
var API_CONFIG = { baseUrl: '', apiKey: '', model: '' };

// 预设配置
var PRESETS = {
  deepseek: { baseUrl: 'https://api.deepseek.com/anthropic', model: 'deepseek-v4-pro' },
  kimi:     { baseUrl: 'https://api.moonshot.ai/anthropic',  model: 'kimi-k2.6' },
  glm:      { baseUrl: 'https://open.bigmodel.cn/api/anthropic', model: 'glm-4.5' }
};

function loadSettings(){
  try{
    var s=JSON.parse(localStorage.getItem('crm_ai_settings'));
    if(s){ API_CONFIG.baseUrl=s.baseUrl||''; API_CONFIG.apiKey=s.apiKey||''; API_CONFIG.model=s.model||''; }
  }catch(e){}
}

function openSettings(){
  document.getElementById('set-base-url').value=API_CONFIG.baseUrl;
  document.getElementById('set-api-key').value=API_CONFIG.apiKey;
  document.getElementById('set-model').value=API_CONFIG.model;
  document.getElementById('settings-overlay').classList.remove('hidden');
  document.getElementById('settings-msg').textContent='';
}

function closeSettings(e){
  if(e&&e.target!==document.getElementById('settings-overlay'))return;
  document.getElementById('settings-overlay').classList.add('hidden');
}

function applyPreset(name){
  var p=PRESETS[name];
  if(p){ document.getElementById('set-base-url').value=p.baseUrl; document.getElementById('set-model').value=p.model; }
}

function saveSettings(){
  API_CONFIG.baseUrl=document.getElementById('set-base-url').value.trim();
  API_CONFIG.apiKey=document.getElementById('set-api-key').value.trim();
  API_CONFIG.model=document.getElementById('set-model').value.trim();
  localStorage.setItem('crm_ai_settings',JSON.stringify(API_CONFIG));
  document.getElementById('settings-msg').textContent='✓ 已保存 (下次对话生效)';
  setTimeout(function(){document.getElementById('settings-overlay').classList.add('hidden')},800);
}

loadSettings();

// ============================================================
// 登录 / 注册
// ============================================================
var AUTH_USER = null;

function switchAuthTab(tab){
  document.querySelectorAll('.auth-tab').forEach(function(t){t.classList.remove('active')});
  document.querySelector('.auth-tab[onclick*="'+tab+'"]').classList.add('active');
  document.getElementById('login-form').classList.toggle('hidden',tab!=='login');
  document.getElementById('register-form').classList.toggle('hidden',tab!=='register');
  document.getElementById('auth-msg').textContent='';
}

function doLogin(e){
  e.preventDefault();
  var u=document.getElementById('login-username').value.trim();
  // 开发环境：任意用户名+任意密码即可登录
  AUTH_USER={id:u,name:u};
  document.getElementById('auth-overlay').style.display='none';
  document.getElementById('auth-msg').textContent='';
}

function doRegister(e){
  e.preventDefault();
  var p1=document.getElementById('reg-password').value;
  var p2=document.getElementById('reg-password2').value;
  if(p1!==p2){document.getElementById('auth-msg').textContent='两次密码不一致';return;}
  var u=document.getElementById('reg-username').value.trim();
  localStorage.setItem('crm_ai_user',JSON.stringify({id:u,name:u}));
  AUTH_USER={id:u,name:u};
  document.getElementById('auth-overlay').style.display='none';
}

// 检查是否已登录
try{var saved=JSON.parse(localStorage.getItem('crm_ai_user'));if(saved)AUTH_USER=saved;document.getElementById('auth-overlay').style.display='none'}catch(e){}

// ============================================================
// 状态管理
// ============================================================

const state = {
  currentView: 'chat',
  userId: 'dev-sales-001',   // 开发环境 Mock
  sessionId: null,           // Agent 会话ID（跨轮对话复用）
  isStreaming: false,
};

// ============================================================
// 视图切换
// ============================================================

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add('active');

  if (view === 'customers') renderCustomerCards();
  if (view === 'knowledge') renderKnowledgeResults('');
}

// ============================================================
// 对话功能
// ============================================================

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatLoading = document.getElementById('chat-loading');
const modelSelect = document.getElementById('model-select');

function initChat() {
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // 快捷按钮
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.prompt;
      sendMessage();
    });
  });

  // 新对话
  document.getElementById('new-chat-btn').addEventListener('click', () => {
    state.sessionId = null;
    chatMessages.innerHTML = '';
    addWelcomeMessage();
  });
}

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || state.isStreaming) return;

  state.isStreaming = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;
  chatLoading.classList.remove('hidden');

  // 添加用户消息
  appendMessage('user', message);
  scrollToBottom();

  try {
    const response = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': state.userId,
      },
      body: JSON.stringify({
        message,
        task_type: modelSelect.value,
        session_id: state.sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 读取 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantDiv = null;
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';  // 最后不完整的行留在 buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (!data) continue;

        try {
          const event = JSON.parse(data);

          if (event.type === 'text_delta') {
            if (!assistantDiv) {
              assistantDiv = document.createElement('div');
              assistantDiv.className = 'message assistant';
              const contentDiv = document.createElement('div');
              contentDiv.className = 'message-content';
              assistantDiv.appendChild(contentDiv);
              chatMessages.appendChild(assistantDiv);
            }
            fullContent += event.content;
            // 渲染 Markdown（简单版）
            assistantDiv.querySelector('.message-content').innerHTML = renderMarkdown(fullContent);
            scrollToBottom();
          } else if (event.type === 'tool_call') {
            // 显示工具调用状态
            const toolDiv = document.createElement('div');
            toolDiv.className = 'message system';
            toolDiv.innerHTML = `<div class="message-content" style="font-size:12px;color:var(--gray-500);">🔧 调用工具: <strong>${event.tool_name}</strong></div>`;
            chatMessages.appendChild(toolDiv);
            scrollToBottom();
          } else if (event.type === 'done') {
            state.sessionId = event.session_id || state.sessionId;
            if (event.usage) {
              console.log('Token usage:', event.usage);
            }
          } else if (event.type === 'error') {
            appendMessage('system', `❌ 错误: ${event.content}`);
          }
        } catch (e) {
          console.error('Parse event error:', e, data);
        }
      }
    }
  } catch (error) {
    appendMessage('system', `❌ 连接失败: ${error.message}`);
  } finally {
    state.isStreaming = false;
    sendBtn.disabled = false;
    chatLoading.classList.add('hidden');
    chatInput.focus();
    scrollToBottom();
  }
}

function appendMessage(type, content) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  if (type === 'assistant') {
    contentDiv.innerHTML = renderMarkdown(content);
  } else {
    contentDiv.textContent = content;
  }
  div.appendChild(contentDiv);
  chatMessages.appendChild(div);
}

function addWelcomeMessage() {
  // 欢迎消息已在 HTML 中，新对话时重新添加
  chatMessages.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'message system';
  div.innerHTML = `<div class="message-content">
    <p>👋 你好！我是 CRM AI 助手。开始提问吧～</p>
    <p class="hint">试试输入你的问题 👇</p>
  </div>`;
  chatMessages.appendChild(div);
}

/**
 * 简易 Markdown → HTML 渲染（生产环境可用 marked/markdown-it）
 */
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    // 标题
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 粗体/斜体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // 换行
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  // 修复空段落
  html = html.replace(/<p><\/p>/g, '');
  // 包装连续的 li
  html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
  return html;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================================
// 客户卡片
// ============================================================

const MOCK_CUSTOMERS = [
  { id: 'C001', name: '上海美妆科技有限公司', industry: '电商', level: 'S', cost_30d: '285万', roi: 3.3, health: 'healthy' },
  { id: 'C002', name: '杭州鲸灵网络有限公司', industry: '游戏', level: 'A', cost_30d: '152万', roi: 1.3, health: 'warning' },
  { id: 'C003', name: '南京星辉教育科技有限公司', industry: '教育', level: 'B', cost_30d: '68万', roi: 2.1, health: 'warning' },
  { id: 'C004', name: '北京未来科技有限公司', industry: 'AI/科技', level: 'S', cost_30d: '520万', roi: 4.5, health: 'healthy' },
  { id: 'C005', name: '深圳鹏程电商有限公司', industry: '电商', level: 'A', cost_30d: '890万', roi: 2.9, health: 'healthy' },
];

function renderCustomerCards() {
  const grid = document.getElementById('customer-grid');
  if (!grid) return;

  const levelClass = { S: 'level-S', A: 'level-A', B: 'level-B', C: 'level-C' };
  const healthIcon = { healthy: '🟢', warning: '🟡', risk: '🔴' };

  grid.innerHTML = MOCK_CUSTOMERS.map(c => `
    <div class="customer-card" onclick="switchView('chat'); chatInput.value='帮我看看${c.name}的详细情况'; sendMessage();">
      <div class="card-header">
        <span class="customer-name">${c.name}</span>
        <span class="customer-level ${levelClass[c.level] || ''}">${c.level}</span>
      </div>
      <div class="card-stats">
        <span>行业: ${c.industry}</span>
        <span>近30天消耗: <strong>¥${c.cost_30d}</strong></span>
      </div>
      <div class="card-stats" style="margin-top:6px;">
        <span>ROI: <strong>${c.roi}</strong></span>
        <span>状态: <span class="badge-${c.health}">${healthIcon[c.health] || ''}</span></span>
      </div>
    </div>
  `).join('');
}

// ============================================================
// 知识库搜索
// ============================================================

function renderKnowledgeResults(query = '') {
  const container = document.getElementById('knowledge-results');
  if (!container) return;

  const mockResults = [
    { title: '巨量千川 oCPM 出价策略详解', content: 'oCPM是千川智能出价产品，以转化为优化目标...', category: '产品', source: '千川帮助中心' },
    { title: '电商行业投放最佳实践', content: '优化重点：素材CTR > 落地页CVR > 出价策略...', category: '策略', source: '运营团队' },
    { title: '教育行业广告合规要点', content: '学科类培训广告全面禁止投放，非学科需提供资质...', category: '政策', source: '审核中心' },
    { title: '游戏买量ROI优化案例', content: '通过素材优化+定向+出价策略将ROI从1.2提升至2.5...', category: '案例', source: '案例库' },
    { title: '巨量搜索广告投放指南', content: '搜索流量转化率是信息流的3-5倍，短语匹配为主...', category: '产品', source: '引擎帮助中心' },
  ];

  const filtered = query
    ? mockResults.filter(r => r.title.includes(query) || r.content.includes(query) || r.category.includes(query))
    : mockResults;

  container.innerHTML = filtered.map(r => `
    <div class="knowledge-item">
      <h4>${r.title}</h4>
      <p>${r.content}</p>
      <div class="meta">
        <span>📂 ${r.category}</span>
        <span>📖 ${r.source}</span>
      </div>
    </div>
  `).join('');
}

// 知识库搜索事件
document.getElementById('knowledge-search-input')?.addEventListener('input', (e) => {
  renderKnowledgeResults(e.target.value);
});

// 分类标签点击
document.querySelectorAll('.knowledge-categories .tag').forEach(tag => {
  tag.addEventListener('click', function () {
    document.querySelectorAll('.knowledge-categories .tag').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    const cat = this.textContent;
    if (cat === '全部') {
      renderKnowledgeResults('');
    } else {
      renderKnowledgeResults(cat);
    }
  });
});

// ============================================================
// 初始化
// ============================================================

function init() {
  initNavigation();
  initChat();
  renderCustomerCards();
}

document.addEventListener('DOMContentLoaded', init);
