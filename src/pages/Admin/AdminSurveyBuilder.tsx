import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  Settings,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  BarChart3,
  MessageSquare,
  Users,
  Grid3X3,
  ArrowUpDown,
  Palette,
  Target,
  Zap,
  Brain,
  Send,
  Building2,
  X
} from 'lucide-react';
import { surveyTemplates, questionTypes, defaultBranding, aiGeneratedQuestions, aiGeneratedQuestionsLegacy, censusDemographicOptions } from '../../data/surveyTemplates';
import { getAssignments, saveAssignments, saveSurvey as saveSurveyService, getSurveyById } from '../../services/surveyService';
import type { Survey, SurveyQuestion, SurveySection } from '../../types/survey';

const AdminSurveyBuilder = () => {
  const { surveyId } = useParams();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  const [draggedQuestion, setDraggedQuestion] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBranding, setShowBranding] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Organizations data (in a real app, this would come from an API)
  const organizations = [
    { id: '1', name: 'Pacific Coast University', type: 'University', learners: 45 },
    { id: '2', name: 'Mountain View High School', type: 'K-12 Education', learners: 23 },
    { id: '3', name: 'Community Impact Network', type: 'Nonprofit', learners: 28 },
    { id: '4', name: 'Regional Fire Department', type: 'Government', learners: 67 },
    { id: '5', name: 'TechForward Solutions', type: 'Corporate', learners: 34 },
    { id: '6', name: 'Regional Medical Center', type: 'Healthcare', learners: 89 },
    { id: '7', name: 'Unity Community Church', type: 'Religious', learners: 15 }
  ];

  useEffect(() => {
    if (surveyId && surveyId !== 'new') {
      // Load existing survey
      loadSurvey(surveyId);
    } else if (templateId) {
      // Create from template
      createFromTemplate(templateId);
    } else {
      // Create blank survey
      createBlankSurvey();
    }
  }, [surveyId, templateId]);

  const loadSurvey = (id: string) => {
    // Try local storage first
    (async () => {
      const local = await getSurveyById(id);
      if (local) {
        setSurvey(local);
        if (local.sections.length > 0) setActiveSection(local.sections[0].id);
        return;
      }

      // In a real app, this would load from database
      // For now, create a sample survey
    })();
    
    // Sample fallback (if no local)
    const sampleSurvey: Survey = {
      id,
      title: 'Q1 2025 Climate Assessment',
      description: 'Quarterly organizational climate and culture assessment',
      type: 'climate-assessment',
      status: 'draft',
      createdBy: 'Mya Dennis',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: [],
      branding: defaultBranding,
      settings: {
        allowAnonymous: true,
        allowSaveAndContinue: true,
        showProgressBar: true,
        randomizeQuestions: false,
        randomizeOptions: false,
        requireCompletion: false,
        accessControl: {
          requireLogin: false
        },
        notifications: {
          sendReminders: true,
          reminderSchedule: [3, 7, 14],
          completionNotification: true
        }
      },
      assignedTo: {
        organizationIds: [],
        userIds: [],
        cohortIds: []
      },
      totalInvites: 0,
      totalResponses: 0,
      completionRate: 0,
      avgCompletionTime: 0,
      reflectionPrompts: [
        "What's one change that would make you feel a stronger sense of belonging?",
        "How can leadership better support inclusion in your daily work?",
        "What would you like to see more of in our organization's culture?"
      ],
      generateHuddleReport: true,
      actionStepsEnabled: true,
      benchmarkingEnabled: true
    };
    setSurvey(sampleSurvey);
    if (sampleSurvey.sections.length > 0) {
      setActiveSection(sampleSurvey.sections[0].id);
    }

    // Load assignments from backend if available
    (async () => {
      const assignment = await getAssignments(id);
      if (assignment && assignment.organization_ids) {
        setSurvey(prev => prev ? { ...prev, assignedTo: { ...prev.assignedTo, organizationIds: assignment.organization_ids } } : prev);
      }
    })();
  };

  const createFromTemplate = (templateId: string) => {
    const template = surveyTemplates.find(t => t.id === templateId);
    if (!template) {
      createBlankSurvey();
      return;
    }

    const newSurvey: Survey = {
      id: `survey-${Date.now()}`,
      title: template.name,
      description: template.description,
      type: template.id as any,
      status: 'draft',
      createdBy: 'Mya Dennis',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: template.sections.map((section, index) => ({
        ...section,
        id: `section-${Date.now()}-${index}`,
        questions: section.questions.map((question, qIndex) => ({
          ...question,
          id: `question-${Date.now()}-${index}-${qIndex}`
        }))
      })),
      branding: defaultBranding,
      settings: {
        ...template.defaultSettings,
        accessControl: {
          requireLogin: false,
          ...template.defaultSettings?.accessControl
        },
        notifications: {
          sendReminders: true,
          reminderSchedule: [3, 7, 14],
          completionNotification: true,
          ...template.defaultSettings?.notifications
        }
      } as any,
      assignedTo: {
        organizationIds: [],
        userIds: [],
        cohortIds: []
      },
      totalInvites: 0,
      totalResponses: 0,
      completionRate: 0,
      avgCompletionTime: 0,
      reflectionPrompts: [
        "What's one change that would make you feel a stronger sense of belonging?",
        "How can leadership better support inclusion in your daily work?",
        "What would you like to see more of in our organization's culture?"
      ],
      generateHuddleReport: true,
      actionStepsEnabled: true,
      benchmarkingEnabled: true
    };

    setSurvey(newSurvey);
    if (newSurvey.sections.length > 0) {
      setActiveSection(newSurvey.sections[0].id);
    }
  };

  const createBlankSurvey = () => {
    const newSurvey: Survey = {
      id: `survey-${Date.now()}`,
      title: 'New Survey',
      description: 'Survey description',
      type: 'custom',
      status: 'draft',
      createdBy: 'Mya Dennis',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: [],
      branding: defaultBranding,
      settings: {
        allowAnonymous: true,
        allowSaveAndContinue: true,
        showProgressBar: true,
        randomizeQuestions: false,
        randomizeOptions: false,
        requireCompletion: false,
        accessControl: {
          requireLogin: false
        },
        notifications: {
          sendReminders: true,
          reminderSchedule: [3, 7, 14],
          completionNotification: true
        }
      },
      assignedTo: {
        organizationIds: [],
        userIds: [],
        cohortIds: []
      },
      totalInvites: 0,
      totalResponses: 0,
      completionRate: 0,
      avgCompletionTime: 0,
      reflectionPrompts: [
        "What's one change that would make you feel a stronger sense of belonging?"
      ],
      generateHuddleReport: true,
      actionStepsEnabled: true,
      benchmarkingEnabled: true
    };
    setSurvey(newSurvey);
  };

  const addSection = () => {
    if (!survey) return;
    
    const newSection: SurveySection = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      description: '',
      order: survey.sections.length + 1,
      questions: []
    };
    
    setSurvey(prev => prev ? {
      ...prev,
      sections: [...prev.sections, newSection],
      updatedAt: new Date().toISOString()
    } : null);
    
    setActiveSection(newSection.id);
  };

  const addQuestion = (sectionId: string, questionType: string) => {
    if (!survey) return;
    
    const section = survey.sections.find(s => s.id === sectionId);
    if (!section) return;

    const newQuestion: SurveyQuestion = {
      id: `question-${Date.now()}`,
      type: questionType as any,
      title: 'New Question',
      required: false,
      order: section.questions.length + 1,
      ...(questionType === 'multiple-choice' && {
        options: ['Option 1', 'Option 2', 'Option 3'],
        allowMultiple: false,
        allowOther: false
      }),
      ...(questionType === 'likert-scale' && {
        scale: {
          min: 1,
          max: 5,
          minLabel: 'Strongly Disagree',
          maxLabel: 'Strongly Agree',
          midLabel: 'Neutral'
        }
      }),
      ...(questionType === 'ranking' && {
        rankingItems: ['Item 1', 'Item 2', 'Item 3'],
        maxRankings: 3
      }),
      ...(questionType === 'matrix' && {
        matrixRows: ['Row 1', 'Row 2', 'Row 3'],
        matrixColumns: ['Column 1', 'Column 2', 'Column 3'],
        matrixType: 'single'
      }),
      ...(questionType === 'demographics' && {
        options: ['Option 1', 'Option 2', 'Option 3']
      })
    };

    setSurvey(prev => prev ? {
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId 
          ? { ...s, questions: [...s.questions, newQuestion] }
          : s
      ),
      updatedAt: new Date().toISOString()
    } : null);
  };

  // Drag and drop handlers for questions
  const onDragStart = (e: React.DragEvent, questionId: string) => {
    setDraggedQuestion(questionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, sectionId: string, targetQuestionId?: string) => {
    e.preventDefault();
    if (!survey || !draggedQuestion) return;

    setSurvey(prev => {
      if (!prev) return prev;
      const sections = prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        const questions = [...s.questions];
        const draggedIndex = questions.findIndex(q => q.id === draggedQuestion);
        if (draggedIndex === -1) return s;
        const [dq] = questions.splice(draggedIndex, 1);
        if (!targetQuestionId) {
          questions.push(dq);
        } else {
          const targetIndex = questions.findIndex(q => q.id === targetQuestionId);
          questions.splice(targetIndex === -1 ? questions.length : targetIndex, 0, dq);
        }
        // reassign orders
        const reordered = questions.map((q, i) => ({ ...q, order: i + 1 }));
        return { ...s, questions: reordered };
      });
      return { ...prev, sections, updatedAt: new Date().toISOString() };
    });
    setDraggedQuestion(null);
  };

  const updateQuestion = (sectionId: string, questionId: string, updates: Partial<SurveyQuestion>) => {
    if (!survey) return;
    
    setSurvey(prev => prev ? {
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId 
          ? {
              ...s,
              questions: s.questions.map(q => 
                q.id === questionId ? { ...q, ...updates } : q
              )
            }
          : s
      ),
      updatedAt: new Date().toISOString()
    } : null);
  };

  const deleteQuestion = (sectionId: string, questionId: string) => {
    if (!survey) return;
    
    setSurvey(prev => prev ? {
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId 
          ? { ...s, questions: s.questions.filter(q => q.id !== questionId) }
          : s
      ),
      updatedAt: new Date().toISOString()
    } : null);
  };

  const generateAIQuestions = () => {
    if (!survey || !activeSection) return;
    
    // Get the active section to understand context
    const currentSection = survey.sections.find(s => s.id === activeSection);
    if (!currentSection) return;

    // Determine the best AI questions based on survey type and section context
    let selectedQuestions: any[] = [];
    const sectionTitle = currentSection.title.toLowerCase();
    const surveyType = survey.type;
    
    // Smart context-aware question selection
    if (sectionTitle.includes('demographic') || sectionTitle.includes('background')) {
      selectedQuestions = aiGeneratedQuestions.demographics.slice(0, 3);
    } else if (sectionTitle.includes('microaggression') || sectionTitle.includes('bias')) {
      selectedQuestions = aiGeneratedQuestions.microaggressions.slice(0, 3);
    } else if (sectionTitle.includes('leadership') || sectionTitle.includes('management')) {
      selectedQuestions = aiGeneratedQuestions.leadership.slice(0, 3);
    } else if (sectionTitle.includes('equity') || sectionTitle.includes('fairness')) {
      selectedQuestions = aiGeneratedQuestions.equity.slice(0, 3);
    } else if (sectionTitle.includes('belonging') || sectionTitle.includes('inclusion')) {
      selectedQuestions = aiGeneratedQuestions.belonging.concat(aiGeneratedQuestions.inclusion).slice(0, 3);
    } else {
      // Default: select based on survey type
      switch (surveyType) {
        case 'climate-assessment':
          selectedQuestions = aiGeneratedQuestions.belonging.concat(aiGeneratedQuestions.inclusion).slice(0, 4);
          break;
        case 'inclusion-index':
          selectedQuestions = aiGeneratedQuestions.inclusion.slice(0, 4);
          break;
        case 'equity-lens':
          selectedQuestions = aiGeneratedQuestions.equity.slice(0, 4);
          break;
        default:
          // Mix of different categories for custom surveys
          selectedQuestions = [
            ...aiGeneratedQuestions.belonging.slice(0, 1),
            ...aiGeneratedQuestions.equity.slice(0, 1),
            ...aiGeneratedQuestions.inclusion.slice(0, 2)
          ];
      }
    }

    setAISuggestions(selectedQuestions);
    setShowAIModal(true);
  };

  const addSelectedAIQuestions = (selectedIndices: number[]) => {
    if (!survey || !activeSection) return;
    
    const currentSection = survey.sections.find(s => s.id === activeSection);
    if (!currentSection) return;

    // Convert selected suggestions to survey questions with proper IDs and order
    const questionsToAdd = selectedIndices.map((index, i) => {
      const template = aiSuggestions[index];
      return {
        ...template,
        id: `ai-question-${Date.now()}-${i}`,
        required: template.required ?? true,
        order: currentSection.questions.length + i + 1
      } as SurveyQuestion;
    });

    setSurvey(prev => prev ? {
      ...prev,
      sections: prev.sections.map(s => 
        s.id === activeSection 
          ? { ...s, questions: [...s.questions, ...questionsToAdd] }
          : s
      ),
      updatedAt: new Date().toISOString()
    } : null);

    setShowAIModal(false);
    setAISuggestions([]);
  };


  const saveSurvey = async () => {
    if (!survey) return;

    setIsSaving(true);
    try {
      // Persist assignments if present
      if (survey.assignedTo?.organizationIds && survey.assignedTo.organizationIds.length > 0) {
        try {
          await saveAssignments(survey.id, survey.assignedTo.organizationIds);
        } catch (err) {
          console.warn('Failed to save assignments during survey save', err);
        }
      }

      // Simulate saving other survey data (replace with real save API)
      // persist locally for now
      try {
        await saveSurveyService(survey);
      } catch (err) {
        console.warn('Local save failed', err);
      }

      // You could show a toast here to confirm save
      // console.log('Survey saved', survey.id);
    } finally {
      setIsSaving(false);
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'multiple-choice':
        return <CheckCircle className="h-5 w-5" />;
      case 'likert-scale':
        return <BarChart3 className="h-5 w-5" />;
      case 'ranking':
        return <ArrowUpDown className="h-5 w-5" />;
      case 'open-ended':
        return <MessageSquare className="h-5 w-5" />;
      case 'matrix':
        return <Grid3X3 className="h-5 w-5" />;
      case 'demographics':
        return <Users className="h-5 w-5" />;
      default:
        return <CheckCircle className="h-5 w-5" />;
    }
  };

  const renderQuestionEditor = (question: SurveyQuestion, sectionId: string) => {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, question.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, sectionId, question.id)}
        className="bg-white border border-gray-200 rounded-lg p-6 mb-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-100 p-2 rounded-lg">
              {getQuestionIcon(question.type)}
            </div>
            <div>
              <input
                type="text"
                value={question.title}
                onChange={(e) => updateQuestion(sectionId, question.id, { title: e.target.value })}
                className="font-medium text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1"
                placeholder="Question title"
              />
              <div className="text-sm text-gray-500 capitalize">{question.type.replace('-', ' ')}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => updateQuestion(sectionId, question.id, { required: e.target.checked })}
                className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">Required</span>
            </label>
            <button
              onClick={() => deleteQuestion(sectionId, question.id)}
              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <textarea
            value={question.description || ''}
            onChange={(e) => updateQuestion(sectionId, question.id, { description: e.target.value })}
            placeholder="Question description (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            rows={2}
          />
        </div>

        {/* Question Type Specific Editors */}
        {question.type === 'multiple-choice' && (
          <div className="space-y-3">
            <div className="flex items-center space-x-4 mb-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={question.allowMultiple || false}
                  onChange={(e) => updateQuestion(sectionId, question.id, { allowMultiple: e.target.checked })}
                  className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600">Allow multiple selections</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={question.allowOther || false}
                  onChange={(e) => updateQuestion(sectionId, question.id, { allowOther: e.target.checked })}
                  className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600">Allow "Other" option</span>
              </label>
            </div>
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(question.options || [])];
                    newOptions[index] = e.target.value;
                    updateQuestion(sectionId, question.id, { options: newOptions });
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder={`Option ${index + 1}`}
                />
                <button
                  onClick={() => {
                    const newOptions = question.options?.filter((_, i) => i !== index);
                    updateQuestion(sectionId, question.id, { options: newOptions });
                  }}
                  className="p-2 text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
                updateQuestion(sectionId, question.id, { options: newOptions });
              }}
              className="text-orange-500 hover:text-orange-600 text-sm font-medium"
            >
              + Add Option
            </button>
          </div>
        )}

        {question.type === 'likert-scale' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scale Range</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={question.scale?.min || 1}
                    onChange={(e) => updateQuestion(sectionId, question.id, {
                      scale: { ...question.scale!, min: parseInt(e.target.value) }
                    })}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    min="1"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="number"
                    value={question.scale?.max || 5}
                    onChange={(e) => updateQuestion(sectionId, question.id, {
                      scale: { ...question.scale!, max: parseInt(e.target.value) }
                    })}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    min="2"
                    max="10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Label</label>
                <input
                  type="text"
                  value={question.scale?.minLabel || ''}
                  onChange={(e) => updateQuestion(sectionId, question.id, {
                    scale: { ...question.scale!, minLabel: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="e.g., Strongly Disagree"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Label</label>
                <input
                  type="text"
                  value={question.scale?.maxLabel || ''}
                  onChange={(e) => updateQuestion(sectionId, question.id, {
                    scale: { ...question.scale!, maxLabel: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="e.g., Strongly Agree"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mid Label (Optional)</label>
                <input
                  type="text"
                  value={question.scale?.midLabel || ''}
                  onChange={(e) => updateQuestion(sectionId, question.id, {
                    scale: { ...question.scale!, midLabel: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="e.g., Neutral"
                />
              </div>
            </div>
          </div>
        )}

        {question.type === 'ranking' && (
          <div className="space-y-3">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Rankings</label>
              <input
                type="number"
                value={question.maxRankings || question.rankingItems?.length || 3}
                onChange={(e) => updateQuestion(sectionId, question.id, { maxRankings: parseInt(e.target.value) })}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                min="1"
                max={question.rankingItems?.length || 10}
              />
            </div>
            {question.rankingItems?.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(question.rankingItems || [])];
                    newItems[index] = e.target.value;
                    updateQuestion(sectionId, question.id, { rankingItems: newItems });
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder={`Ranking item ${index + 1}`}
                />
                <button
                  onClick={() => {
                    const newItems = question.rankingItems?.filter((_, i) => i !== index);
                    updateQuestion(sectionId, question.id, { rankingItems: newItems });
                  }}
                  className="p-2 text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newItems = [...(question.rankingItems || []), `Item ${(question.rankingItems?.length || 0) + 1}`];
                updateQuestion(sectionId, question.id, { rankingItems: newItems });
              }}
              className="text-orange-500 hover:text-orange-600 text-sm font-medium"
            >
              + Add Ranking Item
            </button>
          </div>
        )}

        {question.type === 'open-ended' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Length</label>
                <input
                  type="number"
                  value={question.validation?.minLength || ''}
                  onChange={(e) => updateQuestion(sectionId, question.id, {
                    validation: { ...question.validation, minLength: parseInt(e.target.value) || undefined }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="Minimum characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Length</label>
                <input
                  type="number"
                  value={question.validation?.maxLength || ''}
                  onChange={(e) => updateQuestion(sectionId, question.id, {
                    validation: { ...question.validation, maxLength: parseInt(e.target.value) || undefined }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="Maximum characters"
                />
              </div>
            </div>
          </div>
        )}

        {question.type === 'matrix' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Matrix Rows</label>
                <div className="space-y-2">
                  {question.matrixRows?.map((row, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={row}
                        onChange={(e) => {
                          const newRows = [...(question.matrixRows || [])];
                          newRows[index] = e.target.value;
                          updateQuestion(sectionId, question.id, { matrixRows: newRows });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        placeholder={`Row ${index + 1}`}
                      />
                      <button
                        onClick={() => {
                          const newRows = question.matrixRows?.filter((_, i) => i !== index);
                          updateQuestion(sectionId, question.id, { matrixRows: newRows });
                        }}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newRows = [...(question.matrixRows || []), `Row ${(question.matrixRows?.length || 0) + 1}`];
                      updateQuestion(sectionId, question.id, { matrixRows: newRows });
                    }}
                    className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                  >
                    + Add Row
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Matrix Columns</label>
                <div className="space-y-2">
                  {question.matrixColumns?.map((column, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={column}
                        onChange={(e) => {
                          const newColumns = [...(question.matrixColumns || [])];
                          newColumns[index] = e.target.value;
                          updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                        placeholder={`Column ${index + 1}`}
                      />
                      <button
                        onClick={() => {
                          const newColumns = question.matrixColumns?.filter((_, i) => i !== index);
                          updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                        }}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newColumns = [...(question.matrixColumns || []), `Column ${(question.matrixColumns?.length || 0) + 1}`];
                      updateQuestion(sectionId, question.id, { matrixColumns: newColumns });
                    }}
                    className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                  >
                    + Add Column
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Response Type</label>
              <select
                value={question.matrixType || 'single'}
                onChange={(e) => updateQuestion(sectionId, question.id, { matrixType: e.target.value as 'single' | 'multiple' | 'rating' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              >
                <option value="single">Single selection per row</option>
                <option value="multiple">Multiple selections per row</option>
                <option value="rating">Rating scale per row</option>
              </select>
            </div>
          </div>
        )}

        {question.type === 'demographics' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-blue-900 mb-2">Census-Aligned Demographics</h4>
              <p className="text-sm text-blue-800">
                Use standardized demographic categories for consistent analysis and benchmarking.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Demographic Category</label>
                <select
                  onChange={(e) => {
                    const category = e.target.value;
                    if (category && censusDemographicOptions[category as keyof typeof censusDemographicOptions]) {
                      updateQuestion(sectionId, question.id, {
                        options: censusDemographicOptions[category as keyof typeof censusDemographicOptions],
                        title: `What is your ${category}?`
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                >
                  <option value="">Select a category</option>
                  <option value="race">Race/Ethnicity</option>
                  <option value="gender">Gender Identity</option>
                  <option value="age">Age Range</option>
                  <option value="education">Education Level</option>
                  <option value="disability">Disability Status</option>
                  <option value="veteranStatus">Veteran Status</option>
                  <option value="sexualOrientation">Sexual Orientation</option>
                </select>
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={question.allowMultiple || false}
                    onChange={(e) => updateQuestion(sectionId, question.id, { allowMultiple: e.target.checked })}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Allow multiple selections</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={question.allowOther || false}
                    onChange={(e) => updateQuestion(sectionId, question.id, { allowOther: e.target.checked })}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Allow "Other" option</span>
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Custom Options</label>
              {question.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(question.options || [])];
                      newOptions[index] = e.target.value;
                      updateQuestion(sectionId, question.id, { options: newOptions });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    placeholder={`Option ${index + 1}`}
                  />
                  <button
                    onClick={() => {
                      const newOptions = question.options?.filter((_, i) => i !== index);
                      updateQuestion(sectionId, question.id, { options: newOptions });
                    }}
                    className="p-2 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
                  updateQuestion(sectionId, question.id, { options: newOptions });
                }}
                className="text-orange-500 hover:text-orange-600 text-sm font-medium"
              >
                + Add Custom Option
              </button>
            </div>
          </div>
        )}

        {/* Conditional Logic Editor */}
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Conditional Logic (optional)</h4>
          <p className="text-xs text-gray-500 mb-2">Show this question only when previous answers match the rule.</p>
          <div className="space-y-2">
            {(question.conditionalLogic?.showIf || []).map((rule, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input className="w-48 px-2 py-1 border rounded" value={rule.questionId} onChange={(e) => {
                  const newRules = [...(question.conditionalLogic?.showIf || [])];
                  newRules[idx] = { ...newRules[idx], questionId: e.target.value };
                  updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' }, });
                }} placeholder="Question ID" />
                <select className="px-2 py-1 border rounded" value={rule.operator} onChange={(e) => {
                  const newRules = [...(question.conditionalLogic?.showIf || [])];
                  newRules[idx] = { ...newRules[idx], operator: e.target.value as 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than' };
                  updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' }, });
                }}>
                  <option value="equals">equals</option>
                  <option value="not-equals">not-equals</option>
                  <option value="contains">contains</option>
                </select>
                <input className="px-2 py-1 border rounded" value={String(rule.value || '')} onChange={(e) => {
                  const newRules = [...(question.conditionalLogic?.showIf || [])];
                  newRules[idx] = { ...newRules[idx], value: e.target.value };
                  updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' }, });
                }} placeholder="Value" />
                <button className="px-2 py-1 text-red-600" onClick={() => {
                  const newRules = (question.conditionalLogic?.showIf || []).filter((_, i) => i !== idx);
                  updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' }, });
                }}>Remove</button>
              </div>
            ))}
            <button className="text-sm text-orange-500" onClick={() => {
              const newRules = [...(question.conditionalLogic?.showIf || []), { questionId: '', operator: 'equals' as const, value: '' }];
              updateQuestion(sectionId, question.id, { conditionalLogic: { ...(question.conditionalLogic || {}), showIf: newRules, logic: question.conditionalLogic?.logic || 'and' } });
            }}>+ Add condition</button>
          </div>
        </div>
      </div>
    );
  };

  if (!survey) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900">Loading survey builder...</h2>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/admin/surveys" 
          className="inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Surveys
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={survey.title}
              onChange={(e) => setSurvey(prev => prev ? { ...prev, title: e.target.value, updatedAt: new Date().toISOString() } : null)}
              className="text-3xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 mb-2"
              placeholder="Survey Title"
            />
            <textarea
              value={survey.description}
              onChange={(e) => setSurvey(prev => prev ? { ...prev, description: e.target.value, updatedAt: new Date().toISOString() } : null)}
              className="text-gray-600 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 resize-none"
              placeholder="Survey description"
              rows={2}
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowBranding(!showBranding)}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Palette className="h-4 w-4" />
              <span>Branding</span>
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Building2 className="h-4 w-4" />
              <span>Assign Survey</span>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
            <Link
              to={`/admin/surveys/${survey.id}/preview`}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </Link>
            <button
              onClick={saveSurvey}
              disabled={isSaving}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Question Types Palette */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Question Types</h3>
          <div className="space-y-3">
            {questionTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  if (activeSection) {
                    addQuestion(activeSection, type.id);
                  }
                }}
                disabled={!activeSection}
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    {getQuestionIcon(type.id)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{type.name}</div>
                    <div className="text-xs text-gray-600">{type.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">AI Suggestions</h4>
            <div className="space-y-2">
              <button 
                onClick={generateAIQuestions}
                disabled={!activeSection}
                className="w-full text-left p-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-purple-800">Generate DEI Questions</span>
                </div>
              </button>
              <button className="w-full text-left p-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors duration-200">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-800">Suggest Logic Flows</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Main Builder Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Sections */}
          <div className="space-y-4">
            {survey.sections.map((section) => (
              <div key={section.id} className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        sections: prev.sections.map(s => 
                          s.id === section.id ? { ...s, title: e.target.value } : s
                        ),
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1"
                      placeholder="Section title"
                    />
                    <textarea
                      value={section.description || ''}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        sections: prev.sections.map(s => 
                          s.id === section.id ? { ...s, description: e.target.value } : s
                        ),
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="text-gray-600 bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 resize-none w-full"
                      placeholder="Section description"
                      rows={1}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActiveSection(activeSection === section.id ? '' : section.id)}
                      className="p-2 text-gray-600 hover:text-gray-800"
                    >
                      {activeSection === section.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                    <button className="p-2 text-red-600 hover:text-red-800">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {activeSection === section.id && (
                  <div className="space-y-4">
                    {section.questions.map((question) => renderQuestionEditor(question, section.id))}
                    
                    {section.questions.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No questions yet. Select a question type from the left to get started.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={addSection}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-500 hover:bg-orange-50 transition-colors duration-200"
            >
              <Plus className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <span className="text-gray-600 font-medium">Add Section</span>
            </button>
          </div>

          {/* Reflection Prompts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Reflection Prompts</h3>
            <p className="text-gray-600 text-sm mb-4">
              These prompts will appear after survey completion to encourage deeper thinking and self-reflection.
            </p>
            <div className="space-y-3">
              {survey.reflectionPrompts.map((prompt, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => {
                      const newPrompts = [...survey.reflectionPrompts];
                      newPrompts[index] = e.target.value;
                      setSurvey(prev => prev ? { ...prev, reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() } : null);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    placeholder="Reflection prompt"
                  />
                  <button
                    onClick={() => {
                      const newPrompts = survey.reflectionPrompts.filter((_, i) => i !== index);
                      setSurvey(prev => prev ? { ...prev, reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() } : null);
                    }}
                    className="p-2 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newPrompts = [...survey.reflectionPrompts, 'New reflection prompt'];
                  setSurvey(prev => prev ? { ...prev, reflectionPrompts: newPrompts, updatedAt: new Date().toISOString() } : null);
                }}
                className="text-orange-500 hover:text-orange-600 text-sm font-medium"
              >
                + Add Reflection Prompt
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Survey Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Access Control */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Access & Privacy</h3>
                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.settings.allowAnonymous}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        settings: { ...prev.settings, allowAnonymous: e.target.checked },
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Allow anonymous responses</span>
                      <p className="text-sm text-gray-600">Participants can respond without logging in</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.settings.allowSaveAndContinue}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        settings: { ...prev.settings, allowSaveAndContinue: e.target.checked },
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Save & continue later</span>
                      <p className="text-sm text-gray-600">Allow participants to save progress and return</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Display Options */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Display Options</h3>
                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.settings.showProgressBar}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        settings: { ...prev.settings, showProgressBar: e.target.checked },
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="font-medium text-gray-900">Show progress bar</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.settings.randomizeQuestions}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        settings: { ...prev.settings, randomizeQuestions: e.target.checked },
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="font-medium text-gray-900">Randomize question order</span>
                  </label>
                </div>
              </div>

              {/* Huddle Co. Features */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Huddle Co. Features</h3>
                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.generateHuddleReport}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        generateHuddleReport: e.target.checked,
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Generate Huddle Report</span>
                      <p className="text-sm text-gray-600">Auto-generate team discussion summaries</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.actionStepsEnabled}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        actionStepsEnabled: e.target.checked,
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Leadership action steps</span>
                      <p className="text-sm text-gray-600">Generate actionable recommendations</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.benchmarkingEnabled}
                      onChange={(e) => setSurvey(prev => prev ? {
                        ...prev,
                        benchmarkingEnabled: e.target.checked,
                        updatedAt: new Date().toISOString()
                      } : null)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Enable benchmarking</span>
                      <p className="text-sm text-gray-600">Compare results with industry standards</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  saveSurvey();
                  setShowSettings(false);
                }}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Assign Survey to Organizations</h2>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Select Organizations</h3>
                <p className="text-gray-600 text-sm">Choose which organizations should receive this survey. Participants will be notified via email.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {organizations.map((org) => (
                  <label key={org.id} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={survey?.assignedTo.organizationIds.includes(org.id) || false}
                      onChange={(e) => {
                        if (!survey) return;
                        const currentIds = survey.assignedTo.organizationIds;
                        const newIds = e.target.checked
                          ? [...currentIds, org.id]
                          : currentIds.filter(id => id !== org.id);
                        setSurvey(prev => prev ? {
                          ...prev,
                          assignedTo: { ...prev.assignedTo, organizationIds: newIds },
                          updatedAt: new Date().toISOString()
                        } : null);
                      }}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{org.name}</div>
                        <div className="text-sm text-gray-600">{org.type} • {org.learners} learners</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-orange-900 mb-2">Survey Distribution</h4>
                <div className="text-sm text-orange-800">
                  <p className="mb-2">
                    <strong>Selected Organizations:</strong> {survey?.assignedTo.organizationIds.length || 0}
                  </p>
                  <p className="mb-2">
                    <strong>Total Potential Participants:</strong> {
                      organizations
                        .filter(org => survey?.assignedTo.organizationIds.includes(org.id))
                        .reduce((acc, org) => acc + org.learners, 0)
                    }
                  </p>
                  <p>
                    Participants will receive email invitations with secure survey links. Anonymous responses are {survey?.settings.allowAnonymous ? 'enabled' : 'disabled'}.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await saveSurvey();
                  setShowAssignModal(false);
                }}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2"
              >
                <Send className="h-4 w-4" />
                <span>Assign & Notify</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Suggestions Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">AI-Generated Question Suggestions</h2>
                    <p className="text-sm text-gray-600">Select questions to add to your survey section</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-4">
                  These questions were intelligently selected based on your survey type and section content. 
                  Choose the ones that best fit your assessment goals.
                </p>
              </div>
              <div className="space-y-4">
                {aiSuggestions.map((suggestion, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id={`ai-question-${index}`}
                        className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        defaultChecked={true}
                      />
                      <div className="flex-1">
                        <label htmlFor={`ai-question-${index}`} className="cursor-pointer">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium text-gray-900">{suggestion.title}</span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                              {suggestion.type.replace('-', ' ')}
                            </span>
                            {suggestion.category && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {suggestion.category}
                              </span>
                            )}
                          </div>
                          {suggestion.description && (
                            <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                          )}
                          <div className="text-xs text-gray-500">
                            {suggestion.type === 'likert-scale' && suggestion.scale && (
                              <span>Scale: {suggestion.scale.min} ({suggestion.scale.minLabel}) to {suggestion.scale.max} ({suggestion.scale.maxLabel})</span>
                            )}
                            {suggestion.type === 'multiple-choice' && suggestion.options && (
                              <span>{suggestion.options.length} options • {suggestion.allowMultiple ? 'Multiple' : 'Single'} choice</span>
                            )}
                            {suggestion.type === 'ranking' && suggestion.rankingItems && (
                              <span>{suggestion.rankingItems.length} items to rank</span>
                            )}
                            {suggestion.type === 'matrix' && suggestion.matrixRows && (
                              <span>{suggestion.matrixRows.length}×{suggestion.matrixColumns?.length || 0} matrix</span>
                            )}
                            {suggestion.type === 'open-ended' && suggestion.validation && (
                              <span>
                                {suggestion.validation.minLength && `Min: ${suggestion.validation.minLength} chars`}
                                {suggestion.validation.maxLength && ` Max: ${suggestion.validation.maxLength} chars`}
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between">
              <button
                onClick={() => setShowAIModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Get selected checkboxes
                  const checkboxes = document.querySelectorAll<HTMLInputElement>('input[id^="ai-question-"]:checked');
                  const selectedIndices = Array.from(checkboxes).map(cb => 
                    parseInt(cb.id.split('-').pop() || '0')
                  );
                  addSelectedAIQuestions(selectedIndices);
                }}
                className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors duration-200"
              >
                Add Selected Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Section Button */}
      {survey.sections.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Start Building Your Survey</h3>
          <p className="text-gray-600 mb-6">Add your first section to begin creating questions.</p>
          <button
            onClick={addSection}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center mx-auto space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Add First Section</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminSurveyBuilder;