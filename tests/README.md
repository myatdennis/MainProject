Local e2e test instructions

1) Install deps

```bash
npm install
npx playwright install --with-deps
```

2) Start dev server (for development / debugging)

```bash
npm run dev
# note the port printed by Vite (usually 5175, may change). Update tests if needed.
```

3) Quick smoke via Node script (headed browser, useful for debugging):

```bash
node tests/run-survey-import.mjs
```

4) Run full Playwright runner tests (after installing @playwright/test):

```bash
npm run test:e2e
```

Troubleshooting
- If Playwright throws 'Page closed' or browser crashes, try running headed (set headless: false) and inspect console logs.
- If ports differ, update the test base URL or ensure Vite serves on a known port (e.g., `--port 5176`).
