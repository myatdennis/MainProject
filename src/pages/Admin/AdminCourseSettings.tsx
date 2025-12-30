import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { useToast } from '../../context/ToastContext';

const AdminCourseSettings: React.FC = () => {
  const { showToast } = useToast();
  const { courseId } = useParams();
  const course = courseId ? courseStore.getCourse(courseId) : null;

  if (!course) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Course Not Found</h1>
        <Link to="/admin/courses" className="text-orange-500 hover:text-orange-600">
          ← Back to Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link 
          to="/admin/courses" 
          className="text-sm text-orange-500 hover:text-orange-600 mb-4 inline-block"
        >
          ← Back to Courses
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Course Settings</h1>
        <p className="text-gray-600">Configure settings for "{course.title}"</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="space-y-6">
          {/* Basic Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="published" selected={course.status === 'published'}>Published</option>
                  <option value="draft" selected={course.status === 'draft'}>Draft</option>
                  <option value="archived" selected={course.status === 'archived'}>Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="Beginner" selected={course.difficulty === 'Beginner'}>Beginner</option>
                  <option value="Intermediate" selected={course.difficulty === 'Intermediate'}>Intermediate</option>
                  <option value="Advanced" selected={course.difficulty === 'Advanced'}>Advanced</option>
                </select>
              </div>
            </div>
          </div>

          {/* Access Control */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Control</h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">Require enrollment approval</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">Allow self-enrollment</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">Track completion certificates</span>
              </label>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">Notify on enrollment</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">Send progress reminders</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">Email completion certificates</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Link 
              to="/admin/courses"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button 
              onClick={() => showToast('Course settings saved.', 'success')}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCourseSettings;