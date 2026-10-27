# ThRei_Players

`ThRei_Players` 是 threi 的 SourceMod 服务器插件，负责：

- 向 threi API 上报服务器名称、地图、人数上限、SteamID64 在线玩家及其 IP；
- 从 threi API 同步白名单与封禁快照，在玩家连接时执行拦截；
- 长轮询管理后台下发的踢出/封禁/解封指令，通常 1 秒内执行，执行后向 API 确认；
- 把游戏内通过 `BanClient`（包括 `sm_ban`）执行的封禁回传网站，网站会记录封禁并自动封禁该玩家 IP；
- 网站解除服务器封禁时，删除服务器本地由 `sm_ban` 写入的 SteamID 封禁；
- 在最后一名玩家断开时立即补报一次，尽量让网站先清理名单再进入空服休眠。

白名单、踢出和封禁全部走带每服务器令牌的插件 HTTP 通道，**不需要 RCON**。RCON 只用于
站点侧可选的空服休眠状态探测，插件本身从不读取或发送 RCON 指令。

## 依赖

- SourceMod 1.11 或更高版本
- [SteamWorks 扩展](https://github.com/Julien-Marchand/SteamWorks)（HTTP 请求通过 Steam 客户端发送）

只安装 SourceMod 而没有 SteamWorks 时，插件无法上报或同步访问规则，日志会提示
`SteamWorks extension is not loaded`。

## 安装与升级

已编译的插件位于：

```text
addons/sourcemod/plugins/ThRei_Players.smx
```

将 `addons` 目录复制到对应游戏目录（例如 CS:GO 的 `csgo/`、CS:S 的 `cstrike/`），然后执行：

```text
sm plugins load ThRei_Players
```

升级时覆盖 `.smx` 后执行：

```text
sm plugins reload ThRei_Players
sm_threi_status
```

1.8.0 改成**纯插件封禁**：不再写 basebans/引擎封禁，封禁保存在
`configs/threi_bans.cfg` 并在玩家连接时由插件用自定义提示踢出。因此：

- 封禁立即生效，解封后立即可以重新连接；
- 重连时显示我们的 `sm_threi_ban_kick_message` 和原因，而不是 Valve 的
  “您已被禁止使用此服务器”；
- 1.8.1 起不再检测 basebans，始终注册 `sm_ban` / `sm_addban` / `sm_unban` /
  `sm_banip` / `sm_unbanip`。请直接删除 `basebans.smx`，避免命令重复注册。

1.7.0 新增 `sm_threi_*` 封禁命令和网站分组解封；1.7.1 支持 SteamID64/2/3；1.7.2 修复
非法 UTF-8 与 4xx 队列堵塞；1.7.3 支持不加引号的 SteamID2/3 参数。1.6.1 增加了网站
解封时的本地 `unban` 指令。1.6.0 增加了在线玩家 IP 上报与游戏内封禁回传。1.5.0 使用
`/plugin/actions?wait=20` 长轮询，新指令通常 1 秒内到达；旧 API 会返回 404，此时插件仍会
上报状态，但不会执行访问控制。

> 1.8.1 的封禁只存在于插件和 `configs/threi_bans.cfg` 中；插件未加载时封禁不会生效。
> 网站仍然是权威来源，插件会定期从访问快照刷新 SteamID 封禁。

## 获取服务器令牌

1. 登录 threi 管理后台，进入「服务器管理」。
2. 点击「添加服务器」，填写游戏服务器的 Host / IP 和端口；服务器 ID 由系统自动生成。
3. 添加成功后打开「插件配置」（已有服务器直接点击该按钮）。
4. 点击「生成令牌」。令牌只在该对话框中显示给管理员。
5. 复制生成的配置行。每台服务器使用独立令牌；重新生成会让旧令牌立即失效。

令牌不会出现在服务器列表、公开接口或 API 日志中。

## 配置

插件只读取 `cfg/sourcemod/threi_players.cfg`。首次加载时会自动生成文件；已有文件不会被覆盖，
新版本新增的配置项不写进文件时会使用默认值。

单实例可以填写服务器 ID 与令牌：

```cfg
sm_threi_players_enabled "1"

// 完整上报地址，必须包含 /api/v1/plugin/report
sm_threi_api_url "https://threi.cn/api/v1/plugin/report"

// 添加服务器时生成的服务器 ID（插件配置弹窗会给出）
sm_threi_server_id "srv-1a2b3c4d5e6f"

// 管理后台生成的令牌，不要泄露
sm_threi_token "把这里替换成插件令牌"

// 上报间隔，单位秒，范围 5–600
sm_threi_interval "30"
```

### 访问控制与指令配置

```cfg
// 总开关：同步白名单/封禁并在玩家连接时拦截
sm_threi_access_enabled "1"

// 首次快照尚未加载时是否放行。1 = 放行，0 = 在加载前拒绝连接。
// 快照成功加载后，白名单与封禁始终严格生效，不受此开关影响。
sm_threi_access_fail_open "1"

// 白名单/封禁快照刷新间隔，单位秒，范围 10–600
sm_threi_access_interval "30"

// 总开关：长轮询网站下发的踢出/封禁指令
sm_threi_actions_enabled "1"

// 失败后的重试间隔，单位秒，范围 5–600。正常投递使用 20 秒 long-poll，
// 不再是固定轮询间隔。
sm_threi_actions_interval "15"

// 被白名单拦截时的提示
sm_threi_whitelist_kick_message "该服务器需要白名单。请在 threi.cn 提交申请后重试。"

// 被封禁玩家连接或被踢出时的基础提示；具体封禁原因会附加在括号中
sm_threi_ban_kick_message "你已被该服务器封禁。"
```

可以对照仓库中的示例：`cfg/sourcemod/threi_players.cfg.example`。

修改后执行：

```text
sm plugins reload ThRei_Players
sm_threi_status
```

`sm_threi_status` 只显示令牌是否已配置，不会输出令牌内容。它会显示当前实例的 `hostport`、
实例配置是否匹配、API 地址、访问快照是否已加载、白名单/封禁条目数量与待确认指令数。

### 一台主机运行多个实例

多个实例共用同一份 SourceMod 安装和 `cfg/sourcemod` 目录时，只维护一份
`threi_players.cfg`。为每个实例添加一行 `sm_threi_instance`：

```cfg
sm_threi_players_enabled "1"
sm_threi_api_url "https://threi.cn/api/v1/plugin/report"
sm_threi_interval "30"
sm_threi_access_enabled "1"
sm_threi_actions_enabled "1"

// sm_threi_instance <实例端口> <该服务器在后台生成的令牌>
sm_threi_instance 10001 "实例 10001 的令牌"
sm_threi_instance 10002 "实例 10002 的令牌"
```

插件启动时读取自身的 `hostport`（缺失时回退到 `port`），只使用端口匹配的那一行令牌。
上报请求可以不带 `serverId`，API 会根据唯一令牌找到对应服务器。访问快照与指令轮询也使用
同一令牌，因此不需要把服务器 ID 复制到配置里。

- 端口必须与实例实际监听的 `hostport` 一致；修改实例端口后同步修改对应行。
- 配置中只要存在任意一行有效的 `sm_threi_instance`，插件就不再使用
  `sm_threi_server_id` / `sm_threi_token`。如果当前端口没有匹配行，插件会记录错误并暂停所有
  HTTP 请求，避免把数据或指令作用到错误的服务器。
- 仍兼容三参数形式：`sm_threi_instance <端口> <服务器ID> <令牌>`。
- 修改后执行 `sm plugins reload ThRei_Players`，再用 `sm_threi_status` 确认
  `hostport` 和 `instance=matched`。

## 工作方式

### 状态上报

- 每 `sm_threi_interval` 秒上报一次（默认 30 秒）；
- 地图开始时；
- 玩家通过 Steam 认证进入后；
- 玩家断开后；最后一名玩家离开时会立即尝试发送一次，跳过即将离线的该玩家；
- 管理员执行 `sm_threi_report` 时。

只上报满足以下条件的玩家：

- 在游戏中；
- 不是 bot、SourceTV 或 Replay；
- `GetClientAuthId(client, AuthId_SteamID64, ...)` 验证成功；
- SteamID64 为 17 位数字。

### 白名单与封禁

插件每 `sm_threi_access_interval` 秒获取一次纯文本访问快照：

```text
# ThRei access snapshot v1
server srv-1a2b3c4d5e6f
requires_whitelist 1
whitelist 76561199125125759
ban 76561198000000000 0 永久封禁
ban 76561198000000001 1792914155 临时封禁
```

- `requires_whitelist 0` 时只执行封禁，不检查白名单；`1` 时同时检查。
- 快照中的 `whitelist` 行来自网站的全服白名单；同一份名单用于所有开启 `requires_whitelist`
  的服务器。玩家申请并通过一次后，所有这类服务器都可进入。
- `ban` 的第二个字段是到期 Unix 时间戳，`0` 表示永久。插件本地也会判断是否过期，
  网站解除封禁或封禁到期后，新快照加载即恢复放行。
- 快照加载后，新连接会在 `OnClientPostAdminCheck` 时检查；随后每次刷新快照也会复查在线玩家，
  因此在网站新增封禁、移除白名单或解除封禁后，最长约一个刷新间隔即可生效。
- 快照保存在内存中。API 暂时不可达时继续使用最后一次成功加载的规则，不会因为一次网络失败
  突然放行或踢出所有人。
- `sm_threi_access_fail_open` 只影响“首次快照尚未成功加载”的短暂时段；默认放行以避免服务器
  启动时把所有人锁在门外。

### 踢出与封禁指令

插件对 `/plugin/actions?wait=20` 发起 long-poll：没有指令时请求最多挂起 20 秒，一有新指令
立即返回；每次响应后约 1 秒内重新发起下一次请求。`sm_threi_actions_interval` 只作为请求
失败后的重试间隔。

```text
# ThRei actions v1
action 7e4f... kick 76561199125125759 管理员踢出
action 8a1d... ban 76561198000000000 1792914155 临时封禁
action 9c2e... unban 76561198000000000 网站解除封禁
```

- `kick` 只踢出当前在线目标，不写入本地封禁缓存。
- `ban` 立即写入本地封禁缓存并踢出在线目标，防止玩家在下次快照前重连；随后由快照中的权威
  到期时间与原因覆盖本地条目。
- `unban` 由网站解除游戏服务器封禁时下发。插件先清除本地访问缓存，再把 SteamID64 转换为
  SteamID2，调用 `RemoveBan(BANFLAG_AUTHID)` 删除 `sm_ban` / `BanClient` 写入的服务器本地
  SteamID 封禁。手动在游戏内添加的 IP 封禁不在此列。
- 已过期或已被管理员解除的封禁不会被执行；插件仍会确认该指令，避免队列反复下发。
- 执行后插件调用 `POST /api/v1/plugin/actions/{id}/ack`，API 记录 `processed_at`。
  确认失败时指令会在下一次轮询中重试；踢出/封禁操作本身是幂等的。

## 空服休眠与 RCON

CS:GO 的 `sv_hibernate_when_empty` 会在空服时暂停游戏帧与 SourceMod 定时器，插件因此停止上报。
网站会把配置了 RCON 密码的服务器交给可选的 RCON 状态探测：仅发送 `status` 命令，把空服标记为
`hibernating`。这与插件无关，也不是白名单/踢出/封禁的前置条件。

没有配置 RCON 密码的空服会在 90 秒后被网站标记为 `offline`，但进程通常仍可连接；服务器目录
仍会提供「加入游戏」。完整说明见仓库 `docs/DEPLOYMENT.md`。

## 管理命令

| 命令 | 说明 |
| --- | --- |
| `sm_threi_ban` | 封禁在线目标或 SteamID<br>`sm_threi_ban <目标\|SteamID64\|STEAM_x:y:z\|[U:1:account]> <分钟> [原因]` |
| `sm_threi_addban` | 按 SteamID 封禁（可离线）<br>`sm_threi_addban <SteamID64\|STEAM_x:y:z\|[U:1:account]> <分钟> [原因]` |
| `sm_threi_unban` | 解封 SteamID 并同步网站<br>`sm_threi_unban <SteamID64\|STEAM_x:y:z\|[U:1:account]>` |
| `sm_threi_banip` | 封禁 IP 并同步网站<br>`sm_threi_banip <IP> <分钟> [原因]` |
| `sm_threi_unbanip` | 解封 IP 并同步网站<br>`sm_threi_unbanip <IP>` |
| `sm_threi_report` | 立即发送一次状态上报 |
| `sm_threi_status` | 显示端口匹配、访问缓存与指令队列状态（隐藏令牌） |

`sm_threi_ban`、`sm_threi_addban`、`sm_threi_unban`、`sm_threi_banip`、`sm_threi_unbanip`
需要 `ADMFLAG_BAN`；`sm_threi_report`、`sm_threi_status` 需要 `ADMFLAG_ROOT`。

1.8.1 起不再检测 basebans，始终注册 `sm_ban` / `sm_addban` / `sm_unban` / `sm_banip` /
`sm_unbanip`。请先删除 `basebans.smx`，否则两个插件会争用同名命令并产生注册错误。删除后
执行 `sm plugins reload ThRei_Players` 即可。

### 封禁行为

- 1.8.1 的封禁只写入插件内存和 `configs/threi_bans.cfg`，**不写 basebans/引擎封禁**。
  玩家连接时由 `CheckClientAccess` 用 `sm_threi_ban_kick_message` + 具体原因踢出，因此重连
  也能看到自定义提示。
- `sm_threi_ban` / `sm_threi_addban` 立即写插件封禁、保存文件、踢出在线目标，并异步上报
  网站；网站记录包含账号封禁、该服务器游戏封禁，在线目标还会带 IP 自动封禁。网站不可达时
  本地插件封禁先生效，上报进入重试队列。
- `sm_threi_unban` / `sm_threi_unbanip` 先请求网站解除插件来源的记录，成功返回后删除插件
  内存和文件中的封禁；没有引擎封禁需要等待，所以可以立即重连。网站仍有管理员手动封禁时
  返回 `409`，插件会提示并且不会在本地解封。
- 网站「封禁管理」解除某条游戏服务器封禁时，会一并解除同一次游戏内封禁产生的网站账号/IP
  封禁，并下发 `unban`；插件收到后删除本地插件封禁。若发现旧版 1.7.x 写入的引擎封禁，
  也会顺带执行 `RemoveBan` 清理。
- `sm_threi_ban` 的原因默认“管理员封禁”，最长 400 字符；分钟数 `0` 表示永久。在线目标解析
  遵循 SourceMod immunity；离线 SteamID 直接封禁。
- SteamID64、SteamID2（`STEAM_0:0:...` 或 `STEAM_1:...`）和 SteamID3（`[U:1:...]` 或
  `U:1:...`）都可以用于 `sm_threi_ban` / `sm_threi_addban` / `sm_threi_unban`；内部统一
  转成 SteamID64 再匹配。1.7.3+ 直接读取原始参数串，因此这些格式不加引号也可以；加引号
  仍然兼容。
- 上报前会校验玩家名/原因的 UTF-8；非法名字回退为 SteamID，非法原因回退为“管理员封禁”，
  避免网站 JSON 解析返回 400。HTTP 4xx（408/429 除外）会记录并丢弃该条上报，避免堵塞后续
  封禁；网络错误和 5xx 继续退避重试。
- `sm_threi_banip` 写插件 IP 封禁和网站 IP 封禁；连接时同时检查 SteamID 和 IP。网站
  `create_ip_ban` 会自动关联已知普通账号。
- 首次加载访问快照时会为当前网站封禁和插件 IP 封禁执行一次 `RemoveBan`，清理旧版 1.7.x
  写入的引擎封禁；basebans 自己遗留的、未被网站接管的引擎封禁仍存在于
  `banned_user.cfg` / `banned_ip.cfg`，需要时手动清理。

`sm_threi_instance` 不是管理命令，而是供 `threi_players.cfg` 调用的服务器控制台命令，由插件
在加载配置时解析。

## API 协议

所有插件请求都带：

```http
X-ThRei-Plugin-Token: <每服务器令牌>
```

### 上报

```http
POST /api/v1/plugin/report
Content-Type: application/json
```

```json
{
  "name": "KZ | 新手服",
  "map": "kz_beginner",
  "maxPlayers": 32,
  "players": [
    {
      "steamId64": "76561199125125759",
      "name": "玩家昵称",
      "ipAddress": "203.0.113.10",
      "connectedSeconds": 120
    }
  ]
}
```

成功响应：

```json
{
  "serverId": "srv-1a2b3c4d5e6f",
  "playerCount": 1,
  "skipped": 0,
  "reportedAt": "2026-10-25T04:15:00Z"
}
```

`serverId` 可省略，此时 API 根据唯一令牌找到服务器；如果同时提供，则必须与令牌所属服务器一致。
上报会事务性替换在线名单：不在本次名单中的旧玩家会被删除，持续在线的玩家保留原 `connected_at`。
`ipAddress` 由插件通过 `GetClientIP` 上报，用于服务器封禁时自动创建 IP 封禁；旧版插件不发送
该字段，API 会按 `NULL` 处理。

### 游戏内封禁回传

插件 1.6.0 注册 `OnBanClient` 转发。服务器内通过 `BanClient` 执行的封禁（包括常见的
`sm_ban` 命令）会异步上报：

```http
POST /api/v1/plugin/ban-report
Content-Type: application/json
```

```json
{
  "steamId64": "76561199125125759",
  "ipAddress": "203.0.113.10",
  "playerName": "玩家昵称",
  "reason": "长期挂机",
  "durationMinutes": 0
}
```

- `durationMinutes` 为 SourceMod 的封禁分钟数，`0` 表示永久。
- 网站会写入一条账号封禁、一条该服务器的游戏封禁；如果该玩家有 IP，还会自动创建 IP 封禁。
  三条记录共享 `ban_group_id`，网站解除服务器封禁时会按分组一起解除（插件来源）。
- 上报失败会按退避间隔重试；服务器本地封禁已经生效，不依赖网站是否可达。
- 原始控制台 `banid` / `addip` 不会触发 `OnBanClient`，因此不会回传。使用 `sm_ban`、
  `sm_threi_ban` 或 `BanClient` 才能同步。
- 网站下发的封禁指令写入插件封禁缓存和 `configs/threi_bans.cfg`，不写引擎封禁；插件重载后
  由文件继续生效。网站 `unban` 指令会删除该条目，玩家可立即重连。
- 游戏内 `sm_threi_unban` 会先调用 `POST /plugin/unban-report`，成功后删除插件封禁；网站仍有
  管理员手动封禁时返回 `409`，不会在本地解封。直接使用 basebans `sm_unban` 只会清理旧引擎
  封禁，不会同步网站/插件封禁。
- 一次游戏内封禁在网站产生分组记录；通过网站解除「游戏服务器封禁」会同时解除同组账号/IP
  封禁。没有分组的历史记录需要分别检查。

### IP 封禁回传

```http
POST /api/v1/plugin/ip-ban-report
Content-Type: application/json
```

```json
{
  "ipAddress": "203.0.113.10",
  "reason": "恶意刷屏",
  "durationMinutes": 0
}
```

插件 `sm_threi_banip` 使用该接口写入网站 IP 封禁。网站会关联该 IP 下已知的普通账号；
`sm_threi_unbanip` 调用 `/plugin/unban-report` 并只解除插件来源的 IP 封禁。

### 游戏内解封回传

```http
POST /api/v1/plugin/unban-report
Content-Type: application/json
```

```json
{
  "steamId64": "76561198000000000",
  "ipAddress": "203.0.113.10",
  "reason": "游戏内解封"
}
```

- `steamId64` 和 `ipAddress` 至少提供一个。
- API 只解除 `created_by IS NULL` 的插件来源记录；如果该服务器或网站仍有管理员手动封禁，
  返回 `409`，插件保持本地封禁。
- 成功后插件删除本地 SteamID/IP 封禁和访问缓存。

### 访问快照

```http
GET /api/v1/plugin/access-snapshot
Accept: text/plain
```

响应为上文所示的 `# ThRei access snapshot v1` 纯文本，成功状态 `200`。

### 待执行指令与确认

```http
GET /api/v1/plugin/actions
Accept: text/plain
```

响应为 `# ThRei actions v1` 纯文本。执行后：

```http
POST /api/v1/plugin/actions/{uuid}/ack
```

成功返回 `204 No Content`。令牌缺失、错误或服务器已撤销令牌时统一返回 `401`；确认不属于
当前服务器的指令返回 `404`。

## 安全

- 生产环境必须使用 HTTPS：令牌在 HTTP 请求头中传输，明文 HTTP 会让令牌暴露在网络中。
- 令牌只写入游戏服务器的 `cfg/sourcemod/threi_players.cfg`，不要提交到 Git。
- 1.6.0 起令牌还可回传游戏内封禁（会写入账号封禁、服务器封禁和 IP 封禁）；1.7.0 起还可
  解封插件来源记录。令牌泄露等同于允许伪造封禁/解封，应立即在管理后台轮换。
- 令牌使用 `FCVAR_PROTECTED | FCVAR_UNLOGGED`，不会下发给游戏客户端。
- 定期在管理后台重新生成令牌，尤其是在管理员变动或配置文件泄露后。
- 1.8.1 的本地封禁保存在 `configs/threi_bans.cfg`，文件损坏会导致插件封禁失效；建议纳入
  服务器备份，并限制文件写权限。插件未加载时纯插件封禁不会生效。
- 游戏服务器只需要能访问 threi 的 API 地址；白名单、踢出与封禁不依赖 RCON，也不要求开放
  A2S/RCON 端口。

## 编译

使用 SourceMod 1.11 编译器，并确保 `SteamWorks.inc` 在 include 路径中：

```bash
spcomp64 \
  -i /path/to/sourcemod/scripting/include \
  -i /path/to/SteamWorks.inc/directory \
  -o addons/sourcemod/plugins/ThRei_Players.smx \
  addons/sourcemod/scripting/ThRei_Players.sp
```

当前仓库内的 `.smx` 使用 SourcePawn Compiler 1.11.0.6970 编译。

## 排错

**插件没有加载**

- 确认 SourceMod 版本不低于 1.11。
- 确认 SteamWorks 扩展已安装并在 `sm exts list` 中显示为运行中。
- 查看 `addons/sourcemod/logs/` 下的错误日志。

**cfg/sourcemod/threi_players.cfg 没有自动生成**

插件在 `OnPluginStart` 中调用了 `AutoExecConfig(true, "threi_players")`，正常情况下首次加载
就会生成该文件。**自动生成的文件只包含 ConVar**；`sm_threi_instance` 是用 `RegServerCmd`
注册的控制台命令，不是 ConVar，因此不会出现在自动生成的文件里，需要手动添加：

```cfg
sm_threi_api_url "https://threi.cn/api/v1/plugin/report"
sm_threi_instance 10001 "该服务器的令牌"
```

单实例也可以不写 `sm_threi_instance`，改为填写 `sm_threi_server_id` 与 `sm_threi_token`
两个 ConVar；只要文件里存在任意一行有效的 `sm_threi_instance`，插件就会忽略这两个 ConVar。
没有生成文件时按顺序检查：

- `sm plugins list` 是否显示 `ThRei_Players` 且版本正确；未加载时执行
  `sm plugins load ThRei_Players` 并查看控制台错误。
- 文件只会写入当前游戏目录：CS:GO 是 `<serverfiles>/csgo/cfg/sourcemod/`，CS:S 是
  `<serverfiles>/cstrike/cfg/sourcemod/`。多实例共用 SourceMod 时只有一份共享 cfg。
- 确认 `cfg/sourcemod` 目录存在，且运行服务器的用户对它可写；目录属主错误时
  `AutoExecConfig` 无法创建文件，也不会覆盖已有文件。
- 可以直接从仓库的 `cfg/sourcemod/threi_players.cfg.example` 复制一份为
  `cfg/sourcemod/threi_players.cfg`，填入令牌后执行 `sm plugins reload ThRei_Players`。

**后台显示「等待插件上报」**

- 执行 `sm_threi_status`，确认 `hostport` 正确、`instance=matched`，api 与 token 均已配置。
- 多实例主机确认配置文件中有该端口对应的 `sm_threi_instance` 行；没有匹配行时插件会记录
  `No sm_threi_instance entry matches hostport ...` 并暂停请求。
- 执行 `sm_threi_report` 立即触发一次上报。
- 确认游戏服务器可以访问 `sm_threi_api_url`；必要时在服务器上使用 curl 测试。
- 确认 URL 包含 `/api/v1/plugin/report`，并且协议为 `http://` 或 `https://`。

**白名单或封禁没有生效**

- 确认 `sm_threi_access_enabled "1"`，并用 `sm_threi_status` 查看 `access=enabled loaded=yes`。
- 如果显示 `loaded=no`，检查 API 的 `access-snapshot` 请求是否返回 `200`；旧版 API 会返回 404。
- 网站修改后最多等待一个 `sm_threi_access_interval`（默认 30 秒），或重载插件立即重新加载。
- 如果服务器 `requires_whitelist` 为关闭状态，插件不会用白名单拦截，但仍会执行封禁。

**网站踢出/封禁后游戏内没有反应**

- 确认 `sm_threi_actions_enabled "1"`，并用 `sm_threi_status` 查看 `actions=enabled` 与
  `pendingAcks`。
- 正常情况新指令约 1 秒内执行；API 不可达时按 `sm_threi_actions_interval` 重试。
- 目标玩家已经离线时，踢出不会产生额外动作；封禁仍会写入本地缓存阻止重连。

**网站解封后游戏内仍然被封**

1.8.0+ 会在网站解除「游戏服务器封禁」时自动下发 `unban`，删除插件封禁文件/缓存中的
SteamID 条目，玩家无需等待引擎解封即可重连；网站账号/IP 封禁也会按分组解除。如果仍然
被封，确认 `sm_threi_status` 显示 `version=1.8.1`，并确认解除的是「游戏服务器封禁」而不是
只解除了网站账号/IP 封禁。

如果是从 1.7.x 升级，旧版写入的引擎封禁会在首次快照加载时清理；basebans 自己遗留的、
未被网站接管的引擎封禁仍可能需要手动 `sm_unban`。手动解封旧引擎封禁时不要用
`sm_unban <SteamID64>`（basebans 会把它当 IP），请用 SteamID2/3：

```text
sm_unban "STEAM_1:1:12345678"
sm_unban "[U:1:24691356]"
```

1.8.1 安装并卸载 basebans 后，直接使用 `sm_unban` / `sm_threi_unban` 即可，不再依赖
`sm_banlist`；网站上的账号封禁、服务器封禁和 IP 封禁仍需分别解除。

**游戏内封禁没有出现在网站**

- 确认插件版本为 1.8.1 或更高：`sm_threi_status` 应显示 `version=1.8.1`。网站解封和分组
  清理需要 1.7.0+；1.6.0 只支持封禁回传。
- `sm_threi_ban` / `sm_threi_addban` / `sm_threi_banip` 会主动上报；通过 `BanClient`
  执行的封禁（如 basebans `sm_ban`）会经 `OnBanClient` 回传；控制台原始 `banid` /
  `addip` 不会回传。
- 查看 `addons/sourcemod/logs/` 中是否出现 `Queued in-game ban report`；出现
  `Ban report failed` 时检查 API 连通性、令牌和 `sm_threi_api_url`。
- 网站已在更早时间存在同一玩家的有效账号封禁时，不会重复写入账号封禁，但仍会补写该服务器的
  游戏封禁与 IP 封禁。

**API 返回 401**

- 令牌错误、令牌已被重新生成/撤销，或提供了与令牌不匹配的服务器 ID。
- 在后台重新复制配置，更新 `cfg/sourcemod/threi_players.cfg` 后重新加载插件。

**API 返回 404（访问控制接口）**

- API 版本过旧，不包含 `plugin/access-snapshot`、`plugin/actions`、`plugin/ban-report`
  或确认接口。
- 升级网站 API 后重载插件。

**API 返回 422**

- 地图名超过 128 字符、最大玩家数不在 1–1024 之间，或上报内容不是合法 JSON。
- 查看 `addons/sourcemod/logs/` 中记录的响应内容。

**服务器显示离线或休眠**

- `hibernating` 表示网站通过可选的 RCON `status` 探测确认空服仍在运行；没有配置 RCON 时，
  超过 90 秒没有上报会显示 `offline`。
- 检查插件是否仍在运行、SteamWorks 是否正常、网络是否可达，并查看日志。
- 空服休眠会暂停 SourceMod 定时器，这是游戏引擎行为，不代表插件崩溃。
