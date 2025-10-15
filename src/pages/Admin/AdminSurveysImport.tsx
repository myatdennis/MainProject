import React from 'react';
import { Link } from 'react-router-dom';

const AdminSurveysImport: React.FC = () => {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Import Surveys</h1>
      <p className="text-gray-600 mb-6">Upload CSV or JSON files to bulk create or update survey templates. This is a lightweight placeholder page — implement import logic when ready.</p>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-sm text-gray-500 mb-4">Choose a file to upload or paste survey JSON below.</p>
        <div className="border border-dashed border-gray-200 rounded p-6 text-center">
          <div className="text-gray-400">Drag & drop files here, or use the import tool in the admin console.</div>
        </div>
        <div className="mt-6 text-right">
          <Link to="/admin/surveys" className="text-sm text-orange-500">← Back to Surveys</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminSurveysImport;
