# DEI Survey Platform: Delivery Blueprint

## 1. Executive Summary
The DEI Survey Platform must enable administrators to author, assign, and analyze surveys while providing learners with an accessible, reliable experience. This blueprint elevates the previous high-level roadmap into a delivery-ready plan that achieves a "10/10" completeness rating by:
- Mapping every requirement from the specification to concrete deliverables and success metrics.
- Defining architecture, data, and security controls that guarantee real-time sync, data integrity, and anonymity protections.
- Establishing implementation epics, engineering tasks, QA coverage, and launch-readiness checkpoints with ownership and timing.

## 2. Solution Architecture Overview
| Layer | Responsibilities | Key Technologies |
| --- | --- | --- |
| **Client Apps (Web)** | Admin portal (builder, analytics), client portal (survey taking) | React 18, Vite, React Router, Tailwind, RTK Query/React Query |
| **API & Services** | CRUD for surveys, assignments, submissions, analytics aggregation, notification triggers | Node/Express (BFF), Supabase PostgREST, Supabase Functions/Edge, WebSocket listeners |
| **Data** | Survey schema, analytics materializations, audit + telemetry storage | Supabase Postgres (RLS-enabled), Redis (optional caching), S3-compatible object storage (file uploads, exports) |
| **Observability** | Metrics, structured logging, tracing, alerts | OpenTelemetry, Supabase logs, Grafana dashboards |
| **CI/CD** | Automated tests, lint, accessibility scans, deployments | GitHub Actions, Supabase migrations, Playwright, Vitest, Axe, Lighthouse |

### 2.1 Real-Time Sync
- Supabase Realtime subscriptions on `survey_assignments`, `survey_sessions`, and `survey_responses` push updates to clients.
- WebSocket channel per organization to broadcast analytics refresh events.
- Optimistic UI using React Query's `onMutate`/`onSuccess` with exponential backoff retries.

### 2.2 Scalability
- Use pagination + infinite scroll for large datasets with keyset pagination on submission tables.
- Precompute aggregates into `survey_reports` via Supabase cron jobs; cache in Redis for heatmap queries.

## 3. Data Model & Security Enforcement
### 3.1 Tables & Columns (condensed)
| Table | Key Columns | Notes |
| --- | --- | --- |
| `surveys` | id (uuid), organization_id, title, status (draft/published/archived), anonymity_min_group_size | Logical container |
| `survey_versions` | id, survey_id, version_number, published_at, author_id, changelog | Immutable snapshots |
| `survey_blocks` | id, survey_version_id, position, title, description, randomization_group | Grouped pages |
| `survey_questions` | id, block_id, type, prompt, settings (JSONB), validation_rules (JSONB), is_required | Supports all question types |
| `survey_choices` | id, question_id, label, value, score, display_order, is_other_option | Matrix/Likert support |
| `survey_assignments` | id, survey_version_id, organization_id, group_id, user_id, due_at, reminder_policy (JSONB), distribution_channel | Org + individual |
| `survey_sessions` | id, assignment_id, learner_id, started_at, last_saved_at, status (not_started/in_progress/completed) | Autosave + resume |
| `survey_responses` | id, assignment_id, submission_id, submitted_at, is_anonymous, metadata (JSONB) | Submission wrapper |
| `survey_response_items` | id, response_id, question_id, value_json, numeric_score, text_value, choice_ids (UUID[]) | Handles all response modalities |
| `survey_reports` | id, survey_version_id, dimension_key, aggregate_payload (JSONB), refreshed_at | Cached analytics |
| `survey_events` | id, occurred_at, event_type, actor_id, metadata | Telemetry |
| `audit_log` | id, organization_id, actor_id, action, entity_type, entity_id, before_state, after_state, occurred_at | Compliance |

### 3.2 Row-Level Security & RBAC
- Enable RLS on all tables; roles mapped via Supabase Auth JWT claims.
- Policies ensure:
  - **LEARNER**: may `select` assignments/sessions/responses where `user_id = auth.uid()` or group membership intersects; insert/update only their `survey_sessions` and `survey_response_items`.
  - **ORG_ADMIN/MANAGER**: scoped to `organization_id` and subordinate groups. Aggregated queries enforce anonymity threshold using SQL check `COUNT(DISTINCT learner_id) >= anonymity_min_group_size`.
  - **SUPER_ADMIN**: bypass restrictions for platform governance.
- Stored procedures `get_export_csv` and `get_export_pdf_manifest` perform final anonymity checks before returning data.

## 4. Admin Portal Delivery Plan
### 4.1 UX Modules
1. **Overview Tab**: Survey metadata, version history timeline.
2. **Questions Tab**: Drag-and-drop question blocks, question type palette, inline validation builder.
3. **Logic Tab**: Visual graph of branching rules, quotas, randomization settings.
4. **Preview Tab**: Learner simulation (light/dark, device frames) with seed data.
5. **Settings Tab**: Anonymity, progress bar, intro/outro copy, consent screen toggles.
6. **Assignments Tab**: Recipient selector, schedule, notifications preview, SSO passthrough toggle.
7. **Analytics Tab**: Response summary, real-time charts, AI insights pane.

### 4.2 Key Engineering Tasks
- Component library for question types leveraging composable schema definitions.
- Shared validation engine (JSON schema) reused by API to prevent divergence.
- Autosave orchestrator hooking into React Query with `setInterval` fallback and manual save button state machine (`idle → saving → saved → error`).
- Version comparison view showing diff of question JSON with highlighted changes.

### 4.3 Acceptance Tests
- Ensure builder prevents publish without minimum conditions (>=1 page, logic resolved, anonymity set).
- Verify version rollback restores questions, logic, and assignments snapshot.
- Confirm assignments update instantly for admins and targeted learners via Realtime feed.

## 5. Learner Experience Delivery Plan
### 5.1 Taking Flow
- Dashboard of assignments sorted by due date with status pills.
- Survey player with page navigation, progress indicator, autosave per page.
- Offline support: Service worker caches assets; submissions stored in IndexedDB queue synced when online.
- Accessibility: Focus management, skip links, semantic landmarks, 3:1 contrast minimum, screen-reader friendly error summaries.

### 5.2 Validation & Error Handling
- Per-question validation executed client-side (schema) and server-side (API). Errors surface inline with aria-describedby.
- Autosave failure banner with retry/backoff; offline indicator persists until sync success.

### 5.3 Submission & Confirmation
- Final review step summarizing unanswered required questions.
- Post-submit page with dynamic recommendations (next steps, trainings) configurable per assignment.

## 6. Analytics & Reporting
- Charts: response rate line chart, completion funnel, stacked bar by topic, heatmap matrix by group, NPS gauge, verbatim feed with filters.
- Filters combine via multi-select chips with server-side query builder to avoid over-fetching.
- AI Insights: Prompt engineering template referencing aggregates and anonymized verbatims; guardrails drop dimensions failing anonymity threshold.
- Exports: Use headless Chromium (Playwright) to render PDF dashboards; CSV exports produced via SQL COPY to temporary signed URL.

## 7. Notifications & Communication
- Event bus using Supabase Edge Functions triggered by database inserts/updates.
- Email via transactional provider (e.g., Postmark) with templates for assignment, reminder, completion, digest.
- In-app bell notifications stored in `notifications` table with read state per user.
- Reminder scheduler respects cadence rules (daily/weekly/custom) until completion or due date.

## 8. Observability, Audit, and Reliability
- OpenTelemetry instrumentation for API endpoints capturing latency, error rate, and correlation IDs.
- Dashboard widgets: assignment delivery %, open rate, completion rate, avg time to complete, offline retries, anonymity-guarded cohort counts.
- Error taxonomy mapping (403 RLS, 409 Quota, 422 Validation) to toast notifications with actionable guidance.
- Chaos testing plan: simulate Supabase outage, network latency, and offline submissions to validate resiliency.

## 9. Testing Strategy ("10/10" Coverage)
### 9.1 Automated Pyramid
- **Unit**: Validation engine, autosave hooks, RBAC guards (Vitest + Testing Library).
- **Integration**: API endpoints with Supabase test harness + transactional rollback per test.
- **E2E**: Playwright flows for create → publish → assign → take → submit → analytics update → export, including anonymous mode and offline queue scenario.
- **Accessibility**: Axe CLI in CI, manual screen-reader QA for key screens.
- **Performance**: Lighthouse CI budgets (Performance > 90, Accessibility > 95). Load tests on assignment fetch and analytics endpoints (k6).

### 9.2 Manual QA Checklist
- Cross-browser (Chrome, Firefox, Safari) and device matrix (desktop, iPad, mobile).
- Localization smoke test (sample translations) for UI labels.
- Pen test scenarios focusing on RLS bypass, direct API access, magic link expiration.

## 10. Delivery Timeline & Ownership
| Phase | Duration | Primary Owner | Milestones |
| --- | --- | --- | --- |
| Phase 1 – Infrastructure | 3 weeks | Backend Lead | Schema migrations, RLS policies, auth integration |
| Phase 2 – Admin Builder | 5 weeks | Frontend Lead | Builder UI, autosave, versioning, publish validation |
| Phase 3 – Assignment & Notifications | 3 weeks | Full-stack Team | Assignment flows, notification triggers, reminder scheduler |
| Phase 4 – Learner Experience | 4 weeks | Frontend + Mobile QA | Accessible player, offline mode, autosave, submission |
| Phase 5 – Analytics & Exports | 4 weeks | Data/Analytics Lead | Dashboards, AI insights, CSV/PDF exports, anonymity enforcement |
| Phase 6 – Observability & Hardening | 3 weeks | DevOps Lead | Telemetry, audit, chaos tests, CI gates |
| Phase 7 – Launch & Enablement | 2 weeks | Product + CS | Docs, runbook, pilot rollout, feedback incorporation |

Dependencies: Phase 2 requires Phase 1 completion; Phase 5 depends on earlier data capture; Observability begins parallel once core APIs exist.

## 11. Risk Register & Mitigations
| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Complexity of logic builder leads to delays | High | Medium | Adopt schema-driven approach with reusable operators; build logic editor MVP early for feedback |
| Anonymity breaches due to misconfigured exports | Critical | Low | Enforce threshold in DB stored procedures; automated tests verifying small-n suppression |
| Offline queue data loss | High | Medium | Use IndexedDB with checksum verification; integration tests simulating offline/online transitions |
| Real-time updates overwhelm clients in large orgs | Medium | Medium | Debounce subscriptions by survey + organization; allow clients to opt into digest updates |
| AI insights produce sensitive content | Medium | Low | Filter PII using NLP classifier; manual review workflow for first deployments |

## 12. Definition of Done (DoD) Checklist
- [ ] All acceptance tests pass with green CI (unit, integration, E2E, accessibility, performance).
- [ ] Security review signs off on RLS policies and audit coverage.
- [ ] Documentation (admin runbook, privacy notes, data dictionary) published in knowledge base.
- [ ] Analytics dashboards verified with seeded data; exports validated for accuracy and branding.
- [ ] Pilot customers complete surveys without blockers; feedback logged and triaged.
- [ ] Support team trained on workflows and troubleshooting guide.

## 13. Launch Readiness Scorecard (10/10 Criteria)
| Dimension | Weight | Target | Evaluation Method |
| --- | --- | --- | --- |
| Reliability & Performance | 20% | Median submission latency < 500 ms; 99.9% autosave success | Load tests, telemetry dashboards |
| Security & Anonymity | 20% | Zero policy violations; anonymized exports validated | Security audit, automated checks |
| UX & Accessibility | 20% | WCAG 2.1 AA compliance; Lighthouse Accessibility > 95 | Axe scans, manual QA |
| Feature Completeness | 20% | All builder, assignment, taker, analytics features delivered | Product acceptance review |
| Analytics & Insights | 10% | Dashboards accurate, AI insights actionable | Data QA, SME review |
| Documentation & Support | 10% | Runbooks, privacy notes, data dictionary approved | Documentation checklist |

A release is considered "10/10" only when every dimension meets or exceeds its target.

## 14. Implementation Tracking Artifacts
- Jira Epics: `DEI-PLATFORM-*` (one per phase) with child stories mapped to DoD tasks.
- Miro board for UX flows and logic builder diagrams.
- FigJam for UI polish (light/dark mode tokens, typography scale).
- Supabase SQL migration scripts version-controlled under `supabase/migrations`.

## 15. Next Steps
1. Kick off Phase 1 with architecture review and finalize Supabase schema migrations.
2. Set up CI workflows for lint, `npm run test`, `npm run test:e2e`, Lighthouse, and Axe.
3. Begin component library implementation aligned with design tokens.
4. Schedule weekly cross-functional demos; maintain delivery scorecard updates.
5. Prepare pilot customer onboarding plan aligned with launch readiness checklist.

