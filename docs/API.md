# ThRei API 约定

> 当前版本：`v1`（Steam 登录与真实数据阶段）。
> 本文区分**已实现**与**规划**能力。规划中的接口不得被前端或第三方当作可用能力。

## 1. 基础约定

| 项目 | 约定 |
| --- | --- |
| 业务 API 前缀 | `/api/v1` |
| 传输 | HTTPS（生产，经 Nginx 终止 TLS）；HTTP 仅本地开发 |
| 请求/响应格式 | `application/json; charset=utf-8` |
| 字段命名 | 健康/系统接口保持既有 `snake_case`；业务接口使用 `camelCase` |
| 时间格式 | RFC 3339 / UTC |
| 认证 | Steam OpenID 登录 + `threi_session` HttpOnly Cookie；插件上报使用每服务器令牌 |
| 请求追踪 | 响应头 `x-request-id` |
| 健康检查 | 根路径 `/health/live`、`/health/ready`，不属于业务 API |
| OpenAPI | `/api/v1/openapi.json`、`/api/v1/docs`（受 `API_DOCS_ENABLED` 控制） |

生产环境中，浏览器与 API 同源：Nginx 将 `/api/` 直接转发到 API。开发环境可使用 Next.js rewrite 或 `NEXT_PUBLIC_API_BASE_URL` 指向 `http://127.0.0.1:8080`。

## 2. 认证

### 2.1 登录流程

1. 浏览器访问 `GET /api/v1/auth/steam/login`。
2. API 返回 `307`，跳转到 `https://steamcommunity.com/openid/login`，携带 `return_to` 和 `realm`。
3. Steam 授权后跳回 `GET /api/v1/auth/steam/callback`。
4. API 向 Steam 发送 `openid.mode=check_authentication`；只有返回 `is_valid:true` 才接受断言。
5. API 按 `steam_id64` 创建/更新用户，写入会话并返回 `303` 到 `/account`。
6. 浏览器收到 `Set-Cookie`：

```text
threi_session=<opaque-token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000
```

生产环境使用 HTTPS 时追加 `Secure`。数据库只保存令牌的 SHA-256 哈希，不保存原始令牌。

Steam 是唯一登录方式；没有密码、邮箱注册或其他登录入口。

### 2.2 会话接口

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/auth/me` | 可选 | 返回 `{ "user": ... }`；未登录为 `{ "user": null }` |
| POST | `/api/v1/auth/logout` | 需要 | 删除当前会话并清除 Cookie，返回 `204` |

`user` 示例：

```json
{
  "user": {
    "steamId64": "76561198000000000",
    "name": "Steam 昵称",
    "avatarUrl": "https://avatars.akamai.steamstatic.com/...",
    "role": "member",
    "bio": "",
    "location": "",
    "joinedAt": "2026-10-23T14:43:25Z",
    "lastLoginAt": "2026-10-23T14:43:25Z"
  }
}
```

### 2.3 角色与权限

- `role`：`member` / `moderator` / `admin`。
- `ADMIN_STEAM_IDS` 用于首次创建/引导管理员；已有用户的数据库角色不会被登录覆盖，之后通过管理面板维护。
- `/api/v1/account` 需要登录；`/api/v1/admin/overview` 需要管理员。
- 管理页面 `/admin` 在 Web 服务端检查会话与角色，API 仍会再次检查。
- 公开读取接口不需要登录。

### 2.4 尚未实现

- 登录/回调限流
- CSRF 双提交令牌（当前没有写业务接口；登出 POST 不携带 CSRF 令牌）
- RBAC 细粒度权限、会话设备管理、强制下线
- 审核/审计接口

## 3. 健康与系统

### 3.1 `GET /health/live`

进程存活检查，不访问依赖。

```json
{ "status": "ok", "service": "threi-api", "version": "0.1.0" }
```

### 3.2 `GET /health/ready`

并行探测 PostgreSQL 与 Redis（各 2 秒超时）。数据库失败或 Redis 必需但不可用时返回 `503`；Redis 非必需且不可用时返回 `200` + `degraded`。不返回连接串或驱动错误。

### 3.3 `GET /api/v1/system/info`

非敏感服务元信息，不需要认证：

```json
{
  "name": "threi-api",
  "version": "0.1.0",
  "environment": "production",
  "api_version": "v1"
}
```

## 4. 服务器

### `GET /api/v1/servers`

返回 `is_active=true` 的服务器，按推荐与名称排序。在线玩家取 `server_players.last_seen_at` 最近 5 分钟的记录。数据库为空时返回 `[]`。

```json
[
  {
    "id": "kz-beginner",
    "name": "KZ | Beginner",
    "map": "kz_beginner",
    "description": "新手路线",
    "community": "KZ 社区",
    "status": "online",
    "ip": "kz01.example.com",
    "port": 27015,
    "region": "华东",
    "tickrate": 128,
    "maxPlayers": 32,
    "latencyMs": 12,
    "tags": ["新手", "教学"],
    "mapImage": "https://cdn.example.com/kz_beginner.jpg",
    "featured": true,
    "requiresWhitelist": false,
    "playerCount": 1,
    "players": [
      {
        "name": "Steam 昵称",
        "avatarUrl": "https://avatars.akamai.steamstatic.com/...",
        "connectedAt": "2026-10-23T14:43:25Z"
      }
    ]
  }
]
```

- `status`：`online` / `maintenance` / `offline` / `hibernating`。`hibernating` 表示空服休眠但进程仍可由可选的 RCON 状态探测确认存活。
- `community`：可选的社区组名称，用于把同一台主机上的多个实例分组展示；空字符串表示未分组。
- `latencyMs`、`playerCount` 可为 `null`；`mapImage` 可为空字符串。
- 状态、地图、人数与在线玩家由游戏服务器上的 `ThRei_Players` 插件上报。API 不使用 A2S 轮询，也不会向游戏服务器发送任意 RCON 指令。
- 没有配置 RCON 密码的插件服务器超过 90 秒未上报时，后台任务会把状态标记为 `offline`、人数清零并删除在线名单。配置了 RCON 密码且启用 `HIBERNATION_POLL_ENABLED` 时，后台只发送 `status` 判断存活：空服标记 `hibernating`，有玩家标记 `online`；连续 3 次 RCON 失败才标记 `offline`。`maintenance` 状态不会被插件上报或后台任务覆盖。
- 在线名单只包含插件已通过 Steam 认证的玩家（SteamID64 非空）。插件安装与配置见 [../plugins/ThRei_Players/README.md](../plugins/ThRei_Players/README.md)。

### `POST /api/v1/plugin/report`

供 `ThRei_Players` 插件调用，不使用 Cookie 会话。请求头必须携带管理面板生成的服务器令牌：

```http
POST /api/v1/plugin/report
Content-Type: application/json
X-ThRei-Plugin-Token: <server plugin token>
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

- `serverId` 可省略：令牌在数据库中唯一，API 会直接根据令牌找到服务器。这样一台主机上的多个实例可以共用一份配置，只按端口写各自的令牌。若同时提供 `serverId`，必须与令牌所属服务器一致。
- `name`、`map`、`maxPlayers` 可省略。`name` 为游戏服务器的 `hostname`，上报后会更新服务器目录中的显示名称；省略或为空时保留当前名称。
- `players` 中无效或重复的 SteamID64 会被跳过，响应里的 `skipped` 表示跳过数量。
- `ipAddress` 由插件 1.6.0+ 通过 `GetClientIP` 上报，非法或空值按 `NULL` 保存；用于服务器封禁时自动创建 IP 封禁。
- `connectedSeconds` 用于恢复 `connected_at`，超出 0–2592000 秒会被截断。
- 成功返回 `{ "serverId": "...", "playerCount": 1, "skipped": 0, "reportedAt": "..." }`。
- 令牌缺失、错误、服务器不存在或 `serverId` 与令牌不匹配统一返回 `401 unauthorized`，避免枚举服务器。
- 字段超出限制或 JSON 非法返回 `422`。
- 上报会在一个事务内替换该服务器的在线名单；本次未出现的玩家会被删除，持续在线的玩家保留原 `connected_at`。

### `GET /api/v1/plugin/access-snapshot`

供 `ThRei_Players` 1.5.0+ 同步访问规则。请求头与上报相同，响应为 `text/plain; charset=utf-8`：

```text
# ThRei access snapshot v1
server srv-1a2b3c4d5e6f
requires_whitelist 1
whitelist 76561199125125759
ban 76561198000000000 0 永久封禁
ban 76561198000000001 1792914155 临时封禁
banip 203.0.113.10 0 恶意刷屏
```

- `requires_whitelist` 为 `0` 时插件只执行封禁，不检查白名单。
- `whitelist` 每行一个 SteamID64，来自全服白名单；同一份名单用于所有开启白名单的服务器。
- `ban` / `banip` 的第二个字段是到期 Unix 时间戳，`0` 表示永久；第三个字段起为已压平为单行的原因。
- 最多返回 10,000 条白名单、10,000 条生效 SteamID 封禁与 10,000 条生效 IP 封禁。已解除、已过期封禁不会出现在快照中。
- 令牌缺失或错误返回 `401`，不泄露服务器是否存在。

### `GET /api/v1/plugin/actions`

供 `ThRei_Players` 1.5.0+ 长轮询管理后台下发的指令，响应为
`text/plain; charset=utf-8`。支持 `?wait=<秒>`（最大 20）：没有待执行指令时请求会挂起，
一有新指令立即返回；不传 `wait` 时保持原来的立即返回行为，兼容旧插件。

```text
# ThRei actions v1
action 7e4f0d8a-... kick 76561199125125759 管理员踢出
action 8a1d2c3b-... ban 76561198000000000 1792914155 临时封禁
action 9c2e3d4f-... unban 76561198000000000 网站解除封禁
action 4b7a1c2d-... banip 203.0.113.10 0 恶意刷屏
action 5c8b2d3e-... unbanip 203.0.113.10 网站解除 IP 封禁
```

- 最多返回 100 条未确认指令，按创建时间排序。
- `kick` 不带到期时间；`ban` / `banip` 的到期时间用于插件本地拦截临时封禁。
- `unban` / `unbanip` 在网站解除游戏服务器封禁或 IP 封禁时下发；插件 1.9.0+ 会立即清除对应本地封禁。
- 原因中的控制字符会替换为空格并限制为 400 字符，防止注入额外协议行。

### `POST /api/v1/plugin/actions/{id}/ack`

插件执行或判定指令已过期后调用，成功返回 `204 No Content`，把 `server_actions.processed_at` 设为当前时间。指令不属于该令牌对应的服务器时返回 `404`。确认失败不会丢失指令，下一次 long-poll 会再次返回。

### `POST /api/v1/plugin/ban-report`

供 `ThRei_Players` 1.9.0+ 回传游戏内的 ThRei 封禁命令。请求头与上报相同。

```json
{
  "steamId64": "76561199125125759",
  "ipAddress": "203.0.113.10",
  "playerName": "玩家昵称",
  "reason": "长期挂机",
  "durationMinutes": 0
}
```

- `durationMinutes` 为分钟数，`0` 或省略表示永久；最大 52,560,000 分钟。
- `associateIpOnly: true` 供插件 1.9.1+ 在 SteamID 封禁玩家重连时补关联 IP：不会新建 SteamID
  封禁，只用该玩家当前 IP 创建同 `ban_group_id`、同到期时间的游戏 IP 封禁并下发 `banip`。
- 成功返回 `204 No Content`。API 会写入一条**全服**游戏封禁（`server_id = NULL`，若尚无生效的全服封禁），并为所有启用服务器写入 `ban` 指令。
- 如果请求带 `ipAddress`，还会创建游戏 IP 封禁；已有生效 IP 封禁时跳过。SteamID 封禁、IP 封禁共享 `ban_group_id`。
- **不会写入网站账号封禁，也不会撤销网站会话**；网站账号仍然可以登录，用户中心会显示游戏封禁原因。
- `serverId` 可省略，由令牌解析；提供时必须与令牌所属服务器一致。
- 网站下发的指令不会回传，避免循环。
- 令牌缺失或错误返回 `401`；SteamID64、原因或时长不合法返回 `422`。

### `POST /api/v1/plugin/ip-ban-report`

供插件 `sm_banip` 回传 IP 封禁。请求头与上报相同。

```json
{
  "ipAddress": "203.0.113.10",
  "reason": "恶意刷屏",
  "durationMinutes": 0
}
```

- `durationMinutes` 规则同 `ban-report`。
- 成功返回 `204`；写入仅作用于游戏服务器的 IP 封禁，并向所有启用服务器下发 `banip` 指令。
- 不会写入网站账号封禁，也不影响网站登录；已有生效 IP 封禁时跳过，仍返回 `204`。

### `POST /api/v1/plugin/unban-report`

供插件 `sm_unban` / `sm_unbanip` 在游戏内解封时同步网站。

```json
{
  "steamId64": "76561198000000000",
  "ipAddress": "203.0.113.10",
  "reason": "游戏内解封"
}
```

- `steamId64` 和 `ipAddress` 至少提供一个；`steamId64` 必须是 17 位数字。
- 只解除 `created_by IS NULL` 的插件来源记录：按 SteamID 找到插件来源的全服/单服游戏封禁及其
  `ban_group_id`，解除同组游戏 IP 封禁；IP 参数只解除插件来源游戏 IP 封禁。
- 如果仍存在管理员手动封禁，返回 `409`，不修改任何记录，插件保持本地封禁。
- 成功返回 `204`。插件收到成功后再删除本地 SteamID/IP 封禁；API 同时向所有服务器下发 `unban` / `unbanip`，让其他服务器立即放行。

## 5. 论坛

### 5.1 `GET /api/v1/forum/categories`

分类来自 `categories` 表；主题/回复计数与最近活动由真实表聚合。

```json
[
  {
    "slug": "announcements",
    "name": "公告与活动",
    "description": "服务器维护、赛季更新、计时赛和社区活动。",
    "icon": "megaphone",
    "topicCount": 0,
    "postCount": 0,
    "lastActivityAt": null
  }
]
```

### 5.2 `GET /api/v1/forum/topics`

Query：

| 参数 | 说明 |
| --- | --- |
| `limit` | 1–50，默认 20 |
| `category` | 分类 slug |
| `q` | 搜索标题、摘要、标签、作者、分类名，最长由前端限制 120 字符 |
| `author` | 作者 UUID（内部/账号接口使用） |

返回 `ForumTopic[]`，包含 `slug`、`title`、`excerpt`、`categorySlug`、`categoryName`、`categoryIcon`、`author`、`tags`、`createdAt`、`lastActivityAt`、`views`、`pinned`、`hot`、`replyCount`。没有主题时返回 `[]`。

### 5.3 `GET /api/v1/forum/topics/{slug}`

返回主题详情与回复；不存在或已软删除返回 `404 not_found`。

```json
{
  "slug": "topic-slug",
  "title": "主题标题",
  "content": "正文，段落以换行分隔",
  "replies": [
    {
      "id": "uuid",
      "content": "回复内容",
      "likes": 0,
      "createdAt": "2026-10-23T14:43:25Z",
      "author": { "name": "作者", "role": "member", "avatarUrl": null }
    }
  ]
}
```

### 5.4 `GET /api/v1/forum/active-users?limit=8`

返回最近发帖或回复的作者，按最近活动时间倒序，`limit` 范围 1–30。

## 6. 社区、用户中心与管理

### 6.1 `GET /api/v1/community/overview`

```json
{
  "members": 0,
  "topics": 0,
  "replies": 0,
  "onlinePlayers": 0,
  "servers": 0,
  "newTopicsWeek": 0,
  "activeMembersWeek": 0
}
```

全部来自数据库；空库返回 0。`members` 与 `activeMembersWeek` 不包含 `is_system=true` 的官方系统账号。

### 6.2 `GET /api/v1/account`

需要登录，返回当前用户资料、统计、最近主题、收藏和最近活动。未登录返回 `401 unauthorized`。用户不存在或会话过期同样返回 401。

### 6.3 `GET /api/v1/admin/overview`

需要 `admin` 角色，返回统计、角色分布、最近注册用户、最近主题和最近 7 天活动。非管理员返回 `403 forbidden`，未登录返回 `401 unauthorized`。

### 6.4 管理员管理

- `GET /admin/admins` 返回所有管理员（含禁用状态）。
- `GET /admin/users/lookup?steamId64=765...`：查询玩家昵称、头像、角色与禁用状态；未找到返回 `{ "user": null }`。
- `POST /admin/admins` body `{ "steamId64": "765..." }`：按 SteamID64 新增管理员；用户尚未登录时创建占位账号，首次登录保留管理员角色。
- `DELETE /admin/admins/{steam_id64}`：取消管理员权限，并撤销其会话。
- `POST /admin/admins/{steam_id64}/disable` body `{ "reason": "..." }`：禁用账号并撤销会话；禁用账号无法登录。
- `POST /admin/admins/{steam_id64}/enable`：重新启用。
- 管理员不能取消/禁用自己；系统拒绝取消或禁用最后一位可用管理员。
- `ADMIN_STEAM_IDS` 只用于首次创建/引导管理员；登录不会覆盖数据库中已由管理面板修改的角色。

### 6.4.1 登录玩家

- `GET /admin/players` 返回所有非系统账号，按最近登录时间倒序；包含 `steamId64`、昵称、头像、角色、禁用状态、注册时间、最近登录时间、`lastLoginIp` 与当前 `activeSessions`。
- 该接口仅管理员可访问，用于管理面板「登录玩家」页面。

### 6.5 封禁管理

封禁只作用于游戏服务器，**任何封禁都不会阻止网站登录**，也不会撤销网站会话。用户中心通过 `GET /account` 的 `gameBans` 显示封禁服务器、原因和到期时间。

- `GET /admin/server-bans` 返回生效和历史的游戏封禁；每项包含 `scope`（`global` / `server`）、`serverId`、`serverName`、`steamId64`、原因、到期时间、操作者与解封记录。
- `POST /admin/server-bans` body `{ "steamId64": "...", "reason": "...", "playerName": "...", "expiresInHours": 24, "scope": "global" | "server", "serverId": "..." }`；`scope` 缺省为 `global`，`expiresInHours` 缺省/`null` 为永久。
- 全服封禁对所有启用服务器写入 `ban` 指令；单服封禁只写指定服务器。若已知玩家 IP（插件上报的服务器 IP，或网站最近登录 IP），会自动创建游戏 IP 封禁，且与 SteamID 封禁共享 `ban_group_id`。管理员当前 IP 不会被自动封禁。
- `POST /admin/server-bans/{id}/lift` 解除封禁；会清理未执行的旧 `ban` 指令，写入 `unban`，并按 `ban_group_id` 解除同组游戏 IP 封禁、下发 `unbanip`。
- `GET /admin/server-ip-bans` 返回游戏 IP 封禁记录；`POST /admin/server-ip-bans` body `{ "ipAddress": "...", "reason": "...", "expiresInHours": 24 }` 创建并立即下发 `banip`。
- `POST /admin/server-ip-bans/{id}/lift` body `{ "reason": "..." }` 解除 IP 封禁并下发 `unbanip`。
- 旧的 `/admin/bans` 网站账号/IP 封禁接口已移除；`bans` 表仅保留历史结构，不再读写或执行。

### 6.6 白名单

- 白名单为全服共享：一次审核通过或手动添加，所有开启 `requires_whitelist` 的服务器通用。
- `GET /admin/whitelist` 返回全服申请、已授权名单和服务器白名单设置；申请/条目中的 `serverId` 为 `null`、`serverName` 为 `全服`。
- `POST /admin/whitelist` body `{ "steamId64": "...", "playerName": "..." }` 手动加入全服白名单；旧版 `serverId` 字段会被忽略。
- `POST /admin/whitelist/applications/{id}/approve` / `reject` body `{ "note": "..." }` 审核申请；通过时会写入 `global_whitelist`。
- `DELETE /admin/whitelist/{steam_id64}` 移除全服授权。
- `PATCH /admin/servers/{id}/whitelist` body `{ "requiresWhitelist": true }` 开关该服务器是否使用全服白名单。
- `POST /whitelist/applications` body `{ "message": "..." }` 当前登录玩家提交全服申请；已有待审申请或已在全服白名单时返回 409。旧版 `serverId` 字段会被忽略。
- `GET /account` 返回 `whitelist: { whitelisted, pending }`，用于用户中心显示全服白名单状态。
- `ThRei_Players` 1.5.0+ 默认每 30 秒读取一次 `/plugin/access-snapshot`，快照中的 `whitelist` 行来自全服白名单，在玩家连接时执行白名单与服务器封禁拦截；审核通过、移除授权或新增封禁会在一个刷新间隔内生效，不需要 RCON。

### 6.7 论坛管理

- `GET /admin/forum/topics`：返回所有主题（含已软删除），含正文、分类、作者、回复数和管理状态。
- `PATCH /admin/forum/topics/{slug}` body：`title`、`excerpt`、`content`、`categorySlug`、`tags`、`pinned`、`hot`。
- `DELETE /admin/forum/topics/{slug}` 软删除；`POST .../restore` 恢复。
- `GET /admin/forum/replies`、`PATCH/DELETE /admin/forum/replies/{id}`、`POST .../restore` 管理回复。
- `GET /admin/forum/users`：用户、角色、禁言、禁用状态。
- `POST /admin/forum/users/{steam_id64}/mute` body `{ "reason": "...", "expiresInHours": 168 }`；`DELETE` 解除禁言。
- 禁言只限制论坛发言，不阻止网站登录；论坛管理不再提供网站封禁操作。

### 6.8 服务器管理

- `GET /admin/servers`：服务器、在线玩家、服务器封禁记录。服务器包含 `playerCount`、`lastReportedAt`、`pluginState`（`disabled` / `waiting` / `connected`）、`hasRconPassword`、`lastRconAt`、`rconFailures`、`pendingActions`；玩家包含 `steamId64`、`name`、`avatarUrl`、`connectedAt`、`lastSeenAt`。API 不返回插件令牌或 RCON 密码原文。
- `POST /admin/servers`：添加服务器。最小请求体为 `{ "host": "1.2.3.4", "port": 27015 }`；省略 `id` 时自动生成 `srv-` 加 12 位十六进制 ID，`name` 默认 `host:port`，`map` 为 `待上报`，`status` 为 `offline`，`region` 为 `未知`，`tickrate` 为 128，`maxPlayers` 为 64。成功返回 `201` 与 `{ "id": "..." }`。可选字段仍支持 `id`、`name`、`map`、`description`、`communityId`、`region`、`tickrate`、`maxPlayers`、`latencyMs`、`tags`、`mapImage`、`status`、`featured`、`requiresWhitelist`；`communityId` 必须是已存在的社区组 ID，未知 ID 返回 `422`；自定义 `id` 已存在时返回 `409`。为兼容升级前已加载的页面，仍接受 `community` 组名，但只按名称匹配已有社区组，不会自动创建。新服务器在插件首次上报前保持 `offline`。
- `PATCH /admin/servers/{id}` body `{ "isActive": false }` 启用/停用；`DELETE` 删除服务器。
- `PATCH /admin/servers/{id}/community` body `{ "communityId": "com-1a2b3c4d5e6f" }`：设置实例所属社区组；传 `null`、空字符串或省略表示不分组；未知组返回 `422`，服务器不存在返回 `404`，成功返回 `204`。旧版页面发送的 `community` 组名也会按名称解析到已有社区组；空字符串仍表示不分组，名称不存在返回 `422` 而不是静默解绑。
- `GET /admin/servers/{id}/plugin-token`：读取当前插件令牌或 `null`；仅管理员可见，响应带 `Cache-Control: no-store`。
- `POST /admin/servers/{id}/plugin-token`：生成新令牌；旧令牌立即失效，同时清空在线名单并把状态重置为 `offline`（`maintenance` 保留）。
- `DELETE /admin/servers/{id}/plugin-token`：撤销令牌，并执行同样的在线状态清理，返回 `204`。
- `PUT /admin/servers/{id}/rcon-password` body `{ "password": "..." }`：设置可选的 RCON 密码，仅用于空服休眠存活探测。密码只写不读，任何接口都不会返回；成功 `204`，空密码、控制字符或超过 256 字符返回 `422`。
- `DELETE /admin/servers/{id}/rcon-password`：删除 RCON 密码并清除休眠状态，成功 `204`。
- `POST /admin/servers/{id}/players/{steam_id64}/kick` body `{ "reason": "..." }`：写入 `server_actions`，由 `ThRei_Players` 1.5.0+ 通过 long-poll 通常在 1 秒内执行；插件离线时恢复后执行。
- `POST /admin/servers/{id}/players/{steam_id64}/ban` body `{ "reason": "...", "expiresInHours": 24, "playerName": "...", "scope": "global" }`：原子写入 `server_bans` 与 `server_actions`。`scope` 为 `global`（默认，`server_id = NULL`，对所有启用服务器生效）或 `server`（仅路径指定的服务器）；全局封禁会为每台启用服务器写入一条指令，插件立即踢出在线目标并阻止重连。若已知玩家 IP（插件 1.6.0+ 上报的服务器 IP，或网站最近登录 IP），还会自动创建 IP 封禁；管理员当前 IP 不会被自动封禁。
- `GET /admin/server-bans`：返回所有游戏服务器封禁（含全服封禁），每项带 `scope`（`global` / `server`）和 `serverName`（全服封禁为 `全服`）。
- `POST /admin/server-bans/{id}/lift` 解除服务器封禁；会同时把尚未执行的封禁指令标记为已处理，避免解封后旧指令再次生效，并写入 `unban` 指令。若该封禁带 `ban_group_id`，还会解除同组游戏 IP 封禁并下发 `unbanip`。所有封禁生效和解封都只影响游戏服务器，网站登录不受影响。
- 踢出/封禁指令由插件确认后写入 `processed_at`；`pendingActions` 是尚未确认的指令数。封禁到期或已解除时，插件不会执行对应指令，但仍会确认队列项。
- RCON 只发送 `status` 用于休眠/存活判断，白名单、踢出与封禁都不依赖 RCON。

### 6.9 社区组管理

社区组用于把同一主机或同一社区的多个服务器实例归在一起。一个服务器最多属于一个社区组；删除社区组只会让组内实例变为未分组，不会删除服务器或插件令牌。

- `GET /admin/server-communities`：返回 `{ "communities": [...] }`。每个社区组包含 `id`、`name`、`description`、`createdAt`、`updatedAt`，以及 `servers` 数组；实例包含 `id`、`name`、`host`、`port`、`status`、`isActive`、`playerCount`、`maxPlayers`、`pluginState`。
- `POST /admin/server-communities` body `{ "name": "ThRei 主机", "description": "可选描述" }`：创建社区组，名称 1–60 字符且大小写不敏感唯一；成功返回 `201 { "id": "com-..." }`，重名返回 `409`。
- `PATCH /admin/server-communities/{id}` body `{ "name": "...", "description": "..." }`：至少提供一个字段；成功返回 `204`，不存在返回 `404`，重名返回 `409`。
- `DELETE /admin/server-communities/{id}`：删除社区组并把组内实例置为未分组，返回 `204`。
- `POST /admin/server-communities/{id}/servers` body `{ "serverIds": ["srv-...", "srv-..."] }`：把实例加入社区组；已属于其他组的实例会被移动到当前组。空数组或未知服务器 ID 返回 `422`，组不存在返回 `404`，成功返回 `204`。
- `DELETE /admin/server-communities/{id}/servers/{server_id}`：把实例移出社区组；实例不在该组时返回 `404`，成功返回 `204`。
- 公开服务器接口中的 `community` 为该实例所属社区组名称（未分组为空字符串），管理接口的服务器对象同时返回 `communityId` 与 `community`。

## 7. 错误结构

业务 API 的错误使用统一结构（健康检查 503 返回专用就绪状态）：

```json
{
  "error": {
    "code": "not_found",
    "message": "The requested resource was not found.",
    "details": null
  }
}
```

- 错误响应带 `Cache-Control: no-store` 与 `x-request-id`。
- 内部错误只记录服务端日志；客户端收到通用消息。

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 400 | `bad_request` | 请求无法处理（如 Steam 断言参数错误） |
| 401 | `unauthorized` | 需要登录或会话失效 |
| 403 | `forbidden` | 已登录但不是管理员 |
| 404 | `not_found` | 资源或路由不存在 |
| 405 | `method_not_allowed` | 路径存在但方法不允许 |
| 409 | `conflict` | 与当前资源状态冲突（预留） |
| 422 | `validation_error` | 字段校验失败（预留） |
| 429 | `too_many_requests` | 限流（预留，尚未实现） |
| 503 | `service_unavailable` | 服务暂时不可用（预留） |
| 504 | `request_timeout` | 请求处理超时 |
| 500 | `internal_error` | 未预期内部错误 |

## 8. 请求追踪

- 每个响应包含 `x-request-id`。
- Nginx 使用 `$request_id` 注入；API 只接受长度 1–128、ASCII 字母/数字/`-`/`_` 的值，否则生成 UUID。
- 前端 `ApiClient` 将 `x-request-id` 暴露为 `ApiError.requestId`。

## 9. 分页、排序与过滤

当前只实现 `limit` 上限 50 的简单截断，没有游标分页；论坛主题按置顶、最近活动排序。后续大量数据需要游标分页时再引入 `items/next_cursor` 结构，不能直接暴露数据库自增 ID。

## 10. OpenAPI

开发环境（`API_DOCS_ENABLED=true`）：

- JSON：`GET /api/v1/openapi.json`
- Swagger UI：`GET /api/v1/docs`

生产环境默认关闭，两个路由返回统一 404。

新增/修改端点时必须补充 `#[utoipa::path]`、将 path 加入 `ApiDoc`、更新本文并添加测试。当前业务响应的详细 schema 尚未全部加入 OpenAPI，前端类型仍以 `apps/web/src/types` 和 feature types 为准。

## 11. CORS

- 允许来源由 `CORS_ALLOWED_ORIGINS`（逗号分隔）控制，默认空。
- 允许凭据（Cookie）；生产同源部署不需要 CORS。
- 暴露 `x-request-id`，允许 `accept`、`authorization`、`content-type`、`x-request-id`、`x-csrf-token`。

## 12. 限流与滥用防护（规划）

- 登录、回调、发帖/回复、资料修改按 IP + 用户 + 动作维度限流。
- 使用 Redis 计数/滑动窗口；当前 Redis 只做就绪检查，不承载业务限流。
- 触发时返回 `429 too_many_requests`，带 `Retry-After`。
- 管理操作应有审计记录。

当前没有业务限流，只有 Nginx 请求体限制与 API 超时。
