-- Enforce organization-scoped slug uniqueness for courses
-- 1) Deduplicate any existing conflicts by appending a short suffix.
with slug_dupes as (
  select
    id,
    slug,
    coalesce(organization_id, '__global__') as scope_key,
    row_number() over (
      partition by coalesce(organization_id, '__global__'), slug
      order by updated_at desc nulls last, created_at desc nulls last, id
    ) as dup_rank
  from public.courses
)
update public.courses as c
set slug = concat(c.slug, '-', left(replace(gen_random_uuid()::text, '-', ''), 6))
from slug_dupes d
where c.id = d.id
  and d.dup_rank > 1;

-- 2) Guarantee uniqueness via an expression index (null org_ids share a single global scope).
create unique index if not exists courses_org_slug_unique
  on public.courses (coalesce(organization_id, '__global__'), lower(slug));
