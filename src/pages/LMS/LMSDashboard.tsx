import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  BookOpen, 
  Clock, 
  Award, 
  TrendingUp, 
  Play, 
  CheckCircle, 
  Calendar,
  Download,
  MessageSquare
} from 'lucide-react';

const LMSDashboard = () => {
  const { user } = useAuth();

  const modules = [
    {
      id: 'foundations',
      title: 'Foundations of Inclusive Leadership',
      progress: 100,
      status: 'completed',
      duration: '45 min',
      type: 'Video + Worksheet'
    },
    {
      id: 'bias',
      title: 'Recognizing and Mitigating Bias',
      progress: 75,
      status: 'in-progress',
      duration: '60 min',
      type: 'Interactive + Quiz'
    },
    {
      id: 'empathy',
      title: 'Empathy in Action',
      progress: 50,
      status: 'in-progress',
      duration: '40 min',
      type: 'Case Study'
    },
    {
      id: 'conversations',
      title: 'Courageous Conversations at Work',
      progress: 0,
      status: 'not-started',
      duration: '55 min',
      type: 'Video + Template'
    },
    {
      id: 'action-planning',
      title: 'Personal & Team Action Planning',
      progress: 0,
      status: 'not-started',
      duration: '30 min',
      type: 'Worksheet + Coaching'
    }
  ];

  const stats = [
    { label: 'Modules Completed', value: '1/5', icon: BookOpen, color: 'text-blue-500' },
    { label: 'Total Progress', value: '45%', icon: TrendingUp, color: 'text-green-500' },
    { label: 'Time Invested', value: '2.5 hrs', icon: Clock, color: 'text-orange-500' },
    { label: 'Certificates Earned', value: '0', icon: Award, color: 'text-purple-500' }
  ];

  const recentActivity = [
    {
      action: 'Completed',
      item: 'Foundations of Inclusive Leadership',
      time: '2 days ago',
      icon: CheckCircle,
      color: 'text-green-500'
    },
    {
      action: 'Downloaded',
      item: 'Leadership Reflection Worksheet',
      time: '3 days ago',
      icon: Download,
      color: 'text-blue-500'
    },
    {
      action: 'Started',
      item: 'Recognizing and Mitigating Bias',
      time: '1 week ago',
      icon: Play,
      color: 'text-orange-500'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {user?.name || 'Learner'}!</h1>
        <p className="text-gray-600">Continue your inclusive leadership journey. You're making great progress!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-gray-50`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Course Progress */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Your Learning Path</h2>
              <Link 
                to="/lms/courses" 
                className="text-orange-500 hover:text-orange-600 font-medium text-sm"
              >
                View All Courses →
              </Link>
            </div>
            
            <div className="space-y-4">
              {modules.map((module) => (
                <div key={module.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{module.title}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {module.duration}
                        </span>
                        <span>{module.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(module.status)}`}>
                        {getStatusText(module.status)}
                      </span>
                      <Link
                        to={`/lms/module/${module.id}`}
                        className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors duration-200"
                      >
                        {module.status === 'completed' ? 'Review' : module.status === 'in-progress' ? 'Continue' : 'Start'}
                      </Link>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${module.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-sm text-gray-600 mt-1">
                    {module.progress}% complete
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/lms/downloads"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
              >
                <Download className="h-5 w-5 text-blue-500 mr-3" />
                <span className="font-medium text-gray-900">Download All Resources</span>
              </Link>
              <Link
                to="/lms/feedback"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
              >
                <MessageSquare className="h-5 w-5 text-green-500 mr-3" />
                <span className="font-medium text-gray-900">Submit Feedback</span>
              </Link>
              <Link
                to="/lms/contact"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
              >
                <Calendar className="h-5 w-5 text-orange-500 mr-3" />
                <span className="font-medium text-gray-900">Book Coaching Call</span>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg bg-gray-50`}>
                      <Icon className={`h-4 w-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action} <span className="font-normal">{activity.item}</span>
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Next Coaching Session</h3>
            <p className="text-sm text-gray-600 mb-4">
              Scheduled for March 15, 2025 at 2:00 PM EST
            </p>
            <button className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors duration-200">
              Join Meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LMSDashboard;