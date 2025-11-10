import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import documentService from '../../dal/documents';
import { useParams } from 'react-router-dom';
const DocumentsPage = () => {
    const { orgId } = useParams();
    const [docs, setDocs] = useState([]);
    useEffect(() => {
        const load = async () => {
            const list = await documentService.listDocuments({ orgId });
            setDocs(list);
        };
        load();
    }, [orgId]);
    return (_jsxs("div", { className: "container", children: [_jsx("h1", { className: "text-2xl font-bold text-neutral-text mb-4", children: "Shared Documents" }), _jsx("div", { className: "flex flex-col gap-3", children: docs.map(d => (_jsxs("div", { className: "doc-row", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-primary", children: d.name }), _jsxs("div", { className: "text-sm muted-text", children: [d.category, " \u2022 ", d.tags.join(', ')] })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "text-sm muted-text", children: ["Downloads: ", d.downloadCount || 0] }), _jsx("div", { children: d.url ? (_jsx("a", { onClick: () => documentService.recordDownload(d.id), href: d.url, target: "_blank", rel: "noreferrer", className: "text-primary font-medium underline", children: "Open" })) : _jsx("span", { className: "muted-text", children: "No file" }) })] })] }, d.id))) })] }));
};
export default DocumentsPage;
