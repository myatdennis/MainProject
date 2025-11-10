import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import VideoPlayer from '../../components/VideoPlayer';
import CompletionScreen from '../../components/CompletionScreen';
import { useParams, useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { useEnhancedCourseProgress } from '../../hooks/useEnhancedCourseProgress';
import ClientErrorBoundary from '../../components/ClientErrorBoundary';
import { CheckCircle, Clock, FileText, Video, ArrowLeft, ArrowRight, BookOpen, MessageSquare, Save, Award, AlertTriangle, Send, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
const EnhancedLMSModule = () => {
    const { moduleId, lessonId } = useParams();
    const navigate = useNavigate();
    const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
    const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
    const [reflection, setReflection] = useState('');
    const [quizAnswers, setQuizAnswers] = useState({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizScore, setQuizScore] = useState(null);
    // Removed unused videoProgress state
    // Get course from store
    const course = moduleId ? courseStore.getCourse(moduleId) : null;
    // Current module and lesson data
    const currentModule = course?.modules?.[currentModuleIndex];
    const currentLessonData = currentModule?.lessons[currentLessonIndex];
    // Enhanced course progress hook with real-time sync and auto-save
    const { lessonProgress, reflections, loading: progressLoading, error: progressError, updateLessonProgress, markLessonComplete, saveReflection: saveReflectionToProgress, setActiveLessonTracking, syncStatus, isOnline, isSaving, pendingChanges, calculateCourseProgress, getCompletionStats, forceSave } = useEnhancedCourseProgress(moduleId || '', {
        enableAutoSave: true,
        enableRealtime: true,
        autoSaveInterval: 30000
    });
    // Get current lesson progress
    const currentLessonProgress = currentLessonData ? lessonProgress[currentLessonData.id] : null;
    const currentReflection = currentLessonData ? reflections[currentLessonData.id] : null;
    // Sync URL parameters with state
    useEffect(() => {
        if (!course)
            return;
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
            }
            else {
                setReflection('');
            }
        }
    }, [currentLessonData?.id, currentReflection?.content, setActiveLessonTracking]);
    // Navigation helpers
    const goToNextLesson = () => {
        if (!course)
            return;
        const nextLessonIndex = currentLessonIndex + 1;
        if (nextLessonIndex < currentModule.lessons.length) {
            const nextLesson = currentModule.lessons[nextLessonIndex];
            navigate(`/lms/module/${moduleId}/lesson/${nextLesson.id}`);
        }
        else {
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
        if (!course)
            return;
        const prevLessonIndex = currentLessonIndex - 1;
        if (prevLessonIndex >= 0) {
            const prevLesson = currentModule.lessons[prevLessonIndex];
            navigate(`/lms/module/${moduleId}/lesson/${prevLesson.id}`);
        }
        else {
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
    const updateCurrentLessonProgress = async (updates) => {
        if (!currentLessonData || !currentModule)
            return;
        try {
            await updateLessonProgress(currentLessonData.id, currentModule.id, updates);
        }
        catch (error) {
            console.error('Error updating lesson progress:', error);
            toast.error('Failed to save progress');
        }
    };
    const handleMarkComplete = async () => {
        if (!currentLessonData || !currentModule)
            return;
        try {
            await markLessonComplete(currentLessonData.id, currentModule.id, quizScore?.score);
            toast.success('Lesson completed!');
            // Auto-navigate to next lesson after completion
            setTimeout(goToNextLesson, 2000);
        }
        catch (error) {
            console.error('Error marking lesson complete:', error);
            toast.error('Failed to mark lesson complete');
        }
    };
    const handleReflectionSave = async () => {
        if (!reflection.trim() || !currentLessonData)
            return;
        try {
            await saveReflectionToProgress(currentLessonData.id, reflection);
            toast.success('Reflection saved');
        }
        catch (error) {
            console.error('Error saving reflection:', error);
            toast.error('Failed to save reflection');
        }
    };
    const handleQuizSubmit = async () => {
        if (!currentLessonData?.content.questions)
            return;
        const questions = currentLessonData.content.questions;
        let score = 0;
        const maxScore = questions.length;
        // Calculate score
        questions.forEach((question, index) => {
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
        }
        else {
            toast.error(`Quiz failed. Score: ${score}/${maxScore}. Need 70% to pass.`);
        }
    };
    // Video progress tracking
    const handleVideoProgress = (progress) => {
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
            }
            else {
                toast.error('Some data could not be saved');
            }
        }
        catch (error) {
            toast.error('Failed to save progress');
        }
    };
    // Loading and error states
    if (progressLoading) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsxs("div", { className: "text-center", children: [_jsx(RefreshCw, { className: "w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" }), _jsx("p", { className: "text-gray-600", children: "Loading your learning session..." })] }) }));
    }
    if (progressError) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsxs("div", { className: "text-center", children: [_jsx(AlertTriangle, { className: "w-8 h-8 mx-auto mb-4 text-red-600" }), _jsx("p", { className: "text-red-600 mb-4", children: progressError }), _jsx("button", { onClick: () => window.location.reload(), className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", children: "Retry" })] }) }));
    }
    if (!course || !currentModule || !currentLessonData) {
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsxs("div", { className: "text-center", children: [_jsx(FileText, { className: "w-8 h-8 mx-auto mb-4 text-gray-400" }), _jsx("p", { className: "text-gray-600", children: "Lesson not found" })] }) }));
    }
    const completionStats = getCompletionStats();
    const courseProgress = calculateCourseProgress();
    // Determine if course is fully completed
    const allLessonsCompleted = completionStats.total > 0 && completionStats.completed === completionStats.total;
    return (_jsx(ClientErrorBoundary, { children: _jsx("div", { className: "min-h-screen bg-gray-50", children: allLessonsCompleted ? (_jsx("div", { className: "flex items-center justify-center min-h-[60vh]", children: _jsx(CompletionScreen, { courseTitle: course?.title || 'Course', certificateUrl: course?.certification?.available ? '/lms/certificates' : undefined, onDownloadCertificate: () => {
                        // Navigate to certificates page or trigger download
                        window.location.href = '/lms/certificates';
                    }, onShare: () => {
                        if (navigator.share) {
                            navigator.share({
                                title: `I just completed ${course?.title}!`,
                                text: `I earned a certificate in ${course?.title}. Check it out!`,
                                url: window.location.origin + '/lms/certificates'
                            });
                        }
                        else {
                            navigator.clipboard.writeText(window.location.origin + '/lms/certificates');
                            toast.success('Certificate link copied to clipboard!');
                        }
                    }, onNextCourse: () => {
                        // Navigate to courses page for now
                        window.location.href = '/lms/courses';
                    } }) })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "bg-white shadow-sm border-b", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 py-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("button", { onClick: () => navigate('/lms/courses'), className: "flex items-center text-gray-600 hover:text-gray-800", children: [_jsx(ArrowLeft, { className: "w-5 h-5 mr-1" }), "Back to Courses"] }), _jsxs("div", { className: "text-sm text-gray-500", children: [currentModule.title, " \u2022 Lesson ", currentLessonIndex + 1, " of ", currentModule.lessons.length] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: `flex items-center space-x-1 ${isOnline ? 'text-green-600' : 'text-red-600'}`, children: [isOnline ? _jsx(Wifi, { className: "w-4 h-4" }) : _jsx(WifiOff, { className: "w-4 h-4" }), _jsx("span", { className: "text-xs", children: isOnline ? 'Online' : 'Offline' })] }), _jsxs("div", { className: `flex items-center space-x-1 text-xs ${syncStatus === 'synced' ? 'text-green-600' :
                                                        syncStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'}`, children: [isSaving && _jsx(RefreshCw, { className: "w-3 h-3 animate-spin" }), _jsx("span", { children: syncStatus === 'synced' ? 'Synced' :
                                                                syncStatus === 'pending' ? 'Saving...' : 'Sync Error' }), pendingChanges > 0 && (_jsxs("span", { className: "bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs", children: [pendingChanges, " pending"] }))] }), _jsxs("button", { onClick: handleForceSave, className: "px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700", disabled: isSaving, children: [_jsx(Save, { className: "w-3 h-3 inline mr-1" }), "Save Now"] })] })] }), _jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "flex items-center justify-between text-sm mb-2", children: [_jsx("span", { children: "Course Progress" }), _jsxs("span", { children: [courseProgress, "% Complete"] })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-blue-600 h-2 rounded-full transition-all duration-300", style: { width: `${courseProgress}%` } }) })] })] }) }), _jsx("div", { className: "max-w-7xl mx-auto px-4 py-8", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-4 gap-8", children: [_jsx("div", { className: "lg:col-span-3", children: _jsxs("div", { className: "bg-white rounded-xl shadow-sm p-8", children: [_jsx("div", { className: "mb-8", children: _jsxs("div", { className: "flex items-center space-x-3 mb-4", children: [_jsx("div", { className: `p-2 rounded-lg ${currentLessonData.type === 'video' ? 'bg-red-100 text-red-600' :
                                                                currentLessonData.type === 'text' ? 'bg-blue-100 text-blue-600' :
                                                                    'bg-green-100 text-green-600'}`, children: currentLessonData.type === 'video' ? _jsx(Video, { className: "w-5 h-5" }) :
                                                                currentLessonData.type === 'text' ? _jsx(FileText, { className: "w-5 h-5" }) :
                                                                    _jsx(BookOpen, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: currentLessonData.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-500 mt-1", children: [_jsxs("span", { className: "flex items-center", children: [_jsx(Clock, { className: "w-4 h-4 mr-1" }), currentLessonData.duration, " min"] }), currentLessonProgress?.completed && (_jsxs("span", { className: "flex items-center text-green-600", children: [_jsx(CheckCircle, { className: "w-4 h-4 mr-1" }), "Completed"] }))] })] })] }) }), currentLessonData.type === 'video' && (_jsx("div", { className: "mb-8", children: _jsx(VideoPlayer, { videoContent: {
                                                        id: currentLessonData.id,
                                                        type: 'url',
                                                        title: currentLessonData.title,
                                                        description: currentLessonData.description,
                                                        url: currentLessonData.content?.videoUrl,
                                                        thumbnail: currentLessonData.content?.videoThumbnail,
                                                        duration: typeof currentLessonData.content?.videoDuration === 'number' ? currentLessonData.content.videoDuration : undefined,
                                                        settings: {
                                                            requireWatchPercentage: 90,
                                                            resumeFromLastPosition: true,
                                                            markAsWatched: true
                                                        }
                                                    }, onProgress: handleVideoProgress, onComplete: handleVideoComplete }) })), currentLessonData.type === 'text' && (_jsx("div", { className: "mb-8", children: _jsx("div", { className: "prose max-w-none", children: _jsx("div", { dangerouslySetInnerHTML: { __html: currentLessonData.content?.text || currentLessonData.content || '' } }) }) })), currentLessonData.content.questions && (_jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Knowledge Check" }), _jsx("div", { className: "space-y-6", children: currentLessonData.content.questions.map((question, qIndex) => (_jsxs("div", { className: "bg-gray-50 rounded-lg p-6", children: [_jsx("h4", { className: "font-medium mb-4", children: question.question }), _jsx("div", { className: "space-y-2", children: question.options.map((option, oIndex) => (_jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "radio", name: `question-${qIndex}`, value: oIndex, checked: quizAnswers[qIndex] === oIndex, onChange: (e) => setQuizAnswers(prev => ({
                                                                                    ...prev,
                                                                                    [qIndex]: parseInt(e.target.value)
                                                                                })), className: "mr-3", disabled: quizSubmitted }), _jsx("span", { className: quizSubmitted ? (oIndex === question.correctAnswer ? 'text-green-600 font-medium' :
                                                                                    quizAnswers[qIndex] === oIndex ? 'text-red-600' : '') : '', children: option })] }, oIndex))) }), quizSubmitted && (_jsx("div", { className: "mt-4 p-4 bg-blue-50 rounded-lg", children: _jsxs("p", { className: "text-sm text-blue-800", children: [_jsx("strong", { children: "Explanation:" }), " ", question.explanation] }) }))] }, qIndex))) }), !quizSubmitted ? (_jsxs("button", { onClick: handleQuizSubmit, className: "mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700", disabled: Object.keys(quizAnswers).length < currentLessonData.content.questions.length, children: [_jsx(Send, { className: "w-4 h-4 inline mr-2" }), "Submit Quiz"] })) : (_jsxs("div", { className: "mt-6 p-4 rounded-lg bg-gray-50", children: [_jsxs("div", { className: `flex items-center ${quizScore?.passed ? 'text-green-600' : 'text-red-600'}`, children: [quizScore?.passed ?
                                                                        _jsx(CheckCircle, { className: "w-5 h-5 mr-2" }) :
                                                                        _jsx(AlertTriangle, { className: "w-5 h-5 mr-2" }), _jsxs("span", { className: "font-medium", children: ["Score: ", quizScore?.score, "/", quizScore?.maxScore, "(", Math.round((quizScore?.score || 0) / (quizScore?.maxScore || 1) * 100), "%)"] })] }), _jsx("p", { className: "text-sm text-gray-600 mt-2", children: quizScore?.passed ?
                                                                    'Congratulations! You passed the quiz.' :
                                                                    'You need 70% or higher to pass. Please review the material and try again.' })] }))] })), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "Reflection" }), _jsx("textarea", { value: reflection, onChange: (e) => setReflection(e.target.value), placeholder: "Share your thoughts about this lesson...", className: "w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" }), _jsxs("button", { onClick: handleReflectionSave, disabled: !reflection.trim() || isSaving, className: "mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed", children: [_jsx(MessageSquare, { className: "w-4 h-4 inline mr-2" }), "Save Reflection"] })] }), _jsxs("div", { className: "flex items-center justify-between pt-8 border-t border-gray-200", children: [_jsxs("button", { onClick: goToPreviousLesson, disabled: currentModuleIndex === 0 && currentLessonIndex === 0, className: "flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed", children: [_jsx(ArrowLeft, { className: "w-4 h-4 mr-2" }), "Previous Lesson"] }), _jsxs("div", { className: "flex items-center space-x-4", children: [!currentLessonProgress?.completed && (_jsxs("button", { onClick: handleMarkComplete, className: "px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700", children: [_jsx(Award, { className: "w-4 h-4 inline mr-2" }), "Mark Complete"] })), _jsxs("button", { onClick: goToNextLesson, className: "flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", children: ["Next Lesson", _jsx(ArrowRight, { className: "w-4 h-4 ml-2" })] })] })] })] }) }), _jsx("div", { className: "lg:col-span-1", children: _jsxs("div", { className: "bg-white rounded-xl shadow-sm p-6 sticky top-8", children: [_jsx("h3", { className: "font-semibold mb-4", children: "Course Progress" }), _jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex items-center justify-between text-sm mb-2", children: [_jsx("span", { children: "Lessons Completed" }), _jsxs("span", { children: [completionStats.completed, "/", completionStats.total] })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-green-600 h-2 rounded-full", style: { width: `${completionStats.percentage}%` } }) }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: [completionStats.percentage, "% complete"] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-3", children: currentModule.title }), currentModule.lessons.map((lesson, index) => {
                                                        const progress = lessonProgress[lesson.id];
                                                        const isActive = index === currentLessonIndex;
                                                        const isCompleted = progress?.completed;
                                                        return (_jsx("button", { onClick: () => navigate(`/lms/module/${moduleId}/lesson/${lesson.id}`), className: `w-full text-left p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 border-2 border-blue-200' :
                                                                isCompleted ? 'bg-green-50 border border-green-200' :
                                                                    'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: `w-6 h-6 rounded-full flex items-center justify-center text-xs ${isCompleted ? 'bg-green-600 text-white' :
                                                                                    isActive ? 'bg-blue-600 text-white' :
                                                                                        'bg-gray-300 text-gray-600'}`, children: isCompleted ? _jsx(CheckCircle, { className: "w-3 h-3" }) : index + 1 }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: `text-sm font-medium ${isActive ? 'text-blue-900' :
                                                                                            isCompleted ? 'text-green-900' :
                                                                                                'text-gray-700'}`, children: lesson.title }), _jsxs("p", { className: "text-xs text-gray-500", children: [lesson.duration, " min"] })] })] }), progress && !isCompleted && (_jsxs("div", { className: "w-8 h-8 relative", children: [_jsxs("svg", { className: "w-8 h-8 transform -rotate-90", viewBox: "0 0 24 24", children: [_jsx("circle", { cx: "12", cy: "12", r: "8", stroke: "currentColor", strokeWidth: "2", fill: "none", className: "text-gray-300" }), _jsx("circle", { cx: "12", cy: "12", r: "8", stroke: "currentColor", strokeWidth: "2", fill: "none", strokeDasharray: `${progress.progress_percentage * 0.5} 50`, className: "text-blue-600" })] }), _jsxs("span", { className: "absolute inset-0 flex items-center justify-center text-xs font-medium", children: [progress.progress_percentage, "%"] })] }))] }) }, lesson.id));
                                                    })] })] }) })] }) })] })) }) }));
};
export default EnhancedLMSModule;
