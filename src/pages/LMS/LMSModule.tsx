import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { useCourseProgress } from '../../hooks/useCourseProgress';
import { 
  Play, 
  Pause, 
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
  Send
} from 'lucide-react';
import { getVideoEmbedUrl } from '../../utils/videoUtils';

const LMSModule = () => {
  const { moduleId, lessonId } = useParams();
  const navigate = useNavigate();
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [reflection, setReflection] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<{ [questionId: string]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number; maxScore: number; passed: boolean } | null>(null);
  const [interactiveAnswers, setInteractiveAnswers] = useState<{ [optionIndex: number]: boolean }>({});
  const [showInteractiveFeedback, setShowInteractiveFeedback] = useState(false);

  // Get course from store
  const course = moduleId ? courseStore.getCourse(moduleId) : null;
  
  // Define current module and lesson data
  const currentModule = course?.modules[currentModuleIndex];
  const currentLessonData = currentModule?.lessons[currentLessonIndex];
  
  // Use course progress hook for backend integration
  const {
    enrollmentData,
    lessonProgress,
    reflections,
    loading: progressLoading,
    error: progressError,
    enrollInCourse,
    updateLessonProgress,
    saveReflection,
    submitQuizAttempt
  } = useCourseProgress(moduleId || '');

  useEffect(() => {
    if (course && !enrollmentData && !progressLoading && !progressError) {
      // Auto-enroll user in course if not already enrolled
      enrollInCourse().catch(console.error);
    }
  }, [course, enrollmentData, progressLoading, progressError]);

  useEffect(() => {
    // Load reflection for current lesson
    if (currentLessonData?.id && reflections[currentLessonData.id]) {
      setReflection(reflections[currentLessonData.id].content);
    } else {
      setReflection('');
    }
  }, [currentModuleIndex, currentLessonIndex, reflections, currentLessonData]);

  // Sync URL lessonId -> current module/lesson indices
  useEffect(() => {
    if (!course) return;
    if (!lessonId) return;
    // find module and lesson indices by lesson id
    for (let mi = 0; mi < course.modules.length; mi++) {
      const m = course.modules[mi];
      const li = m.lessons.findIndex(l => l.id === lessonId);
      if (li !== -1) {
        setCurrentModuleIndex(mi);
        setCurrentLessonIndex(li);
        return;
      }
    }
  }, [lessonId, course]);

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

  const handleNextLesson = async () => {
    // Mark current lesson as completed if not already
    if (!isLessonCompleted) {
      await markLessonComplete();
    }

    if (currentLessonIndex < currentModule.lessons.length - 1) {
      const nextLessonIndex = currentLessonIndex + 1;
      setCurrentLessonIndex(nextLessonIndex);
      navigate(`/lms/module/${moduleId}/lesson/${currentModule.lessons[nextLessonIndex].id}`);
    } else if (currentModuleIndex < course.modules.length - 1) {
      const nextModuleIndex = currentModuleIndex + 1;
      setCurrentModuleIndex(nextModuleIndex);
      setCurrentLessonIndex(0);
      navigate(`/lms/module/${moduleId}/lesson/${course.modules[nextModuleIndex].lessons[0].id}`);
    }
    
    // Reset quiz state for new lesson
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setInteractiveAnswers({});
    setShowInteractiveFeedback(false);
  };

  const handlePrevLesson = () => {
    if (currentLessonIndex > 0) {
      const prevLessonIndex = currentLessonIndex - 1;
      setCurrentLessonIndex(prevLessonIndex);
      navigate(`/lms/module/${moduleId}/lesson/${currentModule.lessons[prevLessonIndex].id}`);
    } else if (currentModuleIndex > 0) {
      const prevModuleIndex = currentModuleIndex - 1;
      const prevModule = course.modules[prevModuleIndex];
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
  };

  const markLessonComplete = async () => {
    try {
      await updateLessonProgress(currentLessonData.id, {
        completed: true,
        progressPercentage: 100,
        timeSpent: (currentLessonProgress?.time_spent || 0) + 60 // Add 1 minute
      });
    } catch (error) {
      console.error('Error marking lesson complete:', error);
    }
  };

  const handleSaveReflection = async () => {
    if (!reflection.trim()) return;
    
    try {
      await saveReflection(currentLessonData.id, reflection);
      // Show success feedback
    } catch (error) {
      console.error('Error saving reflection:', error);
    }
  };

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
      await submitQuizAttempt(currentLessonData.id, quizAnswers, score, maxScore);
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
      updateLessonProgress(currentLessonData.id, {
        completed: true,
        progressPercentage: 100
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
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const renderCurrentLessonContent = () => {
    switch (currentLessonData.type) {
      case 'video':
        return (
          <div className="space-y-4">
            {(() => {
              const embedUrl = getVideoEmbedUrl(currentLessonData.content || {});
              const isExternalVideo = currentLessonData.content.videoSourceType && 
                                    ['youtube', 'vimeo', 'external'].includes(currentLessonData.content.videoSourceType);
              
              if (embedUrl && isExternalVideo) {
                return (
                  <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={currentLessonData.title}
                      onLoad={() => {
                        // Mark as started when iframe loads
                        updateLessonProgress(currentLessonData.id, {
                          progressPercentage: Math.max(currentLessonProgress?.progress_percentage || 0, 10),
                          timeSpent: (currentLessonProgress?.time_spent || 0) + 1
                        });
                      }}
                    />
                  </div>
                );
              } else if (currentLessonData.content.videoUrl && currentLessonData.content.videoUrl.trim()) {
                return (
                  <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                    <video 
                      controls 
                      className="w-full h-full"
                      src={currentLessonData.content.videoUrl}
                      poster={course.thumbnail}
                      crossOrigin="anonymous"
                      onTimeUpdate={(e) => {
                        const video = e.target as HTMLVideoElement;
                        if (video.duration && !isNaN(video.duration)) {
                          const progress = Math.round((video.currentTime / video.duration) * 100);
                          if (progress > (currentLessonProgress?.progress_percentage || 0)) {
                            updateLessonProgress(currentLessonData.id, {
                              progressPercentage: progress,
                              timeSpent: Math.round(video.currentTime)
                            });
                          }
                        }
                      }}
                      onEnded={() => {
                        updateLessonProgress(currentLessonData.id, {
                          completed: true,
                          progressPercentage: 100
                        });
                      }}
                      onError={() => {
                        console.warn('Video playback error - this may be due to network issues or unsupported format');
                      }}
                      onLoadedMetadata={() => {
                        // Mark as started when video metadata loads
                        updateLessonProgress(currentLessonData.id, {
                          progressPercentage: Math.max(currentLessonProgress?.progress_percentage || 0, 5),
                          timeSpent: (currentLessonProgress?.time_spent || 0) + 1
                        });
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                );
              } else {
                return (
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Video className="h-12 w-12 mx-auto mb-2" />
                      <p>Video content is being prepared</p>
                      <p className="text-sm mt-1">Please check back later or contact your instructor</p>
                    </div>
                  </div>
                );
              }
            })()}
            
            {currentLessonData.content.transcript && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Transcript</h4>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{currentLessonData.content.transcript}</p>
              </div>
            )}
            
            {currentLessonData.content.notes && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Key Notes</h4>
                <p className="text-blue-800 text-sm">{currentLessonData.content.notes}</p>
              </div>
            )}
          </div>
        );

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

      case 'download':
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
                      updateLessonProgress(currentLessonData.id, {
                        completed: true,
                        progressPercentage: 100
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

  const calculateOverallProgress = () => {
    const totalLessons = course.modules.reduce((acc, module) => acc + module.lessons.length, 0);
    const completedLessons = Object.values(lessonProgress).filter(progress => progress.completed).length;
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  };

  const overallProgress = calculateOverallProgress();

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
        <div className="mt-2">
          <span className="text-sm text-gray-500">
            Module {currentModuleIndex + 1} of {course.modules.length}: {currentModule.title}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
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
                      onClick={markLessonComplete}
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

          {/* Reflection Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Reflection & Notes</h3>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="What are your key takeaways from this lesson? How will you apply these concepts in your leadership role?"
              className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-600">
                {reflections[currentLessonData.id] ? 'Last saved: ' + new Date(reflections[currentLessonData.id].updated_at).toLocaleString() : 'Notes are automatically saved'}
              </p>
              <button 
                onClick={handleSaveReflection}
                disabled={!reflection.trim()}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Notes</span>
              </button>
            </div>
          </div>

          {/* Key Takeaways */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Key Takeaways</h3>
            <ul className="space-y-3">
              {course.keyTakeaways.map((takeaway, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Course Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Course Progress</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Overall Progress</span>
                <span>{overallProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                ></div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">
                {Object.values(lessonProgress).filter(p => p.completed).length}
              </span> of{' '}
              <span className="font-medium">
                {course.modules.reduce((acc, m) => acc + m.lessons.length, 0)}
              </span> lessons completed
            </div>
            
            {overallProgress === 100 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <Award className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-green-800">Course Completed!</p>
                <p className="text-sm text-green-700">Congratulations on finishing this course.</p>
              </div>
            )}
          </div>

          {/* Module and Lesson List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Course Content</h3>
            <div className="space-y-4">
              {course.modules.map((module, moduleIndex) => (
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
              {currentModule.resources.map((resource, index) => (
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
              {currentModule.resources.length === 0 && (
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
                <button key={star} className="text-yellow-400 hover:text-yellow-500">
                  <Star className="h-6 w-6 fill-current" />
                </button>
              ))}
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