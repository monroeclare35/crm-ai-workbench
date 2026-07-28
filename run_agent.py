"""
CRM AI 工作台 Agent 运行脚本
"""
import os, sys, json, asyncio

# 模型
os.environ["ANTHROPIC_BASE_URL"]="https://api.deepseek.com/anthropic"
os.environ["ANTHROPIC_AUTH_TOKEN"]="sk-530763cc55cc4320b16089a9e9730a72"
os.environ["ANTHROPIC_MODEL"]="deepseek-v4-pro"

from claude_agent_sdk import (
    query, ClaudeAgentOptions,
    tool, create_sdk_mcp_server, ToolAnnotations,
    ResultMessage, StreamEvent,
)

# ═════════════ MOCK 数据 ═════════════
C=[{"id":"C001","name":"上海美妆科技","industry":"电商(美妆)","cost_30d_wan":285,"roi":3.3,"trend":"↑上升","health":"🟢健康"},
   {"id":"C002","name":"杭州鲸灵网络","industry":"游戏(手游)","cost_30d_wan":152,"roi":1.3,"trend":"↓下降","health":"🟡关注","alert":"ROI连续7天下降42%"},
   {"id":"C003","name":"南京星辉教育","industry":"教育(职业技能)","cost_30d_wan":68,"roi":2.1,"trend":"→平稳","health":"🟡关注"},
   {"id":"C004","name":"北京未来科技","industry":"AI/科技(大模型)","cost_30d_wan":520,"roi":4.5,"trend":"↑上升","health":"🟢健康"},
   {"id":"C005","name":"深圳鹏程电商","industry":"电商(综合)","cost_30d_wan":890,"roi":2.9,"trend":"→平稳","health":"🟢健康"}]

# ═════════════ MCP Tools ═════════════
@tool("search_customers","搜索客户。按名称关键词、行业筛选。",{"keyword":str,"industry":str},annotations=ToolAnnotations(readOnlyHint=True))
async def search_customers(args):
    kw=(args.get("keyword")or"").lower();ind=(args.get("industry")or"").lower()
    r=[c for c in C if(not kw or kw in c["name"].lower()or kw in c["industry"].lower())and(not ind or ind in c["industry"].lower())]
    return{"content":[{"type":"text","text":json.dumps(r,ensure_ascii=False)}]}

@tool("get_customer_detail","获取客户完整详情",{"customer_id":str},annotations=ToolAnnotations(readOnlyHint=True))
async def get_customer_detail(args):
    for c in C:
        if c["id"]==args["customer_id"]:return{"content":[{"type":"text","text":json.dumps(c,ensure_ascii=False)}]}
    return{"content":[{"type":"text","text":"NOT FOUND"}],"is_error":True}

@tool("search_knowledge","搜索广告知识库",{"query":str},annotations=ToolAnnotations(readOnlyHint=True))
async def search_knowledge(args):
    kb={"oCPM":"oCPM以转化为优化目标。日转化>=20效果最佳。学习期1-3天。","ROI诊断":"ROI下降拆解:CTR(素材)→CVR(落地页)→CPA(竞价)→客单价→复购率。","搜索广告":"搜索广告收入=Query*填充率*eCPM。CVR是信息流3-5倍。","千川素材":"15-30秒最佳，前3秒钩子，真人出镜CTR+30%。","冷启动":"前3天:预算1.5倍+放宽定向+>=5套素材+不频繁调整。"}
    q=args["query"].lower();r=[]
    for k,v in kb.items():
        if any(w in q for w in k):r.append({"title":k,"content":v})
    if not r:r=[{"title":"通用","content":"建议查看行业benchmark数据。"}]
    return{"content":[{"type":"text","text":json.dumps(r,ensure_ascii=False)}]}

srv=create_sdk_mcp_server(name="crm",version="1.0",tools=[search_customers,get_customer_detail,search_knowledge])

# ═════════════ System Prompt ═════════════
SYS="""你是广告AI策略Agent。你不是聊天机器人，你是Agent——主动调工具、拿数据、做分析。

## 工具
- search_customers: 搜客户列表
- get_customer_detail: 获取客户完整详情(消耗/ROI/趋势/健康/告警)
- search_knowledge: 搜索广告知识库(出价策略/素材/合规/冷启动)
- Bash: 执行Python脚本处理数据
- Write: 保存结果到文件

## 规则
1. 用户问客户→先调get_customer_detail获取数据
2. 分析必须基于工具返回的真实数据
3. ROI异常→同时调search_knowledge查原因
4. 结构化输出:表格+分点，每条建议具体可落地

## 当前客户(C001-C005)
上海美妆(电商/ROI3.3) 杭州鲸灵(游戏/ROI1.3⚠️) 南京星辉(教育/ROI2.1) 北京未来(AI/ROI4.5) 深圳鹏程(电商/ROI2.9)
"""

# ═════════════ Run ═════════════
async def run(prompt:str):
    print(f"\n{'='*60}\n[Agent] {prompt}\n{'='*60}")
    opts=ClaudeAgentOptions(model="deepseek-v4-pro",system_prompt=SYS,mcp_servers={"crm":srv},
        allowed_tools=["Bash","Write","mcp__crm__*"],permission_mode="bypassPermissions",max_turns=8,cwd=os.getcwd())
    async for msg in query(prompt=prompt,options=opts):
        t=type(msg).__name__
        if isinstance(msg,StreamEvent):
            try:
                ev=msg.event
                if isinstance(ev,dict):
                    ty=ev.get("type","")
                    if ty=="content_block_start":
                        cb=ev.get("content_block",{})
                        if cb.get("type")=="tool_use":print(f"\n  [ToolCall] {cb.get('name','')}")
                    elif ty=="content_block_delta":
                        d=ev.get("delta",{})
                        if d.get("type")=="text_delta":print(d.get("text",""),end="",flush=True)
                        elif d.get("type")=="input_json_delta":print(d.get("partial_json",""),end="",flush=True)
                    elif ty=="content_block_stop":print("")
            except Exception as ex:print(f"[stream err: {ex}]",end="")
        elif isinstance(msg,ResultMessage):
            r=getattr(msg,'result',None)
            if r:print(f"\n[Result] {str(r)[:200]}")
            u=getattr(msg,'usage',None)
            if isinstance(u,dict):print(f"[tokens: {u.get('input_tokens',0)}+{u.get('output_tokens',0)}]")
            else:print("[done]")

if __name__=="__main__":
    p=sys.argv[1]if len(sys.argv)>1 else "帮我看看北京未来科技有限公司的投放情况，消耗、ROI、趋势怎么样"
    asyncio.run(run(p))
