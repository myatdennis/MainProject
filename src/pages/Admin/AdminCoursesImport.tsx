import React from 'react';
import { Link } from 'react-router-dom';

const AdminCoursesImport: React.FC = () => {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Import Courses</h1>
      <p className="text-gray-600 mb-6">Upload course packages (JSON or ZIP) to bulk create or update courses. Placeholder page for now.</p>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-sm text-gray-500 mb-4">Drag & drop course packages here or connect to an external content source.</p>
        <div className="border border-dashed border-gray-200 rounded p-6 text-center">
          <div className="text-gray-400">Import area (not yet implemented)</div>
        </div>
        <div className="mt-6 text-right">
          <Link to="/admin/courses" className="text-sm text-orange-500">← Back to Courses</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminCoursesImport;
