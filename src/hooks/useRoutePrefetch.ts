import { useEffect } from 'react';

/**
 * Prefetches a route chunk and/or static asset using <link rel="prefetch">.
 * Usage: useRoutePrefetch(['/admin/analytics', '/admin/courses']);
 */
export function useRoutePrefetch(paths: string[]) {
  useEffect(() => {
    paths.forEach((path) => {
      // Prefetch route chunk (Vite/webpack will resolve chunk for route)
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = path;
      link.as = 'document';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
    return () => {
      // Optionally clean up
    };
  }, [paths]);
}
