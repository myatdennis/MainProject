# Survey Assignment Real DB-Backed Smoke — Release Evidence

## Status

**Gate result:** ✅ **PASS artifact captured (real DB-backed run).**

## Attempt timestamp

- Successful smoke execution observed after server startup at `2026-04-06T12:43:24.834Z`.

## Runtime mode confirmation (server)

From startup logs:

- `startup_runtime_mode.mode`: `db-backed`
- `startup_runtime_mode.surveyAssignmentPersistence`: `real`
- Console banner: `[startup] DB-backed mode | survey assignment persistence: real-db`

This confirms the run executed in real persistence mode.

## Executed real-db smoke

Smoke runner output:

```text
[survey-smoke] PASS {
  surveyId: '338339aa-499c-4e40-a1a3-e869cd94c961',
  duplicateMeta: { inserted: 0, updated: 1, skipped: 0, invalidTargetIds: [] },
  learnerStatus: 'completed'
}
```

## Evidence summary

- Survey create/assign flow completed against real DB.
- Duplicate assign behavior verified (`inserted: 0`, `updated: 1`).
- Learner assigned-survey path succeeded.
- Learner submit/completion succeeded (`learnerStatus: completed`).

## Guardrails honored

- No bypass mode used for the PASS artifact.
- Real bearer-token auth path exercised.
- Server remained in DB-backed runtime mode throughout.
