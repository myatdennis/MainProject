import { useEffect, Suspense, lazy, useRef, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
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
import ClientRequireAuth from './components/routing/ClientRequireAuth';
import DevDebugPanel from './components/DevDebugPanel';
import { useSecureAuth } from './context/SecureAuthContext';
import ToastContext from './context/ToastContext';

// Import components used in routes/layout
import OrgWorkspaceLayout from './components/OrgWorkspace/OrgWorkspaceLayout';
import ClientDashboard from './pages/Client/ClientDashboard';
import ClientCourses from './pages/Client/ClientCourses';
import ClientCourseDetail from './pages/Client/ClientCourseDetail';
import ClientLessonView from './pages/Client/ClientLessonView';
import ClientCourseCompletion from './pages/Client/ClientCourseCompletion';
import ClientSurveys from './pages/Client/ClientSurveys';
import ClientDocuments from './pages/Client/DocumentsPage';
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
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const AdminHealth = lazy(() => import('./pages/Admin/AdminHealth'));
const AdminCourses = lazy(() => import('./pages/Admin/AdminCourses'));
const AdminCourseBuilder = lazy(() => import('./pages/Admin/AdminCourseBuilder'));
const AdminCourseDetail = lazy(() => import('./pages/Admin/AdminCourseDetail'));
const AdminCourseEdit = lazy(() => import('./pages/Admin/AdminCourseEdit'));
const AdminCourseAssign = lazy(() => import('./pages/Admin/AdminCourseAssign'));
const AdminCourseSettings = lazy(() => import('./pages/Admin/AdminCourseSettings'));
const AdminSurveys = lazy(() => import('./pages/Admin/AdminSurveys'));
const AdminAnalytics = lazy(() => import('./pages/Admin/AdminAnalytics'));
const AdminSurveyBuilder = lazy(() => import('./pages/Admin/AdminSurveyBuilder'));
const AdminSurveyAnalytics = lazy(() => import('./pages/Admin/AdminSurveyAnalytics'));
const AdminSurveyPreview = lazy(() => import('./pages/Admin/AdminSurveyPreview'));
const AdminSurveysImport = lazy(() => import('./pages/Admin/AdminSurveysImport'));
const AdminSurveysBulk = lazy(() => import('./pages/Admin/AdminSurveysBulk'));
const AdminOrganizations = lazy(() => import('./pages/Admin/AdminOrganizations'));
const AdminOrganizationProfile = lazy(() => import('./pages/Admin/AdminOrganizationProfile'));
const AdminOrganizationCreate = lazy(() => import('./pages/Admin/AdminOrganizationNew'));
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers'));
const AdminUserProfile = lazy(() => import('./pages/Admin/AdminUserProfile'));
const AdminDocuments = lazy(() => import('./pages/Admin/AdminDocuments'));
const AdminPerformanceDashboard = lazy(() => import('./pages/Admin/AdminPerformanceDashboard'));
const AdminSettings = lazy(() => import('./pages/Admin/AdminSettings'));
const AdminQueueMonitor = lazy(() => import('./pages/Admin/AdminQueueMonitor'));
const AdminLeadershipInsights = lazy(() => import('./pages/Admin/AdminLeadershipInsights'));
const AdminProfilePage = lazy(() => import('./pages/Admin/AdminProfilePage'));
const AdminLayout = lazy(() => import('./components/Admin/AdminLayout'));
const AdminCRM = lazy(() => import('./pages/Admin/AdminCRM'));
const AdminCoursesImport = lazy(() => import('./pages/Admin/AdminCoursesImport'));
const AdminCourseBulkPlaceholder = lazy(() => import('./pages/Admin/Course/AdminCourseBulkPlaceholder'));
const AdminCourseNewPlaceholder = lazy(() => import('./pages/Admin/Course/AdminCourseNewPlaceholder'));
const AdminOrgProfile = lazy(() => import('./pages/Admin/AdminOrgProfile'));
const AdminReports = lazy(() => import('./pages/Admin/AdminReports'));
const AdminIntegrations = lazy(() => import('./pages/Admin/AdminIntegrations'));
const AdminIntegrationConfig = lazy(() => import('./pages/Admin/AdminIntegrationConfig'));
const AdminCertificates = lazy(() => import('./pages/Admin/AdminCertificates'));

const AdminProtectedLayout = () => (
  <RequireAuth mode="admin">
    <AdminLayout />
  </RequireAuth>
);

const LmsProtectedLayout = () => (
  <RequireAuth mode="lms" loginPathOverride="/login">
    <LMSLayout />
  </RequireAuth>
);

const ClientProtectedLayout = () => (
  <ClientRequireAuth>
    <ClientLayout />
  </ClientRequireAuth>
);

const OrgWorkspaceProtectedLayout = () => (
  <RequireAuth mode="lms" loginPathOverride="/login">
    <OrgWorkspaceLayout />
  </RequireAuth>
);

const LegacyCourseRedirect = () => {
  const location = useLocation();
  const targetPath =
    location.pathname && location.pathname.startsWith('/courses')
      ? `/lms${location.pathname}`
      : '/lms/courses';
  return <Navigate to={{ pathname: targetPath, search: location.search, hash: location.hash }} replace />;
};

/**
 * Redirects the legacy singular-form lesson URL to the canonical plural form.
 * e.g. /lms/course/:courseId/lesson/:lessonId → /lms/courses/:courseId/lesson/:lessonId
 * This ensures stale deep-links (from emails, notifications, analytics) still work.
 */
const LmsLessonCanonicalRedirect = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: `/lms/courses/${courseId}/lesson/${lessonId}`, search: location.search, hash: location.hash }}
      replace
    />
  );
};


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
  const toastContext = useContext(ToastContext);
  const showCatalogToast = toastContext?.showToast;
  const courseInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof showCatalogToast !== 'function') {
      return;
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      const eventType = typeof detail.event === 'string' ? detail.event : 'unknown';
      let message = 'We are reconnecting to your course catalog.';
      if (eventType === 'assignment_scope_failed') {
        message = 'We hit a snag loading your assignments. Showing cached data while we retry.';
      } else if (eventType === 'assignment_scope_empty') {
        message = 'No assignments were returned for this workspace. Cached courses are still available.';
      } else if (eventType === 'default_catalog_loaded') {
        message = 'Showing the demo course catalog while we reconnect. Please refresh soon.';
      }
      showCatalogToast(message, eventType === 'assignment_scope_failed' ? 'error' : 'warning', 6000);
    };
    window.addEventListener('huddle:catalog-warning', handler as EventListener);
    return () => {
      window.removeEventListener('huddle:catalog-warning', handler as EventListener);
    };
  }, [showCatalogToast]);

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
        {/*
          Per-section Suspense + ErrorBoundary isolation:
          A chunk-load failure in the admin portal will not blank the LMS or
          marketing pages, and vice-versa.  Statically-imported routes (Home,
          Login, LMS pages) don't need a Suspense at all.
        */}
        <Routes>
          {/* ── Marketing / public ─────────────────────────────────────── */}
          <Route path="/" element={<HomePage />} />
          <Route
            path="/about"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
                <ErrorBoundary>
                  <AboutPage />
                </ErrorBoundary>
              </Suspense>
            }
          />
          <Route
            path="/services"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
                <ErrorBoundary>
                  <ServicesPage />
                </ErrorBoundary>
              </Suspense>
            }
          />
          <Route
            path="/resources"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
                <ErrorBoundary>
                  <ResourcePage />
                </ErrorBoundary>
              </Suspense>
            }
          />
          <Route
            path="/testimonials"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
                <ErrorBoundary>
                  <TestimonialsPage />
                </ErrorBoundary>
              </Suspense>
            }
          />
          <Route
            path="/contact"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
                <ErrorBoundary>
                  <ContactPage />
                </ErrorBoundary>
              </Suspense>
            }
          />
          <Route
            path="/client-portal"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
                <ErrorBoundary>
                  <ClientPortalPage />
                </ErrorBoundary>
              </Suspense>
            }
          />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/unauthorized"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading..." />}>
                <ErrorBoundary>
                  <Unauthorized />
                </ErrorBoundary>
              </Suspense>
            }
          />
          <Route path="/client-portal/org/:orgId/*" element={<OrgWorkspaceProtectedLayout />} />

          {/* ── Client portal ──────────────────────────────────────────── */}
          <Route path="/client/*" element={<ClientProtectedLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ClientDashboard />} />
            <Route path="courses" element={<ClientCourses />} />
            <Route path="courses/:courseId" element={<ClientCourseDetail />} />
            <Route path="courses/:courseId/lessons/:lessonId" element={<ClientLessonView />} />
            <Route path="courses/:courseId/completion" element={<ClientCourseCompletion />} />
            <Route path="surveys" element={<ClientSurveys />} />
            <Route path="documents" element={<ClientDocuments />} />
            <Route path="profile" element={<ClientProfile />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ── Public auth ────────────────────────────────────────────── */}
          <Route path="/login" element={<LMSLogin />} />
          <Route path="/lms/login" element={<Navigate to="/login" replace />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/courses/*" element={<LegacyCourseRedirect />} />

          {/* ── LMS portal ─────────────────────────────────────────────── */}
          {/*
            Isolated Suspense + ErrorBoundary: a chunk-load failure inside
            the LMS sub-tree will not affect the admin portal or marketing pages.
          */}
          <Route path="/lms" element={<Navigate to="/lms/dashboard" replace />} />
          <Route
            path="/lms/*"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading LMS..." />}>
                <ErrorBoundary>
                  <LmsProtectedLayout />
                </ErrorBoundary>
              </Suspense>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<LMSDashboard />} />
            <Route path="courses" element={<LMSCourses />} />
            <Route path="courses/:courseId" element={<LMSModule />} />
            <Route path="course/:courseId" element={<LMSModule />} />
            <Route path="module/:moduleId" element={<LMSModule />} />
            {/* Canonical lesson URL — always use the plural "courses" form */}
            <Route path="courses/:courseId/lesson/:lessonId" element={<LMSLessonView />} />
            {/*
              Legacy singular "course" form — redirect to canonical URL.
              Keeps stale deep-links (email notifications, analytics, external
              bookmarks) working without silently serving two active routes.
            */}
            <Route path="course/:courseId/lesson/:lessonId" element={<LmsLessonCanonicalRedirect />} />
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

          {/* ── Admin portal ────────────────────────────────────────────── */}
          {/*
            Isolated Suspense + ErrorBoundary: a chunk-load failure inside
            the admin sub-tree will not affect the LMS or marketing pages.
          */}
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<LoadingSpinner size="lg" className="py-20" text="Loading Admin..." />}>
                <ErrorBoundary>
                  <AdminProtectedLayout />
                </ErrorBoundary>
              </Suspense>
            }
          >
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
            <Route path="surveys/builder/:surveyId" element={<AdminSurveyBuilder />} />
            <Route path="surveys/analytics" element={<AdminSurveyAnalytics />} />
            <Route path="surveys/:surveyId/analytics" element={<AdminSurveyAnalytics />} />
            <Route path="surveys/:surveyId/preview" element={<AdminSurveyPreview />} />
            <Route path="surveys/import" element={<AdminSurveysImport />} />
            <Route path="surveys/bulk" element={<AdminSurveysBulk />} />
            <Route path="surveys/queue" element={<AdminQueueMonitor />} />
            <Route path="organizations" element={<AdminOrganizations />} />
            <Route path="organizations/new" element={<AdminOrganizationCreate />} />
            <Route path="organizations/:organizationId" element={<AdminOrganizationProfile />} />
            <Route path="org-profiles/:orgProfileId" element={<AdminOrgProfile />} />
            <Route path="crm" element={<AdminCRM />} />
            <Route path="leadership" element={<AdminLeadershipInsights />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:userId" element={<AdminUserProfile />} />
            <Route path="documents" element={<AdminDocuments />} />
            <Route path="performance" element={<AdminPerformanceDashboard />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="integrations" element={<AdminIntegrations />} />
            <Route path="integrations/:integrationId" element={<AdminIntegrationConfig />} />
            <Route path="certificates" element={<AdminCertificates />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!hideMarketingChrome && <Footer />}
      {!hideMarketingChrome && <AIBot />}
      {import.meta.env.DEV && <ConnectionDiagnostic />}
      {import.meta.env.DEV && <TroubleshootingGuide />}
      {import.meta.env.DEV && <DevDebugPanel />}
    </div>
  );
}

export default App;
