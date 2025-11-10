import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
const ClientSurveys = () => {
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsx(SEO, { title: "My Surveys", description: "View and complete assigned surveys." }), _jsx(Breadcrumbs, { items: [{ label: 'Dashboard', to: '/client/dashboard' }, { label: 'Surveys', to: '/client/surveys' }] }), _jsxs(Card, { tone: "muted", className: "mt-4 space-y-3", children: [_jsx("h1", { className: "font-heading text-2xl font-bold text-charcoal", children: "My Surveys" }), _jsx("p", { className: "text-sm text-slate/80", children: "You don\u2019t have any surveys yet. Check back later." }), _jsx("div", { children: _jsx(Button, { asChild: true, variant: "ghost", size: "sm", children: _jsx("a", { href: "/client/dashboard", children: "\u2190 Back to dashboard" }) }) })] })] }));
};
export default ClientSurveys;
