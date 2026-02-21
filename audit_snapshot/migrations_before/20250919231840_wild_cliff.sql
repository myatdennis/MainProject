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
CREATE INDEX IF NOT EXISTS idx_user_reflections_lesson_id ON user_reflections(lesson_id);