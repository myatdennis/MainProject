-- Policies for assignments table: allow service role full access and organization-scoped user inserts

-- Allow service role to bypass RLS for all operations on assignments
CREATE POLICY IF NOT EXISTS "service_role_full_access" ON public.assignments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to insert when organization_id matches their JWT claim
CREATE POLICY IF NOT EXISTS "org_scoped_insert" ON public.assignments
  FOR INSERT
  USING (auth.role() = 'authenticated')
  WITH CHECK (
    (auth.role() = 'authenticated' AND (new.organization_id::text = auth.jwt() ->> 'org_id'))
    OR auth.role() = 'service_role'
  );

-- You may need to adapt auth.jwt() claims to match your JWT structure.
