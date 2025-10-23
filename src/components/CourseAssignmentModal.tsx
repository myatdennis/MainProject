import React, { useEffect, useMemo, useState } from 'react';
import { X, BookOpen, Users, Building2, Bell } from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
import type { CourseAssignmentRequest } from '../types/assignment';

type CourseOption = { id: string; title: string; duration?: string };

type OrganizationOption = { id: string; name: string; contactEmail?: string };
type UserOption = { id: string; name: string; email?: string; organization?: string };

interface CourseAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: string[];
  course?: CourseOption;
  courseOptions?: CourseOption[];
  availableOrganizations?: OrganizationOption[];
  availableUsers?: UserOption[];
  onAssignComplete?: (assignment: Omit<CourseAssignmentRequest, 'assignedBy'>) => Promise<void> | void;
}

const fallbackCourses: CourseOption[] = [
  { id: '1', title: 'Foundations of Inclusive Leadership', duration: '4 weeks' },
  { id: '2', title: 'Recognizing and Mitigating Bias', duration: '3 weeks' },
  { id: '3', title: 'Empathy in Action', duration: '3 weeks' },
  { id: '4', title: 'Courageous Conversations at Work', duration: '5 weeks' },
  { id: '5', title: 'Personal & Team Action Planning', duration: '2 weeks' },
];

const CourseAssignmentModal: React.FC<CourseAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  course: initialCourse,
  courseOptions,
  availableOrganizations = [],
  availableUsers = [],
  onAssignComplete,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourse?.id || '');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(selectedUsers || []);
  const [notifyLearners, setNotifyLearners] = useState(true);
  const [message, setMessage] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const courseChoices = useMemo(() => {
    const map = new Map<string, CourseOption>();

    if (initialCourse) {
      map.set(initialCourse.id, initialCourse);
    }

    (courseOptions || []).forEach(option => {
      map.set(option.id, option);
    });

    if (map.size === 0) {
      fallbackCourses.forEach(course => map.set(course.id, course));
    }

    return Array.from(map.values());
  }, [courseOptions, initialCourse]);

  const selectedCourse = useMemo(
    () => courseChoices.find(option => option.id === selectedCourseId) ?? courseChoices[0],
    [courseChoices, selectedCourseId],
  );

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return availableUsers;
    const searchTerm = userSearch.trim().toLowerCase();
    return availableUsers.filter(user =>
      user.name.toLowerCase().includes(searchTerm) ||
      (user.email && user.email.toLowerCase().includes(searchTerm)) ||
      (user.organization && user.organization.toLowerCase().includes(searchTerm)),
    );
  }, [availableUsers, userSearch]);

  useEffect(() => {
    if (!isOpen) return;

    const defaultCourseId = initialCourse?.id || courseChoices[0]?.id || '';
    setSelectedCourseId(defaultCourseId);
    setAssignmentDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setSelectedOrganizationIds([]);
    setSelectedUserIds(selectedUsers || []);
    setNotifyLearners(true);
    setMessage('');
    setUserSearch('');
  }, [isOpen, initialCourse, courseChoices, selectedUsers]);

  if (!isOpen) return null;

  const handleToggleOrganization = (orgId: string) => {
    setSelectedOrganizationIds(prev =>
      prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId],
    );
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
  };

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedCourse) {
      showToast('Please select a course to assign', 'error');
      return;
    }

    if (selectedOrganizationIds.length === 0 && selectedUserIds.length === 0) {
      showToast('Select at least one organization or learner', 'error');
      return;
    }

    setLoading(true);

    try {
      const payload: Omit<CourseAssignmentRequest, 'assignedBy'> = {
        courseId: selectedCourse.id,
        courseTitle: selectedCourse.title,
        assignmentDate,
        dueDate: dueDate || undefined,
        organizationIds: selectedOrganizationIds,
        userIds: selectedUserIds,
        message: message.trim() ? message.trim() : undefined,
        notifyLearners,
      };

      await Promise.resolve(onAssignComplete?.(payload));
      onClose();
    } catch (error) {
      console.error('Failed to assign course', error);
      showToast('Failed to assign course', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalSelected = selectedOrganizationIds.length + selectedUserIds.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Assign Course</h2>
              <p className="text-sm text-gray-600">
                Assign course to {totalSelected} recipient{totalSelected === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            disabled={loading}
            aria-label="Close assignment modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleAssign} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Course *</label>
              <select
                value={selectedCourse?.id || selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
                disabled={loading || courseChoices.length === 0}
              >
                {courseChoices.map(courseOption => (
                  <option key={courseOption.id} value={courseOption.id}>
                    {courseOption.title}{courseOption.duration ? ` (${courseOption.duration})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Date</label>
                <input
                  type="date"
                  value={assignmentDate}
                  onChange={(event) => setAssignmentDate(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date (Optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  min={assignmentDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Organizations</label>
                <span className="text-xs text-gray-500">
                  {selectedOrganizationIds.length} selected
                </span>
              </div>
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                {availableOrganizations.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No organizations available</div>
                ) : (
                  availableOrganizations.map(organization => (
                    <label
                      key={organization.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-gray-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{organization.name}</div>
                          {organization.contactEmail && (
                            <div className="text-xs text-gray-500">{organization.contactEmail}</div>
                          )}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedOrganizationIds.includes(organization.id)}
                        onChange={() => handleToggleOrganization(organization.id)}
                        className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        disabled={loading}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Learners</label>
                <span className="text-xs text-gray-500">{selectedUserIds.length} selected</span>
              </div>
              <input
                type="text"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search learners by name, email, or organization"
                className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading || availableUsers.length === 0}
              />
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No learners match the search filters</div>
                ) : (
                  filteredUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-gray-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">
                            {[user.email, user.organization].filter(Boolean).join(' • ')}
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => handleToggleUser(user.id)}
                        className="h-4 w-4 text-green-600 border-gray-300 rounded"
                        disabled={loading}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Personal message (optional)</label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share context or expectations for this course assignment"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={4}
                disabled={loading}
              />
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-blue-500 mt-1" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Notifications</h4>
                  <p className="text-xs text-blue-700">
                    Learners receive instant email notifications when this assignment is saved. Toggle below to disable emails.
                  </p>
                </div>
              </div>
              <label className="flex items-center justify-between bg-white border border-blue-100 rounded-lg px-3 py-2">
                <span className="text-sm text-blue-900">Send notification emails</span>
                <input
                  type="checkbox"
                  checked={notifyLearners}
                  onChange={(event) => setNotifyLearners(event.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  disabled={loading}
                />
              </label>
              <div className="text-xs text-blue-600">
                {totalSelected === 0
                  ? 'Select at least one organization or learner to enable assignment.'
                  : `Ready to assign to ${totalSelected} recipient${totalSelected === 1 ? '' : 's'}.`}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={loading}
              variant="success"
              disabled={totalSelected === 0}
            >
              <BookOpen className="h-4 w-4" />
              Assign Course
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseAssignmentModal;

