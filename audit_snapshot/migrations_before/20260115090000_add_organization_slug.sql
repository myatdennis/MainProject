-- Ensure organizations have a unique slug used throughout the API
BEGIN;

create extension if not exists "uuid-ossp";

alter table if exists public.organizations
  add column if not exists slug text;

with source as (
  select
    id,
    nullif(slug, '') as existing_slug,
    coalesce(name, id::text) as slug_source
  from public.organizations
),
normalized as (
  select
    id,
    case
      when existing_slug is not null then existing_slug
      else regexp_replace(lower(slug_source), '[^a-z0-9]+', '-', 'g')
    end as base_slug
  from source
),
sanitized as (
  select
    id,
    case
      when base_slug is null or base_slug = '' then lower(concat('org-', left(id::text, 8)))
      else trim(both '-' from left(base_slug, 64))
    end as slug_candidate
  from normalized
),
numbered as (
  select
    id,
    slug_candidate,
    row_number() over (partition by slug_candidate order by id) as rn
  from sanitized
),
final as (
  select
    id,
    left(
      case
        when rn = 1 then slug_candidate
        else concat(slug_candidate, '-', rn - 1)
      end,
      64
    ) as final_slug
  from numbered
)
update public.organizations o
set slug = final.final_slug
from final
where o.id = final.id
  and (o.slug is null or o.slug = '' or o.slug <> final.final_slug);

alter table public.organizations
  alter column slug set not null;

create unique index if not exists organizations_slug_unique on public.organizations(slug);

COMMIT;
