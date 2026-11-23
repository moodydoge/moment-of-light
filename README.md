# 此刻有光（moment-of-light）

当你想找人说说话时，AI 可以先陪你聊聊；如果你愿意，也可以邀请一位真实的人，分享几分钟善意。

本仓库是「AI青年行·2026高校好事计划」参赛项目 **此刻有光** 的独立工程（不沿用 WarmSteps）。

## 技术栈

- React 19 + TypeScript
- Vite（内嵌服务端 AI 代理）
- Tailwind CSS v4
- React Router
- Vitest

## 本地启动

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5174/`。

### 启用真实 AI

1. 复制 `.env.example` 为 `.env`
2. 填入已获授权的 `MOL_AI_API_KEY`，以及兼容 OpenAI Chat Completions 的 `MOL_AI_BASE_URL` / `MOL_AI_MODEL`
3. 重新执行 `npm run dev`

未配置密钥时，界面会明确使用 **演示适配器**，不会伪装成真实模型成功。

密钥只在 Vite 服务端中间件读取，不会打包进浏览器。详见 [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md)。

其他命令：

```bash
npm run lint
npm run test
npm run build
```

## 当前已实现

### Milestone 1

- 暖纸风移动优先页面与日/夜主题
- 发起陪伴、善意响应池（演示）、结束反馈
- 可替换服务适配层与安全 UI 边界

### Milestone 2

- 真实 AI 服务端代理（OpenAI 兼容 `/chat/completions`）
- 连续对话上下文（内存、短窗口，默认不落库）
- 生成中 / 取消 / 失败重试 / 结束停止迟到回复
- 独立系统提示词与危机审慎引导
- 话题卡静态展示（发送或填入输入框）
- 演示 AI 与真实 AI 明确区分

## 尚未实现

- 已授权额度下的正式线上模型托管
- 真人实时通信与服务端匹配
- WorkBuddy 正式发布绑定
- 可靠年龄验证与内容治理闭环

## 演示说明

- 真人匹配仍为演示数据与演示控制，标注「演示 / 非真实用户」
- 无密钥时 AI 为演示适配器；有密钥时消息不再标 `isDemo`

详见：

- [docs/PRD.md](docs/PRD.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SAFETY.md](docs/SAFETY.md)
- [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md)
- [AGENTS.md](AGENTS.md)
