import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useToast } from '../../context/ToastContext';
import apiRequest from '../../utils/apiClient';
import { BookOpen, CheckCircle2, FileJson, FileSpreadsheet, UploadCloud } from 'lucide-react';
const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
});
const slugify = (s = '') => String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
// Minimal CSV parser (no quotes/escapes). Accepts header row.
const parseCsvSimple = (text) => {
    const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
    if (lines.length === 0)
        return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const cols = line.split(',');
        const obj = {};
        headers.forEach((h, i) => (obj[h] = (cols[i] ?? '').trim()));
        return obj;
    });
};
const groupCsvToImportItems = (rows) => {
    // Expected columns (flexible): course_title, course_slug?, course_description, module_title, module_order, lesson_title, lesson_type, lesson_order, lesson_duration_s
    const byCourse = {};
    rows.forEach((r) => {
        const title = r.course_title || r.course || r.courseName || r.course_title_text || '';
        if (!title)
            return;
        const key = (r.course_slug || slugify(title)).toLowerCase();
        if (!byCourse[key])
            byCourse[key] = { title, description: r.course_description || '', slug: r.course_slug || slugify(title), rows: [] };
        byCourse[key].rows.push(r);
    });
    const items = [];
    Object.values(byCourse).forEach((c) => {
        const modulesMap = new Map();
        c.rows.forEach((r) => {
            const modTitle = r.module_title || 'Module';
            const modOrder = Number.parseInt(r.module_order || '', 10);
            const mKey = `${modTitle}|${Number.isFinite(modOrder) ? modOrder : ''}`;
            if (!modulesMap.has(mKey)) {
                modulesMap.set(mKey, {
                    title: modTitle,
                    description: r.module_description || undefined,
                    order_index: Number.isFinite(modOrder) ? modOrder : undefined,
                    lessons: [],
                });
            }
            const lessons = modulesMap.get(mKey).lessons;
            const lOrder = Number.parseInt(r.lesson_order || '', 10);
            const duration_s = Number.parseInt(r.lesson_duration_s || r.lesson_duration || '', 10);
            lessons.push({
                title: r.lesson_title || 'Lesson',
                description: r.lesson_description || undefined,
                type: (r.lesson_type || 'text').toLowerCase(),
                order_index: Number.isFinite(lOrder) ? lOrder : undefined,
                duration_s: Number.isFinite(duration_s) ? duration_s : undefined,
                content: {},
            });
        });
        const modules = Array.from(modulesMap.values());
        items.push({
            course: {
                title: c.title,
                slug: c.slug,
                description: c.description ?? '',
                status: 'draft',
                meta: {},
            },
            modules,
        });
    });
    return items;
};
const AdminCoursesImport = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [dragActive, setDragActive] = useState(false);
    const [fileName, setFileName] = useState(null);
    const [items, setItems] = useState([]);
    const [existingSlugs, setExistingSlugs] = useState(new Set());
    const [importing, setImporting] = useState(false);
    const inputRef = useRef(null);
    const loadExisting = useCallback(async () => {
        try {
            const res = await apiRequest('/api/admin/courses', { noTransform: true });
            const slugs = new Set();
            (res.data || []).forEach((c) => {
                const s = (c.slug || c.id || '').toString().toLowerCase();
                if (s)
                    slugs.add(s);
            });
            setExistingSlugs(slugs);
        }
        catch (e) {
            // non-fatal
        }
    }, []);
    React.useEffect(() => {
        void loadExisting();
    }, [loadExisting]);
    const onFiles = useCallback(async (files) => {
        if (!files || files.length === 0)
            return;
        const file = files[0];
        setFileName(file.name);
        try {
            const text = await readFileAsText(file);
            let parsed = [];
            if (file.name.toLowerCase().endsWith('.json')) {
                const json = JSON.parse(text);
                const arr = Array.isArray(json) ? json : json.courses ?? [json];
                parsed = (arr || []).map((c) => {
                    const mapped = {
                        course: {
                            id: c.id,
                            slug: c.slug || slugify(c.title || c.id || ''),
                            title: c.title,
                            description: c.description ?? null,
                            status: c.status || 'draft',
                            version: c.version || 1,
                            meta: {
                                difficulty: c.difficulty ?? null,
                                estimated_duration: c.estimatedDuration ?? null,
                                tags: c.tags ?? [],
                                key_takeaways: c.keyTakeaways ?? [],
                                thumbnail: c.thumbnail ?? null,
                                external_id: c.external_id ?? undefined,
                            },
                        },
                        modules: (c.modules || []).map((m, mi) => ({
                            id: m.id,
                            title: m.title || `Module ${mi + 1}`,
                            description: m.description ?? null,
                            order_index: Number.isFinite(m.order) ? m.order : mi,
                            lessons: (m.lessons || []).map((l, li) => ({
                                id: l.id,
                                title: l.title || `Lesson ${li + 1}`,
                                description: l.description ?? null,
                                type: l.type === 'document' ? 'resource' : l.type,
                                order_index: Number.isFinite(l.order) ? l.order : li,
                                duration_s: l.duration_s ?? null,
                                content: l.content || {},
                                completion_rule_json: l.completion_rule_json ?? l.completionRule ?? null,
                            })),
                        })),
                    };
                    return mapped;
                });
            }
            else if (file.name.toLowerCase().endsWith('.csv')) {
                const rows = parseCsvSimple(text);
                parsed = groupCsvToImportItems(rows);
            }
            else if (file.name.toLowerCase().endsWith('.zip')) {
                showToast('SCORM packages are not yet supported in this demo. Please upload JSON or CSV.', 'error');
                return;
            }
            else {
                showToast('Unsupported file type. Please upload JSON or CSV.', 'error');
                return;
            }
            setItems(parsed);
            showToast(`Parsed ${parsed.length} course(s)`, 'success');
        }
        catch (e) {
            showToast(`Failed to parse file: ${e?.message || 'Unknown error'}`, 'error');
        }
    }, [showToast]);
    const onDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const files = e.dataTransfer?.files || null;
        void onFiles(files);
    }, [onFiles]);
    const onDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };
    const onDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };
    const summary = useMemo(() => {
        return items.map((it) => ({
            title: it.course?.title || '(untitled)',
            slug: it.course?.slug,
            action: it.course?.slug && existingSlugs.has(String(it.course.slug).toLowerCase()) ? 'update' : 'create',
        }));
    }, [items, existingSlugs]);
    const startImport = useCallback(async () => {
        if (items.length === 0)
            return;
        setImporting(true);
        try {
            const payload = { items };
            const res = await apiRequest('/api/admin/courses/import', { method: 'POST', body: JSON.stringify(payload), noTransform: true });
            const count = Array.isArray(res?.data) ? res.data.length : items.length;
            showToast(`Imported ${count} course(s) successfully`, 'success');
            navigate('/admin/courses');
        }
        catch (e) {
            const msg = e?.body?.error || e?.message || 'Import failed';
            showToast(msg, 'error');
        }
        finally {
            setImporting(false);
        }
    }, [items, navigate, showToast]);
    return (_jsxs("div", { className: "p-6 max-w-6xl mx-auto", children: [_jsx("div", { className: "mb-6", children: _jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Courses', to: '/admin/courses' }, { label: 'Import', to: '/admin/courses/import' }] }) }), _jsx("h1", { className: "text-2xl font-bold text-gray-900 mb-2", children: "Import Courses" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Upload JSON or CSV to create/update courses. We\u2019ll preview changes before saving." }), _jsx("div", { className: `bg-white p-6 rounded-lg shadow-sm border ${dragActive ? 'border-sky-400 ring-2 ring-sky-200' : 'border-gray-200'}`, onDrop: onDrop, onDragOver: onDragOver, onDragLeave: onDragLeave, children: _jsxs("div", { className: "flex items-center justify-center flex-col text-center py-8", children: [_jsx("div", { className: "mb-3 text-gray-500", children: fileName?.endsWith('.csv') ? (_jsx(FileSpreadsheet, { className: "h-10 w-10" })) : fileName?.endsWith('.json') ? (_jsx(FileJson, { className: "h-10 w-10" })) : (_jsx(UploadCloud, { className: "h-10 w-10" })) }), _jsxs("p", { className: "text-sm text-gray-600 mb-2", children: ["Drag & drop a JSON or CSV file here, or", _jsx("button", { onClick: () => inputRef.current?.click(), className: "ml-1 text-orange-600 hover:underline", type: "button", children: "browse" })] }), _jsx("input", { type: "file", accept: ".json,.csv", ref: inputRef, className: "hidden", onChange: (e) => void onFiles(e.target.files) }), fileName && _jsxs("div", { className: "text-xs text-gray-500", children: ["Selected: ", fileName] })] }) }), items.length > 0 && (_jsxs("div", { className: "mt-8", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900 mb-3", children: "Pre-import summary" }), _jsx("div", { className: "overflow-hidden rounded-lg border border-gray-200", children: _jsxs("table", { className: "min-w-full bg-white", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left py-2 px-4 text-sm font-medium text-gray-700", children: "Course" }), _jsx("th", { className: "text-left py-2 px-4 text-sm font-medium text-gray-700", children: "Slug" }), _jsx("th", { className: "text-left py-2 px-4 text-sm font-medium text-gray-700", children: "Action" })] }) }), _jsx("tbody", { children: summary.map((row, idx) => (_jsxs("tr", { className: "border-t border-gray-100", children: [_jsxs("td", { className: "py-2 px-4 text-sm text-gray-900 flex items-center gap-2", children: [_jsx(BookOpen, { className: "h-4 w-4 text-gray-400" }), " ", row.title] }), _jsx("td", { className: "py-2 px-4 text-sm text-gray-600", children: row.slug || '-' }), _jsx("td", { className: "py-2 px-4 text-sm", children: row.action === 'create' ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-full", children: [_jsx(CheckCircle2, { className: "h-4 w-4" }), " Create"] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 text-sky-700 bg-sky-50 px-2 py-1 rounded-full", children: [_jsx(CheckCircle2, { className: "h-4 w-4" }), " Update"] })) })] }, idx))) })] }) }), _jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsx("div", { className: "text-xs text-gray-500", children: "We\u2019ll upsert by slug and preserve stable IDs when possible." }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { variant: "secondary", onClick: () => setItems([]), disabled: importing, children: "Clear" }), _jsx(Button, { onClick: startImport, disabled: importing, children: importing ? 'Importing…' : 'Import courses' })] })] })] })), items.length === 0 && (_jsxs("div", { className: "mt-6 text-sm text-gray-600", children: [_jsx("p", { className: "mb-2", children: "JSON shape (preferred):" }), _jsx("pre", { className: "bg-gray-50 p-3 rounded border border-gray-200 overflow-auto text-xs", children: `{
  "courses": [
    {
      "title": "My Course",
      "slug": "my-course",
      "description": "...",
      "status": "draft",
      "modules": [
        {
          "title": "Module 1",
          "order": 1,
          "lessons": [
            { "type": "text", "title": "Intro", "order": 1 },
            { "type": "quiz", "title": "Check", "order": 2 }
          ]
        }
      ]
    }
  ]
}` })] })), _jsx("div", { className: "mt-8 text-right", children: _jsx(Link, { to: "/admin/courses", className: "text-sm text-orange-600 hover:underline", children: "\u2190 Back to Courses" }) })] }));
};
export default AdminCoursesImport;
