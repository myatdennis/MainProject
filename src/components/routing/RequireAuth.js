import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
const loginPathByMode = {
    admin: '/admin/login',
    lms: '/lms/login',
};
export const RequireAuth = ({ mode, children }) => {
    const { authInitializing, isAuthenticated } = useAuth();
    const location = useLocation();
    if (authInitializing) {
        return (_jsx("div", { className: "flex min-h-[60vh] items-center justify-center bg-softwhite", children: _jsx(LoadingSpinner, { size: "lg" }) }));
    }
    const allowed = mode === 'admin' ? isAuthenticated.admin : isAuthenticated.lms;
    const anyAuth = isAuthenticated.admin || isAuthenticated.lms;
    if (!allowed) {
        if (anyAuth) {
            return _jsx(Navigate, { to: "/unauthorized", state: { from: location }, replace: true });
        }
        return (_jsx(Navigate, { to: loginPathByMode[mode], state: { from: location }, replace: true }));
    }
    return _jsx(_Fragment, { children: children });
};
export default RequireAuth;
