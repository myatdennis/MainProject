import { LazyImage } from '../../components/PerformanceComponents';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  X, 
  Building2, 
  Users, 
  TrendingUp, 
  Calendar,
  Mail,
  Phone,
  Globe,
  MapPin,
  CreditCard,
  Settings,
  BarChart3,
  Activity,
  Award,
  Clock,
  Target,
  Download,
  Share,
  AlertCircle,
  CheckCircle,
  Zap,
  UserPlus,
  Trash2
} from 'lucide-react';
import {
  getOrg,
  getOrgStats,
  listOrgMembers,
  addOrgMember,
  removeOrgMember,
  type Org,
  type OrgMember,
} from '../../dal/orgs';
import LoadingButton from '../../components/LoadingButton';
import EditOrganizationModal from '../../components/EditOrganizationModal';
import { useToast } from '../../context/ToastContext';
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const OrganizationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  
  const [organization, setOrganization] = useState<Org | null>(null);
  const [orgStats, setOrgStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analytics' | 'settings' | 'billing'>('overview');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'member' });
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!id) return;
    setMembersLoading(true);
    try {
  const data = await listOrgMembers(id);
      setMembers(data);
    } catch (error) {
      console.error('Failed to load organization members:', error);
      showToast('Failed to load organization members', 'error');
    } finally {
      setMembersLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const [orgData, statsData] = await Promise.all([
          getOrg(id),
          getOrgStats(id)
        ]);
        
        setOrganization(orgData);
        setOrgStats(statsData);
      } catch (error) {
        showToast('Failed to load organization details', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, showToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleOrganizationUpdated = (updatedOrg: Org) => {
    setOrganization(updatedOrg);
    showToast('Organization updated successfully!', 'success');
  };

  const handleAddMember = async () => {
    if (!id) return;
    const userId = memberForm.userId.trim();
    if (!userId) {
      showToast('User ID is required', 'error');
      return;
    }

    setMemberSubmitting(true);
    try {
  const member = await addOrgMember(id, { userId, role: memberForm.role });
      setMembers((prev) => {
        const exists = prev.find((m) => m.id === member.id);
        if (exists) {
          return prev.map((m) => (m.id === member.id ? member : m));
        }
        return [member, ...prev];
      });
      setMemberForm((form) => ({ ...form, userId: '' }));
      showToast('Member added successfully', 'success');
    } catch (error) {
      console.error('Failed to add organization member:', error);
      showToast('Failed to add organization member', 'error');
    } finally {
      setMemberSubmitting(false);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!id) return;
    try {
  await removeOrgMember(id, membershipId);
      setMembers((prev) => prev.filter((member) => member.id !== membershipId));
      showToast('Member removed successfully', 'success');
    } catch (error) {
      console.error('Failed to remove organization member:', error);
      showToast('Failed to remove organization member', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Organization Not Found</h3>
        <p className="text-gray-600 mb-4">The organization you're looking for doesn't exist.</p>
        <Link
          to="/admin/organizations"
          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Organizations
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'inactive': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'trial': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'inactive': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'suspended': return <X className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const COLORS = ['#3A7DFF', '#228B22', '#F6C87B', '#D72638', '#de7b12'];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users & Learners', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin/organizations"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-3 rounded-lg">
                {organization.logo ? (
                  <LazyImage
                    src={organization.logo}
                    webpSrc={organization.logo?.replace(/\.(png|jpg|jpeg)$/i, '.webp')}
                    avifSrc={organization.logo?.replace(/\.(png|jpg|jpeg)$/i, '.avif')}
                    fallbackSrc="/default-org-fallback.png"
                    alt="Logo"
                    className="w-8 h-8 rounded"
                    placeholder={<div className="w-8 h-8 rounded bg-mutedgrey animate-pulse" />} 
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-blue-600" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm text-gray-600">{organization.type}</span>
                  <span className="text-gray-300">•</span>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(organization.status)}`}>
                    {getStatusIcon(organization.status)}
                    <span className="ml-1 capitalize">{organization.status}</span>
                  </div>
                  {organization.tags && organization.tags.map((tag: string) => (
                    <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Share className="w-4 h-4" />
              <span>Share</span>
            </button>
            <button className="flex items-center space-x-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <LoadingButton
              onClick={() => setShowEditModal(true)}
              variant="primary"
            >
              <Edit className="w-4 h-4" />
              Edit Organization
            </LoadingButton>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-900">{organization.totalLearners}</div>
                <div className="text-sm text-blue-700">Total Learners</div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-900">{organization.activeLearners}</div>
                <div className="text-sm text-green-700">Active Learners</div>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Target className="w-8 h-8 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-yellow-900">{organization.completionRate}%</div>
                <div className="text-sm text-yellow-700">Completion Rate</div>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Award className="w-8 h-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold text-purple-900">{organization.cohorts.length}</div>
                <div className="text-sm text-purple-700">Active Cohorts</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Organization Information</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">Primary Contact</div>
                        <div className="text-gray-600">{organization.contactPerson}</div>
                        <div className="text-sm text-gray-500">{organization.contactEmail}</div>
                      </div>
                    </div>
                    
                    {organization.contactPhone && (
                      <div className="flex items-center space-x-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">Phone</div>
                          <div className="text-gray-600">{organization.contactPhone}</div>
                        </div>
                      </div>
                    )}
                    
                    {organization.website && (
                      <div className="flex items-center space-x-3">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">Website</div>
                          <a href={organization.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {organization.website}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {organization.address && (
                      <div className="flex items-start space-x-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-medium text-gray-900">Address</div>
                          <div className="text-gray-600">
                            {organization.address}<br />
                            {organization.city && `${organization.city}, `}
                            {organization.state} {organization.postalCode}<br />
                            {organization.country}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subscription Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Subscription Details</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">Plan</div>
                        <div className="text-gray-600">{organization.subscription}</div>
                        <div className="text-sm text-gray-500">
                          {organization.billingCycle && `Billed ${organization.billingCycle}`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">Contract Period</div>
                        <div className="text-gray-600">
                          {organization.contractStart ? new Date(organization.contractStart).toLocaleDateString() : 'Not set'}
                          {organization.contractEnd && ` - ${new Date(organization.contractEnd).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Zap className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">Limits</div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Max Learners: {organization.maxLearners || 'Unlimited'}</div>
                          <div>Max Courses: {organization.maxCourses || 'Unlimited'}</div>
                          <div>Storage: {organization.maxStorage || 'Unlimited'} GB</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Overview */}
              {orgStats && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {/* User Growth Chart */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">User Growth (12 months)</h4>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={orgStats.trends.userGrowth}>
                            <XAxis dataKey="month" fontSize={12} />
                            <YAxis fontSize={12} />
                            <CartesianGrid strokeDasharray="3 3" />
                            <Tooltip />
                            <Line type="monotone" dataKey="users" stroke="#3A7DFF" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Module Progress */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Module Progress</h4>
                      <div className="space-y-2">
                        {Object.entries(organization.modules).map(([module, progress]) => (
                          <div key={module} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 capitalize">{module}</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-16 h-2 bg-gray-200 rounded-full">
                                <div 
                                  className="h-2 bg-blue-500 rounded-full"
                                  style={{ width: `${Number(progress)}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{Number(progress)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Description and Notes */}
              {(organization.description || organization.notes) && (
                <div className="space-y-4">
                  {organization.description && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                      <p className="text-gray-600">{organization.description}</p>
                    </div>
                  )}
                  
                  {organization.notes && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Internal Notes</h3>
                      <p className="text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        {organization.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <span>Organization Members</span>
                      <Users className="w-4 h-4 text-gray-500" />
                    </h3>
                    <p className="text-sm text-gray-600">Manage member access for this organization workspace.</p>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <input
                      type="text"
                      value={memberForm.userId}
                      onChange={(e) => setMemberForm((form) => ({ ...form, userId: e.target.value }))}
                      placeholder="Supabase User ID"
                      className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={memberForm.role}
                      onChange={(e) => setMemberForm((form) => ({ ...form, role: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="member">Member</option>
                      <option value="editor">Editor</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      onClick={handleAddMember}
                      disabled={memberSubmitting}
                      className="inline-flex items-center justify-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-60"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {memberSubmitting ? 'Adding…' : 'Add Member'}
                    </button>
                  </div>
                </div>
                <div className="overflow-hidden">
                  {membersLoading ? (
                    <div className="p-6 flex items-center justify-center text-sm text-gray-500">
                      Loading members…
                    </div>
                  ) : members.length === 0 ? (
                    <div className="p-6 text-sm text-gray-500">No members found for this organization.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invited By</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {members.map((member) => (
                            <tr key={member.id}>
                              <td className="px-4 py-3 text-sm text-gray-900 font-mono">{member.userId}</td>
                              <td className="px-4 py-3 text-sm text-gray-700 capitalize">{member.role}</td>
                              <td className="px-4 py-3 text-sm text-gray-500 font-mono">{member.invitedBy ?? '—'}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{new Date(member.createdAt).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="inline-flex items-center px-2.5 py-1.5 border border-red-200 text-sm text-red-600 rounded-lg hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">User Engagement Insights</h3>
                <div className="flex space-x-2">
                  <button className="px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Import Users
                  </button>
                  <button className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                    Add User
                  </button>
                </div>
              </div>

              {orgStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Engagement Stats */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">User Engagement</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Daily Active</span>
                        <span className="font-medium">{orgStats.engagement.dailyActiveUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Weekly Active</span>
                        <span className="font-medium">{orgStats.engagement.weeklyActiveUsers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Monthly Active</span>
                        <span className="font-medium">{orgStats.engagement.monthlyActiveUsers}</span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Stats */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Learning Performance</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Courses Completed</span>
                        <span className="font-medium">{orgStats.performance.coursesCompleted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Certificates Issued</span>
                        <span className="font-medium">{orgStats.performance.certificatesIssued}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Avg Session Time</span>
                        <span className="font-medium">{orgStats.overview.avgSessionTime}min</span>
                      </div>
                    </div>
                  </div>

                  {/* Average Scores */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Average Scores</h4>
                    <div className="space-y-2">
                      {Object.entries(orgStats.performance.avgScores || {}).map(([module, score]) => (
                        <div key={module} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 capitalize">{module}</span>
                          <span className="font-medium">{score as number}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Cohorts */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Active Cohorts</h4>
                <div className="space-y-2">
                  {organization.cohorts.map((cohort: string, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <span className="font-medium text-gray-900">{cohort}</span>
                      <span className="text-sm text-gray-600">Active</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && orgStats && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Analytics Dashboard</h3>
              
              {/* Completion Trends */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Daily Completions (30 days)</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orgStats.trends.completionTrends}>
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <CartesianGrid strokeDasharray="3 3" />
                      <Tooltip />
                      <Bar dataKey="completions" fill="#228B22" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Module Distribution */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Module Progress Distribution</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(organization.modules).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          dataKey="value"
                          label
                        >
                          {Object.entries(organization.modules).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Key Metrics</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">User Retention Rate</span>
                      <span className="font-semibold text-green-600">
                        {Math.round((orgStats.engagement.weeklyActiveUsers / orgStats.overview.totalUsers) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Course Completion Rate</span>
                      <span className="font-semibold text-blue-600">{organization.completionRate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Average Score</span>
                      <span className="font-semibold text-purple-600">
                        {orgStats.performance.avgScores && Object.keys(orgStats.performance.avgScores).length > 0 
                          ? Math.round(Object.values(orgStats.performance.avgScores as Record<string, number>).reduce((a, b) => a + b, 0) / Object.values(orgStats.performance.avgScores as Record<string, number>).length)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Organization Settings</h3>
              
              {/* Features */}
              {organization.features && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Enabled Features</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(organization.features).map(([feature, enabled]) => (
                      <div key={feature} className={`p-3 border rounded-lg ${enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">
                            {feature.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings */}
              {organization.settings && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Configuration</h4>
                  <div className="space-y-3">
                    {Object.entries(organization.settings).map(([setting, value]) => (
                      <div key={setting} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <span className="font-medium capitalize">
                          {setting.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-gray-600">
                          {typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Billing & Subscription</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Current Plan</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-blue-900">{organization.subscription}</span>
                      <span className="text-sm text-blue-700">{organization.billingCycle}</span>
                    </div>
                    {organization.customPricing && organization.customPricing > 0 ? (
                      <div className="text-2xl font-bold text-blue-900">${organization.customPricing}/month</div>
                    ) : (
                      <div className="text-sm text-blue-700">Custom pricing</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Billing Contact</h4>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 font-medium">{organization.billingEmail || organization.contactEmail}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Next billing:</span>
                      <span className="ml-2 font-medium">
                        {organization.contractEnd ? new Date(organization.contractEnd).toLocaleDateString() : 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">Usage & Limits</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-yellow-700">Learners</div>
                    <div className="font-semibold text-yellow-900">
                      {organization.totalLearners} / {organization.maxLearners || '∞'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-yellow-700">Courses</div>
                    <div className="font-semibold text-yellow-900">
                      {organization.cohorts.length} / {organization.maxCourses || '∞'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-yellow-700">Storage</div>
                    <div className="font-semibold text-yellow-900">
                      2.3 GB / {organization.maxStorage || '∞'} GB
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <EditOrganizationModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        organization={organization}
        onOrganizationUpdated={handleOrganizationUpdated}
      />
    </div>
  );
};

export default OrganizationDetails;
