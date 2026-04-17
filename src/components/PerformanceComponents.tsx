import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  placeholder?: React.ReactNode;
  threshold?: number;
}

export const LazyImage: React.FC<LazyImageProps & {
  webpSrc?: string;
  avifSrc?: string;
  srcSet?: string;
  sizes?: string;
}> = ({
  src,
  alt,
  fallbackSrc,
  className = '',
  placeholder,
  threshold = 0.1,
  webpSrc,
  avifSrc,
  srcSet,
  sizes
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  const imageSrc = hasError && fallbackSrc ? fallbackSrc : src;

  return (
    <div
      ref={imgRef}
      className={`relative min-h-[280px] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,rgba(58,125,255,0.08),rgba(222,123,18,0.08),rgba(255,255,255,0.96))] ${className}`}
      aria-label={alt}
      role="img"
    >
      {!isLoaded && placeholder && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-app-muted animate-pulse">
          {placeholder}
        </div>
      )}
      {isInView && (
        <picture>
          {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
          {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
          {srcSet && <source srcSet={srcSet} />}
          <motion.img
            src={imageSrc}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={`rounded-2xl shadow-card transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
            loading="lazy"
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0 }}
            sizes={sizes}
          />
        </picture>
      )}
    </div>
  );
};

interface ImageSkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const ImageSkeleton: React.FC<ImageSkeletonProps> = ({
  className = '',
  width = 'w-full',
  height = 'h-48'
}) => {
  return (
    <div
      className={`animate-pulse rounded-2xl shadow-card ${width} ${height} ${className} bg-[linear-gradient(90deg,rgba(222,123,18,0.16),rgba(58,125,255,0.10),rgba(255,255,255,0.96))]`}
      aria-label="Loading image"
      role="img"
    >
      <div className="flex items-center justify-center h-full">
        <svg
          className="w-10 h-10 text-mutedgrey"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="10" cy="10" r="8" fill="url(#huddle-gradient)" />
          <defs>
            <linearGradient id="huddle-gradient" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3A7DFF" />
              <stop offset="1" stopColor="#228B22" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

// Performance monitoring hook
export const usePerformanceMonitoring = () => {
  useEffect(() => {
    if (!import.meta.env.DEV || typeof PerformanceObserver === 'undefined') {
      return;
    }

    // Web Vitals monitoring
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
        }
      }
    });

    observer.observe({ entryTypes: ['measure', 'navigation'] });

    // Cleanup
    return () => observer.disconnect();
  }, []);
};

// Debounced search hook for better performance
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Virtual scrolling for large lists
interface VirtualScrollProps {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  className?: string;
}

export const VirtualScroll: React.FC<VirtualScrollProps> = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className = ''
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const visibleItems = items.slice(visibleStart, visibleEnd);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) =>
            renderItem(item, visibleStart + index)
          )}
        </div>
      </div>
    </div>
  );
};

export default LazyImage;
