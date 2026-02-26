-- Align upsert_course_full RPC with text-based identifiers
create or replace function public.upsert_course_full(p_course jsonb, p_modules jsonb)
returns text
language plpgsql
as $$
declare
  v_course_id text;
  v_title text;
  v_slug text;
  v_description text;
  v_status text;
  v_version integer;
  v_org text;
  v_meta jsonb;
  m jsonb;
  l jsonb;
  v_module_id text;
  v_lesson_id text;
  present_module_ids text[] := '{}'::text[];
  present_lesson_ids text[];
begin
  if p_course is null then
    raise exception 'p_course required';
  end if;

  v_title := coalesce(nullif(p_course->>'title', ''), nullif(p_course->>'name', ''));
  if v_title is null then
    raise exception 'title required';
  end if;

  v_slug := nullif(p_course->>'slug', '');
  v_description := nullif(p_course->>'description', '');
  v_status := coalesce(p_course->>'status', 'draft');
  v_version := coalesce(nullif(p_course->>'version', '')::int, 1);
  v_org := nullif(
    coalesce(
      p_course->>'organization_id',
      p_course->>'org_id',
      p_course->>'organizationId'
    ),
    ''
  );
  v_meta := coalesce(p_course->'meta_json', '{}'::jsonb);

  if nullif(p_course->>'id', '') is not null then
    v_course_id := trim(p_course->>'id');
  else
    v_course_id := gen_random_uuid()::text;
  end if;

  insert into public.courses (
    id,
    slug,
    title,
    description,
    status,
    version,
    organization_id,
    meta_json
  )
  values (
    v_course_id,
    v_slug,
    v_title,
    v_description,
    v_status,
    v_version,
    v_org,
    v_meta
  )
  on conflict (id) do update set
    slug = excluded.slug,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    version = excluded.version,
    organization_id = excluded.organization_id,
    meta_json = excluded.meta_json;

  if p_modules is not null then
    for m in select * from jsonb_array_elements(p_modules)
    loop
      if nullif(m->>'id', '') is not null then
        present_module_ids := array_append(present_module_ids, trim(m->>'id'));
      end if;
    end loop;
  end if;

  if array_length(present_module_ids, 1) is null then
    delete from public.modules where course_id = v_course_id;
  else
    delete from public.modules
     where course_id = v_course_id
       and id not in (select unnest(present_module_ids));
  end if;

  if p_modules is not null then
    for m in select * from jsonb_array_elements(p_modules)
    loop
      v_module_id := coalesce(nullif(m->>'id', ''), gen_random_uuid()::text);
      insert into public.modules (id, course_id, title, description, order_index)
      values (
        v_module_id,
        v_course_id,
        m->>'title',
        nullif(m->>'description', ''),
        coalesce(nullif(m->>'order_index', '')::int, 0)
      )
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        order_index = excluded.order_index;

      present_lesson_ids := '{}'::text[];
      if (m ? 'lessons') then
        for l in select * from jsonb_array_elements(m->'lessons')
        loop
          if nullif(l->>'id', '') is not null then
            present_lesson_ids := array_append(present_lesson_ids, trim(l->>'id'));
          end if;
        end loop;
      end if;

      if array_length(present_lesson_ids, 1) is null then
        delete from public.lessons where module_id = v_module_id;
      else
        delete from public.lessons
         where module_id = v_module_id
           and id not in (select unnest(present_lesson_ids));
      end if;

      if (m ? 'lessons') then
        for l in select * from jsonb_array_elements(m->'lessons')
        loop
          v_lesson_id := coalesce(nullif(l->>'id', ''), gen_random_uuid()::text);
          insert into public.lessons (
            id,
            module_id,
            type,
            title,
            description,
            order_index,
            duration_s,
            content_json,
            completion_rule_json
          )
          values (
            v_lesson_id,
            v_module_id,
            l->>'type',
            l->>'title',
            nullif(l->>'description', ''),
            coalesce(nullif(l->>'order_index', '')::int, 0),
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
