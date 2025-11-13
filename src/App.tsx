import { useEffect, Suspense, lazy } from 'react';
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
// (removed duplicate import)
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { courseStore } from './store/courseStore';
import { LoadingSpinner } from './components/LoadingComponents';
import { ErrorBoundary } from './components/ErrorHandling';
import Header from './components/Header';
import Footer from './components/Footer';
import DemoModeBanner from './components/DemoModeBanner';
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
import NotFound from './pages/NotFound';
import AIBot from './components/AIBot/AIBot';

import HomePage from './pages/HomePage';
import LMSLogin from './pages/LMS/LMSLogin';
import AdminLogin from './pages/Admin/AdminLogin';

const AboutPage = lazy(() => import('./pages/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ResourcePage = lazy(() => import('./pages/ResourcePage'));
const TestimonialsPage = lazy(() => import('./pages/TestimonialsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ClientPortalPage = lazy(() => import('./pages/ClientPortalPage'));


function App() {
  useEffect(() => {
    // Initialize course store and sync default courses to database
    courseStore.init().catch(error => {
      console.error('Failed to initialize course store:', error);
    });
  }, []);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[var(--hud-bg)]">
        <Header />
        <DemoModeBanner />
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
                <Route path="/lms/*" element={<RequireAuth mode="lms"><LMSLayout><></></LMSLayout></RequireAuth>} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/dashboard" element={
                  <RequireAuth mode="admin">
                    <Suspense fallback={<LoadingSpinner size="lg" text="Loading..." />}>
                      <AdminDashboard />
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
