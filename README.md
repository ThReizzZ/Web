# ThRei

ThRei 是一个以长期生存、共同建造和友好交流为核心的 Minecraft 社区系统。仓库包含官网、服务器状态、论坛、用户中心和管理面板的统一前端，以及 Rust API、数据库、缓存、反向代理和生产部署骨架。

> **当前状态：前端内容预览阶段（v0.1.0）。**
> 官网、服务器页、论坛、用户中心和管理面板已填充完整的模拟数据，可预览上线后的界面和交互。
> 这些页面数据目前保存在前端代码中，**不会持久化**；登录、权限、真实服务器状态、审核和审计等后端业务仍**尚未实现**。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 16（App Router）、React 19、TypeScript 5.9（strict）、Tailwind CSS 4、shadcn/ui 风格组件、Lucide、React Hook Form + Zod、TanStack Query 5 |
| 后端 | Rust 1.97.1、Axum 0.8、Tokio、SQLx 0.9、PostgreSQL 17、Redis 7.4、OpenAPI（utoipa） |
| 部署 | Docker、Docker Compose、Nginx（非特权镜像）、多阶段构建 |

前端依赖在 `apps/web/package.json` 中使用精确版本；Rust 依赖使用兼容版本范围，由 `Cargo.lock` 精确锁定。两者与固定镜像标签共同保证可复现构建。

## 主要页面

| 路径 | 内容 |
| --- | --- |
| `/` | 官网首页：服务器在线状态、最新讨论、公告与社区数据 |
| `/servers` | 服务器列表：地图、IP/PORT、在线玩家、人数上限；卡片/列表切换、复制地址、加入游戏说明 |
| `/forum` | 论坛：分类、主题列表、搜索 |
| `/forum/[category]` | 分类主题列表 |
| `/forum/topic/[id]` | 帖子详情与回复 |
| `/account` | 用户中心：资料、活动、通知、徽章、安全与收藏服务器 |
| `/admin` | 管理面板：运营指标、用户、内容审核、审计、系统状态 |

> 页面内容为预览用模拟数据；服务器地址使用保留域名 `*.threi.example`，不会连接真实服务器。

## 目录结构

```text
threi/
├── apps/web/                  # Next.js 应用（官网 / 服务器 / 论坛 / 用户中心 / 管理面板）
│   ├── public/images/servers/ # 服务器地图预览图
│   ├── src/app/               # App Router 路由与布局（route groups 分离业务边界）
│   ├── src/components/        # 公共 UI 与布局组件
│   ├── src/features/          # servers / forum / account / admin 模块与模拟数据
│   ├── src/hooks/             # 共享客户端 hooks（TanStack Query）
│   ├── src/lib/               # API 客户端、Query Provider、站点配置、工具函数
│   ├── src/services/          # 类型化 API 服务封装
│   ├── src/types/             # 跨模块 API 类型
│   ├── Dockerfile
│   └── package.json
├── services/api/              # Rust Axum API（模块化单体）
│   ├── src/config/            # 环境配置加载与校验
│   ├── src/routes/            # HTTP 路由（health、system）
│   ├── src/middleware/        # 请求追踪 ID
│   ├── src/modules/           # 未来业务模块边界说明（当前无业务实现）
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
├── .env.example               # Compose 环境变量模板（无真实密钥）
└── README.md
```

## 快速开始（Docker Compose）

前置要求：Docker Engine 24+、支持 `compose.yaml` 与 `depends_on.condition` 的 Docker Compose、可访问镜像仓库。

```bash
cp .env.example .env
# 编辑 .env：至少替换 POSTGRES_PASSWORD、DATABASE_URL、REDIS_PASSWORD
# 密码建议使用 URL 安全字符：openssl rand -hex 24

docker compose config
docker compose build
docker compose up -d
docker compose ps
```

默认入口为 `http://127.0.0.1/`（`HTTP_BIND=127.0.0.1`、`HTTP_PORT=80`）。对外部署时，在防火墙/安全组就绪后再把 `HTTP_BIND` 改为 `0.0.0.0`。

首次 `up` 会先运行 `migrate` 服务，再启动 API。手动执行迁移：

```bash
docker compose run --rm migrate
```

查看日志与停止：

```bash
docker compose logs -f
docker compose logs -f api
docker compose down        # 保留命名卷
# docker compose down -v  # 危险：删除 PostgreSQL / Redis 数据卷
```

数据库备份：

```bash
./scripts/backup-db.sh
```

完整的部署、迁移、备份恢复、升级与 HTTPS 配置见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 本地开发（不经 Docker 运行应用）

需要一个本地 PostgreSQL 和 Redis。也可以只用 Compose 启动基础设施：

```bash
cp .env.example .env
docker compose -f compose.yaml -f compose.dev.yaml up -d postgres redis

cp services/api/.env.example services/api/.env
cp apps/web/.env.example apps/web/.env.local
# 若修改过根 .env 的密码，请同步修改 services/api/.env
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
- OpenAPI UI：<http://127.0.0.1:8080/api/v1/docs>（`API_DOCS_ENABLED=true` 时）
- 开发环境的浏览器请求通过 Next.js rewrite 走同源 `/api/v1`，不依赖 CORS。

`compose.dev.yaml` 只把 PostgreSQL/Redis 发布到 `127.0.0.1`，不得用于生产。

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

Docker 相关验证：

```bash
docker compose config
docker compose build
```

## 当前 API

所有业务接口统一使用 `/api/v1` 前缀。健康检查是基础设施接口，位于根路径，且不通过 Nginx 公开。

| 方法 | 路径 | 说明 | 公开 |
| --- | --- | --- | --- |
| GET | `/health/live` | 进程存活检查 | 否（容器内部） |
| GET | `/health/ready` | PostgreSQL / Redis 就绪检查 | 否（容器内部） |
| GET | `/api/v1/system/info` | 非敏感服务元信息 | 是 |
| GET | `/api/v1/openapi.json` | OpenAPI JSON | 受 `API_DOCS_ENABLED` 控制 |
| GET | `/api/v1/docs` | Swagger UI | 受 `API_DOCS_ENABLED` 控制 |

真实响应示例、错误结构、分页与认证约定见 [docs/API.md](docs/API.md)。

## 安全现状

**已经实现：**

- 统一错误结构，不向客户端返回内部错误或数据库凭据
- 请求追踪 ID（支持从 Nginx 传入并校验）
- 安全响应头、CORS 允许列表、请求体大小与超时限制
- 数据库迁移与 API 启动分离，迁移失败不会静默重建数据库
- 数据库和 Redis 不发布公网端口；API、Web 容器以非 root 用户运行
- 生产环境默认关闭 API 文档；`.env` 被 Git 忽略
- PostgreSQL 权威数据持久化；Redis 明确定位为缓存/临时状态

**尚未实现（不得视为已有能力）：**

- 登录、登出、会话与密码管理
- CSRF 防护、登录限流、角色与权限校验
- 管理面板鉴权（当前 `/admin` 是公开可见的骨架）
- 内容审核、管理操作审计
- CSP、HTTPS 证书自动化、备份自动化
- 论坛、用户中心、通知等业务接口与数据表

在完成认证与授权前，**不得将管理面板直接暴露到公网**。临时限制方式见部署文档。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [开发变更日志](docs/DEVELOPMENT.md) — 每次开发完成后必须追加
- [版本变更记录](docs/CHANGELOG.md)
- [API 约定](docs/API.md)
- [部署手册](docs/DEPLOYMENT.md)

## 工程约定

- **格式与检查：** Rust 使用 `rustfmt` / `clippy`；前端使用 ESLint、Prettier、`tsc --noEmit`。不要通过关闭规则来“通过检查”。
- **组件边界：** 默认 Server Components；仅在浏览器交互、客户端状态或 TanStack Query 缓存需要时添加 `"use client"`。
- **后端分层：** 路由只负责 HTTP 输入输出；业务规则在 service 层；SQL 归属模块 repository；跨模块通过 service 调用。
- **环境变量：** 只提交 `.env.example`。真实密码、Cookie 密钥和令牌不得进入代码、日志或 Git。
- **迁移：** 只新增迁移，不修改已应用迁移；迁移由独立 `migrate` 进程执行。使用 forward-only 策略，回滚依赖备份或新的修复迁移。
- **API 变更：** 破坏性变更必须升级版本前缀并更新 `docs/API.md`、OpenAPI 和 CHANGELOG。
- **依赖升级：** 使用精确版本与锁文件；升级后运行全部检查并记录到开发日志。
- **开发日志：** 每次完成一组有边界的修改，按北京时间追加到 `docs/DEVELOPMENT.md`，最新条目置顶。

## 已知限制

- 当前环境没有 Docker，镜像构建和容器启动未在本次初始化中实际执行；请在有 Docker 的主机上先运行 `docker compose build` 与健康检查。
- 没有 CI 配置；检查脚本供本地和后续 CI 直接复用。
- 尚无覆盖真实数据库的自动化集成测试；本次通过临时 PostgreSQL 实例手工验证了迁移与就绪检查。
- Redis 当前只用于未来的缓存/临时状态，业务代码尚未读写 Redis。
- 未配置 HTTPS 证书；`deploy/nginx/https.conf.example` 仅为示例。

## License

内部项目。除非仓库后续添加明确的许可证文件，否则不构成开源授权。
