import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, Suspense, lazy } from 'react';
// (removed duplicate import)
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
// New secure auth with server-side verification
import { SecureAuthProvider, useSecureAuth } from './context/SecureAuthContext';
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
const AdminCourseBuilder = lazy(() => import('./pages/Admin/AdminCourseBuilder'));
const ClientDashboard = lazy(() => import('./pages/Client/ClientDashboard'));
const ClientCourses = lazy(() => import('./pages/Client/ClientCourses'));
const ClientCourseDetail = lazy(() => import('./pages/Client/ClientCourseDetail'));
const ClientLessonView = lazy(() => import('./pages/Client/ClientLessonView'));
const ClientCourseCompletion = lazy(() => import('./pages/Client/ClientCourseCompletion'));
const ClientSurveys = lazy(() => import('./pages/Client/ClientSurveys'));
const ClientProfile = lazy(() => import('./pages/Client/ClientProfile'));
// Lazy load Admin components
// Explicit extension added to help Vite resolve the TSX module during dev HMR
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard.tsx'));
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
const AdminSurveysImport = lazy(() => import('./pages/Admin/AdminSurveysImport'));
const AdminCoursePreview = lazy(() => import('./pages/Admin/AdminCoursePreview'));
const AdminDocuments = lazy(() => import('./pages/Admin/AdminDocuments'));
const AdminUserProfile = lazy(() => import('./pages/Admin/AdminUserProfile'));
const AdminOrgProfile = lazy(() => import('./pages/Admin/AdminOrgProfile'));
const AdminResourceSender = lazy(() => import('./pages/Admin/AdminResourceSender'));
const AdminPerformanceDashboard = lazy(() => import('./pages/Admin/AdminPerformanceDashboard'));
const AdminCoursesImport = lazy(() => import('./pages/Admin/AdminCoursesImport'));
const AdminCoursesBulk = lazy(() => import('./pages/Admin/AdminCoursesBulk'));
const AdminCourseSettings = lazy(() => import('./pages/Admin/AdminCourseSettings'));
const AdminSurveysBulk = lazy(() => import('./pages/Admin/AdminSurveysBulk'));
const AdminQueueMonitor = lazy(() => import('./pages/Admin/AdminQueueMonitor'));
const AdminAICourseCreator = lazy(() => import('./pages/Admin/AdminAICourseCreator'));
const AdminWebpageEditor = lazy(() => import('./pages/Admin/AdminWebpageEditor'));
const AdminDashboardTest = lazy(() => import('./pages/Admin/AdminDashboardTest'));
const AdminAuthTest = lazy(() => import('./pages/Admin/AdminAuthTest'));
const EnhancedAdminPortal = lazy(() => import('./pages/Admin/EnhancedAdminPortal'));
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
            // Continue rendering even if course store fails - app should still work
        });
    }, []);
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60000,
                gcTime: 5 * 60000,
                retry: 2,
                refetchOnWindowFocus: false,
                // Suspense should be configured per-hook in React Query v5; remove from defaults
            }
        }
    });
    return (_jsx(ErrorBoundary, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(ToastProvider, { children: _jsx(SecureAuthProvider, { children: _jsx(AppWithAuthRoutes, {}) }) }) }) }));
}
function AppWithAuthRoutes() {
    const { authInitializing } = useSecureAuth();
    if (authInitializing) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-[var(--hud-bg)]", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" }), _jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Initializing authentication..." }), _jsx("p", { className: "text-gray-600", children: "Please wait while we check your authentication status." })] }) }));
    }
    return (_jsxs(Router, { children: [_jsxs("div", { className: "min-h-screen flex flex-col bg-[var(--hud-bg)]", children: [_jsx(Header, {}), _jsx(DemoModeBanner, {}), _jsx("main", { className: "flex-grow", children: _jsx(Suspense, { fallback: _jsx(LoadingSpinner, { size: "lg", className: "py-20", text: "Loading..." }), children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/about", element: _jsx(AboutPage, {}) }), _jsx(Route, { path: "/services", element: _jsx(ServicesPage, {}) }), _jsx(Route, { path: "/resources", element: _jsx(ResourcePage, {}) }), _jsx(Route, { path: "/testimonials", element: _jsx(TestimonialsPage, {}) }), _jsx(Route, { path: "/contact", element: _jsx(ContactPage, {}) }), _jsx(Route, { path: "/client-portal", element: _jsx(ClientPortalPage, {}) }), _jsxs(Route, { path: "/client-portal/org/:orgId/*", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(OrgWorkspaceLayout, {}) }), children: [_jsx(Route, { path: "strategic-plans", element: _jsx(StrategicPlansPage, {}) }), _jsx(Route, { path: "session-notes", element: _jsx(SessionNotesPage, {}) }), _jsx(Route, { path: "action-tracker", element: _jsx(ActionTrackerPage, {}) }), _jsx(Route, { path: "documents", element: _jsx(DocumentsPage, {}) }), _jsx(Route, { path: "", element: _jsx(StrategicPlansPage, {}) })] }), _jsx(Route, { path: "/client", element: _jsx(Navigate, { to: "/client/dashboard", replace: true }) }), _jsx(Route, { path: "/client/dashboard", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(ClientDashboard, {}) }) }), _jsx(Route, { path: "/client/courses", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(ClientCourses, {}) }) }), _jsx(Route, { path: "/client/courses/:courseId", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(ClientCourseDetail, {}) }) }), _jsx(Route, { path: "/client/courses/:courseId/lessons/:lessonId", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(ClientLessonView, {}) }) }), _jsx(Route, { path: "/client/courses/:courseId/completion", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(ClientCourseCompletion, {}) }) }), _jsx(Route, { path: "/client/surveys", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(ClientSurveys, {}) }) }), _jsx(Route, { path: "/client/profile", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(ClientProfile, {}) }) }), _jsx(Route, { path: "/lms/login", element: _jsx(LMSLogin, {}) }), _jsx(Route, { path: "/lms", element: _jsx(Navigate, { to: "/lms/dashboard", replace: true }) }), _jsx(Route, { path: "/lms/*", element: _jsx(RequireAuth, { mode: "lms", children: _jsx(LMSLayout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "dashboard", element: _jsx(LearnerDashboard, {}) }), _jsx(Route, { path: "courses", element: _jsx(LMSCourses, {}) }), _jsx(Route, { path: "course/:courseId", element: _jsx(CoursePlayer, {}) }), _jsx(Route, { path: "course/:courseId/lesson/:lessonId", element: _jsx(CoursePlayer, {}) }), _jsx(Route, { path: "module/:moduleId", element: _jsx(ErrorBoundary, { children: _jsx(LMSModule, {}) }) }), _jsx(Route, { path: "downloads", element: _jsx(LMSDownloads, {}) }), _jsx(Route, { path: "feedback", element: _jsx(LMSFeedback, {}) }), _jsx(Route, { path: "contact", element: _jsx(LMSContact, {}) }), _jsx(Route, { path: "settings", element: _jsx(LMSSettings, {}) }), _jsx(Route, { path: "certificates", element: _jsx(LMSCertificates, {}) }), _jsx(Route, { path: "progress", element: _jsx(ErrorBoundary, { children: _jsx(LMSProgress, {}) }) }), _jsx(Route, { path: "help", element: _jsx(LMSHelp, {}) }), _jsx(Route, { path: "*", element: _jsx(NotFound, {}) })] }) }) }) }), _jsx(Route, { path: "/admin/login", element: _jsx(AdminLogin, {}) }), _jsx(Route, { path: "/admin", element: _jsx(Navigate, { to: "/admin/dashboard", replace: true }) }), _jsx(Route, { path: "/admin/*", element: _jsx(RequireAuth, { mode: "admin", children: _jsx(AdminLayout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "dashboard", element: _jsx(ErrorBoundary, { children: _jsx(AdminDashboard, {}) }) }), _jsx(Route, { path: "users", element: _jsx(ErrorBoundary, { children: _jsx(AdminUsers, {}) }) }), _jsx(Route, { path: "users/:userId", element: _jsx(AdminUserProfile, {}) }), _jsx(Route, { path: "organizations", element: _jsx(ErrorBoundary, { children: _jsx(AdminOrganizations, {}) }) }), _jsx(Route, { path: "organizations/new", element: _jsx(AdminOrganizationNew, {}) }), _jsx(Route, { path: "organizations/:id", element: _jsx(OrganizationDetails, {}) }), _jsx(Route, { path: "org-profiles/:orgProfileId", element: _jsx(AdminOrgProfile, {}) }), _jsx(Route, { path: "send-resource", element: _jsx(AdminResourceSender, {}) }), _jsx(Route, { path: "courses", element: _jsx(ErrorBoundary, { children: _jsx(AdminCourses, {}) }) }), _jsx(Route, { path: "courses/import", element: _jsx(AdminCoursesImport, {}) }), _jsx(Route, { path: "courses/bulk", element: _jsx(AdminCoursesBulk, {}) }), _jsx(Route, { path: "courses/new", element: _jsx(AdminCourseCreate, {}) }), _jsx(Route, { path: "courses/:courseId/edit", element: _jsx(AdminCourseEdit, {}) }), _jsx(Route, { path: "courses/:courseId/assign", element: _jsx(AdminCourseAssign, {}) }), _jsx(Route, { path: "courses/:courseId/settings", element: _jsx(AdminCourseSettings, {}) }), _jsx(Route, { path: "courses/:courseId/preview", element: _jsx(AdminCoursePreview, {}) }), _jsx(Route, { path: "reports", element: _jsx(AdminReports, {}) }), _jsx(Route, { path: "analytics", element: _jsx(AdminAnalytics, {}) }), _jsx(Route, { path: "performance", element: _jsx(AdminPerformanceDashboard, {}) }), _jsx(Route, { path: "certificates", element: _jsx(AdminCertificates, {}) }), _jsx(Route, { path: "integrations", element: _jsx(AdminIntegrations, {}) }), _jsx(Route, { path: "integrations/:integrationId", element: _jsx(AdminIntegrationConfig, {}) }), _jsx(Route, { path: "surveys", element: _jsx(AdminSurveys, {}) }), _jsx(Route, { path: "surveys/bulk", element: _jsx(AdminSurveysBulk, {}) }), _jsx(Route, { path: "surveys/new", element: _jsx(AdminSurveyBuilder, {}) }), _jsx(Route, { path: "surveys/:surveyId/edit", element: _jsx(AdminSurveyBuilder, {}) }), _jsx(Route, { path: "surveys/import", element: _jsx(AdminSurveysImport, {}) }), _jsx(Route, { path: "surveys/queue", element: _jsx(AdminQueueMonitor, {}) }), _jsx(Route, { path: "surveys/builder", element: _jsx(AdminSurveyBuilder, {}) }), _jsx(Route, { path: "surveys/builder/:surveyId", element: _jsx(AdminSurveyBuilder, {}) }), _jsx(Route, { path: "surveys/:surveyId/analytics", element: _jsx(AdminSurveyAnalytics, {}) }), _jsx(Route, { path: "surveys/:surveyId/preview", element: _jsx(AdminSurveyBuilder, {}) }), _jsx(Route, { path: "course-builder/new", element: _jsx(AdminCourseBuilder, {}) }), _jsx(Route, { path: "course-builder/:courseId", element: _jsx(AdminCourseBuilder, {}) }), _jsx(Route, { path: "courses/:courseId/details", element: _jsx(AdminCourseDetail, {}) }), _jsx(Route, { path: "documents", element: _jsx(ErrorBoundary, { children: _jsx(AdminDocuments, {}) }) }), _jsx(Route, { path: "ai/course-creator", element: _jsx(AdminAICourseCreator, {}) }), _jsx(Route, { path: "webpage-editor", element: _jsx(AdminWebpageEditor, {}) }), _jsx(Route, { path: "dashboard-test", element: _jsx(AdminDashboardTest, {}) }), _jsx(Route, { path: "auth-test", element: _jsx(AdminAuthTest, {}) }), _jsx(Route, { path: "enhanced", element: _jsx(EnhancedAdminPortal, {}) }), _jsx(Route, { path: "settings", element: _jsx(AdminSettings, {}) }), _jsx(Route, { path: "*", element: _jsx(NotFound, {}) })] }) }) }) }), _jsx(Route, { path: "/unauthorized", element: _jsx(Unauthorized, {}) }), _jsx(Route, { path: "*", element: _jsx(NotFound, {}) })] }) }) }), _jsx(Footer, {}), _jsx(AIBot, {}), _jsx(ConnectionDiagnostic, {}), _jsx(TroubleshootingGuide, {})] }), _jsx(Toaster, { position: "top-right", toastOptions: {
                    duration: 4000,
                    style: {
                        background: '#1E1E1E',
                        color: '#fff',
                    },
                    success: {
                        duration: 3000,
                        iconTheme: {
                            primary: '#228B22',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        duration: 5000,
                        iconTheme: {
                            primary: '#D72638',
                            secondary: '#fff',
                        },
                    },
                } })] }));
}
export default App;
