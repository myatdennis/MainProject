alter table public.survey_assignments
  add column if not exists user_ids text[] default '{}',
  add column if not exists cohort_ids text[] default '{}',
  add column if not exists department_ids text[] default '{}';

-- Backfill existing survey assignments from surveys.assigned_to JSON before dropping the column
DO $$
DECLARE
  rec record;
  org_ids text[];
  user_ids text[];
  cohort_ids text[];
  dept_ids text[];
BEGIN
  FOR rec IN
    SELECT id, assigned_to
    FROM public.surveys
    WHERE assigned_to IS NOT NULL
  LOOP
    org_ids := coalesce(
      ARRAY(SELECT jsonb_array_elements_text(rec.assigned_to -> 'organizationIds')),
      '{}'::text[]
    );
    user_ids := coalesce(
      ARRAY(SELECT jsonb_array_elements_text(rec.assigned_to -> 'userIds')),
      '{}'::text[]
    );
    cohort_ids := coalesce(
      ARRAY(SELECT jsonb_array_elements_text(rec.assigned_to -> 'cohortIds')),
      '{}'::text[]
    );
    dept_ids := coalesce(
      ARRAY(SELECT jsonb_array_elements_text(rec.assigned_to -> 'departmentIds')),
      '{}'::text[]
    );

    INSERT INTO public.survey_assignments (survey_id, organization_ids, user_ids, cohort_ids, department_ids, updated_at)
    VALUES (rec.id, org_ids, user_ids, cohort_ids, dept_ids, now())
    ON CONFLICT (survey_id)
    DO UPDATE SET
      organization_ids = excluded.organization_ids,
      user_ids = excluded.user_ids,
      cohort_ids = excluded.cohort_ids,
      department_ids = excluded.department_ids,
      updated_at = now();
  END LOOP;
END $$;

alter table public.surveys
  drop column if exists assigned_to;
