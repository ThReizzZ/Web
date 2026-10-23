# Changelog

本文件面向项目维护者，按版本或里程碑汇总重要功能、修复、兼容性变化和升级注意事项。

与 `docs/DEVELOPMENT.md` 的区别：

- `DEVELOPMENT.md`：逐次开发变更，包含背景、文件、数据库/API 变化与真实验证结果；
- `CHANGELOG.md`：版本级汇总，便于部署和升级时快速判断影响。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，但版本号与发布状态以仓库实际状态为准。**未打标签、未发布的版本必须明确标注。**

---

## [Unreleased]

**状态：** 本地开发预览，尚未创建 Git tag 或正式发布。

### Added

- 新增 `/servers` 服务器目录：12 个 CS:GO KZ 服务器、地图、IP/PORT、全部在线玩家、人数上限、tickrate、延迟与区域信息。
- 服务器卡片/列表两种显示模式，默认卡片，选择会保存在浏览器 `localStorage`；支持按服务器、地图、地区或玩家昵称搜索。
- 卡片视图为 3 列错落卡片墙（1280px 起 3 列、768px 起 2 列、手机 1 列），卡片按内容高度排列，避免少人数服务器出现大面积空白。
- 全部在线玩家名称在卡片和列表中都完整展示，不使用省略号或“+N”隐藏。
- 在线玩家使用“模拟渐变字母头像 + 昵称”展示，卡片、列表和首页特色服务器在线栏保持一致。
- 复制 IP:PORT 按钮与“加入游戏”弹窗（CS:GO 控制台 `connect` 命令与 Steam 启动入口）。
- 新增 12 张本地 KZ 服务器地图预览 SVG；Web Dockerfile 现复制 `public/` 静态资源。
- 官网首页、论坛、分类页、帖子详情、用户中心和管理面板填充完整模拟数据。
- 论坛支持基于模拟数据的标题/摘要/标签/作者/分类搜索；新增分类卡片和主题回复展示。
- 管理面板新增运营指标、活跃度图表、用户列表、内容审核队列、审计日志、系统设置与服务器状态。
- 顶部导航、页脚和 sitemap 增加服务器入口。

### Changed

- 公开品牌名统一为 **ThRei**；技术标识 `threi-api`、包名、镜像名和 Compose 服务名保持不变。
- 站点游戏主题从 Minecraft 调整为 CS:GO KZ，官网、服务器、论坛、用户中心与管理面板文案同步。
- 首页和服务器页 hero 改为更平实的社区/目录说明，移除“从一次起跳开始”等煽情表达。
- 服务器卡片改为 16:9 地图头图和两列玩家头像布局，提升 3 列卡片墙中的可读性。
- 首页特色服务器卡片使用两列玩家头像布局，保持紧凑网格。
- 卡片墙使用自然高度，不再强制同行卡片等高；每张卡片内部的复制地址和加入游戏按钮保持底部对齐。
- 移除首页的架构原则/基础设施说明，替换为 KZ 社区、服务器和论坛内容。
- 移除“模块骨架 / 待实现”等开发占位文案，保留预览数据与未鉴权提示。

### Fixed

- 修复 `CardHeader` 使用 `flex-row` 但未启用 flex 导致的标题/操作错位。
- 修复用户中心横幅文字被头像遮挡、管理面板设置卡片多余空白。
- 移除论坛搜索结果的重复清除按钮。
- 修复服务器卡片 IP:PORT 截断、复制/加入按钮高度不一致和在线玩家名称被隐藏的问题。

### Security

- 服务器、论坛、用户中心和管理面板数据均为前端模拟数据，不代表真实状态。
- 管理面板仍无认证与权限校验；生产环境必须接入认证或临时限制访问。
- 服务器地址使用保留域名 `*.threi.example`，不会连接真实服务器。

### Compatibility / Upgrade Notes

- 本次没有数据库迁移和 API 契约变化。
- Web 镜像现在需要复制 `apps/web/public/`，已更新 `apps/web/Dockerfile`。
- 模拟数据仅用于预览，刷新后不会保留页面内的临时交互结果。

---

## [0.1.0] — 架构初始化（未发布）

**状态：** 本次任务交付，尚未创建 Git tag 或正式发布。

### Added

- Next.js 16 App Router 前端骨架，按 route group 分离官网、论坛、用户中心和管理面板布局。
- 共享 UI 组件（shadcn/ui 风格）、Lucide 图标、Tailwind CSS 4 设计 token。
- React Hook Form + Zod 的论坛搜索表单示例；TanStack Query 的 API 状态卡片。
- 统一浏览器/服务端 API 客户端，包含超时、错误归一化、`x-request-id` 与 Cookie 转发能力。
- Rust Axum API 模块化单体骨架、统一错误结构、请求 ID、CORS、超时、请求体限制和安全响应头。
- `/health/live`、`/health/ready` 健康检查；`/api/v1/system/info` 非敏感元信息接口。
- utoipa OpenAPI 生成与 Swagger UI（开发默认开启，生产默认关闭）。
- SQLx + PostgreSQL 连接池、独立 `migrate` 二进制、版本化初始迁移。
- Redis 连接管理器；支持必需/可选模式与就绪降级。
- Docker Compose 生产导向编排：Nginx（非特权）、Web、API、migrate、PostgreSQL、Redis。
- 多阶段 Dockerfile：运行镜像不包含构建工具链；Web/API 以非 root 运行。
- Nginx HTTP 反向代理模板、请求 ID 注入、内部健康检查隐藏、HTTPS 示例。
- `.env.example`、开发用 Compose 覆盖、本地检查脚本和数据库备份脚本。
- 项目文档：README、ARCHITECTURE、DEVELOPMENT、API、DEPLOYMENT、CHANGELOG。

### Changed

- 无（首次初始化）。

### Fixed

- 无（首次初始化）。

### Security

- 已实现：统一错误不泄露内部信息、请求追踪、安全响应头、CORS 允许列表、数据库/Redis 不发布端口、非 root 容器、生产默认关闭 API 文档、迁移与启动分离。
- **未实现，禁止误认为已有：** 登录、会话、CSRF、登录限流、RBAC、管理面板鉴权、内容审核、管理审计、CSP、HTTPS 自动化。详见 README 与 ARCHITECTURE。

### Compatibility / Upgrade Notes

- 首次部署：复制 `.env.example` 为 `.env`，替换全部密钥，执行 `docker compose config`、`docker compose build`、`docker compose up -d`。
- 初始迁移只创建 `pgcrypto` 与 `set_updated_at()`，没有业务表；迁移由 `migrate` 服务在 API 启动前执行。
- 初始版本没有历史数据/API，因此不存在从旧版本升级或兼容性迁移。

### Known Limitations

- 当前开发环境没有 Docker daemon/CLI，未实际构建镜像；详见 `docs/DEPLOYMENT.md` 第 13 节。
- 未配置 CI、HTTPS 证书、备份自动化、指标与集中日志。
- 前端无自动化组件/E2E 测试；后端暂无连接真实数据库的自动化集成测试（本次以临时实例手工验证）。
- `.sqlx` 离线编译缓存尚未引入（当前无编译期查询宏）。

---

## 模板（供后续版本使用）

```markdown
## [x.y.z] — YYYY-MM-DD（发布 / 未发布）

### Added
- 新功能、接口、配置或文档。

### Changed
- 行为、依赖、部署方式或契约变化。

### Deprecated
- 计划移除的能力。

### Removed
- 已移除的能力。

### Fixed
- 修复的问题及影响范围。

### Security
- 安全修复、认证/权限变化；未实现的安全能力不得写入此节。

### Compatibility / Upgrade Notes
- 数据库迁移、环境变量、API 兼容性、回滚注意事项。

### Known Limitations
- 尚未解决但已知的问题。
```
