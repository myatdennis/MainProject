import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Calendar,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  Settings,
  Download,
  Upload,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

const AdminOrganizations = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  const organizations = [
    {
      id: '1',
      name: 'Pacific Coast University',
      type: 'University',
      contactPerson: 'Dr. Sarah Chen',
      contactEmail: 'sarah.chen@pacificcoast.edu',
      enrollmentDate: '2025-01-15',
      status: 'active',
      totalLearners: 45,
      activeLearners: 42,
      completionRate: 94,
      cohorts: ['Spring 2025 Leadership', 'Faculty Development 2025'],
      subscription: 'Premium',
      lastActivity: '2025-03-11',
      modules: {
        foundations: 98,
        bias: 91,
        empathy: 87,
        conversations: 82,
        planning: 76
      },
      notes: 'Excellent engagement. Requested additional modules for faculty.'
    },
    {
      id: '2',
      name: 'Mountain View High School',
      type: 'K-12 Education',
      contactPerson: 'Marcus Rodriguez',
      contactEmail: 'mrodriguez@mvhs.edu',
      enrollmentDate: '2025-01-20',
      status: 'active',
      totalLearners: 23,
      activeLearners: 20,
      completionRate: 87,
      cohorts: ['Spring 2025 Leadership'],
      subscription: 'Standard',
      lastActivity: '2025-03-10',
      modules: {
        foundations: 95,
        bias: 89,
        empathy: 85,
        conversations: 78,
        planning: 65
      },
      notes: 'Focus on athletic department leadership development.'
    },
    {
      id: '3',
      name: 'Community Impact Network',
      type: 'Nonprofit',
      contactPerson: 'Jennifer Walsh',
      contactEmail: 'jwalsh@communityimpact.org',
      enrollmentDate: '2025-01-10',
      status: 'inactive',
      totalLearners: 28,
      activeLearners: 15,
      completionRate: 61,
      cohorts: ['Spring 2025 Leadership'],
      subscription: 'Standard',
      lastActivity: '2025-02-28',
      modules: {
        foundations: 85,
        bias: 68,
        empathy: 54,
        conversations: 42,
        planning: 28
      },
      notes: 'Low engagement recently. Follow up needed.'
    },
    {
      id: '4',
      name: 'Regional Fire Department',
      type: 'Government',
      contactPerson: 'Captain David Thompson',
      contactEmail: 'dthompson@regionalfire.gov',
      enrollmentDate: '2024-12-01',
      status: 'active',
      totalLearners: 67,
      activeLearners: 63,
      completionRate: 89,
      cohorts: ['Winter 2025 Leadership', 'Command Staff Development'],
      subscription: 'Premium',
      lastActivity: '2025-03-11',
      modules: {
        foundations: 92,
        bias: 88,
        empathy: 91,
        conversations: 85,
        planning: 79
      },
      notes: 'Strong leadership commitment. Excellent results.'
    },
    {
      id: '5',
      name: 'TechForward Solutions',
      type: 'Corporate',
      contactPerson: 'Lisa Park',
      contactEmail: 'lpark@techforward.com',
      enrollmentDate: '2025-02-01',
      status: 'active',
      totalLearners: 34,
      activeLearners: 32,
      completionRate: 96,
      cohorts: ['Spring 2025 Leadership'],
      subscription: 'Premium',
      lastActivity: '2025-03-11',
      modules: {
        foundations: 100,
        bias: 97,
        empathy: 94,
        conversations: 91,
        planning: 88
      },
      notes: 'Outstanding engagement. Interested in advanced modules.'
    }
  ];

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getSubscriptionColor = (subscription: string) => {
    return subscription === 'Premium' 
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Organization Management</h1>
        <p className="text-gray-600">Manage client organizations, track progress, and oversee cohorts</p>
      </div>

      {/* Search and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Organization</span>
            </button>
            <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
            <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {filteredOrgs.map((org) => (
          <div key={org.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-600">{org.type}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(org.status)}
                <button className="p-1 text-gray-400 hover:text-gray-600">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Contact:</span>
                <span className="text-sm font-medium text-gray-900">{org.contactPerson}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Learners:</span>
                <span className="text-sm font-medium text-gray-900">
                  {org.activeLearners}/{org.totalLearners} active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completion:</span>
                <span className="text-sm font-bold text-green-600">{org.completionRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Subscription:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSubscriptionColor(org.subscription)}`}>
                  {org.subscription}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-sm font-bold text-gray-900">{org.completionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full"
                  style={{ width: `${org.completionRate}%` }}
                ></div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Module Progress</h4>
              <div className="grid grid-cols-5 gap-1">
                {Object.entries(org.modules).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className={`w-full h-2 rounded-full ${
                      value >= 90 ? 'bg-green-500' :
                      value >= 70 ? 'bg-yellow-500' :
                      value >= 50 ? 'bg-orange-500' : 'bg-red-500'
                    }`}></div>
                    <div className="text-xs text-gray-600 mt-1">{value}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(org.status)}`}>
                  {org.status}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg" title="View Details">
                  <Eye className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" title="Edit">
                  <Edit className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg" title="Settings">
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-blue-600">{organizations.length}</div>
          <div className="text-sm text-gray-600">Total Organizations</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-green-600">
            {organizations.filter(org => org.status === 'active').length}
          </div>
          <div className="text-sm text-gray-600">Active Organizations</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {organizations.reduce((acc, org) => acc + org.totalLearners, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Learners</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round(organizations.reduce((acc, org) => acc + org.completionRate, 0) / organizations.length)}%
          </div>
          <div className="text-sm text-gray-600">Avg. Completion</div>
        </div>
      </div>

      {/* Detailed Organization Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Organization Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 font-semibold text-gray-900">Organization</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Contact</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Learners</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Progress</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Status</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Last Activity</th>
                <th className="text-center py-3 px-6 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.map((org) => (
                <tr key={org.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div>
                      <div className="font-medium text-gray-900">{org.name}</div>
                      <div className="text-sm text-gray-600">{org.type}</div>
                      <div className="text-xs text-gray-500">{org.cohorts.join(', ')}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div>
                      <div className="font-medium text-gray-900">{org.contactPerson}</div>
                      <div className="text-sm text-gray-600">{org.contactEmail}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="text-lg font-bold text-gray-900">{org.activeLearners}</div>
                    <div className="text-sm text-gray-600">of {org.totalLearners}</div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="text-lg font-bold text-green-600">{org.completionRate}%</div>
                    <div className="w-16 bg-gray-200 rounded-full h-2 mt-1 mx-auto">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full"
                        style={{ width: `${org.completionRate}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {getStatusIcon(org.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(org.status)}`}>
                        {org.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center text-sm text-gray-600">
                    {new Date(org.lastActivity).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button className="p-1 text-blue-600 hover:text-blue-800" title="View Details">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-600 hover:text-gray-800" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-600 hover:text-gray-800" title="Settings">
                        <Settings className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminOrganizations;