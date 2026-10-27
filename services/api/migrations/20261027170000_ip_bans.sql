-- IP bans for website logins. A banned IP blocks logins and automatically
-- bans member accounts that are known to use that IP.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address text;

CREATE INDEX IF NOT EXISTS users_last_login_ip_idx
    ON users (last_login_ip)
    WHERE last_login_ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessions_ip_idx
    ON sessions (ip_address)
    WHERE ip_address IS NOT NULL;

ALTER TABLE bans ALTER COLUMN steam_id64 DROP NOT NULL;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS ban_type text NOT NULL DEFAULT 'steam';
ALTER TABLE bans ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS source_ban_id uuid REFERENCES bans (id) ON DELETE SET NULL;

-- Existing rows are SteamID bans.
ALTER TABLE bans DROP CONSTRAINT IF EXISTS bans_ban_type_check;
ALTER TABLE bans ADD CONSTRAINT bans_ban_type_check
    CHECK (ban_type IN ('steam', 'ip'));

ALTER TABLE bans DROP CONSTRAINT IF EXISTS bans_identity_check;
ALTER TABLE bans ADD CONSTRAINT bans_identity_check
    CHECK (
        (ban_type = 'steam' AND steam_id64 IS NOT NULL AND ip_address IS NULL)
        OR (ban_type = 'ip' AND steam_id64 IS NULL AND ip_address IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS bans_ip_active_idx
    ON bans (ip_address)
    WHERE ban_type = 'ip' AND lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS bans_source_idx
    ON bans (source_ban_id)
    WHERE source_ban_id IS NOT NULL;
