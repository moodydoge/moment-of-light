# 此刻有光 · WorkBuddy / 云端部署准备（M4）

> 状态：**方案与本地检查完成；未执行付费开通、正式公网发布或公开真人匹配。**  
> 未经你确认，不得开放不受限制的匿名陌生人聊天。  
> **更新：** 决策与最短路径见 `docs/M4_5_DEPLOYMENT_DECISION.md`（主推轻量云主机同源 `npm run start`）。

## 1. WorkBuddy 能力结论

| 能力 | WorkBuddy 现状 | 对「此刻有光」的影响 |
|---|---|---|
| 静态 HTML/H5 发布 | 适合 | 可托管前端 `dist/` |
| Node 服务 / SQLite | 通常不支持常驻进程 | **无法单独承载** Companion API + WS |
| DeepSeek 密钥代理 | 无服务端保密执行环境时不安全 | Key 不能进前端；需独立后端 |
| WebSocket 实时消息 | 非实时 IM 平台 | 真人通道需另外部署 |
| HTTPS | 视平台 | 公网必须 HTTPS + WSS |

**结论：** WorkBuddy 适合作为**静态前端发布面**；M2 AI 代理与 M3 Companion **必须另外部署** Node 服务（本机受控 / 自建 VPS / 云函数+托管库等）。仅把 `dist` 丢上 WorkBuddy **不能**完整跑通真人实时聊天。

## 2. 推荐架构（待你确认后执行）

```
[浏览器] → WorkBuddy 静态站 (HTTPS)
         ↘ REST/WSS → Companion+AI Node 服务 (HTTPS)
                        ├─ DeepSeek (MOL_AI_*)
                        ├─ SQLite 或托管 Postgres
                        └─ MOL_COMPANION_SECRET / ADMIN_TOKEN
```

前端需配置可覆盖的 API 基址（当前同源 `/api/*`；跨域部署时需 CORS + 环境变量，**尚未改正式生产配置**）。

## 3. 环境变量清单（名称级）

| 变量 | 用途 | 备注 |
|---|---|---|
| `MOL_AI_API_KEY` | DeepSeek 等 | 仅服务端 |
| `MOL_AI_BASE_URL` / `MOL_AI_MODEL` | 模型端点 | 现用 deepseek-flash 等 |
| `MOL_COMPANION_SECRET` | 访客 HMAC | 生产必须固定且保密 |
| `MOL_COMPANION_DB` | SQLite 路径 | 生产建议持久卷或迁库 |
| `MOL_COMPANION_ADMIN_TOKEN` | 举报管理 | 可选但建议配置 |
| （前端）API 基址 | 跨域时 | **待确认后加** |

## 4. 构建与部署步骤（本地已验证）

```bash
npm ci
npm run lint
npm run test
npm run build   # 产出 dist/
```

本地联调：`npm run dev`（Vite 插件挂载 `/api/ai/*` 与 `/api/companion/*` + WS）。

生产示意（**未执行**）：

1. 将 `dist/` 发布到 WorkBuddy（或任意静态 CDN）。  
2. 在独立主机启动带 AI + Companion 的 Node/Vite preview 或自定义 server。  
3. 配置反向代理 HTTPS，同源反代 `/api` 与 `/ws`（若拆分则配 CORS）。  
4. 健康检查：`GET /api/ai/status`、`GET /api/companion/status`（`publicOpen` 必须为 `false` 直至批准）。

## 5. 资源与费用（需你确认）

可能产生费用的项（**本轮未开通**）：

- DeepSeek API 调用额度  
- 云主机 / 对象存储 / 带宽  
- 若改用 Supabase：Auth + DB + Realtime 套餐  

回滚：保留上一版 `dist` 与 DB 文件快照；Companion `publicOpen` 保持 false；关闭访客签发或轮换 `MOL_COMPANION_SECRET`。

## 6. 待你确认的操作清单

1. 是否允许创建/付费云主机或 Supabase 项目？  
2. 是否允许将前端发布到 WorkBuddy（仅静态，真人仍受控或关闭）？  
3. 是否允许配置生产 `MOL_*` 密钥与管理员令牌？  
4. 是否允许小范围受邀测试（邀请码），仍禁止公众无限制匹配？  
5. 数据库是否从 SQLite 迁移到托管 Postgres？

确认前：**不公开开放真人聊天服务。**
