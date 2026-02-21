/*
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
  WITH CHECK (true);