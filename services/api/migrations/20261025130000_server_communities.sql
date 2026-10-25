-- Community groups become first-class entities so admins can create a group
-- first and then attach one or more server instances to it. The previous
-- free-text servers.community column is migrated into this table.
CREATE TABLE server_communities (
    id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness keeps "KZ" and "kz" from becoming two groups.
CREATE UNIQUE INDEX server_communities_name_key
    ON server_communities (lower(name));

CREATE TRIGGER server_communities_set_updated_at
BEFORE UPDATE ON server_communities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE server_communities IS
    'Admin-managed community groups used to organize server instances in the catalog.';

-- Preserve the labels that were already assigned through servers.community.
-- Group case-insensitively so legacy labels such as "KZ" and "kz" cannot
-- violate the unique index; min() picks one stable display spelling.
INSERT INTO server_communities (id, name)
SELECT 'com-' || substr(md5(lower(name)), 1, 12), min(name)
FROM (
    SELECT btrim(community) AS name
    FROM servers
    WHERE btrim(community) <> ''
) AS existing
GROUP BY lower(name)
ON CONFLICT DO NOTHING;

ALTER TABLE servers
    ADD COLUMN community_id text REFERENCES server_communities (id) ON DELETE SET NULL;

UPDATE servers AS s
SET community_id = c.id
FROM server_communities AS c
WHERE lower(btrim(s.community)) = lower(c.name);

ALTER TABLE servers DROP COLUMN community;

CREATE INDEX servers_community_id_idx ON servers (community_id);

COMMENT ON COLUMN servers.community_id IS
    'Optional community group; deleting the group leaves the server ungrouped.';
