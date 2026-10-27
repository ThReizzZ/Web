# Changelog

本文件面向项目维护者，按版本或里程碑汇总重要功能、修复、兼容性变化和升级注意事项。

与 `docs/DEVELOPMENT.md` 的区别：

- `DEVELOPMENT.md`：逐次开发变更，包含背景、文件、数据库/API 变化与真实验证结果；
- `CHANGELOG.md`：版本级汇总，便于部署和升级时快速判断影响。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，但版本号与发布状态以仓库实际状态为准。**未打标签、未发布的版本必须明确标注。**

---

## [Unreleased]

**状态：** 本地开发与真实数据接入，尚未创建 Git tag 或正式发布。

### Changed

- **2026-10-28 封禁模型改为仅作用于游戏服务器：** 不论封禁来自游戏内还是网站，都不再封禁
  网站账号、不撤销网站会话、不阻止网站登录；用户中心展示当前游戏封禁的服务器、原因和到期时间。
  旧 `bans` 表停用并清空记录，新增 `server_ip_bans` 保存游戏 IP 封禁。
- SteamID 游戏封禁和服务器管理里的玩家封禁会自动查找玩家最近 IP（网站登录、有效会话或插件
  上报的服务器 IP）并创建游戏 IP 封禁；管理员当前 IP 不会被自动封禁。
- 网站解除游戏封禁会同时解除同组 IP 封禁；新增 `banip` / `unbanip` 即时指令，网站和游戏内
  的 IP 封禁解除都能在约 1 秒内到达所有服务器。
- `ThRei_Players` 1.6.0 上报在线玩家 IP；1.9.0 通过 `POST /api/v1/plugin/ban-report` 回传
  游戏内 ThRei 封禁，网站写入全服游戏封禁和 IP 封禁，不再写入账号封禁。
- 网站解除游戏服务器封禁时写入 `unban` 指令；`ThRei_Players` 1.6.1 会把 SteamID64 转为
  SteamID2 并调用 `RemoveBan`，删除服务器本地由 `sm_ban` 写入的 SteamID 封禁。
- `ThRei_Players` 1.7.0 新增 `sm_threi_ban` / `sm_threi_addban` / `sm_threi_unban` /
  `sm_threi_banip` / `sm_threi_unbanip`，同时写本地引擎封禁和网站记录；网站下发的封禁也写
  本地引擎封禁。新增 `ban_group_id` 把一次游戏内封禁产生的账号、服务器、IP 记录关联起来，
  网站解除服务器封禁时按组清理；新增 `/plugin/ip-ban-report` 与 `/plugin/unban-report`。
  basebans 暂时保留，后续版本再提供兼容命令名并逐台卸载。
- `ThRei_Players` 1.7.1 修复封禁/解封命令只识别 SteamID64 的问题，现在支持
  `STEAM_0:0:...`、`STEAM_1:...`、`[U:1:...]` 和 `U:1:...`，内部统一转 SteamID64。
- `ThRei_Players` 1.7.2 过滤非法 UTF-8 玩家名/原因，并在网站返回 4xx 时丢弃该条上报，
  避免一条坏请求卡住后续封禁同步。
- `ThRei_Players` 1.7.3 改为读取原始参数串，支持不加引号的 SteamID2/3 和 IPv6；Source
  引擎的 `:` 分词不再把 `STEAM_0:0:...` 拆成多个参数。
- `ThRei_Players` 1.8.0 改成纯插件封禁：不再写 basebans/引擎封禁，封禁持久化到
  `configs/threi_bans.cfg`，连接时用自定义提示踢出；解封删除条目后立即可以重连。basebans
  未加载时自动接管 `sm_ban` / `sm_unban` / `sm_banip` 等命令。代价是插件未加载时封禁失效。
- `ThRei_Players` 1.8.1 取消 basebans 检测，始终注册 `sm_ban` / `sm_addban` / `sm_unban` /
  `sm_banip` / `sm_unbanip`；安装前直接删除 `basebans.smx` 即可。
- `ThRei_Players` 1.9.0 支持访问快照 `banip`、指令 `banip` / `unbanip`；游戏内封禁默认全服，
  网站解封 IP 立即清除所有服务器本地封禁。封禁不写引擎封禁，也不影响网站账号。
- `ThRei_Players` 1.9.1 在 SteamID 封禁玩家重连时自动补抓 IP：本服立即加入本地 IP 封禁，
  并通过 `associateIpOnly` 上报网站，关联到原封禁并广播 `banip`。即使封禁时玩家离线且从未
  登录网站，下次进服后同 IP 的其他账号也会被拦截。
- `ThRei_Players` 1.9.2 移除失效的 `sm_threi_ban`，统一使用 `sm_ban` / `!ban`；`!ban` 不带
  参数会打开选择玩家、时长和原因的交互菜单，带参数时保持原来的直接封禁行为。
- `ThRei_Players` 1.9.3 移除 `sm_threi_addban` / `sm_threi_unban` / `sm_threi_banip` /
  `sm_threi_unbanip`，统一使用标准命令 `sm_addban` / `sm_unban` / `sm_banip` / `sm_unbanip`；
  只保留 `sm_threi_report` / `sm_threi_status` 诊断命令。
- 管理面板新增「登录玩家」页面：列出全部非系统账号、最近登录时间/IP、角色、禁用状态和活跃会话数。
- 用户中心 KZ 地图卡片支持 KZT/SKZ/VNL 模式、已完成/未完成地图、T1–T7 筛选和分页；完成地图显示地图分数。
- 顶部导航移除重复的「用户中心」入口，保留右上角头像入口。
- 服务器卡片和服务器目录从 KZ:GO 地图库补全地图预览图与 Tier 等级；图片加载失败时显示渐变兜底。
- `ThRei_Players` 1.9.4 上报在线真人玩家的平均 RTT（`latencyMs`）。服务器卡片对登录用户按访问 IP 与服务器位置显示“预估延迟”，未登录用户显示“延迟未知”；插件平均延迟保存在 API 中备用。
- 服务器卡片隐藏社区组名称和未知地区标识；不再直接展示 IP:PORT，仅保留复制地址和加入游戏按钮。
- 地图预览改为下载站优先：先请求 `cdn.threi.cn/csgo/map-images-v1/{map}.jpg`，失败后回退到站点 `/map-images/{map}` 代理（GitHub raw → jsDelivr），最终再显示渐变兜底。图片已同步到 files.threi.cn 的 `map-images-v1` 目录。
- 白名单改为全服共享：玩家申请一次、管理员审核一次，所有开启白名单的服务器通用；
  新增 `global_whitelist` 并迁移旧的 `server_whitelist` 数据。
- 游戏服务器封禁默认作用于全部服务器（`scope: "global"`），封禁弹窗可选择“仅本服”；
  `server_bans.server_id` 允许为 `NULL` 表示全服封禁，访问快照同时包含全服封禁。
- `/api/v1/plugin/actions` 新增 `?wait=<秒>` long-poll（最大 20 秒），`ThRei_Players` 1.5.0
  使用它，网站踢出/封禁通常 1 秒内执行。
- 管理面板「封禁管理」新增游戏服务器封禁列表，可查看作用范围并解除。

### Added

- 管理面板新增独立的「服务器排序」页面：支持拖动、置顶/上移/下移，保存后公开目录按该顺序显示。
- 服务器管理页操作区重新分组：常用操作保留文字按钮，RCON/社区组/白名单/删除改为图标按钮。
- 服务器目录新增排序：默认、在线人数、服务器名称、延迟、在线状态；选择保存在本地。
- 新增亮色/黑夜模式切换：顶部导航与管理面板均可切换，偏好保存在本地，未设置时跟随系统。
- 新增 Steam OpenID 登录：`/api/v1/auth/steam/login`、`/callback`、`/me`、`/logout`。
- 新增数据库会话：随机令牌、SHA-256 哈希存储、`threi_session` HttpOnly Cookie、过期时间与登出撤销。
- 新增真实业务表：`users`、`sessions`、`servers`、`server_players`、`categories`、`topics`、`replies`、`favorites`。
- 新增真实数据 API：服务器目录、论坛分类/主题/详情/活跃用户、社区统计、用户中心、管理员概览。
- 新增管理员角色：`ADMIN_STEAM_IDS` 配置；`/admin` 与 `/api/v1/admin/overview` 双重校验。
- 新增管理员管理：按 SteamID64 添加管理员、取消管理员、禁用/启用账号，并保护最后一位可用管理员。
- 新增管理员输入查询：输入 17 位 SteamID64 后显示玩家头像、昵称和 ID 下拉框，选择后再添加。
- 新增论坛管理：主题/回复编辑、软删除、恢复、置顶/热门/分类/标签设置，论坛用户禁言与封禁。
- 新增服务器管理：添加/删除、启用停用、在线玩家查看、踢出指令、服务器封禁与解封。
- 管理员、封禁、白名单授权和最近注册恢复为单列列表；玩家名称完整换行显示，状态、SteamID64、时间和操作分区展示，不需要横向滚动。
- 新增管理员、新增封禁、手动添加白名单、添加服务器改为 Modal 弹窗，不再在当前页面展开表单。
- 新增通用 Modal、确认弹窗、Toast、Tooltip、Alert 组合；管理操作反馈使用 Toast，危险操作使用确认弹窗。
- 管理面板导航新增论坛管理和服务器管理。
- 管理面板表单改为弹窗后，页面默认只展示列表；弹窗支持遮罩、Esc/关闭按钮和移动端滚动。
- 新增封禁管理：临时/永久封禁、封禁记录、解封；封禁立即撤销网站会话并阻止登录。
- 新增白名单审核：服务器白名单开关、玩家申请、通过/拒绝、手动授权、移除授权；用户中心提供白名单申请表单。
- 服务器 API 与卡片新增 `requiresWhitelist` 标记。
- 顶部导航改为“使用Steam登录”，登录后显示当前 Steam 用户。
- 顶部导航的“管理面板”入口只对 `admin` 角色显示；匿名用户与普通成员不可见。
- `/admin` 布局在服务端再次校验：匿名访问重定向到 `/account`，普通成员重定向到首页；管理员 API 仍返回 401/403。
- 管理面板导航改为“概览 / 管理员 / 封禁管理 / 白名单审核”，并增加当前管理员信息；删除重复的“服务状态”入口。
- 删除运营概览中的独立服务状态区块与前端系统状态组件，统计信息保留在运营概览。
- 服务器卡片/列表、论坛、用户中心与管理面板改为读取 API/PostgreSQL 数据；空库显示空状态。
- 新增 `apps/web/src/services/content.ts` 类型化内容 API 客户端。
- 新增 OpenAPI 路径：auth、servers、forum、community、account、admin。
- 新增 HTTP 合约测试：Steam 登录重定向、匿名 `/auth/me`、未登录 `/account` 返回 401。
- 新增官方新手指南主题，说明进入 KZ 服务器、常见拦截原因、白名单申请模板与审核说明。
- 论坛“新手指南”卡片的按钮改为“查看教学”，跳转 `/forum/topic/new-player-guide`。
- 新增 `users.is_system`，官方系统账号不参与成员数、角色分布、最近注册与活跃统计。
- 新增开发环境外部 PostgreSQL/Redis 配置说明；生产仍使用 Compose 内 PostgreSQL/Redis。
- 新增 `ThRei_Players` SourceMod 插件（源码、已编译 `smx`、配置示例与安装文档），主动上报服务器 `hostname`、地图、人数上限与 SteamID64 在线玩家。
- 插件上报中的 `name`（服务器 `hostname`）会自动更新服务器目录显示名称；`POST /api/v1/plugin/report` 的 `name` 字段可选，旧版插件和空名称不会覆盖现有名称。
- 新增社区组管理：管理面板 `/admin/communities` 可创建、重命名、删除社区组，并在组内添加或移出
  服务器实例；一个实例最多属于一个组。服务器目录显示社区组标签并支持按组筛选。
- 新增 `server_communities` 表与 `servers.community_id` 外键，迁移
  `20261025130000_server_communities.sql` 会把原有自由文本 `servers.community` 自动转换为社区组并回填。
- 新增管理员接口：`GET/POST /admin/server-communities`、`PATCH/DELETE /admin/server-communities/{id}`、
  `POST /admin/server-communities/{id}/servers`、`DELETE /admin/server-communities/{id}/servers/{serverId}`。
- `ThRei_Players` 1.3.0 支持一主机多实例且只使用一份 `cfg/sourcemod/threi_players.cfg`：
  每个实例写一行 `sm_threi_instance <hostport> "<令牌>"`，插件按自身 `hostport` 选择令牌；
  上报请求可省略 `serverId`，API 根据唯一令牌定位服务器。任意有效实例行存在时不再使用
  `sm_threi_server_id` / `sm_threi_token`；端口无匹配行时跳过上报，避免写错服务器。
  该设计取代 1.2.0 的每端口 `threi_players_<hostport>.cfg` 方案。
- `ThRei_Players` 1.4.0 新增白名单与服务器封禁同步：每 `sm_threi_access_interval`（默认 30 秒）
  获取一次纯文本访问快照，在玩家连接完成时拦截，并在每次刷新后复查在线玩家。服务器未开启
  `requires_whitelist` 时只执行封禁；临时封禁带到期时间，过期或解封后自动恢复放行。
- 新增网站踢出/封禁执行：插件轮询 `GET /api/v1/plugin/actions`，执行后向
  `POST /api/v1/plugin/actions/{id}/ack` 确认。解封会同时取消尚未执行的封禁指令；过期封禁不会
  执行但会确认，避免队列反复下发。白名单、踢出和封禁都不依赖 RCON。
- 新增 `GET /api/v1/plugin/access-snapshot`：返回 `requires_whitelist`、白名单与带到期 Unix
  时间戳的封禁原因，使用与上报相同的每服务器令牌。
- 新增可选的 RCON 空服存活探测：仅对插件上报已过期且管理员设置了 RCON 密码的服务器发送
  `status`，空服标记为 `hibernating`、有玩家标记为 `online`，连续 3 次失败才标记 `offline`。
  RCON 密码通过 `PUT/DELETE /admin/servers/{id}/rcon-password` 管理，只写不读。
- 服务器状态新增 `hibernating`，前端状态徽章与「加入游戏」按钮支持该状态；`offline` 与
  `hibernating` 都允许用户打开连接对话框。
- 管理面板服务器卡片新增 RCON 配置弹窗、`RCON 兜底` / 探测失败徽章、待执行指令数，并提示
  踢出/封禁指令已入队，由插件在一个轮询间隔内执行。
- 新增 `POST /api/v1/plugin/report` 与每服务器插件令牌；管理面板支持生成、读取、轮换和撤销令牌。
- 管理面板服务器卡片新增 `pluginState`（`disabled` / `waiting` / `connected`）与最近上报时间，玩家列表显示 SteamID64。
- 新增 90 秒未上报自动离线和在线名单清理任务。
- 新增 `STEAM_COMMUNITY_BASE_URL`：API 主机的 Steam OpenID 校验与资料查询可走
  Cloudflare Worker 中继；新增 `deploy/cloudflare/steam-relay-worker.js`。
  浏览器登录跳转不受影响，仍需客户端能访问 Steam。
- 新增 `STEAM_COMMUNITY_IP`：API 可直连指定的 Steam 边缘 IP，使用完全限定名
  `steamcommunity.com.` 作为 SNI 并仍按 `steamcommunity.com` 校验证书；适用于大陆主机
  重置 `steamcommunity.com` TLS 连接的网络。资料查询失败时回退到
  `STEAM_COMMUNITY_BASE_URL`，OpenID `check_authentication` 不重放。
- 新增一次性管理员登录链接：`GET /api/v1/auth/magic` 与 `services/api/src/bin/magic-link.rs`。
  运维可在 API 容器内生成 10 分钟有效、单次使用的管理员会话令牌，用于 Steam 不可用时
  进入管理面板。令牌只保存哈希，兑换后删除。

### Changed

- 管理面板“添加服务器”简化为只填 Host/IP 与端口：服务器 ID 自动生成（`srv-` + 12 位十六进制），
  名称默认 `host:port`，地图、地区、状态等使用默认值；添加成功后自动打开「插件配置」引导生成令牌。
  `POST /admin/servers` 仅 `host`、`port` 必填，其余字段可选，成功返回 `201 { "id": "..." }`。
  新增可选 `communityId` 字段；`PATCH /admin/servers/{id}/community` 改为接收 `communityId`。
  为兼容升级前已加载的页面，两个接口仍接受旧 `community` 组名并按名称匹配已有社区组。
- `POST /api/v1/plugin/report` 的 `serverId` 改为可选：省略时按唯一插件令牌匹配服务器，
  提供时仍须与令牌一致。新增迁移 `20261025120000_server_community.sql`。
- 服务器目录的「加入游戏」按钮不再因 `offline` 状态禁用：离线只表示 90 秒内没有收到
  插件上报，服务器可能仍在运行（例如空服休眠），用户仍可打开连接对话框尝试加入；
  对话框会显示状态说明。`maintenance` 仍保持禁用并显示「维护中」。
- 生产环境服务端 Steam 请求改为 Cloudflare Worker 中继 `steam.threi.online`
  （`steam-relay-worker.js` + `wrangler.toml`）；直连边缘 IP 保留为备选方案。
- 前端删除所有模拟数据模块：`features/forum/data`、`features/account/data`、`features/admin/data`。
- 删除 12 个模拟服务器、模拟玩家头像/昵称、模拟主题/回复、模拟运营指标和未鉴权管理面板内容。
- 删除 12 张不再使用的 KZ 地图 SVG；服务器地图图片改由数据库 `servers.map_image` 提供。
- 用户中心重写为当前 Steam 用户资料、真实主题/回复/收藏统计与最近活动。
- 管理面板重写为真实统计、角色分布、最近会员、最近主题、7 天活动和服务器节点。
- 首页/服务器页/论坛页/分类页/主题详情页改为动态读取 API。
- 登录 CTA 与首页/用户中心/管理面板的登录入口统一使用 Steam OpenID。
- 服务器实时状态改为由游戏服务器插件上报；移除 API 的 A2S 轮询和
  `SERVER_MONITOR_ENABLED`、`SERVER_POLL_INTERVAL_SECS`、`SERVER_QUERY_TIMEOUT_SECS`。
  RCON 之后仅以可选的 `status` 存活探测重新引入，不提供任意命令执行。
- `servers.last_queried_at` 重命名为 `last_reported_at`；移除旧轮询字段
  `servers.query_error`。原 `servers.rcon_password` 被删除后，迁移
  `20261025140000_server_access_and_hibernation.sql` 以只写凭据的形式重新加入，并新增
  `last_rcon_at` 与 `rcon_failures`。
- 有插件令牌但超过 90 秒未上报的服务器：未设置 RCON 密码时仍由清理任务标记 `offline`；
  设置密码且启用 `HIBERNATION_POLL_ENABLED` 时交给 RCON 探测，不再被清理任务直接判离线。
- `server_players` 移除匿名槽位与来源列，`steam_id64` 恢复为非空；升级后旧轮询快照会被清空，服务器保持离线直到插件首次上报。
- 新服务器默认状态改为离线，等待插件上报后转为在线；`maintenance` 状态不会被插件覆盖。
- Compose 增加 `WEB_URL`、`STEAM_RETURN_URL`、`STEAM_REALM`、`COOKIE_SECURE`、`SESSION_TTL_DAYS`、`ADMIN_STEAM_IDS`。
- `WEB_URL` 在生产环境必填，避免回调错误指向 localhost。
- `ADMIN_STEAM_IDS` 只用于首次创建/引导管理员；登录不会覆盖管理面板中已修改的数据库角色。
- 开发环境 Steam 回调 origin 改为浏览器实际访问的局域网地址；`127.0.0.1` 只适用于浏览器与开发服务器在同一台机器的情况。
- Steam 头像远程域名新增 `avatars.fastly.steamstatic.com`。

### Removed

- 移除前端模拟数据与“预览数据”声明。
- 移除未使用的 `apps/web/public/images/servers/*.svg`。
- 移除模拟通知、徽章、审核队列、审计日志、系统设置等未接入真实数据的管理面板模块。
- 移除 A2S 查询、通用 RCON 客户端、后台全量轮询任务与 `POST /admin/servers/{id}/query`。
  1.4.0 仅重新加入只发送 `status` 的最小 RCON 存活探测和只写 RCON 密码接口，不恢复任意命令执行。

### Fixed

- 修复 Source RCON 数据包大小字段错误包含 4 字节长度前缀的问题：真实服务器会等待不存在的
  后续字节，导致存活探测超时。大小字段现只统计 id、type、body 与两个结尾 NUL，并新增会发送
  空 `RESPONSE_VALUE` 信封的集成测试。
- 修复无待执行指令时无效插件令牌访问 `/api/v1/plugin/actions` 返回 200 空响应的问题；
  `actions` 与 `ack` 现在都先校验令牌，无效或缺失令牌统一返回 401。
- 修复 `ThRei_Players` 将 `User-Agent` 作为自定义请求头导致 Steamworks
  `SetHTTPRequestHeaderValue` 返回 false、插件始终无法上报的问题。插件改为使用 Steam 自带的
  User-Agent，并在请求配置失败时记录具体步骤；版本升至 1.1.1。
- 修复用户中心横幅中用户名与封面重叠、被深色背景遮挡的问题。
- 修复服务器卡片在无地图图片时的空白封面。
- 修复服务器延迟未知时的显示。
- 修复论坛作者角色显示英文 `admin` / `member` 的问题，统一显示中文角色名。
- 修复教程正文单换行被折叠成一段的问题，保留步骤换行。
- 移除运营概览中的“真实数据 / 页面数据来自 PostgreSQL”提示卡片。
- 修复管理面板宽表格在 1440 和移动端被截断/页面横向溢出的问题，表单在窄屏改为紧凑网格布局。
- 修复管理面板客户端组件使用相对时间导致 React hydration text mismatch 的问题，客户端时间改为稳定绝对时间。
- 移除关闭按钮的自定义 Tooltip，改用原生 title，修复悬停时元素被弹窗边缘裁切的问题。
- 修复新增封禁弹窗中存在正文和底部两个提交按钮的问题。
- 管理员/封禁/白名单列表在 390px 宽度下改为单列换行，不再出现页面级横向滚动或名称截断。

### Security

- Steam 断言必须经过 Steam OpenID `check_authentication` 验证后才会被信任。
- 会话令牌只保存哈希；Cookie 为 HttpOnly、SameSite=Lax，生产环境使用 Secure。
- 插件上报、访问快照、指令轮询与确认均使用每服务器独立令牌；令牌不出现在服务器列表、公开接口
  和日志中，错误令牌统一返回 401。踢出/封禁原因会压平控制字符并限制长度，防止注入协议行。
- RCON 密码只能由管理员写入或删除，任何接口都不会返回原文，也不会写入日志；RCON 客户端只会
  发送 `status`。白名单、踢出和封禁不经过 RCON。
- 会话 Cookie 有效期可配置；登出删除数据库会话并清除 Cookie。
- `/account` 需要登录，管理员 API 需要 `admin` 角色。
- 尚未实现登录限流、CSRF、细粒度 RBAC、审核与审计；当前没有写业务接口。
- 生产环境仍需 HTTPS；回调地址必须与公开 origin 一致。
- magic link 是应急通道：链接等同于管理员凭证，只能通过安全渠道交给目标管理员；
  Nginx 访问日志可能记录 `token` 查询参数。不要在生产启用 `STEAM_SKIP_OPENID_VERIFICATION`。

### Compatibility / Upgrade Notes

- 新增迁移 `20261023230000_real_content_and_steam_auth.sql`、`20261023233000_seed_new_player_guide.sql`、`20261023235000_admin_moderation_whitelist.sql` 与 `20261024010000_forum_server_moderation.sql`，部署时必须先运行 `migrate`。
- 本里程碑另新增 `20261025060000_server_live_polling.sql`、`20261025070000_server_plugin_reports.sql`、
  `20261025120000_server_community.sql`、`20261025130000_server_communities.sql` 与
  `20261025140000_server_access_and_hibernation.sql`。最后一项扩展服务器状态约束以允许
  `hibernating`，加入只写 `rcon_password`、`last_rcon_at`、`rcon_failures` 及长度/范围约束。
- 升级 API 后必须同时升级 `ThRei_Players` 到 1.4.0 才能让白名单、踢出和封禁在游戏内生效；
  旧插件仍可上报状态，但不会执行访问控制或指令。插件配置新增访问/指令轮询开关和提示文案，
  不配置时使用默认值。RCON 密码是可选配置，不设置也能正常使用全部白名单与封禁功能。
- 新迁移新增 `users.is_system`、`users.is_disabled`、`servers.requires_whitelist`、`bans`、`whitelist_applications`、`server_whitelist`、`forum_mutes`、`server_bans`、`server_actions`、`server_communities`；不会创建模拟服务器或模拟玩家。
- 数据库预置 5 个论坛分类、1 个系统账号和 1 篇官方新手指南；不会创建模拟服务器、模拟玩家或模拟讨论。
- 需要在环境变量中设置 `WEB_URL`、`STEAM_RETURN_URL`、`STEAM_REALM`；生产必须 HTTPS。
- 大陆主机若无法直连 Steam，可设置 `STEAM_COMMUNITY_IP`（直连）或
  `STEAM_COMMUNITY_BASE_URL`（Worker 中继），二者可只配其一。修改后需重建 API 容器。
- 首次登录后从用户中心获取 SteamID64，再加入 `ADMIN_STEAM_IDS` 并重新登录以获得管理员角色。
- 开发环境可使用局域网 PostgreSQL/Redis；连接信息仅保存在本地 `.env`，不得提交。
- 如果浏览器从另一台机器访问，必须使用开发机的局域网 IP（当前为 `192.168.0.101:3100`）并让 `WEB_URL` / `STEAM_RETURN_URL` 使用同一 origin，否则 Steam 回调会指向浏览器自己的 `127.0.0.1`。
- 真实 Steam 授权需要人工在浏览器完成；自动化只验证了重定向、回调和会话边界。

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
