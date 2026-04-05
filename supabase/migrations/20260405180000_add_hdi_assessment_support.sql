BEGIN;

ALTER TABLE IF EXISTS public.surveys
  ADD COLUMN IF NOT EXISTS assessment_type text;

UPDATE public.surveys
SET assessment_type = 'hdi'
WHERE assessment_type IS NULL
  AND lower(coalesce(type, '')) IN ('hdi', 'hdi-assessment', 'hdi-huddle-development-inventory', 'hdi-intercultural-development-index');

CREATE INDEX IF NOT EXISTS surveys_assessment_type_idx
  ON public.surveys (assessment_type);

ALTER TABLE IF EXISTS public.survey_responses
  ADD COLUMN IF NOT EXISTS assessment_type text;

CREATE INDEX IF NOT EXISTS survey_responses_assessment_type_idx
  ON public.survey_responses (assessment_type)
  WHERE assessment_type IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.hdi_assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_response_id uuid NOT NULL UNIQUE REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  survey_id text NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id text NULL,
  stage_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  do_score numeric(5,2) NULL,
  stage_placement jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  comparison jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS hdi_assessment_results_survey_id_idx
  ON public.hdi_assessment_results (survey_id);

CREATE INDEX IF NOT EXISTS hdi_assessment_results_user_id_idx
  ON public.hdi_assessment_results (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS hdi_assessment_results_org_id_idx
  ON public.hdi_assessment_results (organization_id)
  WHERE organization_id IS NOT NULL;

ALTER TABLE public.hdi_assessment_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hdi_assessment_results_service_full_access" ON public.hdi_assessment_results;
CREATE POLICY "hdi_assessment_results_service_full_access"
  ON public.hdi_assessment_results FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
