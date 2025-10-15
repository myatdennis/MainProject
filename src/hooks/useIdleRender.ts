import { useEffect, useState } from 'react';

interface UseIdleRenderOptions {
  /**
   * Timeout in milliseconds passed to requestIdleCallback fallback timer.
   * Defaults to 1500ms to wait for critical content to paint before hydrating
   * supporting widgets.
   */
  timeout?: number;
  /**
   * Minimum delay before rendering when the idle callback fires immediately.
   */
  minDelay?: number;
}

/**
 * Returns a boolean that flips to true once the browser has completed the
 * initial work and an idle period has been reached. This lets us defer
 * hydration of non-critical widgets, reducing main-thread contention during
 * the LCP window.
 */
export function useIdleRender({ timeout = 1500, minDelay = 0 }: UseIdleRenderOptions = {}) {
  const [isReady, setIsReady] = useState(() => typeof window === 'undefined');

  useEffect(() => {
    if (typeof window === 'undefined' || isReady) {
      return;
    }

    let didCancel = false;
    let idleId: number | null = null;
    let timerId: number | null = null;
    let delayTimer: number | null = null;

    const markReady = () => {
      if (didCancel) return;
      if (minDelay > 0) {
        delayTimer = window.setTimeout(() => {
          if (!didCancel) {
            setIsReady(true);
          }
        }, minDelay);
      } else {
        setIsReady(true);
      }
    };

    const schedule = () => {
      if ('requestIdleCallback' in window) {
        idleId = (window as any).requestIdleCallback(markReady, { timeout });
      } else {
        timerId = window.setTimeout(markReady, timeout);
      }
    };

    schedule();

    const handleFirstInteraction = () => {
      if (!isReady) {
        markReady();
      }
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      didCancel = true;
      if (idleId !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      if (delayTimer !== null) {
        window.clearTimeout(delayTimer);
      }
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [isReady, timeout, minDelay]);

  return isReady;
}

export default useIdleRender;
