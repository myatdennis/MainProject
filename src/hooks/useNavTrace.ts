/**
 * useNavTrace
 *
 * DEV-only hook that instruments the render-to-commit pipeline for a named
 * page component.  Import and call once at the top of each admin page.
 *
 * Produces the following console sequence for each navigation:
 *
 *   [NAV CLICK]         /admin/courses         (AdminLayout sidebar)
 *   [ROUTE MATCHED]     /admin/courses         (AdminProtectedLayout)
 *   [ADMIN LAYOUT RENDER] /admin/courses       (AdminLayout render fn)
 *   [OUTLET RENDER]     /admin/courses         (AdminLayout Outlet wrapper)
 *   [PAGE RENDER]       /admin/courses  AdminCourses   ← this hook
 *   [PAGE COMMIT]       /admin/courses  AdminCourses   ← this hook
 *
 * All logs are suppressed in production (import.meta.env.DEV guard).
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export const useNavTrace = (pageName: string): void => {
  const location = useLocation();
  const committedPathRef = useRef<string | null>(null);

  // [PAGE RENDER] fires synchronously during the render phase.
  // It is intentionally outside useEffect so it captures render, not commit.
  if (import.meta.env.DEV) {
    // Using a ref-based guard so the log only fires once per pathname (not on
    // every re-render caused by unrelated state updates in the same page).
    if (committedPathRef.current !== location.pathname) {
      console.debug('[PAGE RENDER]', location.pathname, pageName);
    }
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // [PAGE COMMIT] fires after React has committed the new DOM to the screen.
    // If [PAGE RENDER] appears but [PAGE COMMIT] does NOT, it means React
    // started rendering but threw or was interrupted before committing.
    if (committedPathRef.current === location.pathname) return;
    committedPathRef.current = location.pathname;
    console.debug('[PAGE COMMIT]', location.pathname, pageName);
  }, [location.pathname, pageName]);
};

export default useNavTrace;
