-- Infrastructure-only initial migration.
--
-- No business tables are created in this phase. Business tables will be
-- introduced by their own modules once their requirements and access patterns
-- are clear. This migration only establishes shared database helpers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Standard trigger helper for future tables that expose `updated_at`.
-- Applied explicitly by migrations, never automatically.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at() IS
    'Sets updated_at to now() on UPDATE; attach with CREATE TRIGGER ... EXECUTE FUNCTION set_updated_at().';
