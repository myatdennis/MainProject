Playwright E2E tests for MainProject

This folder contains Playwright tests that exercise critical LMS flows:
- Admin: create -> publish -> assign
- Learner: sees assignment -> plays video -> progress sync

Quick start (local):
1. Install deps (if not already installed):
   npm install --save-dev @playwright/test
   npx playwright install --with-deps

2. Run the dev server in another terminal (Vite):
   npm run dev

3. Run Playwright tests:
   npx playwright test tests/e2e --config=tests/e2e/playwright.config.ts

Notes:
- The shared helpers default to `E2E_BASE_URL=http://localhost:5174` (Vite) and `E2E_API_BASE_URL=http://localhost:8888` (Express via `server/start-e2e-dev.cjs`). Override those env vars if your dev server runs elsewhere.
- Use the provided `loginAsAdmin` helper instead of copy/pasting form filling logic—it's SecureAuth-aware and waits for the `#email` bootstrap to complete.
- Adjust credentials and selectors to match your app (the test includes a few conservative fallbacks).
- These are smoke/integration tests and not a complete replacement for manual QA.
