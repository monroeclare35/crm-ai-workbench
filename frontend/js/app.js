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

// 预设配置 — 可直接调用的 API 端点
var PRESETS = {
  deepseek: { apiUrl: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-v4-pro' },
  kimi:     { apiUrl: 'https://api.moonshot.ai/v1/chat/completions',  model: 'kimi-k2.6' },
  glm:      { apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4.5' }
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
  API_CONFIG.apiUrl=document.getElementById('set-api-url').value.trim();
  API_CONFIG.apiKey=document.getElementById('set-api-key').value.trim();
  API_CONFIG.model=document.getElementById('set-model').value.trim();
  localStorage.setItem('crm_ai_settings',JSON.stringify(API_CONFIG));
  document.getElementById('settings-msg').textContent='✓ 已保存';
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

  if (view === 'dashboard') renderDashboard();
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
  var message = chatInput.value.trim();
  if (!message || state.isStreaming) return;

  // 检查API配置
  if (!API_CONFIG.apiKey) {
    appendMessage('system', '⚠️ 请先点击左下角 ⚙️ 设置 API Key（然后选 DeepSeek 预设）');
    return;
  }

  state.isStreaming = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;
  chatLoading.classList.remove('hidden');

  appendMessage('user', message);
  scrollToBottom();

  var apiUrl = API_CONFIG.apiUrl || 'https://api.deepseek.com/v1/chat/completions';
  var model = API_CONFIG.model || 'deepseek-v4-pro';

  // System Prompt — 广告AI策略助手
  var systemPrompt = '你是抖音集团广告AI策略助手。你擅长：\n'+
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
// 初始化
// ============================================================

function init() {
  initNavigation();
  initChat();
  renderDashboard();
  renderCustomerCards();
}

document.addEventListener('DOMContentLoaded', init);
