-- Add helpful indexes for modules and lessons ordering
CREATE INDEX IF NOT EXISTS idx_modules_course_order ON public.modules (course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_module_order ON public.lessons (module_id, order_index);

-- Add FK constraints with cascade if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_modules_course' AND conrelid = 'public.modules'::regclass
  ) THEN
    ALTER TABLE public.modules
      ADD CONSTRAINT fk_modules_course FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lessons_module' AND conrelid = 'public.lessons'::regclass
  ) THEN
    ALTER TABLE public.lessons
      ADD CONSTRAINT fk_lessons_module FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;
  END IF;
END$$;
