import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
const AdminQueueMonitor = () => {
    const [queue, setQueue] = useState([]);
    const [lastFlush, setLastFlush] = useState(null);
    const refresh = async () => {
        const mod = await import('../../dal/surveys');
        setQueue(mod.getQueueSnapshot());
        setLastFlush(mod.getLastFlushTime());
    };
    useEffect(() => {
        refresh();
        let mounted = true;
        import('../../dal/surveys').then(mod => {
            const handler = () => { if (mounted)
                refresh(); };
            mod.surveyQueueEvents.addEventListener('queuechange', handler);
            mod.surveyQueueEvents.addEventListener('flush', handler);
            return () => { mounted = false; mod.surveyQueueEvents.removeEventListener('queuechange', handler); mod.surveyQueueEvents.removeEventListener('flush', handler); };
        });
    }, []);
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Queue Monitor" }), _jsxs("div", { children: [_jsx(Link, { to: "/admin/surveys", className: "text-sm text-orange-500 mr-4", children: "\u2190 Back to Surveys" }), _jsx("button", { onClick: async () => { const mod = await import('../../dal/surveys'); await mod.flushNow(); refresh(); }, className: "px-3 py-2 bg-blue-600 text-white rounded", children: "Flush Now" })] })] }), _jsxs("div", { className: "bg-white p-4 rounded shadow-sm border", children: [_jsxs("div", { className: "mb-4 text-sm text-gray-600", children: ["Pending items: ", _jsx("strong", { children: queue.length })] }), lastFlush && _jsxs("div", { className: "mb-4 text-xs text-gray-500", children: ["Last flush: ", new Date(lastFlush).toLocaleString()] }), queue.length === 0 ? (_jsx("div", { className: "text-sm text-gray-500", children: "Queue is empty." })) : (_jsx("div", { className: "space-y-3", children: queue.map((item, idx) => (_jsxs("div", { className: "p-3 border rounded", children: [_jsx("div", { className: "font-medium", children: item.title || item.id }), _jsxs("div", { className: "text-xs text-gray-600", children: ["Status: ", item.status || 'draft'] }), _jsx("pre", { className: "text-xs mt-2 bg-gray-50 p-2 rounded max-h-40 overflow-auto", children: JSON.stringify(item, null, 2) })] }, idx))) }))] })] }));
};
export default AdminQueueMonitor;
