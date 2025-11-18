# UI Routes & Buttons Matrix

This auto-generated matrix lists visible frontend routes and a quick status for each (exists/needs attention). Review and expand as needed.

| Label | Route | Component | Status | Notes |
|---|---|---|---|---|
| Home | / | HomePage | OK | Landing page
| About | /about | AboutPage | OK |
| Services | /services | ServicesPage | OK |
| Resources | /resources | ResourcePage | OK |
| Testimonials | /testimonials | TestimonialsPage | OK |
| Contact | /contact | ContactPage | OK |
| Client Portal Entry | /client-portal | ClientPortalPage | OK |
| Org Workspace | /client-portal/org/:orgId/* | OrgWorkspaceLayout | OK |
| Client Dashboard | /client/dashboard | ClientDashboard | OK |
| Client Courses | /client/courses | ClientCourses | OK |
| Client Course Detail | /client/courses/:courseId | ClientCourseDetail | OK |
| Client Lesson | /client/courses/:courseId/lessons/:lessonId | ClientLessonView | OK |
| Course Completion | /client/courses/:courseId/completion | ClientCourseCompletion | OK |
| Client Surveys | /client/surveys | ClientSurveys | OK |
| Client Profile | /client/profile | ClientProfile | OK |
| LMS Login | /lms/login | LMSLogin | OK |
| LMS Dashboard | /lms/dashboard | LearnerDashboard | OK |
| LMS Course | /lms/course/:courseId | Course player route | OK |
| Admin Dashboard | /admin | AdminLanding | OK |
| Admin Users | /admin/users | AdminUsers | OK |
| Admin Courses | /admin/courses | AdminCourses | OK |
| Admin Surveys | /admin/surveys | AdminSurveys | OK |

## Notes and missing routes
- There is no specific client route for an individual survey (`/client/surveys/:id`) — some components expect to open client survey detail; consider adding a route if needed.
- Meeting join is a placeholder and now uses a button to avoid dead anchor references.
- Some pages use raw anchors for navigation; prefer `Link` for internal navigation.

This matrix can be expanded into a clickable audit CSV for manual QA.
