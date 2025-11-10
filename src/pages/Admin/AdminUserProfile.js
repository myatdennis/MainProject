import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ProfileView from '../../components/ProfileView';
const AdminUserProfile = () => {
    const { userId } = useParams();
    if (!userId) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-12", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "User ID Not Found" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Please select a user to view their profile." }), _jsx(Link, { to: "/admin/users", className: "text-orange-600 hover:text-orange-700 font-medium", children: "Back to Users" })] }) }));
    }
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsxs(Link, { to: "/admin/users", className: "flex items-center text-gray-600 hover:text-gray-900 mb-4", children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Users"] }), _jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "User Profile" }), _jsx("p", { className: "text-gray-600", children: "View user details, learning progress, and manage resources." })] }), _jsx(ProfileView, { profileType: "user", profileId: userId, isAdmin: true })] }));
};
export default AdminUserProfile;
