# Client Onboarding Implementation Plan

## Scope
Code-level work to deliver the audited onboarding flow:
1. Org creation wizard + defaults
2. Owner/Admin assignment guardrails
3. Invite management (bulk, resend, duplicate detection)
4. Invite acceptance (landing, status, compliance)
5. Activation checklist + telemetry
6. Operational hooks (emails, audit logging, analytics)

## Components & Files to Touch
- Backend: `server/index.js`, `server/routes/admin-organizations.js` (new), `server/routes/org-invites.js` (new), `server/middleware/permissions.js` (new), `server/utils/email.js`, migration files.
- Frontend: `src/pages/Admin/AdminOrganizationCreate.tsx`, `AdminOrganizations.tsx`, `AdminOrgProfile.tsx`, `src/components/onboarding/OrgWizard.tsx` (new), `src/components/onboarding/InviteManager.tsx` (new), `src/context/SecureAuthContext.tsx`, `src/services/orgService.ts`, `src/services/inviteService.ts` (new), `src/hooks/useOnboardingProgress.ts` (new).
- Shared: `shared/permissions/index.js`, `shared/onboarding/statuses.ts` (new), `shared/emails/templates.ts` (new).
- Docs: `CLIENT_ONBOARDING_AUDIT.md` (reference), `README.md` updates, `CLIENT_ONBOARDING_IMPLEMENTATION_PLAN.md` (this file).

## Work Breakdown Structure
1. **Permissions & Role Defaults**
   - Extend `shared/permissions` to include onboarding-specific capabilities (`org.manageInvites`, `org.viewActivationStatus`).
   - Add middleware helper `requirePermission(permission)` referencing the new registry.
   - Update auth middleware to attach `permissions` set on `req.user`.

2. **Organization Creation Flow**
   - Backend route `POST /api/admin/onboarding/orgs` with validations (slug uniqueness, timezone, plan default, owner requirement).
   - Persist default plan + sandbox environment; create onboarding checklist row.
   - Frontend wizard (3 steps) capturing org metadata, owner, tags.
   - Real-time validation messages and progress indicator.

3. **Invite System**
   - Table `org_invites` (id, org_id, email, role, inviter_id, status, token, expires_at, metadata).
   - Backend routes: create, bulk upload, resend, revoke, status list.
   - Email service integration (using existing transactional provider) for invite + reminder templates.
   - UI component for bulk entry, CSV upload, duplicate detection, status chips.

4. **Invite Acceptance & Login**
   - Public endpoints `GET /invite/:token`, `POST /invite/:token/accept` requiring password + MFA if enabled.
   - Landing page showing org branding, instructions, fallback code.
   - Update auth context to refresh after acceptance.

5. **Activation Checklist & Telemetry**
   - Table `org_activation_steps` storing milestones, timestamps, actor.
   - Backend events triggered on: org create, owner assigned, invites sent, first login, first course publish, first learner invite, first analytics view.
   - Frontend `useOnboardingProgress` hook to poll status and render progress card.

6. **Audit Logging + Operational Tools**
   - Expand `auditLogService` actions: `org_create`, `org_invite_sent`, `org_invite_resend`, `org_activation_step`.
   - Internal dashboard (Admin > Organizations) to show friction alerts (pending invites > 7 days, bounced emails, etc.).
   - Scheduler/BG job to auto-resend reminders and expire invites.

## Dependencies & Sequencing
1. Database migrations for tables + indexes.
2. Shared permissions + middleware updates to enforce capabilities.
3. Backend APIs for org creation and invite lifecycle.
4. Frontend wizard + invite manager UI.
5. Activation checklist UI + telemetry instrumentation.
6. Email templating + scheduled reminders.

## Testing Strategy
- Unit tests for permission gating and invite token expiry logic (Jest/Vitest).
- Integration tests hitting new endpoints (Supertest) to cover failure states (duplicate invites, missing owner, invalid tokens).
- Cypress/Playwright flow for wizard → invite → acceptance → activation checklist.
- Manual QA for email rendering across clients.

## Rollout Plan
1. Deploy behind feature flag `CLIENT_ONBOARDING_V2` to beta orgs.
2. Monitor invite acceptance metrics via telemetry dashboard.
3. Incrementally migrate existing orgs by backfilling activation status and generating invites for pending members.
4. Remove legacy invite flows once adoption >90%.
