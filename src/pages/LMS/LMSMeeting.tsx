import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Video, Calendar, ArrowLeft, Mail } from 'lucide-react';
import SEO from '../../components/SEO/SEO';

const LMSMeeting: React.FC = () => {
  const { sessionId } = useParams();

  return (
    <>
      <SEO title="Join Session" description="Join your scheduled learning session." />
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          to="/lms/dashboard"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 rounded-full p-4">
              <Video className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Live Session</h1>
          {sessionId && (
            <p className="text-sm text-gray-500 mb-4">Session ID: <code className="bg-gray-100 px-2 py-0.5 rounded">{sessionId}</code></p>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">Your session link will appear here</p>
                <p className="text-sm text-blue-700 mt-1">
                  When your facilitator starts the session, you will receive a join link via email. Please check your inbox or contact your administrator.
                </p>
              </div>
            </div>
          </div>

          <a
            href="mailto:support@huddle-co.com"
            className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            <Mail className="h-4 w-4" />
            Contact support for session details
          </a>
        </div>
      </div>
    </>
  );
};

export default LMSMeeting;
