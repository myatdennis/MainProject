/*
  # Learning Management System Database Schema

  1. New Tables
    - `user_profiles` - Extended user information for learners
    - `courses` - Course definitions and metadata
    - `modules` - Course modules/sections
    - `lessons` - Individual lessons within modules
    - `user_course_enrollments` - Track user enrollments in courses
    - `user_lesson_progress` - Track individual lesson completion and progress
    - `user_quiz_attempts` - Track quiz attempts and scores
    - `user_reflections` - Store user notes and reflections

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Add policies for admins to manage all data

  3. Features
    - Progress tracking with timestamps
    - Quiz attempt history with scores
    - Reflection and note storage
    - Course enrollment management
*/

-- User profiles for extended information
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  organization text,
  role text,
  cohort text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  thumbnail text,
  duration text,
  difficulty text DEFAULT 'Beginner' CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
  estimated_time text,
  prerequisites text[] DEFAULT '{}',
  learning_objectives text[] DEFAULT '{}',
  key_takeaways text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  type text DEFAULT 'Mixed',
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  due_date timestamptz
);

-- Modules table
CREATE TABLE IF NOT EXISTS modules (
  id text PRIMARY KEY,
  course_id text REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  duration text,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id text PRIMARY KEY,
  module_id text REFERENCES modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('video', 'interactive', 'quiz', 'download', 'text')),
  duration text,
  order_index integer NOT NULL,
  content jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User course enrollments
CREATE TABLE IF NOT EXISTS user_course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_accessed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- User lesson progress
CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id text REFERENCES lessons(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  time_spent integer DEFAULT 0, -- in seconds
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_accessed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Quiz attempts
CREATE TABLE IF NOT EXISTS user_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id text REFERENCES lessons(id) ON DELETE CASCADE,
  attempt_number integer DEFAULT 1,
  score integer DEFAULT 0,
  max_score integer DEFAULT 0,
  percentage integer DEFAULT 0,
  answers jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  passed boolean DEFAULT false
);

-- User reflections and notes
CREATE TABLE IF NOT EXISTS user_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id text REFERENCES lessons(id) ON DELETE CASCADE,
  content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reflections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for courses (read-only for learners, full access for admins)
CREATE POLICY "Anyone can read published courses"
  ON courses
  FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE POLICY "Admins can manage all courses"
  ON courses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- RLS Policies for modules
CREATE POLICY "Anyone can read modules of published courses"
  ON modules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = modules.course_id 
      AND courses.status = 'published'
    )
  );

CREATE POLICY "Admins can manage all modules"
  ON modules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- RLS Policies for lessons
CREATE POLICY "Anyone can read lessons of published courses"
  ON lessons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM modules 
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id 
      AND courses.status = 'published'
    )
  );

CREATE POLICY "Admins can manage all lessons"
  ON lessons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- RLS Policies for user_course_enrollments
CREATE POLICY "Users can read own enrollments"
  ON user_course_enrollments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own enrollments"
  ON user_course_enrollments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_lesson_progress
CREATE POLICY "Users can read own lesson progress"
  ON user_lesson_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own lesson progress"
  ON user_lesson_progress
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_quiz_attempts
CREATE POLICY "Users can read own quiz attempts"
  ON user_quiz_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own quiz attempts"
  ON user_quiz_attempts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_reflections
CREATE POLICY "Users can read own reflections"
  ON user_reflections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own reflections"
  ON user_reflections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin policies for viewing all data
CREATE POLICY "Admins can read all user data"
  ON user_course_enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can read all lesson progress"
  ON user_lesson_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can read all quiz attempts"
  ON user_quiz_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can read all reflections"
  ON user_reflections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_user_course_enrollments_user_id ON user_course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_enrollments_course_id ON user_course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user_id ON user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson_id ON user_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_attempts_user_id ON user_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_attempts_lesson_id ON user_quiz_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_reflections_user_id ON user_reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reflections_lesson_id ON user_reflections(lesson_id);/*
  # Update RLS policies for courses table

  1. Security Updates
    - Add policy for authenticated users to insert courses
    - Add policy for authenticated users to update courses
    - Ensure proper access control for course management
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage all courses" ON courses;
DROP POLICY IF EXISTS "Anyone can read published courses" ON courses;

-- Create new policies with proper authentication
CREATE POLICY "Authenticated users can read published courses"
  ON courses
  FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE POLICY "Authenticated users can manage courses"
  ON courses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;/*
  # Fix RLS Policies for Courses Table

  1. Security Updates
    - Drop existing restrictive policies on courses table
    - Add policy for anonymous users to read published courses
    - Add policy for authenticated users to manage all courses
    - Add policy for service role to have full access

  2. Changes
    - Allow anon role to SELECT published courses
    - Allow authenticated role to INSERT, UPDATE, DELETE courses
    - Allow service_role to have full access for initialization
*/

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Authenticated users can manage courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can read published courses" ON courses;

-- Allow anonymous users to read published courses
CREATE POLICY "Anonymous users can read published courses"
  ON courses
  FOR SELECT
  TO anon
  USING (status = 'published');

-- Allow authenticated users to read all courses
CREATE POLICY "Authenticated users can read all courses"
  ON courses
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert courses
CREATE POLICY "Authenticated users can insert courses"
  ON courses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update courses
CREATE POLICY "Authenticated users can update courses"
  ON courses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete courses
CREATE POLICY "Authenticated users can delete courses"
  ON courses
  FOR DELETE
  TO authenticated
  USING (true);

-- Allow service role full access for system operations
CREATE POLICY "Service role has full access"
  ON courses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Create Storage Buckets for Course Content

  1. Storage Buckets
    - `course-videos` - For video content uploads
    - `course-resources` - For downloadable resources (PDFs, documents, etc.)

  2. Security
    - Public read access for course content
    - Authenticated write access for admins
    - Proper file size and type restrictions
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('course-videos', 'course-videos', true),
  ('course-resources', 'course-resources', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for course-videos bucket
CREATE POLICY "Public can view course videos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'course-videos');

CREATE POLICY "Authenticated users can upload course videos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'course-videos');

CREATE POLICY "Authenticated users can update course videos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'course-videos');

CREATE POLICY "Authenticated users can delete course videos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'course-videos');

-- Create policies for course-resources bucket
CREATE POLICY "Public can view course resources"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'course-resources');

CREATE POLICY "Authenticated users can upload course resources"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'course-resources');

CREATE POLICY "Authenticated users can update course resources"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'course-resources');

CREATE POLICY "Authenticated users can delete course resources"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'course-resources');/*
  # Update Storage Configuration for Video Files

  1. Storage Buckets
    - Update `course-videos` bucket with larger file size limits
    - Update `course-resources` bucket for other file types
  
  2. File Size Limits
    - Set course-videos bucket to 100MB limit
    - Set course-resources bucket to 50MB limit
  
  3. MIME Type Restrictions
    - Allow video formats: mp4, webm, mov, avi
    - Allow document formats: pdf, doc, docx, ppt, pptx
*/

-- Update storage bucket policies for larger file uploads
UPDATE storage.buckets 
SET file_size_limit = 104857600 -- 100MB
WHERE id = 'course-videos';

UPDATE storage.buckets 
SET file_size_limit = 52428800 -- 50MB  
WHERE id = 'course-resources';

-- Update bucket policies to allow specific MIME types
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'video/mp4',
  'video/webm', 
  'video/quicktime',
  'video/x-msvideo'
]
WHERE id = 'course-videos';

UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif'
]
WHERE id = 'course-resources';-- Add survey_assignments table to persist survey -> organization assignments

CREATE TABLE IF NOT EXISTS survey_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id text NOT NULL,
  organization_ids text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (survey_id)
);

-- Enable RLS and admin polcies can be added as needed
ALTER TABLE survey_assignments ENABLE ROW LEVEL SECURITY;
/*
  # Ensure courses have slugs for id/slug routing support

  1. Schema Changes
    - Add nullable slug column to courses table if it does not already exist
    - Backfill existing rows with a slug derived from id/title
    - Add unique index on slug for fast lookup
*/

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing slug values when absent
UPDATE courses
SET slug = COALESCE(
  slug,
  CASE
    WHEN title IS NOT NULL THEN
      regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')
    ELSE id
  END
)
WHERE slug IS NULL;

-- Ensure all slugs are lowercase and trimmed
UPDATE courses
SET slug = trim(both '-' from regexp_replace(lower(slug), '-{2,}', '-', 'g'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_slug ON courses (slug);
/*
  # Course Assignments table

  1. Structure
    - Stores learner assignments to courses with progress metadata
    - Tracks due dates, notes, and assignee metadata

  2. Security
    - Enables RLS with permissive authenticated policies (tighten in production)
*/

CREATE TABLE IF NOT EXISTS course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in-progress', 'completed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  due_date timestamptz,
  note text,
  assigned_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_assignments_user_id ON course_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_course_assignments_course_id ON course_assignments (course_id);

ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read course assignments"
  ON course_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert course assignments"
  ON course_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update course assignments"
  ON course_assignments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete course assignments"
  ON course_assignments
  FOR DELETE
  TO authenticated
  USING (true);
-- Learning goals and achievements tables for learner progress dashboard

CREATE TABLE IF NOT EXISTS user_learning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  target_date date,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'overdue')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, title)
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  earned_date date,
  icon text,
  rarity text DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, title)
);

ALTER TABLE user_learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own learning goals"
  ON user_learning_goals
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can manage own achievements"
  ON user_achievements
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
-- Ensure required extensions are available
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Core course catalog tables
create table if not exists public.courses (
  id text primary key default gen_random_uuid()::text,
  organization_id text,
  slug text unique,
  title text not null,
  description text,
  status text not null default 'draft',
  version integer not null default 1,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'published_at'
  ) then
    alter table public.courses add column published_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'due_date'
  ) then
    alter table public.courses add column due_date timestamptz;
  end if;
end$$;

create table if not exists public.modules (
  id text primary key default gen_random_uuid()::text,
  course_id text not null references public.courses(id) on delete cascade,
  order_index integer not null default 0,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists modules_course_idx on public.modules(course_id, order_index);

create table if not exists public.lessons (
  id text primary key default gen_random_uuid()::text,
  module_id text not null references public.modules(id) on delete cascade,
  order_index integer not null default 0,
  type text not null,
  title text not null,
  description text,
  duration_s integer,
  content_json jsonb not null default '{}'::jsonb,
  completion_rule_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lessons_module_idx on public.lessons(module_id, order_index);

-- Assignment + enrolment bridge
create table if not exists public.assignments (
  id text primary key default gen_random_uuid()::text,
  organization_id text,
  course_id text not null references public.courses(id) on delete cascade,
  user_id text,
  due_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignments_org_course_idx on public.assignments(organization_id, course_id);
create index if not exists assignments_user_idx on public.assignments(user_id);

-- Progress tracking
create table if not exists public.user_course_progress (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  course_id text not null references public.courses(id) on delete cascade,
  percent numeric(5,2) not null default 0,
  status text not null default 'not_started',
  time_spent_s integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists user_course_progress_unique on public.user_course_progress(user_id, course_id);

create table if not exists public.user_lesson_progress (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  lesson_id text not null references public.lessons(id) on delete cascade,
  percent numeric(5,2) not null default 0,
  status text not null default 'not_started',
  time_spent_s integer not null default 0,
  resume_at_s integer,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists user_lesson_progress_unique on public.user_lesson_progress(user_id, lesson_id);

-- Certificates
create table if not exists public.certificates (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  course_id text not null references public.courses(id) on delete cascade,
  issued_at timestamptz not null default now(),
  pdf_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists certificates_user_course_idx on public.certificates(user_id, course_id);

-- Trigger helpers to keep updated_at current
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'courses_set_updated_at') then
    create trigger courses_set_updated_at
    before update on public.courses
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'modules_set_updated_at') then
    create trigger modules_set_updated_at
    before update on public.modules
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'lessons_set_updated_at') then
    create trigger lessons_set_updated_at
    before update on public.lessons
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'assignments_set_updated_at') then
    create trigger assignments_set_updated_at
    before update on public.assignments
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'user_course_progress_set_updated_at') then
    create trigger user_course_progress_set_updated_at
    before update on public.user_course_progress
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'user_lesson_progress_set_updated_at') then
    create trigger user_lesson_progress_set_updated_at
    before update on public.user_lesson_progress
    for each row execute function public.set_updated_at();
  end if;
end$$;

-- Development seed (idempotent)
insert into public.courses (id, title, status)
select '00000000-0000-0000-0000-000000000001', 'Sample Inclusive Leadership Course', 'published'
where not exists (select 1 from public.courses where id = '00000000-0000-0000-0000-000000000001');
create extension if not exists "uuid-ossp";

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  course_id text,
  lesson_id text,
  module_id text,
  event_type text not null,
  session_id text,
  user_agent text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_idx on public.analytics_events(user_id, created_at desc);
create index if not exists analytics_events_course_idx on public.analytics_events(course_id, created_at desc);

create table if not exists public.learner_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  course_id text not null,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_at timestamptz,
  total_time_spent integer not null default 0,
  sessions_count integer not null default 0,
  progress_percentage numeric(5,2) not null default 0,
  engagement_score numeric(5,2) not null default 0,
  milestones jsonb not null default '[]'::jsonb,
  drop_off_points jsonb not null default '[]'::jsonb,
  path_taken jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists learner_journeys_user_course_idx on public.learner_journeys(user_id, course_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'learner_journeys_set_updated_at') then
    create trigger learner_journeys_set_updated_at
    before update on public.learner_journeys
    for each row execute function public.set_updated_at();
  end if;
end$$;
create extension if not exists "uuid-ossp";

create table if not exists public.organizations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  type text,
  description text,
  logo text,
  contact_person text,
  contact_email text not null,
  contact_phone text,
  website text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  subscription text not null,
  billing_email text,
  billing_cycle text,
  custom_pricing numeric,
  max_learners integer,
  max_courses integer,
  max_storage integer,
  features jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  enrollment_date timestamptz,
  contract_start timestamptz,
  contract_end timestamptz,
  total_learners integer not null default 0,
  active_learners integer not null default 0,
  completion_rate numeric(5,2) not null default 0,
  cohorts jsonb not null default '[]'::jsonb,
  last_activity timestamptz,
  modules jsonb not null default '{}'::jsonb,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_status_idx on public.organizations(status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'organizations_set_updated_at') then
    create trigger organizations_set_updated_at
    before update on public.organizations
    for each row execute function public.set_updated_at();
  end if;
end$$;
create extension if not exists "uuid-ossp";

create table if not exists public.documents (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  filename text,
  url text,
  category text not null,
  subcategory text,
  tags jsonb not null default '[]'::jsonb,
  file_type text,
  visibility text not null default 'global',
  org_id text,
  user_id text,
  created_at timestamptz not null default now(),
  created_by text,
  download_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists documents_visibility_idx on public.documents(visibility);
create index if not exists documents_org_idx on public.documents(org_id);
create index if not exists documents_user_idx on public.documents(user_id);
create index if not exists documents_category_idx on public.documents(category);

create or replace function public.increment_document_download(doc_id text)
returns public.documents as $$
  update public.documents
     set download_count = download_count + 1
   where id = doc_id
   returning *;
$$ language sql security definer;
create extension if not exists "uuid-ossp";

create table if not exists public.surveys (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  type text,
  status text not null default 'draft',
  sections jsonb not null default '[]'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  assigned_to jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surveys_status_idx on public.surveys(status);
create index if not exists surveys_type_idx on public.surveys(type);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'surveys_set_updated_at') then
    create trigger surveys_set_updated_at
    before update on public.surveys
    for each row execute function public.set_updated_at();
  end if;
end$$;
create extension if not exists "uuid-ossp";

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  body text,
  org_id text,
  user_id text,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

create index if not exists notifications_org_idx on public.notifications(org_id);
create index if not exists notifications_user_idx on public.notifications(user_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'notifications_set_updated_at') then
    create trigger notifications_set_updated_at
    before update on public.notifications
    for each row execute function public.set_updated_at();
  end if;
end$$;
create extension if not exists "uuid-ossp";

create table if not exists public.org_workspace_strategic_plans (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  content text not null,
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_workspace_strategic_plans_org_idx on public.org_workspace_strategic_plans(org_id);

create table if not exists public.org_workspace_session_notes (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  title text not null,
  body text,
  note_date timestamptz not null default now(),
  tags jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_workspace_session_notes_org_idx on public.org_workspace_session_notes(org_id);
create index if not exists org_workspace_session_notes_date_idx on public.org_workspace_session_notes(note_date desc);

create table if not exists public.org_workspace_action_items (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  assignee text,
  due_at timestamptz,
  status text not null default 'Not Started',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_workspace_action_items_org_idx on public.org_workspace_action_items(org_id);
create index if not exists org_workspace_action_items_status_idx on public.org_workspace_action_items(status);
create index if not exists org_workspace_action_items_due_idx on public.org_workspace_action_items(due_at);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'org_workspace_strategic_plans_set_updated_at') then
    create trigger org_workspace_strategic_plans_set_updated_at
      before update on public.org_workspace_strategic_plans
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'org_workspace_session_notes_set_updated_at') then
    create trigger org_workspace_session_notes_set_updated_at
      before update on public.org_workspace_session_notes
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'org_workspace_action_items_set_updated_at') then
    create trigger org_workspace_action_items_set_updated_at
      before update on public.org_workspace_action_items
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.org_workspace_strategic_plans enable row level security;
alter table public.org_workspace_session_notes enable row level security;
alter table public.org_workspace_action_items enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Authenticated access to strategic plans" on public.org_workspace_strategic_plans;
drop policy if exists "Authenticated access to session notes" on public.org_workspace_session_notes;
drop policy if exists "Authenticated access to action items" on public.org_workspace_action_items;
drop policy if exists "Service role access to strategic plans" on public.org_workspace_strategic_plans;
drop policy if exists "Service role access to session notes" on public.org_workspace_session_notes;
drop policy if exists "Service role access to action items" on public.org_workspace_action_items;
drop policy if exists "Authenticated access to notifications" on public.notifications;
drop policy if exists "Service role access to notifications" on public.notifications;

create policy "Authenticated access to strategic plans"
  on public.org_workspace_strategic_plans
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role access to strategic plans"
  on public.org_workspace_strategic_plans
  for all
  to service_role
  using (true)
  with check (true);

create policy "Authenticated access to session notes"
  on public.org_workspace_session_notes
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role access to session notes"
  on public.org_workspace_session_notes
  for all
  to service_role
  using (true)
  with check (true);

create policy "Authenticated access to action items"
  on public.org_workspace_action_items
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role access to action items"
  on public.org_workspace_action_items
  for all
  to service_role
  using (true)
  with check (true);

create policy "Authenticated access to notifications"
  on public.notifications
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role access to notifications"
  on public.notifications
  for all
  to service_role
  using (true)
  with check (true);
create extension if not exists "uuid-ossp";

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_memberships_unique on public.organization_memberships(org_id, user_id);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'organization_memberships_set_updated_at') then
    create trigger organization_memberships_set_updated_at
      before update on public.organization_memberships
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.organization_memberships enable row level security;

drop policy if exists "Members can view their membership" on public.organization_memberships;
drop policy if exists "Org admins manage memberships" on public.organization_memberships;
drop policy if exists "Service role access to memberships" on public.organization_memberships;

create policy "Members can view their membership"
  on public.organization_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Org admins manage memberships"
  on public.organization_memberships
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = organization_memberships.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = organization_memberships.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner')
    )
  );

create policy "Service role access to memberships"
  on public.organization_memberships
  for all
  to service_role
  using (true)
  with check (true);

-- Harden workspace policies to leverage organization membership roles
drop policy if exists "Authenticated access to strategic plans" on public.org_workspace_strategic_plans;
drop policy if exists "Service role access to strategic plans" on public.org_workspace_strategic_plans;
drop policy if exists "Authenticated access to session notes" on public.org_workspace_session_notes;
drop policy if exists "Service role access to session notes" on public.org_workspace_session_notes;
drop policy if exists "Authenticated access to action items" on public.org_workspace_action_items;
drop policy if exists "Service role access to action items" on public.org_workspace_action_items;

create policy "Members read strategic plans"
  on public.org_workspace_strategic_plans
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_strategic_plans.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "Editors manage strategic plans"
  on public.org_workspace_strategic_plans
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_strategic_plans.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_strategic_plans.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  );

create policy "Members read session notes"
  on public.org_workspace_session_notes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_session_notes.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "Editors manage session notes"
  on public.org_workspace_session_notes
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_session_notes.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_session_notes.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  );

create policy "Members read action items"
  on public.org_workspace_action_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_action_items.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "Editors manage action items"
  on public.org_workspace_action_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_action_items.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_action_items.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  );

create policy "Service role access to strategic plans"
  on public.org_workspace_strategic_plans
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role access to session notes"
  on public.org_workspace_session_notes
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role access to action items"
  on public.org_workspace_action_items
  for all
  to service_role
  using (true)
  with check (true);

-- Align notifications table to membership awareness
alter table public.notifications
  alter column user_id type uuid using nullif(user_id, '')::uuid;

alter table public.notifications enable row level security;

drop policy if exists "Authenticated access to notifications" on public.notifications;
drop policy if exists "Service role access to notifications" on public.notifications;

create policy "Users read their notifications"
  on public.notifications
  for select
  to authenticated
  using (
    (user_id is not null and user_id = auth.uid())
    or (
      org_id is not null and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = notifications.org_id
          and m.user_id = auth.uid()
      )
    )
  );

create policy "Org editors manage notifications"
  on public.notifications
  for all
  to authenticated
  using (
    org_id is null and user_id = auth.uid()
    or (
      org_id is not null and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = notifications.org_id
          and m.user_id = auth.uid()
          and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
      )
    )
  )
  with check (
    org_id is null and user_id = auth.uid()
    or (
      org_id is not null and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = notifications.org_id
          and m.user_id = auth.uid()
          and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
      )
    )
  );

create policy "Service role access to notifications"
  on public.notifications
  for all
  to service_role
  using (true)
  with check (true);
-- Migration placeholder retained to match remote history.
-- Logic superseded by 20251031173857_normalize_documents_updated_trigger.sql.
-- Ensure documents table exists (matches your earlier schema)
create table if not exists public.documents (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  filename text,
  url text,
  category text not null,
  subcategory text,
  tags jsonb not null default '[]'::jsonb,
  file_type text,
  visibility text not null default 'global',
  org_id text,
  user_id text,
  created_at timestamptz not null default now(),
  created_by text,
  download_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

-- Ensure updated_at column
alter table public.documents
  add column if not exists updated_at timestamptz not null default now();

-- Normalize the trigger function (drop anything bad, then recreate)
drop function if exists public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create the trigger if missing
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'documents_set_updated_at'
      and tgrelid = 'public.documents'::regclass
  ) then
    create trigger documents_set_updated_at
      before update on public.documents
      for each row
      execute function public.set_updated_at();
  end if;
end $$;

-- Recreate the download incrementer (NOT a trigger; it's a plain SQL function)
create or replace function public.increment_document_download(doc_id text)
returns public.documents
language sql
security definer
set search_path = public
as $fn$
  update public.documents
     set download_count = download_count + 1,
         updated_at     = now()
   where id = doc_id
   returning *;
$fn$;
-- Persistent courses schema and policies for Edge API

-- Ensure base schema additions exist
alter table public.courses
  add column if not exists organization_id text;

alter table public.courses
  add column if not exists name text;

update public.courses
   set name = coalesce(name, title)
 where name is null;

alter table public.courses
  add column if not exists created_by uuid references auth.users(id);

update public.courses
   set slug = coalesce(nullif(slug, ''), gen_random_uuid()::text)
 where slug is null or slug = '';

alter table public.courses
  alter column name set not null;

alter table public.courses
  alter column slug set not null;

create index if not exists courses_slug_idx on public.courses(slug);

-- Guard the updated_at column via trigger (trigger body already normalized elsewhere)
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'courses_set_updated_at'
  ) then
    create trigger courses_set_updated_at
      before update on public.courses
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Harden row level security
alter table public.courses enable row level security;

drop policy if exists "Courses service role full access" on public.courses;
drop policy if exists "Courses admin manage" on public.courses;
drop policy if exists "Courses member read" on public.courses;
drop policy if exists "Courses owner update" on public.courses;
drop policy if exists "Courses owner delete" on public.courses;

create policy "Courses service role full access"
  on public.courses
  for all
  to service_role
  using (true)
  with check (true);

create policy "Courses admin manage"
  on public.courses
  for all
  to authenticated
  using (
    public.courses.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.courses.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner')
    )
  )
  with check (
    public.courses.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.courses.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner')
    )
  );

create policy "Courses member read"
  on public.courses
  for select
  to authenticated
  using (
    public.courses.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.courses.organization_id
        and m.user_id = auth.uid()
    )
  );

create policy "Courses owner update"
  on public.courses
  for update
  to authenticated
  using ((public.courses.created_by)::text = auth.uid()::text)
  with check ((public.courses.created_by)::text = auth.uid()::text);

create policy "Courses owner delete"
  on public.courses
  for delete
  to authenticated
  using ((public.courses.created_by)::text = auth.uid()::text);

-- Remove legacy seed course that interferes with smoke tests
delete from public.courses
 where id = '00000000-0000-0000-0000-000000000001'
   and title = 'Sample Inclusive Leadership Course';

-- Ensure notifications can participate in updated_at triggers
alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();
-- Ensure notifications table exposes updated_at for trigger logic
alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'notifications_set_updated_at'
      and tgrelid = 'public.notifications'::regclass
  ) then
    create trigger notifications_set_updated_at
      before update on public.notifications
      for each row execute function public.set_updated_at();
  end if;
end $$;
-- Harden RLS for learning content and progress tables to align with Edge API contract

-- Modules table policies
alter table public.modules enable row level security;

drop policy if exists "Modules service role access" on public.modules;
drop policy if exists "Modules member read" on public.modules;
drop policy if exists "Modules admin manage" on public.modules;

create policy "Modules service role access"
  on public.modules
  for all
  to service_role
  using (true)
  with check (true);

create policy "Modules member read"
  on public.modules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      where c.id = public.modules.course_id
        and (
          c.organization_id is null
          or exists (
            select 1
            from public.organization_memberships m
            where m.org_id = c.organization_id
              and m.user_id = auth.uid()
          )
        )
    )
  );

create policy "Modules admin manage"
  on public.modules
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      join public.organization_memberships m
        on m.org_id = c.organization_id
      where c.id = public.modules.course_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.courses c
      where c.id = public.modules.course_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.courses c
      join public.organization_memberships m
        on m.org_id = c.organization_id
      where c.id = public.modules.course_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.courses c
      where c.id = public.modules.course_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  );

-- Lessons table policies
alter table public.lessons enable row level security;

drop policy if exists "Lessons service role access" on public.lessons;
drop policy if exists "Lessons member read" on public.lessons;
drop policy if exists "Lessons admin manage" on public.lessons;

create policy "Lessons service role access"
  on public.lessons
  for all
  to service_role
  using (true)
  with check (true);

create policy "Lessons member read"
  on public.lessons
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = public.lessons.module_id
        and (
          c.organization_id is null
          or exists (
            select 1
            from public.organization_memberships om
            where om.org_id = c.organization_id
              and om.user_id = auth.uid()
          )
        )
    )
  );

create policy "Lessons admin manage"
  on public.lessons
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      join public.organization_memberships om
        on om.org_id = c.organization_id
      where m.id = public.lessons.module_id
        and om.user_id = auth.uid()
        and lower(coalesce(om.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = public.lessons.module_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      join public.organization_memberships om
        on om.org_id = c.organization_id
      where m.id = public.lessons.module_id
        and om.user_id = auth.uid()
        and lower(coalesce(om.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = public.lessons.module_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  );

-- Assignments table policies
alter table public.assignments enable row level security;

drop policy if exists "Assignments service role access" on public.assignments;
drop policy if exists "Assignments learner read" on public.assignments;
drop policy if exists "Assignments admin manage" on public.assignments;

create policy "Assignments service role access"
  on public.assignments
  for all
  to service_role
  using (true)
  with check (true);

create policy "Assignments learner read"
  on public.assignments
  for select
  to authenticated
  using (
    (public.assignments.user_id is not null and public.assignments.user_id = auth.uid()::text)
    or (
      public.assignments.organization_id is not null and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = public.assignments.organization_id
          and m.user_id = auth.uid()
      )
    )
  );

create policy "Assignments admin manage"
  on public.assignments
  for all
  to authenticated
  using (
    public.assignments.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.assignments.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
  )
  with check (
    public.assignments.organization_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.assignments.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
  );

-- User course progress policies
alter table public.user_course_enrollments enable row level security;

drop policy if exists "Course enrollments service role" on public.user_course_enrollments;
drop policy if exists "Course enrollments self manage" on public.user_course_enrollments;
drop policy if exists "Course enrollments admin read" on public.user_course_enrollments;

create policy "Course enrollments service role"
  on public.user_course_enrollments
  for all
  to service_role
  using (true)
  with check (true);

create policy "Course enrollments self manage"
  on public.user_course_enrollments
  for all
  to authenticated
  using (public.user_course_enrollments.user_id = auth.uid()::text)
  with check (public.user_course_enrollments.user_id = auth.uid()::text);

create policy "Course enrollments admin read"
  on public.user_course_enrollments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      join public.organization_memberships m
        on m.org_id = c.organization_id
      where c.id = public.user_course_enrollments.course_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.courses c
      where c.id = public.user_course_enrollments.course_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  );

-- User lesson progress policies
alter table public.user_lesson_progress enable row level security;

drop policy if exists "Lesson progress service role" on public.user_lesson_progress;
drop policy if exists "Lesson progress self manage" on public.user_lesson_progress;
drop policy if exists "Lesson progress admin read" on public.user_lesson_progress;

create policy "Lesson progress service role"
  on public.user_lesson_progress
  for all
  to service_role
  using (true)
  with check (true);

create policy "Lesson progress self manage"
  on public.user_lesson_progress
  for all
  to authenticated
  using (public.user_lesson_progress.user_id = auth.uid())
  with check (public.user_lesson_progress.user_id = auth.uid());

create policy "Lesson progress admin read"
  on public.user_lesson_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      join public.organization_memberships om
        on om.org_id = c.organization_id
      where l.id = public.user_lesson_progress.lesson_id
        and om.user_id = auth.uid()
        and lower(coalesce(om.role, 'member')) in ('admin', 'owner', 'manager', 'editor')
    )
    or exists (
      select 1
      from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = public.user_lesson_progress.lesson_id
        and c.organization_id is null
        and c.created_by::text = auth.uid()::text
    )
  );

-- Analytics tables should only be accessible via service role
alter table public.analytics_events enable row level security;
alter table public.learner_journeys enable row level security;

drop policy if exists "Analytics events service role" on public.analytics_events;
drop policy if exists "Learner journeys service role" on public.learner_journeys;

create policy "Analytics events service role"
  on public.analytics_events
  for all
  to service_role
  using (true)
  with check (true);

create policy "Learner journeys service role"
  on public.learner_journeys
  for all
  to service_role
  using (true)
  with check (true);
-- Migration: Create progress_events table for idempotent client progress submissions
-- Adds a lightweight events table to deduplicate client-submitted progress events

CREATE TABLE IF NOT EXISTS progress_events (
  id text PRIMARY KEY,
  user_id text,
  course_id text,
  lesson_id text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Optional index for querying by user/course/lesson
CREATE INDEX IF NOT EXISTS idx_progress_events_user_course ON progress_events (user_id, course_id);
-- 2025-11-01 13:00:00 - Harden RLS policies to match actual LMS schema
-- These policies previously referenced placeholder columns (org_id, owner_id, assigned_user_id)
-- which do not exist in the live schema. Update them to use the real columns so the migration executes.

------------------------------------------------------------------------------
-- Courses: published courses are visible to members, drafts limited to owners/admins
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_courses_for_org" ON public.courses;
CREATE POLICY "allow_select_courses_for_org" ON public.courses
  FOR SELECT USING (
    public.courses.status = 'published'
    OR public.courses.organization_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.org_id = public.courses.organization_id
        AND m.user_id = auth.uid()
    )
    OR (public.courses.created_by IS NOT NULL AND public.courses.created_by::text = auth.uid()::text)
  );

DROP POLICY IF EXISTS "allow_manage_courses_for_org_admins" ON public.courses;
CREATE POLICY "allow_manage_courses_for_org_admins" ON public.courses
  FOR ALL USING (
    (
      public.courses.organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.courses.organization_id
          AND m.user_id = auth.uid()
          AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
      )
    )
    OR (
      public.courses.organization_id IS NULL
      AND public.courses.created_by IS NOT NULL
      AND public.courses.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    (
      public.courses.organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.courses.organization_id
          AND m.user_id = auth.uid()
          AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
      )
    )
    OR (
      public.courses.organization_id IS NULL
      AND public.courses.created_by IS NOT NULL
      AND public.courses.created_by::text = auth.uid()::text
    )
  );

------------------------------------------------------------------------------
-- User course enrollments: learners manage their own rows, org admins can read/write
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_course_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_user_see_their_enrollments" ON public.user_course_enrollments;
CREATE POLICY "allow_user_see_their_enrollments" ON public.user_course_enrollments
  FOR SELECT USING (
    public.user_course_enrollments.user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE c.id = public.user_course_enrollments.course_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "allow_manage_enrollments_by_org_admin" ON public.user_course_enrollments;
CREATE POLICY "allow_manage_enrollments_by_org_admin" ON public.user_course_enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE c.id = public.user_course_enrollments.course_id
        AND m.user_id = auth.uid()
        AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.user_course_enrollments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.courses c
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE c.id = public.user_course_enrollments.course_id
        AND m.user_id = auth.uid()
        AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.user_course_enrollments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  );

------------------------------------------------------------------------------
-- Assignments: assignees can read their row, org admins manage scoped assignments
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_user_view_assignments" ON public.assignments;
CREATE POLICY "allow_user_view_assignments" ON public.assignments
  FOR SELECT USING (
    (public.assignments.user_id IS NOT NULL AND public.assignments.user_id::text = auth.uid()::text)
    OR (
      public.assignments.organization_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.assignments.organization_id
          AND m.user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.assignments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "allow_manage_assignments_by_admin" ON public.assignments;
CREATE POLICY "allow_manage_assignments_by_admin" ON public.assignments
  FOR ALL USING (
    (
      public.assignments.organization_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.assignments.organization_id
          AND m.user_id = auth.uid()
          AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.assignments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    (
      public.assignments.organization_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.org_id = public.assignments.organization_id
          AND m.user_id = auth.uid()
          AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = public.assignments.course_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  );

------------------------------------------------------------------------------
-- Lesson progress: learners own their data, org admins can audit
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_user_manage_own_progress" ON public.user_lesson_progress;
CREATE POLICY "allow_user_manage_own_progress" ON public.user_lesson_progress
  FOR ALL USING (
    public.user_lesson_progress.user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules mo ON mo.id = l.module_id
      JOIN public.courses c ON c.id = mo.course_id
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE l.id = public.user_lesson_progress.lesson_id
        AND m.user_id = auth.uid()
        AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules mo ON mo.id = l.module_id
      JOIN public.courses c ON c.id = mo.course_id
      WHERE l.id = public.user_lesson_progress.lesson_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    public.user_lesson_progress.user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules mo ON mo.id = l.module_id
      JOIN public.courses c ON c.id = mo.course_id
      JOIN public.organization_memberships m ON m.org_id = c.organization_id
      WHERE l.id = public.user_lesson_progress.lesson_id
        AND m.user_id = auth.uid()
        AND lower(coalesce(m.role, 'member')) IN ('admin','owner','manager','editor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules mo ON mo.id = l.module_id
      JOIN public.courses c ON c.id = mo.course_id
      WHERE l.id = public.user_lesson_progress.lesson_id
        AND c.organization_id IS NULL
        AND c.created_by::text = auth.uid()::text
    )
  );

------------------------------------------------------------------------------
-- Progress events: users can insert/read their own events, service role has full access
------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.progress_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_insert_progress_events" ON public.progress_events;
CREATE POLICY "allow_insert_progress_events" ON public.progress_events
  FOR INSERT WITH CHECK (
    public.progress_events.user_id::text = auth.uid()::text
  );

DROP POLICY IF EXISTS "allow_select_progress_events" ON public.progress_events;
CREATE POLICY "allow_select_progress_events" ON public.progress_events
  FOR SELECT USING (
    public.progress_events.user_id::text = auth.uid()::text
  );

DROP POLICY IF EXISTS "progress_events_service_role" ON public.progress_events;
CREATE POLICY "progress_events_service_role" ON public.progress_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- End of hardened RLS policies
-- Add helpful indexes for modules and lessons ordering
CREATE INDEX IF NOT EXISTS idx_modules_course_order ON public.modules (course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_module_order ON public.lessons (module_id, order_index);

-- Add FK constraints with cascade if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_modules_course' AND conrelid = 'public.modules'::regclass
  ) THEN
    ALTER TABLE public.modules
      ADD CONSTRAINT fk_modules_course FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_lessons_module' AND conrelid = 'public.lessons'::regclass
  ) THEN
    ALTER TABLE public.lessons
      ADD CONSTRAINT fk_lessons_module FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;
  END IF;
END$$;
-- Add helpful indexes for ordering and lookups
create index if not exists idx_modules_course_order on public.modules (course_id, order_index);
create index if not exists idx_lessons_module_order on public.lessons (module_id, order_index);

-- Ensure FKs exist (ignore errors if already present)
alter table public.modules
  add constraint modules_course_id_fkey
  foreign key (course_id) references public.courses(id)
  on delete cascade;

alter table public.lessons
  add constraint lessons_module_id_fkey
  foreign key (module_id) references public.modules(id)
  on delete cascade;
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
alter table public.documents
  add column if not exists storage_path text,
  add column if not exists url_expires_at timestamptz,
  add column if not exists file_size bigint;

create index if not exists documents_storage_path_idx on public.documents(storage_path);
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
-- Migration: add per-resource version columns and idempotency_keys table
-- Date: 2025-11-07

-- Add version column to modules and lessons to support optimistic checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'version'
  ) THEN
    ALTER TABLE public.modules ADD COLUMN version integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'version'
  ) THEN
    ALTER TABLE public.lessons ADD COLUMN version integer NOT NULL DEFAULT 1;
  END IF;
END$$;

-- Create a generic idempotency_keys table for server-driven deduplication (course upserts, imports, etc.)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id text PRIMARY KEY,
  key_type text NOT NULL,
  resource_id text,
  payload jsonb,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_type_resource ON public.idempotency_keys (key_type, resource_id);

-- Helpful comment: Consumers can insert a row with id = client provided idempotency key before performing
-- the target operation. If the insert fails because the key already exists, treat as deduplicated.
-- Migration: add analytics tables and aggregate views/functions
-- Date: 2025-11-08
-- Dependencies: assumes `public.courses(id)` and `public.lessons(id)` exist (TEXT primary keys from 20250919231840_wild_cliff.sql).
-- This migration augments existing progress tables and can be re-run safely.

-- 1) analytics tables
CREATE TABLE IF NOT EXISTS public.user_course_progress (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_course_progress
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS progress numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_course_progress_course_id ON public.user_course_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_course_progress_user_id ON public.user_course_progress(user_id);

CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  lesson_id text NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS course_id text,
  ADD COLUMN IF NOT EXISTS progress numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_lesson_progress_course_fk'
      AND table_schema = 'public'
      AND table_name = 'user_lesson_progress'
  ) THEN
    ALTER TABLE public.user_lesson_progress
      ADD CONSTRAINT user_lesson_progress_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson_id ON public.user_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_course_id ON public.user_lesson_progress(course_id);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  org_id uuid,
  course_id text REFERENCES public.courses(id) ON DELETE CASCADE,
  question_id text,
  response_text text,
  rating integer, -- optional numeric rating 1-5
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_course_id ON public.survey_responses(course_id);

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending/submitted/graded
  grade numeric(5,2),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments(course_id);

-- 2) aggregate views
-- Course-level completion rate view
CREATE OR REPLACE VIEW public.view_course_completion_rate AS
SELECT
  course_id,
  COUNT(*) FILTER (WHERE TRUE) AS total_users,
  COUNT(*) FILTER (WHERE completed) AS completed_count,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE completed) / NULLIF(COUNT(*),0),2)
  END AS completion_percent,
  MAX(updated_at) AS last_updated
FROM public.user_course_progress
GROUP BY course_id;

-- Course-level avg progress
CREATE OR REPLACE VIEW public.view_course_avg_progress AS
SELECT
  course_id,
  ROUND(AVG(progress)::numeric,2) AS avg_progress,
  MAX(updated_at) AS last_updated
FROM public.user_course_progress
GROUP BY course_id;

-- Lesson-level dropoff: percent of users who started course but did not complete lesson
CREATE OR REPLACE VIEW public.view_lesson_dropoff AS
SELECT
  course_id,
  lesson_id,
  COUNT(*) AS started_count,
  COUNT(*) FILTER (WHERE completed) AS completed_count,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(100.0 * (1 - (COUNT(*) FILTER (WHERE completed) / NULLIF(COUNT(*),0)))::numeric,2)
  END AS dropoff_percent
FROM public.user_lesson_progress
GROUP BY course_id, lesson_id;

-- Engagement score (simple heuristic): combination of avg progress and activity volume
CREATE OR REPLACE FUNCTION public.fn_course_engagement_score(course_identifier text)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT
    ROUND(
      (COALESCE(cp.avg_progress,0) * 0.6) +
      (LEAST(COALESCE(activity.activity_count,0) / 10.0, 40) * 0.4),
      2
    ) AS score
  FROM (
    SELECT avg_progress FROM public.view_course_avg_progress WHERE course_id = course_identifier
  ) cp
  CROSS JOIN (
    SELECT COUNT(*)::numeric AS activity_count FROM (
      SELECT id FROM public.user_course_progress WHERE course_id = course_identifier
      UNION ALL
      SELECT id FROM public.user_lesson_progress WHERE course_id = course_identifier
      UNION ALL
      SELECT id FROM public.survey_responses WHERE course_id = course_identifier
    ) t
  ) activity;
$$;

-- 3) helper view for admin overview
CREATE OR REPLACE VIEW public.view_admin_overview AS
SELECT
  (SELECT COUNT(DISTINCT user_id) FROM public.user_course_progress) AS total_active_learners,
  (SELECT COUNT(DISTINCT org_id) FROM public.user_course_progress WHERE org_id IS NOT NULL) AS total_orgs,
  (SELECT COUNT(DISTINCT course_id) FROM public.user_course_progress) AS total_courses,
  (SELECT ROUND(AVG(avg_progress)::numeric,2) FROM public.view_course_avg_progress) AS platform_avg_progress,
  (SELECT ROUND(AVG(completion_percent)::numeric,2) FROM public.view_course_completion_rate) AS platform_avg_completion
;

-- Grant select permissions to anon/admin roles as appropriate in Supabase projects
-- (Do not grant broadly in production; configure RLS and policies to scope by org/user.)
-- Add organization scoping and RLS to surveys-related tables
-- Date: 2025-12-28

-- 1) Ensure surveys have an organization_id column
alter table public.surveys
  add column if not exists organization_id text references public.organizations(id);

create index if not exists surveys_organization_idx
  on public.surveys(organization_id);

-- 2) Align survey_responses to use organization_id text column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'survey_responses'
      AND column_name = 'org_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'survey_responses'
      AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'alter table public.survey_responses rename column org_id to organization_id';
  END IF;
END $$;

alter table public.survey_responses
  add column if not exists organization_id text;

alter table public.survey_responses
  alter column organization_id type text using (organization_id::text);

alter table public.survey_responses
  drop constraint if exists survey_responses_organization_fk;

alter table public.survey_responses
  add constraint survey_responses_organization_fk
  foreign key (organization_id) references public.organizations(id)
  on delete set null;

create index if not exists survey_responses_org_idx
  on public.survey_responses(organization_id);

-- 3) Harden RLS for surveys table
alter table public.surveys enable row level security;

drop policy if exists "Surveys service" on public.surveys;
drop policy if exists "Surveys member" on public.surveys;
drop policy if exists "Surveys admin" on public.surveys;

drop policy if exists "Surveys service role" on public.surveys;
drop policy if exists "Surveys member read" on public.surveys;
drop policy if exists "Surveys admin manage" on public.surveys;

create policy "Surveys service role"
  on public.surveys
  for all
  to service_role
  using (true)
  with check (true);

create policy "Surveys member read"
  on public.surveys
  for select
  to authenticated
  using (
    public.surveys.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.surveys.organization_id
        and m.user_id = auth.uid()
    )
  );

create policy "Surveys admin manage"
  on public.surveys
  for all
  to authenticated
  using (
    public.surveys.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.surveys.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  )
  with check (
    public.surveys.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.surveys.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  );

-- 4) Harden RLS for survey_responses table
alter table public.survey_responses enable row level security;

drop policy if exists "Survey responses service" on public.survey_responses;
drop policy if exists "Survey responses member" on public.survey_responses;
drop policy if exists "Survey responses admin" on public.survey_responses;

drop policy if exists "Survey responses service role" on public.survey_responses;
drop policy if exists "Survey responses own" on public.survey_responses;
drop policy if exists "Survey responses admin manage" on public.survey_responses;

create policy "Survey responses service role"
  on public.survey_responses
  for all
  to service_role
  using (true)
  with check (true);

create policy "Survey responses own"
  on public.survey_responses
  for select
  to authenticated
  using (
    public.survey_responses.user_id = auth.uid()
    or (
      public.survey_responses.organization_id is not null
      and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = public.survey_responses.organization_id
          and m.user_id = auth.uid()
      )
    )
  );

create policy "Survey responses submit"
  on public.survey_responses
  for insert
  to authenticated
  with check (
    public.survey_responses.user_id = auth.uid()
    and (
      public.survey_responses.organization_id is not null
      and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = public.survey_responses.organization_id
          and m.user_id = auth.uid()
      )
    )
  );

create policy "Survey responses admin manage"
  on public.survey_responses
  for all
  to authenticated
  using (
    public.survey_responses.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.survey_responses.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  )
  with check (
    public.survey_responses.organization_id is not null
    and exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.survey_responses.organization_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  );

-- 5) Survey assignments: ensure RLS enforced with same pattern
alter table public.survey_assignments enable row level security;

drop policy if exists "Survey assignments service role" on public.survey_assignments;
drop policy if exists "Survey assignments member read" on public.survey_assignments;
drop policy if exists "Survey assignments admin manage" on public.survey_assignments;

create policy "Survey assignments service role"
  on public.survey_assignments
  for all
  to service_role
  using (true)
  with check (true);

create policy "Survey assignments member read"
  on public.survey_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from unnest(public.survey_assignments.organization_ids) as org_id
      join public.organization_memberships m on m.org_id = org_id
      where m.user_id = auth.uid()
    )
  );

create policy "Survey assignments admin manage"
  on public.survey_assignments
  for all
  to authenticated
  using (
    exists (
      select 1
      from unnest(public.survey_assignments.organization_ids) as org_id
      join public.organization_memberships m on m.org_id = org_id
      where m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  )
  with check (
    exists (
      select 1
      from unnest(public.survey_assignments.organization_ids) as org_id
      join public.organization_memberships m on m.org_id = org_id
      where m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
    )
  );
-- 2025-12-29 Harden RLS policies to enforce real org scoping
-- This migration normalizes all critical LMS tables so that RLS checks
-- reference the actual organization_id / membership relationships that
-- exist in the schema.

-- Convenience helper to avoid repeating the admin role check inline
create or replace function public._is_org_admin(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
  );
$$;

drop function if exists public._is_org_member;
create or replace function public._is_org_member(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
  );
$$;

------------------------------------------------------------------------------
-- Courses
------------------------------------------------------------------------------
alter table public.courses enable row level security;

drop policy if exists "Courses service role full access" on public.courses;
drop policy if exists "Courses admin manage" on public.courses;
drop policy if exists "Courses member read" on public.courses;
drop policy if exists "Courses owner update" on public.courses;
drop policy if exists "Courses owner delete" on public.courses;
drop policy if exists "allow_select_courses_for_org" on public.courses;
drop policy if exists "allow_manage_courses_for_org_admins" on public.courses;

create policy "courses_service_full_access"
  on public.courses
  for all
  to service_role
  using (true)
  with check (true);

create policy "courses_member_read"
  on public.courses
  for select
  to authenticated
  using (
    public.courses.organization_id is null
    or public._is_org_member(public.courses.organization_id)
    or (public.courses.created_by is not null and public.courses.created_by::text = auth.uid()::text)
  );

create policy "courses_admin_manage"
  on public.courses
  for all
  to authenticated
  using (
    public.courses.organization_id is null
    or public._is_org_admin(public.courses.organization_id)
    or (public.courses.created_by is not null and public.courses.created_by::text = auth.uid()::text)
  )
  with check (
    public.courses.organization_id is null
    or public._is_org_admin(public.courses.organization_id)
    or (public.courses.created_by is not null and public.courses.created_by::text = auth.uid()::text)
  );

------------------------------------------------------------------------------
-- Assignments
------------------------------------------------------------------------------
alter table public.assignments enable row level security;

drop policy if exists "allow_user_view_assignments" on public.assignments;
drop policy if exists "allow_manage_assignments_by_admin" on public.assignments;

drop policy if exists "assignments_service_full_access" on public.assignments;
drop policy if exists "assignments_member_read" on public.assignments;
drop policy if exists "assignments_admin_manage" on public.assignments;

create policy "assignments_service_full_access"
  on public.assignments
  for all
  to service_role
  using (true)
  with check (true);

create policy "assignments_self_access"
  on public.assignments
  for all
  to authenticated
  using (public.assignments.user_id is not null and public.assignments.user_id::text = auth.uid()::text)
  with check (public.assignments.user_id is not null and public.assignments.user_id::text = auth.uid()::text);

create policy "assignments_member_read"
  on public.assignments
  for select
  to authenticated
  using (
    public.assignments.organization_id is not null
    and public._is_org_member(public.assignments.organization_id)
  );

create policy "assignments_admin_manage"
  on public.assignments
  for all
  to authenticated
  using (
    public.assignments.organization_id is not null
    and public._is_org_admin(public.assignments.organization_id)
  )
  with check (
    public.assignments.organization_id is not null
    and public._is_org_admin(public.assignments.organization_id)
  );

------------------------------------------------------------------------------
-- User course progress
------------------------------------------------------------------------------
alter table public.user_course_progress enable row level security;

drop policy if exists "user_course_progress_service" on public.user_course_progress;
drop policy if exists "user_course_progress_self" on public.user_course_progress;
drop policy if exists "user_course_progress_admin" on public.user_course_progress;

create policy "user_course_progress_service"
  on public.user_course_progress
  for all
  to service_role
  using (true)
  with check (true);

create policy "user_course_progress_self"
  on public.user_course_progress
  for all
  to authenticated
  using (public.user_course_progress.user_id::text = auth.uid()::text)
  with check (public.user_course_progress.user_id::text = auth.uid()::text);

create policy "user_course_progress_admin"
  on public.user_course_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      where c.id = public.user_course_progress.course_id
        and (
          c.organization_id is null
          or public._is_org_admin(c.organization_id)
        )
    )
  );

------------------------------------------------------------------------------
-- User lesson progress
------------------------------------------------------------------------------
alter table public.user_lesson_progress enable row level security;

drop policy if exists "allow_user_manage_own_progress" on public.user_lesson_progress;

drop policy if exists "user_lesson_progress_service" on public.user_lesson_progress;
drop policy if exists "user_lesson_progress_self" on public.user_lesson_progress;
drop policy if exists "user_lesson_progress_admin" on public.user_lesson_progress;

create policy "user_lesson_progress_service"
  on public.user_lesson_progress
  for all
  to service_role
  using (true)
  with check (true);

create policy "user_lesson_progress_self"
  on public.user_lesson_progress
  for all
  to authenticated
  using (public.user_lesson_progress.user_id::text = auth.uid()::text)
  with check (public.user_lesson_progress.user_id::text = auth.uid()::text);

create policy "user_lesson_progress_admin"
  on public.user_lesson_progress
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.lessons l
      join public.modules mo on mo.id = l.module_id
      join public.courses c on c.id = mo.course_id
      where l.id = public.user_lesson_progress.lesson_id
        and (
          c.organization_id is null
          or public._is_org_admin(c.organization_id)
        )
    )
  );

------------------------------------------------------------------------------
-- Surveys
------------------------------------------------------------------------------
alter table public.surveys enable row level security;

drop policy if exists "Surveys service" on public.surveys;
drop policy if exists "Surveys member" on public.surveys;
drop policy if exists "Surveys admin" on public.surveys;
drop policy if exists "Surveys service role" on public.surveys;
drop policy if exists "Surveys member read" on public.surveys;
drop policy if exists "Surveys admin manage" on public.surveys;

create policy "surveys_service_full_access"
  on public.surveys
  for all
  to service_role
  using (true)
  with check (true);

create policy "surveys_member_read"
  on public.surveys
  for select
  to authenticated
  using (
    public.surveys.organization_id is null
    or public._is_org_member(public.surveys.organization_id)
  );

create policy "surveys_admin_manage"
  on public.surveys
  for all
  to authenticated
  using (
    public.surveys.organization_id is null
    or public._is_org_admin(public.surveys.organization_id)
  )
  with check (
    public.surveys.organization_id is null
    or public._is_org_admin(public.surveys.organization_id)
  );

------------------------------------------------------------------------------
-- Survey assignments
------------------------------------------------------------------------------
alter table public.survey_assignments enable row level security;

drop policy if exists "Survey assignments service role" on public.survey_assignments;
drop policy if exists "Survey assignments member read" on public.survey_assignments;
drop policy if exists "Survey assignments admin manage" on public.survey_assignments;

create policy "survey_assignments_service"
  on public.survey_assignments
  for all
  to service_role
  using (true)
  with check (true);

create policy "survey_assignments_member_read"
  on public.survey_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from unnest(coalesce(public.survey_assignments.organization_ids, '{}')) as org_id
      where public._is_org_member(org_id)
    )
  );

create policy "survey_assignments_admin_manage"
  on public.survey_assignments
  for all
  to authenticated
  using (
    exists (
      select 1
      from unnest(coalesce(public.survey_assignments.organization_ids, '{}')) as org_id
      where public._is_org_admin(org_id)
    )
  )
  with check (
    exists (
      select 1
      from unnest(coalesce(public.survey_assignments.organization_ids, '{}')) as org_id
      where public._is_org_admin(org_id)
    )
  );

------------------------------------------------------------------------------
-- Survey responses
------------------------------------------------------------------------------
alter table public.survey_responses enable row level security;

drop policy if exists "Survey responses service" on public.survey_responses;
drop policy if exists "Survey responses member" on public.survey_responses;
drop policy if exists "Survey responses admin" on public.survey_responses;
drop policy if exists "Survey responses service role" on public.survey_responses;
drop policy if exists "Survey responses own" on public.survey_responses;
drop policy if exists "Survey responses submit" on public.survey_responses;
drop policy if exists "Survey responses admin manage" on public.survey_responses;

create policy "survey_responses_service"
  on public.survey_responses
  for all
  to service_role
  using (true)
  with check (true);

create policy "survey_responses_self"
  on public.survey_responses
  for all
  to authenticated
  using (public.survey_responses.user_id::text = auth.uid()::text)
  with check (public.survey_responses.user_id::text = auth.uid()::text);

create policy "survey_responses_member_read"
  on public.survey_responses
  for select
  to authenticated
  using (
    public.survey_responses.organization_id is not null
    and public._is_org_member(public.survey_responses.organization_id)
  );

create policy "survey_responses_admin_manage"
  on public.survey_responses
  for all
  to authenticated
  using (
    public.survey_responses.organization_id is not null
    and public._is_org_admin(public.survey_responses.organization_id)
  )
  with check (
    public.survey_responses.organization_id is not null
    and public._is_org_admin(public.survey_responses.organization_id)
  );
-- Add optimistic version tracking to courses so admin import/upsert APIs can store version numbers
BEGIN;

ALTER TABLE IF EXISTS public.courses
    ADD COLUMN IF NOT EXISTS version integer;

ALTER TABLE IF EXISTS public.courses
    ALTER COLUMN version SET DEFAULT 1;

UPDATE public.courses
   SET version = COALESCE(version, 1)
 WHERE version IS NULL;

ALTER TABLE IF EXISTS public.courses
    ALTER COLUMN version SET NOT NULL;

COMMENT ON COLUMN public.courses.version IS 'Optimistic concurrency/version counter for admin upserts and imports';

COMMIT;
-- Phase 7: Analytics ingestion pipeline + org aware views
-- Date: 2026-01-04

create table if not exists public.analytics_event_batches (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null,
  org_id uuid,
  course_id uuid,
  lesson_id uuid,
  user_id uuid,
  event_type text not null,
  status text not null default 'accepted',
  error text,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists analytics_event_batches_client_event_id_idx
  on public.analytics_event_batches(client_event_id);
create index if not exists analytics_event_batches_org_id_idx
  on public.analytics_event_batches(org_id);
create index if not exists analytics_event_batches_course_id_idx
  on public.analytics_event_batches(course_id);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_event_batches(id) on delete cascade,
  org_id uuid,
  course_id uuid,
  lesson_id uuid,
  user_id uuid,
  event_name text not null,
  event_version text,
  properties jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists analytics_events_batch_id_idx on public.analytics_events(batch_id);
create index if not exists analytics_events_org_course_idx on public.analytics_events(org_id, course_id);
create index if not exists analytics_events_occurred_at_idx on public.analytics_events(occurred_at);

create table if not exists public.analytics_dead_letters (
  id uuid primary key default gen_random_uuid(),
  client_event_id text,
  payload jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_dead_letters_client_event_id_idx
  on public.analytics_dead_letters(client_event_id);

create table if not exists public.analytics_insights (
  org_id uuid,
  metric text not null,
  value jsonb not null,
  refreshed_at timestamptz not null default now(),
  source text not null default 'batch',
  primary key (org_id, metric)
);

-- Org-aware analytic views
create or replace view public.view_course_completion_rate as
select
  org_id,
  course_id,
  count(*) filter (where true) as total_users,
  count(*) filter (where completed) as completed_count,
  case when count(*) = 0 then 0
       else round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 2)
  end as completion_percent,
  max(updated_at) as last_updated
from public.user_course_progress
group by org_id, course_id;

create or replace view public.view_course_avg_progress as
select
  org_id,
  course_id,
  round(avg(progress)::numeric, 2) as avg_progress,
  max(updated_at) as last_updated
from public.user_course_progress
group by org_id, course_id;

create or replace view public.view_lesson_dropoff as
select
  org_id,
  course_id,
  lesson_id,
  count(*) as started_count,
  count(*) filter (where completed) as completed_count,
  case when count(*) = 0 then 0
       else round(100.0 * (1 - (count(*) filter (where completed) / nullif(count(*), 0)))::numeric, 2)
  end as dropoff_percent
from public.user_lesson_progress
group by org_id, course_id, lesson_id;

create or replace view public.view_admin_overview as
with total_orgs as (
  select count(distinct org_id) as value
  from public.user_course_progress
  where org_id is not null
),
progress as (
  select
    org_id,
    count(distinct user_id) as total_active_learners,
    count(distinct course_id) as total_courses,
    round(avg(progress)::numeric, 2) as platform_avg_progress
  from public.user_course_progress
  group by rollup (org_id)
),
completion as (
  select org_id, round(avg(completion_percent)::numeric, 2) as platform_avg_completion
  from public.view_course_completion_rate
  group by rollup (org_id)
)
select
  progress.org_id,
  progress.total_active_learners,
  (select value from total_orgs) as total_orgs,
  progress.total_courses,
  coalesce(progress.platform_avg_progress, 0) as platform_avg_progress,
  coalesce(completion.platform_avg_completion, 0) as platform_avg_completion
from progress
left join completion on completion.org_id is not distinct from progress.org_id;
-- 2026-01-04 Leadership AI recommendations schema
-- Adds storage + helper view for organization-level leadership insights

create table if not exists public.organization_leadership_recommendations (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  title text not null,
  summary text not null,
  category text not null default 'engagement',
  priority text not null default 'medium',
  impact text,
  status text not null default 'open',
  confidence numeric(5,2),
  tags jsonb not null default '[]'::jsonb,
  data_points jsonb not null default '{}'::jsonb,
  generated_by text not null default 'heuristic',
  ai_model text,
  ai_version text,
  generated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_leadership_recommendations_org_idx on public.organization_leadership_recommendations(org_id);
create index if not exists org_leadership_recommendations_status_idx on public.organization_leadership_recommendations(status);

-- keep updated_at accurate
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'organization_leadership_recommendations_set_updated_at') then
    create trigger organization_leadership_recommendations_set_updated_at
      before update on public.organization_leadership_recommendations
      for each row execute function public.set_updated_at();
  end if;
end$$;

alter table public.organization_leadership_recommendations enable row level security;

drop policy if exists "leadership_recs_service" on public.organization_leadership_recommendations;
drop policy if exists "leadership_recs_member_read" on public.organization_leadership_recommendations;
drop policy if exists "leadership_recs_admin_manage" on public.organization_leadership_recommendations;

create policy "leadership_recs_service"
  on public.organization_leadership_recommendations
  for all
  to service_role
  using (true)
  with check (true);

create policy "leadership_recs_member_read"
  on public.organization_leadership_recommendations
  for select
  to authenticated
  using (public._is_org_member(organization_leadership_recommendations.org_id));

create policy "leadership_recs_admin_manage"
  on public.organization_leadership_recommendations
  for all
  to authenticated
  using (public._is_org_admin(organization_leadership_recommendations.org_id))
  with check (public._is_org_admin(organization_leadership_recommendations.org_id));

-- Aggregate helper view for quick org health lookups
create or replace view public.view_org_leadership_health as
with progress as (
  select
    org_id::text as org_id,
    count(distinct user_id) as active_learners,
    count(*) filter (where completed) as completed_records,
    count(*) as total_records,
    round(avg(progress)::numeric, 2) as avg_progress,
    round(
      case when count(*) = 0 then 0
           else 100.0 * count(*) filter (where completed) / nullif(count(*), 0)
      end,
      2
    ) as completion_rate
  from public.user_course_progress
  group by org_id
),
surveys as (
  select
    org_id::text as org_id,
    round(avg(coalesce(rating, 0))::numeric, 2) as avg_rating,
    count(*) as responses
  from public.survey_responses
  group by org_id
),
dropoffs as (
  select
    c.organization_id::text as org_id,
    max(v.dropoff_percent) as worst_dropoff
  from public.view_lesson_dropoff v
  join public.courses c on c.id = v.course_id
  group by c.organization_id
),
assignments as (
  select
    organization_id::text as org_id,
    count(*) filter (
      where status in ('pending', 'assigned') and due_at is not null and due_at < now()
    ) as overdue_assignments
  from public.assignments
  group by organization_id
)
select
  o.id as org_id,
  o.name,
  coalesce(progress.active_learners, 0) as active_learners,
  coalesce(progress.completion_rate, 0) as completion_rate,
  coalesce(progress.avg_progress, 0) as avg_progress,
  coalesce(surveys.avg_rating, 0) as avg_survey_rating,
  coalesce(surveys.responses, 0) as survey_responses,
  coalesce(assignments.overdue_assignments, 0) as overdue_assignments,
  coalesce(dropoffs.worst_dropoff, 0) as worst_dropoff
from public.organizations o
left join progress on progress.org_id = o.id
left join surveys on surveys.org_id = o.id
left join assignments on assignments.organization_id = o.id
left join dropoffs on dropoffs.org_id = o.id;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Messages table supports admin-to-user/org communications
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id text primary key default gen_random_uuid()::text,
  sender_id text not null,
  recipient_user_id text,
  recipient_org_id text,
  subject text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'delivered',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_recipient_check
    check ((recipient_user_id is not null) or (recipient_org_id is not null))
);

create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists messages_recipient_user_idx on public.messages(recipient_user_id);
create index if not exists messages_recipient_org_idx on public.messages(recipient_org_id);

alter table public.messages
  drop constraint if exists messages_recipient_org_fk,
  drop constraint if exists messages_recipient_user_fk;

-- Optional foreign key to notifications will be established via message_id references

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'messages_set_updated_at') then
    create trigger messages_set_updated_at
      before update on public.messages
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Expand notifications table with typed payloads + linkage to messages
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists type text not null default 'generic',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists message_id text,
  add column if not exists read_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notifications
  alter column user_id drop default,
  alter column user_id type text using user_id::text,
  alter column org_id type text using org_id::text,
  alter column title set default '',
  alter column body set default '';

-- Rename deprecated read flag to is_read to align with API naming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'read'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN read TO is_read;
  END IF;
END$$;

alter table public.notifications
  alter column is_read set default false,
  alter column is_read set not null;

alter table public.notifications
  add constraint notifications_message_fk foreign key (message_id) references public.messages(id) on delete cascade;

create index if not exists notifications_user_unread_idx on public.notifications(user_id, is_read);
create index if not exists notifications_org_idx on public.notifications(org_id);
create index if not exists notifications_type_idx on public.notifications(type);

-- Ensure updated_at trigger exists for notifications as schema evolves
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'notifications_set_updated_at') then
    create trigger notifications_set_updated_at
      before update on public.notifications
      for each row execute function public.set_updated_at();
  end if;
end$$;
-- 2026-01-04 Organization profile + branding tables
create extension if not exists "uuid-ossp";

create table if not exists public.organization_profiles (
  org_id text primary key references public.organizations(id) on delete cascade,
  mission text,
  vision text,
  core_values jsonb not null default '[]'::jsonb,
  dei_priorities jsonb not null default '[]'::jsonb,
  tone_guidelines text,
  accessibility_commitments text,
  preferred_languages text[] not null default '{}'::text[],
  audience_segments jsonb not null default '[]'::jsonb,
  ai_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_ai_refresh_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'organization_profiles_set_updated_at'
  ) then
    create trigger organization_profiles_set_updated_at
      before update on public.organization_profiles
      for each row execute function public.set_updated_at();
  end if;
end$$;

create table if not exists public.organization_branding (
  org_id text primary key references public.organizations(id) on delete cascade,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  typography jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'organization_branding_set_updated_at'
  ) then
    create trigger organization_branding_set_updated_at
      before update on public.organization_branding
      for each row execute function public.set_updated_at();
  end if;
end$$;

create table if not exists public.organization_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  role text,
  type text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_contacts_unique_email unique (org_id, email)
);

create index if not exists organization_contacts_org_id_idx on public.organization_contacts(org_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'organization_contacts_set_updated_at'
  ) then
    create trigger organization_contacts_set_updated_at
      before update on public.organization_contacts
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- Seed rows for existing orgs so RLS lookups succeed
insert into public.organization_profiles (org_id)
select id from public.organizations
on conflict (org_id) do nothing;

insert into public.organization_branding (org_id)
select id from public.organizations
on conflict (org_id) do nothing;

insert into public.organization_contacts (org_id, name, email, role, type, phone, is_primary)
select
  id as org_id,
  contact_person,
  contact_email,
  case when contact_person is not null then 'primary_contact' else null end,
  'primary',
  contact_phone,
  true
from public.organizations
where contact_person is not null and contact_email is not null
on conflict (org_id, email) do nothing;

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------
alter table public.organization_profiles enable row level security;
alter table public.organization_branding enable row level security;
alter table public.organization_contacts enable row level security;

create policy "org_profiles_service"
  on public.organization_profiles
  for all
  to service_role
  using (true)
  with check (true);

create policy "org_profiles_member_read"
  on public.organization_profiles
  for select
  to authenticated
  using (
    public._is_org_member(organization_profiles.org_id)
    or public._is_org_admin(organization_profiles.org_id)
  );

create policy "org_profiles_admin_manage"
  on public.organization_profiles
  for all
  to authenticated
  using (public._is_org_admin(organization_profiles.org_id))
  with check (public._is_org_admin(organization_profiles.org_id));

create policy "org_branding_service"
  on public.organization_branding
  for all
  to service_role
  using (true)
  with check (true);

create policy "org_branding_member_read"
  on public.organization_branding
  for select
  to authenticated
  using (
    public._is_org_member(organization_branding.org_id)
    or public._is_org_admin(organization_branding.org_id)
  );

create policy "org_branding_admin_manage"
  on public.organization_branding
  for all
  to authenticated
  using (public._is_org_admin(organization_branding.org_id))
  with check (public._is_org_admin(organization_branding.org_id));

create policy "org_contacts_service"
  on public.organization_contacts
  for all
  to service_role
  using (true)
  with check (true);

create policy "org_contacts_member_read"
  on public.organization_contacts
  for select
  to authenticated
  using (
    public._is_org_member(organization_contacts.org_id)
    or public._is_org_admin(organization_contacts.org_id)
  );

create policy "org_contacts_admin_manage"
  on public.organization_contacts
  for all
  to authenticated
  using (public._is_org_admin(organization_contacts.org_id))
  with check (public._is_org_admin(organization_contacts.org_id));
-- 2026-01-04 Expand user_profiles with organization + preference fields
alter table if exists public.user_profiles
  add column if not exists organization_id text references public.organizations(id) on delete set null,
  add column if not exists title text,
  add column if not exists department text,
  add column if not exists location text,
  add column if not exists timezone text,
  add column if not exists phone text,
  add column if not exists language text,
  add column if not exists pronouns text,
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists accessibility_prefs jsonb not null default '{}'::jsonb,
  add column if not exists notification_settings jsonb not null default '{}'::jsonb;

-- helper view for quick access to preference summaries
create or replace view public.user_profile_preferences_vw as
select
  up.id as profile_id,
  up.user_id,
  up.organization_id,
  coalesce(up.preferences, '{}'::jsonb) as preferences,
  coalesce(up.accessibility_prefs, '{}'::jsonb) as accessibility_prefs,
  coalesce(up.notification_settings, '{}'::jsonb) as notification_settings,
  up.updated_at
from public.user_profiles up;
-- Phase 8: Batched progress ingestion stored procedure
-- Creates/updates helper used by /api/client/progress/batch to fan events into
-- user_lesson_progress, user_course_progress, and progress_events with a single call.

create or replace function public.upsert_progress_batch(events_json jsonb)
  returns table(accepted text[], duplicates text[])
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  accepted_ids text[];
  duplicate_ids text[];
begin
  with incoming as (
    select
      coalesce(event->>'client_event_id', event->>'clientEventId', event->>'id') as client_event_id,
      nullif(event->>'user_id', '') as user_id,
      nullif(event->>'course_id', '') as course_id,
      nullif(event->>'lesson_id', '') as lesson_id,
      nullif(event->>'org_id', '') as org_id,
      greatest(0, least(100, coalesce((event->>'percent')::numeric, 0))) as progress,
      greatest(0, coalesce(
        (event->>'time_spent_seconds')::integer,
        (event->>'time_spent_s')::integer,
        (event->>'timeSpentSeconds')::integer,
        0
      )) as time_spent_seconds,
      greatest(0, coalesce(
        (event->>'resume_at_seconds')::integer,
        (event->>'resume_at_s')::integer,
        (event->>'position')::integer,
        (event->>'position_seconds')::integer,
        0
      )) as resume_at_seconds,
      coalesce(event->>'status', event->>'event_status') as status,
      coalesce(event->>'event_type', event->>'type') as event_type,
      coalesce(
        (event->>'occurred_at')::timestamptz,
        (event->>'occurredAt')::timestamptz,
        now()
      ) as occurred_at
    from jsonb_array_elements(events_json) as event
  ),
  filtered as (
    select *
    from incoming
    where client_event_id is not null
      and user_id is not null
      and (course_id is not null or lesson_id is not null)
  ),
  deduped as (
    select f.*, (pe.id is not null) as is_duplicate
    from filtered f
    left join public.progress_events pe on pe.id = f.client_event_id
  ),
  inserted_events as (
    insert into public.progress_events (id, user_id, course_id, lesson_id, payload)
    select
      client_event_id,
      user_id,
      course_id,
      lesson_id,
      jsonb_build_object(
        'percent', progress,
        'time_spent_seconds', time_spent_seconds,
        'status', status,
        'event_type', event_type,
        'occurred_at', occurred_at
      )
    from deduped
    where not is_duplicate
    on conflict (id) do nothing
    returning id
  )
  select coalesce(array_agg(id), array[]::text[])
  into accepted_ids
  from inserted_events;

  select coalesce(array_agg(client_event_id), array[]::text[])
  into duplicate_ids
  from deduped
  where is_duplicate;

  -- Fan out lesson-level updates
  with upsert_lessons as (
    insert into public.user_lesson_progress (
      user_id,
      course_id,
      lesson_id,
      org_id,
      progress,
      time_spent_seconds,
      completed,
      updated_at
    )
    select
      d.user_id,
      d.course_id,
      d.lesson_id,
      nullif(d.org_id, ''),
      d.progress,
      greatest(d.time_spent_seconds, d.resume_at_seconds),
      d.progress >= 100 or lower(coalesce(d.status, '')) = 'completed',
      d.occurred_at
    from deduped d
    where not d.is_duplicate and d.lesson_id is not null
    on conflict (user_id, lesson_id) do update set
      progress = greatest(excluded.progress, public.user_lesson_progress.progress),
      time_spent_seconds = greatest(
        coalesce(excluded.time_spent_seconds, 0),
        coalesce(public.user_lesson_progress.time_spent_seconds, 0)
      ),
      completed = public.user_lesson_progress.completed or excluded.completed,
      updated_at = greatest(excluded.updated_at, public.user_lesson_progress.updated_at)
  )
  select 1;

  -- Course-level rollups
  with upsert_courses as (
    insert into public.user_course_progress (
      user_id,
      course_id,
      org_id,
      progress,
      completed,
      updated_at
    )
    select
      d.user_id,
      d.course_id,
      nullif(d.org_id, ''),
      d.progress,
      d.progress >= 100 or lower(coalesce(d.status, '')) = 'completed',
      d.occurred_at
    from deduped d
    where not d.is_duplicate and d.course_id is not null
    on conflict (user_id, course_id) do update set
      progress = greatest(excluded.progress, public.user_course_progress.progress),
      completed = public.user_course_progress.completed or excluded.completed,
      updated_at = greatest(excluded.updated_at, public.user_course_progress.updated_at)
  )
  select 1;

  accepted := coalesce(accepted_ids, array[]::text[]);
  duplicates := coalesce(duplicate_ids, array[]::text[]);
  return next;
  return;
end;
$$;
-- 2026-01-06 Multi-tenant foundation: org RLS, membership canon, helper views
create extension if not exists "uuid-ossp";

-------------------------------------------------------------------------------
-- Helper function: current request user id from JWT claims
-------------------------------------------------------------------------------
create or replace function public._current_request_user_id()
returns uuid
language plpgsql
stable
as $$
declare
  claims json;
  subj text;
begin
  begin
    claims := current_setting('request.jwt.claims', true)::json;
  exception when others then
    return null;
  end;
  if claims ? 'sub' then
    subj := claims->>'sub';
    if subj is not null and subj <> '' then
      return subj::uuid;
    end if;
  end if;
  return null;
end;
$$;

-------------------------------------------------------------------------------
-- Organizations RLS
-------------------------------------------------------------------------------
alter table if exists public.organizations enable row level security;

drop policy if exists "organizations_service" on public.organizations;
drop policy if exists "organizations_member" on public.organizations;
drop policy if exists "organizations_admin" on public.organizations;

drop policy if exists "org_service_full_access" on public.organizations;
drop policy if exists "org_member_read" on public.organizations;
drop policy if exists "org_admin_manage" on public.organizations;

create policy "org_service_full_access"
  on public.organizations
  for all
  to service_role
  using (true)
  with check (true);

create policy "org_member_read"
  on public.organizations
  for select
  to authenticated
  using (
    public._is_org_member(public.organizations.id)
  );

create policy "org_admin_manage"
  on public.organizations
  for all
  to authenticated
  using (public._is_org_admin(public.organizations.id))
  with check (public._is_org_admin(public.organizations.id));

-------------------------------------------------------------------------------
-- Organization memberships canonicalization
-------------------------------------------------------------------------------
alter table if exists public.organization_memberships
  add column if not exists status text not null default 'pending' check (status in ('pending','active','revoked')),
  add column if not exists invited_email text,
  add column if not exists accepted_at timestamptz,
  add column if not exists last_seen_at timestamptz;

update public.organization_memberships
set status = 'active'
where status is null or status = '';

create index if not exists organization_memberships_status_idx
  on public.organization_memberships(status);

create index if not exists organization_memberships_org_status_idx
  on public.organization_memberships(org_id, status);

-------------------------------------------------------------------------------
-- Organization-aware helper views
-------------------------------------------------------------------------------
create or replace view public.organization_membership_vw as
select
  m.id,
  m.org_id,
  m.user_id,
  m.role,
  m.status,
  m.invited_email,
  m.invited_by,
  m.accepted_at,
  m.last_seen_at,
  m.created_at,
  m.updated_at,
  u.email as user_email,
  u.raw_user_meta_data as user_metadata,
  up.first_name,
  up.last_name,
  up.organization_id as profile_org_id
from public.organization_memberships m
left join auth.users u on u.id = m.user_id
left join public.user_profiles up on up.user_id = m.user_id;

grant select on public.organization_membership_vw to authenticated;

grant select on public.organization_membership_vw to service_role;

create or replace view public.user_organizations_vw as
select
  m.user_id,
  m.org_id as organization_id,
  m.role,
  m.status,
  o.name as organization_name,
  o.status as organization_status,
  o.subscription,
  o.features,
  m.accepted_at,
  m.last_seen_at
from public.organization_memberships m
join public.organizations o on o.id = m.org_id;

grant select on public.user_organizations_vw to authenticated;

grant select on public.user_organizations_vw to service_role;

-------------------------------------------------------------------------------
-- Default owner membership trigger
-------------------------------------------------------------------------------
create or replace function public.create_owner_membership_for_org()
returns trigger
language plpgsql
security definer
as $$
declare
  actor uuid;
begin
  actor := public._current_request_user_id();
  if actor is null then
    return new;
  end if;

  insert into public.organization_memberships (org_id, user_id, role, status, invited_by, accepted_at)
  values (new.id, actor, 'owner', 'active', actor, now())
  on conflict (org_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    accepted_at = coalesce(organization_memberships.accepted_at, now());

  return new;
end;
$$;

create trigger organizations_create_owner_membership
  after insert on public.organizations
  for each row execute function public.create_owner_membership_for_org();

-------------------------------------------------------------------------------
-- Convenience org_id indexes for frequently accessed tables
-------------------------------------------------------------------------------
create index if not exists courses_organization_id_idx on public.courses(organization_id);
create index if not exists assignments_organization_id_idx on public.assignments(organization_id);
create index if not exists surveys_organization_id_idx on public.surveys(organization_id);
create index if not exists certificates_organization_id_idx on public.certificates(organization_id);
create index if not exists notifications_organization_id_idx on public.notifications(org_id);
create index if not exists org_workspace_strategic_plans_org_idx on public.org_workspace_strategic_plans(org_id);
create index if not exists org_workspace_session_notes_org_idx on public.org_workspace_session_notes(org_id);
create index if not exists org_workspace_action_items_org_idx on public.org_workspace_action_items(org_id);

-------------------------------------------------------------------------------
-- Ensure helper grants exist for service/auth roles
-------------------------------------------------------------------------------
grant execute on function public._current_request_user_id to authenticated, service_role;
grant execute on function public.create_owner_membership_for_org to authenticated, service_role;
-- 2026-01-07 Client onboarding schema
create extension if not exists "uuid-ossp";

-------------------------------------------------------------------------------
-- Organization columns for onboarding metadata
-------------------------------------------------------------------------------
alter table if exists public.organizations
  add column if not exists slug text,
  add column if not exists timezone text default 'UTC',
  add column if not exists onboarding_status text default 'pending';

do $$
declare
  rec record;
  attempted_slug text;
  suffix integer;
begin
  for rec in select id, name, slug from public.organizations loop
    if rec.slug is not null then
      continue;
    end if;
    attempted_slug := regexp_replace(lower(coalesce(rec.name, rec.id::text)), '[^a-z0-9]+', '-', 'g');
    attempted_slug := trim(both '-' from attempted_slug);
    if attempted_slug is null or attempted_slug = '' then
      attempted_slug := left(rec.id::text, 12);
    end if;
    suffix := 1;
    while exists(select 1 from public.organizations where slug = attempted_slug and id <> rec.id) loop
      suffix := suffix + 1;
      attempted_slug := attempted_slug || '-' || suffix::text;
    end loop;
    update public.organizations set slug = attempted_slug where id = rec.id;
  end loop;
end$$;

create unique index if not exists organizations_slug_unique on public.organizations(slug);

-------------------------------------------------------------------------------
-- Org invites
-------------------------------------------------------------------------------
create table if not exists public.org_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invite_token text not null,
  role text not null default 'member',
  status text not null default 'pending' check (status in ('pending','sent','accepted','revoked','expired','bounced')),
  inviter_id uuid references auth.users(id),
  inviter_email text,
  invited_name text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  last_sent_at timestamptz,
  reminder_count integer not null default 0,
  duplicate_of uuid references public.org_invites(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists org_invites_org_idx on public.org_invites(org_id);
create index if not exists org_invites_status_idx on public.org_invites(status);
create index if not exists org_invites_email_idx on public.org_invites(lower(email));

create unique index if not exists org_invites_pending_unique
  on public.org_invites(org_id, lower(email))
  where status in ('pending','sent');

create trigger org_invites_set_updated_at
  before update on public.org_invites
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Activation steps + events
-------------------------------------------------------------------------------
create table if not exists public.org_activation_steps (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  step text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','blocked')),
  description text,
  completed_at timestamptz,
  actor_id uuid references auth.users(id),
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (org_id, step)
);

create trigger org_activation_steps_set_updated_at
  before update on public.org_activation_steps
  for each row execute function public.set_updated_at();

create table if not exists public.org_activation_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  actor_id uuid references auth.users(id),
  actor_email text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists org_activation_events_org_idx on public.org_activation_events(org_id);
create index if not exists org_activation_events_type_idx on public.org_activation_events(event_type);

-------------------------------------------------------------------------------
-- Progress view aggregates
-------------------------------------------------------------------------------
create or replace view public.org_onboarding_progress_vw as
with step_counts as (
  select
    org_id,
    count(*) as total_steps,
    count(*) filter (where status = 'completed') as completed_steps,
    min(created_at) filter (where step = 'org_created') as org_created_at,
    max(completed_at) filter (where step = 'first_login') as first_login_at
  from public.org_activation_steps
  group by org_id
), invite_counts as (
  select
    org_id,
    count(*) filter (where status in ('pending','sent')) as pending_invites,
    count(*) filter (where status = 'accepted') as accepted_invites,
    count(*) filter (where status = 'pending' and created_at < timezone('utc', now()) - interval '7 days') as stale_invites,
    max(last_sent_at) as last_sent_at
  from public.org_invites
  group by org_id
)
select
  o.id as org_id,
  o.name as org_name,
  coalesce(sc.total_steps, 0) as total_steps,
  coalesce(sc.completed_steps, 0) as completed_steps,
  coalesce(ic.pending_invites, 0) as pending_invites,
  coalesce(ic.accepted_invites, 0) as accepted_invites,
  coalesce(ic.stale_invites, 0) as stale_invites,
  ic.last_sent_at,
  sc.org_created_at,
  sc.first_login_at
from public.organizations o
left join step_counts sc on sc.org_id = o.id
left join invite_counts ic on ic.org_id = o.id;

grant select on public.org_onboarding_progress_vw to authenticated;
grant select on public.org_onboarding_progress_vw to service_role;

-------------------------------------------------------------------------------
-- Row level security
-------------------------------------------------------------------------------
alter table public.org_invites enable row level security;
alter table public.org_activation_steps enable row level security;
alter table public.org_activation_events enable row level security;

create policy if not exists "org_invites_service_full_access"
  on public.org_invites
  for all
  to service_role
  using (true)
  with check (true);

create policy if not exists "org_invites_member_read"
  on public.org_invites
  for select
  to authenticated
  using (public._is_org_member(org_id));

create policy if not exists "org_invites_admin_manage"
  on public.org_invites
  for all
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

create policy if not exists "org_activation_steps_service_full_access"
  on public.org_activation_steps
  for all
  to service_role
  using (true)
  with check (true);

create policy if not exists "org_activation_steps_member_read"
  on public.org_activation_steps
  for select
  to authenticated
  using (public._is_org_member(org_id));

create policy if not exists "org_activation_steps_admin_manage"
  on public.org_activation_steps
  for all
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

create policy if not exists "org_activation_events_service_full_access"
  on public.org_activation_events
  for all
  to service_role
  using (true)
  with check (true);

create policy if not exists "org_activation_events_member_read"
  on public.org_activation_events
  for select
  to authenticated
  using (public._is_org_member(org_id));

create policy if not exists "org_activation_events_admin_manage"
  on public.org_activation_events
  for insert, update, delete
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

-------------------------------------------------------------------------------
-- Convenience grants
-------------------------------------------------------------------------------
grant select, insert, update, delete on public.org_invites to service_role;
grant select on public.org_invites to authenticated;

grant select, insert, update, delete on public.org_activation_steps to service_role;
grant select on public.org_activation_steps to authenticated;

grant select, insert, update, delete on public.org_activation_events to service_role;
grant select on public.org_activation_events to authenticated;
-- 2026-01-07 Additional invite acceptance metadata
alter table if exists public.org_invites
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_user_id uuid references auth.users(id) on delete set null;

create index if not exists org_invites_token_idx on public.org_invites(invite_token);
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-------------------------------------------------------------------------------
-- Organization querying indexes (search + pagination)
-------------------------------------------------------------------------------
create index if not exists organizations_created_desc_idx on public.organizations (created_at desc);
create index if not exists organizations_status_created_idx on public.organizations (status, created_at desc);
create index if not exists organizations_subscription_idx on public.organizations (subscription, created_at desc);
create index if not exists organizations_name_trgm on public.organizations using gin (name gin_trgm_ops);
create index if not exists organizations_contact_trgm on public.organizations using gin (contact_email gin_trgm_ops);

-------------------------------------------------------------------------------
-- Membership + enrollment indexes for large orgs
-------------------------------------------------------------------------------
create index if not exists organization_memberships_org_created_idx on public.organization_memberships(org_id, created_at desc);
create index if not exists organization_memberships_role_idx on public.organization_memberships(org_id, lower(role));
create index if not exists user_course_enrollments_course_enrolled_idx on public.user_course_enrollments(course_id, enrolled_at desc);
create index if not exists user_course_enrollments_course_completed_idx on public.user_course_enrollments(course_id, completed_at desc);

-------------------------------------------------------------------------------
-- Notifications delivery columns + indexes
-------------------------------------------------------------------------------
alter table if exists public.notifications
  add column if not exists dispatch_status text not null default 'pending' check (dispatch_status in ('pending','queued','processing','delivered','failed')),
  add column if not exists channels text[] not null default array['in_app'],
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists scheduled_for timestamptz,
  add column if not exists delivered_at timestamptz;

update public.notifications
set dispatch_status = case when read = true then 'delivered' else 'queued' end
where dispatch_status = 'pending';

create index if not exists notifications_created_desc_idx on public.notifications (created_at desc);
create index if not exists notifications_status_idx on public.notifications (dispatch_status);
create index if not exists notifications_pending_idx on public.notifications (dispatch_status, scheduled_for)
  where dispatch_status in ('pending','queued','processing');

-------------------------------------------------------------------------------
-- Durable audit log storage for compliance
-------------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  org_id uuid references public.organizations(id) on delete set null,
  user_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_org_created_idx on public.audit_logs(org_id, created_at desc);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action);

alter table public.audit_logs enable row level security;

create policy if not exists audit_logs_service_read
  on public.audit_logs
  for select
  to service_role
  using (true);

create policy if not exists audit_logs_service_write
  on public.audit_logs
  for insert
  to service_role
  with check (true);

-------------------------------------------------------------------------------
-- Materialized rollup for dashboard traffic
-------------------------------------------------------------------------------
create materialized view if not exists public.org_enrollment_stats_mv as
select
  c.org_id,
  date_trunc('day', u.enrolled_at) as activity_day,
  count(*) as enrollments,
  count(*) filter (where u.completed_at is not null) as completions
from public.user_course_enrollments u
join public.courses c on c.id = u.course_id
where c.org_id is not null
group by 1, 2;

create unique index if not exists org_enrollment_stats_mv_pk on public.org_enrollment_stats_mv(org_id, activity_day);

grant select on public.org_enrollment_stats_mv to authenticated;
grant select on public.org_enrollment_stats_mv to service_role;

create or replace function public.refresh_org_enrollment_stats_mv()
returns void
language plpgsql
as $$
begin
  refresh materialized view concurrently public.org_enrollment_stats_mv;
end;
$$;

-------------------------------------------------------------------------------
-- Convenience grants
-------------------------------------------------------------------------------
grant select on public.audit_logs to authenticated;

-- 2026-01-08 backend error fixes
-- * Restore user_organizations_vw so membership queries resolve
-- * Allow analytics ingestion to store arbitrary client event ids

BEGIN;

create or replace view public.user_organizations_vw as
select
  m.user_id,
  m.org_id as organization_id,
  m.role,
  m.status,
  o.name as organization_name,
  o.status as organization_status,
  o.subscription,
  o.features,
  m.accepted_at,
  m.last_seen_at
from public.organization_memberships m
join public.organizations o on o.id = m.org_id;

grant select on public.user_organizations_vw to authenticated;
grant select on public.user_organizations_vw to service_role;

alter table if exists public.analytics_events
  add column if not exists client_event_id text;

create unique index if not exists analytics_events_client_event_id_key
  on public.analytics_events(client_event_id)
  where client_event_id is not null;

COMMIT;
-- Restore org_invites table and associated grants/policies in case earlier migration was skipped
BEGIN;

create extension if not exists "uuid-ossp";

-- Ensure helper functions exist for RLS policies (created in 2025-12 hardening migration)
create or replace function public._is_org_admin(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
  );
$$;

create or replace function public._is_org_member(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
  );
$$;

create table if not exists public.org_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id text not null references public.organizations(id) on delete cascade,
  email text not null,
  invite_token text not null,
  role text not null default 'member',
  status text not null default 'pending' check (status in ('pending','sent','accepted','revoked','expired','bounced')),
  inviter_id uuid references auth.users(id),
  inviter_email text,
  invited_name text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  last_sent_at timestamptz,
  reminder_count integer not null default 0,
  duplicate_of uuid references public.org_invites(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists org_invites_org_idx on public.org_invites(org_id);
create index if not exists org_invites_status_idx on public.org_invites(status);
create index if not exists org_invites_email_idx on public.org_invites(lower(email));
create index if not exists org_invites_token_idx on public.org_invites(invite_token);

create unique index if not exists org_invites_pending_unique
  on public.org_invites(org_id, lower(email))
  where status in ('pending','sent');

create trigger org_invites_set_updated_at
  before update on public.org_invites
  for each row execute function public.set_updated_at();

alter table public.org_invites enable row level security;

drop policy if exists "org_invites_service_full_access" on public.org_invites;
create policy "org_invites_service_full_access"
  on public.org_invites
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "org_invites_member_read" on public.org_invites;
create policy "org_invites_member_read"
  on public.org_invites
  for select
  to authenticated
  using (public._is_org_member(org_id));

drop policy if exists "org_invites_admin_manage" on public.org_invites;
create policy "org_invites_admin_manage"
  on public.org_invites
  for all
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

grant select, insert, update, delete on public.org_invites to service_role;
grant select on public.org_invites to authenticated;

COMMIT;
-- STEP 3: Harden schema so server and Supabase stay in sync
-- Ensure consistent memberships surface, learner notifications metadata, and analytics idempotency key support.

BEGIN;

-- 1) Recreate the membership view with the exact columns expected by the server
CREATE OR REPLACE VIEW public.user_organizations_vw AS
SELECT
  om.user_id,
  om.org_id AS organization_id,
  COALESCE(NULLIF(om.role, ''), 'member') AS role,
  'active'::text AS status,
  org.name AS organization_name,
  org.status AS organization_status,
  org.subscription,
  org.features,
  om.created_at AS accepted_at,
  om.updated_at AS last_seen_at
FROM public.organization_memberships AS om
LEFT JOIN public.organizations AS org
  ON org.id = om.org_id;

GRANT SELECT ON public.user_organizations_vw TO anon;
GRANT SELECT ON public.user_organizations_vw TO authenticated;
GRANT SELECT ON public.user_organizations_vw TO service_role;

-- 2) Ensure notifications have a dispatch_status column available for server writes/reads
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dispatch_status text;

UPDATE public.notifications
SET dispatch_status = COALESCE(dispatch_status, 'queued');

ALTER TABLE public.notifications
  ALTER COLUMN dispatch_status SET DEFAULT 'queued';

-- 3) Ensure analytics events can store client_event_id for idempotency
ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS client_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_client_event_id_key
  ON public.analytics_events (client_event_id)
  WHERE client_event_id IS NOT NULL;

COMMIT;
-- Phase 4 media pipeline: course media asset registry + signed URL metadata
create table if not exists public.course_media_assets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  module_id uuid,
  lesson_id uuid,
  org_id uuid,
  bucket text not null,
  storage_path text not null,
  mime_type text,
  bytes bigint,
  checksum text,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  source text default 'api',
  status text default 'uploaded',
  metadata jsonb default '{}'::jsonb,
  signed_url text,
  signed_url_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_media_assets_course_idx on public.course_media_assets(course_id);
create index if not exists course_media_assets_lesson_idx on public.course_media_assets(lesson_id);
create index if not exists course_media_assets_org_idx on public.course_media_assets(org_id);
create index if not exists course_media_assets_storage_idx on public.course_media_assets(bucket, storage_path);

create or replace function public.course_media_assets_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger course_media_assets_updated_at
before update on public.course_media_assets
for each row execute procedure public.course_media_assets_set_updated_at();

alter table public.course_media_assets enable row level security;

drop policy if exists "allow org members" on public.course_media_assets;
create policy "allow org members" on public.course_media_assets
  using (
    org_id is null
    or exists (
      select 1 from public.organization_memberships m
      where m.org_id = course_media_assets.org_id
        and m.user_id = auth.uid()
        and coalesce(m.status, 'active') = 'active'
    )
  );
-- Phase 6 cleanup: enforce org_id presence across analytics artifacts
-- Date: 2026-01-13

begin;

-- Remove legacy rows that still lack org context so refreshed views stay org-scoped
delete from public.analytics_events where org_id is null;
delete from public.analytics_event_batches where org_id is null;
delete from public.user_course_progress where org_id is null;
delete from public.user_lesson_progress where org_id is null;

delete from public.org_enrollment_stats_mv where org_id is null;

-- Rebuild analytics views without org_id rollups/fallbacks
create or replace view public.view_course_completion_rate as
select
  org_id,
  course_id,
  count(*) as total_users,
  count(*) filter (where completed) as completed_count,
  case when count(*) = 0 then 0
       else round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 2)
  end as completion_percent,
  max(updated_at) as last_updated
from public.user_course_progress
where org_id is not null
group by org_id, course_id;

create or replace view public.view_course_avg_progress as
select
  org_id,
  course_id,
  round(avg(progress)::numeric, 2) as avg_progress,
  max(updated_at) as last_updated
from public.user_course_progress
where org_id is not null
group by org_id, course_id;

create or replace view public.view_lesson_dropoff as
select
  org_id,
  course_id,
  lesson_id,
  count(*) as started_count,
  count(*) filter (where completed) as completed_count,
  case when count(*) = 0 then 0
       else round(100.0 * (1 - (count(*) filter (where completed) / nullif(count(*), 0)))::numeric, 2)
  end as dropoff_percent
from public.user_lesson_progress
where org_id is not null
group by org_id, course_id, lesson_id;

create or replace view public.view_admin_overview as
with scoped_progress as (
  select org_id, user_id, course_id, progress, completed, updated_at
  from public.user_course_progress
  where org_id is not null
),
org_counts as (
  select count(distinct org_id) as total_orgs from scoped_progress
),
org_progress as (
  select
    org_id,
    count(distinct user_id) as total_active_learners,
    count(distinct course_id) as total_courses,
    round(avg(progress)::numeric, 2) as platform_avg_progress,
    max(updated_at) as last_updated
  from scoped_progress
  group by org_id
),
org_completion as (
  select org_id, round(avg(completion_percent)::numeric, 2) as platform_avg_completion
  from public.view_course_completion_rate
  where org_id is not null
  group by org_id
)
select
  p.org_id,
  p.total_active_learners,
  (select total_orgs from org_counts) as total_orgs,
  p.total_courses,
  p.platform_avg_progress,
  coalesce(c.platform_avg_completion, 0) as platform_avg_completion,
  p.last_updated
from org_progress p
left join org_completion c on c.org_id = p.org_id;

refresh materialized view public.org_enrollment_stats_mv;

commit;

-- Retune the batched progress ingestion proc to require org_id
create or replace function public.upsert_progress_batch(events_json jsonb)
  returns table(accepted text[], duplicates text[])
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  accepted_ids text[];
  duplicate_ids text[];
  uuid_regex constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  with incoming as (
    select
      coalesce(event->>'client_event_id', event->>'clientEventId', event->>'id') as client_event_id,
      nullif(event->>'user_id', '') as user_id,
      nullif(event->>'course_id', '') as course_id,
      nullif(event->>'lesson_id', '') as lesson_id,
      case when (event->>'org_id') ~* uuid_regex then (event->>'org_id')::uuid else null end as org_id,
      greatest(0, least(100, coalesce((event->>'percent')::numeric, 0))) as progress,
      greatest(0, coalesce(
        (event->>'time_spent_seconds')::integer,
        (event->>'time_spent_s')::integer,
        (event->>'timeSpentSeconds')::integer,
        0
      )) as time_spent_seconds,
      greatest(0, coalesce(
        (event->>'resume_at_seconds')::integer,
        (event->>'resume_at_s')::integer,
        (event->>'position')::integer,
        (event->>'position_seconds')::integer,
        0
      )) as resume_at_seconds,
      coalesce(event->>'status', event->>'event_status') as status,
      coalesce(event->>'event_type', event->>'type') as event_type,
      coalesce(
        (event->>'occurred_at')::timestamptz,
        (event->>'occurredAt')::timestamptz,
        now()
      ) as occurred_at
    from jsonb_array_elements(events_json) as event
  ),
  filtered as (
    select *
    from incoming
    where client_event_id is not null
      and user_id is not null
      and org_id is not null
      and (course_id is not null or lesson_id is not null)
  ),
  deduped as (
    select f.*, (pe.id is not null) as is_duplicate
    from filtered f
    left join public.progress_events pe on pe.id = f.client_event_id
  ),
  inserted_events as (
    insert into public.progress_events (id, user_id, course_id, lesson_id, payload)
    select
      client_event_id,
      user_id,
      course_id,
      lesson_id,
      jsonb_build_object(
        'percent', progress,
        'time_spent_seconds', time_spent_seconds,
        'status', status,
        'event_type', event_type,
        'occurred_at', occurred_at,
        'org_id', org_id::text
      )
    from deduped
    where not is_duplicate
    on conflict (id) do nothing
    returning id
  )
  select coalesce(array_agg(id), array[]::text[])
  into accepted_ids
  from inserted_events;

  select coalesce(array_agg(client_event_id), array[]::text[])
  into duplicate_ids
  from deduped
  where is_duplicate;

  with upsert_lessons as (
    insert into public.user_lesson_progress (
      user_id,
      course_id,
      lesson_id,
      org_id,
      progress,
      time_spent_seconds,
      completed,
      updated_at
    )
    select
      d.user_id,
      d.course_id,
      d.lesson_id,
      d.org_id,
      d.progress,
      greatest(d.time_spent_seconds, d.resume_at_seconds),
      d.progress >= 100 or lower(coalesce(d.status, '')) = 'completed',
      d.occurred_at
    from deduped d
    where not d.is_duplicate and d.lesson_id is not null
    on conflict (user_id, lesson_id) do update set
      progress = greatest(excluded.progress, public.user_lesson_progress.progress),
      time_spent_seconds = greatest(
        coalesce(excluded.time_spent_seconds, 0),
        coalesce(public.user_lesson_progress.time_spent_seconds, 0)
      ),
      completed = public.user_lesson_progress.completed or excluded.completed,
      updated_at = greatest(excluded.updated_at, public.user_lesson_progress.updated_at)
  )
  select 1;

  with upsert_courses as (
    insert into public.user_course_progress (
      user_id,
      course_id,
      org_id,
      progress,
      completed,
      updated_at
    )
    select
      d.user_id,
      d.course_id,
      d.org_id,
      d.progress,
      d.progress >= 100 or lower(coalesce(d.status, '')) = 'completed',
      d.occurred_at
    from deduped d
    where not d.is_duplicate and d.course_id is not null
    on conflict (user_id, course_id) do update set
      progress = greatest(excluded.progress, public.user_course_progress.progress),
      completed = public.user_course_progress.completed or excluded.completed,
      updated_at = greatest(excluded.updated_at, public.user_course_progress.updated_at)
  )
  select 1;

  accepted := coalesce(accepted_ids, array[]::text[]);
  duplicates := coalesce(duplicate_ids, array[]::text[]);
  return next;
  return;
end;
$$;
-- Standardize organization identifiers across courses and documents
-- Date: 2026-01-14

begin;

-- Courses: ensure organization_id mirrors legacy org_id
alter table public.courses
  add column if not exists organization_id text;

update public.courses
set organization_id = nullif(btrim(org_id::text), '')
where organization_id is null
  and org_id is not null;

-- Enforce NOT NULL only when every row is backfilled
DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count FROM public.courses WHERE organization_id IS NULL;
  IF missing_count = 0 THEN
    EXECUTE 'alter table public.courses alter column organization_id set not null';
  ELSE
    RAISE EXCEPTION 'Cannot set courses.organization_id NOT NULL: % rows remain null. Backfill required before re-running migration.', missing_count;
  END IF;
END $$;

create index if not exists courses_organization_id_idx on public.courses (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_organization_id_not_empty_chk'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_organization_id_not_empty_chk
      CHECK (btrim(organization_id) <> '');
  END IF;
END $$;

-- Documents: ensure organization_id mirrors legacy org_id
alter table public.documents
  add column if not exists organization_id text;

update public.documents
set organization_id = nullif(btrim(org_id::text), '')
where organization_id is null
  and org_id is not null;

DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT count(*) INTO missing_count FROM public.documents WHERE organization_id IS NULL;
  IF missing_count = 0 THEN
    EXECUTE 'alter table public.documents alter column organization_id set not null';
  ELSE
    RAISE EXCEPTION 'Cannot set documents.organization_id NOT NULL: % rows remain null. Backfill required before re-running migration.', missing_count;
  END IF;
END $$;

create index if not exists documents_organization_id_idx on public.documents (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_organization_id_not_empty_chk'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_organization_id_not_empty_chk
      CHECK (btrim(organization_id) <> '');
  END IF;
END $$;

commit;

-- Down migration (manual rollback instructions)
-- begin;
--   alter table public.documents drop constraint if exists documents_organization_id_not_empty_chk;
--   drop index if exists documents_organization_id_idx;
--   alter table public.documents alter column organization_id drop not null;
--   alter table public.documents drop column if exists organization_id;
--
--   alter table public.courses drop constraint if exists courses_organization_id_not_empty_chk;
--   drop index if exists courses_organization_id_idx;
--   alter table public.courses alter column organization_id drop not null;
--   alter table public.courses drop column if exists organization_id;
-- commit;
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
-- Ensure org_invites and audit_logs exist for onboarding + auditing flows
BEGIN;

create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public._is_org_admin(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
      and lower(coalesce(m.role, 'member')) in ('admin','owner','manager','editor')
  );
$$;

create or replace function public._is_org_member(org_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.org_id = org_id
      and m.user_id = auth.uid()
  );
$$;

create table if not exists public.org_invites (
  id uuid primary key default uuid_generate_v4(),
  org_id text not null references public.organizations(id) on delete cascade,
  email text not null,
  invite_token text not null,
  role text not null default 'member',
  status text not null default 'pending' check (status in ('pending','sent','accepted','revoked','expired','bounced')),
  inviter_id uuid references auth.users(id),
  inviter_email text,
  invited_name text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  last_sent_at timestamptz,
  reminder_count integer not null default 0,
  duplicate_of uuid references public.org_invites(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists org_invites_org_idx on public.org_invites(org_id);
create index if not exists org_invites_status_idx on public.org_invites(status);
create index if not exists org_invites_email_idx on public.org_invites(lower(email));
create index if not exists org_invites_token_idx on public.org_invites(invite_token);

create unique index if not exists org_invites_pending_unique
  on public.org_invites(org_id, lower(email))
  where status in ('pending','sent');

drop trigger if exists org_invites_set_updated_at on public.org_invites;
create trigger org_invites_set_updated_at
  before update on public.org_invites
  for each row execute function public.set_updated_at();

alter table public.org_invites enable row level security;

drop policy if exists "org_invites_service_full_access" on public.org_invites;
create policy "org_invites_service_full_access"
  on public.org_invites
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "org_invites_member_read" on public.org_invites;
create policy "org_invites_member_read"
  on public.org_invites
  for select
  to authenticated
  using (public._is_org_member(org_id));

drop policy if exists "org_invites_admin_manage" on public.org_invites;
create policy "org_invites_admin_manage"
  on public.org_invites
  for all
  to authenticated
  using (public._is_org_admin(org_id))
  with check (public._is_org_admin(org_id));

grant select, insert, update, delete on public.org_invites to service_role;
grant select on public.org_invites to authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  org_id text,
  user_id uuid,
  ip_address text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_org_created_idx on public.audit_logs(org_id, created_at desc);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_service_access on public.audit_logs;
create policy audit_logs_service_access
  on public.audit_logs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists audit_logs_member_read on public.audit_logs;
create policy audit_logs_member_read
  on public.audit_logs
  for select
  to authenticated
  using (org_id is not null and public._is_org_member(org_id));

grant select, insert, update, delete on public.audit_logs to service_role;
grant select on public.audit_logs to authenticated;

COMMIT;
-- Migration: Consolidate course assignments into public.assignments
-- Date: 2026-01-20

-- 1) Ensure new columns exist on public.assignments so it can store learner metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'note'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN note text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'assigned_by'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN assigned_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.assignments
      ADD COLUMN status text NOT NULL DEFAULT 'assigned'
      CHECK (status IN ('assigned', 'in-progress', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'progress'
  ) THEN
    ALTER TABLE public.assignments
      ADD COLUMN progress integer NOT NULL DEFAULT 0
      CHECK (progress >= 0 AND progress <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN idempotency_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'client_request_id'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN client_request_id text;
  END IF;
END$$;

-- 2) Normalize defaults/check constraints in case columns already existed without them
ALTER TABLE public.assignments
  ALTER COLUMN status SET DEFAULT 'assigned';
ALTER TABLE public.assignments
  ALTER COLUMN progress SET DEFAULT 0;

-- 3) Backfill organization_id from courses when missing so migrated rows remain scoped
UPDATE public.assignments a
SET organization_id = c.organization_id
FROM public.courses c
WHERE a.course_id = c.id
  AND a.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- 4) Copy data from legacy course_assignments if the table is still present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'course_assignments'
  ) THEN
    INSERT INTO public.assignments (
      id,
      course_id,
      user_id,
      organization_id,
      due_at,
      note,
      assigned_by,
      status,
      progress,
      created_at,
      updated_at,
      active
    )
    SELECT
      ca.id,
      ca.course_id,
      ca.user_id,
      COALESCE(c.organization_id, a.organization_id),
      ca.due_date,
      ca.note,
      ca.assigned_by,
      ca.status,
      ca.progress,
      ca.created_at,
      ca.updated_at,
      TRUE
    FROM public.course_assignments ca
    LEFT JOIN public.courses c ON c.id = ca.course_id
    LEFT JOIN public.assignments a ON a.id = ca.id
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      organization_id = COALESCE(EXCLUDED.organization_id, public.assignments.organization_id),
      due_at = EXCLUDED.due_at,
      note = EXCLUDED.note,
      assigned_by = EXCLUDED.assigned_by,
      status = EXCLUDED.status,
      progress = EXCLUDED.progress,
      created_at = LEAST(public.assignments.created_at, EXCLUDED.created_at),
      updated_at = GREATEST(public.assignments.updated_at, EXCLUDED.updated_at),
      active = TRUE;

    DROP TABLE public.course_assignments;
  END IF;
END$$;

-- 5) Create new indexes/constraints to enforce uniqueness and support idempotency lookups
CREATE UNIQUE INDEX IF NOT EXISTS assignments_unique_user_per_course
  ON public.assignments(course_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_unique_org_per_course
  ON public.assignments(course_id, organization_id)
  WHERE user_id IS NULL AND organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_idempotency_key_idx
  ON public.assignments (
    idempotency_key,
    coalesce(user_id, 'user:null'),
    coalesce(organization_id, 'org:null')
  )
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_client_request_id_idx
  ON public.assignments (
    client_request_id,
    coalesce(user_id, 'user:null'),
    coalesce(organization_id, 'org:null')
  )
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS assignments_status_idx ON public.assignments(status);
CREATE INDEX IF NOT EXISTS assignments_progress_idx ON public.assignments(progress);
CREATE INDEX IF NOT EXISTS assignments_org_idx ON public.assignments(organization_id);

-- 6) Ensure updated_at stays current after the new columns/updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'assignments_set_updated_at'
  ) THEN
    CREATE TRIGGER assignments_set_updated_at
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;
create or replace view public.user_organizations_vw as
select
  uo.user_id,
  uo.organization_id,
  o.name as organization_name,
  uo.role,
  uo.status,
  uo.created_at,
  uo.updated_at
from public.user_organizations uo
join public.organizations o
  on o.id = uo.organization_id;

grant select on public.user_organizations_vw to authenticated;
grant select on public.user_organizations_vw to service_role;
grant select on public.user_organizations_vw to anon;
-- Grant select access on user_organizations_vw to all runtime roles
GRANT SELECT ON public.user_organizations_vw TO anon;
GRANT SELECT ON public.user_organizations_vw TO authenticated;
GRANT SELECT ON public.user_organizations_vw TO service_role;
-- 2026-02-13 Fix user_organizations_vw to reference organization_memberships
-- Ensures server-side membership lookups work even when public.user_organizations table does not exist.

DROP VIEW IF EXISTS public.user_organizations_vw;

CREATE OR REPLACE VIEW public.user_organizations_vw AS
SELECT
  m.user_id,
  m.org_id AS organization_id,
  m.org_id AS org_id,
  m.role,
  m.status,
  m.accepted_at,
  m.last_seen_at,
  o.name AS organization_name,
  o.slug AS organization_slug,
  o.slug AS org_slug,
  o.status AS organization_status,
  o.subscription,
  o.features,
  o.created_at AS organization_created_at
FROM public.organization_memberships AS m
JOIN public.organizations AS o
  ON o.id = m.org_id;

GRANT SELECT ON public.user_organizations_vw TO anon;
GRANT SELECT ON public.user_organizations_vw TO authenticated;
GRANT SELECT ON public.user_organizations_vw TO service_role;
-- 2026-02-14 Ensure audit_logs.details column exists (jsonb) for PostgREST contract

ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
-- 2026-02-14 Ensure user_organizations_vw only references stable organization_memberships columns

DROP VIEW IF EXISTS public.user_organizations_vw;

CREATE OR REPLACE VIEW public.user_organizations_vw AS
SELECT
  m.user_id,
  m.org_id AS organization_id,
  m.org_id AS org_id,
  m.role,
  'active'::text AS status,
  NULL::timestamptz AS accepted_at,
  NULL::timestamptz AS last_seen_at,
  o.name AS organization_name,
  o.slug AS organization_slug,
  o.slug AS org_slug,
  o.status AS organization_status,
  o.subscription,
  o.features,
  o.created_at AS organization_created_at
FROM public.organization_memberships AS m
JOIN public.organizations AS o
  ON o.id = m.org_id;

GRANT SELECT ON public.user_organizations_vw TO anon;
GRANT SELECT ON public.user_organizations_vw TO authenticated;
GRANT SELECT ON public.user_organizations_vw TO service_role;
