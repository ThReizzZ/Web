-- Real content and Steam authentication schema.
--
-- This migration intentionally contains no community content, server records,
-- users, topics or replies. Only the forum category taxonomy is seeded because
-- it is structural configuration rather than simulated activity.

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    steam_id64 text NOT NULL UNIQUE CHECK (steam_id64 ~ '^[0-9]{17}$'),
    persona_name text NOT NULL CHECK (char_length(persona_name) BETWEEN 1 AND 80),
    avatar_url text,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
    bio text NOT NULL DEFAULT '' CHECK (char_length(bio) <= 2000),
    location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 120),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE servers (
    id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name text NOT NULL,
    map text NOT NULL,
    description text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'maintenance', 'offline')),
    host text NOT NULL,
    port integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
    region text NOT NULL DEFAULT '',
    tickrate integer NOT NULL DEFAULT 128 CHECK (tickrate BETWEEN 1 AND 1000),
    max_players integer NOT NULL DEFAULT 32 CHECK (max_players BETWEEN 1 AND 1024),
    latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
    tags text[] NOT NULL DEFAULT '{}',
    map_image text NOT NULL DEFAULT '',
    featured boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX servers_active_idx ON servers (is_active, featured DESC, name);

CREATE TABLE server_players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
    avatar_url text,
    connected_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (server_id, steam_id64)
);

CREATE INDEX server_players_server_idx ON server_players (server_id, last_seen_at DESC);

CREATE TABLE categories (
    slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    icon text NOT NULL DEFAULT 'messages' CHECK (icon IN ('megaphone', 'messages', 'map', 'graduation', 'life-buoy')),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[A-Za-z0-9_-]+$'),
    category_slug text NOT NULL REFERENCES categories (slug) ON DELETE RESTRICT,
    author_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    excerpt text NOT NULL DEFAULT '' CHECK (char_length(excerpt) <= 500),
    content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 100000),
    tags text[] NOT NULL DEFAULT '{}',
    views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
    pinned boolean NOT NULL DEFAULT false,
    hot boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX topics_category_activity_idx ON topics (category_slug, last_activity_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX topics_activity_idx ON topics (last_activity_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX topics_author_idx ON topics (author_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id uuid NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000),
    likes integer NOT NULL DEFAULT 0 CHECK (likes >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX replies_topic_created_idx ON replies (topic_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX replies_author_idx ON replies (author_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE favorites (
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, server_id)
);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER servers_set_updated_at
BEFORE UPDATE ON servers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO categories (slug, name, description, icon, sort_order)
VALUES
    ('announcements', '公告与活动', '服务器维护、赛季更新、计时赛和社区活动。', 'megaphone', 10),
    ('general', '综合讨论', 'KZ 闲聊、地图推荐、计时器问题和社区日常。', 'messages', 20),
    ('maps', '地图与记录', 'KZ 地图推荐、个人最佳、路线拆解和排行榜讨论。', 'map', 30),
    ('guides', '技巧与教学', '预加速、连跳、长跳、空中转向和新手练习方法。', 'graduation', 40),
    ('support', '帮助与反馈', '连接、延迟、Steam 登录、计时器和服务器问题。', 'life-buoy', 50)
ON CONFLICT (slug) DO NOTHING;
