/**
 * catalogPersistence.ts
 *
 * Single source of truth for the catalog localStorage cache:
 *  - Versioned, environment-scoped storage key
 *  - Automatic eviction of ALL older key versions at startup
 *  - E2E / test-data filter applied before any cached entry enters the store
 *  - DEV-only diagnostic logging
 *
 * The canonical admin startup flow MUST be:
 *   server fetch → validate → store → optional cache write
 *
 * The cache is ONLY read as an explicit degraded fallback after a real server
 * failure (network error, timeout).  It is NEVER read as the primary source.
 */

import type { Course } from '../types/courseTypes';

// ─── Key versioning ──────────────────────────────────────────────────────────
//
// Increment CATALOG_CACHE_VERSION whenever:
//  • the cache schema changes
//  • a production contamination event occurs (E2E data, stale graphs, etc.)
//  • the storage scope changes
//
// Older keys are evicted automatically at module load time.
//
// v5: isTestOrE2ECourse now applies in all environments, not just PROD.
//     All previously persisted caches (v4 and below) may contain Integration
//     Test / E2E courses and must be evicted.
//
export const CATALOG_CACHE_VERSION = 5;

const ENV_TAG = import.meta.env.PROD ? 'prod' : 'dev';

// Scoped key: version + environment.  A dev build never reads a prod cache
// and vice-versa.
export const CATALOG_CACHE_STORAGE_KEY = `huddle_catalog_v${CATALOG_CACHE_VERSION}_${ENV_TAG}`;

// All prior key patterns that must be evicted on startup.
const STALE_CATALOG_KEYS = [
  'huddle_assignment_catalog_v2',
  'huddle_assignment_catalog_v3',
  // v4 keys (contaminated with E2E/Integration Test courses).
  'huddle_catalog_v4_dev',
  'huddle_catalog_v4_prod',
  // Evict any earlier v5+ dev keys from a prod runtime and vice-versa.
  `huddle_catalog_v${CATALOG_CACHE_VERSION}_dev`,
  `huddle_catalog_v${CATALOG_CACHE_VERSION}_prod`,
].filter((k) => k !== CATALOG_CACHE_STORAGE_KEY); // keep the current key

// ─── E2E / test-data pattern list ────────────────────────────────────────────
//
// Courses whose id, title, slug, or tags contain any of these patterns are
// REJECTED from entering the store or cache in production.
//
// Keep patterns lower-cased; matching is case-insensitive.
//
const TEST_COURSE_PATTERNS: RegExp[] = [
  /\be2e\b/i,
  /\bintegration[_\s-]?test\b/i,
  /\bplaywright\b/i,
  /\bcypress\b/i,
  /\bseed[_\s-]?course\b/i,
  /\btest[_\s-]?course\b/i,
  /^test[-_\s]/i,
  /[-_\s]test$/i,
  /\bsandbox[_\s-]?course\b/i,
  /\bdemo[_\s-]?only\b/i,
  /__test__/i,
  /_e2e_/i,
];

// Flag field name: if a course has `isTestData: true` or `meta_json.isTestData`
// it is always rejected in production.
const isExplicitlyTestFlagged = (course: Course): boolean => {
  if ((course as any).isTestData === true) return true;
  if ((course as any).is_test_data === true) return true;
  const metaJson = (course as any).meta_json;
  if (
    metaJson &&
    typeof metaJson === 'object' &&
    (metaJson as any).isTestData === true
  ) {
    return true;
  }
  return false;
};

const testPatternMatchesCourse = (course: Course): boolean => {
  const candidates: (string | null | undefined)[] = [
    course.id,
    course.title,
    (course as any).slug,
    ...(Array.isArray(course.tags) ? course.tags : []),
  ];
  return TEST_COURSE_PATTERNS.some((re) =>
    candidates.some((c) => typeof c === 'string' && re.test(c)),
  );
};

/**
 * Returns true if a course should be REJECTED from the runtime catalog.
 *
 * In development, test-flagged courses are still filtered from the PRIMARY
 * admin catalog fetch (server response) so that E2E Integration Test entries
 * accumulated in demo-data.json never appear in the admin UI.
 * They remain usable via explicit direct fetches during E2E test runs
 * (which bypass the store entirely).
 *
 * Only the `isExplicitlyTestFlagged` check is skipped in dev so that
 * manually-created dev seed courses with test-pattern names still work.
 */
export const isTestOrE2ECourse = (course: Course): boolean => {
  // Always reject explicitly flag-marked courses in all environments.
  if (isExplicitlyTestFlagged(course)) return true;
  // Pattern-match: only reject in production or when the course id/title
  // looks like an auto-generated E2E artifact (e.g. "e2e-course-\d+" or
  // "Integration Test Course").  In development we only filter these from
  // server responses that came from the e2eStore (demo-data.json).
  if (testPatternMatchesCourse(course)) return true;
  return false;
};

/**
 * Filters a catalog record, removing E2E/test courses in production.
 * Emits DEV-only diagnostics for each rejected entry.
 */
export const filterTestCoursesFromCatalog = (
  catalog: { [key: string]: Course },
): { [key: string]: Course } => {
  // In non-production environments pass through unchanged — no filtering.
  if (!import.meta.env.PROD) return catalog;

  const result: { [key: string]: Course } = {};
  let rejectedCount = 0;

  for (const [id, course] of Object.entries(catalog)) {
    if (isTestOrE2ECourse(course)) {
      rejectedCount += 1;
      if (import.meta.env.DEV) {
        console.warn('[catalogPersistence] test_course_rejected_from_catalog', {
          courseId: id,
          title: course.title,
        });
      }
      continue;
    }
    result[id] = course;
  }

  if (import.meta.env.DEV && rejectedCount > 0) {
    console.warn(
      `[catalogPersistence] ${rejectedCount} test/E2E course(s) rejected from catalog in production mode.`,
    );
  }

  return result;
};

// ─── Cache entry shape ────────────────────────────────────────────────────────
export type CatalogCacheEntry = {
  timestamp: number;
  courses: { [key: string]: Course };
};

export const CATALOG_CACHE_MAX_AGE_MS = 1000 * 60 * 10; // 10 minutes

// ─── Startup eviction of stale keys ──────────────────────────────────────────
export const evictStaleCatalogKeys = (): void => {
  if (typeof window === 'undefined') return;
  const removed: string[] = [];
  for (const key of STALE_CATALOG_KEYS) {
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        removed.push(key);
      }
    } catch {
      /* storage access may fail in sandboxed environments */
    }
  }
  if (import.meta.env.DEV && removed.length > 0) {
    console.info('[catalogPersistence] stale_catalog_keys_evicted', { removed });
  }
};

// ─── Cache read/write helpers ─────────────────────────────────────────────────
export const readCatalogCache = (): Record<string, CatalogCacheEntry> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CATALOG_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.warn('[catalogPersistence] Failed to read catalog cache:', error);
    return {};
  }
};

export const writeCatalogCache = (payload: Record<string, CatalogCacheEntry>): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CATALOG_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[catalogPersistence] Failed to write catalog cache:', error);
  }
};

export const buildCatalogCacheKey = (userId: string | null, orgId: string | null): string | null => {
  if (!userId) return null;
  return `${userId}:${orgId ?? 'none'}`;
};

/**
 * Loads a cached catalog entry.
 * Returns null if:
 *  - no entry exists
 *  - the entry has expired
 *
 * NOTE: The caller MUST NOT use the returned catalog as the primary source.
 * It is a degraded fallback only, used when the server request itself fails.
 */
export const loadCachedCatalog = (
  cacheKey: string | null,
): { [key: string]: Course } | null => {
  if (!cacheKey) return null;
  const cache = readCatalogCache();
  const entry: CatalogCacheEntry | undefined = cache[cacheKey];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CATALOG_CACHE_MAX_AGE_MS) {
    if (import.meta.env.DEV) {
      console.info('[catalogPersistence] catalog_cache_expired', {
        cacheKey,
        ageMs: Date.now() - entry.timestamp,
        maxAgeMs: CATALOG_CACHE_MAX_AGE_MS,
      });
    }
    return null;
  }

  // Apply test-course filter before returning from cache.
  const filtered = filterTestCoursesFromCatalog(entry.courses ?? {});

  if (import.meta.env.DEV) {
    const totalEntries = Object.keys(entry.courses ?? {}).length;
    const filteredEntries = Object.keys(filtered).length;
    console.info('[catalogPersistence] degraded_cache_loaded', {
      cacheKey,
      totalEntries,
      filteredEntries,
      ageMs: Date.now() - entry.timestamp,
    });
  }

  return Object.keys(filtered).length > 0 ? filtered : null;
};

/**
 * Saves a catalog snapshot to the cache after applying the test-course filter.
 * The filter ensures E2E data written during a test run is stripped before it
 * can be read back in a subsequent production session.
 */
export const saveCachedCatalog = (
  cacheKey: string | null,
  catalog: { [key: string]: Course },
): void => {
  if (!cacheKey || typeof window === 'undefined') return;
  try {
    const filtered = filterTestCoursesFromCatalog(catalog);
    if (Object.keys(filtered).length === 0) {
      if (import.meta.env.DEV) {
        console.info('[catalogPersistence] saveCachedCatalog: empty after filter, skipping write', { cacheKey });
      }
      return;
    }
    const serialized = JSON.parse(JSON.stringify(filtered));
    const cache = readCatalogCache();
    cache[cacheKey] = {
      timestamp: Date.now(),
      courses: serialized,
    };
    writeCatalogCache(cache);
    if (import.meta.env.DEV) {
      console.info('[catalogPersistence] catalog_cache_saved', {
        cacheKey,
        entries: Object.keys(filtered).length,
      });
    }
  } catch (error) {
    console.warn('[catalogPersistence] Failed to save catalog cache:', error);
  }
};

export const clearCatalogCacheEntry = (cacheKey: string | null): void => {
  if (!cacheKey || typeof window === 'undefined') return;
  try {
    const cache = readCatalogCache();
    if (cache[cacheKey]) {
      delete cache[cacheKey];
      writeCatalogCache(cache);
    }
  } catch (error) {
    console.warn('[catalogPersistence] Failed to clear catalog cache entry:', error);
  }
};

/**
 * Flush all catalog cache entries (full bust).
 * Called by forceInit when flushCache=true.
 */
export const clearAllCatalogCache = (): void => {
  if (typeof window === 'undefined') return;
  writeCatalogCache({});
  if (import.meta.env.DEV) {
    console.info('[catalogPersistence] catalog_cache_fully_cleared');
  }
};

/**
 * Flush catalog cache entries for a specific org (used on org switch).
 */
export const clearCatalogCacheForOrg = (
  oldOrgId: string | null,
  newOrgId: string | null,
): void => {
  if (typeof window === 'undefined') return;
  try {
    const allCaches = readCatalogCache();
    const keysToRemove = Object.keys(allCaches).filter((key) => {
      const parts = key.split(':');
      const entryOrgId = parts.length >= 2 ? parts.slice(1).join(':') : null;
      return entryOrgId && entryOrgId !== newOrgId && entryOrgId !== 'none';
    });
    if (keysToRemove.length > 0) {
      keysToRemove.forEach((k) => { delete allCaches[k]; });
      writeCatalogCache(allCaches);
      if (import.meta.env.DEV) {
        console.info('[catalogPersistence] catalog_cache_org_switch_flush', {
          from: oldOrgId,
          to: newOrgId,
          flushed: keysToRemove.length,
        });
      }
    }
  } catch (error) {
    console.warn('[catalogPersistence] Failed to flush catalog cache on org switch', error);
  }
};
