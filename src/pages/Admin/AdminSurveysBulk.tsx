import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const AdminSurveysBulk: React.FC = () => {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get('ids') || '';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Bulk Survey Actions</h1>
      <p className="text-gray-600 mb-4">Perform bulk actions on the following survey IDs:</p>
      <pre className="bg-gray-100 p-4 rounded">{ids}</pre>
      <div className="mt-6">
        <Link to="/admin/surveys" className="text-sm text-orange-500">← Back to Surveys</Link>
      </div>
    </div>
  );
};

export default AdminSurveysBulk;
