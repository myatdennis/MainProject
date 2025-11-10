import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSearchParams, Link } from 'react-router-dom';
const AdminCoursesBulk = () => {
    const [searchParams] = useSearchParams();
    const ids = searchParams.get('ids') || '';
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Bulk Course Actions" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Perform bulk actions on the following course IDs:" }), _jsx("pre", { className: "bg-gray-100 p-4 rounded", children: ids }), _jsx("div", { className: "mt-6", children: _jsx(Link, { to: "/admin/courses", className: "text-sm text-orange-500", children: "\u2190 Back to Courses" }) })] }));
};
export default AdminCoursesBulk;
