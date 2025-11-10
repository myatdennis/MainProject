import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, Info } from 'lucide-react';
const DemoModeBanner = () => {
    const [isVisible, setIsVisible] = useState(true);
    // Check if we're in demo mode
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const isDemoMode = !supabaseUrl || !supabaseAnonKey;
    // Don't show banner if not in demo mode or if user closed it
    if (!isDemoMode || !isVisible) {
        return null;
    }
    return (_jsx("div", { className: "bg-blue-50 border-l-4 border-blue-400 p-4 relative", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(Info, { className: "h-5 w-5 text-blue-400 mr-3" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Demo Mode:" }), " You're viewing a demonstration of The Huddle Co platform. All data is simulated and progress is stored locally.", _jsx("a", { href: "mailto:contact@thehuddleco.com", className: "underline ml-1 hover:text-blue-900", children: "Contact us to get started with your organization" })] }) })] }), _jsx("button", { onClick: () => setIsVisible(false), className: "text-blue-400 hover:text-blue-600 transition-colors", "aria-label": "Close demo banner", children: _jsx(X, { className: "h-5 w-5" }) })] }) }));
};
export default DemoModeBanner;
