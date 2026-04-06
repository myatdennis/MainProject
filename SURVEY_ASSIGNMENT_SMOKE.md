# Survey Assignment Smoke Verification

This smoke verifies the runtime flow end-to-end:

1. Admin assigns a survey
2. Assignment persists
3. Learner can fetch assigned surveys
4. Learner submits survey
5. Completion persists

Script: `scripts/survey_assignment_smoke.mjs`
Task: `npm run smoke:survey-assignment`
Real DB-backed task: `npm run smoke:survey-assignment:real-db`

## Verification modes (do not mix these)

### A) Real DB-backed verification (proves real persistence)

Use this mode when you want true Supabase/database persistence evidence.

Requirements:

- server runtime mode is `db-backed` (no fallback flags)
- valid admin + learner bearer tokens
- no E2E bypass headers

Run:

```bash
SMOKE_ADMIN_BEARER_TOKEN="<admin_token>" \
SMOKE_LEARNER_BEARER_TOKEN="<learner_token>" \
SURVEY_SMOKE_API_BASE_URL="http://127.0.0.1:3000" \
SURVEY_SMOKE_ORG_ID="demo-sandbox-org" \
npm run smoke:survey-assignment:real-db
```

Guardrail: `smoke:survey-assignment:real-db` sets `SMOKE_EXPECT_DB_BACKED=true` and the script fails fast if the server reports fallback/simulated persistence.

### B) Fallback / E2E verification (proves runtime flow only)

This uses the same E2E bypass/session path already used by Playwright tests.
No guessed credentials are required.

This mode verifies API flow behavior, but persistence may be simulated in-memory.

```bash
SMOKE_USE_E2E_BYPASS=true \
SURVEY_SMOKE_API_BASE_URL="http://127.0.0.1:8888" \
npm run smoke:survey-assignment
```

Optional env:

- `SURVEY_SMOKE_API_BASE_URL` (default: `http://127.0.0.1:8888`)
- `SURVEY_SMOKE_ORG_ID` (default: `demo-sandbox-org`)
- `SURVEY_SMOKE_ADMIN_USER_ID` (default: `00000000-0000-0000-0000-000000000001`)
- `SURVEY_SMOKE_LEARNER_USER_ID` (default: `00000000-0000-0000-0000-000000000002`)

## Auth mode details

### Bearer-token mode (used by real DB-backed verification)

If you want to verify against real auth, provide both admin and learner bearer tokens:

```bash
SMOKE_ADMIN_BEARER_TOKEN="<admin_token>" \
SMOKE_LEARNER_BEARER_TOKEN="<learner_token>" \
SURVEY_SMOKE_API_BASE_URL="http://localhost:3000" \
SURVEY_SMOKE_ORG_ID="demo-sandbox-org" \
npm run smoke:survey-assignment
```

### E2E bypass mode (used by fallback/E2E verification)

```bash
SMOKE_USE_E2E_BYPASS=true npm run smoke:survey-assignment
```

## Getting bearer tokens in dev (no guessed credentials)

Use an actual signed-in browser session:

1. Sign in via the app UI as the target user (admin or learner).
2. Open DevTools Console on the same app origin.
3. Run this snippet and copy the first non-empty token.

```javascript
(() => {
  const stores = [localStorage, sessionStorage];
  const candidates = [];
  for (const store of stores) {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      const value = store.getItem(key);
      if (!value) continue;
      if (/access.?token|auth|session|supabase/i.test(key)) {
        candidates.push({ key, value });
      }
      try {
        const parsed = JSON.parse(value);
        const token = parsed?.access_token || parsed?.accessToken || parsed?.session?.access_token;
        if (token) {
          console.log('TOKEN', key, token);
        }
      } catch {
        // non-JSON value, continue
      }
    }
  }
  console.log('Candidates', candidates.map((c) => c.key));
})();
```

Then set:

- `SMOKE_ADMIN_BEARER_TOKEN` from admin session
- `SMOKE_LEARNER_BEARER_TOKEN` from learner session

## Expected output

On success, script prints:

- verification mode (`real-db-backed` or `fallback-e2e`)
- server runtime mode + assignment persistence mode (when exposed by `/api/health`)
- created survey id
- duplicate assign metadata (`inserted/updated/skipped`)
- learner status after submit (`completed`)
- `PASS`

On failure, script exits non-zero and prints the failing step + raw API response.

## Mode interpretation checklist

- If you need **real persistence proof**, use `smoke:survey-assignment:real-db` and bearer tokens.
- If you need **fast flow proof in test harness**, use E2E bypass mode.
- Do not treat bypass/fallback results as DB persistence evidence.
