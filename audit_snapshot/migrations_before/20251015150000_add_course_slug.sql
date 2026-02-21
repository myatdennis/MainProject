/*
  # Ensure courses have slugs for id/slug routing support

  1. Schema Changes
    - Add nullable slug column to courses table if it does not already exist
    - Backfill existing rows with a slug derived from id/title
    - Add unique index on slug for fast lookup
*/

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing slug values when absent
UPDATE courses
SET slug = COALESCE(
  slug,
  CASE
    WHEN title IS NOT NULL THEN
      regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')
    ELSE id
  END
)
WHERE slug IS NULL;

-- Ensure all slugs are lowercase and trimmed
UPDATE courses
SET slug = trim(both '-' from regexp_replace(lower(slug), '-{2,}', '-', 'g'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_slug ON courses (slug);
