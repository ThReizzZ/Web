-- Optional community/group label. One physical host often runs several
-- game-server instances; the label lets the catalog group those instances
-- while the plugin still reports each instance independently.
ALTER TABLE servers
    ADD COLUMN community text NOT NULL DEFAULT ''
        CHECK (char_length(community) <= 60);

COMMENT ON COLUMN servers.community IS
    'Optional community group shown in the server catalog; empty means ungrouped.';
