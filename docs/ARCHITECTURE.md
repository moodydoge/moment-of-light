# 架构说明 — 此刻有光

## 页面与路由

| 路径 | 页面 | 职责 |
|---|---|---|
| `/` | HomePage | 首页入口与陪伴约定 |
| `/start` | StartCompanionPage | 发起陪伴选项 |
| `/chat` | ChatPage | AI / 真人演示聊天与状态控制 |
| `/kindness` | KindnessPoolPage | 善意响应池 |
| `/feedback` | FeedbackPage | 结束反馈 |

## 状态模型

核心会话状态（`SessionStatus`）：

`ai_chatting` → `invite_confirming` → `waiting_human` → `human_requesting` → `human_joined` → `human_left` → `ended`

纯函数状态机：`src/lib/sessionMachine.ts`（含自动化测试）。

AI 私聊与公开请求有明确边界：开放请求默认只暴露话题标签，不分享 AI 历史（`shareAiHistory: false`）。

## 服务适配层

接口定义：`src/services/contracts.ts`

| 接口 | 职责 | 当前实现 |
|---|---|---|
| `CompanionAIService` | 话题卡与回复（含 history / AbortSignal） | `LiveAIService` 或 `DemoAIService` |
| `MatchingService` | 请求开放 / 列表 / 接入确认 | UI 已切换到 Companion API；旧 demo 仅作回退 |
| Companion API | `/api/companion/*` | 受控试点：HMAC 访客 + SQLite + WS |
| `ChatService` | AI 侧消息（内存） | `DemoChatService`；真人消息走 Companion |
| `FeedbackService` | 反馈 / 举报 / 阻止 | 真人路径走 Companion；AI-only 仍可用 demo |

AI 生成状态（`AiGenerationStatus`）：`idle | generating | success | failed | cancelled | ended`

### Milestone 2 AI 路径

1. 浏览器 → `POST /api/ai/chat`（同源）  
2. Vite Node 中间件（`server/viteAiPlugin.ts`）读取 `MOL_AI_*`  
3. 上游 OpenAI 兼容 `POST {baseUrl}/chat/completions`  
4. 系统提示词：`server/companionPrompt.ts`（与业务编排分离）

未配置密钥时 `kind` 保持 `demo`，UI 明确标注；不得把 demo 改称 live。

## 生产入口（M4.5）

- 开发：`npm run dev`（Vite `configureServer` 挂载 AI + Companion + WS）
- 生产：`npm run build` → `npm run start`（`server/prodServer.ts`：静态 `dist/` + `/api/ai/*` + `/api/companion/*` + `/api/companion/ws` + `/healthz`）
- `server/standalone.mjs` **仅** AI 代理，不含 Companion，不可单独作为真人通道生产入口
- 跨域可选：构建期 `VITE_MOL_API_BASE` + 运行期 `MOL_CORS_ORIGINS`；推荐同源反代以简化 WSS

## 未来接入方向

1. **正式托管**：轻量云主机或容器云托管跑 `prodServer`（见 `docs/M4_5_DEPLOYMENT_DECISION.md`）。
2. **真人实时通信**：已用原生 WebSocket（`ws`）+ 4s 轮询兜底；多实例需共享会话层（当前单实例内存 hub）。
3. **匹配**：请求入库、双向确认、超时、限流、举报处置（受控试点已具备基础版）。
4. **发布**：WorkBuddy 可只发静态；完整能力依赖上述 Node 服务。
