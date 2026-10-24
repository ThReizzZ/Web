-- Seed the official new-player guide.
--
-- The guide is real community documentation, not a simulated forum post. It
-- uses a dedicated system account so no player is falsely credited as author.
-- System accounts are excluded from member/activity statistics.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

INSERT INTO users (steam_id64, persona_name, role, bio, is_system, last_login_at)
VALUES (
    '00000000000000000',
    'ThRei 系统',
    'admin',
    'ThRei 官方指南与公告账号。',
    true,
    now()
)
ON CONFLICT (steam_id64) DO UPDATE SET
    persona_name = EXCLUDED.persona_name,
    bio = EXCLUDED.bio,
    is_system = true;

INSERT INTO topics (
    slug, category_slug, author_id, title, excerpt, content, tags,
    views, pinned, hot, created_at, last_activity_at
)
SELECT
    'new-player-guide',
    'guides',
    u.id,
    '新手指南：进入 KZ 服务器与白名单申请',
    '从启动 CS:GO、连接服务器，到被服务器拦截时如何提交白名单申请，一篇说明完整流程。',
    $guide$一、进入服务器
1. 使用 Steam 登录 ThRei，打开服务器页面，选择状态为“在线”的 KZ 服务器。
2. 复制服务器地址（IP:PORT），或点击“加入游戏”查看连接命令。
3. 启动 CS:GO，在游戏设置中启用开发者控制台。默认控制台按键是 ~。
4. 在控制台输入 connect IP:PORT，例如 connect kz01.example.com:27015。
5. 连接成功后按检查点开始跳跃；如果服务器要求白名单，会提示相应错误或直接断开连接。

二、进入服务器被拦截时先确认原因
常见拦截包括白名单/保留位、Steam 登录或 VAC 状态异常、IP 或账号封禁、服务器满员、地图访问限制。请先记录服务器名称、完整地址、发生时间、当时的提示文字或截图，以及能否进入其他 ThRei 服务器。

三、提交白名单申请
1. 在用户中心复制你的 SteamID64。ThRei 只使用 Steam 登录，SteamID64 是核对身份的唯一依据。
2. 在论坛“帮助与反馈”分类提交申请。标题建议写：[白名单申请] 你的 Steam 昵称。
3. 正文请包含：SteamID64、目标服务器名称与 IP:PORT、错误提示或截图、最近一次尝试时间、是否可以进入其他服务器。
4. 如果你无法在论坛发帖，可以在服务器内联系在线管理员，并附上同样的信息；管理员会按 SteamID64 核对记录。
5. 管理员会检查服务器日志和白名单配置。白名单不会自动通过，也不会收取费用；请勿重复提交相同申请或在多个帖子中刷屏。

四、常见问题
Q：为什么我已经登录 Steam，还是被服务器拦截？
A：网站登录和游戏服务器白名单是两件事。网站登录只确认你的社区身份，服务器仍会独立检查白名单、封禁和 Steam 状态。

Q：多久能通过？
A：取决于管理员核对记录的时间，不承诺即时处理。提交后请耐心等待，不要重复开帖；可以在原帖补充新信息。

Q：VAC 封禁或社区封禁可以申请吗？
A：可以提交说明，但管理员会按服务器规则审核。使用小号、共享账号、绕过封禁或作弊记录可能导致拒绝。

Q：服务器满员怎么办？
A：先尝试其他在线服务器。满员不是白名单问题；保留位只对已配置的成员开放。

Q：连接超时或一直重试怎么办？
A：确认地址没有多余空格、CS:GO 已更新、Steam 在线；再检查服务器状态和本地网络。仍然失败时，在帮助与反馈中附上服务器、地图和错误截图。$guide$,
    ARRAY['新手指南', 'Steam', '白名单', '服务器'],
    0,
    true,
    false,
    now(),
    now()
FROM users u
WHERE u.steam_id64 = '00000000000000000'
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    tags = EXCLUDED.tags,
    pinned = true,
    last_activity_at = now();
