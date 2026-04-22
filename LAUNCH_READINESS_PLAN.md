# LAUNCH READINESS PLAN

## P0 — Must fix before launch
1. Remove all legacy/compatibility code and placeholder files from critical paths
   - Risk: Bugs, contract drift, silent failures, confusion
   - Acceptance: No legacy/compat code in any critical path; all placeholder files removed
2. Migrate backend membership/role cache to Redis or distributed cache
   - Risk: Role/membership drift, security/data risk in multi-instance
   - Acceptance: All membership/role cache is distributed and consistent
3. Harden org/session propagation for SSR and multi-instance
   - Risk: Stale/ambiguous org/session, data leakage, trust loss
   - Acceptance: Org/session context is always correct, never stale/ambiguous
4. Remove all fallback logic that can mask real errors in org/session/assignment flows
   - Risk: Bugs hidden, degraded user experience, trust loss
   - Acceptance: All errors surfaced, no silent fallback in critical flows
5. Ensure all demo/debug code is disabled in production builds
   - Risk: Security/data leak, privilege escalation
   - Acceptance: All prod builds verified with demo/debug code off
6. Unify data contracts and remove compatibility layers
   - Risk: Contract drift, bugs, hard to maintain
   - Acceptance: Single source of truth for all contracts, no legacy layers
7. Ensure all error/empty/loading states are user-visible and never silent
   - Risk: Users lose trust, can't recover from errors
   - Acceptance: All error/empty/loading states are explicit and actionable
8. Expand test coverage for all critical flows in prod-like env
   - Risk: Bugs/regressions in prod
   - Acceptance: All critical flows tested, no legacy path untested
9. Harden assignment/org enforcement and remove legacy paths
   - Risk: Data leakage, assignment bugs
   - Acceptance: All enforcement is robust, no legacy paths
10. Manual verification of all launch gating and environment flags
    - Risk: Security/data leak, bugs in prod
    - Acceptance: All flags verified, CI check added

## P1 — Should fix before launch if possible
- Refactor oversized/fragile modules for clarity
- Add distributed cache for all backend state
- Add automated launch gating checks to CI
- Polish admin/learner UX for edge cases
- Add advanced error reporting/diagnostics

## P2 — Safe to defer until shortly after launch
- Performance tuning for rare flows
- Advanced analytics/tracing
- UI polish for non-critical flows
- Further refactoring for maintainability

## P3 — Post-launch improvement
- Feature expansion
- Non-critical UI/UX enhancements
- Deep analytics and reporting

### Implementation Order & Rationale
1. Remove legacy/compat code and placeholder files (must be done first to avoid drift)
2. Migrate backend cache to Redis/distributed (enables safe multi-instance)
3. Harden org/session propagation (depends on unified code)
4. Remove fallback logic (depends on unified code)
5. Unify contracts (depends on legacy removal)
6. Harden assignment/org enforcement (depends on unified contracts)
7. Expand test coverage (after code is unified)
8. Manual/CI verification of flags (final step before launch)

### What to Test/Verify After Each Phase
- All critical flows (admin, learner, assignment, org, session, error, loading)
- All error/empty/loading states
- All environment flags and launch gating
- Multi-instance/SSR behavior
- No legacy/compat code remains

---

# IMPLEMENTATION EXECUTION PLAN

## Phase 1: Remove Legacy/Compatibility Code
- Goal: Eliminate all legacy/compatibility code and placeholder files
- Files: `courseStoreOrgBridge`, `SecureAuthContext`, assignment services, `auth.ts`, shared/contracts
- Remove: All fallback/legacy logic, placeholder files
- Refactor: All critical paths to use unified logic
- Tests: Update all tests to cover only unified paths
- Manual: Verify no legacy code remains
- Outcome: No legacy/compat code in any critical path

## Phase 2: Migrate Backend Cache to Redis/Distributed
- Goal: Ensure all membership/role cache is distributed
- Files: `auth.js`, `runtimeFlags.js`, backend cache modules
- Remove: In-memory cache for membership/role
- Refactor: Use Redis or distributed cache
- Tests: Add tests for multi-instance consistency
- Manual: Verify cache is consistent across instances
- Outcome: No in-memory cache for critical state

## Phase 3: Harden Org/Session Propagation
- Goal: Ensure org/session context is always correct
- Files: `SecureAuthContext`, `courseStoreOrgBridge`, SSR logic
- Remove: SSR fallback logic
- Refactor: Unify org/session propagation
- Tests: Add tests for SSR/multi-instance
- Manual: Verify no stale/ambiguous context
- Outcome: Org/session context is robust

## Phase 4: Remove Fallback Logic
- Goal: All errors surfaced, no silent fallback
- Files: All context/store/service layers
- Remove: All fallback logic in org/session/assignment
- Refactor: Always surface errors
- Tests: Add tests for error surfacing
- Manual: Verify all errors are user-visible
- Outcome: No silent fallback in critical flows

## Phase 5: Unify Data Contracts
- Goal: Single source of truth for all contracts
- Files: `shared/contracts`, assignment services, frontend/backend API
- Remove: Compatibility layers
- Refactor: Use unified contracts everywhere
- Tests: Add contract shape tests
- Manual: Verify all contracts are unified
- Outcome: No contract drift

## Phase 6: Harden Assignment/Org Enforcement
- Goal: Robust enforcement, no legacy paths
- Files: Assignment services, org enforcement logic
- Remove: Legacy/fallback enforcement
- Refactor: Use unified enforcement everywhere
- Tests: Add enforcement tests
- Manual: Verify enforcement is robust
- Outcome: No legacy/fallback enforcement

## Phase 7: Expand Test Coverage
- Goal: All critical flows tested
- Files: All test suites
- Remove: Legacy/untested paths
- Refactor: Add tests for all critical flows
- Tests: Run all tests in prod-like env
- Manual: Verify all critical flows are tested
- Outcome: No untested critical path

## Phase 8: Manual/CI Verification of Flags
- Goal: All launch gating and env flags verified
- Files: `runtimeFlags.js`, CI config
- Remove: N/A
- Refactor: Add CI check for prod flags
- Tests: Add CI test for flag state
- Manual: Verify all flags before launch
- Outcome: All flags verified, no demo/debug in prod

---

# PRE-LAUNCH CHECKLIST

## Engineering
- [ ] All legacy/compatibility code removed
- [ ] All placeholder files removed
- [ ] Backend cache is Redis/distributed
- [ ] Org/session propagation is robust
- [ ] No fallback logic in critical flows
- [ ] Data contracts unified
- [ ] Assignment/org enforcement hardened
- [ ] All critical flows tested
- [ ] All prod flags verified

## QA
- [ ] All error/empty/loading states surfaced
- [ ] All admin/learner flows tested
- [ ] Multi-instance/SSR tested
- [ ] No legacy/compat code remains
- [ ] No silent fallback in any flow

## Product/UX
- [ ] All user-facing errors are actionable
- [ ] Org switching/session expiration is clear
- [ ] No misleading/ambiguous states
- [ ] Admin/learner dashboards are useful

## Security/Env
- [ ] Demo/debug code disabled in prod
- [ ] All environment flags verified
- [ ] No in-memory cache for critical state
- [ ] No placeholder files in prod

## Monitoring/Logging
- [ ] All critical errors/warnings logged
- [ ] Diagnostics available for all flows
- [ ] No silent failures in logs

## Rollback/Readiness
- [ ] Rollback plan in place
- [ ] All migrations reversible
- [ ] Launch gating can be toggled safely

---

# FINAL VERDICT

**Not launch-ready.**

System is close, but must fix all P0 issues and verify in prod-like environment before launch.
