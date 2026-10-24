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

- `status`：`online` / `maintenance` / `offline`。
- `latencyMs`、`playerCount` 可为 `null`；`mapImage` 可为空字符串。
- 状态、地图、人数与在线玩家由游戏服务器上的 `ThRei_Players` 插件上报。API 不再使用 A2S/RCON 轮询；超过 90 秒没有收到上报时，后台任务会把服务器标记为 `offline`、人数清零并删除在线名单。`maintenance` 状态不会被上报或清理任务覆盖。
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
  "serverId": "kz-beginner",
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

- `serverId` 必须与令牌所属服务器一致；`map`、`maxPlayers` 可省略。
- `players` 中无效或重复的 SteamID64 会被跳过，响应里的 `skipped` 表示跳过数量。
- `connectedSeconds` 用于恢复 `connected_at`，超出 0–2592000 秒会被截断。
- 成功返回 `{ "serverId": "...", "playerCount": 1, "skipped": 0, "reportedAt": "..." }`。
- 令牌缺失、错误、服务器不存在或 `serverId` 不匹配统一返回 `401 unauthorized`，避免枚举服务器。
- 字段超出限制或 JSON 非法返回 `422`。
- 上报会在一个事务内替换该服务器的在线名单；本次未出现的玩家会被删除，持续在线的玩家保留原 `connected_at`。

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

### 6.5 封禁管理

- `GET /admin/bans` 返回生效和历史封禁记录。
- `POST /admin/bans` body `{ "steamId64": "...", "reason": "...", "expiresInHours": 24 }`；`expiresInHours` 缺省/`null` 为永久。
- `POST /admin/bans/{id}/lift` body `{ "reason": "..." }` 解封。
- 管理员账号不能直接被封禁，需先取消管理员权限。
- 封禁会撤销目标网站会话；后续登录和会话读取都会被拒绝，直到解封或到期。

### 6.6 白名单

- `GET /admin/whitelist` 返回申请、已授权名单和服务器白名单设置。
- `POST /admin/whitelist` body `{ "serverId": "...", "steamId64": "...", "playerName": "..." }` 手动授权。
- `POST /admin/whitelist/applications/{id}/approve` / `reject` body `{ "note": "..." }` 审核申请；通过时会写入 `server_whitelist`。
- `DELETE /admin/whitelist/{server_id}/{steam_id64}` 移除授权。
- `PATCH /admin/servers/{id}/whitelist` body `{ "requiresWhitelist": true }` 开关服务器要求。
- `POST /whitelist/applications` body `{ "serverId": "...", "message": "..." }` 当前登录玩家提交申请；同一服务器已有待审申请或已在白名单时返回 409。
- 当前没有游戏服务器插件自动读取白名单；实际进服拦截需要插件从 `server_whitelist` / `bans` 表同步或在连接前查询。

### 6.7 论坛管理

- `GET /admin/forum/topics`：返回所有主题（含已软删除），含正文、分类、作者、回复数和管理状态。
- `PATCH /admin/forum/topics/{slug}` body：`title`、`excerpt`、`content`、`categorySlug`、`tags`、`pinned`、`hot`。
- `DELETE /admin/forum/topics/{slug}` 软删除；`POST .../restore` 恢复。
- `GET /admin/forum/replies`、`PATCH/DELETE /admin/forum/replies/{id}`、`POST .../restore` 管理回复。
- `GET /admin/forum/users`：用户、角色、禁言、封禁、禁用状态。
- `POST /admin/forum/users/{steam_id64}/mute` body `{ "reason": "...", "expiresInHours": 168 }`；`DELETE` 解除禁言。
- 禁言只限制论坛发言，不阻止网站登录；封禁继续使用 `/admin/bans`，会撤销登录会话。

### 6.8 服务器管理

- `GET /admin/servers`：服务器、在线玩家、服务器封禁记录。服务器包含 `playerCount`、`lastReportedAt`、`pluginState`（`disabled` / `waiting` / `connected`）；玩家包含 `steamId64`、`name`、`avatarUrl`、`connectedAt`、`lastSeenAt`。API 不返回插件令牌原文。
- `POST /admin/servers`：添加服务器；字段包括 `id`、`name`、`map`、`host`、`port`、`region`、`tickrate`、`maxPlayers`、`tags`、`mapImage`、`status`、`featured`、`requiresWhitelist`。新服务器在插件首次上报前应保持 `offline`。
- `PATCH /admin/servers/{id}` body `{ "isActive": false }` 启用/停用；`DELETE` 删除服务器。
- `GET /admin/servers/{id}/plugin-token`：读取当前插件令牌或 `null`；仅管理员可见，响应带 `Cache-Control: no-store`。
- `POST /admin/servers/{id}/plugin-token`：生成新令牌；旧令牌立即失效，同时清空在线名单并把状态重置为 `offline`（`maintenance` 保留）。
- `DELETE /admin/servers/{id}/plugin-token`：撤销令牌，并执行同样的在线状态清理，返回 `204`。
- `POST /admin/servers/{id}/players/{steam_id64}/kick` body `{ "reason": "..." }`：写入 `server_actions`。
- `POST /admin/servers/{id}/players/{steam_id64}/ban` body `{ "reason": "...", "expiresInHours": 24, "playerName": "..." }`：写入 `server_bans` 与 `server_actions`。
- `POST /admin/server-bans/{id}/lift` 解除服务器封禁。
- 踢出/封禁目前只落库；`ThRei_Players` 只负责状态与玩家上报，不执行管理指令。游戏内执行需要后续插件消费 `server_actions` 和读取 `server_bans`。

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
