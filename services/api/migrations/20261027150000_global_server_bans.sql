-- A NULL server_id represents a ban that applies to every game server.
-- Per-server bans keep the concrete server id.
ALTER TABLE server_bans ALTER COLUMN server_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS server_bans_global_active_idx
    ON server_bans (steam_id64)
    WHERE server_id IS NULL AND lifted_at IS NULL;
