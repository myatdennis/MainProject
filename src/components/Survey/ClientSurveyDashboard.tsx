import React, { useState, useEffect } from 'react';
import { 
  BookOpen,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  BarChart3,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ClientSurvey {
  id: string;
  title: string;
  description: string;
  type: 'climate-assessment' | 'inclusion-index' | 'equity-lens' | 'custom';
  status: 'not-started' | 'in-progress' | 'completed';
  dueDate?: string;
  progress?: number;
  estimatedTime: string;
  organizationName: string;
}

interface ClientSurveyDashboardProps {
  organizationId: string;
}

const ClientSurveyDashboard: React.FC<ClientSurveyDashboardProps> = ({ organizationId }) => {
  const [surveys, setSurveys] = useState<ClientSurvey[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    const loadSurveys = async () => {
      setLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock survey data for the organization
      const mockSurveys: ClientSurvey[] = [
        {
          id: 'climate-2025-q1',
          title: 'Q1 2025 Climate Assessment',
          description: 'Quarterly organizational climate and culture assessment to understand your team dynamics and workplace satisfaction.',
          type: 'climate-assessment',
          status: 'in-progress',
          progress: 65,
          dueDate: '2025-03-15',
          estimatedTime: '15-20 minutes',
          organizationName: 'Pacific Coast University'
        },
        {
          id: 'inclusion-index-2025',
          title: 'Annual Inclusion Index',
          description: 'Comprehensive inclusion measurement with benchmarking against industry standards.',
          type: 'inclusion-index', 
          status: 'not-started',
          dueDate: '2025-03-30',
          estimatedTime: '20-25 minutes',
          organizationName: 'Pacific Coast University'
        },
        {
          id: 'leadership-360',
          title: 'Leadership Development Survey',
          description: 'Multi-rater feedback for inclusive leadership development and growth.',
          type: 'custom',
          status: 'completed',
          progress: 100,
          estimatedTime: '18 minutes',
          organizationName: 'Pacific Coast University'
        }
      ];
      
      setSurveys(mockSurveys);
      setLoading(false);
    };

    loadSurveys();
  }, [organizationId]);

  const getStatusColor = (status: ClientSurvey['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in-progress': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'not-started': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: ClientSurvey['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5" />;
      case 'in-progress': return <Clock className="h-5 w-5" />;
      case 'not-started': return <Play className="h-5 w-5" />;
      default: return <BookOpen className="h-5 w-5" />;
    }
  };

  const getTypeIcon = (type: ClientSurvey['type']) => {
    switch (type) {
      case 'climate-assessment': return <BarChart3 className="h-6 w-6 text-blue-500" />;
      case 'inclusion-index': return <Users className="h-6 w-6 text-green-500" />;
      case 'equity-lens': return <TrendingUp className="h-6 w-6 text-orange-500" />;
      default: return <BookOpen className="h-6 w-6 text-purple-500" />;
    }
  };

  const getActionButton = (survey: ClientSurvey) => {
    switch (survey.status) {
      case 'completed':
        return (
          <Link
            to={`/survey/${survey.id}/results`}
            className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200"
          >
            View Results
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        );
      case 'in-progress':
        return (
          <Link
            to={`/survey/${survey.id}/continue`}
            className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-200"
          >
            Continue Survey
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        );
      case 'not-started':
        return (
          <Link
            to={`/survey/${survey.id}/start`}
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
          >
            Start Survey
            <Play className="ml-2 h-4 w-4" />
          </Link>
        );
      default:
        return null;
    }
  };

  const isDueSoon = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    const diffInDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays <= 7 && diffInDays > 0;
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    return due < now;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey Dashboard</h1>
          <p className="text-gray-600">Complete your assigned surveys and track your progress</p>
        </div>
      </div>

      {/* Survey Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Surveys</p>
              <p className="text-2xl font-bold text-gray-900">{surveys.length}</p>
            </div>
            <BookOpen className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {surveys.filter(s => s.status === 'completed').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-orange-600">
                {surveys.filter(s => s.status === 'in-progress').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-600">
                {surveys.filter(s => s.status === 'not-started').length}
              </p>
            </div>
            <Play className="h-8 w-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Survey Cards */}
      <div className="space-y-4">
        {surveys.map((survey) => (
          <div key={survey.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {getTypeIcon(survey.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{survey.title}</h3>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${getStatusColor(survey.status)}`}>
                      {getStatusIcon(survey.status)}
                      <span className="ml-1">
                        {survey.status === 'not-started' ? 'Not Started' : 
                         survey.status === 'in-progress' ? 'In Progress' : 'Completed'}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4">{survey.description}</p>
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{survey.estimatedTime}</span>
                    </div>
                    
                    {survey.dueDate && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span className={`${isOverdue(survey.dueDate) ? 'text-red-600 font-medium' : isDueSoon(survey.dueDate) ? 'text-orange-600 font-medium' : ''}`}>
                          Due: {new Date(survey.dueDate).toLocaleDateString()}
                        </span>
                        {isDueSoon(survey.dueDate) && !isOverdue(survey.dueDate) && (
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        )}
                        {isOverdue(survey.dueDate) && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  
                  {survey.status === 'in-progress' && survey.progress !== undefined && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium text-gray-900">{survey.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${survey.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex-shrink-0">
                {getActionButton(survey)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {surveys.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys assigned</h3>
          <p className="text-gray-600">
            You don't have any surveys assigned to you at the moment. Check back later or contact your administrator.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClientSurveyDashboard;