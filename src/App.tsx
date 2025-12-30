import { useEffect, Suspense, lazy } from 'react';
// Load admin routes eagerly so they always share the main React instance in dev/prod.
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminHealth from './pages/Admin/AdminHealth';
import AdminCourses from './pages/Admin/AdminCourses';
import AdminCourseBuilder from './pages/Admin/AdminCourseBuilder';
import AdminCourseDetail from './pages/Admin/AdminCourseDetail';
import AdminCourseAssign from './pages/Admin/AdminCourseAssign';
import AdminCourseSettings from './pages/Admin/AdminCourseSettings';
import AdminSurveys from './pages/Admin/AdminSurveys';
// (removed duplicate import)
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { courseStore } from './store/courseStore';
import { LoadingSpinner } from './components/LoadingComponents';
import { ErrorBoundary } from './components/ErrorHandling';
import Header from './components/Header';
import Footer from './components/Footer';
import DemoModeBanner from './components/DemoModeBanner';
import ConnectivityBanner from './components/ConnectivityBanner';
import SupabaseStatusBanner from './components/SupabaseStatusBanner';
import ConnectionDiagnostic from './components/ConnectionDiagnostic';
import TroubleshootingGuide from './components/TroubleshootingGuide';
import RequireAuth from './components/routing/RequireAuth';
import DevDebugPanel from './components/DevDebugPanel';

// Import components used in routes/layout
import OrgWorkspaceLayout from './components/OrgWorkspace/OrgWorkspaceLayout';
import ClientDashboard from './pages/Client/ClientDashboard';
import ClientCourses from './pages/Client/ClientCourses';
import ClientCourseDetail from './pages/Client/ClientCourseDetail';
import ClientLessonView from './pages/Client/ClientLessonView';
import ClientCourseCompletion from './pages/Client/ClientCourseCompletion';
import ClientSurveys from './pages/Client/ClientSurveys';
import ClientProfile from './pages/Client/ClientProfile';
import ClientLayout from './pages/Client/ClientLayout';
import LMSLayout from './components/LMS/LMSLayout';
import LMSDashboard from './pages/LMS/LMSDashboard';
import LMSCourses from './pages/LMS/LMSCourses';
import LMSProgress from './pages/LMS/LMSProgress';
import LMSCertificates from './pages/LMS/LMSCertificates';
import LMSDownloads from './pages/LMS/LMSDownloads';
import LMSFeedback from './pages/LMS/LMSFeedback';
import LMSContact from './pages/LMS/LMSContact';
import LMSSettings from './pages/LMS/LMSSettings';
import LMSHelp from './pages/LMS/LMSHelp';
import LMSMeeting from './pages/LMS/LMSMeeting';
import LMSModule from './pages/LMS/LMSModule';
import LMSCourseCompletion from './pages/LMS/LMSCourseCompletion';
import LMSLessonView from './pages/LMS/LMSLessonView';
import NotFound from './pages/NotFound';
import AIBot from './components/AIBot/AIBot';
import AdminCourseImportPlaceholder from './pages/Admin/Course/AdminCourseImportPlaceholder';
import AdminCourseBulkPlaceholder from './pages/Admin/Course/AdminCourseBulkPlaceholder';
import AdminCourseNewPlaceholder from './pages/Admin/Course/AdminCourseNewPlaceholder';

import HomePage from './pages/HomePage';
import LMSLogin from './pages/LMS/LMSLogin';
import AdminLogin from './pages/Admin/AdminLogin';
import useViewportHeight from './hooks/useViewportHeight';

const AboutPage = lazy(() => import('./pages/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ResourcePage = lazy(() => import('./pages/ResourcePage'));
const TestimonialsPage = lazy(() => import('./pages/TestimonialsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage'));


function App() {
  useViewportHeight();
  useEffect(() => {
    // Initialize course store and sync default courses to database
    courseStore.init().catch(error => {
      console.error('Failed to initialize course store:', error);
    });
  }, []);

  return (
    <Router>
      <div className="flex min-h-[calc(var(--app-vh,1vh)*100)] flex-col bg-[var(--hud-bg)]" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
    <Header />
    <DemoModeBanner />
    <SupabaseStatusBanner />
    <ConnectivityBanner />
        <main className="flex-grow">
          <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/resources" element={<ResourcePage />} />
                <Route path="/testimonials" element={<TestimonialsPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/client-portal" element={<ClientPortalPage />} />
                <Route path="/client-portal/org/:orgId/*" element={<RequireAuth mode="lms"><OrgWorkspaceLayout /></RequireAuth>} />
                <Route
                  path="/client/*"
                  element={(
                    <RequireAuth mode="lms">
                      <ClientLayout />
                    </RequireAuth>
                  )}
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ClientDashboard />} />
                  <Route path="courses" element={<ClientCourses />} />
                  <Route path="courses/:courseId" element={<ClientCourseDetail />} />
                  <Route path="courses/:courseId/lessons/:lessonId" element={<ClientLessonView />} />
                  <Route path="courses/:courseId/completion" element={<ClientCourseCompletion />} />
                  <Route path="surveys" element={<ClientSurveys />} />
                  <Route path="profile" element={<ClientProfile />} />
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Route>
                <Route path="/lms/login" element={<LMSLogin />} />
                <Route path="/lms" element={<Navigate to="/lms/dashboard" replace />} />
                <Route
                  path="/lms/*"
                  element={(
                    <RequireAuth mode="lms">
                      <LMSLayout />
                    </RequireAuth>
                  )}
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<LMSDashboard />} />
                  <Route path="courses" element={<LMSCourses />} />
                  <Route path="courses/:courseId" element={<LMSModule />} />
                  <Route path="course/:courseId" element={<LMSModule />} />
                  <Route path="module/:moduleId" element={<LMSModule />} />
                  <Route path="course/:courseId/lesson/:lessonId" element={<LMSLessonView />} />
                  <Route path="courses/:courseId/lesson/:lessonId" element={<LMSLessonView />} />
                  <Route path="courses/:courseId/completion" element={<LMSCourseCompletion />} />
                  <Route path="course/:courseId/completion" element={<LMSCourseCompletion />} />
                  <Route path="progress" element={<LMSProgress />} />
                  <Route path="certificates" element={<LMSCertificates />} />
                  <Route path="downloads" element={<LMSDownloads />} />
                  <Route path="feedback" element={<LMSFeedback />} />
                  <Route path="contact" element={<LMSContact />} />
                  <Route path="settings" element={<LMSSettings />} />
                  <Route path="help" element={<LMSHelp />} />
                  <Route path="meeting" element={<LMSMeeting />} />
                </Route>
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route
                  path="/admin/dashboard"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminDashboard />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/courses"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourses />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/courses/new"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourseNewPlaceholder />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/courses/import"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourseImportPlaceholder />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/courses/bulk"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourseBulkPlaceholder />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/courses/:courseId/details"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourseDetail />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/courses/:courseId/assign"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourseAssign />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/courses/:courseId/settings"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourseSettings />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/surveys"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminSurveys />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/course-builder/new"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourseBuilder />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/course-builder/:courseId"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminCourseBuilder />
                    </RequireAuth>
                  )}
                />
                <Route
                  path="/admin/health"
                  element={(
                    <RequireAuth mode="admin">
                      <AdminHealth />
                    </RequireAuth>
                  )}
                />
                {/* ...admin routes... */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </main>
        <Footer />
        <AIBot />
        <ConnectionDiagnostic />
        <TroubleshootingGuide />
        <DevDebugPanel />
      </div>
    </Router>
  );
}

export default App;
