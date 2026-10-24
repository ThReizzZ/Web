# 开发变更日志

本文件记录 threi 项目**已经发生**的开发事实，供维护者追溯修改内容、原因、影响范围和验证结果。

## 维护规则

1. 每次完成一组具有明确边界的开发修改后追加记录，不要等到项目结束才统一补写。
2. 新条目插入到历史条目之前，按完成时间倒序排列。
3. 标题统一使用北京时间（UTC+8）：`## YYYY年MM月DD日 HH时mm分ss秒 主题`。
4. 该格式从 **2026年10月19日 00时48分** 起启用；此前存在的历史条目沿用旧格式，不批量重写。
5. 时间必须来自可信系统时间并换算为 UTC+8，不得编造；无法确定精确秒数时先检查时间来源。
6. 每条必须包含：背景、变更内容、涉及文件、数据库与 API 变化、测试与结果。
7. 文件列表以真实 Git 状态、diff 或实际文件操作为准；没有代码变更时如实说明。
8. 未执行的测试必须写“未执行”，不得把未验证内容写成通过。
9. 发现旧记录事实错误时，新增纠正记录并注明原记录位置，保留历史。
10. 文档修改若影响项目行为或开发规范，也需要记录。

---

## 2026年10月25日 04时23分18秒 用 ThRei_Players 插件替代 A2S/RCON 轮询

### 背景

用户明确要求不再使用 A2S，改用游戏服务器插件上报 `server_players`，并把插件命名为 `ThRei_Players`。此前的 A2S/RCON 轮询要求 API 能访问游戏服务器的 UDP/TCP 端口，RCON 密码还需要明文存储在数据库中；在没有 RCON 时只能得到匿名玩家名，无法获得 SteamID64。

本次改为由游戏服务器主动向 API 上报，API 不再连接游戏服务器。

### 变更内容

- 新增 SourceMod 1.11 插件 `plugins/ThRei_Players/`：
  - 使用 SteamWorks 扩展发送 HTTP POST，不需要开放 A2S/RCON 端口；
  - 每 30 秒（可配置）上报地图、最大人类玩家数、已通过 Steam 认证且非 bot/SourceTV/Replay 的 SteamID64、昵称和连接秒数；
  - 地图开始、玩家认证进入、玩家断开和管理员执行 `sm_threi_report` 时也会触发上报；
  - 配置项 `sm_threi_players_enabled`、`sm_threi_api_url`、`sm_threi_server_id`、`sm_threi_token`（`FCVAR_PROTECTED`）、`sm_threi_interval`（5–600 秒）；
  - 自带 JSON 转义、请求超时、请求中防重入和失败日志；令牌不会输出到 `sm_threi_status` 或日志；
  - 已提供源码、编译后的 `ThRei_Players.smx`、配置示例和中文安装文档。
- 新增 API 插件上报模块 `server_plugin`：
  - `POST /api/v1/plugin/report`，用每服务器令牌认证；
  - 校验 `serverId`、地图、最大玩家数、玩家数量、17 位 SteamID64、昵称长度和连接秒数；
  - 事务内更新服务器快照、删除本次未出现的玩家、upsert 当前玩家并保留已有 `connected_at`；
  - `/api/v1/admin/servers/{id}/plugin-token` 支持读取、生成/轮换、撤销令牌；令牌由 UUID v4 生成 32 位十六进制字符串，列表和公开接口不返回；
  - 后台任务每 30 秒清理超过 90 秒未上报的插件服务器：标记离线、人数清零、删除在线名单，`maintenance` 状态保持不变。
- 管理面板服务器管理改为插件工作流：
  - 移除“立即检测”和 RCON 密码弹窗；
  - 新增插件状态（`disabled` / `waiting` / `connected`）、最近上报时间和“插件配置”弹窗；
  - 弹窗可编辑上报地址、复制配置、生成/轮换/撤销令牌，并提示使用 HTTPS；
  - 玩家列表显示 SteamID64；新建服务器默认离线，等待插件首次上报；
  - 踢出/封禁仍只写入待执行队列，界面明确提示插件尚不执行游戏内操作。
- 删除 A2S/RCON 客户端、后台轮询任务、`server_monitor` 配置和 Compose 中相关环境变量。
- 更新 README、API、架构、部署、CHANGELOG、环境变量示例和本地开发说明。

### 涉及文件

- `plugins/ThRei_Players/README.md`（新增）
- `plugins/ThRei_Players/cfg/sourcemod/threi_players.cfg.example`（新增）
- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`（新增）
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`（新增，已编译）
- `services/api/migrations/20261025070000_server_plugin_reports.sql`（新增）
- `services/api/src/modules/server_plugin.rs`（新增）
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/servers.rs`（仅检查，查询无需改动）
- `services/api/src/modules/mod.rs`
- `services/api/src/routes/mod.rs`
- `services/api/src/app.rs`
- `services/api/src/main.rs`
- `services/api/src/config/mod.rs`
- `services/api/src/infrastructure/mod.rs`
- `services/api/src/openapi.rs`
- `services/api/Cargo.toml`（utoipa 启用 `chrono` feature）
- `services/api/src/infrastructure/a2s.rs`（删除）
- `services/api/src/infrastructure/rcon.rs`（删除）
- `services/api/src/modules/server_monitor.rs`（删除）
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/services/content.ts`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `apps/web/src/features/servers/data/servers.ts`
- `.env.example`、`compose.yaml`、`services/api/.env.example`
- `README.md`、`docs/API.md`、`docs/ARCHITECTURE.md`、`docs/CHANGELOG.md`、`docs/DEPLOYMENT.md`、`docs/DEVELOPMENT.md`

### 数据库与 API 变化

- 迁移 `20261025070000_server_plugin_reports`：
  - `servers.last_queried_at` 重命名为 `last_reported_at`；
  - 新增 `servers.plugin_token`（可空、32–128 字符、非空时唯一）；
  - 删除 `servers.rcon_password`、`servers.query_error`；
  - 把旧轮询写入的服务器快照重置为离线（保留 `maintenance`），清空人数和最近上报时间；
  - 删除旧 A2S/RCON 玩家记录，删除 `server_players.source`、`slot`、匿名槽位索引和来源约束，恢复 `steam_id64 NOT NULL`。
- `POST /api/v1/plugin/report`：请求字段 `serverId`、`map`、`maxPlayers`、`players[].steamId64`、`name`、`connectedSeconds`；成功返回 `serverId`、`playerCount`、`skipped`、`reportedAt`。错误令牌/服务器统一 401，字段非法 422。
- `GET /api/v1/admin/servers`：新增 `lastReportedAt`、`pluginState`，玩家返回 `steamId64`；移除 `lastQueriedAt`、`queryError`、`rconState`、`source`、`slot`。
- `GET/POST/DELETE /api/v1/admin/servers/{id}/plugin-token`：读取（`Cache-Control: no-store`）、生成/轮换、撤销令牌；生成和撤销会清空在线快照并标记离线（`maintenance` 保留）。
- 删除 `POST /api/v1/admin/servers/{id}/query`、`PUT /api/v1/admin/servers/{id}/rcon-password`；`POST /api/v1/admin/servers` 不再接受 `rconPassword`。
- 移除环境变量 `SERVER_MONITOR_ENABLED`、`SERVER_POLL_INTERVAL_SECS`、`SERVER_QUERY_TIMEOUT_SECS`。
- 升级影响：旧轮询快照已清空，现有服务器（当前为 `id=1`）在生成令牌并安装插件前保持离线；旧 A2S 匿名玩家不再展示。

### 测试与结果

- `./scripts/check.sh`：通过。
  - `cargo fmt --all -- --check` 通过；
  - `cargo clippy --all-targets -- -D warnings` 通过；
  - `cargo test`：18 个单元测试、14 个 HTTP 契约测试全部通过；
  - `npm run typecheck`、`npm run lint`、`npm run format:check` 通过。
- `npm run build`：通过，`/servers`、`/admin/servers` 等路由成功生成。
- SourceMod 插件使用 `spcomp64`（SourcePawn Compiler 1.11.0.6970）编译通过，无 warning；产物 `ThRei_Players.smx` 已生成（Code 13092 bytes，Data 137656 bytes）。
- 已执行 `cargo run --bin migrate`，迁移 `20261025070000` 落库；`servers`、`server_players` 新约束和索引已确认。
- 使用临时服务器 `plugin-e2e-test` 和 curl 验证上报：
  - 正确令牌上报 2 名玩家返回 200，数据库地图/人数/最近上报时间更新；
  - 第二次只上报 1 名玩家后，旧玩家被删除，仍在线的玩家 `connected_at` 保持不变；
  - 错误令牌返回统一 401；地图超过 128 字符返回 422；
  - 上报 200 字中文昵称返回 200，数据库昵称被截断为 80 字符并以省略号结尾，满足 `server_players.display_name` 的 CHECK 约束。
- 创建临时管理员会话验证管理 API：
  - `GET /admin/servers` 返回 `pluginState=connected` 和玩家 SteamID64；
  - `GET .../plugin-token` 返回令牌并带 `Cache-Control: no-store`；
  - `POST .../plugin-token` 生成新令牌，服务器状态重置为 offline、名单清空；
  - `DELETE .../plugin-token` 返回 204。
- 清理验证：把 `last_reported_at` 改为 2 分钟前，后台清理任务将临时服务器标记为 `offline`、人数 0、名单 0；临时服务器和管理员会话已删除。
- 重启 API 后 `/health/ready` 正常，`/api/v1/servers` 返回 200；`/servers` 页面 HTML 正常渲染，`/admin/servers` 在管理员会话下 HTML 包含“插件配置”和“未接入插件”。
- 未执行：
  - 没有真实的 Source 游戏服务器可安装 SourceMod/SteamWorks，因此未在真实服务器上加载 `ThRei_Players.smx` 或验证插件实际 HTTP 请求；
  - 未在浏览器中完整点击“插件配置”弹窗的生成/复制/撤销流程（仅验证 SSR HTML 和对应管理 API）；
  - 未执行 Docker Compose 构建/启动（本机无 Docker daemon）；
  - 踢出/封禁的游戏内执行仍未实现，插件只上报状态和玩家。

---

## 2026年10月25日 03时56分15秒 接入 A2S/RCON 实时检测服务器状态与玩家

### 背景

用户反馈服务器目录和玩家列表没有实时数据。此前 `servers.status`、`servers.map`、`servers.player_count` 依赖人工维护，`server_players` 需要外部插件上报，项目中没有轮询游戏服务器的逻辑。

参考 LumiAdmin 的实现方式阅读了 A2S/RCON 相关代码（仅阅读下载源码，未执行）：A2S_INFO/A2S_PLAYER 可在无凭据时取得在线状态、地图、玩家数与匿名玩家名；RCON `status` 可进一步取得 SteamID64。使用实际服务器 `124.223.209.55:10001` 验证 A2S 查询可用（地图 `kz_unmake`、1 名玩家）。

### 变更内容

- 新增 Source A2S UDP 客户端：处理 challenge、分片响应、A2S_INFO 与 A2S_PLAYER 解析；玩家查询失败时仍保留服务器信息。
- 新增 Source RCON TCP 客户端：认证、执行 `status`、读取多包响应；解析 `STEAM_1:x:y`、`[U:1:x]` 与 17 位 SteamID64，跳过 Bot 与无法解析的记录。
- 新增后台监控任务：启动时立即检测一次，之后按 `SERVER_POLL_INTERVAL_SECS`（默认 30 秒）轮询启用的服务器，最多 8 个并发；按服务器行锁串行化同一服务器的后台检测与手动检测。
- A2S 优先提供状态/地图/人数/延迟；配置 RCON 密码时优先使用 `status` 的完整玩家名单与 SteamID64。无 RCON 时把匿名玩家写入 `server_players`（`source='a2s'`、`slot`、`steam_id64=NULL`），有 RCON 时写入 `source='rcon'`。
- 公共 `/api/v1/servers` 增加 `playerCount`，在线人数优先取实时人数；前端首页、服务器目录、加入弹窗统一使用实时人数。
- 管理面板服务器卡片显示实时人数、最近检测时间、查询错误与 `RCON 已配置`/`仅 A2S` 徽标；新增“立即检测”和“RCON”操作，RCON 弹窗可设置或清除密码；匿名玩家提示“配置 RCON 后可管理”，不显示无效的踢出/封禁入口。
- 新增配置项 `SERVER_MONITOR_ENABLED`（默认 true）、`SERVER_POLL_INTERVAL_SECS`（10–3600，默认 30）、`SERVER_QUERY_TIMEOUT_SECS`（1–30，默认 3），并接入 Compose 环境变量。

### 涉及文件

- `services/api/migrations/20261025060000_server_live_polling.sql`（新增）
- `services/api/src/infrastructure/a2s.rs`（新增）
- `services/api/src/infrastructure/rcon.rs`（新增）
- `services/api/src/infrastructure/mod.rs`
- `services/api/src/modules/server_monitor.rs`（新增）
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/servers.rs`
- `services/api/src/modules/mod.rs`
- `services/api/src/config/mod.rs`
- `services/api/src/app.rs`
- `services/api/src/main.rs`
- `apps/web/src/features/servers/data/servers.ts`
- `apps/web/src/features/servers/components/server-card.tsx`
- `apps/web/src/features/servers/components/server-list-row.tsx`
- `apps/web/src/features/servers/components/join-server-button.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `apps/web/src/services/content.ts`
- `.env.example`、`compose.yaml`、`services/api/.env.example`
- `README.md`、`docs/API.md`、`docs/DEVELOPMENT.md`

### 数据库与 API 变化

- `servers` 新增 `rcon_password`、`player_count`、`last_queried_at`、`query_error`。
- `server_players.steam_id64` 改为可空；新增 `source`（`report` / `rcon` / `a2s`）与 `slot`；新增 `(server_id, slot) WHERE steam_id64 IS NULL` 唯一索引和来源/身份一致性约束。
- 公共 `GET /api/v1/servers` 返回新增 `playerCount`。
- 管理 `GET /api/v1/admin/servers` 返回 `playerCount`、`lastQueriedAt`、`queryError`、`rconState`；玩家返回 `source`、`slot`，匿名玩家 `steamId64` 为 `null`。API 不返回 RCON 密码原文。
- `POST /api/v1/admin/servers` 支持可选 `rconPassword`；新增 `PUT /api/v1/admin/servers/{id}/rcon-password` 与 `POST /api/v1/admin/servers/{id}/query`。
- RCON 密码明文保存在数据库；踢出/封禁仍只写入管理表，不会通过 RCON 自动执行。

### 测试与结果

- `cargo fmt`：通过。
- `cargo test`：23 个单元测试、14 个 HTTP 契约测试全部通过。
- `cargo clippy --all-targets -- -D warnings`：通过。
- `npm run check`（`next typegen` + `tsc --noEmit` + ESLint + Prettier）：通过。
- 已执行 `cargo run --bin migrate`，迁移版本 `20261025060000` 落库。
- 重启 API 后轮询日志显示 `server monitor started`，首次探测 `source="a2s"`、`players=1`。
- 实测 `124.223.209.55:10001`：`servers` 行为 `online`、地图 `kz_unmake`、`player_count=1`、`max_players=10`、`latency_ms=20`、`last_queried_at` 已更新；`server_players` 写入匿名玩家“冰板栗”（`source='a2s'`、`slot=0`、`steam_id64=NULL`）。
- `GET /api/v1/servers` 返回 `playerCount: 1` 与“冰板栗”；`/servers` 页面 HTML 已渲染该玩家和实时人数。
- 未执行：未配置真实 RCON 密码，因此 SteamID64 解析、管理面板“立即检测”鉴权后的 UI 操作、踢出/封禁未在真实服务器验收；`/admin/servers` 未登录访问按预期 307 跳转。

---

## 2026年10月25日 03时39分31秒 修复局域网访问时管理面板按钮无响应

### 背景

用户反馈在管理面板点击“添加服务器”没有反应。使用本机 Firefox + geckodriver 以 `http://192.168.1.128:3000` 访问并复现：

- 页面 HTML 和样式正常渲染，但按钮 DOM 节点没有 React 内部属性，整个页面未完成 hydration；
- 点击按钮不会打开 Modal，浏览器控制台没有报错；
- Next.js 开发服务器日志出现 `Blocked cross-origin request to Next.js dev resource /_next/hmr from "192.168.1.128"`。

原因是 Next.js 16 开发模式默认阻止非 localhost 来源访问开发资源（`/_next/hmr`），浏览器从局域网地址访问时 HMR/客户端初始化被拦截，导致页面看似正常但客户端组件全部不可交互。此前开发机使用 `192.168.0.101:3100` 时未记录该配置项。

### 变更内容

- `next.config.ts` 新增 `allowedDevOrigins`：从 `NEXT_PUBLIC_SITE_URL` 解析 hostname；当 hostname 不是 `localhost`/`127.0.0.1` 时加入允许列表。
- 保持生产构建不受影响；该配置只在开发服务器生效。
- 未修改任何组件、API 或数据库逻辑。

### 涉及文件

- `apps/web/next.config.ts`
- `docs/DEVELOPMENT.md`

### 数据库与 API 变化

- 无。

### 测试与结果

- `npm run check`（`next typegen` + `tsc --noEmit` + ESLint + Prettier）：通过。
- Firefox + geckodriver（headless，访问 `http://192.168.1.128:3000/admin/servers`）：
  - 修复前：页面无 React root、按钮无 React 属性、点击无反应；
  - 修复后：按钮带有 React 属性，点击“添加服务器”后 `<dialog>` 的 `open=true`、`display=block`，添加服务器弹窗正常显示；
  - 截图确认弹窗包含基本信息、网络与运行状态、展示与访问等表单区块。
- 未提交测试服务器：验证结束后关闭测试会话并撤销登录，未向数据库写入服务器记录。

---

## 2026年10月25日 03时20分15秒 开发环境 Steam 登录校验跳过与局域网回调修正

### 背景

用户反馈 Steam 登录显示“Steam 登录未完成”。排查发现两个独立问题：

1. 开发配置仍使用 `http://localhost:3000` 作为站点 origin 和 Steam 回调地址，但浏览器不在 VM 本机；Steam 授权后回调指向浏览器自己的 `localhost`，无法到达 API，浏览器提示连接被拒绝。
2. 将 origin 改为局域网地址后，回调已能到达 API，但 VM 网络无法访问 `steamcommunity.com`（所有解析 IP 的 80/443 均超时）；`check_authentication` 校验等待 10 秒后失败，API 重定向到 `/account?steam_error=steam_login_failed`。

### 变更内容

#### 1. 开发环境站点 origin 改为局域网地址

- `services/api/.env` 的 `WEB_URL`、`STEAM_RETURN_URL`、`STEAM_REALM` 改为 `http://192.168.1.128:3000`；`CORS_ALLOWED_ORIGINS` 同时允许 `localhost`、`127.0.0.1` 与该地址。
- `apps/web/.env.local` 的 `NEXT_PUBLIC_SITE_URL` 同步修改。
- 两个文件均被 Git 忽略，不提交。

#### 2. 新增仅开发环境可用的 OpenID 校验跳过开关

- `AuthSettings` 新增 `steam_skip_openid_verification`，读取 `STEAM_SKIP_OPENID_VERIFICATION`。
- 该开关为 true 且 `APP_ENV` 不是 `development` 时，配置加载直接返回错误，API 拒绝启动。
- 开关启用时：
  - 回调不再请求 `steamcommunity.com/openid/login` 的 `check_authentication`；
  - 每次回调输出 WARN 日志，包含 SteamID64；
  - 昵称与头像使用本地回退值（`Steam 用户 <后6位>`、无头像），避免 profile 请求再次等待 10 秒超时。
- `.env.example` 增加变量说明（默认 `false`）；README 本地开发章节补充使用说明和风险提示。

### 涉及文件

- `services/api/src/config/mod.rs`
- `services/api/src/modules/auth/mod.rs`
- `services/api/.env`（Git 忽略）
- `apps/web/.env.local`（Git 忽略）
- `.env.example`
- `README.md`
- `docs/DEVELOPMENT.md`

### 数据库与 API 变化

- 无新迁移。
- API 路由与响应结构不变；仅回调在开关启用时改变校验行为。
- 数据库新增管理员用户 `76561199125125759`（`role=admin`），由模拟回调创建；验证会话已通过 `/auth/logout` 撤销。

### 测试与结果

- `cargo fmt --all`：通过。
- `cargo clippy --all-targets -- -D warnings`：通过。
- `cargo test`：单元测试 12 项、HTTP 合约测试 14 项，共 26 项，全部通过；新增开发环境跳过开关配置测试。
- 端到端（开发环境、开关开启）：
  - 通过 `http://192.168.1.128:3000/api/v1/auth/steam/callback` 模拟回调，返回 303 到 `/account` 并写入 `threi_session` Cookie；
  - `/api/v1/auth/me` 返回 `role=admin`；
  - `/api/v1/admin/overview` 返回 200；
  - 日志出现跳过校验 WARN；
  - `/auth/logout` 返回 204，之后 `/auth/me` 返回 `null`。
- 开启开关后的真实浏览器 Steam 登录：未执行，需要人工点击“使用Steam登录”完成验收。

---

## 2026年10月24日 22时42分06秒 弹窗内容重排与关闭按钮遮挡修复

### 背景

用户反馈 Modal 内部比例、布局和样式不好看；鼠标悬停右上角关闭按钮时会有一个元素显示不全、被遮挡。

### 变更内容

#### 1. Modal 结构重做

- Modal 改为固定头部 + 可滚动内容区 + 固定底部操作栏：
  - 头部显示标题、描述和关闭按钮；
  - 内容区单独滚动，长表单不会把弹窗撑出视口；
  - 底部操作栏固定，提交/取消按钮始终可见。
- 调整尺寸档位：`sm` 26rem、`md` 36rem、`lg` 48rem、`xl` 64rem；不再使用过宽或过窄的临时宽度。
- 关闭按钮改为原生 `title` 提示，移除自定义 Tooltip，避免弹窗打开时自动聚焦触发悬浮元素或在弹窗边缘被裁切。

#### 2. 表单内容重新布局

- 新增管理员：
  - SteamID64 查询保留；
  - 生产管理员数量提醒改为 Alert；
  - 提交按钮移到 Modal 底部栏。
- 新增封禁：
  - 警告、玩家信息、时长、原因分区；
  - 移除正文中重复的提交按钮，只保留底部栏的“创建封禁”。
- 手动添加白名单：
  - 服务器、SteamID64、昵称分区；
  - 底部栏提交。
- 添加服务器：
  - 内容拆为“基本信息 / 网络与运行状态 / 展示与访问”三组；
  - 描述、网络字段、推荐/白名单选项分组展示；
  - 底部栏提交。
- ConfirmDialog/ReasonDialog 使用同一 Modal 头部、内容、底部结构。

#### 3. 其他弹窗交互

- ConfirmDialog 继续用于删除服务器、移除白名单、解封、删除管理员、论坛删除等操作。
- Toast 继续用于操作结果提示。
- 白名单“需要白名单”徽章保留 Tooltip 说明；关闭按钮不再使用自定义 Tooltip。

### 涉及文件

- `apps/web/src/components/ui/modal.tsx`
- `apps/web/src/components/ui/confirm-dialog.tsx`
- `apps/web/src/components/ui/reason-dialog.tsx`
- `apps/web/src/components/ui/tooltip.tsx`
- `apps/web/src/features/admin/components/admin-accounts-manager.tsx`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `apps/web/src/features/admin/components/whitelist-manager.tsx`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `docs/DEVELOPMENT.md`
- `docs/CHANGELOG.md`

### 数据库与 API 变化

- 无数据库迁移。
- 无 API 契约变化。

### 测试与结果

- `./scripts/check.sh`：通过；Rust 25 项测试、TypeScript、ESLint、Prettier。
- `npm run build`：通过。
- Playwright 1440/390：
  - 四个表单 Modal 均只有一个提交按钮；
  - 弹窗内页无横向溢出；
  - 关闭按钮悬停不再出现被遮挡的 Tooltip；
  - 添加服务器 Modal 分组布局正常；
  - 管理页面无 console/pageerror。

### 待办与风险

- 部分原因输入仍使用浏览器 prompt，后续可迁移到 ReasonDialog。
- 游戏服务器实际踢出/封禁仍需插件消费 `server_actions`。


---

## 2026年10月24日 22时33分39秒 管理表单改为 Modal 并补齐 Toast/确认/Tooltip

### 背景

用户认为新增管理员、添加服务器、新增封禁、手动添加白名单在页面内展开表单不优雅，要求改为 Modal 模拟弹窗，并在网站其他合适位置使用 Tooltip、Toast、Alert、Popconfirm、Modal 等交互。

### 变更内容

#### 1. 通用弹窗与反馈组件

新增：

- `components/ui/modal.tsx`：原生 `<dialog>` Modal，支持遮罩、Esc、关闭按钮、标题/描述、滚动内容区和尺寸档位。
- `components/ui/confirm-dialog.tsx`：基于 Modal 的危险操作确认弹窗，内置 Alert 提示。
- `components/ui/toast.tsx`：管理面板 ToastProvider 和 `useToast`，固定右上角、自动消失、最多保留 4 条。
- `components/ui/tooltip.tsx`：轻量悬停 Tooltip，用于 Modal 关闭按钮等场景。

`(admin)/layout.tsx` 增加 `ToastProvider`，所有管理页面共享 Toast。

#### 2. 四个表单改为 Modal

- 新增管理员：
  - 保留 SteamID64 查询下拉框；
  - 选择玩家后点击添加；
  - 表单移入 Modal。
- 新增封禁：
  - 表单移入 Modal；
  - 显示管理员账号不可直接封禁的 Alert。
- 手动添加白名单：
  - 表单移入 Modal；
  - 显示游戏服务器插件执行拦截的 Alert。
- 添加服务器：
  - 大尺寸 Modal，字段网格布局；
  - 移动端弹窗内部滚动，不撑破页面。

点击页面右上角按钮打开弹窗；提交成功后关闭并 Toast 提示。

#### 3. 其他交互动效

- 管理操作原有内联反馈改为 Toast，不再在页面顶部追加反馈条。
- 删除管理员、移除白名单、解除封禁、删除服务器、删除论坛主题/回复改为 ConfirmDialog。
- 白名单通过/拒绝改为带审核备注的 Modal，不再使用浏览器 `prompt`。
- Modal 关闭按钮增加 Tooltip。
- ConfirmDialog 和部分表单增加 Alert 说明。
- 修复 Modal 打开时关闭按钮自动聚焦导致 Tooltip 立即显示的问题。

### 涉及文件

- `apps/web/src/components/ui/modal.tsx`（新增）
- `apps/web/src/components/ui/confirm-dialog.tsx`（新增）
- `apps/web/src/components/ui/toast.tsx`（新增）
- `apps/web/src/components/ui/tooltip.tsx`（新增）
- `apps/web/src/app/(admin)/layout.tsx`
- `apps/web/src/features/admin/components/admin-accounts-manager.tsx`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `apps/web/src/features/admin/components/whitelist-manager.tsx`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `apps/web/src/features/admin/components/forum-moderation-manager.tsx`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/DEVELOPMENT.md`

### 数据库与 API 变化

- 无数据库迁移。
- 无 API 契约变化。
- 仅调整管理面板前端交互。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 11 项、HTTP 合约测试 14 项，共 25 项通过；
  - TypeScript、ESLint、Prettier、Clippy、rustfmt 通过。
- `npm run build`：通过。
- Playwright 实测：
  - 四个新增表单均以 `dialog[open]` 打开，页面不再出现内联表单；
  - 1440 和 390 宽度下弹窗打开无页面横向溢出；
  - 添加服务器成功后弹窗关闭并出现 Toast；
  - 删除服务器弹出 ConfirmDialog，确认后删除成功；
  - 管理页面无 console/pageerror，无 hydration mismatch；
  - Modal 关闭按钮 Tooltip 仅在悬停时显示。
- 临时管理员会话和测试服务器已清理。当前数据库：1 位真实管理员、1 篇官方指南、0 个服务器。

### 待办与风险

- 部分原因输入（如踢出原因、服务器封禁原因、禁言原因）仍使用浏览器 prompt；后续可继续迁移为统一 ReasonDialog。
- 游戏服务器实际踢出/封禁仍需插件消费 `server_actions`。
- 本轮只调整前端交互，未新增业务权限；管理 API 继续执行管理员校验。


---

## 2026年10月24日 20时48分45秒 管理表单重设计、论坛管理与服务器管理

### 背景

用户要求：

1. 重新设计新增管理员、新增封禁、手动添加白名单三个表单，保留管理员 SteamID64 查询下拉框；
2. 管理面板增加论坛管理：主题/回复编辑、删除、禁言、论坛用户封禁等；
3. 管理面板增加服务器管理：服务器添加/删除、在线玩家踢出/封禁等；
4. 改善整体排版，避免表格和表单拥挤。

### 变更内容

#### 1. 表单重设计

- 新增管理员、新增封禁、手动添加白名单改为**可折叠表单**：
  - 默认突出列表；
  - 点击页面右上角按钮展开；
  - 表单采用居中卡片、分区字段和统一的主按钮。
- 管理员表单保留 SteamID64 查询下拉框，选择玩家后再添加。
- 封禁表单使用 SteamID64/昵称、时长、原因分区。
- 手动白名单表单使用服务器、SteamID64、昵称分区。
- 提交成功后自动收起表单并刷新列表。

#### 2. 论坛管理

新增 `/admin/forum` 与 `forum_admin` API：

- 主题：
  - 编辑标题、摘要、正文、分类、标签、置顶、热门；
  - 软删除与恢复。
- 回复：
  - 编辑正文；
  - 软删除与恢复。
- 用户：
  - 查看角色、登录/禁言/封禁状态；
  - 禁言与解除禁言（可设置时长与原因）；
  - 永久封禁（复用网站封禁，撤销会话并阻止登录）；
  - 管理员账号不提供禁言/封禁操作。
- 页面使用“主题 / 回复 / 用户”标签页，保持单列列表布局。

#### 3. 服务器管理

新增 `/admin/servers` 与 `server_admin` API：

- 添加服务器（ID、名称、地图、Host/IP、端口、地区、Tickrate、最大人数、状态、标签、图片、推荐、白名单）；
- 删除服务器（级联其在线玩家、白名单、服务器封禁和指令）；
- 启用/停用服务器；
- 查看在线玩家；
- 对在线玩家提交踢出指令；
- 对在线玩家执行服务器封禁；
- 查看服务器封禁并解封。
- 新增 `server_actions` 队列，供游戏服务器插件消费踢出/封禁指令。
- 当前数据库没有服务器和玩家，页面显示空状态；实际游戏内执行仍依赖插件。

#### 4. 布局与稳定性

- 管理导航新增“论坛管理”“服务器管理”。
- 运营概览新增论坛管理和服务器管理快捷入口。
- 客户端管理列表时间改为稳定绝对时间，修复 React hydration text mismatch。
- 管理员、封禁、白名单、论坛、服务器页面在 1440 和 390 宽度下无页面横向溢出。

### 涉及文件

- `services/api/migrations/20261024010000_forum_server_moderation.sql`（新增）
- `services/api/src/modules/forum_admin.rs`（新增）
- `services/api/src/modules/server_admin.rs`（新增）
- `services/api/src/modules/mod.rs`
- `services/api/src/routes/mod.rs`
- `services/api/tests/http_contract.rs`
- `apps/web/src/features/admin/components/forum-moderation-manager.tsx`（新增）
- `apps/web/src/features/admin/components/server-admin-manager.tsx`（新增）
- `apps/web/src/features/admin/components/admin-accounts-manager.tsx`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `apps/web/src/features/admin/components/whitelist-manager.tsx`
- `apps/web/src/features/admin/components/admin-nav.tsx`
- `apps/web/src/app/(admin)/admin/forum/page.tsx`（新增）
- `apps/web/src/app/(admin)/admin/servers/page.tsx`（新增）
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/services/content.ts`
- `README.md`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

### 数据库与 API 变化

新增迁移 `20261024010000_forum_server_moderation.sql`：

- `forum_mutes`：论坛禁言记录；
- `server_bans`：服务器级封禁；
- `server_actions`：供游戏服务器插件消费的踢出/封禁待处理指令。

新增 API：

- `GET /admin/forum/topics`、`PATCH/DELETE /admin/forum/topics/{slug}`、`POST .../restore`
- `GET /admin/forum/replies`、`PATCH/DELETE /admin/forum/replies/{id}`、`POST .../restore`
- `GET /admin/forum/users`、`POST/DELETE /admin/forum/users/{steam_id64}/mute`
- `GET/POST /admin/servers`
- `PATCH/DELETE /admin/servers/{id}`
- `POST /admin/servers/{id}/players/{steam_id64}/kick`
- `POST /admin/servers/{id}/players/{steam_id64}/ban`
- `POST /admin/server-bans/{id}/lift`

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 11 项、HTTP 合约测试 14 项，共 25 项通过；
  - TypeScript、ESLint、Prettier、Clippy、rustfmt 通过。
- `npm run build`：通过，新增 `/admin/forum`、`/admin/servers` 路由。
- API 实测：
  - 论坛主题编辑、删除/恢复 204；
  - 回复编辑、删除/恢复 204；
  - 禁言/解除禁言成功；
  - 服务器添加/删除 204；
  - 在线玩家踢出 204，玩家从在线列表移除；
  - 服务器封禁 204，封禁记录生效，解封 204；
  - 服务器启停 204；
  - 匿名访问新增管理接口返回 401。
- Playwright 实测：
  - 新增管理员/新增封禁/手动白名单/添加服务器表单可展开，1440 无溢出；
  - 论坛主题通过 UI 编辑成功，论坛用户可通过 UI 禁言；
  - 服务器通过 UI 添加成功；
  - 管理页面 1440/390 全量加载无 console/pageerror，无横向滚动；
  - 修复了此前管理页面 React hydration text mismatch。
- 临时测试用户、主题、回复、服务器、玩家、禁言、封禁、白名单和会话均已清理。
- 当前数据库：1 位真实管理员、1 篇官方指南、0 个服务器、0 条论坛测试内容、0 条封禁/禁言。

### 待办与风险

- 游戏内踢出/封禁需要服务器插件消费 `server_actions` 并读取 `server_bans`；Web 端只写指令和记录。
- 公开论坛发帖/回复写接口仍未开放；当前论坛管理针对已有内容。
- 禁言目前记录在 `forum_mutes`，待发帖接口接入后必须在发帖服务中强制校验。
- 服务器管理当前支持添加、删除、启停和在线玩家操作；完整字段编辑、分类管理和论坛审核工作流仍需后续扩展。


---

## 2026年10月24日 00时43分30秒 管理列表恢复列表式并修复玩家名称截断

### 背景

上一版将管理员、封禁和白名单授权改成了双列卡片。用户反馈卡片式不好看，仍然偏好上一版的列表式布局，但必须解决玩家内容挤在一起、玩家名称显示不全和需要横向滚动的问题。

本次以 00:27:42 的卡片布局为被取代设计；旧记录保留用于追溯。

### 变更内容

#### 1. 恢复列表式布局

- 管理员列表恢复为单列 `divide-y` 列表，不再使用双列卡片。
- 封禁记录恢复为单列列表，每条记录占满整行。
- 白名单“已授权名单”恢复为单列列表。
- 最近注册成员恢复为单列列表。
- 保留表单、待审核申请和服务器白名单设置的现有结构。

#### 2. 解决挤在一起和名称显示不全

- 玩家名称不再使用 `truncate`，改为 `break-words`，长名称完整换行显示。
- SteamID64 使用 `break-all`，长数字不会撑破容器。
- 管理员列表把状态、SteamID64、最近登录、加入时间分到不同行/区块，不再和名称、操作按钮挤在同一行。
- 管理员操作按钮放在独立区域，窄屏自动移动到下一行。
- 封禁列表的玩家信息、封禁原因、期限/解封信息分块展示。
- 白名单授权列表的玩家信息、服务器、授权时间、添加者和移除按钮分行展示。
- 列表项保留清楚的间距和分隔线，避免内容拥挤。
- 移动端管理导航改为自动换行，避免“白名单审核”等入口被裁切或需要横向滚动。

#### 3. 补充玩家头像

- 封禁 API 返回 `avatarUrl`，封禁列表显示玩家头像或首字回退头像。
- 白名单申请与授权记录 API 返回 `avatarUrl`，列表使用真实 Steam 头像或回退头像。
- 管理员列表继续显示真实 Steam 头像。

#### 4. 保留此前的功能

- 管理员新增仍支持 SteamID64 查询下拉框，显示头像、昵称、SteamID64 后选择再添加。
- 服务状态入口和独立区块保持删除状态。
- 管理面板导航保持：概览、管理员、封禁管理、白名单审核。

### 涉及文件

- `apps/web/src/features/admin/components/admin-accounts-manager.tsx`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `apps/web/src/features/admin/components/whitelist-manager.tsx`
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/features/admin/types.ts`
- `services/api/src/modules/bans.rs`
- `services/api/src/modules/whitelist.rs`
- `docs/DEVELOPMENT.md`

### 数据库与 API 变化

- 无数据库迁移变化。
- `GET /api/v1/admin/bans`、创建封禁响应增加 `avatarUrl`。
- `GET /api/v1/admin/whitelist` 的申请与授权记录增加 `avatarUrl`。
- 管理列表不再有宽表格，不需要横向滚动。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 11 项、HTTP 合约测试 14 项，共 25 项通过；
  - TypeScript、ESLint、Prettier、Clippy、rustfmt 通过。
- `npm run build`：通过。
- Playwright 使用临时长昵称数据验证：
  - 1440 宽度下管理员、封禁、白名单长名称完整显示，无页面横向滚动；
  - 390 宽度下列表自动改为单列，名称自动换行，操作按钮移动到底部，无页面横向滚动；管理导航自动换行显示完整入口；
  - 管理员页、封禁页、白名单页、概览均无 console/pageerror。
- 临时管理员、测试用户、测试服务器、测试封禁、白名单申请/授权和临时会话均已清理。
- 当前数据库：1 位真实管理员、1 篇官方指南、0 个服务器、0 条封禁、0 条白名单申请/授权。


---

## 2026年10月24日 00时27分42秒 管理面板去重复、管理员查询与卡片化布局

### 背景

用户反馈：

1. 运营概览和“服务状态”功能重复，要求删除服务状态，服务状态已由概览覆盖；
2. 管理员、封禁管理、白名单审核页面中部分信息需要向右滚动才能看全；
3. 新增管理员输入 SteamID64 后，需要出现包含玩家头像、昵称和 SteamID64 的下拉框，选择后再点击“添加管理员”；
4. 封禁与白名单页面同样不能出现需要横向滚动才能看全的信息；
5. 继续改善管理页面布局和美观度。

### 变更内容

#### 1. 删除重复的“服务状态”

- 管理侧边栏移除“服务状态”项。
- 运营概览移除独立的 `id="status"` 区块、`SystemStatusCard` 和服务器节点卡片。
- 删除未再使用的前端文件：
  - `features/admin/components/system-status-card.tsx`
  - `hooks/use-system-status.ts`
  - `services/system.ts`
- 删除 `types/api.ts` 中的 `SystemInfo` 类型。
- 后端 `/api/v1/system/info` 保留为基础设施接口，但管理面板不再调用；服务器统计继续显示在概览卡片和快捷入口中。

#### 2. 新增管理员查询下拉框

- 新增管理员 API：`GET /api/v1/admin/users/lookup?steamId64=...`
  - 仅管理员可调用；
  - 返回玩家的 SteamID64、昵称、头像、角色、禁用状态；
  - 未找到返回 `{ "user": null }`。
- 管理员页面输入 17 位 SteamID64 后进行 280ms 防抖查询，出现下拉框：
  - 显示头像、昵称、SteamID64；
  - 显示“成员 / 已是管理员 / 已禁用”状态；
  - 点击选择后，在表单中显示已选玩家确认卡片；
  - 点击“添加管理员”才真正提交。
- 未找到已登录玩家时，下拉框提供“选择该 SteamID 创建占位管理员”的选项，保留为未登录用户预建管理员的能力。
- 已是管理员的玩家不能被重复添加；已禁用玩家选中后仍可通过添加/启用流程处理。

#### 3. 列表改为响应式卡片

- 管理员列表从宽表格改为卡片行：
  - 头像、昵称、SteamID64、状态、禁用原因、最近登录、加入时间、操作按钮；
  - 所有信息在卡片内换行展示，不再需要横向滚动。
- 封禁记录从宽表格改为卡片：
  - 玩家、SteamID64、原因、封禁类型、期限、操作者、解封信息和解封按钮；
  - 右侧操作按钮在窄屏自动换行到卡片底部。
- 白名单“已授权名单”从表格改为卡片行：
  - 玩家、SteamID64、服务器、添加时间、添加者、移除按钮；
  - 窄屏自动纵向排列。
- 运营概览“最近注册”也从宽表格改为成员卡片，移除管理面板最后一处需要横向滚动的表格。
- 管理页继续保持“列表优先、表单在下方/右侧”的结构；1440 宽度下列表完整显示，1536 以上表单在右侧。
- 管理主内容增加 `overflow-x-hidden` 和 `min-w-0`，修复移动端页面横向溢出；内部表格不再作为主展示方式。

### 涉及文件

- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/app/(admin)/layout.tsx`
- `apps/web/src/features/admin/components/admin-nav.tsx`
- `apps/web/src/features/admin/components/admin-accounts-manager.tsx`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `apps/web/src/features/admin/components/whitelist-manager.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/services/content.ts`
- `apps/web/src/types/api.ts`
- 删除 `apps/web/src/features/admin/components/system-status-card.tsx`
- 删除 `apps/web/src/hooks/use-system-status.ts`
- 删除 `apps/web/src/services/system.ts`
- `services/api/src/modules/admin_users.rs`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `README.md`

### 数据库与 API 变化

- 无数据库迁移变化。
- 新增 `GET /api/v1/admin/users/lookup`。
- 管理面板不再调用 `/api/v1/system/info`；后端接口保留。
- 管理员、封禁、白名单 API 契约保持不变。
- 当前数据库仍为：1 位真实管理员、1 篇官方指南、0 个服务器、0 条封禁、0 条白名单申请/授权；临时测试数据已清理。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 11 项、HTTP 合约测试 14 项，共 25 项通过；
  - TypeScript、ESLint、Prettier、Clippy、rustfmt 通过。
- `npm run build`：通过；管理面板路由为 `/admin`、`/admin/admins`、`/admin/bans`、`/admin/whitelist`。
- API 实测：
  - `/admin/users/lookup` 对存在的玩家返回头像信息，对未知 SteamID64 返回 `user:null`；
  - 匿名管理员接口仍返回 401。
- Playwright 实测：
  - 概览和侧边栏不再出现“服务状态”；
  - 输入临时玩家 SteamID64 后出现含昵称/SteamID64 的下拉项，选择后添加管理员成功；
  - 管理员列表、封禁记录、白名单授权均以卡片完整展示，1440 和 390 宽度无页面横向滚动；
  - 管理页面无 console/pageerror。
- 临时管理员、测试服务器、临时封禁、白名单申请、临时会话均已清理；未执行真实游戏服务器插件、Docker、HTTPS 验证。


---

## 2026年10月24日 00时03分08秒 管理面板：管理员、封禁与白名单功能

### 背景

用户要求：

1. 将 SteamID64 `76561198298405388` 设为管理员；
2. 删除运营概览里的“真实数据 / 页面数据来自 PostgreSQL / 管理员由 ADMIN_STEAM_IDS 配置”提示；
3. 管理面板新增管理员管理，支持新增、删除（取消管理员）、禁用/启用，生产环境不能只有一位管理员；
4. 新增封禁管理，对违规玩家封禁、解封；
5. 新增白名单审核，管理需要白名单的服务器、审核申请、授权/移除玩家；
6. 合理规划布局并改善页面美观度。

### 变更内容

#### 1. 管理员与权限

- 本地数据库已将 `76561198298405388` 的 `users.role` 更新为 `admin`；本地 `services/api/.env` 的 `ADMIN_STEAM_IDS` 已包含该 ID（文件被 Git 忽略，不提交）。
- `ADMIN_STEAM_IDS` 现在只用于首次创建/引导管理员。登录 upsert 改为保留数据库中的角色，不会在每次登录时覆盖管理面板修改。
- 新增 `users.is_disabled`、`disabled_at`、`disabled_reason`：
  - 禁用管理员后立即删除其所有会话；
  - 禁用用户不能登录；
  - 启用只恢复登录资格，不自动创建会话。
- 管理员不能取消/禁用自己；最后一位可用管理员不能被取消或禁用。
- 管理面板 `/admin` 布局在服务端再次校验收会话与角色；匿名重定向 `/account`，普通成员重定向首页。
- 顶部导航仍只对管理员显示“管理面板”。

#### 2. 管理员管理页面

新增 `/admin/admins`：

- 列表显示头像、昵称、SteamID64、状态、最近登录、加入时间；
- 新增管理员：输入 SteamID64，支持尚未登录的用户（创建占位账号，首次登录保留管理员角色）；
- 取消管理员：降级为成员并撤销会话；
- 禁用/启用账号；
- 当前账号操作按钮禁用，后端再次保护；
- 页面说明生产环境至少保留两位管理员。

#### 3. 封禁管理

新增 `/admin/bans`：

- 新增 `bans` 表：SteamID64、玩家昵称、原因、到期时间、操作者、解封者、解封原因。
- 创建临时（24h/7d/30d）或永久封禁；
- 封禁后立即撤销目标网站会话；
- 登录与 `/auth/me` 查询会拒绝生效封禁；
- 列表区分生效/已结束，支持解封并保留历史；
- 管理员账号不能直接封禁，必须先在管理员页取消权限。

#### 4. 白名单审核

新增 `/admin/whitelist`、`server_whitelist`、`whitelist_applications`、`servers.requires_whitelist`：

- 管理服务器是否开启白名单；
- 查看待审核申请，填写审核备注后通过/拒绝；
- 通过申请自动写入 `server_whitelist`；
- 手动按 SteamID64 添加白名单；
- 移除已授权玩家；
- 显示服务器授权数、待审核数；
- 用户中心新增“白名单申请”卡片：仅当存在开启白名单的服务器时显示，登录玩家可选择服务器并提交说明；
- 服务器 API 和卡片增加 `requiresWhitelist` 字段/标识；
- 未授权玩家、白名单数据的游戏内拦截仍需要服务器插件读取数据库。

#### 5. 布局与视觉

- 管理侧边栏改为真实路由导航：概览、管理员、封禁管理、白名单审核、服务状态，支持当前页高亮。
- 管理页面统一“列表优先、表单在下方/右侧”的布局；宽屏使用表格，窄屏内部横向滚动，页面本身不横向溢出。
- 表单在 1440 宽度下使用紧凑多列布局，避免整页被长表单拉长。
- 运营概览新增“管理员管理 / 封禁管理 / 白名单审核”快捷入口和待审/生效封禁统计。
- 删除运营概览的“真实数据”提示卡片及相关文案。
- 管理页头显示当前管理员头像/昵称。
- 修复管理表格在 1440 下右侧操作列被截断、手机端页面横向溢出 19px 的问题。

### 涉及文件

- `services/api/migrations/20261023235000_admin_moderation_whitelist.sql`（新增）
- `services/api/src/modules/admin_users.rs`（新增）
- `services/api/src/modules/bans.rs`（新增）
- `services/api/src/modules/whitelist.rs`（新增）
- `services/api/src/modules/auth/mod.rs`
- `services/api/src/modules/admin.rs`
- `services/api/src/modules/servers.rs`
- `services/api/src/modules/mod.rs`
- `services/api/src/routes/mod.rs`
- `apps/web/src/app/(admin)/layout.tsx`
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/app/(admin)/admin/admins/page.tsx`（新增）
- `apps/web/src/app/(admin)/admin/bans/page.tsx`（新增）
- `apps/web/src/app/(admin)/admin/whitelist/page.tsx`（新增）
- `apps/web/src/features/admin/components/admin-nav.tsx`
- `apps/web/src/features/admin/components/admin-accounts-manager.tsx`（新增）
- `apps/web/src/features/admin/components/bans-manager.tsx`（新增）
- `apps/web/src/features/admin/components/whitelist-manager.tsx`（新增）
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/account/components/whitelist-apply-card.tsx`（新增）
- `apps/web/src/app/(account)/account/page.tsx`
- `apps/web/src/app/(servers)/servers/page.tsx`（仅沿用现有；服务器 API 类型更新）
- `apps/web/src/features/servers/data/servers.ts`
- `apps/web/src/features/servers/components/server-card.tsx`
- `apps/web/src/features/servers/components/server-list-row.tsx`
- `apps/web/src/services/content.ts`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/CHANGELOG.md`
- `docs/DEPLOYMENT.md`

### 数据库与 API 变化

新增迁移 `20261023235000_admin_moderation_whitelist.sql`：

- `users.is_disabled`、`disabled_at`、`disabled_reason`
- `servers.requires_whitelist`
- `bans`
- `whitelist_applications`
- `server_whitelist`

新增管理 API：

- `GET/POST /api/v1/admin/admins`
- `DELETE /api/v1/admin/admins/{steam_id64}`
- `POST /api/v1/admin/admins/{steam_id64}/disable`
- `POST /api/v1/admin/admins/{steam_id64}/enable`
- `GET/POST /api/v1/admin/bans`
- `POST /api/v1/admin/bans/{id}/lift`
- `GET/POST /api/v1/admin/whitelist`
- `POST /api/v1/admin/whitelist/applications/{id}/approve`
- `POST /api/v1/admin/whitelist/applications/{id}/reject`
- `DELETE /api/v1/admin/whitelist/{server_id}/{steam_id64}`
- `PATCH /api/v1/admin/servers/{id}/whitelist`
- `POST /api/v1/whitelist/applications`（登录玩家提交）

认证变化：

- 登录 upsert 保留现有数据库角色；
- 禁用用户/生效封禁用户在登录和会话查询时被拒绝；
- 禁用管理员、封禁玩家时删除其现有会话。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 11 项、HTTP 合约测试 14 项，共 25 项通过；
  - Clippy、rustfmt、TypeScript、ESLint、Prettier 全部通过。
- `npm run build`：通过，包含 `/admin/admins`、`/admin/bans`、`/admin/whitelist` 新路由。
- 数据库迁移已应用；测试数据随后清理。
- API 实测：
  - 匿名访问管理员接口返回 401；
  - 新增临时管理员、取消管理员；
  - 禁用/启用临时管理员；
  - 自身禁用返回 400；
  - 创建临时封禁、解封；
  - 被禁用户即使有会话，`/auth/me` 返回 `user:null`；
  - 通过白名单申请、生成授权记录；
  - 开关服务器白名单；
  - 登录玩家提交白名单申请。
- Playwright 实测：
  - 管理员概览不再包含“真实数据/页面数据来自 PostgreSQL”提示；
  - 快捷入口、管理员列表、封禁列表、白名单列表在 1440 宽度下无截断；
  - 通过 UI 新增管理员、创建/解封封禁、通过白名单申请；
  - 用户中心提交白名单申请；
  - 匿名/普通成员无法看到或进入管理面板；管理员可进入；
  - 1440、1024、390 宽度下管理页面无页面级横向溢出；390 下修复了 19px 溢出；
  - 无 console/pageerror。
- 临时测试用户、服务器、封禁、白名单和会话已清理。当前数据库：1 位真实成员（管理员）、1 篇官方指南、0 个服务器、0 条封禁、0 条白名单申请/授权；系统账号不计入成员。
- 未执行：游戏服务器插件白名单/封禁拦截、Docker 镜像构建、`nginx -t`、HTTPS 验证。

### 待办与风险

- 游戏内封禁和白名单拦截需要服务器插件在连接前读取 `bans` / `server_whitelist` / `servers.requires_whitelist`；当前 Web 只完成管理和审核。
- 白名单申请审核结果不会自动通知玩家（通知系统未实现）。
- 管理员操作审计、登录限流和 CSRF 仍未实现。
- 生产环境需要通过 `ADMIN_STEAM_IDS` 引导至少一位管理员，之后在管理面板添加更多管理员；建议保留至少两位。
- 服务器记录新增/管理接口仍未实现，白名单设置只对已存在的服务器生效。


---

## 2026年10月23日 23时21分00秒 管理员导航、新手指南与 Steam 回调地址修正

### 背景

用户提出三项修改：

1. 顶部导航中的“管理面板”只允许管理员 Steam 用户看到和进入；
2. 论坛“新手指南”卡片的按钮“查看服务器状态”改为“查看教学”，跳转到详细说明进入服务器、被拦截时如何申请白名单的教学帖；
3. 本地 Steam 登录回调返回 `http://127.0.0.1:3100/...` 时浏览器提示“127.0.0.1 拒绝了我们的连接请求”。

### 变更内容

#### 1. 管理面板入口按角色显示

- `siteConfig.nav` 移除固定的“管理面板”项。
- `SiteHeader` 在 `/auth/me` 返回 `role=admin` 时才追加“管理面板”导航项；匿名用户和普通成员不渲染该入口。
- 页脚移除“管理面板”链接，避免非管理员从其他入口看到管理入口。
- `(admin)/layout.tsx` 在服务端读取 `/auth/me`：匿名访问 `/admin` 重定向到 `/account`，普通成员重定向到 `/`，只有管理员进入面板。
- `/api/v1/admin/overview` 继续在 API 层校验角色；不依赖前端隐藏。

#### 2. 官方新手指南

新增迁移 `services/api/migrations/20261023233000_seed_new_player_guide.sql`：

- `users` 增加 `is_system boolean NOT NULL DEFAULT false`；
- 预置 `ThRei 系统` 账号（`is_system=true`，`role=admin`），只用于官方指南作者；
- 预置主题 `new-player-guide`：
  - 分类：技巧与教学；
  - 标题：新手指南：进入 KZ 服务器与白名单申请；
  - 置顶；
  - 内容覆盖：进入服务器步骤、常见拦截原因、白名单申请所需信息、提交方式、常见问题、VAC/封禁/满员说明；
- 系统账号不计入成员数、角色分布、最近注册、最近活跃和社区活跃人数统计。

论坛“新手指南”卡片的按钮改为“查看教学”，指向 `/forum/topic/new-player-guide`。主题正文使用 `whitespace-pre-line` 保留单换行，让编号步骤分行显示。

论坛作者角色统一显示中文（管理员/版主/成员），不再直接显示数据库中的 `admin`/`member`。

#### 3. Steam 回调地址修正

- 开发环境站点 origin 从 `http://127.0.0.1:3100` 改为开发机局域网地址 `http://192.168.0.101:3100`。
- `services/api/.env` 中 `WEB_URL`、`STEAM_RETURN_URL`、`STEAM_REALM` 同步改为该局域网地址；CORS 同时允许 `127.0.0.1`、`localhost` 与 `192.168.0.101`。
- `apps/web/.env.local` 的 `NEXT_PUBLIC_SITE_URL` 同步改为局域网地址，并以该地址重新构建 Web。
- 将回调中出现的真实 SteamID64 写入本地被 Git 忽略的 `ADMIN_STEAM_IDS`，并把已登录用户角色更新为 `admin`。不把该值写入仓库。
- Steam 头像实际返回 `avatars.fastly.steamstatic.com`，补充 Next Image 远程域名白名单；已通过真实 Steam 头像验证加载。

#### 4. 回调报错原因

浏览器返回的 `openid.return_to` 是 `http://127.0.0.1:3100/api/v1/auth/steam/callback`。如果浏览器不在开发服务器本机，`127.0.0.1` 会指向浏览器自己的机器，而不是开发机，因此出现连接拒绝。

服务端本身在 3100 端口正常监听。使用用户提供的回调参数在本机验证时，Steam OpenID 校验成功、会话可以写入，说明登录回调代码本身可用；该验证会话随后已通过 `/auth/logout` 删除。旧回调中的 nonce 已使用，用户需要从新 origin 重新点击“使用Steam登录”。

修正后，浏览器应访问：

```text
http://192.168.0.101:3100
```

Steam 回调会指向同一 origin。若以后通过域名或端口转发访问，必须同步修改开发环境 `.env` 的 `WEB_URL`/`STEAM_RETURN_URL`/`STEAM_REALM` 与 Web 的 `NEXT_PUBLIC_SITE_URL`，不能把 `127.0.0.1` 写死给远程浏览器。

### 涉及文件

- `apps/web/src/lib/site-config.ts`
- `apps/web/src/components/layout/site-header.tsx`
- `apps/web/src/components/layout/site-footer.tsx`
- `apps/web/src/app/(forum)/forum/page.tsx`
- `apps/web/src/app/(forum)/forum/topic/[id]/page.tsx`
- `apps/web/src/features/forum/components/topic-row.tsx`
- `apps/web/src/lib/roles.ts`（新增）
- `apps/web/src/lib/format.ts`（仅此前时间格式；本次未改）
- `apps/web/src/app/(account)/account/page.tsx`
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/next.config.ts`
- `apps/web/.env.local`（Git 忽略）
- `services/api/.env`（Git 忽略）
- `services/api/migrations/20261023233000_seed_new_player_guide.sql`（新增）
- `services/api/src/modules/community.rs`
- `services/api/src/modules/admin.rs`
- `services/api/src/modules/forum.rs`
- `docs/DEVELOPMENT.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/DEPLOYMENT.md`

### 数据库与 API 变化

- 新迁移：`users.is_system`、系统账号 1 个、官方指南主题 1 篇。
- 没有新增 API 路径；以下查询增加系统账号过滤：
  - 社区成员数与本周活跃人数；
  - 管理员成员数、今日登录、角色分布、最近注册和 7 天新成员；
  - 论坛最近活跃作者。
- 论坛主题/分类计数包含官方指南；成员统计不包含系统账号。
- 当前数据库真实成员 1 人，主题 1 篇（官方指南），服务器 0 个，在线玩家 0 人；没有模拟服务器或模拟玩家。
- API 回调与登录路由未变；OpenID 校验逻辑未变，只修正了开发环境回调 origin。

### 测试与结果

- `./scripts/check.sh`：通过，Rust 单元测试 11 项、HTTP 合约测试 13 项，共 24 项；TypeScript、ESLint、Prettier 通过。
- `npm run build`：通过，Web 以 `NEXT_PUBLIC_SITE_URL=http://192.168.0.101:3100` 构建。
- 数据库：
  - 新迁移执行成功；
  - 社区接口返回成员 1、主题 1、活跃成员 0（系统账号被排除）；
  - 论坛主题列表包含 `new-player-guide`，作者为“ThRei 系统”，角色显示“管理员”；
  - `/api/v1/community/overview` 不再把系统账号计入成员。
- Playwright（以 `http://192.168.0.101:3100` 访问）：
  - 匿名用户顶部导航不包含“管理面板”；
  - 临时管理员会话顶部导航包含“管理面板”，真实 Steam 头像加载成功（184×184，fastly 域名）；
  - 临时普通成员会话顶部导航不包含“管理面板”；
  - 管理员会话访问 `/admin` 显示运营概览；
  - 普通成员直接访问 `/admin` 服务端重定向到 `/`，匿名访问重定向到 `/account`；
  - 论坛“查看教学”按钮存在，href 为 `/forum/topic/new-player-guide`；
  - 点击后进入教学帖，正文包含“进入服务器”“白名单申请”“SteamID64”“帮助与反馈”“VAC”等段落；
  - 作者角色显示中文“管理员”，教程编号步骤保留换行；
  - `/admin` 管理员页面可访问。
- 真实回调：
  - 使用用户提供的 Steam 断言参数在本机回调，Steam OpenID `check_authentication` 通过，服务端成功创建会话并设置 Cookie；
  - 随后删除该会话，避免留下测试登录；
  - 浏览器端需要从 `http://192.168.0.101:3100` 重新发起一次登录，旧 nonce 已消耗。
- 未执行：从新 origin 重新完成一次浏览器 Steam 授权、Docker 镜像构建/启动、`nginx -t`、HTTPS 验证。

### 待办与风险

- 若开发机 IP 变化，必须同步更新开发 `.env` 和 Web 的 `NEXT_PUBLIC_SITE_URL`。
- 如果用户从另一台机器访问，应使用开发机局域网 IP，而不是浏览器自己的 `127.0.0.1`。
- 论坛发帖/回复写接口仍未开放；指南中的白名单申请暂时按“联系服务器内管理员”执行。
- `ADMIN_STEAM_IDS` 只保存在本地 `.env`；生产部署需要在 Compose `.env` 中配置。
- 官方指南使用独立系统账号，已从成员/活跃统计中排除；后续新增官方内容应继续使用 `is_system=true`。


---

## 2026年10月23日 22时57分47秒 Steam 登录、真实数据与局域网数据库接入

### 背景

用户要求：

1. 顶部导航的“加入服务器”改为“使用Steam登录”，点击后跳转 Steam 登录，并将 Steam 作为网站唯一登录方式；
2. 删除前端模拟数据，网站全部改为真实数据；
3. 开发环境连接局域网 PostgreSQL `192.168.0.62`（用户 `test`、库 `test`）与 Redis `192.168.0.62`（带密码），生产环境后续使用 Docker Compose 拉起的 PostgreSQL/Redis。

本次没有创建 Git commit，也没有 push；所有改动保留在工作区。

### 变更内容

#### 1. Steam OpenID 登录

- 新增 `GET /api/v1/auth/steam/login`：构造 Steam OpenID 2.0 `checkid_setup` 请求并返回 307。
- 新增 `GET /api/v1/auth/steam/callback`：
  - 校验 `openid.mode=id_res` 与 `openid.return_to`；
  - 将断言以 `check_authentication` POST 回 Steam，只有响应包含 `is_valid:true` 才信任；
  - 从 `openid.claimed_id` 提取 17 位 SteamID64；
  - 读取公开 Steam profile XML 的昵称与头像，失败时回退到 `Steam 用户 <ID 后 6 位>`；
  - 按 `steam_id64` upsert `users`；
  - 生成随机会话令牌，数据库保存 SHA-256 哈希；
  - 设置 `threi_session` HttpOnly Cookie 并跳转 `/account`。
- 新增 `GET /api/v1/auth/me`、`POST /api/v1/auth/logout`。
- Cookie 参数：`Path=/`、`HttpOnly`、`SameSite=Lax`，生产环境可配置 `Secure`；默认 30 天过期。
- 顶部导航未登录显示“使用Steam登录”，登录后显示 Steam 用户头像与名称；用户中心未登录显示登录卡片。
- `ADMIN_STEAM_IDS` 中的 SteamID64 在登录时获得 `admin` 角色；`/admin` 与服务端 API 均校验，不再公开。
- Steam 回调地址、realm、Web origin 全部通过环境变量配置；生产 `WEB_URL` 必填。

#### 2. 真实数据库与 API

新增迁移 `services/api/migrations/20261023230000_real_content_and_steam_auth.sql`，建立：

- `users`、`sessions`
- `servers`、`server_players`
- `categories`、`topics`、`replies`
- `favorites`

迁移只预置 5 个论坛分类作为结构配置，不写入任何服务器、用户、主题、回复或模拟统计。

新增只读业务 API：

- `GET /api/v1/servers`
- `GET /api/v1/forum/categories`
- `GET /api/v1/forum/topics`
- `GET /api/v1/forum/topics/{slug}`
- `GET /api/v1/forum/active-users`
- `GET /api/v1/community/overview`
- `GET /api/v1/account`（登录）
- `GET /api/v1/admin/overview`（管理员）
- auth 路由 4 个（见上）

API 查询全部绑定参数，不拼接用户输入；论坛搜索限制 `q` 最长 120 字符、分类最长 64 字符、列表最多 50 条。

#### 3. 前端删除模拟数据

删除：

- `features/forum/data/forum.ts`
- `features/account/data/account.ts`
- `features/admin/data/dashboard.ts`
- 12 张 `public/images/servers/kz-*.svg`
- 模拟服务器、玩家昵称/头像、主题、回复、通知、徽章、审核队列、审计日志和系统设置。

保留：

- `features/servers/data/servers.ts`：仅 `KzServer` / `KzPlayer` 类型、地址、搜索与统计工具，不再包含数据；
- `public/.gitkeep`：保持 Dockerfile 的 `public/` 复制路径有效。

首页、服务器页、论坛页、分类页、主题详情、用户中心和管理面板改为 Server Components 调用 `services/content.ts`，即 API/PostgreSQL 数据。空库时显示空状态，不回退到模拟内容。

服务器地图图片改由数据库 `servers.map_image` 提供；卡片使用普通 `<img>` 以支持任意真实图片地址，Steam 头像仍通过 Next Image 与远程域名白名单加载。

#### 4. 开发环境外部数据库

本地被 Git 忽略的 `services/api/.env` 已切换为：

- PostgreSQL：局域网 `192.168.0.62:5432`，用户/库按用户提供；
- Redis：局域网 `192.168.0.62:6379`，使用用户提供的密码；
- 开发环境 `REDIS_REQUIRED=false`，Redis 仅用于就绪检查/后续缓存；
- `WEB_URL` 与 Steam 回调指向本地预览 `http://127.0.0.1:3100`。

真实密码没有写入 README、`.env.example`、代码或 Git；生产环境仍使用 Compose 内 PostgreSQL/Redis。Compose 增加 auth 环境变量，并由 `SITE_URL` 派生 Steam 回调与 realm。

### 涉及文件

- `services/api/migrations/20261023230000_real_content_and_steam_auth.sql`（新增）
- `services/api/src/modules/auth/mod.rs`（新增）
- `services/api/src/modules/servers.rs`（新增）
- `services/api/src/modules/forum.rs`（新增）
- `services/api/src/modules/community.rs`（新增）
- `services/api/src/modules/account.rs`（新增）
- `services/api/src/modules/admin.rs`（新增）
- `services/api/src/modules/mod.rs`
- `services/api/src/routes/mod.rs`
- `services/api/src/app.rs`
- `services/api/src/config/mod.rs`
- `services/api/src/errors/mod.rs`
- `services/api/src/openapi.rs`
- `services/api/Cargo.toml`、`Cargo.lock`
- `services/api/tests/http_contract.rs`
- `apps/web/src/components/layout/site-header.tsx`
- `apps/web/src/components/shared/user-avatar.tsx`
- `apps/web/src/services/content.ts`（新增）
- `apps/web/src/lib/format.ts`（新增）
- `apps/web/src/features/forum/types.ts`、`features/account/types.ts`、`features/admin/types.ts`（新增）
- `apps/web/src/features/servers/data/servers.ts`（改为纯类型/工具）
- `apps/web/src/features/servers/components/*`（真实头像、空地图兜底、状态）
- `apps/web/src/app/(site)/page.tsx`
- `apps/web/src/app/(servers)/servers/page.tsx`
- `apps/web/src/app/(forum)/forum/page.tsx`
- `apps/web/src/app/(forum)/forum/[category]/page.tsx`
- `apps/web/src/app/(forum)/forum/topic/[id]/page.tsx`
- `apps/web/src/app/(account)/account/page.tsx`
- `apps/web/src/features/account/components/logout-button.tsx`（新增）
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/app/(admin)/layout.tsx`（服务端权限重定向）
- `apps/web/src/features/admin/components/admin-nav.tsx`
- 删除 `features/forum/data/forum.ts`
- 删除 `features/account/data/account.ts`
- 删除 `features/admin/data/dashboard.ts`
- 删除 `apps/web/public/images/servers/*.svg`
- `apps/web/public/.gitkeep`（新增）
- `apps/web/next.config.ts`（Steam 头像远程域名）
- `.env.example`、`services/api/.env.example`、`compose.yaml`
- `README.md`、`docs/ARCHITECTURE.md`、`docs/API.md`、`docs/CHANGELOG.md`、`docs/DEPLOYMENT.md`

### 数据库与 API 变化

- 数据库迁移：新增 8 张业务表；`categories` 预置 5 行；其余表为空。
- 已对局域网测试库执行迁移，并重复执行确认幂等。
- 新增 12 个业务 API 路径（4 个 auth、5 个内容读取、1 个 community、1 个 account、1 个 admin，另有 OpenAPI 文档路由既有）。
- 会话存储：`sessions.token_hash` 为主键，原始令牌不落库。
- 删除前端所有模拟数据；页面在没有数据库记录时展示空状态。
- 未新增写操作接口，因此暂未实现 CSRF；后续发帖/回复、服务器管理写接口必须先补 CSRF 与限流。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 11 项、HTTP 合约测试 13 项，共 24 项通过；
  - `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings` 通过；
  - TypeScript、ESLint、Prettier 全部通过。
- `npm run build`：通过，13 个页面/路由；`/`、`/servers`、`/forum`、`/forum/[category]`、`/forum/topic/[id]`、`/account`、`/admin` 为动态渲染。
- 局域网数据库：
  - 迁移成功，`/health/ready` 返回 `database=ok`、`redis=ok`；
  - 重复执行 `migrate` 成功；
  - 清理测试数据后：成员 0、主题 0、回复 0、服务器 0、在线玩家 0；分类 5。
- HTTP 验证：
  - `/api/v1/auth/steam/login` 返回 307，Location 指向 `https://steamcommunity.com/openid/login`；
  - 通过 Web 代理访问同一路径仍返回 307；
  - 无效回调 `openid.mode=cancel` 返回 303 到 `/account?steam_error=steam_login_failed`；
  - 匿名 `/api/v1/auth/me` 返回 `{user:null}`；
  - 未登录 `/api/v1/account` 与 `/api/v1/admin/overview` 返回 401；
  - 临时成员会话访问 `/api/v1/account` 返回 200，访问 `/api/v1/admin/overview` 返回 403；测试用户随后删除；
  - 配置测试覆盖生产环境缺少 `WEB_URL` 与非法 `ADMIN_STEAM_IDS`；
  - OpenAPI JSON 包含 auth、servers、forum、community、account、admin 路径。
- Playwright 无头 Chromium：
  - 1920/1440/1024/768/390 宽度访问 `/`、`/servers`、`/forum`、`/account`、`/admin`，均返回 200，无横向溢出，无 console/pageerror；
  - 空库状态：首页无模拟内容，服务器页显示“暂时还没有服务器记录”，论坛显示分类与空主题，用户中心/管理面板显示 Steam 登录/权限提示；
  - 临时插入测试用户与会话（仅用于验证，随后删除）：
    - 导航显示 Steam 用户头像/名称；
    - 用户中心显示真实资料、统计、活动与收藏；
    - `/admin` 显示真实统计与角色分布；
    - 登出后导航恢复“使用Steam登录”，会话删除；
  - 账号页用户名不再被深色封面遮挡。
- Compose：使用 `/tmp/docker-compose --env-file .env.example config` 验证配置可解析；未执行镜像构建/容器启动。
- 未执行：真实 Steam 账号浏览器授权、Docker 镜像构建与启动、`nginx -t`、HTTPS 验证、真实游戏服务器插件上报。

### 待办与风险

- `ADMIN_STEAM_IDS` 默认为空，首次登录后需要从用户中心取得 SteamID64，加入配置并重新登录；否则 `/admin` 无管理员可用。
- 生产必须配置 HTTPS，并把 `SITE_URL`/回调地址设为公开 origin；本地 `127.0.0.1` 回调仅用于开发。
- 当前没有论坛发帖、回复、资料编辑、收藏管理和服务器管理写接口；数据库记录需后续管理接口或受控数据库运维写入。
- `server_players` 需要游戏服务器插件上报；未接入前在线玩家为空。
- 未实现登录限流、CSRF、细粒度 RBAC、审核与审计。


---

## 2026年10月23日 22时14分11秒 服务器卡片改为三列错落卡片墙

### 背景

用户认为上一版的双列卡片“特别丑、比例不好”，要求重新设计；随后确认单列横向展示卡“不叫卡片排列，叫做列表排列”，需要继续改回真正的卡片排列。

上一记录 `2026年10月23日 21时57分29秒 服务器玩家头像展示与 hero 文案调整` 中“服务器目录取消三列卡片、统一两列”的布局描述，已被本次三列卡片墙取代；旧记录保留用于追溯。

### 变更内容

#### 1. 卡片视图改为三列错落卡片墙

- 服务器目录卡片视图从单列横向展示卡改为多列卡片墙：
  - 1280px 及以上：3 列；
  - 768–1279px：2 列；
  - 手机：1 列。
- 使用 `useSyncExternalStore` 订阅 `matchMedia`，在 1/2/3 列之间切换；服务端快照固定为 3 列，避免首屏布局不确定。
- 卡片按列分配，而不是使用 CSS `columns` 的列优先顺序：每列独立纵向排列，首行按服务器顺序显示，避免出现首行跳号。
- 卡片使用自然高度，不再为了同行等高而把玩家面板拉满；少人数服务器不会出现大面积空白。
- 每张卡片内部的地图、玩家面板、地址和操作区保持完整结构；按钮仍在卡片底部对齐。

#### 2. 卡片比例与玩家布局

- `ServerCard` 地图头图从 `16:7` 调整为 `16:9`，让 3 列宽度下的卡片头部不再过扁。
- 玩家头像列表固定两列，避免在 3 列卡片中因内部三列过窄导致昵称换行。
- 所有在线玩家头像与昵称仍然完整展示，不省略、不使用“+N”。
- 首页推荐服务器仍使用现有卡片网格；地图头图比例同步为 `16:9`。
- 删除上一版临时使用的 `server-showcase-card.tsx`，卡片视图重新使用统一的 `ServerCard`。

#### 3. 列表视图保持不变

- 列表仍使用 `ServerListRow`，显示地图缩略图、描述、玩家头像与昵称、地址和操作按钮。
- 卡片墙按内容高度排列，因此同行卡片底部不再强制对齐；这是为了避免少人数服务器出现大块空白。
- 每张卡片内部的“复制地址/加入游戏”按钮仍保持同一行、同一高度。

### 涉及文件

- `apps/web/src/features/servers/components/server-directory.tsx`
- `apps/web/src/features/servers/components/server-card.tsx`
- `apps/web/src/features/servers/components/player-roster.tsx`
- `apps/web/src/features/servers/components/server-showcase-card.tsx`（删除）
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/DEVELOPMENT.md`（本记录）

### 数据库与 API 变化

- 无数据库迁移、Rust API 或 OpenAPI 契约变化。
- 服务器、玩家头像、昵称和在线状态仍为前端模拟数据，刷新不会持久化，也不代表真实服务器或 Steam 账号。
- 服务器地址继续使用保留域名 `*.threi.example`，不会连接真实 CS:GO 服务器。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 6 项、HTTP 契约测试 10 项，共 16 项通过；
  - TypeScript、ESLint、Prettier 全部通过。
- `npm run build`：通过，静态生成 24 个页面/路由。
- Playwright 无头 Chromium 验证：
  - 1920 / 1440 / 1280 宽度下为 3 列，卡片宽度均为约 352px；
  - 1024 / 768 宽度下为 2 列，390 宽度下为 1 列；
  - 首行卡片顶部坐标一致且列位置不同，第二张卡片从第一列继续纵向排列；
  - 12 个服务器卡片均渲染，Beginner 显示 9 个玩家头像，Hardcore 显示 28 个；
  - 抽查 Beginner / Hardcore 卡片，复制/加入按钮高度均为 36px，顶部坐标一致；
  - 所有测试宽度无横向溢出；
  - 列表视图仍显示 12 个服务器和 28 个 Hardcore 玩家头像；
  - 首页玩家头像正常渲染；
  - `/`、`/servers`、`/forum`、`/forum/maps`、`/forum/topic/season-three-rush`、`/account`、`/admin` 均返回 200；
  - 复制地址和加入游戏弹窗验证通过，console/pageerror 无错误。
- 未执行：Docker 镜像构建、容器启动、`nginx -t`、HTTPS 验证（本机无 Docker daemon）；未连接真实 CS:GO 服务器验证。


---

## 2026年10月23日 21时57分29秒 服务器玩家头像展示与 hero 文案调整

### 背景

用户认为首页标题“在 ThRei 的 KZ 世界里，和朋友们一起起跳、连跳、刷新记录。”和服务器页标题“找到你的 KZ 服务器，从一次起跳开始。”语气过于中二、煽情，需要改成更平实的表述。

同时，服务器目录目前只显示玩家昵称，用户希望在玩家名称旁同时显示头像，并要求重新规划玩家列表的布局；头像和名称先使用模拟数据。

### 变更内容

#### 1. 首页与服务器页文案收敛

- 首页 hero 标题从“在 ThRei 的 KZ 世界里……刷新记录”改为：
  - “一个专注 KZ 的社区，”
  - “找服务器，记录成绩。”
- 首页说明改为介绍服务器、地图和玩家记录，并提示可以到论坛交流路线与技巧。
- 首页特色服务器在线栏从“正在热身”改为“当前有 N 位玩家在线”，并展示玩家头像。
- 服务器页 hero 标题从“找到你的 KZ 服务器，从一次起跳开始。”改为：
  - “KZ 服务器目录”
  - “地图、玩家与地址。”
- 服务器页说明改为介绍新手、连跳、长跳和进阶服务器，以及查看玩家、复制地址和启动 CS:GO 的操作。
- 服务器页 metadata、目录区标题“选择 KZ 服务器”、统计文案“在线，分布在 12 个服务器”同步改为平实表述。
- 首页服务器推荐区标题改为“推荐 KZ 服务器”。

#### 2. 玩家模拟头像数据

- 新增 `KzPlayer` 接口，包含 `name` 和 `avatar` 字段；`KzServer.players` 从 `string[]` 改为 `KzPlayer[]`。
- 保留 40 个模拟玩家昵称，新增 20 组本地 Tailwind 渐变色板，按玩家顺序生成稳定的模拟字母头像。
- 同一玩家在不同服务器中复用同一头像；不依赖外部图片服务，也不代表真实 Steam 头像。
- 服务器搜索同步改为读取 `player.name`，仍可按玩家昵称查找服务器。

#### 3. 玩家头像与昵称布局

- 新增 `PlayerRoster` 组件，统一卡片、列表和首页在线栏的玩家展示。
- 每个玩家条目包含：
  - `UserAvatar` 小型渐变字母头像；
  - 完整玩家昵称；
  - `title` 提示和 `data-player-name` / `data-player-avatar` 属性，便于测试与后续替换。
- 卡片视图使用两列或三列网格，根据卡片宽度切换；列表视图使用带边框的横向玩家标签。
- 玩家昵称不截断、不使用“+N”隐藏，长昵称自动换行。
- 首页特色服务器在线栏复用列表变体，头像与昵称一起展示。
- 服务器卡片数量较多时，玩家面板继续使用 `flex-1` 填充并在底部显示剩余空位，保持“复制地址/加入游戏”按钮对齐。

#### 4. 卡片宽度与响应式调整

- 服务器目录取消 1920 宽度下的三列卡片，统一最多两列，避免玩家头像和昵称被压缩。
- 首页特色服务器卡片在紧凑模式下使用两列玩家头像布局，避免三列卡片中的昵称换行过多。
- 1920、1440、1024、768 和 390 宽度下验证无横向溢出，玩家名称完整显示，按钮仍对齐。

### 涉及文件

- `apps/web/src/components/shared/user-avatar.tsx`
- `apps/web/src/features/servers/data/servers.ts`
- `apps/web/src/features/servers/components/player-roster.tsx`（新增）
- `apps/web/src/features/servers/components/server-card.tsx`
- `apps/web/src/features/servers/components/server-list-row.tsx`
- `apps/web/src/features/servers/components/server-directory.tsx`
- `apps/web/src/app/(site)/page.tsx`
- `apps/web/src/app/(servers)/servers/page.tsx`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/DEVELOPMENT.md`（本记录）

### 数据库与 API 变化

- 无数据库迁移、Rust API 或 OpenAPI 契约变化。
- 玩家头像、昵称和在线状态仍为前端模拟数据，刷新不会持久化，也不代表真实服务器或 Steam 账号。
- 服务器地址继续使用保留域名 `*.threi.example`，不会连接真实 CS:GO 服务器。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 6 项、HTTP 契约测试 10 项，共 16 项通过；
  - TypeScript、ESLint、Prettier 全部通过。
- `npm run build`：通过，静态生成 24 个页面/路由。
- Playwright 无头 Chromium 验证：
  - `/servers` 渲染 12 个服务器卡片；
  - `KZ | Beginner` 显示 9 个玩家头像和昵称，`KZ | Hardcore` 显示 28 个，名称完整；
  - 列表视图同样显示 9 / 28 个头像和昵称；
  - 首页在线栏和特色服务器共渲染 48 个玩家头像条目；
  - 搜索玩家 `n0va` 返回 2 个服务器，`LongJumpLarry` 也能命中；
  - 1920、1440、1024、768 宽度下卡片底边和“复制地址/加入游戏”按钮坐标一致，按钮高度均为 36px，无横向溢出；
  - 390 宽度下无横向溢出，玩家头像和昵称完整，按钮高度和顶部坐标一致；
  - 所有检查页面返回 200，浏览器 console 与 pageerror 均无错误。
- 未执行：Docker 镜像构建、容器启动、`nginx -t`、HTTPS 验证（本机无 Docker daemon）；未连接真实 CS:GO 服务器验证头像或玩家状态。


---

## 2026年10月23日 21时37分32秒 站点主题切换为 CS:GO KZ 与服务器目录扩展

### 背景

用户确认网站的设计与样式搭配可以保留，但内容主题错误：站点实际是 Minecraft 社区，需要整体改为 **CS:GO 的 KZ 模式**。同时提出两点界面要求：

1. 服务器数量可能达到 10–30 个，服务器目录需要能承载这个规模，并且每个服务器的**全部在线玩家名称**都要显示；
2. 修复服务器卡片中“复制地址”和“加入游戏”按钮与其他卡片未对齐的问题。

上一记录 `2026年10月23日 20时52分04秒 服务器页面与全站模拟内容上线预览` 中关于 3 个 Minecraft 服务器、三张旧地图和 Minecraft Java 版加入步骤的描述，已被本记录中的 12 个 CS:GO KZ 服务器与 Steam/控制台连接方式取代；旧记录保留用于追溯。

### 变更内容

#### 1. 全站从 Minecraft 切换为 CS:GO KZ

- 官网首页 hero、服务器推荐、论坛动态、社区数据与 CTA 改为 KZ 语境；
- 论坛分类改为公告与活动、综合讨论、地图与记录、技巧与教学、帮助与反馈；
- 8 个论坛主题、回复、作者角色与站内链接全部改为 KZ 地图、连跳、长跳、计时赛和新手绑定等主题；
- 用户中心 bio、最近活动、通知、徽章、收藏服务器与 Steam 账号标签改为 KZ 内容；
- 管理面板角色、审核队列、审计日志、最近主题和服务器节点说明改为 KZ 运营语境；
- 站点描述、manifest、页脚、README、架构文档与 CHANGELOG 同步更新；
- 删除旧 Minecraft 服务器地图 SVG 和无用的 `player-avatar.tsx`。

#### 2. 服务器目录扩展到 12 个 KZ 服务器

- 重写 `features/servers/data/servers.ts`，新增 `KzServer` 数据模型：服务器名、地图、描述、状态、IP、端口、区域、tickrate、人数上限、延迟、标签、完整在线玩家数组和地图预览图；
- 新增 12 个 KZ 服务器，人数上限均为 32，在线玩家共 184 人；每个服务器提供独立的 IP:PORT 与地图；
- 在线玩家使用 `string[]` 保存，卡片和列表都渲染全部名称，不使用省略号或“+N”隐藏；
- 新增 12 张本地 KZ 地图预览 SVG，放在 `apps/web/public/images/servers/`；
- 新增服务器搜索：可按服务器名、地图、地区、描述、标签或在线玩家昵称过滤；
- 服务器卡片视图使用 `md:grid-cols-2 2xl:grid-cols-3`，列表视图纵向堆叠，适配 10–30 个服务器的规模；
- 列表行展示缩略图、描述、tickrate、延迟、完整玩家标签、地址和操作按钮；
- “加入游戏”弹窗改为 CS:GO：提供 `steam://connect/IP:PORT` 入口、控制台 `connect IP:PORT` 命令和三步加入说明；
- 服务器页 hero 展示特色服务器背景、在线人数/容量/tickrate/服务器数统计，并保留三步进入指南与用户中心 CTA。

#### 3. 修复卡片按钮对齐

- 卡片使用 `flex h-full flex-col` 结构，操作区使用 `mt-auto` 固定在内容底部；
- 地址框与两个按钮放在同一个底部操作区，按钮使用 `grid grid-cols-2 gap-2` 等宽排列；
- “复制地址”和“加入游戏”统一为默认尺寸（36px 高），避免顶部对齐但底部错位；
- 列表行操作列使用 `lg:justify-between`，地址在上、按钮在下；
- 在线人数较少的卡片让玩家面板 `flex-1` 填充剩余高度，并在底部显示“还有 N 个空位 / 复制地址加入”，避免按钮对齐后留下无意义空白；
- 在 1920、1440、1024、768 和 390 宽度下验证同行卡片底边、复制/加入按钮的 y 坐标与高度一致。

#### 4. 响应式标题修正

- 首页和服务器页 hero 标题改为显式分行，避免中文词在窄屏被拆开；
- 首页标题字号调整为 `text-3xl sm:text-4xl md:text-5xl lg:text-6xl`，390px 宽度下不再出现“服务/器”或“起/跳”跨行断裂；
- 服务器页标题缩短为“找到你的 KZ 服务器，从一次起跳开始。”。

### 涉及文件

- 服务器数据与组件：
  - `apps/web/src/features/servers/data/servers.ts`
  - `apps/web/src/features/servers/components/server-card.tsx`
  - `apps/web/src/features/servers/components/server-list-row.tsx`
  - `apps/web/src/features/servers/components/server-directory.tsx`
  - `apps/web/src/features/servers/components/join-server-button.tsx`
  - 删除 `apps/web/src/features/servers/components/player-avatar.tsx`
- 服务器页面与素材：
  - `apps/web/src/app/(servers)/servers/page.tsx`
  - `apps/web/public/images/servers/kz-{beginner,bhop-city,longjump-lab,hardcore,climb-alpha,skyline,neon,frost,dune,void,marble,aztec}.svg`
  - 删除 `elysium-valley.svg`、`aether-workshop.svg`、`ember-arena.svg`
- 全站内容：
  - `apps/web/src/app/(site)/page.tsx`
  - `apps/web/src/app/(forum)/forum/page.tsx`
  - `apps/web/src/features/forum/data/forum.ts`
  - `apps/web/src/features/forum/components/forum-category-icon.tsx`
  - `apps/web/src/features/account/data/account.ts`
  - `apps/web/src/app/(account)/account/page.tsx`
  - `apps/web/src/features/admin/data/dashboard.ts`
  - `apps/web/src/app/(admin)/admin/page.tsx`
  - `apps/web/src/lib/site-config.ts`
  - `apps/web/src/app/manifest.ts`
  - `apps/web/src/components/layout/site-footer.tsx`
- 文档：
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CHANGELOG.md`
  - `docs/DEVELOPMENT.md`（本记录）

### 数据库与 API 变化

- 无数据库结构或迁移变更。
- 无 Rust API 路由、请求/响应结构或 OpenAPI 契约变更。
- 服务器目录、论坛、用户中心和管理面板仍使用前端静态预览数据；刷新不会保存修改，也不代表真实服务器状态。
- 服务器地址继续使用保留域名 `*.threi.example`，不会连接真实 CS:GO 服务器。
- `/admin` 仍未接入鉴权，生产环境不得公开。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 6 项、HTTP 契约测试 10 项，共 16 项通过；
  - TypeScript `tsc --noEmit` 通过；
  - ESLint `--max-warnings=0` 通过；
  - Prettier `--check` 通过。
- `npm run build`：通过，静态生成 24 个页面/路由；`/servers` 单页渲染 12 个服务器卡片，同时生成 5 个论坛分类页和 8 个论坛主题页。
- Playwright 无头 Chromium 验证：
  - `/servers` 默认卡片视图渲染 12 个服务器；
  - `KZ | Beginner` 显示 9 个玩家，`KZ | Hardcore` 显示 28 个玩家，未隐藏任何名称；
  - 搜索 `kz_hardcore` 返回 1 个结果，清空后恢复 12 个；列表视图显示 12 个服务器和 28 个 Hardcore 玩家；
  - 视图切换后刷新页面仍保持列表模式，`localStorage` 值为 `list`；
  - 复制结果为 `kz01.threi.example:27015`；
  - 加入弹窗可见，Steam 链接为 `steam://connect/kz01.threi.example:27015`；
  - 1920、1440、1024、768 宽度下，同行卡片底边一致，复制/加入按钮 y 坐标一致且高度均为 36px；
  - 390 宽度下无横向溢出，玩家列表完整，复制/加入按钮高度均为 36px 且顶部对齐；
  - `/`、`/forum`、`/forum/maps`、`/forum/topic/season-three-rush`、`/forum?q=长跳`、`/account`、`/admin` 均返回 200；
  - 浏览器 console 与 pageerror 均无错误。
- 未执行：Docker 镜像构建、容器启动、`nginx -t`、HTTPS 与生产反向代理验证（本机无 Docker daemon）；未连接真实 CS:GO 服务器验证连接与 KZ 插件行为。


---

## 2026年10月23日 20时52分04秒 服务器页面与全站模拟内容上线预览

### 背景

用户希望在顶部导航增加服务器功能页，展示当前服务器人数、IP/PORT、地图与地图图片、在线玩家名称和人数上限；提供卡片/列表两种显示模式（默认卡片），并在合适位置提供复制 IP:PORT 和加入游戏按钮。同时，官网、论坛、用户中心和管理面板不应继续展示架构原则或“模块骨架”，而应替换为模拟开发环境数据，以便预览上线后的实际观感。

本次全部为前端展示层和本地模拟数据，不接入真实服务器状态，也不改变数据库或 API 契约。页面中的服务器地址使用保留域名 `*.threi.example`，不会连接真实服务器。

### 变更内容

#### 1. 服务器模块与 `/servers`

- 新增 `src/features/servers` 数据与组件：
  - 3 个模拟服务器：Elysium Valley（长期生存）、Aether Workshop（自由创造）、Ember Arena（竞技与活动）；
  - 每个服务器包含 IP、PORT、地图、版本、区域、延迟、在线人数、人数上限和在线玩家样例；
  - 玩家列表显示头像色块、名称、角色，并标注“显示 N / 总在线人数”。
- 新增三张本地地图预览 SVG：Elysium Valley、Aether Workshop、Ember Arena，放在 `public/images/servers/`。
- 新增 `(servers)` route group 和 `/servers` 页面，顶部导航、页脚、sitemap 同步加入服务器入口。
- 新增卡片/列表显示切换：
  - 默认卡片模式；
  - 使用 `useSyncExternalStore` 读取 `localStorage`，避免 effect 内同步 setState；
  - 用户选择在下一次访问时保留。
- 新增“复制地址”按钮：
  - 复制完整 `IP:PORT`；
  - 优先使用 `navigator.clipboard`，提供旧浏览器降级；
  - 复制成功后显示“已复制”，并通过 `aria-live` 通知辅助技术。
- 新增“加入游戏”按钮：
  - 打开原生 `<dialog>`，展示服务器信息、完整地址、复制按钮和 Minecraft Java 版加入步骤；
  - 支持关闭按钮、点击遮罩关闭和 Escape 关闭。
- 服务器卡片和列表模式均完整展示 IP:PORT，不再截断；复制与加入按钮在卡片中并排展示。
- 修正服务器卡片/列表的响应式布局，移动端 390px 宽度下地址和按钮仍可正常显示。

#### 2. 官网首页

- 移除架构原则、数据流、技术栈清单和安全规划说明。
- 新首页包含：
  - 服务器地图背景 Hero、第三赛季公告入口、在线玩家与社区统计；
  - 三个服务器的快捷卡片（含地图、人数、地址、复制和加入按钮）；
  - 最新论坛主题、公告与活动、社区数据；
  - 服务器长期开放 CTA 和加入引导。
- 页脚增加“预览环境：服务器状态、论坛内容与用户资料均为模拟数据”说明。

#### 3. 论坛

- 新增论坛模拟数据：5 个分类、8 个主题、作者/角色/标签/浏览数/回复和详细回复内容。
- 论坛首页改为分类卡片、最新讨论、社区概览、最近活跃成员和新手指南侧栏。
- 搜索支持按标题、摘要、标签、作者和分类名过滤本地模拟主题，并显示结果数量与空状态。
- 分类页展示分类信息、主题列表、其他分类与服务器入口。
- 帖子详情页展示完整正文、标签、作者、浏览/回复统计和逐条回复；未知分类/帖子返回真正 404。
- 新增服务器状态卡片填充分类网格，更新搜索框占位文案。

#### 4. 用户中心

- 使用模拟用户“星野”替换骨架内容：头像、角色、简介、加入时间、地区、资料完整度。
- 增加主题/回复/游戏时长/社区贡献统计，最近活动、我的主题、通知、徽章、账号安全和收藏服务器。
- 修正横幅欢迎文字被头像遮挡的问题。

#### 5. 管理面板

- 移除“后续业务模块边界”和开发占位说明，替换为完整模拟运营面板：
  - 注册成员、今日活跃、主题总数、待审核内容统计；
  - 最近 7 天在线/新主题柱状图、角色分布；
  - 最近注册用户、最近主题、审核队列、管理操作审计；
  - 系统设置摘要、平台服务状态、服务器节点状态。
- 管理侧边栏改为指向页面内各区块的锚点链接，移除“待实现”徽章。
- 保留“演示数据”标识和未接入认证/权限的安全提示。
- 平台服务卡片改为更产品化的“平台服务”文案，同时保留真实 API 连通性检查。
- 修正 `CardHeader` 布局错位、设置卡片多余空白和移动端导航。

#### 6. 文案与资源

- 修正全局错误页、404 页中的开发期措辞。
- 移除页面上残留的“骨架 / 尚未实现 / 待实现”展示文案（安全提示和模拟数据说明除外）。
- Web Dockerfile 增加 `COPY public ./public`，确保地图图片进入生产运行镜像。
- README 增加主要页面说明和模拟数据声明；ARCHITECTURE 增加服务器路由、模拟数据模块和未来 `servers` 后端模块边界；CHANGELOG 增加 Unreleased 汇总。

### 涉及文件

#### 新增

| 文件 | 用途 |
| --- | --- |
| `apps/web/public/images/servers/elysium-valley.svg` | Elysium Valley 地图预览图 |
| `apps/web/public/images/servers/aether-workshop.svg` | Aether Workshop 地图预览图 |
| `apps/web/public/images/servers/ember-arena.svg` | Ember Arena 地图预览图 |
| `apps/web/src/app/(servers)/layout.tsx` | 服务器页面布局边界 |
| `apps/web/src/app/(servers)/servers/page.tsx` | `/servers` 页面、Hero、统计、加入步骤 |
| `apps/web/src/features/servers/data/servers.ts` | 服务器/玩家模拟数据、地址工具函数 |
| `apps/web/src/features/servers/components/server-directory.tsx` | 卡片/列表切换与 localStorage 偏好 |
| `apps/web/src/features/servers/components/server-card.tsx` | 卡片模式服务器展示 |
| `apps/web/src/features/servers/components/server-list-row.tsx` | 列表模式服务器展示 |
| `apps/web/src/features/servers/components/server-status-badge.tsx` | 在线/维护状态徽章 |
| `apps/web/src/features/servers/components/player-avatar.tsx` | 服务器玩家头像色块 |
| `apps/web/src/features/servers/components/copy-address-button.tsx` | 复制 IP:PORT 按钮与状态反馈 |
| `apps/web/src/features/servers/components/join-server-button.tsx` | 加入游戏说明对话框 |
| `apps/web/src/components/shared/user-avatar.tsx` | 通用用户头像组件 |
| `apps/web/src/features/forum/data/forum.ts` | 分类、主题、回复模拟数据与搜索 |
| `apps/web/src/features/forum/components/category-card.tsx` | 论坛分类卡片 |
| `apps/web/src/features/forum/components/forum-category-icon.tsx` | 分类图标与配色映射 |
| `apps/web/src/features/forum/components/topic-row.tsx` | 主题列表行 |
| `apps/web/src/features/account/data/account.ts` | 用户中心模拟资料、通知、活动 |
| `apps/web/src/features/admin/data/dashboard.ts` | 管理面板统计、审核、审计数据 |

#### 修改

| 文件 | 修改 |
| --- | --- |
| `apps/web/src/app/(site)/page.tsx` | 官网首页重写为服务器/社区内容 |
| `apps/web/src/app/(forum)/forum/page.tsx` | 分类、搜索、最新讨论和侧栏 |
| `apps/web/src/app/(forum)/forum/[category]/page.tsx` | 分类主题列表与 404 |
| `apps/web/src/app/(forum)/forum/topic/[id]/page.tsx` | 帖子正文、回复、相关主题 |
| `apps/web/src/app/(account)/account/page.tsx` | 用户中心模拟资料与活动 |
| `apps/web/src/app/(admin)/admin/page.tsx` | 管理运营面板与锚点区块 |
| `apps/web/src/app/(admin)/layout.tsx` | 演示数据标识，移除大面积开发警告 |
| `apps/web/src/app/global-error.tsx` | 错误页措辞 |
| `apps/web/src/app/not-found.tsx` | 404 措辞 |
| `apps/web/src/app/sitemap.ts` | 加入 `/servers` |
| `apps/web/src/components/layout/site-header.tsx` | 导航入口与“加入服务器”CTA |
| `apps/web/src/components/layout/site-footer.tsx` | 服务器入口、模拟数据说明 |
| `apps/web/src/lib/site-config.ts` | 导航增加服务器、站点描述更新 |
| `apps/web/src/features/forum/components/forum-search-form.tsx` | 搜索框占位文案 |
| `apps/web/src/features/admin/components/admin-nav.tsx` | 锚点导航，移除待实现 |
| `apps/web/src/features/admin/components/system-status-card.tsx` | 平台服务文案 |
| `apps/web/Dockerfile` | 复制 `public/` 静态地图资源 |
| `README.md` | 主要页面、模拟数据说明、目录更新 |
| `docs/ARCHITECTURE.md` | 服务器路由、模拟数据边界、未来 servers 模块 |
| `docs/CHANGELOG.md` | 新增 Unreleased 内容汇总 |
| `docs/DEVELOPMENT.md` | 新增本条记录 |
| `services/api/src/modules/mod.rs` | 未来 `servers` 后端模块边界注释 |

### 数据库与 API 变化

- 数据库：无迁移、表结构、索引或数据变化。
- API：无接口、请求/响应结构、错误码或权限变化。
- `services/api/src/modules/mod.rs` 仅为未来 `servers` 模块的注释补充，不影响编译产物行为。
- 前端页面中的服务器、论坛、用户中心和管理数据全部来自本地模拟数据；刷新后不持久化，也不请求真实服务器状态。

### 测试与结果

| 检查 | 命令/方式 | 结果 |
| --- | --- | --- |
| 全量静态检查 | `./scripts/check.sh` | 通过（Rust fmt、Clippy、16 个测试、TypeScript、ESLint、Prettier） |
| Next.js 生产构建 | `API_INTERNAL_URL=... NEXT_PUBLIC_SITE_URL=... npm run build` | 通过；`/servers` 为静态路由，分类/帖子使用 SSG |
| 服务器页卡片默认 | 无头 Chromium | `卡片` 按钮 `aria-pressed=true`，`列表=false` |
| 显示模式切换 | 点击“列表”并刷新 | 切换成功，`localStorage["threi.servers.view"]="list"`，刷新后保持 |
| 复制 IP:PORT | 点击复制并读取剪贴板 | 剪贴板为 `play.threi.example:25565`，按钮显示“已复制” |
| 加入游戏弹窗 | 点击“加入游戏” | 原生 dialog 可见，可关闭 |
| 页面状态 | `/`、`/servers`、`/forum`、`/forum/survival`、`/forum/topic/season-three-islands`、`/account`、`/admin` | 均返回 200 |
| 非法路由 | `/forum/unknown-category`、`/forum/topic/unknown-topic` | 404 |
| 地图资源 | 三张 `/images/servers/*.svg` | 200，`image/svg+xml` |
| 搜索 | `/forum?q=建筑` | 返回 3 个模拟结果 |
| 移动端 | 390×844 无头浏览器访问 `/servers` | 200，地址与操作按钮正常显示 |
| 控制台 | 浏览器交互检查 | 无 console/page error |
| API 连通性 | `/api/v1/system/info` 经 Next rewrite | 200 |

**未执行：**

- Docker 镜像构建与容器启动：当前环境没有 Docker daemon/CLI；本次改动只影响 Web 运行时和静态资源，但首次部署仍需实际构建验证。
- Nginx 配置加载与 HTTPS 验证：与本次内容修改无关，仍受环境限制。
- 未将无头浏览器检查固化为仓库内 E2E 测试；本次为临时脚本验证，截图在 `/tmp`，未提交。
- 未测试真实游戏客户端连接：模拟地址使用保留域名，不连接真实服务器。

### 已知限制

- 模拟数据不会持久化；发帖、编辑资料、审核操作等写能力未实现。
- 服务器状态、玩家列表、地图和人数为前端静态预览，不代表真实服务器。
- 管理面板仍公开可见，认证和权限尚未接入；生产环境必须保护。
- 加入游戏按钮提供连接说明和复制地址，不直接唤起游戏客户端（未确定游戏协议）。

## 2026年10月23日 20时20分17秒 官网公开品牌名称调整为 ThRei

### 背景

用户确认官网对外名称为 **ThRei**，要求将当前展示的 `threi` 调整为 `ThRei`。本次只调整公开品牌名，保留仓库名、包名、Docker 服务名、镜像名、API 技术标识等仍需保持小写的技术标识，避免破坏已有命令、路径和部署配置。

### 变更内容

- 前端站点配置：`name` 改为 `ThRei`，标题改为 `ThRei 社区`，描述加入品牌名。
- 品牌组件：导航和页脚展示 `ThRei`，Logo 方块字符由 `t` 改为 `T`，无障碍标签同步。
- 页面 metadata：管理面板、用户中心、论坛首页、分类页、帖子详情页的描述改为 `ThRei`。
- 官网首页文案、PWA manifest、全局错误页品牌文字、应用图标 `aria-label` 同步为 `ThRei`。
- OpenAPI 标题改为 `ThRei API`，描述改为 `ThRei community API`；API 启动日志中的品牌名同步，但健康检查响应和 `system/info` 的 `threi-api` 服务标识保持不变。
- README 与文档标题/说明中的产品展示名改为 `ThRei`；技术路径、镜像名、Compose 服务名、包名保持原样。
- 重新构建并重启本地预览，使当前运行页面立即显示新名称。

### 涉及文件

| 文件 | 修改 |
| --- | --- |
| `apps/web/src/lib/site-config.ts` | 站点名称、标题、描述 |
| `apps/web/src/components/layout/brand.tsx` | 导航品牌文字、Logo 字符、aria-label |
| `apps/web/src/app/(site)/page.tsx` | 官网首页品牌文案 |
| `apps/web/src/app/manifest.ts` | PWA 名称与短名称 |
| `apps/web/src/app/icon.svg` | 图标 aria-label |
| `apps/web/src/app/global-error.tsx` | 全局错误页品牌文字 |
| `apps/web/src/app/(admin)/layout.tsx` | 管理面板 metadata 描述 |
| `apps/web/src/app/(account)/account/page.tsx` | 用户中心 metadata 描述 |
| `apps/web/src/app/(forum)/forum/page.tsx` | 论坛首页 metadata 描述 |
| `apps/web/src/app/(forum)/forum/[category]/page.tsx` | 分类页 metadata 描述 |
| `apps/web/src/app/(forum)/forum/topic/[id]/page.tsx` | 帖子详情 metadata 描述 |
| `services/api/src/openapi.rs` | OpenAPI 标题与描述 |
| `services/api/src/main.rs` | 启动日志品牌名 |
| `README.md` | 项目标题与简介 |
| `docs/ARCHITECTURE.md` | 文档标题与产品说明 |
| `docs/API.md` | 文档标题 |
| `docs/DEPLOYMENT.md` | 文档标题 |
| `docs/DEVELOPMENT.md` | 新增本条开发记录 |

### 数据库与 API 变化

- 数据库：无。
- API：仅 OpenAPI 文档标题/描述和启动日志中的展示名称变化；未新增、删除或修改接口，未改变请求/响应结构、错误码或权限。`/health/live`、`/health/ready`、`/api/v1/system/info` 的技术服务标识仍为 `threi-api`。

### 测试与结果

- `./scripts/check.sh`：通过（Rust fmt、Clippy、16 个测试、TypeScript、ESLint、Prettier）。
- `cargo build --release --locked --bins`：通过。
- `npm run build`：通过。
- 本地预览已重新构建并重启：
  - 页面标题为 `ThRei 社区`；
  - 导航、页脚与首页显示 `ThRei`；
  - OpenAPI 标题为 `ThRei API`；
  - `/`、`/forum`、`/account`、`/admin` 均返回 200。
- 未执行：Docker 镜像构建、容器启动、Nginx/HTTPS 验证（本机无 Docker；与本次品牌修改无关）。

## 2026年10月23日 19时47分47秒 项目架构初始化

### 背景

threi 是准备长期运营的社区系统，需要统一承载官网、论坛、用户中心和管理面板，并共享后端 API、身份和权限体系。

本次任务开始前，`/home/xbdj/threi` 是**空目录**，且没有 Git 仓库；因此不存在需要保留或兼容的旧文件、旧数据或旧 Git 历史。本次初始化的目标是：

- 建立 Next.js + Rust Axum + PostgreSQL + Redis 的 Monorepo 骨架；
- 明确前后端职责、路由布局边界、API 前缀、错误结构、日志和请求追踪；
- 建立最小数据库迁移、健康检查、OpenAPI 和生产导向的 Docker Compose / Nginx 配置；
- 建立可维护的架构、API、部署、CHANGELOG 与开发日志文档；
- 不提前实现完整登录、论坛、管理后台等业务。

环境检查结果：Node.js 24.19.0、npm 11.17.0、Rust/Cargo 1.97.1、Git 2.53.0 可用；**没有 Docker CLI/daemon**，也没有本机 PostgreSQL/Redis 服务。因此本次实际完成了依赖安装、前后端构建和静态检查，并使用临时 PostgreSQL 17.11 + 临时 Redis 7.4.11 验证了迁移、健康检查和端到端请求；Docker 镜像构建与 Nginx 实际启动**未执行**。

### 变更内容

#### 1. 仓库与工程基础

- 初始化 Git 仓库（`main` 分支），**未创建任何 commit，也未 push**。
- 建立根级 `.gitignore`、`.editorconfig`、`.env.example`。
- 采用 `apps/web` + `services/api` 双工程结构；不引入根级 JavaScript workspace，避免前后端依赖互相牵制。
- 增加 `compose.yaml`（生产导向）和 `compose.dev.yaml`（仅把 PostgreSQL/Redis 发布到 `127.0.0.1` 供本地开发）。
- 增加 `scripts/check.sh`（格式、静态检查、测试）与 `scripts/backup-db.sh`（容器内 `pg_dump`）。

#### 2. 前端（apps/web）

- 使用 Next.js 16 App Router、React 19、TypeScript 5.9 strict、Tailwind CSS 4。
- 建立 route groups：
  - `(site)`：`/` 官网；
  - `(forum)`：`/forum`、`/forum/[category]`、`/forum/topic/[id]`；
  - `(account)`：`/account`；
  - `(admin)`：`/admin`，使用独立侧边栏布局，与公开站点分离。
- 根布局只负责 `html/body`、全局样式、字体栈和 TanStack Query Provider；各业务分组拥有独立 layout。
- 默认使用 Server Components；仅查询 Provider、API 状态卡片、论坛搜索表单、错误边界和 Radix 基础组件使用 `"use client"`。
- 实现 shadcn/ui 风格基础组件：Button、Card、Badge、Input、Label、Separator、Skeleton、Alert；统一 Lucide 图标和 Tailwind 设计 token。
- 建立统一 API 客户端：
  - 浏览器端读取 `NEXT_PUBLIC_API_BASE_URL`，空值表示同源；
  - 服务端使用 `server-only` + `API_INTERNAL_URL`，转发 Cookie 与请求 ID；
  - 统一超时、凭据、JSON 解析、错误归一化和 `ApiError`（含 `requestId`）；
  - `src/services/system.ts` 使用 Zod 校验 `/api/v1/system/info` 响应。
- 建立开发期同源代理：`next.config.ts` 按 `API_INTERNAL_URL` 生成 `/api/v1/:path*` rewrite；生产由 Nginx 直接转发 `/api/`。
- `typecheck` 脚本先运行 `next typegen`，确保在没有 `.next` 缓存的干净克隆中也能解析 Next 生成的路由类型。
- 实现 SEO：标题模板、metadataBase、OpenGraph/Twitter、`robots.ts`、`sitemap.ts`、`manifest.ts`、`icon.svg`、动态分类/帖子 metadata。
- 实现错误与空状态：`not-found.tsx`、`error.tsx`、`global-error.tsx`、`healthz` 路由。
- 管理面板明确标注“认证与权限尚未实现”，不展示虚假管理数据；用户中心、论坛页面均为骨架并标记待实现能力。
- 由于 `forum/loading.tsx` 的父级 Suspense 会导致动态段 `notFound()` 在流式响应中返回 200，移除了该 loading 边界，使非法分类/帖子标识返回真正的 404 状态码。

#### 3. 后端（services/api）

- Rust 1.97.1 + Axum 0.8 + Tokio；`rust-toolchain.toml` 固定工具链。
- 采用模块化单体结构：config、routes、middleware、modules（仅边界说明）、infrastructure、errors，以及独立 `migrate` 二进制。
- 统一请求管道：请求 ID → 安全响应头 → Tracing → CORS → 超时 → 请求体限制 → 路由。
- 请求 ID 支持复用 Nginx `$request_id`，仅接受 1–128 位安全字符，否则生成 UUID；响应返回 `x-request-id`。
- 统一错误类型 `AppError`，错误响应为 `{"error":{"code","message","details"}}`，内部错误只写服务端日志。
- 配置模块从环境变量加载并校验；`Settings` 不实现 `Debug`，避免连接串被意外打印。
- PostgreSQL 连接池：max/min、acquire timeout、启动连接总超时；启动失败安全退出。
- Redis 可选/必需模式：不可用时可按配置降级或阻止启动；使用 `ConnectionManager` 支持恢复后重连。
- 健康检查：
  - `/health/live`：进程存活；
  - `/health/ready`：并行探测 PostgreSQL/Redis，返回 `ok`/`degraded`/`unavailable`，不泄露地址或凭据；
  - Nginx 对两个路径返回 404，健康检查只在容器/编排内部使用。
- 新增 `/api/v1/system/info`，返回服务名、版本、环境和 API 版本，用于前端连通性验证。
- utoipa 生成 OpenAPI 与 Swagger UI；使用 `vendored` 资源，避免构建期下载；`API_DOCS_ENABLED` 控制挂载，生产默认关闭。
- 统一 CORS 白名单、请求超时（504 JSON）、请求体大小限制、安全响应头。
- 优雅停机：监听 Ctrl+C / SIGTERM，停止接收新请求并等待连接排空。

#### 4. 数据库与迁移

- 使用 SQLx 0.9 + PostgreSQL 17，连接池配置可通过环境变量调整。
- 迁移由 `migrate` 二进制执行，API 启动**不会**自动建表、删库或重置数据。
- 新增最小初始迁移 `20261023110000_init.sql`：仅启用 `pgcrypto` 并创建 `set_updated_at()` 触发器函数，不创建业务表。
- SQLx 自动创建 `_sqlx_migrations` 记录版本、校验和与执行结果；本次尚未引入 `.sqlx` 离线缓存，因为当前没有使用编译期查询宏。文档已明确后续生成/提交流程。

#### 5. 部署

- 前端 Dockerfile：Node 24.19.0 多阶段构建，输出 Next.js standalone；运行镜像仅含运行产物，使用 UID 1001。
- 后端 Dockerfile：Rust 1.97.1 多阶段构建；运行镜像基于 Debian bookworm-slim，含 API + migrator + tini，使用 UID 10001。
- Compose 服务：`nginx`、`web`、`api`、`migrate`、`postgres`、`redis`。
- 网络：`edge`（Nginx/Web/API）与 `internal: true`（API/PostgreSQL/Redis）；数据库和 Redis 不发布宿主机端口。
- 默认仅 Nginx 发布 `127.0.0.1:80 -> 8080`；生产公网需显式设置 `HTTP_BIND=0.0.0.0` 并配置防火墙。
- PostgreSQL 使用命名卷 `postgres_data`；Redis 使用 `redis_data` + AOF everysec + `allkeys-lru`，明确其缓存/临时状态定位。
- 健康检查与依赖顺序：PostgreSQL/Redis healthy → migrate 成功 → API ready → Web healthy → Nginx。
- Nginx 使用 `nginx/nginx-unprivileged` 非特权镜像；HTTP 模板通过 `SERVER_NAME` 注入；提供 HTTPS 示例模板。
- 所有镜像使用固定版本标签，不使用 `latest`。
- 多阶段构建避免把 Rust/Node 编译工具链带入运行镜像。

#### 6. 文档与规范

- 创建 README、ARCHITECTURE、DEVELOPMENT、CHANGELOG、API、DEPLOYMENT。
- 明确 Server/Client Components 边界、模块化单体分层、API 版本、错误结构、分页/认证规划、数据库迁移规则、SQLx 离线流程、Redis 定位、备份恢复、升级回滚与 HTTPS 步骤。
- 文档明确区分“已实现”和“待实现”，尤其标注认证、CSRF、限流、RBAC、管理审计、HTTPS 尚未实现。
- 记录本次环境无 Docker，未伪造镜像构建或容器启动结果。

#### 7. 验证过程中修复的问题

- `@hookform/resolvers@6.0.0` 的 optional peer 依赖在 npm 11 下与 `effect` 版本冲突；改用兼容的 `5.9.2`（仅 peer 依赖 `react-hook-form`），安装与构建通过。
- utoipa Swagger UI 的 `.url()` 已注册 OpenAPI JSON 路由，额外手写同一路由导致启动 panic（`Overlapping method route`）；移除重复路由后测试通过。
- Next.js 16 构建自动将 `tsconfig.json` 的 `jsx` 调整为 `react-jsx`；保留该官方要求。
- Dockerfile 使用命名字符串作为 `USER` 被 hadolint 提示，改为数字 UID/GID；Web 健康检查改为 JSON 形式。
- 移除论坛父级 `loading.tsx`，修复非法动态参数在流式渲染下返回 200 的问题；重新构建后非法分类/帖子返回 404。

### 涉及文件

> 以下为本次实际新增的全部项目文件（不含 `node_modules/`、`target/`、`.next/` 等构建产物）。**没有删除或修改任何既有用户文件**（起始目录为空）。

#### 根目录与部署

| 文件 | 用途 |
| --- | --- |
| `.editorconfig` | 统一缩进、换行、UTF-8 与文件类型规则 |
| `.env.example` | Compose 环境变量模板，仅占位符，不含真实密钥 |
| `.gitignore` | 忽略环境文件、构建产物、备份、TLS 证书与本地文件 |
| `README.md` | 项目概览、快速开始、本地开发、检查、安全现状与文档索引 |
| `compose.yaml` | 生产导向的 Web/API/DB/Redis/Nginx 编排、网络、卷、健康检查 |
| `compose.dev.yaml` | 仅开发用：把 PostgreSQL/Redis 发布到 127.0.0.1 |
| `deploy/nginx/nginx.conf` | Nginx 主配置：日志、gzip、临时路径、upgrade map、include |
| `deploy/nginx/conf.d/default.conf.template` | HTTP 反向代理模板；SERVER_NAME 注入；隐藏健康检查 |
| `deploy/nginx/https.conf.example` | HTTPS/TLS 配置示例，未默认启用 |
| `scripts/check.sh` | 一键运行 Rust/前端格式、Lint、类型检查与测试 |
| `scripts/backup-db.sh` | 在 PostgreSQL 容器内执行 pg_dump 生成备份 |

#### 文档

| 文件 | 用途 |
| --- | --- |
| `docs/ARCHITECTURE.md` | 整体架构、技术选型、目录、边界、认证规划、部署拓扑、决策与限制 |
| `docs/DEVELOPMENT.md` | 本开发变更日志及维护规则 |
| `docs/CHANGELOG.md` | 版本级变更模板与 0.1.0 未发布汇总 |
| `docs/API.md` | API 前缀、当前接口、错误码、追踪、认证/分页/OpenAPI 约定 |
| `docs/DEPLOYMENT.md` | 环境变量、部署、迁移、日志、排障、备份恢复、升级回滚、HTTPS |

#### 前端 `apps/web`

| 文件 | 用途 |
| --- | --- |
| `package.json` | 前端依赖、脚本、Node 版本约束（依赖使用精确版本） |
| `package-lock.json` | npm 锁定文件 |
| `tsconfig.json` | TypeScript strict、路径别名与 Next 插件配置 |
| `next.config.ts` | standalone 输出、安全响应头、开发期 API rewrite |
| `next-env.d.ts` | Next.js 生成并保留的 TypeScript 类型引用 |
| `postcss.config.mjs` | Tailwind CSS PostCSS 插件 |
| `eslint.config.mjs` | ESLint flat config，继承 Next core-web-vitals/typescript |
| `.prettierrc.json` / `.prettierignore` | Prettier 规则与忽略范围 |
| `components.json` | shadcn/ui 风格组件配置 |
| `.env.example` | 本地前端环境变量模板 |
| `.dockerignore` | 排除 node_modules、.next、环境文件等 |
| `Dockerfile` | 多阶段 standalone 构建，非 root 运行与健康检查 |
| `src/app/layout.tsx` | 根布局、metadata、QueryProvider、跳转主内容链接 |
| `src/app/globals.css` | Tailwind 4 引入、设计 token、基础样式 |
| `src/app/error.tsx` | 路由错误边界（客户端） |
| `src/app/global-error.tsx` | 根级严重错误页面 |
| `src/app/not-found.tsx` | 统一 404 页面与 metadata |
| `src/app/healthz/route.ts` | Web 容器健康检查端点 |
| `src/app/icon.svg` | 应用图标 |
| `src/app/manifest.ts` | PWA manifest |
| `src/app/robots.ts` | robots.txt 规则 |
| `src/app/sitemap.ts` | 站点地图（仅公开可索引页面） |
| `src/app/(site)/layout.tsx` | 官网布局边界 |
| `src/app/(site)/page.tsx` | 官网首页骨架 |
| `src/app/(forum)/layout.tsx` | 论坛布局边界 |
| `src/app/(forum)/forum/page.tsx` | 论坛首页骨架、搜索参数展示 |
| `src/app/(forum)/forum/[category]/page.tsx` | 分类页骨架、参数校验与动态 metadata |
| `src/app/(forum)/forum/topic/[id]/page.tsx` | 帖子详情骨架、参数校验与动态 metadata |
| `src/app/(forum)/forum/loading.tsx` | **创建后移除**：父级 Suspense 使 `notFound()` 返回 200，最终不存在于仓库 |
| `src/app/(account)/layout.tsx` | 用户中心布局边界 |
| `src/app/(account)/account/page.tsx` | 用户中心骨架与安全说明 |
| `src/app/(admin)/layout.tsx` | 管理面板独立布局、未鉴权警告 |
| `src/app/(admin)/admin/page.tsx` | 系统概览、API 状态、未来模块边界 |
| `src/components/layout/brand.tsx` | 品牌标识 |
| `src/components/layout/page-container.tsx` | 统一内容宽度容器 |
| `src/components/layout/site-header.tsx` | 公开导航 |
| `src/components/layout/site-footer.tsx` | 公开页脚 |
| `src/components/layout/site-shell.tsx` | 官网/论坛/用户中心共享框架与 main landmark |
| `src/components/ui/alert.tsx` | 提示组件 |
| `src/components/ui/badge.tsx` | 徽章组件 |
| `src/components/ui/button.tsx` | 按钮组件 |
| `src/components/ui/card.tsx` | 卡片组件 |
| `src/components/ui/input.tsx` | 输入框组件 |
| `src/components/ui/label.tsx` | 表单标签（Radix） |
| `src/components/ui/separator.tsx` | 分隔线（Radix） |
| `src/components/ui/skeleton.tsx` | 加载骨架 |
| `src/features/admin/components/admin-nav.tsx` | 管理侧边栏/移动导航，标注待实现模块 |
| `src/features/admin/components/system-status-card.tsx` | 浏览器端 TanStack Query 连通性卡片 |
| `src/features/forum/components/forum-search-form.tsx` | React Hook Form + Zod 搜索表单 |
| `src/features/forum/lib/params.ts` | 分类/帖子参数与搜索参数 Zod schema |
| `src/hooks/use-system-status.ts` | 系统状态 Query hook |
| `src/lib/api/client.ts` | 统一 API 客户端、超时与 ApiError |
| `src/lib/api/browser.ts` | 浏览器端 API 客户端单例 |
| `src/lib/api/server.ts` | 服务端 API 客户端（server-only，转发 Cookie/请求 ID） |
| `src/lib/query/query-provider.tsx` | TanStack Query Provider |
| `src/lib/site-config.ts` | 站点 metadata、导航和 URL 解析 |
| `src/lib/utils.ts` | `cn` 类名工具 |
| `src/services/system.ts` | `/system/info` 类型化服务与 Zod 校验 |
| `src/types/api.ts` | API 错误与小范围共享类型 |

#### 后端 `services/api`

| 文件 | 用途 |
| --- | --- |
| `Cargo.toml` | Rust 依赖、edition 2024、lint 策略 |
| `Cargo.lock` | Rust 锁定文件 |
| `rust-toolchain.toml` | 固定 Rust 1.97.1 + rustfmt/clippy |
| `.env.example` | 本地 API 环境变量模板 |
| `.dockerignore` | 排除 target、环境文件等 |
| `Dockerfile` | Rust 多阶段构建，非 root，API + migrator + 健康检查 |
| `migrations/20261023110000_init.sql` | 最小初始迁移：pgcrypto 与 set_updated_at() |
| `src/main.rs` | 启动、配置、日志、连接、HTTP serve、优雅停机 |
| `src/lib.rs` | 模块导出（测试与二进制复用） |
| `src/app.rs` | 路由组装、中间件、CORS、超时、安全头、文档挂载 |
| `src/state.rs` | AppState（DB、Redis、环境、启动时间） |
| `src/openapi.rs` | utoipa OpenAPI 与 Swagger UI 路由 |
| `src/config/mod.rs` | 环境配置加载、校验与单元测试 |
| `src/errors/mod.rs` | AppError、统一错误响应与 schema |
| `src/middleware/mod.rs` | 中间件模块声明 |
| `src/middleware/request_id.rs` | 请求 ID 注入/透传、校验、trace span |
| `src/modules/mod.rs` | 未来业务模块边界与依赖规则说明 |
| `src/infrastructure/mod.rs` | 基础设施模块声明 |
| `src/infrastructure/database.rs` | PostgreSQL 连接池与就绪探测 |
| `src/infrastructure/redis.rs` | Redis 连接管理器、可选/必需模式与就绪探测 |
| `src/infrastructure/telemetry.rs` | 开发/生产日志初始化 |
| `src/routes/mod.rs` | `/api/v1` 路由装配 |
| `src/routes/health.rs` | live/ready handler 与响应 schema |
| `src/routes/system.rs` | `/system/info` handler 与 schema |
| `src/routes/fallback.rs` | 统一 404/405 |
| `src/bin/migrate.rs` | 独立迁移二进制 |
| `tests/http_contract.rs` | 健康检查、错误、请求 ID、OpenAPI、CORS 合约测试 |

### 数据库与 API 变化

#### 数据库

- **初始迁移：** `services/api/migrations/20261023110000_init.sql`
  - `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
  - `CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger`
  - 为函数添加注释。
- 未创建任何业务表、索引或约束；业务表留待对应模块实现。
- SQLx 在首次迁移时创建 `_sqlx_migrations`，记录版本、描述、校验和、成功状态、执行时间。
- 迁移由 `migrate` 二进制执行；API 启动不执行迁移，不删除/重建数据库。
- 迁移为 forward-only；失败处理、备份与恢复已写入 `docs/DEPLOYMENT.md`。

#### API

新增（全部为本项目首次定义，不存在旧客户端兼容问题）：

| 方法 | 路径 | 变化 |
| --- | --- | --- |
| GET | `/health/live` | 新增进程存活检查；返回 `status/service/version` |
| GET | `/health/ready` | 新增依赖就绪检查；200 `ok/degraded` 或 503 `unavailable`；不泄露依赖地址 |
| GET | `/api/v1/system/info` | 新增非敏感服务元信息；返回 `name/version/environment/api_version` |
| GET | `/api/v1/openapi.json` | 新增 OpenAPI JSON（`API_DOCS_ENABLED` 控制） |
| GET | `/api/v1/docs` | 新增 Swagger UI（303 跳转，`API_DOCS_ENABLED` 控制） |

- 错误响应统一为 `{"error":{"code","message","details"}}`，错误响应带 `Cache-Control: no-store` 和 `x-request-id`。
- 所有接口默认支持 CORS 白名单（生产同源时为空）；预检暴露 `x-request-id`。
- 健康检查端点位于根路径，Nginx 返回 404，不通过公网暴露。
- 认证、权限、分页、业务接口未实现，已在 `docs/API.md` 标注为设计约定/待实现。
- OpenAPI paths 已注册上述三个业务/基础设施路径（health 两个、system 一个）。

#### 配置

新增环境变量包括：`APP_ENV`、`API_HOST`、`API_PORT`、`DATABASE_URL`、`DATABASE_MAX_CONNECTIONS`、`DATABASE_MIN_CONNECTIONS`、`DATABASE_ACQUIRE_TIMEOUT_SECS`、`DATABASE_CONNECT_TIMEOUT_SECS`、`REDIS_URL`、`REDIS_REQUIRED`、`REDIS_CONNECT_TIMEOUT_SECS`、`CORS_ALLOWED_ORIGINS`、`API_DOCS_ENABLED`、`REQUEST_TIMEOUT_SECS`、`REQUEST_BODY_LIMIT_BYTES`、`RUST_LOG`、`LOG_JSON`；Compose 另有 `SITE_URL`、`HTTP_BIND`、`HTTP_PORT`、`SERVER_NAME`、`IMAGE_TAG`、PostgreSQL/Redis 凭据等。

### 测试与结果

#### 已执行并通过

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| Rust 格式 | `cargo fmt --all -- --check` | 通过 |
| Rust Clippy | `cargo clippy --all-targets -- -D warnings` | 通过（含 pedantic） |
| Rust 测试 | `cargo test` | 通过：配置单测 6 个 + HTTP 合约测试 10 个，共 16 个；0 失败 |
| Rust release 构建 | `cargo build --release --locked --bins` | 通过，产出 `threi-api` 15 MB、`migrate` 7.3 MB |
| TypeScript | 删除 `.next` 后执行 `npm run typecheck`（先 `next typegen`，再 `tsc --noEmit`） | 通过，干净环境可生成路由类型 |
| ESLint | `npm run lint`（`--max-warnings=0`） | 通过 |
| Prettier | `npm run format:check` | 通过 |
| Next.js 生产构建 | `npm run build` | 通过；生成 `/`、`/forum`、`/forum/[category]`、`/forum/topic/[id]`、`/account`、`/admin` 等路由 |
| 前端生产依赖审计 | `npm audit --omit=dev --registry=https://registry.npmjs.org` | 0 个漏洞 |
| Compose 配置 | 独立 Compose v5.6.1：`docker-compose --env-file .env.example -f compose.yaml config` | 通过（退出码 0） |
| Compose 开发覆盖 | `... -f compose.yaml -f compose.dev.yaml config` | 通过；PostgreSQL/Redis 仅绑定 `127.0.0.1` |
| Nginx 模板变量 | `SERVER_NAME=... envsubst` + 花括号计数 | 通过；无残留 Compose 变量 |
| Shell 脚本 | ShellCheck 0.11.0 `scripts/*.sh` | 通过 |
| Dockerfile 静态检查 | hadolint 2.15.1 | 2 个 `DL3008` 警告（apt 包未固定版本，固定版本会随 Debian 更新失效）；0 个错误 |
| 密钥扫描 | 对仓库文本做占位/高熵凭据模式检索 | 未发现真实密钥（仅 `.env.example` 占位符） |

#### 使用临时真实依赖完成的验证（未使用任何未知/生产数据库）

为弥补本机没有 Docker/PostgreSQL/Redis 的限制，在 `/tmp/threi-it` 启动了临时实例：

- PostgreSQL 17.11（embedded binaries，端口 55432，仅监听 127.0.0.1）；
- Redis 7.4.11（源码构建，端口 56379，仅监听 127.0.0.1）；
- API 绑定 `127.0.0.1:58080`，使用上述临时依赖。

实际结果：

1. `cargo run --bin migrate` 成功执行初始迁移，并记录到 `_sqlx_migrations`；API 启动路径确认不会执行迁移。
2. `/health/live` 返回 200；`/health/ready` 返回 200，`database=ok`、`redis=ok`。
3. `/api/v1/system/info` 返回 200 且仅包含非敏感元信息。
4. 传入 `x-request-id: nginx0123456789abcdef` 后响应保留同一 ID；无有效 ID 时生成 UUID。
5. 未知路由返回 404 统一错误；`POST /health/live` 返回 405 统一错误；错误响应含 `Cache-Control: no-store`。
6. CORS 预检对配置允许的 `http://localhost:3000` 返回允许头；未配置来源不会获得允许头。
7. `/api/v1/openapi.json` 返回 200，paths 包含 `/health/live`、`/health/ready`、`/api/v1/system/info`；Swagger UI 请求 303 到 `/api/v1/docs/`。
8. 停止 Redis 后，因 `REDIS_REQUIRED=true`，`/health/ready` 返回 503 且 `redis=unavailable`；API 其他接口仍可响应；重启 Redis 后 readiness 自动恢复为 200。
9. 使用 Next.js 生产服务器（端口 3300，避开本机已有服务）验证：
   - `/`、`/forum`、`/forum/general`、`/forum/topic/example-topic`、`/account`、`/admin` 均返回 200；
   - `/admin` 服务端渲染包含 `threi-api`、`系统概览`、`API 连通性`，说明 Server Component 经 `API_INTERNAL_URL` 取数成功；
   - `/api/v1/system/info` 经 Next rewrite 返回 200；
   - 非法分类 `/forum/UPPER_CASE`、`/forum/bad.slug`、非法帖子标识返回 **404** 并渲染 not-found 页面；
   - `/robots.txt`、`/sitemap.xml` 正常生成。

#### 未执行或受环境限制

- **未执行 Docker 镜像构建**（`docker compose build`）：当前环境没有 Docker CLI/daemon。
- **未启动 Compose 服务**（`docker compose up -d`、`docker compose ps`）：同上。
- **未执行 `nginx -t`**：没有本机 Nginx 或 Docker；仅验证了模板替换和花括号平衡。
- **未验证 HTTPS/证书续期**：没有域名与证书。
- **未执行 cargo-audit**：环境未安装该工具。
- **未执行 CI**：本次没有配置 CI。
- **未执行自动化数据库集成测试**：迁移/就绪/端到端验证为上述临时实例上的手工验证；`cargo test` 不依赖真实数据库。
- **未执行组件/E2E 测试**：前端仅有构建、类型检查与手工页面验证。
- **前端完整 `npm audit`（含 devDependencies）**：报告 5 个 high，来源为 ESLint 工具链的 `braces` 传递依赖；`npm audit fix --force` 会强制降级到 `eslint-config-next@14`，属于破坏性变更，因此未执行。生产依赖审计为 0 漏洞，后续应跟踪上游修复。

#### 已知问题与风险

- 管理面板仍公开可见，生产前必须完成认证/授权或临时网络限制。
- Dockerfile 的 apt 包未固定版本（hadolint DL3008）；这是为了跟随 Debian 安全更新，镜像基础标签已固定。
- 无 CI、自动备份、指标、集中日志和 HTTPS 自动化。
- 当前 `.sqlx` 不存在（尚未使用编译期查询宏）；引入后必须按文档流程生成并提交。
- 临时验证实例位于 `/tmp/threi-it`，不属于项目文件；验证后已停止 PostgreSQL/Redis/API/Web 进程并删除该目录。

### 交付状态

本次仅完成架构初始化，**没有**实现用户要求的完整官网、论坛或管理后台业务。未创建 Git commit，未 push，未执行任何破坏性 Git 操作。代码与文档中的“已实现/待实现”边界以本记录和 `docs/ARCHITECTURE.md` 为准。
