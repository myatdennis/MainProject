import React, { useState } from 'react';
import { BarChart3, Users, Zap, Brain, Smartphone, Plus, FileCheck } from 'lucide-react';
import RealTimeDashboard from '../../components/Admin/RealTimeDashboard';
import BulkOperationsCenter from '../../components/Admin/BulkOperationsCenter';
import LearningAnalyticsEngine from '../../components/Admin/LearningAnalyticsEngine';
import AIContentAssistant from '../../components/Admin/AIContentAssistant';
import MobileAdminApp from '../../components/Admin/MobileAdminApp';
import DEISurveyPlatform from '../../components/Survey/DEISurveyPlatform';

type FeatureTab = 'overview' | 'realtime' | 'bulk-ops' | 'analytics' | 'ai-content' | 'mobile' | 'surveys';

const EnhancedAdminPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FeatureTab>('overview');

  const features = [
    {
      id: 'overview' as FeatureTab,
      name: 'Overview',
      icon: Plus,
      description: 'Main dashboard overview'
    },
    {
      id: 'realtime' as FeatureTab,
      name: 'Real-Time Analytics',
      icon: BarChart3,
      description: 'Live metrics and activity monitoring'
    },
    {
      id: 'bulk-ops' as FeatureTab,
      name: 'Bulk Operations',
      icon: Users,
      description: 'Mass user management and operations'
    },
    {
      id: 'analytics' as FeatureTab,
      name: 'Learning Analytics',
      icon: Zap,
      description: 'Advanced learning insights and predictions'
    },
    {
      id: 'ai-content' as FeatureTab,
      name: 'AI Content Assistant',
      icon: Brain,
      description: 'AI-powered content creation and analysis'
    },
    {
      id: 'mobile' as FeatureTab,
      name: 'Mobile Admin',
      icon: Smartphone,
      description: 'Mobile app configuration and features'
    },
    {
      id: 'surveys' as FeatureTab,
      name: 'DEI Surveys',
      icon: FileCheck,
      description: 'Diversity, equity, and inclusion survey platform'
    }
  ];

  const quickStats = [
    { label: 'Total Users', value: '2,847', change: '+12%', changeType: 'positive' },
    { label: 'Active Courses', value: '64', change: '+3', changeType: 'positive' },
    { label: 'Completion Rate', value: '87%', change: '+5%', changeType: 'positive' },
    { label: 'Monthly Revenue', value: '$124K', change: '+18%', changeType: 'positive' }
  ];

  const recentActivities = [
    { action: 'New user registered', user: 'Sarah Chen', time: '2 min ago' },
    { action: 'Course completed', user: 'Mike Johnson', time: '5 min ago' },
    { action: 'Certificate issued', user: 'Emma Davis', time: '8 min ago' },
    { action: 'Bulk import completed', user: 'System', time: '15 min ago' },
    { action: 'AI analysis finished', user: 'Content AI', time: '22 min ago' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Enhanced Admin Portal</h1>
        <p className="text-blue-100">Advanced tools and analytics for comprehensive platform management</p>
      </div>

      {/* Feature Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          {features.map((feature) => (
            <button
              key={feature.id}
              onClick={() => setActiveTab(feature.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === feature.id
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <feature.icon className="w-4 h-4" />
              <span>{feature.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[600px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {quickStats.map((stat, index) => (
                <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className={`text-sm ${
                        stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change} from last month
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Feature Overview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                        <p className="text-xs text-gray-600">{activity.user}</p>
                      </div>
                      <span className="text-xs text-gray-500">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">New Features Available</h3>
                <div className="space-y-4">
                  {features.slice(1).map((feature) => (
                    <div key={feature.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                      <feature.icon className="w-6 h-6 text-blue-600" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{feature.name}</h4>
                        <p className="text-sm text-gray-600">{feature.description}</p>
                      </div>
                      <button
                        onClick={() => setActiveTab(feature.id)}
                        className="text-blue-600 text-sm font-medium hover:text-blue-700"
                      >
                        Explore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Implementation Status */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Implementation Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">5/5</div>
                  <div className="text-sm text-green-700">High Priority Features</div>
                  <div className="text-xs text-green-600 mt-1">Complete</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">90%</div>
                  <div className="text-sm text-blue-700">Coverage</div>
                  <div className="text-xs text-blue-600 mt-1">All priority matrix items</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">Ready</div>
                  <div className="text-sm text-purple-700">Production</div>
                  <div className="text-xs text-purple-600 mt-1">All systems operational</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'realtime' && <RealTimeDashboard />}
        {activeTab === 'bulk-ops' && <BulkOperationsCenter />}
        {activeTab === 'analytics' && <LearningAnalyticsEngine />}
        {activeTab === 'ai-content' && <AIContentAssistant />}
        {activeTab === 'mobile' && <MobileAdminApp />}
        {activeTab === 'surveys' && <DEISurveyPlatform />}
      </div>
    </div>
  );
};

export default EnhancedAdminPortal;