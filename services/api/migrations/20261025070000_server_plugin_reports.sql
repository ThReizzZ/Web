-- Replace server polling with authenticated reports from the ThRei_Players
-- SourceMod plugin.
--
-- Each server gets an independent, high-entropy plugin token. The plugin sends
-- the current map, human-player limit and identified SteamID64 roster to
-- POST /api/v1/plugin/report. The API marks a plugin-managed server offline
-- when its last report is older than the staleness window.

ALTER TABLE servers
    RENAME COLUMN last_queried_at TO last_reported_at;

ALTER TABLE servers
    ADD COLUMN plugin_token text;

ALTER TABLE servers
    DROP COLUMN rcon_password,
    DROP COLUMN query_error;

ALTER TABLE servers
    ADD CONSTRAINT servers_plugin_token_length CHECK (
        plugin_token IS NULL OR char_length(plugin_token) BETWEEN 32 AND 128
    );

CREATE UNIQUE INDEX servers_plugin_token_idx
    ON servers (plugin_token)
    WHERE plugin_token IS NOT NULL;

-- Snapshots written by the removed poller are no longer authoritative. Keep
-- maintenance, but otherwise wait for the plugin's first report.
UPDATE servers
SET status = CASE
        WHEN status = 'maintenance' THEN status
        ELSE 'offline'
    END,
    player_count = 0,
    latency_ms = NULL,
    last_reported_at = NULL,
    updated_at = now()
WHERE last_reported_at IS NOT NULL;

-- A2S rows were anonymous and RCON rows were produced by the API poller.
-- Neither identity can be continued without the matching poller, so remove
-- them before restoring the plugin-only roster shape.
DELETE FROM server_players
WHERE steam_id64 IS NULL OR source IN ('a2s', 'rcon');

ALTER TABLE server_players
    DROP CONSTRAINT server_players_source_identity;

DROP INDEX server_players_anonymous_slot_idx;

ALTER TABLE server_players
    DROP COLUMN source,
    DROP COLUMN slot,
    ALTER COLUMN steam_id64 SET NOT NULL;
