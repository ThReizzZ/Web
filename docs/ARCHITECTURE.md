# ThRei 架构说明

> 本文记录当前**已实现**的架构，以及明确规划但**尚未实现**的能力。
> 架构发生变化时，必须同步更新本文与 [DEVELOPMENT.md](DEVELOPMENT.md)。
> 当前版本：`0.1.0`（Steam 登录与真实数据接入）。

## 1. 目标与阶段

ThRei 是一个长期运营的 CS:GO KZ 社区系统，统一承载官网、服务器目录、论坛、用户中心和管理面板。
第一阶段采用**模块化单体**（modular monolith），目标是：

- 建立清晰的前后端职责边界和目录边界；
- 统一身份、API、错误处理、日志和配置；
- 建立可重复的数据库迁移与部署流程；
- 为后续用户、权限、论坛、通知、审核、审计和系统配置模块预留扩展点；
- 不提前引入微服务、消息队列等尚无实际需求的基础设施。

当前已实现 Steam OpenID 登录、数据库会话、真实业务表、服务器/论坛/社区/用户中心/管理统计的只读 API、管理面板的服务端角色校验，以及由 `ThRei_Players` SourceMod 插件主动上报的服务器状态与玩家名单。前端不再使用模拟数据。

尚未实现：论坛发帖/回复、资料与收藏写接口、插件对踢出/封禁/白名单指令的游戏内执行、审核/审计写流程、登录限流与 CSRF 令牌、CI 和自动化部署验证。相关能力在本文中明确标记为“规划”。

## 2. 技术选型

| 领域 | 选择 | 原因 |
| --- | --- | --- |
| Web | Next.js 16 App Router | 统一 Server/Client Components、路由布局、SEO metadata、独立容器部署 |
| UI | React 19 + TypeScript strict + Tailwind CSS 4 | 类型安全、可组合样式、低运行时依赖 |
| 组件 | shadcn/ui 风格源码组件 + Radix primitives + Lucide | 组件源码归项目所有，避免锁定；可按需扩展 |
| 表单 | React Hook Form + Zod | 客户端校验与未来后端契约共享校验思路 |
| 客户端数据 | TanStack Query 5 | 缓存、重试、刷新与异步状态，仅在客户端边界使用 |
| API | Rust + Axum 0.8 + Tokio | 强类型、低开销、成熟的 tower 中间件生态 |
| 数据访问 | SQLx 0.9 + PostgreSQL 17 | 异步、连接池、版本化迁移，后续可使用编译期查询检查 |
| 缓存 | Redis 7.4 | 缓存、限流计数、临时状态；非权威数据源 |
| API 文档 | utoipa 6 + Swagger UI（vendored） | 从代码生成 OpenAPI，避免构建期外部下载 |
| 部署 | Docker Compose + Nginx（非特权镜像） | 单机/小规模部署简单，服务边界清晰，可平滑扩展 |

依赖版本通过 `Cargo.lock`、`package-lock.json` 和固定镜像标签锁定。升级依赖属于架构变更，需运行完整检查并记录日志。

## 3. 系统边界

```text
Browser
  │  HTTP(S)
  ▼
Nginx (only published service; default 127.0.0.1:80 -> 8080)
  ├── /api/  ──────────────► Rust API (Axum, :8080)
  └── /      ──────────────► Next.js web (:3000)
                                 │ server-side fetch (Docker internal)
                                 └──────────────► Rust API

Rust API ──► PostgreSQL 17 (internal network, persistent volume)
         └─► Redis 7.4       (internal network, cache/transient state)

Game server (SourceMod + ThRei_Players)
  │  HTTPS POST /api/v1/plugin/report + per-server token
  └──────────────────────────────► Nginx ──► Rust API
```

职责：

- **Web**：页面渲染、SEO、交互、客户端缓存。不包含后端密钥，不决定最终权限。
- **API**：业务规则、认证/授权、数据访问、审计、统一错误。所有写操作的最终校验在此。
- **PostgreSQL**：权威数据源，只能由 API 访问。
- **Redis**：缓存和临时状态（未来：限流、会话索引等），不是系统记录。
- **Nginx**：公开入口、TLS 终止预留、路径转发、请求 ID 注入、隐藏内部健康检查。
- **游戏服务器插件**：只主动上报状态与已认证玩家，不接收 API 的连接；令牌按服务器隔离。

## 4. Monorepo 结构

```text
apps/web                 Next.js 应用（独立构建、独立镜像）
services/api             Rust API 与 migrator（独立构建、独立镜像）
deploy/nginx             Nginx 主配置、HTTP 模板、HTTPS 示例
plugins/ThRei_Players    SourceMod 上报插件（源码、已编译 smx、配置示例）
docs                     架构、开发日志、API、部署、CHANGELOG
scripts                  检查与备份脚本
compose.yaml             生产导向编排
compose.dev.yaml         本地开发用的基础设施端口覆盖
```

前端与后端是同一 Git 仓库中的两个独立工程，没有共用构建工具链，也没有根级 JavaScript workspace。这样可以避免前后端依赖版本相互牵制。

### 与初始规划的差异

- **`apps/web/public/` 保留为空静态资源目录**（`.gitkeep`）；图标和 manifest 由 `src/app/icon.svg`、`src/app/manifest.ts` 生成。
- **`services/api/src/modules/` 已有真实业务模块**：`auth`、`servers`、`forum`、`community`、`account`、`admin`。没有为了抽象而创建空目录。
- **没有独立的通用 `models/`、`services/`、`repositories/` 顶层目录**。未来每个业务模块内部按 `routes / service / repository / dto` 组织，减少跨模块耦合。
- **健康检查放在根路径 `/health/*`**，不纳入 `/api/v1`，因为它们属于基础设施探针；Nginx 会隐藏这些路径。
- **`routes/system.rs` 属于基础设施元信息**，不是业务模块，因此没有放入 `modules/`。
- **暂无 `.sqlx` 离线缓存**：当前只使用运行时查询和 `sqlx::migrate!`，没有使用 `query!` 编译期宏。引入编译期查询后必须提交 `.sqlx`（见第 8 节）。

## 5. 前端架构

### 5.1 路由与布局边界

```text
src/app/layout.tsx                根布局：html/body、全局样式、QueryProvider
src/app/(site)/                   官网布局（/）
src/app/(servers)/                服务器布局（/servers）
src/app/(forum)/                  论坛布局（/forum、/forum/[category]、/forum/topic/[id]）
src/app/(account)/                用户中心布局（/account）
src/app/(admin)/                  独立管理面板布局（/admin）
```

每个 route group 拥有自己的 layout；根布局只提供全局 provider。官网、服务器、论坛、用户中心共享 `SiteShell`（导航/页脚/主 landmark），管理面板使用独立的侧边栏和状态栏，避免业务代码混在同一布局中。

### 5.2 Server / Client Components 边界

默认使用 Server Components。当前 `"use client"` 仅用于：

- `QueryProvider`：TanStack Query 的客户端上下文；
- `SystemStatusCard`：浏览器端 API 探测与刷新；
- `ForumSearchForm`：React Hook Form + Zod + `useRouter`；
- `ServerDirectory`：3 列卡片墙/列表显示模式切换、`localStorage` 偏好与 1/2/3 列响应式分配；
- `CopyAddressButton` / `JoinServerButton`：剪贴板、原生 `<dialog>` 加入说明与交互状态；
- `LogoutButton`：调用登出 API 并刷新导航；
- `Modal` / `ConfirmDialog` / `ToastProvider` / `Tooltip`：管理面板弹窗、危险操作确认、操作反馈和悬浮提示；
- `error.tsx` / `global-error.tsx`：错误边界需要交互；
- Radix `Label` / `Separator` 包装组件（基础交互组件）。

页面、metadata、数据读取和布局保持为 Server Components。不要为了省事给根布局或整页添加 `"use client"`。

### 5.3 API 客户端

- `src/lib/api/client.ts`：与框架无关的 `ApiClient`，统一处理 base URL、超时、`credentials`、JSON 解析和错误归一化；错误类型为 `ApiError`，包含 HTTP 状态、业务错误码和 `x-request-id`。
- `src/lib/api/browser.ts`：浏览器客户端。`NEXT_PUBLIC_API_BASE_URL` 为空时使用同源 `/api/v1`（生产由 Nginx 转发；本地由 Next rewrite 转发）。
- `src/lib/api/server.ts`：仅服务端使用（`server-only`），通过 `API_INTERNAL_URL` 访问容器内 API，并转发 Cookie、请求 ID；Steam 会话就是这样在 Server Components 中读取的。服务端密钥不进入客户端 bundle。
- `src/services/content.ts`：按资源封装服务器、论坛、社区、用户中心、管理员与 `/auth/me` 端点；`src/services/system.ts` 保留系统信息校验。
- `src/hooks/*.ts`：TanStack Query hooks，统一 key 和刷新策略。

本地开发时，`next.config.ts` 根据 `API_INTERNAL_URL` 生成 `/api/v1/:path*` rewrite。生产环境 Nginx 在请求到达 Next 之前就处理 `/api/`，因此 rewrite 不是生产流量的主路径。

### 5.4 SEO 与错误页面

- 根布局定义 `metadataBase`、标题模板、OpenGraph、Twitter、robots。
- 页面提供 `generateMetadata`（分类/帖子按参数生成标题，服务器页有独立 metadata）。
- `robots.ts`、`sitemap.ts`（含 `/servers`）、`manifest.ts`、`icon.svg` 已建立。
- `not-found.tsx`、`error.tsx`、`global-error.tsx` 已建立。论坛列表刻意不使用父级 `loading.tsx`，以免流式渲染使 `notFound()` 无法返回真正的 404 状态码。
- 用户中心与管理面板设置 `noindex`。

### 5.5 认证与前端访问控制

Steam 是唯一登录方式：

- 顶部导航在未登录时显示“使用Steam登录”，链接到 `/api/v1/auth/steam/login`。
- “管理面板”入口只在当前用户角色为 `admin` 时加入顶部导航；匿名用户和普通成员不渲染该入口，页脚也不展示管理员入口。
- `(admin)` layout 在服务端再次读取会话：匿名访问重定向到 `/account`，非管理员重定向到首页，只有管理员渲染管理面板。
- 管理面板页面：`/admin` 运营概览、`/admin/admins` 管理员管理、`/admin/forum` 论坛管理、`/admin/servers` 服务器管理、`/admin/bans` 封禁管理、`/admin/whitelist` 白名单审核；共享服务端角色门禁与响应式侧边导航。服务状态入口已移除，其信息由运营概览覆盖。
- API 跳转 Steam OpenID；Steam 回调到 `${WEB_URL}/api/v1/auth/steam/callback`。
- API 向 Steam 校验断言，记录/更新 `users`，生成随机会话令牌；数据库只保存令牌的 SHA-256 哈希，浏览器收到 HttpOnly Cookie。
- 服务端请求通过 `getServerApiClient()` 转发 Cookie；`/auth/me` 决定导航显示登录按钮还是用户头像。
- `/account` 未登录时显示 Steam 登录卡片；`/admin` 未登录或非管理员时显示受限提示。
- 管理员由 `ADMIN_STEAM_IDS` 首次引导；之后通过管理面板维护角色。API `/admin/*` 再次校验，不依赖前端隐藏。

前端访问控制只改善体验，最终授权在 API。当前没有写操作接口，因此暂未引入 CSRF 令牌；后续写接口必须先补 CSRF 与限流。

### 5.6 真实数据与模块组织

页面数据通过 Server Components 调用 API，API 再查询 PostgreSQL：

- `src/services/content.ts`：`/servers`、`/forum/*`、`/community/overview`、`/account`、`/admin/overview`、`/auth/me` 的类型化请求。
- `src/features/servers/data/servers.ts`：仅保留 `KzServer` / `KzPlayer` 类型、地址与搜索/统计工具，不含数据。
- `src/features/forum/types.ts`、`features/account/types.ts`、`features/admin/types.ts`：API 响应类型。
- 服务器、分类、主题、回复、用户、会话、收藏和在线玩家均来自数据库表。
- 数据库为空时页面显示空状态，不回退到伪造内容。
- 迁移预置 1 篇官方新手指南；作者为 `users.is_system=true` 的系统账号，不计入成员/活跃统计。论坛“新手指南”卡片通过“查看教学”跳转到该主题。

服务器状态与在线玩家由 `ThRei_Players` 上报写入 `servers` / `server_players`；公开目录和管理面板读取同一份快照。超过 90 秒未上报时，后台清理任务会把服务器标记离线并删除名单。

## 6. 后端架构

### 6.1 模块化单体

```text
src/main.rs                 启动、配置、日志、依赖连接、HTTP serve、优雅停机
src/lib.rs                  供测试和二进制复用的模块导出
src/app.rs                  路由组装、中间件、CORS、超时、安全头
src/config/                 环境变量解析与校验（不输出密钥）
src/routes/health.rs        /health/live、/health/ready
src/routes/system.rs        /api/v1/system/info
src/routes/fallback.rs      统一 404 / 405 错误
src/middleware/request_id.rs 请求 ID 注入、校验、透传、trace span
src/errors/                 统一 AppError 与错误响应结构
src/infrastructure/         PostgreSQL、Redis、日志初始化
src/modules/                auth / servers / forum / community / account / admin
src/bin/migrate.rs          独立迁移二进制
```

已实现模块：`auth`（Steam OpenID、会话、用户）、`servers`（目录、在线玩家与白名单标记）、`server_plugin`（插件上报、令牌校验、在线名单替换与过期清理）、`server_admin`（服务器增删、插件令牌、玩家操作）、`forum`（分类/主题/回复读取）、`forum_admin`（内容编辑/删除/恢复与用户禁言）、`community`（统计）、`account`（当前用户概览）、`admin`（运营统计）、`admin_users`（管理员增删/禁用）、`bans`（封禁/解封）、`whitelist`（申请审核与服务器白名单）。每个模块目前按职责分文件；后续写接口继续沿用以下结构：

```text
modules/<name>/
├── mod.rs        模块装配与公开接口
├── routes.rs     HTTP handler、提取器、OpenAPI path
├── service.rs    业务规则、授权决策、事务边界
├── repository.rs 该模块拥有的 SQL
├── model.rs      持久化模型
└── dto.rs        请求/响应契约
```

规则：

- handler 不写业务规则，不直接拼复杂 SQL；
- service 不依赖 Axum 类型，便于单元测试；
- 模块不能直接访问其他模块的 repository；跨模块通过 service 接口；
- 共享认证、审计、错误与 DB 池属于基础设施。

### 6.2 HTTP 请求管道

由外到内：

1. **请求 ID**：接受上游（Nginx `$request_id`）传入的合法 ID（1–128 个 ASCII 字母/数字/`-`/`_`），否则生成 UUID；写入请求扩展和响应 `x-request-id`。
2. **安全响应头**：`nosniff`、`DENY`、`no-referrer`、受限 Permissions-Policy。
3. **Tracing**：span 包含 method、path、request_id；访问日志包含状态码与延迟。
4. **CORS**：允许来源来自 `CORS_ALLOWED_ORIGINS`，默认空（生产同源），支持 credentials，暴露 `x-request-id`。
5. **请求超时**：`REQUEST_TIMEOUT_SECS`，超时返回统一 JSON 错误（504）。
6. **请求体限制**：`REQUEST_BODY_LIMIT_BYTES`。
7. **路由**：`/health/*`、`/api/v1/*`、可选文档路由、统一 fallback。

### 6.3 错误处理

成功响应当前直接返回资源 JSON（不额外包裹 `data`）。错误统一为：

```json
{
  "error": {
    "code": "not_found",
    "message": "The requested resource was not found.",
    "details": null
  }
}
```

- `AppError` 映射 HTTP 状态与稳定错误码；
- 内部错误只记录在服务端日志，客户端收到通用消息；
- 错误响应带 `Cache-Control: no-store`；
- 请求 ID 放在 `x-request-id` 响应头（不重复放入 body）；
- 未知路由和错误方法同样使用统一结构。

### 6.4 配置

配置通过环境变量注入，`dotenvy` 只用于本地 `.env`（不覆盖已有环境变量）。

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `APP_ENV` | `development` | `development` / `test` / `production` |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `8080` | 容器内监听 |
| `DATABASE_URL` | 必填 | `postgres://...`，包含凭据，禁止记录 |
| `DATABASE_MAX_CONNECTIONS` | `10` | 连接池上限 |
| `DATABASE_MIN_CONNECTIONS` | `1` | 连接池下限 |
| `DATABASE_ACQUIRE_TIMEOUT_SECS` | `5` | 获取连接超时 |
| `DATABASE_CONNECT_TIMEOUT_SECS` | `5` | 启动连接总超时 |
| `REDIS_URL` | 可选 | `redis://` / `rediss://` |
| `REDIS_REQUIRED` | 生产默认 `true` | Redis 不可用时是否阻止就绪 |
| `REDIS_CONNECT_TIMEOUT_SECS` | `5` | Redis 启动连接超时 |
| `CORS_ALLOWED_ORIGINS` | 空 | 逗号分隔的 http(s) origin |
| `WEB_URL` | 开发 `http://localhost:3000`；生产必填 | 浏览器访问的公开 Web origin，用于 Steam 回跳 |
| `STEAM_RETURN_URL` | `${WEB_URL}/api/v1/auth/steam/callback` | Steam OpenID return_to，必须是公开可访问地址 |
| `STEAM_REALM` | `${WEB_URL}` | Steam OpenID realm |
| `COOKIE_SECURE` | 生产默认 `true` | 会话 Cookie 是否加 `Secure`；本地 HTTP 设为 `false` |
| `SESSION_TTL_DAYS` | `30` | 会话有效期（1–365 天） |
| `ADMIN_STEAM_IDS` | 空 | 逗号分隔的 17 位 SteamID64；仅用于首次引导管理员，之后由管理面板维护角色 |
| `API_DOCS_ENABLED` | 非生产默认 `true` | 是否挂载 OpenAPI UI |
| `REQUEST_TIMEOUT_SECS` | `30` | 请求处理超时 |
| `REQUEST_BODY_LIMIT_BYTES` | `1048576` | 请求体上限 |
| `RUST_LOG` | 生产 `info` | tracing filter |
| `LOG_JSON` | 生产默认 `true` | JSON 日志 |

`Settings` 不实现 `Debug`，避免意外打印完整连接串。启动日志只输出环境、监听地址、连接池参数等非敏感信息。

启动失败策略：

- **PostgreSQL 不可用**：API 启动失败并以非零码退出，由重启策略恢复；Compose 等待 PostgreSQL healthy。
- **Redis 不可用**：
  - `REDIS_REQUIRED=true`：API 启动失败；
  - `REDIS_REQUIRED=false`：API 继续启动，就绪检查返回 200 + `degraded`。已建立的 `ConnectionManager` 会在 Redis 恢复后自动重连；如果 Redis 在启动时就不可用，当前进程会以“无 Redis”状态运行，需要重启 API 才会重新建立连接（当前没有业务代码依赖 Redis）。
- 配置非法：在日志初始化前打印变量名与原因（不打印值），退出。

### 6.5 健康检查

- `GET /health/live`：仅表示进程可响应 HTTP，不检查依赖。
- `GET /health/ready`：并行探测 PostgreSQL 和 Redis，各 2 秒超时。
  - PostgreSQL 不可用 → `503`，`status=unavailable`；
  - Redis 不可用且 `REDIS_REQUIRED=true` → `503`；
  - Redis 不可用但非必需 → `200`，`status=degraded`；
  - Redis 未配置且非必需 → `checks.redis=disabled`。
- 响应只包含状态、版本、运行时长，不包含地址、账号、密码、驱动错误或内部路径。
- 两个端点位于根路径，由 Nginx 返回 404，不暴露到公网。容器健康检查直接访问容器内端口。

### 6.6 插件上报与在线状态

- **上报方向**：游戏服务器上的 `ThRei_Players` 通过 SteamWorks 的 HTTP 客户端调用 `POST /api/v1/plugin/report`。API 不主动连接游戏服务器，不需要开放 A2S 端口或保存 RCON 密码。
- **认证**：每个服务器有独立的 32 位十六进制令牌，保存在 `servers.plugin_token`，通过 `X-ThRei-Plugin-Token` 请求头提交。令牌只在管理员读取/生成接口中返回，不出现在服务器列表、公开接口或日志中。缺失、错误、服务器不存在或 `serverId` 不匹配统一返回 `401`。
- **输入校验**：`serverId` 最多 80 字符；地图最多 128 字符；`maxPlayers` 为 1–1024；最多 1024 名玩家；SteamID64 必须是 17 位数字；昵称截断到 80 字符；连接秒数限制在 0–2592000。无效或重复玩家记入 `skipped`，不会让整次上报失败。
- **写入**：在单个事务中更新服务器快照（状态、地图、人数上限、人数、`last_reported_at`），删除本次不再出现的 `server_players`，并 upsert 当前玩家；upsert 保留已有 `connected_at`。`maintenance` 状态不会被上报改为 `online`。
- **过期清理**：后台任务每 30 秒扫描一次；插件管理的服务器超过 90 秒未上报时，状态改为 `offline`、人数清零、延迟清空、删除在线名单，`maintenance` 保持不变。
- **管理状态**：`pluginState` 由 `plugin_token` 与 `last_reported_at` 派生：`disabled`（无令牌）、`waiting`（有令牌但没有最近上报）、`connected`（90 秒内有上报）。
- **令牌生命周期**：生成/轮换会清空在线快照并标记离线；撤销令牌执行同样的清理。旧令牌立即失效。
- **边界**：插件只上报状态和名单，不轮询踢出/封禁/白名单指令。`server_actions` 的游戏内执行仍未实现。

### 6.7 OpenAPI

- `utoipa` 从 handler 和 schema 生成 OpenAPI 3。
- 默认开发环境开启 `/api/v1/openapi.json` 与 `/api/v1/docs`；生产默认关闭。
- Swagger UI 使用 `vendored` 资源，构建时不需要从 GitHub 下载。
- 新增接口必须补充 `#[utoipa::path]`、schema、错误响应和 `docs/API.md`。
- 前端类型生成**尚未接入**；后续可基于 OpenAPI 生成类型，但生成代码需纳入评审。

## 7. 数据库设计原则

- PostgreSQL 是唯一权威数据源。
- SQLx 连接池：最大/最小连接数、获取超时、启动连接总超时可配置。
- 迁移使用 `sqlx::migrate!` 嵌入二进制，由独立的 `migrate` 二进制执行，**API 启动不自动迁移**。
- 迁移文件名 `YYYYMMDDHHMMSS_description.sql`，已应用迁移不可修改；修正通过新迁移完成。
- PostgreSQL DDL 在事务中执行；SQLx 在 `_sqlx_migrations` 记录版本、校验和与执行结果。
- 初始迁移建立 `pgcrypto` 与 `set_updated_at()`；后续迁移建立用户、会话、服务器、在线玩家、分类、主题、回复、收藏表。
- 业务表使用外键、唯一约束、CHECK 约束和索引；主题/回复采用 `deleted_at` 软删除字段，当前读取接口只返回未删除记录。
- `users.is_system` 标记官方系统账号；成员数、角色分布、最近注册和活跃统计会排除这些账号。
- `users.is_disabled` 禁用管理员账号；禁用会撤销会话并阻止登录。
- `bans` 保存 SteamID64、原因、到期时间、操作者与解封记录；生效封禁阻止登录。
- `servers.plugin_token` 保存每服务器插件令牌，唯一且可空；`servers.last_reported_at` 记录最近插件上报时间。
- `server_players` 的 SteamID64 非空，插件上报时按 `(server_id, steam_id64)` upsert；不再保存 A2S 匿名槽位。
- `server_whitelist`、`whitelist_applications` 管理服务器白名单与审核；`servers.requires_whitelist` 标记需要白名单的服务器。
- `forum_mutes` 记录论坛禁言；`server_bans` 记录服务器级封禁；`server_actions` 保存待游戏服务器插件消费的踢出/封禁指令。
- 迁移只新增，不修改已应用迁移。
- 禁止应用启动时删除/重建数据库；禁止容器启动时无条件清空卷。
- 备份/恢复流程见 [DEPLOYMENT.md](DEPLOYMENT.md)。

### SQLx 编译期检查与 `.sqlx`

当前没有使用 `query!` / `query_as!` 宏，因此不需要 `.sqlx`。引入编译期查询时：

1. 使用真实的本地/临时开发数据库（不得指向生产库）；
2. 运行 `cargo sqlx prepare` 生成 `.sqlx`；
3. 提交 `.sqlx` 并让 CI/Docker 构建使用 `SQLX_OFFLINE=true`；
4. 每次修改查询后重新生成并审查差异；
5. 不得为了绕过检查而删除 `.sqlx` 或改成未检查的字符串 SQL。

## 8. Redis 使用原则

- Redis 只存放**可重建的缓存**和**临时状态**（未来：限流计数、短期会话索引、通知去重）。
- 权威数据（用户、帖子、权限、审计）不写 Redis。
- Compose 启用 AOF（`appendonly yes`、`appendfsync everysec`）以减少重启时的临时状态丢失，但 Redis **不是备份系统**。
- 当前使用 `allkeys-lru` 与 `--save ""`。若未来把用户会话放入 Redis，必须重新评估淘汰策略与持久化要求。
- Redis 不发布公网端口，只加入内部网络。

## 9. 认证与权限设计（当前实现）

已实现：

- **身份**：Steam OpenID 2.0 是唯一登录方式；没有本地密码、邮箱注册或备用登录。
- **校验**：回调收到断言后，将参数以 `openid.mode=check_authentication` POST 回 Steam；只有 `is_valid:true` 才信任 `claimed_id` 中的 SteamID64。
- **用户**：按 `steam_id64` upsert；从公开 Steam profile XML 读取昵称和头像，失败时使用可读的 Steam 用户占位名称。
- **会话**：64 位十六进制随机令牌；数据库只保存 SHA-256 哈希；30 天过期（可配置）。
- **Cookie**：`threi_session`，`HttpOnly; SameSite=Lax; Path=/`，生产加 `Secure`；前端不把令牌写入 `localStorage`。
- **角色**：`member` / `moderator` / `admin`；`ADMIN_STEAM_IDS` 仅首次引导，之后由管理面板维护；管理页面和 API 均校验。
- **登出**：删除数据库会话并返回过期 Cookie。
- **权限**：`/api/v1/account` 需要登录；`/api/v1/admin/*` 需要管理员；公开读取接口不需要登录。管理员管理、封禁、白名单审核在 API 层再次校验。
- **插件**：`/api/v1/plugin/report` 不使用 Cookie，只接受每服务器令牌；令牌仅由管理员生成、读取和撤销。

尚未实现：

- 登录/回调限流；Steam 已承担主要身份验证，但仍需防滥用。
- CSRF 令牌；当前只有登出 POST 和只读接口，后续写接口必须补。
- RBAC 细粒度权限（当前只区分 admin 与其他角色）。
- 管理员操作审计表、会话设备管理、强制下线。
- 真实 Steam 账号的端到端自动化验收。

## 10. 部署拓扑

Compose 服务：

| 服务 | 网络 | 端口 | 说明 |
| --- | --- | --- | --- |
| `nginx` | edge | `127.0.0.1:80 -> 8080` | 唯一发布入口，非特权 UID 101 |
| `web` | edge | 内部 3000 | Next.js standalone，非 root UID 1001 |
| `api` | edge + internal | 内部 8080 | Axum，非 root UID 10001，含 migrator 二进制 |
| `migrate` | internal | 无 | 一次性迁移，完成后退出 |
| `postgres` | internal | 无发布 | 持久卷 `postgres_data` |
| `redis` | internal | 无发布 | 持久卷 `redis_data`（缓存/临时状态） |

- `edge` 是桥接网络；`internal` 设置 `internal: true`，数据库与 Redis 不直接暴露公网。
- 启动顺序：PostgreSQL/Redis healthy → `migrate` 成功 → API healthy → Web healthy → Nginx。
- 容器健康检查区分进程存活与依赖就绪：API 使用 `/health/ready`，Web 使用 `/healthz`。
- 镜像使用固定标签：`rust:1.97.1-slim-bookworm`、`debian:bookworm-slim`、`node:24.19.0-alpine3.23`、`nginx/nginx-unprivileged:1.30.6-alpine3.24`、`postgres:17.11-alpine3.23`、`redis:7.4.11-alpine3.21`。
- 多阶段构建，运行镜像不包含 Rust/Node 构建工具链。
- 默认只把 Nginx 绑定到 `127.0.0.1`；公网部署需显式修改 `HTTP_BIND` 并配置防火墙。
- HTTPS 模板位于 `deploy/nginx/https.conf.example`，未默认启用。

## 11. 配置与密钥管理

- 所有运行配置通过环境变量或受控配置文件注入；容器镜像不包含 `.env`。
- `.env` 被 Git 忽略；`.env.example` 只含占位符。
- `DATABASE_URL` 与 Redis URL 中的密码需要 URL 编码；推荐使用十六进制随机密码。
- 数据库/Redis 密码、未来 Cookie 密钥、SMTP 凭据不得写入日志、错误响应、前端 bundle 或 OpenAPI。
- 当前 Docker Compose 使用环境变量；更高安全等级可迁移到 Docker secrets / 外部 secret manager。
- 修改密码时需同步 `POSTGRES_PASSWORD`、`DATABASE_URL`、`REDIS_PASSWORD`（Compose 会拼入 `REDIS_URL`），并重建 API 容器。

## 12. 可观测性

- `tracing` + `tracing-subscriber`；生产 JSON 日志，开发可读格式。
- 每个请求一个 span，包含 method、path、request_id；响应日志包含状态码与延迟。
- Nginx 注入 `$request_id`，API 校验后沿用；错误响应返回 `x-request-id`。
- 日志不得包含密码、完整连接串、Cookie 或令牌。
- 当前没有指标（Prometheus）与分布式追踪导出；后续按运营需求引入，不在本阶段提前部署。

## 13. 当前限制与未来方向

**限制：**

- 写接口、CSRF、登录限流、审核与审计尚未实现；论坛/服务器内容目前只能通过数据库或后续管理接口写入。
- `ThRei_Players` 只上报状态与玩家，不执行踢出、封禁或白名单指令；在线名单依赖游戏服务器能访问 API。
- 在线状态由 90 秒上报窗口判断，API 不保存历史在线曲线。
- 没有邮件、通知投递和文件存储。
- 没有 CI、指标、集中日志和自动备份。
- Nginx 只配置了 HTTP；HTTPS 仅有示例。
- 本机无 Docker，镜像构建、Compose 启动和 `nginx -t` 未实际执行。
- `.sqlx` 尚未引入（使用运行时查询）。
- 前端没有纳入仓库的自动化组件/E2E 测试；本次使用本地无头浏览器做过手工交互验证。
- Steam 登录的最终授权需要真实 Steam 账号在浏览器完成。

**建议顺序：**

1. 在有 Docker 的主机完成镜像构建、Compose 启动和健康检查；
2. 真实 Steam 账号登录验收 + 登录限流/CSRF；
3. 论坛发帖/回复、资料编辑、收藏写接口；
4. 插件对踢出、封禁与白名单指令的游戏内执行；
5. 管理审核与审计；
6. CI、备份自动化、指标与 HTTPS 自动化。

## 14. 关键决策记录

| 决策 | 结论 | 理由 |
| --- | --- | --- |
| 单体 vs 微服务 | 第一阶段模块化单体 | 业务尚未验证，减少部署与一致性成本 |
| 健康检查前缀 | 根路径 `/health/*` | 基础设施探针不属于业务 API 版本 |
| 数据库迁移时机 | 独立 migrator，启动前执行 | 避免多实例启动时竞争迁移，失败可观测 |
| Redis 必需性 | 可配置；默认生产必需 | 允许开发环境降级，生产按实际依赖决定 |
| API 错误格式 | 错误统一包裹，成功直接返回 | 简单、易扩展，避免过度嵌套 |
| 前端 API 访问 | 浏览器同源，SSR 走内部地址 | 减少 CORS 与密钥暴露 |
| API 文档 | 开发默认开，生产默认关 | 降低生产信息面，保留开发效率 |
| 登录方式 | Steam OpenID 唯一登录 | 与 KZ 玩家身份一致，避免维护第二套密码 |
| 会话存储 | PostgreSQL 哈希令牌 + HttpOnly Cookie | 可撤销、可过期；当前不需要 Redis 持久化会话 |
| 管理面板 | 服务端会话 + 管理员 API 双重校验 | 前端隐藏不作为授权依据 |
| 数据来源 | PostgreSQL 业务表 | 删除前端模拟数据，空库显示空状态 |
| 前端目录 | route groups + features + services | 布局边界与 API 读取清晰 |

## 15. 文档维护

- 架构、目录、API 前缀、认证方案、网络拓扑、依赖策略变化时更新本文。
- 每次开发变更按北京时间写入 [DEVELOPMENT.md](DEVELOPMENT.md)，最新置顶。
- 版本级变化汇总到 [CHANGELOG.md](CHANGELOG.md)。
- API 契约变化同步 [API.md](API.md) 和 OpenAPI。
- 部署命令变化同步 [DEPLOYMENT.md](DEPLOYMENT.md) 与 README。
