import { useEffect, Suspense, lazy } from 'react';
// (removed duplicate import)
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { courseStore } from './store/courseStore';
import { LoadingSpinner } from './components/LoadingComponents';
import { ErrorBoundary } from './components/ErrorHandling';
import Header from './components/Header';
import Footer from './components/Footer';
import DemoModeBanner from './components/DemoModeBanner';
import ConnectionDiagnostic from './components/ConnectionDiagnostic';
import TroubleshootingGuide from './components/TroubleshootingGuide';
import RequireAuth from './components/routing/RequireAuth';

// Eager load core pages for better initial experience
import HomePage from './pages/HomePage';
import LMSLogin from './pages/LMS/LMSLogin';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminLayout from './components/Admin/AdminLayout';

// Lazy load secondary pages
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ResourcePage = lazy(() => import('./pages/ResourcePage'));
const TestimonialsPage = lazy(() => import('./pages/TestimonialsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage'));

// Lazy load LMS components
const LMSCourses = lazy(() => import('./pages/LMS/LMSCourses'));
const LMSModule = lazy(() => import('./pages/LMS/LMSModule'));
const LMSDownloads = lazy(() => import('./pages/LMS/LMSDownloads'));
const LMSFeedback = lazy(() => import('./pages/LMS/LMSFeedback'));
const LMSContact = lazy(() => import('./pages/LMS/LMSContact'));
const LMSSettings = lazy(() => import('./pages/LMS/LMSSettings'));
const LMSCertificates = lazy(() => import('./pages/LMS/LMSCertificates'));
const LMSProgress = lazy(() => import('./pages/LMS/LMSProgress'));
const LMSHelp = lazy(() => import('./pages/LMS/LMSHelp'));
const LMSLayout = lazy(() => import('./components/LMS/LMSLayout'));
const LearnerDashboard = lazy(() => import('./pages/LearnerDashboard'));
const CoursePlayer = lazy(() => import('./components/CoursePlayer/CoursePlayer'));
const AdvancedCourseBuilder = lazy(() => import('./components/CourseBuilder/AdvancedCourseBuilder'));
const ClientDashboard = lazy(() => import('./pages/Client/ClientDashboard'));
const ClientCourses = lazy(() => import('./pages/Client/ClientCourses'));
const ClientCourseDetail = lazy(() => import('./pages/Client/ClientCourseDetail'));
const ClientLessonView = lazy(() => import('./pages/Client/ClientLessonView'));

// Lazy load Admin components
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers'));
const AdminOrganizations = lazy(() => import('./pages/Admin/AdminOrganizations'));
const AdminOrganizationNew = lazy(() => import('./pages/Admin/AdminOrganizationNew'));
const OrganizationDetails = lazy(() => import('./pages/Admin/OrganizationDetails'));
const AdminCourses = lazy(() => import('./pages/Admin/AdminCourses'));
const AdminReports = lazy(() => import('./pages/Admin/AdminReports'));
const AdminSettings = lazy(() => import('./pages/Admin/AdminSettings'));
// AdminLayout is now eagerly loaded above
const AdminAnalytics = lazy(() => import('./pages/Admin/AdminAnalytics'));
const AdminCertificates = lazy(() => import('./pages/Admin/AdminCertificates'));
const AdminIntegrations = lazy(() => import('./pages/Admin/AdminIntegrations'));
const AdminIntegrationConfig = lazy(() => import('./pages/Admin/AdminIntegrationConfig'));
const AdminCourseCreate = lazy(() => import('./pages/Admin/AdminCourseCreate'));
const AdminCourseEdit = lazy(() => import('./pages/Admin/AdminCourseEdit'));
const AdminCourseAssign = lazy(() => import('./pages/Admin/AdminCourseAssign'));
const AdminCourseDetail = lazy(() => import('./pages/Admin/AdminCourseDetail'));
const AdminSurveys = lazy(() => import('./pages/Admin/AdminSurveys'));
const AdminSurveyBuilder = lazy(() => import('./pages/Admin/AdminSurveyBuilder'));
const AdminSurveyAnalytics = lazy(() => import('./pages/Admin/AdminSurveyAnalytics'));
const AdminDocuments = lazy(() => import('./pages/Admin/AdminDocuments'));
const AdminUserProfile = lazy(() => import('./pages/Admin/AdminUserProfile'));
const AdminOrgProfile = lazy(() => import('./pages/Admin/AdminOrgProfile'));
const AdminResourceSender = lazy(() => import('./pages/Admin/AdminResourceSender'));
const AdminPerformanceDashboard = lazy(() => import('./pages/Admin/AdminPerformanceDashboard'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

// Lazy load additional components
const AIBot = lazy(() => import('./components/AIBot/AIBot'));
const OrgWorkspaceLayout = lazy(() => import('./components/OrgWorkspace/OrgWorkspaceLayout'));
const StrategicPlansPage = lazy(() => import('./components/OrgWorkspace/StrategicPlansPage'));
const SessionNotesPage = lazy(() => import('./components/OrgWorkspace/SessionNotesPage'));
const ActionTrackerPage = lazy(() => import('./components/OrgWorkspace/ActionTrackerPage'));
import DocumentsPage from './pages/Client/DocumentsPage';

function App() {
  useEffect(() => {
    // Initialize course store and sync default courses to database
    courseStore.init().catch(error => {
      console.error('Failed to initialize course store:', error);
    });
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppWithAuthRoutes />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

import { useAuth } from './context/AuthContext';

function AppWithAuthRoutes() {
  const { authInitializing } = useAuth();
  if (authInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900">Initializing authentication...</h2>
          <p className="text-gray-600">Please wait while we check your authentication status.</p>
        </div>
      </div>
    );
  }
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <DemoModeBanner />
        <main className="flex-grow">
          <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/resources" element={<ResourcePage />} />
              <Route path="/testimonials" element={<TestimonialsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/client-portal" element={<ClientPortalPage />} />
              <Route path="/client-portal/org/:orgId/*" element={
                <RequireAuth mode="lms">
                  <OrgWorkspaceLayout />
                </RequireAuth>
              }>
                <Route path="strategic-plans" element={<StrategicPlansPage />} />
                <Route path="session-notes" element={<SessionNotesPage />} />
                <Route path="action-tracker" element={<ActionTrackerPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="" element={<StrategicPlansPage />} />
              </Route>
              <Route path="/client" element={<Navigate to="/client/dashboard" replace />} />
              <Route
                path="/client/dashboard"
                element={
                  <RequireAuth mode="lms">
                    <ClientDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/client/courses"
                element={
                  <RequireAuth mode="lms">
                    <ClientCourses />
                  </RequireAuth>
                }
              />
              <Route
                path="/client/courses/:courseId"
                element={
                  <RequireAuth mode="lms">
                    <ClientCourseDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="/client/courses/:courseId/lessons/:lessonId"
                element={
                  <RequireAuth mode="lms">
                    <ClientLessonView />
                  </RequireAuth>
                }
              />
              <Route path="/lms/login" element={<LMSLogin />} />
              <Route path="/lms" element={<Navigate to="/lms/dashboard" replace />} />
              <Route
                path="/lms/*"
                element={
                  <RequireAuth mode="lms">
                    <LMSLayout>
                      <Routes>
                        <Route path="dashboard" element={<LearnerDashboard />} />
                        <Route path="courses" element={<LMSCourses />} />
                        <Route path="course/:courseId" element={<CoursePlayer />} />
                        <Route path="course/:courseId/lesson/:lessonId" element={<CoursePlayer />} />
                        <Route
                          path="module/:moduleId"
                          element={
                            <ErrorBoundary>
                              <LMSModule />
                            </ErrorBoundary>
                          }
                        />
                        <Route path="downloads" element={<LMSDownloads />} />
                        <Route path="feedback" element={<LMSFeedback />} />
                        <Route path="contact" element={<LMSContact />} />
                        <Route path="settings" element={<LMSSettings />} />
                        <Route path="certificates" element={<LMSCertificates />} />
                        <Route
                          path="progress"
                          element={
                            <ErrorBoundary>
                              <LMSProgress />
                            </ErrorBoundary>
                          }
                        />
                        <Route path="help" element={<LMSHelp />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </LMSLayout>
                  </RequireAuth>
                }
              />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route
                path="/admin/*"
                element={
                  <RequireAuth mode="admin">
                    <AdminLayout>
                      <Routes>
                        <Route
                          path="dashboard"
                          element={
                            <ErrorBoundary>
                              <AdminDashboard />
                            </ErrorBoundary>
                          }
                        />
                        <Route
                          path="users"
                          element={
                            <ErrorBoundary>
                              <AdminUsers />
                            </ErrorBoundary>
                          }
                        />
                        <Route path="users/:userId" element={<AdminUserProfile />} />
                        <Route
                          path="organizations"
                          element={
                            <ErrorBoundary>
                              <AdminOrganizations />
                            </ErrorBoundary>
                          }
                        />
                        <Route path="organizations/new" element={<AdminOrganizationNew />} />
                        <Route path="organizations/:id" element={<OrganizationDetails />} />
                        <Route path="org-profiles/:orgProfileId" element={<AdminOrgProfile />} />
                        <Route path="send-resource" element={<AdminResourceSender />} />
                        <Route
                          path="courses"
                          element={
                            <ErrorBoundary>
                              <AdminCourses />
                            </ErrorBoundary>
                          }
                        />
                        <Route path="courses/new" element={<AdminCourseCreate />} />
                        <Route path="courses/:courseId/edit" element={<AdminCourseEdit />} />
                        <Route path="courses/:courseId/assign" element={<AdminCourseAssign />} />
                        <Route path="reports" element={<AdminReports />} />
                        <Route path="analytics" element={<AdminAnalytics />} />
                        <Route path="performance" element={<AdminPerformanceDashboard />} />
                        <Route path="certificates" element={<AdminCertificates />} />
                        <Route path="integrations" element={<AdminIntegrations />} />
                        <Route path="integrations/:integrationId" element={<AdminIntegrationConfig />} />
                        <Route path="surveys" element={<AdminSurveys />} />
                        <Route path="surveys/builder" element={<AdminSurveyBuilder />} />
                        <Route path="surveys/builder/:surveyId" element={<AdminSurveyBuilder />} />
                        <Route path="surveys/:surveyId/analytics" element={<AdminSurveyAnalytics />} />
                        <Route path="surveys/:surveyId/preview" element={<AdminSurveyBuilder />} />
                        <Route path="course-builder/:courseId" element={<AdvancedCourseBuilder />} />
                        <Route path="courses/:courseId/details" element={<AdminCourseDetail />} />
                        <Route
                          path="documents"
                          element={
                            <ErrorBoundary>
                              <AdminDocuments />
                            </ErrorBoundary>
                          }
                        />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AdminLayout>
                  </RequireAuth>
                }
              />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <AIBot />
        <ConnectionDiagnostic />
        <TroubleshootingGuide />
      </div>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1E1E1E',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#3BAA66',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#E6473A',
              secondary: '#fff',
            },
          },
        }}
      />
    </Router>
  );
}

export default App;
