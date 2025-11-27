# Efficiency review & recommendations

This file contains automated and manual recommendations to improve the repository build, run-time, and deployment performance.

1) Build optimizations (done):
- Added `vite-plugin-compression` to produce compressed artifacts (brotli) for production.
- Added `optimize:build` script to run CI, build and analyze bundles.

2) Dependency & bundle efficiency:
- Run `npm run optimize:build` to generate production build and a bundle analysis report.
- Inspect `npm run analyze` output for large chunks and move rarely-used heavy libraries to lazy-loaded chunks (e.g., large admin pages are already split into `admin-*` chunks in `vite.config.ts`).
- Consider replacing large charting libs (Chart.js/Recharts) with lighter alternatives or dynamic import on heavy pages.

3) Dependency auditing and dedupe:
- Run `npm audit` and `npm audit fix` if available. For major vulnerabilities, upgrade dependencies or use `npm audit` logs to triage.

4) Production static hosting:
- Ensure compression & caching at CDN/Netlify in Netlify settings; enable Brotli and gzip for assets.
- Leverage `Cache-Control` headers and set long-lived max-age for static JS/CSS since hashed filenames are used.

5) Remove unused devDependencies:
- After reviewing, remove any devDependencies or dependencies that are not necessary for production (e.g., `supabase` appeared in devDependencies and `@supabase/supabase-js` in dependencies — verify if both are required).

6) Test & Validation:
- After changes, run `npm ci && npm run build` locally or in CI to verify outcome.
