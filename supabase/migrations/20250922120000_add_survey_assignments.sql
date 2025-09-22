-- Add survey_assignments table to persist survey -> organization assignments

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
