/**
 * useRouteChangeReset
 *
 * Provides a stable `routeKey` integer that increments every time the pathname
 * changes. Pages use this as a useEffect/useMemo dependency so their local state
 * resets on navigation without forcing a full component remount.
 *
 * Why not key={location.pathname}?
 * Keying on pathname destroys the component tree (including Suspense boundaries),
 * causing lazy chunks to re-suspend and the UI to flash a spinner. This hook gives
 * you controlled, opt-in resets without unmounting.
 *
 * Usage:
 *   const { routeKey } = useRouteChangeReset();
 *   useEffect(() => { setLocalState(initialValue); }, [routeKey]);
 *   const derived = useMemo(() => computeFromStore(), [routeKey, storeVersion]);
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export interface RouteChangeResetResult {
  /** Increments on every pathname change. Use as a useEffect/useMemo dep. */
  routeKey: number;
  /** The pathname that produced the current routeKey. */
  currentPath: string;
  /** The previous pathname, null on first render. */
  previousPath: string | null;
}

export const useRouteChangeReset = (): RouteChangeResetResult => {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);
  const [routeKey, setRouteKey] = useState(0);
  const [currentPath, setCurrentPath] = useState(location.pathname);
  const [previousPath, setPreviousPath] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevPathRef.current;
    if (prev !== null && prev !== location.pathname) {
      if (import.meta.env.DEV) {
        console.info('[useRouteChangeReset] route_change_detected', {
          from: prev,
          to: location.pathname,
        });
      }
      setPreviousPath(prev);
      setCurrentPath(location.pathname);
      setRouteKey((k) => k + 1);
    } else if (prev === null) {
      setCurrentPath(location.pathname);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  return { routeKey, currentPath, previousPath };
};

export default useRouteChangeReset;
