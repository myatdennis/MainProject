// Temporary compatibility shim while modules migrate to adminCourses/clientCourses.
// Prefer importing directly from './adminCourses' or './clientCourses'.

import type { NormalizedCourse } from '../utils/courseNormalization';
import {
  fetchCourse,
  fetchPublishedCourses,
} from './clientCourses';

export * from './adminCourses';
export type { FetchPublishedCoursesOptions, FetchCourseOptions } from './clientCourses';
export {
  fetchPublishedCourses,
  fetchCourse,
} from './clientCourses';

export const getPublishedCourses = fetchPublishedCourses;
export function listPublishedCourses(orgId: string): Promise<NormalizedCourse[]> {
  if (!orgId) {
    throw new Error('orgId is required to list published courses');
  }
  return fetchPublishedCourses({ orgId, assignedOnly: true });
}

export const getCourse = fetchCourse;
