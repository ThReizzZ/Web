-- Forum moderation and in-game server operations.

CREATE TABLE IF NOT EXISTS forum_mutes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
    expires_at timestamptz,
    created_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    lifted_at timestamptz,
    lifted_by uuid REFERENCES users (id) ON DELETE SET NULL,
    lift_reason text
);

CREATE INDEX IF NOT EXISTS forum_mutes_steam_idx ON forum_mutes (steam_id64, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_mutes_active_idx ON forum_mutes (steam_id64) WHERE lifted_at IS NULL;

CREATE TABLE IF NOT EXISTS server_bans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    player_name text,
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
    expires_at timestamptz,
    created_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    lifted_at timestamptz,
    lifted_by uuid REFERENCES users (id) ON DELETE SET NULL,
    lift_reason text
);

CREATE INDEX IF NOT EXISTS server_bans_server_idx ON server_bans (server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS server_bans_active_idx ON server_bans (server_id, steam_id64) WHERE lifted_at IS NULL;

CREATE TABLE IF NOT EXISTS server_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    action text NOT NULL CHECK (action IN ('kick', 'ban')),
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
    created_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS server_actions_pending_idx ON server_actions (server_id, created_at)
    WHERE processed_at IS NULL;
