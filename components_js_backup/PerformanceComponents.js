import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
export const LazyImage = ({ src, alt, fallbackSrc, className = '', placeholder, threshold = 0.1 }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef(null);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                observer.disconnect();
            }
        }, { threshold });
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
    return (_jsxs("div", { ref: imgRef, className: `relative overflow-hidden rounded-2xl ${darkMode ? 'bg-gradient-to-br from-indigo-900 via-charcoal to-sunrise/10' : 'bg-gradient-to-br from-indigo-50 via-ivory to-sunrise/10'} ${className}`, "aria-label": alt, role: "img", children: [!isLoaded && placeholder && (_jsx("div", { className: `absolute inset-0 flex items-center justify-center animate-pulse rounded-2xl ${darkMode ? 'bg-mutedgrey/40' : 'bg-mutedgrey'}`, children: placeholder })), isInView && (_jsx(motion.img, { src: imageSrc, alt: alt, onLoad: handleLoad, onError: handleError, className: `transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} rounded-2xl shadow-card ${className} ${darkMode ? 'bg-charcoal' : ''}`, loading: "lazy", initial: { opacity: 0 }, animate: { opacity: isLoaded ? 1 : 0 } })), _jsx("div", { className: "absolute bottom-2 right-2 z-10", children: _jsx("button", { onClick: () => setDarkMode(!darkMode), className: "px-2 py-1 rounded bg-charcoal text-ivorywhite text-xs font-heading hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500", "aria-label": darkMode ? 'Switch to light mode' : 'Switch to dark mode', children: darkMode ? 'Light' : 'Dark' }) })] }));
};
export const ImageSkeleton = ({ className = '', width = 'w-full', height = 'h-48' }) => {
    const [darkMode, setDarkMode] = useState(false);
    return (_jsxs("div", { className: `animate-pulse rounded-2xl shadow-card ${width} ${height} ${className} ${darkMode ? 'bg-gradient-to-r from-indigo-900/20 via-charcoal to-ivory' : 'bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory'}`, "aria-label": "Loading image", role: "img", children: [_jsx("div", { className: "flex items-center justify-center h-full", children: _jsxs("svg", { className: "w-10 h-10 text-mutedgrey", fill: "currentColor", viewBox: "0 0 20 20", children: [_jsx("circle", { cx: "10", cy: "10", r: "8", fill: "url(#huddle-gradient)" }), _jsx("defs", { children: _jsxs("linearGradient", { id: "huddle-gradient", x1: "0", y1: "0", x2: "20", y2: "20", gradientUnits: "userSpaceOnUse", children: [_jsx("stop", { stopColor: darkMode ? '#3A7DFF' : '#3A7DFF' }), _jsx("stop", { offset: "1", stopColor: darkMode ? '#228B22' : '#228B22' })] }) })] }) }), _jsx("div", { className: "absolute bottom-2 right-2 z-10", children: _jsx("button", { onClick: () => setDarkMode(!darkMode), className: "px-2 py-1 rounded bg-charcoal text-ivorywhite text-xs font-heading hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500", "aria-label": darkMode ? 'Switch to light mode' : 'Switch to dark mode', children: darkMode ? 'Light' : 'Dark' }) })] }));
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
export function useDebounce(value, delay) {
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
export const VirtualScroll = ({ items, itemHeight, containerHeight, renderItem, className = '' }) => {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef(null);
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(visibleStart + Math.ceil(containerHeight / itemHeight) + 1, items.length);
    const handleScroll = useCallback((e) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);
    const visibleItems = items.slice(visibleStart, visibleEnd);
    const totalHeight = items.length * itemHeight;
    const offsetY = visibleStart * itemHeight;
    return (_jsx("div", { ref: containerRef, className: `overflow-auto ${className}`, style: { height: containerHeight }, onScroll: handleScroll, children: _jsx("div", { style: { height: totalHeight, position: 'relative' }, children: _jsx("div", { style: { transform: `translateY(${offsetY}px)` }, children: visibleItems.map((item, index) => renderItem(item, visibleStart + index)) }) }) }));
};
export default LazyImage;
