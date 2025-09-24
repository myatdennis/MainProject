import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CheckCircle,
  Award,
  BarChart3,
  Calendar,
  Share2,
  Download,
  ArrowRight,
  Star
} from 'lucide-react';
import { getSurveyById } from '../../services/surveyService';
import clientPortalService from '../../services/clientPortalService';
import type { Survey } from '../../types/survey';
import type { ClientSurveySession } from '../../types/clientPortal';

const ClientSurveyCompletion = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [session, setSession] = useState<ClientSurveySession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!surveyId) return;

    const loadData = async () => {
      try {
        const [surveyData, sessionData] = await Promise.all([
          getSurveyById(surveyId),
          clientPortalService.getSurveySession(surveyId)
        ]);
        
        setSurvey(surveyData);
        setSession(sessionData);
      } catch (error) {
        console.error('Error loading completion data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [surveyId]);

  const getTotalQuestions = () => {
    return survey?.sections.reduce((total, section) => total + section.questions.length, 0) || 0;
  };

  const getCompletionTime = () => {
    if (!session?.startedAt || !session?.completedAt) return null;
    
    const start = new Date(session.startedAt);
    const end = new Date(session.completedAt);
    const diffMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const shareResults = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Completed: ${survey?.title}`,
          text: `I just completed the ${survey?.title} survey!`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share failed:', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading completion details...</p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Survey not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Survey Completed!
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Thank you for completing the <strong>{survey.title}</strong>. 
            Your responses have been submitted successfully.
          </p>
        </div>

        {/* Completion Stats */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {Object.keys(session?.responses || {}).length}
              </div>
              <div className="text-gray-600">Questions Answered</div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {getCompletionTime() || 'N/A'}
              </div>
              <div className="text-gray-600">Completion Time</div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Award className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                100%
              </div>
              <div className="text-gray-600">Completion Rate</div>
            </div>
          </div>
        </div>

        {/* What Happens Next */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Star className="h-6 w-6 mr-3 text-orange-500" />
            What Happens Next?
          </h2>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-blue-600">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Processing Your Responses</h3>
                <p className="text-gray-600">
                  Your survey responses are being analyzed and will be included in the organizational report.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-blue-600">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Report Generation</h3>
                <p className="text-gray-600">
                  A comprehensive report will be generated for your organization's leadership team within 5-7 business days.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-blue-600">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Follow-up Actions</h3>
                <p className="text-gray-600">
                  You may receive follow-up resources, action items, or invitations to participate in focus groups based on your responses.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Stay Engaged</h3>
                <p className="text-gray-600">
                  Continue your learning journey with assigned courses and resources in your client portal.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Survey Details */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Survey Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Survey Type</div>
              <div className="text-gray-900">
                {survey.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Completed On</div>
              <div className="text-gray-900">
                {session?.completedAt ? new Date(session.completedAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Today'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Total Questions</div>
              <div className="text-gray-900">{getTotalQuestions()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Response ID</div>
              <div className="text-gray-900 font-mono text-sm">
                {session?.userId?.slice(-8) || 'N/A'}...
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/client/surveys"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium"
          >
            View All Surveys
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>

          <Link
            to="/client/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors duration-200 font-medium"
          >
            Return to Dashboard
          </Link>

          <button
            onClick={shareResults}
            className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors duration-200 font-medium"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Completion
          </button>
        </div>

        {/* Feedback */}
        <div className="text-center mt-12 p-6 bg-blue-50 rounded-xl">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Help Us Improve
          </h3>
          <p className="text-gray-600 mb-4">
            How was your survey experience? Your feedback helps us create better surveys.
          </p>
          <Link
            to="/client/feedback"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Provide Feedback
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ClientSurveyCompletion;