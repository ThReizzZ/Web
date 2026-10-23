# ThRei

ThRei 是一个以 CS:GO KZ 攀爬、连跳和长跳玩法为核心的社区系统，包含官网、服务器目录、论坛、用户中心和管理面板，统一使用 Rust API 与 PostgreSQL 数据源。

> **当前状态：真实数据与 Steam 登录接入阶段（v0.1.0）。**
> 前端不再包含模拟数据；服务器、论坛、用户中心和统计数字均来自 PostgreSQL。
> 登录只支持 Steam OpenID。数据库为空时会显示空状态，而不是伪造内容。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 16（App Router）、React 19、TypeScript 5.9（strict）、Tailwind CSS 4、shadcn/ui 风格组件、Lucide、React Hook Form + Zod、TanStack Query 5 |
| 后端 | Rust 1.97.1、Axum 0.8、Tokio、SQLx 0.9、PostgreSQL 17/18、Redis 7.4、OpenAPI（utoipa） |
| 登录 | Steam OpenID 2.0，数据库会话，HttpOnly Cookie |
| 部署 | Docker、Docker Compose、Nginx（非特权镜像）、多阶段构建 |

前端依赖在 `apps/web/package.json` 中使用精确版本；Rust 依赖使用兼容版本范围，由 `Cargo.lock` 精确锁定。

## 主要页面

| 路径 | 内容 |
| --- | --- |
| `/` | 官网首页：真实服务器统计、最新主题、公告与社区计数 |
| `/servers` | 服务器目录：数据库中的 KZ 服务器、地图、IP/PORT、真实在线玩家、人数上限；卡片墙/列表切换、搜索、复制地址与 Steam 加入流程 |
| `/forum` | 论坛：数据库分类、主题列表、搜索与最近活跃成员 |
| `/forum/[category]` | 分类主题列表 |
| `/forum/topic/[id]` | 帖子详情与回复；包含官方新手指南与白名单说明 |
| `/account` | 用户中心：Steam 资料、主题/回复统计、最近活动、服务器收藏与退出登录 |
| `/admin` | 管理面板：运营概览、管理员管理、封禁管理、白名单审核 |

没有数据时，页面显示明确的空状态；不会回退到模拟内容。服务器地址、地图和在线玩家以数据库记录为准。

## 登录

- 顶部导航的登录按钮为 **使用Steam登录**，点击后跳转到 Steam OpenID。
- Steam 是网站唯一登录方式；没有本地密码、邮箱注册或其他登录入口。
- 回调地址默认为 `${WEB_URL}/api/v1/auth/steam/callback`。
- 登录成功后写入 `threi_session` HttpOnly Cookie（`SameSite=Lax`，生产环境加 `Secure`）。
- `ADMIN_STEAM_IDS` 中的 SteamID64 用于首次引导管理员；之后通过管理面板增删/禁用，登录不会覆盖数据库角色。
- 顶部导航只对管理员显示“管理面板”；匿名用户和普通成员看不到该入口。
- 管理面板 `/admin` 在服务端校验会话与管理员角色；匿名访问跳转登录，非管理员跳转首页。
- 管理面板支持按 SteamID64 新增管理员、取消管理员、禁用/启用账号；不能操作自己，也不能移除最后一位可用管理员。
- 封禁管理支持临时/永久封禁、解封；封禁会立即撤销目标网站会话并阻止再次登录。
- 白名单审核支持申请审核、服务器白名单开关、手动授权与移除；玩家可在用户中心提交申请。游戏内拦截仍需服务器插件读取白名单数据。

真实 Steam 登录需要浏览器完成 Steam 授权。自动化测试覆盖了登录重定向、回调和未登录访问，但未使用真实 Steam 账号完成最终授权。

## 目录结构

```text
threi/
├── apps/web/                  # Next.js 应用（官网 / 服务器 / 论坛 / 用户中心 / 管理面板）
│   ├── public/                # 静态资源占位目录
│   ├── src/app/               # App Router 路由与布局
│   ├── src/components/        # 公共 UI 与布局组件
│   ├── src/features/          # servers / forum / account / admin 模块与类型
│   ├── src/lib/               # API 客户端、格式化、站点配置
│   ├── src/services/          # 类型化 API 请求
│   ├── src/types/             # 跨模块 API 类型
│   ├── Dockerfile
│   └── package.json
├── services/api/              # Rust Axum API（模块化单体）
│   ├── src/config/            # 环境配置加载与校验
│   ├── src/routes/            # HTTP 路由（health、system）
│   ├── src/modules/           # auth / servers / forum / community / account / admin
│   ├── src/infrastructure/    # PostgreSQL、Redis、日志
│   ├── src/errors/            # 统一错误类型与响应
│   ├── migrations/            # 版本化 SQLx 迁移
│   ├── tests/                 # HTTP 合约测试
│   ├── Dockerfile
│   └── Cargo.toml
├── deploy/nginx/              # Nginx 主配置、HTTP 模板、HTTPS 示例
├── docs/                      # 架构、开发日志、API、部署、CHANGELOG
├── scripts/                   # 本地检查与数据库备份
├── compose.yaml               # 生产导向服务编排
├── compose.dev.yaml           # 仅开发用的端口覆盖
└── .env.example               # Compose 环境变量模板（无真实密钥）
```

## 快速开始（Docker Compose）

前置要求：Docker Engine 24+、支持 `compose.yaml` 与 `depends_on.condition` 的 Docker Compose、可访问镜像仓库。

```bash
cp .env.example .env
# 编辑 .env：至少替换 POSTGRES_PASSWORD、DATABASE_URL、REDIS_PASSWORD，
# 并把 SITE_URL 改成公开 HTTPS 地址；Steam 回调由它派生。
# 填入 ADMIN_STEAM_IDS（逗号分隔的 SteamID64），否则管理面板无人可访问。

docker compose config
docker compose build
docker compose up -d
docker compose ps
```

默认入口为 `http://127.0.0.1/`。首次启动会执行迁移，然后启动 API/Web/Nginx。生产环境使用 HTTPS 时保持 `COOKIE_SECURE=true`；本地 HTTP 调试可设为 `false`。

手动迁移与日志：

```bash
docker compose run --rm migrate
docker compose logs -f api
docker compose logs -f web
```

数据库备份：

```bash
./scripts/backup-db.sh
```

完整部署、迁移、备份恢复、升级与 HTTPS 配置见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 本地开发（不经 Docker 运行应用）

开发环境使用一个独立的 PostgreSQL 与 Redis。当前开发配置连接局域网测试实例；连接信息只写在被 Git 忽略的 `services/api/.env` 中，不提交到仓库。

```bash
cp services/api/.env.example services/api/.env
cp apps/web/.env.example apps/web/.env.local
# 按本地数据库填写 DATABASE_URL / REDIS_URL
# 按本地预览地址填写 WEB_URL / STEAM_RETURN_URL / STEAM_REALM
```

启动后端（终端 1）：

```bash
cd services/api
cargo run --bin migrate
cargo run
```

启动前端（终端 2）：

```bash
cd apps/web
npm install
npm run dev
```

- Web：<http://localhost:3000>
- API：<http://127.0.0.1:8080>
- Steam 回调：`http://localhost:3000/api/v1/auth/steam/callback`
- OpenAPI UI：<http://127.0.0.1:8080/api/v1/docs>（`API_DOCS_ENABLED=true` 时）

本地浏览器通过 Next.js rewrite 走同源 `/api/v1`。如果从局域网其他设备访问，请把 `WEB_URL`、`STEAM_RETURN_URL`、`STEAM_REALM` 和 `NEXT_PUBLIC_SITE_URL` 改成该设备访问的 origin；Steam 回调必须与浏览器访问的 origin 一致。

Redis 是可选的缓存/临时状态依赖；当前会话存储在 PostgreSQL，不依赖 Redis。`REDIS_REQUIRED=false` 时 Redis 不可用只会让就绪检查变为 `degraded`。

## 检查与测试

```bash
./scripts/check.sh
cd apps/web && npm run build
```

`scripts/check.sh` 依次执行：

- `cargo fmt --all -- --check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`

## API

所有业务接口统一使用 `/api/v1` 前缀。健康检查是基础设施接口，位于根路径，且不通过 Nginx 公开。

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/health/live` | 进程存活检查 | 否（容器内部） |
| GET | `/health/ready` | PostgreSQL / Redis 就绪检查 | 否（容器内部） |
| GET | `/api/v1/system/info` | 非敏感服务元信息 | 否 |
| GET | `/api/v1/auth/steam/login` | 跳转 Steam OpenID | 否 |
| GET | `/api/v1/auth/steam/callback` | 验证 Steam 断言、创建会话 | 否 |
| GET | `/api/v1/auth/me` | 当前会话用户或 `null` | 可选 |
| POST | `/api/v1/auth/logout` | 撤销当前会话 | 需要 |
| GET | `/api/v1/servers` | 服务器、地图与在线玩家 | 否 |
| GET | `/api/v1/forum/categories` | 分类与真实计数 | 否 |
| GET | `/api/v1/forum/topics` | 主题列表、分类/搜索过滤 | 否 |
| GET | `/api/v1/forum/topics/{slug}` | 主题详情与回复 | 否 |
| GET | `/api/v1/forum/active-users` | 最近活跃作者 | 否 |
| GET | `/api/v1/community/overview` | 社区统计 | 否 |
| GET | `/api/v1/account` | 当前用户资料与活动 | 需要 |
| GET | `/api/v1/admin/overview` | 管理统计 | 管理员 |
| GET | `/api/v1/admin/users/lookup` | 按 SteamID64 查询玩家资料 | 管理员 |
| GET/POST | `/api/v1/admin/admins` | 管理员列表 / 新增管理员 | 管理员 |
| DELETE | `/api/v1/admin/admins/{steam_id64}` | 取消管理员权限 | 管理员 |
| POST | `/api/v1/admin/admins/{steam_id64}/disable`、`/enable` | 禁用 / 启用管理员 | 管理员 |
| GET/POST | `/api/v1/admin/bans` | 封禁记录 / 创建封禁 | 管理员 |
| POST | `/api/v1/admin/bans/{id}/lift` | 解封 | 管理员 |
| GET/POST | `/api/v1/admin/whitelist` | 白名单审核数据 / 手动授权 | 管理员 |
| POST | `/api/v1/admin/whitelist/applications/{id}/approve`、`/reject` | 审核申请 | 管理员 |
| PATCH | `/api/v1/admin/servers/{id}/whitelist` | 开关服务器白名单要求 | 管理员 |
| POST | `/api/v1/whitelist/applications` | 玩家提交白名单申请 | 需要登录 |
| GET | `/api/v1/openapi.json` | OpenAPI JSON | 受 `API_DOCS_ENABLED` 控制 |
| GET | `/api/v1/docs` | Swagger UI | 受 `API_DOCS_ENABLED` 控制 |

真实响应示例、错误结构、Cookie 会话与配置见 [docs/API.md](docs/API.md)。

## 安全现状

**已经实现：**

- Steam OpenID 唯一登录方式，服务端验证断言后才信任 SteamID64
- 不透明随机会话令牌；数据库只保存 SHA-256 哈希；HttpOnly Cookie、过期时间
- 生产环境 `Secure` Cookie 选项，`SameSite=Lax`
- `/account` 与 `/admin` 服务端会话检查；管理 API 二次校验管理员角色
- 管理角色初始由 `ADMIN_STEAM_IDS` 引导，之后可在管理面板增删/禁用；管理面板导航只对管理员显示
- 统一错误结构、请求追踪 ID、安全响应头、CORS 允许列表、请求体与超时限制
- 数据库迁移与 API 启动分离；数据库和 Redis 不发布公网端口
- 生产环境默认关闭 API 文档；`.env` 被 Git 忽略

**尚未实现（不得视为已有能力）：**

- 登录限流、CSRF 令牌（当前已有管理员写接口，但尚未加 CSRF）
- 论坛发帖/回复、资料编辑、收藏管理的写接口
- 细粒度 RBAC、管理员操作审计
- 游戏服务器插件到 `server_players` 的实时上报
- CSP、HTTPS 证书自动化、备份自动化
- CI；当前只有本地检查脚本
- 使用真实 Steam 账号完成一次完整的浏览器登录验收

在完成安全评审前，不要将管理面板暴露到不受信任的公网。`/admin` 即使有服务端权限检查，也不替代部署层访问控制。

## 已知限制

- 数据库预置了 5 个论坛分类和 1 篇官方新手指南，没有预置服务器、真实玩家或模拟讨论。
- 新手指南会说明进入服务器和申请白名单的流程；登录玩家可在用户中心提交白名单申请，论坛发帖/回复写接口仍未开放。
- 服务器“在线玩家”需要外部游戏服务器插件写入 `server_players`；当前没有该插件。
- 没有通过网站创建/编辑论坛内容或服务器的界面；服务器记录仍需由后续服务器管理接口或数据库运维写入。
- 白名单和封禁数据已落库，但游戏服务器插件尚未接入；未实现自动踢出/拦截，生产需要插件在连接前读取对应表。
- 本机没有 Docker daemon，镜像构建、Compose 启动、`nginx -t` 与 HTTPS 未在本地执行。
- 当前开发环境连接局域网 PostgreSQL/Redis；生产使用 Compose 内 PostgreSQL/Redis。
- 真实 Steam 断言已能在服务端通过 OpenID 校验并建立会话；仍需要人工从浏览器完整重试一次新回调，以验证最终跳转和 Cookie 写入。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [开发变更日志](docs/DEVELOPMENT.md) — 每次开发完成后必须追加
- [版本变更记录](docs/CHANGELOG.md)
- [API 约定](docs/API.md)
- [部署手册](docs/DEPLOYMENT.md)

## 工程约定

- **格式与检查：** Rust 使用 `rustfmt` / `clippy`；前端使用 ESLint、Prettier、`tsc --noEmit`。不要通过关闭规则来“通过检查”。
- **组件边界：** 默认 Server Components；仅在浏览器交互、客户端状态或 TanStack Query 缓存需要时添加 `"use client"`。
- **后端分层：** 路由负责 HTTP 输入输出；SQL 归属业务模块；认证与权限由 API 最终校验。
- **环境变量：** 只提交 `.env.example`。真实密码、Cookie 令牌不得进入代码、日志或 Git。
- **迁移：** 只新增迁移，不修改已应用迁移；迁移由独立 `migrate` 进程执行。使用 forward-only 策略。
- **开发日志：** 每次完成一组有边界的修改，按北京时间追加到 `docs/DEVELOPMENT.md`，最新条目置顶。

## License

内部项目。除非仓库后续添加明确的许可证文件，否则不构成开源授权。
