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
