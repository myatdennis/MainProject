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
- The test uses lightweight selectors and will create demo entities. It expects the app running at VITE_API_BASE_URL (default localhost:5173 when using Vite).
- Adjust credentials and selectors to match your app (the test includes a few conservative fallbacks).
- These are smoke/integration tests and not a complete replacement for manual QA.
