-- Tenant Onboarding foundational schema
BEGIN;

CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    industry text,
    size text,
    logo_url text,
    color_theme_json jsonb DEFAULT '{}'::jsonb,
    timezone text DEFAULT 'UTC',
    locale text DEFAULT 'en-US',
    tier text DEFAULT 'Standard',
    primary_contact_name text NOT NULL,
    primary_contact_email text NOT NULL,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS org_settings (
    organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    lms_json jsonb NOT NULL,
    notifications_json jsonb NOT NULL,
    surveys_json jsonb NOT NULL,
    rbac_json jsonb NOT NULL,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    name text,
    role text NOT NULL,
    status text DEFAULT 'invited',
    created_at timestamptz DEFAULT timezone('utc', now()),
    UNIQUE (email, organization_id)
);

CREATE TABLE IF NOT EXISTS groups (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS courses (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    summary text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS modules (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    position integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS lessons (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
    title text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb,
    position integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS resources (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    url text,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS surveys (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    template jsonb,
    settings jsonb,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS survey_items (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
    prompt text NOT NULL,
    item_type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    position integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    type text NOT NULL,
    subject text,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS audit_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id uuid,
    organization_id uuid,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT timezone('utc', now())
);

-- Indexes for analytics and performance
CREATE INDEX IF NOT EXISTS organizations_created_at_idx ON organizations (created_at DESC);
CREATE INDEX IF NOT EXISTS org_settings_org_idx ON org_settings (organization_id);
CREATE INDEX IF NOT EXISTS users_org_created_idx ON users (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS groups_org_idx ON groups (organization_id);
CREATE INDEX IF NOT EXISTS courses_org_created_idx ON courses (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS surveys_org_created_idx ON surveys (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_org_created_idx ON notifications (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_org_created_idx ON audit_events (organization_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Policies for tenant isolation
CREATE POLICY IF NOT EXISTS tenant_select ON organizations
FOR SELECT USING (
  auth.jwt()->>'role' = 'SUPER_ADMIN' OR
  (auth.jwt()->>'organization_id')::uuid = id
);

CREATE POLICY IF NOT EXISTS tenant_select_cascading ON org_settings
FOR SELECT USING ((auth.jwt()->>'organization_id')::uuid = organization_id);

CREATE POLICY IF NOT EXISTS tenant_select_users ON users
FOR SELECT USING (
  auth.jwt()->>'role' = 'SUPER_ADMIN' OR
  (auth.jwt()->>'organization_id')::uuid = organization_id
);

CREATE POLICY IF NOT EXISTS tenant_write_users ON users
FOR ALL USING (
  auth.jwt()->>'role' IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER') AND
  (auth.jwt()->>'organization_id')::uuid = organization_id
) WITH CHECK (
  (auth.jwt()->>'organization_id')::uuid = organization_id
);

CREATE POLICY IF NOT EXISTS tenant_select_generic ON courses
FOR SELECT USING (
  (auth.jwt()->>'role') = 'SUPER_ADMIN' OR
  auth.uid() IN (
    SELECT id FROM users WHERE users.organization_id = courses.organization_id
  )
);

CREATE POLICY IF NOT EXISTS tenant_write_generic ON courses
FOR ALL USING (
  (auth.jwt()->>'role') IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER') AND
  (auth.jwt()->>'organization_id')::uuid = courses.organization_id
) WITH CHECK (
  (auth.jwt()->>'organization_id')::uuid = courses.organization_id
);

-- Apply same policies across dependent tables
CREATE POLICY IF NOT EXISTS tenant_select_modules ON modules
FOR SELECT USING ((auth.jwt()->>'organization_id')::uuid = modules.organization_id);

CREATE POLICY IF NOT EXISTS tenant_write_modules ON modules
FOR ALL USING ((auth.jwt()->>'organization_id')::uuid = modules.organization_id)
WITH CHECK ((auth.jwt()->>'organization_id')::uuid = modules.organization_id);

CREATE POLICY IF NOT EXISTS tenant_select_lessons ON lessons
FOR SELECT USING ((auth.jwt()->>'organization_id')::uuid = lessons.organization_id);

CREATE POLICY IF NOT EXISTS tenant_write_lessons ON lessons
FOR ALL USING ((auth.jwt()->>'organization_id')::uuid = lessons.organization_id)
WITH CHECK ((auth.jwt()->>'organization_id')::uuid = lessons.organization_id);

CREATE POLICY IF NOT EXISTS tenant_select_resources ON resources
FOR SELECT USING ((auth.jwt()->>'organization_id')::uuid = resources.organization_id);

CREATE POLICY IF NOT EXISTS tenant_write_resources ON resources
FOR ALL USING ((auth.jwt()->>'organization_id')::uuid = resources.organization_id)
WITH CHECK ((auth.jwt()->>'organization_id')::uuid = resources.organization_id);

CREATE POLICY IF NOT EXISTS tenant_select_surveys ON surveys
FOR SELECT USING ((auth.jwt()->>'organization_id')::uuid = surveys.organization_id);

CREATE POLICY IF NOT EXISTS tenant_write_surveys ON surveys
FOR ALL USING ((auth.jwt()->>'organization_id')::uuid = surveys.organization_id)
WITH CHECK ((auth.jwt()->>'organization_id')::uuid = surveys.organization_id);

CREATE POLICY IF NOT EXISTS tenant_select_survey_items ON survey_items
FOR SELECT USING ((auth.jwt()->>'organization_id')::uuid = survey_items.organization_id);

CREATE POLICY IF NOT EXISTS tenant_write_survey_items ON survey_items
FOR ALL USING ((auth.jwt()->>'organization_id')::uuid = survey_items.organization_id)
WITH CHECK ((auth.jwt()->>'organization_id')::uuid = survey_items.organization_id);

CREATE POLICY IF NOT EXISTS tenant_select_notifications ON notifications
FOR SELECT USING ((auth.jwt()->>'organization_id')::uuid = notifications.organization_id);

CREATE POLICY IF NOT EXISTS tenant_write_notifications ON notifications
FOR ALL USING ((auth.jwt()->>'organization_id')::uuid = notifications.organization_id)
WITH CHECK ((auth.jwt()->>'organization_id')::uuid = notifications.organization_id);

CREATE POLICY IF NOT EXISTS tenant_select_audit ON audit_events
FOR SELECT USING (
  auth.jwt()->>'role' = 'SUPER_ADMIN' OR
  (auth.jwt()->>'organization_id')::uuid = audit_events.organization_id
);

COMMIT;
