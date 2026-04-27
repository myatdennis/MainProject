import type { NormalizedCourse } from '../utils/courseNormalization';
import { slugify } from '../utils/courseNormalization';
import apiRequest from '../utils/apiClient';
import { getUserSession } from '../lib/secureStorage';
import { mapCourseRecord, type SupabaseCourseRecord } from '../services/courseService';
import { getGlobalActiveOrgIdForApi, buildScopedApiUrl } from '../lib/orgContext';
import { GLOBAL_ORG_ID } from '../constants/org';

export interface FetchPublishedCoursesOptions {
  assignedOnly?: boolean;
}

export interface FetchCourseOptions {
  includeDrafts?: boolean;
}

const hasClientSession = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    return Boolean(getUserSession());
  } catch {
    return false;
  }
};

const unwrapApiData = <T>(payload: T | { data?: T } | null | undefined): T | null => {
  if (payload == null) return null;
  if (typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return ((payload as { data?: T }).data ?? null) as T | null;
  }
  return payload as T;
};

export async function fetchPublishedCourses(
  options: FetchPublishedCoursesOptions = {}
): Promise<NormalizedCourse[]> {
  const { assignedOnly = false } = options;
  const params = new URLSearchParams();
  if (assignedOnly) {
    params.set('assigned', 'true');
  }

  if (!hasClientSession()) {
    if (import.meta.env.DEV) {
      console.info('[clientCourses.fetchPublishedCourses] Skipping API fetch because no session is present.');
    }
    return [];
  }

  const relativePath = params.toString() ? `/client/courses?${params.toString()}` : '/client/courses';
  try {
    const activeOrgId = getGlobalActiveOrgIdForApi();
    const url = buildScopedApiUrl(relativePath, activeOrgId ?? undefined);
    const json = await apiRequest<SupabaseCourseRecord[] | { data?: SupabaseCourseRecord[] }>(url, { noTransform: true });
    let courses = (unwrapApiData(json) || []).map(mapCourseRecord);

    if (activeOrgId && activeOrgId !== GLOBAL_ORG_ID) {
      courses = courses.filter((course) => {
        const orgIds = (course as any).organizationIds || (course as any).organization_ids || [];
        if (Array.isArray(orgIds) && orgIds.length > 0) {
          return orgIds.includes(activeOrgId);
        }
        return true;
      });
    }

    return courses;
  } catch (error) {
    console.error('[clientCourses.fetchPublishedCourses] Failed to fetch catalog:', error);
    return [];
  }
}

export async function fetchCourse(
  identifier: string,
  options: FetchCourseOptions = {}
): Promise<NormalizedCourse | null> {
  if (!hasClientSession()) {
    if (import.meta.env.DEV) {
      console.info('[clientCourses.fetchCourse] Skipping API fetch because no session is present.');
    }
    return null;
  }
  const { includeDrafts = false } = options;
  const normalizedIdentifier = identifier.trim();
  const queryParam = includeDrafts ? '?includeDrafts=true' : '';

  try {
    const url = buildScopedApiUrl(`/client/courses/${normalizedIdentifier}${queryParam}`, getGlobalActiveOrgIdForApi() ?? undefined);
    const json = await apiRequest<SupabaseCourseRecord | null | { data?: SupabaseCourseRecord | null }>(url, { noTransform: true });

    const primaryRecord = unwrapApiData(json);
    if (primaryRecord) {
      return mapCourseRecord(primaryRecord);
    }

    const slugCandidate = slugify(normalizedIdentifier);
    if (slugCandidate && slugCandidate !== normalizedIdentifier) {
      const slugUrl = buildScopedApiUrl(`/client/courses/${slugCandidate}${queryParam}`, getGlobalActiveOrgIdForApi() ?? undefined);
      const slugJson = await apiRequest<SupabaseCourseRecord | null | { data?: SupabaseCourseRecord | null }>(slugUrl, { noTransform: true });
      const slugRecord = unwrapApiData(slugJson);
      if (slugRecord) {
        return mapCourseRecord(slugRecord);
      }
    }

    return null;
  } catch (error) {
    console.error('[clientCourses.fetchCourse] Failed to load course from API:', error);
    throw error;
  }
}
