# Tenant Onboarding Flow Runbook

This runbook documents the guided organization onboarding flow that lives at `/admin/onboarding/new-org`. It includes data model requirements, environment variables, RLS policies, seeding logic, and automated testing coverage so that super-admins can provision production-ready tenants in minutes.

## Wizard Overview

1. **Organization Details** – capture identity, contact, timezone/locale, subscription tier, and generate slug + org identifier.
2. **Branding** – upload logo and favicon, choose colors and typography with accessibility validation, preview light/dark themes.
3. **Defaults** – configure LMS visibility, completion rules, notifications, surveys, and baseline RBAC roles.
4. **Seed Content** – optionally preload demo courses, surveys, and starter notifications with org-wide assignment toggles.
5. **Invite Users** – upload CSV or add rows with RBAC roles, groups, and send-now toggle for branded magic link invites.
6. **Review & Launch** – summarize configuration, confirm RLS telemetry provisioning, and execute atomic creation transaction.

## Environment Variables

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL for executing SQL migrations and API requests. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key required to run the atomic onboarding transaction and seed content. |
| `INVITE_EMAIL_SENDER` | Branded email address used when sending invite + magic-link emails. |
| `MAGIC_LINK_EXPIRATION_MINUTES` | Duration in minutes for invite magic links (default 72 hours). |
| `BILLING_PROVIDER_KEY` | Optional key to hydrate billing integration (Stripe/LemonSqueezy). |

## API Flow (Atomic Transaction)

1. Create organization row with generated UUID + slug.
2. Persist branding JSON blob and timezone/locale metadata.
3. Insert default settings (`org_settings`), RBAC roles, and telemetry bootstrap events.
4. Optionally insert seeded courses/modules/lessons/resources/surveys/notifications using prepared templates.
5. Upsert departmental groups and invited users (`status = 'invited'`).
6. Trigger email service if `sendInvitesNow` is true and enqueue `org_launched` webhook payload.

All writes must run within a single transaction (`BEGIN ... COMMIT`) to avoid partially provisioned tenants.

## Row-Level Security Summary

RLS is enabled on every tenant-scoped table. Policies ensure:

- `SUPER_ADMIN` can view all records.
- Org-scoped roles can only read/write rows where `organization_id` matches their JWT claim.
- Write policies require elevated roles (`ORG_ADMIN`, `MANAGER`) and enforce the same `organization_id` on insert/update.
- Audit events are readable by super-admin or the owning organization.

Refer to [`supabase/migrations/20240918000100_tenant_onboarding.sql`](../supabase/migrations/20240918000100_tenant_onboarding.sql) for the full policy list.

## Seed Content Templates

| Content | Description |
| --- | --- |
| **DEI Foundations** | Multi-lesson video course with quiz and PDF resource. |
| **Inclusive Leadership Microlearning** | 5–10 minute refresher with actionable checklist. |
| **Workplace Climate Pulse Survey** | Likert-based survey with anonymity threshold baked into settings. |
| **Starter Notifications** | Welcome email, “Start your first course,” and “How to take a survey.” |

Templates are stored as JSON definitions and can be extended per vertical.

## Telemetry & Audit Logging

- `org_created`, `seed_content_created`, `invites_sent`, and `org_launched` events recorded in `audit_events`.
- Admin dashboard surfaces “Recent Orgs Created” widget with status + elapsed time.
- Failures automatically capture payload and stack for debugging.

## Testing Strategy

- **E2E**: Exercise the full wizard, verify seeded data, login as invited learner, and confirm analytics scoping.
- **RLS**: Ensure Org A user cannot access Org B data using Supabase row-level policy tests.
- **Visual Regression**: Snapshot theme application across admin/client (light & dark).
- **Performance**: Org dashboard should hydrate cached metrics < 1s post-launch.
- **Email**: Magic-link invite delivered and usable within expiration window.

## Operational Checklist

- [ ] Run Supabase migration: `supabase db push` (or `npm run supabase:migrate` if scripted).
- [ ] Configure environment variables listed above.
- [ ] Confirm invite email template includes organization logo + brand colors.
- [ ] Validate RLS policies in staging before production rollout.
- [ ] Monitor telemetry dashboard for onboarding success/failure signals.

