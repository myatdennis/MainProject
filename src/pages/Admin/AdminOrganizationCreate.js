import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { createOrg } from '../../dal/orgs';
const AdminOrganizationCreate = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [type, setType] = useState('Corporate');
    const [contactPerson, setContactPerson] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [status, setStatus] = useState('active');
    const [saving, setSaving] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const created = await createOrg({ name, type, contactPerson, contactEmail, status });
            navigate(`/admin/organizations/${created.id}`);
        }
        catch (err) {
            console.error('Failed to create org', err);
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("div", { className: "p-6 max-w-3xl mx-auto", children: [_jsxs("div", { className: "mb-6 flex items-center space-x-3", children: [_jsx("div", { className: "bg-green-50 p-2 rounded", children: _jsx(Plus, { className: "h-6 w-6 text-green-600" }) }), _jsx("h1", { className: "text-2xl font-bold", children: "Create Organization" })] }), _jsx("form", { onSubmit: handleSubmit, className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: _jsxs("div", { className: "grid grid-cols-1 gap-4", children: [_jsx("input", { value: name, onChange: e => setName(e.target.value), placeholder: "Organization name", className: "p-3 border rounded" }), _jsx("input", { value: type, onChange: e => setType(e.target.value), placeholder: "Type (e.g. Corporate)", className: "p-3 border rounded" }), _jsx("input", { value: contactPerson, onChange: e => setContactPerson(e.target.value), placeholder: "Contact person", className: "p-3 border rounded" }), _jsx("input", { value: contactEmail, onChange: e => setContactEmail(e.target.value), placeholder: "Contact email", className: "p-3 border rounded" }), _jsxs("select", { value: status, onChange: e => setStatus(e.target.value), className: "p-3 border rounded", children: [_jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" })] }), _jsx("div", { className: "flex items-center justify-end", children: _jsx("button", { type: "submit", disabled: saving, className: "bg-orange-500 text-white px-4 py-2 rounded-lg", children: saving ? 'Creating...' : 'Create Organization' }) })] }) })] }));
};
export default AdminOrganizationCreate;
