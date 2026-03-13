# Org Profile Foundation Plan

Updated: 2026-03-13  
Owner: Platform Enablement

## Purpose
This runbook documents the production-ready Admin Organization Profile + CRM workspace, onboarding communications, and verification workflow required before inviting real client organizations. It pairs with `ADMIN_ORG_ONBOARDING_REMEDIATION_PLAN.md` and replaces legacy OrganizationDetails guidance.

## Experience Overview
1. **Workspace entry points**
   - `/admin/organizations` lists all orgs with filters, summary cards, and direct links to the unified profile.
   - `/admin/organizations/:id` renders the workspace with onboarding progress, assignment cards, shared resources, contacts, invites, communication feed, and embeds (InviteManager, OrgCommunicationPanel, ProfileView).
2. **Snapshot cards**
   - Assignments: live course/survey counts + top items via canonical `assignments` table.
   - Resources: in-memory profile service highlights documents/links shared with the org (unread/completed counts).
3. **Communication**
   - Messaging panel logs all outbound touches (`organization_message_sent/failed`) and supports email + in-app.
   - InviteManager exposes reminder timestamps, expiry cues, and bulk resend with structured logging.
4. **Onboarding telemetry**
   - `organization_onboarding_status_updated` fires when checklist steps advance.
   - Invite acceptance publishes `organization_login_completed` and `organization_invite_accepted`.

## Automation & Smoke Testing
Run the scripted flow after every deployment touching org onboarding:

```bash
API_BASE_URL="https://api.the-huddle.co" \
ADMIN_BEARER_TOKEN="..." \
COURSE_ID="course-uuid" \
SURVEY_ID="survey-uuid" \
node scripts/org_onboarding_smoke.mjs
```

The script will:
1. Create a disposable organization with owner seeding.
2. Optionally assign the provided course/survey IDs.
3. Issue a manager invite (email suppressed).
4. Accept the invite via the public endpoint and log assignment counts once hydrated.

Review the resulting org profile to confirm:
- Assigned content + shared resources cards render with the injected data.
- Invite + message logs display the new entries.
- Structured logs (`organization_login_completed`, etc.) appear in Railway.

## Manual Verification Checklist
1. Create organization via modal; verify redirect to workspace with owner invite visible.
2. Assign a course + survey; confirm counts update in the “Assigned content” cards.
3. Send a message via OrgCommunicationPanel; verify toast + log entry + `organization_message_sent`.
4. Issue an invite (manual or via smoke script), resend it, and observe reminder metadata.
5. Accept invite; confirm `organization_login_completed` log and onboarding checklist progression.
6. Share at least one resource via ProfileService (legacy UI) and confirm the new “Shared resources” card updates.
7. Trigger onboarding step update (admin API or workspace) and confirm `organization_onboarding_status_updated`.
8. Load `/admin/organizations/:id` and `/admin/organizations` ensuring no dead CTA links.

## References
- `ADMIN_ORG_ONBOARDING_REMEDIATION_PLAN.md`
- `scripts/org_onboarding_smoke.mjs`
- `src/pages/Admin/AdminOrgProfile.tsx`
- `server/index.js` – organization schema guard, invite lifecycle, onboarding routes
