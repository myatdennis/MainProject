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
var lucide_react_1 = require("lucide-react");
var documents_1 = require("../../dal/documents");
var notifications_1 = require("../../dal/notifications");
var ToastContext_1 = require("../../context/ToastContext");
var AdminDocuments = function () {
    var _a = (0, react_1.useState)([]), docs = _a[0], setDocs = _a[1];
    var _b = (0, react_1.useState)(''), name = _b[0], setName = _b[1];
    var _c = (0, react_1.useState)('Training'), category = _c[0], setCategory = _c[1];
    var _d = (0, react_1.useState)(''), subcategory = _d[0], setSubcategory = _d[1];
    var _e = (0, react_1.useState)(''), tags = _e[0], setTags = _e[1];
    var _f = (0, react_1.useState)('global'), visibility = _f[0], setVisibility = _f[1];
    var _g = (0, react_1.useState)(''), orgId = _g[0], setOrgId = _g[1];
    var _h = (0, react_1.useState)(''), userId = _h[0], setUserId = _h[1];
    var _j = (0, react_1.useState)(null), file = _j[0], setFile = _j[1];
    var inputRef = (0, react_1.useRef)(null);
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var load = function () { return __awaiter(void 0, void 0, void 0, function () {
        var list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, documents_1.default.listDocuments()];
                case 1:
                    list = _a.sent();
                    setDocs(list || []);
                    return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () { load(); }, []);
    var onFile = function (f) { return setFile(f); };
    var handleUpload = function () { return __awaiter(void 0, void 0, void 0, function () {
        var url, doc;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!file && !name) {
                        showToast('Provide a name or file', 'error');
                        return [2 /*return*/];
                    }
                    if (!file) return [3 /*break*/, 2];
                    return [4 /*yield*/, new Promise(function (res, rej) {
                            var r = new FileReader();
                            r.onload = function () { return res(String(r.result)); };
                            r.onerror = rej;
                            r.readAsDataURL(file);
                        })];
                case 1:
                    // read as data URL for local dev (replace with real upload in production)
                    url = _a.sent();
                    _a.label = 2;
                case 2: return [4 /*yield*/, documents_1.default.addDocument({
                        name: name || file.name,
                        filename: file === null || file === void 0 ? void 0 : file.name,
                        url: url,
                        category: category,
                        subcategory: subcategory || undefined,
                        tags: tags ? tags.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [],
                        fileType: file === null || file === void 0 ? void 0 : file.type,
                        visibility: visibility,
                        orgId: visibility === 'org' ? orgId : undefined,
                        userId: visibility === 'user' ? userId : undefined,
                        createdBy: 'Admin'
                    }, file || undefined)];
                case 3:
                    doc = _a.sent();
                    if (!(visibility === 'org' && orgId)) return [3 /*break*/, 5];
                    return [4 /*yield*/, notifications_1.default.addNotification({ title: 'New Document Shared', body: "A document \"".concat(doc.name, "\" was shared with your organization."), orgId: orgId })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    if (!(visibility === 'user' && userId)) return [3 /*break*/, 7];
                    return [4 /*yield*/, notifications_1.default.addNotification({ title: 'New Document Shared', body: "A document \"".concat(doc.name, "\" was shared with you."), userId: userId })];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7:
                    setName('');
                    setFile(null);
                    setTags('');
                    setOrgId('');
                    setUserId('');
                    load();
                    return [2 /*return*/];
            }
        });
    }); };
    var handleDelete = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!confirm('Delete document?'))
                        return [2 /*return*/];
                    return [4 /*yield*/, documents_1.default.deleteDocument(id)];
                case 1:
                    _a.sent();
                    load();
                    showToast('Document deleted', 'success');
                    return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "container", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold text-neutral-text", children: "Document Library" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.FilePlus, { className: "w-6 h-6 text-primary" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm muted-text", children: "Upload and manage documents" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-md mb-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium muted-text block mb-2", children: "Name" }), (0, jsx_runtime_1.jsx)("input", { className: "input", value: name, onChange: function (e) { return setName(e.target.value); } })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium muted-text block mb-2", children: "Category" }), (0, jsx_runtime_1.jsx)("input", { className: "input", value: category, onChange: function (e) { return setCategory(e.target.value); } })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium muted-text block mb-2", children: "Subcategory" }), (0, jsx_runtime_1.jsx)("input", { className: "input", value: subcategory, onChange: function (e) { return setSubcategory(e.target.value); } })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mt-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium muted-text block mb-2", children: "Tags (comma separated)" }), (0, jsx_runtime_1.jsx)("input", { className: "input", value: tags, onChange: function (e) { return setTags(e.target.value); } })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium muted-text block mb-2", children: "Visibility" }), (0, jsx_runtime_1.jsxs)("select", { className: "input", value: visibility, onChange: function (e) { return setVisibility(e.target.value); }, children: [(0, jsx_runtime_1.jsx)("option", { value: "global", children: "Global" }), (0, jsx_runtime_1.jsx)("option", { value: "org", children: "Organization" }), (0, jsx_runtime_1.jsx)("option", { value: "user", children: "User" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium muted-text block mb-2", children: "Org ID / User ID" }), (0, jsx_runtime_1.jsx)("input", { className: "input", placeholder: "orgId or userId", value: visibility === 'org' ? orgId : userId, onChange: function (e) { return visibility === 'org' ? setOrgId(e.target.value) : setUserId(e.target.value); } })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium muted-text block mb-2", children: "File" }), (0, jsx_runtime_1.jsxs)("div", { className: "border-dashed p-6 rounded-lg", style: { border: '2px dashed var(--input-border)' }, children: [(0, jsx_runtime_1.jsx)("input", { ref: inputRef, type: "file", onChange: function (e) { var _a; return onFile(((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0]) || null); }, style: { display: 'none' } }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center gap-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.UploadCloud, { className: "w-5 h-5 muted-text" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { var _a; return (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "text-sm text-primary", children: "Choose file" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm muted-text", children: "or drag and drop (not implemented)" })] }), file && (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 text-sm text-neutral-text", children: ["Selected: ", file.name, " ", (0, jsx_runtime_1.jsx)("button", { onClick: function () { return setFile(null); }, className: "ml-3 text-danger", children: "Remove" })] })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 text-right", children: (0, jsx_runtime_1.jsx)("button", { onClick: handleUpload, className: "btn-primary primary-gradient", children: "Upload" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-md", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-neutral-text mb-4", children: "All Documents" }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col gap-4", children: docs.map(function (d) {
                            var _a;
                            return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between border p-4 rounded-lg", style: { border: '1px solid var(--card-border)', background: 'var(--card-bg)' }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-primary", children: d.name }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm muted-text", children: [d.category, " \u2022 ", d.subcategory, " \u2022 ", (_a = d.tags) === null || _a === void 0 ? void 0 : _a.join(', ')] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs muted-text", children: [d.visibility, d.orgId ? " \u2022 org:".concat(d.orgId) : '', d.userId ? " \u2022 user:".concat(d.userId) : ''] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4", children: [d.url && (0, jsx_runtime_1.jsx)("a", { onClick: function () { return documents_1.default.recordDownload(d.id); }, href: d.url, target: "_blank", rel: "noreferrer", className: "text-sm text-primary font-medium underline", children: "Open" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm muted-text", children: [d.downloadCount || 0, " downloads"] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleDelete(d.id); }, className: "icon-action", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash, { className: "w-4 h-4" }) })] })] }, d.id));
                        }) })] })] }));
};
exports.default = AdminDocuments;
