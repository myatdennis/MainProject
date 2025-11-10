import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import notificationService from '../../dal/notifications';
import { useAuth } from '../../context/AuthContext';
const OrgWorkspaceLayout = () => {
    const { orgId } = useParams();
    const { isAuthenticated } = useAuth();
    const [orgName] = useState(`Organization ${orgId}`);
    const [allowed, setAllowed] = useState(false);
    const [notifications, setNotifications] = useState([]);
    // Basic guard: this would be replaced with a real permission check
    useEffect(() => {
        let cancelled = false;
        const evaluateAccess = async () => {
            if (!orgId) {
                setAllowed(false);
                setNotifications([]);
                return;
            }
            try {
                const svc = await import('../../services/clientWorkspaceService');
                const access = await svc.checkWorkspaceAccess(orgId);
                const canAccess = Boolean(access) || isAuthenticated.admin;
                if (!cancelled) {
                    setAllowed(canAccess);
                }
                if (canAccess) {
                    const notes = await notificationService.listNotifications({ orgId });
                    if (!cancelled) {
                        setNotifications(notes.slice(0, 5));
                    }
                }
                else if (!cancelled) {
                    setNotifications([]);
                }
            }
            catch (error) {
                console.error('Failed to evaluate organization workspace access:', error);
                if (!cancelled) {
                    setAllowed(isAuthenticated.admin);
                    setNotifications([]);
                }
            }
        };
        evaluateAccess();
        return () => {
            cancelled = true;
        };
    }, [orgId, isAuthenticated.admin]);
    const [darkMode, setDarkMode] = useState(false);
    return (_jsxs("div", { className: `p-6 max-w-7xl mx-auto ${darkMode ? 'dark' : ''}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("img", { src: "/logo192.png", alt: "The Huddle Co. logo", className: `h-12 w-12 rounded-full bg-gradient-to-r ${darkMode ? 'from-indigo-900/20 via-charcoal to-ivory' : 'from-sunrise/20 via-indigo-100 to-ivory'}`, onError: (e) => {
                                    e.currentTarget.src = '/default-org-fallback.png';
                                    e.currentTarget.className += darkMode ? ' bg-gradient-to-r from-indigo-900/20 via-charcoal to-ivory' : ' bg-gradient-to-r from-sunrise/20 via-indigo-100 to-ivory';
                                }, "aria-label": "Organization logo for The Huddle Co." }), _jsxs("div", { children: [_jsxs("h1", { className: `text-2xl font-bold ${darkMode ? 'text-sunrise' : 'text-sunrise'}`, children: [orgName, " Workspace"] }), _jsx("div", { className: `text-sm ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`, children: "Private workspace for your organization" })] })] }), _jsx("div", { className: "flex items-center space-x-3", children: _jsx(Link, { to: "/client-portal", className: `text-sm ${darkMode ? 'text-sunrise' : 'text-gray-700'}`, children: "Back to Portal" }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: [!allowed && (_jsxs("div", { className: `md:col-span-4 rounded-lg p-8 border text-center ${darkMode ? 'bg-charcoal text-ivorywhite border-indigo-900' : 'bg-white'}`, children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Access Restricted" }), _jsx("p", { className: `text-sm mb-4 ${darkMode ? 'text-mutedgrey' : 'text-gray-600'}`, children: "You must be a member of this organization or a Huddle Co. admin to view this workspace." }), _jsx("div", { className: "space-x-2", children: _jsx("button", { onClick: () => alert('Request access (mock)'), className: `px-4 py-2 rounded font-heading btn-cta`, children: "Request Access" }) })] })), _jsx("nav", { className: `md:col-span-1 rounded-lg p-4 border ${darkMode ? 'bg-charcoal text-ivorywhite border-indigo-900' : 'bg-white'}`, children: _jsxs("ul", { className: "space-y-2", children: [_jsx("li", { children: _jsx(Link, { to: "strategic-plans", className: `block p-2 rounded ${darkMode ? 'hover:bg-indigo-900/10' : 'hover:bg-gray-50'}`, children: "Strategic Plan Drafts" }) }), _jsx("li", { children: _jsx(Link, { to: "session-notes", className: `block p-2 rounded ${darkMode ? 'hover:bg-indigo-900/10' : 'hover:bg-gray-50'}`, children: "Session Notes & Follow-Ups" }) }), _jsx("li", { children: _jsx(Link, { to: "action-tracker", className: `block p-2 rounded ${darkMode ? 'hover:bg-indigo-900/10' : 'hover:bg-gray-50'}`, children: "Shared Action Tracker" }) }), _jsx("li", { children: _jsx(Link, { to: "documents", className: `block p-2 rounded ${darkMode ? 'hover:bg-indigo-900/10' : 'hover:bg-gray-50'}`, children: "Shared Documents" }) })] }) }), _jsxs("div", { className: `md:col-span-3 ${darkMode ? 'bg-charcoal text-ivorywhite' : ''}`, children: [notifications.length > 0 && (_jsxs("div", { className: `mb-4 rounded-lg p-3 ${darkMode ? 'bg-indigo-900/10 border-indigo-900 text-ivorywhite' : 'bg-yellow-50 border border-yellow-100'}`, children: [_jsx("h4", { className: "font-semibold", children: "Recent Workspace Notifications" }), _jsx("ul", { className: "text-sm mt-2 space-y-1", children: notifications.map(n => (_jsxs("li", { children: [n.title, " \u2014 ", _jsx("span", { className: darkMode ? 'text-mutedgrey' : 'text-gray-600', children: new Date(n.createdAt).toLocaleString() })] }, n.id))) })] })), _jsx(Outlet, {}), _jsx("div", { className: "mt-8 flex justify-end", children: _jsx("button", { onClick: () => setDarkMode(!darkMode), className: "px-4 py-2 rounded-xl bg-charcoal text-ivorywhite font-heading hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500", "aria-label": darkMode ? 'Switch to light mode' : 'Switch to dark mode', children: darkMode ? 'Light Mode' : 'Dark Mode' }) })] })] })] }));
};
export default OrgWorkspaceLayout;
