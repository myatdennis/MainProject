import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
const AdminAuthTest = () => {
    const { login, isAuthenticated, user } = useAuth();
    const [status, setStatus] = useState('');
    const testLogin = async () => {
        setStatus('Attempting login...');
        try {
            const result = await login('admin@thehuddleco.com', 'admin123', 'admin');
            setStatus(`Login result: ${JSON.stringify(result)}`);
        }
        catch (error) {
            setStatus(`Login error: ${error}`);
        }
    };
    return (_jsxs("div", { className: "p-8", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "Admin Auth Test" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("strong", { children: "Authentication Status:" }), _jsx("pre", { children: JSON.stringify(isAuthenticated, null, 2) })] }), _jsxs("div", { children: [_jsx("strong", { children: "User:" }), _jsx("pre", { children: JSON.stringify(user, null, 2) })] }), _jsx("div", { children: _jsx("button", { onClick: testLogin, className: "bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600", children: "Test Admin Login" }) }), _jsxs("div", { children: [_jsx("strong", { children: "Status:" }), " ", status] })] })] }));
};
export default AdminAuthTest;
