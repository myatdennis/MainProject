import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Calendar, 
  Activity, 
  BookOpen,
  Award,
  ChevronRight,
  FileText,
  Link,
  Video,
  StickyNote,
  ClipboardList,
  Filter,
  Eye,
  CheckCircle,
  Circle
} from 'lucide-react';
import { UserProfile, OrganizationProfile, BaseResource } from '../models/Profile';
import profileService from '../services/ProfileService';

interface ProfileViewProps {
  profileType: 'user' | 'organization';
  profileId: string;
  isAdmin?: boolean;
  onResourceStatusChange?: (resourceId: string, status: BaseResource['status']) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ 
  profileType, 
  profileId, 
  isAdmin = false, 
  onResourceStatusChange 
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganizationProfile | null>(null);
  const [resources, setResources] = useState<BaseResource[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'progress'>('overview');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [profileType, profileId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (profileType === 'user') {
        const profile = await profileService.getUserProfile(profileId);
        setUserProfile(profile);
        if (profile) {
          setResources(profile.resources);
        }
      } else {
        const profile = await profileService.getOrganizationProfile(profileId);
        setOrgProfile(profile);
        if (profile) {
          setResources(profile.resources);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResourceStatusChange = async (resourceId: string, status: BaseResource['status']) => {
    try {
      await profileService.updateResourceStatus(profileType, profileId, resourceId, status);
      setResources(prev => 
        prev.map(r => r.id === resourceId ? { ...r, status } : r)
      );
      onResourceStatusChange?.(resourceId, status);
    } catch (error) {
      console.error('Failed to update resource status:', error);
    }
  };

  const getResourceIcon = (type: BaseResource['type']) => {
    switch (type) {
      case 'document': return <FileText className="h-4 w-4" />;
      case 'link': return <Link className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'note': return <StickyNote className="h-4 w-4" />;
      case 'assignment': return <ClipboardList className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: BaseResource['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'read': return 'text-blue-600 bg-blue-100';
      case 'unread': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: BaseResource['priority']) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  const filteredResources = resources.filter(resource => {
    if (resourceFilter === 'all') return true;
    if (resourceFilter === 'unread') return resource.status === 'unread';
    if (resourceFilter === 'read') return resource.status === 'read';
    if (resourceFilter === 'completed') return resource.status === 'completed';
    return resource.type === resourceFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!userProfile && !orgProfile) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400">
          {profileType === 'user' ? <User className="h-16 w-16 mx-auto mb-4" /> : <Building2 className="h-16 w-16 mx-auto mb-4" />}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Not Found</h3>
        <p className="text-gray-600">The requested {profileType} profile could not be found.</p>
      </div>
    );
  }

  const profile = userProfile || orgProfile;
  if (!profile) return null;

  const renderUserOverview = () => {
    if (!userProfile) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {userProfile.avatar ? (
                <img
                  src={userProfile.avatar}
                  alt={userProfile.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
                  <User className="h-8 w-8 text-orange-600" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{userProfile.name}</h1>
              <p className="text-lg text-gray-600">{userProfile.role}</p>
              <p className="text-sm text-gray-500">{userProfile.organization}</p>
              {userProfile.bio && (
                <p className="mt-3 text-gray-700">{userProfile.bio}</p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3 text-gray-600">
              <Mail className="h-4 w-4" />
              <span>{userProfile.email}</span>
            </div>
            {userProfile.contactInfo?.phone && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Phone className="h-4 w-4" />
                <span>{userProfile.contactInfo.phone}</span>
              </div>
            )}
            {userProfile.enrollmentDate && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Enrolled: {new Date(userProfile.enrollmentDate).toLocaleDateString()}</span>
              </div>
            )}
            {userProfile.lastActivity && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Activity className="h-4 w-4" />
                <span>Last active: {new Date(userProfile.lastActivity).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {userProfile.contactInfo && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userProfile.contactInfo.department && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <p className="mt-1 text-gray-900">{userProfile.contactInfo.department}</p>
                </div>
              )}
              {userProfile.contactInfo.title && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <p className="mt-1 text-gray-900">{userProfile.contactInfo.title}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOrgOverview = () => {
    if (!orgProfile) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              {orgProfile.logo ? (
                <img
                  src={orgProfile.logo}
                  alt={orgProfile.name}
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{orgProfile.name}</h1>
              <p className="text-lg text-gray-600">{orgProfile.type}</p>
              <div className="mt-2">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  orgProfile.status === 'active' ? 'bg-green-100 text-green-800' : 
                  orgProfile.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {orgProfile.status.charAt(0).toUpperCase() + orgProfile.status.slice(1)}
                </span>
              </div>
              {orgProfile.description && (
                <p className="mt-3 text-gray-700">{orgProfile.description}</p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 text-gray-600">
              <User className="h-4 w-4" />
              <span>{orgProfile.contactPerson}</span>
            </div>
            {orgProfile.contactEmail && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Mail className="h-4 w-4" />
                <span>{orgProfile.contactEmail}</span>
              </div>
            )}
            {orgProfile.website && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Globe className="h-4 w-4" />
                <a href={orgProfile.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                  Website
                </a>
              </div>
            )}
            {orgProfile.enrollmentDate && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Enrolled: {new Date(orgProfile.enrollmentDate).toLocaleDateString()}</span>
              </div>
            )}
            {orgProfile.lastActivity && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Activity className="h-4 w-4" />
                <span>Last active: {new Date(orgProfile.lastActivity).toLocaleDateString()}</span>
              </div>
            )}
            {orgProfile.subscription && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Award className="h-4 w-4" />
                <span>{orgProfile.subscription} Plan</span>
              </div>
            )}
          </div>
        </div>

        {orgProfile.address && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Address
            </h3>
            <div className="text-gray-700">
              {orgProfile.address.street && <p>{orgProfile.address.street}</p>}
              <p>
                {orgProfile.address.city}{orgProfile.address.state ? `, ${orgProfile.address.state}` : ''} {orgProfile.address.zip}
              </p>
              {orgProfile.address.country && <p>{orgProfile.address.country}</p>}
            </div>
          </div>
        )}

        {orgProfile.metrics && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Metrics</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Learners</div>
                <div className="text-2xl font-bold">{orgProfile.metrics.totalLearners}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-sm text-gray-600">Active Learners</div>
                <div className="text-2xl font-bold">{orgProfile.metrics.activeLearners}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-sm text-gray-600">Completion Rate</div>
                <div className="text-2xl font-bold">{orgProfile.metrics.completionRate}%</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-sm text-gray-600">Downloads</div>
                <div className="text-2xl font-bold">{orgProfile.metrics.totalDownloads}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProgress = () => {
    const progressData = userProfile?.learningProgress || 
      (orgProfile ? { 
        completedModules: Object.values(orgProfile.modules).filter(v => v >= 80).length,
        totalModules: Object.keys(orgProfile.modules).length,
        completionRate: orgProfile.metrics?.completionRate || 0,
        modules: orgProfile.modules 
      } : null);

    if (!progressData) return null;

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Learning Progress
          </h3>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{progressData.completionRate}%</div>
            <div className="text-sm text-gray-600">Overall Progress</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {progressData.completedModules} of {progressData.totalModules} modules completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-orange-500 h-2 rounded-full" 
              style={{ width: `${(progressData.completedModules / progressData.totalModules) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900">Module Breakdown</h4>
          {Object.entries(progressData.modules).map(([module, progress]) => (
            <div key={module} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 capitalize">
                {module.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <div className="flex items-center space-x-3">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${progress >= 80 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900 w-12 text-right">{progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderResources = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Resources</h3>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">All Resources</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="completed">Completed</option>
              <option value="document">Documents</option>
              <option value="link">Links</option>
              <option value="video">Videos</option>
              <option value="note">Notes</option>
              <option value="assignment">Assignments</option>
            </select>
          </div>
        </div>

        {filteredResources.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No resources found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredResources.map((resource) => (
              <div
                key={resource.id}
                className={`bg-white p-4 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow ${getPriorityColor(resource.priority)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getResourceIcon(resource.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{resource.title}</h4>
                        {resource.priority && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            resource.priority === 'high' ? 'bg-red-100 text-red-800' :
                            resource.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {resource.priority}
                          </span>
                        )}
                      </div>
                      {resource.description && (
                        <p className="text-sm text-gray-600 mt-1">{resource.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Type: {resource.type}</span>
                        {resource.category && <span>Category: {resource.category}</span>}
                        <span>From: {resource.createdBy}</span>
                        <span>{new Date(resource.createdAt).toLocaleDateString()}</span>
                      </div>
                      {resource.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {resource.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(resource.status)}`}>
                      {resource.status}
                    </span>
                    {!isAdmin && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleResourceStatusChange(resource.id, 'read')}
                          className={`p-1 rounded ${resource.status === 'read' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                          title="Mark as read"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleResourceStatusChange(resource.id, 'completed')}
                          className={`p-1 rounded ${resource.status === 'completed' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                          title="Mark as completed"
                        >
                          {resource.status === 'completed' ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Navigation Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-1">
          {['overview', 'resources', 'progress'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (profileType === 'user' ? renderUserOverview() : renderOrgOverview())}
        {activeTab === 'resources' && renderResources()}
        {activeTab === 'progress' && renderProgress()}
      </div>
    </div>
  );
};

export default ProfileView;