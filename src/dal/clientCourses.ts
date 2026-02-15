import type { NormalizedCourse } from '../utils/courseNormalization';
import { slugify } from '../utils/courseNormalization';
import apiRequest from '../utils/apiClient';
import { getUserSession } from '../lib/secureStorage';
import { mapCourseRecord, type SupabaseCourseRecord } from '../services/courseService';

export interface FetchPublishedCoursesOptions {
  orgId?: string;
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

export async function fetchPublishedCourses(
  options: FetchPublishedCoursesOptions = {}
): Promise<NormalizedCourse[]> {
  const { orgId, assignedOnly = false } = options;
  const params = new URLSearchParams();

  if (assignedOnly) {
    if (!orgId) {
      console.warn('[clientCourses.fetchPublishedCourses] orgId is required when assignedOnly=true');
      return [];
    }
    params.set('assigned', 'true');
    params.set('orgId', orgId);
  }

  if (!hasClientSession()) {
    if (import.meta.env.DEV) {
      console.info('[clientCourses.fetchPublishedCourses] Skipping API fetch because no session is present.');
    }
    return [];
  }

  const path = params.toString() ? `/api/client/courses?${params.toString()}` : '/api/client/courses';
  try {
    const json = await apiRequest<{ data: SupabaseCourseRecord[] }>(path, { noTransform: true });
    return (json.data || []).map(mapCourseRecord);
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
    const json = await apiRequest<{ data: SupabaseCourseRecord | null }>(
      `/api/client/courses/${normalizedIdentifier}${queryParam}`,
      { noTransform: true }
    );

    if (json.data) {
      return mapCourseRecord(json.data);
    }

    const slugCandidate = slugify(normalizedIdentifier);
    if (slugCandidate && slugCandidate !== normalizedIdentifier) {
      const slugJson = await apiRequest<{ data: SupabaseCourseRecord | null }>(
        `/api/client/courses/${slugCandidate}${queryParam}`,
        { noTransform: true }
      );
      if (slugJson.data) {
        return mapCourseRecord(slugJson.data);
      }
    }

    return null;
  } catch (error) {
    console.error('[clientCourses.fetchCourse] Failed to load course from API:', error);
    throw error;
  }
}
