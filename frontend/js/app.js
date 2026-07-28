/**
 * CRM AI 智能工作台 — Frontend App v2.0
 * SVG 迷你图表 · 客户数据表 · 报告卡片 · 知识搜索 · SSE 流式对话
 */

// ============================================================
// State
// ============================================================
const S = { view:'chat', userId:'dev-sales-001', streaming:false };

// ============================================================
// Navigation
// ============================================================
function initNav(){
  document.querySelectorAll('.nav-item[data-view]').forEach(el=>{
    el.addEventListener('click',function(e){e.preventDefault();switchView(this.dataset.view)})
  });
}
function switchView(v){
  if(S.streaming) return;
  S.view=v;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const targetNav=document.querySelector('.nav-item[data-view="'+v+'"]');
  if(targetNav) targetNav.classList.add('active');
  document.querySelectorAll('.view').forEach(vw=>vw.classList.remove('active'));
  const targetView=document.getElementById('view-'+v);
  if(targetView) targetView.classList.add('active');
  try{
    if(v==='dashboard') renderCharts();
    if(v==='customers') renderCustomerTable();
    if(v==='reports') renderReports();
    if(v==='knowledge') renderKnowledge();
  }catch(e){console.error('switchView render error:',e)}
}

// ============================================================
// SVG Mini Sparklines
// ============================================================
function sparkSVG(data,color,width=60,height=32){
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-(v/Math.max(...data))*height}`);
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ============================================================
// Dashboard Charts (SVG) — 防御式渲染
// ============================================================
function renderCharts(){
  try{
    // Mini sparklines
    const cost=[82,88,78,92,85,95,90,98,102,96,108,105,112,118,115,125,120,128,130,122,135,128,140,145,138,148,142,155,150,160];
    const roi=[3.1,2.9,3.0,3.2,3.0,2.8,2.9,3.1,2.7,2.8,2.6,2.9,2.8,2.7,2.9,2.8,2.6,2.82];
    const active=[38,39,38,40,41,42,41,43,42,44,43,45,44,46,45,47,46,47];
    var el=document.getElementById('spark-cost'); if(el) el.innerHTML=sparkSVG(cost,'#2563EB');
    el=document.getElementById('spark-roi'); if(el) el.innerHTML=sparkSVG(roi,'#059669',60,32);
    el=document.getElementById('spark-active'); if(el) el.innerHTML=sparkSVG(active,'#0284C7',60,32);

    // Trend chart
    var trendEl=document.getElementById('chart-trend');
    if(trendEl){
      var w=600,h=220,pad=40;
      var maxV=Math.max.apply(null,cost);
      var pts=cost.map(function(v,i){return (pad+(i/(cost.length-1))*(w-2*pad))+','+(h-pad-(v/maxV)*(h-2*pad))}).join(' ');
      var area=pts+' '+(pad+(cost.length-1)/(cost.length-1)*(w-2*pad))+','+(h-pad)+' '+pad+','+(h-pad);
      var gridLines=[0,.25,.5,.75,1].map(function(x){return '<line x1="'+pad+'" y1="'+(h-pad-x*(h-2*pad))+'" x2="'+(pad+(cost.length-1)/(cost.length-1)*(w-2*pad))+'" y2="'+(h-pad-x*(h-2*pad))+'" stroke="#E4E7ED" stroke-width="0.5" stroke-dasharray="4,4"/>'}).join('');
      trendEl.innerHTML='<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="220"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563EB" stop-opacity="0.15"/><stop offset="100%" stop-color="#2563EB" stop-opacity="0"/></linearGradient></defs><polygon points="'+area+'" fill="url(#tg)"/><polyline points="'+pts+'" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+gridLines+'</svg>';
    }

    // Health pie
    var healthEl=document.getElementById('chart-health');
    if(healthEl){
      var total=47,healthy=32,warning=10,risk=5,cx=100,cy=110,r=80;
      var arcs=[{v:healthy,c:'#059669'},{v:warning,c:'#D97706'},{v:risk,c:'#DC2626'}];
      var ang=0,slices='';
      for(var i=0;i<arcs.length;i++){var a=arcs[i],pct=a.v/total,a0=ang,sw=pct*2*Math.PI;ang+=sw;slices+='<path d="'+describeArc(cx,cy,r,a0,ang)+'" fill="'+a.c+'" opacity="0.85"/>'}
      healthEl.innerHTML='<svg viewBox="0 0 200 220" width="100%" height="220">'+slices+'<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" font-size="28" font-weight="700" fill="#1A1D26">'+total+'</text><text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-size="11" fill="#5F6675">客户总数</text></svg><div style="display:flex;gap:12px;justify-content:center;margin-top:8px;font-size:11.5px"><span style="color:#059669">● 健康 '+healthy+'</span><span style="color:#D97706">● 关注 '+warning+'</span><span style="color:#DC2626">● 风险 '+risk+'</span></div>';
    }

    // Industry bars
    var indEl=document.getElementById('chart-industry');
    if(indEl){
      var bars=[{l:'电商',v:42,c:'#2563EB'},{l:'游戏',v:28,c:'#7C3AED'},{l:'教育',v:15,c:'#059669'},{l:'AI/科技',v:10,c:'#F59E0B'},{l:'其他',v:5,c:'#6B7280'}];
      var mxW=160,bh=26,gap=10,barsHTML='';
      for(var j=0;j<bars.length;j++){var d=bars[j];barsHTML+='<rect x="20" y="'+(j*(bh+gap)+10)+'" width="'+(d.v/mxW*160)+'" height="'+bh+'" rx="5" fill="'+d.c+'" opacity="0.85"/><text x="'+(d.v/mxW*160+26)+'" y="'+(j*(bh+gap)+10+bh/2+4)+'" font-size="11" fill="#1A1D26" font-weight="500">'+d.l+' '+d.v+'%</text>'}
      indEl.innerHTML='<svg viewBox="0 0 200 180" width="100%" height="220">'+barsHTML+'</svg>';
    }
  }catch(e){console.error('renderCharts error:',e)}
}

function describeArc(cx,cy,r,start,end){
  const x1=cx+r*Math.cos(start),y1=cy+r*Math.sin(start),x2=cx+r*Math.cos(end),y2=cy+r*Math.sin(end);
  const large=end-start>Math.PI?1:0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

// ============================================================
// Customer Table
// ============================================================
const CUSTOMERS=[
  {id:'C001',name:'上海美妆科技有限公司',industry:'电商',region:'华东区',level:'S',cost:'285万',roi:3.3,trend:'up',health:'healthy'},
  {id:'C002',name:'杭州鲸灵网络有限公司',industry:'游戏',region:'华东区',level:'A',cost:'152万',roi:1.3,trend:'down',health:'warning'},
  {id:'C003',name:'南京星辉教育科技有限公司',industry:'教育',region:'华东区',level:'B',cost:'68万',roi:2.1,trend:'stable',health:'warning'},
  {id:'C004',name:'北京未来科技有限公司',industry:'AI/科技',region:'华北区',level:'S',cost:'520万',roi:4.5,trend:'up',health:'healthy'},
  {id:'C005',name:'深圳鹏程电商有限公司',industry:'电商',region:'华南区',level:'A',cost:'890万',roi:2.9,trend:'stable',health:'healthy'},
];
function renderCustomerTable(){
  const tbody=document.getElementById('customer-tbody');
  if(!tbody)return;
  const healthLabel={healthy:'健康',warning:'关注',risk:'风险'};
  tbody.innerHTML=CUSTOMERS.map(c=>`<tr onclick="switchView('chat');document.getElementById('chat-input').value='帮我看看${c.name}的详细情况，包括消耗趋势和健康度评估';document.getElementById('send-btn').click()">
    <td style="font-weight:600">${c.name}</td><td>${c.industry}</td><td>${c.region}</td>
    <td><span class="level-badge level-${c.level}">${c.level}</span></td>
    <td style="font-weight:600">¥${c.cost} <span class="cost-${c.trend}">${c.trend==='up'?'↑':c.trend==='down'?'↓':'→'}</span></td>
    <td style="font-weight:600">${c.roi}</td>
    <td><span class="health-dot health-${c.health}"></span>${healthLabel[c.health]}</td>
    <td><button class="btn-sm" onclick="event.stopPropagation();switchView('chat');document.getElementById('chat-input').value='给我${c.name}出一份投放优化方案';document.getElementById('send-btn').click()">分析</button></td>
  </tr>`).join('');
}

// ============================================================
// Reports
// ============================================================
function renderReports(){
  const grid=document.getElementById('report-grid');
  if(!grid)return;
  const reports=[{icon:'📋',title:'华东区周报','date:'2026-07-27','desc':'本周区域消耗 ¥1,285万，环比 +12.5%。5个客户需要重点关注...',meta:'2小时前 · AI生成'},{icon:'📊',title:'上海美妆月报','date:'2026年7月','desc':'月消耗 ¥285万，ROI 3.3，趋势向好。建议加大千川投放...',meta:'昨天 · AI生成'},{icon:'🔬',title:'教育行业Q2分析','date:'2026 Q2','desc':'教育行业广告投放趋势、政策合规动态、头部客户案例分析...',meta:'3天前 · Deep Research'},{icon:'📋',title:'杭州鲸灵优化方案','date:'2026-07-26','desc':'ROI从1.5降至1.3，诊断材料衰减+出价策略问题，建议...',meta:'昨天 · AI生成'}];
  grid.innerHTML=reports.map(r=>`<div class="report-card"><div class="report-icon">${r.icon}</div><h4>${r.title}</h4><p>${r.desc}</p><div class="report-meta"><span>${r.date}</span><span>${r.meta}</span></div></div>`).join('');
}

// ============================================================
// Knowledge
// ============================================================
function renderKnowledge(q=''){
  const container=document.getElementById('knowledge-results');
  if(!container)return;
  const docs=[{title:'巨量千川 oCPM 出价策略详解',content:'oCPM是千川智能出价产品，以转化为优化目标，系统自动调整出价。适用有明确转化目标和充足数据的广告主。日转化≥20个时效果最佳。',cat:'产品文档',src:'千川帮助中心',tags:['出价','oCPM','千川']},{title:'电商行业巨量千川投放最佳实践',content:'优化重点：素材CTR > 落地页CVR > 出价策略。短视频15-30秒最佳，前3秒必须有钩子，真人出镜CTR比图文高30%。',cat:'策略最佳实践',src:'运营团队',tags:['电商','千川','ROI']},{title:'教育行业广告投放合规要点',content:'学科类培训广告全面禁止投放。非学科需提供办学许可证。广告文案不得包含"保过""包就业"等用语。K12受众定向禁止年龄/年级标签。',cat:'投放政策',src:'审核中心',tags:['教育','合规','政策']},{title:'游戏买量ROI优化案例——杭州鲸灵网络',content:'通过素材优化（真人解说+KOL混剪）+定向优化（付费用户画像）+出价切换oCPM，ROI从1.2提升至2.5。关键：不看消耗，关注LTV/CAC。',cat:'行业案例',src:'案例库',tags:['游戏','ROI','案例']},{title:'巨量搜索广告投放指南',content:'用户在抖音搜索时展示广告，转化率是信息流的3-5倍。关键词四维覆盖：品牌词+品类词+竞品词+场景词。建议oCPC出价。',cat:'产品文档',src:'引擎帮助中心',tags:['搜索','SEM','关键词']}];
  const filtered=q?docs.filter(d=>d.title.includes(q)||d.content.includes(q)||d.cat.includes(q)||d.tags.some(t=>t.includes(q))):docs;
  container.innerHTML=filtered.map(d=>`<div class="k-card"><h4>${d.title}</h4><p>${d.content}</p><div class="k-meta"><span>📂 ${d.cat}</span><span>📖 ${d.src}</span><span>${d.tags.map(t=>'#'+t).join(' ')}</span></div></div>`).join('');
}
document.querySelectorAll('.k-cat').forEach(el=>{el.addEventListener('click',function(){document.querySelectorAll('.k-cat').forEach(e=>e.classList.remove('active'));this.classList.add('active');const c=this.textContent;renderKnowledge(c==='全部'?'':c)})});
document.getElementById('knowledge-search-input')?.addEventListener('input',e=>renderKnowledge(e.target.value));

// ============================================================
// Chat
// ============================================================
const chatMsgs=document.getElementById('chat-messages');
const chatInput=document.getElementById('chat-input');
const sendBtn=document.getElementById('send-btn');
const loadingEl=document.getElementById('chat-loading');
const newChatBtn=document.getElementById('new-chat-btn');

function initChat(){
  sendBtn.addEventListener('click',sendMsg);
  chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}});
  chatInput.addEventListener('input',()=>{chatInput.style.height='auto';chatInput.style.height=Math.min(chatInput.scrollHeight,140)+'px'});
  document.querySelectorAll('.prompt-chip').forEach(btn=>{btn.addEventListener('click',()=>{chatInput.value=btn.dataset.prompt;sendMsg()})});
  newChatBtn.addEventListener('click',()=>{chatMsgs.innerHTML='';addWelcome();});
}

function addWelcome(){
  chatMsgs.innerHTML=`<div class="welcome-screen">
    <div class="welcome-icon"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
    <h3>你好，张三</h3><p class="welcome-sub">我是你的 CRM AI 助手，可以帮你查询数据、分析客户、生成报告。</p>
    <div class="quick-prompts">${Array.from(document.querySelectorAll('.prompt-chip')).map(b=>b.outerHTML).join('')}</div>
  </div>`;
  document.querySelectorAll('.prompt-chip').forEach(btn=>{btn.addEventListener('click',()=>{chatInput.value=btn.dataset.prompt;sendMsg()})});
}

async function sendMsg(){
  const msg=chatInput.value.trim();
  if(!msg||S.streaming)return;
  S.streaming=true;chatInput.value='';chatInput.style.height='auto';sendBtn.disabled=true;
  loadingEl.classList.remove('hidden');
  // Remove welcome if present
  const welcome=chatMsgs.querySelector('.welcome-screen');
  if(welcome)welcome.remove();
  // User message
  chatMsgs.appendChild(msgEl('user',msg));
  scrollDown();
  try{
    const resp=await fetch('/api/v1/chat/stream',{method:'POST',headers:{'Content-Type':'application/json','X-User-Id':S.userId},body:JSON.stringify({message:msg,task_type:document.getElementById('model-select')?.value||'chat'})});
    if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
    const reader=resp.body.getReader(),decoder=new TextDecoder();
    let buffer='',asstEl=null,fullText='';
    while(true){
      const{value,done}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      const lines=buffer.split('\n');buffer=lines.pop()||'';
      for(const line of lines){
        if(!line.startsWith('data: '))continue;
        const data=line.slice(6);if(!data)continue;
        try{
          const ev=JSON.parse(data);
          if(ev.type==='text_delta'){
            if(!asstEl){asstEl=document.createElement('div');asstEl.className='message assistant';asstEl.innerHTML='<div class="msg-bubble"></div>';chatMsgs.appendChild(asstEl)}
            fullText+=ev.content;
            asstEl.querySelector('.msg-bubble').innerHTML=md(fullText);
            scrollDown();
          }else if(ev.type==='tool_call'){
            chatMsgs.appendChild(msgEl('system','🔧 调用: <strong>'+ev.tool_name+'</strong>'));
            scrollDown();
          }else if(ev.type==='done'){
            // done
          }else if(ev.type==='error'){
            chatMsgs.appendChild(msgEl('system','❌ '+ev.content));
          }
        }catch(e){}
      }
    }
  }catch(e){
    chatMsgs.appendChild(msgEl('system','❌ 连接失败: '+e.message));
  }finally{
    S.streaming=false;sendBtn.disabled=false;loadingEl.classList.add('hidden');chatInput.focus();
  }
}

function msgEl(type,content){
  const el=document.createElement('div');el.className='message '+type;
  if(type==='assistant')el.innerHTML='<div class="msg-bubble">'+md(content)+'</div>';
  else el.innerHTML='<div class="msg-bubble">'+content+'</div>';
  return el;
}
function scrollDown(){chatMsgs.scrollTop=chatMsgs.scrollHeight}

// Simple Markdown
function md(t){
  return t.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>').replace(/```(\w*)\n([\s\S]*?)```/g,'<pre><code>$2</code></pre>')
    .replace(/^- (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g,'<ul>$&</ul>')
    .replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');
}

// ============================================================
// Init
// ============================================================
function init(){
  initNav();
  initChat();
  try{renderCustomerTable()}catch(e){}
  try{renderReports()}catch(e){}
  try{renderKnowledge()}catch(e){}
}
document.addEventListener('DOMContentLoaded',init);
