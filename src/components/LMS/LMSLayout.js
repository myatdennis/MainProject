import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, TrendingUp, Award, Download, MessageSquare, Phone, Settings, HelpCircle, Menu, X, Users, LogOut, } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
const navigation = [
    { name: 'Dashboard', href: '/lms/dashboard', icon: LayoutDashboard },
    { name: 'My Courses', href: '/lms/courses', icon: BookOpen },
    { name: 'Progress', href: '/lms/progress', icon: TrendingUp },
    { name: 'Certificates', href: '/lms/certificates', icon: Award },
    { name: 'Downloads', href: '/lms/downloads', icon: Download },
    { name: 'Submit Feedback', href: '/lms/feedback', icon: MessageSquare },
    { name: 'Contact Coach', href: '/lms/contact', icon: Phone },
    { name: 'Settings', href: '/lms/settings', icon: Settings },
    { name: 'Help', href: '/lms/help', icon: HelpCircle },
];
const LMSLayout = ({ children }) => {
    const { logout, isAuthenticated, user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            if (!isAuthenticated.lms) {
                localStorage.setItem('huddle_lms_auth', 'true');
                localStorage.setItem('huddle_user', JSON.stringify({
                    name: 'Sarah Chen',
                    email: 'demo@thehuddleco.com',
                    role: 'Learner',
                    id: `demo-lms-${Date.now()}`,
                }));
                window.location.reload();
            }
            return;
        }
        if (!isAuthenticated.lms) {
            navigate('/lms/login');
        }
    }, [isAuthenticated.lms, navigate]);
    if (isAuthenticated.lms === undefined) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-softwhite", children: _jsx(LoadingSpinner, { size: "lg" }) }));
    }
    const isActive = (href) => location.pathname === href;
    const handleLogout = async () => {
        await logout('lms');
        navigate('/lms/login');
    };
    return (_jsxs("div", { className: "flex min-h-screen bg-softwhite", children: [sidebarOpen && (_jsx("div", { className: "fixed inset-0 z-40 bg-charcoal/40 backdrop-blur lg:hidden", onClick: () => setSidebarOpen(false) })), _jsxs("aside", { className: `fixed inset-y-0 left-0 z-50 w-[260px] transform bg-white shadow-[0_24px_60px_rgba(16,24,40,0.12)] transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`, children: [_jsxs("div", { className: "flex items-center justify-between border-b border-mist/70 px-6 py-6", children: [_jsxs(Link, { to: "/", className: "flex items-center gap-3 no-underline", children: [_jsx("span", { className: "flex h-10 w-10 items-center justify-center rounded-2xl text-white", style: { background: 'var(--gradient-brand)' }, children: _jsx(Users, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-heading text-base font-bold text-charcoal", children: "The Huddle Co." }), _jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.35em] text-slate/70", children: "Learner Portal" })] })] }), _jsx("button", { className: "lg:hidden", onClick: () => setSidebarOpen(false), children: _jsx(X, { className: "h-5 w-5 text-slate/70" }) })] }), _jsxs("div", { className: "flex h-full flex-col justify-between px-5 py-6", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { tone: "muted", className: "space-y-3", children: [_jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: "Spring 2025 Cohort" }), _jsxs("div", { children: [_jsxs("p", { className: "font-heading text-base font-semibold text-charcoal", children: ["Welcome, ", user?.email || 'Learner'] }), _jsx("p", { className: "text-xs text-slate/70", children: "Keep building your inclusive leadership practice." })] })] }), _jsx("nav", { className: "space-y-2", children: navigation.map((item) => {
                                            const Icon = item.icon;
                                            const active = isActive(item.href);
                                            return (_jsxs(Link, { to: item.href, onClick: () => setSidebarOpen(false), className: `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${active
                                                    ? 'text-white shadow-card-sm'
                                                    : 'text-slate/80 hover:bg-cloud hover:text-skyblue'}`, style: active ? { background: 'var(--gradient-blue-green)' } : undefined, children: [_jsx("span", { className: `flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-white/20 text-white' : 'bg-cloud text-slate'}`, children: _jsx(Icon, { className: "h-4 w-4" }) }), item.name] }, item.name));
                                        }) })] }), _jsx(Button, { variant: "ghost", className: "w-full justify-center", leadingIcon: _jsx(LogOut, { className: "h-4 w-4" }), onClick: handleLogout, children: "Logout" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col", children: [_jsx("header", { className: "sticky top-0 z-20 border-b border-mist/60 bg-white/90 backdrop-blur", children: _jsxs("div", { className: "flex h-16 items-center justify-between px-6 lg:px-10", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { className: "text-slate/70 hover:text-sunrise lg:hidden", onClick: () => setSidebarOpen(true), children: _jsx(Menu, { className: "h-6 w-6" }) }), _jsx("p", { className: "hidden font-heading text-lg font-semibold text-charcoal lg:block", children: "Leadership Journey" })] }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-slate/70", children: [_jsx(Badge, { tone: "info", className: "bg-sunrise/10 text-sunrise", children: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }), _jsx("span", { children: user?.email })] })] }) }), _jsx("main", { className: "flex-1 overflow-y-auto bg-softwhite px-6 py-8 lg:px-12", children: children })] })] }));
};
export default LMSLayout;
