-- Transactional upsert for course + modules + lessons
-- Accepts JSONB arguments shaped similarly to server payloads (snake_case)
-- Returns the course id (uuid)

create or replace function public.upsert_course_full(p_course jsonb, p_modules jsonb)
returns uuid
language plpgsql
as $$
declare
  v_course_id uuid;
  v_title text;
  v_slug text;
  v_description text;
  v_status text;
  v_version int;
  v_org uuid;
  v_meta jsonb;
  m jsonb;
  l jsonb;
  v_module_id uuid;
  v_lesson_id uuid;
  present_module_ids uuid[] := '{}'::uuid[];
  present_lesson_ids uuid[];
begin
  if p_course is null then
    raise exception 'p_course required';
  end if;

  v_title := coalesce(p_course->>'title', p_course->>'name');
  if v_title is null or length(v_title) = 0 then
    raise exception 'title required';
  end if;

  v_slug := nullif(p_course->>'slug', '');
  v_description := coalesce(p_course->>'description', null);
  v_status := coalesce(p_course->>'status', 'draft');
  v_version := coalesce((p_course->>'version')::int, 1);
  v_org := nullif(coalesce(p_course->>'org_id', p_course->>'organizationId'), '')::uuid;
  v_meta := coalesce(p_course->'meta_json', '{}'::jsonb);

  -- Upsert course
  if nullif(p_course->>'id', '') is not null then
    v_course_id := (p_course->>'id')::uuid;
  else
    v_course_id := gen_random_uuid();
  end if;

  insert into public.courses (id, slug, title, description, status, version, organization_id, meta_json)
  values (v_course_id, v_slug, v_title, v_description, v_status, v_version, v_org, v_meta)
  on conflict (id) do update set
    slug = excluded.slug,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    version = excluded.version,
    organization_id = excluded.organization_id,
    meta_json = excluded.meta_json;

  -- Collect present module ids for deletion step
  if p_modules is not null then
    for m in select * from jsonb_array_elements(p_modules)
    loop
      if nullif(m->>'id', '') is not null then
        present_module_ids := array_append(present_module_ids, (m->>'id')::uuid);
      end if;
    end loop;
  end if;

  -- Delete modules not present
  if array_length(present_module_ids, 1) is null then
    delete from public.modules where course_id = v_course_id;
  else
    delete from public.modules where course_id = v_course_id and id not in (select unnest(present_module_ids));
  end if;

  -- Upsert modules and lessons
  if p_modules is not null then
    for m in select * from jsonb_array_elements(p_modules)
    loop
      v_module_id := coalesce(nullif(m->>'id', '')::uuid, gen_random_uuid());
      insert into public.modules (id, course_id, title, description, order_index)
      values (v_module_id, v_course_id, m->>'title', nullif(m->>'description',''), coalesce((m->>'order_index')::int, 0))
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        order_index = excluded.order_index;

      -- lessons deletion set for this module
      present_lesson_ids := '{}'::uuid[];
      if (m ? 'lessons') then
        for l in select * from jsonb_array_elements(m->'lessons')
        loop
          if nullif(l->>'id', '') is not null then
            present_lesson_ids := array_append(present_lesson_ids, (l->>'id')::uuid);
          end if;
        end loop;
      end if;

      if array_length(present_lesson_ids, 1) is null then
        delete from public.lessons where module_id = v_module_id;
      else
        delete from public.lessons where module_id = v_module_id and id not in (select unnest(present_lesson_ids));
      end if;

      if (m ? 'lessons') then
        for l in select * from jsonb_array_elements(m->'lessons')
        loop
          v_lesson_id := coalesce(nullif(l->>'id','')::uuid, gen_random_uuid());
          insert into public.lessons (id, module_id, type, title, description, order_index, duration_s, content_json, completion_rule_json)
          values (
            v_lesson_id,
            v_module_id,
            l->>'type',
            l->>'title',
            nullif(l->>'description',''),
            coalesce((l->>'order_index')::int, 0),
            coalesce((l->>'duration_s')::int, null),
            coalesce(l->'content_json', '{}'::jsonb),
            coalesce(l->'completion_rule_json', null)
          )
          on conflict (id) do update set
            type = excluded.type,
            title = excluded.title,
            description = excluded.description,
            order_index = excluded.order_index,
            duration_s = excluded.duration_s,
            content_json = excluded.content_json,
            completion_rule_json = excluded.completion_rule_json;
        end loop;
      end if;
    end loop;
  end if;

  return v_course_id;
end;
$$;
