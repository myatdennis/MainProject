// Central query key factory for React Query usage
// Provides stable key construction to avoid accidental collisions.
export const queryKeys = {
    auth: {
        user: () => ['auth', 'user'],
        organization: (orgId) => ['auth', 'organization', orgId],
    },
    profiles: {
        userProfiles: () => ['profiles', 'users'],
        orgProfiles: () => ['profiles', 'orgs'],
    },
    courses: {
        list: (mode) => ['courses', 'list', mode],
        course: (id) => ['courses', 'course', id],
        progress: (userId, courseId) => ['courses', 'progress', userId, courseId],
    }
};
