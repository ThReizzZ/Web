-- Player access monitoring and administrator player profiles.
--
-- `server_access_logs` records connection attempts reported by the plugin
-- (rejections) and successful joins derived from the roster report. The
-- `server_player_sessions` table keeps join/leave history for the admin player
-- detail page. `player_admin_profiles` stores admin-only notes and tags.

CREATE TABLE IF NOT EXISTS server_access_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    player_name text NOT NULL CHECK (char_length(player_name) BETWEEN 1 AND 80),
    ip_address text,
    allowed boolean NOT NULL,
    access_method text NOT NULL CHECK (access_method IN (
        'unrestricted',
        'whitelist',
        'snapshot_fallback',
        'banned',
        'whitelist_rejected',
        'access_unavailable'
    )),
    failure_code text CHECK (failure_code IS NULL OR failure_code IN (
        'banned',
        'ip_banned',
        'not_whitelisted',
        'access_unavailable',
        'no_steamid'
    )),
    reject_reason text CHECK (reject_reason IS NULL OR char_length(reject_reason) <= 1000),
    rating integer,
    steam_level integer,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS server_access_logs_occurred_idx
    ON server_access_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS server_access_logs_steam_idx
    ON server_access_logs (steam_id64, occurred_at DESC);
CREATE INDEX IF NOT EXISTS server_access_logs_server_idx
    ON server_access_logs (server_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS server_access_logs_ip_idx
    ON server_access_logs (ip_address, occurred_at DESC)
    WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS server_access_logs_failure_idx
    ON server_access_logs (failure_code, occurred_at DESC)
    WHERE failure_code IS NOT NULL;

-- A retried plugin report keeps the same occurred_at, so the unique key makes
-- rejection reporting idempotent. Successful joins are deduplicated by the
-- roster diff before this table is touched.
CREATE UNIQUE INDEX IF NOT EXISTS server_access_logs_event_idx
    ON server_access_logs (server_id, steam_id64, occurred_at, allowed, access_method);

CREATE TABLE IF NOT EXISTS server_player_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    player_name text NOT NULL CHECK (char_length(player_name) BETWEEN 1 AND 80),
    ip_address text,
    joined_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    left_at timestamptz,
    leave_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS server_player_sessions_open_idx
    ON server_player_sessions (server_id, steam_id64)
    WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS server_player_sessions_steam_idx
    ON server_player_sessions (steam_id64, joined_at DESC);
CREATE INDEX IF NOT EXISTS server_player_sessions_server_idx
    ON server_player_sessions (server_id, joined_at DESC);

-- Any code path that removes a live roster row (plugin report, admin kick,
-- ban, token rotation, hibernation, stale sweep) closes the matching session
-- automatically. The report path updates `last_seen_at` while the player is
-- online; code that wants a more precise leave time can set `left_at` first.
CREATE OR REPLACE FUNCTION close_server_player_session()
RETURNS trigger AS $$
BEGIN
    UPDATE server_player_sessions
    SET left_at = now(), leave_reason = 'disconnect'
    WHERE server_id = OLD.server_id
      AND steam_id64 = OLD.steam_id64
      AND left_at IS NULL;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS server_players_close_session ON server_players;
CREATE TRIGGER server_players_close_session
AFTER DELETE ON server_players
FOR EACH ROW EXECUTE FUNCTION close_server_player_session();

CREATE TABLE IF NOT EXISTS player_admin_profiles (
    steam_id64 text PRIMARY KEY CHECK (steam_id64 ~ '^[0-9]{17}$'),
    note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 4000),
    tags text[] NOT NULL DEFAULT '{}',
    updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER player_admin_profiles_set_updated_at
BEFORE UPDATE ON player_admin_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS player_admin_profile_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    steam_id64 text NOT NULL CHECK (steam_id64 ~ '^[0-9]{17}$'),
    note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 4000),
    tags text[] NOT NULL DEFAULT '{}',
    changed_by uuid REFERENCES users (id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_admin_profile_history_steam_idx
    ON player_admin_profile_history (steam_id64, changed_at DESC);
