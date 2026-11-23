# Milestone 3 技术设计（真人善意响应）

## 1. 环境核查结论

| 能力 | 现状 |
|---|---|
| WorkBuddy | 轻量 HTML 发布，非实时 IM / 鉴权数据库 |
| DeepSeek AI | 本地 Vite 代理已通，M3 保留 |
| 用户认证 / RLS / Realtime 云库 | **当前工程未接入任何云数据库** |
| 正式公网陌生人聊天 | **不开放**，直至权限与防滥用验收通过 |

## 2. 本轮实施方案（受控试点）

在**不擅自开通付费云资源**的前提下，新增本机/局域网可运行的 Companion 服务：

- 服务端签发访客身份（HMAC token，**不接受客户端自填 userId 作为授权**）
- SQLite（Node `node:sqlite`）持久化请求/申请/会话/消息/举报阻止
- WebSocket 推送 + REST 写入
- 匹配确认使用 SQL 条件更新（原子占位）

跨设备：两台设备访问同一主机（`127.0.0.1` 或局域网 IP）即可真实互通。

标记：`companion.kind = 'live-controlled'`（受控试点，非公网开放）。

## 3. 逻辑状态机

`AI_ONLY → REQUEST_OPEN → APPLICATION_PENDING → REQUEST_ACCEPTED → HUMAN_CONNECTED → (HUMAN_LEFT | SESSION_ENDED)`  
旁路：`REQUEST_CANCELLED` / `REQUEST_EXPIRED`

约束：同一请求同一时刻最多确认一位陪伴者。

## 4. 需要你确认的云变更清单（未执行）

若后续要换成托管云，可选其一（**尚未创建**）：

1. **Supabase**：Auth 匿名登录 + Postgres + RLS + Realtime  
2. **腾讯云开发 / 自建 Node**：HTTPS + WSS + 托管数据库  

确认前不会创建云项目、付费实例或正式发布。

## 5. 公网开放门槛

在完成：会话 ACL、第三方越权拒绝、并发占位、举报阻止服务端生效、基本限流验收前，  
**禁止**将真人匹配对公众无限制开放。
