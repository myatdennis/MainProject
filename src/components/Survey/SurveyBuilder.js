import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { Plus, Trash2, Copy, Eye, Settings, ChevronDown, ChevronUp, GripVertical, Wand2, Save, Send } from 'lucide-react';
const QUESTION_TYPES = [
    { type: 'single-select', label: 'Single Choice', description: 'Choose one option', icon: '○' },
    { type: 'multi-select', label: 'Multiple Choice', description: 'Choose multiple options', icon: '☑' },
    { type: 'matrix-likert', label: 'Matrix/Likert', description: 'Grid of questions with rating scale', icon: '⊞' },
    { type: 'ranking', label: 'Ranking', description: 'Rank items in order', icon: '≡' },
    { type: 'nps', label: 'Net Promoter Score', description: '0-10 recommendation scale', icon: '⊕' },
    { type: 'slider', label: 'Slider', description: 'Visual slider input', icon: '▬' },
    { type: 'open-ended', label: 'Text Response', description: 'Free text input', icon: '📝' },
    { type: 'file-upload', label: 'File Upload', description: 'Upload documents/images', icon: '📎' },
    { type: 'demographics', label: 'Demographics', description: 'Standard demographic questions', icon: '👥' },
];
const DEI_TEMPLATES = [
    {
        id: 'workplace-climate',
        name: 'Workplace Climate & Inclusion Index',
        description: 'Measure belonging, respect, fairness, and voice in the workplace',
        category: 'Core DEI Assessment',
        estimatedDuration: 15,
        questionCount: 35,
        tags: ['inclusion', 'belonging', 'climate']
    },
    {
        id: 'psychological-safety',
        name: 'Psychological Safety & Team Trust',
        description: 'Assess team dynamics and psychological safety levels',
        category: 'Team Effectiveness',
        estimatedDuration: 12,
        questionCount: 28,
        tags: ['safety', 'trust', 'teams']
    },
    {
        id: 'bias-microaggressions',
        name: 'Bias & Microaggressions Pulse',
        description: 'Identify and measure bias incidents and microaggressions',
        category: 'Bias Assessment',
        estimatedDuration: 10,
        questionCount: 22,
        tags: ['bias', 'microaggressions', 'pulse']
    },
    {
        id: 'accessibility',
        name: 'Accessibility & Accommodations',
        description: 'Evaluate accessibility needs and accommodation effectiveness',
        category: 'Accessibility',
        estimatedDuration: 8,
        questionCount: 18,
        tags: ['accessibility', 'accommodations', 'inclusion']
    },
    {
        id: 'leadership-culture',
        name: 'Leadership & Culture Barometer',
        description: 'Assess leadership effectiveness in creating inclusive culture',
        category: 'Leadership Assessment',
        estimatedDuration: 20,
        questionCount: 42,
        tags: ['leadership', 'culture', 'management']
    },
    {
        id: 'recruitment-equity',
        name: 'Recruitment & Promotion Equity',
        description: 'Evaluate fairness in hiring and promotion processes',
        category: 'Talent Processes',
        estimatedDuration: 18,
        questionCount: 38,
        tags: ['recruitment', 'promotion', 'equity']
    }
];
const SurveyBuilder = ({ survey: initialSurvey, onSave, onPublish }) => {
    const [survey, setSurvey] = useState(initialSurvey || {
        id: '',
        title: 'New Survey',
        description: '',
        status: 'draft',
        version: 1,
        createdBy: 'current-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        sections: [],
        blocks: [{
                id: 'block-1',
                title: 'Survey Questions',
                questions: [],
            }],
        settings: {
            anonymityMode: 'confidential',
            anonymityThreshold: 5,
            allowMultipleResponses: false,
            showProgressBar: true,
            consentRequired: true,
            allowAnonymous: true,
            allowSaveAndContinue: true,
            randomizeQuestions: false,
            randomizeOptions: false,
        },
        branding: {
            primaryColor: '#3A7DFF',
            secondaryColor: '#228B22',
        },
        defaultLanguage: 'en',
        supportedLanguages: ['en'],
        completionSettings: {
            thankYouMessage: 'Thank you for completing this survey!',
            showResources: true,
            recommendedCourses: [],
        }
    });
    const [activeTab, setActiveTab] = useState('build');
    const [showAIAssist, setShowAIAssist] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    // Question Management
    const addQuestion = useCallback((blockId, type) => {
        const newQuestion = {
            id: `question-${Date.now()}`,
            type,
            title: `New ${type.replace('-', ' ')} Question`,
            description: '',
            required: false,
            order: survey.blocks.find(b => b.id === blockId)?.questions.length || 0,
        };
        // Add type-specific properties
        if (type === 'single-select' || type === 'multi-select') {
            newQuestion.options = ['Option 1', 'Option 2', 'Option 3'];
        }
        else if (type === 'matrix-likert') {
            newQuestion.matrixRows = ['Statement 1', 'Statement 2'];
            newQuestion.matrixColumns = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
        }
        else if (type === 'nps') {
            newQuestion.scale = { min: 0, max: 10, minLabel: 'Not at all likely', maxLabel: 'Extremely likely' };
        }
        else if (type === 'slider') {
            newQuestion.scale = { min: 0, max: 100, minLabel: 'Low', maxLabel: 'High' };
        }
        else if (type === 'ranking') {
            newQuestion.rankingItems = ['Item 1', 'Item 2', 'Item 3'];
        }
        setSurvey(prev => ({
            ...prev,
            blocks: prev.blocks.map(block => block.id === blockId
                ? { ...block, questions: [...block.questions, newQuestion] }
                : block)
        }));
    }, [survey.blocks]);
    const updateQuestion = useCallback((blockId, questionId, updates) => {
        setSurvey(prev => ({
            ...prev,
            blocks: prev.blocks.map(block => block.id === blockId
                ? {
                    ...block,
                    questions: block.questions.map(q => q.id === questionId ? { ...q, ...updates } : q)
                }
                : block)
        }));
    }, []);
    const deleteQuestion = useCallback((blockId, questionId) => {
        setSurvey(prev => ({
            ...prev,
            blocks: prev.blocks.map(block => block.id === blockId
                ? {
                    ...block,
                    questions: block.questions.filter(q => q.id !== questionId)
                }
                : block)
        }));
    }, []);
    const duplicateQuestion = useCallback((blockId, questionId) => {
        const block = survey.blocks.find(b => b.id === blockId);
        const question = block?.questions.find(q => q.id === questionId);
        if (question) {
            const duplicated = {
                ...question,
                id: `question-${Date.now()}`,
                title: `${question.title} (Copy)`,
                order: question.order + 1
            };
            addQuestion(blockId, duplicated.type);
            updateQuestion(blockId, duplicated.id, duplicated);
        }
    }, [survey.blocks, addQuestion, updateQuestion]);
    // AI Assistant Functions
    const handleAIAssist = async (prompt, type) => {
        // Mock AI assistance - in real implementation, this would call an AI service
        const suggestions = {
            generate: [
                "How comfortable do you feel expressing your authentic self at work?",
                "To what extent do you feel your voice is heard and valued in team meetings?",
                "How fairly do you feel promotion decisions are made in your organization?"
            ],
            improve: [
                "Consider adding a neutral option to avoid forced choice bias",
                "This question may be leading - try rephrasing more neutrally",
                "Add clarifying text to ensure consistent interpretation"
            ],
            translate: [
                "Question translated to Spanish, French, and German",
                "Cultural adaptation suggestions provided",
                "Localized examples added for regional context"
            ]
        };
        // Simulate AI response
        alert(`AI Suggestions for "${prompt}":\n\n${suggestions[type].join('\n\n')}`);
        setShowAIAssist(false);
        setAiPrompt('');
    };
    // Load Template
    const loadTemplate = (templateId) => {
        const template = DEI_TEMPLATES.find(t => t.id === templateId);
        if (!template)
            return;
        // Mock template loading - in real implementation, this would load actual template data
        const templateSurvey = {
            ...survey,
            title: template.name,
            description: template.description,
            blocks: [{
                    id: 'block-1',
                    title: 'Survey Questions',
                    questions: [
                        {
                            id: 'q1',
                            type: 'matrix-likert',
                            title: 'Rate your agreement with the following statements about your workplace:',
                            description: 'Please consider your experiences over the past 6 months',
                            required: true,
                            order: 0,
                            matrixRows: [
                                'I feel like I belong in this organization',
                                'My colleagues treat me with respect',
                                'I can be my authentic self at work',
                                'My opinions are valued by my team'
                            ],
                            matrixColumns: [
                                'Strongly Disagree',
                                'Disagree',
                                'Somewhat Disagree',
                                'Neutral',
                                'Somewhat Agree',
                                'Agree',
                                'Strongly Agree'
                            ]
                        },
                        {
                            id: 'q2',
                            type: 'nps',
                            title: 'How likely are you to recommend this organization as a great place to work for people from diverse backgrounds?',
                            required: true,
                            order: 1,
                            scale: {
                                min: 0,
                                max: 10,
                                minLabel: 'Not at all likely',
                                maxLabel: 'Extremely likely'
                            }
                        }
                    ]
                }]
        };
        setSurvey(templateSurvey);
        setActiveTab('build');
    };
    // Question Type Selector Component
    const QuestionTypeSelector = ({ onSelect }) => (_jsx("div", { className: "grid grid-cols-3 gap-3 p-4", children: QUESTION_TYPES.map(({ type, label, description, icon }) => (_jsxs("button", { onClick: () => onSelect(type), className: "p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors", children: [_jsx("div", { className: "text-2xl mb-2", children: icon }), _jsx("div", { className: "font-medium text-sm text-gray-900", children: label }), _jsx("div", { className: "text-xs text-gray-600", children: description })] }, type))) }));
    // Question Editor Component
    const QuestionEditor = ({ question, onUpdate, onDelete, onDuplicate }) => {
        const [expanded, setExpanded] = useState(false);
        return (_jsxs("div", { className: "border border-gray-200 rounded-lg bg-white", children: [_jsx("div", { className: "p-4 border-b border-gray-100", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(GripVertical, { className: "w-4 h-4 text-gray-400 cursor-move" }), _jsxs("div", { className: "flex-1", children: [_jsx("input", { type: "text", value: question.title, onChange: (e) => onUpdate({ title: e.target.value }), className: "w-full font-medium text-gray-900 bg-transparent border-none outline-none", placeholder: "Enter question text..." }), question.description && (_jsx("input", { type: "text", value: question.description, onChange: (e) => onUpdate({ description: e.target.value }), className: "w-full text-sm text-gray-600 bg-transparent border-none outline-none mt-1", placeholder: "Question description..." }))] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("label", { className: "flex items-center space-x-1 text-sm", children: [_jsx("input", { type: "checkbox", checked: question.required, onChange: (e) => onUpdate({ required: e.target.checked }), className: "rounded border-gray-300" }), _jsx("span", { children: "Required" })] }), _jsx("button", { onClick: () => setExpanded(!expanded), className: "p-1 hover:bg-gray-100 rounded", children: expanded ? _jsx(ChevronUp, { className: "w-4 h-4" }) : _jsx(ChevronDown, { className: "w-4 h-4" }) }), _jsx("button", { onClick: onDuplicate, className: "p-1 hover:bg-gray-100 rounded", children: _jsx(Copy, { className: "w-4 h-4" }) }), _jsx("button", { onClick: onDelete, className: "p-1 hover:bg-red-100 rounded text-red-600", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }) }), expanded && (_jsx("div", { className: "p-4", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Description" }), _jsx("input", { type: "text", value: question.description || '', onChange: (e) => onUpdate({ description: e.target.value }), className: "w-full p-2 border border-gray-300 rounded-lg", placeholder: "Optional question description..." })] }), (question.type === 'single-select' || question.type === 'multi-select') && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Answer Options" }), _jsxs("div", { className: "space-y-2", children: [question.options?.map((option, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: option, onChange: (e) => {
                                                            const newOptions = [...(question.options || [])];
                                                            newOptions[index] = e.target.value;
                                                            onUpdate({ options: newOptions });
                                                        }, className: "flex-1 p-2 border border-gray-300 rounded" }), _jsx("button", { onClick: () => {
                                                            const newOptions = question.options?.filter((_, i) => i !== index);
                                                            onUpdate({ options: newOptions });
                                                        }, className: "p-2 text-red-600 hover:bg-red-100 rounded", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, index))), _jsxs("button", { onClick: () => {
                                                    const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
                                                    onUpdate({ options: newOptions });
                                                }, className: "flex items-center space-x-1 text-blue-600 hover:text-blue-700", children: [_jsx(Plus, { className: "w-4 h-4" }), _jsx("span", { children: "Add Option" })] })] })] })), question.type === 'matrix-likert' && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Row Labels (Statements)" }), _jsxs("div", { className: "space-y-2", children: [question.matrixRows?.map((row, index) => (_jsx("input", { type: "text", value: row, onChange: (e) => {
                                                            const newRows = [...(question.matrixRows || [])];
                                                            newRows[index] = e.target.value;
                                                            onUpdate({ matrixRows: newRows });
                                                        }, className: "w-full p-2 border border-gray-300 rounded" }, index))), _jsx("button", { onClick: () => {
                                                            const newRows = [...(question.matrixRows || []), `Statement ${(question.matrixRows?.length || 0) + 1}`];
                                                            onUpdate({ matrixRows: newRows });
                                                        }, className: "text-blue-600 text-sm", children: "+ Add Row" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Column Labels (Scale)" }), _jsx("div", { className: "space-y-2", children: question.matrixColumns?.map((col, index) => (_jsx("input", { type: "text", value: col, onChange: (e) => {
                                                        const newCols = [...(question.matrixColumns || [])];
                                                        newCols[index] = e.target.value;
                                                        onUpdate({ matrixColumns: newCols });
                                                    }, className: "w-full p-2 border border-gray-300 rounded" }, index))) })] })] })), question.type === 'nps' && (_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Low End Label (0)" }), _jsx("input", { type: "text", value: question.scale?.minLabel || '', onChange: (e) => onUpdate({
                                                    scale: {
                                                        min: 0,
                                                        max: 10,
                                                        minLabel: e.target.value,
                                                        maxLabel: question.scale?.maxLabel || 'Extremely likely'
                                                    }
                                                }), className: "w-full p-2 border border-gray-300 rounded" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "High End Label (10)" }), _jsx("input", { type: "text", value: question.scale?.maxLabel || '', onChange: (e) => onUpdate({
                                                    scale: {
                                                        min: 0,
                                                        max: 10,
                                                        minLabel: question.scale?.minLabel || 'Not at all likely',
                                                        maxLabel: e.target.value
                                                    }
                                                }), className: "w-full p-2 border border-gray-300 rounded" })] })] }))] }) }))] }));
    };
    return (_jsxs("div", { className: "max-w-7xl mx-auto bg-white", children: [_jsxs("div", { className: "border-b border-gray-200 bg-white sticky top-0 z-10", children: [_jsx("div", { className: "px-6 py-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("input", { type: "text", value: survey.title, onChange: (e) => setSurvey(prev => ({ ...prev, title: e.target.value })), className: "text-xl font-semibold text-gray-900 bg-transparent border-none outline-none" }), _jsx("input", { type: "text", value: survey.description || '', onChange: (e) => setSurvey(prev => ({ ...prev, description: e.target.value })), className: "block text-sm text-gray-600 bg-transparent border-none outline-none mt-1", placeholder: "Survey description..." })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("span", { className: `px-2 py-1 rounded text-xs font-medium ${survey.status === 'published'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'}`, children: survey.status }), _jsxs("button", { onClick: () => onSave(survey), className: "flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200", children: [_jsx(Save, { className: "w-4 h-4" }), _jsx("span", { children: "Save" })] }), _jsxs("button", { onClick: () => onPublish(survey), className: "flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: [_jsx(Send, { className: "w-4 h-4" }), _jsx("span", { children: "Publish" })] })] })] }) }), _jsx("div", { className: "px-6", children: _jsx("nav", { className: "flex space-x-8", children: [
                                { id: 'build', label: 'Build', icon: Plus },
                                { id: 'templates', label: 'Templates', icon: Copy },
                                { id: 'settings', label: 'Settings', icon: Settings },
                                { id: 'preview', label: 'Preview', icon: Eye },
                            ].map(({ id, label, icon: Icon }) => (_jsxs("button", { onClick: () => setActiveTab(id), className: `flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${activeTab === id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: [_jsx(Icon, { className: "w-4 h-4" }), _jsx("span", { children: label })] }, id))) }) })] }), _jsxs("div", { className: "p-6", children: [activeTab === 'templates' && (_jsxs("div", { children: [_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: "DEI Survey Templates" }), _jsx("p", { className: "text-gray-600", children: "Choose from research-backed templates designed for diversity, equity, and inclusion measurement" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: DEI_TEMPLATES.map((template) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-6 hover:border-blue-500 transition-colors", children: [_jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "font-semibold text-gray-900 mb-2", children: template.name }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: template.description }), _jsxs("div", { className: "flex items-center justify-between text-xs text-gray-500", children: [_jsxs("span", { children: [template.questionCount, " questions"] }), _jsxs("span", { children: ["~", template.estimatedDuration, " min"] })] })] }), _jsx("div", { className: "flex flex-wrap gap-1 mb-4", children: template.tags.map((tag) => (_jsx("span", { className: "px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded", children: tag }, tag))) }), _jsx("button", { onClick: () => loadTemplate(template.id), className: "w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors", children: "Use This Template" })] }, template.id))) })] })), activeTab === 'build' && (_jsxs("div", { className: "grid grid-cols-4 gap-6", children: [_jsx("div", { className: "col-span-3 space-y-6", children: survey.blocks.map((block) => (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: block.title }), _jsxs("button", { onClick: () => setShowAIAssist(true), className: "flex items-center space-x-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200", children: [_jsx(Wand2, { className: "w-4 h-4" }), _jsx("span", { children: "AI Assist" })] })] }), _jsx("div", { className: "space-y-4", children: block.questions.map((question) => (_jsx(QuestionEditor, { question: question, onUpdate: (updates) => updateQuestion(block.id, question.id, updates), onDelete: () => deleteQuestion(block.id, question.id), onDuplicate: () => duplicateQuestion(block.id, question.id) }, question.id))) }), _jsx("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-6", children: _jsxs("div", { className: "text-center", children: [_jsx(Plus, { className: "w-8 h-8 text-gray-400 mx-auto mb-2" }), _jsx("h4", { className: "font-medium text-gray-900 mb-1", children: "Add Question" }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "Choose a question type to get started" }), _jsx(QuestionTypeSelector, { onSelect: (type) => addQuestion(block.id, type) })] }) })] }, block.id))) }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gray-50 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-3", children: "Quick Stats" }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Questions" }), _jsx("span", { children: survey.blocks.reduce((total, block) => total + block.questions.length, 0) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Estimated time" }), _jsxs("span", { children: [Math.ceil(survey.blocks.reduce((total, block) => total + block.questions.length, 0) * 0.5), " min"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Status" }), _jsx("span", { className: "capitalize", children: survey.status })] })] })] }), _jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "DEI Best Practices" }), _jsxs("ul", { className: "text-sm text-blue-700 space-y-1", children: [_jsx("li", { children: "\u2022 Use inclusive language" }), _jsx("li", { children: "\u2022 Provide anonymity options" }), _jsx("li", { children: "\u2022 Include diverse perspectives" }), _jsx("li", { children: "\u2022 Test for bias in questions" })] })] })] })] })), activeTab === 'settings' && (_jsxs("div", { className: "max-w-3xl space-y-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Survey Settings" }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Anonymity Mode" }), _jsxs("select", { value: survey.settings.anonymityMode, onChange: (e) => setSurvey(prev => ({
                                                            ...prev,
                                                            settings: { ...prev.settings, anonymityMode: e.target.value }
                                                        })), className: "w-full p-3 border border-gray-300 rounded-lg", children: [_jsx("option", { value: "anonymous", children: "Anonymous - No identifying information collected" }), _jsx("option", { value: "confidential", children: "Confidential - Identity known but kept private" }), _jsx("option", { value: "identified", children: "Identified - Responses linked to participants" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Anonymity Threshold (minimum group size to show results)" }), _jsx("input", { type: "number", min: "3", max: "20", value: survey.settings.anonymityThreshold, onChange: (e) => setSurvey(prev => ({
                                                            ...prev,
                                                            settings: { ...prev.settings, anonymityThreshold: parseInt(e.target.value) }
                                                        })), className: "w-32 p-3 border border-gray-300 rounded-lg" }), _jsx("p", { className: "text-sm text-gray-600 mt-1", children: "Groups smaller than this will be masked in reports" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("label", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "checkbox", checked: survey.settings.showProgressBar, onChange: (e) => setSurvey(prev => ({
                                                                    ...prev,
                                                                    settings: { ...prev.settings, showProgressBar: e.target.checked }
                                                                })), className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Show progress bar" })] }), _jsxs("label", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "checkbox", checked: survey.settings.consentRequired, onChange: (e) => setSurvey(prev => ({
                                                                    ...prev,
                                                                    settings: { ...prev.settings, consentRequired: e.target.checked }
                                                                })), className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Require consent to participate" })] }), _jsxs("label", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "checkbox", checked: survey.settings.allowMultipleResponses, onChange: (e) => setSurvey(prev => ({
                                                                    ...prev,
                                                                    settings: { ...prev.settings, allowMultipleResponses: e.target.checked }
                                                                })), className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Allow multiple responses per user" })] })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Branding" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Primary Color" }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "color", value: survey.branding.primaryColor, onChange: (e) => setSurvey(prev => ({
                                                                    ...prev,
                                                                    branding: { ...prev.branding, primaryColor: e.target.value }
                                                                })), className: "w-12 h-12 border border-gray-300 rounded-lg" }), _jsx("input", { type: "text", value: survey.branding.primaryColor, onChange: (e) => setSurvey(prev => ({
                                                                    ...prev,
                                                                    branding: { ...prev.branding, primaryColor: e.target.value }
                                                                })), className: "flex-1 p-3 border border-gray-300 rounded-lg" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Secondary Color" }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "color", value: survey.branding.secondaryColor, onChange: (e) => setSurvey(prev => ({
                                                                    ...prev,
                                                                    branding: { ...prev.branding, secondaryColor: e.target.value }
                                                                })), className: "w-12 h-12 border border-gray-300 rounded-lg" }), _jsx("input", { type: "text", value: survey.branding.secondaryColor, onChange: (e) => setSurvey(prev => ({
                                                                    ...prev,
                                                                    branding: { ...prev.branding, secondaryColor: e.target.value }
                                                                })), className: "flex-1 p-3 border border-gray-300 rounded-lg" })] })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Completion Settings" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Thank You Message" }), _jsx("textarea", { value: survey.completionSettings.thankYouMessage, onChange: (e) => setSurvey(prev => ({
                                                            ...prev,
                                                            completionSettings: { ...prev.completionSettings, thankYouMessage: e.target.value }
                                                        })), rows: 3, className: "w-full p-3 border border-gray-300 rounded-lg" })] }), _jsxs("label", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "checkbox", checked: survey.completionSettings.showResources, onChange: (e) => setSurvey(prev => ({
                                                            ...prev,
                                                            completionSettings: { ...prev.completionSettings, showResources: e.target.checked }
                                                        })), className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Show recommended resources after completion" })] })] })] })] })), activeTab === 'preview' && (_jsx("div", { className: "max-w-2xl mx-auto", children: _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg shadow-sm", children: [_jsxs("div", { className: "p-6 border-b border-gray-200", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900", children: survey.title }), survey.description && (_jsx("p", { className: "text-gray-600 mt-2", children: survey.description })), survey.settings.showProgressBar && (_jsxs("div", { className: "mt-4", children: [_jsx("div", { className: "bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-blue-500 h-2 rounded-full transition-all", style: { width: '25%' } }) }), _jsx("p", { className: "text-sm text-gray-600 mt-1", children: "Progress: 1 of 4 pages" })] }))] }), _jsxs("div", { className: "p-6 space-y-6", children: [survey.blocks[0]?.questions.slice(0, 3).map((question) => (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsxs("h3", { className: "font-medium text-gray-900", children: [question.title, question.required && _jsx("span", { className: "text-red-500 ml-1", children: "*" })] }), question.description && (_jsx("p", { className: "text-sm text-gray-600 mt-1", children: question.description }))] }), question.type === 'single-select' && (_jsx("div", { className: "space-y-2", children: question.options?.slice(0, 3).map((option, index) => (_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", name: question.id, className: "border-gray-300" }), _jsx("span", { className: "text-sm", children: option })] }, index))) })), question.type === 'matrix-likert' && (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "text-left p-2" }), question.matrixColumns?.slice(0, 5).map((col, index) => (_jsx("th", { className: "text-center p-2 text-xs", children: col }, index)))] }) }), _jsx("tbody", { children: question.matrixRows?.slice(0, 2).map((row, rowIndex) => (_jsxs("tr", { className: "border-t border-gray-200", children: [_jsx("td", { className: "p-2 text-sm", children: row }), question.matrixColumns?.slice(0, 5).map((_, colIndex) => (_jsx("td", { className: "p-2 text-center", children: _jsx("input", { type: "radio", name: `${question.id}-${rowIndex}` }) }, colIndex)))] }, rowIndex))) })] }) })), question.type === 'nps' && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-xs text-gray-600", children: question.scale?.minLabel }), _jsx("span", { className: "text-xs text-gray-600", children: question.scale?.maxLabel })] }), _jsx("div", { className: "flex space-x-1", children: Array.from({ length: 11 }, (_, i) => (_jsx("button", { className: "w-8 h-8 border border-gray-300 rounded text-sm hover:bg-blue-100", children: i }, i))) })] })), question.type === 'open-ended' && (_jsx("textarea", { rows: 3, className: "w-full p-3 border border-gray-300 rounded-lg", placeholder: "Enter your response..." }))] }, question.id))), _jsxs("div", { className: "flex justify-between pt-4", children: [_jsx("button", { className: "px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50", children: "Previous" }), _jsx("button", { className: "px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: "Next" })] })] })] }) }))] }), showAIAssist && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-md", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "AI Survey Assistant" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "What would you like help with?" }), _jsx("textarea", { value: aiPrompt, onChange: (e) => setAiPrompt(e.target.value), rows: 3, className: "w-full p-3 border border-gray-300 rounded-lg", placeholder: "e.g., Generate questions about workplace inclusion for remote teams" })] }), _jsxs("div", { className: "flex space-x-3", children: [_jsx("button", { onClick: () => handleAIAssist(aiPrompt, 'generate'), className: "flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: "Generate Questions" }), _jsx("button", { onClick: () => handleAIAssist(aiPrompt, 'improve'), className: "flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600", children: "Improve Existing" })] }), _jsx("button", { onClick: () => setShowAIAssist(false), className: "w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50", children: "Cancel" })] })] }) }))] }));
};
export default SurveyBuilder;
