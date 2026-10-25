-- Optional RCON fallback for empty/hibernating Source servers.
--
-- The ThRei_Players plugin remains the authoritative source. RCON is used only
-- to answer one question the plugin cannot while CS:GO hibernation pauses game
-- frames: is the server process still alive? Whitelist and kick/ban execution
-- stay on the authenticated plugin HTTP channel.

ALTER TABLE servers DROP CONSTRAINT IF EXISTS servers_status_check;
ALTER TABLE servers
    ADD CONSTRAINT servers_status_check
    CHECK (status IN ('online', 'maintenance', 'offline', 'hibernating'));

ALTER TABLE servers ADD COLUMN IF NOT EXISTS rcon_password text;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_rcon_at timestamptz;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS rcon_failures integer NOT NULL DEFAULT 0;

ALTER TABLE servers DROP CONSTRAINT IF EXISTS servers_rcon_password_length;
ALTER TABLE servers
    ADD CONSTRAINT servers_rcon_password_length
    CHECK (rcon_password IS NULL OR char_length(rcon_password) BETWEEN 1 AND 256);
ALTER TABLE servers DROP CONSTRAINT IF EXISTS servers_rcon_failures_range;
ALTER TABLE servers
    ADD CONSTRAINT servers_rcon_failures_range
    CHECK (rcon_failures BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS servers_rcon_poll_idx
    ON servers (id)
    WHERE rcon_password IS NOT NULL;
