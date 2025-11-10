import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
const StrategicPlansPage = () => {
    const { orgId } = useParams();
    const [versions, setVersions] = useState([]);
    const [editor, setEditor] = useState('');
    useEffect(() => {
        if (!orgId)
            return;
        (async () => {
            const svc = await import('../../services/clientWorkspaceService');
            const list = await svc.listStrategicPlans(orgId);
            setVersions(list);
        })();
    }, [orgId]);
    const save = async () => {
        if (!orgId)
            return;
        const svc = await import('../../services/clientWorkspaceService');
        await svc.addStrategicPlanVersion(orgId, editor, 'Huddle Co.');
        const v = await svc.listStrategicPlans(orgId);
        setVersions(v);
        setEditor('');
    };
    const remove = async (id) => {
        if (!orgId)
            return;
        const svc = await import('../../services/clientWorkspaceService');
        await svc.deleteStrategicPlanVersion(orgId, id);
        setVersions(await svc.listStrategicPlans(orgId));
    };
    const restore = async (id) => {
        if (!orgId)
            return;
        const { getStrategicPlanVersion, addStrategicPlanVersion } = await import('../../services/clientWorkspaceService');
        const v = await getStrategicPlanVersion(orgId, id);
        if (v) {
            // when restoring, we create a new version from the selected content
            await addStrategicPlanVersion(orgId, v.content, 'Restored Version');
            const svc = await import('../../services/clientWorkspaceService');
            setVersions(await svc.listStrategicPlans(orgId));
        }
    };
    return (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Strategic Plan Drafts" }), _jsxs("div", { className: "mb-4", children: [_jsx("textarea", { className: "w-full p-3 border rounded", rows: 8, value: editor, onChange: (e) => setEditor(e.target.value), placeholder: "Paste or write your strategic plan draft here (markdown supported)" }), _jsx("div", { className: "flex justify-end mt-2", children: _jsx("button", { onClick: save, className: "bg-orange-500 text-white px-4 py-2 rounded", children: "Save Version" }) })] }), _jsxs("div", { className: "bg-white rounded shadow p-4", children: [_jsx("h3", { className: "font-semibold mb-2", children: "Versions" }), versions.length === 0 && _jsx("div", { className: "text-sm text-gray-500", children: "No versions yet." }), _jsx("ul", { className: "space-y-3", children: versions.map(v => (_jsxs("li", { className: "border p-3 rounded", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-600", children: [new Date(v.createdAt).toLocaleString(), " \u2022 ", v.createdBy] }), _jsxs("div", { className: "space-x-2", children: [_jsx("button", { onClick: () => restore(v.id), className: "text-sm text-blue-600", children: "Restore" }), _jsx("button", { onClick: () => remove(v.id), className: "text-sm text-red-600", children: "Delete" })] })] }), _jsx("div", { className: "mt-2 prose max-w-none", dangerouslySetInnerHTML: { __html: v.content } })] }, v.id))) })] })] }));
};
export default StrategicPlansPage;
