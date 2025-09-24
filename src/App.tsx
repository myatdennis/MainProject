import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { courseStore } from './store/courseStore';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ResourcePage from './pages/ResourcePage';
import TestimonialsPage from './pages/TestimonialsPage';
import ContactPage from './pages/ContactPage';
import ClientPortalPage from './pages/ClientPortalPage';
import LMSDashboard from './pages/LMS/LMSDashboard';
import LMSCourses from './pages/LMS/LMSCourses';
import LMSModule from './pages/LMS/LMSModule';
import LMSDownloads from './pages/LMS/LMSDownloads';
import LMSFeedback from './pages/LMS/LMSFeedback';
import LMSContact from './pages/LMS/LMSContact';
import LMSLogin from './pages/LMS/LMSLogin';
import LMSLayout from './components/LMS/LMSLayout';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminOrganizations from './pages/Admin/AdminOrganizations';
import AdminOrganizationProfile from './pages/Admin/AdminOrganizationProfile';
import AdminCourses from './pages/Admin/AdminCourses';
import AdminReports from './pages/Admin/AdminReports';
import AdminSettings from './pages/Admin/AdminSettings';
import AdminLayout from './components/Admin/AdminLayout';
import AdminAnalytics from './pages/Admin/AdminAnalytics';
import AdminCertificates from './pages/Admin/AdminCertificates';
import AdminIntegrations from './pages/Admin/AdminIntegrations';
import AdminCourseBuilder from './pages/Admin/AdminCourseBuilder';
import AdminCourseDetail from './pages/Admin/AdminCourseDetail';
import AdminSurveys from './pages/Admin/AdminSurveys';
import AdminSurveyBuilder from './pages/Admin/AdminSurveyBuilder';
import AdminSurveyAnalytics from './pages/Admin/AdminSurveyAnalytics';
import AdminDocuments from './pages/Admin/AdminDocuments';
import AdminUserProfile from './pages/Admin/AdminUserProfile';
import AdminOrgProfile from './pages/Admin/AdminOrgProfile';
import AdminResourceSender from './pages/Admin/AdminResourceSender';
import AIBot from './components/AIBot/AIBot';
import OrgWorkspaceLayout from './components/OrgWorkspace/OrgWorkspaceLayout';
import StrategicPlansPage from './components/OrgWorkspace/StrategicPlansPage';
import SessionNotesPage from './components/OrgWorkspace/SessionNotesPage';
import ActionTrackerPage from './components/OrgWorkspace/ActionTrackerPage';
import SurveysPage from './components/OrgWorkspace/SurveysPage';
import DocumentsPage from './pages/Client/DocumentsPage';

function App() {
  useEffect(() => {
    // Initialize course store and sync default courses to database
    courseStore.init().catch(error => {
      console.error('Failed to initialize course store:', error);
    });
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-white">
          <Header />
          <main className="flex-grow">
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
                <Route path="surveys" element={<SurveysPage />} />
                <Route path="strategic-plans" element={<StrategicPlansPage />} />
                <Route path="session-notes" element={<SessionNotesPage />} />
                <Route path="action-tracker" element={<ActionTrackerPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="" element={<SurveysPage />} />
              </Route>
              <Route path="/lms/login" element={<LMSLogin />} />
              <Route path="/lms" element={<Navigate to="/lms/dashboard" replace />} />
              <Route path="/lms/*" element={
                <LMSLayout>
                  <Routes>
                    <Route path="dashboard" element={<LMSDashboard />} />
                    <Route path="courses" element={<LMSCourses />} />
                    <Route path="module/:moduleId" element={<LMSModule />} />
                    <Route path="downloads" element={<LMSDownloads />} />
                    <Route path="feedback" element={<LMSFeedback />} />
                    <Route path="contact" element={<LMSContact />} />
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
                    <Route path="organizations/:orgId" element={<AdminOrganizationProfile />} />
                    <Route path="org-profiles/:orgProfileId" element={<AdminOrgProfile />} />
                    <Route path="send-resource" element={<AdminResourceSender />} />
                    <Route path="courses" element={<AdminCourses />} />
                    <Route path="reports" element={<AdminReports />} />
                    <Route path="analytics" element={<AdminAnalytics />} />
                    <Route path="certificates" element={<AdminCertificates />} />
                    <Route path="integrations" element={<AdminIntegrations />} />
                    <Route path="surveys" element={<AdminSurveys />} />
                    <Route path="surveys/builder" element={<AdminSurveyBuilder />} />
                    <Route path="surveys/builder/:surveyId" element={<AdminSurveyBuilder />} />
                    <Route path="surveys/:surveyId/analytics" element={<AdminSurveyAnalytics />} />
                    <Route path="surveys/:surveyId/preview" element={<AdminSurveyBuilder />} />
                    <Route path="course-builder/:courseId" element={<AdminCourseBuilder />} />
                    <Route path="courses/:courseId/details" element={<AdminCourseDetail />} />
                    <Route path="documents" element={<AdminDocuments />} />
                    <Route path="settings" element={<AdminSettings />} />
                  </Routes>
                </AdminLayout>
              } />
            </Routes>
          </main>
          <Footer />
          <AIBot />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;