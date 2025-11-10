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
var courseDiff_1 = require("../../utils/courseDiff");
var adminCourseMerge_1 = require("../../utils/adminCourseMerge");
var supabase_1 = require("../../lib/supabase");
var videoUtils_1 = require("../../utils/videoUtils");
var lucide_react_1 = require("lucide-react");
var CourseAssignmentModal_1 = require("../../components/CourseAssignmentModal");
var LivePreview_1 = require("../../components/LivePreview");
var AIContentAssistant_1 = require("../../components/AIContentAssistant");
// import DragDropItem from '../../components/DragDropItem'; // TODO: Implement drag drop functionality
var VersionControl_1 = require("../../components/VersionControl");
var AdminCourseBuilder = function () {
    var _a, _b, _c, _d, _e;
    var courseId = (0, react_router_dom_1.useParams)().courseId;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var isNewCourseRoute = !courseId || courseId === 'new';
    var isEditing = !isNewCourseRoute;
    var _f = (0, react_1.useState)(function () {
        if (isEditing && courseId) {
            var existingCourse = courseStore_1.courseStore.getCourse(courseId);
            return existingCourse || createEmptyCourse(courseId);
        }
        return createEmptyCourse();
    }), course = _f[0], setCourse = _f[1];
    var _g = (0, react_1.useState)('overview'), activeTab = _g[0], setActiveTab = _g[1];
    var _h = (0, react_1.useState)({}), expandedModules = _h[0], setExpandedModules = _h[1];
    var _j = (0, react_1.useState)(null), editingLesson = _j[0], setEditingLesson = _j[1];
    var _k = (0, react_1.useState)({}), uploadingVideos = _k[0], setUploadingVideos = _k[1];
    var _l = (0, react_1.useState)({}), uploadProgress = _l[0], setUploadProgress = _l[1];
    var _m = (0, react_1.useState)(null), uploadError = _m[0], setUploadError = _m[1];
    var _o = (0, react_1.useState)(false), showAssignmentModal = _o[0], setShowAssignmentModal = _o[1];
    var lastPersistedRef = (0, react_1.useRef)(null);
    var _p = (0, react_1.useState)(isEditing), initializing = _p[0], setInitializing = _p[1];
    var _q = (0, react_1.useState)(null), loadError = _q[0], setLoadError = _q[1];
    var lastLoadedCourseIdRef = (0, react_1.useRef)(null);
    var searchParams = (0, react_router_dom_1.useSearchParams)()[0];
    var _r = (0, react_1.useState)(null), highlightLessonId = _r[0], setHighlightLessonId = _r[1];
    (0, react_1.useEffect)(function () {
        var _a;
        var moduleQ = searchParams.get('module');
        var lessonQ = searchParams.get('lesson');
        if (!moduleQ || !lessonQ)
            return;
        // Expand the requested module and open the lesson editor if the lesson exists
        setExpandedModules(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[moduleQ] = true, _a)));
        });
        var mod = (_a = course.modules) === null || _a === void 0 ? void 0 : _a.find(function (m) { return m.id === moduleQ; });
        var lessonExists = mod === null || mod === void 0 ? void 0 : mod.lessons.some(function (l) { return l.id === lessonQ; });
        if (lessonExists) {
            setEditingLesson({ moduleId: moduleQ, lessonId: lessonQ });
            setHighlightLessonId(lessonQ);
            // remove highlight after a short delay
            setTimeout(function () { return setHighlightLessonId(null); }, 2000);
            // Scroll into view after render
            setTimeout(function () {
                var el = document.getElementById("lesson-".concat(lessonQ));
                if (el)
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    }, [searchParams, course.modules]);
    (0, react_1.useEffect)(function () {
        if (!isEditing || !courseId) {
            setLoadError(function (prev) { return (prev ? null : prev); });
            if (initializing) {
                setInitializing(false);
            }
            return;
        }
        if (lastLoadedCourseIdRef.current === courseId) {
            if (initializing) {
                setInitializing(false);
            }
            return;
        }
        var cancelled = false;
        var hydrateCourse = function () { return __awaiter(void 0, void 0, void 0, function () {
            var existing, remote_1, error_1, message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setInitializing(true);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        existing = courseStore_1.courseStore.getCourse(courseId);
                        if (existing) {
                            if (cancelled)
                                return [2 /*return*/];
                            setCourse(existing);
                            lastPersistedRef.current = existing;
                            lastLoadedCourseIdRef.current = courseId;
                            setLoadError(null);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, (0, courses_1.loadCourseFromDatabase)(courseId, { includeDrafts: true })];
                    case 2:
                        remote_1 = _a.sent();
                        if (cancelled)
                            return [2 /*return*/];
                        if (remote_1) {
                            setCourse(function (prev) {
                                var merged = (0, adminCourseMerge_1.mergePersistedCourse)(prev, remote_1);
                                courseStore_1.courseStore.saveCourse(merged, { skipRemoteSync: true });
                                lastPersistedRef.current = merged;
                                return merged;
                            });
                            lastLoadedCourseIdRef.current = courseId;
                            setLoadError(null);
                        }
                        else {
                            setLoadError('Unable to locate this course in the database. Editing local draft only.');
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        if (cancelled)
                            return [2 /*return*/];
                        console.error('Failed to load course details:', error_1);
                        message = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        setLoadError("Failed to load course details: ".concat(message));
                        return [3 /*break*/, 5];
                    case 4:
                        if (!cancelled) {
                            setInitializing(false);
                        }
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        hydrateCourse();
        return function () {
            cancelled = true;
        };
    }, [isEditing, courseId]);
    // Keyboard shortcuts
    (0, react_1.useEffect)(function () {
        var handleKeyDown = function (event) {
            // Cmd/Ctrl + S to save
            if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault();
                handleSave();
            }
            // Escape to close modals
            if (event.key === 'Escape') {
                if (editingLesson) {
                    setEditingLesson(null);
                }
                if (showAssignmentModal) {
                    setShowAssignmentModal(false);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return function () { return document.removeEventListener('keydown', handleKeyDown); };
    }, [editingLesson, showAssignmentModal]);
    // Auto-save course changes with enhanced feedback
    (0, react_1.useEffect)(function () {
        var _a;
        if (course.id && course.id !== 'new' && ((_a = course.title) === null || _a === void 0 ? void 0 : _a.trim())) {
            // Debounce saves to avoid too frequent localStorage writes
            var timeoutId_1 = setTimeout(function () {
                var _a, _b;
                try {
                    var updatedCourse = __assign(__assign({}, course), { duration: (0, courseStore_1.calculateCourseDuration)(course.modules || []), lessons: (0, courseStore_1.countTotalLessons)(course.modules || []), lastUpdated: new Date().toISOString() });
                    courseStore_1.courseStore.saveCourse(updatedCourse, { skipRemoteSync: true });
                    console.log('� Auto-saved course:', course.title, {
                        id: course.id,
                        modules: ((_a = course.modules) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        totalLessons: updatedCourse.lessons,
                        videoLessons: ((_b = course.modules) === null || _b === void 0 ? void 0 : _b.reduce(function (count, module) {
                            return count + module.lessons.filter(function (lesson) { var _a; return lesson.type === 'video' && ((_a = lesson.content) === null || _a === void 0 ? void 0 : _a.videoUrl); }).length;
                        }, 0)) || 0
                    });
                    // Update local state with calculated fields
                    if (course.duration !== updatedCourse.duration || course.lessons !== updatedCourse.lessons) {
                        setCourse(updatedCourse);
                    }
                }
                catch (error) {
                    console.error('❌ Auto-save failed:', error);
                }
            }, 1500);
            return function () { return clearTimeout(timeoutId_1); };
        }
    }, [course]);
    // Debounced remote auto-sync (single upsert). Runs only when there are real changes vs lastPersistedRef.
    (0, react_1.useEffect)(function () {
        var _a;
        if (!course.id || !((_a = course.title) === null || _a === void 0 ? void 0 : _a.trim()))
            return;
        // Avoid overlapping autosaves
        if (autoSaveLockRef.current)
            return;
        // Check if there are changes since last persist
        var diff = (0, courseDiff_1.computeCourseDiff)(lastPersistedRef.current, course);
        if (!diff.hasChanges)
            return;
        if (autoSaveTimerRef.current)
            clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
            var preparedCourse, persisted, merged, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        autoSaveLockRef.current = true;
                        setSaveStatus(function (s) { return (s === 'saving' ? s : 'saving'); });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        preparedCourse = __assign(__assign({}, course), { duration: (0, courseStore_1.calculateCourseDuration)(course.modules || []), lessons: (0, courseStore_1.countTotalLessons)(course.modules || []), lastUpdated: new Date().toISOString() });
                        return [4 /*yield*/, (0, courses_1.syncCourseToDatabase)(preparedCourse)];
                    case 2:
                        persisted = _a.sent();
                        merged = persisted ? (0, adminCourseMerge_1.mergePersistedCourse)(preparedCourse, persisted) : preparedCourse;
                        courseStore_1.courseStore.saveCourse(merged, { skipRemoteSync: true });
                        setCourse(merged);
                        lastPersistedRef.current = merged;
                        setSaveStatus('saved');
                        setLastSaveTime(new Date());
                        setTimeout(function () { return setSaveStatus('idle'); }, 2000);
                        return [3 /*break*/, 5];
                    case 3:
                        err_1 = _a.sent();
                        console.error('❌ Remote auto-sync failed:', err_1);
                        setSaveStatus('error');
                        setTimeout(function () { return setSaveStatus('idle'); }, 4000);
                        return [3 /*break*/, 5];
                    case 4:
                        autoSaveLockRef.current = false;
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); }, 1000);
        return function () {
            if (autoSaveTimerRef.current)
                clearTimeout(autoSaveTimerRef.current);
        };
    }, [course]);
    // Course validation function
    var validateCourse = function (course) {
        var _a, _b, _c;
        var issues = [];
        // Basic course info validation
        if (!((_a = course.title) === null || _a === void 0 ? void 0 : _a.trim()))
            issues.push('Course title is required');
        if (!((_b = course.description) === null || _b === void 0 ? void 0 : _b.trim()))
            issues.push('Course description is required');
        if (!course.modules || course.modules.length === 0)
            issues.push('At least one module is required');
        // Module and lesson validation
        (_c = course.modules) === null || _c === void 0 ? void 0 : _c.forEach(function (module, mIndex) {
            var _a, _b;
            if (!((_a = module.title) === null || _a === void 0 ? void 0 : _a.trim()))
                issues.push("Module ".concat(mIndex + 1, ": Title is required"));
            if (!module.lessons || module.lessons.length === 0) {
                issues.push("Module ".concat(mIndex + 1, ": At least one lesson is required"));
            }
            (_b = module.lessons) === null || _b === void 0 ? void 0 : _b.forEach(function (lesson, lIndex) {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                if (!((_a = lesson.title) === null || _a === void 0 ? void 0 : _a.trim())) {
                    issues.push("Module ".concat(mIndex + 1, ", Lesson ").concat(lIndex + 1, ": Title is required"));
                }
                // Type-specific validation
                switch (lesson.type) {
                    case 'video':
                        if (!((_c = (_b = lesson.content) === null || _b === void 0 ? void 0 : _b.videoUrl) === null || _c === void 0 ? void 0 : _c.trim())) {
                            issues.push("Module ".concat(mIndex + 1, ", Lesson ").concat(lIndex + 1, ": Video URL is required"));
                        }
                        break;
                    case 'quiz':
                        if (!((_d = lesson.content) === null || _d === void 0 ? void 0 : _d.questions) || lesson.content.questions.length === 0) {
                            issues.push("Module ".concat(mIndex + 1, ", Lesson ").concat(lIndex + 1, ": Quiz questions are required"));
                        }
                        break;
                    case 'document':
                        if (!((_f = (_e = lesson.content) === null || _e === void 0 ? void 0 : _e.fileUrl) === null || _f === void 0 ? void 0 : _f.trim())) {
                            issues.push("Module ".concat(mIndex + 1, ", Lesson ").concat(lIndex + 1, ": Document file is required"));
                        }
                        break;
                    case 'text':
                        if (!((_h = (_g = lesson.content) === null || _g === void 0 ? void 0 : _g.textContent) === null || _h === void 0 ? void 0 : _h.trim())) {
                            issues.push("Module ".concat(mIndex + 1, ", Lesson ").concat(lIndex + 1, ": Text content is required"));
                        }
                        break;
                }
            });
        });
        return { isValid: issues.length === 0, issues: issues };
    };
    function createEmptyCourse(initialCourseId) {
        // Smart defaults based on common course patterns
        var currentDate = new Date().toISOString();
        var suggestedTags = ['Professional Development', 'Leadership', 'Skills Training'];
        var resolvedCourseId = initialCourseId && initialCourseId !== 'new' ? initialCourseId : (0, courseStore_1.generateId)('course');
        return {
            id: resolvedCourseId,
            title: 'New Course',
            description: 'Enter your course description here. What will learners achieve after completing this course?',
            status: 'draft',
            thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
            duration: '30 min', // Smart default duration
            difficulty: 'Beginner',
            enrollments: 0,
            completions: 0,
            completionRate: 0,
            avgRating: 0,
            totalRatings: 0,
            createdBy: 'Mya Dennis',
            createdDate: currentDate,
            lastUpdated: currentDate,
            estimatedTime: '30-45 minutes', // Better default estimate
            prerequisites: [],
            learningObjectives: [
                'Understand key concepts and terminology',
                'Apply learned skills in practical scenarios',
                'Demonstrate proficiency through assessments'
            ],
            certification: {
                available: true, // Enable by default
                name: 'Course Completion Certificate',
                requirements: ['Complete all lessons', 'Pass final assessment with 80% score'],
                validFor: '1 year',
                renewalRequired: false
            },
            tags: suggestedTags,
            keyTakeaways: [
                'Key concept #1',
                'Practical skill #2',
                'Actionable insight #3'
            ],
            type: 'Mixed',
            lessons: 0,
            rating: 0,
            progress: 0,
            modules: [
                // Start with one module template
                {
                    id: (0, courseStore_1.generateId)('module'),
                    title: 'Introduction',
                    description: 'Course overview and learning objectives',
                    duration: '10 min',
                    order: 1,
                    lessons: [
                        {
                            id: (0, courseStore_1.generateId)('lesson'),
                            title: 'Welcome & Overview',
                            type: 'video',
                            duration: '5 min',
                            content: {
                                notes: 'Welcome learners and introduce the course objectives'
                            },
                            completed: false,
                            order: 1
                        }
                    ],
                    resources: []
                }
            ]
        };
    }
    var _s = (0, react_1.useState)('idle'), saveStatus = _s[0], setSaveStatus = _s[1];
    var _t = (0, react_1.useState)(null), lastSaveTime = _t[0], setLastSaveTime = _t[1];
    var autoSaveTimerRef = (0, react_1.useRef)(null);
    var autoSaveLockRef = (0, react_1.useRef)(false);
    // Inline editing state
    var _u = (0, react_1.useState)(null), inlineEditing = _u[0], setInlineEditing = _u[1];
    // Live preview state
    var _v = (0, react_1.useState)(false), showPreview = _v[0], setShowPreview = _v[1];
    // AI Assistant handlers
    var handleApplySuggestion = function (suggestion) {
        switch (suggestion.id) {
            case 'desc-enhance':
                setCourse(function (prev) { return (__assign(__assign({}, prev), { description: prev.description + ' This course is designed to help you develop essential skills through hands-on practice, real-world examples, and interactive exercises. By the end of this course, you will have gained practical knowledge that you can immediately apply in your professional environment.' })); });
                break;
            case 'objectives-expand':
                setCourse(function (prev) { return (__assign(__assign({}, prev), { learningObjectives: [
                        'Understand and apply key concepts and principles',
                        'Demonstrate proficiency through practical exercises',
                        'Analyze real-world scenarios and provide solutions',
                        'Evaluate different approaches and methodologies',
                        'Create actionable plans for implementation'
                    ] })); });
                break;
            case 'accessibility-transcripts':
                // Auto-enable transcript placeholders for video lessons
                setCourse(function (prev) {
                    var _a;
                    return (__assign(__assign({}, prev), { modules: ((_a = prev.modules) === null || _a === void 0 ? void 0 : _a.map(function (module) { return (__assign(__assign({}, module), { lessons: module.lessons.map(function (lesson) {
                                return lesson.type === 'video'
                                    ? __assign(__assign({}, lesson), { content: __assign(__assign({}, lesson.content), { transcript: 'Transcript will be automatically generated...' }) }) : lesson;
                            }) })); })) || [] }));
                });
                break;
            case 'performance-lazy-load':
                // This would be handled at the system level
                console.log('Performance optimization applied');
                break;
        }
    };
    var handleDismissSuggestion = function (suggestionId) {
        console.log('Dismissed suggestion:', suggestionId);
    };
    // Drag and drop handlers - TODO: Implement drag and drop functionality
    /*
    const reorderModules = (dragIndex: number, hoverIndex: number) => {
      const modules = [...(course.modules || [])];
      const draggedModule = modules[dragIndex];
      
      modules.splice(dragIndex, 1);
      modules.splice(hoverIndex, 0, draggedModule);
      
      // Update order properties
      const reorderedModules = modules.map((module, index) => ({
        ...module,
        order: index + 1
      }));
      
      setCourse(prev => ({
        ...prev,
        modules: reorderedModules
      }));
    };
  
    const reorderLessons = (moduleId: string, dragIndex: number, hoverIndex: number) => {
      setCourse(prev => ({
        ...prev,
        modules: prev.modules?.map(module => {
          if (module.id === moduleId) {
            const lessons = [...module.lessons];
            const draggedLesson = lessons[dragIndex];
            
            lessons.splice(dragIndex, 1);
            lessons.splice(hoverIndex, 0, draggedLesson);
            
            // Update order properties
            const reorderedLessons = lessons.map((lesson, index) => ({
              ...lesson,
              order: index + 1
            }));
            
            return { ...module, lessons: reorderedLessons };
          }
          return module;
        }) || []
      }));
    };
    */
    // Version control handler
    var handleRestoreVersion = function (version) {
        setCourse(version.course);
    };
    (0, react_1.useEffect)(function () {
        if (course && !lastPersistedRef.current) {
            lastPersistedRef.current = course;
        }
    }, [course]);
    var persistCourse = function (nextCourse, statusOverride) { return __awaiter(void 0, void 0, void 0, function () {
        var preparedCourse, diff, validation, persisted, merged;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    preparedCourse = __assign(__assign({}, nextCourse), { status: (_a = statusOverride !== null && statusOverride !== void 0 ? statusOverride : nextCourse.status) !== null && _a !== void 0 ? _a : 'draft', duration: (0, courseStore_1.calculateCourseDuration)(nextCourse.modules || []), lessons: (0, courseStore_1.countTotalLessons)(nextCourse.modules || []), lastUpdated: new Date().toISOString(), publishedDate: statusOverride === 'published'
                            ? nextCourse.publishedDate || new Date().toISOString()
                            : nextCourse.publishedDate });
                    diff = (0, courseDiff_1.computeCourseDiff)(lastPersistedRef.current, preparedCourse);
                    validation = validateCourse(preparedCourse);
                    if (!validation.isValid) {
                        throw new courses_1.CourseValidationError('course', validation.issues);
                    }
                    if (!diff.hasChanges) {
                        courseStore_1.courseStore.saveCourse(preparedCourse, { skipRemoteSync: true });
                        setCourse(preparedCourse);
                        return [2 /*return*/, preparedCourse];
                    }
                    return [4 /*yield*/, (0, courses_1.syncCourseToDatabase)(preparedCourse)];
                case 1:
                    persisted = _b.sent();
                    merged = persisted ? (0, adminCourseMerge_1.mergePersistedCourse)(preparedCourse, persisted) : preparedCourse;
                    courseStore_1.courseStore.saveCourse(merged, { skipRemoteSync: true });
                    setCourse(merged);
                    lastPersistedRef.current = merged;
                    return [2 /*return*/, merged];
            }
        });
    }); };
    var handleSave = function () { return __awaiter(void 0, void 0, void 0, function () {
        var updatedCourse, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setSaveStatus('saving');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    updatedCourse = __assign(__assign({}, course), { duration: (0, courseStore_1.calculateCourseDuration)(course.modules || []), lessons: (0, courseStore_1.countTotalLessons)(course.modules || []), lastUpdated: new Date().toISOString() });
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 300); })];
                case 2:
                    _a.sent(); // Simulate save delay
                    return [4 /*yield*/, persistCourse(updatedCourse)];
                case 3:
                    _a.sent();
                    setSaveStatus('saved');
                    setLastSaveTime(new Date());
                    // Reset to idle after 3 seconds
                    setTimeout(function () { return setSaveStatus('idle'); }, 3000);
                    if (isNewCourseRoute) {
                        navigate("/admin/course-builder/".concat(updatedCourse.id));
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    if (error_2 instanceof courses_1.CourseValidationError) {
                        console.warn('⚠️ Course validation issues:', error_2.issues);
                    }
                    else {
                        console.error('❌ Error saving course:', error_2);
                    }
                    setSaveStatus('error');
                    setTimeout(function () { return setSaveStatus('idle'); }, 5000);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handlePublish = function () { return __awaiter(void 0, void 0, void 0, function () {
        var publishedCourse, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setSaveStatus('saving');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    publishedCourse = __assign(__assign({}, course), { status: 'published', publishedDate: new Date().toISOString(), duration: (0, courseStore_1.calculateCourseDuration)(course.modules || []), lessons: (0, courseStore_1.countTotalLessons)(course.modules || []), lastUpdated: new Date().toISOString() });
                    return [4 /*yield*/, persistCourse(publishedCourse, 'published')];
                case 2:
                    _a.sent();
                    setSaveStatus('saved');
                    setLastSaveTime(new Date());
                    setTimeout(function () { return setSaveStatus('idle'); }, 3000);
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    if (error_3 instanceof courses_1.CourseValidationError) {
                        console.warn('⚠️ Course validation issues:', error_3.issues);
                    }
                    else {
                        console.error('❌ Error publishing course:', error_3);
                    }
                    setSaveStatus('error');
                    setTimeout(function () { return setSaveStatus('idle'); }, 5000);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleAssignmentComplete = function () {
        setShowAssignmentModal(false);
        // Optionally refresh course data or show success message
    };
    var addModule = function () {
        var newModule = {
            id: (0, courseStore_1.generateId)('module'),
            title: "Module ".concat((course.modules || []).length + 1),
            description: '',
            duration: '0 min',
            order: (course.modules || []).length + 1,
            lessons: [],
            resources: []
        };
        setCourse(function (prev) { return (__assign(__assign({}, prev), { modules: __spreadArray(__spreadArray([], (prev.modules || []), true), [newModule], false) })); });
    };
    var updateModule = function (moduleId, updates) {
        setCourse(function (prev) {
            var updatedCourse = __assign(__assign({}, prev), { modules: (prev.modules || []).map(function (module) {
                    return module.id === moduleId ? __assign(__assign({}, module), updates) : module;
                }) });
            // Save the updated course to localStorage
            courseStore_1.courseStore.saveCourse(updatedCourse, { skipRemoteSync: true });
            return updatedCourse;
        });
    };
    var deleteModule = function (moduleId) {
        setCourse(function (prev) { return (__assign(__assign({}, prev), { modules: (prev.modules || []).filter(function (module) { return module.id !== moduleId; }) })); });
    };
    var addLesson = function (moduleId) {
        var _a;
        var module = (_a = course.modules) === null || _a === void 0 ? void 0 : _a.find(function (m) { return m.id === moduleId; });
        if (!module)
            return;
        var newLesson = {
            id: (0, courseStore_1.generateId)('lesson'),
            title: "Lesson ".concat(module.lessons.length + 1),
            type: 'video',
            duration: '10 min',
            content: {},
            completed: false,
            order: module.lessons.length + 1
        };
        updateModule(moduleId, {
            lessons: __spreadArray(__spreadArray([], module.lessons, true), [newLesson], false)
        });
    };
    var updateLesson = function (moduleId, lessonId, updates) {
        var _a;
        var module = (_a = course.modules) === null || _a === void 0 ? void 0 : _a.find(function (m) { return m.id === moduleId; });
        if (!module)
            return;
        var updatedLessons = module.lessons.map(function (lesson) {
            return lesson.id === lessonId ? __assign(__assign({}, lesson), updates) : lesson;
        });
        updateModule(moduleId, { lessons: updatedLessons });
    };
    var deleteLesson = function (moduleId, lessonId) {
        var _a;
        var module = (_a = course.modules) === null || _a === void 0 ? void 0 : _a.find(function (m) { return m.id === moduleId; });
        if (!module)
            return;
        updateModule(moduleId, {
            lessons: module.lessons.filter(function (lesson) { return lesson.id !== lessonId; })
        });
    };
    var handleVideoUpload = function (moduleId, lessonId, file) { return __awaiter(void 0, void 0, void 0, function () {
        var maxSize, uploadKey, fileExt, fileName, supabase, error, publicUrl, objectUrl, error_4, errorMessage;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    maxSize = 50 * 1024 * 1024;
                    if (file.size > maxSize) {
                        setUploadError("File size (".concat((file.size / 1024 / 1024).toFixed(1), "MB) exceeds the 50MB limit. Please compress your video or use a smaller file."));
                        return [2 /*return*/];
                    }
                    uploadKey = "".concat(moduleId, "-").concat(lessonId);
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 6, 7, 8]);
                    setUploadingVideos(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[uploadKey] = true, _a)));
                    });
                    setUploadProgress(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[uploadKey] = 0, _a)));
                    });
                    fileExt = file.name.split('.').pop();
                    fileName = "".concat(course.id, "/").concat(moduleId, "/").concat(lessonId, ".").concat(fileExt);
                    return [4 /*yield*/, (0, supabase_1.getSupabase)()];
                case 2:
                    supabase = _g.sent();
                    if (!supabase) return [3 /*break*/, 4];
                    return [4 /*yield*/, supabase.storage
                            .from('course-videos')
                            .upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: true
                        })];
                case 3:
                    error = (_g.sent()).error;
                    if (error)
                        throw error;
                    publicUrl = supabase.storage
                        .from('course-videos')
                        .getPublicUrl(fileName).data.publicUrl;
                    // Update lesson content with video URL
                    updateLesson(moduleId, lessonId, {
                        content: __assign(__assign({}, (_c = (_b = (_a = course.modules) === null || _a === void 0 ? void 0 : _a.find(function (m) { return m.id === moduleId; })) === null || _b === void 0 ? void 0 : _b.lessons.find(function (l) { return l.id === lessonId; })) === null || _c === void 0 ? void 0 : _c.content), { videoUrl: publicUrl, fileName: file.name, fileSize: "".concat((file.size / (1024 * 1024)).toFixed(1), " MB") })
                    });
                    return [3 /*break*/, 5];
                case 4:
                    objectUrl = URL.createObjectURL(file);
                    updateLesson(moduleId, lessonId, {
                        content: __assign(__assign({}, (_f = (_e = (_d = course.modules) === null || _d === void 0 ? void 0 : _d.find(function (m) { return m.id === moduleId; })) === null || _e === void 0 ? void 0 : _e.lessons.find(function (l) { return l.id === lessonId; })) === null || _f === void 0 ? void 0 : _f.content), { videoUrl: objectUrl, fileName: file.name, fileSize: "".concat((file.size / (1024 * 1024)).toFixed(1), " MB") })
                    });
                    _g.label = 5;
                case 5:
                    setUploadProgress(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[uploadKey] = 100, _a)));
                    });
                    return [3 /*break*/, 8];
                case 6:
                    error_4 = _g.sent();
                    console.error('Error uploading video:', error_4);
                    errorMessage = error_4 instanceof Error ? error_4.message : 'Unknown error occurred';
                    setUploadError("Upload failed: ".concat(errorMessage, ". This could be due to network issues or file format. Please check your connection and try again."));
                    return [3 /*break*/, 8];
                case 7:
                    setUploadingVideos(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[uploadKey] = false, _a)));
                    });
                    setTimeout(function () {
                        setUploadProgress(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[uploadKey] = 0, _a)));
                        });
                    }, 2000);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var handleFileUpload = function (moduleId, lessonId, file) { return __awaiter(void 0, void 0, void 0, function () {
        var uploadKey, fileUrl, supabase, fileExt, fileName, error, publicUrl, err_2, error_5;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    uploadKey = "".concat(moduleId, "-").concat(lessonId);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 9, 10, 11]);
                    setUploadingVideos(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[uploadKey] = true, _a)));
                    });
                    fileUrl = void 0;
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 7, , 8]);
                    return [4 /*yield*/, (0, supabase_1.getSupabase)()];
                case 3:
                    supabase = _d.sent();
                    if (!supabase) return [3 /*break*/, 5];
                    fileExt = file.name.split('.').pop();
                    fileName = "".concat(course.id, "/").concat(moduleId, "/").concat(lessonId, "-resource.").concat(fileExt);
                    return [4 /*yield*/, supabase.storage
                            .from('course-resources')
                            .upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: true
                        })];
                case 4:
                    error = (_d.sent()).error;
                    if (error)
                        throw error;
                    publicUrl = supabase.storage
                        .from('course-resources')
                        .getPublicUrl(fileName).data.publicUrl;
                    fileUrl = publicUrl;
                    return [3 /*break*/, 6];
                case 5: throw new Error('Supabase not configured');
                case 6: return [3 /*break*/, 8];
                case 7:
                    err_2 = _d.sent();
                    console.log('Supabase upload not available, using demo mode with data URL');
                    // Fallback: Create a data URL for demo purposes
                    // This keeps the file in memory/browser storage
                    fileUrl = URL.createObjectURL(file);
                    return [3 /*break*/, 8];
                case 8:
                    // Update lesson content with file URL
                    updateLesson(moduleId, lessonId, {
                        content: __assign(__assign({}, (_c = (_b = (_a = course.modules) === null || _a === void 0 ? void 0 : _a.find(function (m) { return m.id === moduleId; })) === null || _b === void 0 ? void 0 : _b.lessons.find(function (l) { return l.id === lessonId; })) === null || _c === void 0 ? void 0 : _c.content), { fileUrl: fileUrl, fileName: file.name, fileSize: "".concat((file.size / (1024 * 1024)).toFixed(1), " MB") })
                    });
                    return [3 /*break*/, 11];
                case 9:
                    error_5 = _d.sent();
                    console.error('Error uploading file:', error_5);
                    alert('Failed to upload file. Please try again.');
                    return [3 /*break*/, 11];
                case 10:
                    setUploadingVideos(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[uploadKey] = false, _a)));
                    });
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    var toggleModuleExpansion = function (moduleId) {
        setExpandedModules(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[moduleId] = !prev[moduleId], _a)));
        });
    };
    var renderLessonEditor = function (moduleId, lesson) {
        var isEditing = (editingLesson === null || editingLesson === void 0 ? void 0 : editingLesson.moduleId) === moduleId && (editingLesson === null || editingLesson === void 0 ? void 0 : editingLesson.lessonId) === lesson.id;
        var uploadKey = "".concat(moduleId, "-").concat(lesson.id);
        var isUploading = uploadingVideos[uploadKey];
        var progress = uploadProgress[uploadKey];
        if (!isEditing) {
            return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center w-8 h-8 bg-white rounded-full border border-gray-200", children: [lesson.type === 'video' && (0, jsx_runtime_1.jsx)(lucide_react_1.Video, { className: "h-4 w-4 text-blue-500" }), lesson.type === 'interactive' && (0, jsx_runtime_1.jsx)(lucide_react_1.MessageSquare, { className: "h-4 w-4 text-green-500" }), lesson.type === 'quiz' && (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 text-orange-500" }), lesson.type === 'document' && (0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "h-4 w-4 text-purple-500" }), lesson.type === 'text' && (0, jsx_runtime_1.jsx)(lucide_react_1.BookOpen, { className: "h-4 w-4 text-indigo-500" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(inlineEditing === null || inlineEditing === void 0 ? void 0 : inlineEditing.moduleId) === moduleId && (inlineEditing === null || inlineEditing === void 0 ? void 0 : inlineEditing.lessonId) === lesson.id ? ((0, jsx_runtime_1.jsx)("input", { type: "text", value: lesson.title, onChange: function (e) { return updateLesson(moduleId, lesson.id, { title: e.target.value }); }, onBlur: function () { return setInlineEditing(null); }, onKeyDown: function (e) {
                                            if (e.key === 'Enter' || e.key === 'Escape') {
                                                setInlineEditing(null);
                                            }
                                        }, className: "font-medium text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent", autoFocus: true })) : ((0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors", onDoubleClick: function () { return setInlineEditing({ moduleId: moduleId, lessonId: lesson.id }); }, title: "Double-click to edit", children: lesson.title })), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [(0, jsx_runtime_1.jsxs)("span", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-3 w-3 mr-1" }), lesson.duration] }), (0, jsx_runtime_1.jsx)("span", { className: "capitalize", children: lesson.type }), lesson.content.videoUrl && lesson.type === 'video' && ((0, jsx_runtime_1.jsxs)("span", { className: "text-green-600 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-3 w-3 mr-1" }), "Video uploaded"] })), lesson.content.fileUrl && lesson.type === 'document' && ((0, jsx_runtime_1.jsxs)("span", { className: "text-green-600 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-3 w-3 mr-1" }), "File uploaded"] }))] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return setEditingLesson({ moduleId: moduleId, lessonId: lesson.id }); }, className: "p-1 text-blue-600 hover:text-blue-800", title: "Edit lesson", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                    try {
                                        // Preview the specific lesson in LMS context
                                        var lessonUrl = "/lms/courses/".concat(course.id, "/modules/").concat(moduleId, "?lesson=").concat(lesson.id);
                                        window.open(lessonUrl, '_blank');
                                    }
                                    catch (err) {
                                        console.warn('Preview failed', err);
                                    }
                                }, className: "p-1 text-green-600 hover:text-green-800", title: "Preview lesson in LMS", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return deleteLesson(moduleId, lesson.id); }, className: "p-1 text-red-600 hover:text-red-800", title: "Delete lesson", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }));
        }
        return ((0, jsx_runtime_1.jsx)("div", { className: "border border-gray-300 rounded-lg p-4 bg-white", children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Lesson Title" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: lesson.title, onChange: function (e) { return updateLesson(moduleId, lesson.id, { title: e.target.value }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Duration" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: lesson.duration, onChange: function (e) { return updateLesson(moduleId, lesson.id, { duration: e.target.value }); }, placeholder: "e.g., 15 min", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Lesson Type" }), (0, jsx_runtime_1.jsxs)("select", { value: lesson.type, onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                    type: e.target.value,
                                    content: {} // Reset content when type changes
                                }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "video", children: "Video" }), (0, jsx_runtime_1.jsx)("option", { value: "interactive", children: "Interactive Exercise" }), (0, jsx_runtime_1.jsx)("option", { value: "quiz", children: "Quiz" }), (0, jsx_runtime_1.jsx)("option", { value: "document", children: "Download Resource" }), (0, jsx_runtime_1.jsx)("option", { value: "text", children: "Text Content" })] })] }), lesson.type === 'video' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Video Source" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("button", { onClick: function () { return updateLesson(moduleId, lesson.id, {
                                                    content: __assign(__assign({}, lesson.content), { videoSourceType: 'internal' })
                                                }); }, className: "p-4 border-2 rounded-lg transition-all duration-200 ".concat((!lesson.content.videoSourceType || lesson.content.videoSourceType === 'internal')
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-300 hover:border-gray-400'), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-6 w-6 mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium", children: "Upload File" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return updateLesson(moduleId, lesson.id, {
                                                    content: __assign(__assign({}, lesson.content), { videoSourceType: 'external' })
                                                }); }, className: "p-4 border-2 rounded-lg transition-all duration-200 ".concat(lesson.content.videoSourceType === 'external'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-300 hover:border-gray-400'), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Video, { className: "h-6 w-6 mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium", children: "External URL" })] })] })] }), (0, jsx_runtime_1.jsx)("div", { children: (!lesson.content.videoSourceType || lesson.content.videoSourceType === 'internal') ? ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Video Upload" }), lesson.content.videoUrl ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "aspect-video bg-gray-900 rounded-lg overflow-hidden", children: (0, jsx_runtime_1.jsx)("video", { controls: true, className: "w-full h-full", src: lesson.content.videoUrl, children: "Your browser does not support the video tag." }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-5 w-5 text-green-500" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-green-800 font-medium", children: [lesson.content.fileName || 'Video uploaded', lesson.content.fileSize && " (".concat(lesson.content.fileSize, ")")] })] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return updateLesson(moduleId, lesson.id, {
                                                                content: __assign(__assign({}, lesson.content), { videoUrl: '', fileName: '', fileSize: '' })
                                                            }); }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-6", children: isUploading ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader, { className: "h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: progress === 0 ? 'Preparing upload...' :
                                                            progress < 50 ? 'Uploading video...' :
                                                                progress < 100 ? 'Processing video...' : 'Upload complete!' }), progress > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "w-full bg-gray-200 rounded-full h-2 mt-2", children: (0, jsx_runtime_1.jsx)("div", { className: "bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-300", style: { width: "".concat(progress, "%") } }) })), progress > 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-gray-500 mt-1", children: [progress, "% complete"] })), uploadError && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-3 p-3 bg-red-50 rounded-lg border border-red-200", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-red-600 mb-2", children: uploadError }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                            setUploadError(null);
                                                                            var fileInput = document.createElement('input');
                                                                            fileInput.type = 'file';
                                                                            fileInput.accept = 'video/*';
                                                                            fileInput.onchange = function (e) {
                                                                                var _a, _b;
                                                                                var file = (_b = (_a = e.target) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b[0];
                                                                                if (file)
                                                                                    handleVideoUpload(moduleId, lesson.id, file);
                                                                            };
                                                                            fileInput.click();
                                                                        }, className: "text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors", children: "Try Again" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return setUploadError(null); }, className: "text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors", children: "Dismiss" })] })] }))] })) : ((0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Video, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-4", children: "Upload a video file for this lesson" }), (0, jsx_runtime_1.jsx)("input", { type: "file", accept: "video/*", onChange: function (e) {
                                                            var _a;
                                                            var file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                                                            if (file) {
                                                                handleVideoUpload(moduleId, lesson.id, file);
                                                            }
                                                        }, className: "hidden", id: "video-upload-".concat(lesson.id) }), (0, jsx_runtime_1.jsxs)("label", { htmlFor: "video-upload-".concat(lesson.id), className: "bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 cursor-pointer inline-flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Choose Video File" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-2", children: "Supported formats: MP4, WebM, MOV (max 100MB)" })] })) }))] })) : ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700", children: "Video URL" }), (0, jsx_runtime_1.jsx)("input", { type: "url", value: lesson.content.videoUrl || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                                content: __assign(__assign({}, lesson.content), { videoUrl: e.target.value })
                                            }); }, placeholder: "https://example.com/video.mp4 or YouTube/Vimeo URL", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), lesson.content.videoUrl && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "aspect-video bg-gray-900 rounded-lg overflow-hidden", children: (function () {
                                                        var url = lesson.content.videoUrl || '';
                                                        var embedUrl = (0, videoUtils_1.getVideoEmbedUrl)(lesson.content);
                                                        // Check if it's a supported embed URL (YouTube, Vimeo)
                                                        if (embedUrl && (url.includes('youtube.') || url.includes('youtu.be') || url.includes('vimeo.'))) {
                                                            return ((0, jsx_runtime_1.jsx)("iframe", { src: embedUrl, className: "w-full h-full", frameBorder: "0", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowFullScreen: true, title: lesson.title }));
                                                        }
                                                        // Direct video file
                                                        return ((0, jsx_runtime_1.jsx)("video", { controls: true, className: "w-full h-full", src: lesson.content.videoUrl, children: "Your browser does not support the video tag." }));
                                                    })() }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm text-gray-600", children: [(0, jsx_runtime_1.jsx)("span", { children: "Preview: Video will display like this to learners" }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return updateLesson(moduleId, lesson.id, {
                                                                content: __assign(__assign({}, lesson.content), { videoUrl: '' })
                                                            }); }, className: "text-red-600 hover:text-red-800 flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-3 w-3" }), (0, jsx_runtime_1.jsx)("span", { children: "Remove" })] })] })] })), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500", children: "Supports direct video URLs (.mp4, .webm, .mov) and embedded videos (YouTube, Vimeo)" })] })) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Transcript (Optional)" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.transcript || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { transcript: e.target.value })
                                        }); }, rows: 4, placeholder: "Add video transcript for accessibility...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Key Notes" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.notes || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { notes: e.target.value })
                                        }); }, rows: 3, placeholder: "Important points and takeaways from this video...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })), lesson.type === 'interactive' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Scenario Text" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.scenarioText || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { scenarioText: e.target.value })
                                        }); }, rows: 3, placeholder: "Describe the scenario or situation...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Response Options" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(lesson.content.options || []).map(function (option, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-gray-900", children: ["Option ", index + 1] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: option.isCorrect || false, onChange: function (e) {
                                                                                    var updatedOptions = __spreadArray([], (lesson.content.options || []), true);
                                                                                    updatedOptions[index] = __assign(__assign({}, option), { isCorrect: e.target.checked });
                                                                                    updateLesson(moduleId, lesson.id, {
                                                                                        content: __assign(__assign({}, lesson.content), { options: updatedOptions })
                                                                                    });
                                                                                }, className: "h-4 w-4 text-green-500 focus:ring-green-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-green-600", children: "Correct Answer" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                            var updatedOptions = (lesson.content.options || []).filter(function (_, i) { return i !== index; });
                                                                            updateLesson(moduleId, lesson.id, {
                                                                                content: __assign(__assign({}, lesson.content), { options: updatedOptions })
                                                                            });
                                                                        }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: option.text || '', onChange: function (e) {
                                                            var updatedOptions = __spreadArray([], (lesson.content.options || []), true);
                                                            updatedOptions[index] = __assign(__assign({}, option), { text: e.target.value });
                                                            updateLesson(moduleId, lesson.id, {
                                                                content: __assign(__assign({}, lesson.content), { options: updatedOptions })
                                                            });
                                                        }, placeholder: "Option text...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-2" }), (0, jsx_runtime_1.jsx)("textarea", { value: option.feedback || '', onChange: function (e) {
                                                            var updatedOptions = __spreadArray([], (lesson.content.options || []), true);
                                                            updatedOptions[index] = __assign(__assign({}, option), { feedback: e.target.value });
                                                            updateLesson(moduleId, lesson.id, {
                                                                content: __assign(__assign({}, lesson.content), { options: updatedOptions })
                                                            });
                                                        }, placeholder: "Feedback for this option...", rows: 2, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                    var newOption = { text: '', feedback: '', isCorrect: false };
                                                    var updatedOptions = __spreadArray(__spreadArray([], (lesson.content.options || []), true), [newOption], false);
                                                    updateLesson(moduleId, lesson.id, {
                                                        content: __assign(__assign({}, lesson.content), { options: updatedOptions })
                                                    });
                                                }, className: "w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4 mx-auto" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Instructions" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.instructions || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { instructions: e.target.value })
                                        }); }, rows: 2, placeholder: "Instructions for completing this exercise...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })), lesson.type === 'quiz' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Passing Score (%)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: "0", max: "100", value: lesson.content.passingScore || 80, onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                                    content: __assign(__assign({}, lesson.content), { passingScore: parseInt(e.target.value) })
                                                }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: lesson.content.allowRetakes || false, onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                                            content: __assign(__assign({}, lesson.content), { allowRetakes: e.target.checked })
                                                        }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-700", children: "Allow Retakes" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: lesson.content.showCorrectAnswers || false, onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                                            content: __assign(__assign({}, lesson.content), { showCorrectAnswers: e.target.checked })
                                                        }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-700", children: "Show Correct Answers" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Questions" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(lesson.content.questions || []).map(function (question, qIndex) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-3", children: [(0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-gray-900", children: ["Question ", qIndex + 1] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                    var updatedQuestions = (lesson.content.questions || []).filter(function (_, i) { return i !== qIndex; });
                                                                    updateLesson(moduleId, lesson.id, {
                                                                        content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                    });
                                                                }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: question.text, onChange: function (e) {
                                                            var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                            updatedQuestions[qIndex] = __assign(__assign({}, question), { text: e.target.value });
                                                            updateLesson(moduleId, lesson.id, {
                                                                content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                            });
                                                        }, placeholder: "Question text...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(question.options || []).map(function (option, oIndex) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", name: "correct-".concat(question.id), checked: question.correctAnswerIndex === oIndex, onChange: function () {
                                                                            var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                            updatedQuestions[qIndex] = __assign(__assign({}, question), { correctAnswerIndex: oIndex });
                                                                            updateLesson(moduleId, lesson.id, {
                                                                                content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                            });
                                                                        }, className: "h-4 w-4 text-green-500 focus:ring-green-500" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: option, onChange: function (e) {
                                                                            var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                            var updatedOptions = __spreadArray([], (question.options || []), true);
                                                                            updatedOptions[oIndex] = e.target.value;
                                                                            updatedQuestions[qIndex] = __assign(__assign({}, question), { options: updatedOptions });
                                                                            updateLesson(moduleId, lesson.id, {
                                                                                content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                            });
                                                                        }, placeholder: "Option ".concat(oIndex + 1, "..."), className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                            var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                            var updatedOptions = (question.options || []).filter(function (_, i) { return i !== oIndex; });
                                                                            updatedQuestions[qIndex] = __assign(__assign({}, question), { options: updatedOptions, correctAnswerIndex: (question.correctAnswerIndex || 0) > oIndex ? (question.correctAnswerIndex || 0) - 1 : (question.correctAnswerIndex || 0) });
                                                                            updateLesson(moduleId, lesson.id, {
                                                                                content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                            });
                                                                        }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }, oIndex)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                    var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                    var updatedOptions = __spreadArray(__spreadArray([], (question.options || []), true), [''], false);
                                                                    updatedQuestions[qIndex] = __assign(__assign({}, question), { options: updatedOptions });
                                                                    updateLesson(moduleId, lesson.id, {
                                                                        content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                    });
                                                                }, className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Option" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Explanation (Optional)" }), (0, jsx_runtime_1.jsx)("textarea", { value: question.explanation || '', onChange: function (e) {
                                                                    var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                    updatedQuestions[qIndex] = __assign(__assign({}, question), { explanation: e.target.value });
                                                                    updateLesson(moduleId, lesson.id, {
                                                                        content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                    });
                                                                }, rows: 2, placeholder: "Explain why this is the correct answer...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }, question.id)); }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () {
                                                    var newQuestion = {
                                                        id: (0, courseStore_1.generateId)('question'),
                                                        text: '',
                                                        options: ['', ''],
                                                        correctAnswerIndex: 0,
                                                        explanation: ''
                                                    };
                                                    var updatedQuestions = __spreadArray(__spreadArray([], (lesson.content.questions || []), true), [newQuestion], false);
                                                    updateLesson(moduleId, lesson.id, {
                                                        content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                    });
                                                }, className: "w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4 mx-auto mb-1" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Add Question" })] })] })] })] })), lesson.type === 'document' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Resource Title" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: lesson.content.title || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { title: e.target.value })
                                        }); }, placeholder: "e.g., Leadership Assessment Worksheet", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.description || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { description: e.target.value })
                                        }); }, rows: 3, placeholder: "Describe what this resource contains and how to use it...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "File Upload" }), lesson.content.fileUrl ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-5 w-5 text-green-500" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-green-800 font-medium", children: [lesson.content.fileName, " (", lesson.content.fileSize, ")"] })] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return updateLesson(moduleId, lesson.id, {
                                                    content: __assign(__assign({}, lesson.content), { fileUrl: '', fileName: '', fileSize: '' })
                                                }); }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-6", children: isUploading ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader, { className: "h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: "Uploading file..." })] })) : ((0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-4", children: "Upload a downloadable resource" }), (0, jsx_runtime_1.jsx)("input", { type: "file", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx", onChange: function (e) {
                                                        var _a;
                                                        var file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                                                        if (file) {
                                                            handleFileUpload(moduleId, lesson.id, file);
                                                        }
                                                    }, className: "hidden", id: "file-upload-".concat(lesson.id) }), (0, jsx_runtime_1.jsxs)("label", { htmlFor: "file-upload-".concat(lesson.id), className: "bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors duration-200 cursor-pointer inline-flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Choose File" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-2", children: "Supported: PDF, DOC, XLS, PPT (max 50MB)" })] })) }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Instructions" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.instructions || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { instructions: e.target.value })
                                        }); }, rows: 2, placeholder: "Instructions for using this resource...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })), lesson.type === 'text' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Content Title" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: lesson.content.title || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { title: e.target.value })
                                        }); }, placeholder: "e.g., Reflection: Leadership Journey", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Content Description" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.description || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { description: e.target.value })
                                        }); }, rows: 3, placeholder: "Brief description of this content section...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Main Content" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.content || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { content: e.target.value })
                                        }); }, rows: 6, placeholder: "Enter the main content, reading material, or instructions...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "This content will be displayed to learners. You can include instructions, reading material, or reflection prompts." })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Reflection Prompt (Optional)" }), (0, jsx_runtime_1.jsx)("textarea", { value: lesson.content.reflectionPrompt || '', onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                            content: __assign(__assign({}, lesson.content), { reflectionPrompt: e.target.value })
                                        }); }, rows: 4, placeholder: "What questions do you want learners to reflect on? e.g., 'How will you apply these concepts in your leadership role?'", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "If provided, learners will see a reflection area where they can write and save their thoughts." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: lesson.content.allowReflection || false, onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                                        content: __assign(__assign({}, lesson.content), { allowReflection: e.target.checked })
                                                    }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-700", children: "Enable reflection area for learners" })] }) }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: lesson.content.requireReflection || false, onChange: function (e) { return updateLesson(moduleId, lesson.id, {
                                                        content: __assign(__assign({}, lesson.content), { requireReflection: e.target.checked })
                                                    }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded", disabled: !lesson.content.allowReflection }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm ".concat(!lesson.content.allowReflection ? 'text-gray-400' : 'text-gray-700'), children: "Require reflection to complete lesson" })] }) })] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "border-t border-gray-200 pt-6 mt-6", children: [(0, jsx_runtime_1.jsxs)("h4", { className: "text-lg font-medium text-gray-900 mb-4 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-5 w-5 mr-2 text-blue-500" }), "Additional Content"] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-4", children: "Add quiz questions, additional reading, or notes to enhance any lesson type." }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700", children: "Knowledge Check Questions" }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () {
                                                    var newQuestion = {
                                                        id: (0, courseStore_1.generateId)('question'),
                                                        text: '',
                                                        options: ['', ''],
                                                        correctAnswerIndex: 0,
                                                        explanation: ''
                                                    };
                                                    var updatedQuestions = __spreadArray(__spreadArray([], (lesson.content.questions || []), true), [newQuestion], false);
                                                    updateLesson(moduleId, lesson.id, {
                                                        content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                    });
                                                }, className: "text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Add Question" })] })] }), (lesson.content.questions || []).length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: (lesson.content.questions || []).map(function (question, qIndex) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4 bg-gray-50", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-3", children: [(0, jsx_runtime_1.jsxs)("span", { className: "font-medium text-gray-900", children: ["Question ", qIndex + 1] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                var updatedQuestions = (lesson.content.questions || []).filter(function (_, i) { return i !== qIndex; });
                                                                updateLesson(moduleId, lesson.id, {
                                                                    content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                });
                                                            }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: question.text, onChange: function (e) {
                                                        var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                        updatedQuestions[qIndex] = __assign(__assign({}, question), { text: e.target.value });
                                                        updateLesson(moduleId, lesson.id, {
                                                            content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                        });
                                                    }, placeholder: "Question text...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(question.options || []).map(function (option, oIndex) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", name: "correct-".concat(question.id), checked: question.correctAnswerIndex === oIndex, onChange: function () {
                                                                        var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                        updatedQuestions[qIndex] = __assign(__assign({}, question), { correctAnswerIndex: oIndex });
                                                                        updateLesson(moduleId, lesson.id, {
                                                                            content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                        });
                                                                    }, className: "h-4 w-4 text-green-500 focus:ring-green-500" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: option, onChange: function (e) {
                                                                        var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                        var updatedOptions = __spreadArray([], (question.options || []), true);
                                                                        updatedOptions[oIndex] = e.target.value;
                                                                        updatedQuestions[qIndex] = __assign(__assign({}, question), { options: updatedOptions });
                                                                        updateLesson(moduleId, lesson.id, {
                                                                            content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                        });
                                                                    }, placeholder: "Option ".concat(oIndex + 1, "..."), className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                        var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                        var updatedOptions = (question.options || []).filter(function (_, i) { return i !== oIndex; });
                                                                        updatedQuestions[qIndex] = __assign(__assign({}, question), { options: updatedOptions, correctAnswerIndex: (question.correctAnswerIndex || 0) > oIndex ? (question.correctAnswerIndex || 0) - 1 : (question.correctAnswerIndex || 0) });
                                                                        updateLesson(moduleId, lesson.id, {
                                                                            content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                        });
                                                                    }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }, oIndex)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                var updatedOptions = __spreadArray(__spreadArray([], (question.options || []), true), [''], false);
                                                                updatedQuestions[qIndex] = __assign(__assign({}, question), { options: updatedOptions });
                                                                updateLesson(moduleId, lesson.id, {
                                                                    content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                });
                                                            }, className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Option" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Explanation (Optional)" }), (0, jsx_runtime_1.jsx)("textarea", { value: question.explanation || '', onChange: function (e) {
                                                                var updatedQuestions = __spreadArray([], (lesson.content.questions || []), true);
                                                                updatedQuestions[qIndex] = __assign(__assign({}, question), { explanation: e.target.value });
                                                                updateLesson(moduleId, lesson.id, {
                                                                    content: __assign(__assign({}, lesson.content), { questions: updatedQuestions })
                                                                });
                                                            }, rows: 2, placeholder: "Explain why this is the correct answer...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }, question.id)); }) })), (lesson.content.questions || []).length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-8 w-8 text-gray-400 mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-2", children: "No quiz questions added" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-500 text-xs", children: "Add quiz questions to test learner comprehension after the main content" })] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end space-x-3 pt-4 border-t border-gray-200", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return setEditingLesson(null); }, className: "px-4 py-2 text-gray-600 hover:text-gray-800", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return setEditingLesson(null); }, className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200", children: "Save Lesson" })] })] }) }));
    };
    var tabs = [
        { id: 'overview', name: 'Overview', icon: lucide_react_1.Settings },
        { id: 'content', name: 'Content', icon: lucide_react_1.BookOpen },
        { id: 'settings', name: 'Settings', icon: lucide_react_1.Target },
        { id: 'history', name: 'History', icon: lucide_react_1.Clock }
    ];
    if (initializing && isEditing) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "p-6 max-w-4xl mx-auto", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader, { className: "h-5 w-5 animate-spin text-orange-500" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-900", children: "Loading course builder\u2026" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500", children: "Fetching the latest course data." })] })] }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-7xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsxs)(react_router_dom_1.Link, { to: "/admin/courses", className: "inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Course Management"] }), loadError && ((0, jsx_runtime_1.jsx)("div", { className: "mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800", children: loadError })), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: isEditing ? 'Edit Course' : 'Create New Course' }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: isEditing ? "Editing: ".concat(course.title) : 'Build a comprehensive learning experience' }), isEditing && (function () {
                                        var validation = validateCourse(course);
                                        return ((0, jsx_runtime_1.jsx)("div", { className: "mt-2 px-3 py-2 rounded-lg text-sm ".concat(validation.isValid
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'), children: validation.isValid ? ((0, jsx_runtime_1.jsx)("span", { children: "\u2705 Course is valid and ready to publish" })) : ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("span", { children: ["\u26A0\uFE0F ", validation.issues.length, " validation issue(s):"] }), (0, jsx_runtime_1.jsxs)("ul", { className: "mt-1 text-xs", children: [validation.issues.slice(0, 3).map(function (issue, index) { return ((0, jsx_runtime_1.jsxs)("li", { children: ["\u2022 ", issue] }, index)); }), validation.issues.length > 3 && ((0, jsx_runtime_1.jsxs)("li", { children: ["\u2022 ... and ", validation.issues.length - 3, " more"] }))] })] })) }));
                                    })()] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setShowPreview(true); }, className: "bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors duration-200 flex items-center space-x-2 font-medium", title: "Preview course as learner", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Live Preview" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: handleSave, "data-save-button": true, disabled: saveStatus === 'saving', className: "px-6 py-3 rounded-lg transition-all duration-200 flex items-center space-x-2 font-medium ".concat(saveStatus === 'saved'
                                            ? 'bg-green-500 text-white hover:bg-green-600'
                                            : saveStatus === 'error'
                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                : 'bg-blue-500 text-white hover:bg-blue-600', " ").concat(saveStatus === 'saving' ? 'opacity-75 cursor-not-allowed' : ''), children: saveStatus === 'saving' ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Loader, { className: "h-4 w-4 animate-spin" }), (0, jsx_runtime_1.jsx)("span", { children: "Saving..." })] })) : saveStatus === 'saved' ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Saved!" })] })) : saveStatus === 'error' ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Retry Save" })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Save Draft" }), (0, jsx_runtime_1.jsx)("span", { className: "hidden md:inline text-xs opacity-75", children: "\u2318S" })] })) }), lastSaveTime && saveStatus === 'idle' && ((0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-500 flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-3 w-3 mr-1 text-green-500" }), "Auto-saved at ", lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })] })), course.status === 'draft' && ((0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setShowAssignmentModal(true); }, className: "bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2", disabled: !course.id || (course.modules || []).length === 0, title: !course.id || (course.modules || []).length === 0 ? "Save course and add content before assigning" : "", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Assign to Users" })] })), (0, jsx_runtime_1.jsxs)("button", { onClick: handlePublish, className: "bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2", disabled: (course.modules || []).length === 0, title: (course.modules || []).length === 0 ? "Add content before publishing" : "", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: course.status === 'published' ? 'Update Published' : 'Publish Course' })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return window.open("/courses/".concat(course.id), '_blank'); }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Preview" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () {
                                            try {
                                                var newId = (0, courseStore_1.generateId)('course');
                                                var cloned = __assign(__assign({}, course), { id: newId, title: "".concat(course.title, " (Copy)"), createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString(), enrollments: 0, completions: 0, completionRate: 0 });
                                                courseStore_1.courseStore.saveCourse(cloned, { skipRemoteSync: true });
                                                navigate("/admin/course-builder/".concat(newId));
                                            }
                                            catch (err) {
                                                console.warn('Failed to duplicate course', err);
                                            }
                                        }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Duplicate" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () {
                                            try {
                                                var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(course, null, 2));
                                                var dlAnchor = document.createElement('a');
                                                dlAnchor.setAttribute('href', dataStr);
                                                dlAnchor.setAttribute('download', "".concat(course.title.replace(/\s+/g, '_').toLowerCase() || 'course', ".json"));
                                                document.body.appendChild(dlAnchor);
                                                dlAnchor.click();
                                                dlAnchor.remove();
                                            }
                                            catch (err) {
                                                console.warn('Export failed', err);
                                            }
                                        }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Export" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () {
                                            if (!confirm('Delete this course? This action cannot be undone.'))
                                                return;
                                            try {
                                                courseStore_1.courseStore.deleteCourse(course.id);
                                                navigate('/admin/courses');
                                            }
                                            catch (err) {
                                                console.warn('Delete failed', err);
                                            }
                                        }, className: "border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Delete" })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 mb-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "border-b border-gray-200", children: (0, jsx_runtime_1.jsx)("nav", { className: "flex space-x-8 px-6", children: tabs.map(function (tab) {
                                var Icon = tab.icon;
                                return ((0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setActiveTab(tab.id); }, className: "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ".concat(activeTab === tab.id
                                        ? 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'), children: [(0, jsx_runtime_1.jsx)(Icon, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: tab.name })] }, tab.id));
                            }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [activeTab === 'overview' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Course Title *" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: course.title, onChange: function (e) { return setCourse(function (prev) { return (__assign(__assign({}, prev), { title: e.target.value })); }); }, placeholder: "e.g., Foundations of Inclusive Leadership", className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Difficulty Level" }), (0, jsx_runtime_1.jsxs)("select", { value: course.difficulty, onChange: function (e) { return setCourse(function (prev) { return (__assign(__assign({}, prev), { difficulty: e.target.value })); }); }, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "Beginner", children: "Beginner" }), (0, jsx_runtime_1.jsx)("option", { value: "Intermediate", children: "Intermediate" }), (0, jsx_runtime_1.jsx)("option", { value: "Advanced", children: "Advanced" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), (0, jsx_runtime_1.jsx)("textarea", { value: course.description, onChange: function (e) { return setCourse(function (prev) { return (__assign(__assign({}, prev), { description: e.target.value })); }); }, rows: 4, placeholder: "Describe what learners will gain from this course...", className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Learning Objectives" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(course.learningObjectives || []).map(function (objective, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: objective, onChange: function (e) {
                                                                    var updated = __spreadArray([], (course.learningObjectives || []), true);
                                                                    updated[index] = e.target.value;
                                                                    setCourse(function (prev) { return (__assign(__assign({}, prev), { learningObjectives: updated })); });
                                                                }, placeholder: "Learning objective...", className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                    var updated = (course.learningObjectives || []).filter(function (_, i) { return i !== index; });
                                                                    setCourse(function (prev) { return (__assign(__assign({}, prev), { learningObjectives: updated })); });
                                                                }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return setCourse(function (prev) { return (__assign(__assign({}, prev), { learningObjectives: __spreadArray(__spreadArray([], (prev.learningObjectives || []), true), [''], false) })); }); }, className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Learning Objective" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Key Takeaways" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(course.keyTakeaways || []).map(function (takeaway, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: takeaway, onChange: function (e) {
                                                                    var updated = __spreadArray([], (course.keyTakeaways || []), true);
                                                                    updated[index] = e.target.value;
                                                                    setCourse(function (prev) { return (__assign(__assign({}, prev), { keyTakeaways: updated })); });
                                                                }, placeholder: "Key takeaway...", className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                    var updated = (course.keyTakeaways || []).filter(function (_, i) { return i !== index; });
                                                                    setCourse(function (prev) { return (__assign(__assign({}, prev), { keyTakeaways: updated })); });
                                                                }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return setCourse(function (prev) { return (__assign(__assign({}, prev), { keyTakeaways: __spreadArray(__spreadArray([], (prev.keyTakeaways || []), true), [''], false) })); }); }, className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Key Takeaway" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Tags" }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2 mb-2", children: (course.tags || []).map(function (tag, index) { return ((0, jsx_runtime_1.jsxs)("span", { className: "bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)("span", { children: tag }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                var updated = (course.tags || []).filter(function (_, i) { return i !== index; });
                                                                setCourse(function (prev) { return (__assign(__assign({}, prev), { tags: updated })); });
                                                            }, className: "text-orange-600 hover:text-orange-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-3 w-3" }) })] }, index)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Add a tag...", onKeyPress: function (e) {
                                                            if (e.key === 'Enter') {
                                                                var input = e.target;
                                                                var tag_1 = input.value.trim();
                                                                if (tag_1 && !(course.tags || []).includes(tag_1)) {
                                                                    setCourse(function (prev) { return (__assign(__assign({}, prev), { tags: __spreadArray(__spreadArray([], (prev.tags || []), true), [tag_1], false) })); });
                                                                    input.value = '';
                                                                }
                                                            }
                                                        }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-500", children: "Press Enter to add" })] })] })] })), activeTab === 'content' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900", children: "Course Modules" }), (0, jsx_runtime_1.jsxs)("button", { onClick: addModule, className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Add Module" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(course.modules || []).map(function (module, _moduleIndex) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "p-4 bg-gray-50 border-b border-gray-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 flex-1", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return toggleModuleExpansion(module.id); }, className: "text-gray-600 hover:text-gray-800", children: expandedModules[module.id] ? ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronUp, { className: "h-5 w-5" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "h-5 w-5" })) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: module.title, onChange: function (e) { return updateModule(module.id, { title: e.target.value }); }, placeholder: "Module title...", className: "font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: module.description, onChange: function (e) { return updateModule(module.id, { description: e.target.value }); }, placeholder: "Module description...", className: "text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full mt-1" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-600", children: [module.lessons.length, " lessons"] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return deleteModule(module.id); }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }) }), expandedModules[module.id] && ((0, jsx_runtime_1.jsxs)("div", { className: "p-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "space-y-3 mb-4", children: module.lessons.map(function (lesson) { return ((0, jsx_runtime_1.jsx)("div", { id: "lesson-".concat(lesson.id), className: highlightLessonId === lesson.id ? 'transition-all duration-300 ring-2 ring-orange-300 bg-orange-50 rounded-md p-1' : '', children: renderLessonEditor(module.id, lesson) }, lesson.id)); }) }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return addLesson(module.id); }, className: "w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-5 w-5 mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm", children: "Add Lesson" })] })] }))] }, module.id)); }), (course.modules || []).length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-12 border-2 border-dashed border-gray-300 rounded-lg", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BookOpen, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No modules yet" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-4", children: "Start building your course by adding the first module." }), (0, jsx_runtime_1.jsx)("button", { onClick: addModule, className: "bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200", children: "Add First Module" })] }))] })] })), activeTab === 'overview' && ((0, jsx_runtime_1.jsx)("div", { className: "mt-8", children: (0, jsx_runtime_1.jsx)(AIContentAssistant_1.default, { course: course, onApplySuggestion: handleApplySuggestion, onDismissSuggestion: handleDismissSuggestion }) })), activeTab === 'settings' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Course Type" }), (0, jsx_runtime_1.jsxs)("select", { value: course.type, onChange: function (e) { return setCourse(function (prev) { return (__assign(__assign({}, prev), { type: e.target.value })); }); }, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "Video", children: "Video" }), (0, jsx_runtime_1.jsx)("option", { value: "Interactive", children: "Interactive" }), (0, jsx_runtime_1.jsx)("option", { value: "Mixed", children: "Mixed" }), (0, jsx_runtime_1.jsx)("option", { value: "Workshop", children: "Workshop" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Estimated Time" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: course.estimatedTime, onChange: function (e) { return setCourse(function (prev) { return (__assign(__assign({}, prev), { estimatedTime: e.target.value })); }); }, placeholder: "e.g., 45-60 minutes", className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Prerequisites" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(course.prerequisites || []).map(function (prerequisite, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: prerequisite, onChange: function (e) {
                                                                    var updated = __spreadArray([], (course.prerequisites || []), true);
                                                                    updated[index] = e.target.value;
                                                                    setCourse(function (prev) { return (__assign(__assign({}, prev), { prerequisites: updated })); });
                                                                }, placeholder: "Prerequisite...", className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                    var updated = (course.prerequisites || []).filter(function (_, i) { return i !== index; });
                                                                    setCourse(function (prev) { return (__assign(__assign({}, prev), { prerequisites: updated })); });
                                                                }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return setCourse(function (prev) { return (__assign(__assign({}, prev), { prerequisites: __spreadArray(__spreadArray([], (prev.prerequisites || []), true), [''], false) })); }); }, className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Prerequisite" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Certification Settings" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 p-4 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: ((_a = course.certification) === null || _a === void 0 ? void 0 : _a.available) || false, onChange: function (e) { return setCourse(function (prev) {
                                                                    var _a;
                                                                    return (__assign(__assign({}, prev), { certification: __assign(__assign({}, ((_a = prev.certification) !== null && _a !== void 0 ? _a : { available: false, name: '', requirements: [], validFor: '1 year', renewalRequired: false })), { available: e.target.checked }) }));
                                                                }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-700", children: "Offer certification for this course" })] }), ((_b = course.certification) === null || _b === void 0 ? void 0 : _b.available) && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Certificate Name" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: course.certification.name, onChange: function (e) { return setCourse(function (prev) { return (__assign(__assign({}, prev), { certification: __assign(__assign({}, prev.certification), { name: e.target.value }) })); }); }, placeholder: "e.g., Inclusive Leadership Foundation Certificate", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Requirements" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [course.certification.requirements.map(function (requirement, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: requirement, onChange: function (e) {
                                                                                            var updated = __spreadArray([], course.certification.requirements, true);
                                                                                            updated[index] = e.target.value;
                                                                                            setCourse(function (prev) { return (__assign(__assign({}, prev), { certification: __assign(__assign({}, prev.certification), { requirements: updated }) })); });
                                                                                        }, placeholder: "Certification requirement...", className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                                            var updated = course.certification.requirements.filter(function (_, i) { return i !== index; });
                                                                                            setCourse(function (prev) { return (__assign(__assign({}, prev), { certification: __assign(__assign({}, prev.certification), { requirements: updated }) })); });
                                                                                        }, className: "text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return setCourse(function (prev) { return (__assign(__assign({}, prev), { certification: __assign(__assign({}, prev.certification), { requirements: __spreadArray(__spreadArray([], prev.certification.requirements, true), [''], false) }) })); }); }, className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Requirement" })] })] })] }))] })] })] })), activeTab === 'history' && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-6", children: (0, jsx_runtime_1.jsx)(VersionControl_1.default, { course: course, onRestore: handleRestoreVersion }) }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Course Preview" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("img", { src: course.thumbnail, alt: course.title, className: "w-full h-48 object-cover rounded-lg mb-4" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-2xl font-bold text-gray-900 mb-2", children: course.title || 'Course Title' }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-4", children: course.description || 'Course description will appear here...' }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [(0, jsx_runtime_1.jsxs)("span", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-4 w-4 mr-1" }), (0, courseStore_1.calculateCourseDuration)(course.modules || [])] }), (0, jsx_runtime_1.jsxs)("span", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BookOpen, { className: "h-4 w-4 mr-1" }), (0, courseStore_1.countTotalLessons)(course.modules || []), " lessons"] }), (0, jsx_runtime_1.jsxs)("span", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-4 w-4 mr-1" }), course.difficulty] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-semibold text-gray-900 mb-3", children: "Learning Objectives:" }), (0, jsx_runtime_1.jsxs)("ul", { className: "space-y-2 mb-6", children: [(course.learningObjectives || []).slice(0, 3).map(function (objective, index) { return ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-start space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-700 text-sm", children: objective || 'Learning objective...' })] }, index)); }), (course.learningObjectives || []).length > 3 && ((0, jsx_runtime_1.jsxs)("li", { className: "text-sm text-gray-500", children: ["+", (course.learningObjectives || []).length - 3, " more objectives"] }))] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: (course.tags || []).map(function (tag, index) { return ((0, jsx_runtime_1.jsx)("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: tag }, index)); }) })] })] })] }), (0, jsx_runtime_1.jsx)(CourseAssignmentModal_1.default, { isOpen: showAssignmentModal, onClose: function () { return setShowAssignmentModal(false); }, onAssignComplete: handleAssignmentComplete, selectedUsers: [], course: { id: course.id, title: course.title, duration: course.duration } }), (0, jsx_runtime_1.jsx)(LivePreview_1.default, { isOpen: showPreview, onClose: function () { return setShowPreview(false); }, course: course, currentModule: editingLesson ? (_c = course.modules) === null || _c === void 0 ? void 0 : _c.find(function (m) { return m.id === editingLesson.moduleId; }) : undefined, currentLesson: editingLesson ?
                    (_e = (_d = course.modules) === null || _d === void 0 ? void 0 : _d.find(function (m) { return m.id === editingLesson.moduleId; })) === null || _e === void 0 ? void 0 : _e.lessons.find(function (l) { return l.id === editingLesson.lessonId; }) : undefined })] }));
};
exports.default = AdminCourseBuilder;
