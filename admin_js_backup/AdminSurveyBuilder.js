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
var lucide_react_1 = require("lucide-react");
// Lazy load heavy components
var AssignmentModal = (0, react_1.lazy)(function () { return Promise.resolve().then(function () { return require('../../components/Survey/AssignmentModal'); }); });
var SurveySettingsModal = (0, react_1.lazy)(function () { return Promise.resolve().then(function () { return require('../../components/Survey/SurveySettingsModal'); }); });
var surveyTemplates_1 = require("../../data/surveyTemplates");
var surveys_1 = require("../../dal/surveys");
var AdminSurveyBuilder = function () {
    var _a, _b;
    var surveyId = (0, react_router_dom_1.useParams)().surveyId;
    var searchParams = (0, react_router_dom_1.useSearchParams)()[0];
    var templateId = searchParams.get('template');
    var isAIMode = searchParams.get('ai') === '1';
    var _c = (0, react_1.useState)(null), survey = _c[0], setSurvey = _c[1];
    var _d = (0, react_1.useState)(''), activeSection = _d[0], setActiveSection = _d[1];
    var _e = (0, react_1.useState)(null), draggedQuestion = _e[0], setDraggedQuestion = _e[1];
    var _f = (0, react_1.useState)(false), showSettings = _f[0], setShowSettings = _f[1];
    var _g = (0, react_1.useState)(false), showBranding = _g[0], setShowBranding = _g[1];
    var _h = (0, react_1.useState)(false), showAssignModal = _h[0], setShowAssignModal = _h[1];
    var _j = (0, react_1.useState)(false), isSaving = _j[0], setIsSaving = _j[1];
    var _k = (0, react_1.useState)(''), lastSavedAt = _k[0], setLastSavedAt = _k[1];
    var saveDebounceRef = react_1.default.useRef(null);
    var initialLoadRef = react_1.default.useRef(true);
    var _l = (0, react_1.useState)(0), queueLength = _l[0], setQueueLength = _l[1];
    var _m = (0, react_1.useState)(null), lastFlush = _m[0], setLastFlush = _m[1];
    // Organizations data (in a real app, this would come from an API)
    var organizations = [
        { id: '1', name: 'Pacific Coast University', type: 'University', learners: 45 },
        { id: '2', name: 'Mountain View High School', type: 'K-12 Education', learners: 23 },
        { id: '3', name: 'Community Impact Network', type: 'Nonprofit', learners: 28 },
        { id: '4', name: 'Regional Fire Department', type: 'Government', learners: 67 },
        { id: '5', name: 'TechForward Solutions', type: 'Corporate', learners: 34 },
        { id: '6', name: 'Regional Medical Center', type: 'Healthcare', learners: 89 },
        { id: '7', name: 'Unity Community Church', type: 'Religious', learners: 15 }
    ];
    (0, react_1.useEffect)(function () {
        if (surveyId && surveyId !== 'new') {
            // Load existing survey
            loadSurvey(surveyId);
        }
        else if (templateId) {
            // Create from template
            createFromTemplate(templateId);
        }
        else {
            // Create blank survey
            createBlankSurvey();
        }
    }, [surveyId, templateId]);
    var loadSurvey = function (id) {
        // Try local storage first
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var local;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, surveys_1.getSurveyById)(id)];
                    case 1:
                        local = _a.sent();
                        if (local) {
                            setSurvey(local);
                            if (local.sections.length > 0)
                                setActiveSection(local.sections[0].id);
                            return [2 /*return*/];
                        }
                        return [2 /*return*/];
                }
            });
        }); })();
        // Sample fallback (if no local)
        var sampleSurvey = {
            id: id,
            title: 'Q1 2025 Climate Assessment',
            description: 'Quarterly organizational climate and culture assessment',
            status: 'draft',
            createdBy: 'Mya Dennis',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: [],
            branding: surveyTemplates_1.defaultBranding,
            settings: {
                anonymityMode: 'anonymous',
                anonymityThreshold: 5,
                allowMultipleResponses: false,
                showProgressBar: true,
                consentRequired: false,
                allowAnonymous: true,
                allowSaveAndContinue: true,
                randomizeQuestions: false,
                randomizeOptions: false
            },
            assignedTo: {
                organizationIds: [],
                userIds: [],
                cohortIds: []
            },
            blocks: [],
            defaultLanguage: 'en',
            supportedLanguages: ['en'],
            completionSettings: {
                thankYouMessage: 'Thank you for completing our survey!',
                showResources: true,
                recommendedCourses: []
            },
            reflectionPrompts: [
                "What's one change that would make you feel a stronger sense of belonging?",
                "How can leadership better support inclusion in your daily work?",
                "What would you like to see more of in our organization's culture?"
            ]
        };
        setSurvey(sampleSurvey);
        if (sampleSurvey.sections.length > 0) {
            setActiveSection(sampleSurvey.sections[0].id);
        }
        // Load assignments from backend if available
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var assignment;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, surveys_1.getAssignments)(id)];
                    case 1:
                        assignment = _a.sent();
                        if (assignment && assignment.organization_ids) {
                            setSurvey(function (prev) {
                                var _a, _b, _c;
                                return prev ? __assign(__assign({}, prev), { assignedTo: {
                                        organizationIds: assignment.organization_ids,
                                        userIds: ((_a = prev.assignedTo) === null || _a === void 0 ? void 0 : _a.userIds) || [],
                                        departmentIds: ((_b = prev.assignedTo) === null || _b === void 0 ? void 0 : _b.departmentIds) || [],
                                        cohortIds: ((_c = prev.assignedTo) === null || _c === void 0 ? void 0 : _c.cohortIds) || []
                                    } }) : prev;
                            });
                        }
                        return [2 /*return*/];
                }
            });
        }); })();
    };
    var createFromTemplate = function (templateId) {
        var _a, _b;
        var template = surveyTemplates_1.surveyTemplates.find(function (t) { return t.id === templateId; });
        if (!template) {
            createBlankSurvey();
            return;
        }
        var newSurvey = {
            id: "survey-".concat(Date.now()),
            title: template.name,
            description: template.description,
            status: 'draft',
            createdBy: 'Mya Dennis',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: template.sections.map(function (section, index) { return (__assign(__assign({}, section), { id: "section-".concat(Date.now(), "-").concat(index), questions: section.questions.map(function (question, qIndex) { return (__assign(__assign({}, question), { id: "question-".concat(Date.now(), "-").concat(index, "-").concat(qIndex) })); }) })); }),
            branding: surveyTemplates_1.defaultBranding,
            settings: __assign(__assign({}, template.defaultSettings), { accessControl: __assign({ requireLogin: false }, (_a = template.defaultSettings) === null || _a === void 0 ? void 0 : _a.accessControl), notifications: __assign({ sendReminders: true, reminderSchedule: [3, 7, 14], completionNotification: true }, (_b = template.defaultSettings) === null || _b === void 0 ? void 0 : _b.notifications) }),
            assignedTo: {
                organizationIds: [],
                userIds: [],
                cohortIds: []
            },
            reflectionPrompts: [
                "What's one change that would make you feel a stronger sense of belonging?",
                "How can leadership better support inclusion in your daily work?",
                "What would you like to see more of in our organization's culture?"
            ],
            blocks: [],
            defaultLanguage: 'en',
            supportedLanguages: ['en'],
            completionSettings: {
                thankYouMessage: 'Thank you for completing our survey!',
                showResources: true,
                recommendedCourses: []
            }
        };
        setSurvey(newSurvey);
        if (newSurvey.sections.length > 0) {
            setActiveSection(newSurvey.sections[0].id);
        }
    };
    var createBlankSurvey = function () {
        var newSurvey = {
            id: "survey-".concat(Date.now()),
            title: 'New Survey',
            description: 'Survey description',
            status: 'draft',
            createdBy: 'Mya Dennis',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: [],
            blocks: [],
            branding: surveyTemplates_1.defaultBranding,
            settings: {
                anonymityMode: 'anonymous',
                anonymityThreshold: 5,
                allowMultipleResponses: false,
                showProgressBar: true,
                consentRequired: false,
                allowAnonymous: true,
                allowSaveAndContinue: true,
                randomizeQuestions: false,
                randomizeOptions: false
            },
            defaultLanguage: 'en',
            supportedLanguages: ['en'],
            completionSettings: {
                thankYouMessage: 'Thank you for completing our survey!',
                showResources: true,
                recommendedCourses: []
            },
            assignedTo: {
                organizationIds: [],
                userIds: [],
                cohortIds: []
            },
            reflectionPrompts: [
                "What's one change that would make you feel a stronger sense of belonging?"
            ]
        };
        setSurvey(newSurvey);
    };
    var addSection = function () {
        if (!survey)
            return;
        var newSection = {
            id: "section-".concat(Date.now()),
            title: 'New Section',
            description: '',
            order: survey.sections.length + 1,
            questions: []
        };
        setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { sections: __spreadArray(__spreadArray([], prev.sections, true), [newSection], false), updatedAt: new Date().toISOString() }) : null; });
        setActiveSection(newSection.id);
    };
    var addQuestion = function (sectionId, questionType) {
        if (!survey)
            return;
        var section = survey.sections.find(function (s) { return s.id === sectionId; });
        if (!section)
            return;
        var newQuestion = __assign(__assign(__assign(__assign(__assign({ id: "question-".concat(Date.now()), type: questionType, title: 'New Question', required: false, order: section.questions.length + 1 }, (questionType === 'multiple-choice' && {
            options: ['Option 1', 'Option 2', 'Option 3'],
            allowMultiple: false,
            allowOther: false
        })), (questionType === 'likert-scale' && {
            scale: {
                min: 1,
                max: 5,
                minLabel: 'Strongly Disagree',
                maxLabel: 'Strongly Agree',
                midLabel: 'Neutral'
            }
        })), (questionType === 'ranking' && {
            rankingItems: ['Item 1', 'Item 2', 'Item 3'],
            maxRankings: 3
        })), (questionType === 'matrix' && {
            matrixRows: ['Row 1', 'Row 2', 'Row 3'],
            matrixColumns: ['Column 1', 'Column 2', 'Column 3'],
            matrixType: 'single'
        })), (questionType === 'demographics' && {
            options: ['Option 1', 'Option 2', 'Option 3']
        }));
        setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { sections: prev.sections.map(function (s) {
                return s.id === sectionId
                    ? __assign(__assign({}, s), { questions: __spreadArray(__spreadArray([], s.questions, true), [newQuestion], false) }) : s;
            }), updatedAt: new Date().toISOString() }) : null; });
    };
    // Drag and drop handlers for questions
    var onDragStart = function (e, questionId) {
        setDraggedQuestion(questionId);
        e.dataTransfer.effectAllowed = 'move';
    };
    var onDragOver = function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    var onDrop = function (e, sectionId, targetQuestionId) {
        e.preventDefault();
        if (!survey || !draggedQuestion)
            return;
        setSurvey(function (prev) {
            if (!prev)
                return prev;
            var sections = prev.sections.map(function (s) {
                if (s.id !== sectionId)
                    return s;
                var questions = __spreadArray([], s.questions, true);
                var draggedIndex = questions.findIndex(function (q) { return q.id === draggedQuestion; });
                if (draggedIndex === -1)
                    return s;
                var dq = questions.splice(draggedIndex, 1)[0];
                if (!targetQuestionId) {
                    questions.push(dq);
                }
                else {
                    var targetIndex = questions.findIndex(function (q) { return q.id === targetQuestionId; });
                    questions.splice(targetIndex === -1 ? questions.length : targetIndex, 0, dq);
                }
                // reassign orders
                var reordered = questions.map(function (q, i) { return (__assign(__assign({}, q), { order: i + 1 })); });
                return __assign(__assign({}, s), { questions: reordered });
            });
            return __assign(__assign({}, prev), { sections: sections, updatedAt: new Date().toISOString() });
        });
        setDraggedQuestion(null);
    };
    var updateQuestion = function (sectionId, questionId, updates) {
        if (!survey)
            return;
        setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { sections: prev.sections.map(function (s) {
                return s.id === sectionId
                    ? __assign(__assign({}, s), { questions: s.questions.map(function (q) {
                            return q.id === questionId ? __assign(__assign({}, q), updates) : q;
                        }) }) : s;
            }), updatedAt: new Date().toISOString() }) : null; });
    };
    var deleteQuestion = function (sectionId, questionId) {
        if (!survey)
            return;
        setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { sections: prev.sections.map(function (s) {
                return s.id === sectionId
                    ? __assign(__assign({}, s), { questions: s.questions.filter(function (q) { return q.id !== questionId; }) }) : s;
            }), updatedAt: new Date().toISOString() }) : null; });
    };
    var addAIQuestions = function () {
        if (!survey || !activeSection)
            return;
        // Add a selection of AI-generated questions to the active section
        var selectedQuestions = surveyTemplates_1.aiGeneratedQuestions.slice(0, 3).map(function (template, index) { return (__assign(__assign({}, template), { id: "ai-question-".concat(Date.now(), "-").concat(index), required: true, order: survey.sections.find(function (s) { return s.id === activeSection; }).questions.length + index + 1 })); });
        setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { sections: prev.sections.map(function (s) {
                return s.id === activeSection
                    ? __assign(__assign({}, s), { questions: __spreadArray(__spreadArray([], s.questions, true), selectedQuestions, true) }) : s;
            }), updatedAt: new Date().toISOString() }) : null; });
    };
    var saveSurvey = function () { return __awaiter(void 0, void 0, void 0, function () {
        var err_1, err_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!survey)
                        return [2 /*return*/];
                    setIsSaving(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, , 9, 10]);
                    if (!(((_a = survey.assignedTo) === null || _a === void 0 ? void 0 : _a.organizationIds) && survey.assignedTo.organizationIds.length > 0)) return [3 /*break*/, 5];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, surveys_1.saveAssignments)(survey.id, survey.assignedTo.organizationIds)];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _b.sent();
                    console.warn('Failed to save assignments during survey save', err_1);
                    return [3 /*break*/, 5];
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    // prefer queued save to batch backend writes
                    return [4 /*yield*/, (0, surveys_1.queueSaveSurvey)(survey)];
                case 6:
                    // prefer queued save to batch backend writes
                    _b.sent();
                    return [3 /*break*/, 8];
                case 7:
                    err_2 = _b.sent();
                    console.warn('Local save failed', err_2);
                    return [3 /*break*/, 8];
                case 8:
                    // You could show a toast here to confirm save
                    setLastSavedAt(new Date().toLocaleTimeString());
                    return [3 /*break*/, 10];
                case 9:
                    setIsSaving(false);
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    }); };
    // Autosave with debounce when survey changes
    (0, react_1.useEffect)(function () {
        if (initialLoadRef.current) {
            // Skip autosave on initial load
            initialLoadRef.current = false;
            return;
        }
        if (!survey)
            return;
        if (saveDebounceRef.current) {
            window.clearTimeout(saveDebounceRef.current);
        }
        // debounce 1500ms
        saveDebounceRef.current = window.setTimeout(function () {
            // only autosave if not currently saving
            if (!isSaving) {
                saveSurvey();
            }
        }, 1500);
        return function () {
            if (saveDebounceRef.current) {
                window.clearTimeout(saveDebounceRef.current);
                saveDebounceRef.current = null;
            }
        };
    }, [survey]);
    // Subscribe to queue events
    (0, react_1.useEffect)(function () {
        Promise.resolve().then(function () { return require('../../dal/surveys'); }).then(function (mod) {
            setQueueLength(mod.getQueueLength());
            setLastFlush(mod.getLastFlushTime());
            var handler = function () {
                setQueueLength(mod.getQueueLength());
                setLastFlush(mod.getLastFlushTime());
            };
            mod.surveyQueueEvents.addEventListener('queuechange', handler);
            mod.surveyQueueEvents.addEventListener('flush', handler);
            return function () {
                mod.surveyQueueEvents.removeEventListener('queuechange', handler);
                mod.surveyQueueEvents.removeEventListener('flush', handler);
            };
        });
    }, []);
    var getQuestionIcon = function (type) {
        switch (type) {
            case 'multiple-choice':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-5 w-5" });
            case 'likert-scale':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-5 w-5" });
            case 'ranking':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowUpDown, { className: "h-5 w-5" });
            case 'open-ended':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.MessageSquare, { className: "h-5 w-5" });
            case 'matrix':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Grid3X3, { className: "h-5 w-5" });
            case 'demographics':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-5 w-5" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-5 w-5" });
        }
    };
    var renderQuestionEditor = function (question, sectionId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        return ((0, jsx_runtime_1.jsxs)("div", { draggable: true, onDragStart: function (e) { return onDragStart(e, question.id); }, onDragOver: onDragOver, onDrop: function (e) { return onDrop(e, sectionId, question.id); }, className: "bg-white border border-gray-200 rounded-lg p-6 mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-gray-100 p-2 rounded-lg", children: getQuestionIcon(question.type) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: question.title, onChange: function (e) { return updateQuestion(sectionId, question.id, { title: e.target.value }); }, className: "font-medium text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1", placeholder: "Question title" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500 capitalize", children: question.type.replace('-', ' ') })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: question.required, onChange: function (e) { return updateQuestion(sectionId, question.id, { required: e.target.checked }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Required" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return deleteQuestion(sectionId, question.id); }, className: "p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "mb-4", children: (0, jsx_runtime_1.jsx)("textarea", { value: question.description || '', onChange: function (e) { return updateQuestion(sectionId, question.id, { description: e.target.value }); }, placeholder: "Question description (optional)", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", rows: 2 }) }), question.type === 'multiple-choice' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 mb-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: question.allowMultiple || false, onChange: function (e) { return updateQuestion(sectionId, question.id, { allowMultiple: e.target.checked }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Allow multiple selections" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: question.allowOther || false, onChange: function (e) { return updateQuestion(sectionId, question.id, { allowOther: e.target.checked }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Allow \"Other\" option" })] })] }), (_a = question.options) === null || _a === void 0 ? void 0 : _a.map(function (option, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: option, onChange: function (e) {
                                        var newOptions = __spreadArray([], (question.options || []), true);
                                        newOptions[index] = e.target.value;
                                        updateQuestion(sectionId, question.id, { options: newOptions });
                                    }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Option ".concat(index + 1) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                        var _a;
                                        var newOptions = (_a = question.options) === null || _a === void 0 ? void 0 : _a.filter(function (_, i) { return i !== index; });
                                        updateQuestion(sectionId, question.id, { options: newOptions });
                                    }, className: "p-2 text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                var _a;
                                var newOptions = __spreadArray(__spreadArray([], (question.options || []), true), ["Option ".concat((((_a = question.options) === null || _a === void 0 ? void 0 : _a.length) || 0) + 1)], false);
                                updateQuestion(sectionId, question.id, { options: newOptions });
                            }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Option" })] })), question.type === 'likert-scale' && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Scale Range" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "number", value: ((_b = question.scale) === null || _b === void 0 ? void 0 : _b.min) || 1, onChange: function (e) { return updateQuestion(sectionId, question.id, {
                                                    scale: __assign(__assign({}, question.scale), { min: parseInt(e.target.value) })
                                                }); }, className: "w-16 px-2 py-1 border border-gray-300 rounded text-sm", min: "1" }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-500", children: "to" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: ((_c = question.scale) === null || _c === void 0 ? void 0 : _c.max) || 5, onChange: function (e) { return updateQuestion(sectionId, question.id, {
                                                    scale: __assign(__assign({}, question.scale), { max: parseInt(e.target.value) })
                                                }); }, className: "w-16 px-2 py-1 border border-gray-300 rounded text-sm", min: "2", max: "10" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Label" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: ((_d = question.scale) === null || _d === void 0 ? void 0 : _d.minLabel) || '', onChange: function (e) { return updateQuestion(sectionId, question.id, {
                                            scale: __assign(__assign({}, question.scale), { minLabel: e.target.value })
                                        }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "e.g., Strongly Disagree" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Label" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: ((_e = question.scale) === null || _e === void 0 ? void 0 : _e.maxLabel) || '', onChange: function (e) { return updateQuestion(sectionId, question.id, {
                                            scale: __assign(__assign({}, question.scale), { maxLabel: e.target.value })
                                        }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "e.g., Strongly Agree" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Mid Label (Optional)" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: ((_f = question.scale) === null || _f === void 0 ? void 0 : _f.midLabel) || '', onChange: function (e) { return updateQuestion(sectionId, question.id, {
                                            scale: __assign(__assign({}, question.scale), { midLabel: e.target.value })
                                        }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "e.g., Neutral" })] })] }) })), question.type === 'ranking' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Maximum Rankings" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: question.maxRankings || ((_g = question.rankingItems) === null || _g === void 0 ? void 0 : _g.length) || 3, onChange: function (e) { return updateQuestion(sectionId, question.id, { maxRankings: parseInt(e.target.value) }); }, className: "w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", min: "1", max: ((_h = question.rankingItems) === null || _h === void 0 ? void 0 : _h.length) || 10 })] }), (_j = question.rankingItems) === null || _j === void 0 ? void 0 : _j.map(function (item, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-500 w-6", children: [index + 1, "."] }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: item, onChange: function (e) {
                                        var newItems = __spreadArray([], (question.rankingItems || []), true);
                                        newItems[index] = e.target.value;
                                        updateQuestion(sectionId, question.id, { rankingItems: newItems });
                                    }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Ranking item ".concat(index + 1) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                        var _a;
                                        var newItems = (_a = question.rankingItems) === null || _a === void 0 ? void 0 : _a.filter(function (_, i) { return i !== index; });
                                        updateQuestion(sectionId, question.id, { rankingItems: newItems });
                                    }, className: "p-2 text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                var _a;
                                var newItems = __spreadArray(__spreadArray([], (question.rankingItems || []), true), ["Item ".concat((((_a = question.rankingItems) === null || _a === void 0 ? void 0 : _a.length) || 0) + 1)], false);
                                updateQuestion(sectionId, question.id, { rankingItems: newItems });
                            }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Ranking Item" })] })), question.type === 'open-ended' && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Length" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: ((_k = question.validation) === null || _k === void 0 ? void 0 : _k.minLength) || '', onChange: function (e) { return updateQuestion(sectionId, question.id, {
                                            validation: __assign(__assign({}, question.validation), { minLength: parseInt(e.target.value) || undefined })
                                        }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Minimum characters" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Length" }), (0, jsx_runtime_1.jsx)("input", { type: "number", value: ((_l = question.validation) === null || _l === void 0 ? void 0 : _l.maxLength) || '', onChange: function (e) { return updateQuestion(sectionId, question.id, {
                                            validation: __assign(__assign({}, question.validation), { maxLength: parseInt(e.target.value) || undefined })
                                        }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Maximum characters" })] })] }) })), question.type === 'matrix' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Matrix Rows" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(_m = question.matrixRows) === null || _m === void 0 ? void 0 : _m.map(function (row, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: row, onChange: function (e) {
                                                                var newRows = __spreadArray([], (question.matrixRows || []), true);
                                                                newRows[index] = e.target.value;
                                                                updateQuestion(sectionId, question.id, { matrixRows: newRows });
                                                            }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Row ".concat(index + 1) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                var _a;
                                                                var newRows = (_a = question.matrixRows) === null || _a === void 0 ? void 0 : _a.filter(function (_, i) { return i !== index; });
                                                                updateQuestion(sectionId, question.id, { matrixRows: newRows });
                                                            }, className: "p-2 text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                        var _a;
                                                        var newRows = __spreadArray(__spreadArray([], (question.matrixRows || []), true), ["Row ".concat((((_a = question.matrixRows) === null || _a === void 0 ? void 0 : _a.length) || 0) + 1)], false);
                                                        updateQuestion(sectionId, question.id, { matrixRows: newRows });
                                                    }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Row" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Matrix Columns" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(_o = question.matrixColumns) === null || _o === void 0 ? void 0 : _o.map(function (column, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: column, onChange: function (e) {
                                                                var newColumns = __spreadArray([], (question.matrixColumns || []), true);
                                                                newColumns[index] = e.target.value;
                                                                updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                                                            }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Column ".concat(index + 1) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                                var _a;
                                                                var newColumns = (_a = question.matrixColumns) === null || _a === void 0 ? void 0 : _a.filter(function (_, i) { return i !== index; });
                                                                updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                                                            }, className: "p-2 text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                        var _a;
                                                        var newColumns = __spreadArray(__spreadArray([], (question.matrixColumns || []), true), ["Column ".concat((((_a = question.matrixColumns) === null || _a === void 0 ? void 0 : _a.length) || 0) + 1)], false);
                                                        updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                                                    }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Column" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Response Type" }), (0, jsx_runtime_1.jsxs)("select", { value: question.matrixType || 'single', onChange: function (e) { return updateQuestion(sectionId, question.id, { matrixType: e.target.value }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", children: [(0, jsx_runtime_1.jsx)("option", { value: "single", children: "Single selection per row" }), (0, jsx_runtime_1.jsx)("option", { value: "multiple", children: "Multiple selections per row" }), (0, jsx_runtime_1.jsx)("option", { value: "rating", children: "Rating scale per row" })] })] })] })), question.type === 'demographics' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-blue-900 mb-2", children: "Census-Aligned Demographics" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-blue-800", children: "Use standardized demographic categories for consistent analysis and benchmarking." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Demographic Category" }), (0, jsx_runtime_1.jsxs)("select", { onChange: function (e) {
                                                var category = e.target.value;
                                                if (category && surveyTemplates_1.censusDemographicOptions[category]) {
                                                    updateQuestion(sectionId, question.id, {
                                                        options: surveyTemplates_1.censusDemographicOptions[category],
                                                        title: "What is your ".concat(category, "?")
                                                    });
                                                }
                                            }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select a category" }), (0, jsx_runtime_1.jsx)("option", { value: "race", children: "Race/Ethnicity" }), (0, jsx_runtime_1.jsx)("option", { value: "gender", children: "Gender Identity" }), (0, jsx_runtime_1.jsx)("option", { value: "age", children: "Age Range" }), (0, jsx_runtime_1.jsx)("option", { value: "education", children: "Education Level" }), (0, jsx_runtime_1.jsx)("option", { value: "disability", children: "Disability Status" }), (0, jsx_runtime_1.jsx)("option", { value: "veteranStatus", children: "Veteran Status" }), (0, jsx_runtime_1.jsx)("option", { value: "sexualOrientation", children: "Sexual Orientation" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: question.allowMultiple || false, onChange: function (e) { return updateQuestion(sectionId, question.id, { allowMultiple: e.target.checked }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-700", children: "Allow multiple selections" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: question.allowOther || false, onChange: function (e) { return updateQuestion(sectionId, question.id, { allowOther: e.target.checked }); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-700", children: "Allow \"Other\" option" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700", children: "Custom Options" }), (_p = question.options) === null || _p === void 0 ? void 0 : _p.map(function (option, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: option, onChange: function (e) {
                                                var newOptions = __spreadArray([], (question.options || []), true);
                                                newOptions[index] = e.target.value;
                                                updateQuestion(sectionId, question.id, { options: newOptions });
                                            }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Option ".concat(index + 1) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                var _a;
                                                var newOptions = (_a = question.options) === null || _a === void 0 ? void 0 : _a.filter(function (_, i) { return i !== index; });
                                                updateQuestion(sectionId, question.id, { options: newOptions });
                                            }, className: "p-2 text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                        var _a;
                                        var newOptions = __spreadArray(__spreadArray([], (question.options || []), true), ["Option ".concat((((_a = question.options) === null || _a === void 0 ? void 0 : _a.length) || 0) + 1)], false);
                                        updateQuestion(sectionId, question.id, { options: newOptions });
                                    }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Custom Option" })] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 border-t pt-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-sm font-medium text-gray-900 mb-2", children: "Conditional Logic (optional)" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mb-2", children: "Show this question only when previous answers match the rule." }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(((_q = question.conditionalLogic) === null || _q === void 0 ? void 0 : _q.showIf) || []).map(function (rule, idx) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { className: "w-48 px-2 py-1 border rounded", value: rule.questionId, onChange: function (e) {
                                                var _a, _b;
                                                var newRules = __spreadArray([], (((_a = question.conditionalLogic) === null || _a === void 0 ? void 0 : _a.showIf) || []), true);
                                                newRules[idx] = __assign(__assign({}, newRules[idx]), { questionId: e.target.value });
                                                updateQuestion(sectionId, question.id, { conditionalLogic: __assign(__assign({}, (question.conditionalLogic || {})), { showIf: newRules, logic: ((_b = question.conditionalLogic) === null || _b === void 0 ? void 0 : _b.logic) || 'and' }), });
                                            }, placeholder: "Question ID" }), (0, jsx_runtime_1.jsxs)("select", { className: "px-2 py-1 border rounded", value: rule.operator, onChange: function (e) {
                                                var _a, _b;
                                                var newRules = __spreadArray([], (((_a = question.conditionalLogic) === null || _a === void 0 ? void 0 : _a.showIf) || []), true);
                                                newRules[idx] = __assign(__assign({}, newRules[idx]), { operator: e.target.value });
                                                updateQuestion(sectionId, question.id, { conditionalLogic: __assign(__assign({}, (question.conditionalLogic || {})), { showIf: newRules, logic: ((_b = question.conditionalLogic) === null || _b === void 0 ? void 0 : _b.logic) || 'and' }), });
                                            }, children: [(0, jsx_runtime_1.jsx)("option", { value: "equals", children: "equals" }), (0, jsx_runtime_1.jsx)("option", { value: "not-equals", children: "not-equals" }), (0, jsx_runtime_1.jsx)("option", { value: "contains", children: "contains" })] }), (0, jsx_runtime_1.jsx)("input", { className: "px-2 py-1 border rounded", value: String(rule.value || ''), onChange: function (e) {
                                                var _a, _b;
                                                var newRules = __spreadArray([], (((_a = question.conditionalLogic) === null || _a === void 0 ? void 0 : _a.showIf) || []), true);
                                                newRules[idx] = __assign(__assign({}, newRules[idx]), { value: e.target.value });
                                                updateQuestion(sectionId, question.id, { conditionalLogic: __assign(__assign({}, (question.conditionalLogic || {})), { showIf: newRules, logic: ((_b = question.conditionalLogic) === null || _b === void 0 ? void 0 : _b.logic) || 'and' }), });
                                            }, placeholder: "Value" }), (0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1 text-red-600", onClick: function () {
                                                var _a, _b;
                                                var newRules = (((_a = question.conditionalLogic) === null || _a === void 0 ? void 0 : _a.showIf) || []).filter(function (_, i) { return i !== idx; });
                                                updateQuestion(sectionId, question.id, { conditionalLogic: __assign(__assign({}, (question.conditionalLogic || {})), { showIf: newRules, logic: ((_b = question.conditionalLogic) === null || _b === void 0 ? void 0 : _b.logic) || 'and' }), });
                                            }, children: "Remove" })] }, idx)); }), (0, jsx_runtime_1.jsx)("button", { className: "text-sm text-orange-500", onClick: function () {
                                        var _a, _b;
                                        var newRules = __spreadArray(__spreadArray([], (((_a = question.conditionalLogic) === null || _a === void 0 ? void 0 : _a.showIf) || []), true), [{ questionId: '', operator: 'equals', value: '' }], false);
                                        updateQuestion(sectionId, question.id, { conditionalLogic: __assign(__assign({}, (question.conditionalLogic || {})), { showIf: newRules, logic: ((_b = question.conditionalLogic) === null || _b === void 0 ? void 0 : _b.logic) || 'and' }) });
                                    }, children: "+ Add condition" })] })] })] }));
    };
    if (!survey) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-4xl mx-auto text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-gray-900", children: "Loading survey builder..." })] }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-7xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsxs)(react_router_dom_1.Link, { to: "/admin/surveys", className: "inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Surveys"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 mb-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: survey.title, onChange: function (e) { return setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { title: e.target.value, updatedAt: new Date().toISOString() }) : null; }); }, className: "text-3xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1", placeholder: "Survey Title" }), isAIMode && ((0, jsx_runtime_1.jsxs)("span", { className: "bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-sm font-medium flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "AI Mode" })] }))] }), (0, jsx_runtime_1.jsx)("textarea", { value: survey.description, onChange: function (e) { return setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { description: e.target.value, updatedAt: new Date().toISOString() }) : null; }); }, className: "text-gray-600 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 resize-none", placeholder: "Survey description", rows: 2 })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setShowBranding(!showBranding); }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Palette, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Branding" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setShowAssignModal(true); }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Building2, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Assign Survey" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setShowSettings(!showSettings); }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Settings, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Settings" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return window.open("/admin/surveys/".concat(survey.id, "/preview"), '_blank'); }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Preview" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: function () {
                                            try {
                                                var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(survey, null, 2));
                                                var dlAnchor = document.createElement('a');
                                                dlAnchor.setAttribute('href', dataStr);
                                                dlAnchor.setAttribute('download', "".concat(survey.title.replace(/\s+/g, '_').toLowerCase() || 'survey', ".json"));
                                                document.body.appendChild(dlAnchor);
                                                dlAnchor.click();
                                                dlAnchor.remove();
                                            }
                                            catch (err) {
                                                console.warn('Export failed', err);
                                            }
                                        }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Export" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: saveSurvey, disabled: isSaving, className: "bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: isSaving ? 'Saving...' : 'Save' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-500 ml-2", children: [lastSavedAt ? "Last saved ".concat(lastSavedAt) : 'Not saved yet', (0, jsx_runtime_1.jsx)("div", { children: queueLength > 0 ? " \u2022 ".concat(queueLength, " pending sync") : ' • synced' }), lastFlush && (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-400", children: ["Last flush: ", new Date(lastFlush).toLocaleTimeString()] })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-4 gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Question Types" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: surveyTemplates_1.questionTypes.map(function (type) { return ((0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                        if (activeSection) {
                                            addQuestion(activeSection, type.id);
                                        }
                                    }, disabled: !activeSection, className: "w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-gray-100 p-2 rounded-lg", children: getQuestionIcon(type.id) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900 text-sm", children: type.name }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-600", children: type.description })] })] }) }, type.id)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 pt-6 border-t border-gray-200", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "AI Suggestions" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: addAIQuestions, disabled: !activeSection, className: "w-full text-left p-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "h-4 w-4 text-purple-500" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-purple-800", children: "Generate DEI Questions" })] }) }), (0, jsx_runtime_1.jsx)("button", { className: "w-full text-left p-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors duration-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "h-4 w-4 text-blue-500" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-blue-800", children: "Suggest Logic Flows" })] }) })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "lg:col-span-3 space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [survey.sections.map(function (section) { return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-xl p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: section.title, onChange: function (e) { return setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { sections: prev.sections.map(function (s) {
                                                                        return s.id === section.id ? __assign(__assign({}, s), { title: e.target.value }) : s;
                                                                    }), updatedAt: new Date().toISOString() }) : null; }); }, className: "text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1", placeholder: "Section title" }), (0, jsx_runtime_1.jsx)("textarea", { value: section.description || '', onChange: function (e) { return setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { sections: prev.sections.map(function (s) {
                                                                        return s.id === section.id ? __assign(__assign({}, s), { description: e.target.value }) : s;
                                                                    }), updatedAt: new Date().toISOString() }) : null; }); }, className: "text-gray-600 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 resize-none w-full", placeholder: "Section description", rows: 1 })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return setActiveSection(activeSection === section.id ? '' : section.id); }, className: "p-2 text-gray-600 hover:text-gray-800", children: activeSection === section.id ? (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronUp, { className: "h-5 w-5" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsx)("button", { className: "p-2 text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }), activeSection === section.id && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [section.questions.map(function (question) { return renderQuestionEditor(question, section.id); }), section.questions.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-8 border-2 border-dashed border-gray-300 rounded-lg", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.MessageSquare, { className: "h-8 w-8 text-gray-400 mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-500", children: "No questions yet. Select a question type from the left to get started." })] }))] }))] }, section.id)); }), (0, jsx_runtime_1.jsxs)("button", { onClick: addSection, className: "w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-500 hover:bg-orange-50 transition-colors duration-200", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-6 w-6 text-gray-400 mx-auto mb-2" }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-600 font-medium", children: "Add Section" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Reflection Prompts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-4", children: "These prompts will appear after survey completion to encourage deeper thinking and self-reflection." }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(_a = survey.reflectionPrompts) === null || _a === void 0 ? void 0 : _a.map(function (prompt, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: prompt, onChange: function (e) {
                                                            var newPrompts = __spreadArray([], (survey.reflectionPrompts || []), true);
                                                            newPrompts[index] = e.target.value;
                                                            setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() }) : null; });
                                                        }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Reflection prompt" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                            var newPrompts = (survey.reflectionPrompts || []).filter(function (_, i) { return i !== index; });
                                                            setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() }) : null; });
                                                        }, className: "p-2 text-red-600 hover:text-red-800", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }, index)); }), (0, jsx_runtime_1.jsx)("button", { onClick: function () {
                                                    var newPrompts = __spreadArray(__spreadArray([], (survey.reflectionPrompts || []), true), ['New reflection prompt'], false);
                                                    setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() }) : null; });
                                                }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Reflection Prompt" })] })] })] })] }), showSettings && ((0, jsx_runtime_1.jsx)(react_1.default.Suspense, { fallback: (0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-8 rounded-xl shadow-xl flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "animate-spin h-6 w-6 border-2 border-gray-600 border-t-transparent rounded-full" }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-700 font-medium", children: "Loading Settings Panel..." })] }) }), children: (0, jsx_runtime_1.jsx)(SurveySettingsModal, { isOpen: showSettings, onClose: function () { return setShowSettings(false); }, settings: {
                        accessControl: {
                            requireAuth: !survey.settings.allowAnonymous,
                            allowAnonymous: survey.settings.allowAnonymous,
                            ipRestriction: '',
                            timeLimit: 0
                        },
                        notifications: {
                            sendReminders: true,
                            reminderFrequency: 'weekly',
                            completionNotifications: true
                        },
                        advanced: {
                            allowBack: survey.settings.allowSaveAndContinue,
                            showProgress: survey.settings.showProgressBar,
                            randomizeQuestions: survey.settings.randomizeQuestions,
                            preventMultipleSubmissions: true
                        }
                    }, onSave: function (settings) {
                        setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { settings: __assign(__assign({}, prev.settings), { allowAnonymous: settings.accessControl.allowAnonymous, allowSaveAndContinue: settings.advanced.allowBack, showProgressBar: settings.advanced.showProgress, randomizeQuestions: settings.advanced.randomizeQuestions }), updatedAt: new Date().toISOString() }) : null; });
                        saveSurvey();
                    } }) })), showAssignModal && ((0, jsx_runtime_1.jsx)(react_1.default.Suspense, { fallback: (0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-8 rounded-xl shadow-xl flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-700 font-medium", children: "Loading Assignment Modal..." })] }) }), children: (0, jsx_runtime_1.jsx)(AssignmentModal, { isOpen: showAssignModal, onClose: function () { return setShowAssignModal(false); }, organizations: organizations, selectedOrganizations: ((_b = survey === null || survey === void 0 ? void 0 : survey.assignedTo) === null || _b === void 0 ? void 0 : _b.organizationIds) || [], onSave: function (organizationIds) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!survey)
                                        return [2 /*return*/];
                                    setSurvey(function (prev) { return prev ? __assign(__assign({}, prev), { assignedTo: __assign(__assign({}, prev.assignedTo), { organizationIds: organizationIds }), updatedAt: new Date().toISOString() }) : null; });
                                    return [4 /*yield*/, saveSurvey()];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); } }) })), survey.sections.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-12", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "Start Building Your Survey" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-6", children: "Add your first section to begin creating questions." }), (0, jsx_runtime_1.jsxs)("button", { onClick: addSection, className: "bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center mx-auto space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-5 w-5" }), (0, jsx_runtime_1.jsx)("span", { children: "Add First Section" })] })] }))] }));
};
exports.default = AdminSurveyBuilder;
