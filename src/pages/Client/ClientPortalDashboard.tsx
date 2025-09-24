import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileText,
  GraduationCap,
  BarChart3,
  User,
  AlertCircle,
  TrendingUp,
  BookOpen,
  Target,
  Award,
  ChevronRight
} from 'lucide-react';
import clientPortalService from '../../services/clientPortalService';
import type { ClientDashboardData, ClientNotification } from '../types/clientPortal';

const ClientPortalDashboard = () => {
  const [dashboardData, setDashboardData] = useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const data = await clientPortalService.getClientDashboardData();
        setDashboardData(data);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const markNotificationRead = (notificationId: string) => {
    if (!dashboardData) return;
    
    setDashboardData({
      ...dashboardData,
      notifications: dashboardData.notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'not-started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'survey': return <BarChart3 className="h-4 w-4" />;
      case 'course': return <GraduationCap className="h-4 w-4" />;
      case 'file': return <FileText className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Unable to load dashboard data</p>
        </div>
      </div>
    );
  }

  const unreadNotifications = dashboardData.notifications.filter(n => !n.read);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-lg">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
                <p className="text-gray-600">Welcome back! Here's your learning dashboard.</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {unreadNotifications.length > 0 && (
                <div className="relative">
                  <button className="p-2 bg-blue-50 rounded-lg">
                    <Bell className="h-5 w-5 text-blue-600" />
                  </button>
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Surveys</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.completedSurveys}/{dashboardData.stats.totalSurveys}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <div className="bg-blue-100 rounded-full h-2">
                <div 
                  className="bg-blue-500 rounded-full h-2" 
                  style={{ 
                    width: `${dashboardData.stats.totalSurveys > 0 
                      ? (dashboardData.stats.completedSurveys / dashboardData.stats.totalSurveys) * 100 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Courses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.completedCourses}/{dashboardData.stats.totalCourses}
                </p>
              </div>
              <GraduationCap className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <div className="bg-green-100 rounded-full h-2">
                <div 
                  className="bg-green-500 rounded-full h-2" 
                  style={{ 
                    width: `${dashboardData.stats.totalCourses > 0 
                      ? (dashboardData.stats.completedCourses / dashboardData.stats.totalCourses) * 100 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Files</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.downloadedFiles}/{dashboardData.stats.totalFiles}
                </p>
              </div>
              <FileText className="h-8 w-8 text-orange-500" />
            </div>
            <div className="mt-2">
              <div className="bg-orange-100 rounded-full h-2">
                <div 
                  className="bg-orange-500 rounded-full h-2" 
                  style={{ 
                    width: `${dashboardData.stats.totalFiles > 0 
                      ? (dashboardData.stats.downloadedFiles / dashboardData.stats.totalFiles) * 100 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Notifications</p>
                <p className="text-2xl font-bold text-gray-900">{unreadNotifications.length}</p>
              </div>
              <Bell className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-sm text-gray-600 mt-2">New items</p>
          </div>
        </div>

        {/* Notifications Section */}
        {unreadNotifications.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Recent Notifications
              </h2>
              <button 
                onClick={() => setShowAllNotifications(!showAllNotifications)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {showAllNotifications ? 'Show Less' : 'View All'}
              </button>
            </div>
            <div className="space-y-3">
              {(showAllNotifications ? dashboardData.notifications : unreadNotifications.slice(0, 3))
                .map((notification) => (
                <div 
                  key={notification.id} 
                  className={`flex items-start space-x-3 p-3 rounded-lg ${notification.read ? 'bg-gray-50' : 'bg-blue-50'}`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{notification.title}</p>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <button 
                      onClick={() => markNotificationRead(notification.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Surveys Section */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-blue-500" />
                  Surveys
                </h2>
                <Link 
                  to="/client/surveys" 
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {dashboardData.surveys.slice(0, 4).map((survey) => (
                <div key={survey.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">{survey.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(survey.status)}`}>
                      {survey.status.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">{survey.description}</p>
                  
                  {survey.status === 'in-progress' && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{survey.answeredQuestions}/{survey.totalQuestions} questions</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 rounded-full h-2" 
                          style={{ width: `${survey.progress || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {survey.dueDate && (
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Due {new Date(survey.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <Link 
                      to={`/client/surveys/${survey.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      {survey.status === 'not-started' ? 'Start' : 
                       survey.status === 'in-progress' ? 'Continue' : 'View'}
                    </Link>
                  </div>
                </div>
              ))}
              {dashboardData.surveys.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No surveys assigned yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Courses Section */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <GraduationCap className="h-5 w-5 mr-2 text-green-500" />
                  Courses
                </h2>
                <Link 
                  to="/lms/courses" 
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {dashboardData.courses.slice(0, 4).map((course) => (
                <div key={course.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    {course.thumbnail && (
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900 text-sm">{course.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(course.status)}`}>
                          {course.status.replace('-', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{course.duration}</p>
                      
                      {course.progress > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>{course.progress}%</span>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 rounded-full h-2" 
                              style={{ width: `${course.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          {course.dueDate && (
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Due {new Date(course.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <Link 
                          to={`/lms/courses`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          {course.status === 'not-started' ? 'Start' : 
                           course.status === 'in-progress' ? 'Continue' : 'View'}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {dashboardData.courses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No courses assigned yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Files & Resources Section */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-orange-500" />
                  Files & Resources
                </h2>
                <Link 
                  to="/client/files" 
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {dashboardData.files.slice(0, 4).map((file) => (
                <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">{file.name}</h3>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {file.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{file.category}</p>
                  {file.description && (
                    <p className="text-xs text-gray-600 mb-3">{file.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {file.downloaded ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Downloaded
                        </span>
                      ) : (
                        <span>Not downloaded</span>
                      )}
                    </div>
                    <a 
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  </div>
                </div>
              ))}
              {dashboardData.files.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No files shared yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientPortalDashboard;