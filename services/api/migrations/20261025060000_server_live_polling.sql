-- Live server status and roster detection.
--
-- The API polls each active server with A2S (no credentials required) and,
-- when an RCON password is configured, with the Source RCON protocol. RCON is
-- the only query path that exposes SteamID64 values; A2S can still report the
-- anonymous in-game roster (slot/name/score) so the public directory shows
-- players even before RCON is configured.

ALTER TABLE servers
    ADD COLUMN rcon_password text,
    ADD COLUMN player_count integer CHECK (player_count IS NULL OR player_count >= 0),
    ADD COLUMN last_queried_at timestamptz,
    ADD COLUMN query_error text;

ALTER TABLE server_players
    ALTER COLUMN steam_id64 DROP NOT NULL,
    ADD COLUMN source text NOT NULL DEFAULT 'report'
        CHECK (source IN ('report', 'rcon', 'a2s')),
    ADD COLUMN slot integer CHECK (slot IS NULL OR slot >= 0);

-- Anonymous A2S rows are identified by their in-game slot. Identified rows
-- (plugin report or RCON) keep the existing (server_id, steam_id64) unique key.
CREATE UNIQUE INDEX server_players_anonymous_slot_idx
    ON server_players (server_id, slot)
    WHERE steam_id64 IS NULL;

ALTER TABLE server_players
    ADD CONSTRAINT server_players_source_identity CHECK (
        (source = 'a2s' AND steam_id64 IS NULL AND slot IS NOT NULL)
        OR (source IN ('report', 'rcon') AND steam_id64 IS NOT NULL)
    );
