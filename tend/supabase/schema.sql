-- Tend 2.0 — Supabase Schema
-- Run in Supabase SQL Editor to initialize all tables

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────────
create table users (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  age int,
  weight_lbs decimal,
  height_in decimal,
  fitness_goal text check (fitness_goal in ('strength', 'recomposition', 'feel_better', 'all')),
  training_days_per_week int default 4,
  yoga_time text check (yoga_time in ('morning', 'evening')),
  hrv_baseline decimal,
  resting_hr_baseline decimal,
  created_at timestamptz default now(),
  settings jsonb default '{}'::jsonb
);

alter table users enable row level security;
create policy "Users can read/write own profile" on users
  using (auth.uid() = id) with check (auth.uid() = id);

-- ─── Health Snapshots ─────────────────────────────────────────────────────────
create table health_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  date date not null,
  hrv decimal,
  resting_hr decimal,
  sleep_hours decimal,
  sleep_efficiency decimal,
  active_calories int,
  exercise_minutes int,
  avg_heart_rate decimal,
  strain_score decimal,
  recovery_score int,
  readiness_score int,
  stress_inferred boolean default false,
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table health_snapshots enable row level security;
create policy "Users own health data" on health_snapshots
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_health_snapshots_user_date on health_snapshots(user_id, date desc);

-- ─── Journal ──────────────────────────────────────────────────────────────────
create table journal_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  date date not null,
  anchor_question text,
  mood int check (mood in (-1, 0, 1)),
  recovery_at_write int,
  content_blocks jsonb default '[]'::jsonb,
  linked_goals uuid[] default '{}',
  linked_tasks uuid[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table journal_entries enable row level security;
create policy "Users own journal" on journal_entries
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_journal_user_date on journal_entries(user_id, date desc);

-- ─── Stroke Data ──────────────────────────────────────────────────────────────
create table stroke_data (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null,
  entry_type text not null check (entry_type in ('journal', 'brain_dump', 'capture', 'priority')),
  strokes jsonb not null default '[]'::jsonb,
  recognized_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table stroke_data enable row level security;
-- RLS via join to parent table — app verifies ownership before writing

-- ─── Brain Dumps ──────────────────────────────────────────────────────────────
create table brain_dumps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  strokes jsonb default '[]'::jsonb,
  recognized_text text,
  extracted_tasks uuid[] default '{}',
  created_at timestamptz default now()
);

alter table brain_dumps enable row level security;
create policy "Users own brain dumps" on brain_dumps
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Goals ────────────────────────────────────────────────────────────────────
create table goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  title text not null,
  category text check (category in ('health', 'business', 'personal')),
  target_date date,
  status text default 'active' check (status in ('active', 'done', 'paused')),
  progress int default 0 check (progress between 0 and 100),
  milestones jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table goals enable row level security;
create policy "Users own goals" on goals
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Tasks ────────────────────────────────────────────────────────────────────
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  title text not null,
  notes text default '',
  due_date date,
  position int default 0,
  status text default 'active' check (status in ('active', 'done')),
  goal_id uuid references goals on delete set null,
  project_id uuid,
  source text default 'manual' check (source in ('brain_dump', 'journal', 'manual', 'voice')),
  created_at timestamptz default now()
);

alter table tasks enable row level security;
create policy "Users own tasks" on tasks
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_tasks_user_status on tasks(user_id, status, position);
create index idx_tasks_due_date on tasks(user_id, due_date);

-- ─── Fitness Plans ────────────────────────────────────────────────────────────
create table fitness_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  name text not null,
  goal_type text,
  weeks int default 12,
  days_per_week int default 4,
  split_structure jsonb default '[]'::jsonb,
  active boolean default true,
  created_at timestamptz default now()
);

alter table fitness_plans enable row level security;
create policy "Users own fitness plans" on fitness_plans
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Workout Sessions ─────────────────────────────────────────────────────────
create table workout_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  plan_id uuid references fitness_plans on delete set null,
  date date not null,
  exercises jsonb default '[]'::jsonb,
  duration_minutes int,
  total_volume_lbs int default 0,
  strain_contribution decimal default 0,
  recovery_at_start int,
  notes text default '',
  healthkit_workout_id text,
  created_at timestamptz default now()
);

alter table workout_sessions enable row level security;
create policy "Users own workout sessions" on workout_sessions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_workout_sessions_user_date on workout_sessions(user_id, date desc);

-- ─── Nutrition Logs ───────────────────────────────────────────────────────────
create table nutrition_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  date date not null,
  entries jsonb default '[]'::jsonb,
  totals jsonb default '{"calories":0,"protein":0,"carbs":0,"fat":0}'::jsonb,
  training_day boolean default false,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table nutrition_logs enable row level security;
create policy "Users own nutrition logs" on nutrition_logs
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Habits ───────────────────────────────────────────────────────────────────
create table habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  title text not null,
  frequency text default 'daily' check (frequency in ('daily', 'weekly')),
  completion_log jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table habits enable row level security;
create policy "Users own habits" on habits
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Body Measurements ────────────────────────────────────────────────────────
create table body_measurements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  date date not null,
  weight_lbs decimal,
  waist_in decimal,
  hips_in decimal,
  chest_in decimal,
  arms_in decimal,
  notes text default ''
);

alter table body_measurements enable row level security;
create policy "Users own measurements" on body_measurements
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Mobility Scores ──────────────────────────────────────────────────────────
create table mobility_scores (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  workout_session_id uuid references workout_sessions on delete cascade,
  date date not null,
  score int check (score between 1 and 5),
  area text check (area in ('back', 'shoulders', 'general'))
);

alter table mobility_scores enable row level security;
create policy "Users own mobility scores" on mobility_scores
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Projects (Founder HQ) ────────────────────────────────────────────────────
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  title text not null,
  status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
  description text default '',
  created_at timestamptz default now()
);

alter table projects enable row level security;
create policy "Users own projects" on projects
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Space Captures ───────────────────────────────────────────────────────────
create table captures (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users on delete cascade not null,
  type text not null check (type in ('text', 'drawing', 'voice')),
  content text default '',
  transcription text,
  created_at timestamptz default now()
);

alter table captures enable row level security;
create policy "Users own captures" on captures
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_captures_user_date on captures(user_id, created_at desc);

-- ─── Updated at trigger ───────────────────────────────────────────────────────
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger journal_entries_updated_at
  before update on journal_entries
  for each row execute function handle_updated_at();

create trigger stroke_data_updated_at
  before update on stroke_data
  for each row execute function handle_updated_at();
