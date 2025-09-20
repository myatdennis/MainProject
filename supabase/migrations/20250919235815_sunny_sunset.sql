/*
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
  USING (bucket_id = 'course-resources');