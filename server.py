"""
CRM AI 工作台 — FastAPI 后端
Claude Agent SDK + MCP tools + DeepSeek V4
"""

import os, sys, json, asyncio, shutil, subprocess

os.environ["ANTHROPIC_BASE_URL"]="https://api.deepseek.com/anthropic"
os.environ["ANTHROPIC_AUTH_TOKEN"]="sk-530763cc55cc4320b16089a9e9730a72"
os.environ["ANTHROPIC_API_KEY"]="sk-530763cc55cc4320b16089a9e9730a72"
os.environ["ANTHROPIC_MODEL"]="deepseek-v4-pro"
os.environ["CLAUDE_CODE_SKIP_AUTH"]="1"
os.environ["DISABLE_ANTHROPIC_OAUTH"]="1"

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ═════════════ MOCK ═════════════
C=[{"id":"C001","name":"上海美妆科技","industry":"电商(美妆)","cost_30d_wan":285,"roi":3.3,"trend":"rising","health":"healthy","products":"千川+引擎","accounts":8},
   {"id":"C002","name":"杭州鲸灵网络","industry":"游戏(手游)","cost_30d_wan":152,"roi":1.3,"trend":"declining","health":"warning","products":"引擎+穿山甲","accounts":5,"alert":"ROI连续7天下降42%"},
   {"id":"C003","name":"南京星辉教育","industry":"教育(职业技能)","cost_30d_wan":68,"roi":2.1,"trend":"stable","health":"warning","products":"千川","accounts":3},
   {"id":"C004","name":"北京未来科技","industry":"AI/科技(大模型)","cost_30d_wan":520,"roi":4.5,"trend":"rising","health":"healthy","products":"引擎+搜索","accounts":12},
   {"id":"C005","name":"深圳鹏程电商","industry":"电商(综合)","cost_30d_wan":890,"roi":2.9,"trend":"stable","health":"healthy","products":"千川+引擎+穿山甲","accounts":20}]

KB={"oCPM":"oCPM以转化为优化目标。日转化>=20效果最佳。学习期1-3天。初始出价=目标成本*1.2。",
    "ROI":"ROI下降六维拆解:CTR(素材疲劳)->CVR(落地页)->CPA(竞价)->客单价->复购率->退货率。",
    "搜索广告":"搜索广告收入=Query量*填充率*eCPM。CVR是信息流3-5倍。关键词:品牌词+品类词+竞品词+场景词。",
    "千川":"电商首选。15-30秒视频，前3秒钩子，真人出镜CTR+30%。每周>=3套新素材。",
    "冷启动":"新账户前3天:预算1.5倍+放宽定向+>=5套素材+不频繁调整(<=2次/天)。",
    "合规":"禁用:最/第一/国家级/唯一/顶级。教育禁保过/包就业。K12禁年龄定向。首次警告+下架，再犯封停7-30天。"}

BENCHMARK={"电商":{"ctr":2.1,"cvr":1.8,"cpa":45,"roi":2.6},"游戏":{"ctr":2.8,"cvr":1.5,"cpa":38,"roi":2.2},"教育":{"ctr":1.8,"cvr":2.5,"cpa":55,"roi":3.1},"AI/科技":{"ctr":2.3,"cvr":2.0,"cpa":65,"roi":2.9}}

# ═════════════ MCP Tools ═════════════
try:
    from claude_agent_sdk import tool, create_sdk_mcp_server, ToolAnnotations

    @tool("search_customers","搜索客户。按名称关键词、行业筛选。",{"keyword":str,"industry":str},annotations=ToolAnnotations(readOnlyHint=True))
    async def t_search(args):
        kw=(args.get("keyword")or"").lower();ind=(args.get("industry")or"").lower()
        r=[{"id":c["id"],"name":c["name"],"industry":c["industry"],"cost_30d_wan":c["cost_30d_wan"],"roi":c["roi"],"health":c["health"]} for c in C if(not kw or kw in c["name"].lower()or kw in c["industry"].lower())and(not ind or ind in c["industry"].lower())]
        return{"content":[{"type":"text","text":json.dumps(r,ensure_ascii=False)}]}

    @tool("get_customer_detail","客户详情(消耗/ROI/趋势/健康/产品/告警)",{"customer_id":str},annotations=ToolAnnotations(readOnlyHint=True))
    async def t_detail(args):
        for c in C:
            if c["id"]==args["customer_id"]:return{"content":[{"type":"text","text":json.dumps(c,ensure_ascii=False)}]}
        return{"content":[{"type":"text","text":"NOT FOUND"}],"is_error":True}

    @tool("search_knowledge","搜索广告知识库(策略/产品/合规/冷启动)",{"query":str},annotations=ToolAnnotations(readOnlyHint=True))
    async def t_knowledge(args):
        q=args["query"].lower();r=[]
        for k,v in KB.items():
            if any(w in q for w in k):r.append({"title":k,"content":v})
        if not r:r=[{"title":"通用","content":"请查看行业benchmark或联系运营团队。"}]
        return{"content":[{"type":"text","text":json.dumps(r,ensure_ascii=False)}]}

    @tool("get_benchmark","行业基准数据(CTR/CVR/CPA/ROI)",{"industry":str},annotations=ToolAnnotations(readOnlyHint=True))
    async def t_benchmark(args):
        b=BENCHMARK.get(args.get("industry",""),{"ctr":2.35,"cvr":1.8,"cpa":50,"roi":2.7})
        return{"content":[{"type":"text","text":json.dumps(b,ensure_ascii=False)}]}

    srv=create_sdk_mcp_server(name="crm",version="1.0",tools=[t_search,t_detail,t_knowledge,t_benchmark])
    SDK_READY=True
except Exception as e:
    SDK_READY=False; SDK_ERROR=str(e)

SYS="""你是广告AI策略Agent。你不是聊天机器人——主动调工具、拿数据、做分析。

## 工具
- get_customer_detail(customer_id): 客户详情(消耗/ROI/趋势/健康/产品)
- search_customers(keyword,industry): 搜客户列表
- search_knowledge(query): 搜广告知识库
- get_benchmark(industry): 查行业基准
- Bash: 执行Python脚本
- Write: 保存文件

## 规则
1. 用户问客户->先调get_customer_detail获取真实数据
2. 分析必须基于工具返回的数据
3. ROI异常->同时调search_knowledge查原因+get_benchmark对比行业
4. 结构化输出:表格+分点
5. 创意生成:按产品线(千川15-30秒/搜索30字/引擎原生)差异化

## 客户速查
C001上海美妆(电商/ROI3.3) C002杭州鲸灵(游戏/ROI1.3告警!) C003南京星辉(教育/ROI2.1) C004北京未来(AI/ROI4.5) C005深圳鹏程(电商/ROI2.9)
"""

# ═════════════ App ═════════════
app=FastAPI(title="CRM AI Agent")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])

class ChatReq(BaseModel):
    message: str
    task_type: str = "chat"

@app.post("/api/v1/chat/stream")
async def chat_stream(req:ChatReq):
    if not SDK_READY:
        async def err(): yield f"data: {json.dumps({'type':'error','content':f'SDK init failed: {SDK_ERROR}'})}\n\n"
        return StreamingResponse(err(),media_type="text/event-stream")

    from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage, StreamEvent
    async def gen():
        try:
            cli=shutil.which("claude") or shutil.which("node")
            stderr_lines=[]
            def capture_stderr(line): stderr_lines.append(line)
            opts=ClaudeAgentOptions(model="deepseek-v4-pro",system_prompt=SYS,mcp_servers={"crm":srv},
                allowed_tools=["Bash","Write","mcp__crm__*"],permission_mode="bypassPermissions",max_turns=10,
                cwd=os.getcwd(),cli_path=cli,stderr=capture_stderr,include_partial_messages=True)
            async for msg in query(prompt=req.message,options=opts):
                if isinstance(msg,StreamEvent):
                    try:
                        ev=msg.event
                        if isinstance(ev,dict):
                            ty=ev.get("type","")
                            if ty=="content_block_start":
                                cb=ev.get("content_block",{})
                                cbt=cb.get("type","")
                                if cbt=="tool_use":
                                    yield f"data: {json.dumps({'type':'agent_step','step':'tool_call','name':cb.get('name',''),'input':cb.get('input',{})},ensure_ascii=False)}\n\n"
                                elif cbt=="thinking":
                                    yield f"data: {json.dumps({'type':'agent_step','step':'thinking'},ensure_ascii=False)}\n\n"
                            elif ty=="content_block_delta":
                                d=ev.get("delta",{})
                                dt=d.get("type","")
                                if dt=="text_delta":yield f"data: {json.dumps({'type':'text_delta','content':d.get('text','')},ensure_ascii=False)}\n\n"
                                elif dt=="thinking_delta":yield f"data: {json.dumps({'type':'agent_step','step':'thinking_delta','text':d.get('thinking','')[:200]},ensure_ascii=False)}\n\n"
                            elif ty=="content_block_stop":
                                yield f"data: {json.dumps({'type':'agent_step','step':'block_done'},ensure_ascii=False)}\n\n"
                    except:pass
                elif isinstance(msg,ResultMessage):
                    r=getattr(msg,'result',None)
                    if r: yield f"data: {json.dumps({'type':'text_delta','content':str(r)},ensure_ascii=False)}\n\n"
                    u=getattr(msg,'usage',None); tk={"input_tokens":0,"output_tokens":0}
                    if isinstance(u,dict):tk=u
                    yield f"data: {json.dumps({'type':'done','usage':tk},ensure_ascii=False)}\n\n"
        except Exception as e:
            err=str(e)
            if stderr_lines: err+=" | stderr: "+" | ".join(stderr_lines[-5:])
            yield f"data: {json.dumps({'type':'error','content':err},ensure_ascii=False)}\n\n"
    return StreamingResponse(gen(),media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

@app.get("/api/v1/debug/files")
async def list_files():
    import glob
    files=glob.glob("/app/**/*",recursive=True)
    return {"files":files[:50]}

@app.get("/api/v1/debug/claude-test")
async def claude_test():
    """直接跑claude CLI看stderr"""
    try:
        r=subprocess.run(["claude","--version"],capture_output=True,text=True,timeout=10)
        # 用echo测试stdin通信
        r2=subprocess.run(["claude"],input='{"type":"init"}\n',capture_output=True,text=True,timeout=15)
        return {"version":{"stdout":r.stdout.strip(),"stderr":r.stderr.strip(),"rc":r.returncode},"init_test":{"stdout":r2.stdout.strip()[:500],"stderr":r2.stderr.strip()[:500],"rc":r2.returncode}}
    except Exception as e: return {"error":str(e)}

@app.get("/api/v1/health")
async def health():
    info={"status":"ok","agent":"Claude Agent SDK + DeepSeek V4 Pro","sdk_ready":SDK_READY,"claude_path":shutil.which("claude") or "NOT FOUND"}
    # Test claude CLI
    try:
        r=subprocess.run(["claude","--version"],capture_output=True,text=True,timeout=10)
        info["claude_version"]=r.stdout.strip() or r.stderr.strip()
        info["claude_rc"]=r.returncode
    except Exception as e: info["claude_test_err"]=str(e)
    try:
        r=subprocess.run(["node","-e","console.log('ok')"],capture_output=True,text=True,timeout=5)
        info["node_test"]=r.stdout.strip()
    except Exception as e: info["node_test_err"]=str(e)
    return info

if __name__=="__main__":
    import uvicorn
    port=int(os.environ.get("PORT",8000))
    print(f"\n=== CRM AI Agent :{port} ===")
    print(f"SDK ready: {SDK_READY}")
    print(f"Claude path: {shutil.which('claude')}")
    uvicorn.run(app,host="0.0.0.0",port=port,log_level="info")
