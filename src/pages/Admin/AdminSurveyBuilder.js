import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, lazy } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Settings, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle, BarChart3, MessageSquare, Users, Grid3X3, ArrowUpDown, Palette, Target, Zap, Brain, Building2 } from 'lucide-react';
// Lazy load heavy components
const AssignmentModal = lazy(() => import('../../components/Survey/AssignmentModal'));
const SurveySettingsModal = lazy(() => import('../../components/Survey/SurveySettingsModal'));
import { surveyTemplates, questionTypes, defaultBranding, aiGeneratedQuestions, censusDemographicOptions } from '../../data/surveyTemplates';
import { getAssignments, saveAssignments, getSurveyById, queueSaveSurvey } from '../../dal/surveys';
const AdminSurveyBuilder = () => {
    const { surveyId } = useParams();
    const [searchParams] = useSearchParams();
    const templateId = searchParams.get('template');
    const isAIMode = searchParams.get('ai') === '1';
    const [survey, setSurvey] = useState(null);
    const [activeSection, setActiveSection] = useState('');
    const [draggedQuestion, setDraggedQuestion] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showBranding, setShowBranding] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState('');
    const saveDebounceRef = React.useRef(null);
    const initialLoadRef = React.useRef(true);
    const [queueLength, setQueueLength] = useState(0);
    const [lastFlush, setLastFlush] = useState(null);
    // Organizations data (in a real app, this would come from an API)
    const organizations = [
        { id: '1', name: 'Pacific Coast University', type: 'University', learners: 45 },
        { id: '2', name: 'Mountain View High School', type: 'K-12 Education', learners: 23 },
        { id: '3', name: 'Community Impact Network', type: 'Nonprofit', learners: 28 },
        { id: '4', name: 'Regional Fire Department', type: 'Government', learners: 67 },
        { id: '5', name: 'TechForward Solutions', type: 'Corporate', learners: 34 },
        { id: '6', name: 'Regional Medical Center', type: 'Healthcare', learners: 89 },
        { id: '7', name: 'Unity Community Church', type: 'Religious', learners: 15 }
    ];
    useEffect(() => {
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
    const loadSurvey = (id) => {
        // Try local storage first
        (async () => {
            const local = await getSurveyById(id);
            if (local) {
                setSurvey(local);
                if (local.sections.length > 0)
                    setActiveSection(local.sections[0].id);
                return;
            }
            // In a real app, this would load from database
            // For now, create a sample survey
        })();
        // Sample fallback (if no local)
        const sampleSurvey = {
            id,
            title: 'Q1 2025 Climate Assessment',
            description: 'Quarterly organizational climate and culture assessment',
            status: 'draft',
            createdBy: 'Mya Dennis',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: [],
            branding: defaultBranding,
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
        (async () => {
            const assignment = await getAssignments(id);
            if (assignment && assignment.organization_ids) {
                setSurvey(prev => prev ? {
                    ...prev,
                    assignedTo: {
                        organizationIds: assignment.organization_ids,
                        userIds: prev.assignedTo?.userIds || [],
                        departmentIds: prev.assignedTo?.departmentIds || [],
                        cohortIds: prev.assignedTo?.cohortIds || []
                    }
                } : prev);
            }
        })();
    };
    const createFromTemplate = (templateId) => {
        const template = surveyTemplates.find(t => t.id === templateId);
        if (!template) {
            createBlankSurvey();
            return;
        }
        const newSurvey = {
            id: `survey-${Date.now()}`,
            title: template.name,
            description: template.description,
            status: 'draft',
            createdBy: 'Mya Dennis',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: template.sections.map((section, index) => ({
                ...section,
                id: `section-${Date.now()}-${index}`,
                questions: section.questions.map((question, qIndex) => ({
                    ...question,
                    id: `question-${Date.now()}-${index}-${qIndex}`
                }))
            })),
            branding: defaultBranding,
            settings: {
                ...template.defaultSettings,
                accessControl: {
                    requireLogin: false,
                    ...template.defaultSettings?.accessControl
                },
                notifications: {
                    sendReminders: true,
                    reminderSchedule: [3, 7, 14],
                    completionNotification: true,
                    ...template.defaultSettings?.notifications
                }
            },
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
    const createBlankSurvey = () => {
        const newSurvey = {
            id: `survey-${Date.now()}`,
            title: 'New Survey',
            description: 'Survey description',
            status: 'draft',
            createdBy: 'Mya Dennis',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: [],
            blocks: [],
            branding: defaultBranding,
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
    const addSection = () => {
        if (!survey)
            return;
        const newSection = {
            id: `section-${Date.now()}`,
            title: 'New Section',
            description: '',
            order: survey.sections.length + 1,
            questions: []
        };
        setSurvey(prev => prev ? {
            ...prev,
            sections: [...prev.sections, newSection],
            updatedAt: new Date().toISOString()
        } : null);
        setActiveSection(newSection.id);
    };
    const addQuestion = (sectionId, questionType) => {
        if (!survey)
            return;
        const section = survey.sections.find(s => s.id === sectionId);
        if (!section)
            return;
        const newQuestion = {
            id: `question-${Date.now()}`,
            type: questionType,
            title: 'New Question',
            required: false,
            order: section.questions.length + 1,
            ...(questionType === 'multiple-choice' && {
                options: ['Option 1', 'Option 2', 'Option 3'],
                allowMultiple: false,
                allowOther: false
            }),
            ...(questionType === 'likert-scale' && {
                scale: {
                    min: 1,
                    max: 5,
                    minLabel: 'Strongly Disagree',
                    maxLabel: 'Strongly Agree',
                    midLabel: 'Neutral'
                }
            }),
            ...(questionType === 'ranking' && {
                rankingItems: ['Item 1', 'Item 2', 'Item 3'],
                maxRankings: 3
            }),
            ...(questionType === 'matrix' && {
                matrixRows: ['Row 1', 'Row 2', 'Row 3'],
                matrixColumns: ['Column 1', 'Column 2', 'Column 3'],
                matrixType: 'single'
            }),
            ...(questionType === 'demographics' && {
                options: ['Option 1', 'Option 2', 'Option 3']
            })
        };
        setSurvey(prev => prev ? {
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId
                ? { ...s, questions: [...s.questions, newQuestion] }
                : s),
            updatedAt: new Date().toISOString()
        } : null);
    };
    // Drag and drop handlers for questions
    const onDragStart = (e, questionId) => {
        setDraggedQuestion(questionId);
        e.dataTransfer.effectAllowed = 'move';
    };
    const onDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    const onDrop = (e, sectionId, targetQuestionId) => {
        e.preventDefault();
        if (!survey || !draggedQuestion)
            return;
        setSurvey(prev => {
            if (!prev)
                return prev;
            const sections = prev.sections.map(s => {
                if (s.id !== sectionId)
                    return s;
                const questions = [...s.questions];
                const draggedIndex = questions.findIndex(q => q.id === draggedQuestion);
                if (draggedIndex === -1)
                    return s;
                const [dq] = questions.splice(draggedIndex, 1);
                if (!targetQuestionId) {
                    questions.push(dq);
                }
                else {
                    const targetIndex = questions.findIndex(q => q.id === targetQuestionId);
                    questions.splice(targetIndex === -1 ? questions.length : targetIndex, 0, dq);
                }
                // reassign orders
                const reordered = questions.map((q, i) => ({ ...q, order: i + 1 }));
                return { ...s, questions: reordered };
            });
            return { ...prev, sections, updatedAt: new Date().toISOString() };
        });
        setDraggedQuestion(null);
    };
    const updateQuestion = (sectionId, questionId, updates) => {
        if (!survey)
            return;
        setSurvey(prev => prev ? {
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId
                ? {
                    ...s,
                    questions: s.questions.map(q => q.id === questionId ? { ...q, ...updates } : q)
                }
                : s),
            updatedAt: new Date().toISOString()
        } : null);
    };
    const deleteQuestion = (sectionId, questionId) => {
        if (!survey)
            return;
        setSurvey(prev => prev ? {
            ...prev,
            sections: prev.sections.map(s => s.id === sectionId
                ? { ...s, questions: s.questions.filter(q => q.id !== questionId) }
                : s),
            updatedAt: new Date().toISOString()
        } : null);
    };
    const addAIQuestions = () => {
        if (!survey || !activeSection)
            return;
        // Add a selection of AI-generated questions to the active section
        const selectedQuestions = aiGeneratedQuestions.slice(0, 3).map((template, index) => ({
            ...template,
            id: `ai-question-${Date.now()}-${index}`,
            required: true,
            order: survey.sections.find(s => s.id === activeSection).questions.length + index + 1
        }));
        setSurvey(prev => prev ? {
            ...prev,
            sections: prev.sections.map(s => s.id === activeSection
                ? { ...s, questions: [...s.questions, ...selectedQuestions] }
                : s),
            updatedAt: new Date().toISOString()
        } : null);
    };
    const saveSurvey = async () => {
        if (!survey)
            return;
        setIsSaving(true);
        try {
            // Persist assignments if present
            if (survey.assignedTo?.organizationIds && survey.assignedTo.organizationIds.length > 0) {
                try {
                    await saveAssignments(survey.id, survey.assignedTo.organizationIds);
                }
                catch (err) {
                    console.warn('Failed to save assignments during survey save', err);
                }
            }
            // Simulate saving other survey data (replace with real save API)
            // persist locally for now
            try {
                // prefer queued save to batch backend writes
                await queueSaveSurvey(survey);
            }
            catch (err) {
                console.warn('Local save failed', err);
            }
            // You could show a toast here to confirm save
            setLastSavedAt(new Date().toLocaleTimeString());
        }
        finally {
            setIsSaving(false);
        }
    };
    // Autosave with debounce when survey changes
    useEffect(() => {
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
        saveDebounceRef.current = window.setTimeout(() => {
            // only autosave if not currently saving
            if (!isSaving) {
                saveSurvey();
            }
        }, 1500);
        return () => {
            if (saveDebounceRef.current) {
                window.clearTimeout(saveDebounceRef.current);
                saveDebounceRef.current = null;
            }
        };
    }, [survey]);
    // Subscribe to queue events
    useEffect(() => {
        import('../../dal/surveys').then(mod => {
            setQueueLength(mod.getQueueLength());
            setLastFlush(mod.getLastFlushTime());
            const handler = () => {
                setQueueLength(mod.getQueueLength());
                setLastFlush(mod.getLastFlushTime());
            };
            mod.surveyQueueEvents.addEventListener('queuechange', handler);
            mod.surveyQueueEvents.addEventListener('flush', handler);
            return () => {
                mod.surveyQueueEvents.removeEventListener('queuechange', handler);
                mod.surveyQueueEvents.removeEventListener('flush', handler);
            };
        });
    }, []);
    const getQuestionIcon = (type) => {
        switch (type) {
            case 'multiple-choice':
                return _jsx(CheckCircle, { className: "h-5 w-5" });
            case 'likert-scale':
                return _jsx(BarChart3, { className: "h-5 w-5" });
            case 'ranking':
                return _jsx(ArrowUpDown, { className: "h-5 w-5" });
            case 'open-ended':
                return _jsx(MessageSquare, { className: "h-5 w-5" });
            case 'matrix':
                return _jsx(Grid3X3, { className: "h-5 w-5" });
            case 'demographics':
                return _jsx(Users, { className: "h-5 w-5" });
            default:
                return _jsx(CheckCircle, { className: "h-5 w-5" });
        }
    };
    const renderQuestionEditor = (question, sectionId) => {
        return (_jsxs("div", { draggable: true, onDragStart: (e) => onDragStart(e, question.id), onDragOver: onDragOver, onDrop: (e) => onDrop(e, sectionId, question.id), className: "bg-white border border-gray-200 rounded-lg p-6 mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-gray-100 p-2 rounded-lg", children: getQuestionIcon(question.type) }), _jsxs("div", { children: [_jsx("input", { type: "text", value: question.title, onChange: (e) => updateQuestion(sectionId, question.id, { title: e.target.value }), className: "font-medium text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1", placeholder: "Question title" }), _jsx("div", { className: "text-sm text-gray-500 capitalize", children: question.type.replace('-', ' ') })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: question.required, onChange: (e) => updateQuestion(sectionId, question.id, { required: e.target.checked }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-600", children: "Required" })] }), _jsx("button", { onClick: () => deleteQuestion(sectionId, question.id), className: "p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }), _jsx("div", { className: "mb-4", children: _jsx("textarea", { value: question.description || '', onChange: (e) => updateQuestion(sectionId, question.id, { description: e.target.value }), placeholder: "Question description (optional)", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", rows: 2 }) }), question.type === 'multiple-choice' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center space-x-4 mb-3", children: [_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: question.allowMultiple || false, onChange: (e) => updateQuestion(sectionId, question.id, { allowMultiple: e.target.checked }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-600", children: "Allow multiple selections" })] }), _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: question.allowOther || false, onChange: (e) => updateQuestion(sectionId, question.id, { allowOther: e.target.checked }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-600", children: "Allow \"Other\" option" })] })] }), question.options?.map((option, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: option, onChange: (e) => {
                                        const newOptions = [...(question.options || [])];
                                        newOptions[index] = e.target.value;
                                        updateQuestion(sectionId, question.id, { options: newOptions });
                                    }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: `Option ${index + 1}` }), _jsx("button", { onClick: () => {
                                        const newOptions = question.options?.filter((_, i) => i !== index);
                                        updateQuestion(sectionId, question.id, { options: newOptions });
                                    }, className: "p-2 text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => {
                                const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
                                updateQuestion(sectionId, question.id, { options: newOptions });
                            }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Option" })] })), question.type === 'likert-scale' && (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Scale Range" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "number", value: question.scale?.min || 1, onChange: (e) => updateQuestion(sectionId, question.id, {
                                                    scale: { ...question.scale, min: parseInt(e.target.value) }
                                                }), className: "w-16 px-2 py-1 border border-gray-300 rounded text-sm", min: "1" }), _jsx("span", { className: "text-gray-500", children: "to" }), _jsx("input", { type: "number", value: question.scale?.max || 5, onChange: (e) => updateQuestion(sectionId, question.id, {
                                                    scale: { ...question.scale, max: parseInt(e.target.value) }
                                                }), className: "w-16 px-2 py-1 border border-gray-300 rounded text-sm", min: "2", max: "10" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Label" }), _jsx("input", { type: "text", value: question.scale?.minLabel || '', onChange: (e) => updateQuestion(sectionId, question.id, {
                                            scale: { ...question.scale, minLabel: e.target.value }
                                        }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "e.g., Strongly Disagree" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Label" }), _jsx("input", { type: "text", value: question.scale?.maxLabel || '', onChange: (e) => updateQuestion(sectionId, question.id, {
                                            scale: { ...question.scale, maxLabel: e.target.value }
                                        }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "e.g., Strongly Agree" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Mid Label (Optional)" }), _jsx("input", { type: "text", value: question.scale?.midLabel || '', onChange: (e) => updateQuestion(sectionId, question.id, {
                                            scale: { ...question.scale, midLabel: e.target.value }
                                        }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "e.g., Neutral" })] })] }) })), question.type === 'ranking' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Maximum Rankings" }), _jsx("input", { type: "number", value: question.maxRankings || question.rankingItems?.length || 3, onChange: (e) => updateQuestion(sectionId, question.id, { maxRankings: parseInt(e.target.value) }), className: "w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", min: "1", max: question.rankingItems?.length || 10 })] }), question.rankingItems?.map((item, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("span", { className: "text-sm text-gray-500 w-6", children: [index + 1, "."] }), _jsx("input", { type: "text", value: item, onChange: (e) => {
                                        const newItems = [...(question.rankingItems || [])];
                                        newItems[index] = e.target.value;
                                        updateQuestion(sectionId, question.id, { rankingItems: newItems });
                                    }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: `Ranking item ${index + 1}` }), _jsx("button", { onClick: () => {
                                        const newItems = question.rankingItems?.filter((_, i) => i !== index);
                                        updateQuestion(sectionId, question.id, { rankingItems: newItems });
                                    }, className: "p-2 text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => {
                                const newItems = [...(question.rankingItems || []), `Item ${(question.rankingItems?.length || 0) + 1}`];
                                updateQuestion(sectionId, question.id, { rankingItems: newItems });
                            }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Ranking Item" })] })), question.type === 'open-ended' && (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Min Length" }), _jsx("input", { type: "number", value: question.validation?.minLength || '', onChange: (e) => updateQuestion(sectionId, question.id, {
                                            validation: { ...question.validation, minLength: parseInt(e.target.value) || undefined }
                                        }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Minimum characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Max Length" }), _jsx("input", { type: "number", value: question.validation?.maxLength || '', onChange: (e) => updateQuestion(sectionId, question.id, {
                                            validation: { ...question.validation, maxLength: parseInt(e.target.value) || undefined }
                                        }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Maximum characters" })] })] }) })), question.type === 'matrix' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Matrix Rows" }), _jsxs("div", { className: "space-y-2", children: [question.matrixRows?.map((row, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: row, onChange: (e) => {
                                                                const newRows = [...(question.matrixRows || [])];
                                                                newRows[index] = e.target.value;
                                                                updateQuestion(sectionId, question.id, { matrixRows: newRows });
                                                            }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: `Row ${index + 1}` }), _jsx("button", { onClick: () => {
                                                                const newRows = question.matrixRows?.filter((_, i) => i !== index);
                                                                updateQuestion(sectionId, question.id, { matrixRows: newRows });
                                                            }, className: "p-2 text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => {
                                                        const newRows = [...(question.matrixRows || []), `Row ${(question.matrixRows?.length || 0) + 1}`];
                                                        updateQuestion(sectionId, question.id, { matrixRows: newRows });
                                                    }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Row" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Matrix Columns" }), _jsxs("div", { className: "space-y-2", children: [question.matrixColumns?.map((column, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: column, onChange: (e) => {
                                                                const newColumns = [...(question.matrixColumns || [])];
                                                                newColumns[index] = e.target.value;
                                                                updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                                                            }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: `Column ${index + 1}` }), _jsx("button", { onClick: () => {
                                                                const newColumns = question.matrixColumns?.filter((_, i) => i !== index);
                                                                updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                                                            }, className: "p-2 text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => {
                                                        const newColumns = [...(question.matrixColumns || []), `Column ${(question.matrixColumns?.length || 0) + 1}`];
                                                        updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                                                    }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Column" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Response Type" }), _jsxs("select", { value: question.matrixType || 'single', onChange: (e) => updateQuestion(sectionId, question.id, { matrixType: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", children: [_jsx("option", { value: "single", children: "Single selection per row" }), _jsx("option", { value: "multiple", children: "Multiple selections per row" }), _jsx("option", { value: "rating", children: "Rating scale per row" })] })] })] })), question.type === 'demographics' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "Census-Aligned Demographics" }), _jsx("p", { className: "text-sm text-blue-800", children: "Use standardized demographic categories for consistent analysis and benchmarking." })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Demographic Category" }), _jsxs("select", { onChange: (e) => {
                                                const category = e.target.value;
                                                if (category && censusDemographicOptions[category]) {
                                                    updateQuestion(sectionId, question.id, {
                                                        options: censusDemographicOptions[category],
                                                        title: `What is your ${category}?`
                                                    });
                                                }
                                            }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", children: [_jsx("option", { value: "", children: "Select a category" }), _jsx("option", { value: "race", children: "Race/Ethnicity" }), _jsx("option", { value: "gender", children: "Gender Identity" }), _jsx("option", { value: "age", children: "Age Range" }), _jsx("option", { value: "education", children: "Education Level" }), _jsx("option", { value: "disability", children: "Disability Status" }), _jsx("option", { value: "veteranStatus", children: "Veteran Status" }), _jsx("option", { value: "sexualOrientation", children: "Sexual Orientation" })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: question.allowMultiple || false, onChange: (e) => updateQuestion(sectionId, question.id, { allowMultiple: e.target.checked }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-700", children: "Allow multiple selections" })] }), _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: question.allowOther || false, onChange: (e) => updateQuestion(sectionId, question.id, { allowOther: e.target.checked }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-700", children: "Allow \"Other\" option" })] })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Custom Options" }), question.options?.map((option, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: option, onChange: (e) => {
                                                const newOptions = [...(question.options || [])];
                                                newOptions[index] = e.target.value;
                                                updateQuestion(sectionId, question.id, { options: newOptions });
                                            }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: `Option ${index + 1}` }), _jsx("button", { onClick: () => {
                                                const newOptions = question.options?.filter((_, i) => i !== index);
                                                updateQuestion(sectionId, question.id, { options: newOptions });
                                            }, className: "p-2 text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => {
                                        const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
                                        updateQuestion(sectionId, question.id, { options: newOptions });
                                    }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Custom Option" })] })] })), _jsxs("div", { className: "mt-4 border-t pt-4", children: [_jsx("h4", { className: "text-sm font-medium text-gray-900 mb-2", children: "Conditional Logic (optional)" }), _jsx("p", { className: "text-xs text-gray-500 mb-2", children: "Show this question only when previous answers match the rule." }), _jsxs("div", { className: "space-y-2", children: [(question.conditionalLogic?.showIf || []).map((rule, idx) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { className: "w-48 px-2 py-1 border rounded", value: rule.questionId, onChange: (e) => {
                                                const newRules = [...(question.conditionalLogic?.showIf || [])];
                                                newRules[idx] = { ...newRules[idx], questionId: e.target.value };
                                                updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' }, });
                                            }, placeholder: "Question ID" }), _jsxs("select", { className: "px-2 py-1 border rounded", value: rule.operator, onChange: (e) => {
                                                const newRules = [...(question.conditionalLogic?.showIf || [])];
                                                newRules[idx] = { ...newRules[idx], operator: e.target.value };
                                                updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' }, });
                                            }, children: [_jsx("option", { value: "equals", children: "equals" }), _jsx("option", { value: "not-equals", children: "not-equals" }), _jsx("option", { value: "contains", children: "contains" })] }), _jsx("input", { className: "px-2 py-1 border rounded", value: String(rule.value || ''), onChange: (e) => {
                                                const newRules = [...(question.conditionalLogic?.showIf || [])];
                                                newRules[idx] = { ...newRules[idx], value: e.target.value };
                                                updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' }, });
                                            }, placeholder: "Value" }), _jsx("button", { className: "px-2 py-1 text-red-600", onClick: () => {
                                                const newRules = (question.conditionalLogic?.showIf || []).filter((_, i) => i !== idx);
                                                updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' }, });
                                            }, children: "Remove" })] }, idx))), _jsx("button", { className: "text-sm text-orange-500", onClick: () => {
                                        const newRules = [...(question.conditionalLogic?.showIf || []), { questionId: '', operator: 'equals', value: '' }];
                                        updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' } });
                                    }, children: "+ Add condition" })] })] })] }));
    };
    if (!survey) {
        return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" }), _jsx("h2", { className: "text-xl font-semibold text-gray-900", children: "Loading survey builder..." })] }));
    }
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsxs(Link, { to: "/admin/surveys", className: "inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium", children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Surveys"] }), _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-3 mb-2", children: [_jsx("input", { type: "text", value: survey.title, onChange: (e) => setSurvey(prev => prev ? { ...prev, title: e.target.value, updatedAt: new Date().toISOString() } : null), className: "text-3xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1", placeholder: "Survey Title" }), isAIMode && (_jsxs("span", { className: "bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-sm font-medium flex items-center space-x-1", children: [_jsx(Brain, { className: "h-4 w-4" }), _jsx("span", { children: "AI Mode" })] }))] }), _jsx("textarea", { value: survey.description, onChange: (e) => setSurvey(prev => prev ? { ...prev, description: e.target.value, updatedAt: new Date().toISOString() } : null), className: "text-gray-600 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 resize-none", placeholder: "Survey description", rows: 2 })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("button", { onClick: () => setShowBranding(!showBranding), className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Palette, { className: "h-4 w-4" }), _jsx("span", { children: "Branding" })] }), _jsxs("button", { onClick: () => setShowAssignModal(true), className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Building2, { className: "h-4 w-4" }), _jsx("span", { children: "Assign Survey" })] }), _jsxs("button", { onClick: () => setShowSettings(!showSettings), className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Settings, { className: "h-4 w-4" }), _jsx("span", { children: "Settings" })] }), _jsxs("button", { onClick: () => window.open(`/admin/surveys/${survey.id}/preview`, '_blank'), className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Eye, { className: "h-4 w-4" }), _jsx("span", { children: "Preview" })] }), _jsxs("button", { onClick: () => {
                                            try {
                                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(survey, null, 2));
                                                const dlAnchor = document.createElement('a');
                                                dlAnchor.setAttribute('href', dataStr);
                                                dlAnchor.setAttribute('download', `${survey.title.replace(/\s+/g, '_').toLowerCase() || 'survey'}.json`);
                                                document.body.appendChild(dlAnchor);
                                                dlAnchor.click();
                                                dlAnchor.remove();
                                            }
                                            catch (err) {
                                                console.warn('Export failed', err);
                                            }
                                        }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(BarChart3, { className: "h-4 w-4" }), _jsx("span", { children: "Export" })] }), _jsxs("button", { onClick: saveSurvey, disabled: isSaving, className: "bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50", children: [_jsx(Save, { className: "h-4 w-4" }), _jsx("span", { children: isSaving ? 'Saving...' : 'Save' })] }), _jsxs("div", { className: "text-xs text-gray-500 ml-2", children: [lastSavedAt ? `Last saved ${lastSavedAt}` : 'Not saved yet', _jsx("div", { children: queueLength > 0 ? ` • ${queueLength} pending sync` : ' • synced' }), lastFlush && _jsxs("div", { className: "text-xs text-gray-400", children: ["Last flush: ", new Date(lastFlush).toLocaleTimeString()] })] })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-4 gap-8", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Question Types" }), _jsx("div", { className: "space-y-3", children: questionTypes.map((type) => (_jsx("button", { onClick: () => {
                                        if (activeSection) {
                                            addQuestion(activeSection, type.id);
                                        }
                                    }, disabled: !activeSection, className: "w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-gray-100 p-2 rounded-lg", children: getQuestionIcon(type.id) }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900 text-sm", children: type.name }), _jsx("div", { className: "text-xs text-gray-600", children: type.description })] })] }) }, type.id))) }), _jsxs("div", { className: "mt-6 pt-6 border-t border-gray-200", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-3", children: "AI Suggestions" }), _jsxs("div", { className: "space-y-2", children: [_jsx("button", { onClick: addAIQuestions, disabled: !activeSection, className: "w-full text-left p-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Brain, { className: "h-4 w-4 text-purple-500" }), _jsx("span", { className: "text-sm text-purple-800", children: "Generate DEI Questions" })] }) }), _jsx("button", { className: "w-full text-left p-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors duration-200", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Zap, { className: "h-4 w-4 text-blue-500" }), _jsx("span", { className: "text-sm text-blue-800", children: "Suggest Logic Flows" })] }) })] })] })] }), _jsxs("div", { className: "lg:col-span-3 space-y-6", children: [_jsxs("div", { className: "space-y-4", children: [survey.sections.map((section) => (_jsxs("div", { className: "bg-gray-50 rounded-xl p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("input", { type: "text", value: section.title, onChange: (e) => setSurvey(prev => prev ? {
                                                                    ...prev,
                                                                    sections: prev.sections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s),
                                                                    updatedAt: new Date().toISOString()
                                                                } : null), className: "text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1", placeholder: "Section title" }), _jsx("textarea", { value: section.description || '', onChange: (e) => setSurvey(prev => prev ? {
                                                                    ...prev,
                                                                    sections: prev.sections.map(s => s.id === section.id ? { ...s, description: e.target.value } : s),
                                                                    updatedAt: new Date().toISOString()
                                                                } : null), className: "text-gray-600 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 resize-none w-full", placeholder: "Section description", rows: 1 })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => setActiveSection(activeSection === section.id ? '' : section.id), className: "p-2 text-gray-600 hover:text-gray-800", children: activeSection === section.id ? _jsx(ChevronUp, { className: "h-5 w-5" }) : _jsx(ChevronDown, { className: "h-5 w-5" }) }), _jsx("button", { className: "p-2 text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }), activeSection === section.id && (_jsxs("div", { className: "space-y-4", children: [section.questions.map((question) => renderQuestionEditor(question, section.id)), section.questions.length === 0 && (_jsxs("div", { className: "text-center py-8 border-2 border-dashed border-gray-300 rounded-lg", children: [_jsx(MessageSquare, { className: "h-8 w-8 text-gray-400 mx-auto mb-2" }), _jsx("p", { className: "text-gray-500", children: "No questions yet. Select a question type from the left to get started." })] }))] }))] }, section.id))), _jsxs("button", { onClick: addSection, className: "w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-500 hover:bg-orange-50 transition-colors duration-200", children: [_jsx(Plus, { className: "h-6 w-6 text-gray-400 mx-auto mb-2" }), _jsx("span", { className: "text-gray-600 font-medium", children: "Add Section" })] })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Reflection Prompts" }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "These prompts will appear after survey completion to encourage deeper thinking and self-reflection." }), _jsxs("div", { className: "space-y-3", children: [survey.reflectionPrompts?.map((prompt, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: prompt, onChange: (e) => {
                                                            const newPrompts = [...(survey.reflectionPrompts || [])];
                                                            newPrompts[index] = e.target.value;
                                                            setSurvey(prev => prev ? { ...prev, reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() } : null);
                                                        }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm", placeholder: "Reflection prompt" }), _jsx("button", { onClick: () => {
                                                            const newPrompts = (survey.reflectionPrompts || []).filter((_, i) => i !== index);
                                                            setSurvey(prev => prev ? { ...prev, reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() } : null);
                                                        }, className: "p-2 text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => {
                                                    const newPrompts = [...(survey.reflectionPrompts || []), 'New reflection prompt'];
                                                    setSurvey(prev => prev ? { ...prev, reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() } : null);
                                                }, className: "text-orange-500 hover:text-orange-600 text-sm font-medium", children: "+ Add Reflection Prompt" })] })] })] })] }), showSettings && (_jsx(React.Suspense, { fallback: _jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center", children: _jsxs("div", { className: "bg-white p-8 rounded-xl shadow-xl flex items-center space-x-3", children: [_jsx("div", { className: "animate-spin h-6 w-6 border-2 border-gray-600 border-t-transparent rounded-full" }), _jsx("span", { className: "text-gray-700 font-medium", children: "Loading Settings Panel..." })] }) }), children: _jsx(SurveySettingsModal, { isOpen: showSettings, onClose: () => setShowSettings(false), settings: {
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
                    }, onSave: (settings) => {
                        setSurvey(prev => prev ? {
                            ...prev,
                            settings: {
                                ...prev.settings,
                                allowAnonymous: settings.accessControl.allowAnonymous,
                                allowSaveAndContinue: settings.advanced.allowBack,
                                showProgressBar: settings.advanced.showProgress,
                                randomizeQuestions: settings.advanced.randomizeQuestions
                            },
                            updatedAt: new Date().toISOString()
                        } : null);
                        saveSurvey();
                    } }) })), showAssignModal && (_jsx(React.Suspense, { fallback: _jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center", children: _jsxs("div", { className: "bg-white p-8 rounded-xl shadow-xl flex items-center space-x-3", children: [_jsx("div", { className: "animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" }), _jsx("span", { className: "text-gray-700 font-medium", children: "Loading Assignment Modal..." })] }) }), children: _jsx(AssignmentModal, { isOpen: showAssignModal, onClose: () => setShowAssignModal(false), organizations: organizations, selectedOrganizations: survey?.assignedTo?.organizationIds || [], onSave: async (organizationIds) => {
                        if (!survey)
                            return;
                        setSurvey(prev => prev ? {
                            ...prev,
                            assignedTo: { ...prev.assignedTo, organizationIds },
                            updatedAt: new Date().toISOString()
                        } : null);
                        await saveSurvey();
                    } }) })), survey.sections.length === 0 && (_jsxs("div", { className: "text-center py-12", children: [_jsx(Target, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "Start Building Your Survey" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Add your first section to begin creating questions." }), _jsxs("button", { onClick: addSection, className: "bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center mx-auto space-x-2", children: [_jsx(Plus, { className: "h-5 w-5" }), _jsx("span", { children: "Add First Section" })] })] }))] }));
};
export default AdminSurveyBuilder;
