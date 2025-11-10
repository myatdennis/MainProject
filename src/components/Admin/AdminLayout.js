import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorHandling';
import AdminErrorBoundary from '../ErrorBoundary/AdminErrorBoundary';
import { useAuth } from '../../context/AuthContext';
import { Shield, Menu, X, LogOut, Bell, Search, Plus, BookOpen, BarChart3, TrendingUp, Settings, ClipboardList, FileText, } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: TrendingUp },
    { name: 'Courses', href: '/admin/courses', icon: BookOpen },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Surveys', href: '/admin/surveys', icon: ClipboardList },
    { name: 'Documents', href: '/admin/documents', icon: FileText },
    { name: 'Performance', href: '/admin/performance', icon: TrendingUp },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
];
const AdminLayout = ({ children }) => {
    const { isAuthenticated, user, authInitializing, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (authInitializing)
            return;
        if (!isAuthenticated?.admin && location.pathname !== '/admin/login') {
            navigate('/admin/login');
        }
    }, [authInitializing, isAuthenticated?.admin, location.pathname, navigate]);
    const isActive = (href) => {
        if (href === '/admin/dashboard') {
            return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
        }
        return location.pathname.startsWith(href);
    };
    const handleLogout = async () => {
        await logout('admin');
        navigate('/admin/login');
    };
    if (authInitializing || isAuthenticated?.admin === undefined) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-softwhite", children: _jsx(LoadingSpinner, { size: "lg" }) }));
    }
    if (!isAuthenticated?.admin) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-softwhite text-sm text-slate/80", children: "Checking admin access\u2026" }));
    }
    const content = (_jsxs("div", { className: "flex min-h-screen bg-softwhite", children: [sidebarOpen && (_jsx("div", { className: "fixed inset-0 z-40 bg-charcoal/40 backdrop-blur lg:hidden", onClick: () => setSidebarOpen(false) })), _jsxs("aside", { className: `fixed inset-y-0 left-0 z-50 w-[280px] transform bg-white shadow-[0_24px_60px_rgba(16,24,40,0.12)] transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`, children: [_jsxs("div", { className: "flex items-center justify-between border-b border-mist/70 px-6 py-6", children: [_jsxs(Link, { to: "/", className: "flex items-center gap-3 no-underline", children: [_jsx("span", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white", children: _jsx(Shield, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-heading text-lg font-bold text-charcoal", children: "Admin Portal" }), _jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.35em] text-slate/70", children: "The Huddle Co." })] })] }), _jsx("button", { className: "lg:hidden", onClick: () => setSidebarOpen(false), children: _jsx(X, { className: "h-5 w-5 text-slate/70" }) })] }), _jsxs("div", { className: "flex h-full flex-col justify-between px-6 py-6", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { tone: "muted", className: "space-y-3", children: [_jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: "System Online" }), _jsxs("div", { children: [_jsxs("p", { className: "font-heading text-lg font-semibold text-charcoal", children: ["Welcome, ", user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' : 'Admin'] }), _jsx("p", { className: "text-xs text-slate/70", children: user?.role || 'Admin & Facilitator' })] })] }), _jsx("nav", { className: "space-y-2", children: navigation.map((item) => {
                                            const Icon = item.icon;
                                            const active = isActive(item.href);
                                            return (_jsxs(Link, { to: item.href, onClick: () => setSidebarOpen(false), className: `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${active
                                                    ? 'bg-gradient-to-r from-sunrise/90 to-skyblue/90 text-white shadow-card-sm'
                                                    : 'text-slate/80 hover:bg-cloud hover:text-skyblue'}`, children: [_jsx("span", { className: `flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-white/20 text-white' : 'bg-cloud text-slate'}`, children: _jsx(Icon, { className: "h-4 w-4" }) }), item.name] }, item.name));
                                        }) }), _jsxs(Card, { tone: "muted", className: "space-y-3", children: [_jsx("p", { className: "font-heading text-sm font-semibold text-charcoal", children: "Quick actions" }), _jsx(Button, { asChild: true, size: "sm", variant: "secondary", leadingIcon: _jsx(Plus, { className: "h-4 w-4" }), children: _jsx(Link, { to: "/admin/courses/new", children: "Create course" }) }), _jsx(Button, { asChild: true, size: "sm", variant: "ghost", leadingIcon: _jsx(ClipboardList, { className: "h-4 w-4" }), children: _jsx(Link, { to: "/admin/courses/import", children: "Import courses" }) }), _jsx(Button, { asChild: true, size: "sm", variant: "ghost", leadingIcon: _jsx(Bell, { className: "h-4 w-4" }), children: _jsx(Link, { to: "/admin/surveys/queue", children: "Survey queue" }) })] })] }), _jsx(Button, { variant: "ghost", className: "w-full justify-center", leadingIcon: _jsx(LogOut, { className: "h-4 w-4" }), onClick: handleLogout, children: "Logout" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col", children: [_jsx("header", { className: "sticky top-0 z-30 border-b border-mist/60 bg-white/90 backdrop-blur", children: _jsxs("div", { className: "flex h-20 items-center justify-between px-6 lg:px-10", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { className: "text-slate/70 hover:text-sunrise lg:hidden", onClick: () => setSidebarOpen(true), children: _jsx(Menu, { className: "h-6 w-6" }) }), _jsxs("div", { className: "relative hidden items-center rounded-full border border-mist bg-white px-4 py-2 text-sm text-slate/70 shadow-sm lg:flex", children: [_jsx(Search, { className: "mr-2 h-4 w-4" }), _jsx(Input, { placeholder: "Search reports, orgs, or learners", className: "border-none p-0 text-sm text-charcoal focus-visible:ring-0" })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { variant: "ghost", size: "sm", leadingIcon: _jsx(Bell, { className: "h-4 w-4" }), children: "Alerts" }), _jsx(Button, { variant: "secondary", size: "sm", leadingIcon: _jsx(ClipboardList, { className: "h-4 w-4" }), onClick: () => navigate('/admin/surveys/builder'), children: "New survey" })] })] }) }), _jsx("main", { className: "flex-1 overflow-y-auto bg-softwhite px-6 py-8 lg:px-12", children: children ?? _jsx(Outlet, {}) })] })] }));
    return (_jsx(ErrorBoundary, { children: _jsx(AdminErrorBoundary, { children: content }) }));
};
export default AdminLayout;
