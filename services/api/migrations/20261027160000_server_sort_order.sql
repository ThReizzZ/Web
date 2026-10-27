-- Manual server order controlled from the admin panel.
ALTER TABLE servers ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Preserve the previous public order (featured first, then name) as the
-- starting point; admins can then move servers up or down.
WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY featured DESC, name) - 1 AS position
    FROM servers
)
UPDATE servers AS s
SET sort_order = ordered.position
FROM ordered
WHERE s.id = ordered.id;

CREATE INDEX IF NOT EXISTS servers_sort_order_idx ON servers (sort_order, name);
