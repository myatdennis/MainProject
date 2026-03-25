# Runtime Validation Checklist — Huddle Admin LMS
**Version**: post-`continueAsGuest` bootstrap fix (March 25 2026)  
**Branch**: `feat/ws-client`  
**Tester setup**: Chrome DevTools open, Console tab, **Preserve log ✓**, **Verbose level**, Network tab with **Preserve log ✓**, filter `Fetch/XHR`.

---

## BEFORE YOU START

Open DevTools → Console → paste this filter into the filter box to focus on auth signals:
```
AUTH_|REQUIRE_AUTH|ROUTE MATCHED|COURSE|PAGE GATE|RENDER|BOOTSTRAP|SETTLED|RESET|apiBase
```

Open a second Network tab column: right-click column header → check **Response Headers** and **Initiator**.

---

## SCENARIO 1 — Cold Load "/"

**URL**: `https://the-huddle.co/`  
**State**: fresh incognito tab, no localStorage, no cookies  
**Clicks**: none — navigate to URL and observe

### Expected console logs (in order)
```
[AUTH BOOTSTRAP START]        pathname=/
[AUTH_STATE_SET]              source=runBootstrap:no_token_cold → unauthenticated
                              OR
[AUTH_RESET]                  source=continueAsGuest reason=bootstrap_login_route
                              (if Supabase token read fails immediately)
[AUTH_SETTLED_DEFERRED]       reason=public_auth_entry_no_token_cold  OR
                              reason=continueAsGuest:bootstrap_login_route:public_auth_entry
[AUTH_STATE_MACHINE]          authInitializing=false authStatus=unauthenticated
[REQUIRE_AUTH_EVAL]           authSettled=false bootstrapComplete=true authFullySettled=false
[REQUIRE_AUTH_WAIT]           (no redirect — stays on /)
```

### Expected network calls
- `GET /auth/session` — **may or may not fire** (only if a Supabase token exists)
- If fired: response `401` or `{ user: null }` is acceptable

### Must NOT appear
- Any `window.location.assign` redirect (no console `[AUTH REDIRECT DECISION] decision=redirecting`)
- `[REQUIRE_AUTH_FINAL_DECISION] decision=redirect`
- Any `GET /api/admin/courses` or `GET /api/admin/me`
- `[AUTH_RESET] continueAsGuest SUPPRESSED` (no prior session to suppress)
- Double `[AUTH BOOTSTRAP START]` entries

### Pass/Fail
- ✅ PASS: Marketing landing page renders fully, no redirect, no spinner overlay
- ✅ PASS: `[AUTH_SETTLED_DEFERRED]` appears (not `[AUTH_SETTLED]` with `authSettled=true`)
- ✅ PASS: `bootstrapComplete=true` in the `[AUTH_SETTLED_DEFERRED]` log
- ❌ FAIL: Page blank or shows spinner only
- ❌ FAIL: Browser redirects to `/admin/login` or `/login`
- ❌ FAIL: `[AUTH_SETTLED]` appears with `authSettled=true` (premature settlement on public path)

---

## SCENARIO 2 — Login from Admin Login Page

**URL**: `https://the-huddle.co/admin/login`  
**State**: continuing from Scenario 1 OR fresh incognito tab  
**Clicks**: enter valid admin email + password → click "Sign In"

### Phase A — Page load (before submitting)

#### Expected console logs
```
[AUTH BOOTSTRAP START]        pathname=/admin/login
[AUTH_RESET]                  source=continueAsGuest reason=bootstrap_login_route
[AUTH_STATE_SET]              source=continueAsGuest:bootstrap_login_route → unauthenticated
[AUTH_SETTLED_DEFERRED]       reason=continueAsGuest:bootstrap_login_route:public_auth_entry
                              authSettled=false bootstrapComplete=true
[AUTH_STATE_MACHINE]          authInitializing=false authStatus=unauthenticated
```

#### Must NOT appear on load
- `[AUTH_SETTLED]` with `authSettled=true` (must be deferred)
- `[REQUIRE_AUTH_FINAL_DECISION] decision=redirect`
- Any redirect to `/login`

### Phase B — After clicking "Sign In"

#### Expected network calls (in order)
```
POST supabase.co/auth/v1/token    → 200  (Supabase signInWithPassword)
GET  supabase.co/auth/v1/user     → 200  (getSession call)
GET  https://api.the-huddle.co/api/auth/session  → 200  { user: {...}, memberships: [...] }
GET  https://api.the-huddle.co/api/admin/me      → 200  { access: { allowed: true }, user: {...} }
```

#### Expected console logs (after submit, in order)
```
[AUTH SESSION RESTORED]       userId=<uuid> activeOrgId=<orgId> reason=admin_session_bootstrap
[AUTH_SETTLED]                pathname=/admin/login authStatus=authenticated reason=session_applied
[AUTH_STATE_SET]              source=fetchServerSession:admin → authenticated
[AUTH_STATE_SET]              source=login:admin_success → authenticated
[AUTH_STATE_MACHINE]          authInitializing=false authStatus=authenticated
[REQUIRE_AUTH_EVAL]           authSettled=true bootstrapComplete=true authFullySettled=true
[ROUTE MATCHED] admin         /admin/courses  (or /admin/dashboard)
[REQUIRE_AUTH_FINAL_DECISION] decision=allow  pathname=/admin/courses
[RequireAuth][admin]          admin_capability_granted  via=<platform_admin|org_admin>
[PAGE GATE AdminCourses]      isCatalogLoading=true  (or false if instant)
[COURSE RESET]                caller=courseStore.init/pre-fetch-flush
[COURSE FETCH]                source=getAllCoursesFromDatabase
[RAW API RESPONSE]            count=N  ids=[...]
```

#### Must NOT appear after login
- `[AUTH_RESET]` without `SUPPRESSED` suffix (no session wipe after login)
- `[REQUIRE_AUTH_WAIT]` after `[AUTH_SETTLED]` fires
- `[AUTH_SETTLED_DEFERRED]` (must now be settled)
- `bootstrapComplete=false` anywhere in logs after submit
- Any `401` on `GET /api/auth/session` after credentials accepted
- Double `GET /api/admin/me` within the same 500ms window
- `[apiBase] Missing VITE_API_BASE_URL` (env var must be set in deploy)
- URL bar showing `/login` at any point

### Pass/Fail
- ✅ PASS: Browser navigates to `/admin/courses` (or `/admin/dashboard`) after successful login
- ✅ PASS: Course list renders with actual courses (not empty, not error state)
- ✅ PASS: `[AUTH_SETTLED]` contains `bootstrapComplete=true authSettled=true`
- ✅ PASS: All API calls go to `https://api.the-huddle.co/api/...` (not `/api/...` same-origin)
- ❌ FAIL: Stuck on `/admin/login` with spinner
- ❌ FAIL: `[REQUIRE_AUTH_WAIT]` loops indefinitely (means `authFullySettled` never became true)
- ❌ FAIL: `bootstrapComplete=false` visible after login success
- ❌ FAIL: Network request to `/api/auth/session` going to Netlify (same-origin, not Railway)

---

## SCENARIO 3 — Hard Refresh on "/admin/courses"

**URL**: `https://the-huddle.co/admin/courses`  
**State**: currently logged in from Scenario 2  
**Clicks**: press `Cmd+Shift+R` (hard refresh, bypass cache)

### Expected console logs (in order)
```
[AUTH BOOTSTRAP START]        pathname=/admin/courses
[AUTH_STATE_SET]              → unauthenticated  (transient while token read is in flight)
  [wait for /auth/session response...]
[AUTH SESSION RESTORED]       userId=<uuid> reason=bootstrap_success
[AUTH_SETTLED]                pathname=/admin/courses reason=session_applied
[AUTH_STATE_SET]              source=runBootstrap:success → authenticated
[AUTH_STATE_MACHINE]          authInitializing=false authStatus=authenticated
[AUTH_SETTLED]                reason=bootstrap_finally  (from finally block — idempotent)
[REQUIRE_AUTH_EVAL]           authSettled=true bootstrapComplete=true authFullySettled=true
[ROUTE MATCHED] admin         /admin/courses
[REQUIRE_AUTH_FINAL_DECISION] decision=allow
[RequireAuth][admin]          admin_capability_granted
[PAGE GATE AdminCourses]      isCatalogLoading=true phase=loading
[COURSE RESET]                caller=courseStore.init/pre-fetch-flush
[COURSE FETCH]                url=/api/admin/courses
[RAW API RESPONSE]            count=N
[RENDER COURSES]              total=N filtered=N phase=ready
```

### Expected network calls
```
GET  https://api.the-huddle.co/api/auth/session   → 200
GET  https://api.the-huddle.co/api/admin/me        → 200
GET  https://api.the-huddle.co/api/admin/courses?includeStructure=true&includeLessons=true  → 200
```

### Must NOT appear
- `[REQUIRE_AUTH_REDIRECT]` (authenticated hard refresh must never redirect)
- `[REQUIRE_AUTH_WAIT]` persisting more than ~2 seconds
- Double `[AUTH BOOTSTRAP START]` (stale run protection should prevent this)
- `401` on `/auth/session` (valid session should restore)
- `[AUTH_RESET]` without SUPPRESSED on a fresh bootstrap with prior session token
- Any request to `/api/...` going to same-origin Netlify instead of Railway
- `[COURSE GRAPH REJECTED]` unless courses genuinely have no modules/lessons

### Pass/Fail
- ✅ PASS: Courses page renders with full course list within 3 seconds
- ✅ PASS: No full-page spinner persisting beyond token validation
- ✅ PASS: `[RAW API RESPONSE]` shows `count > 0` (or 0 only if DB is genuinely empty)
- ✅ PASS: Two `[AUTH_SETTLED]` entries OK (idempotent: `applySessionPayload` + `finally`)
- ❌ FAIL: Redirect to `/admin/login`
- ❌ FAIL: Courses list empty when DB has data (check `[RAW API RESPONSE]`)
- ❌ FAIL: Spinner visible for more than 5 seconds
- ❌ FAIL: `[COURSE STORE INPUT]` shows `[]` while Network tab shows courses in response body

---

## SCENARIO 4 — Hard Refresh on "/admin/analytics"

**URL**: `https://the-huddle.co/admin/analytics`  
**State**: logged in  
**Clicks**: navigate to analytics page, then `Cmd+Shift+R`

### Expected console logs
```
[AUTH BOOTSTRAP START]        pathname=/admin/analytics
[AUTH SESSION RESTORED]       userId=<uuid> reason=bootstrap_success
[AUTH_SETTLED]                reason=session_applied
[AUTH_SETTLED]                reason=bootstrap_finally
[REQUIRE_AUTH_FINAL_DECISION] decision=allow  pathname=/admin/analytics
[RequireAuth][admin]          admin_capability_granted
```

### Expected network calls
```
GET  https://api.the-huddle.co/api/auth/session   → 200
GET  https://api.the-huddle.co/api/admin/me        → 200
GET  https://api.the-huddle.co/api/admin/analytics/... → 200  (analytics-specific endpoints)
```

### Must NOT appear
- Redirect to `/admin/login`
- `[REQUIRE_AUTH_WAIT]` without resolution within 3 seconds
- Any 403 or 401 on analytics endpoints for a valid admin session
- `[apiBase] Missing VITE_API_BASE_URL`

### Pass/Fail
- ✅ PASS: Analytics page renders (charts, tables, or empty-state if no data)
- ✅ PASS: No redirect, no spinner lock
- ❌ FAIL: Page blank after 5 seconds
- ❌ FAIL: Admin access denied message for a valid admin user

---

## SCENARIO 5 — Rapid Navigation (dashboard → courses → users → organizations → surveys → analytics)

**URL**: Start at `https://the-huddle.co/admin/dashboard`  
**State**: logged in, courses already loaded once (Scenario 3)  
**Clicks**: click each nav item in the sidebar in rapid succession (~300ms between clicks)

### For EACH navigation click

#### Expected console logs per nav
```
[ROUTE MATCHED] admin         /admin/<page>
[REQUIRE_AUTH_EVAL]           authSettled=true authFullySettled=true  ← must NOT wait
[REQUIRE_AUTH_FINAL_DECISION] decision=allow  ← immediate, no wait
[PAGE GATE Admin<Page>]       (DEV only, may appear)
```

#### Expected network calls per nav
- `GET /api/admin/<page-specific-data>` — loads page data
- `GET /api/admin/me` — **must NOT re-fire** if already granted within same session (check `adminGateKeyRef` dedup)

#### Must NOT appear during rapid nav
- `[REQUIRE_AUTH_WAIT]` on any navigation after first authenticated load (i.e., `hasResolvedAuthRef.current` must be `true`)
- Full-page spinner flashing between routes
- `[AUTH_RESET]` on any nav click
- `[AUTH BOOTSTRAP START]` re-triggering mid-navigation
- `[COURSE RESET]` firing on EVERY nav click (should only fire on explicit `forceInit` calls, not passive nav)
- Multiple simultaneous `GET /api/auth/session` calls racing

### Special check — org switch (if org selector is visible)
- Change org in sidebar dropdown
- Expected: `[AdminLayout] forceInit after org switch` + `[COURSE RESET]` + `[COURSE FETCH]`
- Must NOT: silent failure with stale courses from wrong org

### Pass/Fail
- ✅ PASS: All 6 pages render without spinner lock or redirect
- ✅ PASS: No `[REQUIRE_AUTH_WAIT]` after first authenticated render
- ✅ PASS: `GET /api/admin/me` fires at most once per unique `userId:membershipStatus` key
- ✅ PASS: Course list on `/admin/courses` shows cached data immediately, no re-fetch spinner
- ❌ FAIL: Any page shows full-screen spinner for >1 second during rapid nav
- ❌ FAIL: `[REQUIRE_AUTH_WAIT]` appears on a nav after first successful auth
- ❌ FAIL: Console shows `[AUTH_RESET]` during navigation (session destroyed mid-session)

---

## SCENARIO 6 — Logout

**URL**: currently on any admin page  
**Clicks**: click avatar/user menu → click "Log out"

### Expected console logs
```
[AUTH_STATE_SET]              source=logout:manual_logout → unauthenticated
[AUTH_STATE_SET]              source=logout:manual_logout sessionStatus → unauthenticated
[AUTH_STATE_MACHINE]          authInitializing=false authStatus=unauthenticated sessionStatus=unauthenticated
[REQUIRE_AUTH_EVAL]           authStatus=unauthenticated authSettled=true
[REQUIRE_AUTH_FINAL_DECISION] decision=redirect  target=/admin/login
[REQUIRE_AUTH_REDIRECT]       pathname=/admin/<page> → /admin/login
```

### Expected network calls
```
POST https://api.the-huddle.co/api/auth/logout    → 200 or 204
POST supabase.co/auth/v1/logout                   → 204  (Supabase signOut)
```

### Must NOT appear
- `[AUTH_RESET]` (logout goes through `logout()` directly, not `continueAsGuest`)
- Any `GET /api/admin/courses` or `GET /api/admin/me` after logout fires
- `[REQUIRE_AUTH_WAIT]` loop (settled state from prior session allows immediate redirect)
- Double `POST /auth/logout` (logout must fire exactly once)

### localStorage after logout (check Application → Local Storage)
- `huddle_access_token` → **absent or empty**
- `huddle_refresh_token` → **absent or empty**
- `secure_user_session` → **absent or empty**
- `huddle_admin_access_snapshot` → **absent** (cleared by `clearAdminAccessSnapshot()`)

### Pass/Fail
- ✅ PASS: Browser arrives at `/admin/login` immediately after click
- ✅ PASS: localStorage tokens are cleared
- ✅ PASS: `POST /api/auth/logout` returns 200
- ❌ FAIL: Stays on current admin page after clicking logout
- ❌ FAIL: Tokens still present in localStorage
- ❌ FAIL: API calls continue firing after logout (authenticated requests with stale token)

---

## SCENARIO 7 — Login Again Without Closing Browser

**URL**: `/admin/login` (arrived from Scenario 6 logout redirect)  
**State**: previously authenticated in this tab, now logged out, NO new tab opened

### Phase A — Page state check (before entering credentials)

#### Expected console logs
```
[AUTH_RESET]                  source=continueAsGuest reason=bootstrap_login_route
[AUTH_SETTLED_DEFERRED]       reason=continueAsGuest:bootstrap_login_route:public_auth_entry
[AUTH_STATE_MACHINE]          authInitializing=false authStatus=unauthenticated
```

**Critical check**: `[AUTH_SETTLED_DEFERRED]` must appear — NOT `[AUTH_SETTLED]`.  
`authSettled` must be `false` here so `RequireAuth` cannot redirect the user back to a protected route before they log in again.

#### Must NOT appear
- `[AUTH_SESSION_RESTORED]` (no auto-login from cached state)
- `[REQUIRE_AUTH_FINAL_DECISION] decision=allow` (must not skip login page)
- `[AUTH_SETTLED]` with `authSettled=true` (not yet settled)
- `window.__HUDDLE_AUTH_REDIRECT_FIRED__` still set to `true` (module-level flag should be fresh after navigation away from protected route)

### Phase B — Second login attempt

#### Expected logs (same as Scenario 2 Phase B)
```
[AUTH SESSION RESTORED]       reason=admin_session_bootstrap
[AUTH_SETTLED]                authSettled=true reason=session_applied
[REQUIRE_AUTH_EVAL]           authFullySettled=true
[REQUIRE_AUTH_FINAL_DECISION] decision=allow
```

#### Must NOT appear
- `hasResolvedAuthRef = true` blocking new auth (ref is per-component instance — remount after logout navigation resets it)
- Courses page showing stale data from previous session's org

### Pass/Fail
- ✅ PASS: Second login succeeds and reaches `/admin/courses` exactly as first login did
- ✅ PASS: `[AUTH_SETTLED_DEFERRED]` fires on login page load (not `[AUTH_SETTLED]`)
- ✅ PASS: Course list reflects current session's org (no cross-session contamination)
- ❌ FAIL: Auto-redirect to admin dashboard without entering credentials (cached session leak)
- ❌ FAIL: `bootstrapComplete=false` after second login submit
- ❌ FAIL: `[REQUIRE_AUTH_WAIT]` loops after second login success

---

## SCENARIO 8 — Temporary Network Disturbance

**URL**: `/admin/courses` while logged in  
**Clicks**:
1. DevTools → Network → Throttling → **Offline**
2. Reload page (`Cmd+R`)
3. Wait 5 seconds for timeout behavior
4. DevTools → Network → Throttling → **Online**
5. Click "Retry sync" button (if visible) OR reload again

### Phase A — During offline reload

#### Expected console logs
```
[AUTH BOOTSTRAP START]        pathname=/admin/courses
[SecureAuth] Failed to inspect Supabase session during bootstrap   (warn)
  — or —
[AUTH_RESET]                  source=continueAsGuest reason=bootstrap_no_supabase_token
  — or —
[SecureAuth] bootstrap timeout fail-open                           (warn, after 10s)
```

#### Must NOT appear during offline
- Hard redirect to `/admin/login` before timeout (bootstrap fail-open timer gives 10s)
- `[AUTH_SETTLED]` with `authStatus=authenticated` (no session can be confirmed offline)
- Any successful `GET /auth/session` (impossible while offline)

### Phase B — After going back online and retrying

#### Expected console logs
```
[AUTH SESSION RESTORED]       reason=bootstrap_success  OR  admin_session_bootstrap
[AUTH_SETTLED]                authSettled=true
[REQUIRE_AUTH_FINAL_DECISION] decision=allow
[COURSE RESET] + [COURSE FETCH]
[RAW API RESPONSE]            count=N
```

#### Must NOT appear after recovery
- `[AUTH_RESET]` wipe of a valid session
- Course list remaining empty after successful recovery
- `[apiBase] Missing VITE_API_BASE_URL` error

### Pass/Fail
- ✅ PASS: Offline page shows a meaningful error state (not blank white screen)
- ✅ PASS: After reconnection, clicking Retry or reloading restores full auth + courses
- ✅ PASS: Bootstrap fail-open timer fires at ~10s during extended offline (see `[SecureAuth] bootstrap timeout fail-open`)
- ❌ FAIL: App permanently stuck after recovery (requires full manual reload to fix)
- ❌ FAIL: `[AUTH_RESET]` fires and destroys confirmed session during transient offline
- ❌ FAIL: Courses show data from previous org or empty after a clean recovery

---

## SCENARIO 9 — Browser Reload on Protected Route (with valid session)

**URL**: `https://the-huddle.co/admin/analytics`  
**State**: logged in, session valid  
**Clicks**: `Cmd+R` (soft reload, uses cache)

This is distinct from Scenario 4 (hard refresh) — a soft reload preserves Supabase's localStorage session tokens.

### Expected console logs (in order)
```
[AUTH BOOTSTRAP START]        pathname=/admin/analytics
  [Supabase token found immediately — no AUTH_BOOTSTRAP_WAIT]
[AUTH SESSION RESTORED]       userId=<uuid> reason=bootstrap_success
[AUTH_SETTLED]                pathname=/admin/analytics reason=session_applied
[AUTH_STATE_SET]              source=runBootstrap:success → authenticated
[AUTH_SETTLED]                reason=bootstrap_finally
[AUTH_STATE_MACHINE]          authInitializing=false authStatus=authenticated
[REQUIRE_AUTH_EVAL]           authSettled=true bootstrapComplete=true authFullySettled=true
[REQUIRE_AUTH_FINAL_DECISION] decision=allow
```

### Expected network calls
```
GET  https://api.the-huddle.co/api/auth/session  → 200  { user: {...} }
GET  https://api.the-huddle.co/api/admin/me      → 200
```

### Must NOT appear
- `[AUTH_BOOTSTRAP_WAIT]` (token is present — no cold-boot no-token path)
- `[AUTH_SETTLED_DEFERRED]` (analytics is a protected route, not a public auth entry)
- Redirect to `/admin/login`
- `[REQUIRE_AUTH_WAIT]` lasting more than 3 seconds
- `[AUTH_RESET]` (valid token should restore session cleanly)

### Pass/Fail
- ✅ PASS: Analytics page renders within 2 seconds of reload
- ✅ PASS: `[AUTH_SETTLED]` fires with `authStatus=authenticated`
- ✅ PASS: Exactly one `GET /api/auth/session` in Network tab (not multiple races)
- ❌ FAIL: Redirect to login on reload (regression: stale `bootstrap_login_route` behavior)
- ❌ FAIL: Two or more concurrent `GET /auth/session` calls (stale-run guard failing)
- ❌ FAIL: `bootstrapComplete=false` in `[REQUIRE_AUTH_EVAL]` (the core bug this fix addresses)

---

## SCENARIO 10 — Console + Network Inspection Checklist

Run these checks at any point during a logged-in session.

### Console Health Checks

Run in browser console:
```js
// 1. Check auth debug snapshot
window.__HUDDLE_AUTH_DEBUG__.dump()
```
**Expected**: `{ authStatus: 'authenticated', sessionStatus: 'authenticated', hasSession: true, activeOrgId: '<uuid>', ... }`

```js
// 2. Verify no double /api prefix in any recent XHR
window.__HUDDLE_AUTH_DEBUG__.dump().lastRedirect
```
**Expected**: `null` or a legitimate redirect reason (not a redirect from a protected route)

```js
// 3. Check that authSettled is exposed correctly
// (via React DevTools: select SecureAuthProvider, read authSettled from state)
```
**Expected value after login**: `true`

```js
// 4. Confirm no stale bootstrap flag
// Look for in console history:
// [AUTH_SETTLED] reason=bootstrap_finally  → must appear exactly once per page load with token
// [AUTH_SETTLED] reason=session_applied    → must appear for every login/session restore
```

### Network Inspection Checks

In Network tab (filter: XHR, `api.the-huddle.co`):

| Request | Expected | Pass condition |
|---------|----------|----------------|
| `GET /auth/session` | `200 { user: {...} }` | Response URL starts with `https://api.the-huddle.co` |
| `GET /admin/me` | `200 { access: { allowed: true } }` | Fires once after membership resolves, not on every route change |
| `GET /admin/courses?includeStructure=true` | `200 [{ id, title, modules: [...] }]` | Response URL = Railway, count > 0 if DB has data |
| `POST /auth/logout` | `200` or `204` | Only fires when logout button clicked |
| `POST /auth/refresh` (if fired) | `200 { accessToken, refreshToken }` | Only fires on token expiry, not every request |

### Must NEVER appear in Network tab
- Any `GET /api/auth/session` going to **Netlify origin** (`the-huddle.co/api/auth/session`)
- `404` on `GET /api/admin/courses`
- `401` on `GET /api/admin/courses` for a logged-in admin user
- `GET /api/api/...` (double `/api` prefix — `assertNoDoubleApi` guard would throw)
- CORS errors on any `api.the-huddle.co` request

### localStorage State Check (Application tab → Local Storage → `the-huddle.co`)

| Key | Logged-in expected | Logged-out expected |
|-----|-------------------|---------------------|
| `huddle_access_token` | Non-empty JWT string | Absent or empty |
| `huddle_refresh_token` | Non-empty string | Absent or empty |
| `secure_user_session` | JSON with `id`, `email`, `role` | Absent or empty |
| `huddle_admin_access_snapshot` | JSON with `access.allowed: true` | Absent |
| `huddle_active_org_preference` | UUID string | Absent or stale (OK) |

### Pass/Fail
- ✅ PASS: All API calls resolve to `api.the-huddle.co` in the Request URL column
- ✅ PASS: `window.__HUDDLE_AUTH_DEBUG__.dump()` shows `authStatus=authenticated` while on admin page
- ✅ PASS: No CORS errors in console
- ✅ PASS: `GET /admin/me` fires at most once per tab lifetime per `userId:membershipStatus` key
- ❌ FAIL: Any network call URL shows `the-huddle.co/api/...` (same-origin routing to Netlify)
- ❌ FAIL: `[apiBase] Missing VITE_API_BASE_URL in production` visible in console
- ❌ FAIL: `[apiBase] Detected double /api prefix` in console

---

## QUICK PASS/FAIL SUMMARY TABLE

| Scenario | Core assertion | Log to verify | Fail signal |
|----------|---------------|---------------|-------------|
| 1. Cold `/` | Landing renders, no redirect | `[AUTH_SETTLED_DEFERRED]` | Redirect to `/login` |
| 2. Login `/admin/login` | Reaches `/admin/courses` after submit | `[AUTH_SETTLED] reason=session_applied` + `bootstrapComplete=true` | `[REQUIRE_AUTH_WAIT]` loops |
| 3. Hard refresh `/admin/courses` | Courses render, no redirect | `[AUTH_SESSION_RESTORED]` + `[REQUIRE_AUTH_FINAL_DECISION] allow` | Redirect to login |
| 4. Hard refresh `/admin/analytics` | Analytics renders, no redirect | `[REQUIRE_AUTH_FINAL_DECISION] allow` | Redirect to login |
| 5. Rapid nav | No spinner between nav items | No `[REQUIRE_AUTH_WAIT]` after first auth | Spinner flash on nav |
| 6. Logout | Arrives at `/admin/login`, tokens cleared | `[REQUIRE_AUTH_REDIRECT]` + localStorage empty | Stays on current page |
| 7. Re-login | Full login flow works again | `[AUTH_SETTLED_DEFERRED]` on page load, then `[AUTH_SETTLED]` after submit | Auto-redirect without credentials |
| 8. Network disturbance | Recovery without session wipe | `[AUTH SESSION RESTORED]` after reconnect | `[AUTH_RESET]` during offline |
| 9. Soft reload | Protected route restores session | `[AUTH_SETTLED] reason=bootstrap_finally` | Redirect to login |
| 10. Console/Network | All calls to Railway, no double-API | No same-origin `/api/...` in Network tab | Any call going to Netlify |

---

## KNOWN ACCEPTABLE BEHAVIORS (not bugs)

- **Two `[AUTH_SETTLED]` entries on hard reload with token**: First fires from `applySessionPayload` (`reason=session_applied`), second from `runBootstrap finally` (`reason=bootstrap_finally`). Idempotent, both correct.
- **`[AUTH_RESET] continueAsGuest SUPPRESSED`** appearing: This is the race-protection guard working correctly — a background session poll tried to clear a live session and was blocked.
- **`[REQUIRE_AUTH_EVAL]` firing multiple times**: React renders trigger multiple evaluations. Only the LAST one before render commit matters.
- **`GET /admin/me` returning 200 with `access.allowed=false`**: If the user was demoted while logged in. App should show the "Admin access required" screen — not a bug.
- **`[SecureAuth] membership retry backoff failed`**: Background retry noise, not a user-visible failure unless membership stays `error` for >30 seconds.
- **`[COURSE GRAPH REJECTED] no_modules`**: Expected if a course in the DB lacks modules. Check that it's not rejecting ALL courses.
