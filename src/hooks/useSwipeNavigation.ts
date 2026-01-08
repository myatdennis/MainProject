import { useMemo, useRef } from 'react';

interface SwipeNavigationOptions {
  disabled?: boolean;
  threshold?: number;
  verticalTolerance?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeNavigationHandlers {
  onTouchStart?: (event: React.TouchEvent) => void;
  onTouchMove?: (event: React.TouchEvent) => void;
  onTouchEnd?: () => void;
}

/**
 * Lightweight hook to add horizontal swipe gestures without pulling in heavy dependencies.
 * Designed for touch surfaces in the mobile course builder to flip between modules.
 */
const useSwipeNavigation = ({
  disabled,
  threshold = 48,
  verticalTolerance = 32,
  onSwipeLeft,
  onSwipeRight,
}: SwipeNavigationOptions): SwipeNavigationHandlers => {
  const startXRef = useRef(0);
  const endXRef = useRef(0);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);

  return useMemo(() => {
    if (disabled) {
      return {};
    }

    return {
      onTouchStart: (event: React.TouchEvent) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        startXRef.current = touch.clientX;
        endXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        trackingRef.current = true;
      },
      onTouchMove: (event: React.TouchEvent) => {
        if (!trackingRef.current || event.touches.length !== 1) return;
        const touch = event.touches[0];
        endXRef.current = touch.clientX;
        const deltaY = Math.abs(touch.clientY - startYRef.current);
        if (deltaY > verticalTolerance) {
          trackingRef.current = false;
        }
      },
      onTouchEnd: () => {
        if (!trackingRef.current) return;
        trackingRef.current = false;
        const deltaX = startXRef.current - endXRef.current;
        if (Math.abs(deltaX) < threshold) {
          return;
        }
        if (deltaX > 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }
    } satisfies SwipeNavigationHandlers;
  }, [disabled, threshold, verticalTolerance, onSwipeLeft, onSwipeRight]);
};

export default useSwipeNavigation;
