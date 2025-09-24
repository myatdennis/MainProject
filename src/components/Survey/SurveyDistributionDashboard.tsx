import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Eye, 
  MousePointer,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { getDistributionTracking, getCompletionStatus } from '../../services/surveyService';
import type { SurveyDistribution, SurveyCompletionStatus } from '../../services/surveyService';

interface SurveyDistributionDashboardProps {
  surveyId: string;
  surveyTitle: string;
}

const SurveyDistributionDashboard: React.FC<SurveyDistributionDashboardProps> = ({ 
  surveyId, 
  surveyTitle 
}) => {
  const [distributions, setDistributions] = useState<SurveyDistribution[]>([]);
  const [completionStatus, setCompletionStatus] = useState<SurveyCompletionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'opened' | 'completed'>('all');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [distributionData, statusData] = await Promise.all([
          getDistributionTracking(surveyId),
          getCompletionStatus(surveyId)
        ]);
        setDistributions(distributionData);
        setCompletionStatus(statusData);
      } catch (error) {
        console.error('Failed to load distribution data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [surveyId]);

  const getStatusColor = (status: SurveyDistribution['status']) => {
    switch (status) {
      case 'sent': return 'text-blue-600 bg-blue-50';
      case 'opened': return 'text-purple-600 bg-purple-50';
      case 'clicked': return 'text-orange-600 bg-orange-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: SurveyDistribution['status']) => {
    switch (status) {
      case 'sent': return <Mail className="h-4 w-4" />;
      case 'opened': return <Eye className="h-4 w-4" />;
      case 'clicked': return <MousePointer className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredDistributions = distributions.filter(d => 
    filter === 'all' || d.status === filter
  );

  const statusCounts = {
    total: distributions.length,
    pending: distributions.filter(d => d.status === 'pending').length,
    sent: distributions.filter(d => d.status === 'sent').length,
    opened: distributions.filter(d => d.status === 'opened').length,
    completed: distributions.filter(d => d.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Distribution Tracking</h2>
          <div className="text-sm text-gray-600">
            Survey: {surveyTitle}
          </div>
        </div>

        {/* Status Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-gray-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{statusCounts.total}</div>
                <div className="text-sm text-gray-600">Total Invites</div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <Mail className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-blue-900">{statusCounts.sent}</div>
                <div className="text-sm text-blue-600">Sent</div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <Eye className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold text-purple-900">{statusCounts.opened}</div>
                <div className="text-sm text-purple-600">Opened</div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <MousePointer className="h-8 w-8 text-orange-500" />
              <div>
                <div className="text-2xl font-bold text-orange-900">{statusCounts.opened}</div>
                <div className="text-sm text-orange-600">Clicked</div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-green-900">{statusCounts.completed}</div>
                <div className="text-sm text-green-600">Completed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {['all', 'pending', 'sent', 'opened', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
                filter === status
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-1 text-xs">
                  ({status === 'pending' ? statusCounts.pending : 
                    status === 'sent' ? statusCounts.sent :
                    status === 'opened' ? statusCounts.opened : 
                    statusCounts.completed})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Distribution List */}
        <div className="space-y-3">
          {filteredDistributions.map((distribution) => (
            <div 
              key={distribution.id} 
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-lg ${getStatusColor(distribution.status)}`}>
                  {getStatusIcon(distribution.status)}
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {distribution.recipient_type} - {distribution.recipient_id}
                  </div>
                  <div className="text-sm text-gray-600">
                    {distribution.sent_at && (
                      <span>Sent: {new Date(distribution.sent_at).toLocaleDateString()}</span>
                    )}
                    {distribution.reminder_count > 0 && (
                      <span className="ml-3 text-orange-600">
                        {distribution.reminder_count} reminder{distribution.reminder_count > 1 ? 's' : ''} sent
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(distribution.status)}`}>
                  {distribution.status}
                </div>
                {distribution.completed_at && (
                  <div className="text-xs text-gray-500 mt-1">
                    Completed: {new Date(distribution.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredDistributions.length === 0 && (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No distributions found</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'No survey invitations have been sent yet.'
                : `No distributions with status "${filter}" found.`}
            </p>
          </div>
        )}
      </div>

      {/* Completion Rate Analytics */}
      {completionStatus && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Completion Analytics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">By Organization</h4>
              <div className="space-y-2">
                {Object.entries(completionStatus.by_organization).map(([orgId, data]) => (
                  <div key={orgId} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Org {orgId}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{data.rate}%</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 rounded-full transition-all duration-300"
                          style={{ width: `${data.rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">By Department</h4>
              <div className="space-y-2">
                {Object.entries(completionStatus.by_department).map(([dept, data]) => (
                  <div key={dept} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{dept}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{data.rate}%</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${data.rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">By User Type</h4>
              <div className="space-y-2">
                {Object.entries(completionStatus.by_user_type).map(([userType, data]) => (
                  <div key={userType} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{userType.replace('_', ' ')}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{data.rate}%</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full transition-all duration-300"
                          style={{ width: `${data.rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyDistributionDashboard;