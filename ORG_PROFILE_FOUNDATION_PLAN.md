# Organization Profile + AI Context Plan

## Goals
1. Replace local/session-based organization profile data with a canonical Supabase-backed source of truth.
2. Capture rich qualitative inputs (mission, DEI focus, tone, accessibility, languages) that downstream AI services can use.
3. Centralize branding + contacts so builders, survey tools, and messaging flows stay in sync.
4. Enforce organization-aware Row Level Security (RLS) via existing `_is_org_admin` / `_is_org_member` helpers.
5. Provide clean backend APIs + typed frontend services so AI assistants, survey builders, and course tools can fetch/write profile data safely.

## Data Model (Supabase)
### `organization_profiles`
| Column | Type | Notes |
| --- | --- | --- |
| `org_id` | text PK references `organizations.id` | One-to-one with `organizations` |
| `mission` | text | High-level purpose statement |
| `vision` | text | Long-term aspiration |
| `values` | jsonb default `[]` | Array of `{ label, description }` |
| `dei_priorities` | jsonb default `[]` | Structured DEI goals |
| `tone_guidelines` | text | Voice guidance for AI copy |
| `accessibility_commitments` | text | Requirements & commitments |
| `preferred_languages` | text[] default `{}` | Controlled set of ISO codes |
| `audience_segments` | jsonb default `[]` | Named cohorts for targeting |
| `ai_context` | jsonb default `{}` | Cached context summary (allow AI edge functions to hydrate) |
| `metadata` | jsonb default `{}` | Future-proof misc data |
| `created_at` / `updated_at` | timestamptz default `now()` | Audit |

### `organization_branding`
| Column | Type | Notes |
| --- | --- | --- |
| `org_id` | text PK FK -> `organizations.id` |
| `logo_url` | text | Public asset URL |
| `primary_color` | text | HEX |
| `secondary_color` | text | HEX |
| `accent_color` | text | HEX |
| `typography` | jsonb default `{}` | e.g. `{ heading: 'Poppins', body: 'Inter' }` |
| `media` | jsonb default `[]` | Additional brand assets |
| `updated_at` | timestamptz |

### `organization_contacts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK default `gen_random_uuid()` |
| `org_id` | text not null FK |
| `name` | text not null |
| `email` | text not null |
| `role` | text | e.g., "Chief People Officer" |
| `type` | text | `billing`, `executive`, `learning`, etc. |
| `phone` | text |
| `is_primary` | boolean default `false` |
| `notes` | text |
| `created_at` / `updated_at` | timestamptz |

### RLS Policies
- Enable RLS on all three tables.
- `service_role` full access policy for automation.
- `_is_org_admin(org_id)` can `select/insert/update/delete`.
- `_is_org_member(org_id)` can `select` for AI assistance + personalization.
- Contacts table additionally allows users to view contacts tied to org assignments via `organization_memberships` (join).

## Backend API Surface (Express)
- `/api/admin/org-profiles/:orgId`
  - `GET` returns merged `organizations` + `organization_profiles` + `organization_branding` + contacts.
  - `PUT` upserts profile + branding + contacts array (wrap in transaction helper on server).
- `/api/admin/org-profiles/:orgId/contacts`
  - `POST/PUT/DELETE` for granular contact management (used by assignments + messaging).
- Middleware: reuse `requireAdmin` + `requireOrgAccess` to ensure org context enforced before hitting Supabase.
- Services should call Supabase via server only; never from browser.

## Frontend Service Changes
- Introduce `orgProfileService` that fetches consolidated profile via new endpoints and exposes strongly typed objects used by:
  - `ProfileService` (remove localStorage fallback).
  - `AIContentAssistant`, `AdminSurveyBuilder`, `AISurveyBot` for AI prompt context.
  - Admin organization profile UI (editing mission, tone, colors, contacts).
- Provide React Query hooks (e.g., `useOrgProfile(orgId)`) for caching + optimistic updates.

## AI Context Plumbing
- When admin saves org profile, backend emits an async job/event (Supabase function or queue) that writes a summarized prompt-ready payload into `organization_profiles.ai_context` (keyed by `prompt_version`).
- AI builders request `/api/admin/org-profiles/:orgId/context` to get sanitized context for prompt injection.
- Document prompt hints under `docs/ai_prompts/ORG_CONTEXT.md` (follow-up task).

## Migration Strategy
1. New migration `20260104_org_profile_tables.sql` creates the tables + constraints + policies + triggers.
2. Backfill existing organizations with empty profile rows to maintain referential integrity.
3. Data seeding script (admin-only) to copy local mock data into Supabase for demo orgs (optional).

## Rollout Notes
- Update ENV docs: ensure Supabase service role key available to backend for multi-table upserts.
- Coordinate with Railway pipeline to run the migration + restart server.
- Netlify/Vercel frontends rely on new `/api/admin/org-profiles` endpoints; update `API_REFERENCE.md` once implemented.

## Next Steps
1. Implement migration + RLS (Todo #3).
2. Wire Express routes + DAL/service layer.
3. Replace `ProfileService` local storage usage with API-driven flow.
4. Feed profile context into AI builders + surveys.
