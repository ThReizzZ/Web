# threi 部署手册

> 适用于本仓库的 Compose 栈：`nginx`、`web`、`api`、`migrate`、`postgres`、`redis`。
> 所有命令均在仓库根目录执行。生产环境必须替换全部示例密钥，并在防火墙后运行。

## 1. 环境准备

- Linux 服务器（建议 2 vCPU / 2 GB 内存以上）
- Docker Engine 24+
- Docker Compose v2
- 可用磁盘空间（镜像、PostgreSQL 数据、备份）
- 已解析到服务器的域名（HTTPS 需要）
- 防火墙/安全组：只开放 80/443；不要开放 3000、8080、5432、6379

检查版本：

```bash
docker --version
docker compose version
```

## 2. 环境变量

```bash
cp .env.example .env
```

至少修改：

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_PASSWORD` | 强随机密码 |
| `DATABASE_URL` | 必须与 `POSTGRES_*` 一致；密码需 URL-safe/百分号编码 |
| `REDIS_PASSWORD` | 强随机密码；会被拼入 API 的 `REDIS_URL` |
| `SITE_URL` | 公开访问地址，如 `https://community.example.com` |
| `SERVER_NAME` | Nginx server_name，如 `community.example.com` |
| `HTTP_BIND` | 默认 `127.0.0.1`；公网部署改为 `0.0.0.0` 并配置防火墙 |
| `HTTP_PORT` | 默认 `80`；若前置了其他 TLS 代理可改为 `8080` |
| `API_DOCS_ENABLED` | 生产建议保持 `false` |
| `CORS_ALLOWED_ORIGINS` | 同源部署保持空；跨域时显式填写 |

建议用十六进制密码，避免 URL 编码问题：

```bash
openssl rand -hex 32
```

`DATABASE_URL` 示例（密码需与该处完全一致）：

```dotenv
POSTGRES_PASSWORD=<hex-password>
DATABASE_URL=postgres://threi:<hex-password>@postgres:5432/threi
```

> 修改 `POSTGRES_PASSWORD`/数据库名后必须同步 `DATABASE_URL`。
> 修改 `REDIS_PASSWORD` 后无需改 API 配置，Compose 会重新生成 `REDIS_URL`。
> `.env` 被 Git 忽略，权限建议 `chmod 600 .env`。

## 3. 校验与构建

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

`docker compose config` 只做本地解析，不需要连接远程仓库。
`docker compose build` 构建两个独立镜像：

- `threi-api:<IMAGE_TAG>`（Rust 多阶段构建，运行镜像含 API 与 migrator）
- `threi-web:<IMAGE_TAG>`（Next.js standalone，多阶段构建）

`docker compose up -d` 的启动顺序：

1. `postgres`、`redis` 通过健康检查；
2. `migrate` 执行嵌入的 SQLx 迁移并成功退出；
3. `api` 启动并通过 `/health/ready`；
4. `web` 启动并通过 `/healthz`；
5. `nginx` 启动并通过 `/nginx-health`。

若 `migrate` 失败，`api` 不会启动；查看日志：

```bash
docker compose logs migrate
docker compose logs api
```

## 4. 验证

```bash
docker compose ps
docker compose logs --tail=100 migrate api

# 容器内部健康检查（不经过公网）
docker compose exec -T api curl -fsS http://127.0.0.1:8080/health/live
docker compose exec -T api curl -fsS http://127.0.0.1:8080/health/ready

# 经过 Nginx 的公开接口
curl -fsS http://127.0.0.1/api/v1/system/info
curl -fsS http://127.0.0.1/nginx-health
```

`/health/live` 和 `/health/ready` 被 Nginx 刻意返回 404，这是预期行为，不是故障；请从容器内部或编排系统探测。

Web：

```bash
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/forum
```

## 5. 常用运行命令

```bash
docker compose config       # 校验编排与变量插值
docker compose build        # 构建 web/api 镜像
docker compose up -d        # 启动/更新服务
docker compose ps           # 查看状态与健康
docker compose logs -f      # 跟踪全部日志
docker compose logs -f api  # 跟踪 API 日志
docker compose exec api sh  # 进入 API 容器
docker compose down         # 停止并删除容器，保留命名卷
```

**数据风险：**

- `docker compose down` 默认**不会删除**命名卷 `threi_postgres_data`、`threi_redis_data`。
- `docker compose down -v` 会删除命名卷，**永久丢失 PostgreSQL 数据**。
- 不要用 `down -v` 作为常规重启或“清理”命令。
- 迁移失败时不要通过删除卷来“修复”；先备份并检查失败原因。

## 6. 数据库迁移

迁移文件位于 `services/api/migrations/`，使用 `sqlx::migrate!` 编译进 `migrate` 二进制。**API 启动不会自动迁移。**

正常升级：

```bash
docker compose build
docker compose run --rm migrate
docker compose up -d
```

`up` 时也会先运行 `migrate` 服务；显式 `run --rm migrate` 适合在维护窗口先执行并观察结果。

查看迁移记录：

```bash
docker compose exec postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version, description, success, installed_on FROM _sqlx_migrations ORDER BY version;"'
```

规则与故障处理：

- 迁移是 forward-only；不要修改已经应用过的迁移文件，否则校验和不匹配。
- 需要修正时新增迁移，不要编辑历史文件。
- 迁移失败会以非零码退出；SQLx 不会自动回滚已提交的 DDL/数据变更。先查看 `migrate` 日志，评估是否需要恢复备份，再新增修复迁移。
- 不要删除 `_sqlx_migrations` 或数据库卷来绕过失败。
- 只允许应用/迁移连接数据库；不要手工在生产库执行未审查的 SQL。
- 回滚策略：应用镜像回滚 + 数据库从备份恢复，或编写向前修复迁移。优先使用“扩展 → 迁移数据 → 收缩”的兼容式迁移。

## 7. 日志

```bash
docker compose logs -f --tail=200
docker compose logs -f api
docker compose logs -f nginx
docker compose logs -f migrate
```

- API 生产默认 JSON 日志；包含 `request_id`、method、path、状态码、延迟。
- Nginx 访问日志包含 `request_id`。
- 日志驱动为 `json-file`，每条服务限制 `max-size=10m`、`max-file=3`。
- 不要把 `.env`、Cookie、令牌或完整连接串写入日志。
- 生产环境建议接入集中日志采集；本次未配置。

## 8. 故障排查

### API 不健康 / 反复重启

```bash
docker compose ps
docker compose logs --tail=200 api
docker compose logs --tail=100 postgres redis migrate
```

常见原因：

- `DATABASE_URL` 密码/库名与 `POSTGRES_*` 不一致；
- 密码含 `@`、`/`、`#` 等未编码字符；
- PostgreSQL 尚未 healthy；
- `REDIS_REQUIRED=true` 但 Redis 不可用；
- 首次启动迁移失败。

### `migrate` 失败

```bash
docker compose logs migrate
```

检查数据库连接、迁移 SQL、磁盘空间。不要清空数据库卷；必要时先备份，再新增修复迁移。

### 502 / 504

```bash
docker compose ps
docker compose logs nginx web api
```

- `web` 不健康：检查 Next.js 启动日志、Node 内存、`API_INTERNAL_URL`。
- `api` 不健康：检查数据库/Redis。
- 504：检查 API 日志和请求耗时；默认 API 超时 30 秒、Nginx 读超时 60 秒。

### 端口被占用

```bash
ss -ltnp | grep ':80\|:443'
```

修改 `.env` 的 `HTTP_PORT`，或者停止占用端口的服务。不要为了排查把 PostgreSQL/Redis 端口发布到公网。

### 健康检查 404

通过 Nginx 访问 `/health/live` 或 `/health/ready` 返回 404 是安全设计。请在容器内探测：

```bash
docker compose exec -T api curl -fsS http://127.0.0.1:8080/health/ready
```

### 管理面板暴露风险

当前 `/admin` **没有认证**。生产上线前必须：

- 完成登录、RBAC 和管理面板服务端保护；或
- 在 Nginx 临时限制来源，例如：

```nginx
location /admin {
  allow 203.0.113.10;   # 替换为运维出口 IP
  deny all;
}
```

这只是临时缓解，不是认证方案。

## 9. 备份与恢复

### 备份

```bash
./scripts/backup-db.sh
# 或指定输出目录
./scripts/backup-db.sh /var/backups/threi
```

脚本通过 `docker compose exec` 在 PostgreSQL 容器内执行 `pg_dump --format=custom`，不需要在宿主机安装 `psql`。建议：

- 每日定时备份，保留多份；
- 备份文件复制到另一台机器/对象存储；
- 定期在临时数据库验证恢复；
- 同时备份 `.env` 到安全位置（不要提交 Git）。

Redis 只保存缓存/可重建的临时状态，**不作为备份对象**；其 AOF 卷不能替代 PostgreSQL 备份。

### 恢复到临时数据库（推荐先验证）

```bash
# 在容器内创建临时库
docker compose exec postgres sh -c \
  'createdb -U "$POSTGRES_USER" threi_restore'

# 导入备份（示例文件名请替换）
cat backups/threi-YYYYMMDDTHHMMSSZ.dump | docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d threi_restore --no-owner --clean --if-exists'

# 验证后删除临时库
docker compose exec postgres sh -c \
  'dropdb -U "$POSTGRES_USER" threi_restore'
```

### 恢复到生产库（高风险）

必须在维护窗口执行，并先停止写入：

```bash
docker compose stop web api
cat backups/threi-YYYYMMDDTHHMMSSZ.dump | docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists'
docker compose start api web
```

`--clean --if-exists` 会删除当前对象；确认备份文件和目标库后再执行。不要在未备份的情况下操作。

## 10. 升级与回滚

升级前：

```bash
./scripts/backup-db.sh
```

升级：

```bash
# 修改 IMAGE_TAG 或拉取新代码后
docker compose build
docker compose run --rm migrate
docker compose up -d
docker compose ps
docker compose logs --tail=100 api
curl -fsS http://127.0.0.1/api/v1/system/info
```

回滚：

1. **仅应用回滚**：把 `IMAGE_TAG` 改回上一版本并 `docker compose up -d`；
2. **数据库兼容问题**：优先新增向前修复迁移；
3. **必须恢复数据**：停止写入，按第 9 节恢复备份；
4. 回滚后重新验证 `/health/ready`、关键页面与 API。

迁移采用 forward-only。为降低风险，生产迁移应遵循 expand/contract：先新增兼容结构，再迁移数据，最后在后续版本移除旧结构。

## 11. HTTPS

默认只提供 HTTP。`deploy/nginx/https.conf.example` 是示例，**不会自动启用**。非特权 Nginx 在容器内监听 8080/8443，需要映射为主机 80/443。

建议步骤：

1. 获取证书（certbot、云厂商证书或内部 CA）；
2. 将证书挂载到容器，例如：
   ```yaml
   nginx:
     ports:
       - "80:8080"
       - "443:8443"
     volumes:
       - ./deploy/nginx/certs:/etc/nginx/certs:ro
       - ./deploy/nginx/certbot-webroot:/var/www/certbot:ro
   ```
3. 基于 `https.conf.example` 创建 `deploy/nginx/conf.d/default.conf.template`，替换 `example.com`、证书路径和 ACME webroot；
4. 设置 `.env` 的 `SERVER_NAME` 为真实域名；
5. `docker compose up -d --force-recreate nginx`；
6. 验证 HTTP→HTTPS 跳转、证书链、API 与页面；
7. 确认 HTTPS 正常后再启用 HSTS；证书续期通过 certbot 定时任务完成并重载 Nginx。

不要同时挂载默认 HTTP 模板和 HTTPS 模板，它们会争用 8080 端口。

## 12. 生产检查清单

- [ ] `.env` 权限受限，所有示例密码已替换
- [ ] `docker compose config` 通过，镜像标签固定，无 `latest`
- [ ] 数据库/Redis 没有发布公网端口
- [ ] `HTTP_BIND` 与防火墙/安全组匹配
- [ ] 备份已配置并验证恢复
- [ ] `docker compose ps` 所有服务 healthy（`migrate` 为 exited 0）
- [ ] API/Web 健康检查通过
- [ ] 管理面板已受保护（认证或临时网络限制）
- [ ] HTTPS 证书有效，HSTS 仅在验证后启用
- [ ] 日志中无密钥、Cookie 或连接串
- [ ] 已阅读并遵守 `docs/DEVELOPMENT.md` 的日志规则

## 13. 本次交付的验证边界

本次架构初始化在**没有 Docker daemon/CLI** 的开发环境中完成，因此：

- 已通过独立 Compose v5.6.1 二进制执行 `docker compose config`；
- 未实际执行镜像构建、容器启动、Nginx 配置加载和 HTTPS 验证；
- 已在临时 PostgreSQL 17.11 + Redis 7.4.11 实例上验证迁移、健康检查和 API；
- 首次在具备 Docker 的主机部署时，必须执行 `docker compose build`、`docker compose up -d` 并完成第 12 节检查。
