import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
const NotFound = () => {
    const location = useLocation();
    return (_jsx("div", { className: "flex min-h-[60vh] items-center justify-center px-6 py-16", children: _jsxs(Card, { tone: "muted", className: "max-w-lg space-y-6 text-center", padding: "lg", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate/70", children: "404" }), _jsx("h1", { className: "mt-2 font-heading text-3xl font-bold text-charcoal", children: "Page not found" }), _jsxs("p", { className: "mt-3 text-sm text-slate/80", children: ["We looked everywhere but couldn't find ", _jsx("code", { className: "rounded bg-cloud px-1 py-0.5 text-xs text-slate/70", children: location.pathname }), ". Check the URL or head back to your dashboard."] })] }), _jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:justify-center", children: [_jsx(Button, { asChild: true, size: "sm", children: _jsx(Link, { to: "/", children: "Go to homepage" }) }), _jsx(Button, { variant: "ghost", asChild: true, size: "sm", children: _jsx(Link, { to: "/client/courses", children: "Browse my courses" }) })] })] }) }));
};
export default NotFound;
