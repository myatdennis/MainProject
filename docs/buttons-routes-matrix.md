# Buttons/Routes Matrix (Initial)

Status legend: ok = existing and wired; created = added in this pass; fixed = adjusted target or component.

## Canonical Routes

| Area  | Label/Intent              | Route                                           | Component                      | Status  | Notes |
|-------|---------------------------|-------------------------------------------------|--------------------------------|---------|-------|
| Admin | Dashboard                 | /admin/dashboard                                | AdminDashboard                 | ok      |       |
| Admin | Organizations             | /admin/organizations                            | AdminOrganizations             | ok      |       |
| Admin | Organization Details      | /admin/organizations/:id                        | OrganizationDetails            | ok      |       |
| Admin | Users                     | /admin/users                                     | AdminUsers                     | ok      |       |
| Admin | User Profile              | /admin/users/:id                                 | AdminUserProfile               | ok      |       |
| Admin | Courses                   | /admin/courses                                   | AdminCourses                   | ok      |       |
| Admin | New Course                | /admin/courses/new                               | AdminCourseCreate              | ok      |       |
| Admin | Edit Course               | /admin/courses/:id/edit                          | AdminCourseEdit                | ok      |       |
| Admin | Assign Course             | /admin/courses/:id/assign                        | AdminCourseAssign              | ok      |       |
| Admin | Preview Course            | /admin/courses/:id/preview                       | AdminCoursePreview             | created | Lightweight placeholder |
| Admin | Surveys                   | /admin/surveys                                   | AdminSurveys                   | ok      |       |
| Admin | New Survey                | /admin/surveys/new                               | AdminSurveyBuilder             | created | Alias to builder |
| Admin | Edit Survey               | /admin/surveys/:id/edit                          | AdminSurveyBuilder             | created | Alias to builder |
| Admin | Analytics                 | /admin/analytics                                 | AdminAnalytics                 | ok      |       |

| Area  | Label/Intent              | Route                                           | Component                      | Status  | Notes |
|-------|---------------------------|-------------------------------------------------|--------------------------------|---------|-------|
| Client| Dashboard                 | /client/dashboard                                | ClientDashboard                | ok      |       |
| Client| Courses                   | /client/courses                                  | ClientCourses                  | ok      |       |
| Client| Course Detail             | /client/courses/:id                              | ClientCourseDetail             | ok      |       |
| Client| Lesson View               | /client/courses/:id/lessons/:lessonId           | ClientLessonView               | ok      |       |
| Client| Course Completion         | /client/courses/:id/completion                   | ClientCourseCompletion         | created | Uses stored progress |
| Client| Surveys                   | /client/surveys                                  | ClientSurveys                  | created | Placeholder |
| Client| Profile                   | /client/profile                                  | ClientProfile                  | created | Shows AuthContext user |

## Adjusted Buttons (sample)

| Location                         | Control Label  | Component                 | Route/Action                                  | Status  | Notes |
|----------------------------------|----------------|---------------------------|-----------------------------------------------|---------|-------|
| AdminSurveysImport               | Back to Surveys| Button asChild + Link     | /admin/surveys                                 | fixed   | Was anchor; now shared Button |
| AdminOrganizations (card header) | View           | Button asChild + Link     | /admin/organizations/:id                       | fixed   | Was anchor; now shared Button |
| AdminOrganizationProfile         | Back to Orgs   | Button asChild + Link     | /admin/organizations                           | fixed   | Was anchor; now shared Button |

This matrix will be expanded in follow-up passes to include every clickable (sidebar, tabs, cards, modals).