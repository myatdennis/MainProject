alter table if exists public.lesson_reflections
  add column if not exists response_data jsonb not null default '{}'::jsonb;

update public.lesson_reflections
set response_data = jsonb_strip_nulls(
  jsonb_build_object(
    'prompt_response', coalesce(response_text, ''),
    'deeper_reflection_1', '',
    'deeper_reflection_2', '',
    'deeper_reflection_3', '',
    'action_commitment', '',
    'current_step_id', 'review',
    'submitted_at', case when status = 'submitted' then updated_at else null end
  )
)
where coalesce(response_data, '{}'::jsonb) = '{}'::jsonb;

create index if not exists lesson_reflections_response_data_idx
  on public.lesson_reflections using gin (response_data);
