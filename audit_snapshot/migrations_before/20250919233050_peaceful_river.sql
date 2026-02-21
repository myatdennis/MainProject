/*
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
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;