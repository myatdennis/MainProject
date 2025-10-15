import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { useEnhancedCourseProgress } from '../../hooks/useEnhancedCourseProgress';
import ClientErrorBoundary from '../../components/ClientErrorBoundary';
import { 
  CheckCircle, 
  Clock, 
  FileText, 
  Video,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  MessageSquare,

  Save,
  Award,
  AlertTriangle,
  Send,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const EnhancedLMSModule = () => {
  const { moduleId, lessonId } = useParams();
  const navigate = useNavigate();
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [reflection, setReflection] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<{ [questionId: string]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number; maxScore: number; passed: boolean } | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  
  // Get course from store
  const course = moduleId ? courseStore.getCourse(moduleId) : null;
  
  // Current module and lesson data
  const currentModule = course?.modules?.[currentModuleIndex];
  const currentLessonData = currentModule?.lessons[currentLessonIndex];
  
  // Enhanced course progress hook with real-time sync and auto-save
  const {
    lessonProgress,
    reflections,
    loading: progressLoading,
    error: progressError,
    updateLessonProgress,
    markLessonComplete,
    saveReflection: saveReflectionToProgress,
    setActiveLessonTracking,
    syncStatus,
    isOnline,
    isSaving,
    pendingChanges,
    calculateCourseProgress,
    getCompletionStats,
    forceSave
  } = useEnhancedCourseProgress(moduleId || '', {
    enableAutoSave: true,
    enableRealtime: true,
    autoSaveInterval: 30000
  });

  // Get current lesson progress
  const currentLessonProgress = currentLessonData ? lessonProgress[currentLessonData.id] : null;
  const currentReflection = currentLessonData ? reflections[currentLessonData.id] : null;

  // Sync URL parameters with state
  useEffect(() => {
    if (!course) return;
    
    // Find module and lesson indices from URL params
    if (lessonId) {
      for (let mi = 0; mi < (course.modules || []).length; mi++) {
        const module = (course.modules || [])[mi];
        const li = module.lessons.findIndex(l => l.id === lessonId);
        if (li !== -1) {
          setCurrentModuleIndex(mi);
          setCurrentLessonIndex(li);
          break;
        }
      }
    }
  }, [course, lessonId]);

  // Set active lesson tracking and load reflection
  useEffect(() => {
    if (currentLessonData?.id) {
      setActiveLessonTracking(currentLessonData.id);
      
      // Load existing reflection
      if (currentReflection?.content) {
        setReflection(currentReflection.content);
      } else {
        setReflection('');
      }
    }
  }, [currentLessonData?.id, currentReflection?.content, setActiveLessonTracking]);

  // Navigation helpers
  const goToNextLesson = () => {
    if (!course) return;
    
    const nextLessonIndex = currentLessonIndex + 1;
    if (nextLessonIndex < currentModule!.lessons.length) {
      const nextLesson = currentModule!.lessons[nextLessonIndex];
      navigate(`/lms/module/${moduleId}/lesson/${nextLesson.id}`);
    } else {
      // Move to next module
      const nextModuleIndex = currentModuleIndex + 1;
      if (nextModuleIndex < (course.modules || []).length) {
        const nextModule = (course.modules || [])[nextModuleIndex];
        const firstLesson = nextModule.lessons[0];
        navigate(`/lms/module/${moduleId}/lesson/${firstLesson.id}`);
      }
    }
  };

  const goToPreviousLesson = () => {
    if (!course) return;
    
    const prevLessonIndex = currentLessonIndex - 1;
    if (prevLessonIndex >= 0) {
      const prevLesson = currentModule!.lessons[prevLessonIndex];
      navigate(`/lms/module/${moduleId}/lesson/${prevLesson.id}`);
    } else {
      // Move to previous module
      const prevModuleIndex = currentModuleIndex - 1;
      if (prevModuleIndex >= 0) {
        const prevModule = (course.modules || [])[prevModuleIndex];
        const lastLesson = prevModule.lessons[prevModule.lessons.length - 1];
        navigate(`/lms/module/${moduleId}/lesson/${lastLesson.id}`);
      }
    }
  };

  // Progress tracking functions
  const updateCurrentLessonProgress = async (updates: any) => {
    if (!currentLessonData || !currentModule) return;
    
    try {
      await updateLessonProgress(currentLessonData.id, currentModule.id, updates);
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      toast.error('Failed to save progress');
    }
  };

  const handleMarkComplete = async () => {
    if (!currentLessonData || !currentModule) return;
    
    try {
      await markLessonComplete(currentLessonData.id, currentModule.id, quizScore?.score);
      toast.success('Lesson completed!');
      
      // Auto-navigate to next lesson after completion
      setTimeout(goToNextLesson, 2000);
    } catch (error) {
      console.error('Error marking lesson complete:', error);
      toast.error('Failed to mark lesson complete');
    }
  };

  const handleReflectionSave = async () => {
    if (!reflection.trim() || !currentLessonData) return;
    
    try {
      await saveReflectionToProgress(currentLessonData.id, reflection);
      toast.success('Reflection saved');
    } catch (error) {
      console.error('Error saving reflection:', error);
      toast.error('Failed to save reflection');
    }
  };

  const handleQuizSubmit = async () => {
    if (!currentLessonData?.content.questions) return;

    const questions = currentLessonData.content.questions;
    let score = 0;
    const maxScore = questions.length;

    // Calculate score
    questions.forEach((question: any, index: number) => {
      const userAnswer = quizAnswers[index];
      if (userAnswer === question.correctAnswer) {
        score++;
      }
    });

    const percentage = (score / maxScore) * 100;
    const passed = percentage >= 70; // 70% passing grade

    setQuizScore({ score, maxScore, passed });
    setQuizSubmitted(true);

    // Update lesson progress with quiz results
    await updateCurrentLessonProgress({
      completed: passed,
      progress_percentage: passed ? 100 : Math.max(currentLessonProgress?.progress_percentage || 0, percentage)
    });

    if (passed) {
      toast.success(`Quiz passed! Score: ${score}/${maxScore}`);
    } else {
      toast.error(`Quiz failed. Score: ${score}/${maxScore}. Need 70% to pass.`);
    }
  };

  // Video progress tracking
  const handleVideoProgress = (progress: number) => {
    setVideoProgress(progress);
    
    // Auto-save video progress every 10%
    if (progress % 10 === 0 && progress > (currentLessonProgress?.progress_percentage || 0)) {
      updateCurrentLessonProgress({
        progress_percentage: progress
      });
    }
  };

  const handleVideoComplete = () => {
    updateCurrentLessonProgress({
      completed: true,
      progress_percentage: 100
    });
  };

  // Force save function
  const handleForceSave = async () => {
    try {
      const success = await forceSave();
      if (success) {
        toast.success('All progress saved successfully');
      } else {
        toast.error('Some data could not be saved');
      }
    } catch (error) {
      toast.error('Failed to save progress');
    }
  };

  // Loading and error states
  if (progressLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading your learning session...</p>
        </div>
      </div>
    );
  }

  if (progressError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">{progressError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!course || !currentModule || !currentLessonData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="w-8 h-8 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Lesson not found</p>
        </div>
      </div>
    );
  }

  const completionStats = getCompletionStats();
  const courseProgress = calculateCourseProgress();

  return (
    <ClientErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header with sync status */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/lms/courses')}
                  className="flex items-center text-gray-600 hover:text-gray-800"
                >
                  <ArrowLeft className="w-5 h-5 mr-1" />
                  Back to Courses
                </button>
                <div className="text-sm text-gray-500">
                  {currentModule.title} • Lesson {currentLessonIndex + 1} of {currentModule.lessons.length}
                </div>
              </div>
              
              {/* Sync Status Indicators */}
              <div className="flex items-center space-x-4">
                {/* Online Status */}
                <div className={`flex items-center space-x-1 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  <span className="text-xs">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
                
                {/* Sync Status */}
                <div className={`flex items-center space-x-1 text-xs ${
                  syncStatus === 'synced' ? 'text-green-600' : 
                  syncStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {isSaving && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>
                    {syncStatus === 'synced' ? 'Synced' : 
                     syncStatus === 'pending' ? 'Saving...' : 'Sync Error'}
                  </span>
                  {pendingChanges > 0 && (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                      {pendingChanges} pending
                    </span>
                  )}
                </div>
                
                {/* Force Save Button */}
                <button
                  onClick={handleForceSave}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={isSaving}
                >
                  <Save className="w-3 h-3 inline mr-1" />
                  Save Now
                </button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Course Progress</span>
                <span>{courseProgress}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${courseProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Main Lesson Content */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl shadow-sm p-8">
                
                {/* Lesson Header */}
                <div className="mb-8">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-2 rounded-lg ${
                      currentLessonData.type === 'video' ? 'bg-red-100 text-red-600' :
                      currentLessonData.type === 'text' ? 'bg-blue-100 text-blue-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {currentLessonData.type === 'video' ? <Video className="w-5 h-5" /> :
                       currentLessonData.type === 'text' ? <FileText className="w-5 h-5" /> :
                       <BookOpen className="w-5 h-5" />}
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">{currentLessonData.title}</h1>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {currentLessonData.duration} min
                        </span>
                        {currentLessonProgress?.completed && (
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lesson Content Based on Type */}
                {currentLessonData.type === 'video' && (
                  <div className="mb-8">
                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                      {/* Video player would go here */}
                      <div className="flex items-center justify-center h-full text-white">
                        <div className="text-center">
                          <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg">Video Player</p>
                          <p className="text-sm opacity-75 mt-2">
                            Progress: {videoProgress}%
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Video Controls */}
                    <div className="mt-4 flex items-center space-x-4">
                      <button
                        onClick={handleVideoComplete}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Mark Video Complete
                      </button>
                      
                      <div className="flex-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={videoProgress}
                          onChange={(e) => handleVideoProgress(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          Drag to simulate video progress
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentLessonData.type === 'text' && (
                  <div className="mb-8">
                    <div className="prose max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: (currentLessonData.content as any)?.text || currentLessonData.content || '' }} />
                    </div>
                  </div>
                )}

                {/* Quiz Content */}
                {currentLessonData.content.questions && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Knowledge Check</h3>
                    <div className="space-y-6">
                      {currentLessonData.content.questions.map((question: any, qIndex: number) => (
                        <div key={qIndex} className="bg-gray-50 rounded-lg p-6">
                          <h4 className="font-medium mb-4">{question.question}</h4>
                          <div className="space-y-2">
                            {question.options.map((option: string, oIndex: number) => (
                              <label key={oIndex} className="flex items-center">
                                <input
                                  type="radio"
                                  name={`question-${qIndex}`}
                                  value={oIndex}
                                  checked={quizAnswers[qIndex] === oIndex}
                                  onChange={(e) => setQuizAnswers(prev => ({
                                    ...prev,
                                    [qIndex]: parseInt(e.target.value)
                                  }))}
                                  className="mr-3"
                                  disabled={quizSubmitted}
                                />
                                <span className={quizSubmitted ? (
                                  oIndex === question.correctAnswer ? 'text-green-600 font-medium' :
                                  quizAnswers[qIndex] === oIndex ? 'text-red-600' : ''
                                ) : ''}>
                                  {option}
                                </span>
                              </label>
                            ))}
                          </div>
                          
                          {quizSubmitted && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                              <p className="text-sm text-blue-800">
                                <strong>Explanation:</strong> {question.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {!quizSubmitted ? (
                      <button
                        onClick={handleQuizSubmit}
                        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        disabled={Object.keys(quizAnswers).length < currentLessonData.content.questions.length}
                      >
                        <Send className="w-4 h-4 inline mr-2" />
                        Submit Quiz
                      </button>
                    ) : (
                      <div className="mt-6 p-4 rounded-lg bg-gray-50">
                        <div className={`flex items-center ${quizScore?.passed ? 'text-green-600' : 'text-red-600'}`}>
                          {quizScore?.passed ? 
                            <CheckCircle className="w-5 h-5 mr-2" /> :
                            <AlertTriangle className="w-5 h-5 mr-2" />
                          }
                          <span className="font-medium">
                            Score: {quizScore?.score}/{quizScore?.maxScore} 
                            ({Math.round((quizScore?.score || 0) / (quizScore?.maxScore || 1) * 100)}%)
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          {quizScore?.passed ? 
                            'Congratulations! You passed the quiz.' :
                            'You need 70% or higher to pass. Please review the material and try again.'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reflection Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Reflection</h3>
                  <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="Share your thoughts about this lesson..."
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleReflectionSave}
                    disabled={!reflection.trim() || isSaving}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageSquare className="w-4 h-4 inline mr-2" />
                    Save Reflection
                  </button>
                </div>

                {/* Lesson Navigation */}
                <div className="flex items-center justify-between pt-8 border-t border-gray-200">
                  <button
                    onClick={goToPreviousLesson}
                    disabled={currentModuleIndex === 0 && currentLessonIndex === 0}
                    className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous Lesson
                  </button>
                  
                  <div className="flex items-center space-x-4">
                    {!currentLessonProgress?.completed && (
                      <button
                        onClick={handleMarkComplete}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Award className="w-4 h-4 inline mr-2" />
                        Mark Complete
                      </button>
                    )}
                    
                    <button
                      onClick={goToNextLesson}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Next Lesson
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-8">
                <h3 className="font-semibold mb-4">Course Progress</h3>
                
                {/* Progress Summary */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Lessons Completed</span>
                    <span>{completionStats.completed}/{completionStats.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${completionStats.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {completionStats.percentage}% complete
                  </p>
                </div>

                {/* Module Lessons */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    {currentModule.title}
                  </h4>
                  {currentModule.lessons.map((lesson, index) => {
                    const progress = lessonProgress[lesson.id];
                    const isActive = index === currentLessonIndex;
                    const isCompleted = progress?.completed;
                    
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => navigate(`/lms/module/${moduleId}/lesson/${lesson.id}`)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          isActive ? 'bg-blue-50 border-2 border-blue-200' :
                          isCompleted ? 'bg-green-50 border border-green-200' :
                          'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              isCompleted ? 'bg-green-600 text-white' :
                              isActive ? 'bg-blue-600 text-white' :
                              'bg-gray-300 text-gray-600'
                            }`}>
                              {isCompleted ? <CheckCircle className="w-3 h-3" /> : index + 1}
                            </div>
                            <div className="ml-3">
                              <p className={`text-sm font-medium ${
                                isActive ? 'text-blue-900' :
                                isCompleted ? 'text-green-900' :
                                'text-gray-700'
                              }`}>
                                {lesson.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {lesson.duration} min
                              </p>
                            </div>
                          </div>
                          
                          {progress && !isCompleted && (
                            <div className="w-8 h-8 relative">
                              <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 24 24">
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="8"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  fill="none"
                                  className="text-gray-300"
                                />
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="8"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  fill="none"
                                  strokeDasharray={`${progress.progress_percentage * 0.5} 50`}
                                  className="text-blue-600"
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                {progress.progress_percentage}%
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientErrorBoundary>
  );
};

export default EnhancedLMSModule;