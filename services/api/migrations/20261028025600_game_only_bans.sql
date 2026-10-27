-- Bans now apply to game servers only. Website accounts are never blocked from
-- logging in; the user center reports active game bans instead.
CREATE TABLE IF NOT EXISTS server_ip_bans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address text NOT NULL,
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
    expires_at timestamptz,
    created_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    lifted_at timestamptz,
    lifted_by uuid REFERENCES users (id) ON DELETE SET NULL,
    lift_reason text,
    ban_group_id uuid
);

CREATE INDEX IF NOT EXISTS server_ip_bans_active_idx
    ON server_ip_bans (ip_address)
    WHERE lifted_at IS NULL;

CREATE INDEX IF NOT EXISTS server_ip_bans_group_idx
    ON server_ip_bans (ban_group_id)
    WHERE ban_group_id IS NOT NULL;

-- IP bans no longer have a SteamID, and the plugin needs an explicit
-- `banip`/`unbanip` action to apply and lift them without waiting for the
-- next access snapshot.
ALTER TABLE server_actions ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE server_actions ALTER COLUMN steam_id64 DROP NOT NULL;
ALTER TABLE server_actions DROP CONSTRAINT IF EXISTS server_actions_steam_id64_check;
ALTER TABLE server_actions DROP CONSTRAINT IF EXISTS server_actions_action_check;
ALTER TABLE server_actions ADD CONSTRAINT server_actions_action_check
    CHECK (action IN ('kick', 'ban', 'unban', 'banip', 'unbanip'));
ALTER TABLE server_actions ADD CONSTRAINT server_actions_target_check
    CHECK (
        (steam_id64 IS NOT NULL AND steam_id64 ~ '^[0-9]{17}$')
        OR (ip_address IS NOT NULL AND char_length(ip_address) BETWEEN 1 AND 64)
    );

COMMENT ON TABLE bans IS
    'Deprecated after 2026-10-28: website account/IP bans are no longer enforced. Use server_bans/server_ip_bans.';

-- The user explicitly requested that existing website account/IP ban records be
-- removed when switching to game-only bans.
DELETE FROM bans;
