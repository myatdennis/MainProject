-- Standardize organization identifiers across courses and documents
-- Date: 2026-01-14

begin;

-- Courses: ensure organization_id mirrors legacy org_id
alter table public.courses
  add column if not exists organization_id text;

update public.courses
set organization_id = nullif(btrim(org_id::text), '')
where organization_id is null
  and org_id is not null;

-- Enforce NOT NULL only when every row is backfilled
DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count FROM public.courses WHERE organization_id IS NULL;
  IF missing_count = 0 THEN
    EXECUTE 'alter table public.courses alter column organization_id set not null';
  ELSE
    RAISE EXCEPTION 'Cannot set courses.organization_id NOT NULL: % rows remain null. Backfill required before re-running migration.', missing_count;
  END IF;
END $$;

create index if not exists courses_organization_id_idx on public.courses (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_organization_id_not_empty_chk'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_organization_id_not_empty_chk
      CHECK (btrim(organization_id) <> '');
  END IF;
END $$;

-- Documents: ensure organization_id mirrors legacy org_id
alter table public.documents
  add column if not exists organization_id text;

update public.documents
set organization_id = nullif(btrim(org_id::text), '')
where organization_id is null
  and org_id is not null;

DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count FROM public.documents WHERE organization_id IS NULL;
  IF missing_count = 0 THEN
    EXECUTE 'alter table public.documents alter column organization_id set not null';
  ELSE
    RAISE EXCEPTION 'Cannot set documents.organization_id NOT NULL: % rows remain null. Backfill required before re-running migration.', missing_count;
  END IF;
END $$;

create index if not exists documents_organization_id_idx on public.documents (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_organization_id_not_empty_chk'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_organization_id_not_empty_chk
      CHECK (btrim(organization_id) <> '');
  END IF;
END $$;

commit;

-- Down migration (manual rollback instructions)
-- begin;
--   alter table public.documents drop constraint if exists documents_organization_id_not_empty_chk;
--   drop index if exists documents_organization_id_idx;
--   alter table public.documents alter column organization_id drop not null;
--   alter table public.documents drop column if exists organization_id;
--
--   alter table public.courses drop constraint if exists courses_organization_id_not_empty_chk;
--   drop index if exists courses_organization_id_idx;
--   alter table public.courses alter column organization_id drop not null;
--   alter table public.courses drop column if exists organization_id;
-- commit;
