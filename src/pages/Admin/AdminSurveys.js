import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { getSupabase, hasSupabaseConfig } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, BarChart3, Users, Eye, Edit, Copy, Play, Pause, Archive, Upload, CheckCircle, Clock, Target, TrendingUp, MessageSquare, Brain } from 'lucide-react';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
const AdminSurveys = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [selectedSurveys, setSelectedSurveys] = useState([]);
    const [surveys, setSurveys] = useState([
        {
            id: 'climate-2025-q1',
            title: 'Q1 2025 Climate Assessment',
            description: 'Quarterly organizational climate and culture assessment',
            type: 'climate-assessment',
            status: 'active',
            createdAt: '2025-03-01',
            launchedAt: '2025-03-05',
            closedAt: null,
            totalInvites: 247,
            totalResponses: 189,
            completionRate: 77,
            avgCompletionTime: 12,
            assignedOrgs: ['Pacific Coast University', 'Regional Fire Department', 'TechForward Solutions'],
            assignedOrgIds: ['1', '4', '5'],
            lastActivity: '2025-03-11'
        },
        {
            id: 'inclusion-index-2025',
            title: 'Annual Inclusion Index',
            description: 'Comprehensive inclusion measurement with benchmarking',
            type: 'inclusion-index',
            status: 'draft',
            createdAt: '2025-02-28',
            launchedAt: null,
            closedAt: null,
            totalInvites: 0,
            totalResponses: 0,
            completionRate: 0,
            avgCompletionTime: 0,
            assignedOrgs: [],
            assignedOrgIds: [],
            lastActivity: '2025-03-10'
        },
        {
            id: 'equity-lens-pilot',
            title: 'Equity Lens Pilot Study',
            description: 'Pilot assessment of equity in organizational practices',
            type: 'equity-lens',
            status: 'completed',
            createdAt: '2025-01-15',
            launchedAt: '2025-01-20',
            closedAt: '2025-02-20',
            totalInvites: 156,
            totalResponses: 142,
            completionRate: 91,
            avgCompletionTime: 15,
            assignedOrgs: ['Community Impact Network', 'Mountain View High School'],
            assignedOrgIds: ['3', '2'],
            lastActivity: '2025-02-20'
        },
        {
            id: 'leadership-360',
            title: 'Leadership 360 Assessment',
            description: 'Multi-rater feedback for inclusive leadership development',
            type: 'custom',
            status: 'paused',
            createdAt: '2025-02-10',
            launchedAt: '2025-02-15',
            closedAt: null,
            totalInvites: 89,
            totalResponses: 34,
            completionRate: 38,
            avgCompletionTime: 18,
            assignedOrgs: ['Pacific Coast University'],
            assignedOrgIds: ['1'],
            lastActivity: '2025-03-08'
        }
    ]);
    // Organizations (same sample set used across admin pages)
    const organizations = [
        { id: '1', name: 'Pacific Coast University' },
        { id: '2', name: 'Mountain View High School' },
        { id: '3', name: 'Community Impact Network' },
        { id: '4', name: 'Regional Fire Department' },
        { id: '5', name: 'TechForward Solutions' },
        { id: '6', name: 'Regional Medical Center' },
        { id: '7', name: 'Unity Community Church' }
    ];
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTargetSurveyId, setAssignTargetSurveyId] = useState(null);
    const [selectedOrgIds, setSelectedOrgIds] = useState([]);
    const openAssignModal = (surveyId) => {
        const survey = surveys.find(s => s.id === surveyId);
        setAssignTargetSurveyId(surveyId);
        setSelectedOrgIds(survey?.assignedOrgIds ?? []);
        setShowAssignModal(true);
    };
    const navigate = useNavigate();
    const handleBulkActions = () => {
        if (selectedSurveys.length === 0) {
            alert('Select at least one survey to perform bulk actions');
            return;
        }
        navigate(`/admin/surveys/bulk?ids=${selectedSurveys.join(',')}`);
    };
    const handleAICreator = () => {
        navigate('/admin/surveys/builder?ai=1');
    };
    const handleImport = () => {
        navigate('/admin/surveys/import');
    };
    const handleQueue = () => {
        navigate('/admin/surveys/queue');
    };
    const duplicateSurvey = (surveyId) => {
        const s = surveys.find(s => s.id === surveyId);
        if (!s)
            return;
        const copy = { ...s, id: `${s.id}-copy-${Date.now()}`, title: `Copy of ${s.title}`, createdAt: new Date().toISOString(), lastActivity: new Date().toISOString() };
        setSurveys(prev => [copy, ...prev]);
        // Navigate to builder for the new copy
        navigate(`/admin/surveys/builder/${copy.id}`);
    };
    const closeAssignModal = () => {
        setShowAssignModal(false);
        setAssignTargetSurveyId(null);
        setSelectedOrgIds([]);
    };
    const toggleSelectOrg = (orgId) => {
        setSelectedOrgIds(prev => prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]);
    };
    const saveAssignment = () => {
        if (!assignTargetSurveyId)
            return;
        // Optimistic update locally
        setSurveys(prev => prev.map(s => s.id === assignTargetSurveyId ? {
            ...s,
            assignedOrgIds: selectedOrgIds,
            assignedOrgs: organizations.filter(o => selectedOrgIds.includes(o.id)).map(o => o.name)
        } : s));
        // Persist to Supabase (table: survey_assignments) if configured
        (async () => {
            try {
                if (!hasSupabaseConfig)
                    return;
                const supabase = await getSupabase();
                if (!supabase)
                    return;
                const payload = {
                    survey_id: assignTargetSurveyId,
                    organization_ids: selectedOrgIds,
                    updated_at: new Date().toISOString()
                };
                const { data, error } = await supabase.from('survey_assignments').upsert(payload).select();
                if (error) {
                    console.warn('Failed to save assignment to Supabase:', error.message || error);
                }
                else {
                    console.log('Saved survey assignment to Supabase:', data);
                }
            }
            catch (err) {
                console.warn('Supabase error saving assignment:', err);
            }
        })();
        closeAssignModal();
    };
    const filteredSurveys = surveys.filter(survey => {
        const matchesSearch = survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            survey.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || survey.status === filterStatus;
        const matchesType = filterType === 'all' || survey.type === filterType;
        return matchesSearch && matchesStatus && matchesType;
    });
    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-gray-100 text-gray-800';
            case 'paused':
                return 'bg-yellow-100 text-yellow-800';
            case 'completed':
                return 'bg-blue-100 text-blue-800';
            case 'archived':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'active':
                return _jsx(Play, { className: "h-4 w-4 text-green-500" });
            case 'draft':
                return _jsx(Edit, { className: "h-4 w-4 text-gray-500" });
            case 'paused':
                return _jsx(Pause, { className: "h-4 w-4 text-yellow-500" });
            case 'completed':
                return _jsx(CheckCircle, { className: "h-4 w-4 text-blue-500" });
            case 'archived':
                return _jsx(Archive, { className: "h-4 w-4 text-purple-500" });
            default:
                return _jsx(Clock, { className: "h-4 w-4 text-gray-500" });
        }
    };
    const getTypeColor = (type) => {
        switch (type) {
            case 'climate-assessment':
                return 'bg-blue-100 text-blue-800';
            case 'inclusion-index':
                return 'bg-green-100 text-green-800';
            case 'equity-lens':
                return 'bg-orange-100 text-orange-800';
            case 'custom':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    const handleSelectSurvey = (surveyId) => {
        setSelectedSurveys(prev => prev.includes(surveyId)
            ? prev.filter(id => id !== surveyId)
            : [...prev, surveyId]);
    };
    // removed handleSelectAll (not used)
    return (_jsxs("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [_jsx("div", { className: "mb-6", children: _jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Surveys', to: '/admin/surveys' }] }) }), _jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "DEI Survey Platform" }), _jsx("p", { className: "text-gray-600", children: "Create, manage, and analyze DEI surveys with advanced analytics and insights" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-8", children: [_jsx("div", { className: "card-lg", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Active Surveys" }), _jsx("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: surveys.filter(s => s.status === 'active').length })] }), _jsx("div", { className: "p-3 rounded-lg bg-green-50", children: _jsx(Target, { className: "h-6 w-6 text-green-500" }) })] }) }), _jsx("div", { className: "card-lg", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Total Responses" }), _jsx("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: surveys.reduce((acc, s) => acc + s.totalResponses, 0) })] }), _jsx("div", { className: "p-3 rounded-lg bg-blue-50", children: _jsx(MessageSquare, { className: "h-6 w-6 text-blue-500" }) })] }) }), _jsx("div", { className: "card-lg", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Avg. Completion" }), _jsxs("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: [Math.round(surveys.filter(s => s.totalInvites > 0).reduce((acc, s) => acc + s.completionRate, 0) / surveys.filter(s => s.totalInvites > 0).length) || 0, "%"] })] }), _jsx("div", { className: "p-3 rounded-lg bg-orange-50", children: _jsx(TrendingUp, { className: "h-6 w-6 text-orange-500" }) })] }) }), _jsx("div", { className: "card-lg", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Organizations" }), _jsx("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: new Set(surveys.flatMap(s => s.assignedOrgs)).size })] }), _jsx("div", { className: "p-3 rounded-lg bg-purple-50", children: _jsx(Users, { className: "h-6 w-6 text-purple-500" }) })] }) })] }), _jsx("div", { className: "card-lg card-hover mb-8", children: _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [_jsxs("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1", children: [_jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search surveys...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Filter, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "draft", children: "Draft" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "paused", children: "Paused" }), _jsx("option", { value: "completed", children: "Completed" }), _jsx("option", { value: "archived", children: "Archived" })] }), _jsxs("select", { value: filterType, onChange: (e) => setFilterType(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Types" }), _jsx("option", { value: "climate-assessment", children: "Climate Assessment" }), _jsx("option", { value: "inclusion-index", children: "Inclusion Index" }), _jsx("option", { value: "equity-lens", children: "Equity Lens" }), _jsx("option", { value: "custom", children: "Custom" })] })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [selectedSurveys.length > 0 && (_jsx("div", { className: "flex items-center space-x-2", children: _jsxs("button", { onClick: handleBulkActions, className: "btn-outline", children: ["Bulk Actions (", selectedSurveys.length, ")"] }) })), _jsxs("button", { onClick: handleAICreator, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Brain, { className: "h-4 w-4" }), _jsx("span", { children: "AI Survey Creator" })] }), _jsxs(Link, { to: "/admin/surveys/builder", className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Plus, { className: "h-4 w-4" }), _jsx("span", { children: "Create Survey" })] }), _jsxs("button", { onClick: handleImport, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Upload, { className: "h-4 w-4" }), _jsx("span", { children: "Import" })] }), _jsxs("button", { onClick: handleQueue, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Clock, { className: "h-4 w-4" }), _jsx("span", { children: "Queue" })] })] })] }) }), _jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8", children: filteredSurveys.map((survey) => (_jsx("div", { className: "card-lg card-hover overflow-hidden", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx("h3", { className: "font-bold text-lg text-gray-900", children: survey.title }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(survey.status)}`, children: survey.status })] }), _jsx("p", { className: "text-gray-600 text-sm mb-3", children: survey.description }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(survey.type)}`, children: survey.type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [getStatusIcon(survey.status), _jsx("input", { type: "checkbox", checked: selectedSurveys.includes(survey.id), onChange: () => handleSelectSurvey(survey.id), className: "h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]" })] })] }), survey.status !== 'draft' && (_jsxs("div", { className: "grid grid-cols-2 gap-4 mb-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-xl font-bold text-blue-600", children: survey.totalResponses }), _jsx("div", { className: "text-xs text-gray-600", children: "Responses" })] }), _jsxs("div", { className: "text-center", children: [_jsxs("div", { className: "text-xl font-bold text-green-600", children: [survey.completionRate, "%"] }), _jsx("div", { className: "text-xs text-gray-600", children: "Completion" })] })] })), survey.status === 'active' && (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Progress" }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [survey.completionRate, "%"] })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full", style: { width: `${survey.completionRate}%`, background: 'var(--gradient-blue-green)' } }) })] })), survey.assignedOrgs.length === 0 && (_jsx("div", { className: "mb-4", children: _jsx("span", { className: "text-xs text-red-500 italic", children: "Not assigned" }) })), _jsxs("div", { className: "mb-4", children: [_jsx("div", { className: "text-sm text-gray-600 mb-2", children: "Assigned Organizations:" }), _jsxs("div", { className: "flex flex-wrap gap-1", children: [survey.assignedOrgs.length > 0 ? (survey.assignedOrgs.slice(0, 2).map((org, index) => (_jsx("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: org }, index)))) : (_jsx("span", { className: "text-xs text-gray-500 italic", children: "No assignments" })), survey.assignedOrgs.length > 2 && (_jsxs("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: ["+", survey.assignedOrgs.length - 2, " more"] }))] })] }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "text-sm text-gray-600", children: [survey.status === 'draft' ? 'Created' : 'Last activity', ": ", new Date(survey.lastActivity).toLocaleDateString()] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { className: "p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg", title: "AI Insights", children: _jsx(Brain, { className: "h-4 w-4" }) }), _jsx(Link, { to: `/admin/surveys/${survey.id}/analytics`, className: "p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg", title: "View Analytics", children: _jsx(BarChart3, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => openAssignModal(survey.id), className: "p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg", title: "Assign to Organizations", children: _jsx(Users, { className: "h-4 w-4" }) }), _jsx(Link, { to: `/admin/surveys/${survey.id}/preview`, className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Preview Survey", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx(Link, { to: `/admin/surveys/builder/${survey.id}`, className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Edit Survey", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => duplicateSurvey(survey.id), className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Duplicate", children: _jsx(Copy, { className: "h-4 w-4" }) })] })] })] }) }, survey.id))) }), filteredSurveys.length === 0 && (_jsx("div", { className: "mb-8", children: _jsx(EmptyState, { title: "No surveys found", description: searchTerm || filterStatus !== 'all' || filterType !== 'all' ? 'Try adjusting your search or filters to find surveys.' : 'Create your first survey to get started.', action: searchTerm || filterStatus !== 'all' || filterType !== 'all' ? (_jsx("button", { className: "btn-outline", onClick: () => { setSearchTerm(''); setFilterStatus('all'); setFilterType('all'); }, children: "Reset filters" })) : (_jsx(Link, { to: "/admin/surveys/builder", className: "btn-cta", children: "Create Your First Survey" })) }) })), _jsxs("div", { className: "rounded-xl p-8", style: { background: 'var(--gradient-banner)' }, children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Start with a Template" }), _jsx("p", { className: "text-gray-600 max-w-2xl mx-auto", children: "Choose from our research-backed DEI survey templates designed by experts in organizational psychology and inclusive leadership." })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "card-lg hover:shadow-md transition-shadow duration-200", children: [_jsx("div", { className: "bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4", children: _jsx(BarChart3, { className: "h-6 w-6 text-blue-600" }) }), _jsx("h3", { className: "font-bold text-gray-900 mb-2", children: "Climate Assessment" }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "Comprehensive workplace culture and belonging assessment" }), _jsx(Link, { to: "/admin/surveys/builder?template=climate-assessment", className: "text-blue-600 hover:text-blue-700 font-medium text-sm", children: "Use Template \u2192" })] }), _jsxs("div", { className: "card-lg hover:shadow-md transition-shadow duration-200", children: [_jsx("div", { className: "bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4", children: _jsx(Target, { className: "h-6 w-6 text-green-600" }) }), _jsx("h3", { className: "font-bold text-gray-900 mb-2", children: "Inclusion Index" }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "Measure inclusion across key dimensions with benchmarking" }), _jsx(Link, { to: "/admin/surveys/builder?template=inclusion-index", className: "text-green-600 hover:text-green-700 font-medium text-sm", children: "Use Template \u2192" })] }), _jsxs("div", { className: "card-lg hover:shadow-md transition-shadow duration-200", children: [_jsx("div", { className: "bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4", children: _jsx(CheckCircle, { className: "h-6 w-6 text-orange-600" }) }), _jsx("h3", { className: "font-bold text-gray-900 mb-2", children: "Equity Lens" }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "Evaluate organizational practices through an equity framework" }), _jsx(Link, { to: "/admin/surveys/builder?template=equity-lens", className: "text-orange-600 hover:text-orange-700 font-medium text-sm", children: "Use Template \u2192" })] })] })] }), showAssignModal && (_jsxs("div", { className: "fixed inset-0 flex items-center justify-center z-50", children: [_jsx("div", { className: "absolute inset-0 bg-black opacity-30", onClick: closeAssignModal }), _jsxs("div", { className: "bg-white rounded-xl shadow-2xl z-50 w-full max-w-2xl p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-bold", children: "Assign Survey to Organizations" }), _jsx("button", { onClick: closeAssignModal, className: "text-gray-500 hover:text-gray-800", children: "Close" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Select which organizations should receive this survey. Assignments can be changed later." }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-h-64 overflow-y-auto", children: organizations.map(org => (_jsxs("label", { className: `flex items-center space-x-3 p-3 rounded-lg border ${selectedOrgIds.includes(org.id) ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white'}`, children: [_jsx("input", { type: "checkbox", checked: selectedOrgIds.includes(org.id), onChange: () => toggleSelectOrg(org.id), className: "h-4 w-4 text-orange-500" }), _jsx("div", { children: _jsx("div", { className: "font-medium text-gray-900", children: org.name }) })] }, org.id))) }), _jsxs("div", { className: "flex items-center justify-end space-x-3", children: [_jsx("button", { onClick: closeAssignModal, className: "btn-outline", children: "Cancel" }), _jsx("button", { onClick: saveAssignment, className: "btn-cta", children: "Save Assignment" })] })] })] }))] }));
};
export default AdminSurveys;
