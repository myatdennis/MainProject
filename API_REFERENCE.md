# API_REFERENCE.md

## API Reference

This document lists all major API endpoints for the LMS platform. For authentication, include a valid access token in the `Authorization` header unless otherwise noted.

---

### Authentication
- `POST /api/auth/login` — User login
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/forgot-password` — Request password reset
- `GET /api/auth/csrf` — Get CSRF token

### Courses
- `GET /api/client/courses` — List published courses
- `GET /api/client/courses/:identifier` — Get course by ID or slug
- `GET /api/admin/courses` — List all courses (admin)
- `POST /api/admin/courses` — Create or update a course (admin)
- `POST /api/admin/courses/import` — Batch import courses (admin)
- `POST /api/admin/courses/:id/publish` — Publish a course (admin)
- `POST /api/admin/courses/:id/assign` — Assign course to users/org (admin)
- `DELETE /api/admin/courses/:id` — Delete a course (admin)

### Modules & Lessons
- `POST /api/admin/modules` — Create module (admin)
- `POST /api/admin/lessons` — Create lesson (admin)

### Assignments
- `GET /api/client/assignments?user_id=...` — List assignments for user

### Progress & Analytics
- `POST /api/client/progress/batch` — Batch lesson progress events
- `POST /api/analytics/events/batch` — Batch analytics events
- `GET /api/admin/analytics` — Analytics overview (admin)
- `POST /api/admin/analytics/summary` — AI-generated analytics summary (admin)

### Surveys
- `GET /api/admin/surveys` — List all surveys (admin)
- `POST /api/admin/surveys` — Create or update survey (admin)
- `GET /api/client/surveys` — List available surveys for user
- `POST /api/client/surveys/:id/submit` — Submit survey response

### Users & Organizations
- `GET /api/admin/users` — List users (admin)
- `POST /api/admin/users` — Create or update user (admin)
- `GET /api/admin/organizations` — List organizations (admin)
- `POST /api/admin/organizations` — Create or update organization (admin)

### Content & Documents
- `GET /api/text-content` — Get editable text content
- `PUT /api/text-content` — Update text content
- `GET /api/admin/documents` — List admin documents
- `POST /api/admin/documents` — Upload document

---

**See each route's implementation for required parameters and response shapes.**

For more details, see the full backend code or contact the project maintainer.
