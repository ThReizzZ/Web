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
