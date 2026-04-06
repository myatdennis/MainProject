# HDI Implementation Entry Points (Survey Assignment System)

This map identifies stable integration points in the current survey-assignment stack for HDI rollout.

## 1) Stable survey extension points

- **HDI template source**
  - `server/index.js`
  - `GET /api/admin/surveys/templates/hdi`
  - Uses `buildHdiSurveyTemplate()` from `server/lib/hdiTemplate.js`

- **Survey create/update persistence path**
  - `POST /api/admin/surveys`
  - `PUT /api/admin/surveys/:id`
  - Assignment target normalization and synchronization already wired (`normalizeAssignedTargets`, `syncSurveyAssignments`).

- **HDI detection + scoring trigger on submit**
  - `POST /api/client/surveys/:id/submit`
  - Uses `isHdiAssessment(...)`, `scoreHdiSubmission(...)`, `buildHdiProfile(...)`, `buildHdiReport(...)`
  - Supports pre/post comparison logic via `compareHdiReports(...)` / `buildHdiComparison(...)`

## 2) Assignment hooks to reuse

- **Admin assignment write endpoint**
  - `POST /api/admin/surveys/:id/assign`
  - Duplicate-safe semantics already present (`inserted/updated/skipped` meta)
  - Persistence verification path built in

- **Aggregate refresh hook**
  - `refreshSurveyAssignmentAggregates(surveyId)`
  - Invoked after assignment updates and learner submit completion

- **Audit/event hooks**
  - `logSurveyAssignmentEvent(...)`
  - Existing event set includes: attempted, created, updated, skipped_duplicate, persisted, completed, failed

## 3) Learner results/reporting entry points

- **Assigned survey visibility endpoint**
  - `GET /api/client/surveys/assigned`

- **Submission endpoint (core write path)**
  - `POST /api/client/surveys/:id/submit`
  - Marks assignment completion and writes completion audit metadata

- **Learner results endpoint**
  - `GET /api/client/surveys/:id/results`
  - Returns latest HDI record + optional pre/post comparison payload

## 4) Admin analytics/reporting entry points

- **Participant report**
  - `GET /api/admin/surveys/:id/hdi/participant-report`
  - Uses `buildHdiParticipantRows(...)`

- **Cohort analytics**
  - `GET /api/admin/surveys/:id/hdi/cohort-analytics`
  - Uses `buildHdiCohortAnalytics(...)`

- **Pre/post comparison**
  - `GET /api/admin/surveys/:id/hdi/pre-post-comparison`
  - Uses `buildHdiComparison(...)`

## 5) Recommended immediate HDI implementation sequence

1. **Finalize HDI survey schema contract**
   - Lock required metadata keys (`assessmentType`, `administrationType`, `participantKey`, `linkedAssessmentId`).
2. **Standardize participant identity derivation**
   - Ensure deterministic participant-key rules across submit + reporting endpoints.
3. **Harden pre/post linking rules**
   - Add strict validation for pre/post pairing and linked-assessment integrity.
4. **Promote analytics payload contracts**
   - Define typed response shapes for participant/cohort/comparison endpoints.
5. **Add focused tests**
   - Submit scoring happy path + one malformed payload case + pre/post comparison edge case.
