import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Building2 } from 'lucide-react';
import documentService from '../../dal/documents';
// clientWorkspaceService is dynamically imported where used so it can be bundled with the org-workspace chunk
import notificationService from '../../dal/notifications';
import orgService from '../../dal/orgs';
import { useToast } from '../../context/ToastContext';
const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'services', label: 'Services' },
    { key: 'resources', label: 'Resources' },
    { key: 'action-tracker', label: 'Action Tracker' },
    { key: 'metrics', label: 'Metrics' }
];
const AdminOrganizationProfile = () => {
    const { orgId } = useParams();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('overview');
    const [documents, setDocuments] = useState([]);
    const [actionItems, setActionItems] = useState([]);
    const [strategicPlansCount, setStrategicPlansCount] = useState(0);
    const [totalLearners, setTotalLearners] = useState(null);
    const [avgCompletion, setAvgCompletion] = useState(null);
    const [totalDownloads, setTotalDownloads] = useState(0);
    // Upload form state
    const [file, setFile] = useState(null);
    const [docName, setDocName] = useState('');
    const [docCategory, setDocCategory] = useState('Onboarding');
    const [docTags, setDocTags] = useState('');
    // Action item form
    const [newActionTitle, setNewActionTitle] = useState('');
    const [newActionDue, setNewActionDue] = useState('');
    const [newActionAssignee, setNewActionAssignee] = useState('');
    useEffect(() => {
        if (!orgId)
            return;
        // load documents for resources tab
        documentService.listDocuments({ orgId }).then(setDocuments).catch(() => setDocuments([]));
        // load action items
        (async () => {
            try {
                const svc = await import('../../services/clientWorkspaceService');
                const actions = await svc.listActionItems(orgId);
                setActionItems(actions);
                const plans = await svc.listStrategicPlans(orgId);
                setStrategicPlansCount(plans.length);
            }
            catch (e) {
                setActionItems([]);
                setStrategicPlansCount(0);
            }
        })();
        // org totals
        orgService.getOrg(orgId).then(o => {
            if (o) {
                setTotalLearners(o.totalLearners || 0);
                setAvgCompletion(o.completionRate || 0);
            }
            else {
                setTotalLearners(null);
                setAvgCompletion(null);
            }
        }).catch(() => { setTotalLearners(null); setAvgCompletion(null); });
        // document downloads aggregate
        documentService.listDocuments({ orgId }).then(list => setTotalDownloads(list.reduce((acc, d) => acc + (d.downloadCount || 0), 0))).catch(() => setTotalDownloads(0));
    }, [orgId]);
    const handleAssignDocument = async () => {
        // quick demo: create a placeholder doc and assign to org
        const meta = await documentService.addDocument({
            name: `welcome-packet-${Date.now()}`,
            filename: 'welcome.pdf',
            url: undefined,
            category: 'Onboarding',
            subcategory: undefined,
            tags: ['welcome'],
            fileType: 'application/pdf',
            visibility: 'org',
            orgId: orgId,
            createdBy: 'Admin'
        });
        if (meta && meta.id) {
            await documentService.assignToOrg(meta.id, orgId);
            // notificationService API is addNotification and expects body
            await notificationService.addNotification({
                title: 'Document assigned',
                body: `Assigned ${meta.name} to organization ${orgId}`,
                orgId: orgId
            });
            // refresh
            const list = await documentService.listDocuments({ orgId });
            setDocuments(list);
        }
    };
    const handleFileChange = (f) => setFile(f);
    const handleUpload = async () => {
        if (!orgId)
            return;
        if (!file && !docName) {
            showToast('Provide a name or file', 'error');
            return;
        }
        let url = undefined;
        if (file) {
            // read as data URL for local dev (documentService will also attempt storage upload)
            url = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(String(r.result));
                r.onerror = rej;
                r.readAsDataURL(file);
            });
        }
        const doc = await documentService.addDocument({
            name: docName || file.name,
            filename: file?.name,
            url,
            category: docCategory,
            subcategory: undefined,
            tags: docTags ? docTags.split(',').map(t => t.trim()).filter(Boolean) : [],
            fileType: file?.type,
            visibility: 'org',
            orgId: orgId,
            createdBy: 'Admin'
        }, file || undefined);
        if (doc && doc.id) {
            await documentService.assignToOrg(doc.id, orgId);
            await notificationService.addNotification({ title: 'New Document Shared', body: `A document "${doc.name}" was shared with your organization.`, orgId: orgId });
            setDocName('');
            setFile(null);
            setDocTags('');
            const list = await documentService.listDocuments({ orgId });
            setDocuments(list);
        }
    };
    const handleAddAction = async () => {
        if (!orgId || !newActionTitle) {
            showToast('Provide a title for the action', 'error');
            return;
        }
        const svc = await import('../../services/clientWorkspaceService');
        await svc.addActionItem(orgId, {
            title: newActionTitle,
            description: '',
            assignee: newActionAssignee || undefined,
            dueDate: newActionDue || undefined,
            status: 'Not Started'
        });
        setNewActionTitle('');
        setNewActionDue('');
        setNewActionAssignee('');
        const list = await (await import('../../services/clientWorkspaceService')).listActionItems(orgId);
        setActionItems(list);
        showToast('Action item added', 'success');
    };
    const toggleActionStatus = async (item) => {
        if (!orgId)
            return;
        const order = ['Not Started', 'In Progress', 'Completed'];
        const idx = order.indexOf(item.status || 'Not Started');
        const next = order[(idx + 1) % order.length];
        const updated = { ...item, status: next };
        const svc2 = await import('../../services/clientWorkspaceService');
        await svc2.updateActionItem(orgId, updated);
        const list = await svc2.listActionItems(orgId);
        setActionItems(list);
    };
    const renderOverview = () => (_jsx("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: _jsxs("div", { className: "flex items-start space-x-4", children: [_jsx("div", { className: "bg-blue-50 p-4 rounded-lg", children: _jsx(Building2, { className: "h-6 w-6 text-blue-600" }) }), _jsxs("div", { children: [_jsxs("h2", { className: "text-2xl font-bold", children: ["Organization ", orgId] }), _jsx("p", { className: "text-gray-600 mt-2", children: "Basic organization information and contact details will appear here." }), _jsx("div", { className: "mt-3", children: _jsx(Button, { asChild: true, variant: "ghost", size: "sm", "aria-label": "Back to Organizations", children: _jsx(Link, { to: "/admin/organizations", children: "Back to Organizations" }) }) })] })] }) }));
    const renderServices = () => (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsx("h3", { className: "font-bold text-lg mb-2", children: "Services" }), _jsx("p", { className: "text-sm text-gray-600", children: "List and configure services provided to this organization." }), _jsx("div", { className: "mt-4", children: _jsx("button", { className: "px-4 py-2 bg-orange-500 text-white rounded-lg", children: "Edit Services" }) })] }));
    const renderResources = () => (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "font-bold text-lg", children: "Resources" }), _jsx("div", { className: "flex items-center space-x-2", children: _jsx("button", { onClick: handleAssignDocument, className: "px-3 py-1 bg-blue-600 text-white rounded-lg", children: "Assign Demo Document" }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-4", children: [_jsx("div", { className: "md:col-span-2", children: documents.length === 0 ? (_jsx("div", { className: "text-sm text-gray-500", children: "No documents assigned to this organization." })) : (_jsx("ul", { className: "space-y-2", children: documents.map(doc => (_jsxs("li", { className: "p-3 border rounded-lg flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: doc.name }), _jsx("div", { className: "text-sm text-gray-600", children: doc.filename || doc.category })] }), _jsx("div", { className: "text-sm text-gray-500", children: doc.visibility })] }, doc.id))) })) }), _jsxs("div", { className: "p-4 border rounded-lg", children: [_jsx("div", { className: "text-sm font-medium mb-2", children: "Upload & Assign" }), _jsx("input", { type: "text", placeholder: "Document name", value: docName, onChange: e => setDocName(e.target.value), className: "w-full mb-2 p-2 border rounded" }), _jsx("input", { type: "text", placeholder: "Category", value: docCategory, onChange: e => setDocCategory(e.target.value), className: "w-full mb-2 p-2 border rounded" }), _jsx("input", { type: "text", placeholder: "Tags (comma separated)", value: docTags, onChange: e => setDocTags(e.target.value), className: "w-full mb-2 p-2 border rounded" }), _jsx("input", { type: "file", onChange: e => handleFileChange(e.target.files?.[0] || null), className: "w-full mb-2" }), _jsx("div", { className: "text-right", children: _jsx("button", { onClick: handleUpload, className: "px-3 py-1 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded", children: "Upload & Share" }) })] })] })] }));
    const renderActionTracker = () => (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsx("div", { className: "flex items-center justify-between mb-4", children: _jsx("h3", { className: "font-bold text-lg", children: "Action Tracker" }) }), _jsxs("div", { className: "mb-4 grid grid-cols-1 md:grid-cols-3 gap-2", children: [_jsx("input", { value: newActionTitle, onChange: e => setNewActionTitle(e.target.value), placeholder: "Action title", className: "p-2 border rounded" }), _jsx("input", { value: newActionDue, onChange: e => setNewActionDue(e.target.value), placeholder: "Due date", type: "date", className: "p-2 border rounded" }), _jsx("input", { value: newActionAssignee, onChange: e => setNewActionAssignee(e.target.value), placeholder: "Assignee", className: "p-2 border rounded" }), _jsx("div", { className: "md:col-span-3 text-right", children: _jsx("button", { onClick: handleAddAction, className: "px-3 py-1 bg-blue-600 text-white rounded", children: "Add Action" }) })] }), actionItems.length === 0 ? (_jsx("div", { className: "text-sm text-gray-500", children: "No action items for this organization." })) : (_jsx("ul", { className: "space-y-2", children: actionItems.map(item => (_jsxs("li", { className: "p-3 border rounded-lg flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: item.title }), _jsxs("div", { className: "text-sm text-gray-600", children: ["Due: ", item.dueDate || '—'] }), _jsxs("div", { className: "text-xs text-gray-500", children: ["Assignee: ", item.assignee || 'Unassigned'] })] }), _jsxs("div", { className: "flex flex-col items-end space-y-2", children: [_jsx("div", { className: `px-2 py-1 rounded-full text-sm ${item.status === 'Completed' ? 'bg-green-100 text-green-800' : item.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`, children: item.status }), _jsx("div", { className: "flex space-x-2", children: _jsx("button", { onClick: () => toggleActionStatus(item), className: "px-2 py-1 bg-white border rounded text-sm", children: "Toggle Status" }) })] })] }, item.id))) }))] }));
    const renderMetrics = () => (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsx("h3", { className: "font-bold text-lg mb-2", children: "Metrics" }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Documents" }), _jsx("div", { className: "text-2xl font-bold", children: documents.length })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Learners" }), _jsx("div", { className: "text-2xl font-bold", children: totalLearners === null ? '—' : totalLearners })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Action Items" }), _jsx("div", { className: "text-2xl font-bold", children: actionItems.length })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Completed" }), _jsx("div", { className: "text-2xl font-bold", children: actionItems.length === 0 ? '—' : `${Math.round((actionItems.filter(a => a.status === 'Completed').length / actionItems.length) * 100)}%` })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Avg Completion" }), _jsx("div", { className: "text-2xl font-bold", children: avgCompletion === null ? '—' : `${avgCompletion}%` })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Strategic Plans" }), _jsx("div", { className: "text-2xl font-bold", children: strategicPlansCount })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Downloads" }), _jsx("div", { className: "text-2xl font-bold", children: totalDownloads })] })] })] }));
    return (_jsxs("div", { className: "p-6 max-w-6xl mx-auto", children: [_jsx("div", { className: "mb-6 flex items-center justify-between", children: _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "Organization Profile" }), _jsx("p", { className: "text-sm text-gray-600", children: "Manage organization details, resources and activity." })] }) }), _jsx("div", { className: "mb-6", children: _jsx("nav", { className: "flex space-x-2", children: tabs.map(t => (_jsx("button", { onClick: () => setActiveTab(t.key), className: `px-4 py-2 rounded-lg ${activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`, children: t.label }, t.key))) }) }), _jsxs("div", { className: "space-y-6", children: [activeTab === 'overview' && renderOverview(), activeTab === 'services' && renderServices(), activeTab === 'resources' && renderResources(), activeTab === 'action-tracker' && renderActionTracker(), activeTab === 'metrics' && renderMetrics()] })] }));
};
export default AdminOrganizationProfile;
