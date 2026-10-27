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

## 2026年10月28日 02时35分17秒 取消 basebans 检测并固定接管命令（1.8.1）

### 背景

用户表示会直接删除 basebans，不需要插件检测；检测本身也没有必要，增加启动逻辑。

### 变更内容

- 版本 1.8.1。
- 删除 `FindPluginByFile("basebans.smx")` / `GetPluginStatus` 检测。
- `sm_ban` / `sm_addban` / `sm_unban` / `sm_banip` / `sm_unbanip` 现在**始终注册**，
  运行时和启动时都不再检查 basebans。
- 安装说明改为：覆盖 1.8.1 后先不要 reload，先删除/卸载 basebans，再
  `sm plugins reload ThRei_Players`，避免同名命令冲突。
- 纯插件封禁、即时解封、连接时自定义提示、`configs/threi_bans.cfg` 均沿用 1.8.0。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`

### 插件包

- `ThRei_Players-1.8.1`：`/home/threi/ThRei_Players-1.8.1/`、`.zip`、`.tar.gz`，并复制到
  `/mnt/c/Users/15155/Downloads/`。
- `.smx` SHA-256：`f193dbb1c3f4ff92e8fabcb43a26de410d481181ec98072bea7102c5a79291d6`。

### 测试与结果

- SourcePawn Compiler 1.11.0.6970 编译通过，无警告。
- 未执行真实游戏服务器测试；需要用户删除 basebans 后安装 1.8.1 验证。
- 无网站/API 变更。

## 2026年10月28日 02时32分15秒 纯插件封禁与脱离 basebans（1.8.0）

### 背景

用户要求完全脱离 basebans，并达到：秒封禁、秒解封、解封后立即可以进入服务器，重连时显示
我们自己的封禁提示，而不是 Valve 的“您已被禁止使用此服务器”。

### 原因

1.7.x 为防止插件重载/API 故障，把 ThRei 封禁写成引擎封禁（`BanIdentity`/`BanClient`）。
引擎会在 SourceMod 检查之前拒绝连接，客户端显示 Valve 默认提示；解封还要等待 `removeid`
和封禁文件重写。

### 变更内容

- 版本 1.8.0。
- 移除本插件所有 `BanIdentity` 调用：`sm_threi_ban` / `sm_threi_addban` / 网站下发封禁 /
  `sm_threi_banip` 都不再写引擎封禁。
- 新增插件封禁存储 `addons/sourcemod/configs/threi_bans.cfg`（KeyValues）：
  - 启动时加载 SteamID/IP 封禁、到期时间和原因；
  - 封禁/解封/快照刷新时保存；
  - `CheckClientAccess` 在第一次快照加载前也先检查文件封禁，避免 fail-open 放行；
  - 连接时同时检查 SteamID 和 IP，用 `KickForBan` 显示 `sm_threi_ban_kick_message` + 原因。
- `sm_threi_unban` / `sm_threi_unbanip` 成功后直接删除内存和文件条目，不再等待引擎解封；
  仍保留一次 `RemoveBan` 用于清理 1.7.x/basebans 旧引擎封禁。
- 首次成功加载快照时，对当前网站封禁和插件 IP 封禁执行一次 `RemoveBan`，清理旧版引擎封禁，
  使重连由插件接管并显示自定义提示。
- basebans 未运行时自动注册 `sm_ban` / `sm_addban` / `sm_unban` / `sm_banip` / `sm_unbanip`
  兼容命令；basebans 仍加载时只注册 `sm_threi_*`，避免冲突。
- 更新安装说明：先安装 1.8.0，再卸载 basebans 并重载插件；说明旧引擎封禁清理和
  `configs/threi_bans.cfg` 权限。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`

### 插件包

- `ThRei_Players-1.8.0`：`/home/threi/ThRei_Players-1.8.0/`、`.zip`、`.tar.gz`，并复制到
  `/mnt/c/Users/15155/Downloads/`。
- `.smx` SHA-256：`85277af242872d364539eec9031bf071edbdb6d3a80e21e28b1b9910757906bf`。

### 测试与结果

- SourcePawn Compiler 1.11.0.6970 编译通过，无警告。
- **未执行**：真实游戏服务器测试；需要用户安装 1.8.0、卸载 basebans、重载插件后验证：
  封禁后重连显示自定义原因；网站解封后立即重连；`configs/threi_bans.cfg` 正确写入。
- 网站/API 没有变更，不需要重新部署 API。
- 已知取舍：封禁只在插件加载时生效；插件未加载会失去封禁保护。封禁文件需要可写并纳入备份。

## 2026年10月28日 02时18分29秒 支持不加引号的 SteamID2/3 参数（1.7.3）

### 背景

用户在服务器执行：

```text
sm_threi_unban STEAM_0:0:914966745
```

得到 `[ThRei] 无法识别 SteamID：STEAM_0`。

### 原因

Source 引擎的 `CCommand` 分词器 break set 是 `{}()':`，包含冒号。未加引号时
`STEAM_0:0:914966745` 被拆成 `STEAM_0`、`0`、`914966745` 三个参数，`GetCmdArg(1)` 只能
拿到 `STEAM_0`。

### 变更内容

- 版本 1.7.3。
- 新增 `ReadBanCommandArgs` / `ReadFirstArg`：读取 `GetCmdArgString()` 的原始参数串，再用
  `BreakString` 只按空白（支持引号）拆分，保留 SteamID2/3 和 IPv6 中的冒号。
- `sm_threi_ban`、`sm_threi_addban`、`sm_threi_unban`、`sm_threi_banip`、`sm_threi_unbanip`
  全部改用原始参数解析；不加引号也可用，加引号仍兼容。
- 错误提示补充“SteamID2/3 可加引号”。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`

### 插件包

- `ThRei_Players-1.7.3`：`/home/threi/ThRei_Players-1.7.3/`、`.zip`、`.tar.gz`，并复制到
  `/mnt/c/Users/15155/Downloads/`。
- `.smx` SHA-256：`1cdb0111bc2ae060135110405338129fb69b232f37fb0c51ca9811ba2d16adac`。

### 测试与结果

- SourcePawn Compiler 1.11.0.6970 编译通过，无警告。
- 按 Source SDK `CCommand::Tokenize` 的 break set 确认问题来自引擎分词，不是插件 ID 解析。
- **未执行**：真实游戏服务器 1.7.3 命令测试；需要用户在 1服 直接执行
  `sm_threi_unban STEAM_0:0:914966745` 验证。
- 无网站/API 变更。

## 2026年10月28日 02时14分29秒 修复封禁上报 400 与队列堵塞（1.7.2）

### 背景

用户反馈 1.7.1 使用后“没有同步网站”。生产日志显示：

- 2026-10-27 18:02:35 UTC：`/plugin/ban-report` 返回 204，账号/服务器/IP 记录已生成；
- 18:04:44 UTC：`/plugin/unban-report` 返回 204；
- 18:10:57 UTC：`/plugin/ban-report` 返回 **400**，之后没有新记录。

400 的原因是 JSON 请求体解析失败（典型为玩家名包含非法 UTF-8 字节）。1.7.1 的上报失败
逻辑只丢弃 422，400 会一直退避重试并停留在队列头部，导致后续封禁上报全部被堵住。

### 变更内容

- 新增 `IsValidUtf8` 校验：
  - 玩家名非法时回退为 SteamID；
  - 原因非法时回退为“管理员封禁”/“服务器封禁”；
  - 避免 `serde_json` 因非法 Unicode 返回 400。
- `OnBanReportComplete` 对 HTTP 4xx（408/429 除外）记录响应体后丢弃该条上报，不再无限
  重试；网络错误和 5xx 继续退避重试。这样一条坏请求不会堵塞后续队列。
- 版本 1.7.2。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`

### 插件包

- `ThRei_Players-1.7.2`：`/home/threi/ThRei_Players-1.7.2/`、`.zip`、`.tar.gz`，并复制到
  `/mnt/c/Users/15155/Downloads/`。
- `.smx` SHA-256：`d8b36033a75f287902375e3f50e1a2378fa95c69497e10d726adb781a01f2d0e`。

### 测试与结果

- SourcePawn Compiler 1.11.0.6970 编译通过，无警告。
- 用非法 UTF-8 的 `playerName` 请求生产 `/plugin/ban-report`，确认返回 400
  `invalid unicode code point`；合法请求无令牌返回 401，说明 400 确为 JSON 解析失败。
- 生产 18:02 的成功记录和 18:04 的解封记录已核对，测试未新增数据。
- **未执行**：真实游戏服务器 1.7.2 上报测试。需要用户安装 1.7.2 后重新封禁一次确认。

## 2026年10月28日 02时07分14秒 插件封禁命令支持 SteamID2/3（1.7.1）

### 背景

用户测试 1.7.0 时反馈：`STEAM_0:0:914966745` 无法识别，只有 SteamID64 可用。

### 原因

`sm_threi_ban` / `sm_threi_addban` 只把 17 位 SteamID64 当 ID，其他格式会进入
`FindTarget` 当玩家名查找；`TrySteamIdTo64` 只接入了 `sm_threi_unban`。

### 变更内容

- 1.7.1 版本号。
- `sm_threi_ban` 在解析目标前先调用 `TrySteamIdTo64`，支持 SteamID64、SteamID2
  （`STEAM_0:0:...` / `STEAM_1:...`）和 SteamID3（`[U:1:...]` / `U:1:...`）。
- `sm_threi_addban` 同样改为 `TrySteamIdTo64`，离线按转换后的 SteamID64 封禁。
- `TrySteamIdTo64` 增加数字校验、SteamID3 无方括号形式和 account ID 溢出保护。
- 在线目标仍遵循 SourceMod immunity；离线 SteamID 直接封禁。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`

### 插件包

- `ThRei_Players-1.7.1`：`/home/threi/ThRei_Players-1.7.1/`、`.zip`、`.tar.gz`，并复制到
  `/mnt/c/Users/15155/Downloads/`。
- `.smx` SHA-256：`a3ad0881e58b19f5d36d210e8c6bdb1e9665aadede81ec1b17530e2b89f026b4`。

### 测试与结果

- SourcePawn Compiler 1.11.0.6970 编译通过，无警告。
- 转换公式核对：`STEAM_0:0:914966745` → account ID `1829933490` → SteamID64
  `76561199790199218`。
- **未执行**：真实游戏服务器命令测试；需要用户在 1服 用 `sm_threi_addban "STEAM_0:0:..."`、
  `sm_threi_unban "STEAM_0:0:..."` 验证。
- 本次没有网站/API 变更，无需重新部署 API。

## 2026年10月27日 23时17分08秒 插件内置封禁命令与分组解封（1.7.0）

### 背景

用户希望最终用 `ThRei_Players` 完全替代 `basebans.smx`。本阶段先实现 1.7.0：新增自己的
封禁/解封/IP 封禁命令，同时写本地引擎封禁和网站记录；basebans 暂时保留，在 1服 验证后再
于 1.7.4 提供 `sm_ban` / `sm_unban` 兼容命令并逐台卸载。

### 变更内容

- 新增迁移 `20261027230400_ban_groups.sql`：`bans`、`server_bans` 增加 `ban_group_id` 与索引。
- 插件新增命令（`ADMFLAG_BAN`）：
  - `sm_threi_ban <目标|SteamID64> <分钟> [原因]`
  - `sm_threi_addban <SteamID64> <分钟> [原因]`
  - `sm_threi_unban <SteamID64|STEAM_x:y:z|[U:1:account]>`
  - `sm_threi_banip <IP> <分钟> [原因]`
  - `sm_threi_unbanip <IP>`
- 封禁命令同时调用 `BanIdentity` 写本地 SourceMod 引擎封禁，并上报网站；上报失败进入带退避
  的重试队列，本地封禁不依赖网站可达。
- 网站下发的 `ban` 动作在 1.7.0 中也会调用 `BanIdentity` 写本地引擎封禁（不触发
  `OnBanClient`，不会回环），使网站在插件重载/API 故障时仍有效；`unban` 动作删除它。
- `ban-report` 为账号封禁、服务器封禁、IP 封禁生成同一个 `ban_group_id`；新增
  `POST /plugin/ip-ban-report` 和 `POST /plugin/unban-report`。
- `sm_threi_unban` / `sm_threi_unbanip` 先请求网站，成功后才删除本地封禁；网站存在管理员
  手动封禁时 API 返回 `409`，插件保持本地封禁，避免误解除。
- 网站解除游戏服务器封禁时，若记录为插件来源且带分组，会同时解除同组账号/IP 封禁和 IP
  关联账号封禁，并写入 `unban` 指令。
- 管理面板解除服务器封禁后重新拉取封禁列表，立即显示分组解除结果。

### 涉及文件

- `services/api/migrations/20261027230400_ban_groups.sql`
- `services/api/src/modules/bans.rs`
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/server_plugin.rs`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`
- `README.md`、`docs/API.md`、`docs/ARCHITECTURE.md`、`docs/CHANGELOG.md`

### 数据库与 API 变化

- `bans.ban_group_id`、`server_bans.ban_group_id`。
- 新增 `POST /api/v1/plugin/ip-ban-report`、`POST /api/v1/plugin/unban-report`。
- `ban-report` 产生的三类记录共享分组。

### 插件包

- `/home/threi/ThRei_Players-1.7.0/`、`.zip`、`.tar.gz`，并复制到
  `/mnt/c/Users/15155/Downloads/`。
- `.smx` SHA-256：`95951d746389343a05eb05d9d699eb54a55fe695deeb3532df9e41e92ecb1d22`。

### 测试与结果

- `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`：通过。
- `cargo test`：47 个单元测试 + 14 个 HTTP 合约测试通过。
- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- SourcePawn Compiler 1.11.0.6970 编译 1.7.0：通过，无警告。
- 生产迁移 `20261027230400` 成功；所有容器健康。
- 生产 API 测试（测试数据均已清理）：
  - `ban-report` 返回 204，账号/服务器/IP 记录共享同一 `ban_group_id`；
  - 网站解除服务器封禁返回 204，同组账号/IP/服务器封禁全部解除，并生成 `unban` 指令；
  - `unban-report` 用 SteamID 解除插件来源分组返回 204；
  - `ip-ban-report` + IP `unban-report` 返回 204；
  - 管理员手动封禁调用 `unban-report` 返回 409，封禁保持不变。
- **未执行**：真实游戏服务器上的 1.7.0 命令测试。需要用户在 1服 安装 1.7.0 后测试
  `sm_threi_ban` / `sm_threi_unban` / `sm_threi_banip`，确认本地引擎封禁和网站同步。

## 2026年10月27日 22时51分14秒 网站解封自动清除服务器本地封禁

### 背景

用户反馈：游戏内 `sm_ban` 封禁玩家后，网站虽然能解封网站侧记录，但服务器本地 SourceMod
封禁仍在，仍需进服务器执行 `sm_unban`。希望网站解除游戏服务器封禁时自动清理本地封禁。

### 变更内容

- 新增迁移 `20261027224300_server_unban_actions.sql`：
  `server_actions.action` 约束从 `kick`/`ban` 扩展为 `kick`/`ban`/`unban`。
- `POST /admin/server-bans/{id}/lift` 在解除封禁的事务中：
  - 继续把尚未执行的 `ban` 指令标记完成；
  - 单服封禁向对应服务器写入一条 `unban` 指令；
  - 全服封禁向所有配置了插件令牌的服务器写入 `unban` 指令。
- `ThRei_Players` 1.6.1：
  - 解析 `unban` 指令，先清除插件本地封禁缓存；
  - 把 SteamID64 转成 `STEAM_1:Y:Z`，再调用 `RemoveBan(BANFLAG_AUTHID)` 执行引擎
    `removeid`，删除 `sm_ban` / `BanClient` 写入的本地 SteamID 封禁；
  - 无法识别的动作会确认并跳过，避免旧插件/新 API 组合把队列卡住。
- 管理面板「游戏服务器封禁」解封提示更新：说明会下发本地解封指令，需要插件 1.6.1+。
- 手动在游戏内添加的 IP 封禁不会被自动 `unban` 删除；仍可在服务器用 `sm_unban <IP>`
  或 `removeip` 处理。

### 涉及文件

- `services/api/migrations/20261027224300_server_unban_actions.sql`
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/plugin_access.rs`（动作渲染测试）
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`
- `README.md`、`docs/API.md`、`docs/ARCHITECTURE.md`、`docs/CHANGELOG.md`

### 数据库与 API 变化

- `server_actions.action` 允许 `unban`。
- 动作协议新增 `action <id> unban <steamid64> <reason>`；旧插件不识别，需要 1.6.1+。

### 插件包

- `/home/threi/ThRei_Players-1.6.1/`、`.zip`、`.tar.gz`，并复制到
  `/mnt/c/Users/15155/Downloads/`。
- `.smx` SHA-256：`624a6bdc56e36737b4e75365ba0c4518dbcd9d743e8fe2b97966688fbc2171f0`。

### 测试与结果

- `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`：通过。
- `cargo test`：47 个单元测试 + 14 个 HTTP 合约测试通过。
- `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm run build`：通过。
- SourcePawn Compiler 1.11.0.6970 编译插件 1.6.1：通过，无警告。
- 生产部署：迁移 `20261027224300` 成功；`api`、`web`、`nginx`、`postgres`、`redis` 均健康。
- 生产 API 测试：创建临时 `server_bans` 记录并调用解封接口，返回 204，`server_actions`
  生成 `unban` 指令（`网站解除封禁`）；测试数据已清理。
- **未执行**：真实游戏服务器上的插件 1.6.1 解封验证（本机无法访问游戏服务器）；需要用户
  安装 1.6.1 后在 1服 做一次封禁/网站解封测试。

## 2026年10月27日 14时56分40秒 自动 IP 封禁生产部署与验证

### 背景

用户在完成本地实现后要求部署网站/API 部分；游戏服务器插件由用户自行覆盖为 1.6.0。

### 变更内容

- 通过 SSH 上传 `threi-update-20261027.tar.gz` 并解压到 `/home/web/threi`；未覆盖 `.env`、
  `compose.override.yaml`、`services/api/Dockerfile.deploy`、`services/api/.cargo/config.toml`。
- 构建并切换 `threi-api:0.1.0`、`threi-web:0.1.0` 镜像。
- 执行 `docker compose run --rm migrate`，应用 `20261027180000_server_player_ips.sql`。
- 执行 `docker compose up -d --wait`，`api`、`web`、`nginx`、`postgres`、`redis` 均健康。

### 生产验证

- `/health/ready` 返回 `{"status":"ok","checks":{"database":"ok","redis":"ok"}}`。
- `https://threi.cn/` 返回 200；新接口无令牌返回 401；不存在的旧路径行为已变为新路由。
- 用真实服务器插件令牌调用 `POST /api/v1/plugin/ban-report` 返回 204，数据库新增：
  - 1 条网站 Steam 封禁；
  - 1 条该服务器游戏封禁；
  - 1 条自动 IP 封禁（原因前缀“服务器封禁自动关联 IP”）。
- 通过临时管理员 magic-link 调用 `POST /admin/bans`（`banType=steam`）返回 200，数据库新增
  1 条 Steam 封禁和 1 条自动 IP 封禁。
- 所有测试封禁、临时用户和会话已清理，最终计数为 0。
- 部署后的 Web 构建产物包含新的封禁页提示文本；API/Web 日志无 error/panic。

### 未完成

- 游戏服务器仍需安装 `ThRei_Players` 1.6.0；用户表示将自行覆盖 `.smx` 并重载。

## 2026年10月27日 14时33分03秒 自动 IP 封禁与游戏内封禁回传

### 背景

用户要求：玩家被 ban 后自动封禁其 IP；并询问在游戏服务器内封禁玩家是否会同步到网站。
原实现只有手动 IP 封禁，SteamID 封禁和服务器封禁不会自动创建 IP 封禁；插件只消费网站指令，
不会把游戏内封禁回传网站。

### 变更内容

#### 自动 IP 封禁

- 抽出 `bans::create_ip_ban`，统一处理手动和自动 IP 封禁：检查已有生效 IP 封禁，写入
  IP 封禁，自动关联该 IP 下已知的非管理员账号（`source_ban_id` 指向 IP 封禁），删除会话。
- 网站 SteamID 封禁（`POST /admin/bans` 的 `banType=steam`）创建后查找目标玩家的最近 IP：
  依次使用 `users.last_login_ip`、有效会话 `sessions.ip_address`、插件上报的
  `server_players.ip_address`；存在且不等于操作管理员当前 IP 时自动创建 IP 封禁。失败只
  记录警告，不影响已经创建的 SteamID 封禁。
- 服务器管理封禁玩家（`POST /admin/servers/{id}/players/{steam_id64}/ban`）在事务删除在线
  名单前捕获 `server_players.ip_address`，没有时回退 `users.last_login_ip`，随后自动创建
  IP 封禁；管理员当前 IP 不会被自动封禁。
- 新增迁移 `20261027180000_server_player_ips.sql`：`server_players.ip_address` 与部分索引。

#### 插件 1.6.0

- `/plugin/report` 的玩家对象新增 `ipAddress`，API 校验 IPv4/IPv6，非法或空值按 `NULL`
  保存；upsert 时新值优先、旧值保留。
- 新增 `POST /api/v1/plugin/ban-report`：校验每服务器令牌，写入网站账号封禁（若尚无生效
  SteamID 封禁）和该服务器的游戏封禁（若尚无生效全服/单服封禁），有 IP 时自动创建 IP 封禁。
  已有生效封禁时跳过，避免重复。
- 插件注册 `OnBanClient`，把 `BanClient` / `sm_ban` 封禁异步排队上报；上报失败只写日志，
  不影响 SourceMod 本地封禁。原始控制台 `banid` / `addip` 不触发该转发；网站下发指令不会
  回传，避免循环。
- 服务器管理在线名单显示插件上报的 IP；封禁确认框提示会自动封禁该 IP。

### 涉及文件

- `services/api/migrations/20261027180000_server_player_ips.sql`
- `services/api/src/modules/bans.rs`
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/server_plugin.rs`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`
- `docs/API.md`、`docs/ARCHITECTURE.md`、`docs/CHANGELOG.md`、`README.md`

### 数据库与 API 变化

- 迁移：`server_players.ip_address text`；索引 `server_players_ip_idx`。
- `POST /api/v1/plugin/report` 接受可选 `ipAddress`。
- 新增 `POST /api/v1/plugin/ban-report`，返回 `204`。
- SteamID 封禁和服务器封禁的响应不变，但可能额外产生一条 IP 封禁记录。

### 插件包

- 本地包：`/home/threi/ThRei_Players-1.6.0/`、`.zip`、`.tar.gz`，并复制到
  `/mnt/c/Users/15155/Downloads/`。
- `.smx` SHA-256：`04da93ba8059197a653823360313456b189268d871cfd7332459edec8b494be0`。

### 测试与结果

- `cargo fmt --all -- --check`：通过。
- `cargo clippy --all-targets -- -D warnings`：通过。
- `cargo test`：47 个单元测试 + 14 个 HTTP 合约测试通过。
- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- `npm run build`：通过（退出码 0；本地 WSL 仍打印 Turbopack 缓存 fsync `os error 22` 警告，但页面生成完成）。
- SourcePawn Compiler 1.11.0.6970 编译插件：通过，无警告。
- **当时未执行**：生产迁移与部署、真实 PostgreSQL 下的端到端封禁测试。本机没有 PostgreSQL /
  Docker，编写本条时也没有可用的生产 SSH 凭据；后续已在 14:56 完成部署和验证，见上方条目。

### 部署后验证步骤

1. `docker compose run --rm migrate`，确认 `20261027180000` 成功。
2. 在游戏服务器安装 `ThRei_Players` 1.6.0，`sm_threi_status` 显示 `version=1.6.0`。
3. 网站封禁一个测试 SteamID，确认封禁管理出现 IP 封禁。
4. 在游戏内执行 `sm_ban <测试玩家> 0 测试`，确认网站出现账号封禁、服务器封禁和 IP 封禁。
5. 清理测试封禁与账号。

## 2026年10月27日 14时14分54秒 IP 封禁与全服白名单

### 背景

用户要求增加 IP 封禁类型：封禁某个 IP 后，该 IP 下登录的账号一同封禁。同时把原来按服务器逐个
申请的白名单改为全服白名单：玩家申请并通过一次后，所有开启白名单的服务器都可进入。

### 变更内容

#### IP 封禁（网站登录）

- `bans` 新增 `ban_type`（`steam` / `ip`）、`ip_address`、`source_ban_id`；
  `users` 新增 `last_login_ip`，`sessions` 新增 `ip_address`。
- 封禁管理新增「封禁类型」选择：SteamID64 或 IP 地址。IP 封禁创建时：
  - 自动为已知使用该 IP 的非管理员账号写入 SteamID 封禁，`source_ban_id` 指向 IP 封禁；
  - 删除这些账号的现有会话；
  - 后续从该 IP 登录的普通账号会在登录时被自动关联封禁并拒绝；
  - 管理员账号保留恢复通道：管理员从被封 IP 登录会记录警告但不自动封禁。
- 解除 IP 封禁时，同时解除由它自动生成的账号封禁。
- 登录 IP 从反向代理头获取：优先非回环 `X-Real-IP`，否则取 `X-Forwarded-For` 最后一个
  非回环地址（兼容 Caddy → Nginx，降低伪造首项的影响）。
- IP 封禁只作用于网站登录，不影响游戏服务器封禁；游戏服务器封禁仍由 `server_bans` 管理。

#### 全服白名单

- 新增 `global_whitelist` 表；迁移时把 `server_whitelist` 按 SteamID64 去重合并。
- `whitelist_applications.server_id` 改为可空；现有 pending 申请统一置空，并保留最早一条，
  重复 pending 自动标记为 rejected（备注“已合并为全服白名单申请”），再建立
  `(steam_id64) WHERE status='pending'` 唯一索引。
- 玩家申请不再选择服务器：提交一次全服申请；审核通过或手动添加都会写入
  `global_whitelist`，所有开启 `requires_whitelist` 的服务器通用。
- 插件访问快照的白名单查询改为读取 `global_whitelist`；插件本身无需升级（1.5.0 即可）。
- 管理面板「白名单审核」改为全服申请/全服授权列表；服务器设置仍保留每台的
  `requires_whitelist` 开关。
- 用户中心增加白名单状态：已通过、待审核、可申请；避免重复提交。

### 涉及文件

- `services/api/migrations/20261027170000_ip_bans.sql`
- `services/api/migrations/20261027171000_global_whitelist.sql`
- `services/api/src/modules/auth/mod.rs`
- `services/api/src/modules/bans.rs`
- `services/api/src/modules/whitelist.rs`
- `services/api/src/modules/plugin_access.rs`
- `services/api/src/modules/account.rs`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/account/types.ts`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `apps/web/src/features/admin/components/whitelist-manager.tsx`
- `apps/web/src/features/admin/components/forum-moderation-manager.tsx`
- `apps/web/src/features/account/components/whitelist-apply-card.tsx`
- `apps/web/src/app/(account)/account/page.tsx`
- `apps/web/src/services/content.ts`

### 数据库与 API 变化

- 迁移 `20261027170000_ip_bans`：`bans` 新列与身份约束、`users.last_login_ip`、
  `sessions.ip_address` 及索引。
- 迁移 `20261027171000_global_whitelist`：`global_whitelist` 表、旧白名单迁移、
  pending 申请归一与唯一索引、`server_whitelist` 标记为 deprecated。
- `POST /api/v1/admin/bans` body 新增 `banType`（`steam` 默认 / `ip`）与 `ipAddress`；
  响应新增 `banType`、`ipAddress`、`sourceBanId`。
- `POST /api/v1/admin/bans/{id}/lift` 对 IP 封禁会联动解除 `source_ban_id` 关联的账号封禁。
- `POST /api/v1/whitelist/applications` 不再需要 `serverId`；`POST /admin/whitelist`
  body 不再需要 `serverId`；移除接口改为 `DELETE /admin/whitelist/{steam_id64}`。
- `GET /api/v1/account` 新增 `whitelist: { whitelisted, pending }`。
- `GET /api/v1/plugin/access-snapshot` 的白名单来源改为 `global_whitelist`。

### 测试与结果

- `cargo fmt --all -- --check`、`cargo clippy --all-targets -- -D warnings`：通过。
- `cargo test`：lib 43 项、HTTP 合约 14 项通过（新增 client IP 解析测试）。
- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- 生产库事务试跑两份迁移后 `ROLLBACK`：成功；pending 申请归一与重复拒绝符合预期。
- 生产部署：迁移 `20261027170000`、`20261027171000` 成功，api/web 容器 healthy。
- 一次性管理员会话端到端验证：
  - 创建/解除测试 IP 封禁：201/204，`ban_type=ip`、`ip_address` 正确；
  - 临时用户自动关联：IP 封禁 + 关联 Steam 封禁（`source_ban_id` 非空），解除 IP 封禁后
    两条都变为已解除；
  - 全服白名单添加/列表/移除：204，条目 `serverId=null`、`serverName=全服`；
  - 全服白名单审核：通过 204，申请状态 approved，`global_whitelist` 出现记录，移除 204；
  - 测试用户、申请、封禁记录和临时管理员会话均已清理。

---

## 2026年10月27日 13时52分57秒 服务器排序页支持拖拽

### 背景

线上已有 18 台服务器，逐台点“上移/下移”仍然不够方便；用户要求服务器排序页支持拖动。

### 变更内容

- `ServerOrderManager` 每行左侧新增拖拽手柄（`GripVertical`），使用原生 HTML5
  drag-and-drop：
  - `dragstart` 记录拖拽的服务器 ID，并把整行设为拖拽预览；
  - 拖过其他行时实时交换位置，松开鼠标后进入“有未保存的修改”状态；
  - 拖拽中的行降低透明度并加主色描边。
- 保留置顶/上移/下移按钮，作为键盘操作和触屏设备的备用方式。
- 页面顶部和列表底部都提供“重置/保存顺序”按钮，18 台服务器滚到底部也能直接保存。
- 页面说明中补充拖拽手柄的使用提示。

### 涉及文件

- `apps/web/src/features/admin/components/server-order-manager.tsx`

### 数据库与 API 变化

- 无；仍然通过 `PUT /api/v1/admin/servers/order` 一次性保存完整顺序。

### 测试与结果

- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- 生产 Docker `docker compose build web`：通过；web 容器重建后 `healthy`。
- 线上 `/admin/server-order` 未登录返回 307；生产构建产物包含“拖动排序”文案。

---

## 2026年10月27日 13时50分04秒 独立服务器排序页与服务器管理整理

### 背景

上一条记录把上移/下移按钮直接放进了服务器管理列表，用户反馈操作繁琐、面板太乱。改为独立的
「服务器排序」管理页面，同时整理服务器管理页的操作区。

### 变更内容

- 管理面板导航新增「服务器排序」，路由 `/admin/server-order`。
- 新页面 `ServerOrderManager`：
  - 按当前位置显示 `#1`、`#2`…；
  - 支持置顶、上移、下移，先本地调整，点击「保存顺序」后一次性调用
    `PUT /api/v1/admin/servers/order`；
  - 显示“有未保存的修改”，支持重置为已保存顺序；
  - 停用服务器保留相对位置，但不会出现在公开目录。
- 服务器管理页移除逐台服务器的排序按钮和 `#序号`，改为顶部「调整顺序」链接。
- 服务器管理操作区重新分组：
  - 保留文字按钮「插件配置」「停用/启用」；
  - RCON 兜底、社区组、白名单管理、删除改为带 Tooltip 的图标按钮，放在同一个分段操作组；
  - 删除按钮使用危险色，减少整行按钮宽度和视觉噪音。

### 涉及文件

- `apps/web/src/app/(admin)/admin/server-order/page.tsx`（新增）
- `apps/web/src/features/admin/components/server-order-manager.tsx`（新增）
- `apps/web/src/features/admin/components/admin-nav.tsx`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`

### 数据库与 API 变化

- 无新增数据库迁移；复用 `PUT /api/v1/admin/servers/order` 和 `servers.sort_order`。

### 测试与结果

- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- 生产 Docker `docker compose build web`：通过；web 容器重建后 `healthy`。
- 线上 `/admin/server-order`、`/admin/servers` 未登录均返回 307 跳转登录；`/`、`/servers`
  返回 200。
- 生产构建产物包含「服务器排序」「有未保存的修改」「调整顺序」「保存」「置顶」等页面文案。

---

## 2026年10月27日 13时41分36秒 管理面板手动调整服务器顺序

### 背景

上一条记录实现了访客侧的排序下拉，但用户实际想要的是由管理员决定公开目录中的固定顺序：
在管理面板里把某台服务器移到第一位，它就应该在公开目录排第一。访客侧排序不是这次的重点。

### 变更内容

- 数据库新增 `servers.sort_order`，迁移时按原来的 `featured DESC, name` 顺序回填，
  保证升级后现有顺序不变；新建服务器自动追加到末尾。
- 公开 `GET /api/v1/servers` 改为按 `sort_order, name` 返回；公开目录的“默认排序”因此就是
  管理员设置的顺序。之前加的访客排序下拉仍保留，用户可临时切换其他排序。
- 管理面板服务器列表新增 `#序号` 和上移/下移按钮；移动后调用新接口
  `PUT /api/v1/admin/servers/order`，一次提交完整服务器 ID 顺序，事务内写入 `sort_order`。
- 管理面板服务器列表按 `sort_order, name` 读取，保证与管理面板的上下移动一致。
- 新服务器插入时 `sort_order = MAX(sort_order) + 1`。

### 涉及文件

- `services/api/migrations/20261027160000_server_sort_order.sql`
- `services/api/src/modules/servers.rs`
- `services/api/src/modules/server_admin.rs`
- `apps/web/src/services/content.ts`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`

### 数据库与 API 变化

- 新迁移：`servers.sort_order integer NOT NULL DEFAULT 0`，回填旧顺序并建立
  `(sort_order, name)` 索引。
- 新端点 `PUT /api/v1/admin/servers/order`，body `{ "serverIds": ["srv-...", ...] }`，
  按数组顺序写入 `sort_order = 0..n-1`；需要管理员权限，服务器不存在返回 404。

### 测试与结果

- `cargo fmt --all -- --check`、`cargo clippy --all-targets -- -D warnings`、
  `cargo test`（lib 41 项、HTTP 合约 14 项）：通过。
- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- 生产部署：已执行。`20261027160000_server_sort_order` 迁移成功，api/web 容器重建并
  healthy；`servers.sort_order` 已回填为 0..11，公开 `/api/v1/servers` 返回顺序与数据库
  `ORDER BY sort_order, name` 一致；未登录 `PUT /api/v1/admin/servers/order` 返回 401，
  `/`、`/servers` 返回 200。
- 管理面板构建产物中已包含上移/下移按钮与“移动到第 N 位”提示。

---

## 2026年10月27日 13时38分09秒 服务器目录增加排序

### 背景

用户要求给服务器目录增加排序功能。

### 变更内容

- `data/servers.ts` 新增 `ServerSortKey` 和 `sortServers`：
  - `default` 保持 API 默认顺序（featured 优先、名称）；
  - `players` 按在线人数从多到少；
  - `name` 按名称（`zh-CN`、数字感知）排序；
  - `latency` 按延迟从低到高，未知延迟排最后；
  - `status` 按在线 > 休眠/待上报 > 维护中 > 离线，再按人数和名称。
- `ServerDirectory` 在搜索/社区组筛选之后应用排序，再渲染卡片或列表。
- 筛选栏新增“排序方式”下拉框，选择保存到 `localStorage["threi.servers.sort"]`，
  刷新或再次访问保持；排序选择不会被“清空筛选”重置。

### 涉及文件

- `apps/web/src/features/servers/data/servers.ts`
- `apps/web/src/features/servers/components/server-directory.tsx`

### 测试与结果

- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- 生产 Docker `docker compose build web`：通过；web 容器重建后 `healthy`。
- 线上 `/servers` 返回 200，HTML 中包含“服务器排序方式”下拉框和
  默认/在线人数/服务器名称/延迟最低/在线状态选项。

---

## 2026年10月27日 13时34分28秒 增加黑夜模式

### 背景

用户要求给网站增加黑夜模式，并希望在亮色/暗色之间随时切换。

### 变更内容

- `globals.css` 增加 `.dark` 主题变量（背景、卡片、文字、边框、主色等）和
  `@custom-variant dark`，使现有 `dark:` Tailwind 工具类跟随 `.dark` 类。
- 新增 `ThemeToggle` 按钮，放在官网/论坛/用户中心共用的顶部导航和管理面板顶部导航。
- 根布局加入 `beforeInteractive` 初始化脚本：优先读取 `localStorage["threi-theme"]`，
  没有保存值时跟随系统 `prefers-color-scheme`，在 hydration 前设置 `.dark`，避免闪烁。
- 切换时同步 `color-scheme` 和 `meta[name="theme-color"]`；`viewport.themeColor` 增加
  亮色/暗色媒体查询。
- 管理面板 `<html>` 加 `suppressHydrationWarning`，避免主题类在 hydration 前变化产生警告。

### 涉及文件

- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/layout/theme-toggle.tsx`（新增）
- `apps/web/src/components/layout/site-header.tsx`
- `apps/web/src/app/(admin)/layout.tsx`

### 测试与结果

- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- 本地 `next build`：受 WSL 上 Turbopack 持久化缓存目录 `fsync` 限制失败（`os error 22`），
  不是代码错误；生产 Docker 镜像 `docker compose build web`：通过。
- 生产 web 容器重建后 `healthy`；线上首页 HTML 包含 `theme-init` 脚本与“切换亮色/黑夜模式”
  按钮，CSS 包含 `.dark` 变量和 `:where(.dark, .dark *)` 变体；`/`、`/servers` 返回 200。

---

## 2026年10月27日 12时55分32秒 全服封禁、封禁管理统一与指令即时执行

### 背景

生产环境在 10001 服封禁玩家后，只有 10001 拦截，10002 仍可进入，且「封禁管理」页面看不到
这条记录。原因是站点存在两套封禁：`bans` 是网站账号封禁，`server_bans` 是按服务器作用域的
游戏封禁；「封禁管理」只读前者，插件快照只读后者。用户要求对标 LumiAdmin：封禁默认全服，
保留“仅本服”选项，并让踢出/封禁不再等待 15 秒轮询，而是通常 1 秒内执行。

### 变更内容

- `server_bans.server_id` 允许为 `NULL`，表示全服封禁；访问快照对任意服务器都包含全服封禁。
- 服务器管理页的封禁默认 `scope = "global"`，可为所有启用服务器写入封禁记录与 `server_actions`；
  选择“仅本服”时保持原来的单服行为。
- 新增 `GET /api/v1/admin/server-bans`，「封禁管理」页面同时展示网站账号封禁与游戏服务器封禁，
  显示作用范围并支持解除；全服封禁解封时取消所有服务器上的待执行封禁指令。
- `GET /api/v1/plugin/actions` 新增 `?wait=<秒>` long-poll（最大 20 秒）；没有指令时挂起，
  新指令到达立即返回，旧插件不传 `wait` 时保持原行为。
- `ThRei_Players` 升至 1.5.0：动作请求使用 `&wait=20`，HTTP 超时 25 秒，每次响应后约 1 秒
  重新发起；`sm_threi_actions_interval` 仅作为失败后的重试/退避间隔。
- 管理面板文案从“下一次轮询时执行”改为“通常 1 秒内执行”；服务器封禁列表显示全服/单服标签。

### 涉及文件

- `services/api/migrations/20261027150000_global_server_bans.sql`
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/plugin_access.rs`
- `services/api/Cargo.toml`、`services/api/Cargo.lock`（utoipa `uuid` feature）
- `apps/web/src/app/(admin)/admin/bans/page.tsx`
- `apps/web/src/features/admin/components/bans-manager.tsx`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `apps/web/src/features/admin/types.ts`、`apps/web/src/services/content.ts`
- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`、`plugins/ThRei_Players/cfg/sourcemod/threi_players.cfg.example`
- `docs/API.md`、`docs/DEPLOYMENT.md`、`docs/CHANGELOG.md`

### 数据库与 API 变化

- 新迁移把 `server_bans.server_id` 改为可空，并增加全服封禁索引。
- `POST /admin/servers/{id}/players/{steam_id64}/ban` 的 body 新增 `scope`（`global` 默认 /
  `server`）；全局封禁只写一条 `server_bans`（`server_id = NULL`），并为每个启用服务器写入
  `server_actions`。
- 新端点 `GET /admin/server-bans`；`POST /admin/server-bans/{id}/lift` 兼容全局封禁。
- `/plugin/actions` 支持 `wait` 查询参数；响应格式不变。

### 测试与结果

- `cargo check --all-targets`：通过。
- `cargo clippy --all-targets -- -D warnings`：通过。
- `cargo fmt --all -- --check`：通过。
- `cargo test`：通过（lib 41 项、HTTP 合约 14 项）。
- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过。
- `spcomp64`（SourcePawn Compiler 1.11.0.6970）编译通过，生成 21187 字节的
  `ThRei_Players.smx`，SHA-256 `1d34b0ee10b0fa8ab584349853a8f755475b6b009742d92961eebd872004dbef`。
- 生产部署：已执行。`20261027150000_global_server_bans` 迁移成功，api/web 镜像重建并保持
  healthy；现有 10001 封禁已提升为全服封禁，并为 6 台启用服务器补发封禁动作。线上 `/`、
  `/servers` 返回 200，未登录访问 `/admin/server-bans` 返回 401，
  `/plugin/actions?wait=1` 未带令牌返回 401。
- 构建备注：服务器 `Dockerfile.deploy` 的 Debian 源改为腾讯云镜像并强制 IPv4，解决
  `apt-get` 在 Docker 构建容器内长时间卡住的问题；原文件保留为
  `Dockerfile.deploy.bak-20261027`。

---

## 2026年10月25日 13时55分09秒 对标 LumiAdmin 补齐白名单、踢封执行与空服存活判断

### 背景

此前 `ThRei_Players` 只负责上报在线状态，网站上虽然已有白名单、服务器封禁和踢出/封禁按钮，
但游戏服务器不会执行这些操作。用户要求对标 LumiAdmin / LumiAdmin-plugins 的完整实现，使
白名单审核、踢出和封禁能够真正作用于游戏服务器；同时不能退回到把 RCON 作为主要控制通道。

空服休眠的 `sv_hibernate_when_empty` 会暂停 SourceMod 定时器，插件因此停止上报，网站会把仍在
运行的服务器误判为离线。用户明确要求区分“进程已停止”和“空服休眠”，且白名单、踢出、封禁
不得依赖 RCON。

### 变更内容

- `ThRei_Players` 升至 1.4.0：
  - 每 `sm_threi_access_interval`（默认 30 秒）读取纯文本访问快照，包含
    `requires_whitelist`、白名单和带到期 Unix 时间戳的封禁；
  - 玩家连接完成时按快照拦截，刷新后复查在线玩家；临时封禁到期或解封后自动放行；
  - 首次快照成功前保持 fail-open，避免 API 暂时不可达时把所有人挡在门外；
  - 每 `sm_threi_action_interval` 轮询待执行指令，执行后调用 ack；解封会取消尚未执行的封禁，
    已过期封禁只确认不执行；
  - 继续使用每实例端口匹配同一份 `threi_players.cfg`，HTTP 通道不引入 JSON/RIPExt 依赖。
- API 新增插件访问与指令接口，踢出/封禁通过 `server_actions` 队列下发，执行不经过 RCON。
- 新增可选最小 RCON 存活探测：仅发送 `status`，不暴露任意命令；插件上报过期且管理员设置密码时，
  空服标为 `hibernating`、有玩家标为 `online`，连续 3 次失败才标为 `offline`。
- 90 秒清理任务在启用 RCON 兜底时跳过已配置密码的服务器，避免与休眠探测互相覆盖。
- 管理面板增加 RCON 配置弹窗、只写密码、探测状态/重试徽章、待执行指令数，并说明白名单和
  踢封不依赖 RCON；服务器状态徽章与目录支持 `hibernating`。
- 修复本轮验证发现的两个问题：
  - Source RCON 数据包大小字段错误地包含了 4 字节长度前缀，真实服务器会一直等待不存在的
    后续字节；改为只统计 id、type、body 和两个结尾 NUL。测试改用会发送空
    `RESPONSE_VALUE` 信封的阻塞式假服务器覆盖该路径。
  - 无待执行指令时，无效插件令牌访问 `/plugin/actions` 会返回 200 空响应；改为先按令牌解析
    服务器，`actions` 与 `ack` 对无效令牌统一返回 401。
- 管理面板在 RCON 连续失败超过阈值后显示“连续失败 ≥3 次”，不再出现“5/3”这类误导文案。

### 涉及文件

- `services/api/src/modules/plugin_access.rs`
- `services/api/src/modules/server_hibernation.rs`
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/server_plugin.rs`
- `services/api/src/modules/mod.rs`
- `services/api/src/infrastructure/rcon.rs`
- `services/api/src/infrastructure/mod.rs`
- `services/api/src/routes/mod.rs`
- `services/api/src/openapi.rs`
- `services/api/src/config/mod.rs`
- `services/api/src/main.rs`
- `services/api/migrations/20261025140000_server_access_and_hibernation.sql`
- `compose.yaml`
- `.env.example`
- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `apps/web/src/features/admin/components/community-admin-manager.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/account/types.ts`
- `apps/web/src/features/servers/components/server-card.tsx`
- `apps/web/src/features/servers/components/server-status-badge.tsx`
- `apps/web/src/features/servers/components/join-server-button.tsx`
- `apps/web/src/features/servers/data/servers.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`
- `docs/DEVELOPMENT.md`

### 数据库与 API 变化

- 迁移 `20261025140000_server_access_and_hibernation.sql`：
  - 服务器状态约束增加 `hibernating`；
  - 新增只写 `servers.rcon_password`（长度与空值约束）、`last_rcon_at`、`rcon_failures`
    （0–100）及部分索引。
- 插件接口（请求头 `X-ThRei-Plugin-Token`）：
  - `GET /api/v1/plugin/access-snapshot`：纯文本白名单/封禁快照；
  - `GET /api/v1/plugin/actions`：纯文本待执行踢出/封禁；
  - `POST /api/v1/plugin/actions/{id}/ack`：确认执行，幂等；无效令牌 401。
- 管理接口：
  - `PUT /api/v1/admin/servers/{id}/rcon-password` 写入密码；
  - `DELETE /api/v1/admin/servers/{id}/rcon-password` 移除密码；
  - 服务器管理列表新增 `hasRconPassword`、`lastRconAt`、`rconFailures`、`pendingActions`；
  - 密码只写不读，任何响应与日志都不包含原文；移除密码会重置探测状态。
- 配置新增 `HIBERNATION_POLL_ENABLED`、`HIBERNATION_POLL_SCAN_INTERVAL_SECS`、
  `HIBERNATION_POLL_INTERVAL_SECS`、`HIBERNATION_POLL_AFTER_SECS`、
  `HIBERNATION_RCON_TIMEOUT_SECS`，并已加入 Compose 与 `.env.example`。

### 测试与结果

- `cargo fmt --check`：通过。
- `cargo clippy --all-targets -- -D warnings`：通过。
- `cargo test`：库测试 41 个、HTTP 合约测试 14 个全部通过，0 失败。
- SourcePawn 1.11.0.6970 编译：通过；代码 38252 字节、数据 141552 字节、栈/堆 24244 字节。
  安装的 `ThRei_Players.smx` 为 21113 字节，SHA-256
  `f072131f3837a0755ae54651e2b91233ff490a4476d1e05264475e663dd48e83`。
- 前端 `npx tsc --noEmit`、`npm run lint`（`--max-warnings=0`）、`npm run format:check`：通过。
- 本地 API E2E：有效令牌可读取快照与四字段踢出/五字段封禁指令，ack 后指令消失；无效令牌在
  `actions` 与 `ack` 均返回 401；快照排除已过期封禁，永久/临时封禁及原因格式正确；测试数据已清理。
- 本地假 RCON E2E：探测成功时状态为 `hibernating`、地图更新为 `kz_fake` 且不修改
  `last_reported_at`；假服务器停止后连续失败达到 3 次标记 `offline` 并清零在线人数。
- OpenAPI 已包含 `/plugin/access-snapshot`、`/plugin/actions`、`/plugin/actions/{id}/ack` 与
  `SetRconPasswordRequest`。
- `docker compose config` 未执行：本机没有 Docker CLI。已用 PyYAML 校验 Compose 语法，并用脚本
  交叉检查 Compose 引用的变量均存在于 `.env.example`。
- 生产未部署；本轮只完成本地开发与验证，未 push 到 GitHub。

---

## 2026年10月25日 11时53分30秒 离线状态仍允许打开加入游戏

### 背景

网站上的 `offline` 只表示 90 秒内没有收到插件上报，并不代表游戏服务器进程已停止。
空服休眠时会暂停 SourceMod 定时器，插件停止上报，服务器在目录中显示“离线”，但进程仍可连接。
原按钮在 `offline` 时禁用，只显示“离线”，用户会误以为服务器无法加入。

### 变更内容

- `JoinServerButton` 只在 `maintenance` 状态禁用；`online` 与 `offline` 都显示“加入游戏”并可打开连接对话框。
- 对话框在 `offline` 时显示提示：超过 90 秒没有收到插件上报，服务器可能仍在运行（例如空服休眠），可以直接尝试连接。
- `maintenance` 仍显示“维护中”并保持禁用，避免绕过管理员明确的维护状态。

### 涉及文件

- `apps/web/src/features/servers/components/join-server-button.tsx`
- `docs/CHANGELOG.md`
- `docs/DEVELOPMENT.md`

### 数据库与 API 变化

- 无。仅调整前端按钮可用性与提示文案。

### 测试与结果

- Prettier 格式化 `join-server-button.tsx`：通过。
- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- 生产部署：重建并重启 `web` 容器，健康检查为 `healthy`。
- 生产 `GET https://threi.cn/api/v1/servers`：`ThRei 2服` 返回 `status: "offline"`、0 人。
- 生产 `/servers` HTML：离线实例同样渲染“加入游戏”，并包含离线状态提示；`maintenance` 未出现。
- 未 push 到 GitHub。

---

## 2026年10月25日 11时05分38秒 新增社区组管理页面与实例成员关系

### 背景

上一条记录只把社区组实现为服务器上的自由文本字段，管理员必须先添加服务器、再逐个填写组名，
无法先创建社区组，也无法在组内集中管理实例。用户要求网站提供“添加社区组”的功能，并能在
社区组中添加实例。因此把社区组升级为独立实体，服务器通过外键归属到一个组。

### 变更内容

- 新增迁移 `20261025130000_server_communities.sql`：
  - 创建 `server_communities`（`com-` + 12 位十六进制 ID、名称大小写不敏感唯一、可选描述）；
  - 把原有 `servers.community` 的非空文本按大小写不敏感名称去重后写入社区组；
  - 新增可空外键 `servers.community_id`（`ON DELETE SET NULL`），回填后删除旧列；
  - 为 `servers.community_id` 建索引，并挂接 `set_updated_at()` 触发器。
- 新增 API 模块 `server_communities`：
  - `GET/POST /admin/server-communities`；
  - `PATCH/DELETE /admin/server-communities/{id}`；
  - `POST /admin/server-communities/{id}/servers` 批量加入实例（跨组时自动移动）；
  - `DELETE /admin/server-communities/{id}/servers/{server_id}` 移出实例。
- `server_admin`：`POST /admin/servers` 改收 `communityId` 并校验组存在；
  `PATCH /admin/servers/{id}/community` 改为接收 `communityId`（空值表示未分组）；
  管理服务器列表同时返回 `communityId` 与组名 `community`。
- 公开 `GET /api/v1/servers` 通过 LEFT JOIN 返回社区组名称，目录展示与筛选逻辑不变。
- 管理面板新增 `/admin/communities`「社区组」页面：创建/编辑/删除社区组、查看组内实例、
  通过勾选弹窗批量添加实例、移出实例；删除组前提示实例会变为未分组。
- 管理面板导航新增「社区组」；添加服务器弹窗的社区组改为下拉选择；服务器列表的「社区组」
  按钮也改为下拉选择，并提示先到社区组页面创建。
- 更新 `docs/API.md`、`docs/ARCHITECTURE.md`、`docs/DEPLOYMENT.md`、`docs/CHANGELOG.md`。

### 涉及文件

- `services/api/migrations/20261025130000_server_communities.sql`
- `services/api/src/modules/server_communities.rs`
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/servers.rs`
- `services/api/src/modules/mod.rs`
- `services/api/src/routes/mod.rs`
- `services/api/src/openapi.rs`
- `services/api/tests/http_contract.rs`
- `apps/web/src/app/(admin)/admin/communities/page.tsx`
- `apps/web/src/app/(admin)/admin/servers/page.tsx`
- `apps/web/src/features/admin/components/community-admin-manager.tsx`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `apps/web/src/features/admin/components/admin-nav.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/services/content.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`

### 数据库与 API 变化

- 数据库：新增 `server_communities` 表；`servers.community` 被 `servers.community_id` 外键取代，
  原有非空组名自动迁移，空值保持未分组；删除社区组时实例自动置空。
- 新增管理员社区组 CRUD 与成员接口（见 `docs/API.md` 6.9）。
- `POST /admin/servers` 的 `community` 字段改为 `communityId`；`PATCH /admin/servers/{id}/community`
  同步改为 `communityId`，未知组返回 `422`。为兼容升级前已加载的旧页面，两个接口仍接受
  `community` 组名并按名称匹配已有组；名称不存在时返回 `422`，不会静默解绑。
- 公开服务器响应仍返回 `community` 字符串（组名）；管理服务器对象新增 `communityId`。
- `GET /admin/server-communities` 返回社区组及其实例摘要，供管理页面一次渲染。

### 测试与结果

- 在临时数据库 `threi_migration_test` 中按顺序执行全部旧迁移，插入两个仅大小写不同的同组标签、
  一个空白标签、一个独立组服务器，再执行新迁移：小写同名标签合并为一个社区组并回填两个实例，
  空白标签保持 `NULL`，独立组正常生成，旧列已删除；
- `cargo fmt`、`cargo check --all-targets` 通过；
- `cargo test --lib`：30 个测试通过，包含名称/描述校验与服务器 ID 去重测试；
- `cargo test`：14 个 HTTP 合约测试通过（新增匿名访问社区组接口返回 401）；
- `cargo clippy --all-targets -- -D warnings` 通过；
- `npm run typecheck`、`npm run lint` 通过，变更文件已执行 Prettier；
- 本地 API 端到端验证：创建组 `201`、大小写重名 `409`、未知组添加服务器 `422`、
  加入实例 `204`、重命名后管理接口与公开接口均返回新组名、删除组后实例 `communityId=null`；
- 本地兼容性验证：旧载荷 `community` 组名创建服务器可解析到已有组；`PATCH` 发送其他组名
  返回 `204` 并移动实例，发送不存在的名称返回 `422` 且不解绑，发送空字符串返回 `204` 并解绑；
- Next.js 开发服务器渲染 `/admin/communities` 与 `/admin/servers` 均返回 `200`，页面包含
  「社区组管理」「添加社区组」「移出」等新界面文案；
- 生产部署已执行（2026-10-25 11:13 CST）：重建 `api`/`web` 镜像，`migrate` 退出码 `0`；
  `server_communities` 表与 `servers.community_id` 已存在，原 `srv-724e9db592f3`（ThRei 1服）
  自动归入「ThRei 1」；公开 API 返回 `community: "ThRei 1"`，匿名管理接口 `401`，匿名页面
  `307`；管理员登录后 `/admin/communities` 返回 `200`，临时组创建 `201`、页面可见、删除 `204`，
  测试组已清理。

---

## 2026年10月25日 10时46分44秒 ThRei_Players 改为单配置文件按端口匹配，新增社区组

### 背景

上一条记录实现了 1.2.0 的每端口配置文件方案：多实例主机需要为每个实例复制
`threi_players_<hostport>.cfg`。用户明确要求改回**只保留一个** `threi_players.cfg`，在文件内
按端口填写各实例的令牌，由插件根据自身端口匹配，API 根据令牌定位服务器；同时希望网站在服务器
上增加“社区组”，用于区分同一台主机上的多个实例。因此 1.3.0 取代 1.2.0 的每端口文件方案。

### 变更内容

- 移除 `ResolveConfigName()` / `g_sConfigName` 与每端口文件逻辑，恢复固定加载
  `cfg/sourcemod/threi_players.cfg`。
- 新增服务器控制台命令 `sm_threi_instance <port> <token>`（兼容
  `sm_threi_instance <port> <server-id> <token>`），在 `AutoExecConfig` 之前注册，使
  cfg 中的多行配置在加载时被解析。
- 插件启动时读取 `hostport`（缺失时回退 `port`），只采用端口匹配的令牌；存在任意有效实例行时
  忽略 `sm_threi_server_id` / `sm_threi_token`，端口无匹配行时记录错误并跳过上报，避免把数据
  写入错误的服务器。
- `BuildBody()` 在未配置服务器 ID 时省略 `serverId`，仅凭令牌上报。
- `sm_threi_status` 改为输出 `hostport` 与实例匹配状态（`matched` / `no matching entry` /
  `not configured`），不再输出配置文件名，仍不输出令牌。
- API `POST /api/v1/plugin/report` 的 `serverId` 改为可选；省略时按唯一 `plugin_token` 定位
  服务器，提供时 SQL 同时校验令牌与 ID。新增 `normalize_server_id()` 处理空值与 80 字符上限。
- 新增迁移 `20261025120000_server_community.sql`：`servers.community text NOT NULL DEFAULT ''`，
  限制最多 60 字符。
- 公开服务器 API/类型新增 `community`；服务器卡片显示社区组徽标，列表行显示标签，服务器目录
  支持按社区组筛选并纳入搜索。
- 管理端 `POST /admin/servers` 支持可选 `community`，新增
  `PATCH /admin/servers/{id}/community`；服务器管理页新增「社区组」编辑弹窗，添加服务器弹窗
  可填写社区组。
- 管理面板插件配置片段改为生成 `sm_threi_instance <port> "<token>"`，不再包含服务器 ID。
- 更新插件 README、示例 cfg、API/部署/变更文档。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/cfg/sourcemod/threi_players.cfg.example`
- `plugins/ThRei_Players/README.md`
- `services/api/migrations/20261025120000_server_community.sql`
- `services/api/src/modules/server_plugin.rs`
- `services/api/src/modules/server_admin.rs`
- `services/api/src/modules/servers.rs`
- `apps/web/src/features/servers/data/servers.ts`
- `apps/web/src/features/servers/components/server-card.tsx`
- `apps/web/src/features/servers/components/server-list-row.tsx`
- `apps/web/src/features/servers/components/server-directory.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `apps/web/src/services/content.ts`
- `docs/API.md`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`

### 数据库与 API 变化

- 数据库：新增 `servers.community` 列（非空，默认空字符串，长度不超过 60），由迁移自动执行。
- `POST /api/v1/plugin/report`：`serverId` 可选；仅凭令牌即可上报。令牌错误、服务器不存在或
  ID 与令牌不匹配仍统一返回 `401`。
- `POST /admin/servers`：新增可选 `community`，超过 60 字符或含控制字符返回 `422`。
- 新增 `PATCH /admin/servers/{id}/community`，成功 `204`，不存在 `404`。
- 公开 `GET /api/v1/servers` 响应新增 `community`。
- 旧版 1.1.x 单实例配置（`sm_threi_server_id` + `sm_threi_token`）继续可用；1.2.0 的每端口
  配置文件不再读取，升级后需把令牌迁移到共享 cfg 的 `sm_threi_instance` 行。

### 测试与结果

- `cargo fmt`、`cargo check --all-targets` 通过；
- `cargo test --lib`：27 个测试通过，包含新增的 `server_id_is_optional_trimmed_and_limited`；
- `cargo test`：14 个 HTTP 合约测试通过；
- `cargo clippy --all-targets -- -D warnings` 通过；
- `npm run typecheck`、`npm run lint` 通过，变更前端文件已执行 Prettier；
- `spcomp64`（1.11.0.6970）编译通过，`.smx` 为 11022 字节，SHA-256
  `841e75361b90c8fc32c8d158ccc1adcfc689d16608a6ddc4f17d8797e7126744`；
- 使用 `-z 0` 的临时产物确认包含 `1.3.0`、`sm_threi_instance`、`hostport=`、
  `matched by token` 与端口不匹配的错误文本；
- 未在真实多实例游戏服务器和生产环境联调；需部署 API/Web、执行迁移并安装 1.3.0 后，用
  `sm_threi_status` 确认各实例 `instance=matched`。

---

## 2026年10月25日 10时34分14秒 ThRei_Players 支持一主机多实例的端口配置

### 背景

用户在同一台主机上运行多个游戏服务器实例，它们共用同一份 SourceMod 安装和
`cfg/sourcemod` 目录。管理面板为每个实例分别生成服务器 ID 与令牌，但插件此前固定通过
`AutoExecConfig(true, "threi_players")` 读取同一个 `threi_players.cfg`，多个实例只能使用
同一组 ID/令牌，第二个实例的令牌无法生效。

### 变更内容

- 新增 `ResolveConfigName()`：插件启动时读取 `hostport`（缺失时回退 `port`），先检查
  `cfg/sourcemod/threi_players_<port>.cfg` 是否存在；
  - 存在：使用该实例专属配置；
  - 不存在：回退到共享的 `cfg/sourcemod/threi_players.cfg`，保持单实例旧安装的兼容性。
- `OnPluginStart()` 改为 `AutoExecConfig(true, g_sConfigName)`，动态传入配置基名。
- 配置不完整时的错误日志改为输出当前实际加载的配置文件名。
- `sm_threi_status` 新增 `config=cfg/sourcemod/<name>.cfg`，便于确认实例加载了哪个文件。
- `PLUGIN_VERSION` 从 `1.1.1` 升级到 `1.2.0`，使用 SourcePawn Compiler `1.11.0.6970`
  重新编译 `ThRei_Players.smx`。
- 管理面板插件配置弹窗增加多实例提示：每个实例保存为
  `threi_players_<hostport>.cfg`，公共项可放在共享文件中。
- 插件 README、部署文档与 CHANGELOG 补充多实例配置方式。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`
- `plugins/ThRei_Players/cfg/sourcemod/threi_players.cfg.example`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`

### 数据库与 API 变化

- 无数据库和 API 变更；仍然使用每服务器独立的服务器 ID 与令牌，上报协议不变。

### 测试与结果

- `spcomp64`（1.11.0.6970）编译通过，压缩 `.smx` 为 10048 字节；
- 使用 `-z 0` 的临时产物确认包含版本 `1.2.0`、
  `cfg/sourcemod/threi_players_%d.cfg`、`threi_players_%d`、实例/共享配置日志与
  `config=cfg/sourcemod/%s.cfg`；
- 未在真实多实例游戏服务器上执行联调；需安装 1.2.0 后执行 `sm_threi_status` 确认
  `config` 指向预期文件，并观察后台两个服务器是否各自更新。

---

## 2026年10月25日 10时24分19秒 修复 ThRei_Players 因自定义 User-Agent 无法上报

### 背景

用户反馈游戏服务器插件没有上报，生产 API 也没有收到任何来自该服务器 IP 的请求。游戏服务器日志
反复出现：

```text
[ThRei_Players.smx] [ThRei_Players] Could not configure the HTTP request.
```

排查 Steamworks 文档和扩展源码后确认：`ISteamHTTP::SetHTTPRequestHeaderValue` 明确禁止设置
`User-Agent`（Steam 会在发送时覆盖），该调用返回 false。原插件把五个配置调用用 `&&` 串联，
第一个 Token 头成功后，第二个 `User-Agent` 头失败并短路，导致超时、请求体和回调都没有设置，
插件始终没有发送请求。该问题在 10:10 记录的 1.1.0 版本中仍然存在；本条记录升级到 1.1.1 修复。

### 变更内容

- 移除 `SteamWorks_SetHTTPRequestHeaderValue(request, "User-Agent", ...)`，由 Steam HTTP
  客户端使用自身 User-Agent；
- 将组合的 `&&` 配置链拆成逐步检查；失败时分别记录“token header / timeout / body / callbacks”
  具体步骤并关闭请求句柄，便于以后排查；
- `PLUGIN_VERSION` 从 `1.1.0` 升级到 `1.1.1`，使用 SourcePawn Compiler `1.11.0.6970`
  重新编译 `ThRei_Players.smx`；
- 插件 README 移除 `User-Agent` 请求头示例。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`
- `docs/CHANGELOG.md`

### 数据库与 API 变化

- 无数据库和 API 变更；上报协议、服务器 ID 与令牌格式不变。

### 测试与结果

- `spcomp64`（1.11.0.6970）编译通过，`.smx` 为 9528 字节；
- 使用 `-z 0` 的临时产物确认不再包含 `User-Agent`，包含 `name` 字段与版本 `1.1.1`；
- 未能在真实游戏服务器上验证发送结果，需要用户替换 `.smx` 后观察 API 是否收到上报；
- 生产 API 保持 `healthy`，其余功能未改动。

---

## 2026年10月25日 10时10分21秒 插件上报服务器名称并自动更新目录显示名

### 背景

上一项修改把添加服务器简化为 IP/端口，名称默认显示为 `host:port`。用户指出服务器名称应从游戏
服务器自动读取，而不是长期显示 IP 或要求管理员另行填写。

### 变更内容

- `ThRei_Players.sp` 升级到 `1.1.0`：读取游戏服务器 `hostname`，在 JSON 请求体中增加可选
  `name` 字段；
- 使用 SourceMod `1.11.0.6970` 编译器重新生成 `ThRei_Players.smx`，保持与 SourceMod 1.11
  运行时兼容；
- API `PluginReportRequest` 新增可选 `name`；上报时清理控制字符、限制 120 字符，并通过
  `COALESCE` 更新 `servers.name`，旧版插件或空名称不会覆盖现有名称；
- `persist_report` 的多个参数收拢为 `ReportPayload`，避免 clippy `too_many_arguments`；
- 新增单元测试覆盖名称清洗、空值和截断；
- 文档补充 `name` 字段、自动更新名称与重新编译说明。

### 涉及文件

- `plugins/ThRei_Players/addons/sourcemod/scripting/ThRei_Players.sp`
- `plugins/ThRei_Players/addons/sourcemod/plugins/ThRei_Players.smx`
- `plugins/ThRei_Players/README.md`
- `services/api/src/modules/server_plugin.rs`
- `docs/API.md`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`

### 数据库与 API 变化

- 无数据库迁移，`servers.name` 字段已存在；
- `POST /api/v1/plugin/report` 新增可选 `name` 字段；不带该字段的旧版插件请求保持兼容。

### 测试与结果

- `spcomp64`（SourcePawn Compiler 1.11.0.6970）编译通过，生成 9483 字节的 `.smx`；用
  `-z 0` 编译的临时产物确认包含 `{"serverId":"%s","name":"%s",...}` 和 `hostname`；
- `cargo fmt --all -- --check`、`cargo clippy --all-targets -- -D warnings`：通过；
- `cargo test`：26 个库单元测试与 14 个 HTTP 合约测试全部通过；
- 本机端到端：创建测试服务器并生成令牌后，上报
  `name=KZ | 本地测试服`，管理接口中的名称立即更新；再次上报不带 `name` 时名称保持不变；
  测试服务器已删除（`204`），测试会话已登出（`204`）；
- 生产环境：重建 `api` 镜像并重建容器（`healthy`），`https://threi.cn/` 返回 200；用 magic link
  创建测试服务器并上报 `name=KZ | 生产验证服` 后名称更新，不带 `name` 的后续上报保留名称；
  测试服务器删除（`204`）并登出（`204`）。

---

## 2026年10月25日 09时55分23秒 简化添加服务器流程为 IP/端口 + 插件令牌

### 背景

添加服务器原先要求管理员自行填写服务器 ID、名称、地图、地区等字段。其中 ID 同时是数据库主键、
插件配置里的 `sm_threi_server_id` 和上报匹配条件，管理员必须先想好一个合法 ID 才能配置插件，
容易出错。用户要求改为只输入 IP 和端口，其余通过生成的插件令牌完成配置。

### 变更内容

- `services/api/src/modules/server_admin.rs`：`CreateServerRequest` 除 `host`、`port` 外全部改为
  `Option` / 默认值；省略 `id` 时生成 `srv-` 加 12 位十六进制的 ID（UUID v4 前 12 位），
  自定义 `id` 重复时返回 `409`；
- 默认值：`name` 为 `host:port`，`map` 为 `待上报`，`status` 为 `offline`，`region` 为
  `未知`，`tickrate` 为 128，`maxPlayers` 为 64；
- `POST /api/v1/admin/servers` 成功响应改为 `201 Created` 与 `{ "id": "..." }`；
- 校验改为强制 `host` 非空且不含空格/斜杠、端口 1–65535；可选 ID 仍校验长度、小写字母、
  数字和连字符；
- 管理面板“添加服务器”弹窗只保留 Host/IP 与端口两个字段；添加成功后刷新列表并自动打开该
  服务器的「插件配置」弹窗，引导生成令牌；配置片段继续包含自动生成的服务器 ID；
- `apps/web/src/services/content.ts` 的 `createAdminServer` 只发送 `{ host, port }` 并返回
  `{ id }`；
- 同步更新 API、部署、插件文档与示例配置，示例服务器 ID 改为自动生成格式。

### 涉及文件

- `services/api/src/modules/server_admin.rs`
- `apps/web/src/services/content.ts`
- `apps/web/src/features/admin/components/server-admin-manager.tsx`
- `docs/API.md`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`
- `plugins/ThRei_Players/README.md`
- `plugins/ThRei_Players/cfg/sourcemod/threi_players.cfg.example`

### 数据库与 API 变化

- 无数据库迁移，`servers` 表结构不变；
- `POST /api/v1/admin/servers` 请求体中只有 `host`、`port` 必填，响应由空响应体改为
  `201 { "id": "..." }`；不影响 `ThRei_Players` 上报协议，`.smx` 无需重新编译；
- 自定义 `id` 仍可通过 API 传入，管理面板不再暴露该字段。

### 测试与结果

- `cargo fmt --all -- --check`：通过；
- `cargo clippy --all-targets -- -D warnings`：通过；
- `cargo test`：25 个库单元测试与 14 个 HTTP 合约测试全部通过；
- `npm run typecheck`、`npm run lint`、`npm run format:check`：通过；
- 本机用 magic link 取得管理员会话后，`POST /api/v1/admin/servers` 只发送
  `{"host":"203.0.113.10","port":27015}`，返回 `201 {"id":"srv-61f15ba2f761"}`；
- `GET /api/v1/admin/servers` 确认默认值：`name` 为 `203.0.113.10:27015`、`map` 为
  `待上报`、`status` 为 `offline`、`region` 为 `未知`、`tickrate` 128、`maxPlayers` 64、
  `pluginState` 为 `disabled`；
- 为该测试服务器生成插件令牌成功（32 位），随后删除测试服务器（`204`）并登出测试会话；
- 空 host / 端口 0 返回 `422 validation_error`；
- 生产环境重建 `api` 与 `web` 镜像并重建容器，二者均为 `healthy`；`https://threi.cn/`
  返回 `200`，`/api/v1/system/info` 正常；
- 生产环境用 magic link 取得管理员会话后，只发送
  `{"host":"203.0.113.10","port":27016}`，返回 `201` 与 `srv-95a26448e473`；默认值、
  插件令牌生成均正常，随后删除测试服务器（`204`）并登出（`204`）。

---

## 2026年10月25日 09时43分00秒 将生产 Steam 服务端访问切换到 Cloudflare Worker 中继

### 背景

直连 Steam 边缘 IP 已恢复登录，但单 IP 会随 Steam/Akamai 轮换失效。用户已有接入
Cloudflare 的 `threi.online`，选择用 Worker 中继作为更稳定的生产通道。

### 变更内容

- 在 Cloudflare 账号部署 Worker `threi-steam-relay`，代码来自
  `deploy/cloudflare/steam-relay-worker.js`；
- 通过 `wrangler.toml` 的 `custom_domain = true` 绑定 `steam.threi.online`，
  Cloudflare 自动创建代理 DNS 记录和证书；
- 新增 `deploy/cloudflare/wrangler.toml`，可用 `npx wrangler deploy` 复现部署；
- 生产 `.env` 设置 `STEAM_COMMUNITY_BASE_URL=https://steam.threi.online`，
  并将 `STEAM_COMMUNITY_IP` 置空；
- 只重建 API 容器，未重新构建镜像；
- 临时 Cloudflare API Token 仅用于本次部署，用后删除。

### 涉及文件

- `deploy/cloudflare/wrangler.toml`（新增）
- `deploy/cloudflare/README.md`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`
- 服务器 `/home/web/threi/.env`（不提交）

### 数据库与 API 变化

- 无代码和数据库变更；仅运行时环境变量变化。

### 测试与结果

- 本机访问 `https://steam.threi.online/profiles/76561199125125759?xml=1` 返回
  HTTP 200 和资料 XML；
- 生产服务器访问同一地址返回 HTTP 200（约 1.2 秒），DNS 解析到 Cloudflare 边缘；
- POST `/openid/login`（`openid.mode=check_authentication`）返回 `is_valid:false`，
  说明请求经中继到达 Steam 并可解析响应；
- 根路径 `/` 返回 404，符合只放行两条路径的设计；
- API 容器内 `STEAM_COMMUNITY_BASE_URL=https://steam.threi.online`、
  `STEAM_COMMUNITY_IP` 为空，容器内资料查询返回 200；
- API 重建后 healthy，`/api/v1/system/info` 正常；
- 未使用真实 Steam 账号完成浏览器端登录，仍需人工验证一次完整登录流程。

---

## 2026年10月25日 09时03分00秒 修复大陆主机 Steam 登录并新增一次性管理员登录

### 背景

生产 API 部署在腾讯云大陆主机，`steamcommunity.com` 的 TLS 连接会被重置，OpenID
`check_authentication` 和资料 XML 查询都会失败，用户登录后回到 `/account` 只会看到
`steam_login_failed`。浏览器侧同样可能无法打开 Steam 登录页，因此还需要一条不依赖 Steam
的管理员应急入口。

### 变更内容

- 新增 Steam 直连传输 `services/api/src/modules/auth/steam.rs`：
  - 用 `openssl s_client` 连接 `STEAM_COMMUNITY_IP`，SNI 使用完全限定名
    `steamcommunity.com.`，证书仍按 `steamcommunity.com` 校验；
  - 自行构造 HTTP/1.1 请求并解析 `Content-Length` / chunked 响应，只接受 identity 编码；
  - OpenID `check_authentication` 不重放（断言一次性）；资料查询失败时回退到
    `STEAM_COMMUNITY_BASE_URL`；
  - 12 秒超时、1 MiB 响应上限，非 2xx 统一返回错误。
- 新增配置 `STEAM_COMMUNITY_IP`（可选 IPv4/IPv6），并在 Compose 中透传。
- 新增一次性管理员登录：`GET /api/v1/auth/magic` 与 `services/api/src/bin/magic-link.rs`。
  - 运维在 API 容器内生成 64 位十六进制令牌，数据库只存 SHA-256 哈希，10 分钟有效；
  - 兑换时删除会话行、校验管理员角色/禁用状态/有效封禁，再签发正常会话 Cookie；
  - 用户不存在时创建管理员；已有普通成员需 `--promote`；失败重定向到
    `/account?steam_error=magic_login_failed`。
- API 运行镜像新增 `openssl`，并打包 `magic-link` 二进制；`Cargo.toml` 增加
  tokio `io-util`、`process`、`time` 特性。
- 用户中心登录卡片提示：无法打开 Steam 登录页时先开启 Steam 社区加速器。
- 更新部署文档（直连 / Worker 中继 / magic link）、CHANGELOG 与 Cloudflare 中继说明。

### 涉及文件

- `services/api/src/modules/auth/steam.rs`（新增）
- `services/api/src/bin/magic-link.rs`（新增）
- `services/api/src/modules/auth/mod.rs`
- `services/api/src/config/mod.rs`
- `services/api/src/openapi.rs`
- `services/api/Cargo.toml`
- `services/api/Dockerfile`
- `compose.yaml`
- `.env.example`
- `apps/web/src/app/(account)/account/page.tsx`
- `docs/DEPLOYMENT.md`、`docs/CHANGELOG.md`、`deploy/cloudflare/README.md`

### 数据库与 API 变化

- 无新迁移；magic link 复用 `sessions` 表（`token_hash`、`user_id`、`expires_at`）。
- 新增 `GET /api/v1/auth/magic`；OpenAPI 已注册。其余接口契约不变。
- 新增环境变量 `STEAM_COMMUNITY_IP`，为空时行为与之前一致。

### 测试与结果

- `cargo test --bins`：25 个测试通过，包含配置校验、HTTP 响应解析、chunked 解码、
  请求构造和传输 future `Send` 断言。
- `cargo clippy --all-targets -- -D warnings`：通过。
- 在 API 主机上手工验证：
  - `openssl s_client -connect 23.15.140.216:443 -servername steamcommunity.com.
    -verify_hostname steamcommunity.com` 返回 `HTTP/1.1 200 OK` 与资料 XML；
  - 向 `/openid/login` 发送 `check_authentication` 探测请求返回 `is_valid:false`，
    说明请求到达 Steam 且响应可解析。
- 未使用真实 Steam 账号完成浏览器端登录；生产部署后仍需人工验证一次完整登录。
- magic link 的实际兑换在部署后验证；未在本地执行真实数据库集成测试。

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
