Plan to fix ESLint warnings

1) Decision: choose approach
   - A: Code-first: fix warnings by editing code (remove unused imports, add missing deps, small type annotations). Safer but slower; I'll do files in batches and run lint between batches.
   - B: Suppress-first: add targeted ESLint disables or relax rules (temporary), then follow with code fixes later. Fast but less "clean".

2) If A, I'll execute in batches:
   - Batch 1: remove unused icon imports across Admin pages and components (common source of warnings).
   - Batch 2: fix react-hooks/exhaustive-deps warnings by adding deps or useCallback where appropriate.
   - Batch 3: fix remaining warnings (unused vars, minor type hints, rename unused args to _arg).
   - After each batch: run eslint --fix and npx tsc --noEmit and commit.

3) If B, I'll add file-level ESLint disables for the heavy-warning files and re-run lint; then optionally follow up with code fixes in smaller PRs.

Please reply with your preferred approach: A (code-first) or B (suppress-first).