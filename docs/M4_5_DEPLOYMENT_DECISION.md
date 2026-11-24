# 此刻有光｜M4.5 部署决策报告

**日期：** 2026-11-23  
**范围：** 部署架构核查、最小可运行生产入口、受控试运行准备  
**约束：** 未购买/激活付费云；未改 `publicOpen`；未正式发布；未写入真实生产密钥  

---

## 1. 当前真实前后端架构

### 前端

- Vite + React 19 + TypeScript + Tailwind 4
- 路由：`/` `/start` `/chat` `/kindness` `/feedback`
- AI：`LiveAIService` → `POST /api/ai/chat`（密钥永不进浏览器）
- 真人：`CompanionContext` + `/api/companion/*`；WebSocket `/api/companion/ws`；**4s 轮询兜底**
- 跨域准备（本轮）：`VITE_MOL_API_BASE`（可空=同源）

### 后端（实际形态）

| 项 | 事实 |
|---|---|
| 框架 | **不是** Express/Fastify；是 **Vite 插件中间件**（dev）+ **本轮新增** `server/prodServer.ts`（prod） |
| 运行时 | **Node.js ≥ 22**（使用 `node:sqlite`；本机实测 v26） |
| DeepSeek 调用层 | `server/aiHandler.ts` → OpenAI 兼容 `POST {MOL_AI_BASE_URL}/chat/completions` |
| 实时通道 | **原生 WebSocket**（依赖 `ws`），路径 `/api/companion/ws`；**不是** Socket.IO / SSE |
| 数据库 | **SQLite 文件**（`node:sqlite` / `DatabaseSync`），默认 `./data/companion.sqlite`，启动时 `CREATE TABLE IF NOT EXISTS` |
| 身份鉴权 | `server/companion/auth.ts` HMAC 访客 token（Bearer）；**不接受**客户端自填 userId 作为授权 |
| 内存态 | WebSocket 连接表（`hub.ts`）、AI/消息限流桶在进程内存；**匹配与消息主体在 SQLite** |
| 旧脚本 | `server/standalone.mjs` **仅 AI**，无 Companion/WS/SQLite → **不能**当完整生产入口 |

### 本轮补齐的部署缺口

此前 **仅 `npm run dev` 能跑通完整栈**（Vite `configureServer` 不进入常规生产）。  
现已提供：

- `npm run start` → `tsx server/prodServer.ts`
- `/healthz`、SIGINT/SIGTERM 优雅关闭、WS ping 心跳
- `MOL_COMPANION_INVITE_CODE` **服务端**邀请码闸门
- `.env.production.example`、`Dockerfile`（备选容器）

---

## 2. 现有后端是否可以直接部署？

| 问题 | 结论 |
|---|---|
| 把现有仓库原样丢上 WorkBuddy？ | **否**（静态发布，无常驻 Node / SQLite / WSS） |
| 仅跑 `standalone.mjs`？ | **否**（缺真人通道） |
| 仅跑 `vite preview`？ | **否**（Companion/AI 插件挂在 `configureServer`，生产 preview 不完整） |
| 构建后跑 `npm run start`（单机/单容器）？ | **是** — 这是与现有代码匹配的最小路径 |

**限制（部署时必须接受）：**

1. **单实例**：内存 WS hub / 限流桶不跨进程共享；水平扩展会错乱。  
2. **SQLite 需持久磁盘**；容器无 volume 则重启丢库。  
3. 邀请码 ≠ 实名认证 ≠ 年龄核验。  

---

## 3. 方案比较与推荐

### 方案 A：WorkBuddy 静态前端 + 腾讯云 CloudBase 后端

依据官方文档（CloudBase 云托管支持容器/函数型 WebSocket；空闲约 60s 需心跳；计费并入云开发资源点/套餐，个人版刊例约 ¥19.9–39.9/月起，免费体验 3000 资源点/月——**以控制台为准**）：

| 因素 | 评估 |
|---|---|
| 复用现有代码 | 需容器化跑 `prodServer`；函数型需改适配，**不推荐大改** |
| HTTPS/WSS | 支持（文档明确 WSS） |
| 实时双向 | 支持；需心跳（本轮 prodServer 已 15s ping） |
| DB 持久化 | SQLite 要挂卷；多实例不安全；理想应迁库（超本轮最小改动） |
| 密钥托管 | 环境变量可行 |
| 国内访问 | 好 |
| 复杂度 | 中高（CloudBase 环境 + 容器 + 可能分域 CORS） |
| 费用 | 云开发套餐/资源点 + DeepSeek；常驻实例可能快速耗尽免费点 |

### 方案 B：兼容现有后端的托管（推荐主路径细化）

**B1 主推荐：腾讯云轻量应用服务器（Lighthouse）单机同源跑 `prodServer`**

| 因素 | 评估 |
|---|---|
| 复用代码 | **最佳**：几乎零重构 |
| HTTPS/WSS | Nginx/Caddy 反代即可同源 |
| 实时 | 原生 WS，无网关 60s 限制（相对 CloudBase 网关） |
| DB | 本地磁盘 SQLite + 定期备份 |
| 密钥 | systemd EnvironmentFile / 主机 env |
| 国内访问 | 内地地域好 |
| 复杂度 | **最低** |
| 费用 | 官方入门型约 **¥35–40/月** 起（2C2G；以购买页为准）+ DeepSeek |

**B2 备选：WorkBuddy 静态 + 同一 `prodServer` 部署在 Lighthouse/CloudBase 容器（分域）**

- 需配置 `VITE_MOL_API_BASE` + `MOL_CORS_ORIGINS`
- WSS 跨域更易踩坑；仅当必须用 WorkBuddy 域名展示时采用

### 推荐结论

| 角色 | 方案 |
|---|---|
| **主方案** | **腾讯云轻量应用服务器** 单机：`build` + `start`，Nginx HTTPS 同源；受控邀请码试运行 |
| **备选** | WorkBuddy 只发静态宣传页 + CloudBase **容器型**云托管跑同一镜像（单实例 + 数据卷） |

**不推荐** 11/30 前把后端重写成 CloudBase 云函数/云数据库以「原生 CloudBase」——改动面大，超出最小路径。

---

## 4. 最小部署配置（主方案）

### 1) 前端构建与发布

```bash
npm ci
npm run lint && npm test && npm run build
# 同源：不要设置 VITE_MOL_API_BASE
```

产物：`dist/`。主方案由 `prodServer` **直接托管**，不必先上 WorkBuddy。

### 2) 后端启动

```bash
# 主机安装 Node ≥ 22
export $(grep -v '^#' .env.production | xargs)   # 或 systemd EnvironmentFile
npm run start    # 监听 PORT（默认 8788）
```

### 3) 数据库

- 文件：`MOL_COMPANION_DB`（默认 `./data/companion.sqlite`）
- 迁移：进程启动自动 `migrate()`，无独立迁移工具
- 备份：定时拷贝 sqlite + `-wal`/`-shm`（或 `sqlite3 .backup`）

### 4) 环境变量（仅名称）

见 `.env.production.example`：

`PORT` `MOL_HOST` `MOL_AI_API_KEY` `MOL_AI_BASE_URL` `MOL_AI_MODEL` `MOL_AI_TIMEOUT_MS` `MOL_AI_MAX_OUTPUT_TOKENS` `MOL_COMPANION_SECRET` `MOL_COMPANION_DB` `MOL_COMPANION_ADMIN_TOKEN` `MOL_COMPANION_INVITE_CODE` `MOL_CORS_ORIGINS`（可选）`VITE_MOL_API_BASE`（构建期，可选）

### 5) URL

同源示例：

- 页面：`https://your.domain/`
- API：`https://your.domain/api/ai/*`、`/api/companion/*`
- WS：`wss://your.domain/api/companion/ws?token=…`
- 健康：`GET /healthz`

分域时：页面在 WorkBuddy；API/WS 在后端域名；构建写入 `VITE_MOL_API_BASE`。

### 6) HTTPS / CORS

- 主方案：Caddy/Nginx 终止 TLS，反代到 `127.0.0.1:8788`；**CORS 留空**
- 分域：设置 `MOL_CORS_ORIGINS` 为 WorkBuddy 源

### 7) 身份与权限

- 访客 HMAC；会话 ACL；管理员 `X-Mol-Admin-Token`
- 试运行：`MOL_COMPANION_INVITE_CODE` 未通过则 **403**，无法签发 token（非藏前端按钮）

### 8) 健康检查 / 日志 / 排障

- `GET /healthz` → `ok` + `publicOpen:false` + `inviteRequired`
- 日志：stdout（systemd/journald 或容器日志）
- 排障顺序：healthz → ai/status → companion/status → 邀请码 → WS upgrade

### 9) 环境隔离

- 开发：本机 `.env` + `npm run dev` + 独立 sqlite
- 试运行：独立主机/目录、`MOL_COMPANION_SECRET` / invite / DB 与开发隔离
- **禁止** 开发库直接当生产库

### 10) 回滚

1. 停服务；恢复上一版 `dist` + 代码 tag  
2. 恢复 sqlite 备份  
3. 轮换 `MOL_COMPANION_SECRET`（使旧 token 失效）  
4. 保持 `publicOpen=false`；必要时清空 invite 暂停准入  

---

## 5. 受控试运行方案

### 准入（服务端）

1. `publicOpen` **硬编码 false**（status 接口）。  
2. 设置 `MOL_COMPANION_INVITE_CODE`；错误码无法 `auth/guest`。  
3. 成年勾选仍保留，但文案与报告均声明：**不是年龄核验**。  
4. **缺失能力（必须写明）：** 无实名/手机号/校园统一身份；邀请码可被转发分享 → 只能做到「知码准入」，做不到「可信身份认证」。  
5. 因此：**可做邀请制双人验收**；**不可宣称已具备可信身份认证后的公众匹配。**

### 运营规则

- 线下发放邀请码给明确授权的成年测试者（书面确认）  
- UI 保持「受控试点」标记；不展示虚假在线人数  
- 保留举报 / 阻止 / 结束  
- 试运行数据保留期建议 ≤ 14 天，到期删除 sqlite（需人工执行；**尚无自助删除 API**）  

若你要求「必须可信身份才能开真人」——**当前缺失 OAuth/校园登录**，应继续关闭真人公网入口，仅演示 AI 或本地双机。

---

## 6. 上线安全检查（试运行 vs 公开）

| 检查项 | 试运行 | 公开陌生人匹配 |
|---|---|---|
| A/B/C 权限隔离 | 通过（API/单测） | 通过但需 HTTPS 生产再验 |
| 并发匹配原子性 | 通过 | 通过（单实例） |
| 阻止关系服务端有效 | 通过 | 通过 |
| 举报处理流程 | API 有；需人工值班 | **Blocker：缺值班 SLA** |
| 请求/消息限流 | 基础通过 | 公网建议边缘限流 |
| 管理 API 不开放给普通人 | 通过（无 token 拒绝） | 通过 |
| 私聊不默认公开 | 通过 | 通过 |
| AI 危机提示与响应池分流 | 通过 | 危机 SOP 仍弱 |
| 结束后不能发消息 | 通过 | 通过 |
| 数据保留/删除策略 | **弱（人工删库）** | **Release Blocker** |
| 年龄核验 | **未通过（仅声明）** | **Release Blocker** |
| 可信身份准入 | **未通过（仅邀请码）** | **Release Blocker** |
| HTTPS 生产部署 | 未执行（待授权） | **Release Blocker** |

**公开匹配 Release Blockers：** 年龄核验、可信身份、HTTPS 生产、数据删除策略、危机运营 SOP、多实例/备份方案未达标。

---

## 7. 需要你授权的云端操作（暂停等待确认）

1. 购买/开通 **腾讯云轻量应用服务器**（或 CloudBase 付费/免费环境）  
2. 配置域名与 HTTPS 证书  
3. 在主机写入真实 `MOL_*` 密钥与邀请码  
4. 是否发布 WorkBuddy 静态页（及是否分域）  
5. 是否对外部测试者发放邀请码（书面范围）  
6. 是否迁移离 SQLite（超出最小路径，不建议 11/30 前做）  

**确认前不会执行上述操作。**

---

## 8. 完整部署步骤（主方案 · 待授权后执行）

1. 开通 Lighthouse（内地，Node 22+ 镜像或自行安装）  
2. 克隆仓库 → `npm ci` → 配置 `.env.production`（含 invite + secret）  
3. `npm run build && npm run start`（或 systemd）  
4. Nginx/Caddy：`443` → `127.0.0.1:8788`  
5. 验证：`/healthz`、`/api/ai/status`、`/api/companion/status`（`publicOpen:false`，`inviteRequired:true`）  
6. 双用户邀请码验收（见下）  
7. 备份 cron：每日拷贝 `data/`  

---

## 9. 受控双用户验收方案

1. 组织者发放同一邀请码给 A、B；C 无码或不给码。  
2. A：进入 → 开请求；B：申请；A：接受 → 互发 → 结束 → 反馈。  
3. C：无邀请码无法拿到 token；或有 token 也无法读 A/B 会话。  
4. 验证联系方式拦截、结束后禁发、举报写入。  
5. 记录：**自动化通过 ≠ 真机双浏览器通过**；至少用两台设备/两个浏览器配置各验一次。  

---

## 10. 最短可执行路径（11/30 前）

```
本地已完成：prodServer + 邀请码闸门 + env 模板 + 本报告
     ↓ 你确认购买 Lighthouse / 域名
装机 → env → build → start → HTTPS
     ↓
邀请 2–4 人试运行（publicOpen=false）
     ↓
评审演示：AI 主路径 + 受控真人双机
```

**WorkBuddy：** 可选，仅作静态备份入口；**不是**完整后端。  

---

## 附录：本轮代码改动清单

- `server/prodServer.ts`、`npm run start`、`tsx` 依赖、`engines.node>=22`
- `MOL_COMPANION_INVITE_CODE` + GuestGate 邀请码输入
- `src/lib/apiBase.ts` 与 AI/Companion 客户端基址
- `.env.production.example`、`Dockerfile`、`docs/SAFETY.md` / `ARCHITECTURE.md` 更新
- 单测：`server/companion/auth.test.ts`

**未做：** 付费开通、正式发布、`publicOpen=true`、删除数据库、上传真实聊天记录。
