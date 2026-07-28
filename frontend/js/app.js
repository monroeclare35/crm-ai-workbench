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

// 预设配置 — API端点
var PRESETS = {
  deepseek: { apiUrl: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-v4-pro' },
  kimi:     { apiUrl: 'https://api.moonshot.ai/v1/chat/completions',  model: 'kimi-k2.6' },
  glm:      { apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.5' },
  agent:    { apiUrl: '/api/v1/chat/stream', model: 'agent-sdk', isAgent: true }
};

function loadSettings(){
  try{
    var s=JSON.parse(localStorage.getItem('crm_ai_settings'));
    if(s){ API_CONFIG.apiUrl=s.apiUrl||''; API_CONFIG.apiKey=s.apiKey||''; API_CONFIG.model=s.model||''; }
  }catch(e){}
}

function openSettings(){
  document.getElementById('set-api-url').value=API_CONFIG.apiUrl;
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
  if(p){ document.getElementById('set-api-url').value=p.apiUrl; document.getElementById('set-model').value=p.model; }
}

function saveSettings(){
  var apiUrl=document.getElementById('set-api-url').value.trim();
  API_CONFIG.apiUrl=apiUrl;
  API_CONFIG.apiKey=document.getElementById('set-api-key').value.trim();
  API_CONFIG.model=document.getElementById('set-model').value.trim();
  API_CONFIG.isAgent=(apiUrl.indexOf('/api/v1/chat/stream')>-1||apiUrl.indexOf('localhost')>-1);
  localStorage.setItem('crm_ai_settings',JSON.stringify(API_CONFIG));
  document.getElementById('settings-msg').textContent='[OK] '+(API_CONFIG.isAgent?'Agent SDK Mode':'Direct API Mode');
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

function doLogin(){
  var u=document.getElementById('login-username').value.trim()||'dev-user';
  AUTH_USER={id:u,name:u};
  localStorage.setItem('crm_ai_user',JSON.stringify(AUTH_USER));
  document.getElementById('auth-overlay').style.display='none';
  document.getElementById('auth-msg').textContent='';
}

function doRegister(){
  var u=document.getElementById('reg-username').value.trim();
  if(!u){document.getElementById('auth-msg').textContent='请输入用户名';return;}
  var p1=document.getElementById('reg-password').value;
  var p2=document.getElementById('reg-password2').value;
  if(!p1||p1.length<6){document.getElementById('auth-msg').textContent='密码至少6位';return;}
  if(p1!==p2){document.getElementById('auth-msg').textContent='两次密码不一致';return;}
  AUTH_USER={id:u,name:u};
  localStorage.setItem('crm_ai_user',JSON.stringify(AUTH_USER));
  document.getElementById('auth-overlay').style.display='none';
}

// 注销
function doLogout(){localStorage.removeItem('crm_ai_user');AUTH_USER=null;document.getElementById('auth-overlay').style.display='flex';closeDrill()}

// 自动登录
document.addEventListener('DOMContentLoaded',function(){
  setTimeout(function(){
    try{var s=JSON.parse(localStorage.getItem('crm_ai_user'));if(s&&s.id){AUTH_USER=s;document.getElementById('auth-overlay').style.display='none'}}catch(e){}
  },200);
});

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

  if (view === 'dashboard') renderDashboard();
  if (view === 'reports') renderReports();
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

// Agent API 模式 — 调用真实 Claude Agent SDK 后端
async function sendViaAgentAPI(message, apiUrl) {
  try {
    var response = await fetch(apiUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: message, task_type: 'chat'})
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error('HTTP ' + response.status + ': ' + (errText||'').substring(0, 200));
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var assistantDiv = null;
    var fullContent = '';

    while (true) {
      var result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, {stream: true});
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith('data: ')) continue;
        var data = line.slice(6).trim();
        if (!data) continue;

        try {
          var ev = JSON.parse(data);
          if (ev.type === 'text_delta') {
            if (!assistantDiv) {
              assistantDiv = document.createElement('div');
              assistantDiv.className = 'message assistant';
              assistantDiv.innerHTML = '<div class="message-content"></div>';
              chatMessages.appendChild(assistantDiv);
            }
            fullContent += ev.content;
            assistantDiv.querySelector('.message-content').innerHTML = renderMarkdown(fullContent);
            scrollToBottom();
          } else if (ev.type === 'tool_call') {
            // Agent 正在调工具 — 显示在 trace 面板
            var trace = document.getElementById('agent-trace');
            var steps = document.getElementById('trace-steps');
            trace.classList.remove('hidden');
            var stepEl = document.createElement('div');
            stepEl.className = 'trace-step tool';
            stepEl.innerHTML = '<span class="step-icon">[==]</span><span class="step-body">调用: <strong>' + ev.tool_name + '</strong> ' + JSON.stringify(ev.tool_input||{}).substring(0, 100) + '</span>';
            steps.appendChild(stepEl);
            steps.scrollTop = steps.scrollHeight;
            // 也显示在聊天里
            var toolDiv = document.createElement('div');
            toolDiv.className = 'message system';
            toolDiv.innerHTML = '<div class="message-content" style="font-size:12px;color:var(--text3)">[工具调用] ' + ev.tool_name + '</div>';
            chatMessages.appendChild(toolDiv);
            scrollToBottom();
          } else if (ev.type === 'done') {
            if (ev.usage) {
              console.log('Agent tokens:', ev.usage);
            }
          }
        } catch(e) {}
      }
    }
  } catch (error) {
    appendMessage('system', '[Agent Error] ' + error.message + '\n请确认 Agent 后端已启动 (python server.py)');
  } finally {
    setAgentStatus('idle');
    state.streaming = false;
    sendBtn.disabled = false;
    chatLoading.classList.add('hidden');
    chatInput.focus();
    scrollToBottom();
  }
}

// Agent 状态控制
function setAgentStatus(status){var dot=document.querySelector('.agent-dot');var txt=document.getElementById('agent-status-text');if(status==='working'){dot.classList.add('working');txt.textContent='工作中...'}else{dot.classList.remove('working');txt.textContent='就绪'}}

// 模拟 Agent 工作步骤
function simulateAgentTrace(msg){
  var trace=document.getElementById('agent-trace');
  var steps=document.getElementById('trace-steps');
  trace.classList.remove('hidden'); steps.innerHTML='';
  // 根据消息内容推断步骤
  var plan=[{icon:'💭',type:'think',text:'分析意图: '+msg.substring(0,40)+(msg.length>40?'...':'')},{icon:'🔍',type:'tool',text:'检索相关知识库和行业数据'}];
  if(msg.indexOf('ROI')>-1||msg.indexOf('诊断')>-1||msg.indexOf('拆解')>-1){plan.push({icon:'📊',type:'tool',text:'调用 ad_platform__query_metrics 获取消耗/ROI/CTR数据'});plan.push({icon:'🧮',type:'think',text:'多维度对比分析: 素材/出价/定向拆解'});}
  else if(msg.indexOf('文案')>-1||msg.indexOf('生成')>-1||msg.indexOf('创意')>-1){plan.push({icon:'🎨',type:'tool',text:'调用 creative_library__search_templates 获取行业TOP模板'});plan.push({icon:'✍️',type:'think',text:'按产品线差异化生成文案'});}
  else if(msg.indexOf('搜索')>-1||msg.indexOf('填充率')>-1||msg.indexOf('eCPM')>-1){plan.push({icon:'🔍',type:'tool',text:'调用 search_ad__query_fill_rate 和 search_ad__query_ecpm'});}
  else if(msg.indexOf('周报')>-1||msg.indexOf('报告')>-1){plan.push({icon:'📋',type:'tool',text:'调用 ad_platform__query_metrics 批量拉数据'});plan.push({icon:'🧮',type:'think',text:'异常检测 + 排名 + 趋势分析'});}
  else{plan.push({icon:'🧠',type:'think',text:'综合分析中...'});}
  plan.push({icon:'✔️',type:'done',text:'生成结果'});
  plan.forEach(function(s,i){setTimeout(function(){var el=document.createElement('div');el.className='trace-step '+s.type;el.innerHTML='<span class="step-icon">'+s.icon+'</span><span class="step-body">'+s.text+'</span><span class="step-time">'+(i*0.2).toFixed(1)+'s</span>';steps.appendChild(el);steps.scrollTop=steps.scrollHeight;if(i===plan.length-1)setTimeout(function(){document.getElementById('agent-trace').classList.add('hidden')},1500)},i*350)});
}

function toggleTrace(){var s=document.getElementById('trace-steps');var btn=document.getElementById('trace-collapse');if(s.style.display==='none'){s.style.display='';btn.textContent='收起 ▴'}else{s.style.display='none';btn.textContent='展开 ▾'}}

async function sendMessage() {
  var message = chatInput.value.trim();
  if (!message || state.isStreaming) return;

  if (!API_CONFIG.apiKey) {
    appendMessage('system', '⚠️ 请先点击左下角 ⚙️ 设置 API Key（然后选 DeepSeek 预设）');
    return;
  }

  state.isStreaming = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;
  // Agent 状态切换
  setAgentStatus('working');
  // 显示工作过程
  simulateAgentTrace(message);

  appendMessage('user', message);
  scrollToBottom();

  var isAgent = API_CONFIG.isAgent === true;
  var apiUrl = API_CONFIG.apiUrl || (isAgent ? '/api/v1/chat/stream' : 'https://api.deepseek.com/v1/chat/completions');
  var model = API_CONFIG.model || 'deepseek-v4-pro';

  // Agent模式：调用 Claude Agent SDK 后端
  if (isAgent) {
    await sendViaAgentAPI(message, apiUrl);
    return;
  }

  // System Prompt — 广告AI策略助手 (含客户数据)
  var systemPrompt = '你是抖音集团广告AI策略助手，服务于华东区广告策略团队。\n\n'+
    '## 你的客户数据（你可以直接查询和分析这些客户的投放情况）\n'+
    '| 客户名称 | ID | 行业 | 等级 | 近30天消耗 | ROI | 趋势 | 健康 | 主要产品 |\n'+
    '|---------|-----|------|------|-----------|-----|------|------|----------|\n'+
    '| 上海美妆科技有限公司 | C001 | 电商(美妆) | S | ¥285万 | 3.3 | ↑上升 | 🟢健康 | 千川+引擎 |\n'+
    '| 杭州鲸灵网络有限公司 | C002 | 游戏(手游) | A | ¥152万 | 1.3 | ↓下降 | 🟡关注 | 引擎+穿山甲 |\n'+
    '| 南京星辉教育科技有限公司 | C003 | 教育(职业技能) | B | ¥68万 | 2.1 | →平稳 | 🟡关注 | 千川 |\n'+
    '| 北京未来科技有限公司 | C004 | AI/科技(大模型) | S | ¥520万 | 4.5 | ↑上升 | 🟢健康 | 引擎+搜索 |\n'+
    '| 深圳鹏程电商有限公司 | C005 | 电商(综合) | A | ¥890万 | 2.9 | →平稳 | 🟢健康 | 千川+引擎+穿山甲 |\n\n'+
    '当用户询问某个客户的情况时，请基于上表数据给出详细的投放分析，包括：消耗趋势解读、ROI评估、健康度判断、与同行业对比、优化建议。\n\n'+
    '## 你的核心能力\n'+
    '1. AIGC创意生成：千川/引擎/搜索/穿山甲各产品线的文案、脚本、素材策略\n'+
    '2. 搜广告变现诊断：填充率、eCPM、关键词覆盖率分析和优化建议\n'+
    '3. 投放效果拆解：ROI/CTR/CVR/CPA多维度诊断，定位问题根因\n'+
    '4. 出价策略推荐：oCPM/oCPC/自动出价的选择和调优\n'+
    '5. 行业竞品分析：投放趋势、素材策略、差异化建议\n'+
    '回答要求：结构化、数据驱动、建议具体可落地。如果是创意生成类请求，给出可直接使用的文案。';

  try {
    var response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_CONFIG.apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      throw new Error('HTTP ' + response.status + ': ' + (errText||'').substring(0, 200));
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var assistantDiv = null;
    var fullContent = '';

    while (true) {
      var result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith('data: ')) continue;
        var data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          var chunk = JSON.parse(data);
          var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
          if (delta && delta.content) {
            if (!assistantDiv) {
              assistantDiv = document.createElement('div');
              assistantDiv.className = 'message assistant';
              assistantDiv.innerHTML = '<div class="message-content"></div>';
              chatMessages.appendChild(assistantDiv);
            }
            fullContent += delta.content;
            assistantDiv.querySelector('.message-content').innerHTML = renderMarkdown(fullContent);
            scrollToBottom();
          }
        } catch(e) {}
      }
    }
    if (!fullContent) {
      appendMessage('system', '⚠️ 模型返回为空，请检查 API Key 和模型名称是否正确');
    }
  } catch (error) {
    appendMessage('system', '❌ ' + error.message + '\n\n请检查：\n1. 点击 ⚙️ 设置 → 选 DeepSeek 预设 → 填 API Key → 保存\n2. API Key 格式应为 sk-...\n3. 确认网络能访问 api.deepseek.com');
  } finally {
    setAgentStatus('idle');
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

// ============================================================
// 知识库 — 生产级广告知识体系
// ============================================================

var KNOWLEDGE_BASE=[
  {id:'K001',title:'巨量千川 oCPM 出价策略详解',cat:'出价策略',src:'千川帮助中心',tags:['oCPM','出价','千川','转化'],
   content:'oCPM（Optimized Cost Per Mille）以转化为优化目标，系统根据设定的转化出价自动调整。适用场景：有明确转化目标且日转化≥20个。优势：成本稳定、跑量强。注意：新建计划1-3天学习期，期间不频繁调整。建议初始出价=目标成本×1.2。'},
  {id:'K002',title:'千川短视频素材黄金法则',cat:'AIGC创意',src:'运营团队',tags:['素材','千川','视频','CTR'],
   content:'前3秒决定70%的完播率——必须有钩子（痛点/悬念/反常识）。15-30秒最佳长度。真人出镜CTR比图文高30%。单产品聚焦一个卖点。结尾必须有明确CTA（点击/购买/下载）。每周至少更新3套素材防疲劳。'},
  {id:'K003',title:'教育行业广告合规要点(2026版)',cat:'投放政策',src:'审核中心',tags:['教育','合规','政策','审核'],
   content:'学科类培训广告全面禁止。非学科需提供办学许可证+教师资格证。禁用"保过""包就业""提分100%"等绝对化用语。K12定向禁用年龄/年级标签。落地页必须标注价格和退费规则。违规处罚：首次警告+下架，再犯封停7-30天。'},
  {id:'K004',title:'游戏买量ROI优化案例——杭州鲸灵',cat:'行业案例',src:'案例库',tags:['游戏','ROI','案例','素材'],
   content:'客户：杭州鲸灵网络（手游发行商）。问题：ROI持续下降至1.3，CTR低于行业均值。方案：素材从游戏录屏→真人解说+KOL混剪(CTR 1.5%→2.8%)；定向基于付费画像(25-35男一线)；出价切oCPM(激活成本-40%)；落地页+社交proof(CVR 3%→5.5%)。结果：ROI从1.2→2.5。教训：关注LTV/CAC而非单纯消耗。'},
  {id:'K005',title:'巨量搜索广告关键词四维覆盖法',cat:'搜广告变现',src:'引擎帮助中心',tags:['搜索','SEM','关键词','eCPM'],
   content:'四维关键词策略：品牌词（品牌名+变体，必投）、品类词（行业通用词，抢量）、竞品词（竞品品牌名，截流）、场景词（"怎么选""哪个好"，高意图）。短语匹配为主，精确匹配补充高转化词。搜索流量CVR是信息流3-5倍，CPC高30-50%正常。OEM搜索广告eCPM基准：¥35-50。'},
  {id:'K006',title:'穿山甲广告联盟eCPM优化指南',cat:'搜广告变现',src:'穿山甲官方',tags:['穿山甲','eCPM','变现','广告联盟'],
   content:'穿山甲覆盖10万+APP。主流形式：开屏(eCPM最高¥60-80)、激励视频(¥40-60)、信息流(¥15-30)、插屏(¥10-20)。优化铁三角：填充率×展示率×eCPM。Waterfall+Bidding混合模式最大化收益。激励视频适合游戏，信息流适合内容APP。'},
  {id:'K007',title:'2026 Q2 各行业广告投放 Benchmark',cat:'数据诊断',src:'巨量数据中心',tags:['benchmark','行业数据','CTR','ROI'],
   content:'电商：CTR 2.1%, CVR 1.8%, CPA ¥45, ROI 2.6。游戏：CTR 2.8%, CVR 1.5%, CPA ¥38, ROI 2.2。教育：CTR 1.8%, CVR 2.5%, CPA ¥55, ROI 3.1。金融：CTR 1.5%, CVR 1.2%, CPA ¥120, ROI 1.8。AI/科技：CTR 2.3%, CVR 2.0%, CPA ¥65, ROI 2.9。本地生活：CTR 3.2%, CVR 4.5%, CPA ¥18, ROI 5.5。'},
  {id:'K008',title:'AIGC 创意文案生成 Prompt 工程指南',cat:'AIGC创意',src:'AI Lab',tags:['AIGC','prompt','文案','生成'],
   content:'千川文案Prompt模板："你是资深信息流优化师。产品：[X]，卖点：[Y]，目标人群：[Z]。生成5条短视频文案，每条15-30秒脚本。要求：前3秒钩子+痛点场景+产品解决+限时优惠+强CTA。风格：口语化、紧迫感、信任背书。"搜索广告标题Prompt："生成10个搜索广告标题，≤30字，含核心关键词，数字卖点前置，品牌名收尾。"'},
  {id:'K009',title:'冷启动期投放策略指南',cat:'出价策略',src:'运营团队',tags:['冷启动','新账户','出价','预算'],
   content:'新账户前3天黄金法则：预算设为日常1.5倍（给系统学习空间），放宽定向（兴趣→通投），至少5套素材同时跑，不频繁调整（每天≤2次）。学习期标志：成本波动大、量级不稳→正常，不要慌。3天后根据数据筛选：保留CTR>均值+成本达标计划，关停学习失败计划。'},
  {id:'K010',title:'ROI 下降六维度拆解法',cat:'数据诊断',src:'数据分析团队',tags:['ROI','诊断','拆解','优化'],
   content:'ROI=GMV/Cost。下降原因六维拆解：①CTR下降→素材疲劳/受众饱和→换新素材；②CVR下降→落地页/人群匹配→A/B测落地页；③CPA上升→竞价变激烈→调整出价策略；④客单价下降→促销过度→控制折扣；⑤复购率下降→用户运营→加强私域；⑥退货率上升→产品质量→排查售后。用数据而非直觉定位。'},
  {id:'K011',title:'巨量千川 vs 巨量引擎 产品选型指南',cat:'产品文档',src:'商业化产品团队',tags:['千川','引擎','选型','对比'],
   content:'千川：电商场景首选。强项是直播投流+短视频带货，闭环数据(下单/支付/ROI)。适合有店铺的电商客户。引擎：品牌+效果通吃。强项是品牌曝光+线索收集，覆盖全产品矩阵。适合B2B/教育/金融等非电商客户。搜索：高意图流量，CVR最高。穿山甲：流量广、成本低，适合跑量。建议组合：电商=千川+搜索，B2B=引擎+搜索，游戏=引擎+穿山甲。'},
  {id:'K012',title:'AI 搜广告变现诊断方法论',cat:'搜广告变现',src:'搜索广告团队',tags:['搜索','变现','填充率','诊断'],
   content:'搜索广告收入=Query量×填充率×eCPM。诊断三步：①看Query量趋势(是否下降→用户搜索行为变化)；②看填充率(广告主覆盖是否充足→扩大广告主池)；③看eCPM(竞价密度→提高匹配质量)。常见问题：填充率低=广告主不足，eCPM低=竞价不充分，CTR低=广告与搜索意图不匹配。每个问题对应不同优化手段。'},
  {id:'K013',title:'广告素材合规自动检测规则',cat:'投放政策',src:'审核中心',tags:['合规','素材','检测','规则'],
   content:'自动化检测要点：禁用词库(最/第一/国家级/唯一/顶级等绝对化用语)；行业特定词(教育-保过/医疗-治愈/金融-保本)；图片违规(色情/暴力/虚假标识/未授权logo)；落地页合规(价格标注/退费规则/资质展示)。每季度更新禁用词库。新素材上线前必须过机审+人审双重校验。'},
  {id:'K014',title:'oCPM vs oCPC vs 自动出价 决策树',cat:'出价策略',src:'商业化产品团队',tags:['oCPM','oCPC','决策','出价'],
   content:'出价策略选择决策树：①日转化≥20个→oCPM(成本最稳定)；②日转化<20但>5个→oCPC冷启动→积累数据→转oCPM；③日转化<5个且缺优化人力→自动出价(让系统学)；④严控成本±5%以内→规则出价+预算上限。oCPM学习期1-3天波动正常，不要中途关停。自动出价优势是省心，劣势是成本可能超预期20-30%。'},
  {id:'K015',title:'电商大促期间投放策略',cat:'行业案例',src:'运营团队',tags:['电商','大促','618','双11','策略'],
   content:'大促投放三步法：①预热期(T-7)：预算上调30%，人群包扩容至相似人群，素材预告+种草向；②爆发期(T-0~T+1)：预算拉满至日常3倍，oCPM出价上浮20-30%，所有已验证素材全量上线；③返场期(T+2~T+3)：预算降至1.5倍，素材更新为限时返场+库存告急。关键：大促前7天完成素材审核，避免临时被拒。'},
  {id:'K016',title:'搜索广告填充率提升实操',cat:'搜广告变现',src:'搜索广告团队',tags:['搜索','填充率','实操'],
   content:'填充率=有广告展示的搜索量/总搜索量。提升四步：①拓展广告主覆盖(降低准入门槛、自助开户)；②放宽匹配条件(短语→广泛匹配、增加否定词而非限制)；③提高出价竞争力(建议出价工具、行业benchmark透明化)；④优化广告质量(高CTR广告加权、低质广告降权)。目标：填充率从60%→85%。'},
  {id:'K017',title:'AIGC 视频素材自动生成流程',cat:'AIGC创意',src:'AI Lab',tags:['AIGC','视频','自动生成','素材'],
   content:'AIGC视频生成Pipeline：①输入产品信息+卖点+目标人群→②LLM生成脚本(15-30秒分镜)→③TTS语音合成(可选主播音色)→④视频素材匹配(素材库/生成)→⑤自动剪辑合成→⑥合规检测→⑦输出多版本。当前能力：单条视频生成<3分钟，支持9:16竖屏/16:9横屏，分辨率1080p。最佳实践：先批量生成10条→人工精选3条→A/B测试→保留最优。'},
  {id:'K018',title:'穿山甲 vs 腾讯广告 流量对比',cat:'产品文档',src:'商业分析团队',tags:['穿山甲','腾讯广告','对比','流量'],
   content:'穿山甲优势：DAU 8亿+(抖音+头条系)，eCPM中高，支持Waterfall+Bidding混合。腾讯广告优势：微信生态(朋友圈+公众号+小程序)，社交数据丰富，适合品牌+私域。选择建议：游戏→穿山甲(流量广、成本低)；电商→千川(闭环数据)；品牌→腾讯(社交裂变)；工具类APP→穿山甲(变现效率高)。'},
  {id:'K019',title:'广告投放异常排查 Checklist',cat:'数据诊断',src:'运营团队',tags:['异常','排查','checklist','诊断'],
   content:'消耗骤降排查：①账户余额是否充足；②计划/创意是否被拒审；③出价是否低于竞价底价；④定向是否过窄；⑤时段设置是否错误。消耗暴涨排查：①是否有爆量素材(正常→加预算)；②是否有恶意点击(异常→排查+屏蔽)；③出价策略是否异常。ROI骤降排查：见K010六维拆解法。'},
  {id:'K020',title:'2026 广告行业趋势展望',cat:'行业案例',src:'商业分析团队',tags:['趋势','2026','行业','展望'],
   content:'五大趋势：①AIGC素材占比超60%(人工→AI辅助→AI主导)；②搜索广告增速30%+(用户主动搜索习惯养成)；③直播投流ROI持续优化(实时数据闭环)；④隐私计算下的精准投放(联邦学习+多方安全计算)；⑤多模态广告(视频+AR+可购物广告)。建议：今年重点布局搜索广告+AIGC素材能力。'}
];

function renderKnowledgeResults(query){
  var catFilter=''; if(query) query=query.toLowerCase();
  // 检查是否是分类关键词
  var catMap={'投放政策':'投放政策','AIGC创意':'AIGC创意','搜广告变现':'搜广告变现','出价策略':'出价策略','行业案例':'行业案例','产品文档':'产品文档','数据诊断':'数据诊断'};
  if(query&&catMap[query]){catFilter=query;query=''}
  var container=document.getElementById('knowledge-results');
  if(!container)return;
  var results=KNOWLEDGE_BASE.filter(function(r){
    if(catFilter&&r.cat!==catFilter)return false;
    if(!query)return true;
    return r.title.toLowerCase().indexOf(query)>-1||r.content.toLowerCase().indexOf(query)>-1||r.tags.some(function(t){return t.toLowerCase().indexOf(query)>-1})||r.cat.indexOf(query)>-1;
  });
  if(!results.length){container.innerHTML='<p style="color:var(--text3);text-align:center;padding:40px">未找到匹配的知识条目</p>';return}
  container.innerHTML=results.map(function(r){return'<div class="k-card" onclick="showKnowledgeDetail(\''+r.id+'\')"><h4>'+r.title+'</h4><p>'+r.content+'</p><div class="k-meta"><span>📂 '+r.cat+'</span><span>📖 '+r.src+'</span><span>'+r.tags.map(function(t){return'<code>#'+t+'</code>'}).join(' ')+'</span></div></div>'}).join('');
}

function showKnowledgeDetail(id){
  var r=KNOWLEDGE_BASE.find(function(k){return k.id===id});
  if(!r)return;
  openDrill(r.title,'<div class="drill-section"><div style="display:flex;gap:8px;margin-bottom:12px"><span style="background:var(--brand-light);color:var(--brand);font-size:11px;padding:3px 10px;border-radius:12px">'+r.cat+'</span><span style="color:var(--text3);font-size:11px">来源: '+r.src+'</span></div><p style="font-size:14px;line-height:1.8;white-space:pre-wrap">'+r.content+'</p><div style="margin-top:16px">'+r.tags.map(function(t){return'<code style="margin:2px;padding:3px 8px;background:#F1F5F9;border-radius:4px;font-size:11px">#'+t+'</code>'}).join(' ')+'</div></div>');
}

// ============================================================
// 报告中心 — 丰富报告卡片 + 点击查看完整内容
// ============================================================

var REPORTS=[
  {icon:'📊',title:'华东区广告运营周报',date:'2026-07-28',age:'2小时前',author:'AI Agent',
   summary:'本周华东区总消耗¥1,285万，环比+12.5%。ROI均值2.82，5个账户触发异常告警。千川消耗占比42%领先，搜索广告增速最快(+28%)。',
   body:'<h3>一、核心指标</h3><table><tr><th>指标</th><th>本周</th><th>上周</th><th>环比</th></tr><tr><td>总消耗</td><td>¥1,285万</td><td>¥1,142万</td><td style="color:var(--success)">+12.5%</td></tr><tr><td>ROI</td><td>2.82</td><td>2.91</td><td style="color:var(--danger)">-3.1%</td></tr><tr><td>CTR</td><td>2.42%</td><td>2.38%</td><td style="color:var(--success)">+1.7%</td></tr></table><h3>二、异常账户</h3><p>杭州鲸灵ROI连续下降42%→建议立即出优化方案。成都星辉消耗骤降68%→疑似余额不足。</p><h3>三、产品线分布</h3><p>千川42% | 引擎31% | 搜索16% | 穿山甲11%。搜索广告增速最快，建议加大投入。</p>'},
  {icon:'📋',title:'上海美妆科技 · 7月投放月报',date:'2026-07-27',age:'昨天',author:'AI Agent',
   summary:'客户月消耗¥285万，ROI 3.3，趋势上升。千川贡献68%消耗，引擎32%。素材更新频率达标(每周5套)，CTR高于行业均值15%。',
   body:'<h3>一、核心指标</h3><table><tr><th>指标</th><th>7月</th><th>6月</th><th>变化</th></tr><tr><td>消耗</td><td>¥285万</td><td>¥252万</td><td style="color:var(--success)">+13.1%</td></tr><tr><td>ROI</td><td>3.3</td><td>2.9</td><td style="color:var(--success)">+13.8%</td></tr><tr><td>CTR</td><td>2.7%</td><td>2.5%</td><td style="color:var(--success)">+8%</td></tr></table><h3>二、素材表现</h3><p>TOP3素材: "美妆教程式"(CTR 3.1%)、"素人测评"(CTR 2.9%)、"限时优惠"(CTR 2.7%)。建议加大教程式素材投入。</p><h3>三、优化建议</h3><p>1. 千川日预算从¥8万→¥10万(ROI支撑)；2. 测试搜索广告(美妆搜索量上升)；3. 增加直播切片素材占比。</p>'},
  {icon:'🔬',title:'教育行业2026 Q2 广告趋势调研',date:'2026-07-26',age:'3天前',author:'Deep Research',
   summary:'教育行业Q2广告投放总额增长18%，但合规门槛持续提高。职业技能培训子赛道增速最快(+35%)，搜索广告占比从8%升至15%。',
   body:'<h3>一、市场规模</h3><p>Q2教育行业广告投放总额¥42亿，同比+18%。其中职业技能培训占比42%(增速+35%)，素质教育28%，学历教育18%，留学12%。</p><h3>二、平台分布</h3><p>千川38% | 引擎29% | 搜索15% | 其他18%。搜索广告增速最快(+87% YoY)，源于用户主动搜索"XX培训"习惯养成。</p><h3>三、政策影响</h3><p>3月新规后，K12学科类广告清零，非学科审核周期延长至3-5天。建议客户提前准备资质材料，避免投放中断。</p>'},
  {icon:'💡',title:'杭州鲸灵网络 · ROI诊断报告',date:'2026-07-26',age:'3天前',author:'AI Agent',
   summary:'诊断结论：ROI从2.5降至1.3，主因是素材疲劳(CTR-35%)+竞价激烈(CPA+22%)。建议：紧急更新5套素材，切换oCPM，测试新定向包。',
   body:'<h3>一、问题定位</h3><table><tr><th>维度</th><th>变化</th><th>影响</th><th>根因</th></tr><tr><td>CTR</td><td>2.8%→1.8%</td><td>-35%</td><td>素材超3周未更新</td></tr><tr><td>CVR</td><td>1.5%→1.4%</td><td>-7%</td><td>基本持平</td></tr><tr><td>CPA</td><td>¥38→¥49</td><td>+29%</td><td>同品类竞价加剧</td></tr></table><h3>二、行动计划</h3><p>1.[紧急-24h] 上线5套新素材(真人解说+KOL混剪)；2.[短期-3天] 出价策略从手动切oCPM，目标成本¥42；3.[中期-1周] 测试25-35岁男性+一线城市新定向包。</p>'},
  {icon:'📈',title:'2026 Q2 行业Benchmark季报',date:'2026-07-22',age:'6天前',author:'数据分析团队',
   summary:'全行业CTR均值2.35%(环比+0.12pp)，ROI均值2.7(环比+0.2)。本地生活ROI最高(5.5)，金融ROI最低(1.8)。搜索广告eCPM均值¥42。',
   body:'<h3>一、行业对比</h3><table><tr><th>行业</th><th>CTR</th><th>CVR</th><th>CPA</th><th>ROI</th></tr><tr><td>电商</td><td>2.1%</td><td>1.8%</td><td>¥45</td><td>2.6</td></tr><tr><td>游戏</td><td>2.8%</td><td>1.5%</td><td>¥38</td><td>2.2</td></tr><tr><td>教育</td><td>1.8%</td><td>2.5%</td><td>¥55</td><td>3.1</td></tr><tr><td>本地生活</td><td>3.2%</td><td>4.5%</td><td>¥18</td><td>5.5</td></tr></table>'},
  {icon:'🎨',title:'AIGC创意素材效果分析报告',date:'2026-07-20',age:'1周前',author:'AI Lab',
   summary:'AIGC生成素材占新增素材量的38%，CTR均值2.6%(略高于人工2.4%)。视频类AIGC素材完播率比人工高12%，但转化率低5%。建议：AIGC批量生产+人工精选优化。',
   body:'<h3>一、AIGC素材表现</h3><table><tr><th>类型</th><th>占比</th><th>CTR</th><th>CVR</th><th>完播率</th></tr><tr><td>AIGC视频</td><td>22%</td><td>2.7%</td><td>1.7%</td><td>48%</td></tr><tr><td>AIGC图片</td><td>16%</td><td>2.4%</td><td>1.9%</td><td>-</td></tr><tr><td>人工视频</td><td>38%</td><td>2.5%</td><td>1.9%</td><td>43%</td></tr><tr><td>人工图片</td><td>24%</td><td>2.2%</td><td>1.8%</td><td>-</td></tr></table><h3>二、结论</h3><p>AIGC素材在吸引点击(CTR)和完播率上优于人工，但在转化(CVR)上略逊。推荐策略：AIGC批量生产覆盖量→人工精选TOP素材→在精选素材上人工微调提升转化。</p>'}
];

function renderReports(){
  var grid=document.getElementById('report-grid');
  if(!grid)return;
  grid.innerHTML=REPORTS.map(function(r){
    return'<div class="report-card" onclick="showReportDetail(\''+r.title+'\')"><div class="report-icon">'+r.icon+'</div><h4>'+r.title+'</h4><p>'+r.summary+'</p><div class="report-meta"><span>'+r.date+'</span><span>'+r.author+'</span><span>'+r.age+'</span></div></div>';
  }).join('');
}

function showReportDetail(title){
  var r=REPORTS.find(function(rp){return rp.title===title});
  if(!r)return;
  openDrill(r.title,r.body);
}

// 知识库搜索事件
document.getElementById('knowledge-search-input')&&document.getElementById('knowledge-search-input').addEventListener('input',function(e){renderKnowledgeResults(e.target.value)});

// 分类点击 — 使用知识库侧边栏的 k-cat 按钮
document.querySelectorAll('.k-cat').forEach(function(el){el.addEventListener('click',function(){document.querySelectorAll('.k-cat').forEach(function(e){e.classList.remove('active')});this.classList.add('active');renderKnowledgeResults(this.textContent==='全部'?'':this.textContent)})});

// ============================================================
// 数据看板 — 生产级模拟数据 + SVG 图表
// ============================================================

var DB={period:'7d',region:'华东区'};

// 生成真实感数据
function genDbData(){
  var now=new Date(); var days=DB.period==='30d'?30:(DB.period==='month'?30:7);
  var trend=[], base=DB.region==='华东区'?128:(DB.region==='华北区'?96:DB.region==='华南区'?73:310);
  var roiBase=DB.region==='华东区'?2.82:2.55, total=0;
  for(var i=days;i>=1;i--){
    var d=new Date(now); d.setDate(d.getDate()-i+1);
    var dow=d.getDay(), isWeekend=(dow===0||dow===6);
    var seasonal=1+Math.sin(i/days*Math.PI)*0.08;
    var weekend=isWeekend?0.82:1;
    var noise=0.92+Math.random()*0.16;
    var spike=(i===Math.floor(days*0.4)||i===Math.floor(days*0.75))?1.22:1;
    var val=Math.round(base*seasonal*weekend*noise*spike);
    total+=val; var mo=d.getMonth()+1,dt=d.getDate();
    trend.push({date:mo+'/'+dt,value:val,roi:Math.round((roiBase*(0.88+Math.random()*0.24))*100)/100});
  }
  var prevTotal=Math.round(total*(0.88+Math.random()*0.08));
  var wowPct=Math.round((total-prevTotal)/prevTotal*1000)/10;
  var ctrAvg=Math.round((2.1+Math.random()*0.9)*10)/10;
  var activeCount=DB.region==='全部区域'?187:(DB.region==='华东区'?62:DB.region==='华北区'?54:48);
  var anomalyCount=DB.region==='全部区域'?12:(DB.region==='华东区'?4:3);

  // 行业数据
  var industries=[{n:'电商',v:38,c:'#2563EB'},{n:'游戏',v:24,c:'#7C3AED'},{n:'教育',v:14,c:'#059669'},{n:'AI/科技',v:12,c:'#F59E0B'},{n:'本地生活',v:8,c:'#F97316'},{n:'金融',v:4,c:'#6B7280'}];
  // 产品线
  var products=[{n:'千川',v:42,c:'#2563EB'},{n:'引擎',v:31,c:'#7C3AED'},{n:'搜索',v:16,c:'#059669'},{n:'穿山甲',v:11,c:'#F59E0B'}];
  // TOP10
  var top10=[],names=['上海美妆科技','深圳鹏程电商','北京未来科技','杭州鲸灵网络','成都星辉教育','广州极速游戏','苏州天工AI','武汉乐活电商','南京云帆科技','西安数字引擎'];
  for(var j=0;j<10;j++)top10.push({name:names[j],cost:Math.round((total*0.12-j*total*0.007)*(0.8+Math.random()*0.4)),roi:Math.round((1.8+Math.random()*3.2)*100)/100});
  top10.sort(function(a,b){return b.cost-a.cost});
  // 异常
  var anomalies=[{name:'杭州鲸灵网络',reason:'ROI连续7天下降42%',lvl:'danger'},{name:'成都星辉教育',reason:'消耗骤降68%，疑似余额不足',lvl:'danger'},{name:'苏州天工AI',reason:'CTR低于行业均值35%',lvl:'warn'},{name:'武汉乐活电商',reason:'素材超2周未更新',lvl:'warn'}];
  if(DB.region==='全部区域')anomalies.push({name:'广州极速游戏',reason:'CPA超目标120%',lvl:'danger'});

  return{total:total,wowPct:wowPct,roiAvg:Math.round((roiBase*(0.95+Math.random()*0.1))*100)/100,ctrAvg:ctrAvg,activeCount:activeCount,anomalyCount:anomalyCount,trend:trend,industries:industries,products:products,top10:top10,anomalies:anomalies};
}

// SVG 趋势图
function renderTrendSVG(data){
  var w=640,h=240,padL=50,padR=20,padT=20,padB=30;
  var maxV=Math.max.apply(null,data.map(function(d){return d.value}));
  var xStep=(w-padL-padR)/(data.length-1);
  // 面积
  var pts='',area='';
  for(var i=0;i<data.length;i++){
    var x=padL+i*xStep, y=h-padB-(data[i].value/maxV)*(h-padT-padB);
    pts+=(i?' ':'')+x+','+y;
  }
  area=pts+' '+(padL+(data.length-1)*xStep)+','+(h-padB)+' '+padL+','+(h-padB);
  // Y轴标签
  var yLabels='';
  for(var yi=0;yi<=4;yi++){var yv=Math.round(maxV*yi/4);yLabels+='<text x="'+(padL-6)+'" y="'+(h-padB-(h-padT-padB)*yi/4+4)+'" text-anchor="end" font-size="10" fill="#949CAB">'+(yv>999?Math.round(yv/100)/10+'万':yv)+'</text>';}
  // 周末标注
  var weekends='';
  for(var wi=0;wi<data.length;wi++){var dd=data[wi].date;if(dd.indexOf('/')>-1){var parts=dd.split('/');var dt=parseInt(parts[1]);var d2=new Date(2026,parseInt(parts[0])-1,dt);if(d2.getDay()===0||d2.getDay()===6)weekends+='<rect x="'+(padL+wi*xStep-xStep/2)+'" y="'+padT+'" width="'+(xStep)+'" height="'+(h-padT-padB)+'" fill="#F1F3F7" opacity="0.5"/>';}}
  return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="240"><defs><linearGradient id="tga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563EB" stop-opacity="0.12"/><stop offset="100%" stop-color="#2563EB" stop-opacity="0"/></linearGradient></defs>'+weekends+yLabels+'<polygon points="'+area+'" fill="url(#tga)"/><polyline points="'+pts+'" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+data.map(function(d,i){return '<circle cx="'+(padL+i*xStep)+'" cy="'+(h-padB-(d.value/maxV)*(h-padT-padB))+'" r="'+(i===data.length-1?'3.5':'0')+'" fill="#2563EB"/>'}).join('')+'</svg>';
}

// 行业柱状图
function renderIndustrySVG(data){
  var w=280,h=200,padL=10,padT=10,padB=20,bh=24,gap=8; var maxV=data[0].v;
  return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="200">'+data.map(function(d,i){var bw=(d.v/maxV)*(w-padL-60);return '<rect x="'+padL+'" y="'+(padT+i*(bh+gap))+'" width="'+bw+'" height="'+bh+'" rx="5" fill="'+d.c+'" opacity="0.85"/><text x="'+(padL+bw+6)+'" y="'+(padT+i*(bh+gap)+bh-8)+'" font-size="11" fill="#1A1D26" font-weight="500">'+d.n+' '+d.v+'%</text>'}).join('')+'</svg>';
}

// 产品线饼图
function renderProductSVG(data){
  var w=280,h=200,cx=120,cy=105,r=70; var total=data.reduce(function(s,d){return s+d.v},0); var ang=-Math.PI/2,slices='';
  data.forEach(function(d){var sw=d.v/total*2*Math.PI, end=ang+sw;var x1=cx+r*Math.cos(ang),y1=cy+r*Math.sin(ang),x2=cx+r*Math.cos(end),y2=cy+r*Math.sin(end);var large=sw>Math.PI?1:0;slices+='<path d="M '+cx+' '+cy+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+large+' 1 '+x2+' '+y2+' Z" fill="'+d.c+'" opacity="0.85"/>';ang=end;});
  return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="200">'+slices+'<text x="'+cx+'" y="'+cy+'" text-anchor="middle" font-size="14" font-weight="700">'+total+'%</text></svg><div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px;font-size:11px">'+data.map(function(d){return '<span style="color:'+d.c+'">● '+d.n+' '+d.v+'%</span>'}).join('')+'</div>';
}

function renderDashboard(){
  var data=genDbData();
  document.getElementById('db-time').textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  // KPI
  document.getElementById('kpi-cost').textContent='¥'+(data.total>9999?Math.round(data.total/10000)+'万':data.total.toLocaleString());
  document.getElementById('kpi-cost-chg').textContent=(data.wowPct>=0?'↑':'↓')+' '+Math.abs(data.wowPct)+'% 环比';
  document.getElementById('kpi-cost-chg').className='kpi-sub '+(data.wowPct>=0?'up':'down');
  document.getElementById('kpi-wow').textContent=(data.wowPct>=0?'+':'')+data.wowPct+'%';
  document.getElementById('kpi-roi').textContent=data.roiAvg;
  document.getElementById('kpi-roi-chg').textContent=(data.wowPct>=0?'↑':'↓')+' '+Math.abs(Math.round(data.wowPct*0.6*10)/10)+'%';
  document.getElementById('kpi-roi-chg').className='kpi-sub '+(data.wowPct>=0?'up':'down');
  document.getElementById('kpi-active').textContent=data.activeCount;
  document.getElementById('kpi-active-chg').textContent='+'+Math.round(data.activeCount*0.03)+' 本周新增';
  document.getElementById('kpi-active-chg').className='kpi-sub up';
  document.getElementById('kpi-ctr').textContent=data.ctrAvg+'%';
  document.getElementById('kpi-ctr-chg').textContent='行业均值 2.35%';
  document.getElementById('kpi-alert').textContent=data.anomalyCount;
  // Charts
  var trendEl=document.getElementById('chart-trend'); if(trendEl) trendEl.innerHTML=renderTrendSVG(data.trend);
  var indEl=document.getElementById('chart-industry'); if(indEl) indEl.innerHTML=renderIndustrySVG(data.industries);
  var prodEl=document.getElementById('chart-product'); if(prodEl) prodEl.innerHTML=renderProductSVG(data.products);
  // TOP10 table
  var topEl=document.getElementById('table-top10');
  if(topEl) topEl.innerHTML='<table class="db-mini-table"><thead><tr><th>#</th><th>账户</th><th>消耗</th><th>ROI</th></tr></thead><tbody>'+data.top10.map(function(d,i){return'<tr><td>'+(i+1)+'</td><td style="font-weight:500">'+d.name+'</td><td>¥'+(d.cost>9999?Math.round(d.cost/10000)+'万':d.cost.toLocaleString())+'</td><td style="font-weight:600">'+d.roi+'</td></tr>'}).join('')+'</tbody></table>';
  // Anomaly table
  var anomEl=document.getElementById('table-anomaly');
  if(anomEl) anomEl.innerHTML='<table class="db-mini-table"><tbody>'+data.anomalies.map(function(d){return'<tr><td><span class="db-badge '+d.lvl+'">'+d.lvl+'</span></td><td style="font-weight:500">'+d.name+'</td><td style="font-size:11px;color:var(--text2)">'+d.reason+'</td></tr>'}).join('')+'</tbody></table>';
}

function switchDbPeriod(p,el){DB.period=p;document.querySelectorAll('.db-filter').forEach(function(f){f.classList.remove('active')});el.classList.add('active');renderDashboard()}
function switchDbRegion(r){DB.region=r;renderDashboard()}

// ============================================================
// Drill-down — 每个看板板块点进去的明细
// ============================================================

function openDrill(title,html){
  document.getElementById('drill-title').textContent=title;
  document.getElementById('drill-body').innerHTML=html;
  document.getElementById('drill-overlay').classList.remove('hidden');
}
function closeDrill(e){if(e&&e.target!==document.getElementById('drill-overlay'))return;document.getElementById('drill-overlay').classList.add('hidden')}

// 点击 KPI 卡片
function drillKPI(type){
  var data=genDbData();
  if(type==='cost')openDrill('消耗明细 — '+DB.region,
    '<div class="drill-metric-row"><div class="drill-metric"><span class="dm-label">总消耗</span><span class="dm-val">¥'+(data.total>9999?Math.round(data.total/10000)+'万':data.total.toLocaleString())+'</span></div><div class="drill-metric"><span class="dm-label">日均消耗</span><span class="dm-val">¥'+Math.round(data.total/(DB.period==='7d'?7:30)/10000)+'万</span></div><div class="drill-metric"><span class="dm-label">环比变化</span><span class="dm-val" style="color:'+(data.wowPct>=0?'var(--success)':'var(--danger)')+'">'+(data.wowPct>=0?'+':'')+data.wowPct+'%</span></div></div>'+
    '<div class="drill-section"><h4>日度消耗趋势</h4><table><thead><tr><th>日期</th><th>消耗 (万)</th><th>环比前日</th><th>ROI</th></tr></thead><tbody>'+data.trend.map(function(d,i){var prev=data.trend[i-1];var chg=prev?Math.round((d.value-prev.value)/prev.value*1000)/10:0;return'<tr><td>'+d.date+'</td><td style="font-weight:600">¥'+Math.round(d.value/10000)+'万</td><td style="color:'+(chg>=0?'var(--success)':'var(--danger)')+'">'+(chg>=0?'+':'')+chg+'%</td><td>'+d.roi+'</td></tr>'}).join('')+'</tbody></table></div>');
  else if(type==='roi')openDrill('ROI 分析 — '+DB.region,
    '<div class="drill-metric-row"><div class="drill-metric"><span class="dm-label">平均 ROI</span><span class="dm-val">'+data.roiAvg+'</span></div><div class="drill-metric"><span class="dm-label">最高 ROI</span><span class="dm-val" style="color:var(--success)">'+Math.round((data.roiAvg*1.8)*100)/100+'</span></div><div class="drill-metric"><span class="dm-label">最低 ROI</span><span class="dm-val" style="color:var(--danger)">'+Math.round((data.roiAvg*0.4)*100)/100+'</span></div></div>'+
    '<div class="drill-section"><h4>ROI 分层分析</h4><table><thead><tr><th>ROI区间</th><th>账户数</th><th>消耗占比</th><th>状态</th></tr></thead><tbody><tr><td>> 3.0</td><td>'+Math.round(data.activeCount*0.22)+'</td><td>28%</td><td style="color:var(--success)">优秀</td></tr><tr><td>2.0 - 3.0</td><td>'+Math.round(data.activeCount*0.38)+'</td><td>41%</td><td style="color:var(--success)">良好</td></tr><tr><td>1.0 - 2.0</td><td>'+Math.round(data.activeCount*0.28)+'</td><td>22%</td><td style="color:var(--warning)">关注</td></tr><tr><td>< 1.0</td><td>'+Math.round(data.activeCount*0.12)+'</td><td>9%</td><td style="color:var(--danger)">警告</td></tr></tbody></table></div>');
  else if(type==='active')openDrill('活跃账户明细 — '+DB.region,
    '<div class="drill-section"><h4>活跃账户增长趋势</h4><table><thead><tr><th>周</th><th>活跃账户</th><th>新增</th><th>流失</th><th>净增</th></tr></thead><tbody><tr><td>W27</td><td>'+(data.activeCount-9)+'</td><td>+14</td><td>-6</td><td style="color:var(--success)">+8</td></tr><tr><td>W28</td><td>'+(data.activeCount-5)+'</td><td>+11</td><td>-7</td><td style="color:var(--success)">+4</td></tr><tr><td>W29</td><td>'+(data.activeCount-2)+'</td><td>+8</td><td>-6</td><td style="color:var(--success)">+2</td></tr><tr style="font-weight:600"><td>W30 (当前)</td><td>'+data.activeCount+'</td><td>+11</td><td>-8</td><td style="color:var(--success)">+3</td></tr></tbody></table></div>');
  else if(type==='alert')openDrill('异常告警详情',
    '<div class="drill-section">'+data.anomalies.map(function(a,i){return'<div style="background:'+(a.lvl==='danger'?'var(--danger-bg)':'var(--warning-bg)')+';border-left:3px solid '+(a.lvl==='danger'?'var(--danger)':'var(--warning)')+';padding:12px 16px;border-radius:4px;margin-bottom:8px"><strong>#'+(i+1)+' '+a.name+'</strong><br><span style="font-size:12px;color:var(--text2)">'+a.reason+'</span><br><span style="font-size:11px;color:var(--text3);margin-top:4px;display:block">建议: '+(a.lvl==='danger'?'立即联系客户, 48h内出方案':'本周内跟进检查, 发送优化建议')+'</span></div>'}).join('')+'</div>');
}

// 点击图表 → 看对应分类的明细
function drillIndustry(name){
  var data=genDbData(), ind=data.industries.find(function(d){return d.n===name})||data.industries[0];
  var actCount=Math.round(data.activeCount*(ind.v/100));
  openDrill(ind.n+'行业 · 投放详情','<div class="drill-metric-row"><div class="drill-metric"><span class="dm-label">行业消耗占比</span><span class="dm-val">'+ind.v+'%</span></div><div class="drill-metric"><span class="dm-label">活跃账户</span><span class="dm-val">'+actCount+'</span></div><div class="drill-metric"><span class="dm-label">行业 ROI 均值</span><span class="dm-val">'+Math.round((data.roiAvg*(0.78+Math.random()*0.44))*100)/100+'</span></div></div><div class="drill-section"><h4>子行业分布</h4><table><thead><tr><th>子行业</th><th>消耗占比</th><th>ROI</th><th>趋势</th></tr></thead><tbody>'+['美妆个护','综合电商','直播电商','跨境电商'].map(function(s,i){return'<tr><td style="font-weight:500">'+s+'</td><td>'+Math.round(ind.v/(i+1.5))+'%</td><td>'+Math.round((2+Math.random()*2.5)*100)/100+'</td><td style="color:'+(i<2?'var(--success)':'var(--text2)')+'">'+(i<2?'↑ 增长':'→ 平稳')+'</td></tr>'}).join('')+'</tbody></table></div>');
}

function drillProduct(name){
  var data=genDbData(), prod=data.products.find(function(d){return d.n===name})||data.products[0];
  openDrill(name+' · 投放详情','<div class="drill-metric-row"><div class="drill-metric"><span class="dm-label">消耗占比</span><span class="dm-val">'+prod.v+'%</span></div><div class="drill-metric"><span class="dm-label">平均 CTR</span><span class="dm-val">'+Math.round((1.8+Math.random()*2.2)*10)/10+'%</span></div><div class="drill-metric"><span class="dm-label">平均 CVR</span><span class="dm-val">'+Math.round((1+Math.random()*3)*10)/10+'%</span></div></div><div class="drill-section"><h4>'+name+' 投放策略建议</h4><table><thead><tr><th>维度</th><th>当前值</th><th>行业基准</th><th>建议</th></tr></thead><tbody><tr><td>CTR</td><td>'+Math.round((2+Math.random()*1.2)*10)/10+'%</td><td>2.35%</td><td>'+(Math.random()>0.5?'素材更新频率提升至每周3次':'前3秒钩子优化')+'</td></tr><tr><td>CVR</td><td>'+Math.round((1.5+Math.random()*2)*10)/10+'%</td><td>1.8%</td><td>'+(Math.random()>0.5?'落地页加载速度优化':'增加社交proof模块')+'</td></tr><tr><td>eCPM</td><td>¥'+Math.round(25+Math.random()*30)+'</td><td>¥38</td><td>竞争度中等，有提价空间</td></tr></tbody></table></div>');
}

function drillAccount(name){
  openDrill(name+' · 账户详情','<div class="drill-metric-row"><div class="drill-metric"><span class="dm-label">近30天消耗</span><span class="dm-val">¥'+Math.round((50+Math.random()*200)*100)/100+'万</span></div><div class="drill-metric"><span class="dm-label">当前 ROI</span><span class="dm-val">'+Math.round((1.5+Math.random()*3)*100)/100+'</span></div><div class="drill-metric"><span class="dm-label">CTR</span><span class="dm-val">'+Math.round((1.8+Math.random()*1.8)*10)/10+'%</span></div></div><div class="drill-section"><h4>投放产品分布</h4><table><thead><tr><th>产品</th><th>消耗占比</th><th>ROI</th><th>状态</th></tr></thead><tbody><tr><td>千川</td><td>46%</td><td>'+Math.round((1.8+Math.random()*2.5)*100)/100+'</td><td style="color:var(--success)">正常</td></tr><tr><td>引擎</td><td>32%</td><td>'+Math.round((1.5+Math.random()*2)*100)/100+'</td><td style="color:var(--success)">正常</td></tr><tr><td>搜索</td><td>14%</td><td>'+Math.round((2+Math.random()*3)*100)/100+'</td><td style="color:var(--success)">正常</td></tr><tr><td>穿山甲</td><td>8%</td><td>'+Math.round((1+Math.random()*1.5)*100)/100+'</td><td style="color:var(--warning)">待优化</td></tr></tbody></table></div><div class="drill-section"><h4>最近操作记录</h4><table><thead><tr><th>时间</th><th>操作</th><th>操作人</th></tr></thead><tbody><tr><td>07-29 14:22</td><td>新建千川计划(激活-自动出价)</td><td>张三</td></tr><tr><td>07-28 10:05</td><td>更新素材×3</td><td>张三</td></tr><tr><td>07-27 16:30</td><td>预算调整 ¥500→¥800/天</td><td>张三</td></tr></tbody></table></div>');
}

// 让 KPI 卡片可点击
function bindDrillClicks(){
  var kpis=document.querySelectorAll('.db-kpi');
  if(kpis.length>=6){
    kpis[0].onclick=function(){drillKPI('cost')};
    kpis[1].onclick=function(){drillKPI('cost')};
    kpis[2].onclick=function(){drillKPI('roi')};
    kpis[3].onclick=function(){drillKPI('active')};
    kpis[4].onclick=function(){drillKPI('roi')};
    kpis[5].onclick=function(){drillKPI('alert')};
  }
}

// 在 renderDashboard 末尾绑定
var _origRenderDashboard=renderDashboard;
renderDashboard=function(){
  _origRenderDashboard();
  // 行业柱图点击
  setTimeout(function(){
    var indSvg=document.querySelector('#chart-industry svg');
    if(indSvg) indSvg.style.cursor='pointer';
    var indRects=document.querySelectorAll('#chart-industry rect');
    var indLabels=['电商','游戏','教育','AI/科技','本地生活','金融'];
    indRects.forEach(function(r,i){r.onclick=function(){drillIndustry(indLabels[i]||'电商')}});
    // 产品饼图点击
    var prodPaths=document.querySelectorAll('#chart-product path');
    var prodLabels=['千川','引擎','搜索','穿山甲'];
    prodPaths.forEach(function(p,i){p.style.cursor='pointer';p.onclick=function(){drillProduct(prodLabels[i]||'千川')}});
    // TOP10 点击
    var topRows=document.querySelectorAll('#table-top10 tr');
    topRows.forEach(function(r){r.onclick=function(){var n=r.querySelector('td:nth-child(2)');if(n)drillAccount(n.textContent)}});
    // 异常点击
    var anomRows=document.querySelectorAll('#table-anomaly tr');
    anomRows.forEach(function(r){r.onclick=function(){var n=r.querySelector('td:nth-child(2)');if(n)drillAccount(n.textContent)}});
    // KPI 绑定
    bindDrillClicks();
  },100);
};

// ============================================================
// 初始化
// ============================================================

function init() {
  initNavigation();
  initChat();
  renderDashboard();
  renderReports();
  renderCustomerCards();
  renderKnowledgeResults('');
}

document.addEventListener('DOMContentLoaded', init);
