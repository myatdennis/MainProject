import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Plus, BarChart3, Settings, Users, Bot, FileText, Send, Target, Zap } from 'lucide-react';
import SurveyBuilder from './SurveyBuilder';
import SurveyDistribution from './SurveyDistribution';
import SurveyAnalyticsDashboard from './SurveyAnalyticsDashboard';
import AISurveyBot from './AISurveyBot';
const DEISurveyPlatform = ({ organization = 'Your Organization' }) => {
    const [activeView, setActiveView] = useState('dashboard');
    const [selectedSurvey, setSelectedSurvey] = useState(null);
    const [surveys, setSurveys] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [showAIBot, setShowAIBot] = useState(false);
    // Mock data initialization
    useEffect(() => {
        setSurveys([
            {
                id: 'survey-1',
                title: 'Q1 2024 Workplace Climate Survey',
                description: 'Comprehensive assessment of inclusion, belonging, and psychological safety',
                status: 'published',
                createdBy: 'admin',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-15'),
                sections: [],
                blocks: [
                    {
                        id: 'block-1',
                        title: 'Workplace Experience',
                        questions: [
                            {
                                id: 'q1',
                                type: 'matrix-likert',
                                title: 'Rate your agreement with the following statements:',
                                required: true,
                                order: 0,
                                matrixRows: [
                                    'I feel like I belong in this organization',
                                    'My colleagues treat me with respect',
                                    'I can be my authentic self at work'
                                ],
                                matrixColumns: [
                                    'Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'
                                ]
                            }
                        ]
                    }
                ],
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
                    thankYouMessage: 'Thank you for your valuable feedback!',
                    showResources: true,
                    recommendedCourses: [],
                }
            },
            {
                id: 'survey-2',
                title: 'Leadership Inclusion Assessment',
                description: 'Evaluating leadership effectiveness in creating inclusive environments',
                status: 'draft',
                createdBy: 'admin',
                createdAt: new Date('2024-01-10'),
                updatedAt: new Date('2024-01-20'),
                sections: [],
                blocks: [],
                settings: {
                    anonymityMode: 'anonymous',
                    anonymityThreshold: 3,
                    allowMultipleResponses: false,
                    showProgressBar: true,
                    consentRequired: true,
                    allowAnonymous: true,
                    allowSaveAndContinue: true,
                    randomizeQuestions: false,
                    randomizeOptions: false,
                },
                branding: {
                    primaryColor: '#de7b12',
                    secondaryColor: '#228B22',
                },
                defaultLanguage: 'en',
                supportedLanguages: ['en', 'es'],
                completionSettings: {
                    thankYouMessage: 'Your feedback helps us build better leadership!',
                    showResources: false,
                    recommendedCourses: [],
                }
            }
        ]);
    }, []);
    const handleCreateSurvey = () => {
        setSelectedSurvey(null);
        setActiveView('builder');
    };
    const handleEditSurvey = (survey) => {
        setSelectedSurvey(survey);
        setActiveView('builder');
    };
    const handleSaveSurvey = (survey) => {
        if (survey.id) {
            setSurveys(prev => prev.map(s => s.id === survey.id ? survey : s));
        }
        else {
            const newSurvey = {
                ...survey,
                id: `survey-${Date.now()}`,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            setSurveys(prev => [...prev, newSurvey]);
        }
        setActiveView('dashboard');
    };
    const handlePublishSurvey = (survey) => {
        const publishedSurvey = {
            ...survey,
            status: 'published',
            updatedAt: new Date()
        };
        handleSaveSurvey(publishedSurvey);
        setSelectedSurvey(publishedSurvey);
        setActiveView('distribution');
    };
    const handleAssignmentSave = (assignment) => {
        setAssignments(prev => [...prev, assignment]);
    };
    const getStatsForSurvey = (surveyId) => {
        const assignment = assignments.find(a => a.surveyId === surveyId);
        return {
            responses: assignment?.responses.total || 0,
            completed: assignment?.responses.completed || 0,
            rate: assignment?.responses.total ?
                Math.round((assignment.responses.completed / assignment.responses.total) * 100) : 0
        };
    };
    const renderDashboard = () => (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "rounded-lg p-6 text-white", style: { background: 'var(--gradient-banner)' }, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold mb-2", children: "DEI Survey Platform" }), _jsx("p", { className: "text-white/90", children: "Create, distribute, and analyze diversity, equity, and inclusion surveys with AI-powered insights" })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "text-3xl font-bold", children: surveys.length }), _jsx("div", { className: "text-white/80", children: "Total Surveys" })] })] }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: [_jsx("div", { className: "card p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-green-100 rounded-lg", children: _jsx(FileText, { className: "w-6 h-6 text-green-600" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: surveys.filter(s => s.status === 'published').length }), _jsx("div", { className: "text-sm text-gray-600", children: "Active Surveys" })] })] }) }), _jsx("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-blue-100 rounded-lg", children: _jsx(Users, { className: "w-6 h-6 text-blue-600" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: assignments.reduce((sum, a) => sum + a.responses.total, 0) }), _jsx("div", { className: "text-sm text-gray-600", children: "Total Participants" })] })] }) }), _jsx("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-purple-100 rounded-lg", children: _jsx(BarChart3, { className: "w-6 h-6 text-purple-600" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: assignments.reduce((sum, a) => sum + a.responses.completed, 0) }), _jsx("div", { className: "text-sm text-gray-600", children: "Completed Responses" })] })] }) }), _jsx("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-orange-100 rounded-lg", children: _jsx(Target, { className: "w-6 h-6 text-orange-600" }) }), _jsxs("div", { children: [_jsxs("div", { className: "text-2xl font-bold text-gray-900", children: [assignments.length > 0
                                                    ? Math.round(assignments.reduce((sum, a) => sum + (a.responses.total > 0 ? (a.responses.completed / a.responses.total) : 0), 0)
                                                        / assignments.length * 100)
                                                    : 0, "%"] }), _jsx("div", { className: "text-sm text-gray-600", children: "Avg Response Rate" })] })] }) })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Recent Surveys" }), _jsxs("button", { onClick: handleCreateSurvey, className: "btn-primary inline-flex items-center space-x-2", children: [_jsx(Plus, { className: "w-4 h-4" }), _jsx("span", { children: "Create Survey" })] })] }) }), _jsx("div", { className: "divide-y divide-gray-200", children: surveys.length > 0 ? (surveys.map((survey) => {
                            const stats = getStatsForSurvey(survey.id);
                            return (_jsx("div", { className: "p-6 hover:bg-gray-50 transition-colors", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("h3", { className: "font-semibold text-gray-900", children: survey.title }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${survey.status === 'published'
                                                                ? 'bg-green-100 text-green-800'
                                                                : survey.status === 'draft'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-gray-100 text-gray-800'}`, children: survey.status })] }), _jsx("p", { className: "text-gray-600 text-sm mt-1", children: survey.description }), _jsxs("div", { className: "flex items-center space-x-4 mt-3 text-sm text-gray-500", children: [_jsxs("span", { children: ["Created ", typeof survey.createdAt === 'string' ? new Date(survey.createdAt).toLocaleDateString() : survey.createdAt.toLocaleDateString()] }), _jsx("span", { children: "\u2022" }), _jsxs("span", { children: [survey.blocks.reduce((sum, block) => sum + block.questions.length, 0), " questions"] }), stats.responses > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsxs("span", { children: [stats.completed, "/", stats.responses, " responses (", stats.rate, "%)"] })] }))] })] }), _jsxs("div", { className: "flex items-center space-x-2 ml-4", children: [_jsx("button", { onClick: () => handleEditSurvey(survey), className: "p-2 text-gray-600 hover:bg-gray-200 rounded", title: "Edit Survey", children: _jsx(Settings, { className: "w-4 h-4" }) }), survey.status === 'published' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => {
                                                                setSelectedSurvey(survey);
                                                                setActiveView('distribution');
                                                            }, className: "p-2 text-blue-600 hover:bg-blue-100 rounded", title: "Manage Distribution", children: _jsx(Send, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => {
                                                                setSelectedSurvey(survey);
                                                                setActiveView('analytics');
                                                            }, className: "p-2 text-purple-600 hover:bg-purple-100 rounded", title: "View Analytics", children: _jsx(BarChart3, { className: "w-4 h-4" }) })] }))] })] }) }, survey.id));
                        })) : (_jsxs("div", { className: "p-12 text-center", children: [_jsx(FileText, { className: "w-12 h-12 text-muted-text mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-medium text-neutral-text mb-2", children: "No surveys yet" }), _jsx("p", { className: "text-subtext-muted mb-4", children: "Get started by creating your first DEI survey from our research-backed templates" }), _jsxs("button", { onClick: handleCreateSurvey, className: "btn-primary inline-flex items-center space-x-2", children: [_jsx(Plus, { className: "w-4 h-4" }), _jsx("span", { children: "Create Your First Survey" })] })] })) })] }), _jsx("div", { className: "bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-purple-100 rounded-lg", children: _jsx(Bot, { className: "w-6 h-6 text-purple-600" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900", children: "AI Survey Assistant" }), _jsx("p", { className: "text-sm text-gray-600", children: "Get help creating questions, analyzing data, or improving your surveys" })] })] }), _jsxs("button", { onClick: () => setActiveView('ai'), className: "flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600", children: [_jsx(Zap, { className: "w-4 h-4" }), _jsx("span", { children: "Open AI Assistant" })] })] }) })] }));
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("div", { className: "bg-white border-b border-gray-200 sticky top-0 z-40", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsx("div", { className: "flex items-center justify-between h-16", children: _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "p-2 bg-blue-100 rounded-lg", children: _jsx(BarChart3, { className: "w-6 h-6 text-blue-600" }) }), _jsxs("div", { children: [_jsx("h1", { className: "font-semibold text-gray-900", children: "DEI Survey Platform" }), _jsx("p", { className: "text-xs text-gray-600", children: organization })] })] }), _jsxs("nav", { className: "hidden md:flex space-x-8 ml-8", children: [_jsxs("button", { onClick: () => setActiveView('dashboard'), className: `flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md ${activeView === 'dashboard'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`, children: [_jsx(BarChart3, { className: "w-4 h-4" }), _jsx("span", { children: "Dashboard" })] }), _jsxs("button", { onClick: () => setActiveView('builder'), className: `flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md ${activeView === 'builder'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`, children: [_jsx(Plus, { className: "w-4 h-4" }), _jsx("span", { children: "Survey Builder" })] }), _jsxs("button", { onClick: () => setActiveView('ai'), className: `flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md ${activeView === 'ai'
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`, children: [_jsx(Bot, { className: "w-4 h-4" }), _jsx("span", { children: "AI Assistant" })] })] })] }) }) }) }), _jsxs("div", { className: "max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8", children: [activeView === 'dashboard' && renderDashboard(), activeView === 'builder' && (_jsx(SurveyBuilder, { survey: selectedSurvey || undefined, onSave: handleSaveSurvey, onPublish: handlePublishSurvey })), activeView === 'distribution' && selectedSurvey && (_jsx(SurveyDistribution, { surveyId: selectedSurvey.id, surveyTitle: selectedSurvey.title, onAssignmentSave: handleAssignmentSave })), activeView === 'analytics' && selectedSurvey && (_jsx(SurveyAnalyticsDashboard, { surveyId: selectedSurvey.id })), activeView === 'ai' && (_jsx(AISurveyBot, { surveyData: selectedSurvey ? {
                            id: selectedSurvey.id,
                            title: selectedSurvey.title,
                            questions: selectedSurvey.blocks.flatMap(b => b.questions),
                            responses: [] // Would be populated with actual response data
                        } : undefined, onSuggestionApply: (suggestion) => {
                            // Handle AI suggestions
                            console.log('Applying AI suggestion:', suggestion);
                        } }))] }), activeView !== 'ai' && (_jsx("button", { onClick: () => setShowAIBot(!showAIBot), className: "fixed bottom-6 right-6 p-4 bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-600 transition-colors z-50", children: _jsx(Bot, { className: "w-6 h-6" }) })), showAIBot && activeView !== 'ai' && (_jsx("div", { className: "fixed bottom-20 right-6 w-96 h-96 bg-white border border-gray-200 rounded-lg shadow-2xl z-50", children: _jsxs("div", { className: "h-full flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between p-3 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Bot, { className: "w-5 h-5 text-purple-600" }), _jsx("span", { className: "font-medium text-gray-900", children: "AI Assistant" })] }), _jsx("button", { onClick: () => setShowAIBot(false), className: "text-gray-400 hover:text-gray-600", children: "\u00D7" })] }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(AISurveyBot, { surveyData: selectedSurvey ? {
                                    id: selectedSurvey.id,
                                    title: selectedSurvey.title,
                                    questions: selectedSurvey.blocks.flatMap(b => b.questions),
                                    responses: []
                                } : undefined, onSuggestionApply: (suggestion) => {
                                    console.log('Applying AI suggestion:', suggestion);
                                    setShowAIBot(false);
                                } }) })] }) }))] }));
};
export default DEISurveyPlatform;
