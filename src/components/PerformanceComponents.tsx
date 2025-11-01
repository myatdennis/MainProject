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

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  fallbackSrc,
  className = '',
  placeholder,
  threshold = 0.1
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

  const [darkMode, setDarkMode] = useState(false);
  return (
    <div ref={imgRef} className={`relative overflow-hidden rounded-2xl ${darkMode ? 'bg-gradient-to-br from-indigo-900 via-charcoal to-sunrise/10' : 'bg-gradient-to-br from-indigo-50 via-ivory to-sunrise/10'} ${className}`} aria-label={alt} role="img">
      {!isLoaded && placeholder && (
        <div className={`absolute inset-0 flex items-center justify-center animate-pulse rounded-2xl ${darkMode ? 'bg-mutedgrey/40' : 'bg-mutedgrey'}`}>
          {placeholder}
        </div>
      )}
      {isInView && (
        <motion.img
          src={imageSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} rounded-2xl shadow-card ${className} ${darkMode ? 'bg-charcoal' : ''}`}
          loading="lazy"
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
        />
      )}
      {/* Dark mode toggle for LazyImage */}
      <div className="absolute bottom-2 right-2 z-10">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-2 py-1 rounded bg-charcoal text-ivorywhite text-xs font-heading hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? 'Light' : 'Dark'}
        </button>
      </div>
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
  const [darkMode, setDarkMode] = useState(false);
  return (
    <div className={`animate-pulse rounded-2xl shadow-card ${width} ${height} ${className} ${darkMode ? 'bg-gradient-to-r from-indigo-900/20 via-charcoal to-ivory' : 'bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory'}`} aria-label="Loading image" role="img">
      <div className="flex items-center justify-center h-full">
        <svg
          className="w-10 h-10 text-mutedgrey"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <circle cx="10" cy="10" r="8" fill="url(#huddle-gradient)" />
          <defs>
            <linearGradient id="huddle-gradient" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop stopColor={darkMode ? '#2B84C6' : '#F28C1A'} />
              <stop offset="1" stopColor={darkMode ? '#F28C1A' : '#2B84C6'} />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {/* Dark mode toggle for ImageSkeleton */}
      <div className="absolute bottom-2 right-2 z-10">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-2 py-1 rounded bg-charcoal text-ivorywhite text-xs font-heading hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? 'Light' : 'Dark'}
        </button>
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