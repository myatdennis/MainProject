import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  BarChart3, 
  Settings, 
  Users, 
  Bot,
  FileText,
  Send,
  Target,
  Zap
} from 'lucide-react';
import { Survey, SurveyAssignment } from '../../types/survey';
import SurveyBuilder from './SurveyBuilder';
import SurveyDistribution from './SurveyDistribution';
import SurveyAnalyticsDashboard from './SurveyAnalyticsDashboard';
import AISurveyBot from './AISurveyBot';

interface DEISurveyPlatformProps {
  // Optional props for integration with existing admin portal
  organization?: string;
  userRole?: 'admin' | 'manager' | 'analyst';
}

const DEISurveyPlatform: React.FC<DEISurveyPlatformProps> = ({
  organization = 'Your Organization'
}) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'builder' | 'distribution' | 'analytics' | 'ai'>('dashboard');
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [assignments, setAssignments] = useState<SurveyAssignment[]>([]);
  const [showAIBot, setShowAIBot] = useState(false);

  // Mock data initialization
  useEffect(() => {
    setSurveys([
      {
        id: 'survey-1',
        title: 'Q1 2024 Workplace Climate Survey',
        description: 'Comprehensive assessment of inclusion, belonging, and psychological safety',
        status: 'published',
        createdBy: 'admin',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        sections: [],
        blocks: [
          {
            id: 'block-1',
            title: 'Workplace Experience',
            questions: [
              {
                id: 'q1',
                type: 'matrix-likert',
                title: 'Rate your agreement with the following statements:',
                required: true,
                order: 0,
                matrixRows: [
                  'I feel like I belong in this organization',
                  'My colleagues treat me with respect',
                  'I can be my authentic self at work'
                ],
                matrixColumns: [
                  'Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'
                ]
              }
            ]
          }
        ],
        settings: {
          anonymityMode: 'confidential',
          anonymityThreshold: 5,
          allowMultipleResponses: false,
          showProgressBar: true,
          consentRequired: true,
          allowAnonymous: true,
          allowSaveAndContinue: true,
          randomizeQuestions: false,
          randomizeOptions: false,
        },
        branding: {
          primaryColor: '#3A7DFF',
          secondaryColor: '#228B22',
        },
        defaultLanguage: 'en',
        supportedLanguages: ['en'],
        completionSettings: {
          thankYouMessage: 'Thank you for your valuable feedback!',
          showResources: true,
          recommendedCourses: [],
        }
      },
      {
        id: 'survey-2',
        title: 'Leadership Inclusion Assessment',
        description: 'Evaluating leadership effectiveness in creating inclusive environments',
        status: 'draft',
        createdBy: 'admin',
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-20'),
        sections: [],
        blocks: [],
        settings: {
          anonymityMode: 'anonymous',
          anonymityThreshold: 3,
          allowMultipleResponses: false,
          showProgressBar: true,
          consentRequired: true,
          allowAnonymous: true,
          allowSaveAndContinue: true,
          randomizeQuestions: false,
          randomizeOptions: false,
        },
        branding: {
          primaryColor: '#de7b12',
          secondaryColor: '#228B22',
        },
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'es'],
        completionSettings: {
          thankYouMessage: 'Your feedback helps us build better leadership!',
          showResources: false,
          recommendedCourses: [],
        }
      }
    ]);
  }, []);

  const handleCreateSurvey = () => {
    setSelectedSurvey(null);
    setActiveView('builder');
  };

  const handleEditSurvey = (survey: Survey) => {
    setSelectedSurvey(survey);
    setActiveView('builder');
  };

  const handleSaveSurvey = (survey: Survey) => {
    if (survey.id) {
      setSurveys(prev => prev.map(s => s.id === survey.id ? survey : s));
    } else {
      const newSurvey = {
        ...survey,
        id: `survey-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setSurveys(prev => [...prev, newSurvey]);
    }
    setActiveView('dashboard');
  };

  const handlePublishSurvey = (survey: Survey) => {
    const publishedSurvey = {
      ...survey,
      status: 'published' as const,
      updatedAt: new Date()
    };
    handleSaveSurvey(publishedSurvey);
    setSelectedSurvey(publishedSurvey);
    setActiveView('distribution');
  };

  const handleAssignmentSave = (assignment: SurveyAssignment) => {
    setAssignments(prev => [...prev, assignment]);
  };

  const getStatsForSurvey = (surveyId: string) => {
    const assignment = assignments.find(a => a.surveyId === surveyId);
    return {
      responses: assignment?.responses.total || 0,
      completed: assignment?.responses.completed || 0,
      rate: assignment?.responses.total ? 
        Math.round((assignment.responses.completed / assignment.responses.total) * 100) : 0
    };
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Platform Overview */}
      <div className="rounded-lg p-6 text-white" style={{ background: 'var(--gradient-banner)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">DEI Survey Platform</h1>
            <p className="text-white/90">Create, distribute, and analyze diversity, equity, and inclusion surveys with AI-powered insights</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{surveys.length}</div>
            <div className="text-white/80">Total Surveys</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {surveys.filter(s => s.status === 'published').length}
              </div>
              <div className="text-sm text-gray-600">Active Surveys</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {assignments.reduce((sum, a) => sum + a.responses.total, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Participants</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {assignments.reduce((sum, a) => sum + a.responses.completed, 0)}
              </div>
              <div className="text-sm text-gray-600">Completed Responses</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Target className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {assignments.length > 0 
                  ? Math.round(
                      assignments.reduce((sum, a) => sum + (a.responses.total > 0 ? (a.responses.completed / a.responses.total) : 0), 0) 
                      / assignments.length * 100
                    )
                  : 0
                }%
              </div>
              <div className="text-sm text-gray-600">Avg Response Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Surveys */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Surveys</h2>
            <button
              onClick={handleCreateSurvey}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Survey</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {surveys.length > 0 ? (
            surveys.map((survey) => {
              const stats = getStatsForSurvey(survey.id);
              return (
                <div key={survey.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold text-gray-900">{survey.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          survey.status === 'published' 
                            ? 'bg-green-100 text-green-800'
                            : survey.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {survey.status}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mt-1">{survey.description}</p>
                      <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                        <span>Created {typeof survey.createdAt === 'string' ? new Date(survey.createdAt).toLocaleDateString() : survey.createdAt.toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{survey.blocks.reduce((sum, block) => sum + block.questions.length, 0)} questions</span>
                        {stats.responses > 0 && (
                          <>
                            <span>•</span>
                            <span>{stats.completed}/{stats.responses} responses ({stats.rate}%)</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEditSurvey(survey)}
                        className="p-2 text-gray-600 hover:bg-gray-200 rounded"
                        title="Edit Survey"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      
                      {survey.status === 'published' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedSurvey(survey);
                              setActiveView('distribution');
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                            title="Manage Distribution"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedSurvey(survey);
                              setActiveView('analytics');
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-100 rounded"
                            title="View Analytics"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-text mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-text mb-2">No surveys yet</h3>
              <p className="text-subtext-muted mb-4">Get started by creating your first DEI survey from our research-backed templates</p>
              <button onClick={handleCreateSurvey} className="btn-primary inline-flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create Your First Survey</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant Prompt */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Survey Assistant</h3>
              <p className="text-sm text-gray-600">
                Get help creating questions, analyzing data, or improving your surveys
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveView('ai')}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
          >
            <Zap className="w-4 h-4" />
            <span>Open AI Assistant</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="font-semibold text-gray-900">DEI Survey Platform</h1>
                  <p className="text-xs text-gray-600">{organization}</p>
                </div>
              </div>
              
              <nav className="hidden md:flex space-x-8 ml-8">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md ${
                    activeView === 'dashboard'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>
                
                <button
                  onClick={() => setActiveView('builder')}
                  className={`flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md ${
                    activeView === 'builder'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Survey Builder</span>
                </button>
                
                <button
                  onClick={() => setActiveView('ai')}
                  className={`flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md ${
                    activeView === 'ai'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span>AI Assistant</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeView === 'dashboard' && renderDashboard()}
        
        {activeView === 'builder' && (
          <SurveyBuilder
            survey={selectedSurvey || undefined}
            onSave={handleSaveSurvey}
            onPublish={handlePublishSurvey}
          />
        )}
        
        {activeView === 'distribution' && selectedSurvey && (
          <SurveyDistribution
            surveyId={selectedSurvey.id}
            surveyTitle={selectedSurvey.title}
            onAssignmentSave={handleAssignmentSave}
          />
        )}
        
        {activeView === 'analytics' && selectedSurvey && (
          <SurveyAnalyticsDashboard surveyId={selectedSurvey.id} />
        )}
        
        {activeView === 'ai' && (
          <AISurveyBot
            surveyData={selectedSurvey ? {
              id: selectedSurvey.id,
              title: selectedSurvey.title,
              questions: selectedSurvey.blocks.flatMap(b => b.questions),
              responses: [] // Would be populated with actual response data
            } : undefined}
            onSuggestionApply={(suggestion) => {
              // Handle AI suggestions
              console.log('Applying AI suggestion:', suggestion);
            }}
          />
        )}
      </div>

      {/* AI Bot Toggle (floating) */}
      {activeView !== 'ai' && (
        <button
          onClick={() => setShowAIBot(!showAIBot)}
          className="fixed bottom-6 right-6 p-4 bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-600 transition-colors z-50"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Floating AI Bot */}
      {showAIBot && activeView !== 'ai' && (
        <div className="fixed bottom-20 right-6 w-96 h-96 bg-white border border-gray-200 rounded-lg shadow-2xl z-50">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-900">AI Assistant</span>
              </div>
              <button
                onClick={() => setShowAIBot(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AISurveyBot
                surveyData={selectedSurvey ? {
                  id: selectedSurvey.id,
                  title: selectedSurvey.title,
                  questions: selectedSurvey.blocks.flatMap(b => b.questions),
                  responses: []
                } : undefined}
                onSuggestionApply={(suggestion) => {
                  console.log('Applying AI suggestion:', suggestion);
                  setShowAIBot(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DEISurveyPlatform;