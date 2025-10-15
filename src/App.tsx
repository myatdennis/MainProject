import { useEffect, Suspense, lazy } from 'react';
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
import useIdleRender from './hooks/useIdleRender';

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
const AdminCourseDetail = lazy(() => import('./pages/Admin/AdminCourseDetail'));
const AdminSurveys = lazy(() => import('./pages/Admin/AdminSurveys'));
const AdminSurveyBuilder = lazy(() => import('./pages/Admin/AdminSurveyBuilder'));
const AdminSurveyAnalytics = lazy(() => import('./pages/Admin/AdminSurveyAnalytics'));
const AdminDocuments = lazy(() => import('./pages/Admin/AdminDocuments'));
const AdminUserProfile = lazy(() => import('./pages/Admin/AdminUserProfile'));
const AdminOrgProfile = lazy(() => import('./pages/Admin/AdminOrgProfile'));
const AdminResourceSender = lazy(() => import('./pages/Admin/AdminResourceSender'));
const AdminPerformanceDashboard = lazy(() => import('./pages/Admin/AdminPerformanceDashboard'));

// Lazy load additional components
const AIBot = lazy(() => import('./components/AIBot/AIBot'));
const ConnectionDiagnostic = lazy(() => import('./components/ConnectionDiagnostic'));
const TroubleshootingGuide = lazy(() => import('./components/TroubleshootingGuide'));
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

  const canRenderDeferredWidgets = useIdleRender({ timeout: 1800, minDelay: 200 });

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
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
                <OrgWorkspaceLayout />
              }>
                <Route path="strategic-plans" element={<StrategicPlansPage />} />
                <Route path="session-notes" element={<SessionNotesPage />} />
                <Route path="action-tracker" element={<ActionTrackerPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="" element={<StrategicPlansPage />} />
              </Route>
              <Route path="/lms/login" element={<LMSLogin />} />
              <Route path="/lms" element={<Navigate to="/lms/dashboard" replace />} />
              <Route path="/lms/*" element={
                <LMSLayout>
                  <Routes>
                    <Route path="dashboard" element={<LearnerDashboard />} />
                    <Route path="courses" element={<LMSCourses />} />
                    <Route path="course/:courseId" element={<CoursePlayer />} />
                    <Route path="course/:courseId/lesson/:lessonId" element={<CoursePlayer />} />
                    <Route path="module/:moduleId" element={<LMSModule />} />
                    <Route path="downloads" element={<LMSDownloads />} />
                    <Route path="feedback" element={<LMSFeedback />} />
                    <Route path="contact" element={<LMSContact />} />
                    <Route path="settings" element={<LMSSettings />} />
                    <Route path="certificates" element={<LMSCertificates />} />
                    <Route path="progress" element={<LMSProgress />} />
                    <Route path="help" element={<LMSHelp />} />
                  </Routes>
                </LMSLayout>
              } />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/*" element={
                <AdminLayout>
                  <Routes>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="users/:userId" element={<AdminUserProfile />} />
                    <Route path="organizations" element={<AdminOrganizations />} />
                    <Route path="organizations/new" element={<AdminOrganizationNew />} />
                    <Route path="organizations/:id" element={<OrganizationDetails />} />
                    <Route path="org-profiles/:orgProfileId" element={<AdminOrgProfile />} />
                    <Route path="send-resource" element={<AdminResourceSender />} />
                    <Route path="courses" element={<AdminCourses />} />
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
                    <Route path="documents" element={<AdminDocuments />} />
                    <Route path="settings" element={<AdminSettings />} />
                  </Routes>
                </AdminLayout>
              } />
                </Routes>
              </Suspense>
            </main>
            <Footer />
            {canRenderDeferredWidgets && (
              <Suspense fallback={null}>
                <AIBot />
                <ConnectionDiagnostic />
                <TroubleshootingGuide />
              </Suspense>
            )}
          </div>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </Router>
      </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;