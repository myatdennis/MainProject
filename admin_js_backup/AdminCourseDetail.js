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
var courseStore_1 = require("../../store/courseStore");
var courses_1 = require("../../dal/courses");
var ToastContext_1 = require("../../context/ToastContext");
// Removed unused UI imports to satisfy lints
var lucide_react_1 = require("lucide-react");
var AdminCourseDetail = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var courseId = (0, react_router_dom_1.useParams)().courseId;
    var searchParams = (0, react_router_dom_1.useSearchParams)()[0];
    var navigate = (0, react_router_dom_1.useNavigate)();
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var _k = (0, react_1.useState)(searchParams.get('viewMode') === 'learner' ? 'learner' : 'admin'), viewMode = _k[0], setViewMode = _k[1];
    // Get course from store
    var course = courseId ? courseStore_1.courseStore.getCourse(courseId) : null;
    var persistCourse = function (inputCourse, statusOverride) { return __awaiter(void 0, void 0, void 0, function () {
        var prepared, snapshot, finalCourse;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    prepared = __assign(__assign({}, inputCourse), { status: (_a = statusOverride !== null && statusOverride !== void 0 ? statusOverride : inputCourse.status) !== null && _a !== void 0 ? _a : 'draft', lastUpdated: new Date().toISOString(), publishedDate: statusOverride === 'published'
                            ? inputCourse.publishedDate || new Date().toISOString()
                            : inputCourse.publishedDate });
                    return [4 /*yield*/, (0, courses_1.syncCourseToDatabase)(prepared)];
                case 1:
                    snapshot = _b.sent();
                    finalCourse = (snapshot !== null && snapshot !== void 0 ? snapshot : prepared);
                    courseStore_1.courseStore.saveCourse(finalCourse, { skipRemoteSync: true });
                    return [2 /*return*/, finalCourse];
            }
        });
    }); };
    var handleDuplicateCourse = function () { return __awaiter(void 0, void 0, void 0, function () {
        var newId, cloned, persistedClone, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!course)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    newId = "course-".concat(Date.now());
                    cloned = __assign(__assign({}, course), { id: newId, title: "".concat(course.title, " (Copy)"), createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString(), enrollments: 0, completions: 0, completionRate: 0 });
                    return [4 /*yield*/, persistCourse(cloned)];
                case 2:
                    persistedClone = _a.sent();
                    showToast('Course duplicated successfully.', 'success');
                    navigate("/admin/course-builder/".concat(persistedClone.id));
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    if (error_1 instanceof courses_1.CourseValidationError) {
                        showToast("Duplicate failed: ".concat(error_1.issues.join(' • ')), 'error');
                    }
                    else {
                        console.warn('Duplicate failed', error_1);
                        showToast('Unable to duplicate course right now.', 'error');
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    if (!course) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-4xl mx-auto text-center", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Course Not Found" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-6", children: "The course you're looking for doesn't exist or has been removed." }), (0, jsx_runtime_1.jsxs)(react_router_dom_1.Link, { to: "/admin/courses", className: "inline-flex items-center text-orange-500 hover:text-orange-600 font-medium", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Course Management"] })] }));
    }
    var getStatusColor = function (status) {
        switch (status) {
            case 'published':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-yellow-100 text-yellow-800';
            case 'archived':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    var getDifficultyColor = function (difficulty) {
        switch (difficulty) {
            case 'Beginner':
                return 'bg-blue-100 text-blue-800';
            case 'Intermediate':
                return 'bg-yellow-100 text-yellow-800';
            case 'Advanced':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    var getLessonIcon = function (type) {
        switch (type) {
            case 'video':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Video, { className: "h-5 w-5 text-blue-500" });
            case 'interactive':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.MessageSquare, { className: "h-5 w-5 text-green-500" });
            case 'quiz':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-5 w-5 text-orange-500" });
            case 'download':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "h-5 w-5 text-purple-500" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.BookOpen, { className: "h-5 w-5 text-gray-500" });
        }
    };
    var totalLessons = ((_a = course.modules) !== null && _a !== void 0 ? _a : []).reduce(function (acc, module) { var _a, _b; return acc + ((_b = (_a = module.lessons) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0); }, 0);
    var totalDuration = ((_b = course.modules) !== null && _b !== void 0 ? _b : []).reduce(function (acc, module) {
        var _a;
        var moduleDuration = ((_a = module.lessons) !== null && _a !== void 0 ? _a : []).reduce(function (lessonAcc, lesson) {
            var _a;
            var minutesStr = ((_a = lesson.duration) !== null && _a !== void 0 ? _a : '0').toString().split(' ')[0];
            var minutes = parseInt(minutesStr || '0');
            return lessonAcc + (isNaN(minutes) ? 0 : minutes);
        }, 0);
        return acc + moduleDuration;
    }, 0);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsxs)(react_router_dom_1.Link, { to: "/admin/courses", className: "inline-flex items-center mb-4 font-medium text-[var(--hud-orange)] hover:opacity-80", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Course Management"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 mb-2", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900", children: course.title }), (0, jsx_runtime_1.jsx)("span", { className: "px-3 py-1 rounded-full text-sm font-medium ".concat(getStatusColor(course.status)), children: course.status }), (0, jsx_runtime_1.jsx)("span", { className: "px-3 py-1 rounded-full text-sm font-medium ".concat(getDifficultyColor(course.difficulty)), children: course.difficulty })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-lg mb-4", children: course.description }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 mb-4", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-gray-700", children: "View Mode:" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center bg-gray-100 rounded-lg p-1", children: [(0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setViewMode('admin'); }, className: "px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ".concat(viewMode === 'admin'
                                                            ? 'bg-white text-gray-900 shadow-sm'
                                                            : 'text-gray-600 hover:text-gray-900'), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Settings, { className: "h-4 w-4 mr-1 inline" }), "Admin Preview"] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setViewMode('learner'); }, className: "px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ".concat(viewMode === 'learner'
                                                            ? 'bg-white text-gray-900 shadow-sm'
                                                            : 'text-gray-600 hover:text-gray-900'), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4 mr-1 inline" }), "Learner View"] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsxs)(react_router_dom_1.Link, { to: "/admin/course-builder/".concat(course.id), className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Edit Course" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return void handleDuplicateCourse(); }, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Duplicate" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () {
                                            var _a;
                                            try {
                                                var link_1 = "".concat(window.location.origin, "/courses/").concat(course.id);
                                                (_a = navigator.clipboard) === null || _a === void 0 ? void 0 : _a.writeText(link_1).then(function () { return console.log('Link copied:', link_1); }).catch(function () { return console.log('Copy not supported'); });
                                            }
                                            catch (err) {
                                                console.warn('Share failed', err);
                                            }
                                        }, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Share, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Copy Link" })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "lg:col-span-2 space-y-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-lg overflow-hidden", children: [(0, jsx_runtime_1.jsx)("img", { src: course.thumbnail, alt: course.title, className: "w-full h-64 object-cover" }), (0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-blue-600", children: totalLessons }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Lessons" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-2xl font-bold text-green-600", children: [totalDuration, "m"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Duration" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-orange-600", children: course.enrollments }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Enrolled" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-purple-600", children: course.avgRating }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Rating" })] })] }), viewMode === 'admin' && ((0, jsx_runtime_1.jsxs)("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2 mb-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Info, { className: "h-5 w-5 text-blue-500" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-blue-900", children: "Admin Information" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-blue-700", children: "Created by:" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-blue-900 ml-2", children: course.createdBy })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-blue-700", children: "Created:" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-blue-900 ml-2", children: new Date((_c = course.createdDate) !== null && _c !== void 0 ? _c : new Date().toISOString()).toLocaleDateString() })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-blue-700", children: "Last Updated:" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-blue-900 ml-2", children: new Date((_d = course.lastUpdated) !== null && _d !== void 0 ? _d : new Date().toISOString()).toLocaleDateString() })] }), course.publishedDate && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-blue-700", children: "Published:" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-blue-900 ml-2", children: new Date(course.publishedDate).toLocaleDateString() })] }))] })] })), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: ((_e = course.tags) !== null && _e !== void 0 ? _e : []).map(function (tag, index) { return ((0, jsx_runtime_1.jsx)("span", { className: "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm", children: tag }, index)); }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-4", children: "Learning Objectives" }), (0, jsx_runtime_1.jsx)("ul", { className: "space-y-3", children: ((_f = course.learningObjectives) !== null && _f !== void 0 ? _f : []).map(function (objective, index) { return ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-start space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-700", children: objective })] }, index)); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Course Content" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: ((_g = course.modules) !== null && _g !== void 0 ? _g : []).map(function (module, _moduleIndex) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-bold text-gray-900", children: ["Module ", module.order, ": ", module.title] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: module.description })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-4 w-4 mr-1" }), module.duration] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: module.lessons.map(function (lesson, _lessonIndex) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center w-8 h-8 bg-white rounded-full border border-gray-200", children: getLessonIcon(lesson.type) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900", children: lesson.title }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [(0, jsx_runtime_1.jsxs)("span", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-3 w-3 mr-1" }), lesson.duration] }), (0, jsx_runtime_1.jsx)("span", { className: "capitalize", children: lesson.type })] })] })] }), viewMode === 'admin' && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                            try {
                                                                                var lessonUrl = "/courses/".concat(course.id, "/modules/").concat(module.id, "/lessons/").concat(lesson.id);
                                                                                window.open(lessonUrl, '_blank');
                                                                            }
                                                                            catch (err) {
                                                                                console.warn('Preview failed', err);
                                                                            }
                                                                        }, className: "p-1 text-blue-600 hover:text-blue-800", title: "Preview Lesson", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return navigate("/admin/course-builder/".concat(course.id, "?module=").concat(module.id, "&lesson=").concat(lesson.id)); }, className: "p-1 text-gray-600 hover:text-gray-800", title: "Edit Lesson", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return navigate("/admin/reports?courseId=".concat(course.id)); }, className: "p-1 text-gray-600 hover:text-gray-800", title: "Analytics", children: (0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-4 w-4" }) })] })), viewMode === 'learner' && ((0, jsx_runtime_1.jsxs)("button", { onClick: function () {
                                                                    try {
                                                                        var lessonUrl = "/courses/".concat(course.id, "/modules/").concat(module.id, "/lessons/").concat(lesson.id);
                                                                        window.open(lessonUrl, '_blank');
                                                                    }
                                                                    catch (err) {
                                                                        console.warn('Start failed', err);
                                                                    }
                                                                }, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Play, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Start" })] }))] }, lesson.id)); }) })] }, module.id)); }) })] }), course.prerequisites && course.prerequisites.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-4", children: "Prerequisites" }), (0, jsx_runtime_1.jsx)("ul", { className: "space-y-2", children: course.prerequisites.map(function (prerequisite, index) { return ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4 text-yellow-500 flex-shrink-0" }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-700", children: prerequisite })] }, index)); }) })] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Course Information" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Duration:" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: course.estimatedTime })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Difficulty:" }), (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getDifficultyColor(course.difficulty)), children: course.difficulty })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Due Date:" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-gray-900 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Calendar, { className: "h-4 w-4 mr-1 text-orange-500" }), course.dueDate ? new Date(course.dueDate).toLocaleDateString() : '—'] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Enrolled:" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-gray-900", children: [course.enrollments, " learners"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Completion Rate:" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-green-600", children: [course.completionRate, "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Average Rating:" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Star, { className: "h-4 w-4 text-yellow-400 fill-current" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: course.avgRating }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-500", children: ["(", course.totalRatings, ")"] })] })] })] })] }), course.certification && course.certification.available && ((0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2 mb-4", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Award, { className: "h-5 w-5 text-orange-500" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900", children: "Certification" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-2", children: course.certification.name }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-gray-600", children: ["Valid for ", course.certification.validFor] }), course.certification.renewalRequired && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-yellow-600 mt-1", children: "Renewal required" }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-2", children: "Requirements:" }), (0, jsx_runtime_1.jsx)("ul", { className: "space-y-1", children: course.certification.requirements.map(function (requirement, index) { return ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-start space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-700", children: requirement })] }, index)); }) })] })] })] })), viewMode === 'admin' && ((0, jsx_runtime_1.jsxs)("div", { className: "card-lg", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2 mb-4", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-5 w-5 text-blue-500" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900", children: "Performance Analytics" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Completion Progress" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-medium text-gray-900", children: [course.completionRate, "%"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "w-full bg-gray-200 rounded-full h-2", children: (0, jsx_runtime_1.jsx)("div", { className: "h-2 rounded-full", style: { width: "".concat(course.completionRate, "%"), background: 'var(--gradient-blue-green)' } }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4 text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-green-50 p-3 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-lg font-bold text-green-600", children: course.completions }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-green-700", children: "Completed" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-blue-50 p-3 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-lg font-bold text-blue-600", children: ((_h = course.enrollments) !== null && _h !== void 0 ? _h : 0) - ((_j = course.completions) !== null && _j !== void 0 ? _j : 0) }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-blue-700", children: "In Progress" })] })] }), (0, jsx_runtime_1.jsx)("button", { className: "w-full btn-outline py-2 rounded-lg text-sm", children: "View Detailed Analytics" })] })] })), viewMode === 'learner' && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl p-6", style: { background: 'var(--gradient-banner)' }, children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Ready to Start Learning?" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-6", children: "This course will help you develop essential inclusive leadership skills through interactive lessons, real-world scenarios, and practical exercises." }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3", children: [(0, jsx_runtime_1.jsxs)("button", { className: "btn-cta px-6 py-3 rounded-lg flex items-center justify-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Play, { className: "h-5 w-5" }), (0, jsx_runtime_1.jsx)("span", { children: "Start Course" })] }), (0, jsx_runtime_1.jsxs)("button", { className: "border border-orange-500 text-orange-500 px-6 py-3 rounded-lg hover:bg-orange-500 hover:text-white transition-all duration-200 flex items-center justify-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-5 w-5" }), (0, jsx_runtime_1.jsx)("span", { children: "Download Syllabus" })] })] })] }))] })] })] }));
};
exports.default = AdminCourseDetail;
