# Design checker automation

The brand/design guardrails now run automatically both locally and inside CI so regressions are caught before shipping.

## How it works

1. **Command** – `npm run check:design` executes `scripts/design-consistency-checker.ts` via `ts-node`. The script inspects Tailwind tokens, gradients, toasts, and badge components to ensure they match the approved palette in `src/styles/design-tokens.css`.
2. **Artifacts** – Results are written to `design-consistency-report.json` so designers can diff specific failures.
3. **CI enforcement** – `.github/workflows/ci.yml` includes a “Design consistency” step after linting and before unit tests. Any failure blocks the pull request.

## Running locally

```bash
npm install
npm run check:design
```

The command exits with a non-zero code when:
- unsupported colors or gradients are detected
- button/toast/badge variants drift from the design tokens
- component overrides bypass the shared brand kit

## Troubleshooting tips

| Symptom | Fix |
| --- | --- |
| Report references a CSS variable that “does not exist” | Ensure the token is declared in `src/styles/design-tokens.css` and imported via `main.tsx`. |
| CI passes locally but fails in GitHub Actions | Delete `design-consistency-report.json` locally and rerun; the CI job always regenerates the file so stale artifacts can be ignored. |
| Script cannot find ts-node | Run `npm install` (ts-node is a dev dependency) or invoke `npx ts-node scripts/design-consistency-checker.ts`. |

## Extending the checker

- Add new brand tokens to `src/styles/design-tokens.css` first, then update the checker so the new variables are considered “approved”.
- When introducing new component categories (e.g., banners), mirror the existing checks for buttons/toasts to ensure the palette stays centralized.
