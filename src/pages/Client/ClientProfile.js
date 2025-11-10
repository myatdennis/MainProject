import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
const ClientProfile = () => {
    const { user } = useAuth();
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsx(SEO, { title: "My Profile", description: "Manage your profile and preferences." }), _jsx(Breadcrumbs, { items: [{ label: 'Dashboard', to: '/client/dashboard' }, { label: 'Profile', to: '/client/profile' }] }), _jsxs(Card, { tone: "muted", className: "mt-4 space-y-3", children: [_jsx("h1", { className: "font-heading text-2xl font-bold text-charcoal", children: "My Profile" }), _jsxs("div", { className: "text-sm text-slate/80", children: [_jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Name:" }), " ", user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—' : '—'] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Email:" }), " ", user?.email || '—'] }), _jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Role:" }), " ", user?.role || '—'] })] }), _jsx("div", { className: "flex gap-2 pt-2", children: _jsx(Button, { asChild: true, variant: "ghost", size: "sm", children: _jsx("a", { href: "/client/dashboard", children: "\u2190 Back to dashboard" }) }) })] })] }));
};
export default ClientProfile;
