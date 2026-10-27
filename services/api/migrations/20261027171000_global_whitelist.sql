-- Whitelist is now global: one approval applies to every server that requires
-- a whitelist. The old per-server table is migrated and kept for history.

CREATE TABLE IF NOT EXISTS global_whitelist (
    steam_id64 text PRIMARY KEY CHECK (steam_id64 ~ '^[0-9]{17}$'),
    player_name text,
    added_by uuid REFERENCES users (id) ON DELETE SET NULL,
    source_application_id uuid REFERENCES whitelist_applications (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO global_whitelist (steam_id64, player_name, added_by, source_application_id, created_at)
SELECT DISTINCT ON (steam_id64)
       steam_id64, player_name, added_by, source_application_id, created_at
FROM server_whitelist
ORDER BY steam_id64, created_at, server_id
ON CONFLICT (steam_id64) DO NOTHING;

ALTER TABLE whitelist_applications ALTER COLUMN server_id DROP NOT NULL;

-- Pending applications are now global; historical approved/rejected rows keep
-- their original server id for traceability.
UPDATE whitelist_applications SET server_id = NULL WHERE status = 'pending';

-- Multiple servers could previously have one pending application per player.
-- Keep the oldest one and reject the duplicates so the pending unique index
-- below can be created. Existing rows keep their server_id for history.
WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY steam_id64 ORDER BY created_at, id) AS rn
    FROM whitelist_applications
    WHERE status = 'pending'
)
UPDATE whitelist_applications AS a
SET status = 'rejected',
    reviewed_at = now(),
    review_note = '已合并为全服白名单申请'
FROM ranked
WHERE a.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS whitelist_applications_pending_steam_idx
    ON whitelist_applications (steam_id64)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS global_whitelist_created_idx
    ON global_whitelist (created_at DESC);

COMMENT ON TABLE server_whitelist IS
    'Deprecated: migrated to global_whitelist; kept for historical data.';
