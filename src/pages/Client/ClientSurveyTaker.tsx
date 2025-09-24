import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  BookOpen
} from 'lucide-react';
import { getSurveyById } from '../../services/surveyService';
import clientPortalService from '../../services/clientPortalService';
import type { Survey, SurveyQuestion } from '../../types/survey';
import type { ClientSurveySession, SurveyResponse } from '../../types/clientPortal';

const ClientSurveyTaker = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [session, setSession] = useState<ClientSurveySession | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);

  useEffect(() => {
    if (!surveyId) return;

    const loadSurvey = async () => {
      try {
        // Load survey data
        const surveyData = await getSurveyById(surveyId);
        if (!surveyData) {
          navigate('/client/surveys');
          return;
        }
        setSurvey(surveyData);

        // Load or create session
        let existingSession = await clientPortalService.getSurveySession(surveyId);
        if (!existingSession) {
          existingSession = {
            surveyId,
            userId: 'user-001', // In real app, get from auth context
            organizationId: 'org-001',
            responses: {},
            status: 'not-started',
            currentSectionIndex: 0,
            currentQuestionIndex: 0
          };
        }
        
        setSession(existingSession);
        setCurrentSectionIndex(existingSession.currentSectionIndex || 0);
        setCurrentQuestionIndex(existingSession.currentQuestionIndex || 0);

      } catch (error) {
        console.error('Error loading survey:', error);
        navigate('/client/surveys');
      } finally {
        setLoading(false);
      }
    };

    loadSurvey();
  }, [surveyId, navigate]);

  const getCurrentSection = () => {
    return survey?.sections[currentSectionIndex] || null;
  };

  const getCurrentQuestion = () => {
    const section = getCurrentSection();
    return section?.questions[currentQuestionIndex] || null;
  };

  const getTotalQuestions = () => {
    return survey?.sections.reduce((total, section) => total + section.questions.length, 0) || 0;
  };

  const getAnsweredQuestions = () => {
    return Object.keys(session?.responses || {}).length;
  };

  const getProgress = () => {
    const total = getTotalQuestions();
    const answered = getAnsweredQuestions();
    return total > 0 ? (answered / total) * 100 : 0;
  };

  const saveResponse = async (questionId: string, answer: any) => {
    if (!session) return;

    const response: SurveyResponse = {
      questionId,
      answer,
      answeredAt: new Date().toISOString()
    };

    const updatedResponses = {
      ...session.responses,
      [questionId]: response
    };

    const updatedSession: ClientSurveySession = {
      ...session,
      responses: updatedResponses,
      status: 'in-progress',
      currentSectionIndex,
      currentQuestionIndex,
      lastSavedAt: new Date().toISOString()
    };

    if (!session.startedAt) {
      updatedSession.startedAt = new Date().toISOString();
    }

    setSession(updatedSession);
    await clientPortalService.saveSurveySession(updatedSession);
  };

  const saveAndContinue = async () => {
    if (!session) return;

    setSaving(true);
    try {
      await clientPortalService.saveSurveyResponse(surveyId!, session.responses);
      await clientPortalService.saveSurveySession(session);
    } catch (error) {
      console.error('Error saving survey:', error);
    } finally {
      setSaving(false);
    }
  };

  const nextQuestion = () => {
    const section = getCurrentSection();
    if (!section) return;

    if (currentQuestionIndex < section.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentSectionIndex < (survey?.sections.length || 0) - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      const prevSection = survey?.sections[currentSectionIndex - 1];
      if (prevSection) {
        setCurrentQuestionIndex(prevSection.questions.length - 1);
      }
    }
  };

  const isLastQuestion = () => {
    const section = getCurrentSection();
    return currentSectionIndex === (survey?.sections.length || 0) - 1 && 
           currentQuestionIndex === (section?.questions.length || 0) - 1;
  };

  const canGoNext = () => {
    const question = getCurrentQuestion();
    if (!question || !session) return false;
    
    // Check if current question is required and answered
    if (question.required) {
      return session.responses[question.id] !== undefined;
    }
    return true;
  };

  const submitSurvey = async () => {
    if (!session || !surveyId) return;

    setSaving(true);
    try {
      const finalSession: ClientSurveySession = {
        ...session,
        status: 'completed',
        completedAt: new Date().toISOString()
      };

      await clientPortalService.saveSurveyResponse(surveyId, session.responses);
      await clientPortalService.saveSurveySession(finalSession);
      await clientPortalService.markSurveyCompleted(surveyId);

      navigate(`/client/surveys/${surveyId}/completed`);
    } catch (error) {
      console.error('Error submitting survey:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderQuestionInput = (question: SurveyQuestion) => {
    if (!session) return null;

    const currentAnswer = session.responses[question.id]?.answer;

    switch (question.type) {
      case 'multiple-choice':
        return (
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type={question.allowMultiple ? 'checkbox' : 'radio'}
                  name={question.id}
                  value={option}
                  checked={question.allowMultiple 
                    ? Array.isArray(currentAnswer) && currentAnswer.includes(option)
                    : currentAnswer === option}
                  onChange={(e) => {
                    if (question.allowMultiple) {
                      const current = Array.isArray(currentAnswer) ? currentAnswer : [];
                      const newAnswer = e.target.checked
                        ? [...current, option]
                        : current.filter(item => item !== option);
                      saveResponse(question.id, newAnswer);
                    } else {
                      saveResponse(question.id, option);
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'likert-scale':
        if (!question.scale) return null;
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{question.scale.minLabel}</span>
              <span>{question.scale.maxLabel}</span>
            </div>
            <div className="flex items-center space-x-4">
              {Array.from({ length: question.scale.max - question.scale.min + 1 }, (_, i) => {
                const value = question.scale!.min + i;
                return (
                  <label key={value} className="flex flex-col items-center space-y-2 cursor-pointer">
                    <input
                      type="radio"
                      name={question.id}
                      value={value}
                      checked={currentAnswer === value}
                      onChange={() => saveResponse(question.id, value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-900">{value}</span>
                  </label>
                );
              })}
            </div>
            {question.scale.midLabel && (
              <div className="text-center text-sm text-gray-600">
                {question.scale.midLabel}
              </div>
            )}
          </div>
        );

      case 'open-ended':
        return (
          <textarea
            value={currentAnswer || ''}
            onChange={(e) => saveResponse(question.id, e.target.value)}
            placeholder="Enter your response..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        );

      case 'ranking':
        // Simplified ranking - could be enhanced with drag-and-drop
        return (
          <div className="space-y-3">
            {question.rankingItems?.map((item, index) => (
              <div key={index} className="flex items-center space-x-3">
                <select
                  value={Array.isArray(currentAnswer) ? currentAnswer.indexOf(item) + 1 || '' : ''}
                  onChange={(e) => {
                    const rank = parseInt(e.target.value);
                    const current = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
                    
                    // Remove item from its current position
                    const filtered = current.filter(i => i !== item);
                    
                    if (rank > 0) {
                      // Insert at new position
                      filtered.splice(rank - 1, 0, item);
                    }
                    
                    saveResponse(question.id, filtered);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-</option>
                  {question.rankingItems?.map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="text-gray-500 italic">
            Question type "{question.type}" not implemented yet.
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (!survey || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Survey not found or unable to load.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = getCurrentQuestion();
  const currentSection = getCurrentSection();

  if (!currentQuestion || !currentSection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No questions available in this survey.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowConfirmExit(true)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{survey.title}</h1>
                <p className="text-sm text-gray-600">
                  Section {currentSectionIndex + 1} of {survey.sections.length} • 
                  Question {currentQuestionIndex + 1} of {currentSection.questions.length}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {Math.round(getProgress())}% Complete
              </div>
              <button
                onClick={saveAndContinue}
                disabled={saving}
                className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 rounded-full h-2 transition-all duration-300" 
                style={{ width: `${getProgress()}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-8">
            {/* Section Title */}
            {currentSectionIndex !== (session.currentSectionIndex || 0) && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <h2 className="text-lg font-semibold text-blue-900">{currentSection.title}</h2>
                {currentSection.description && (
                  <p className="text-blue-700 mt-1">{currentSection.description}</p>
                )}
              </div>
            )}

            {/* Question */}
            <div className="mb-8">
              <div className="flex items-start space-x-3 mb-6">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {getAnsweredQuestions() + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {currentQuestion.title}
                    {currentQuestion.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </h3>
                  {currentQuestion.description && (
                    <p className="text-gray-600 mb-4">{currentQuestion.description}</p>
                  )}
                </div>
              </div>

              {/* Answer Input */}
              <div className="pl-11">
                {renderQuestionInput(currentQuestion)}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                onClick={previousQuestion}
                disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              <div className="text-sm text-gray-500">
                {getAnsweredQuestions()} of {getTotalQuestions()} questions answered
              </div>

              {isLastQuestion() ? (
                <button
                  onClick={submitSurvey}
                  disabled={saving || !canGoNext()}
                  className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{saving ? 'Submitting...' : 'Submit Survey'}</span>
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  disabled={!canGoNext()}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showConfirmExit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="h-6 w-6 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-900">Exit Survey?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Your progress will be saved, but you'll need to return later to complete the survey.
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  saveAndContinue();
                  navigate('/client/surveys');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Save & Exit
              </button>
              <button
                onClick={() => setShowConfirmExit(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Continue Survey
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSurveyTaker;