# Manual review required for consolidation (2026-05-02T22:12:47.092Z)

The following RLS policy groups contain unconditional or ambiguous USING clauses and need manual review before consolidation.

- Table: public.analytics_events  Role: authenticated  Action: ALL
  Policies:
    - owner_all  qual=((( SELECT auth.uid() AS uid))::text = (user_id)::text)
    - deny_authenticated  qual=false

- Table: public.audit_logs  Role: authenticated  Action: ALL
  Policies:
    - owner_all  qual=((( SELECT auth.uid() AS uid))::text = (user_id)::text)
    - deny_authenticated  qual=false

- Table: public.auth_audit  Role: authenticated  Action: ALL
  Policies:
    - deny_authenticated  qual=false
    - owner_all  qual=((( SELECT auth.uid() AS uid))::text = (user_id)::text)

- Table: public.user_activity_log  Role: authenticated  Action: ALL
  Policies:
    - owner_all  qual=((( SELECT auth.uid() AS uid))::text = (user_id)::text)
    - deny_authenticated  qual=false

- Table: storage.objects  Role: authenticated  Action: INSERT
  Policies:
    - Users upload own avatars  qual=<null or unconditional>
    - Org members upload org-assets  qual=<null or unconditional>
    - Authenticated upload avatars + org-assets  qual=<null or unconditional>

