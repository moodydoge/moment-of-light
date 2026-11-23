# 此刻有光（moment-of-light）

当你想找人说说话时，AI 可以先陪你聊聊；如果你愿意，也可以邀请一位真实的人，分享几分钟善意。

本仓库是「AI青年行·2026高校好事计划」参赛项目 **此刻有光** 的独立工程（不沿用 WarmSteps）。

## 技术栈

- React 19 + TypeScript
- Vite（内嵌 AI 代理 + Companion 受控服务）
- Tailwind CSS v4
- React Router
- Vitest
- SQLite（`node:sqlite`）+ WebSocket

## 本地启动

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5174/`。

### 启用真实 AI

1. 复制 `.env.example` 为 `.env`
2. 配置 `MOL_AI_API_KEY` / `MOL_AI_BASE_URL` / `MOL_AI_MODEL`
3. 重启 `npm run dev`

### 真人受控试点

开发服务器已内置 Companion API（无需额外云账号）：

- 访客身份由服务端签发
- 请求池 / 申请 / 双方确认 / 真人消息为真实跨端同步
- **尚未对公众无限制开放**

双浏览器步骤见 [docs/M3_DUAL_BROWSER_TEST.md](docs/M3_DUAL_BROWSER_TEST.md)。

```bash
npm run lint
npm run test
npm run build
```

## 当前已实现

### Milestone 1–2

首页与流程、DeepSeek 真实 AI、安全 UI 边界。详见 `CHANGELOG.md`。

### Milestone 3（受控试点）

- 真实善意响应池与双方确认匹配
- 真人实时文字（WebSocket + 轮询兜底）
- 原子占位、会话 ACL、举报/阻止落库
- 真人加入后 AI 改为可选话题建议

## 尚未实现 / 需你确认

- 托管云（如 Supabase Auth+RLS+Realtime）或正式公网部署
- 严格年龄核验与完整内容治理人工闭环
- WorkBuddy 正式发布

云变更清单见 [docs/M3_DESIGN.md](docs/M3_DESIGN.md) — **未擅自开通付费资源**。

## 文档

- [docs/PRD.md](docs/PRD.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SAFETY.md](docs/SAFETY.md)
- [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md)
- [docs/M3_DESIGN.md](docs/M3_DESIGN.md)
- [AGENTS.md](AGENTS.md)
