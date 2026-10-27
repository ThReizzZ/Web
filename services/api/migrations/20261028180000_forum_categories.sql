-- Forum taxonomy and posting support.
--
-- Categories are structural configuration. Existing topics are moved into the
-- general discussion category before retired categories are removed so no
-- content is lost and the foreign key stays valid.

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_icon_check;
ALTER TABLE categories ADD CONSTRAINT categories_icon_check
    CHECK (icon IN ('megaphone', 'messages', 'map', 'graduation', 'life-buoy', 'lightbulb', 'flag'));

INSERT INTO categories (slug, name, description, icon, sort_order)
VALUES
    ('announcements', '公告', '服务器维护、版本更新、活动与社区通知。', 'megaphone', 10),
    ('general', '玩家讨论', 'KZ 地图、跳法、计时记录和社区日常。', 'messages', 20),
    ('feedback', '建议反馈', '对服务器、插件和网站的建议、问题反馈。', 'lightbulb', 30),
    ('reports', '玩家举报', '举报作弊、违规行为和其他需要管理员处理的问题。', 'flag', 40)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;

UPDATE topics
SET category_slug = 'general'
WHERE category_slug NOT IN ('announcements', 'general', 'feedback', 'reports');

DELETE FROM categories
WHERE slug NOT IN ('announcements', 'general', 'feedback', 'reports');
