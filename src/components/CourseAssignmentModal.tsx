import React, { useState } from 'react';
import { X, BookOpen, Users } from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';

interface CourseAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: string[];
  course?: { id: string; title: string; duration: string };
  onAssignComplete?: (assignmentData?: any) => void;
}

const CourseAssignmentModal: React.FC<CourseAssignmentModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedUsers,
  course: _course,
  onAssignComplete 
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');

  const courses = [
    { id: '1', title: 'Foundations of Inclusive Leadership', duration: '4 weeks' },
    { id: '2', title: 'Recognizing and Mitigating Bias', duration: '3 weeks' },
    { id: '3', title: 'Empathy in Action', duration: '3 weeks' },
    { id: '4', title: 'Courageous Conversations at Work', duration: '5 weeks' },
    { id: '5', title: 'Personal & Team Action Planning', duration: '2 weeks' }
  ];

  if (!isOpen) return null;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourse) {
      showToast('Please select a course to assign', 'error');
      return;
    }

    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const courseName = courses.find(c => c.id === selectedCourse)?.title;
      showToast(`${courseName} assigned to ${selectedUsers.length} user(s)`, 'success');
      
      onAssignComplete?.();
      onClose();
    } catch (error) {
      showToast('Failed to assign course', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Assign Course</h2>
              <p className="text-sm text-gray-600">Assign course to {selectedUsers.length} user(s)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAssign} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Course *
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
              disabled={loading}
            >
              <option value="">Choose a course...</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title} ({course.duration})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Date
              </label>
              <input
                type="date"
                value={assignmentDate}
                onChange={(e) => setAssignmentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={assignmentDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <Users className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Assignment Details</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Selected users will receive email notifications about their course assignment and can begin immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
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