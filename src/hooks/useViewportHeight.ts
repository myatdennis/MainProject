import { useEffect } from 'react';

/**
 * Syncs CSS custom properties with the current viewport height so mobile browsers render
 * full-height panels correctly even when the URL bar collapses/expands. Also tracks the
 * safe-area inset so sticky toolbars avoid the home indicator on iOS.
 */
const useViewportHeight = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const updateViewportVars = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const vh = height * 0.01;
      document.documentElement.style.setProperty('--app-vh', `${vh}px`);

      const safeBottom = viewport ? Math.max(0, viewport.height + viewport.offsetTop - window.innerHeight) : 0;
      document.documentElement.style.setProperty('--safe-area-bottom', `${safeBottom}px`);
    };

    updateViewportVars();
    window.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('resize', updateViewportVars);

    return () => {
      window.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
    };
  }, []);
};

export default useViewportHeight;
