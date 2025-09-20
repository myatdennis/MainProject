/*
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
WHERE id = 'course-resources';