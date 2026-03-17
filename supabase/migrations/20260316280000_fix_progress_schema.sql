-- Migration: Fix progress table schema to match server expectations
-- Fixes: [progress] Falling back to legacy lesson progress schema { code: 'PGRST204' }
--        Could not find the 'percent' column of 'user_course_progress'
--        Could not find the 'percent' column of 'user_lesson_progress'

-- ─── user_lesson_progress ────────────────────────────────────────────────────
-- The modern upsert path writes: progress, completed, time_spent_seconds
-- The legacy upsert path writes: percent, status, time_spent_s
-- Add all expected columns so both paths function without schema-detection fallback.

ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS progress         numeric        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed        boolean        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_spent_s     integer        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percent          numeric        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_at_s      integer        NOT NULL DEFAULT 0;

-- Keep status in sync with the completed flag via a trigger so both
-- the modern and legacy read paths return consistent data.
CREATE OR REPLACE FUNCTION public.sync_lesson_progress_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Derive completed from percent / progress if not explicitly set
  IF NEW.completed IS DISTINCT FROM OLD.completed OR
     NEW.progress   IS DISTINCT FROM OLD.progress   OR
     NEW.percent     IS DISTINCT FROM OLD.percent THEN
    -- Mirror percent ↔ progress so either column stays current
    IF NEW.progress <> 0 AND NEW.percent = 0 THEN
      NEW.percent := NEW.progress;
    ELSIF NEW.percent <> 0 AND NEW.progress = 0 THEN
      NEW.progress := NEW.percent;
    END IF;
    -- Derive status from completed flag and progress value
    IF NEW.completed = true OR GREATEST(NEW.progress, NEW.percent) >= 100 THEN
      NEW.status    := 'completed';
      NEW.completed := true;
    ELSE
      NEW.status    := COALESCE(NULLIF(NEW.status, ''), 'in_progress');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lesson_progress_status ON public.user_lesson_progress;
CREATE TRIGGER trg_sync_lesson_progress_status
  BEFORE INSERT OR UPDATE ON public.user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.sync_lesson_progress_status();

-- ─── user_course_progress ────────────────────────────────────────────────────
-- Add 'percent' as a real writable column (server code may write it even
-- though schemaSupportFlags is now initialized to 'missing', this ensures
-- any residual legacy writes don't fail).
ALTER TABLE public.user_course_progress
  ADD COLUMN IF NOT EXISTS percent numeric NOT NULL DEFAULT 0;

-- Keep percent in sync with the canonical progress column.
CREATE OR REPLACE FUNCTION public.sync_course_progress_percent()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.progress IS NOT NULL AND (NEW.percent IS NULL OR NEW.percent = 0) THEN
    NEW.percent := NEW.progress;
  ELSIF NEW.percent IS NOT NULL AND NEW.percent <> 0 AND (NEW.progress IS NULL OR NEW.progress = 0) THEN
    NEW.progress := NEW.percent;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_progress_percent ON public.user_course_progress;
CREATE TRIGGER trg_sync_course_progress_percent
  BEFORE INSERT OR UPDATE ON public.user_course_progress
  FOR EACH ROW EXECUTE FUNCTION public.sync_course_progress_percent();
