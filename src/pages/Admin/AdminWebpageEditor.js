import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
const AdminWebpageEditor = () => {
    const [textItems, setTextItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    useEffect(() => {
        api('/api/text-content')
            .then(res => res.json())
            .then(data => {
            setTextItems(data);
            setLoading(false);
        })
            .catch(() => {
            setError('Failed to load content');
            setLoading(false);
        });
    }, []);
    const handleChange = (key, value) => {
        setTextItems(items => items.map(item => item.key === key ? { ...item, value } : item));
        setSuccess(false);
        setError(null);
    };
    const handleSave = () => {
        setSaving(true);
        api('/api/text-content', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(textItems)
        })
            .then(res => {
            if (!res.ok)
                throw new Error('Failed to save');
            setSuccess(true);
            setSaving(false);
        })
            .catch(() => {
            setError('Failed to save');
            setSaving(false);
        });
    };
    if (loading)
        return _jsx("div", { children: "Loading..." });
    if (error)
        return _jsx("div", { className: "text-red-500", children: error });
    return (_jsxs("div", { className: "max-w-3xl mx-auto mt-8 p-6 bg-white rounded-lg shadow", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "Edit Website Text" }), _jsxs("form", { children: [textItems.map(item => (_jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "font-semibold text-gray-800", children: item.key }), _jsx("textarea", { className: "w-full border rounded mt-2 p-2", value: item.value, onChange: e => handleChange(item.key, e.target.value), rows: 2 })] }, item.key))), _jsx("button", { type: "button", className: "bg-blue-500 text-white px-6 py-2 rounded font-semibold", onClick: handleSave, disabled: saving, children: saving ? "Saving..." : "Save Changes" }), success && _jsx("div", { className: "text-green-500 mt-2", children: "Saved!" }), error && _jsx("div", { className: "text-red-500 mt-2", children: error })] })] }));
};
export default AdminWebpageEditor;
