# ThRei_Players

`ThRei_Players` 是 threi 的 SourceMod 服务器插件，负责：

- 向 threi API 上报服务器名称、地图、人数上限与 SteamID64 在线玩家；
- 从 threi API 同步白名单与封禁快照，在玩家连接时执行拦截；
- 轮询管理后台下发的踢出/封禁指令，执行后向 API 确认；
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

1.4.0 新增的白名单/封禁同步需要使用本仓库中带 `plugin/access-snapshot` 与
`plugin/actions` 接口的 API。旧 API 会返回 404，此时插件仍会上报状态，但不会执行访问控制。

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

// 总开关：轮询网站下发的踢出/封禁指令
sm_threi_actions_enabled "1"

// 指令轮询间隔，单位秒，范围 5–600
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
- `ban` 的第二个字段是到期 Unix 时间戳，`0` 表示永久。插件本地也会判断是否过期，
  网站解除封禁或封禁到期后，新快照加载即恢复放行。
- 快照加载后，新连接会在 `OnClientPostAdminCheck` 时检查；随后每次刷新快照也会复查在线玩家，
  因此在网站新增封禁、移除白名单或解除封禁后，最长约一个刷新间隔即可生效。
- 快照保存在内存中。API 暂时不可达时继续使用最后一次成功加载的规则，不会因为一次网络失败
  突然放行或踢出所有人。
- `sm_threi_access_fail_open` 只影响“首次快照尚未成功加载”的短暂时段；默认放行以避免服务器
  启动时把所有人锁在门外。

### 踢出与封禁指令

插件每 `sm_threi_actions_interval` 秒轮询待执行指令：

```text
# ThRei actions v1
action 7e4f... kick 76561199125125759 管理员踢出
action 8a1d... ban 76561198000000000 1792914155 临时封禁
```

- `kick` 只踢出当前在线目标，不写入本地封禁缓存。
- `ban` 立即写入本地封禁缓存并踢出在线目标，防止玩家在下次快照前重连；随后由快照中的权威
  到期时间与原因覆盖本地条目。
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
| `sm_threi_report` | 立即发送一次状态上报 |
| `sm_threi_status` | 显示端口匹配、访问缓存与指令队列状态（隐藏令牌） |

两个命令都需要 `ADMFLAG_ROOT`。

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
- 令牌使用 `FCVAR_PROTECTED | FCVAR_UNLOGGED`，不会下发给游戏客户端。
- 定期在管理后台重新生成令牌，尤其是在管理员变动或配置文件泄露后。
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
- 网站显示的是待执行队列，插件最长在一个 `sm_threi_actions_interval`（默认 15 秒）后执行。
- 目标玩家已经离线时，踢出不会产生额外动作；封禁仍会写入本地缓存阻止重连。

**API 返回 401**

- 令牌错误、令牌已被重新生成/撤销，或提供了与令牌不匹配的服务器 ID。
- 在后台重新复制配置，更新 `cfg/sourcemod/threi_players.cfg` 后重新加载插件。

**API 返回 404（访问控制接口）**

- API 版本过旧，不包含 `plugin/access-snapshot`、`plugin/actions` 和确认接口。
- 升级网站 API 后重载插件。

**API 返回 422**

- 地图名超过 128 字符、最大玩家数不在 1–1024 之间，或上报内容不是合法 JSON。
- 查看 `addons/sourcemod/logs/` 中记录的响应内容。

**服务器显示离线或休眠**

- `hibernating` 表示网站通过可选的 RCON `status` 探测确认空服仍在运行；没有配置 RCON 时，
  超过 90 秒没有上报会显示 `offline`。
- 检查插件是否仍在运行、SteamWorks 是否正常、网络是否可达，并查看日志。
- 空服休眠会暂停 SourceMod 定时器，这是游戏引擎行为，不代表插件崩溃。
