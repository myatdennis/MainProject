# Customer UAT Checklist – Enterprise Pilot

_Session date:_ **2026-01-06** (09:00–11:00 PT)

Participants
- **Customer:** Redwood Charter (Ops lead: Priya Shah, IT: Doug Hampton)
- **Huddle:** Alexis (infra), Taye (product), Lila (support)

## 1. Environments & access
- ✅ Staging slot `admin-platform-blue` synced with production snapshot `2025-12-30`.
- ✅ Feature flags set to match GA defaults (`FORCE_ORG_ENFORCEMENT=true`, `USE_ASSIGNMENTS_API=true`, `ENABLE_NEW_SW=true`).
- ✅ Demo analytics datasets disabled to ensure telemetry reflects live interactions.

## 2. Test matrix

| Scenario | Owner | Exit criteria | Status |
| --- | --- | --- | --- |
| Org-scoped analytics dashboards | Priya (customer) + Alexis shadowing | Course completion + engagement widgets show only Redwood data; data freshness < 5 min | ✅ Scripted steps validated 2025-12-31 |
| Offline queue recovery | Doug | Toggle laptop offline for 10 min, confirm queued progress auto-flushes without duplicates | ✅ Demo run recorded 2025-12-31 |
| Assignment publishing + rubric edits | Taye | Instructor can publish, learner receives notification, admin can revoke | ✅ Covered in `NEXT_PHASE_REPORT.json` step 14 |
| Video upload + Supabase storage | Lila | Upload 80 MB clip, confirm signed URL loads via CDN domain | ✅ Completed 2025-12-30 |
| Analytics export CSV | Priya | `/api/admin/analytics/export` returns scoped CSV; spot check 5 learners | ✅ CSV attached to ops ticket #PD-482 |

## 3. Success metrics
- No P1 defects logged during the session.
- Any Sev2 bugs receive mitigation in < 24h (tracked in Linear project `ADMIN-UAT-2026`).
- Customer sign-off captured via follow-up email template (see Support Confluence page `UAT Sign-off`).

## 4. Communication plan
- **Pre-brief:** Send agenda + Zoom link 24h prior.
- **Live notes:** Lila to capture in shared Google Doc (`UAT - Redwood - 2026-01-06`).
- **Wrap-up:** Email summary + next steps within 2 hours of session end.

This checklist unblocks the Phase 10 “Customer UAT” gate by documenting the scenarios, owners, and dry-run results completed on 2025-12-31.
