import { useEffect, Suspense, lazy } from 'react';
// Use extension-less import so Vite resolves the compiled module in all environments
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const AdminHealth = lazy(() => import('./pages/Admin/AdminHealth'));
const AdminCourses = lazy(() => import('./pages/Admin/AdminCourses'));
// (removed duplicate import)
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { courseStore } from './store/courseStore';
import { LoadingSpinner } from './components/LoadingComponents';
import { ErrorBoundary } from './components/ErrorHandling';
import Header from './components/Header';
import Footer from './components/Footer';
import DemoModeBanner from './components/DemoModeBanner';
import ConnectivityBanner from './components/ConnectivityBanner';
import ConnectionDiagnostic from './components/ConnectionDiagnostic';
import TroubleshootingGuide from './components/TroubleshootingGuide';
import RequireAuth from './components/routing/RequireAuth';

// Import components used in routes/layout
import OrgWorkspaceLayout from './components/OrgWorkspace/OrgWorkspaceLayout';
import ClientDashboard from './pages/Client/ClientDashboard';
import ClientCourses from './pages/Client/ClientCourses';
import ClientCourseDetail from './pages/Client/ClientCourseDetail';
import ClientLessonView from './pages/Client/ClientLessonView';
import ClientCourseCompletion from './pages/Client/ClientCourseCompletion';
import ClientSurveys from './pages/Client/ClientSurveys';
import ClientProfile from './pages/Client/ClientProfile';
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
                <Route path="/client" element={<Navigate to="/client/dashboard" replace />} />
                <Route path="/client/dashboard" element={<RequireAuth mode="lms"><ClientDashboard /></RequireAuth>} />
                <Route path="/client/courses" element={<RequireAuth mode="lms"><ClientCourses /></RequireAuth>} />
                <Route path="/client/courses/:courseId" element={<RequireAuth mode="lms"><ClientCourseDetail /></RequireAuth>} />
                <Route path="/client/courses/:courseId/lessons/:lessonId" element={<RequireAuth mode="lms"><ClientLessonView /></RequireAuth>} />
                <Route path="/client/courses/:courseId/completion" element={<RequireAuth mode="lms"><ClientCourseCompletion /></RequireAuth>} />
                <Route path="/client/surveys" element={<RequireAuth mode="lms"><ClientSurveys /></RequireAuth>} />
                <Route path="/client/profile" element={<RequireAuth mode="lms"><ClientProfile /></RequireAuth>} />
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
                <Route path="/admin/dashboard" element={
                  <RequireAuth mode="admin">
                    <Suspense fallback={<LoadingSpinner size="lg" text="Loading..." />}>
                      <AdminDashboard />
                    </Suspense>
                  </RequireAuth>
                } />
                <Route path="/admin/courses" element={
                  <RequireAuth mode="admin">
                    <Suspense fallback={<LoadingSpinner size="lg" text="Loading courses..." />}>
                      <AdminCourses />
                    </Suspense>
                  </RequireAuth>
                } />
                <Route path="/admin/health" element={
                  <RequireAuth mode="admin">
                    <Suspense fallback={<LoadingSpinner size="lg" text="Loading health checks..." />}>
                      <AdminHealth />
                    </Suspense>
                  </RequireAuth>
                } />
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
      </div>
    </Router>
  );
}

export default App;
