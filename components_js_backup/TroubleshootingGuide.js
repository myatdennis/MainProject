import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { HelpCircle, CheckCircle, AlertCircle, Terminal, Globe, Server } from 'lucide-react';
const TroubleshootingGuide = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState(null);
    const troubleshootingSteps = [
        {
            id: 'server',
            title: 'Development Server Issues',
            icon: _jsx(Server, { className: "h-5 w-5" }),
            description: 'Server not starting or crashing',
            steps: [
                'Check if port 5173 is already in use: `lsof -i :5173`',
                'Kill any existing processes: `pkill -f vite`',
                'Restart the development server: `npm run dev`',
                'Check for compilation errors in the terminal',
                'Try clearing node_modules and reinstalling: `rm -rf node_modules && npm install`'
            ]
        },
        {
            id: 'browser',
            title: 'Browser Connection Issues',
            icon: _jsx(Globe, { className: "h-5 w-5" }),
            description: 'Can\'t access localhost:5173',
            steps: [
                'Verify the server is running in terminal',
                'Try accessing http://localhost:5173/ directly',
                'Clear browser cache and reload (Cmd+Shift+R on Mac)',
                'Disable browser extensions temporarily',
                'Try a different browser (Chrome, Firefox, Safari)',
                'Check if firewall is blocking the connection'
            ]
        },
        {
            id: 'lms',
            title: 'LMS Module Access',
            icon: _jsx(CheckCircle, { className: "h-5 w-5" }),
            description: 'Unable to load course errors',
            steps: [
                'The app now runs in demo mode automatically',
                'No authentication required for development',
                'Module URLs should work directly',
                'Check browser console for JavaScript errors',
                'Refresh the page if you see authentication errors'
            ]
        },
        {
            id: 'build',
            title: 'Build and Compilation',
            icon: _jsx(Terminal, { className: "h-5 w-5" }),
            description: 'TypeScript or build errors',
            steps: [
                'Check for TypeScript errors: `npx tsc --noEmit`',
                'Run build command: `npm run build`',
                'Check the terminal output for specific error messages',
                'Verify all imports and file paths are correct',
                'Make sure all dependencies are installed'
            ]
        }
    ];
    const quickChecks = [
        { label: 'Development server running', command: 'npm run dev' },
        { label: 'Port 5173 accessible', url: 'http://localhost:5173/' },
        { label: 'No TypeScript errors', command: 'npx tsc --noEmit' },
        { label: 'Build successful', command: 'npm run build' }
    ];
    if (!isOpen) {
        return (_jsx("button", { onClick: () => setIsOpen(true), className: "fixed bottom-4 left-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors", title: "Troubleshooting Guide", children: _jsx(HelpCircle, { className: "h-5 w-5" }) }));
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-gray-200", children: [_jsxs("h2", { className: "text-xl font-semibold text-gray-900 flex items-center", children: [_jsx(HelpCircle, { className: "h-6 w-6 mr-3 text-blue-600" }), "Connection Troubleshooting Guide"] }), _jsx("button", { onClick: () => setIsOpen(false), className: "text-gray-400 hover:text-gray-600 text-2xl leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "p-6 overflow-y-auto max-h-[calc(90vh-120px)]", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Quick Status Checks" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: quickChecks.map((check, index) => (_jsxs("div", { className: "bg-gray-50 p-3 rounded-lg", children: [_jsx("div", { className: "font-medium text-sm text-gray-900", children: check.label }), _jsx("div", { className: "text-xs text-gray-600 mt-1 font-mono", children: check.command || check.url })] }, index))) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4", children: "Detailed Troubleshooting" }), _jsx("div", { className: "space-y-4", children: troubleshootingSteps.map((section) => (_jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsxs("button", { onClick: () => setExpandedSection(expandedSection === section.id ? null : section.id), className: "w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "text-blue-600 mr-3", children: section.icon }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: section.title }), _jsx("div", { className: "text-sm text-gray-600", children: section.description })] })] }), _jsx("div", { className: "text-gray-400", children: expandedSection === section.id ? '−' : '+' })] }), expandedSection === section.id && (_jsx("div", { className: "px-4 pb-4", children: _jsx("ol", { className: "list-decimal list-inside space-y-2 text-sm text-gray-700", children: section.steps.map((step, stepIndex) => (_jsx("li", { className: "leading-relaxed", children: step.includes('`') ? (_jsx("span", { children: step.split('`').map((part, i) => i % 2 === 0 ? part : (_jsx("code", { className: "bg-gray-100 px-2 py-1 rounded text-sm font-mono", children: part }, i))) })) : (step) }, stepIndex))) }) }))] }, section.id))) })] }), _jsx("div", { className: "mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg", children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertCircle, { className: "h-5 w-5 text-blue-600 mr-3 mt-0.5" }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-blue-900", children: "Still Having Issues?" }), _jsxs("p", { className: "text-sm text-blue-800 mt-1", children: ["If problems persist, check the browser console (F12) for error messages, or contact ", _jsx("a", { href: "mailto:contact@thehuddleco.com", className: "underline", children: "contact@thehuddleco.com" }), " for support."] })] })] }) })] })] }) }));
};
export default TroubleshootingGuide;
