import React, { useState, useEffect, useRef, useCallback } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  placeholder?: React.ReactNode;
  threshold?: number;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  fallbackSrc,
  className = '',
  placeholder,
  threshold = 0.1,
  ...props
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
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {!isLoaded && placeholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          {placeholder}
        </div>
      )}
      
      {isInView && (
        <img
          {...props}
          src={imageSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          loading="lazy"
        />
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
    <div className={`animate-pulse bg-gray-200 ${width} ${height} ${className}`}>
      <div className="flex items-center justify-center h-full">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
};

// Performance monitoring hook
export const usePerformanceMonitoring = () => {
  useEffect(() => {
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