import React, { useEffect, useMemo, useState } from 'react';
import { X, BookOpen, Users, Send } from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
import { addAssignments } from '../utils/assignmentStorage';
import { courseStore } from '../store/courseStore';
import type { CourseAssignment } from '../types/assignment';

interface CourseAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUsers: string[];
  course?: { id: string; title: string; duration?: string };
  onAssignComplete?: (assignmentData?: CourseAssignment[]) => void;
}

const CourseAssignmentModal: React.FC<CourseAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedUsers,
  course,
  onAssignComplete,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(course?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [emailList, setEmailList] = useState(selectedUsers.join('\n'));

  useEffect(() => {
    setSelectedCourseId(course?.id ?? '');
  }, [course?.id]);

  useEffect(() => {
    setEmailList((prev) => {
      if (!isOpen) return prev;
      return selectedUsers.join('\n');
    });
  }, [selectedUsers, isOpen]);

  const availableCourses = useMemo(() => {
    if (course) {
      return [course];
    }
    return courseStore.getAllCourses().map((entry) => {
      const durationLabel = entry.duration || (entry.estimatedDuration ? `${entry.estimatedDuration} min` : '');
      return {
        id: entry.id,
        title: entry.title,
        duration: durationLabel,
      };
    });
  }, [course, isOpen]);

  if (!isOpen) return null;

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();

    const targetCourseId = course?.id ?? selectedCourseId;
    if (!targetCourseId) {
      showToast('Pick a course before sending Huddle invites.', 'error');
      return;
    }

    const recipients = emailList
      .split(/\n|,|;/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (recipients.length === 0) {
      showToast('Add at least one email or user ID', 'error');
      return;
    }

    setLoading(true);
    try {
      const assignments = await addAssignments(targetCourseId, recipients, {
        dueDate: dueDate || undefined,
        note: note || undefined,
      });

      if (onAssignComplete) {
        onAssignComplete(assignments);
      } else {
        showToast(
          `Assignments sent to ${assignments.length} learner${assignments.length === 1 ? '' : 's'}. Huddle notifications are on the way.`,
          'success'
        );
      }
      setEmailList('');
      setNote('');
      setDueDate('');
      if (!course) {
        setSelectedCourseId('');
      }
      onClose();
    } catch (error) {
      console.error('[CourseAssignmentModal] Failed to assign course:', error);
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      showToast(
        offline
          ? 'Huddle can’t reach the network right now. We saved your request—try again when you’re back online.'
          : 'We hit a snag assigning this course. Please try again in a moment.',
        'error'
      );
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
              <p className="text-sm text-gray-600">
                {selectedUsers.length > 0
                  ? `Prefilled with ${selectedUsers.length} selected user(s)`
                  : 'Paste learner emails or IDs below'}
              </p>
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
          {!course && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select course *</label>
              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
                disabled={loading}
              >
                <option value="">Choose a course...</option>
                {availableCourses.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title} {entry.duration ? `(${entry.duration})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {course && (
            <div className="rounded-lg border border-mist bg-softwhite/60 px-4 py-3 text-sm text-slate/80">
              Assigning <span className="font-semibold text-charcoal">{course.title}</span>
              {course.duration && <span className="ml-1">({course.duration})</span>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Learner emails or IDs *</label>
            <textarea
              value={emailList}
              onChange={(event) => setEmailList(event.target.value)}
              placeholder="team@inclusive.org\nlearner@huddle.co"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={5}
              required
              disabled={loading}
            />
            <p className="mt-1 text-xs text-slate/70">Separate multiple entries with commas or line breaks.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Note to learners</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={3}
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
                  Learners receive notifications immediately. Progress syncs with analytics and the client portal dashboard.
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
            <LoadingButton type="submit" loading={loading} variant="success">
              <Send className="h-4 w-4" />
              Assign course
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseAssignmentModal;