# Changelog

本项目按比赛里程碑管理版本。当前仓库代码为 **Milestone 2** 完整状态（包含 Milestone 1 全部能力并叠加真实 AI）。

## [0.2.0] — Milestone 2（真实 AI 陪伴）

- 服务端 OpenAI 兼容代理：`/api/ai/status`、`/api/ai/chat`
- DeepSeek 等供应商可通过 `.env` 配置（密钥不进仓库）
- 连续对话上下文、生成中 / 取消 / 失败重试 / 结束停止迟到回复
- 独立系统提示词与危机审慎引导
- 话题卡支持直接发送或填入输入框
- 演示 AI 与真实 AI 明确区分；真人匹配仍为演示

## [0.1.0] — Milestone 1（可交互原型）

- Vite + React + TypeScript + Tailwind 工程脚手架
- 首页 / 发起陪伴 / 聊天 / 善意响应池 / 结束反馈
- 演示态 AI 适配器与匹配状态机
- 安全边界 UI（同意、举报/阻止、身份标注）
- 文档：`README`、`docs/PRD`、`ARCHITECTURE`、`SAFETY`、`AGENTS`

> 说明：Milestone 1 完成时尚未纳入 Git。仓库以 Milestone 2 代码为主干；`v0.1.0` 发行说明用于归档 M1 范围，`v0.2.0` 对应当前可运行代码。
