# threi API 约定

> 当前版本：`v1`（架构初始化阶段）。
> 本文区分**已实现**与**设计约定/待实现**。未实现的接口不得被前端或第三方当作可用能力。

## 1. 基础约定

| 项目 | 约定 |
| --- | --- |
| 业务 API 前缀 | `/api/v1` |
| 传输 | HTTPS（生产，经 Nginx 终止 TLS）；HTTP 仅本地开发 |
| 请求/响应格式 | `application/json; charset=utf-8` |
| 字段命名 | `snake_case` |
| 时间格式 | 未来统一使用 RFC 3339 / UTC（ISO 8601），当前无业务时间字段 |
| 认证 | 规划为服务端 Cookie 会话（尚未实现） |
| 请求追踪 | 响应头 `x-request-id` |
| 健康检查 | 根路径 `/health/live`、`/health/ready`，不属于业务 API |
| OpenAPI | `/api/v1/openapi.json`、`/api/v1/docs`（受 `API_DOCS_ENABLED` 控制） |

生产环境中，浏览器与 API 同源：Nginx 将 `/api/` 直接转发到 API。开发环境可使用 Next.js rewrite 或 `NEXT_PUBLIC_API_BASE_URL` 指向 `http://127.0.0.1:8080`。

## 2. 已实现接口

### 2.1 `GET /health/live`

进程存活检查。不访问数据库或 Redis。

```json
{
  "status": "ok",
  "service": "threi-api",
  "version": "0.1.0"
}
```

- 状态码：`200`
- 公开性：仅容器/编排内部使用；Nginx 对该路径返回 404。
- 不包含依赖状态或敏感配置。

### 2.2 `GET /health/ready`

依赖就绪检查。并行探测 PostgreSQL（2 秒超时）与 Redis（2 秒超时）。

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok"
  },
  "version": "0.1.0",
  "uptime_seconds": 42
}
```

- `200`：`status` 为 `ok` 或 `degraded`。
- `503`：`status=unavailable`（数据库不可用，或 Redis 为必需但不可用）。
- `checks.database`：`ok` / `unavailable`。
- `checks.redis`：`ok` / `unavailable` / `disabled`。
- 不返回连接地址、账号、密码、驱动错误或内部路径。
- 公开性：仅容器/编排内部使用；Nginx 对该路径返回 404。

Redis 不可用且 `REDIS_REQUIRED=false` 时示例：

```json
{
  "status": "degraded",
  "checks": { "database": "ok", "redis": "unavailable" },
  "version": "0.1.0",
  "uptime_seconds": 120
}
```

### 2.3 `GET /api/v1/system/info`

非敏感服务元信息，用于前端验证 API 连通性。**不需要认证**。

```json
{
  "name": "threi-api",
  "version": "0.1.0",
  "environment": "production",
  "api_version": "v1"
}
```

- 状态码：`200`
- 不包含数据库/Redis 地址、密钥、构建路径或主机信息。

## 3. 错误结构

业务 API 的 HTTP 错误使用同一结构（健康检查的 503 返回其专用 `ReadinessResponse`，见 2.2）：

```json
{
  "error": {
    "code": "not_found",
    "message": "The requested resource was not found.",
    "details": null
  }
}
```

- `details` 可选，省略时为 `null` 或在 JSON 中不出现。
- 业务错误响应带 `Cache-Control: no-store`。
- 业务错误响应带 `x-request-id`；请在后端日志、前端错误提示或问题报告中引用。健康检查响应也带 `x-request-id`，但其 503 body 是就绪状态而非错误信封。
- 内部错误只记录服务端日志，客户端仅收到通用消息。

### 错误码

| HTTP | `code` | 含义 |
| --- | --- | --- |
| 400 | `bad_request` | 请求无法处理（格式/参数错误） |
| 401 | `unauthorized` | 需要认证（预留，当前无认证接口） |
| 403 | `forbidden` | 已认证但无权限（预留） |
| 404 | `not_found` | 资源或路由不存在 |
| 405 | `method_not_allowed` | 路径存在但方法不允许 |
| 409 | `conflict` | 与当前资源状态冲突（预留） |
| 422 | `validation_error` | 字段校验失败（预留） |
| 429 | `too_many_requests` | 触发限流（预留） |
| 504 | `request_timeout` | 请求处理超时 |
| 503 | `service_unavailable` | 服务暂时不可用（预留） |
| 500 | `internal_error` | 未预期内部错误 |

> 401/403/409/422/429/503 的响应类型已存在，但当前没有触发它们的业务接口。

## 4. 请求追踪

- 每个响应包含 `x-request-id`。
- Nginx 使用 `$request_id` 注入；API 仅接受长度 1–128、字符集为 ASCII 字母/数字/`-`/`_` 的值，否则生成 UUID。
- JSON/结构化日志中的 `http_request` span 包含 `request_id`。
- 前端 `ApiClient` 会将 `x-request-id` 暴露为 `ApiError.requestId`。

## 5. 认证与授权（设计约定，未实现）

规划方案：

- 登录成功后由 API 设置 `HttpOnly; Secure; SameSite=Lax` 会话 Cookie；前端不把会话令牌写入 `localStorage`。
- 服务端会话令牌为不透明随机值，数据库只保存哈希；支持过期、撤销和设备级会话管理。
- 写请求携带 CSRF 令牌（双提交 Cookie + `x-csrf-token`），API 强制校验。
- 权限由后端 RBAC 检查，前端隐藏按钮仅为体验优化。
- 登录失败与频率限制返回统一错误，不泄露账号是否存在。
- 管理接口要求显式权限；审计记录操作者、目标、动作、结果和请求 ID。

**当前没有任何登录、注册、会话、CSRF 或 RBAC 接口。** `/admin` 页面不是受保护资源。

## 6. 分页、排序与过滤（设计约定，未实现）

论坛等列表接口计划采用游标分页：

```json
{
  "items": [],
  "next_cursor": null
}
```

- Query：`limit`（默认 20，最大 100）、`cursor`（不透明字符串）。
- 不对客户端暴露数据库自增 ID 作为游标。
- 排序方式由端点固定或通过白名单参数选择，禁止直接拼接 SQL 排序字段。
- 过滤参数必须显式定义和校验；未知参数忽略或返回 400（由端点契约决定）。
- 具体实现前，本节不构成可用接口。

## 7. 版本与兼容性

- 业务接口全部位于 `/api/v1`。
- 允许的兼容变更：新增可选字段、新增端点、新增响应头、放宽校验。
- 破坏性变更：删除/重命名字段、改变类型/语义、收紧必填、改变错误码含义。
- 破坏性变更必须引入新版本前缀（如 `/api/v2`），保留过渡期，并更新 API 文档、OpenAPI、前端调用和 CHANGELOG。
- OpenAPI 是接口契约的机器可读来源；`docs/API.md` 解释约定与状态。

## 8. OpenAPI 与文档

开发环境（`API_DOCS_ENABLED=true`）：

- JSON：`GET /api/v1/openapi.json`
- Swagger UI：`GET /api/v1/docs`（会 303 跳转到 `/api/v1/docs/`）

生产环境默认 `API_DOCS_ENABLED=false`，两个路由都返回统一的 404 错误。

新增/修改端点时：

1. 添加 `#[utoipa::path]` 和 schema；
2. 将 path 加入 `ApiDoc` 的 `paths(...)`；
3. 更新本文的“已实现接口”；
4. 添加/更新集成测试；
5. 在 `docs/DEVELOPMENT.md` 记录 API 变化。

前端类型生成尚未接入。后续可在 CI 中基于 OpenAPI 生成类型，但生成结果需要代码审查，不能未经检查直接覆盖手写类型。

## 9. CORS

- 允许来源由 `CORS_ALLOWED_ORIGINS`（逗号分隔）控制，默认空。
- 允许凭据（Cookie）；因此禁止使用通配符 `*`。
- 暴露 `x-request-id`，允许请求头包括 `accept`、`authorization`、`content-type`、`x-request-id`、`x-csrf-token`。
- 生产同源部署不需要 CORS；跨域仅用于本地开发或明确的独立客户端。

## 10. 限流与滥用防护（待实现）

规划：

- 登录、注册、密码重置、发帖/回复等写操作单独限流；
- 以 IP + 用户 + 动作维度在 Redis 计数；
- 触发时返回 `429 too_many_requests`，带 `Retry-After`；
- 管理操作与审核操作保留审计记录。

当前 API 没有任何业务限流，仅由 Nginx 请求体大小和 API 超时提供基础保护。
