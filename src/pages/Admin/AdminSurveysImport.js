import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Button from '../../components/ui/Button';
const AdminSurveysImport = () => {
    return (_jsxs(_Fragment, { children: [_jsx(SEO, { title: "Admin - Surveys Import", description: "Import surveys via CSV or JSON into the admin console." }), _jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Import Surveys" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Upload CSV or JSON files to bulk create or update survey templates. This is a lightweight placeholder page \u2014 implement import logic when ready." }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-sm border border-gray-200", children: [_jsx("p", { className: "text-sm text-gray-500 mb-4", children: "Choose a file to upload or paste survey JSON below." }), _jsx("div", { className: "border border-dashed border-gray-200 rounded p-6 text-center", children: _jsx("div", { className: "text-gray-400", children: "Drag & drop files here, or use the import tool in the admin console." }) }), _jsx("div", { className: "mt-6 text-right", children: _jsx(Button, { asChild: true, variant: "ghost", size: "sm", "aria-label": "Back to Surveys", "data-test": "admin-back-to-surveys", children: _jsx(Link, { to: "/admin/surveys", children: "\u2190 Back to Surveys" }) }) })] })] })] }));
};
export default AdminSurveysImport;
