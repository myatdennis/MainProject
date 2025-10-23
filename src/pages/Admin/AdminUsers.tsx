import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Download, 
  Upload,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertTriangle,
  Mail,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import AddUserModal from '../../components/AddUserModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import LoadingButton from '../../components/LoadingButton';
import { useToast } from '../../context/ToastContext';
import { User } from '../../types/user';
import { courseStore } from '../../store/courseStore';
import orgService, { type Org } from '../../services/orgService';
import type { CourseAssignmentRequest } from '../../types/assignment';

const AdminUsers = () => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCourseAssignModal, setShowCourseAssignModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Org[]>([]);

  const users: User[] = [
    {
      id: '1',
      name: 'Sarah Chen',
      email: 'sarah.chen@pacificcoast.edu',
      organization: 'Pacific Coast University',
      cohort: 'Spring 2025 Leadership',
      role: 'VP Student Affairs',
      enrolled: '2025-01-15',
      lastLogin: '2025-03-10',
      progress: {
        foundations: 100,
        bias: 75,
        empathy: 50,
        conversations: 0,
        planning: 0
      },
      overallProgress: 45,
      status: 'active',
      completedModules: 1,
      totalModules: 5,
      feedbackSubmitted: true
    },
    {
      id: '2',
      name: 'Marcus Rodriguez',
      email: 'mrodriguez@mvhs.edu',
      organization: 'Mountain View High School',
      cohort: 'Spring 2025 Leadership',
      role: 'Athletic Director',
      enrolled: '2025-01-20',
      lastLogin: '2025-03-09',
      progress: {
        foundations: 100,
        bias: 100,
        empathy: 80,
        conversations: 25,
        planning: 0
      },
      overallProgress: 61,
      status: 'active',
      completedModules: 2,
      totalModules: 5,
      feedbackSubmitted: true
    },
    {
      id: '3',
      name: 'Jennifer Walsh',
      email: 'jwalsh@communityimpact.org',
      organization: 'Community Impact Network',
      cohort: 'Spring 2025 Leadership',
      role: 'Executive Director',
      enrolled: '2025-01-10',
      lastLogin: '2025-02-28',
      progress: {
        foundations: 100,
        bias: 50,
        empathy: 0,
        conversations: 0,
        planning: 0
      },
      overallProgress: 30,
      status: 'inactive',
      completedModules: 1,
      totalModules: 5,
      feedbackSubmitted: false
    },
    {
      id: '4',
      name: 'David Thompson',
      email: 'dthompson@regionalfire.gov',
      organization: 'Regional Fire Department',
      cohort: 'Winter 2025 Leadership',
      role: 'Training Commander',
      enrolled: '2024-12-01',
      lastLogin: '2025-03-08',
      progress: {
        foundations: 100,
        bias: 100,
        empathy: 100,
        conversations: 75,
        planning: 50
      },
      overallProgress: 85,
      status: 'active',
      completedModules: 3,
      totalModules: 5,
      feedbackSubmitted: true
    },
    {
      id: '5',
      name: 'Lisa Park',
      email: 'lpark@techforward.com',
      organization: 'TechForward Solutions',
      cohort: 'Spring 2025 Leadership',
      role: 'Chief HR Officer',
      enrolled: '2025-02-01',
      lastLogin: '2025-03-11',
      progress: {
        foundations: 100,
        bias: 100,
        empathy: 100,
        conversations: 100,
        planning: 80
      },
      overallProgress: 96,
      status: 'active',
      completedModules: 4,
      totalModules: 5,
      feedbackSubmitted: true
    }
  ];

  const [usersList, setUsersList] = useState<User[]>(users); // Make users editable

  useEffect(() => {
    orgService
      .listOrgs()
      .then(setOrganizations)
      .catch(error => console.warn('Failed to load organizations for assignments', error));
  }, []);

  const courseOptions = useMemo(
    () => courseStore.getAllCourses().map(course => ({ id: course.id, title: course.title, duration: course.duration })),
    [],
  );

  const organizationFilters = [
    'Pacific Coast University',
    'Mountain View High School',
    'Community Impact Network',
    'Regional Fire Department',
    'TechForward Solutions'
  ];

  const modules = [
    { key: 'foundations', name: 'Foundations of Inclusive Leadership' },
    { key: 'bias', name: 'Recognizing and Mitigating Bias' },
    { key: 'empathy', name: 'Empathy in Action' },
    { key: 'conversations', name: 'Courageous Conversations at Work' },
    { key: 'planning', name: 'Personal & Team Action Planning' }
  ];

  const filteredUsers = usersList.filter((user: User) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.organization.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = filterOrg === 'all' || user.organization === filterOrg;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesOrg && matchesStatus;
  });

  const handleSelectUser = (userId: string) => {
    setSelectedUsers((prev: string[]) => 
      prev.includes(userId) 
        ? prev.filter((id: string) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((user: User) => user.id));
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'inactive':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-red-600 bg-red-50';
    }
  };

  // Handler functions for button actions
  const handleAddUser = () => {
    setShowAddUserModal(true);
  };

  const handleUserAdded = (newUser: User) => {
    setUsersList((prev: User[]) => [...prev, newUser]);
    showToast('User added successfully!', 'success');
  };

  const handleSendReminder = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      showToast(`Reminder sent to ${selectedUsers.length} user(s)`, 'success');
      setSelectedUsers([]);
    } catch (error) {
      showToast('Failed to send reminders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCourse = () => {
    setShowCourseAssignModal(true);
  };

  const handleCourseAssignComplete = (_assignment?: Omit<CourseAssignmentRequest, 'assignedBy'>) => {
    setSelectedUsers([]);
    setShowCourseAssignModal(false);
  };

  const handleImportCSV = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        showToast(`Importing ${file.name}...`, 'info');
        // Here you would implement the actual CSV import logic
        setTimeout(() => {
          showToast('CSV import completed successfully!', 'success');
        }, 3000);
      }
    };
    input.click();
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create and download CSV
      const csvContent = `Name,Email,Organization,Status,Progress\n${filteredUsers.map((user: User) => 
        `"${user.name}","${user.email}","${user.organization}","${user.status}","${user.overallProgress}%"`
      ).join('\n')}`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast('Users exported successfully!', 'success');
    } catch (error) {
      showToast('Failed to export users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUserToDelete(userId);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUsersList((prev: User[]) => prev.filter((user: User) => user.id !== userToDelete));
      showToast('User deleted successfully!', 'success');
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error) {
      showToast('Failed to delete user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userId: string) => {
    const user = usersList.find(u => u.id === userId);
    if (user) {
      setUserToEdit(user);
      setShowEditUserModal(true);
    }
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsersList((prev: User[]) => 
      prev.map((user: User) => 
        user.id === updatedUser.id ? updatedUser : user
      )
    );
    showToast('User updated successfully!', 'success');
    setShowEditUserModal(false);
    setUserToEdit(null);
  };

  const handleMoreOptions = (userId: string) => {
    const user = usersList.find(u => u.id === userId);
    if (user) {
      // For now, show a menu with common actions
      const actions = [
        'Reset Password',
        'Send Welcome Email',
        'View Activity Log',
        'Duplicate User',
        'Export User Data'
      ];
      
      const action = prompt(`Select action for ${user.name}:\n${actions.map((a, i) => `${i+1}. ${a}`).join('\n')}\n\nEnter number (1-${actions.length}):`);
      
      if (action && parseInt(action) >= 1 && parseInt(action) <= actions.length) {
        const selectedAction = actions[parseInt(action) - 1];
        showToast(`${selectedAction} for ${user.name} - Feature coming soon!`, 'info');
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Monitor learner progress, assign courses, and manage user accounts</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterOrg}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterOrg(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Organizations</option>
                {organizationFilters.map(org => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedUsers.length > 0 && (
              <div className="flex items-center space-x-2">
                <LoadingButton
                  onClick={handleSendReminder}
                  loading={loading}
                  variant="primary"
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Mail className="h-4 w-4" />
                  Send Reminder ({selectedUsers.length})
                </LoadingButton>
                <LoadingButton
                  onClick={handleAssignCourse}
                  loading={loading}
                  variant="success"
                >
                  Assign Course
                </LoadingButton>
              </div>
            )}
            <LoadingButton
              onClick={handleAddUser}
              variant="primary"
            >
              <Plus className="h-4 w-4" />
              Add User
            </LoadingButton>
            <LoadingButton
              onClick={handleImportCSV}
              variant="secondary"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </LoadingButton>
            <LoadingButton
              onClick={handleExport}
              loading={loading}
              variant="secondary"
            >
              <Download className="h-4 w-4" />
              Export
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                </th>
                <th className="text-left py-4 px-6 font-semibold text-gray-900">User</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-900">Organization</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-900">Progress</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-900">Modules</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-900">Status</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-900">Last Login</th>
                <th className="text-center py-4 px-6 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user: User) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      <div className="text-xs text-gray-500">{user.role}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div>
                      <div className="font-medium text-gray-900">{user.organization}</div>
                      <div className="text-sm text-gray-600">{user.cohort}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex flex-col items-center">
                      <div className="text-lg font-bold text-gray-900">{user.overallProgress}%</div>
                      <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                          style={{ width: `${user.overallProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="text-sm">
                      <span className="font-medium">{user.completedModules}</span>
                      <span className="text-gray-500">/{user.totalModules}</span>
                    </div>
                    <div className="flex justify-center space-x-1 mt-1">
                      {modules.map((module) => (
                        <div
                          key={module.key}
                          className={`w-3 h-3 rounded-full ${
                            user.progress[module.key as keyof typeof user.progress] === 100
                              ? 'bg-green-500'
                              : user.progress[module.key as keyof typeof user.progress] > 0
                              ? 'bg-yellow-500'
                              : 'bg-gray-300'
                          }`}
                          title={`${module.name}: ${user.progress[module.key as keyof typeof user.progress]}%`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {getStatusIcon(user.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center text-sm text-gray-600">
                    {new Date(user.lastLogin).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Link 
                        to={`/admin/users/user-${user.id}`}
                        className="p-1 text-blue-600 hover:text-blue-800" 
                        title="View Profile"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button 
                        onClick={() => handleEditUser(user.id)}
                        className="p-1 text-gray-600 hover:text-gray-800 transition-colors" 
                        title="Edit User"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1 text-red-600 hover:text-red-800 transition-colors" 
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleMoreOptions(user.id)}
                        className="p-1 text-gray-600 hover:text-gray-800 transition-colors" 
                        title="More Options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-blue-600">{filteredUsers.length}</div>
          <div className="text-sm text-gray-600">Total Users</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-green-600">
            {filteredUsers.filter((u: User) => u.status === 'active').length}
          </div>
          <div className="text-sm text-gray-600">Active Users</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {Math.round(filteredUsers.reduce((acc: number, user: User) => acc + user.overallProgress, 0) / filteredUsers.length) || 0}%
          </div>
          <div className="text-sm text-gray-600">Avg. Progress</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {filteredUsers.filter((u: User) => u.feedbackSubmitted).length}
          </div>
          <div className="text-sm text-gray-600">Feedback Submitted</div>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onUserAdded={handleUserAdded}
      />

      <CourseAssignmentModal
        isOpen={showCourseAssignModal}
        onClose={() => setShowCourseAssignModal(false)}
        selectedUsers={selectedUsers}
        courseOptions={courseOptions}
        availableOrganizations={organizations.map(org => ({ id: org.id, name: org.name, contactEmail: org.contactEmail }))}
        availableUsers={usersList.map(user => ({ id: user.id, name: user.name, email: user.email, organization: user.organization }))}
        onAssignComplete={handleCourseAssignComplete}
      />

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone and will remove all their progress data."
        confirmText="Delete User"
        type="danger"
        loading={loading}
      />

      {/* Edit User Modal */}
      {showEditUserModal && userToEdit && (
        <AddUserModal
          isOpen={showEditUserModal}
          onClose={() => {
            setShowEditUserModal(false);
            setUserToEdit(null);
          }}
          onUserAdded={handleUserUpdated}
          editUser={userToEdit}
        />
      )}
    </div>
  );
};

export default AdminUsers;
