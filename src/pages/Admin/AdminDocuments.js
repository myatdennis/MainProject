import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { FilePlus, UploadCloud, Trash } from 'lucide-react';
import documentService from '../../dal/documents';
import notificationService from '../../dal/notifications';
import { useToast } from '../../context/ToastContext';
const AdminDocuments = () => {
    const [docs, setDocs] = useState([]);
    const [name, setName] = useState('');
    const [category, setCategory] = useState('Training');
    const [subcategory, setSubcategory] = useState('');
    const [tags, setTags] = useState('');
    const [visibility, setVisibility] = useState('global');
    const [orgId, setOrgId] = useState('');
    const [userId, setUserId] = useState('');
    const [file, setFile] = useState(null);
    const inputRef = useRef(null);
    const { showToast } = useToast();
    const load = async () => {
        const list = await documentService.listDocuments();
        setDocs(list || []);
    };
    useEffect(() => { load(); }, []);
    const onFile = (f) => setFile(f);
    const handleUpload = async () => {
        if (!file && !name) {
            showToast('Provide a name or file', 'error');
            return;
        }
        let url;
        if (file) {
            // read as data URL for local dev (replace with real upload in production)
            url = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(String(r.result));
                r.onerror = rej;
                r.readAsDataURL(file);
            });
        }
        const doc = await documentService.addDocument({
            name: name || file.name,
            filename: file?.name,
            url,
            category,
            subcategory: subcategory || undefined,
            tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            fileType: file?.type,
            visibility,
            orgId: visibility === 'org' ? orgId : undefined,
            userId: visibility === 'user' ? userId : undefined,
            createdBy: 'Admin'
        }, file || undefined);
        if (visibility === 'org' && orgId) {
            await notificationService.addNotification({ title: 'New Document Shared', body: `A document \"${doc.name}\" was shared with your organization.`, orgId });
        }
        if (visibility === 'user' && userId) {
            await notificationService.addNotification({ title: 'New Document Shared', body: `A document \"${doc.name}\" was shared with you.`, userId });
        }
        setName('');
        setFile(null);
        setTags('');
        setOrgId('');
        setUserId('');
        load();
    };
    const handleDelete = async (id) => {
        if (!confirm('Delete document?'))
            return;
        await documentService.deleteDocument(id);
        load();
        showToast('Document deleted', 'success');
    };
    return (_jsxs("div", { className: "container", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-neutral-text", children: "Document Library" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(FilePlus, { className: "w-6 h-6 text-primary" }), _jsx("span", { className: "text-sm muted-text", children: "Upload and manage documents" })] })] }), _jsxs("div", { className: "card-md mb-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium muted-text block mb-2", children: "Name" }), _jsx("input", { className: "input", value: name, onChange: e => setName(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium muted-text block mb-2", children: "Category" }), _jsx("input", { className: "input", value: category, onChange: e => setCategory(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium muted-text block mb-2", children: "Subcategory" }), _jsx("input", { className: "input", value: subcategory, onChange: e => setSubcategory(e.target.value) })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mt-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium muted-text block mb-2", children: "Tags (comma separated)" }), _jsx("input", { className: "input", value: tags, onChange: e => setTags(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium muted-text block mb-2", children: "Visibility" }), _jsxs("select", { className: "input", value: visibility, onChange: e => setVisibility(e.target.value), children: [_jsx("option", { value: "global", children: "Global" }), _jsx("option", { value: "org", children: "Organization" }), _jsx("option", { value: "user", children: "User" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium muted-text block mb-2", children: "Org ID / User ID" }), _jsx("input", { className: "input", placeholder: "orgId or userId", value: visibility === 'org' ? orgId : userId, onChange: e => visibility === 'org' ? setOrgId(e.target.value) : setUserId(e.target.value) })] })] }), _jsxs("div", { className: "mt-4", children: [_jsx("label", { className: "text-sm font-medium muted-text block mb-2", children: "File" }), _jsxs("div", { className: "border-dashed p-6 rounded-lg", style: { border: '2px dashed var(--input-border)' }, children: [_jsx("input", { ref: inputRef, type: "file", onChange: e => onFile(e.target.files?.[0] || null), style: { display: 'none' } }), _jsxs("div", { className: "flex items-center justify-center gap-3", children: [_jsx(UploadCloud, { className: "w-5 h-5 muted-text" }), _jsx("button", { onClick: () => inputRef.current?.click(), className: "text-sm text-primary", children: "Choose file" }), _jsx("span", { className: "text-sm muted-text", children: "or drag and drop (not implemented)" })] }), file && _jsxs("div", { className: "mt-3 text-sm text-neutral-text", children: ["Selected: ", file.name, " ", _jsx("button", { onClick: () => setFile(null), className: "ml-3 text-danger", children: "Remove" })] })] })] }), _jsx("div", { className: "mt-4 text-right", children: _jsx("button", { onClick: handleUpload, className: "btn-primary primary-gradient", children: "Upload" }) })] }), _jsxs("div", { className: "card-md", children: [_jsx("h2", { className: "text-lg font-semibold text-neutral-text mb-4", children: "All Documents" }), _jsx("div", { className: "flex flex-col gap-4", children: docs.map(d => (_jsxs("div", { className: "flex items-center justify-between border p-4 rounded-lg", style: { border: '1px solid var(--card-border)', background: 'var(--card-bg)' }, children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-primary", children: d.name }), _jsxs("div", { className: "text-sm muted-text", children: [d.category, " \u2022 ", d.subcategory, " \u2022 ", d.tags?.join(', ')] }), _jsxs("div", { className: "text-xs muted-text", children: [d.visibility, d.orgId ? ` • org:${d.orgId}` : '', d.userId ? ` • user:${d.userId}` : ''] })] }), _jsxs("div", { className: "flex items-center gap-4", children: [d.url && _jsx("a", { onClick: () => documentService.recordDownload(d.id), href: d.url, target: "_blank", rel: "noreferrer", className: "text-sm text-primary font-medium underline", children: "Open" }), _jsxs("div", { className: "text-sm muted-text", children: [d.downloadCount || 0, " downloads"] }), _jsx("button", { onClick: () => handleDelete(d.id), className: "icon-action", children: _jsx(Trash, { className: "w-4 h-4" }) })] })] }, d.id))) })] })] }));
};
export default AdminDocuments;
