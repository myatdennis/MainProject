-- Migration: add per-resource version columns and idempotency_keys table
-- Date: 2025-11-07

-- Add version column to modules and lessons to support optimistic checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'version'
  ) THEN
    ALTER TABLE public.modules ADD COLUMN version integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'version'
  ) THEN
    ALTER TABLE public.lessons ADD COLUMN version integer NOT NULL DEFAULT 1;
  END IF;
END$$;

-- Create a generic idempotency_keys table for server-driven deduplication (course upserts, imports, etc.)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id text PRIMARY KEY,
  key_type text NOT NULL,
  resource_id text,
  payload jsonb,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_type_resource ON public.idempotency_keys (key_type, resource_id);

-- Helpful comment: Consumers can insert a row with id = client provided idempotency key before performing
-- the target operation. If the insert fails because the key already exists, treat as deduplicated.
