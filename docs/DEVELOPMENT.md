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

## 2026年10月23日 22时14分11秒 服务器卡片改为三列错落卡片墙

### 背景

用户认为上一版的双列卡片“特别丑、比例不好”，要求重新设计；随后确认单列横向展示卡“不叫卡片排列，叫做列表排列”，需要继续改回真正的卡片排列。

上一记录 `2026年10月23日 21时57分29秒 服务器玩家头像展示与 hero 文案调整` 中“服务器目录取消三列卡片、统一两列”的布局描述，已被本次三列卡片墙取代；旧记录保留用于追溯。

### 变更内容

#### 1. 卡片视图改为三列错落卡片墙

- 服务器目录卡片视图从单列横向展示卡改为多列卡片墙：
  - 1280px 及以上：3 列；
  - 768–1279px：2 列；
  - 手机：1 列。
- 使用 `useSyncExternalStore` 订阅 `matchMedia`，在 1/2/3 列之间切换；服务端快照固定为 3 列，避免首屏布局不确定。
- 卡片按列分配，而不是使用 CSS `columns` 的列优先顺序：每列独立纵向排列，首行按服务器顺序显示，避免出现首行跳号。
- 卡片使用自然高度，不再为了同行等高而把玩家面板拉满；少人数服务器不会出现大面积空白。
- 每张卡片内部的地图、玩家面板、地址和操作区保持完整结构；按钮仍在卡片底部对齐。

#### 2. 卡片比例与玩家布局

- `ServerCard` 地图头图从 `16:7` 调整为 `16:9`，让 3 列宽度下的卡片头部不再过扁。
- 玩家头像列表固定两列，避免在 3 列卡片中因内部三列过窄导致昵称换行。
- 所有在线玩家头像与昵称仍然完整展示，不省略、不使用“+N”。
- 首页推荐服务器仍使用现有卡片网格；地图头图比例同步为 `16:9`。
- 删除上一版临时使用的 `server-showcase-card.tsx`，卡片视图重新使用统一的 `ServerCard`。

#### 3. 列表视图保持不变

- 列表仍使用 `ServerListRow`，显示地图缩略图、描述、玩家头像与昵称、地址和操作按钮。
- 卡片墙按内容高度排列，因此同行卡片底部不再强制对齐；这是为了避免少人数服务器出现大块空白。
- 每张卡片内部的“复制地址/加入游戏”按钮仍保持同一行、同一高度。

### 涉及文件

- `apps/web/src/features/servers/components/server-directory.tsx`
- `apps/web/src/features/servers/components/server-card.tsx`
- `apps/web/src/features/servers/components/player-roster.tsx`
- `apps/web/src/features/servers/components/server-showcase-card.tsx`（删除）
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/DEVELOPMENT.md`（本记录）

### 数据库与 API 变化

- 无数据库迁移、Rust API 或 OpenAPI 契约变化。
- 服务器、玩家头像、昵称和在线状态仍为前端模拟数据，刷新不会持久化，也不代表真实服务器或 Steam 账号。
- 服务器地址继续使用保留域名 `*.threi.example`，不会连接真实 CS:GO 服务器。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 6 项、HTTP 契约测试 10 项，共 16 项通过；
  - TypeScript、ESLint、Prettier 全部通过。
- `npm run build`：通过，静态生成 24 个页面/路由。
- Playwright 无头 Chromium 验证：
  - 1920 / 1440 / 1280 宽度下为 3 列，卡片宽度均为约 352px；
  - 1024 / 768 宽度下为 2 列，390 宽度下为 1 列；
  - 首行卡片顶部坐标一致且列位置不同，第二张卡片从第一列继续纵向排列；
  - 12 个服务器卡片均渲染，Beginner 显示 9 个玩家头像，Hardcore 显示 28 个；
  - 抽查 Beginner / Hardcore 卡片，复制/加入按钮高度均为 36px，顶部坐标一致；
  - 所有测试宽度无横向溢出；
  - 列表视图仍显示 12 个服务器和 28 个 Hardcore 玩家头像；
  - 首页玩家头像正常渲染；
  - `/`、`/servers`、`/forum`、`/forum/maps`、`/forum/topic/season-three-rush`、`/account`、`/admin` 均返回 200；
  - 复制地址和加入游戏弹窗验证通过，console/pageerror 无错误。
- 未执行：Docker 镜像构建、容器启动、`nginx -t`、HTTPS 验证（本机无 Docker daemon）；未连接真实 CS:GO 服务器验证。


---

## 2026年10月23日 21时57分29秒 服务器玩家头像展示与 hero 文案调整

### 背景

用户认为首页标题“在 ThRei 的 KZ 世界里，和朋友们一起起跳、连跳、刷新记录。”和服务器页标题“找到你的 KZ 服务器，从一次起跳开始。”语气过于中二、煽情，需要改成更平实的表述。

同时，服务器目录目前只显示玩家昵称，用户希望在玩家名称旁同时显示头像，并要求重新规划玩家列表的布局；头像和名称先使用模拟数据。

### 变更内容

#### 1. 首页与服务器页文案收敛

- 首页 hero 标题从“在 ThRei 的 KZ 世界里……刷新记录”改为：
  - “一个专注 KZ 的社区，”
  - “找服务器，记录成绩。”
- 首页说明改为介绍服务器、地图和玩家记录，并提示可以到论坛交流路线与技巧。
- 首页特色服务器在线栏从“正在热身”改为“当前有 N 位玩家在线”，并展示玩家头像。
- 服务器页 hero 标题从“找到你的 KZ 服务器，从一次起跳开始。”改为：
  - “KZ 服务器目录”
  - “地图、玩家与地址。”
- 服务器页说明改为介绍新手、连跳、长跳和进阶服务器，以及查看玩家、复制地址和启动 CS:GO 的操作。
- 服务器页 metadata、目录区标题“选择 KZ 服务器”、统计文案“在线，分布在 12 个服务器”同步改为平实表述。
- 首页服务器推荐区标题改为“推荐 KZ 服务器”。

#### 2. 玩家模拟头像数据

- 新增 `KzPlayer` 接口，包含 `name` 和 `avatar` 字段；`KzServer.players` 从 `string[]` 改为 `KzPlayer[]`。
- 保留 40 个模拟玩家昵称，新增 20 组本地 Tailwind 渐变色板，按玩家顺序生成稳定的模拟字母头像。
- 同一玩家在不同服务器中复用同一头像；不依赖外部图片服务，也不代表真实 Steam 头像。
- 服务器搜索同步改为读取 `player.name`，仍可按玩家昵称查找服务器。

#### 3. 玩家头像与昵称布局

- 新增 `PlayerRoster` 组件，统一卡片、列表和首页在线栏的玩家展示。
- 每个玩家条目包含：
  - `UserAvatar` 小型渐变字母头像；
  - 完整玩家昵称；
  - `title` 提示和 `data-player-name` / `data-player-avatar` 属性，便于测试与后续替换。
- 卡片视图使用两列或三列网格，根据卡片宽度切换；列表视图使用带边框的横向玩家标签。
- 玩家昵称不截断、不使用“+N”隐藏，长昵称自动换行。
- 首页特色服务器在线栏复用列表变体，头像与昵称一起展示。
- 服务器卡片数量较多时，玩家面板继续使用 `flex-1` 填充并在底部显示剩余空位，保持“复制地址/加入游戏”按钮对齐。

#### 4. 卡片宽度与响应式调整

- 服务器目录取消 1920 宽度下的三列卡片，统一最多两列，避免玩家头像和昵称被压缩。
- 首页特色服务器卡片在紧凑模式下使用两列玩家头像布局，避免三列卡片中的昵称换行过多。
- 1920、1440、1024、768 和 390 宽度下验证无横向溢出，玩家名称完整显示，按钮仍对齐。

### 涉及文件

- `apps/web/src/components/shared/user-avatar.tsx`
- `apps/web/src/features/servers/data/servers.ts`
- `apps/web/src/features/servers/components/player-roster.tsx`（新增）
- `apps/web/src/features/servers/components/server-card.tsx`
- `apps/web/src/features/servers/components/server-list-row.tsx`
- `apps/web/src/features/servers/components/server-directory.tsx`
- `apps/web/src/app/(site)/page.tsx`
- `apps/web/src/app/(servers)/servers/page.tsx`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/DEVELOPMENT.md`（本记录）

### 数据库与 API 变化

- 无数据库迁移、Rust API 或 OpenAPI 契约变化。
- 玩家头像、昵称和在线状态仍为前端模拟数据，刷新不会持久化，也不代表真实服务器或 Steam 账号。
- 服务器地址继续使用保留域名 `*.threi.example`，不会连接真实 CS:GO 服务器。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 6 项、HTTP 契约测试 10 项，共 16 项通过；
  - TypeScript、ESLint、Prettier 全部通过。
- `npm run build`：通过，静态生成 24 个页面/路由。
- Playwright 无头 Chromium 验证：
  - `/servers` 渲染 12 个服务器卡片；
  - `KZ | Beginner` 显示 9 个玩家头像和昵称，`KZ | Hardcore` 显示 28 个，名称完整；
  - 列表视图同样显示 9 / 28 个头像和昵称；
  - 首页在线栏和特色服务器共渲染 48 个玩家头像条目；
  - 搜索玩家 `n0va` 返回 2 个服务器，`LongJumpLarry` 也能命中；
  - 1920、1440、1024、768 宽度下卡片底边和“复制地址/加入游戏”按钮坐标一致，按钮高度均为 36px，无横向溢出；
  - 390 宽度下无横向溢出，玩家头像和昵称完整，按钮高度和顶部坐标一致；
  - 所有检查页面返回 200，浏览器 console 与 pageerror 均无错误。
- 未执行：Docker 镜像构建、容器启动、`nginx -t`、HTTPS 验证（本机无 Docker daemon）；未连接真实 CS:GO 服务器验证头像或玩家状态。


---

## 2026年10月23日 21时37分32秒 站点主题切换为 CS:GO KZ 与服务器目录扩展

### 背景

用户确认网站的设计与样式搭配可以保留，但内容主题错误：站点实际是 Minecraft 社区，需要整体改为 **CS:GO 的 KZ 模式**。同时提出两点界面要求：

1. 服务器数量可能达到 10–30 个，服务器目录需要能承载这个规模，并且每个服务器的**全部在线玩家名称**都要显示；
2. 修复服务器卡片中“复制地址”和“加入游戏”按钮与其他卡片未对齐的问题。

上一记录 `2026年10月23日 20时52分04秒 服务器页面与全站模拟内容上线预览` 中关于 3 个 Minecraft 服务器、三张旧地图和 Minecraft Java 版加入步骤的描述，已被本记录中的 12 个 CS:GO KZ 服务器与 Steam/控制台连接方式取代；旧记录保留用于追溯。

### 变更内容

#### 1. 全站从 Minecraft 切换为 CS:GO KZ

- 官网首页 hero、服务器推荐、论坛动态、社区数据与 CTA 改为 KZ 语境；
- 论坛分类改为公告与活动、综合讨论、地图与记录、技巧与教学、帮助与反馈；
- 8 个论坛主题、回复、作者角色与站内链接全部改为 KZ 地图、连跳、长跳、计时赛和新手绑定等主题；
- 用户中心 bio、最近活动、通知、徽章、收藏服务器与 Steam 账号标签改为 KZ 内容；
- 管理面板角色、审核队列、审计日志、最近主题和服务器节点说明改为 KZ 运营语境；
- 站点描述、manifest、页脚、README、架构文档与 CHANGELOG 同步更新；
- 删除旧 Minecraft 服务器地图 SVG 和无用的 `player-avatar.tsx`。

#### 2. 服务器目录扩展到 12 个 KZ 服务器

- 重写 `features/servers/data/servers.ts`，新增 `KzServer` 数据模型：服务器名、地图、描述、状态、IP、端口、区域、tickrate、人数上限、延迟、标签、完整在线玩家数组和地图预览图；
- 新增 12 个 KZ 服务器，人数上限均为 32，在线玩家共 184 人；每个服务器提供独立的 IP:PORT 与地图；
- 在线玩家使用 `string[]` 保存，卡片和列表都渲染全部名称，不使用省略号或“+N”隐藏；
- 新增 12 张本地 KZ 地图预览 SVG，放在 `apps/web/public/images/servers/`；
- 新增服务器搜索：可按服务器名、地图、地区、描述、标签或在线玩家昵称过滤；
- 服务器卡片视图使用 `md:grid-cols-2 2xl:grid-cols-3`，列表视图纵向堆叠，适配 10–30 个服务器的规模；
- 列表行展示缩略图、描述、tickrate、延迟、完整玩家标签、地址和操作按钮；
- “加入游戏”弹窗改为 CS:GO：提供 `steam://connect/IP:PORT` 入口、控制台 `connect IP:PORT` 命令和三步加入说明；
- 服务器页 hero 展示特色服务器背景、在线人数/容量/tickrate/服务器数统计，并保留三步进入指南与用户中心 CTA。

#### 3. 修复卡片按钮对齐

- 卡片使用 `flex h-full flex-col` 结构，操作区使用 `mt-auto` 固定在内容底部；
- 地址框与两个按钮放在同一个底部操作区，按钮使用 `grid grid-cols-2 gap-2` 等宽排列；
- “复制地址”和“加入游戏”统一为默认尺寸（36px 高），避免顶部对齐但底部错位；
- 列表行操作列使用 `lg:justify-between`，地址在上、按钮在下；
- 在线人数较少的卡片让玩家面板 `flex-1` 填充剩余高度，并在底部显示“还有 N 个空位 / 复制地址加入”，避免按钮对齐后留下无意义空白；
- 在 1920、1440、1024、768 和 390 宽度下验证同行卡片底边、复制/加入按钮的 y 坐标与高度一致。

#### 4. 响应式标题修正

- 首页和服务器页 hero 标题改为显式分行，避免中文词在窄屏被拆开；
- 首页标题字号调整为 `text-3xl sm:text-4xl md:text-5xl lg:text-6xl`，390px 宽度下不再出现“服务/器”或“起/跳”跨行断裂；
- 服务器页标题缩短为“找到你的 KZ 服务器，从一次起跳开始。”。

### 涉及文件

- 服务器数据与组件：
  - `apps/web/src/features/servers/data/servers.ts`
  - `apps/web/src/features/servers/components/server-card.tsx`
  - `apps/web/src/features/servers/components/server-list-row.tsx`
  - `apps/web/src/features/servers/components/server-directory.tsx`
  - `apps/web/src/features/servers/components/join-server-button.tsx`
  - 删除 `apps/web/src/features/servers/components/player-avatar.tsx`
- 服务器页面与素材：
  - `apps/web/src/app/(servers)/servers/page.tsx`
  - `apps/web/public/images/servers/kz-{beginner,bhop-city,longjump-lab,hardcore,climb-alpha,skyline,neon,frost,dune,void,marble,aztec}.svg`
  - 删除 `elysium-valley.svg`、`aether-workshop.svg`、`ember-arena.svg`
- 全站内容：
  - `apps/web/src/app/(site)/page.tsx`
  - `apps/web/src/app/(forum)/forum/page.tsx`
  - `apps/web/src/features/forum/data/forum.ts`
  - `apps/web/src/features/forum/components/forum-category-icon.tsx`
  - `apps/web/src/features/account/data/account.ts`
  - `apps/web/src/app/(account)/account/page.tsx`
  - `apps/web/src/features/admin/data/dashboard.ts`
  - `apps/web/src/app/(admin)/admin/page.tsx`
  - `apps/web/src/lib/site-config.ts`
  - `apps/web/src/app/manifest.ts`
  - `apps/web/src/components/layout/site-footer.tsx`
- 文档：
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CHANGELOG.md`
  - `docs/DEVELOPMENT.md`（本记录）

### 数据库与 API 变化

- 无数据库结构或迁移变更。
- 无 Rust API 路由、请求/响应结构或 OpenAPI 契约变更。
- 服务器目录、论坛、用户中心和管理面板仍使用前端静态预览数据；刷新不会保存修改，也不代表真实服务器状态。
- 服务器地址继续使用保留域名 `*.threi.example`，不会连接真实 CS:GO 服务器。
- `/admin` 仍未接入鉴权，生产环境不得公开。

### 测试与结果

- `./scripts/check.sh`：通过。
  - Rust 单元测试 6 项、HTTP 契约测试 10 项，共 16 项通过；
  - TypeScript `tsc --noEmit` 通过；
  - ESLint `--max-warnings=0` 通过；
  - Prettier `--check` 通过。
- `npm run build`：通过，静态生成 24 个页面/路由；`/servers` 单页渲染 12 个服务器卡片，同时生成 5 个论坛分类页和 8 个论坛主题页。
- Playwright 无头 Chromium 验证：
  - `/servers` 默认卡片视图渲染 12 个服务器；
  - `KZ | Beginner` 显示 9 个玩家，`KZ | Hardcore` 显示 28 个玩家，未隐藏任何名称；
  - 搜索 `kz_hardcore` 返回 1 个结果，清空后恢复 12 个；列表视图显示 12 个服务器和 28 个 Hardcore 玩家；
  - 视图切换后刷新页面仍保持列表模式，`localStorage` 值为 `list`；
  - 复制结果为 `kz01.threi.example:27015`；
  - 加入弹窗可见，Steam 链接为 `steam://connect/kz01.threi.example:27015`；
  - 1920、1440、1024、768 宽度下，同行卡片底边一致，复制/加入按钮 y 坐标一致且高度均为 36px；
  - 390 宽度下无横向溢出，玩家列表完整，复制/加入按钮高度均为 36px 且顶部对齐；
  - `/`、`/forum`、`/forum/maps`、`/forum/topic/season-three-rush`、`/forum?q=长跳`、`/account`、`/admin` 均返回 200；
  - 浏览器 console 与 pageerror 均无错误。
- 未执行：Docker 镜像构建、容器启动、`nginx -t`、HTTPS 与生产反向代理验证（本机无 Docker daemon）；未连接真实 CS:GO 服务器验证连接与 KZ 插件行为。


---

## 2026年10月23日 20时52分04秒 服务器页面与全站模拟内容上线预览

### 背景

用户希望在顶部导航增加服务器功能页，展示当前服务器人数、IP/PORT、地图与地图图片、在线玩家名称和人数上限；提供卡片/列表两种显示模式（默认卡片），并在合适位置提供复制 IP:PORT 和加入游戏按钮。同时，官网、论坛、用户中心和管理面板不应继续展示架构原则或“模块骨架”，而应替换为模拟开发环境数据，以便预览上线后的实际观感。

本次全部为前端展示层和本地模拟数据，不接入真实服务器状态，也不改变数据库或 API 契约。页面中的服务器地址使用保留域名 `*.threi.example`，不会连接真实服务器。

### 变更内容

#### 1. 服务器模块与 `/servers`

- 新增 `src/features/servers` 数据与组件：
  - 3 个模拟服务器：Elysium Valley（长期生存）、Aether Workshop（自由创造）、Ember Arena（竞技与活动）；
  - 每个服务器包含 IP、PORT、地图、版本、区域、延迟、在线人数、人数上限和在线玩家样例；
  - 玩家列表显示头像色块、名称、角色，并标注“显示 N / 总在线人数”。
- 新增三张本地地图预览 SVG：Elysium Valley、Aether Workshop、Ember Arena，放在 `public/images/servers/`。
- 新增 `(servers)` route group 和 `/servers` 页面，顶部导航、页脚、sitemap 同步加入服务器入口。
- 新增卡片/列表显示切换：
  - 默认卡片模式；
  - 使用 `useSyncExternalStore` 读取 `localStorage`，避免 effect 内同步 setState；
  - 用户选择在下一次访问时保留。
- 新增“复制地址”按钮：
  - 复制完整 `IP:PORT`；
  - 优先使用 `navigator.clipboard`，提供旧浏览器降级；
  - 复制成功后显示“已复制”，并通过 `aria-live` 通知辅助技术。
- 新增“加入游戏”按钮：
  - 打开原生 `<dialog>`，展示服务器信息、完整地址、复制按钮和 Minecraft Java 版加入步骤；
  - 支持关闭按钮、点击遮罩关闭和 Escape 关闭。
- 服务器卡片和列表模式均完整展示 IP:PORT，不再截断；复制与加入按钮在卡片中并排展示。
- 修正服务器卡片/列表的响应式布局，移动端 390px 宽度下地址和按钮仍可正常显示。

#### 2. 官网首页

- 移除架构原则、数据流、技术栈清单和安全规划说明。
- 新首页包含：
  - 服务器地图背景 Hero、第三赛季公告入口、在线玩家与社区统计；
  - 三个服务器的快捷卡片（含地图、人数、地址、复制和加入按钮）；
  - 最新论坛主题、公告与活动、社区数据；
  - 服务器长期开放 CTA 和加入引导。
- 页脚增加“预览环境：服务器状态、论坛内容与用户资料均为模拟数据”说明。

#### 3. 论坛

- 新增论坛模拟数据：5 个分类、8 个主题、作者/角色/标签/浏览数/回复和详细回复内容。
- 论坛首页改为分类卡片、最新讨论、社区概览、最近活跃成员和新手指南侧栏。
- 搜索支持按标题、摘要、标签、作者和分类名过滤本地模拟主题，并显示结果数量与空状态。
- 分类页展示分类信息、主题列表、其他分类与服务器入口。
- 帖子详情页展示完整正文、标签、作者、浏览/回复统计和逐条回复；未知分类/帖子返回真正 404。
- 新增服务器状态卡片填充分类网格，更新搜索框占位文案。

#### 4. 用户中心

- 使用模拟用户“星野”替换骨架内容：头像、角色、简介、加入时间、地区、资料完整度。
- 增加主题/回复/游戏时长/社区贡献统计，最近活动、我的主题、通知、徽章、账号安全和收藏服务器。
- 修正横幅欢迎文字被头像遮挡的问题。

#### 5. 管理面板

- 移除“后续业务模块边界”和开发占位说明，替换为完整模拟运营面板：
  - 注册成员、今日活跃、主题总数、待审核内容统计；
  - 最近 7 天在线/新主题柱状图、角色分布；
  - 最近注册用户、最近主题、审核队列、管理操作审计；
  - 系统设置摘要、平台服务状态、服务器节点状态。
- 管理侧边栏改为指向页面内各区块的锚点链接，移除“待实现”徽章。
- 保留“演示数据”标识和未接入认证/权限的安全提示。
- 平台服务卡片改为更产品化的“平台服务”文案，同时保留真实 API 连通性检查。
- 修正 `CardHeader` 布局错位、设置卡片多余空白和移动端导航。

#### 6. 文案与资源

- 修正全局错误页、404 页中的开发期措辞。
- 移除页面上残留的“骨架 / 尚未实现 / 待实现”展示文案（安全提示和模拟数据说明除外）。
- Web Dockerfile 增加 `COPY public ./public`，确保地图图片进入生产运行镜像。
- README 增加主要页面说明和模拟数据声明；ARCHITECTURE 增加服务器路由、模拟数据模块和未来 `servers` 后端模块边界；CHANGELOG 增加 Unreleased 汇总。

### 涉及文件

#### 新增

| 文件 | 用途 |
| --- | --- |
| `apps/web/public/images/servers/elysium-valley.svg` | Elysium Valley 地图预览图 |
| `apps/web/public/images/servers/aether-workshop.svg` | Aether Workshop 地图预览图 |
| `apps/web/public/images/servers/ember-arena.svg` | Ember Arena 地图预览图 |
| `apps/web/src/app/(servers)/layout.tsx` | 服务器页面布局边界 |
| `apps/web/src/app/(servers)/servers/page.tsx` | `/servers` 页面、Hero、统计、加入步骤 |
| `apps/web/src/features/servers/data/servers.ts` | 服务器/玩家模拟数据、地址工具函数 |
| `apps/web/src/features/servers/components/server-directory.tsx` | 卡片/列表切换与 localStorage 偏好 |
| `apps/web/src/features/servers/components/server-card.tsx` | 卡片模式服务器展示 |
| `apps/web/src/features/servers/components/server-list-row.tsx` | 列表模式服务器展示 |
| `apps/web/src/features/servers/components/server-status-badge.tsx` | 在线/维护状态徽章 |
| `apps/web/src/features/servers/components/player-avatar.tsx` | 服务器玩家头像色块 |
| `apps/web/src/features/servers/components/copy-address-button.tsx` | 复制 IP:PORT 按钮与状态反馈 |
| `apps/web/src/features/servers/components/join-server-button.tsx` | 加入游戏说明对话框 |
| `apps/web/src/components/shared/user-avatar.tsx` | 通用用户头像组件 |
| `apps/web/src/features/forum/data/forum.ts` | 分类、主题、回复模拟数据与搜索 |
| `apps/web/src/features/forum/components/category-card.tsx` | 论坛分类卡片 |
| `apps/web/src/features/forum/components/forum-category-icon.tsx` | 分类图标与配色映射 |
| `apps/web/src/features/forum/components/topic-row.tsx` | 主题列表行 |
| `apps/web/src/features/account/data/account.ts` | 用户中心模拟资料、通知、活动 |
| `apps/web/src/features/admin/data/dashboard.ts` | 管理面板统计、审核、审计数据 |

#### 修改

| 文件 | 修改 |
| --- | --- |
| `apps/web/src/app/(site)/page.tsx` | 官网首页重写为服务器/社区内容 |
| `apps/web/src/app/(forum)/forum/page.tsx` | 分类、搜索、最新讨论和侧栏 |
| `apps/web/src/app/(forum)/forum/[category]/page.tsx` | 分类主题列表与 404 |
| `apps/web/src/app/(forum)/forum/topic/[id]/page.tsx` | 帖子正文、回复、相关主题 |
| `apps/web/src/app/(account)/account/page.tsx` | 用户中心模拟资料与活动 |
| `apps/web/src/app/(admin)/admin/page.tsx` | 管理运营面板与锚点区块 |
| `apps/web/src/app/(admin)/layout.tsx` | 演示数据标识，移除大面积开发警告 |
| `apps/web/src/app/global-error.tsx` | 错误页措辞 |
| `apps/web/src/app/not-found.tsx` | 404 措辞 |
| `apps/web/src/app/sitemap.ts` | 加入 `/servers` |
| `apps/web/src/components/layout/site-header.tsx` | 导航入口与“加入服务器”CTA |
| `apps/web/src/components/layout/site-footer.tsx` | 服务器入口、模拟数据说明 |
| `apps/web/src/lib/site-config.ts` | 导航增加服务器、站点描述更新 |
| `apps/web/src/features/forum/components/forum-search-form.tsx` | 搜索框占位文案 |
| `apps/web/src/features/admin/components/admin-nav.tsx` | 锚点导航，移除待实现 |
| `apps/web/src/features/admin/components/system-status-card.tsx` | 平台服务文案 |
| `apps/web/Dockerfile` | 复制 `public/` 静态地图资源 |
| `README.md` | 主要页面、模拟数据说明、目录更新 |
| `docs/ARCHITECTURE.md` | 服务器路由、模拟数据边界、未来 servers 模块 |
| `docs/CHANGELOG.md` | 新增 Unreleased 内容汇总 |
| `docs/DEVELOPMENT.md` | 新增本条记录 |
| `services/api/src/modules/mod.rs` | 未来 `servers` 后端模块边界注释 |

### 数据库与 API 变化

- 数据库：无迁移、表结构、索引或数据变化。
- API：无接口、请求/响应结构、错误码或权限变化。
- `services/api/src/modules/mod.rs` 仅为未来 `servers` 模块的注释补充，不影响编译产物行为。
- 前端页面中的服务器、论坛、用户中心和管理数据全部来自本地模拟数据；刷新后不持久化，也不请求真实服务器状态。

### 测试与结果

| 检查 | 命令/方式 | 结果 |
| --- | --- | --- |
| 全量静态检查 | `./scripts/check.sh` | 通过（Rust fmt、Clippy、16 个测试、TypeScript、ESLint、Prettier） |
| Next.js 生产构建 | `API_INTERNAL_URL=... NEXT_PUBLIC_SITE_URL=... npm run build` | 通过；`/servers` 为静态路由，分类/帖子使用 SSG |
| 服务器页卡片默认 | 无头 Chromium | `卡片` 按钮 `aria-pressed=true`，`列表=false` |
| 显示模式切换 | 点击“列表”并刷新 | 切换成功，`localStorage["threi.servers.view"]="list"`，刷新后保持 |
| 复制 IP:PORT | 点击复制并读取剪贴板 | 剪贴板为 `play.threi.example:25565`，按钮显示“已复制” |
| 加入游戏弹窗 | 点击“加入游戏” | 原生 dialog 可见，可关闭 |
| 页面状态 | `/`、`/servers`、`/forum`、`/forum/survival`、`/forum/topic/season-three-islands`、`/account`、`/admin` | 均返回 200 |
| 非法路由 | `/forum/unknown-category`、`/forum/topic/unknown-topic` | 404 |
| 地图资源 | 三张 `/images/servers/*.svg` | 200，`image/svg+xml` |
| 搜索 | `/forum?q=建筑` | 返回 3 个模拟结果 |
| 移动端 | 390×844 无头浏览器访问 `/servers` | 200，地址与操作按钮正常显示 |
| 控制台 | 浏览器交互检查 | 无 console/page error |
| API 连通性 | `/api/v1/system/info` 经 Next rewrite | 200 |

**未执行：**

- Docker 镜像构建与容器启动：当前环境没有 Docker daemon/CLI；本次改动只影响 Web 运行时和静态资源，但首次部署仍需实际构建验证。
- Nginx 配置加载与 HTTPS 验证：与本次内容修改无关，仍受环境限制。
- 未将无头浏览器检查固化为仓库内 E2E 测试；本次为临时脚本验证，截图在 `/tmp`，未提交。
- 未测试真实游戏客户端连接：模拟地址使用保留域名，不连接真实服务器。

### 已知限制

- 模拟数据不会持久化；发帖、编辑资料、审核操作等写能力未实现。
- 服务器状态、玩家列表、地图和人数为前端静态预览，不代表真实服务器。
- 管理面板仍公开可见，认证和权限尚未接入；生产环境必须保护。
- 加入游戏按钮提供连接说明和复制地址，不直接唤起游戏客户端（未确定游戏协议）。

## 2026年10月23日 20时20分17秒 官网公开品牌名称调整为 ThRei

### 背景

用户确认官网对外名称为 **ThRei**，要求将当前展示的 `threi` 调整为 `ThRei`。本次只调整公开品牌名，保留仓库名、包名、Docker 服务名、镜像名、API 技术标识等仍需保持小写的技术标识，避免破坏已有命令、路径和部署配置。

### 变更内容

- 前端站点配置：`name` 改为 `ThRei`，标题改为 `ThRei 社区`，描述加入品牌名。
- 品牌组件：导航和页脚展示 `ThRei`，Logo 方块字符由 `t` 改为 `T`，无障碍标签同步。
- 页面 metadata：管理面板、用户中心、论坛首页、分类页、帖子详情页的描述改为 `ThRei`。
- 官网首页文案、PWA manifest、全局错误页品牌文字、应用图标 `aria-label` 同步为 `ThRei`。
- OpenAPI 标题改为 `ThRei API`，描述改为 `ThRei community API`；API 启动日志中的品牌名同步，但健康检查响应和 `system/info` 的 `threi-api` 服务标识保持不变。
- README 与文档标题/说明中的产品展示名改为 `ThRei`；技术路径、镜像名、Compose 服务名、包名保持原样。
- 重新构建并重启本地预览，使当前运行页面立即显示新名称。

### 涉及文件

| 文件 | 修改 |
| --- | --- |
| `apps/web/src/lib/site-config.ts` | 站点名称、标题、描述 |
| `apps/web/src/components/layout/brand.tsx` | 导航品牌文字、Logo 字符、aria-label |
| `apps/web/src/app/(site)/page.tsx` | 官网首页品牌文案 |
| `apps/web/src/app/manifest.ts` | PWA 名称与短名称 |
| `apps/web/src/app/icon.svg` | 图标 aria-label |
| `apps/web/src/app/global-error.tsx` | 全局错误页品牌文字 |
| `apps/web/src/app/(admin)/layout.tsx` | 管理面板 metadata 描述 |
| `apps/web/src/app/(account)/account/page.tsx` | 用户中心 metadata 描述 |
| `apps/web/src/app/(forum)/forum/page.tsx` | 论坛首页 metadata 描述 |
| `apps/web/src/app/(forum)/forum/[category]/page.tsx` | 分类页 metadata 描述 |
| `apps/web/src/app/(forum)/forum/topic/[id]/page.tsx` | 帖子详情 metadata 描述 |
| `services/api/src/openapi.rs` | OpenAPI 标题与描述 |
| `services/api/src/main.rs` | 启动日志品牌名 |
| `README.md` | 项目标题与简介 |
| `docs/ARCHITECTURE.md` | 文档标题与产品说明 |
| `docs/API.md` | 文档标题 |
| `docs/DEPLOYMENT.md` | 文档标题 |
| `docs/DEVELOPMENT.md` | 新增本条开发记录 |

### 数据库与 API 变化

- 数据库：无。
- API：仅 OpenAPI 文档标题/描述和启动日志中的展示名称变化；未新增、删除或修改接口，未改变请求/响应结构、错误码或权限。`/health/live`、`/health/ready`、`/api/v1/system/info` 的技术服务标识仍为 `threi-api`。

### 测试与结果

- `./scripts/check.sh`：通过（Rust fmt、Clippy、16 个测试、TypeScript、ESLint、Prettier）。
- `cargo build --release --locked --bins`：通过。
- `npm run build`：通过。
- 本地预览已重新构建并重启：
  - 页面标题为 `ThRei 社区`；
  - 导航、页脚与首页显示 `ThRei`；
  - OpenAPI 标题为 `ThRei API`；
  - `/`、`/forum`、`/account`、`/admin` 均返回 200。
- 未执行：Docker 镜像构建、容器启动、Nginx/HTTPS 验证（本机无 Docker；与本次品牌修改无关）。

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
