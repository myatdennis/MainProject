-- 2026-02-14 Ensure audit_logs.details column exists (jsonb) for PostgREST contract

ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
