import React from 'react';
import { Link } from 'react-router-dom';

const LMSDownloadsPackage: React.FC = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto text-center">
      <h1 className="text-2xl font-bold mb-4">Download Complete Package</h1>
      <p className="text-gray-700 mb-6">This is a placeholder page that would handle a large ZIP download and present download progress.</p>
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <button
          onClick={() => alert('Starting download (mock)')}
          className="inline-flex items-center bg-gradient-to-r from-orange-400 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-500 hover:to-red-600 transition-colors duration-200"
        >
          Download Complete Package (128.5 MB)
        </button>
      </div>
      <Link to="/lms/downloads" className="text-sm text-orange-500">← Back to Downloads</Link>
    </div>
  );
};

export default LMSDownloadsPackage;
