import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
const ActionTrackerPage = () => {
    const { orgId } = useParams();
    const [items, setItems] = useState([]);
    const [title, setTitle] = useState('');
    const [assignee, setAssignee] = useState('');
    const [dueDate, setDueDate] = useState('');
    useEffect(() => {
        if (!orgId)
            return;
        (async () => {
            const svc = await import('../../services/clientWorkspaceService');
            const i = await svc.listActionItems(orgId);
            setItems(i);
        })();
    }, [orgId]);
    const create = async () => {
        if (!orgId || !title)
            return;
        const svc = await import('../../services/clientWorkspaceService');
        await svc.addActionItem(orgId, { title, assignee, dueDate, status: 'Not Started' });
        const i = await svc.listActionItems(orgId);
        setItems(i);
        setTitle('');
        setAssignee('');
        setDueDate('');
    };
    const notify = async (item) => {
        console.log(`Notify about action ${item.id} -> assignee: ${item.assignee || 'unassigned'}`);
        alert(`Notification sent to ${item.assignee || 'client contacts'} (mock)`);
    };
    const exportCSV = () => {
        const rows = [['Title', 'Assignee', 'Due Date', 'Status']].concat(items.map(i => [i.title, i.assignee || '', i.dueDate || '', i.status]));
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `action-tracker-${orgId || 'org'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const toggleStatus = async (item) => {
        const next = item.status === 'Completed' ? 'Not Started' : item.status === 'Not Started' ? 'In Progress' : 'Completed';
        const updated = { ...item, status: next };
        const svc = await import('../../services/clientWorkspaceService');
        await svc.updateActionItem(orgId, updated);
        setItems(await svc.listActionItems(orgId));
    };
    return (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Shared Action Tracker" }), _jsx("div", { className: "flex justify-end mb-2", children: _jsx("button", { onClick: exportCSV, className: "text-sm px-3 py-1 border rounded", children: "Export CSV" }) }), _jsxs("div", { className: "bg-white rounded p-4 mb-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2", children: [_jsx("input", { placeholder: "Action title", className: "border p-2 rounded", value: title, onChange: e => setTitle(e.target.value) }), _jsx("input", { placeholder: "Assignee", className: "border p-2 rounded", value: assignee, onChange: e => setAssignee(e.target.value) }), _jsx("input", { type: "date", className: "border p-2 rounded", value: dueDate, onChange: e => setDueDate(e.target.value) })] }), _jsx("div", { className: "flex justify-end mt-2", children: _jsx("button", { className: "bg-orange-500 text-white px-4 py-2 rounded", onClick: create, children: "Add Action" }) })] }), _jsx("div", { className: "space-y-3", children: items.map(it => (_jsxs("div", { className: "bg-white p-3 rounded border flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-semibold", children: it.title }), _jsxs("div", { className: "text-sm text-gray-600", children: [it.assignee || 'Unassigned', " \u2022 Due: ", it.dueDate || '—'] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: `px-3 py-1 rounded-full text-sm ${it.status === 'Completed' ? 'bg-green-100 text-green-800' : it.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`, children: it.status }), _jsx("button", { className: "px-3 py-1 border rounded", onClick: () => toggleStatus(it), children: "Toggle" }), _jsx("button", { className: "px-3 py-1 border rounded", onClick: () => notify(it), children: "Notify" })] })] }, it.id))) })] }));
};
export default ActionTrackerPage;
