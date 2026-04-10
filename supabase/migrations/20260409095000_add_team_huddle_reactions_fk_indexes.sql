-- Supabase linter: unindexed_foreign_keys (INFO)
-- Adds covering indexes for team_huddle_reactions foreign keys.

begin;

create index if not exists team_huddle_reactions_org_idx
  on public.team_huddle_reactions (organization_id);

create index if not exists team_huddle_reactions_user_idx
  on public.team_huddle_reactions (user_id);

commit;

