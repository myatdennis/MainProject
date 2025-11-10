"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var Button_1 = require("../../components/ui/Button");
var Breadcrumbs_1 = require("../../components/ui/Breadcrumbs");
var ToastContext_1 = require("../../context/ToastContext");
var apiClient_1 = require("../../utils/apiClient");
var lucide_react_1 = require("lucide-react");
var readFileAsText = function (file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { return reject(new Error('Failed to read file')); };
        reader.onload = function () { return resolve(String(reader.result || '')); };
        reader.readAsText(file);
    });
};
var slugify = function (s) {
    if (s === void 0) { s = ''; }
    return String(s)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);
};
// Minimal CSV parser (no quotes/escapes). Accepts header row.
var parseCsvSimple = function (text) {
    var lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
    if (lines.length === 0)
        return [];
    var headers = lines[0].split(',').map(function (h) { return h.trim(); });
    return lines.slice(1).map(function (line) {
        var cols = line.split(',');
        var obj = {};
        headers.forEach(function (h, i) { var _a; return (obj[h] = ((_a = cols[i]) !== null && _a !== void 0 ? _a : '').trim()); });
        return obj;
    });
};
var groupCsvToImportItems = function (rows) {
    // Expected columns (flexible): course_title, course_slug?, course_description, module_title, module_order, lesson_title, lesson_type, lesson_order, lesson_duration_s
    var byCourse = {};
    rows.forEach(function (r) {
        var title = r.course_title || r.course || r.courseName || r.course_title_text || '';
        if (!title)
            return;
        var key = (r.course_slug || slugify(title)).toLowerCase();
        if (!byCourse[key])
            byCourse[key] = { title: title, description: r.course_description || '', slug: r.course_slug || slugify(title), rows: [] };
        byCourse[key].rows.push(r);
    });
    var items = [];
    Object.values(byCourse).forEach(function (c) {
        var _a;
        var modulesMap = new Map();
        c.rows.forEach(function (r) {
            var modTitle = r.module_title || 'Module';
            var modOrder = Number.parseInt(r.module_order || '', 10);
            var mKey = "".concat(modTitle, "|").concat(Number.isFinite(modOrder) ? modOrder : '');
            if (!modulesMap.has(mKey)) {
                modulesMap.set(mKey, {
                    title: modTitle,
                    description: r.module_description || undefined,
                    order_index: Number.isFinite(modOrder) ? modOrder : undefined,
                    lessons: [],
                });
            }
            var lessons = modulesMap.get(mKey).lessons;
            var lOrder = Number.parseInt(r.lesson_order || '', 10);
            var duration_s = Number.parseInt(r.lesson_duration_s || r.lesson_duration || '', 10);
            lessons.push({
                title: r.lesson_title || 'Lesson',
                description: r.lesson_description || undefined,
                type: (r.lesson_type || 'text').toLowerCase(),
                order_index: Number.isFinite(lOrder) ? lOrder : undefined,
                duration_s: Number.isFinite(duration_s) ? duration_s : undefined,
                content: {},
            });
        });
        var modules = Array.from(modulesMap.values());
        items.push({
            course: {
                title: c.title,
                slug: c.slug,
                description: (_a = c.description) !== null && _a !== void 0 ? _a : '',
                status: 'draft',
                meta: {},
            },
            modules: modules,
        });
    });
    return items;
};
var AdminCoursesImport = function () {
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)(false), dragActive = _a[0], setDragActive = _a[1];
    var _b = (0, react_1.useState)(null), fileName = _b[0], setFileName = _b[1];
    var _c = (0, react_1.useState)([]), items = _c[0], setItems = _c[1];
    var _d = (0, react_1.useState)(new Set()), existingSlugs = _d[0], setExistingSlugs = _d[1];
    var _e = (0, react_1.useState)(false), importing = _e[0], setImporting = _e[1];
    var inputRef = (0, react_1.useRef)(null);
    var loadExisting = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var res, slugs_1, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, apiClient_1.default)('/api/admin/courses', { noTransform: true })];
                case 1:
                    res = _a.sent();
                    slugs_1 = new Set();
                    (res.data || []).forEach(function (c) {
                        var s = (c.slug || c.id || '').toString().toLowerCase();
                        if (s)
                            slugs_1.add(s);
                    });
                    setExistingSlugs(slugs_1);
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, []);
    react_1.default.useEffect(function () {
        void loadExisting();
    }, [loadExisting]);
    var onFiles = (0, react_1.useCallback)(function (files) { return __awaiter(void 0, void 0, void 0, function () {
        var file, text, parsed, json, arr, rows, e_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!files || files.length === 0)
                        return [2 /*return*/];
                    file = files[0];
                    setFileName(file.name);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, readFileAsText(file)];
                case 2:
                    text = _b.sent();
                    parsed = [];
                    if (file.name.toLowerCase().endsWith('.json')) {
                        json = JSON.parse(text);
                        arr = Array.isArray(json) ? json : (_a = json.courses) !== null && _a !== void 0 ? _a : [json];
                        parsed = (arr || []).map(function (c) {
                            var _a, _b, _c, _d, _e, _f, _g;
                            var mapped = {
                                course: {
                                    id: c.id,
                                    slug: c.slug || slugify(c.title || c.id || ''),
                                    title: c.title,
                                    description: (_a = c.description) !== null && _a !== void 0 ? _a : null,
                                    status: c.status || 'draft',
                                    version: c.version || 1,
                                    meta: {
                                        difficulty: (_b = c.difficulty) !== null && _b !== void 0 ? _b : null,
                                        estimated_duration: (_c = c.estimatedDuration) !== null && _c !== void 0 ? _c : null,
                                        tags: (_d = c.tags) !== null && _d !== void 0 ? _d : [],
                                        key_takeaways: (_e = c.keyTakeaways) !== null && _e !== void 0 ? _e : [],
                                        thumbnail: (_f = c.thumbnail) !== null && _f !== void 0 ? _f : null,
                                        external_id: (_g = c.external_id) !== null && _g !== void 0 ? _g : undefined,
                                    },
                                },
                                modules: (c.modules || []).map(function (m, mi) {
                                    var _a;
                                    return ({
                                        id: m.id,
                                        title: m.title || "Module ".concat(mi + 1),
                                        description: (_a = m.description) !== null && _a !== void 0 ? _a : null,
                                        order_index: Number.isFinite(m.order) ? m.order : mi,
                                        lessons: (m.lessons || []).map(function (l, li) {
                                            var _a, _b, _c, _d;
                                            return ({
                                                id: l.id,
                                                title: l.title || "Lesson ".concat(li + 1),
                                                description: (_a = l.description) !== null && _a !== void 0 ? _a : null,
                                                type: l.type === 'document' ? 'resource' : l.type,
                                                order_index: Number.isFinite(l.order) ? l.order : li,
                                                duration_s: (_b = l.duration_s) !== null && _b !== void 0 ? _b : null,
                                                content: l.content || {},
                                                completion_rule_json: (_d = (_c = l.completion_rule_json) !== null && _c !== void 0 ? _c : l.completionRule) !== null && _d !== void 0 ? _d : null,
                                            });
                                        }),
                                    });
                                }),
                            };
                            return mapped;
                        });
                    }
                    else if (file.name.toLowerCase().endsWith('.csv')) {
                        rows = parseCsvSimple(text);
                        parsed = groupCsvToImportItems(rows);
                    }
                    else if (file.name.toLowerCase().endsWith('.zip')) {
                        showToast('SCORM packages are not yet supported in this demo. Please upload JSON or CSV.', 'error');
                        return [2 /*return*/];
                    }
                    else {
                        showToast('Unsupported file type. Please upload JSON or CSV.', 'error');
                        return [2 /*return*/];
                    }
                    setItems(parsed);
                    showToast("Parsed ".concat(parsed.length, " course(s)"), 'success');
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _b.sent();
                    showToast("Failed to parse file: ".concat((e_2 === null || e_2 === void 0 ? void 0 : e_2.message) || 'Unknown error'), 'error');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [showToast]);
    var onDrop = (0, react_1.useCallback)(function (e) {
        var _a;
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        var files = ((_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.files) || null;
        void onFiles(files);
    }, [onFiles]);
    var onDragOver = function (e) {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };
    var onDragLeave = function (e) {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };
    var summary = (0, react_1.useMemo)(function () {
        return items.map(function (it) {
            var _a, _b, _c;
            return ({
                title: ((_a = it.course) === null || _a === void 0 ? void 0 : _a.title) || '(untitled)',
                slug: (_b = it.course) === null || _b === void 0 ? void 0 : _b.slug,
                action: ((_c = it.course) === null || _c === void 0 ? void 0 : _c.slug) && existingSlugs.has(String(it.course.slug).toLowerCase()) ? 'update' : 'create',
            });
        });
    }, [items, existingSlugs]);
    var startImport = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var payload, res, count, e_3, msg;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (items.length === 0)
                        return [2 /*return*/];
                    setImporting(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    payload = { items: items };
                    return [4 /*yield*/, (0, apiClient_1.default)('/api/admin/courses/import', { method: 'POST', body: JSON.stringify(payload), noTransform: true })];
                case 2:
                    res = _b.sent();
                    count = Array.isArray(res === null || res === void 0 ? void 0 : res.data) ? res.data.length : items.length;
                    showToast("Imported ".concat(count, " course(s) successfully"), 'success');
                    navigate('/admin/courses');
                    return [3 /*break*/, 5];
                case 3:
                    e_3 = _b.sent();
                    msg = ((_a = e_3 === null || e_3 === void 0 ? void 0 : e_3.body) === null || _a === void 0 ? void 0 : _a.error) || (e_3 === null || e_3 === void 0 ? void 0 : e_3.message) || 'Import failed';
                    showToast(msg, 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setImporting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [items, navigate, showToast]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-6xl mx-auto", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6", children: (0, jsx_runtime_1.jsx)(Breadcrumbs_1.default, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Courses', to: '/admin/courses' }, { label: 'Import', to: '/admin/courses/import' }] }) }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold text-gray-900 mb-2", children: "Import Courses" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-6", children: "Upload JSON or CSV to create/update courses. We\u2019ll preview changes before saving." }), (0, jsx_runtime_1.jsx)("div", { className: "bg-white p-6 rounded-lg shadow-sm border ".concat(dragActive ? 'border-sky-400 ring-2 ring-sky-200' : 'border-gray-200'), onDrop: onDrop, onDragOver: onDragOver, onDragLeave: onDragLeave, children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center flex-col text-center py-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-3 text-gray-500", children: (fileName === null || fileName === void 0 ? void 0 : fileName.endsWith('.csv')) ? ((0, jsx_runtime_1.jsx)(lucide_react_1.FileSpreadsheet, { className: "h-10 w-10" })) : (fileName === null || fileName === void 0 ? void 0 : fileName.endsWith('.json')) ? ((0, jsx_runtime_1.jsx)(lucide_react_1.FileJson, { className: "h-10 w-10" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.UploadCloud, { className: "h-10 w-10" })) }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-gray-600 mb-2", children: ["Drag & drop a JSON or CSV file here, or", (0, jsx_runtime_1.jsx)("button", { onClick: function () { var _a; return (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "ml-1 text-orange-600 hover:underline", type: "button", children: "browse" })] }), (0, jsx_runtime_1.jsx)("input", { type: "file", accept: ".json,.csv", ref: inputRef, className: "hidden", onChange: function (e) { return void onFiles(e.target.files); } }), fileName && (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-500", children: ["Selected: ", fileName] })] }) }), items.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-8", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-gray-900 mb-3", children: "Pre-import summary" }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-hidden rounded-lg border border-gray-200", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full bg-white", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-gray-50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "text-left py-2 px-4 text-sm font-medium text-gray-700", children: "Course" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left py-2 px-4 text-sm font-medium text-gray-700", children: "Slug" }), (0, jsx_runtime_1.jsx)("th", { className: "text-left py-2 px-4 text-sm font-medium text-gray-700", children: "Action" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: summary.map(function (row, idx) { return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-gray-100", children: [(0, jsx_runtime_1.jsxs)("td", { className: "py-2 px-4 text-sm text-gray-900 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BookOpen, { className: "h-4 w-4 text-gray-400" }), " ", row.title] }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 px-4 text-sm text-gray-600", children: row.slug || '-' }), (0, jsx_runtime_1.jsx)("td", { className: "py-2 px-4 text-sm", children: row.action === 'create' ? ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-full", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-4 w-4" }), " Create"] })) : ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1 text-sky-700 bg-sky-50 px-2 py-1 rounded-full", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle2, { className: "h-4 w-4" }), " Update"] })) })] }, idx)); }) })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-500", children: "We\u2019ll upsert by slug and preserve stable IDs when possible." }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: function () { return setItems([]); }, disabled: importing, children: "Clear" }), (0, jsx_runtime_1.jsx)(Button_1.default, { onClick: startImport, disabled: importing, children: importing ? 'Importing…' : 'Import courses' })] })] })] })), items.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-6 text-sm text-gray-600", children: [(0, jsx_runtime_1.jsx)("p", { className: "mb-2", children: "JSON shape (preferred):" }), (0, jsx_runtime_1.jsx)("pre", { className: "bg-gray-50 p-3 rounded border border-gray-200 overflow-auto text-xs", children: "{\n  \"courses\": [\n    {\n      \"title\": \"My Course\",\n      \"slug\": \"my-course\",\n      \"description\": \"...\",\n      \"status\": \"draft\",\n      \"modules\": [\n        {\n          \"title\": \"Module 1\",\n          \"order\": 1,\n          \"lessons\": [\n            { \"type\": \"text\", \"title\": \"Intro\", \"order\": 1 },\n            { \"type\": \"quiz\", \"title\": \"Check\", \"order\": 2 }\n          ]\n        }\n      ]\n    }\n  ]\n}" })] })), (0, jsx_runtime_1.jsx)("div", { className: "mt-8 text-right", children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/courses", className: "text-sm text-orange-600 hover:underline", children: "\u2190 Back to Courses" }) })] }));
};
exports.default = AdminCoursesImport;
