import React from 'react';
import { useParams, Link } from 'react-router-dom';

const LMSMeeting: React.FC = () => {
  const { sessionId } = useParams();

  return (
    <div className="p-6 max-w-4xl mx-auto text-center">
      <h1 className="text-2xl font-bold mb-4">Join Meeting</h1>
      <p className="text-gray-700 mb-6">This is a placeholder meeting page for session <strong>{sessionId || 'unknown'}</strong>.</p>
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <p className="text-gray-600 mb-4">When integrated with a conferencing provider this page will contain the meeting join button and instructions.</p>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); alert('Opening meeting (mock)'); }}
          className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          Join Meeting
        </a>
      </div>

      <Link to="/lms/dashboard" className="text-sm text-orange-500">← Back to Dashboard</Link>
    </div>
  );
};

export default LMSMeeting;
