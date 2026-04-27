-- SQL helper to ensure the PRIMARY_ADMIN_EMAIL exists as a user and has platform admin membership.
-- Run this against your Postgres DB (connected to the project's database).
-- Usage: psql $DATABASE_URL -f ensure_primary_admin.sql

-- Replace the values below if you prefer different ids or org.
\set primary_email :'PRIMARY_ADMIN_EMAIL'
\set admin_user_id '00000000-0000-0000-0000-000000000001'
\set org_id '00000000-0000-0000-0000-000000000001'
\set org_name 'Demo Organization'

-- Insert user_profiles if missing
INSERT INTO user_profiles (id, email, full_name, created_at)
SELECT :'admin_user_id', :'primary_email', 'Primary Admin', now()
WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE email = :'primary_email' OR id = :'admin_user_id');

-- Insert organization if missing
INSERT INTO organizations (id, name, created_at)
SELECT :'org_id', :'org_name', now()
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = :'org_id' OR name = :'org_name');

-- Ensure organization_memberships contains the admin membership
INSERT INTO organization_memberships (organization_id, user_id, role, status, created_at)
SELECT :'org_id', :'admin_user_id', 'owner', 'active', now()
WHERE NOT EXISTS (
  SELECT 1 FROM organization_memberships WHERE organization_id = :'org_id' AND user_id = :'admin_user_id'
);

-- Grant any necessary platform admin flags in user_profiles (if you track them)
-- This depends on your schema; skip if you don't have a platform role column.
-- ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS platform_role text;
UPDATE user_profiles SET platform_role = 'platform_admin' WHERE id = :'admin_user_id';

-- Done
SELECT 'primary admin ensured' as status;
