"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var Card_1 = require("../../components/ui/Card");
var Button_1 = require("../../components/ui/Button");
var Badge_1 = require("../../components/ui/Badge");
var Input_1 = require("../../components/ui/Input");
var courseStore_1 = require("../../store/courseStore");
var ToastContext_1 = require("../../context/ToastContext");
var sync_1 = require("../../dal/sync");
var assignmentStorage_1 = require("../../utils/assignmentStorage");
var AdminCourseAssign = function () {
    var courseId = (0, react_router_dom_1.useParams)().courseId;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var syncService = (0, sync_1.useSyncService)();
    var course = (0, react_1.useMemo)(function () { return (courseId ? courseStore_1.courseStore.getCourse(courseId) : null); }, [courseId]);
    var _a = (0, react_1.useState)(''), emails = _a[0], setEmails = _a[1];
    var _b = (0, react_1.useState)(''), dueDate = _b[0], setDueDate = _b[1];
    var _c = (0, react_1.useState)(''), note = _c[0], setNote = _c[1];
    var _d = (0, react_1.useState)(false), submitting = _d[0], setSubmitting = _d[1];
    if (!course) {
        return ((0, jsx_runtime_1.jsxs)(Card_1.default, { tone: "muted", className: "flex flex-col items-start gap-4", children: [(0, jsx_runtime_1.jsx)("span", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-sunrise/10 text-sunrise", children: (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Course not found" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-sm text-slate/80", children: "Choose another course to assign from the course list." })] }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "ghost", size: "sm", onClick: function () { return navigate('/admin/courses'); }, children: "Back to courses" })] }));
    }
    var handleAssign = function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var assignees, assignments, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    assignees = emails
                        .split(/[\n,]/)
                        .map(function (email) { return email.trim().toLowerCase(); })
                        .filter(Boolean);
                    if (assignees.length === 0) {
                        showToast('Add at least one email or user ID', 'error');
                        return [2 /*return*/];
                    }
                    setSubmitting(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, assignmentStorage_1.addAssignments)(course.id, assignees, { dueDate: dueDate, note: note })];
                case 2:
                    assignments = _a.sent();
                    courseStore_1.courseStore.saveCourse(__assign(__assign({}, course), { enrollments: (course.enrollments || 0) + assignments.length, lastUpdated: new Date().toISOString() }), { skipRemoteSync: true });
                    assignments.forEach(function (record) {
                        syncService.logEvent({
                            type: 'assignment_created',
                            data: record,
                            timestamp: Date.now(),
                            courseId: record.courseId,
                            userId: record.userId,
                            source: 'admin',
                        });
                        // Log a secondary event for UX hooks; cast to any to allow custom event type without widening core union
                        syncService.logEvent({
                            type: 'course_assigned',
                            data: record,
                            timestamp: Date.now(),
                        });
                    });
                    showToast("Assigned to ".concat(assignments.length, " learner(s)"), 'success');
                    navigate('/admin/courses');
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    console.error(error_1);
                    showToast('Unable to assign course right now', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setSubmitting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsx)("div", { className: "space-y-8", children: (0, jsx_runtime_1.jsxs)(Card_1.default, { tone: "muted", className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Badge_1.default, { tone: "info", className: "mb-2 bg-skyblue/10 text-skyblue", children: "Assign Course" }), (0, jsx_runtime_1.jsxs)("h1", { className: "font-heading text-3xl font-bold text-charcoal", children: ["Share \u201C", course.title, "\u201D with learners"] }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 max-w-2xl text-sm text-slate/80", children: "Enter email addresses or user IDs to invite learners. Assignments sync to analytics so you can track progress." })] })] }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleAssign, className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-semibold text-charcoal", children: "Learner emails or IDs *" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate/70", children: "Separate multiple entries with commas or line breaks." }), (0, jsx_runtime_1.jsx)("textarea", { value: emails, onChange: function (event) { return setEmails(event.target.value); }, className: "mt-2 h-32 w-full rounded-xl border border-mist px-4 py-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-skyblue focus:ring-offset-2 focus:ring-offset-softwhite", placeholder: "mya@thehuddleco.com\nteam@inclusive.org", required: true })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-semibold text-charcoal", children: "Due date (optional)" }), (0, jsx_runtime_1.jsx)(Input_1.default, { type: "date", value: dueDate, onChange: function (event) { return setDueDate(event.target.value); } })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-semibold text-charcoal", children: "Notes to learners" }), (0, jsx_runtime_1.jsx)("textarea", { value: note, onChange: function (event) { return setNote(event.target.value); }, className: "mt-2 h-24 w-full rounded-xl border border-mist px-4 py-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-skyblue focus:ring-offset-2 focus:ring-offset-softwhite", placeholder: "Highlight key outcomes or include login instructions." })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { type: "submit", size: "sm", disabled: submitting, leadingIcon: (0, jsx_runtime_1.jsx)(lucide_react_1.Send, { className: "h-4 w-4" }), children: submitting ? 'Assigning…' : 'Assign course' }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "ghost", size: "sm", onClick: function () { return navigate('/admin/courses'); }, children: "Cancel" })] })] })] }) }));
};
exports.default = AdminCourseAssign;
