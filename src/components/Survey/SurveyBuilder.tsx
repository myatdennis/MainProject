import React, { useState, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Eye, 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  GripVertical,
  Wand2,
  Save,
  Send
} from 'lucide-react';
import { Survey, SurveyQuestion, QuestionType, AnonymityMode } from '../../types/survey';

const QUESTION_TYPES: Array<{
  type: QuestionType;
  label: string;
  description: string;
  icon: string;
}> = [
  { type: 'single-select', label: 'Single Choice', description: 'Choose one option', icon: '○' },
  { type: 'multi-select', label: 'Multiple Choice', description: 'Choose multiple options', icon: '☑' },
  { type: 'matrix-likert', label: 'Matrix/Likert', description: 'Grid of questions with rating scale', icon: '⊞' },
  { type: 'ranking', label: 'Ranking', description: 'Rank items in order', icon: '≡' },
  { type: 'nps', label: 'Net Promoter Score', description: '0-10 recommendation scale', icon: '⊕' },
  { type: 'slider', label: 'Slider', description: 'Visual slider input', icon: '▬' },
  { type: 'open-ended', label: 'Text Response', description: 'Free text input', icon: '📝' },
  { type: 'file-upload', label: 'File Upload', description: 'Upload documents/images', icon: '📎' },
  { type: 'demographics', label: 'Demographics', description: 'Standard demographic questions', icon: '👥' },
];

const DEI_TEMPLATES = [
  {
    id: 'workplace-climate',
    name: 'Workplace Climate & Inclusion Index',
    description: 'Measure belonging, respect, fairness, and voice in the workplace',
    category: 'Core DEI Assessment',
    estimatedDuration: 15,
    questionCount: 35,
    tags: ['inclusion', 'belonging', 'climate']
  },
  {
    id: 'psychological-safety',
    name: 'Psychological Safety & Team Trust',
    description: 'Assess team dynamics and psychological safety levels',
    category: 'Team Effectiveness',
    estimatedDuration: 12,
    questionCount: 28,
    tags: ['safety', 'trust', 'teams']
  },
  {
    id: 'bias-microaggressions',
    name: 'Bias & Microaggressions Pulse',
    description: 'Identify and measure bias incidents and microaggressions',
    category: 'Bias Assessment',
    estimatedDuration: 10,
    questionCount: 22,
    tags: ['bias', 'microaggressions', 'pulse']
  },
  {
    id: 'accessibility',
    name: 'Accessibility & Accommodations',
    description: 'Evaluate accessibility needs and accommodation effectiveness',
    category: 'Accessibility',
    estimatedDuration: 8,
    questionCount: 18,
    tags: ['accessibility', 'accommodations', 'inclusion']
  },
  {
    id: 'leadership-culture',
    name: 'Leadership & Culture Barometer',
    description: 'Assess leadership effectiveness in creating inclusive culture',
    category: 'Leadership Assessment',
    estimatedDuration: 20,
    questionCount: 42,
    tags: ['leadership', 'culture', 'management']
  },
  {
    id: 'recruitment-equity',
    name: 'Recruitment & Promotion Equity',
    description: 'Evaluate fairness in hiring and promotion processes',
    category: 'Talent Processes',
    estimatedDuration: 18,
    questionCount: 38,
    tags: ['recruitment', 'promotion', 'equity']
  }
];

interface SurveyBuilderProps {
  survey?: Survey;
  onSave: (survey: Survey) => void;
  onPublish: (survey: Survey) => void;
}

const SurveyBuilder: React.FC<SurveyBuilderProps> = ({
  survey: initialSurvey,
  onSave,
  onPublish
}) => {
  const [survey, setSurvey] = useState<Survey>(initialSurvey || {
    id: '',
    title: 'New Survey',
    description: '',
    status: 'draft',
    version: 1,
    createdBy: 'current-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    sections: [],
    blocks: [{
      id: 'block-1',
      title: 'Survey Questions',
      questions: [],
    }],
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
      primaryColor: '#2B84C6',
      secondaryColor: '#3BAA66',
    },
    defaultLanguage: 'en',
    supportedLanguages: ['en'],
    completionSettings: {
      thankYouMessage: 'Thank you for completing this survey!',
      showResources: true,
      recommendedCourses: [],
    }
  });

  const [activeTab, setActiveTab] = useState<'build' | 'settings' | 'preview' | 'templates'>('build');

  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // Question Management
  const addQuestion = useCallback((blockId: string, type: QuestionType) => {
    const newQuestion: SurveyQuestion = {
      id: `question-${Date.now()}`,
      type,
      title: `New ${type.replace('-', ' ')} Question`,
      description: '',
      required: false,
      order: survey.blocks.find(b => b.id === blockId)?.questions.length || 0,
    };

    // Add type-specific properties
    if (type === 'single-select' || type === 'multi-select') {
      newQuestion.options = ['Option 1', 'Option 2', 'Option 3'];
    } else if (type === 'matrix-likert') {
      newQuestion.matrixRows = ['Statement 1', 'Statement 2'];
      newQuestion.matrixColumns = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
    } else if (type === 'nps') {
      newQuestion.scale = { min: 0, max: 10, minLabel: 'Not at all likely', maxLabel: 'Extremely likely' };
    } else if (type === 'slider') {
      newQuestion.scale = { min: 0, max: 100, minLabel: 'Low', maxLabel: 'High' };
    } else if (type === 'ranking') {
      newQuestion.rankingItems = ['Item 1', 'Item 2', 'Item 3'];
    }

    setSurvey(prev => ({
      ...prev,
      blocks: prev.blocks.map(block =>
        block.id === blockId
          ? { ...block, questions: [...block.questions, newQuestion] }
          : block
      )
    }));
  }, [survey.blocks]);

  const updateQuestion = useCallback((blockId: string, questionId: string, updates: Partial<SurveyQuestion>) => {
    setSurvey(prev => ({
      ...prev,
      blocks: prev.blocks.map(block =>
        block.id === blockId
          ? {
              ...block,
              questions: block.questions.map(q =>
                q.id === questionId ? { ...q, ...updates } : q
              )
            }
          : block
      )
    }));
  }, []);

  const deleteQuestion = useCallback((blockId: string, questionId: string) => {
    setSurvey(prev => ({
      ...prev,
      blocks: prev.blocks.map(block =>
        block.id === blockId
          ? {
              ...block,
              questions: block.questions.filter(q => q.id !== questionId)
            }
          : block
      )
    }));
  }, []);

  const duplicateQuestion = useCallback((blockId: string, questionId: string) => {
    const block = survey.blocks.find(b => b.id === blockId);
    const question = block?.questions.find(q => q.id === questionId);
    
    if (question) {
      const duplicated = {
        ...question,
        id: `question-${Date.now()}`,
        title: `${question.title} (Copy)`,
        order: question.order + 1
      };
      
      addQuestion(blockId, duplicated.type);
      updateQuestion(blockId, duplicated.id, duplicated);
    }
  }, [survey.blocks, addQuestion, updateQuestion]);

  // AI Assistant Functions
  const handleAIAssist = async (prompt: string, type: 'generate' | 'improve' | 'translate') => {
    // Mock AI assistance - in real implementation, this would call an AI service
    const suggestions = {
      generate: [
        "How comfortable do you feel expressing your authentic self at work?",
        "To what extent do you feel your voice is heard and valued in team meetings?",
        "How fairly do you feel promotion decisions are made in your organization?"
      ],
      improve: [
        "Consider adding a neutral option to avoid forced choice bias",
        "This question may be leading - try rephrasing more neutrally",
        "Add clarifying text to ensure consistent interpretation"
      ],
      translate: [
        "Question translated to Spanish, French, and German",
        "Cultural adaptation suggestions provided",
        "Localized examples added for regional context"
      ]
    };

    // Simulate AI response
    alert(`AI Suggestions for "${prompt}":\n\n${suggestions[type].join('\n\n')}`);
    setShowAIAssist(false);
    setAiPrompt('');
  };

  // Load Template
  const loadTemplate = (templateId: string) => {
    const template = DEI_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    // Mock template loading - in real implementation, this would load actual template data
    const templateSurvey = {
      ...survey,
      title: template.name,
      description: template.description,
      blocks: [{
        id: 'block-1',
        title: 'Survey Questions',
        questions: [
          {
            id: 'q1',
            type: 'matrix-likert' as QuestionType,
            title: 'Rate your agreement with the following statements about your workplace:',
            description: 'Please consider your experiences over the past 6 months',
            required: true,
            order: 0,
            matrixRows: [
              'I feel like I belong in this organization',
              'My colleagues treat me with respect',
              'I can be my authentic self at work',
              'My opinions are valued by my team'
            ],
            matrixColumns: [
              'Strongly Disagree',
              'Disagree', 
              'Somewhat Disagree',
              'Neutral',
              'Somewhat Agree',
              'Agree',
              'Strongly Agree'
            ]
          },
          {
            id: 'q2',
            type: 'nps' as QuestionType,
            title: 'How likely are you to recommend this organization as a great place to work for people from diverse backgrounds?',
            required: true,
            order: 1,
            scale: {
              min: 0,
              max: 10,
              minLabel: 'Not at all likely',
              maxLabel: 'Extremely likely'
            }
          }
        ]
      }]
    };

    setSurvey(templateSurvey);
    setActiveTab('build');
  };

  // Question Type Selector Component
  const QuestionTypeSelector = ({ onSelect }: { onSelect: (type: QuestionType) => void }) => (
    <div className="grid grid-cols-3 gap-3 p-4">
      {QUESTION_TYPES.map(({ type, label, description, icon }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <div className="text-2xl mb-2">{icon}</div>
          <div className="font-medium text-sm text-gray-900">{label}</div>
          <div className="text-xs text-gray-600">{description}</div>
        </button>
      ))}
    </div>
  );

  // Question Editor Component
  const QuestionEditor = ({ 
    question, 
    onUpdate, 
    onDelete, 
    onDuplicate 
  }: {
    question: SurveyQuestion;
    onUpdate: (updates: Partial<SurveyQuestion>) => void;
    onDelete: () => void;
    onDuplicate: () => void;
  }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <div className="border border-gray-200 rounded-lg bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
            <div className="flex-1">
              <input
                type="text"
                value={question.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="w-full font-medium text-gray-900 bg-transparent border-none outline-none"
                placeholder="Enter question text..."
              />
              {question.description && (
                <input
                  type="text"
                  value={question.description}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  className="w-full text-sm text-gray-600 bg-transparent border-none outline-none mt-1"
                  placeholder="Question description..."
                />
              )}
            </div>
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-1 text-sm">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(e) => onUpdate({ required: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>Required</span>
              </label>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={onDuplicate}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-1 hover:bg-red-100 rounded text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={question.description || ''}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  placeholder="Optional question description..."
                />
              </div>

              {/* Type-specific editors */}
              {(question.type === 'single-select' || question.type === 'multi-select') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Answer Options
                  </label>
                  <div className="space-y-2">
                    {question.options?.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...(question.options || [])];
                            newOptions[index] = e.target.value;
                            onUpdate({ options: newOptions });
                          }}
                          className="flex-1 p-2 border border-gray-300 rounded"
                        />
                        <button
                          onClick={() => {
                            const newOptions = question.options?.filter((_, i) => i !== index);
                            onUpdate({ options: newOptions });
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newOptions = [...(question.options || []), `Option ${(question.options?.length || 0) + 1}`];
                        onUpdate({ options: newOptions });
                      }}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Option</span>
                    </button>
                  </div>
                </div>
              )}

              {question.type === 'matrix-likert' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Row Labels (Statements)
                    </label>
                    <div className="space-y-2">
                      {question.matrixRows?.map((row, index) => (
                        <input
                          key={index}
                          type="text"
                          value={row}
                          onChange={(e) => {
                            const newRows = [...(question.matrixRows || [])];
                            newRows[index] = e.target.value;
                            onUpdate({ matrixRows: newRows });
                          }}
                          className="w-full p-2 border border-gray-300 rounded"
                        />
                      ))}
                      <button
                        onClick={() => {
                          const newRows = [...(question.matrixRows || []), `Statement ${(question.matrixRows?.length || 0) + 1}`];
                          onUpdate({ matrixRows: newRows });
                        }}
                        className="text-blue-600 text-sm"
                      >
                        + Add Row
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Column Labels (Scale)
                    </label>
                    <div className="space-y-2">
                      {question.matrixColumns?.map((col, index) => (
                        <input
                          key={index}
                          type="text"
                          value={col}
                          onChange={(e) => {
                            const newCols = [...(question.matrixColumns || [])];
                            newCols[index] = e.target.value;
                            onUpdate({ matrixColumns: newCols });
                          }}
                          className="w-full p-2 border border-gray-300 rounded"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {question.type === 'nps' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Low End Label (0)
                    </label>
                    <input
                      type="text"
                      value={question.scale?.minLabel || ''}
                      onChange={(e) => onUpdate({ 
                        scale: { 
                          min: 0, 
                          max: 10, 
                          minLabel: e.target.value, 
                          maxLabel: question.scale?.maxLabel || 'Extremely likely' 
                        }
                      })}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      High End Label (10)
                    </label>
                    <input
                      type="text"
                      value={question.scale?.maxLabel || ''}
                      onChange={(e) => onUpdate({ 
                        scale: { 
                          min: 0, 
                          max: 10, 
                          minLabel: question.scale?.minLabel || 'Not at all likely', 
                          maxLabel: e.target.value 
                        }
                      })}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <input
                type="text"
                value={survey.title}
                onChange={(e) => setSurvey(prev => ({ ...prev, title: e.target.value }))}
                className="text-xl font-semibold text-gray-900 bg-transparent border-none outline-none"
              />
              <input
                type="text"
                value={survey.description || ''}
                onChange={(e) => setSurvey(prev => ({ ...prev, description: e.target.value }))}
                className="block text-sm text-gray-600 bg-transparent border-none outline-none mt-1"
                placeholder="Survey description..."
              />
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                survey.status === 'published' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {survey.status}
              </span>
              <button
                onClick={() => onSave(survey)}
                className="flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => onPublish(survey)}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Send className="w-4 h-4" />
                <span>Publish</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'build', label: 'Build', icon: Plus },
              { id: 'templates', label: 'Templates', icon: Copy },
              { id: 'settings', label: 'Settings', icon: Settings },
              { id: 'preview', label: 'Preview', icon: Eye },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'templates' && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">DEI Survey Templates</h3>
              <p className="text-gray-600">Choose from research-backed templates designed for diversity, equity, and inclusion measurement</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DEI_TEMPLATES.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 transition-colors">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{template.name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{template.questionCount} questions</span>
                      <span>~{template.estimatedDuration} min</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => loadTemplate(template.id)}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Use This Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'build' && (
          <div className="grid grid-cols-4 gap-6">
            {/* Question Builder */}
            <div className="col-span-3 space-y-6">
              {survey.blocks.map((block) => (
                <div key={block.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{block.title}</h3>
                    <button
                      onClick={() => setShowAIAssist(true)}
                      className="flex items-center space-x-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>AI Assist</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {block.questions.map((question) => (
                      <QuestionEditor
                        key={question.id}
                        question={question}
                        onUpdate={(updates) => updateQuestion(block.id, question.id, updates)}
                        onDelete={() => deleteQuestion(block.id, question.id)}
                        onDuplicate={() => duplicateQuestion(block.id, question.id)}
                      />
                    ))}
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <h4 className="font-medium text-gray-900 mb-1">Add Question</h4>
                      <p className="text-gray-600 text-sm mb-4">Choose a question type to get started</p>
                      <QuestionTypeSelector
                        onSelect={(type) => addQuestion(block.id, type)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Quick Stats</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Questions</span>
                    <span>{survey.blocks.reduce((total, block) => total + block.questions.length, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated time</span>
                    <span>{Math.ceil(survey.blocks.reduce((total, block) => total + block.questions.length, 0) * 0.5)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="capitalize">{survey.status}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">DEI Best Practices</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Use inclusive language</li>
                  <li>• Provide anonymity options</li>
                  <li>• Include diverse perspectives</li>
                  <li>• Test for bias in questions</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Survey Settings</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Anonymity Mode
                  </label>
                  <select
                    value={survey.settings.anonymityMode}
                    onChange={(e) => setSurvey(prev => ({
                      ...prev,
                      settings: { ...prev.settings, anonymityMode: e.target.value as AnonymityMode }
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  >
                    <option value="anonymous">Anonymous - No identifying information collected</option>
                    <option value="confidential">Confidential - Identity known but kept private</option>
                    <option value="identified">Identified - Responses linked to participants</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Anonymity Threshold (minimum group size to show results)
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="20"
                    value={survey.settings.anonymityThreshold}
                    onChange={(e) => setSurvey(prev => ({
                      ...prev,
                      settings: { ...prev.settings, anonymityThreshold: parseInt(e.target.value) }
                    }))}
                    className="w-32 p-3 border border-gray-300 rounded-lg"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Groups smaller than this will be masked in reports
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.settings.showProgressBar}
                      onChange={(e) => setSurvey(prev => ({
                        ...prev,
                        settings: { ...prev.settings, showProgressBar: e.target.checked }
                      }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Show progress bar</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.settings.consentRequired}
                      onChange={(e) => setSurvey(prev => ({
                        ...prev,
                        settings: { ...prev.settings, consentRequired: e.target.checked }
                      }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Require consent to participate</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={survey.settings.allowMultipleResponses}
                      onChange={(e) => setSurvey(prev => ({
                        ...prev,
                        settings: { ...prev.settings, allowMultipleResponses: e.target.checked }
                      }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Allow multiple responses per user</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={survey.branding.primaryColor}
                      onChange={(e) => setSurvey(prev => ({
                        ...prev,
                        branding: { ...prev.branding, primaryColor: e.target.value }
                      }))}
                      className="w-12 h-12 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={survey.branding.primaryColor}
                      onChange={(e) => setSurvey(prev => ({
                        ...prev,
                        branding: { ...prev.branding, primaryColor: e.target.value }
                      }))}
                      className="flex-1 p-3 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={survey.branding.secondaryColor}
                      onChange={(e) => setSurvey(prev => ({
                        ...prev,
                        branding: { ...prev.branding, secondaryColor: e.target.value }
                      }))}
                      className="w-12 h-12 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={survey.branding.secondaryColor}
                      onChange={(e) => setSurvey(prev => ({
                        ...prev,
                        branding: { ...prev.branding, secondaryColor: e.target.value }
                      }))}
                      className="flex-1 p-3 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Completion Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thank You Message
                  </label>
                  <textarea
                    value={survey.completionSettings.thankYouMessage}
                    onChange={(e) => setSurvey(prev => ({
                      ...prev,
                      completionSettings: { ...prev.completionSettings, thankYouMessage: e.target.value }
                    }))}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  />
                </div>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={survey.completionSettings.showResources}
                    onChange={(e) => setSurvey(prev => ({
                      ...prev,
                      completionSettings: { ...prev.completionSettings, showResources: e.target.checked }
                    }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Show recommended resources after completion</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">{survey.title}</h2>
                {survey.description && (
                  <p className="text-gray-600 mt-2">{survey.description}</p>
                )}
                {survey.settings.showProgressBar && (
                  <div className="mt-4">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: '25%' }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Progress: 1 of 4 pages</p>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-6">
                {survey.blocks[0]?.questions.slice(0, 3).map((question) => (
                  <div key={question.id} className="space-y-3">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {question.title}
                        {question.required && <span className="text-red-500 ml-1">*</span>}
                      </h3>
                      {question.description && (
                        <p className="text-sm text-gray-600 mt-1">{question.description}</p>
                      )}
                    </div>

                    {/* Preview different question types */}
                    {question.type === 'single-select' && (
                      <div className="space-y-2">
                        {question.options?.slice(0, 3).map((option, index) => (
                          <label key={index} className="flex items-center space-x-2">
                            <input type="radio" name={question.id} className="border-gray-300" />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {question.type === 'matrix-likert' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left p-2"></th>
                              {question.matrixColumns?.slice(0, 5).map((col, index) => (
                                <th key={index} className="text-center p-2 text-xs">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {question.matrixRows?.slice(0, 2).map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-t border-gray-200">
                                <td className="p-2 text-sm">{row}</td>
                                {question.matrixColumns?.slice(0, 5).map((_, colIndex) => (
                                  <td key={colIndex} className="p-2 text-center">
                                    <input type="radio" name={`${question.id}-${rowIndex}`} />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {question.type === 'nps' && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">{question.scale?.minLabel}</span>
                          <span className="text-xs text-gray-600">{question.scale?.maxLabel}</span>
                        </div>
                        <div className="flex space-x-1">
                          {Array.from({ length: 11 }, (_, i) => (
                            <button
                              key={i}
                              className="w-8 h-8 border border-gray-300 rounded text-sm hover:bg-blue-100"
                            >
                              {i}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {question.type === 'open-ended' && (
                      <textarea
                        rows={3}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        placeholder="Enter your response..."
                      />
                    )}
                  </div>
                ))}

                <div className="flex justify-between pt-4">
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                    Previous
                  </button>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Modal */}
      {showAIAssist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Survey Assistant</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What would you like help with?
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="e.g., Generate questions about workplace inclusion for remote teams"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleAIAssist(aiPrompt, 'generate')}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Generate Questions
                </button>
                <button
                  onClick={() => handleAIAssist(aiPrompt, 'improve')}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Improve Existing
                </button>
              </div>
              <button
                onClick={() => setShowAIAssist(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyBuilder;