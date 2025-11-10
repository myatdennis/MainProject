import { CourseService } from './courseService';
import { courseStore } from '../store/courseStore';
import { normalizeCourse, flattenLessons, slugify } from '../utils/courseNormalization';
const courseCache = new Map();
let courseStoreInitPromise = null;
const isSupabaseConfigured = () => Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const ensureCourseStoreReady = async () => {
    if (courseStore.getAllCourses().length > 0) {
        return;
    }
    if (!courseStoreInitPromise && typeof courseStore.init === 'function') {
        courseStoreInitPromise = courseStore.init();
    }
    if (courseStoreInitPromise) {
        await courseStoreInitPromise;
    }
};
const cacheResult = (keys, result) => {
    keys.forEach((key) => courseCache.set(key, result));
};
const buildCacheKeys = (course) => {
    const keys = new Set();
    keys.add(course.id);
    keys.add(course.slug);
    keys.add(slugify(course.id));
    keys.add(slugify(course.slug));
    if (course.title) {
        keys.add(slugify(course.title));
    }
    return Array.from(keys);
};
const findLocalCourse = async (identifier) => {
    await ensureCourseStoreReady();
    const normalizedIdentifier = identifier.trim();
    const allCourses = courseStore.getAllCourses();
    if (!allCourses || allCourses.length === 0) {
        return null;
    }
    const slugCandidate = slugify(normalizedIdentifier);
    for (const storedCourse of allCourses) {
        const normalizedCourse = normalizeCourse(storedCourse);
        if (normalizedCourse.id === normalizedIdentifier ||
            normalizedCourse.slug === normalizedIdentifier ||
            normalizedCourse.slug === slugCandidate ||
            slugify(normalizedCourse.id) === normalizedIdentifier ||
            slugify(normalizedCourse.title) === normalizedIdentifier ||
            slugify(normalizedCourse.title) === slugCandidate) {
            const result = {
                course: normalizedCourse,
                modules: normalizedCourse.modules,
                lessons: flattenLessons(normalizedCourse),
                source: 'local'
            };
            cacheResult(buildCacheKeys(normalizedCourse), result);
            return result;
        }
    }
    return null;
};
export const loadCourse = async (identifier, options = {}) => {
    const normalizedIdentifier = identifier.trim();
    const cached = courseCache.get(normalizedIdentifier);
    if (cached) {
        return cached;
    }
    const slugCandidate = slugify(normalizedIdentifier);
    const slugCached = courseCache.get(slugCandidate);
    if (slugCached) {
        return slugCached;
    }
    const { includeDrafts = false, preferRemote = true } = options;
    const supabaseAvailable = isSupabaseConfigured();
    if (supabaseAvailable && preferRemote) {
        try {
            const remoteCourse = await CourseService.loadCourseFromDatabase(normalizedIdentifier, {
                includeDrafts
            });
            if (remoteCourse) {
                const normalizedCourse = normalizeCourse(remoteCourse);
                const result = {
                    course: normalizedCourse,
                    modules: normalizedCourse.modules,
                    lessons: flattenLessons(normalizedCourse),
                    source: 'supabase'
                };
                cacheResult(buildCacheKeys(normalizedCourse), result);
                return result;
            }
        }
        catch (error) {
            console.warn('Falling back to local course store after Supabase load failed:', error);
        }
    }
    const localCourse = await findLocalCourse(normalizedIdentifier);
    if (localCourse) {
        return localCourse;
    }
    if (normalizedIdentifier !== slugCandidate) {
        const fallbackCourse = await findLocalCourse(slugCandidate);
        if (fallbackCourse) {
            return fallbackCourse;
        }
    }
    if (supabaseAvailable && !preferRemote) {
        const remoteCourse = await CourseService.loadCourseFromDatabase(normalizedIdentifier, {
            includeDrafts
        });
        if (remoteCourse) {
            const normalizedCourse = normalizeCourse(remoteCourse);
            const result = {
                course: normalizedCourse,
                modules: normalizedCourse.modules,
                lessons: flattenLessons(normalizedCourse),
                source: 'supabase'
            };
            cacheResult(buildCacheKeys(normalizedCourse), result);
            return result;
        }
    }
    return null;
};
export const clearCourseCache = () => {
    courseCache.clear();
};
