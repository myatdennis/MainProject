import { useEffect, Suspense, lazy, useRef } from 'react';
// Load admin routes eagerly so they always share the main React instance in dev/prod.
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminHealth from './pages/Admin/AdminHealth';
import AdminCourses from './pages/Admin/AdminCourses';
import AdminCourseBuilder from './pages/Admin/AdminCourseBuilder';
import AdminCourseDetail from './pages/Admin/AdminCourseDetail';
import AdminCourseEdit from './pages/Admin/AdminCourseEdit';
import AdminCourseAssign from './pages/Admin/AdminCourseAssign';
import AdminCourseSettings from './pages/Admin/AdminCourseSettings';
import AdminSurveys from './pages/Admin/AdminSurveys';
import AdminAnalytics from './pages/Admin/AdminAnalytics';
import AdminSurveyBuilder from './pages/Admin/AdminSurveyBuilder';
import AdminSurveyAnalytics from './pages/Admin/AdminSurveyAnalytics';
import AdminOrganizations from './pages/Admin/AdminOrganizations';
import AdminOrganizationProfile from './pages/Admin/AdminOrganizationProfile';
import AdminOrganizationCreate from './pages/Admin/AdminOrganizationNew';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminUserProfile from './pages/Admin/AdminUserProfile';
import AdminDocuments from './pages/Admin/AdminDocuments';
import AdminPerformanceDashboard from './pages/Admin/AdminPerformanceDashboard';
import AdminSettings from './pages/Admin/AdminSettings';
import AdminQueueMonitor from './pages/Admin/AdminQueueMonitor';
import AdminLeadershipInsights from './pages/Admin/AdminLeadershipInsights';
import AdminProfilePage from './pages/Admin/AdminProfilePage';
import AdminLayout from './components/Admin/AdminLayout';
// (removed duplicate import)
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { useSecureAuth } from './context/SecureAuthContext';

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
import AdminCoursesImport from './pages/Admin/AdminCoursesImport';
import AdminCourseBulkPlaceholder from './pages/Admin/Course/AdminCourseBulkPlaceholder';
import AdminCourseNewPlaceholder from './pages/Admin/Course/AdminCourseNewPlaceholder';
import InviteAccept from './pages/InviteAccept';
import AuthCallback from './pages/AuthCallback';

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

const AdminProtectedLayout = () => (
  <RequireAuth mode="admin">
    <AdminLayout />
  </RequireAuth>
);

const LmsProtectedLayout = () => (
  <RequireAuth mode="lms">
    <LMSLayout />
  </RequireAuth>
);

const ClientProtectedLayout = () => (
  <RequireAuth mode="lms">
    <ClientLayout />
  </RequireAuth>
);

const OrgWorkspaceProtectedLayout = () => (
  <RequireAuth mode="lms">
    <OrgWorkspaceLayout />
  </RequireAuth>
);


function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  useViewportHeight();
  const { sessionStatus, user, activeOrgId, orgResolutionStatus } = useSecureAuth();
  const courseInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== 'ready') {
      return;
    }
    if (user && orgResolutionStatus !== 'ready') {
      return;
    }
    const targetKey = user ? `${user.id}:${activeOrgId ?? 'none'}` : 'guest';
    if (courseInitKeyRef.current === targetKey) {
      return;
    }
    let cancelled = false;
    const bootstrapCourseStore = async () => {
      try {
        await courseStore.init();
        if (!cancelled) {
          courseInitKeyRef.current = targetKey;
        }
      } catch (error) {
        console.error('Failed to initialize course store:', error);
      }
    };
    void bootstrapCourseStore();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, orgResolutionStatus, user?.id, activeOrgId]);

  const location = useLocation();
  const hideMarketingChrome = /^\/(admin|lms|client)(?:\/|$)/i.test(location.pathname);

  return (
    <div className="flex min-h-[calc(var(--app-vh,1vh)*100)] flex-col bg-[var(--hud-bg)]" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
      {!hideMarketingChrome && (
        <>
          <Header />
          <DemoModeBanner />
        </>
      )}
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
                <Route path="/invite/:token" element={<InviteAccept />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/client-portal/org/:orgId/*" element={<OrgWorkspaceProtectedLayout />} />
                <Route path="/client/*" element={<ClientProtectedLayout />}>
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
                {/* Public auth routes */}
                <Route path="/login" element={<Navigate to="/lms/login" replace />} />
                <Route path="/lms/login" element={<LMSLogin />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/lms" element={<Navigate to="/lms/dashboard" replace />} />
                <Route path="/lms/*" element={<LmsProtectedLayout />}>
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
                <Route path="/admin/*" element={<AdminProtectedLayout />}>
                  <Route index element={<Navigate to="courses" replace />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="health" element={<AdminHealth />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="courses" element={<AdminCourses />} />
                  <Route path="courses/new" element={<AdminCourseNewPlaceholder />} />
                  <Route path="courses/import" element={<AdminCoursesImport />} />
                  <Route path="courses/bulk" element={<AdminCourseBulkPlaceholder />} />
                  <Route path="courses/:courseId/details" element={<AdminCourseDetail />} />
                  <Route path="courses/:courseId/edit" element={<AdminCourseEdit />} />
                  <Route path="courses/:courseId/assign" element={<AdminCourseAssign />} />
                  <Route path="courses/:courseId/settings" element={<AdminCourseSettings />} />
                  <Route path="course-builder/new" element={<AdminCourseBuilder />} />
                  <Route path="course-builder/:courseId" element={<AdminCourseBuilder />} />
                  <Route path="surveys" element={<AdminSurveys />} />
                  <Route path="surveys/builder" element={<AdminSurveyBuilder />} />
                  <Route path="surveys/analytics" element={<AdminSurveyAnalytics />} />
                  <Route path="surveys/queue" element={<AdminQueueMonitor />} />
                  <Route path="organizations" element={<AdminOrganizations />} />
                  <Route path="organizations/new" element={<AdminOrganizationCreate />} />
                  <Route path="organizations/:organizationId" element={<AdminOrganizationProfile />} />
                  <Route path="leadership" element={<AdminLeadershipInsights />} />
                  <Route path="profile" element={<AdminProfilePage />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="users/:userId" element={<AdminUserProfile />} />
                  <Route path="documents" element={<AdminDocuments />} />
                  <Route path="performance" element={<AdminPerformanceDashboard />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>
                {/* ...admin routes... */}
                <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </main>
      {!hideMarketingChrome && <Footer />}
      {!hideMarketingChrome && <AIBot />}
      <ConnectionDiagnostic />
      <TroubleshootingGuide />
      <DevDebugPanel />
    </div>
  );
}

export default App;
