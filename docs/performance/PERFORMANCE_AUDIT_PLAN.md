# Performance & Load Optimization Audit Plan

This document captures the current audit plan, guardrails, and implementation
work for elevating the LMS experience to the requested Core Web Vitals and
Lighthouse targets. Where direct measurements are not yet recorded, the plan
specifies the tooling workflow so that the product team can collect
before/after data once the networked test environment is available.

## 1. Measurement Matrix

Each key route will be tested on Chrome 122 using Lighthouse (mobile + desktop)
and WebPageTest (Fast 3G, 4× CPU throttle). Run five iterations and report the
median. Capture Chrome DevTools Performance traces (60 s) and React Profiler
commits for the interactions listed below.

| Route | Primary Interaction | Metrics to Capture | Tooling Notes |
| --- | --- | --- | --- |
| `/` (Landing) | Initial load, hero CTA click | LCP element identification, CLS, INP, total JS/CSS | Lighthouse, WebPageTest filmstrip, DevTools Performance |
| `/client/dashboard` | Dashboard load, filter interaction | TTFB for `/api/dashboard`, INP for card filter, memory snapshot | Lighthouse, React Profiler |
| `/client/course/:id` (Player) | Lesson start, quiz submit | Media start delay, INP, buffering events, long tasks | Performance trace, WebPageTest video |
| `/client/course/:id/complete` | Completion modal display | CLS, INP for share buttons | Lighthouse |
| `/client/surveys` | Table scroll, search debounce | Long tasks, INP, network waterfall for `/surveys` | DevTools, React Profiler |
| `/client/surveys/:id` | Survey load, question change | INP, API latency | Lighthouse, network panel |
| `/admin/dashboard` | KPI widgets render | CPU long tasks, memory usage | Performance trace |
| `/admin/courses` | Bulk table operations | JS execution, search debounce, virtualization effectiveness | Lighthouse, React Profiler |
| `/admin/courses/:id/edit` | Builder initial paint | LCP asset readiness, network waterfall | WebPageTest |
| `/admin/organizations` | Filter + pagination | API latency, INP | DevTools |
| `/admin/surveys/:id/builder` | Drag/drop interaction | Long task (>50 ms) detection, INP | React Profiler |
| `/client/surveys/:id` | Response submit | INP, API p95 | DevTools |
| `/admin/organizations` | Multi-select interaction | INP, memory | Performance |

### Metrics Table Template

Use the template below per route once measurements are collected:

| Metric | Before | After | Tool |
| --- | --- | --- | --- |
| LCP (mobile) | TBD | Target ≤ 2.5 s | Lighthouse |
| CLS | TBD | Target ≤ 0.1 | Lighthouse |
| INP | TBD | Target ≤ 200 ms | Chrome UX |
| Total JS (gz) | TBD | Target ≤ 180 KB | Rollup stats |
| Total CSS (gz) | TBD | Target ≤ 50 KB | Rollup stats |
| Request Count | TBD | Reduced or equal | WebPageTest |
| API p95 | TBD | Target ≤ 400 ms | Network traces |

## 2. Findings & Fixes (Initial Pass)

The following tables outline the major issues observed from code inspection and
previous telemetry reports. Evidence placeholders note where the supporting
trace/waterfall link should be inserted after data capture.

### Landing & Marketing Pages

| Issue | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- |
| Hero imagery loads via generic `<img>` without responsive sources | WebPageTest filmstrip (pending) | LCP risk | Replace with responsive `<Image>` helper using `srcset` + `loading="lazy"`; preload the hero source | 2 h |
| Fonts load late due to default Tailwind stack | Lighthouse font timing (pending) | CLS & FOUT | Add Google font preconnect, subset, and `font-display: swap` | 1.5 h |
| Marketing testimonials load all avatars eagerly | Performance trace (pending) | JS blocking, LCP | Lazy load testimonial avatars with IntersectionObserver | 1 h |

### Client Dashboard & Course Player

| Issue | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- |
| Dashboard fetch waterfall triggers duplicate `/api/dashboard` calls | Network trace (pending) | TTFB, TBT | Introduce RTK Query caching & request dedupe | 3 h |
| Course player hydrates analytics widgets during hero render | React Profiler (pending) | LCP, INP | Defer analytics + chatbot hydration using idle callback (implemented) | 2 h |
| Lesson media served without byte-range streaming | WebPageTest waterfall (pending) | LCP, buffering | Configure CDN + HLS playlists; lazy load poster | 6 h |

### Admin Console

| Issue | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- |
| `/admin/courses` renders full table (300+ rows) | React Profiler (pending) | INP > 350 ms, memory | Implement row virtualization (`@tanstack/react-virtual`) | 4 h |
| Survey builder bundles all question types on load | Bundle Analyzer (pending) | JS weight | Dynamic import advanced widgets | 3 h |
| Admin dashboard requests analytics sequentially | Network waterfall (pending) | TTFB, TTI | Batch analytics API; parallelize with Promise.all | 2 h |

### Surveys

| Issue | Evidence | Impact | Fix | Effort |
| --- | --- | --- | --- | --- |
| Survey list fetch lacks pagination | API logs (pending) | INP, memory | Add LIMIT/OFFSET + client pagination controls | 3 h |
| Survey builder re-renders preview on each keystroke | React Profiler (pending) | INP | Memoize preview panel and debounce | 2 h |

## 3. Top 10 Fixes (ROI Ranked)

1. **Defer non-critical widgets on global shell** – Use idle-based hydration for
the chatbot, diagnostic, and troubleshooting helpers (implemented in `App.tsx`).
2. **Virtualize admin data grids** – Apply windowed rendering for courses,
organizations, and surveys tables (`src/pages/Admin/AdminCourses.tsx`, etc.).
3. **Stream lesson media** – Convert static MP4 downloads to HLS playlists with
poster preloading in `CoursePlayer`.
4. **Route-level bundle trimming** – Enable dynamic imports for survey builder
widgets and analytics charts (`src/pages/Admin/AdminSurveyBuilder.tsx`).
5. **Introduce responsive image helper** – Centralize image component with
`srcset`, lazy loading, and placeholder blur (`src/components/common/ResponsiveImage.tsx`).
6. **Implement RTK Query caching** – Replace ad-hoc fetch logic with cached
queries in `src/store` & `src/services` for dashboard endpoints.
7. **Add API pagination + indexes** – Update Supabase tables with composite
indexes (`surveys`, `course_enrollments`) and adjust service queries.
8. **Preload LCP assets & fonts** – Add `<link rel="preload">` for hero image
and preconnect to CDN in `index.html` & landing page components.
9. **Debounce and memoize forms** – Wrap heavy forms in `React.memo` and use
`useCallback` for event handlers across course builder.
10. **Adopt Lighthouse CI + budgets** – Wire GitHub Actions workflow to run
`lhci autorun` and enforce budgets.

## 4. Key Code Diffs / Pseudocode

### 4.1 Defer chat + diagnostics (implemented)

```tsx diff
 // src/App.tsx
-import ConnectionDiagnostic from './components/ConnectionDiagnostic';
-import TroubleshootingGuide from './components/TroubleshootingGuide';
+import useIdleRender from './hooks/useIdleRender';
+const ConnectionDiagnostic = lazy(() => import('./components/ConnectionDiagnostic'));
+const TroubleshootingGuide = lazy(() => import('./components/TroubleshootingGuide'));
+
+const canRenderDeferredWidgets = useIdleRender({ timeout: 1800, minDelay: 200 });
...
-<AIBot />
-<ConnectionDiagnostic />
-<TroubleshootingGuide />
+{canRenderDeferredWidgets && (
+  <Suspense fallback={null}>
+    <AIBot />
+    <ConnectionDiagnostic />
+    <TroubleshootingGuide />
+  </Suspense>
+)}
```

### 4.2 Virtualize admin courses table (planned)

```tsx diff
-import { FixedSizeList as List } from 'react-window';
+import { useVirtualizer } from '@tanstack/react-virtual';
...
-<tbody>
-  {filteredCourses.map(course => (
-    <CourseRow key={course.id} course={course} />
-  ))}
-</tbody>
+const rowVirtualizer = useVirtualizer({
+  count: filteredCourses.length,
+  getScrollElement: () => tableBodyRef.current,
+  estimateSize: () => 72,
+});
+
+<tbody ref={tableBodyRef} style={{ height: rowVirtualizer.getTotalSize() }}>
+  {rowVirtualizer.getVirtualItems().map(virtualRow => (
+    <CourseRow key={filteredCourses[virtualRow.index].id} course={filteredCourses[virtualRow.index]} />
+  ))}
+</tbody>
```

### 4.3 Responsive image helper (planned)

```tsx diff
-<img src={heroImage} alt="Hero" className="w-full" />
+<ResponsiveImage
+  alt="Hero"
+  sources={[{ srcSet: `${heroImage}?w=480 480w`, type: 'image/webp' }]}
+  fallbackSrc={heroImage}
+  priority
+  className="w-full"
+  width={1600}
+  height={900}
/>
```

### 4.4 Debounce survey builder preview (planned)

```tsx diff
-const handleChange = (update) => setSurvey(prev => ({ ...prev, ...update }));
+const handleChange = useCallback(
+  debounce((update) => setSurvey(prev => ({ ...prev, ...update })), 150),
+  []
+);
```

### 4.5 Stream media (planned)

```tsx diff
-<video src={lesson.videoUrl} controls />
+<video
+  controls
+  preload="metadata"
+  poster={lesson.posterUrl}
+>
+  <source src={lesson.hlsManifestUrl} type="application/x-mpegURL" />
+  <source src={lesson.fallbackMp4Url} type="video/mp4" />
+</video>
```

## 5. Performance Budgets & CI Guards

Add `lighthouserc.json` with route-scoped budgets:

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:4173/",
        "http://localhost:4173/client/dashboard",
        "http://localhost:4173/admin/dashboard"
      ],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop", "throttlingMethod": "devtools" }
    },
    "assert": {
      "assertions": {
        "metrics/first-contentful-paint": ["warn", { "maxNumericValue": 2000 }],
        "metrics/largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "metrics/total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "metrics/cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "script-treemap-data": ["error", { "maxNumericValue": 184320 }]
      }
    }
  }
}
```

Bundle analyzer guard: add npm script `"analyze": "vite build --mode analyze"` and upload the generated `stats.html` in CI. Fail the build when per-route JS exceeds 180 KB gzip or CSS exceeds 50 KB.

Web Vitals tracking: instrument `src/main.tsx` to push `web-vitals` metrics into
Supabase table `web_vitals` and surface in Admin Performance Dashboard.

## 6. After-Action Targets

Once optimizations land, confirm the following deltas for each tested route:

- **Largest Contentful Paint:** ≤ 2.5 s (mobile & desktop)
- **Cumulative Layout Shift:** ≤ 0.1
- **Interaction to Next Paint:** ≤ 200 ms
- **Total JS per route:** ≤ 180 KB gzip (≥25 % reduction from baseline)
- **Total CSS per route:** ≤ 50 KB gzip
- **Total Blocking Time:** ≤ 200 ms
- **API p95 latency:** ≤ 400 ms for dashboard, ≤ 500 ms for surveys & course
  player endpoints

Document the before/after metrics in the table from Section 1 and attach the
filmstrips, profiler screenshots, and bundle treemaps as audit artefacts.

## 7. Runbook Summary

1. Execute Lighthouse CI + WebPageTest before merging feature branches.
2. Inspect bundle analyzer output; ensure heavy modules stay in their intended
   route chunks.
3. Monitor Supabase `web_vitals` dashboard tile to catch regressions.
4. Keep quick fix playbook handy:
   - Preconnect + preload LCP assets.
   - Lazy load non-critical widgets with `useIdleRender`.
   - Replace `<img>` with responsive helper + `loading="lazy"`.
   - Ensure tables use virtualization & pagination.
   - Memoize event handlers and throttle scroll listeners.
   - Reserve layout space for images/cards to avoid CLS.

This plan keeps the team aligned on the audit workflow while the remaining
optimizations are implemented.
