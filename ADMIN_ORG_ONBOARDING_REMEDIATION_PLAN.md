# Admin Organization Onboarding – Remediation Roadmap

_Updated: 2026-03-13_

This document converts the Phase 1 audit findings into an actionable remediation plan. Each phase is scoped to be independently deployable, minimizes regression risk, and directly maps to the production-readiness goals for organization profiles and onboarding.

---

## Phase 1 – Completed Audit (Reference)
* ✅ Comprehensive code/UX audit of:
  * Organization APIs (`/api/admin/organizations*`, membership, invites, messaging)
  * Org profile payload + UI (AdminOrgProfile, OrgWorkspace, legacy OrganizationDetails)
  * Invite lifecycle endpoints + `InviteAccept` flow
  * Communication + logging subsystems (OrgCommunicationPanel, message logs)
* ✅ Key gaps captured:
  1. Profile UI missing several payload-backed sections (contacts/admins/users/assignments/activity)
  2. Quick actions + CTA surface inconsistent / dead-end buttons
  3. Org creation flow lacks owner provisioning + confirmation redirects
  4. Invite lifecycle lacks reminder visibility, expiry cues, and structured logging
  5. Learner onboarding verification (assignments/resources/notifications) not automated
  6. Schema guard noise + missing column telemetry

---

## Phase 2 – Data Contract & UI Hardening (✅ Completed)
**Objective:** Align backend payloads with a polished Admin Org Profile and eliminate schema guard noise before touching invite/auth flows.

| Track | Shipped Updates |
| --- | --- |
| Backend Schema Guard | `ensureAdminOrgSchemaOrRespond` now distinguishes required vs optional tables, emits a single structured warning per missing optional column, and preserves hard failures for required tables. |
| Org Profile Payload | `buildOrganizationProfilePayload` now inlines assignment summaries, contacts/admins/users/messages, and guarantees stable metrics for the UI. |
| Org Profile UI | `AdminOrgProfile.tsx` renders the new snapshot, invite summary, communications log, CTA chips, and assignment cards without dead buttons. |
| Regression Guarding | `npm run build` succeeds; manual smoke: profile load, invite manager actions, messaging send/refresh. |

Status: ✅ Ready. Move to Phase 3+ deliverables.

---

## Phase 3 – Org Creation & Default Provisioning
**Objective:** Ensure creating an organization automatically seeds ownership + onboarding scaffolding.

**Deliverables**
1. Extend `AddOrganizationModal` / `createOrg` API payload to accept optional `ownerEmail`. Server:
   * Creates placeholder owner invite or membership (when email matches existing user).
   * Emits `organization_created` + `organization_owner_seeded` logs.
2. Redirect admins to the new org profile or workspace after success with toast confirmation.
3. Add validation for duplicate `contact_email`/slug conflicts with friendly errors.

_Progress_: ✅ Owner auto-seeding + post-create redirect shipped (2026‑03‑13).

**Exit Criteria**
* New organizations appear instantly with owner invite/membership visible in Profile → Team / Invites sections.
* Manual checklist: create org → redirected to profile → quick actions available.

---

## Phase 4 – Invite Lifecycle & Acceptance UX (✅ Completed)
**Highlights**
1. Reminder visibility: InviteManager now surfaces last send timestamps, expiry countdown, and reminder counts directly in each row.
2. Bulk resend: selectable invites + bulk resend CTA with detailed success/failure toast.
3. Structured logging: server emits `organization_invite_created|sent|failed` with inviteId/orgId/requestId metadata; acceptance logs enhanced.
4. Invite acceptance UX: InviteAccept screen adds password strength meter, assignment preview cards, and copy referencing org context.
5. Expired invite CTA: recipients can trigger a “Request new invite” mailto flow to the org contact.

**Verification**
* Send, resend, revoke, accept, expired flows manually verified.
* Structured logs observed in local/Railway output per lifecycle event.

---

## Phase 5 – Learner Access & Assignment Verification (✅ Completed)
**Objective:** Guarantee that a newly accepted user lands in the correct context with visible assignments/resources.

**Shipped**
* Admin Org Profile surfaces “Assigned content” cards for courses + surveys and now a dedicated “Shared resources” card powered by the legacy profile service.
* Invite previews highlight up to three upcoming assignments for transparency during acceptance.
* Added `scripts/org_onboarding_smoke.mjs`, an executable smoke script that creates an org → assigns optional course/survey → issues an invite → accepts it via the public flow to confirm assignments hydrate the admin profile.
* Notification/logging coverage expanded: invite acceptance now emits `organization_login_completed`, and onboarding step updates fire `organization_onboarding_status_updated`.

**Exit Criteria**
* Acceptance flow marks `organization_login_completed` for traceability.
* Admin view updates “Assigned content” counts immediately after the smoke script runs.

---

## Phase 6 – Logging, Alerts, and Documentation (✅ Completed)
**Objective:** Final polish before inviting real organizations.

**Shipped**
1. Structured events now cover:
   * `organization_profile_loaded|failed`
   * `organization_message_sent|failed`
   * `organization_onboarding_status_updated`
   * `organization_login_completed`
2. Added `ORG_PROFILE_FOUNDATION_PLAN.md`, detailing the refreshed admin profile workspace, communication tooling, and verification checklist.
3. The new smoke script serves as the automated harness referenced in Phase 5, wiring together create → assign → invite → accept.

---

## Dependencies & Risks
* **Supabase schema drift:** optional tables still guarded but missing columns (e.g., `organization_memberships.invited_email`) must be tracked so Phase 4 logging can include invite metadata.
* **Legacy OrganizationDetails page:** remains in repo; ensure navigation points to unified workspace or explicitly mark deprecated to avoid conflicting UX.
* **Environment variables:** invite email templates rely on `CLIENT_INVITE_LOGIN_URL`; verify across Railway/Netlify before rolling out invites to real clients.

---

## Next Steps
1. Complete manual verification for Phase 2 UI + schema guard changes.
2. Move to Phase 3 tasks (owner provisioning + creation flow polish) per priority.
3. Update this roadmap after each phase ships, referencing PR numbers and deployment targets.
