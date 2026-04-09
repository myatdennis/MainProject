create index if not exists lesson_reflections_course_idx
  on public.lesson_reflections (course_id);

create index if not exists lesson_reflections_lesson_idx
  on public.lesson_reflections (lesson_id);

create index if not exists lesson_reflections_module_idx
  on public.lesson_reflections (module_id);

create index if not exists team_huddle_comments_org_idx
  on public.team_huddle_comments (organization_id);

create index if not exists team_huddle_comments_parent_comment_idx
  on public.team_huddle_comments (parent_comment_id);

create index if not exists team_huddle_comments_user_idx
  on public.team_huddle_comments (user_id);

create index if not exists team_huddle_post_reactions_org_idx
  on public.team_huddle_post_reactions (organization_id);

create index if not exists team_huddle_post_reactions_user_idx
  on public.team_huddle_post_reactions (user_id);

create index if not exists team_huddle_posts_user_idx
  on public.team_huddle_posts (user_id);

create index if not exists team_huddle_reports_comment_idx
  on public.team_huddle_reports (comment_id);

create index if not exists team_huddle_reports_post_idx
  on public.team_huddle_reports (post_id);

create index if not exists team_huddle_reports_reporter_user_idx
  on public.team_huddle_reports (reporter_user_id);
