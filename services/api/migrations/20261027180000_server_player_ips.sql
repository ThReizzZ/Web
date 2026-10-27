-- The plugin reports the client IP for each online player so server-side bans
-- can automatically create an IP ban even when the player never signed in to
-- the website.
ALTER TABLE server_players ADD COLUMN IF NOT EXISTS ip_address text;

CREATE INDEX IF NOT EXISTS server_players_ip_idx
    ON server_players (ip_address)
    WHERE ip_address IS NOT NULL;

-- Used when a website ban looks up the player's most recent game-server IP.
CREATE INDEX IF NOT EXISTS server_players_steam_ip_idx
    ON server_players (steam_id64, last_seen_at DESC)
    WHERE ip_address IS NOT NULL;
