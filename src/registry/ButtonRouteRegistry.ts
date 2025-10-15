/**
 * Comprehensive Button & Route Registry
 * Central registry for all interactive elements across the entire application
 * Auto-generated from site-wide audit and systematically maintained
 */

export interface ButtonRouteEntry {
  id: string;
  label: string;
  roles: string[];
  location: string;
  targetRoute?: string;
  action?: string;
  params?: Record<string, string>;
  fallbackRoute?: string;
  modal?: string;
  created: boolean;
  status: 'working' | 'broken' | 'missing' | 'stub';
  component?: string;
  description?: string;
}

export interface RouteStatus {
  route: string;
  exists: boolean;
  component?: string;
  requiredRoles: string[];
  status: 'working' | 'broken' | 'missing' | 'stub';
}

/**
 * MAIN NAVIGATION & GLOBAL ELEMENTS
 */
export const GLOBAL_NAVIGATION: ButtonRouteEntry[] = [
  // Header Navigation
  { id: 'header-home', label: 'Home', roles: ['*'], location: 'Header', targetRoute: '/', created: true, status: 'working' },
  { id: 'header-about', label: 'About', roles: ['*'], location: 'Header', targetRoute: '/about', created: true, status: 'working' },
  { id: 'header-services', label: 'Services', roles: ['*'], location: 'Header', targetRoute: '/services', created: true, status: 'working' },
  { id: 'header-resources', label: 'Resources', roles: ['*'], location: 'Header', targetRoute: '/resources', created: true, status: 'working' },
  { id: 'header-testimonials', label: 'Testimonials', roles: ['*'], location: 'Header', targetRoute: '/testimonials', created: true, status: 'working' },
  { id: 'header-contact', label: 'Contact', roles: ['*'], location: 'Header', targetRoute: '/contact', created: true, status: 'working' },
  { id: 'header-client-login', label: 'Client Login', roles: ['*'], location: 'Header', targetRoute: '/lms/login', created: true, status: 'working' },
  { id: 'header-admin-login', label: 'Admin', roles: ['*'], location: 'Header', targetRoute: '/admin/login', created: true, status: 'working' },
  { id: 'header-book-call', label: 'Book Discovery Call', roles: ['*'], location: 'Header', action: 'open-booking-widget', created: true, status: 'working' },

  // Home Page CTAs
  { id: 'home-hero-contact', label: 'Start Your Journey', roles: ['*'], location: 'HomePage Hero', targetRoute: '/contact', created: true, status: 'working' },
  { id: 'home-hero-resources', label: 'Explore Resources', roles: ['*'], location: 'HomePage Hero', targetRoute: '/resources', created: true, status: 'working' },
  { id: 'home-services-link', label: 'Learn More About Our Services', roles: ['*'], location: 'HomePage Features', targetRoute: '/services', created: true, status: 'working' },
  { id: 'home-cta-contact', label: 'Get Started Today', roles: ['*'], location: 'HomePage CTA', targetRoute: '/contact', created: true, status: 'working' },
  { id: 'home-cta-resources', label: 'Download Free Resources', roles: ['*'], location: 'HomePage CTA', targetRoute: '/resources', created: true, status: 'working' },
];

/**
 * ADMIN PORTAL NAVIGATION & ACTIONS
 */
export const ADMIN_ROUTES: ButtonRouteEntry[] = [
  // Admin Sidebar Navigation
  { id: 'admin-nav-dashboard', label: 'Dashboard', roles: ['admin'], location: 'Admin Sidebar', targetRoute: '/admin/dashboard', created: true, status: 'working' },
  { id: 'admin-nav-users', label: 'Users', roles: ['admin'], location: 'Admin Sidebar', targetRoute: '/admin/users', created: true, status: 'working' },
  { id: 'admin-nav-organizations', label: 'Organizations', roles: ['admin'], location: 'Admin Sidebar', targetRoute: '/admin/organizations', created: true, status: 'working' },
  { id: 'admin-nav-courses', label: 'Courses', roles: ['admin'], location: 'Admin Sidebar', targetRoute: '/admin/courses', created: true, status: 'working' },
  { id: 'admin-nav-analytics', label: 'Analytics', roles: ['admin'], location: 'Admin Sidebar', targetRoute: '/admin/analytics', created: true, status: 'working' },
  { id: 'admin-nav-settings', label: 'Settings', roles: ['admin'], location: 'Admin Sidebar', targetRoute: '/admin/settings', created: true, status: 'working' },

  // Admin Dashboard Quick Actions
  { id: 'admin-dash-users-mgmt', label: 'User Management', roles: ['admin'], location: 'Admin Dashboard', targetRoute: '/admin/users', created: true, status: 'working' },
  { id: 'admin-dash-course-builder', label: 'Course Builder', roles: ['admin'], location: 'Admin Dashboard', targetRoute: '/admin/course-builder/new', created: false, status: 'missing' },
  { id: 'admin-dash-analytics', label: 'Analytics', roles: ['admin'], location: 'Admin Dashboard', targetRoute: '/admin/analytics', created: true, status: 'working' },
  { id: 'admin-quick-create-org', label: 'Create New Organization', roles: ['admin'], location: 'Admin Header', targetRoute: '/admin/organizations/new', created: false, status: 'missing' },

  // Admin User Management
  { id: 'admin-users-add', label: 'Add User', roles: ['admin'], location: 'Admin Users', modal: 'AddUserModal', created: true, status: 'working' },
  { id: 'admin-users-import', label: 'Import CSV', roles: ['admin'], location: 'Admin Users', action: 'import-csv', created: false, status: 'stub' },
  { id: 'admin-users-export', label: 'Export Users', roles: ['admin'], location: 'Admin Users', action: 'export-users', created: false, status: 'stub' },
  { id: 'admin-users-send-reminder', label: 'Send Reminder', roles: ['admin'], location: 'Admin Users', action: 'send-reminder', created: false, status: 'stub' },
  { id: 'admin-users-assign-course', label: 'Assign Course', roles: ['admin'], location: 'Admin Users', modal: 'CourseAssignmentModal', created: true, status: 'working' },
  { id: 'admin-user-profile', label: 'View Profile', roles: ['admin'], location: 'Admin Users Table', targetRoute: '/admin/users/:userId', params: { userId: 'user-{id}' }, created: true, status: 'working' },
  { id: 'admin-user-edit', label: 'Edit User', roles: ['admin'], location: 'Admin Users Table', action: 'edit-user', created: false, status: 'stub' },
  { id: 'admin-user-delete', label: 'Delete User', roles: ['admin'], location: 'Admin Users Table', action: 'delete-user', created: false, status: 'stub' },

  // Admin Organization Management
  { id: 'admin-orgs-add', label: 'Add Organization', roles: ['admin'], location: 'Admin Organizations', modal: 'AddOrganizationModal', created: true, status: 'working' },
  { id: 'admin-orgs-import', label: 'Import Organizations', roles: ['admin'], location: 'Admin Organizations', action: 'import-orgs', created: false, status: 'stub' },
  { id: 'admin-orgs-export', label: 'Export Organizations', roles: ['admin'], location: 'Admin Organizations', action: 'export-orgs', created: false, status: 'stub' },
  { id: 'admin-org-view', label: 'View Organization', roles: ['admin'], location: 'Admin Organizations Table', targetRoute: '/admin/organizations/:orgId', params: { orgId: '{id}' }, created: true, status: 'working' },
  { id: 'admin-org-profile', label: 'View Profile', roles: ['admin'], location: 'Admin Organizations Table', targetRoute: '/admin/org-profiles/org-profile-:orgId', params: { orgId: '{id}' }, created: true, status: 'working' },
  { id: 'admin-org-edit', label: 'Edit Organization', roles: ['admin'], location: 'Admin Organizations Table', action: 'edit-org', created: false, status: 'stub' },
  { id: 'admin-org-delete', label: 'Delete Organization', roles: ['admin'], location: 'Admin Organizations Table', action: 'delete-org', created: false, status: 'stub' },

  // Admin Course Management
  { id: 'admin-courses-create', label: 'Create Course', roles: ['admin'], location: 'Admin Courses', targetRoute: '/admin/course-builder/new', created: false, status: 'missing' },
  { id: 'admin-courses-import', label: 'Import Courses', roles: ['admin'], location: 'Admin Courses', targetRoute: '/admin/courses/import', created: true, status: 'working' },
  { id: 'admin-courses-bulk-assign', label: 'Bulk Assign', roles: ['admin'], location: 'Admin Courses', targetRoute: '/admin/courses/bulk', params: { ids: 'selected' }, created: false, status: 'missing' },
  { id: 'admin-courses-bulk-publish', label: 'Bulk Publish', roles: ['admin'], location: 'Admin Courses', action: 'bulk-publish', created: true, status: 'working' },
  { id: 'admin-courses-select-all', label: 'Select All', roles: ['admin'], location: 'Admin Courses', action: 'select-all', created: true, status: 'working' },
  { id: 'admin-courses-export', label: 'Export Selected', roles: ['admin'], location: 'Admin Courses', action: 'export-courses', created: false, status: 'stub' },
  { id: 'admin-course-view', label: 'View Course', roles: ['admin'], location: 'Admin Courses Table', targetRoute: '/admin/courses/:courseId/details', params: { courseId: '{id}' }, created: true, status: 'working' },
  { id: 'admin-course-edit', label: 'Edit Course', roles: ['admin'], location: 'Admin Courses Table', targetRoute: '/admin/course-builder/:courseId', params: { courseId: '{id}' }, created: false, status: 'missing' },
  { id: 'admin-course-duplicate', label: 'Duplicate Course', roles: ['admin'], location: 'Admin Courses Table', action: 'duplicate-course', created: false, status: 'stub' },
  { id: 'admin-course-analytics', label: 'Course Analytics', roles: ['admin'], location: 'Admin Courses Table', targetRoute: '/admin/reports?courseId=:courseId', params: { courseId: '{id}' }, created: false, status: 'missing' },
  { id: 'admin-course-delete', label: 'Delete Course', roles: ['admin'], location: 'Admin Courses Table', action: 'delete-course', created: false, status: 'stub' },

  // Admin Survey Management
  { id: 'admin-surveys-nav', label: 'Surveys', roles: ['admin'], location: 'Admin Missing Nav', targetRoute: '/admin/surveys', created: true, status: 'working' },
  { id: 'admin-survey-builder', label: 'Survey Builder', roles: ['admin'], location: 'Admin Surveys', targetRoute: '/admin/surveys/builder', created: true, status: 'working' },
  { id: 'admin-survey-edit', label: 'Edit Survey', roles: ['admin'], location: 'Admin Surveys', targetRoute: '/admin/surveys/builder/:surveyId', params: { surveyId: '{id}' }, created: true, status: 'working' },
  { id: 'admin-survey-preview', label: 'Preview Survey', roles: ['admin'], location: 'Admin Survey Builder', targetRoute: '/admin/surveys/:surveyId/preview', params: { surveyId: '{id}' }, created: true, status: 'working' },
  { id: 'admin-survey-analytics', label: 'Survey Analytics', roles: ['admin'], location: 'Admin Surveys', targetRoute: '/admin/surveys/:surveyId/analytics', params: { surveyId: '{id}' }, created: true, status: 'working' },
  { id: 'admin-survey-assign', label: 'Assign Survey', roles: ['admin'], location: 'Admin Survey Builder', modal: 'AssignmentModal', created: true, status: 'working' },

  // Admin Reports & Analytics
  { id: 'admin-reports-nav', label: 'Reports', roles: ['admin'], location: 'Admin Missing Nav', targetRoute: '/admin/reports', created: true, status: 'working' },
  { id: 'admin-certificates-nav', label: 'Certificates', roles: ['admin'], location: 'Admin Missing Nav', targetRoute: '/admin/certificates', created: true, status: 'working' },
  { id: 'admin-integrations-nav', label: 'Integrations', roles: ['admin'], location: 'Admin Missing Nav', targetRoute: '/admin/integrations', created: true, status: 'working' },
  { id: 'admin-documents-nav', label: 'Documents', roles: ['admin'], location: 'Admin Missing Nav', targetRoute: '/admin/documents', created: true, status: 'working' },
];

/**
 * LMS/CLIENT PORTAL NAVIGATION & ACTIONS
 */
export const LMS_ROUTES: ButtonRouteEntry[] = [
  // LMS Sidebar Navigation
  { id: 'lms-nav-dashboard', label: 'Dashboard', roles: ['learner', 'facilitator'], location: 'LMS Sidebar', targetRoute: '/lms/dashboard', created: true, status: 'working' },
  { id: 'lms-nav-courses', label: 'Courses', roles: ['learner', 'facilitator'], location: 'LMS Sidebar', targetRoute: '/lms/courses', created: true, status: 'working' },
  { id: 'lms-nav-downloads', label: 'Downloads', roles: ['learner', 'facilitator'], location: 'LMS Sidebar', targetRoute: '/lms/downloads', created: true, status: 'working' },
  { id: 'lms-nav-feedback', label: 'Feedback', roles: ['learner', 'facilitator'], location: 'LMS Sidebar', targetRoute: '/lms/feedback', created: true, status: 'working' },
  { id: 'lms-nav-contact', label: 'Contact', roles: ['learner', 'facilitator'], location: 'LMS Sidebar', targetRoute: '/lms/contact', created: true, status: 'working' },

  // LMS Dashboard Quick Actions
  { id: 'lms-dash-browse-courses', label: 'Browse All Courses', roles: ['learner', 'facilitator'], location: 'LMS Dashboard', targetRoute: '/lms/courses', created: true, status: 'working' },
  { id: 'lms-dash-certificates', label: 'View Certificates', roles: ['learner', 'facilitator'], location: 'LMS Dashboard', targetRoute: '/lms/certificates', created: true, status: 'working' },
  { id: 'lms-dash-progress', label: 'View Progress', roles: ['learner', 'facilitator'], location: 'LMS Dashboard', targetRoute: '/lms/progress', created: true, status: 'working' },
  { id: 'lms-dash-goals', label: 'Learning Goals', roles: ['learner', 'facilitator'], location: 'LMS Dashboard', targetRoute: '/lms/goals', created: false, status: 'missing' },
  { id: 'lms-dash-settings', label: 'Settings', roles: ['learner', 'facilitator'], location: 'Enhanced LMS Layout', targetRoute: '/lms/settings', created: true, status: 'working' },
  { id: 'lms-dash-help', label: 'Help', roles: ['learner', 'facilitator'], location: 'Enhanced LMS Layout', targetRoute: '/lms/help', created: true, status: 'working' },

  // Course Navigation
  { id: 'lms-course-start', label: 'Start Course', roles: ['learner', 'facilitator'], location: 'LMS Dashboard', targetRoute: '/lms/course/:courseId', params: { courseId: '{id}' }, created: true, status: 'working' },
  { id: 'lms-course-continue', label: 'Continue', roles: ['learner', 'facilitator'], location: 'LMS Dashboard', targetRoute: '/lms/course/:courseId/lesson/:lessonId', params: { courseId: '{courseId}', lessonId: '{nextLessonId}' }, created: true, status: 'working' },
  { id: 'lms-course-view', label: 'View Course', roles: ['learner', 'facilitator'], location: 'LMS Courses', targetRoute: '/lms/course/:courseId', params: { courseId: '{id}' }, created: true, status: 'working' },
  
  // Module & Lesson Navigation
  { id: 'lms-module-view', label: 'View Module', roles: ['learner', 'facilitator'], location: 'LMS Course', targetRoute: '/lms/module/:moduleId', params: { moduleId: '{id}' }, created: true, status: 'working' },
  { id: 'lms-lesson-next', label: 'Next Lesson', roles: ['learner', 'facilitator'], location: 'LMS Module', targetRoute: '/lms/module/:moduleId/lesson/:lessonId', params: { moduleId: '{moduleId}', lessonId: '{nextLessonId}' }, created: true, status: 'working' },
  { id: 'lms-lesson-prev', label: 'Previous Lesson', roles: ['learner', 'facilitator'], location: 'LMS Module', targetRoute: '/lms/module/:moduleId/lesson/:lessonId', params: { moduleId: '{moduleId}', lessonId: '{prevLessonId}' }, created: true, status: 'working' },
  { id: 'lms-lesson-complete', label: 'Mark Complete', roles: ['learner', 'facilitator'], location: 'LMS Module', action: 'mark-lesson-complete', created: true, status: 'working' },
  
  // Resource Actions
  { id: 'lms-resource-download', label: 'Download Resource', roles: ['learner', 'facilitator'], location: 'LMS Module', action: 'download-resource', created: true, status: 'working' },
  { id: 'lms-feedback-submit', label: 'Submit Feedback', roles: ['learner', 'facilitator'], location: 'LMS Module', targetRoute: '/lms/feedback', created: true, status: 'working' },
];

/**
 * CLIENT WORKSPACE ROUTES
 */
export const CLIENT_WORKSPACE_ROUTES: ButtonRouteEntry[] = [
  { id: 'client-strategic-plans', label: 'Strategic Plans', roles: ['client'], location: 'Client Workspace', targetRoute: '/client/strategic-plans', created: true, status: 'working' },
  { id: 'client-session-notes', label: 'Session Notes', roles: ['client'], location: 'Client Workspace', targetRoute: '/client/session-notes', created: true, status: 'working' },
  { id: 'client-action-tracker', label: 'Action Tracker', roles: ['client'], location: 'Client Workspace', targetRoute: '/client/action-tracker', created: true, status: 'working' },
  { id: 'client-documents', label: 'Documents', roles: ['client'], location: 'Client Workspace', targetRoute: '/client/documents', created: true, status: 'working' },
];

/**
 * MISSING PAGES TO CREATE
 */
export const MISSING_PAGES: RouteStatus[] = [
  // Admin Missing Pages
  { route: '/admin/course-builder/new', exists: false, requiredRoles: ['admin'], status: 'missing', component: 'AdminCourseBuilder' },
  { route: '/admin/course-builder/:courseId', exists: false, requiredRoles: ['admin'], status: 'missing', component: 'AdminCourseBuilder' },
  { route: '/admin/organizations/new', exists: false, requiredRoles: ['admin'], status: 'missing', component: 'AdminOrganizationCreate' },
  { route: '/admin/courses/bulk', exists: false, requiredRoles: ['admin'], status: 'missing', component: 'AdminCoursesBulk' },
  { route: '/admin/courses/import', exists: true, requiredRoles: ['admin'], status: 'working', component: 'AdminCoursesImport' },
  { route: '/admin/reports', exists: true, requiredRoles: ['admin'], status: 'working', component: 'AdminReports' },

  // LMS Missing Pages
    // Missing Component Stubs Needing Implementation
  { route: '/lms/certificates', exists: true, requiredRoles: ['learner', 'facilitator'], status: 'working', component: 'LMSCertificates' },
  { route: '/lms/progress', exists: true, requiredRoles: ['learner', 'facilitator'], status: 'working', component: 'LMSProgress' },
  { route: '/lms/goals', exists: false, requiredRoles: ['learner', 'facilitator'], status: 'missing', component: 'LMSGoals' },
  { route: '/lms/settings', exists: true, requiredRoles: ['learner', 'facilitator'], status: 'working', component: 'LMSSettings' },
  { route: '/lms/help', exists: true, requiredRoles: ['learner', 'facilitator'], status: 'working', component: 'LMSHelp' },

  // Marketing Missing Functionality
  { route: '#book-call', exists: true, requiredRoles: ['*'], status: 'working', component: 'BookingWidget' },
];

/**
 * BROKEN LINKS TO FIX
 */
export const BROKEN_LINKS: ButtonRouteEntry[] = [
  { id: 'admin-org-edit-broken', label: 'Edit Organization', roles: ['admin'], location: 'Admin Organizations', action: 'edit-org', created: false, status: 'stub', description: 'Shows toast instead of actual edit functionality' },
  { id: 'admin-user-edit-broken', label: 'Edit User', roles: ['admin'], location: 'Admin Users', action: 'edit-user', created: false, status: 'stub', description: 'Shows toast instead of actual edit functionality' },
  { id: 'admin-course-duplicate-broken', label: 'Duplicate Course', roles: ['admin'], location: 'Admin Courses', action: 'duplicate-course', created: false, status: 'stub', description: 'Function exists but needs implementation' },
];

/**
 * UTILITY FUNCTIONS
 */
export const getRoutesByStatus = (status: 'working' | 'broken' | 'missing' | 'stub'): ButtonRouteEntry[] => {
  const allRoutes = [...GLOBAL_NAVIGATION, ...ADMIN_ROUTES, ...LMS_ROUTES, ...CLIENT_WORKSPACE_ROUTES, ...BROKEN_LINKS];
  return allRoutes.filter(route => route.status === status);
};

export const getRoutesByRole = (role: string): ButtonRouteEntry[] => {
  const allRoutes = [...GLOBAL_NAVIGATION, ...ADMIN_ROUTES, ...LMS_ROUTES, ...CLIENT_WORKSPACE_ROUTES];
  return allRoutes.filter(route => route.roles.includes(role) || route.roles.includes('*'));
};

export const getMissingPages = (): RouteStatus[] => {
  return MISSING_PAGES.filter(page => !page.exists);
};

export const getBrokenLinks = (): ButtonRouteEntry[] => {
  return BROKEN_LINKS;
};

export default {
  GLOBAL_NAVIGATION,
  ADMIN_ROUTES,
  LMS_ROUTES,
  CLIENT_WORKSPACE_ROUTES,
  MISSING_PAGES,
  BROKEN_LINKS,
  getRoutesByStatus,
  getRoutesByRole,
  getMissingPages,
  getBrokenLinks
};