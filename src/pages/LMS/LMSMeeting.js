import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams, Link } from 'react-router-dom';
const LMSMeeting = () => {
    const { sessionId } = useParams();
    return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto text-center", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "Join Meeting" }), _jsxs("p", { className: "text-gray-700 mb-6", children: ["This is a placeholder meeting page for session ", _jsx("strong", { children: sessionId || 'unknown' }), "."] }), _jsxs("div", { className: "bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6", children: [_jsx("p", { className: "text-gray-600 mb-4", children: "When integrated with a conferencing provider this page will contain the meeting join button and instructions." }), _jsx("a", { href: "#", onClick: (e) => { e.preventDefault(); alert('Opening meeting (mock)'); }, className: "inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200", children: "Join Meeting" })] }), _jsx(Link, { to: "/lms/dashboard", className: "text-sm text-orange-500", children: "\u2190 Back to Dashboard" })] }));
};
export default LMSMeeting;
