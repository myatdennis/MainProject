create index if not exists team_huddle_reactions_org_idx
  on public.team_huddle_reactions (organization_id);

create index if not exists team_huddle_reactions_user_idx
  on public.team_huddle_reactions (user_id);
