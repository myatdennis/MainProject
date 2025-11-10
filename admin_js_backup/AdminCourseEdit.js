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
var CourseEditModal_1 = require("../../components/CourseEditModal");
var courseStore_1 = require("../../store/courseStore");
var ToastContext_1 = require("../../context/ToastContext");
var sync_1 = require("../../dal/sync");
var courses_1 = require("../../dal/courses");
var AdminCourseEdit = function () {
    var courseId = (0, react_router_dom_1.useParams)().courseId;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var syncService = (0, sync_1.useSyncService)();
    var _a = (0, react_1.useState)(null), course = _a[0], setCourse = _a[1];
    var _b = (0, react_1.useState)(true), builderOpen = _b[0], setBuilderOpen = _b[1];
    (0, react_1.useEffect)(function () {
        if (!courseId)
            return;
        setCourse(courseStore_1.courseStore.getCourse(courseId) || null);
    }, [courseId]);
    var handleSave = function (updatedCourse) { return __awaiter(void 0, void 0, void 0, function () {
        var snapshot, finalCourse, err_1, errorMessage, errorDetails, fullMessage;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, courses_1.syncCourseToDatabase)(__assign(__assign({}, updatedCourse), { lastUpdated: new Date().toISOString() }))];
                case 1:
                    snapshot = _c.sent();
                    finalCourse = (snapshot !== null && snapshot !== void 0 ? snapshot : updatedCourse);
                    courseStore_1.courseStore.saveCourse(finalCourse, { skipRemoteSync: true });
                    syncService.logEvent({
                        type: 'course_updated',
                        data: finalCourse,
                        timestamp: Date.now(),
                    });
                    showToast('Course updated', 'success');
                    setBuilderOpen(false);
                    setCourse(courseStore_1.courseStore.getCourse(finalCourse.id) || null);
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _c.sent();
                    if (err_1 instanceof courses_1.CourseValidationError) {
                        showToast("Update failed: ".concat(err_1.issues.join(' • ')), 'error');
                    }
                    else {
                        console.error('Failed to update course', err_1);
                        errorMessage = (err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || ((_a = err_1 === null || err_1 === void 0 ? void 0 : err_1.body) === null || _a === void 0 ? void 0 : _a.error) || 'Could not update course. Please try again.';
                        errorDetails = (_b = err_1 === null || err_1 === void 0 ? void 0 : err_1.body) === null || _b === void 0 ? void 0 : _b.details;
                        fullMessage = errorDetails ? "".concat(errorMessage, ": ").concat(errorDetails) : errorMessage;
                        showToast(fullMessage, 'error');
                    }
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    if (!course) {
        return ((0, jsx_runtime_1.jsxs)(Card_1.default, { tone: "muted", className: "flex flex-col items-start gap-4", children: [(0, jsx_runtime_1.jsx)("span", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-sunrise/10 text-sunrise", children: (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Course not found" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-sm text-slate/80", children: "The course you\u2019re trying to edit may have been removed. Return to the course list to create a new one." })] }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "ghost", size: "sm", onClick: function () { return navigate('/admin/courses'); }, children: "Back to courses" })] }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-8", children: [(0, jsx_runtime_1.jsxs)(Card_1.default, { tone: "muted", className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Badge_1.default, { tone: "info", className: "mb-2 bg-skyblue/10 text-skyblue", children: "Editing" }), (0, jsx_runtime_1.jsx)("h1", { className: "font-heading text-3xl font-bold text-charcoal", children: course.title }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 max-w-2xl text-sm text-slate/80", children: "Update the outline, refresh lesson content, or publish changes. Autosave keeps edits safe every ten seconds." })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-3", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { size: "sm", onClick: function () { return setBuilderOpen(true); }, children: "Reopen builder" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "ghost", size: "sm", onClick: function () { return navigate("/admin/courses/".concat(course.id, "/details")); }, children: "View course details" })] })] }), (0, jsx_runtime_1.jsx)(CourseEditModal_1.default, { isOpen: builderOpen, onClose: function () { return setBuilderOpen(false); }, onSave: handleSave, course: course, mode: "edit" })] }));
};
exports.default = AdminCourseEdit;
