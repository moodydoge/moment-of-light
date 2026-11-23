# AI 接入说明（Milestone 2）

## 核查结论

1. **WorkBuddy** 当前公开能力以本地 HTML 轻量发布（`workbuddy.link`）为主，**不是**面向终端用户陪伴对话的大模型 API。  
2. **腾讯 CodeBuddy Agent SDK**（`@tencent-ai/agent-sdk`）面向编程 Agent，需要 `CODEBUDDY_API_KEY`，且本机环境当前 **未配置** 该密钥；不适合直接当作陪伴对话后端。  
3. 本机未检测到 `MOL_AI_API_KEY` / `OPENAI_API_KEY` 等可用密钥；**未擅自开通付费云资源**。

## 本轮采用的接入方式

- 开发服务器内嵌 **OpenAI 兼容** `POST /v1/chat/completions` 代理：`/api/ai/chat`、`/api/ai/status`  
- 密钥只存在于服务端环境变量（Vite Node 中间件读取），**不会进入浏览器打包产物**  
- 前端通过 `LiveAIService` 调用同源 `/api/ai/*`；未配置时使用 `DemoAIService` 并明确标注演示  

配置见仓库根目录 `.env.example`。复制为 `.env` 后填入已获授权的密钥与模型名，再执行 `npm run dev`。

## 明确不做什么

- 不把演示回复标成真实模型  
- 不在前端保存 API Key  
- 不复用 WarmSteps 云配置  
- 不臆造 WorkBuddy 私有聊天 SDK  
