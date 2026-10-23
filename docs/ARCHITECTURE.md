# ThRei 架构说明

> 本文记录当前**已实现**的架构，以及明确规划但**尚未实现**的能力。
> 架构发生变化时，必须同步更新本文与 [DEVELOPMENT.md](DEVELOPMENT.md)。
> 当前版本：`0.1.0`（架构初始化）。

## 1. 目标与阶段

ThRei 是一个长期运营的 Minecraft 社区系统，统一承载官网、服务器状态、论坛、用户中心和管理面板。
第一阶段采用**模块化单体**（modular monolith），目标是：

- 建立清晰的前后端职责边界和目录边界；
- 统一身份、API、错误处理、日志和配置；
- 建立可重复的数据库迁移与部署流程；
- 为后续用户、权限、论坛、通知、审核、审计和系统配置模块预留扩展点；
- 不提前引入微服务、消息队列等尚无实际需求的基础设施。

本阶段**没有**实现登录、权限、真实服务器状态、论坛持久化数据、审核或审计。前端已使用本地模拟数据填充页面，相关后端能力在本文中标记为“规划”。

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
```

职责：

- **Web**：页面渲染、SEO、交互、客户端缓存。不包含后端密钥，不决定最终权限。
- **API**：业务规则、认证/授权、数据访问、审计、统一错误。所有写操作的最终校验在此。
- **PostgreSQL**：权威数据源，只能由 API 访问。
- **Redis**：缓存和临时状态（未来：限流、会话索引等），不是系统记录。
- **Nginx**：公开入口、TLS 终止预留、路径转发、请求 ID 注入、隐藏内部健康检查。

## 4. Monorepo 结构

```text
apps/web                 Next.js 应用（独立构建、独立镜像）
services/api             Rust API 与 migrator（独立构建、独立镜像）
deploy/nginx             Nginx 主配置、HTTP 模板、HTTPS 示例
docs                     架构、开发日志、API、部署、CHANGELOG
scripts                  检查与备份脚本
compose.yaml             生产导向编排
compose.dev.yaml         本地开发用的基础设施端口覆盖
```

前端与后端是同一 Git 仓库中的两个独立工程，没有共用构建工具链，也没有根级 JavaScript workspace。这样可以避免前后端依赖版本相互牵制。

### 与初始规划的差异

- **没有 `apps/web/public/`**：目前没有静态资源需求。图标和 manifest 由 `src/app/icon.svg`、`src/app/manifest.ts` 生成；等真正需要静态文件时再创建。
- **`services/api/src/modules/` 当前只有边界说明**，没有空业务目录。业务模块在需求明确后创建，避免“占位目录 + 空抽象文件”。
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
- `ServerDirectory`：卡片/列表显示模式切换与 `localStorage` 偏好；
- `CopyAddressButton` / `JoinServerButton`：剪贴板、原生 `<dialog>` 加入说明与交互状态；
- `error.tsx` / `global-error.tsx`：错误边界需要交互；
- Radix `Label` / `Separator` 包装组件（基础交互组件）。

页面、metadata、数据读取和布局保持为 Server Components。不要为了省事给根布局或整页添加 `"use client"`。

### 5.3 API 客户端

- `src/lib/api/client.ts`：与框架无关的 `ApiClient`，统一处理 base URL、超时、`credentials`、JSON 解析和错误归一化；错误类型为 `ApiError`，包含 HTTP 状态、业务错误码和 `x-request-id`。
- `src/lib/api/browser.ts`：浏览器客户端。`NEXT_PUBLIC_API_BASE_URL` 为空时使用同源 `/api/v1`（生产由 Nginx 转发；本地由 Next rewrite 转发）。
- `src/lib/api/server.ts`：仅服务端使用（`server-only`），通过 `API_INTERNAL_URL` 访问容器内 API，并转发 Cookie、请求 ID，为未来会话接入做准备。服务端密钥不进入客户端 bundle。
- `src/services/*.ts`：按资源封装类型化端点，并用 Zod 校验关键响应（当前为 `system/info`）。
- `src/hooks/*.ts`：TanStack Query hooks，统一 key 和刷新策略。

本地开发时，`next.config.ts` 根据 `API_INTERNAL_URL` 生成 `/api/v1/:path*` rewrite。生产环境 Nginx 在请求到达 Next 之前就处理 `/api/`，因此 rewrite 不是生产流量的主路径。

### 5.4 SEO 与错误页面

- 根布局定义 `metadataBase`、标题模板、OpenGraph、Twitter、robots。
- 页面提供 `generateMetadata`（分类/帖子按参数生成标题，服务器页有独立 metadata）。
- `robots.ts`、`sitemap.ts`（含 `/servers`）、`manifest.ts`、`icon.svg` 已建立。
- `not-found.tsx`、`error.tsx`、`global-error.tsx` 已建立。论坛列表刻意不使用父级 `loading.tsx`，以免流式渲染使 `notFound()` 无法返回真正的 404 状态码。
- 用户中心与管理面板设置 `noindex`。

### 5.5 认证与前端访问控制（规划）

前端可以做路由级重定向和菜单显隐以改善体验，但**不能作为授权依据**。后续：

- 未认证访问 `/account`、`/admin` 由服务端会话检查后重定向；
- 管理操作按钮按权限隐藏，同时 API 必须再次校验；
- Cookie 由 API 签发，前端不存储访问令牌到 `localStorage`。

当前 `/admin` 是公开演示面板：数据为前端模拟内容，认证与授权尚未实现，文档明确警告不得直接公网暴露。

### 5.6 预览数据与模块组织

当前页面内容来自前端模块内的本地模拟数据，不经过数据库或 API：

- `src/features/servers/data/servers.ts`：服务器信息、地图、在线玩家样例；
- `src/features/forum/data/forum.ts`：分类、主题、回复，支持本地搜索；
- `src/features/account/data/account.ts`：当前演示用户、活动、通知与安全概览；
- `src/features/admin/data/dashboard.ts`：运营指标、审核队列与审计日志；
- `apps/web/public/images/servers/*.svg`：本地服务器地图预览图。

这些数据只用于界面预览，刷新不会保存修改，也不代表真实服务器状态。后续接入 API 时，应将数据读取替换为服务端查询，并保持组件边界不变。页面底部和管理面板明确标注“预览数据”。

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
src/modules/                未来业务模块边界说明
src/bin/migrate.rs          独立迁移二进制
```

未来业务模块（尚未实现）：`users`、`rbac`、`servers`、`forum`、`notifications`、`moderation`、`audit`、`settings`。`servers` 将负责服务器目录、状态同步和在线玩家查询。每个模块内部建议：

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

### 6.6 OpenAPI

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
- 初始迁移只建立 `pgcrypto` 与 `set_updated_at()` 触发器函数，不创建业务表。
- 业务表按模块需求新增，命名、索引、约束、审计字段和软删除策略在对应模块设计中确定。
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

## 9. 认证与权限设计（规划，未实现）

目标边界：

- **用户**：身份、资料、凭据状态；不直接携带权限判断。
- **角色**：权限集合（如 `member`、`moderator`、`admin`）。
- **权限**：后端稳定标识（如 `forum.topic.delete`、`admin.audit.read`），路由与 service 双重校验。
- **会话**：服务端存储的不透明随机令牌（数据库保存哈希），Cookie 为 `HttpOnly; Secure; SameSite=Lax; Path=/`。
- **CSRF**：Cookie 会话 + 双提交令牌（`x-csrf-token`），写请求校验；登录/登出也覆盖。
- **密码**：Argon2id；禁止明文、可逆加密或自行实现哈希。
- **登录限流**：按 IP + 账号维度，Redis 计数/滑动窗口；失败响应不泄露账号是否存在。
- **管理审计**：写操作记录操作者、动作、目标、时间、请求 ID、结果；审计表只追加。
- **密钥**：Cookie 签名/加密密钥、SMTP 等通过环境变量或后续 secret manager 注入，不提交 Git，不写入日志。
- **前端路由保护**：服务端读取会话后重定向；隐藏菜单不作为授权。

接入顺序建议：用户表/会话 → 登录限流/CSRF → RBAC → 管理面板保护 → 审计。

当前已具备的基础：请求 ID、统一错误、Cookie 透传的 Server API 客户端、CORS 白名单、独立中间件层、PostgreSQL/Redis 连接。**没有**任何认证代码或默认账号。

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

- 没有认证、授权、CSRF、限流；管理面板公开可见。
- 没有业务表和业务 API；服务器、论坛、用户中心和管理面板使用前端模拟数据，刷新后不持久化。
- 没有后台任务、邮件、真实服务器状态同步、通知投递和文件存储。
- 没有 CI、指标、集中日志和自动备份。
- Nginx 只配置了 HTTP；HTTPS 仅有示例。
- 本次初始化环境无 Docker，镜像构建与容器启动未实际执行。
- `.sqlx` 尚未引入（无编译期查询）。
- 前端没有纳入仓库的自动化组件/E2E 测试；本次使用本地无头浏览器做过手工交互验证。

**建议顺序：**

1. 在有 Docker 的主机完成镜像构建、Compose 启动和健康检查；
2. 用户/会话/登录限流/CSRF；
3. RBAC 与管理面板保护 + 审计；
4. 论坛分类、主题、回复（含分页、审核状态）；
5. 通知与用户中心；
6. 内容审核工作流；
7. CI、备份自动化、指标与 HTTPS 自动化。

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
| 管理面板 | 公开演示面板（模拟数据） | 尚未实现认证；文档与界面明确警告 |
| 初始迁移 | 仅扩展与触发器函数 | 不提前创建无需求业务表 |
| 前端目录 | route groups + features（含本地模拟数据） | 布局边界与业务模块清晰，便于后续替换为 API |

## 15. 文档维护

- 架构、目录、API 前缀、认证方案、网络拓扑、依赖策略变化时更新本文。
- 每次开发变更按北京时间写入 [DEVELOPMENT.md](DEVELOPMENT.md)，最新置顶。
- 版本级变化汇总到 [CHANGELOG.md](CHANGELOG.md)。
- API 契约变化同步 [API.md](API.md) 和 OpenAPI。
- 部署命令变化同步 [DEPLOYMENT.md](DEPLOYMENT.md) 与 README。
