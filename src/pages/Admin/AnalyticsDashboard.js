import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import supabaseClient from '../../lib/supabaseClient';
const AnalyticsDashboard = () => {
    const [overview, setOverview] = useState({});
    const [courses, setCourses] = useState([]);
    const [dropoffs, setDropoffs] = useState([]);
    const [loading, setLoading] = useState(false);
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/analytics');
            const json = await res.json();
            setOverview(json.overview || {});
            setCourses(Array.isArray(json.courses) ? json.courses : []);
            setDropoffs(Array.isArray(json.dropoffs) ? json.dropoffs : []);
        }
        catch (err) {
            console.error('Failed to load analytics', err);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
        // If Supabase client is available, use realtime subscriptions for fresh updates
        let subscription = null;
        if (supabaseClient) {
            try {
                subscription = supabaseClient
                    .channel('public:analytics')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_course_progress' }, () => {
                    fetchData();
                })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_lesson_progress' }, () => {
                    fetchData();
                })
                    .subscribe();
            }
            catch (err) {
                console.warn('Realtime subscription failed, falling back to polling', err);
            }
        }
        // Fallback polling every 3s if realtime not available
        const id = setInterval(() => {
            if (!supabaseClient)
                fetchData();
        }, 3000);
        return () => {
            clearInterval(id);
            try {
                if (subscription && subscription.unsubscribe)
                    subscription.unsubscribe();
            }
            catch (e) { }
        };
    }, []);
    const exportCsv = async () => {
        const a = document.createElement('a');
        a.href = '/api/admin/analytics/export';
        a.download = 'analytics.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    const requestSummary = async () => {
        try {
            const res = await fetch('/api/admin/analytics/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            const json = await res.json();
            alert(JSON.stringify(json.sample || json.ai || json.prompt, null, 2));
        }
        catch (err) {
            console.error('Summary request failed', err);
            alert('Failed to generate summary');
        }
    };
    return (_jsxs("div", { style: { padding: 20 }, children: [_jsx("h2", { children: "Admin Analytics" }), _jsxs("div", { style: { display: 'flex', gap: 16, marginBottom: 16 }, children: [_jsxs("div", { style: { padding: 12, border: '1px solid #eee', borderRadius: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: '#666' }, children: "Active learners" }), _jsx("div", { style: { fontSize: 20 }, children: overview.total_active_learners ?? '—' })] }), _jsxs("div", { style: { padding: 12, border: '1px solid #eee', borderRadius: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: '#666' }, children: "Orgs" }), _jsx("div", { style: { fontSize: 20 }, children: overview.total_orgs ?? '—' })] }), _jsxs("div", { style: { padding: 12, border: '1px solid #eee', borderRadius: 8 }, children: [_jsx("div", { style: { fontSize: 12, color: '#666' }, children: "Courses" }), _jsx("div", { style: { fontSize: 20 }, children: overview.total_courses ?? '—' })] })] }), _jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("button", { onClick: exportCsv, style: { marginRight: 8 }, children: "Export CSV" }), _jsx("button", { onClick: requestSummary, children: "AI Summary" })] }), _jsx("h3", { children: "Top courses (by completion %)" }), loading ? _jsx("div", { children: "Loading\u2026" }) : (_jsxs("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: 'left', padding: 8 }, children: "Course" }), _jsx("th", { style: { textAlign: 'right', padding: 8 }, children: "Completion %" }), _jsx("th", { style: { textAlign: 'right', padding: 8 }, children: "Avg progress" })] }) }), _jsx("tbody", { children: courses.map((c) => (_jsxs("tr", { children: [_jsx("td", { style: { padding: 8 }, children: c.course_id }), _jsx("td", { style: { padding: 8, textAlign: 'right' }, children: c.completion_percent ?? '—' }), _jsx("td", { style: { padding: 8, textAlign: 'right' }, children: c.avg_progress ?? '—' })] }, c.course_id))) })] })), _jsx("h3", { style: { marginTop: 20 }, children: "Top lesson dropoffs" }), _jsx("ul", { children: dropoffs.map((d) => (_jsxs("li", { children: [d.course_id, " / ", d.lesson_id, " \u2014 dropoff ", d.dropoff_percent, "%"] }, `${d.course_id}_${d.lesson_id}`))) })] }));
};
export default AnalyticsDashboard;
