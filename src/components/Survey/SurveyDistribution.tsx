import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Send, 
  Clock, 
  Mail, 
  Bell, 
  Target, 
  Download,
  Copy,
  QrCode,
  Globe,
  Eye,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  userCount: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  organization: string;
  department?: string;
  role?: string;
}

interface SurveyAssignment {
  id: string;
  surveyId: string;
  surveyTitle: string;
  assignedTo: string[];
  assignedOrganizations: string[];
  assignedDepartments: string[];
  startDate?: Date;
  endDate?: Date;
  reminderSchedule: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'bi-weekly';
    daysBeforeDeadline: number[];
  };
  accessControl: {
    requireLogin: boolean;
    allowAnonymous: boolean;
    oneTimeAccess: boolean;
  };
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  responses: {
    total: number;
    completed: number;
    inProgress: number;
  };
}

interface SurveyDistributionProps {
  surveyId: string;
  surveyTitle: string;
  onAssignmentSave: (assignment: SurveyAssignment) => void;
}

const SurveyDistribution: React.FC<SurveyDistributionProps> = ({
  surveyId,
  surveyTitle,
  onAssignmentSave
}) => {
  const [activeTab, setActiveTab] = useState<'assign' | 'monitor' | 'links'>('assign');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<SurveyAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  // Assignment Form State
  const [assignment, setAssignment] = useState<Partial<SurveyAssignment>>({
    surveyId,
    surveyTitle,
    assignedTo: [],
    assignedOrganizations: [],
    assignedDepartments: [],
    reminderSchedule: {
      enabled: true,
      frequency: 'weekly',
      daysBeforeDeadline: [7, 3, 1]
    },
    accessControl: {
      requireLogin: true,
      allowAnonymous: false,
      oneTimeAccess: true
    },
    status: 'draft'
  });

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Mock Data - In real app, this would come from API
  useEffect(() => {
    setOrganizations([
      { id: 'org1', name: 'Technology Division', userCount: 245 },
      { id: 'org2', name: 'Human Resources', userCount: 32 },
      { id: 'org3', name: 'Marketing', userCount: 67 },
      { id: 'org4', name: 'Operations', userCount: 189 },
      { id: 'org5', name: 'Finance', userCount: 43 }
    ]);

    setUsers([
      { id: '1', name: 'Sarah Johnson', email: 'sarah.j@company.com', organization: 'Technology Division', department: 'Engineering', role: 'Senior Developer' },
      { id: '2', name: 'Michael Chen', email: 'michael.c@company.com', organization: 'Technology Division', department: 'Product', role: 'Product Manager' },
      { id: '3', name: 'Emily Rodriguez', email: 'emily.r@company.com', organization: 'Human Resources', department: 'Talent Acquisition', role: 'HR Manager' },
      { id: '4', name: 'David Kim', email: 'david.k@company.com', organization: 'Marketing', department: 'Digital Marketing', role: 'Marketing Specialist' },
      { id: '5', name: 'Lisa Thompson', email: 'lisa.t@company.com', organization: 'Operations', department: 'Customer Success', role: 'Team Lead' }
    ]);

    setAssignments([
      {
        id: 'assign1',
        surveyId,
        surveyTitle,
        assignedTo: ['1', '2', '3'],
        assignedOrganizations: ['org1'],
        assignedDepartments: ['Engineering'],
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reminderSchedule: {
          enabled: true,
          frequency: 'weekly',
          daysBeforeDeadline: [7, 3, 1]
        },
        accessControl: {
          requireLogin: true,
          allowAnonymous: false,
          oneTimeAccess: true
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        responses: {
          total: 245,
          completed: 123,
          inProgress: 34
        }
      }
    ]);
  }, [surveyId, surveyTitle]);

  const handleUserSelection = (userId: string, selected: boolean) => {
    if (selected) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleOrganizationSelection = (orgId: string, selected: boolean) => {
    if (selected) {
      setSelectedOrganizations(prev => [...prev, orgId]);
    } else {
      setSelectedOrganizations(prev => prev.filter(id => id !== orgId));
    }
  };

  const handleSaveAssignment = async () => {
    setLoading(true);
    
    const newAssignment: SurveyAssignment = {
      ...assignment,
      id: `assign-${Date.now()}`,
      assignedTo: selectedUsers,
      assignedOrganizations: selectedOrganizations,
      createdAt: new Date(),
      updatedAt: new Date(),
      responses: {
        total: 0,
        completed: 0,
        inProgress: 0
      }
    } as SurveyAssignment;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setAssignments(prev => [...prev, newAssignment]);
    onAssignmentSave(newAssignment);
    setLoading(false);
    
    // Reset form
    setSelectedUsers([]);
    setSelectedOrganizations([]);
    setAssignment(prev => ({ ...prev, status: 'draft' }));
  };

  const filteredUsers = users.filter(user => {
    const matchesDepartment = !filterDepartment || user.department?.includes(filterDepartment);
    const matchesRole = !filterRole || user.role?.includes(filterRole);
    return matchesDepartment && matchesRole;
  });

  const departments = Array.from(new Set(users.map(user => user.department).filter(Boolean)));
  const roles = Array.from(new Set(users.map(user => user.role).filter(Boolean)));

  return (
    <div className="max-w-7xl mx-auto bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Survey Distribution</h1>
              <p className="text-sm text-gray-600">{surveyTitle}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'assign', label: 'Assignment', icon: Target },
              { id: 'monitor', label: 'Monitor', icon: Eye },
              { id: 'links', label: 'Share Links', icon: Globe },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'assign' && (
          <div className="grid grid-cols-3 gap-8">
            {/* Assignment Settings */}
            <div className="col-span-1 space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Survey Period
                    </label>
                    <div className="space-y-2">
                      <input
                        type="datetime-local"
                        value={assignment.startDate?.toISOString().slice(0, 16) || ''}
                        onChange={(e) => setAssignment(prev => ({
                          ...prev,
                          startDate: new Date(e.target.value)
                        }))}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="datetime-local"
                        value={assignment.endDate?.toISOString().slice(0, 16) || ''}
                        onChange={(e) => setAssignment(prev => ({
                          ...prev,
                          endDate: new Date(e.target.value)
                        }))}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reminder Settings
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={assignment.reminderSchedule?.enabled || false}
                          onChange={(e) => setAssignment(prev => ({
                            ...prev,
                            reminderSchedule: {
                              ...prev.reminderSchedule!,
                              enabled: e.target.checked
                            }
                          }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">Enable automatic reminders</span>
                      </label>
                      
                      {assignment.reminderSchedule?.enabled && (
                        <div className="space-y-2 ml-6">
                          <select
                            value={assignment.reminderSchedule.frequency}
                            onChange={(e) => setAssignment(prev => ({
                              ...prev,
                              reminderSchedule: {
                                ...prev.reminderSchedule!,
                                frequency: e.target.value as 'daily' | 'weekly' | 'bi-weekly'
                              }
                            }))}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="bi-weekly">Bi-weekly</option>
                          </select>
                          
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Send reminders (days before deadline)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., 7, 3, 1"
                              value={assignment.reminderSchedule.daysBeforeDeadline.join(', ')}
                              onChange={(e) => {
                                const days = e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                                setAssignment(prev => ({
                                  ...prev,
                                  reminderSchedule: {
                                    ...prev.reminderSchedule!,
                                    daysBeforeDeadline: days
                                  }
                                }));
                              }}
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Control
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={assignment.accessControl?.requireLogin || false}
                          onChange={(e) => setAssignment(prev => ({
                            ...prev,
                            accessControl: {
                              ...prev.accessControl!,
                              requireLogin: e.target.checked
                            }
                          }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">Require login</span>
                      </label>
                      
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={assignment.accessControl?.allowAnonymous || false}
                          onChange={(e) => setAssignment(prev => ({
                            ...prev,
                            accessControl: {
                              ...prev.accessControl!,
                              allowAnonymous: e.target.checked
                            }
                          }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">Allow anonymous responses</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={assignment.accessControl?.oneTimeAccess || false}
                          onChange={(e) => setAssignment(prev => ({
                            ...prev,
                            accessControl: {
                              ...prev.accessControl!,
                              oneTimeAccess: e.target.checked
                            }
                          }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">One-time access only</span>
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveAssignment}
                  disabled={loading || (selectedUsers.length === 0 && selectedOrganizations.length === 0)}
                  className="w-full mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Survey</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Selection Summary</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>Organizations: {selectedOrganizations.length}</div>
                  <div>Individual Users: {selectedUsers.length}</div>
                  <div>Total Recipients: ~{
                    organizations
                      .filter(org => selectedOrganizations.includes(org.id))
                      .reduce((sum, org) => sum + org.userCount, 0) + selectedUsers.length
                  }</div>
                </div>
              </div>
            </div>

            {/* Recipient Selection */}
            <div className="col-span-2 space-y-6">
              {/* Organizations */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Organizations</h3>
                <div className="grid grid-cols-2 gap-4">
                  {organizations.map((org) => (
                    <div key={org.id} className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedOrganizations.includes(org.id)}
                          onChange={(e) => handleOrganizationSelection(org.id, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{org.name}</div>
                          <div className="text-sm text-gray-600">{org.userCount} users</div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Users */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Select Individual Users</h3>
                  
                  {/* Filters */}
                  <div className="flex items-center space-x-2">
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">All Roles</option>
                      {roles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium text-gray-700">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers(filteredUsers.map(user => user.id));
                                } else {
                                  setSelectedUsers([]);
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                          </th>
                          <th className="text-left p-3 text-sm font-medium text-gray-700">Name</th>
                          <th className="text-left p-3 text-sm font-medium text-gray-700">Organization</th>
                          <th className="text-left p-3 text-sm font-medium text-gray-700">Department</th>
                          <th className="text-left p-3 text-sm font-medium text-gray-700">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.id)}
                                onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="p-3">
                              <div>
                                <div className="font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-600">{user.email}</div>
                              </div>
                            </td>
                            <td className="p-3 text-sm text-gray-700">{user.organization}</td>
                            <td className="p-3 text-sm text-gray-700">{user.department}</td>
                            <td className="p-3 text-sm text-gray-700">{user.role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-6">
              {/* Summary Cards */}
              <div className="bg-blue-50 rounded-lg p-6">
                <div className="flex items-center space-x-3">
                  <Send className="w-8 h-8 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-blue-900">
                      {assignments.filter(a => a.status === 'active').length}
                    </div>
                    <div className="text-sm text-blue-700">Active Assignments</div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-900">
                      {assignments.reduce((sum, a) => sum + a.responses.completed, 0)}
                    </div>
                    <div className="text-sm text-green-700">Completed Responses</div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-6">
                <div className="flex items-center space-x-3">
                  <Clock className="w-8 h-8 text-yellow-600" />
                  <div>
                    <div className="text-2xl font-bold text-yellow-900">
                      {assignments.reduce((sum, a) => sum + a.responses.inProgress, 0)}
                    </div>
                    <div className="text-sm text-yellow-700">In Progress</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-3">
                  <Users className="w-8 h-8 text-gray-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {assignments.reduce((sum, a) => sum + a.responses.total, 0)}
                    </div>
                    <div className="text-sm text-gray-700">Total Assigned</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment List */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Survey Assignments</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-gray-700">Assignment</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700">Period</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700">Recipients</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700">Response Rate</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => {
                      const responseRate = assignment.responses.total > 0 
                        ? ((assignment.responses.completed / assignment.responses.total) * 100).toFixed(1)
                        : '0';
                        
                      return (
                        <tr key={assignment.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-4">
                            <div className="font-medium text-gray-900">{assignment.surveyTitle}</div>
                            <div className="text-sm text-gray-600">
                              Created {assignment.createdAt.toLocaleDateString()}
                            </div>
                          </td>
                          <td className="p-4 text-sm text-gray-700">
                            {assignment.startDate && (
                              <div>
                                <div>{assignment.startDate.toLocaleDateString()}</div>
                                {assignment.endDate && (
                                  <div>to {assignment.endDate.toLocaleDateString()}</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-sm text-gray-700">
                            <div>{assignment.responses.total} total</div>
                            <div className="text-xs text-gray-600">
                              {assignment.assignedOrganizations.length} orgs, {assignment.assignedTo.length} users
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${responseRate}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{responseRate}%</span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {assignment.responses.completed} of {assignment.responses.total}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              assignment.status === 'active' 
                                ? 'bg-green-100 text-green-800'
                                : assignment.status === 'scheduled'
                                ? 'bg-yellow-100 text-yellow-800'
                                : assignment.status === 'paused'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {assignment.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <button className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                                <Bell className="w-4 h-4" />
                              </button>
                              <button className="p-1 text-gray-600 hover:bg-gray-100 rounded">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="p-1 text-green-600 hover:bg-green-100 rounded">
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Survey Links</h3>
              <p className="text-gray-600 mb-6">Generate different types of links for various distribution methods</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Public Link */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Globe className="w-6 h-6 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">Public Link</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Anyone with this link can access the survey. No login required.
                </p>
                <div className="bg-gray-50 rounded p-3 mb-4">
                  <code className="text-sm text-gray-800 break-all">
                    https://yourapp.com/survey/{surveyId}/public
                  </code>
                </div>
                <div className="flex space-x-2">
                  <button className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center space-x-1">
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                  <button className="px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Authenticated Link */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Users className="w-6 h-6 text-green-600" />
                  <h4 className="font-semibold text-gray-900">Authenticated Link</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Requires users to log in. Responses are linked to user accounts.
                </p>
                <div className="bg-gray-50 rounded p-3 mb-4">
                  <code className="text-sm text-gray-800 break-all">
                    https://yourapp.com/survey/{surveyId}/auth
                  </code>
                </div>
                <div className="flex space-x-2">
                  <button className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center space-x-1">
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                  <button className="px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Email Template */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Mail className="w-6 h-6 text-purple-600" />
                  <h4 className="font-semibold text-gray-900">Email Template</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Pre-formatted email invitation for copy/paste into your email client.
                </p>
                <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
                  <div className="font-medium mb-2">Subject: Your input needed - {surveyTitle}</div>
                  <div className="text-gray-700">
                    Hello,<br/><br/>
                    You've been invited to participate in our survey: {surveyTitle}.<br/><br/>
                    Your feedback is valuable and will help us improve our workplace culture.<br/><br/>
                    <Link to="/client/surveys" className="text-blue-600 underline">Take Survey Now</Link><br/><br/>
                    Thank you for your participation.
                  </div>
                </div>
                <button className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center space-x-1">
                  <Copy className="w-4 h-4" />
                  <span>Copy Email Template</span>
                </button>
              </div>

              {/* Embedded Code */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                  <h4 className="font-semibold text-gray-900">Embed Code</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Embed the survey directly into your website or intranet.
                </p>
                <div className="bg-gray-50 rounded p-3 mb-4">
                  <code className="text-xs text-gray-800 break-all">
                    {`<iframe src="https://yourapp.com/survey/${surveyId}/embed" width="100%" height="600" frameborder="0"></iframe>`}
                  </code>
                </div>
                <button className="w-full px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center justify-center space-x-1">
                  <Copy className="w-4 h-4" />
                  <span>Copy Embed Code</span>
                </button>
              </div>
            </div>

            {/* Link Analytics */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Link Analytics</h4>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">1,234</div>
                  <div className="text-sm text-gray-600">Total Clicks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">567</div>
                  <div className="text-sm text-gray-600">Started Survey</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">345</div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">28%</div>
                  <div className="text-sm text-gray-600">Completion Rate</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyDistribution;