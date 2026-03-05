import type { QueryClient } from '@tanstack/react-query';

type OrgLike = string | null | undefined;
type InvalidateOptions = {
  orgId?: OrgLike;
  courseId?: string | null;
  slug?: string | null;
  requestId?: string | null;
};

export const courseQueryKeys = {
  adminList: (orgId: OrgLike) => ['courses', 'admin', orgId ?? 'global'] as const,
  learnerCatalog: (scope: 'assigned' | 'all', orgId: OrgLike) =>
    ['courses', 'learner', scope, orgId ?? 'global'] as const,
  courseDetail: (identifier: string) => ['courses', 'detail', identifier] as const,
};

const dispatchInvalidationEvent = (detail: { orgId: OrgLike; courseId?: string | null; slug?: string | null; requestId: string }) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent('huddle:course_catalog_invalidated', { detail }));
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[courseQueryKeys] Failed to dispatch invalidation event', error);
    }
  }
};

const generateRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const invalidateCourseQueries = (client: QueryClient, options: InvalidateOptions = {}) => {
  const targets = [
    courseQueryKeys.adminList(options.orgId ?? null),
    courseQueryKeys.learnerCatalog('assigned', options.orgId ?? null),
    courseQueryKeys.learnerCatalog('all', options.orgId ?? null),
  ];

  targets.forEach((queryKey) => {
    client.invalidateQueries({ queryKey }).catch((error) => {
      if (import.meta.env?.DEV) {
        console.warn('[courseQueryKeys] Failed to invalidate query', { queryKey, error });
      }
    });
  });

  const requestId = options.requestId ?? generateRequestId();
  dispatchInvalidationEvent({
    orgId: options.orgId ?? null,
    courseId: options.courseId ?? null,
    slug: options.slug ?? null,
    requestId,
  });
};
