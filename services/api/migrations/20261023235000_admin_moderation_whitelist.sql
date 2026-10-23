-- Admin account controls, player bans, and server whitelists.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
    ADD COLUMN IF NOT EXISTS disabled_reason text;

ALTER TABLE servers
    ADD COLUMN IF NOT EXISTS requires_whitelist boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS bans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    player_name text,
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
    expires_at timestamptz,
    created_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    lifted_at timestamptz,
    lifted_by uuid REFERENCES users (id) ON DELETE SET NULL,
    lift_reason text
);

CREATE INDEX IF NOT EXISTS bans_steam_id_idx ON bans (steam_id64, created_at DESC);
CREATE INDEX IF NOT EXISTS bans_active_idx ON bans (steam_id64)
    WHERE lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS bans_created_at_idx ON bans (created_at DESC);

CREATE TABLE IF NOT EXISTS whitelist_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    player_name text,
    message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES users (id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    review_note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whitelist_applications_status_idx
    ON whitelist_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS whitelist_applications_server_idx
    ON whitelist_applications (server_id, steam_id64, created_at DESC);

CREATE TABLE IF NOT EXISTS server_whitelist (
    server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    player_name text,
    added_by uuid REFERENCES users (id) ON DELETE SET NULL,
    source_application_id uuid REFERENCES whitelist_applications (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, steam_id64)
);

CREATE INDEX IF NOT EXISTS server_whitelist_steam_idx ON server_whitelist (steam_id64);
