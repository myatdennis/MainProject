import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter,
  BarChart3,
  Users,
  Eye,
  Edit,
  Copy,
  Play,
  Pause,
  Archive,
  Upload,
  CheckCircle,
  Clock,
  
  Target,
  TrendingUp,
  MessageSquare,
  Brain
} from 'lucide-react';

const AdminSurveys = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selectedSurveys, setSelectedSurveys] = useState<string[]>([]);

  const [surveys, setSurveys] = useState<any[]>([
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
  const [assignTargetSurveyId, setAssignTargetSurveyId] = useState<string | null>(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);

  const openAssignModal = (surveyId: string) => {
    const survey = surveys.find(s => s.id === surveyId);
    setAssignTargetSurveyId(surveyId);
    setSelectedOrgIds(survey?.assignedOrgIds ?? []);
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setAssignTargetSurveyId(null);
    setSelectedOrgIds([]);
  };

  const toggleSelectOrg = (orgId: string) => {
    setSelectedOrgIds(prev => prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]);
  };

  const saveAssignment = () => {
    if (!assignTargetSurveyId) return;
    // Optimistic update locally
    setSurveys(prev => prev.map(s => s.id === assignTargetSurveyId ? {
      ...s,
      assignedOrgIds: selectedOrgIds,
      assignedOrgs: organizations.filter(o => selectedOrgIds.includes(o.id)).map(o => o.name)
    } : s));

    // Persist to Supabase (table: survey_assignments)
    (async () => {
      try {
        const payload = {
          survey_id: assignTargetSurveyId,
          organization_ids: selectedOrgIds,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('survey_assignments').upsert(payload).select();
        if (error) {
          console.warn('Failed to save assignment to Supabase:', error.message || error);
        } else {
          console.log('Saved survey assignment to Supabase:', data);
        }
      } catch (err) {
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

  const getStatusColor = (status: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'draft':
        return <Edit className="h-4 w-4 text-gray-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'archived':
        return <Archive className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
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

  const handleSelectSurvey = (surveyId: string) => {
    setSelectedSurveys(prev => 
      prev.includes(surveyId) 
        ? prev.filter(id => id !== surveyId)
        : [...prev, surveyId]
    );
  };

  // removed handleSelectAll (not used)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">DEI Survey Platform</h1>
        <p className="text-gray-600">Create, manage, and analyze DEI surveys with advanced analytics and insights</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Surveys</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {surveys.filter(s => s.status === 'active').length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <Target className="h-6 w-6 text-green-500" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Responses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {surveys.reduce((acc, s) => acc + s.totalResponses, 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Completion</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Math.round(surveys.filter(s => s.totalInvites > 0).reduce((acc, s) => acc + s.completionRate, 0) / surveys.filter(s => s.totalInvites > 0).length) || 0}%
              </p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50">
              <TrendingUp className="h-6 w-6 text-orange-500" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Organizations</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Set(surveys.flatMap(s => s.assignedOrgs)).size}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50">
              <Users className="h-6 w-6 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search surveys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="climate-assessment">Climate Assessment</option>
                <option value="inclusion-index">Inclusion Index</option>
                <option value="equity-lens">Equity Lens</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedSurveys.length > 0 && (
              <div className="flex items-center space-x-2">
                <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200">
                  Bulk Actions ({selectedSurveys.length})
                </button>
              </div>
            )}
            <button className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors duration-200 flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>AI Survey Creator</span>
            </button>
            <Link
              to="/admin/surveys/builder"
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Survey</span>
            </Link>
            <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
          </div>
        </div>
      </div>

      {/* Surveys Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {filteredSurveys.map((survey) => (
          <div key={survey.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-bold text-lg text-gray-900">{survey.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(survey.status)}`}>
                      {survey.status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{survey.description}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(survey.type)}`}>
                    {survey.type.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(survey.status)}
                  <input
                    type="checkbox"
                    checked={selectedSurveys.includes(survey.id)}
                    onChange={() => handleSelectSurvey(survey.id)}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                </div>
              </div>

              {survey.status !== 'draft' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{survey.totalResponses}</div>
                    <div className="text-xs text-gray-600">Responses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{survey.completionRate}%</div>
                    <div className="text-xs text-gray-600">Completion</div>
                  </div>
                </div>
              )}

              {survey.status === 'active' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Progress</span>
                    <span className="text-sm font-medium text-gray-900">{survey.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                      style={{ width: `${survey.completionRate}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {survey.assignedOrgs.length === 0 && (
                <div className="mb-4">
                  <span className="text-xs text-red-500 italic">Not assigned</span>
                </div>
              )}

              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">Assigned Organizations:</div>
                <div className="flex flex-wrap gap-1">
                  {survey.assignedOrgs.length > 0 ? (
                    survey.assignedOrgs.slice(0, 2).map((org: string, index: number) => (
                      <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                        {org}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500 italic">No assignments</span>
                  )}
                  {survey.assignedOrgs.length > 2 && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                      +{survey.assignedOrgs.length - 2} more
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {survey.status === 'draft' ? 'Created' : 'Last activity'}: {new Date(survey.lastActivity).toLocaleDateString()}
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg" 
                    title="AI Insights"
                  >
                    <Brain className="h-4 w-4" />
                  </button>
                  <Link 
                    to={`/admin/surveys/${survey.id}/analytics`}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg" 
                    title="View Analytics"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => openAssignModal(survey.id)}
                    className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg"
                    title="Assign to Organizations"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                  <Link
                    to={`/admin/surveys/${survey.id}/preview`}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
                    title="Preview Survey"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/admin/surveys/builder/${survey.id}`}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
                    title="Edit Survey"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredSurveys.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys found</h3>
          <p className="text-gray-600 mb-6">Try adjusting your search or filter criteria, or create a new survey.</p>
          <Link
            to="/admin/surveys/builder"
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 inline-flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Create Your First Survey</span>
          </Link>
        </div>
      )}

      {/* Survey Templates Section */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Start with a Template</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Choose from our research-backed DEI survey templates designed by experts in organizational psychology and inclusive leadership.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Climate Assessment</h3>
            <p className="text-gray-600 text-sm mb-4">Comprehensive workplace culture and belonging assessment</p>
            <Link
              to="/admin/surveys/builder?template=climate-assessment"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Use Template →
            </Link>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Inclusion Index</h3>
            <p className="text-gray-600 text-sm mb-4">Measure inclusion across key dimensions with benchmarking</p>
            <Link
              to="/admin/surveys/builder?template=inclusion-index"
              className="text-green-600 hover:text-green-700 font-medium text-sm"
            >
              Use Template →
            </Link>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Equity Lens</h3>
            <p className="text-gray-600 text-sm mb-4">Evaluate organizational practices through an equity framework</p>
            <Link
              to="/admin/surveys/builder?template=equity-lens"
              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
            >
              Use Template →
            </Link>
          </div>
        </div>
      </div>
      {/* Assign-to-Organization Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-30" onClick={closeAssignModal}></div>
          <div className="bg-white rounded-xl shadow-2xl z-50 w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Assign Survey to Organizations</h3>
              <button onClick={closeAssignModal} className="text-gray-500 hover:text-gray-800">Close</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Select which organizations should receive this survey. Assignments can be changed later.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-h-64 overflow-y-auto">
              {organizations.map(org => (
                <label key={org.id} className={`flex items-center space-x-3 p-3 rounded-lg border ${selectedOrgIds.includes(org.id) ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white'}`}>
                  <input type="checkbox" checked={selectedOrgIds.includes(org.id)} onChange={() => toggleSelectOrg(org.id)} className="h-4 w-4 text-orange-500" />
                  <div>
                    <div className="font-medium text-gray-900">{org.name}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button onClick={closeAssignModal} className="border border-gray-300 px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={saveAssignment} className="bg-orange-500 text-white px-4 py-2 rounded-lg">Save Assignment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSurveys;

// Assign Modal (rendered via state inside the component)