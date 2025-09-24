import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Filter,
  Search
} from 'lucide-react';
import clientPortalService from '../../services/clientPortalService';
import type { AssignedSurvey } from '../../types/clientPortal';

const ClientSurveysPage = () => {
  const [surveys, setSurveys] = useState<AssignedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'not-started' | 'in-progress' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadSurveys = async () => {
      try {
        const data = await clientPortalService.getAssignedSurveys();
        setSurveys(data);
      } catch (error) {
        console.error('Error loading surveys:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSurveys();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in-progress': return <Clock className="h-5 w-5 text-blue-500" />;
      case 'not-started': return <AlertCircle className="h-5 w-5 text-gray-400" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'not-started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLevel = (dueDate?: string) => {
    if (!dueDate) return 'low';
    
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 3) return 'urgent';
    if (daysUntilDue <= 7) return 'high';
    return 'medium';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'overdue': return 'border-red-500 bg-red-50';
      case 'urgent': return 'border-orange-500 bg-orange-50';
      case 'high': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const filteredSurveys = surveys
    .filter(survey => {
      if (filter !== 'all' && survey.status !== filter) return false;
      if (searchTerm && !survey.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !survey.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by priority (overdue first, then by due date)
      const aPriority = getPriorityLevel(a.dueDate);
      const bPriority = getPriorityLevel(b.dueDate);
      
      if (aPriority === 'overdue' && bPriority !== 'overdue') return -1;
      if (bPriority === 'overdue' && aPriority !== 'overdue') return 1;
      if (aPriority === 'urgent' && bPriority !== 'urgent') return -1;
      if (bPriority === 'urgent' && aPriority !== 'urgent') return 1;
      
      // Then sort by due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      
      // Finally sort by assigned date
      return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading surveys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <BarChart3 className="h-8 w-8 mr-3 text-blue-500" />
                My Surveys
              </h1>
              <p className="text-gray-600 mt-1">Complete your assigned surveys and track your progress</p>
            </div>
            <Link 
              to="/client/dashboard" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-2xl font-bold text-gray-900">{surveys.length}</div>
            <div className="text-sm text-gray-600">Total Surveys</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-2xl font-bold text-blue-600">
              {surveys.filter(s => s.status === 'not-started').length}
            </div>
            <div className="text-sm text-gray-600">Not Started</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {surveys.filter(s => s.status === 'in-progress').length}
            </div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-2xl font-bold text-green-600">
              {surveys.filter(s => s.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search surveys..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Surveys</option>
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Survey Cards */}
        <div className="space-y-4">
          {filteredSurveys.map((survey) => {
            const priority = getPriorityLevel(survey.dueDate);
            return (
              <div 
                key={survey.id} 
                className={`rounded-lg shadow-sm border-2 ${getPriorityColor(priority)} hover:shadow-md transition-shadow duration-200`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(survey.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{survey.title}</h3>
                          <div className="flex items-center space-x-2">
                            {priority === 'overdue' && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                Overdue
                              </span>
                            )}
                            {priority === 'urgent' && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                                Due Soon
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(survey.status)}`}>
                              {survey.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-600 mb-3">{survey.description}</p>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-500 mb-4">
                          <div className="flex items-center">
                            <BarChart3 className="h-4 w-4 mr-1" />
                            {survey.totalQuestions} questions
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            Assigned {new Date(survey.assignedAt).toLocaleDateString()}
                          </div>
                          {survey.dueDate && (
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              Due {new Date(survey.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {survey.status === 'in-progress' && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                              <span>Progress</span>
                              <span>
                                {survey.answeredQuestions}/{survey.totalQuestions} questions completed
                              </span>
                            </div>
                            <div className="bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 rounded-full h-2" 
                                style={{ width: `${survey.progress || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {survey.status === 'completed' && survey.completedAt && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                            <div className="flex items-center">
                              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                              <span className="text-sm text-green-800">
                                Completed on {new Date(survey.completedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {survey.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {survey.status === 'completed' && (
                        <Link 
                          to={`/client/surveys/${survey.id}/results`}
                          className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center"
                        >
                          View Results
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      )}
                      <Link 
                        to={`/client/surveys/${survey.id}`}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium text-sm flex items-center"
                      >
                        {survey.status === 'not-started' ? 'Start Survey' : 
                         survey.status === 'in-progress' ? 'Continue' : 'Review'}
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredSurveys.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys found</h3>
            <p className="text-gray-600">
              {searchTerm || filter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'You don\'t have any surveys assigned yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientSurveysPage;