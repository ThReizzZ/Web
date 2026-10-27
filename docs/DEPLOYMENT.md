# ThRei 部署手册

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
| `SITE_URL` | 公开访问地址，如 `https://community.example.com`；Compose 用它派生 `WEB_URL`、`STEAM_RETURN_URL`、`STEAM_REALM` |
| `COOKIE_SECURE` | HTTPS 生产环境保持 `true`；仅本地 HTTP 调试设为 `false` |
| `SESSION_TTL_DAYS` | 会话有效期，默认 30 天，范围 1–365 |
| `ADMIN_STEAM_IDS` | 管理员 SteamID64，逗号分隔；空值表示没有管理员 |
| `HIBERNATION_POLL_ENABLED` | 可选的 RCON 空服存活探测，默认 `true`；白名单、踢出和封禁不依赖它 |
| `HIBERNATION_POLL_SCAN_INTERVAL_SECS` | 扫描插件上报已过期服务器的间隔，默认 30 秒，范围 1–3600 |
| `HIBERNATION_POLL_INTERVAL_SECS` | 同一服务器两次 RCON 探测的最小间隔，默认 60 秒 |
| `HIBERNATION_POLL_AFTER_SECS` | 插件上报超过该秒数才允许 RCON 探测，默认 90 秒 |
| `HIBERNATION_RCON_TIMEOUT_SECS` | 单次 RCON `status` 查询的总超时，默认 5 秒 |
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
>
> Steam 回调 origin 必须与用户浏览器实际访问的公开地址一致。远程浏览器不能用 `127.0.0.1` 作为回调地址；否则浏览器会尝试连接它自己的本机端口。Compose 由 `SITE_URL` 派生回调地址。

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

### 管理面板访问

`/admin` 已在 Web 服务端检查 Steam 会话与 `admin` 角色，`/api/v1/admin/overview` 也会再次校验；顶部导航只对管理员显示“管理面板”。生产环境仍需：

- 在 `ADMIN_STEAM_IDS` 中配置至少一位初始管理员 SteamID64；之后可在管理面板“管理员”页面添加、取消或禁用管理员；
- 生产环境至少保留两位正常管理员；系统拒绝取消或禁用最后一位可用管理员；
- 首次登录后从用户中心确认 SteamID64，再更新配置并重新登录；
- 不把管理面板作为公网匿名入口；必要时叠加 Nginx 来源限制：

```nginx
location /admin {
  allow 203.0.113.10;   # 替换为运维出口 IP
  deny all;
}
```

网络限制是额外防护，不能替代 Steam 登录和角色校验。

### Steam 登录网络限制

API 主机必须能访问 `steamcommunity.com` 才能完成 OpenID `check_authentication` 和资料 XML 查询。如果服务器所在网络会重置该域名的 TLS 连接（例如中国大陆主机），可以任选一种方式。

#### 方式一：直连 Steam 边缘 IP

查询一个可用的 Steam 边缘 IPv4：

```bash
curl -sS -H 'accept: application/dns-json' \
  'https://doh.pub/dns-query?name=steamcommunity.com&type=A'
```

在 API 主机上验证该 IP（SNI 使用完全限定名 `steamcommunity.com.`，证书仍按 `steamcommunity.com` 校验）：

```bash
printf 'GET /profiles/76561199125125759?xml=1 HTTP/1.1\r\nHost: steamcommunity.com\r\nConnection: close\r\n\r\n' \
  | openssl s_client -quiet -connect <IP>:443 -servername steamcommunity.com. \
      -verify_hostname steamcommunity.com -verify_return_error
```

返回 `HTTP/1.1 200 OK` 和资料 XML 后，在 `.env` 设置：

```dotenv
STEAM_COMMUNITY_BASE_URL=https://steamcommunity.com
STEAM_COMMUNITY_IP=<IP>
```

然后重建 API：

```bash
docker compose up -d --no-deps --force-recreate api
```

API 会优先使用该 IP 直连；资料查询失败时回退到 `STEAM_COMMUNITY_BASE_URL`。OpenID `check_authentication` 是一次性断言，失败后不会自动重放，重新登录即可。Steam/Akamai 轮换 IP 后登录可能重新失败，此时重新查询并更新 `.env`。

#### 方式二：Cloudflare Worker 中继

> 本项目生产环境（`threi.cn`）当前使用本方式：Worker `threi-steam-relay` 绑定
> `steam.threi.online`，服务器与 API 容器均已验证可访问。仓库内
> `deploy/cloudflare/wrangler.toml` 可用 `npx wrangler deploy` 一键部署。

1. 按 [deploy/cloudflare/README.md](../deploy/cloudflare/README.md) 部署 Worker 到
   `steam.threi.online`；
2. 在 `.env` 设置 `STEAM_COMMUNITY_BASE_URL=https://steam.threi.online`（留空或不要设置 `STEAM_COMMUNITY_IP`）；
3. `docker compose up -d --no-deps --force-recreate api`。

Worker 只代理服务端校验，**不会**让浏览器登录页变得可访问。用户浏览器仍需能打开 `steamcommunity.com`（例如开启 Steam 社区加速器、代理或 VPN）；否则登录会在跳转 Steam 时失败。不要在生产环境使用 `STEAM_SKIP_OPENID_VERIFICATION`。

### 应急管理员登录（magic link）

当 Steam 暂时不可用、但需要进入管理面板时，服务器运维可以在 API 容器内生成一次性管理员登录链接：

```bash
cd /home/web/threi
docker compose exec api /app/magic-link --steam-id 76561199125125759
```

- 链接 10 分钟内有效且只能使用一次；打开后会把一次性令牌换成正常会话并跳转 `/account`。
- 用户不存在时会创建为管理员；已存在的普通成员需要加 `--promote`；已禁用账号会被拒绝。
- 链接本身是管理员凭证，不要通过聊天或工单传播；Nginx 访问日志可能记录查询字符串。
- 这是应急通道，不替代 Steam 登录。

### 游戏服务器状态与玩家

API 不再进行 A2S 轮询，也不会向游戏服务器发送任意 RCON 指令。每个游戏服务器需要安装
`plugins/ThRei_Players/` 中的 SourceMod 插件（当前 `1.5.0`）：

1. 游戏服务器安装 SourceMod 1.11+ 与 SteamWorks 扩展；
2. 在管理面板点击「添加服务器」，只需填写游戏服务器的 Host / IP 与端口；服务器 ID 自动生成，添加成功后自动打开「插件配置」。服务器名称、地图和在线人数会在插件首次上报后自动更新；
3. 点击「生成令牌」，复制弹窗中的 `sm_threi_instance <端口> "<令牌>"` 配置行（不需要复制服务器 ID）；
4. 将 `addons/sourcemod/plugins/ThRei_Players.smx` 复制到游戏服务器，把配置写入 `cfg/sourcemod/threi_players.cfg`（多实例见下方说明）：

```cfg
sm_threi_players_enabled "1"
sm_threi_api_url "https://community.example.com/api/v1/plugin/report"
sm_threi_interval "30"
sm_threi_instance 27015 "<管理面板生成的令牌>"

// 白名单与封禁同步、网站踢出/封禁指令（不需要 RCON）
sm_threi_access_enabled "1"
sm_threi_access_fail_open "1"
sm_threi_access_interval "30"
sm_threi_actions_enabled "1"
// 失败后的重试间隔；正常投递使用 20 秒 long-poll，通常 1 秒内到达
sm_threi_actions_interval "15"
```

5. 执行 `sm plugins load ThRei_Players`（或重载地图），然后用 `sm_threi_report` 立即上报；
6. 管理面板应显示「插件已连接」，网站服务器目录出现在线玩家。`sm_threi_status` 会显示访问快照
   是否加载、白名单/封禁条目数与待确认指令数，不会输出令牌。

**一台主机运行多个实例：** 所有实例共用同一份 `cfg/sourcemod/threi_players.cfg`，为每个实例
添加一行 `sm_threi_instance <hostport> "<该实例的令牌>"`：

```cfg
sm_threi_players_enabled "1"
sm_threi_api_url "https://community.example.com/api/v1/plugin/report"
sm_threi_interval "30"
sm_threi_instance 10001 "<实例 10001 的令牌>"
sm_threi_instance 10002 "<实例 10002 的令牌>"
```

插件读取自身 `hostport`（缺失时回退 `port`），只使用端口匹配那一行的令牌。上报请求可以不带
`serverId`，API 根据唯一令牌定位服务器。配置中只要出现任意一行有效 `sm_threi_instance`，
`sm_threi_server_id` / `sm_threi_token` 就不再生效；端口没有匹配行时插件记录错误并跳过上报，
避免把数据写入错误的服务器。`sm_threi_status` 会显示 `hostport` 与 `instance=matched`。
仍兼容三参数形式 `sm_threi_instance <端口> <服务器ID> <令牌>`。

**社区组：** 在管理面板「社区组」页面先创建社区组，再点击组内「添加实例」把同一主机的多个
实例加入；也可以在「服务器管理」的添加服务器弹窗中直接选择社区组。一个实例只能属于一个组，
服务器目录会显示社区组标签并支持按组筛选。删除社区组不会删除服务器，只会让实例变为未分组。

游戏服务器必须能访问 `sm_threi_api_url`。生产环境应使用 HTTPS，因为令牌通过 HTTP 头传输。插件令牌按服务器隔离；重新生成或撤销后旧令牌立即失效。超过 90 秒没有上报会自动显示离线。完整说明见 [../plugins/ThRei_Players/README.md](../plugins/ThRei_Players/README.md)。

### 封禁与白名单

管理面板提供白名单审核、移除授权、服务器封禁/解封，以及在线玩家的踢出/封禁。这些游戏内操作
由 `ThRei_Players` 1.5.0+ 通过带每服务器令牌的 HTTP 通道执行，**不需要 RCON**：

- 插件每 30 秒（`sm_threi_access_interval`）获取一次纯文本访问快照。服务器开启
  `requires_whitelist` 时，不在全服白名单的玩家会在连接完成时被踢出；封禁始终生效，并支持临时
  封禁到期。白名单为全服共享：玩家申请并通过一次后，所有开启白名单的服务器通用；审核通过、
  移除授权、新增封禁或解封最长在一个刷新间隔内同步到游戏服务器。
- 插件对 `/plugin/actions?wait=20` 发起 long-poll，新指令通常 1 秒内到达并执行。执行后调用
  确认接口，API 记录 `processed_at`；请求失败时按 `sm_threi_actions_interval` 重试。目标已
  离线时踢出无额外动作，封禁仍写入插件本地缓存，阻止其重新连接。
- 解封会同时取消尚未执行的封禁指令，避免解封后旧指令再次踢人。
- 网站后台的 `pendingActions` 表示尚未被插件确认的指令数。正常情况下指令约 1 秒内执行；插件
  离线时会在恢复连接后执行。
- 插件缓存最后一次成功加载的访问规则。API 暂时不可达时不会因为一次网络失败突然放行或踢出
  所有人；首次快照加载前是否放行由 `sm_threi_access_fail_open` 控制（默认放行）。
- 令牌错误、撤销或缺失时，访问快照和指令接口返回 `401`，插件保留旧快照并记录日志。

**可选的 RCON 空服探测：** CS:GO 的 `sv_hibernate_when_empty` 会在空服时暂停 SourceMod 定时器，
插件因此停止上报。若在管理面板「服务器管理 → RCON」为实例保存 RCON 密码，API 会在插件上报过期
后只发送 `status` 命令：空服标记 `hibernating`，有玩家标记 `online`，连续 3 次失败才标记
`offline`。RCON 密码只写不读，不出现在任何 API 响应或日志中；删除密码会把 `hibernating`
恢复为 `offline`。RCON 不是白名单、踢出或封禁的前置条件，未配置 RCON 的服务器一切照常工作。

网站账号封禁（`bans`）与服务器封禁（`server_bans`）相互独立：前者支持 SteamID64 与 IP 类型，
阻止网站登录并撤销会话；IP 封禁会自动关联该 IP 下已知的非管理员账号，管理员保留恢复通道。
后者只影响游戏服务器。完整协议与排错见
[../plugins/ThRei_Players/README.md](../plugins/ThRei_Players/README.md) 和
[API.md](API.md)。

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
- [ ] `ADMIN_STEAM_IDS` 已配置，管理面板与管理员 API 验证通过
- [ ] 每个游戏服务器已安装 `ThRei_Players` 1.5.0+，后台显示「插件已连接」，令牌未写入 Git
- [ ] 一主机多实例时，所有实例共用一份 `threi_players.cfg`，每个实例都有匹配 `hostport` 的 `sm_threi_instance` 行，后台各自显示「插件已连接」
- [ ] 已在「社区组」页面创建社区组并加入同一主机的多个实例，服务器目录按组显示正常
- [ ] 全服白名单已在一个服务器上审核通过，并验证其他开启白名单的服务器也能进入；网站踢出/封禁约 1 秒内生效，且没有配置 RCON 也能执行
- [ ] 如启用 RCON 空服探测，已设置密码、验证 `hibernating` 状态，且 API 可访问对应 RCON 端口；密码未写入日志或 Git
- [ ] HTTPS 证书有效，HSTS 仅在验证后启用
- [ ] 日志中无密钥、Cookie 或连接串
- [ ] 已阅读并遵守 `docs/DEVELOPMENT.md` 的日志规则

## 13. 本次交付的验证边界

本次架构初始化在**没有 Docker daemon/CLI** 的开发环境中完成，因此：

- 已通过独立 Compose v5.6.1 二进制执行 `docker compose config`；
- 未实际执行镜像构建、容器启动、Nginx 配置加载和 HTTPS 验证；
- 已在局域网 PostgreSQL 18.6 + Redis 7.4 实例上验证迁移、健康检查、真实数据 API、Steam 登录重定向与未登录/登出流程；
- 未使用真实 Steam 账号完成最终授权，也未执行 Docker/HTTPS 验证；
- 首次在具备 Docker 的主机部署时，必须执行 `docker compose build`、`docker compose up -d` 并完成第 12 节检查。
