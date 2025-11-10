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
var lucide_react_1 = require("lucide-react");
var orgs_1 = require("../../dal/orgs");
var AdminOrganizationCreate = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)(''), name = _a[0], setName = _a[1];
    var _b = (0, react_1.useState)('Corporate'), type = _b[0], setType = _b[1];
    var _c = (0, react_1.useState)(''), contactPerson = _c[0], setContactPerson = _c[1];
    var _d = (0, react_1.useState)(''), contactEmail = _d[0], setContactEmail = _d[1];
    var _e = (0, react_1.useState)('active'), status = _e[0], setStatus = _e[1];
    var _f = (0, react_1.useState)(false), saving = _f[0], setSaving = _f[1];
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var created, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setSaving(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, orgs_1.createOrg)({ name: name, type: type, contactPerson: contactPerson, contactEmail: contactEmail, status: status })];
                case 2:
                    created = _a.sent();
                    navigate("/admin/organizations/".concat(created.id));
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    console.error('Failed to create org', err_1);
                    return [3 /*break*/, 5];
                case 4:
                    setSaving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-3xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-6 flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-green-50 p-2 rounded", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-6 w-6 text-green-600" }) }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold", children: "Create Organization" })] }), (0, jsx_runtime_1.jsx)("form", { onSubmit: handleSubmit, className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 gap-4", children: [(0, jsx_runtime_1.jsx)("input", { value: name, onChange: function (e) { return setName(e.target.value); }, placeholder: "Organization name", className: "p-3 border rounded" }), (0, jsx_runtime_1.jsx)("input", { value: type, onChange: function (e) { return setType(e.target.value); }, placeholder: "Type (e.g. Corporate)", className: "p-3 border rounded" }), (0, jsx_runtime_1.jsx)("input", { value: contactPerson, onChange: function (e) { return setContactPerson(e.target.value); }, placeholder: "Contact person", className: "p-3 border rounded" }), (0, jsx_runtime_1.jsx)("input", { value: contactEmail, onChange: function (e) { return setContactEmail(e.target.value); }, placeholder: "Contact email", className: "p-3 border rounded" }), (0, jsx_runtime_1.jsxs)("select", { value: status, onChange: function (e) { return setStatus(e.target.value); }, className: "p-3 border rounded", children: [(0, jsx_runtime_1.jsx)("option", { value: "active", children: "Active" }), (0, jsx_runtime_1.jsx)("option", { value: "inactive", children: "Inactive" })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-end", children: (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: saving, className: "bg-orange-500 text-white px-4 py-2 rounded-lg", children: saving ? 'Creating...' : 'Create Organization' }) })] }) })] }));
};
exports.default = AdminOrganizationCreate;
