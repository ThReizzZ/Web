-- Link the website account ban, game-server ban, and IP ban created by one
-- in-game ban so an in-game unban can lift exactly that group without
-- touching website-administrator bans.
ALTER TABLE bans ADD COLUMN IF NOT EXISTS ban_group_id uuid;
ALTER TABLE server_bans ADD COLUMN IF NOT EXISTS ban_group_id uuid;

CREATE INDEX IF NOT EXISTS bans_group_idx
    ON bans (ban_group_id)
    WHERE ban_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS server_bans_group_idx
    ON server_bans (ban_group_id)
    WHERE ban_group_id IS NOT NULL;
