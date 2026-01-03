-- Add optimistic version tracking to courses so admin import/upsert APIs can store version numbers
BEGIN;

ALTER TABLE IF EXISTS public.courses
    ADD COLUMN IF NOT EXISTS version integer;

ALTER TABLE IF EXISTS public.courses
    ALTER COLUMN version SET DEFAULT 1;

UPDATE public.courses
   SET version = COALESCE(version, 1)
 WHERE version IS NULL;

ALTER TABLE IF EXISTS public.courses
    ALTER COLUMN version SET NOT NULL;

COMMENT ON COLUMN public.courses.version IS 'Optimistic concurrency/version counter for admin upserts and imports';

COMMIT;
