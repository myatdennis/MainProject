import React, { useState, useEffect } from 'react';
import { Brain, Lightbulb, Zap, CheckCircle, X, Sparkles, Target, Clock, Users } from 'lucide-react';
import { Course } from '../types/courseTypes';

interface AISuggestion {
  id: string;
  type: 'content' | 'structure' | 'engagement' | 'accessibility' | 'performance';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestion: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  autoApplyable?: boolean;
  moduleId?: string;
  lessonId?: string;
}

interface AIContentAssistantProps {
  course: Course;
  onApplySuggestion: (suggestion: AISuggestion) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}

function getIconForType(type: string) {
  switch (type) {
    case 'content':
      return <Lightbulb className="h-4 w-4" />;
    case 'structure':
      return <Target className="h-4 w-4" />;
    case 'engagement':
      return <Zap className="h-4 w-4" />;
    case 'accessibility':
      return <Users className="h-4 w-4" />;
    case 'performance':
      return <Clock className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function getColorForPriority(priority: string) {
  switch (priority) {
    case 'high':
      return 'border-red-200 bg-red-50';
    case 'medium':
      return 'border-yellow-200 bg-yellow-50';
    case 'low':
      return 'border-blue-200 bg-blue-50';
    default:
      return 'border-gray-200 bg-gray-50';
  }
}

function getEffortColor(effort: string) {
  switch (effort) {
    case 'low':
      return 'text-green-600 bg-green-100';
    case 'medium':
      return 'text-yellow-600 bg-yellow-100';
    case 'high':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

const AIContentAssistant: React.FC<AIContentAssistantProps> = ({
  course,
  onApplySuggestion,
  onDismissSuggestion
}) => {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // AI Analysis Engine
  const analyzeContent = React.useCallback(async () => {
    setIsAnalyzing(true);
    
    // Simulate AI analysis delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newSuggestions: AISuggestion[] = [];

    // Content Analysis
    if (!course.description || course.description.length < 100) {
      newSuggestions.push({
        id: 'desc-enhance',
        type: 'content',
        priority: 'high',
        title: 'Enhance Course Description',
        description: 'Course description is too brief for optimal learner engagement',
        suggestion: 'Add details about what learners will achieve, prerequisites, and key benefits. Aim for 150-300 words.',
        impact: 'Higher enrollment rates (+25%)',
        effort: 'low',
        autoApplyable: true
      });
    }

    // Learning Objectives Analysis
    if (!course.learningObjectives || course.learningObjectives.length < 3) {
      newSuggestions.push({
        id: 'objectives-expand',
        type: 'content',
        priority: 'high',
        title: 'Add Learning Objectives',
        description: 'Courses with clear learning objectives have 40% better completion rates',
        suggestion: 'Define 3-5 specific, measurable learning outcomes using action verbs (analyze, create, evaluate).',
        impact: 'Better learner clarity and engagement',
        effort: 'low',
        autoApplyable: true
      });
    }

    // Module Structure Analysis
    const moduleCount = course.modules?.length || 0;
    if (moduleCount < 2) {
      newSuggestions.push({
        id: 'structure-modules',
        type: 'structure',
        priority: 'medium',
        title: 'Optimize Module Structure',
        description: 'Single module courses can feel overwhelming to learners',
        suggestion: 'Break content into 3-5 focused modules, each covering a specific topic or skill.',
        impact: 'Improved learner progression and retention',
        effort: 'medium'
      });
    }

    // Lesson Duration Analysis
    course.modules?.forEach((module) => {
      module.lessons?.forEach((lesson) => {
        const duration = parseInt(lesson.duration || '0') || 0;
        if (duration > 15) {
          newSuggestions.push({
            id: `lesson-duration-${lesson.id}`,
            type: 'engagement',
            priority: 'medium',
            title: `Shorten Lesson: ${lesson.title}`,
            description: 'Lessons over 15 minutes have higher drop-off rates',
            suggestion: 'Break this lesson into smaller, digestible segments (5-10 minutes each).',
            impact: '20% better completion rates for individual lessons',
            effort: 'medium',
            moduleId: module.id,
            lessonId: lesson.id
          });
        }
      });
    });

    // Content Variety Analysis
    const lessonTypes = new Set();
    course.modules?.forEach(module => {
      module.lessons?.forEach(lesson => {
        lessonTypes.add(lesson.type);
      });
    });

    if (lessonTypes.size === 1) {
      newSuggestions.push({
        id: 'content-variety',
        type: 'engagement',
        priority: 'medium',
        title: 'Diversify Content Types',
        description: 'Single content type courses have lower engagement',
        suggestion: 'Mix videos, interactive elements, quizzes, and text content for better learning outcomes.',
        impact: '30% increase in learner engagement',
        effort: 'high'
      });
    }

    // Accessibility Analysis
    let hasTranscripts = false;
    course.modules?.forEach(module => {
      module.lessons?.forEach(lesson => {
        if (lesson.type === 'video' && lesson.content?.transcript) {
          hasTranscripts = true;
        }
      });
    });

    if (!hasTranscripts && course.modules?.some(m => m.lessons?.some(l => l.type === 'video'))) {
      newSuggestions.push({
        id: 'accessibility-transcripts',
        type: 'accessibility',
        priority: 'high',
        title: 'Add Video Transcripts',
        description: 'Video content without transcripts excludes learners with hearing impairments',
        suggestion: 'Provide transcripts for all video content to ensure accessibility compliance.',
        impact: 'Improved accessibility and SEO',
        effort: 'medium',
        autoApplyable: true
      });
    }

    // Performance Optimization
    if (course.modules && course.modules.length > 5) {
      newSuggestions.push({
        id: 'performance-lazy-load',
        type: 'performance',
        priority: 'low',
        title: 'Optimize Loading Performance',
        description: 'Large courses benefit from progressive loading',
        suggestion: 'Enable lazy loading for modules and lessons to improve initial page load time.',
        impact: '50% faster initial load time',
        effort: 'low',
        autoApplyable: true
      });
    }

    setSuggestions(newSuggestions);
    setIsAnalyzing(false);
  }, [course]);

  // Run analysis when course changes
  useEffect(() => {
    if (course.id && course.title) {
      analyzeContent();
    }
  }, [course.id, course.title, course.modules, analyzeContent]);

  const filteredSuggestions = suggestions.filter(suggestion => 
    activeTab === 'all' || suggestion.priority === activeTab
  );

  const priorityCounts = {
    high: suggestions.filter(s => s.priority === 'high').length,
    medium: suggestions.filter(s => s.priority === 'medium').length,
    low: suggestions.filter(s => s.priority === 'low').length
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Content Assistant</h3>
            <p className="text-sm text-gray-600">Smart suggestions to improve your course</p>
          </div>
        </div>
        
        {isAnalyzing && (
          <div className="flex items-center space-x-2 text-purple-600">
            <Brain className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Analyzing content...</span>
          </div>
        )}
      </div>

      {/* Priority Tabs */}
      <div className="flex items-center space-x-2 mb-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'all' 
              ? 'bg-purple-100 text-purple-700 font-medium' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          All ({suggestions.length})
        </button>
        <button
          onClick={() => setActiveTab('high')}
          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'high' 
              ? 'bg-red-100 text-red-700 font-medium' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          High Priority ({priorityCounts.high})
        </button>
        <button
          onClick={() => setActiveTab('medium')}
          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'medium' 
              ? 'bg-yellow-100 text-yellow-700 font-medium' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Medium ({priorityCounts.medium})
        </button>
        <button
          onClick={() => setActiveTab('low')}
          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            activeTab === 'low' 
              ? 'bg-blue-100 text-blue-700 font-medium' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Low Priority ({priorityCounts.low})
        </button>
      </div>

      {/* Suggestions List */}
      <div className="space-y-4">
        {filteredSuggestions.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Great Job! 🎉</h4>
            <p className="text-gray-600">No suggestions found. Your course is well-optimized!</p>
          </div>
        ) : (
          filteredSuggestions.map((suggestion) => (
            <div 
              key={suggestion.id} 
              className={`border rounded-lg p-4 ${getColorForPriority(suggestion.priority)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {getIconForType(suggestion.type)}
                    <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${getEffortColor(suggestion.effort)}`}>
                      {suggestion.effort} effort
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">{suggestion.description}</p>
                  <p className="text-sm text-gray-800 mb-3 font-medium">{suggestion.suggestion}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                      💡 {suggestion.impact}
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      {suggestion.autoApplyable && (
                        <button
                          onClick={() => onApplySuggestion(suggestion)}
                          className="bg-purple-600 text-white px-3 py-1 text-xs rounded hover:bg-purple-700 transition-colors"
                        >
                          Auto-Apply
                        </button>
                      )}
                      <button
                        onClick={() => onDismissSuggestion(suggestion.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-6 p-4 bg-purple-50 rounded-lg">
          <div className="flex items-center space-x-2 text-purple-700 mb-2">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium text-sm">Pro Tip</span>
          </div>
          <p className="text-sm text-purple-600">
            Implementing high-priority suggestions can improve course completion rates by up to 40%. 
            Start with auto-applicable suggestions for quick wins!
          </p>
        </div>
      )}
    </div>
  );
};

export default AIContentAssistant;
