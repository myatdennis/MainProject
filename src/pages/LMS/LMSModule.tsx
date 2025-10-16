import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { useEnhancedCourseProgress } from '../../hooks/useEnhancedCourseProgress';
import syncService from '../../services/syncService';
// import { certificateService } from '../../services/certificateService';
// import { analyticsService } from '../../services/analyticsService';
import { 
  Download, 
  CheckCircle, 
  Clock, 
  FileText, 
  Video,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Star,
  Save,
  Award,
  AlertTriangle,
  Send,
  Zap,
  TrendingUp,
  RefreshCw,
  Lightbulb,
  Trophy,
  PlayCircle
} from 'lucide-react';
import EnhancedVideoPlayer from '../../components/EnhancedVideoPlayer';
import FloatingProgressBar from '../../components/FloatingProgressBar';
import CourseCompletion from '../../components/CourseCompletion';
// import { getVideoEmbedUrl } from '../../utils/videoUtils';

const LMSModule = () => {
  // Restored required state and functions
  const [engagementMetrics, setEngagementMetrics] = useState({
    clicks: 0,
    timeSpent: 0,
    interactions: 0,
    completionPrediction: 0
  });
  const [smartRecommendations, setSmartRecommendations] = useState<any[]>([]);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const debouncedAutoSave = useCallback(async (data: any) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(async () => {
      setIsAutoSaving(true);
      try {
        // Auto-save functionality - will be connected to progress hook
        setLastSavedAt(new Date());
      } catch (error) {
        // Handle error
      } finally {
        setIsAutoSaving(false);
      }
    }, 2000);
  }, []);
  const [sessionStartTime] = useState(Date.now());
  const trackEngagement = useCallback((action: string, _data?: any) => {
    setEngagementMetrics(prev => ({
      ...prev,
      clicks: prev.clicks + (action === 'click' ? 1 : 0),
      interactions: prev.interactions + 1,
      timeSpent: Date.now() - sessionStartTime
    }));
  }, [sessionStartTime]);
  const { moduleId, lessonId } = useParams();
  const navigate = useNavigate();
  
  // State declarations (all hooks must be at the top)
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [reflection, setReflection] = useState('');
  const [moduleRating, setModuleRating] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<{ [questionId: string]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number; maxScore: number; passed: boolean } | null>(null);
  const [interactiveAnswers, setInteractiveAnswers] = useState<{ [optionIndex: number]: boolean }>({});
  const [showInteractiveFeedback, setShowInteractiveFeedback] = useState(false);
  
  // Enhanced state for optimized features
  const [videoProgress, setVideoProgress] = useState(0);
  const [focusTime, setFocusTime] = useState(0);
  const [isPageFocused, setIsPageFocused] = useState(true);
  // smartRecommendations and engagementMetrics can be re-added if actually used
  
  // Sidebar state (for future CourseProgressSidebar integration)
  
  // Refs for optimization
  const videoRef = useRef<HTMLVideoElement>(null);
  const focusTimerRef = useRef<NodeJS.Timeout>();

  // Course refresh state
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [showRefreshNotification, setShowRefreshNotification] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Optimized course loading with memoization
  const course = useMemo(() => {
    const courseData = moduleId ? courseStore.getCourse(moduleId) : null;
    console.log('📖 Loading course data for ID:', moduleId, 'Found:', !!courseData, 'Refresh time:', lastRefreshTime);
    return courseData;
  }, [moduleId, lastRefreshTime]);

  // Validate course data completeness
  const validateCourseData = (course: any) => {
    if (!course) return { isValid: false, issues: ['Course not found'] };
    
    const issues: string[] = [];
    if (!course.modules || course.modules.length === 0) issues.push('No modules found');
    if (!course.title) issues.push('Course title missing');
    
    course.modules?.forEach((module: any, mIndex: number) => {
      if (!module.lessons || module.lessons.length === 0) {
        issues.push(`Module ${mIndex + 1} has no lessons`);
      }
      module.lessons?.forEach((lesson: any, lIndex: number) => {
        if (lesson.type === 'video' && !lesson.content?.videoUrl) {
          issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Video lesson missing videoUrl`);
        }
        if (!lesson.title) {
          issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Missing title`);
        }
      });
    });
    
    return { isValid: issues.length === 0, issues };
  };

  // Define current module and lesson data (must be after course but before other hooks)
  const currentModule = course?.modules?.[currentModuleIndex];
  const currentLessonData = currentModule?.lessons[currentLessonIndex];

  // Debug logging (after variables are defined)
  const courseValidation = validateCourseData(course);
  console.log('🔍 Course Data Validation:', courseValidation);
  console.log('📚 LMS Module Debug:', {
    moduleIdParam: moduleId,
    lessonIdParam: lessonId,
    course: course,
    courseModules: course?.modules,
    currentModuleIndex,
    currentLessonIndex,
    currentModule,
    currentLessonData
  });
  // Focus time tracking for engagement analytics
  useEffect(() => {
    const handleFocus = () => {
      setIsPageFocused(true);
      focusTimerRef.current = setInterval(() => {
        setFocusTime(prev => prev + 1);
      }, 1000);
    };

    const handleBlur = () => {
      setIsPageFocused(false);
      if (focusTimerRef.current) {
        clearInterval(focusTimerRef.current);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    // Start timer immediately
    handleFocus();

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      if (focusTimerRef.current) {
        clearInterval(focusTimerRef.current);
      }
    };
  }, []);
  
  // Force refresh course data if it seems stale
  useEffect(() => {
    if (moduleId && !course) {
      console.log('🔄 Course not found, forcing store refresh for ID:', moduleId);
      // Force reload from localStorage
      window.location.reload();
    }
  }, [moduleId, course]);

  // Add automatic course refresh functionality

  // Function to manually refresh course data
  const refreshCourseData = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      console.log('🔄 Manually refreshing course data...');
      
      // Reinitialize the course store to get latest data
      await courseStore.init();
      
      // Force a component re-render by updating timestamp
      setLastRefreshTime(Date.now());
      
      // Small delay for visual feedback
      setTimeout(() => {
        setRefreshing(false);
        setShowRefreshNotification(true);
        console.log('✅ Course data refreshed successfully');
        
        // Hide notification after 3 seconds
        setTimeout(() => {
          setShowRefreshNotification(false);
        }, 3000);
      }, 1000);
    } catch (error) {
      console.error('❌ Failed to refresh course data:', error);
      setRefreshing(false);
    }
  }, [refreshing]);

  // Auto-refresh course data every 30 seconds to catch updates
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (!refreshing && document.visibilityState === 'visible') {
        console.log('🔄 Auto-refreshing course data...');
        await courseStore.init();
        setLastRefreshTime(Date.now());
      }
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [refreshing]);

  // Real-time sync service integration for instant course updates
  useEffect(() => {
    const unsubscribeCourseUpdates = syncService.subscribeToCourseUpdates((data: any) => {
      console.log('🔄 Real-time course update received:', data);
      
      // Check if this update affects the current course
      if (data.courseId === moduleId || data.manual) {
        setLastRefreshTime(Date.now());
        if (data.manual) {
          setShowRefreshNotification(true);
          setTimeout(() => setShowRefreshNotification(false), 3000);
        }
      }
    });

    const unsubscribeRefreshAll = syncService.subscribeToRefresh((data: any) => {
      console.log('🔄 Global refresh received:', data);
      setLastRefreshTime(Date.now());
      if (data.manual) {
        setShowRefreshNotification(true);
        setTimeout(() => setShowRefreshNotification(false), 3000);
      }
    });

    return () => {
      unsubscribeCourseUpdates();
      unsubscribeRefreshAll();
    };
  }, [moduleId]);

  // Check for course updates when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !refreshing) {
        console.log('👁️ Page became visible, checking for course updates...');
        refreshCourseData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshCourseData, refreshing]);

  // Use enhanced course progress hook for real-time sync and auto-save
  const {
    lessonProgress,
    reflections,
    loading: progressLoading,
    error: progressError,
    updateLessonProgress,
    markLessonComplete,
    saveReflection: saveReflectionToProgress,
    setActiveLessonTracking
  } = useEnhancedCourseProgress(moduleId || '', {
    enableAutoSave: true,
    enableRealtime: true,
    autoSaveInterval: 30000
  });

  useEffect(() => {
    // Load reflection for current lesson
    if (currentLessonData?.id && reflections[currentLessonData.id]) {
      setReflection(reflections[currentLessonData.id].content);
    } else {
      setReflection('');
    }
  }, [currentModuleIndex, currentLessonIndex, reflections, currentLessonData]);

  // Set active lesson tracking when lesson changes
  useEffect(() => {
    if (currentLessonData?.id && setActiveLessonTracking) {
      setActiveLessonTracking(currentLessonData.id);
    }
  }, [currentLessonData?.id, setActiveLessonTracking]);

  // Sync URL lessonId -> current module/lesson indices
  useEffect(() => {
    if (!course) return;
    if (!lessonId) return;
    // find module and lesson indices by lesson id
    for (let mi = 0; mi < (course.modules || []).length; mi++) {
      const m = (course.modules || [])[mi];
      const li = m.lessons.findIndex(l => l.id === lessonId);
      if (li !== -1) {
        setCurrentModuleIndex(mi);
        setCurrentLessonIndex(li);
        return;
      }
    }
  }, [lessonId, course]);

  // Navigation functions (defined before hooks to prevent dependency issues)
  const handleNextLesson = useCallback(async () => {
    const currentLessonProgress = lessonProgress[currentLessonData?.id || ''];
    const isLessonCompleted = currentLessonProgress?.completed || false;
    
    // Mark current lesson as completed if not already
    if (!isLessonCompleted && currentLessonData && currentModule) {
      await markLessonComplete(currentLessonData.id, currentModule.id);
    }

    if (currentModule && currentLessonIndex < currentModule.lessons.length - 1) {
      const nextLessonIndex = currentLessonIndex + 1;
      setCurrentLessonIndex(nextLessonIndex);
      navigate(`/lms/module/${moduleId}/lesson/${currentModule.lessons[nextLessonIndex].id}`);
    } else if (course && currentModuleIndex < (course.modules || []).length - 1) {
      const nextModuleIndex = currentModuleIndex + 1;
      setCurrentModuleIndex(nextModuleIndex);
      setCurrentLessonIndex(0);
      navigate(`/lms/module/${moduleId}/lesson/${(course.modules || [])[nextModuleIndex].lessons[0].id}`);
    }
    
    // Reset quiz state for new lesson
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setInteractiveAnswers({});
    setShowInteractiveFeedback(false);
  }, [currentLessonIndex, currentModuleIndex, course, currentModule, currentLessonData, lessonProgress, markLessonComplete, moduleId, navigate]);

  const handlePrevLesson = useCallback(() => {
    if (currentModule && currentLessonIndex > 0) {
      const prevLessonIndex = currentLessonIndex - 1;
      setCurrentLessonIndex(prevLessonIndex);
      navigate(`/lms/module/${moduleId}/lesson/${currentModule.lessons[prevLessonIndex].id}`);
    } else if (course && currentModuleIndex > 0) {
      const prevModuleIndex = currentModuleIndex - 1;
      const prevModule = (course.modules || [])[prevModuleIndex];
      setCurrentModuleIndex(prevModuleIndex);
      setCurrentLessonIndex(prevModule.lessons.length - 1);
      navigate(`/lms/module/${moduleId}/lesson/${prevModule.lessons[prevModule.lessons.length - 1].id}`);
    }
    
    // Reset quiz state for new lesson
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setInteractiveAnswers({});
    setShowInteractiveFeedback(false);
  }, [currentLessonIndex, currentModuleIndex, course, currentModule, moduleId, navigate]);

  // Helper function to update lesson progress with proper module ID
  const updateCurrentLessonProgress = useCallback(async (updates: any) => {
    if (!currentLessonData || !currentModule) return;
    return updateLessonProgress(currentLessonData.id, currentModule.id, updates);
  }, [currentLessonData, currentModule, updateLessonProgress]);

  const handleSaveReflection = useCallback(async () => {
    if (!reflection.trim() || !currentLessonData) return;
    
    try {
      await saveReflectionToProgress(currentLessonData.id, reflection);
      // Show success feedback
    } catch (error) {
      console.error('Error saving reflection:', error);
    }
  }, [reflection, currentLessonData, saveReflectionToProgress]);

  // Auto-generate certificate when course is completed
  // TODO: Implement certificate generation feature
  /*
  const handleCourseCompletion = async () => {
    if (!course || overallProgress < 100) return;
    
    setCertificateLoading(true);
    
    try {
      // Track completion analytics
      analyticsService.trackCourseCompletion('demo_user_123', course.id, {
        totalTimeSpent: calculateTotalTimeSpent(),
        finalScore: calculateFinalScore(),
        modulesCompleted: course.modules.length,
        lessonsCompleted: Object.values(lessonProgress).filter(p => p.completed).length,
        quizzesPassed: getQuizzesPassed(),
        certificateGenerated: course.certification?.available || false
      });

      // Generate certificate if available
      if (course.certification?.available) {
        const certificate = await certificateService.generateCertificate(
          'demo_user_123',
          'Demo User',
          'demo@example.com',
          course,
          {
            completionDate: new Date().toISOString(),
            completionTime: formatCompletionTime(),
            finalScore: calculateFinalScore(),
            requirementsMet: [
              'Complete all lessons',
              'Pass final assessment',
              'Submit reflections'
            ]
          }
        );
        
        if (certificate) {
          setCertificateGenerated(certificate);
          
          // Show success notification
          const event = new CustomEvent('show-notification', {
            detail: {
              type: 'success',
              message: `🎉 Certificate generated! Check your email for delivery.`,
              duration: 5000
            }
          });
          window.dispatchEvent(event);
        }
      }
    } catch (error) {
      console.error('Certificate generation failed:', error);
      
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: 'Certificate generation failed. Please contact support.',
          duration: 5000
        }
      });
      window.dispatchEvent(event);
    } finally {
      setCertificateLoading(false);
    }
  };
  */

  // Helper functions for certificate generation
  /*
  const calculateTotalTimeSpent = (): number => {
    return Object.values(lessonProgress).reduce((total, progress) => {
      return total + (progress.time_spent || 0);
    }, 0);
  };

  const calculateFinalScore = (): number => {
    // For now, return 100% as we don't have quiz scores in progress yet
    // This could be enhanced to track actual quiz performance
    return 100;
  };

  const getQuizzesPassed = (): number => {
    // Count completed lessons as passed "quizzes" for now
    return Object.values(lessonProgress).filter(p => p.completed).length;
  };

  const formatCompletionTime = (): string => {
    const totalMinutes = Math.round(calculateTotalTimeSpent() / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };
  */

  // AI-powered smart recommendations (defined before all conditional returns)
  const generateSmartRecommendations = useCallback(() => {
    if (!currentModule || !currentLessonData) return;
    
    const recommendations = [];
    const currentLessonProgress = lessonProgress[currentLessonData.id];
    const isLessonCompleted = currentLessonProgress?.completed || false;
    
    // Based on current progress and engagement
    if (videoProgress < 50 && engagementMetrics.timeSpent > 300000) { // 5+ minutes
      recommendations.push({
        type: 'speed',
        title: 'Try adjusting video speed',
        description: 'Consider increasing playback speed to 1.25x for better engagement',
        action: () => {
          if (videoRef.current) {
            videoRef.current.playbackRate = 1.25;
          }
        }
      });
    }
    
    if (isLessonCompleted && currentLessonIndex < (currentModule?.lessons.length || 0) - 1) {
      recommendations.push({
        type: 'next',
        title: 'Continue momentum',
        description: 'You\'re doing great! Ready for the next lesson?',
        action: handleNextLesson
      });
    }
    
    if (reflection.length > 0 && reflection.length < 50) {
      recommendations.push({
        type: 'reflect',
        title: 'Expand your reflection',
        description: 'Add more details to deepen your learning experience',
        action: () => document.querySelector('textarea')?.focus()
      });
    }
    
    setSmartRecommendations(recommendations);
  }, [videoProgress, engagementMetrics, currentLessonIndex, currentModule, reflection, lessonProgress, currentLessonData, handleNextLesson]);

  // Generate recommendations when engagement changes
  useEffect(() => {
    if (engagementMetrics.interactions > 0) {
      generateSmartRecommendations();
    }
  }, [engagementMetrics.interactions, generateSmartRecommendations]);

  // Real-time progress prediction
  const predictCompletionTime = useMemo(() => {
    if (!course || engagementMetrics.timeSpent < 60000) return null; // Need at least 1 minute of data

    const totalLessons = course.modules?.reduce((acc, module) => acc + module.lessons.length, 0) || 0;
    const completedLessons = Object.values(lessonProgress).filter(p => p.completed).length;
    const avgTimePerLesson = engagementMetrics.timeSpent / Math.max(completedLessons, 1);
    const remainingLessons = totalLessons - completedLessons;
    const estimatedTimeRemaining = remainingLessons * avgTimePerLesson;
    
    return {
      totalLessons,
      completedLessons,
      remainingLessons,
      estimatedTimeRemaining,
      completionPercentage: Math.round((completedLessons / totalLessons) * 100)
    };
  }, [course, lessonProgress, engagementMetrics.timeSpent]);

  const calculateOverallProgress = () => {
    const totalLessons = (course.modules || []).reduce((acc, module) => acc + module.lessons.length, 0);
    const completedLessons = Object.values(lessonProgress).filter(progress => progress.completed).length;
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  };

  const overallProgress = calculateOverallProgress();

  useEffect(() => {
    if (overallProgress >= 100) {
      setShowCompletionModal(true);
    }
  }, [overallProgress]);

  if (!course) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Course Not Found</h1>
        <Link to="/lms/courses" className="text-orange-500 hover:text-orange-600">
          ← Back to Courses
        </Link>
      </div>
    );
  }

  // Show loading state while progress is loading
  if (progressLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900">Loading course...</h2>
      </div>
    );
  }
  // Show error state if there's an authentication or loading error
  if (progressError) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Unable to Load Course</h2>
          <p className="text-red-700 mb-4">Please make sure you're logged in and try again.</p>
          <Link 
            to="/lms/login" 
            className="inline-flex items-center bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }
  if (!currentModule || !currentLessonData) {
    return <div className="p-6">Loading...</div>;
  }

  const currentLessonProgress = lessonProgress[currentLessonData.id];
  const isLessonCompleted = currentLessonProgress?.completed || false;



  const handleQuizSubmit = async () => {
    if (!currentLessonData.content.questions) return;

    const questions = currentLessonData.content.questions;
    let score = 0;
    const maxScore = questions.length;

    // Calculate score
    questions.forEach((question: any) => {
      if (quizAnswers[question.id] === question.correctAnswerIndex) {
        score++;
      }
    });

    const percentage = Math.round((score / maxScore) * 100);
    const passed = percentage >= (currentLessonData.content.passingScore || 80);

    setQuizScore({ score, maxScore, passed });
    setQuizSubmitted(true);

    try {
      // TODO: Implement submitQuizAttempt function
      // await submitQuizAttempt(currentLessonData.id, quizAnswers, score, maxScore);
    } catch (error) {
      console.error('Error submitting quiz:', error);
    }
  };

  const handleInteractiveSubmit = () => {
    setShowInteractiveFeedback(true);
    // Mark as completed if correct answer selected
    const hasCorrectAnswer = Object.entries(interactiveAnswers).some(([index, selected]) => {
      if (!selected) return false;
                      const option = currentLessonData.content?.options?.[parseInt(index)];
      return option?.isCorrect;
    });

    if (hasCorrectAnswer) {
      updateCurrentLessonProgress({
        completed: true,
        progress_percentage: 100
      });
    }
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-5 w-5" />;
      case 'interactive':
        return <MessageSquare className="h-5 w-5" />;
      case 'quiz':
        return <CheckCircle className="h-5 w-5" />;
      case 'download':
        return <Download className="h-5 w-5" />;
      case 'text':
        return <BookOpen className="h-5 w-5" />;
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const renderQuizContent = () => {
    return (
      <div className="bg-orange-50 p-6 rounded-lg">
        {currentLessonData.content.questions?.map((question: any, qIndex: number) => (
          <div key={question.id} className="mb-8 last:mb-6">
            <h4 className="font-medium text-orange-900 mb-4 text-lg">
              Question {qIndex + 1}: {question.text}
            </h4>
            
            <div className="space-y-3">
              {question.options.map((option: string, oIndex: number) => (
                <button
                  key={oIndex}
                  onClick={() => {
                    if (!quizSubmitted) {
                      setQuizAnswers(prev => ({
                        ...prev,
                        [question.id]: oIndex
                      }));
                    }
                  }}
                  disabled={quizSubmitted}
                  className={`w-full text-left p-4 border-2 rounded-lg transition-all duration-200 ${
                    quizSubmitted
                      ? oIndex === question.correctAnswerIndex
                        ? 'border-green-500 bg-green-50'
                        : quizAnswers[question.id] === oIndex
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                      : quizAnswers[question.id] === oIndex
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-orange-200 hover:border-orange-300 hover:bg-orange-50'
                  } ${quizSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      quizSubmitted
                        ? oIndex === question.correctAnswerIndex
                          ? 'border-green-500 bg-green-500'
                          : quizAnswers[question.id] === oIndex
                          ? 'border-red-500 bg-red-500'
                          : 'border-gray-300'
                        : quizAnswers[question.id] === oIndex
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-orange-300'
                    }`}>
                      {((quizSubmitted && oIndex === question.correctAnswerIndex) || 
                        (!quizSubmitted && quizAnswers[question.id] === oIndex)) && (
                        <div className="w-full h-full rounded-full bg-white scale-50"></div>
                      )}
                    </div>
                    <span className="text-orange-900">{option}</span>
                  </div>
                </button>
              ))}
            </div>
            
            {quizSubmitted && question.explanation && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Explanation:</h5>
                <p className="text-blue-800 text-sm">{question.explanation}</p>
              </div>
            )}
          </div>
        ))}
        
        {!quizSubmitted && (
          <div className="text-center">
            <button
              onClick={handleQuizSubmit}
              disabled={Object.keys(quizAnswers).length !== currentLessonData.content.questions?.length}
              className="bg-orange-600 text-white px-8 py-3 rounded-lg hover:bg-orange-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto space-x-2"
            >
              <Send className="h-5 w-5" />
              <span>Submit Quiz</span>
            </button>
          </div>
        )}

        {quizSubmitted && quizScore && (
          <div className={`mt-6 p-6 rounded-lg border-2 ${
            quizScore.passed ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
          }`}>
            <div className="text-center">
              <div className={`text-3xl font-bold mb-2 ${
                quizScore.passed ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.round((quizScore.score / quizScore.maxScore) * 100)}%
              </div>
              <p className={`text-lg font-medium mb-2 ${
                quizScore.passed ? 'text-green-800' : 'text-red-800'
              }`}>
                {quizScore.passed ? 'Congratulations! You passed!' : 'Keep studying and try again'}
              </p>
              <p className={`text-sm ${
                quizScore.passed ? 'text-green-700' : 'text-red-700'
              }`}>
                You scored {quizScore.score} out of {quizScore.maxScore} questions correctly
              </p>
              
              {quizScore.passed && (
                <div className="mt-4 flex items-center justify-center space-x-2 text-green-700">
                  <Award className="h-5 w-5" />
                  <span className="font-medium">Lesson completed!</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCurrentLessonContent = () => {
    console.log('🎥 Rendering lesson content:', {
      lessonData: currentLessonData,
      type: currentLessonData.type,
      content: currentLessonData.content,
      videoUrl: currentLessonData.content?.videoUrl
    });
    
    // Debug: Always show what we're working with
    console.log('🔍 Video Debug Details:', {
      lessonType: currentLessonData.type,
      content: currentLessonData.content,
      videoUrl: currentLessonData.content?.videoUrl,
      videoSourceType: currentLessonData.content?.videoSourceType,
      hasContent: !!currentLessonData.content
    });
    
    // Try to render video for any lesson type first, then fall back to type-specific rendering
    const hasVideoContent = currentLessonData.content?.videoUrl || 
                           (currentLessonData.type === 'video');
    
    if (hasVideoContent || currentLessonData.type === 'video') {
      // Try to get the video URL
      const videoUrl = currentLessonData.content?.videoUrl;
      
      console.log('🎯 Current Lesson Debug:', {
        lessonId: currentLessonData.id,
        lessonTitle: currentLessonData.title,
        lessonType: currentLessonData.type,
        courseId: course?.id,
        courseTitle: course?.title,
        moduleId: currentModule?.id,
        moduleTitle: currentModule?.title,
        contentKeys: Object.keys(currentLessonData.content || {}),
        videoUrl: videoUrl
      });
      
      // Check if the video URL is actually valid (not empty, not just whitespace, not a placeholder)
      const isValidVideoUrl = videoUrl && 
                             videoUrl.trim() !== '' && 
                             videoUrl !== 'undefined' && 
                             videoUrl !== 'null' &&
                             !videoUrl.includes('placeholder') &&
                             (videoUrl.startsWith('http') || videoUrl.startsWith('blob:') || videoUrl.startsWith('data:'));
      
      // Special handling for different URL types
      const isBlobUrl = videoUrl?.startsWith('blob:');
      if (isBlobUrl) {
        console.log('⚠️ Warning: Blob URL detected - this may not work after page reload:', videoUrl);
      }
      
      console.log('🔍 Video URL Validation:', {
        rawVideoUrl: videoUrl,
        isValidVideoUrl,
        urlLength: videoUrl?.length,
        trimmed: videoUrl?.trim()
      });
      
      // Fallback video for demo purposes
      const fallbackVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      
      // Use the actual video URL if valid, otherwise use fallback
      const finalVideoUrl = isValidVideoUrl ? videoUrl : fallbackVideoUrl;
      const isUsingFallback = !isValidVideoUrl;
      const isUploadedVideo = videoUrl?.startsWith('uploaded:');
      
      console.log('🎬 Video URL Decision:', {
        videoUrl,
        finalVideoUrl,
        isUsingFallback
      });
      
      return (
        <div className="space-y-4">
          <EnhancedVideoPlayer
            src={finalVideoUrl}
            title={currentLessonData.title}
            onProgress={(progress) => {
              setVideoProgress(progress);
              
              if (progress > (currentLessonProgress?.progress_percentage || 0)) {
                const progressData = {
                  progress_percentage: progress,
                  time_spent: Math.round((progress / 100) * (videoRef.current?.duration || 0))
                };
                
                // Use debounced auto-save
                debouncedAutoSave({
                  lessonId: currentLessonData.id,
                  moduleId: currentModule.id,
                  progress: progressData
                });
              }
              
              // Track engagement milestones
              if (progress === 25 || progress === 50 || progress === 75) {
                trackEngagement('progress_milestone', { milestone: progress });
              }
            }}
            onComplete={() => {
              trackEngagement('video_complete');
              updateLessonProgress(currentLessonData.id, currentModule.id, {
                completed: true,
                progress_percentage: 100
              });
              
              // Generate completion celebration
              const event = new CustomEvent('show-notification', {
                detail: {
                  type: 'success',
                  message: `🎉 Lesson completed! Great job!`,
                  duration: 3000
                }
              });
              window.dispatchEvent(event);
            }}
            initialTime={currentLessonProgress?.time_spent || 0}
            autoPlay={false}
            showTranscript={!!currentLessonData.content?.transcript}
            transcript={currentLessonData.content?.transcript || ''}
            captions={currentLessonData.content?.captions?.map(c => ({
              start: c.startTime || 0,
              end: c.endTime || 0,
              text: c.text || ''
            })) || []}
            className="aspect-video"
          />
          
          {/* Debug overlay to show video status */}
          {isUsingFallback && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 text-sm">
                <strong>🚧 Demo Video:</strong> Using fallback video for demonstration.
              </p>
            </div>
          )}

          {!isUsingFallback && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-800 text-sm">
                <strong>✅ Course Video:</strong> Playing actual lesson video content.
              </p>
            </div>
          )}

          {isUsingFallback && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 text-sm">
                {isUploadedVideo ? (
                  <>
                    <strong>🚧 Demo Video (File Upload):</strong> You uploaded a video file ({videoUrl?.replace('uploaded:', '')}),
                    but file uploads require cloud storage setup. Playing demo video for now.
                  </>
                ) : (
                  <>
                    <strong>🚧 Demo Video:</strong> No valid video URL found in lesson content. 
                    Playing fallback video for demonstration.
                  </>
                )}
              </p>
              <div className="mt-3 text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <strong>Debug Info:</strong><br/>
                    Course ID: {course?.id || 'undefined'}<br/>
                    Lesson ID: {currentLessonData?.id || 'undefined'}<br/>
                    Lesson Type: {currentLessonData?.type || 'undefined'}<br/>
                    Video URL: {videoUrl || 'undefined'}<br/>
                    Content Keys: {Object.keys(currentLessonData?.content || {}).join(', ') || 'none'}
                  </div>
                  <div className="ml-4 flex flex-col space-y-1">
                    <button
                      onClick={() => {
                        console.log('🔄 Force refreshing course data...');
                        window.location.reload();
                      }}
                      className="bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={() => {
                        console.log('🔍 Course Data:', course);
                        console.log('📊 Current Lesson:', currentLessonData);
                        alert('Check browser console for detailed course data');
                      }}
                      className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                    >
                      Debug
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!isUsingFallback && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-green-800 text-sm">
                <strong>✅ Course Video:</strong> Playing actual lesson video content.
              </p>
            </div>
          )}
          
          {currentLessonData.content?.transcript && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Transcript</h4>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{currentLessonData.content.transcript}</p>
            </div>
          )}
          
          {currentLessonData.content?.notes && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Key Notes</h4>
              <p className="text-blue-800 text-sm">{currentLessonData.content.notes}</p>
            </div>
          )}
        </div>
      );
    }

    // Enhanced rendering that supports mixed content types
    const hasQuizContent = currentLessonData.content?.questions && currentLessonData.content.questions.length > 0;
    const hasTextContent = currentLessonData.content?.content || currentLessonData.content?.textContent;
    
    // Create a container for mixed content
    const contentSections = [];
    
    // Add quiz content if present (for mixed video+quiz lessons)
    if (hasQuizContent) {
      contentSections.push(
        <div key="quiz-section" className="mt-8">
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <CheckCircle className="h-6 w-6 mr-2 text-orange-500" />
              Knowledge Check
            </h3>
            {renderQuizContent()}
          </div>
        </div>
      );
    }
    
    // Add text content if present (for mixed lessons with additional reading)
    if (hasTextContent) {
      contentSections.push(
        <div key="text-section" className="mt-8">
          <div className="border-t border-gray-200 pt-8">
            <div className="prose max-w-none">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-blue-900 mb-4">
                  {currentLessonData.content.title || 'Additional Reading'}
                </h3>
                <div className="text-blue-800 whitespace-pre-wrap">
                  {currentLessonData.content.content || currentLessonData.content.textContent}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // If we have mixed content, return all sections
    if (contentSections.length > 0) {
      return (
        <div className="space-y-6">
          {contentSections}
        </div>
      );
    }
    
    // Fall back to type-specific rendering for single-content lessons
    switch (currentLessonData.type) {

      case 'interactive':
        return (
          <div className="space-y-6">
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-green-900 mb-4">Interactive Exercise</h3>
              <p className="text-green-800 text-lg mb-6">{currentLessonData.content.scenarioText}</p>
              
              {currentLessonData.content.instructions && (
                <div className="bg-green-100 p-4 rounded-lg mb-6">
                  <p className="text-green-800 text-sm font-medium">{currentLessonData.content.instructions}</p>
                </div>
              )}
              
              <div className="space-y-3">
                {currentLessonData.content.options?.map((option: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInteractiveAnswers({ [index]: true });
                      if (!showInteractiveFeedback) {
                        setShowInteractiveFeedback(true);
                      }
                    }}
                    className={`w-full text-left p-4 border-2 rounded-lg transition-all duration-200 ${
                      interactiveAnswers[index]
                        ? option.isCorrect
                          ? 'border-green-500 bg-green-50'
                          : 'border-red-500 bg-red-50'
                        : 'border-green-200 hover:border-green-300 hover:bg-green-50'
                    }`}
                  >
                    <p className="font-medium text-green-900 mb-2">{option.text}</p>
                    {showInteractiveFeedback && interactiveAnswers[index] && (
                      <div className={`mt-3 p-3 rounded-lg ${
                        option.isCorrect ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <div className="flex items-center space-x-2 mb-2">
                          {option.isCorrect ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          )}
                          <span className={`font-medium ${
                            option.isCorrect ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {option.isCorrect ? 'Correct!' : 'Not quite right'}
                          </span>
                        </div>
                        <p className={`text-sm ${
                          option.isCorrect ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {option.feedback}
                        </p>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {showInteractiveFeedback && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleInteractiveSubmit}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center mx-auto space-x-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span>Complete Exercise</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'quiz':
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-orange-900 mb-6">Knowledge Check</h3>
              
              {currentLessonData.content.questions?.map((question: any, qIndex: number) => (
                <div key={question.id} className="mb-8 last:mb-6">
                  <h4 className="font-medium text-orange-900 mb-4 text-lg">
                    Question {qIndex + 1}: {question.text}
                  </h4>
                  
                  <div className="space-y-3">
                    {question.options.map((option: string, oIndex: number) => (
                      <button
                        key={oIndex}
                        onClick={() => {
                          if (!quizSubmitted) {
                            setQuizAnswers(prev => ({
                              ...prev,
                              [question.id]: oIndex
                            }));
                          }
                        }}
                        disabled={quizSubmitted}
                        className={`w-full text-left p-4 border-2 rounded-lg transition-all duration-200 ${
                          quizSubmitted
                            ? oIndex === question.correctAnswerIndex
                              ? 'border-green-500 bg-green-50'
                              : quizAnswers[question.id] === oIndex
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 bg-gray-50'
                            : quizAnswers[question.id] === oIndex
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-orange-200 hover:border-orange-300 hover:bg-orange-50'
                        } ${quizSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            quizSubmitted
                              ? oIndex === question.correctAnswerIndex
                                ? 'border-green-500 bg-green-500'
                                : quizAnswers[question.id] === oIndex
                                ? 'border-red-500 bg-red-500'
                                : 'border-gray-300'
                              : quizAnswers[question.id] === oIndex
                              ? 'border-orange-500 bg-orange-500'
                              : 'border-orange-300'
                          }`}>
                            {((quizSubmitted && oIndex === question.correctAnswerIndex) || 
                              (!quizSubmitted && quizAnswers[question.id] === oIndex)) && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                          <span className="text-orange-900">{option}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {quizSubmitted && question.explanation && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="font-medium text-blue-900 mb-2">Explanation:</h5>
                      <p className="text-blue-800 text-sm">{question.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
              
              {!quizSubmitted && (
                <div className="text-center">
                  <button
                    onClick={handleQuizSubmit}
                    disabled={Object.keys(quizAnswers).length !== currentLessonData.content.questions?.length}
                    className="bg-orange-600 text-white px-8 py-3 rounded-lg hover:bg-orange-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto space-x-2"
                  >
                    <Send className="h-5 w-5" />
                    <span>Submit Quiz</span>
                  </button>
                </div>
              )}

              {quizSubmitted && quizScore && (
                <div className={`mt-6 p-6 rounded-lg border-2 ${
                  quizScore.passed ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                }`}>
                  <div className="text-center">
                    <div className={`text-3xl font-bold mb-2 ${
                      quizScore.passed ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Math.round((quizScore.score / quizScore.maxScore) * 100)}%
                    </div>
                    <p className={`text-lg font-medium mb-2 ${
                      quizScore.passed ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {quizScore.passed ? 'Congratulations! You passed!' : 'Keep studying and try again'}
                    </p>
                    <p className={`text-sm ${
                      quizScore.passed ? 'text-green-700' : 'text-red-700'
                    }`}>
                      You scored {quizScore.score} out of {quizScore.maxScore} questions correctly
                    </p>
                    
                    {quizScore.passed && (
                      <div className="mt-4 flex items-center justify-center space-x-2 text-green-700">
                        <Award className="h-5 w-5" />
                        <span className="font-medium">Lesson completed!</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'document':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-blue-900 mb-4">
                {currentLessonData.content.title || currentLessonData.title}
              </h3>
              <p className="text-blue-800 mb-6">
                {currentLessonData.content.description || 'Download the resource below to continue your learning.'}
              </p>
              
              {currentLessonData.content.fileUrl && currentLessonData.content.fileUrl.trim() ? (
                <div className="text-center">
                  <a
                    href={currentLessonData.content.fileUrl}
                    download={currentLessonData.content.fileName}
                    onClick={() => {
                      updateLessonProgress(currentLessonData.id, currentModule.id, {
                        completed: true,
                        progress_percentage: 100
                      });
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 space-x-3 text-lg font-medium"
                  >
                    <Download className="h-6 w-6" />
                    <span>Download {currentLessonData.content.fileName || 'Resource'}</span>
                    {currentLessonData.content.fileSize && (
                      <span className="text-blue-200">({currentLessonData.content.fileSize})</span>
                    )}
                  </a>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                  <p className="text-blue-700">Resource is being prepared</p>
                  <p className="text-blue-600 text-sm mt-1">Please check back later or contact your instructor</p>
                </div>
              )}
              
              {currentLessonData.content.instructions && (
                <div className="mt-6 bg-blue-100 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Instructions</h4>
                  <p className="text-blue-800 text-sm">{currentLessonData.content.instructions}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-6">
            <div className="bg-indigo-50 p-6 rounded-lg">
              <div className="prose max-w-none">
                {currentLessonData.content.content && (
                  <div className="text-gray-900 leading-relaxed whitespace-pre-wrap mb-6">
                    {currentLessonData.content.content}
                  </div>
                )}
                
                {currentLessonData.content.allowReflection && currentLessonData.content.reflectionPrompt && (
                  <div className="mt-8 bg-indigo-100 p-6 rounded-lg border border-indigo-200">
                    <h4 className="font-medium text-indigo-900 mb-4 flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Reflection
                      {currentLessonData.content.requireReflection && (
                        <span className="ml-2 text-sm text-indigo-700 bg-indigo-200 px-2 py-1 rounded">Required</span>
                      )}
                    </h4>
                    <p className="text-indigo-800 mb-4">{currentLessonData.content.reflectionPrompt}</p>
                    
                    <textarea
                      rows={6}
                      className="w-full p-4 border border-indigo-200 rounded-lg resize-vertical focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Share your thoughts and reflections here..."
                      onChange={(e) => {
                        // Auto-save reflection progress
                        if (e.target.value.length > 50) {
                          updateLessonProgress(currentLessonData.id, currentModule.id, {
                            progress_percentage: Math.max(currentLessonProgress?.progress_percentage || 0, 75),
                            time_spent: (currentLessonProgress?.time_spent || 0) + 1
                          });
                        }
                      }}
                    />
                    
                    <div className="mt-4 flex justify-between items-center">
                      <p className="text-sm text-indigo-600">
                        Take your time to reflect on the content above.
                      </p>
                      <button
                        onClick={() => {
                          updateLessonProgress(currentLessonData.id, currentModule.id, {
                            completed: true,
                            progress_percentage: 100
                          });
                        }}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center space-x-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Complete Reflection</span>
                      </button>
                    </div>
                  </div>
                )}
                
                {!currentLessonData.content.allowReflection && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => {
                        updateLessonProgress(currentLessonData.id, currentModule.id, {
                          completed: true,
                          progress_percentage: 100
                        });
                      }}
                      className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center mx-auto space-x-2"
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span>Mark as Complete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{currentLessonData.title}</h3>
            <p className="text-gray-600">Content for this lesson type is not yet available.</p>
          </div>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" style={{ minHeight: '100vh' }}>
      {/* Floating Progress Bar */}
      <FloatingProgressBar 
        currentProgress={overallProgress}
        totalLessons={(course.modules || []).reduce((acc, module) => acc + module.lessons.length, 0)}
        completedLessons={Object.values(lessonProgress).filter(progress => progress.completed).length}
        currentLessonTitle={currentLessonData.title}
        onPrevious={handlePrevLesson}
        onNext={handleNextLesson}
        hasPrevious={!(currentModuleIndex === 0 && currentLessonIndex === 0)}
        hasNext={true}
        estimatedTimeRemaining={predictCompletionTime ? `${Math.round(predictCompletionTime.estimatedTimeRemaining / (1000 * 60 * 60 * 24))} days` : undefined}
        visible={true}
      />

      {/* Refresh Notification */}
      {showRefreshNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="h-5 w-5" />
          <span>Course content refreshed successfully!</span>
        </div>
      )}

      {/* Course Completion Modal */}
      {overallProgress >= 100 && showCompletionModal && (
        <CourseCompletion
          course={{
            id: course.id,
            title: course.title,
            description: course.description || '',
            instructor: course.instructorName || 'Course Instructor',
            duration: course.duration,
            modules: course.modules?.map(module => ({
              id: module.id,
              title: module.title,
              lessons: module.lessons.map(lesson => ({
                id: lesson.id,
                title: lesson.title,
                completed: lessonProgress[lesson.id]?.completed || false
              }))
            }))
          }}
          completionData={{
            completedAt: new Date(),
            timeSpent: Math.round(focusTime / 60), // Convert seconds to minutes
            score: 85, // This would come from actual quiz data
            grade: 'A',
            certificateId: `cert-${course.id}-${Date.now()}`,
            certificateUrl: `/certificates/${course.id}`
          }}
          keyTakeaways={course.keyTakeaways || [
            'Enhanced leadership skills through practical application',
            'Improved understanding of team dynamics and communication',
            'Developed strategic thinking and decision-making abilities'
          ]}
          nextSteps={[
            {
              title: 'Advanced Leadership Course',
              description: 'Continue your leadership journey with advanced concepts',
              href: '/lms/courses/advanced-leadership'
            },
            {
              title: 'Mentorship Program',
              description: 'Apply your skills by mentoring other learners',
              href: '/lms/mentorship'
            }
          ]}
          onClose={() => {
            // Handle completion modal close
            setShowCompletionModal(false);
            navigate('/lms/courses');
          }}
          onCertificateDownload={async () => {
            // Handle certificate download
            trackEngagement('certificate_downloaded');
            // certificateService.downloadCertificate(course.id, user.id);
          }}
          onShareComplete={(platform: string) => {
            // Handle social sharing
            trackEngagement('achievement_shared', { platform });
          }}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <Link 
          to="/lms/courses" 
          className="inline-flex items-center text-orange-500 hover:text-orange-600 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Courses
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
        <p className="text-gray-600">{course.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Module {currentModuleIndex + 1} of {(course.modules || []).length}: {currentModule.title}
          </span>
          <button
            onClick={refreshCourseData}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh course content"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Content'}
          </button>
        </div>
      </div>

      {/* Success Notification for Course Refresh */}
      {showRefreshNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="font-medium">Course content updated successfully!</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Course Progress Sidebar */}
        {course && course.modules && course.modules.length > 0 && (
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Course Progress</h3>
              <div className="space-y-4">
                {(course.modules || []).map((module, moduleIndex) => (
                  <div key={module.id} className="border border-gray-200 rounded-lg">
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <h4 className="font-medium text-gray-900">{module.title}</h4>
                    </div>
                    <div className="p-2 space-y-1">
                      {module.lessons.map((lesson, lessonIndex) => {
                        const lessonProgressData = lessonProgress[lesson.id];
                        const isCurrentLesson = moduleIndex === currentModuleIndex && lessonIndex === currentLessonIndex;
                        
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => {
                              setCurrentModuleIndex(moduleIndex);
                              setCurrentLessonIndex(lessonIndex);
                              setQuizAnswers({});
                              setQuizSubmitted(false);
                              setQuizScore(null);
                              navigate(`/lms/module/${module.id}/lesson/${lesson.id}`);
                            }}
                            className={`w-full text-left p-2 rounded-lg transition-colors duration-200 ${
                              isCurrentLesson
                                ? 'bg-orange-50 border border-orange-200'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`p-1 rounded ${
                                  isCurrentLesson 
                                    ? 'text-orange-500' 
                                    : lessonProgressData?.completed
                                    ? 'text-green-500'
                                    : 'text-gray-400'
                                }`}>
                                  {lessonProgressData?.completed ? (
                                    <CheckCircle className="h-5 w-5" />
                                  ) : (
                                    <Clock className="h-5 w-5" />
                                  )}
                                </div>
                                <div>
                                  <p className={`font-medium text-sm ${
                                    isCurrentLesson 
                                      ? 'text-orange-900' 
                                      : 'text-gray-900'
                                  }`}>
                                    {lesson.title}
                                  </p>
                                  <p className="text-xs text-gray-600">{lesson.duration}</p>
                                </div>
                              </div>
                              {lessonProgressData?.completed && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Lesson Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{currentLessonData.title}</h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {currentLessonData.duration}
                    </span>
                    <span className="capitalize">{currentLessonData.type}</span>
                    {isLessonCompleted && (
                      <span className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Completed
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePrevLesson}
                    disabled={currentModuleIndex === 0 && currentLessonIndex === 0}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNextLesson}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                  {!isLessonCompleted && currentLessonData.type !== 'quiz' && (
                    <button
                      onClick={() => markLessonComplete(currentLessonData.id, currentModule.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Mark Complete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {renderCurrentLessonContent()}
            </div>
          </div>

          {/* Enhanced Reflection Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-500" />
                Reflection & Notes
              </h3>
              <div className="flex items-center space-x-2">
                {isAutoSaving && (
                  <div className="flex items-center text-orange-600 text-sm">
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Auto-saving...
                  </div>
                )}
                {lastSavedAt && (
                  <div className="flex items-center text-green-600 text-sm">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Saved {lastSavedAt.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="relative">
              <textarea
                value={reflection}
                onChange={(e) => {
                  setReflection(e.target.value);
                  trackEngagement('reflection_edit');
                  
                  // Trigger auto-save for reflection
                  debouncedAutoSave({
                    lessonId: currentLessonData.id,
                    moduleId: currentModule.id,
                    progress: { reflection: e.target.value }
                  });
                }}
                onFocus={() => trackEngagement('reflection_focus')}
                placeholder="What are your key takeaways from this lesson? How will you apply these concepts in your leadership role?"
                className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition-all duration-200"
              />
              
              {/* Character count and writing tips */}
              <div className="absolute bottom-2 right-2 flex items-center space-x-2">
                <div className={`text-xs px-2 py-1 rounded ${
                  reflection.length > 200 
                    ? 'bg-green-100 text-green-600' 
                    : reflection.length > 50
                    ? 'bg-yellow-100 text-yellow-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {reflection.length} chars
                </div>
              </div>
            </div>
            
            {/* Smart writing prompts */}
            {reflection.length < 50 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">💡 Writing Prompts:</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• What surprised you most about this content?</li>
                  <li>• How does this relate to your current leadership challenges?</li>
                  <li>• What specific action will you take this week?</li>
                </ul>
              </div>
            )}
            
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-600">
                {reflections[currentLessonData.id] 
                  ? `Previously saved: ${new Date(reflections[currentLessonData.id].updated_at).toLocaleString()}`
                  : 'Notes are auto-saved as you type'
                }
              </p>
              <div className="flex items-center space-x-3">
                {reflection.length >= 100 && (
                  <div className="flex items-center text-green-600 text-sm">
                    <Trophy className="h-4 w-4 mr-1" />
                    Great reflection!
                  </div>
                )}
                <button 
                  onClick={handleSaveReflection}
                  disabled={!reflection.trim()}
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Now</span>
                </button>
              </div>
            </div>
          </div>

          {/* Key Takeaways */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Key Takeaways</h3>
            <ul className="space-y-3">
              {(course.keyTakeaways || []).map((takeaway, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Sidebar - Additional Resources */}
        <div className="lg:w-80 flex-shrink-0 space-y-6">
          {/* Smart Recommendations */}
          {smartRecommendations.length > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 p-6">
              <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
                <Lightbulb className="h-5 w-5 mr-2 text-yellow-500" />
                Smart Recommendations
              </h3>
              <div className="space-y-3">
                {smartRecommendations.map((rec, index) => (
                  <div key={index} className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-blue-200/50 hover:bg-white/90 transition-all duration-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-blue-900 mb-1">{rec.title}</h4>
                        <p className="text-sm text-blue-700 mb-3">{rec.description}</p>
                        <button
                          onClick={rec.action}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors duration-200"
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Apply
                        </button>
                      </div>
                      <div className="ml-3">
                        {rec.type === 'speed' && <PlayCircle className="h-5 w-5 text-blue-500" />}
                        {rec.type === 'next' && <ArrowRight className="h-5 w-5 text-green-500" />}
                        {rec.type === 'reflect' && <MessageSquare className="h-5 w-5 text-orange-500" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-time Engagement Metrics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
              Your Progress Today
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{Math.round(focusTime / 60)}</div>
                <div className="text-xs text-gray-600">Minutes Focused</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{engagementMetrics.interactions}</div>
                <div className="text-xs text-gray-600">Interactions</div>
              </div>
            </div>
            {predictCompletionTime && (
              <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                <div className="text-sm font-medium text-purple-900 mb-1">
                  Completion Prediction
                </div>
                <div className="text-lg font-bold text-purple-600">
                  {Math.round(predictCompletionTime.estimatedTimeRemaining / (1000 * 60 * 60 * 24))} days
                </div>
                <div className="text-xs text-purple-700">
                  {predictCompletionTime.remainingLessons} lessons remaining
                </div>
              </div>
            )}
            {!isPageFocused && (
              <div className="mt-3 flex items-center text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Focus to continue tracking progress
              </div>
            )}
          </div>

          {/* Course Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Course Progress</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Overall Progress</span>
                <span>{overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full transition-all duration-700 ease-out relative"
                  style={{ width: `${overallProgress}%` }}
                >
                  {/* Progress shine animation */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                </div>
                
                {/* Milestone markers */}
                {[25, 50, 75].map(milestone => (
                  <div 
                    key={milestone}
                    className={`absolute top-0 bottom-0 w-0.5 transition-colors duration-300 ${
                      overallProgress >= milestone 
                        ? 'bg-green-400' 
                        : 'bg-gray-300'
                    }`}
                    style={{ left: `${milestone}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">
                {Object.values(lessonProgress).filter(p => p.completed).length}
              </span> of{' '}
              <span className="font-medium">
                {(course.modules || []).reduce((acc, m) => acc + m.lessons.length, 0)}
              </span> lessons completed
            </div>
            
            {overallProgress === 100 && (
              <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg text-center relative overflow-hidden animate-pulse">
                {/* Celebration background effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-100/0 via-green-100/50 to-green-100/0 animate-pulse"></div>
                
                <div className="relative">
                  <Award className="h-10 w-10 text-green-600 mx-auto mb-3 animate-bounce" />
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-2xl">🎉</span>
                    <p className="font-bold text-green-800 text-lg">Course Completed!</p>
                    <span className="text-2xl">🎉</span>
                  </div>
                  <p className="text-sm text-green-700 mb-3">
                    Congratulations! You've successfully completed all lessons.
                  </p>
                  
                  {/* Progress celebration stats */}
                  <div className="flex justify-center space-x-4 text-xs text-green-600">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-3 w-3" />
                      <span>{Object.values(lessonProgress).filter(p => p.completed).length} Lessons</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{course.duration}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-3 w-3" />
                      <span>100% Complete</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Module and Lesson List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Course Content</h3>
            <div className="space-y-4">
              {(course.modules || []).map((module, moduleIndex) => (
                <div key={module.id} className="border border-gray-200 rounded-lg">
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">{module.title}</h4>
                    <p className="text-sm text-gray-600">{module.lessons.length} lessons • {module.duration}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {module.lessons.map((lesson, lessonIndex) => {
                      const lessonProgressData = lessonProgress[lesson.id];
                      const isCurrentLesson = moduleIndex === currentModuleIndex && lessonIndex === currentLessonIndex;
                      
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => {
                            setCurrentModuleIndex(moduleIndex);
                            setCurrentLessonIndex(lessonIndex);
                            // Reset states for new lesson
                            setQuizAnswers({});
                            setQuizSubmitted(false);
                            setQuizScore(null);
                            setInteractiveAnswers({});
                            setShowInteractiveFeedback(false);
                            navigate(`/lms/module/${moduleId}/lesson/${lesson.id}`);
                          }}
                          className={`w-full text-left p-2 rounded-lg transition-colors duration-200 ${
                            isCurrentLesson
                              ? 'bg-orange-50 border border-orange-200'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`p-1 rounded ${
                                isCurrentLesson 
                                  ? 'text-orange-500' 
                                  : lessonProgressData?.completed
                                  ? 'text-green-500'
                                  : 'text-gray-400'
                              }`}>
                                {lessonProgressData?.completed ? (
                                  <CheckCircle className="h-5 w-5" />
                                ) : (
                                  getLessonIcon(lesson.type)
                                )}
                              </div>
                              <div>
                                <p className={`font-medium text-sm ${
                                  isCurrentLesson 
                                    ? 'text-orange-900' 
                                    : 'text-gray-900'
                                }`}>
                                  {lesson.title}
                                </p>
                                <p className="text-xs text-gray-600">{lesson.duration}</p>
                              </div>
                            </div>
                            {lessonProgressData?.completed && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          
                          {lessonProgressData && lessonProgressData.progress_percentage > 0 && lessonProgressData.progress_percentage < 100 && (
                            <div className="mt-2 ml-8">
                              <div className="w-full bg-gray-200 rounded-full h-1">
                                <div 
                                  className="bg-orange-400 h-1 rounded-full"
                                  style={{ width: `${lessonProgressData.progress_percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Module Resources</h3>
            <div className="space-y-3">
              {(currentModule.resources || []).map((resource, index) => (
                <a
                  key={index}
                  href={resource.downloadUrl}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">{resource.title}</p>
                      <p className="text-sm text-gray-600">{resource.type} • {resource.size}</p>
                    </div>
                  </div>
                  <Download className="h-5 w-5 text-gray-400" />
                </a>
              ))}
              {(currentModule.resources || []).length === 0 && (
                <p className="text-gray-500 text-center py-4">No additional resources for this module</p>
              )}
            </div>
          </div>

          {/* Rate This Module */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Rate This Module</h3>
            <p className="text-sm text-gray-600 mb-4">Help us improve the learning experience</p>
            <div className="flex items-center space-x-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  onClick={() => setModuleRating(star)}
                  className={`hover:text-yellow-500 ${moduleRating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                  <Star className="h-6 w-6 fill-current" />
                </button>
              ))}
              {moduleRating > 0 && (
                <span className="ml-2 text-sm text-gray-600">
                  Thanks for rating! ({moduleRating}/5)
                </span>
              )}
            </div>
            <Link
              to="/lms/feedback"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Leave detailed feedback →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LMSModule;