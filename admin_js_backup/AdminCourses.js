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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var courseStore_1 = require("../../store/courseStore");
var courses_1 = require("../../dal/courses");
var lucide_react_1 = require("lucide-react");
var LoadingButton_1 = require("../../components/LoadingButton");
var ConfirmationModal_1 = require("../../components/ConfirmationModal");
var CourseEditModal_1 = require("../../components/CourseEditModal");
var ToastContext_1 = require("../../context/ToastContext");
var sync_1 = require("../../dal/sync");
var courseNormalization_1 = require("../../utils/courseNormalization");
var Breadcrumbs_1 = require("../../components/ui/Breadcrumbs");
var EmptyState_1 = require("../../components/ui/EmptyState");
var Button_1 = require("../../components/ui/Button");
var Input_1 = require("../../components/ui/Input");
var AdminCourses = function () {
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var syncService = (0, sync_1.useSyncService)();
    var _a = (0, react_1.useState)(''), searchTerm = _a[0], setSearchTerm = _a[1];
    var _b = (0, react_1.useState)('all'), filterStatus = _b[0], setFilterStatus = _b[1];
    var _c = (0, react_1.useState)([]), selectedCourses = _c[0], setSelectedCourses = _c[1];
    var _d = (0, react_1.useState)(0), version = _d[0], setVersion = _d[1]; // bump to force re-render when store changes
    var _e = (0, react_1.useState)(false), showDeleteModal = _e[0], setShowDeleteModal = _e[1];
    var _f = (0, react_1.useState)(null), courseToDelete = _f[0], setCourseToDelete = _f[1];
    var _g = (0, react_1.useState)(false), loading = _g[0], setLoading = _g[1];
    var _h = (0, react_1.useState)(false), showCreateModal = _h[0], setShowCreateModal = _h[1];
    var _j = (0, react_router_dom_1.useSearchParams)(), searchParams = _j[0], setSearchParams = _j[1];
    var navigate = (0, react_router_dom_1.useNavigate)();
    // Get courses from store (re-read when version changes)
    var courses = (0, react_1.useMemo)(function () { return courseStore_1.courseStore.getAllCourses(); }, [version]);
    // Ensure course store refreshes on landing (always fetch & merge latest)
    (0, react_1.useEffect)(function () {
        var active = true;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, 4, 5]);
                        if (!(typeof courseStore_1.courseStore.init === 'function')) return [3 /*break*/, 2];
                        setLoading(true);
                        return [4 /*yield*/, courseStore_1.courseStore.init()];
                    case 1:
                        _a.sent();
                        if (!active)
                            return [2 /*return*/];
                        setVersion(function (v) { return v + 1; });
                        _a.label = 2;
                    case 2: return [3 /*break*/, 5];
                    case 3:
                        err_1 = _a.sent();
                        console.warn('[AdminCourses] Failed to initialize course store:', err_1);
                        return [3 /*break*/, 5];
                    case 4:
                        if (active)
                            setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); })();
        return function () {
            active = false;
        };
    }, []);
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
    var filteredCourses = courses.filter(function (course) {
        var matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (course.tags || []).some(function (tag) { return tag.toLowerCase().includes(searchTerm.toLowerCase()); });
        var matchesFilter = filterStatus === 'all' || course.status === filterStatus;
        return matchesSearch && matchesFilter;
    });
    var handleSelectCourse = function (courseId) {
        setSelectedCourses(function (prev) {
            return prev.includes(courseId)
                ? prev.filter(function (id) { return id !== courseId; })
                : __spreadArray(__spreadArray([], prev, true), [courseId], false);
        });
    };
    var handleSelectAll = function () {
        if (selectedCourses.length === filteredCourses.length) {
            setSelectedCourses([]);
        }
        else {
            setSelectedCourses(filteredCourses.map(function (course) { return course.id; }));
        }
    };
    var handleEditCourse = function (course) {
        navigate("/admin/courses/".concat(course.id, "/edit"));
    };
    var handleCreateCourse = function () {
        setSearchParams(function (prev) {
            var params = new URLSearchParams(prev);
            params.set('create', '1');
            return params;
        });
        setShowCreateModal(true);
    };
    var handleAssignCourse = function (course) {
        navigate("/admin/courses/".concat(course.id, "/assign"));
    };
    var handleCreateCourseSave = function (course) {
        var normalizedSlug = (0, courseNormalization_1.slugify)(course.slug || course.title || course.id);
        var created = courseStore_1.courseStore.createCourse(__assign(__assign({}, course), { slug: normalizedSlug, status: course.status || 'draft', lastUpdated: new Date().toISOString() }));
        syncService.logEvent({
            type: 'course_created',
            data: created,
            timestamp: Date.now(),
        });
        showToast('Course created successfully.', 'success');
        closeCreateModal();
        refresh();
        navigate("/admin/courses/".concat(created.id, "/details"));
    };
    var closeCreateModal = function () {
        setShowCreateModal(false);
        setSearchParams(function (prev) {
            var params = new URLSearchParams(prev);
            params.delete('create');
            return params;
        });
    };
    (0, react_1.useEffect)(function () {
        if (searchParams.get('create') === '1') {
            setShowCreateModal(true);
        }
    }, [searchParams]);
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
    var getTypeIcon = function (type) {
        switch (type) {
            case 'video':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Video, { className: "h-4 w-4" });
            case 'interactive':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Play, { className: "h-4 w-4" });
            case 'worksheet':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "h-4 w-4" });
            case 'case-study':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.BookOpen, { className: "h-4 w-4" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.BookOpen, { className: "h-4 w-4" });
        }
    };
    var getTypeColor = function (type) {
        switch (type) {
            case 'video':
                return 'text-blue-600 bg-blue-50';
            case 'interactive':
                return 'text-green-600 bg-green-50';
            case 'worksheet':
                return 'text-orange-600 bg-orange-50';
            case 'case-study':
                return 'text-purple-600 bg-purple-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    };
    var duplicateCourse = function (courseId) { return __awaiter(void 0, void 0, void 0, function () {
        var original, newId, cloned, persistedClone, err_2, errorMessage, errorDetails, fullMessage;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    original = courseStore_1.courseStore.getCourse(courseId);
                    if (!original)
                        return [2 /*return*/];
                    newId = "course-".concat(Date.now());
                    cloned = __assign(__assign({}, original), { id: newId, title: "".concat(original.title, " (Copy)"), createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString(), enrollments: 0, completions: 0, completionRate: 0 });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, persistCourse(cloned)];
                case 2:
                    persistedClone = _c.sent();
                    syncService.logEvent({
                        type: 'course_created',
                        data: persistedClone,
                        timestamp: Date.now()
                    });
                    setVersion(function (v) { return v + 1; });
                    navigate("/admin/course-builder/".concat(persistedClone.id));
                    showToast('Course duplicated successfully.', 'success');
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _c.sent();
                    if (err_2 instanceof courses_1.CourseValidationError) {
                        showToast("Duplicate failed: ".concat(err_2.issues.join(' • ')), 'error');
                    }
                    else {
                        console.warn('Failed to duplicate course', err_2);
                        errorMessage = (err_2 === null || err_2 === void 0 ? void 0 : err_2.message) || ((_a = err_2 === null || err_2 === void 0 ? void 0 : err_2.body) === null || _a === void 0 ? void 0 : _a.error) || 'Could not duplicate course. Please try again.';
                        errorDetails = (_b = err_2 === null || err_2 === void 0 ? void 0 : err_2.body) === null || _b === void 0 ? void 0 : _b.details;
                        fullMessage = errorDetails ? "".concat(errorMessage, ": ").concat(errorDetails) : errorMessage;
                        showToast(fullMessage, 'error');
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var refresh = function () { return setVersion(function (v) { return v + 1; }); };
    var publishSelected = function () { return __awaiter(void 0, void 0, void 0, function () {
        var publishResults, successes, validationErrors, messages, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (selectedCourses.length === 0) {
                        showToast('No courses selected', 'error');
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, Promise.allSettled(selectedCourses.map(function (id) { return __awaiter(void 0, void 0, void 0, function () {
                            var existing, updated, persisted;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        existing = courseStore_1.courseStore.getCourse(id);
                                        if (!existing) {
                                            return [2 /*return*/, null];
                                        }
                                        updated = __assign(__assign({}, existing), { status: 'published', publishedDate: new Date().toISOString(), lastUpdated: new Date().toISOString() });
                                        return [4 /*yield*/, persistCourse(updated, 'published')];
                                    case 1:
                                        persisted = _a.sent();
                                        syncService.logEvent({
                                            type: 'course_updated',
                                            data: persisted,
                                            timestamp: Date.now(),
                                        });
                                        return [2 /*return*/, persisted];
                                }
                            });
                        }); }))];
                case 2:
                    publishResults = _a.sent();
                    successes = publishResults.filter(function (result) { return result.status === 'fulfilled'; }).length;
                    validationErrors = publishResults
                        .filter(function (result) {
                        return result.status === 'rejected' && result.reason instanceof courses_1.CourseValidationError;
                    })
                        .map(function (result) { return result.reason; });
                    if (successes > 0) {
                        showToast("".concat(successes, " course(s) published successfully!"), 'success');
                    }
                    if (validationErrors.length > 0) {
                        messages = Array.from(new Set(validationErrors.flatMap(function (error) { return error.issues; })));
                        showToast("Some courses failed validation: ".concat(messages.join(' • ')), 'error');
                    }
                    setSelectedCourses([]);
                    refresh();
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    showToast('Failed to publish courses', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var exportCourses = function (scope) {
        if (scope === void 0) { scope = 'selected'; }
        var toExport = filteredCourses;
        if (scope === 'selected' && selectedCourses.length > 0) {
            toExport = selectedCourses.map(function (id) { return courseStore_1.courseStore.getCourse(id); }).filter(Boolean);
        }
        else if (scope === 'all') {
            toExport = courseStore_1.courseStore.getAllCourses();
        }
        try {
            var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(toExport, null, 2));
            var dlAnchor = document.createElement('a');
            dlAnchor.setAttribute('href', dataStr);
            dlAnchor.setAttribute('download', "courses-export-".concat(Date.now(), ".json"));
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
        }
        catch (err) {
            console.warn('Export failed', err);
            alert('Failed to export courses');
        }
    };
    var deleteCourse = function (id) {
        setCourseToDelete(id);
        setShowDeleteModal(true);
    };
    var confirmDeleteCourse = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!courseToDelete)
                return [2 /*return*/];
            setLoading(true);
            try {
                courseStore_1.courseStore.deleteCourse(courseToDelete);
                syncService.logEvent({
                    type: 'course_deleted',
                    data: { id: courseToDelete },
                    timestamp: Date.now()
                });
                setSelectedCourses(function (prev) { return prev.filter(function (x) { return x !== courseToDelete; }); });
                refresh();
                showToast('Course deleted successfully!', 'success');
                setShowDeleteModal(false);
                setCourseToDelete(null);
            }
            catch (error) {
                showToast('Failed to delete course', 'error');
            }
            finally {
                setLoading(false);
            }
            return [2 /*return*/];
        });
    }); };
    var handleImportCourses = function () {
        navigate('/admin/courses/import');
    };
    var handleExportCourses = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1500); })];
                case 2:
                    _a.sent();
                    exportCourses(selectedCourses.length > 0 ? 'selected' : 'all');
                    showToast('Courses exported successfully!', 'success');
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    showToast('Failed to export courses', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6", children: (0, jsx_runtime_1.jsx)(Breadcrumbs_1.default, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Courses', to: '/admin/courses' }] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Course Management" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Create, edit, and manage training modules and learning paths" })] }), (0, jsx_runtime_1.jsx)("div", { className: "card-lg card-hover mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex-1 max-w-md", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/60" }), (0, jsx_runtime_1.jsx)(Input_1.default, { className: "pl-9", placeholder: "Search courses...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Filter, { className: "h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("select", { value: filterStatus, onChange: function (e) { return setFilterStatus(e.target.value); }, className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "All Status" }), (0, jsx_runtime_1.jsx)("option", { value: "published", children: "Published" }), (0, jsx_runtime_1.jsx)("option", { value: "draft", children: "Draft" }), (0, jsx_runtime_1.jsx)("option", { value: "archived", children: "Archived" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [selectedCourses.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsxs)(Button_1.default, { variant: "outline", size: "sm", onClick: function () { return navigate("/admin/courses/bulk?ids=".concat(selectedCourses.join(','))); }, children: ["Bulk Assign (", selectedCourses.length, ")"] }), (0, jsx_runtime_1.jsx)(Button_1.default, { size: "sm", onClick: publishSelected, "data-test": "admin-publish-selected", children: "Publish Selected" })] })), (0, jsx_runtime_1.jsx)(Button_1.default, { size: "md", onClick: handleCreateCourse, leadingIcon: (0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), "data-test": "admin-new-course", children: "New Course" }), (0, jsx_runtime_1.jsx)(LoadingButton_1.default, { onClick: function () { return navigate('/admin/courses/new'); }, variant: "secondary", icon: lucide_react_1.BookOpen, children: "Create Course" }), (0, jsx_runtime_1.jsx)(LoadingButton_1.default, { onClick: handleImportCourses, variant: "secondary", icon: lucide_react_1.Upload, disabled: loading, children: "Import" })] })] }) }), filteredCourses.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "mb-8", children: (0, jsx_runtime_1.jsx)(EmptyState_1.default, { title: "No courses found", description: searchTerm || filterStatus !== 'all'
                        ? 'Try adjusting your search or filters to find courses.'
                        : "You haven't created any courses yet. Get started by creating your first course.", action: (0, jsx_runtime_1.jsx)(Button_1.default, { variant: searchTerm || filterStatus !== 'all' ? 'outline' : 'primary', onClick: function () {
                            if (searchTerm || filterStatus !== 'all') {
                                setSearchTerm('');
                                setFilterStatus('all');
                            }
                            else {
                                handleCreateCourse();
                            }
                        }, children: searchTerm || filterStatus !== 'all' ? 'Reset filters' : 'Create course' }) }) })), filteredCourses.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8", children: filteredCourses.map(function (course) { return ((0, jsx_runtime_1.jsxs)("div", { className: "card-lg card-hover overflow-hidden", "data-test": "admin-course-card", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("img", { src: course.thumbnail, alt: course.title, className: "w-full h-48 object-cover" }), (0, jsx_runtime_1.jsx)("div", { className: "absolute top-4 left-4", children: (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(course.status)), children: course.status }) }), (0, jsx_runtime_1.jsx)("div", { className: "absolute top-4 right-4", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedCourses.includes(course.id), onChange: function () { return handleSelectCourse(course.id); }, className: "h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]" }) }), (0, jsx_runtime_1.jsx)("div", { className: "absolute bottom-4 left-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ".concat(getTypeColor(course.type || 'Mixed')), children: [getTypeIcon(course.type || 'Mixed'), (0, jsx_runtime_1.jsx)("span", { className: "capitalize", children: course.type })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-lg text-gray-900 mb-2", children: course.title }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-4 line-clamp-2", children: course.description }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm text-gray-600 mb-4", children: [(0, jsx_runtime_1.jsxs)("span", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-4 w-4 mr-1" }), course.duration] }), (0, jsx_runtime_1.jsxs)("span", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BookOpen, { className: "h-4 w-4 mr-1" }), course.lessons, " lessons"] }), (0, jsx_runtime_1.jsxs)("span", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-4 w-4 mr-1" }), course.enrollments] })] }), course.status === 'published' && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm mb-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Completion Rate" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-gray-900", children: [course.completionRate, "%"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "w-full bg-gray-200 rounded-full h-2", children: (0, jsx_runtime_1.jsx)("div", { className: "h-2 rounded-full", style: { width: "".concat(course.completionRate, "%"), background: 'var(--gradient-blue-green)' } }) })] })), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-1 mb-4", children: (course.tags || []).map(function (tag, index) { return ((0, jsx_runtime_1.jsx)("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: tag }, index)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: ["Updated ", new Date(course.lastUpdated || course.createdDate || new Date().toISOString()).toLocaleDateString()] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/courses/".concat(course.id, "/details"), className: "p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg", title: "Preview as Participant", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleEditCourse(course); }, className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Edit Course", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return void duplicateCourse(course.id); }, className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Duplicate", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleAssignCourse(course); }, className: "p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-lg", title: "Assign Course", children: (0, jsx_runtime_1.jsx)(lucide_react_1.UserPlus, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return navigate("/admin/reports?courseId=".concat(course.id)); }, className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Analytics", children: (0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(LoadingButton_1.default, { onClick: function () { return deleteCourse(course.id); }, variant: "danger", size: "sm", icon: lucide_react_1.Trash2, loading: loading && courseToDelete === course.id, disabled: loading, title: "Delete course", children: "Delete" })] })] })] })] }, course.id)); }) })), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg overflow-hidden", children: [(0, jsx_runtime_1.jsxs)("div", { className: "px-6 py-4 border-b border-gray-200 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-bold text-gray-900", children: "Course Details" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleSelectAll, className: "text-sm text-gray-600 hover:text-gray-900 font-medium", children: selectedCourses.length === filteredCourses.length ? 'Deselect All' : 'Select All' }), (0, jsx_runtime_1.jsx)(LoadingButton_1.default, { onClick: handleExportCourses, variant: "secondary", icon: lucide_react_1.Download, loading: loading, disabled: loading, children: "Export" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-gray-50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "text-left py-3 px-6", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedCourses.length === filteredCourses.length && filteredCourses.length > 0, onChange: handleSelectAll, className: "h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]" }) }), (0, jsx_runtime_1.jsx)("th", { className: "text-left py-3 px-6 font-semibold text-gray-900", children: "Course" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Type" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Enrollments" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Completion" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Rating" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: filteredCourses.map(function (course) { return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedCourses.includes(course.id), onChange: function () { return handleSelectCourse(course.id); }, className: "h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]" }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("img", { src: course.thumbnail, alt: course.title, className: "w-12 h-12 rounded-lg object-cover" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: course.title }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: [course.lessons, " lessons \u2022 ", course.duration] })] })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6 text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ".concat(getTypeColor(course.type || 'Mixed')), children: [getTypeIcon(course.type || 'Mixed'), (0, jsx_runtime_1.jsx)("span", { className: "capitalize", children: course.type })] }) }), (0, jsx_runtime_1.jsxs)("td", { className: "py-4 px-6 text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: course.enrollments }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: [course.completions, " completed"] })] }), (0, jsx_runtime_1.jsxs)("td", { className: "py-4 px-6 text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "font-medium text-gray-900", children: [course.completionRate, "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "w-16 bg-gray-200 rounded-full h-1 mt-1 mx-auto", children: (0, jsx_runtime_1.jsx)("div", { className: "h-1 rounded-full", style: { width: "".concat(course.completionRate, "%"), background: 'var(--gradient-blue-green)' } }) })] }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6 text-center", children: (course.avgRating || 0) > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center space-x-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: course.avgRating }), (0, jsx_runtime_1.jsx)("div", { className: "text-yellow-400", children: "\u2605" })] })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-gray-400", children: "-" })) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6 text-center", children: (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(course.status)), children: course.status }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6 text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center space-x-2", children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/courses/".concat(course.id, "/details?viewMode=learner"), className: "p-1 text-blue-600 hover:text-blue-800", title: "Preview as Participant", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/course-builder/".concat(course.id), className: "p-1 text-gray-600 hover:text-gray-800", title: "Edit Course", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return void duplicateCourse(course.id); }, className: "p-1 text-gray-600 hover:text-gray-800", title: "Duplicate", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return navigate("/admin/courses/".concat(course.id, "/settings")); }, className: "p-1 text-gray-600 hover:text-gray-800", title: "Settings", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Settings, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(LoadingButton_1.default, { onClick: function () { return deleteCourse(course.id); }, variant: "danger", size: "sm", icon: lucide_react_1.Trash2, loading: loading && courseToDelete === course.id, disabled: loading, title: "Delete course", children: "Delete" })] }) })] }, course.id)); }) })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-8 grid grid-cols-1 md:grid-cols-4 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-blue-600", children: courses.length }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Total Courses" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-green-600", children: courses.filter(function (c) { return c.status === 'published'; }).length }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Published" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-orange-600", children: courses.reduce(function (acc, course) { return acc + (course.enrollments || 0); }, 0) }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Total Enrollments" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-purple-600", children: Math.round(courses.filter(function (c) { return (c.avgRating || 0) > 0; }).reduce(function (acc, course) { return acc + (course.avgRating || 0); }, 0) / courses.filter(function (c) { return (c.avgRating || 0) > 0; }).length * 10) / 10 || 0 }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Avg. Rating" })] })] }), (0, jsx_runtime_1.jsx)(ConfirmationModal_1.default, { isOpen: showDeleteModal, onClose: function () {
                    setShowDeleteModal(false);
                    setCourseToDelete(null);
                }, onConfirm: confirmDeleteCourse, title: "Delete Course", message: "Are you sure you want to delete this course? This action cannot be undone and will remove all associated data including enrollments and progress.", confirmText: "Delete Course", cancelText: "Cancel", type: "danger" }), (0, jsx_runtime_1.jsx)(CourseEditModal_1.default, { isOpen: showCreateModal, onClose: closeCreateModal, onSave: handleCreateCourseSave, mode: "create" })] }));
};
exports.default = AdminCourses;
