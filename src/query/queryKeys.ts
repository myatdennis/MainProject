// Central query key factory for React Query usage
// Provides stable key construction to avoid accidental collisions.

export const queryKeys = {
  auth: {
    user: () => ['auth', 'user'] as const,
    organization: (orgId: string | undefined) => ['auth', 'organization', orgId] as const,
  },
  profiles: {
    userProfiles: () => ['profiles', 'users'] as const,
    orgProfiles: () => ['profiles', 'orgs'] as const,
  },
  courses: {
    list: (mode: 'client' | 'lms' | 'admin') => ['courses', 'list', mode] as const,
    course: (id: string) => ['courses', 'course', id] as const,
    progress: (userId: string, courseId: string) => ['courses', 'progress', userId, courseId] as const,
  }
};

export type QueryKey = ReturnType<(typeof queryKeys)[keyof typeof queryKeys][keyof (typeof queryKeys)[keyof typeof queryKeys]]>;