import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize, Settings, ChevronDown, ChevronUp, CheckCircle, Circle, Clock, ArrowLeft, ArrowRight, Bookmark, MessageCircle, FileText, AlertCircle, RefreshCw, BookOpen, Download } from 'lucide-react';
import { loadCourse } from '../../dal/courseData';
import { loadStoredCourseProgress, saveStoredCourseProgress, syncCourseProgressWithRemote, buildLearnerProgressSnapshot } from '../../utils/courseProgress';
import cn from '../../utils/cn';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import LoadingSpinner from '../ui/LoadingSpinner';
import CourseCompletion from '../CourseCompletion';
import { useSyncService } from '../../dal/sync';
import { useToast } from '../../context/ToastContext';
import { updateAssignmentProgress, } from '../../utils/assignmentStorage';
import { trackCourseCompletion as dalTrackCourseCompletion, trackEvent as dalTrackEvent } from '../../dal/analytics';
import { useUserProfile } from '../../hooks/useUserProfile';
import { batchService } from '../../services/batchService';
const CoursePlayer = ({ namespace = 'admin' }) => {
    const { courseId, lessonId } = useParams();
    const navigate = useNavigate();
    const syncService = useSyncService();
    const { showToast } = useToast();
    const isClientNamespace = namespace === 'client';
    const coursePathBase = isClientNamespace ? '/client/courses' : '/lms/course';
    const lessonPathSegment = isClientNamespace ? 'lessons' : 'lesson';
    const coursesIndexPath = isClientNamespace ? '/client/courses' : '/lms/courses';
    const eventSource = isClientNamespace ? 'client' : 'admin';
    const { user } = useUserProfile();
    const learnerId = useMemo(() => {
        if (user)
            return (user.email || user.id).toLowerCase();
        try {
            const raw = localStorage.getItem('huddle_user');
            if (raw) {
                const parsed = JSON.parse(raw);
                return (parsed.email || parsed.id || 'local-user').toLowerCase();
            }
        }
        catch (error) {
            console.warn('[CoursePlayer] Failed legacy identity fallback:', error);
        }
        return 'local-user';
    }, [user]);
    const [courseData, setCourseData] = useState(null);
    const [currentLesson, setCurrentLesson] = useState(null);
    const [completedLessons, setCompletedLessons] = useState(new Set());
    const [lessonProgressMap, setLessonProgressMap] = useState({});
    const [lessonPositions, setLessonPositions] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [showCompletionScreen, setShowCompletionScreen] = useState(false);
    const [completionTimestamp, setCompletionTimestamp] = useState(null);
    const [hasLoggedCourseCompletion, setHasLoggedCourseCompletion] = useState(false);
    const handleRetry = () => setReloadToken((token) => token + 1);
    const storedProgressRef = useRef(null);
    const lessonIdRef = useRef(lessonId);
    const hasTrackedInitialEventRef = useRef(false);
    const lastLoggedErrorRef = useRef(null);
    const lastAutoSavePositionRef = useRef(0);
    // Video player state
    const videoRef = useRef(null);
    const headingRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showControls, _setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    // UI state
    const [showTranscript, setShowTranscript] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [quizAnswers, setQuizAnswers] = useState({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizScore, setQuizScore] = useState(null);
    // Note-taking state
    const [noteText, setNoteText] = useState('');
    const [userNotes, setUserNotes] = useState([]);
    const [userBookmarks, setUserBookmarks] = useState([]);
    const progress = useMemo(() => {
        if (!courseData)
            return null;
        return buildLearnerProgressSnapshot(courseData.course, completedLessons, lessonProgressMap, lessonPositions);
    }, [courseData, completedLessons, lessonProgressMap, lessonPositions]);
    const courseLessons = courseData?.lessons ?? [];
    const course = courseData?.course ?? null;
    const currentLessonIndex = currentLesson
        ? courseLessons.findIndex((lesson) => lesson.id === currentLesson.id)
        : -1;
    const canGoPrevious = currentLessonIndex > 0;
    const canGoNext = currentLessonIndex !== -1 && currentLessonIndex < courseLessons.length - 1;
    const calculateOverallPercent = useCallback((progressMap, completedSet) => {
        if (courseLessons.length === 0) {
            return 0;
        }
        const total = courseLessons.reduce((accumulator, lesson) => {
            if (completedSet.has(lesson.id)) {
                return accumulator + 100;
            }
            const lessonProgress = Math.min(progressMap[lesson.id] ?? 0, 100);
            return accumulator + lessonProgress;
        }, 0);
        return Math.round(total / courseLessons.length);
    }, [courseLessons]);
    useEffect(() => {
        if (!course || courseLessons.length === 0)
            return;
        const allLessonsCompleted = completedLessons.size === courseLessons.length;
        if (allLessonsCompleted) {
            if (!hasLoggedCourseCompletion) {
                const totalTimeSeconds = Object.values(lessonPositions).reduce((sum, value) => sum + Math.max(0, Math.round(value ?? 0)), 0);
                const modulesCompletedCount = Array.isArray(course?.modules)
                    ? course.modules.filter((module) => Array.isArray(module?.lessons) &&
                        module.lessons.length > 0 &&
                        module.lessons.every((moduleLesson) => completedLessons.has(moduleLesson.id))).length
                    : 0;
                syncService.logEvent({
                    type: 'course_completed',
                    courseId: course.id,
                    source: eventSource,
                    userId: learnerId,
                    data: {
                        courseId: course.id,
                        completedAt: Date.now(),
                        overallProgress: 1,
                    },
                    timestamp: Date.now(),
                });
                dalTrackCourseCompletion(learnerId, course.id, {
                    totalTimeSpent: Math.max(0, Math.round(totalTimeSeconds / 60)),
                    modulesCompleted: modulesCompletedCount,
                    lessonsCompleted: courseLessons.length,
                    quizzesPassed: 0,
                    certificateGenerated: Boolean(storedProgressRef.current?.lastLessonId),
                });
                setHasLoggedCourseCompletion(true);
            }
            if (completionTimestamp === null) {
                setCompletionTimestamp(Date.now());
                setShowCompletionScreen(true);
            }
        }
        else {
            if (hasLoggedCourseCompletion) {
                setHasLoggedCourseCompletion(false);
            }
            if (completionTimestamp !== null) {
                setCompletionTimestamp(null);
            }
            if (showCompletionScreen) {
                setShowCompletionScreen(false);
            }
        }
    }, [
        completedLessons,
        course,
        courseLessons.length,
        eventSource,
        hasLoggedCourseCompletion,
        learnerId,
        syncService,
        completionTimestamp,
        showCompletionScreen,
    ]);
    const persistProgress = useCallback((lastLesson) => {
        if (!courseData)
            return;
        const payload = {
            completedLessonIds: Array.from(completedLessons),
            lessonProgress: lessonProgressMap,
            lessonPositions,
            lastLessonId: lastLesson ?? storedProgressRef.current?.lastLessonId
        };
        storedProgressRef.current = payload;
        saveStoredCourseProgress(courseData.course.slug, payload, {
            courseId: courseData.course.id,
            userId: learnerId,
            lessonIds: courseLessons.map((lesson) => lesson.id),
        });
    }, [courseData, completedLessons, lessonProgressMap, lessonPositions, courseLessons, learnerId]);
    useEffect(() => {
        if (!courseData || !currentLesson) {
            return;
        }
        persistProgress(currentLesson.id);
    }, [courseData, currentLesson, persistProgress]);
    useEffect(() => {
        if (!courseData)
            return;
        persistProgress(currentLesson?.id);
    }, [completedLessons, lessonProgressMap, lessonPositions, courseData, currentLesson, persistProgress]);
    useEffect(() => {
        if (!error || !course?.id) {
            if (!error) {
                lastLoggedErrorRef.current = null;
            }
            return;
        }
        if (lastLoggedErrorRef.current === error) {
            return;
        }
        dalTrackEvent('error_occurred', learnerId, {
            courseId: course.id,
            message: error,
            source: eventSource,
        }, course.id);
        lastLoggedErrorRef.current = error;
    }, [error, course?.id, learnerId, eventSource]);
    useEffect(() => {
        lessonIdRef.current = lessonId;
    }, [lessonId]);
    useEffect(() => {
        if (!currentLesson)
            return;
        const savedPosition = lessonPositions[currentLesson.id] ?? 0;
        setCurrentTime(savedPosition);
    }, [currentLesson?.id]);
    useEffect(() => {
        if (!courseData)
            return;
        if (!lessonId)
            return;
        const lesson = courseLessons.find((item) => item.id === lessonId);
        if (lesson) {
            setCurrentLesson(lesson);
        }
    }, [lessonId, courseData, courseLessons]);
    useEffect(() => {
        if (isLoading)
            return;
        if (headingRef.current) {
            headingRef.current.focus();
        }
    }, [isLoading, currentLesson?.id, showCompletionScreen, error]);
    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            if (!courseId) {
                setError('Missing course identifier');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const result = await loadCourse(courseId, { includeDrafts: false, preferRemote: true });
                if (!isMounted)
                    return;
                if (!result) {
                    setCourseData(null);
                    setCurrentLesson(null);
                    setError('Course not found.');
                    setIsLoading(false);
                    return;
                }
                setCourseData({ course: result.course, lessons: result.lessons });
                if (learnerId) {
                    await syncCourseProgressWithRemote({
                        courseSlug: result.course.slug,
                        courseId: result.course.id,
                        userId: learnerId,
                        lessonIds: result.lessons.map((lesson) => lesson.id),
                    });
                }
                const stored = loadStoredCourseProgress(result.course.slug);
                storedProgressRef.current = stored;
                setCompletedLessons(new Set(stored.completedLessonIds));
                setLessonProgressMap(stored.lessonProgress || {});
                setLessonPositions(stored.lessonPositions || {});
                const desiredLessonId = lessonIdRef.current || stored.lastLessonId;
                const startingLesson = (desiredLessonId && result.lessons.find((lesson) => lesson.id === desiredLessonId)) ||
                    result.lessons[0] ||
                    null;
                if (startingLesson) {
                    setCurrentLesson(startingLesson);
                    if (!lessonId || lessonId !== startingLesson.id) {
                        navigate(`${coursePathBase}/${result.course.slug}/${lessonPathSegment}/${startingLesson.id}`, { replace: true });
                    }
                }
                else {
                    setCurrentLesson(null);
                }
            }
            catch (err) {
                if (!isMounted)
                    return;
                console.error('Failed to load course data:', err);
                setCourseData(null);
                setCurrentLesson(null);
                setError(err instanceof Error ? err.message : 'Failed to load course data');
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        loadData();
        return () => {
            isMounted = false;
        };
    }, [courseId, navigate, reloadToken, learnerId]);
    useEffect(() => {
        if (!courseData?.course || !learnerId || hasTrackedInitialEventRef.current) {
            return;
        }
        const stored = storedProgressRef.current;
        if (!stored) {
            return;
        }
        const hasAnyProgress = stored.completedLessonIds.length > 0 ||
            Object.values(stored.lessonProgress ?? {}).some((value) => (value ?? 0) > 0);
        const eventType = hasAnyProgress ? 'course_resumed' : 'course_started';
        dalTrackEvent(eventType, learnerId, {
            courseSlug: courseData.course.slug,
            source: eventSource,
        }, courseData.course.id);
        hasTrackedInitialEventRef.current = true;
    }, [courseData, learnerId, eventSource]);
    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            }
            else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };
    const logProgress = useCallback((lessonId, progressValue, position) => {
        syncService.logEvent({
            type: 'user_progress',
            source: eventSource,
            courseId: course?.id,
            userId: learnerId,
            data: {
                courseId: course?.id,
                lessonId,
                progress: progressValue,
                position,
            },
            timestamp: Date.now(),
        });
        if (course?.id) {
            const boundedProgress = Math.min(progressValue, 100);
            const nextProgressMap = {
                ...lessonProgressMap,
                [lessonId]: boundedProgress,
            };
            const nextCompleted = new Set(completedLessons);
            if (boundedProgress >= 100) {
                nextCompleted.add(lessonId);
            }
            // Enqueue batched progress event (lesson_progress or lesson_completed)
            try {
                batchService.enqueueProgress({
                    type: boundedProgress >= 100 ? 'lesson_completed' : 'lesson_progress',
                    courseId: course.id,
                    lessonId,
                    userId: learnerId,
                    percent: boundedProgress,
                    position,
                });
            }
            catch (e) {
                // Non-fatal; batching service will handle retries separately
                console.warn('[CoursePlayer] Failed to enqueue progress batch event', e);
            }
            const overallPercent = calculateOverallPercent(nextProgressMap, nextCompleted);
            void updateAssignmentProgress(course.id, learnerId, overallPercent);
        }
    }, [
        course?.id,
        learnerId,
        syncService,
        eventSource,
        lessonProgressMap,
        completedLessons,
        calculateOverallPercent,
    ]);
    const completeLesson = useCallback((lesson, position, totalDuration, silent = false) => {
        const nextCompleted = new Set(completedLessons);
        nextCompleted.add(lesson.id);
        const nextProgressMap = {
            ...lessonProgressMap,
            [lesson.id]: 100,
        };
        setCompletedLessons(nextCompleted);
        if ((lessonProgressMap[lesson.id] ?? 0) < 100) {
            setLessonProgressMap(nextProgressMap);
        }
        if (position !== undefined) {
            setLessonPositions((prev) => ({
                ...prev,
                [lesson.id]: totalDuration ? Math.min(position, totalDuration) : position,
            }));
        }
        syncService.logEvent({
            type: 'user_completed',
            source: eventSource,
            courseId: course?.id,
            userId: learnerId,
            data: {
                courseId: course?.id,
                lessonId: lesson.id,
                completedAt: Date.now(),
            },
            timestamp: Date.now(),
        });
        // Enqueue a lesson_completed batched event
        if (course?.id) {
            try {
                batchService.enqueueProgress({
                    type: 'lesson_completed',
                    courseId: course.id,
                    lessonId: lesson.id,
                    userId: learnerId,
                    percent: 100,
                    position,
                });
            }
            catch (e) {
                console.warn('[CoursePlayer] Failed to enqueue completion batch event', e);
            }
        }
        if (!silent) {
            showToast(`Marked "${lesson.title}" complete`, 'success');
        }
        if (course?.id) {
            const overallPercent = calculateOverallPercent(nextProgressMap, nextCompleted);
            void updateAssignmentProgress(course.id, learnerId, overallPercent);
        }
    }, [
        course?.id,
        learnerId,
        showToast,
        syncService,
        eventSource,
        lessonProgressMap,
        completedLessons,
        calculateOverallPercent,
    ]);
    // Flush any queued progress events when unmounting (best-effort)
    useEffect(() => {
        return () => {
            try {
                batchService.flushProgress();
            }
            catch {
                /* ignore */
            }
        };
    }, []);
    // Periodically persist/flush lesson playback position to support resumable video
    useEffect(() => {
        if (!currentLesson)
            return;
        let isActive = true;
        // Tick: read current player position and enqueue a lesson_progress event if position changed
        const tick = () => {
            if (!isActive)
                return;
            if (!videoRef.current)
                return;
            const player = videoRef.current;
            if (!player.duration || Number.isNaN(player.duration))
                return;
            const position = player.currentTime;
            const previous = lastAutoSavePositionRef.current ?? 0;
            // avoid noisy updates for very small changes
            if (Math.abs(position - previous) < 1)
                return;
            lastAutoSavePositionRef.current = position;
            const progressPercent = Math.min(100, Math.round((position / player.duration) * 100));
            if (course?.id) {
                try {
                    batchService.enqueueProgress({
                        type: 'lesson_progress',
                        courseId: course.id,
                        lessonId: currentLesson.id,
                        userId: learnerId,
                        percent: progressPercent,
                        position,
                    });
                }
                catch (e) {
                    console.warn('[CoursePlayer] Failed to enqueue autosave progress', e);
                }
            }
            // Persist locally so reloads pick up the latest position even if batching/network fails
            try {
                persistProgress(currentLesson.id);
            }
            catch (e) {
                // non-fatal
            }
        };
        // Do an immediate tick and then run every 10s
        tick();
        const id = window.setInterval(tick, 10000);
        return () => {
            isActive = false;
            clearInterval(id);
        };
    }, [currentLesson?.id, course?.id, learnerId, persistProgress]);
    const handleTimeUpdate = () => {
        if (!videoRef.current || !currentLesson)
            return;
        const player = videoRef.current;
        if (!player.duration || Number.isNaN(player.duration))
            return;
        const position = player.currentTime;
        const progressPercent = Math.min(100, Math.round((position / player.duration) * 100));
        setCurrentTime(position);
        setLessonPositions((prev) => {
            const previous = prev[currentLesson.id] ?? 0;
            if (Math.abs(previous - position) < 1)
                return prev;
            return { ...prev, [currentLesson.id]: position };
        });
        const previousProgress = lessonProgressMap[currentLesson.id] ?? 0;
        if (progressPercent > previousProgress) {
            setLessonProgressMap((prev) => ({
                ...prev,
                [currentLesson.id]: progressPercent,
            }));
            if (progressPercent >= 90 && !completedLessons.has(currentLesson.id)) {
                completeLesson(currentLesson, position, player.duration, true);
            }
            else if (progressPercent - previousProgress >= 10) {
                logProgress(currentLesson.id, progressPercent, position);
            }
        }
    };
    const handleSeek = (time) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };
    const handleVolumeChange = (newVolume) => {
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
        }
    };
    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };
    const changePlaybackSpeed = (speed) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
            setPlaybackSpeed(speed);
        }
    };
    const skipTime = (seconds) => {
        if (videoRef.current) {
            const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
            handleSeek(newTime);
        }
    };
    const navigateLesson = useCallback((direction) => {
        if (!currentLesson || courseLessons.length === 0)
            return;
        const currentIndex = courseLessons.findIndex((lesson) => lesson.id === currentLesson.id);
        if (currentIndex === -1)
            return;
        const offset = direction === 'next' ? 1 : -1;
        const nextIndex = currentIndex + offset;
        if (nextIndex < 0 || nextIndex >= courseLessons.length)
            return;
        const nextLesson = courseLessons[nextIndex];
        const courseSlug = courseData?.course.slug || courseId || '';
        if (!courseSlug)
            return;
        navigate(`${coursePathBase}/${courseSlug}/${lessonPathSegment}/${nextLesson.id}`);
    }, [courseLessons, currentLesson, navigate, courseData, courseId, coursePathBase, lessonPathSegment]);
    const markLessonComplete = () => {
        if (!currentLesson)
            return;
        completeLesson(currentLesson);
        navigateLesson('next');
    };
    const addBookmark = () => {
        if (!currentLesson)
            return;
        const timestamp = Math.floor(currentTime);
        const newBookmark = {
            id: `bookmark-${Date.now()}`,
            lessonId: currentLesson.id,
            position: timestamp,
            note: 'Video bookmark',
            createdAt: new Date().toISOString()
        };
        setUserBookmarks((prev) => [newBookmark, ...prev]);
    };
    const addNote = () => {
        if (!noteText.trim() || !currentLesson)
            return;
        const timestamp = Math.floor(currentTime);
        const newNote = {
            id: `note-${Date.now()}`,
            lessonId: currentLesson.id,
            position: timestamp,
            content: noteText,
            isPrivate: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setUserNotes((prev) => [newNote, ...prev]);
        setNoteText('');
    };
    if (isLoading) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-softwhite", children: _jsx(LoadingSpinner, { size: "lg" }) }));
    }
    if (error) {
        return (_jsx("div", { className: "bg-softwhite py-24", children: _jsx("div", { className: "mx-auto max-w-xl px-6", children: _jsxs(Card, { tone: "muted", padding: "lg", className: "text-center", role: "alert", "aria-live": "polite", children: [_jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-2xl bg-sunrise/10 text-sunrise", children: _jsx(AlertCircle, { className: "h-6 w-6" }) }), _jsx("h2", { className: "mt-4 font-heading text-xl font-semibold text-charcoal", children: "Unable to load course" }), _jsx("p", { className: "mt-2 text-sm text-slate/80", children: error }), _jsxs("div", { className: "mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center", children: [_jsx(Button, { onClick: handleRetry, trailingIcon: _jsx(RefreshCw, { className: "h-4 w-4" }), children: "Try again" }), _jsx(Button, { variant: "ghost", onClick: () => navigate(coursesIndexPath), children: "Back to courses" })] })] }) }) }));
    }
    if (showCompletionScreen && course) {
        const completionModules = (course.modules || []).map((module) => ({
            id: module.id,
            title: module.title,
            lessons: (module.lessons || []).map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
                completed: completedLessons.has(lesson.id),
            })),
        }));
        const totalSecondsSpent = Object.values(lessonPositions).reduce((sum, value) => {
            if (!Number.isFinite(value))
                return sum;
            return sum + value;
        }, 0);
        const fallbackMinutes = typeof course.estimatedDuration === 'number' && course.estimatedDuration > 0
            ? course.estimatedDuration
            : 0;
        const timeSpentMinutes = totalSecondsSpent > 0 ? Math.round(totalSecondsSpent / 60) : fallbackMinutes;
        const completionCourse = {
            id: course.id,
            title: course.title,
            description: course.description,
            thumbnail: course.thumbnail,
            instructor: course.instructorName,
            duration: course.duration,
            modules: completionModules,
        };
        const completionData = {
            completedAt: new Date(completionTimestamp ?? Date.now()),
            timeSpent: Math.max(timeSpentMinutes, 1),
            score: undefined,
            grade: undefined,
            certificateId: undefined,
            certificateUrl: undefined,
        };
        return (_jsxs("div", { className: "bg-softwhite pb-16", children: [_jsx(CourseCompletion, { course: completionCourse, completionData: completionData, keyTakeaways: course.keyTakeaways || [], nextSteps: [
                        {
                            title: 'Review lessons',
                            description: 'Revisit course modules to reinforce the material.',
                            action: () => setShowCompletionScreen(false),
                        },
                        {
                            title: 'Back to my courses',
                            description: 'Head back to your course list to pick what is next.',
                            action: () => navigate(coursesIndexPath),
                        },
                    ], recommendedCourses: [], onClose: () => setShowCompletionScreen(false) }), _jsxs("div", { className: "mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-3 px-6", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowCompletionScreen(false), children: "Review lessons" }), _jsx(Button, { size: "sm", onClick: () => navigate(coursesIndexPath), children: "Back to courses" })] })] }));
    }
    if (!course || !currentLesson) {
        return (_jsx("div", { className: "bg-softwhite py-24", children: _jsx("div", { className: "mx-auto max-w-xl px-6", children: _jsxs(Card, { tone: "muted", padding: "lg", className: "text-center", children: [_jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-2xl bg-skyblue/10 text-skyblue", children: _jsx(BookOpen, { className: "h-6 w-6" }) }), _jsx("h2", { className: "mt-4 font-heading text-xl font-semibold text-charcoal", children: "Course not found" }), _jsx("p", { className: "mt-2 text-sm text-slate/80", children: "Return to the catalog to choose another learning experience." }), _jsx(Button, { className: "mt-6", onClick: () => navigate(coursesIndexPath), children: "Back to courses" })] }) }) }));
    }
    const courseProgressPercent = Math.round((progress?.overallProgress || 0) * 100);
    return (_jsxs("div", { className: "min-h-screen bg-softwhite pb-16", children: [_jsxs("div", { className: "mx-auto max-w-7xl px-6 py-8 lg:px-12", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx(Button, { variant: "ghost", size: "sm", leadingIcon: _jsx(ArrowLeft, { className: "h-4 w-4" }), onClick: () => navigate(coursesIndexPath), children: "Back to catalog" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: course.difficulty }), _jsx(Badge, { tone: courseProgressPercent >= 100 ? 'positive' : courseProgressPercent > 0 ? 'info' : 'neutral', children: courseProgressPercent >= 100 ? 'Completed' : `${courseProgressPercent}% complete` })] })] }), _jsxs("div", { className: "mt-4", children: [_jsx("h1", { ref: headingRef, tabIndex: -1, className: "font-heading text-3xl font-bold text-charcoal outline-none md:text-4xl focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite", children: course.title }), _jsx("p", { className: "mt-2 max-w-3xl text-sm text-slate/80", children: course.description })] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-3 text-sm text-slate/70", children: [_jsxs("span", { className: "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-card-sm", children: [_jsx(Clock, { className: "h-4 w-4" }), course.duration] }), _jsxs("span", { className: "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-card-sm", children: [_jsx(BookOpen, { className: "h-4 w-4" }), course.lessons, " lessons"] })] }), _jsxs("div", { className: "mt-8 grid gap-6 lg:grid-cols-[320px,1fr]", children: [_jsx(Card, { tone: "muted", className: "h-full", children: _jsxs("div", { className: "flex flex-col gap-6", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between text-sm text-slate/80", children: [_jsx("span", { children: "Overall progress" }), _jsxs("span", { children: [courseProgressPercent, "%"] })] }), _jsx(ProgressBar, { value: courseProgressPercent, className: "mt-2" })] }), _jsx(CourseOutline, { course: course, currentLesson: currentLesson, progress: progress, onLessonSelect: (lesson) => {
                                                const slug = course.slug || courseId || '';
                                                setCurrentLesson(lesson);
                                                if (!slug)
                                                    return;
                                                navigate(`${coursePathBase}/${slug}/${lessonPathSegment}/${lesson.id}`);
                                            } })] }) }), _jsxs(Card, { padding: "none", className: "overflow-hidden", children: [currentLesson.type === 'video' && (_jsxs("div", { className: "relative bg-ink", children: [(() => {
                                                // Support multiple content shapes for video URLs coming from different backends
                                                const raw = currentLesson.content || {};
                                                const videoUrl = raw.videoUrl ||
                                                    raw.src ||
                                                    raw.url ||
                                                    (raw.body && (raw.body.videoUrl || raw.body.src)) ||
                                                    undefined;
                                                const videoType = raw.videoType || raw.type || '';
                                                if (!videoUrl) {
                                                    return (_jsx(Card, { tone: "muted", className: "h-full w-full rounded-none border-none", children: _jsx("p", { className: "text-sm text-slate/80", children: "Video source unavailable. Please contact your facilitator." }) }));
                                                }
                                                // TED Talk videos need iframe embed
                                                if (videoType === 'ted' || videoUrl.includes('ted.com/talks')) {
                                                    // Convert TED talk URL to embed URL
                                                    let embedUrl = videoUrl;
                                                    if (videoUrl.includes('ted.com/talks') && !videoUrl.includes('embed.ted.com')) {
                                                        embedUrl = videoUrl.replace('www.ted.com/talks', 'embed.ted.com/talks');
                                                    }
                                                    return (_jsx("iframe", { src: embedUrl, className: "h-full w-full max-h-[520px] bg-black", style: { aspectRatio: '16/9' }, frameBorder: "0", scrolling: "no", allowFullScreen: true, "data-test": "video-player" }));
                                                }
                                                // YouTube videos need iframe embed
                                                if (videoType === 'youtube' || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                                                    let videoId = '';
                                                    if (videoUrl.includes('youtube.com/watch?v=')) {
                                                        videoId = videoUrl.split('v=')[1]?.split('&')[0];
                                                    }
                                                    else if (videoUrl.includes('youtu.be/')) {
                                                        videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
                                                    }
                                                    else if (videoUrl.includes('youtube.com/embed/')) {
                                                        videoId = videoUrl.split('embed/')[1]?.split('?')[0];
                                                    }
                                                    if (videoId) {
                                                        return (_jsx("iframe", { src: `https://www.youtube.com/embed/${videoId}`, className: "h-full w-full max-h-[520px] bg-black", style: { aspectRatio: '16/9' }, frameBorder: "0", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowFullScreen: true, "data-test": "video-player" }));
                                                    }
                                                }
                                                // Vimeo videos need iframe embed
                                                if (videoType === 'vimeo' || videoUrl.includes('vimeo.com')) {
                                                    let videoId = '';
                                                    if (videoUrl.includes('vimeo.com/')) {
                                                        videoId = videoUrl.split('vimeo.com/')[1]?.split('?')[0]?.split('/')[0];
                                                    }
                                                    if (videoId) {
                                                        return (_jsx("iframe", { src: `https://player.vimeo.com/video/${videoId}`, className: "h-full w-full max-h-[520px] bg-black", style: { aspectRatio: '16/9' }, frameBorder: "0", allow: "autoplay; fullscreen; picture-in-picture", allowFullScreen: true, "data-test": "video-player" }));
                                                    }
                                                }
                                                // Default: use native HTML5 video player for direct video files
                                                return (_jsx("video", { ref: videoRef, src: videoUrl, className: "h-full w-full max-h-[520px] bg-black object-cover", onTimeUpdate: handleTimeUpdate, onLoadedMetadata: () => {
                                                        if (!videoRef.current)
                                                            return;
                                                        const metaDuration = videoRef.current.duration || 0;
                                                        setDuration(metaDuration);
                                                        const storedPosition = lessonPositions[currentLesson.id] ?? 0;
                                                        if (storedPosition > 0 && storedPosition < metaDuration) {
                                                            videoRef.current.currentTime = storedPosition;
                                                            setCurrentTime(storedPosition);
                                                        }
                                                    }, onPlay: () => setIsPlaying(true), onPause: () => setIsPlaying(false), "data-test": "video-player" }));
                                            })(), (() => {
                                                const raw = currentLesson.content || {};
                                                const videoUrl = raw.videoUrl ||
                                                    raw.src ||
                                                    raw.url ||
                                                    (raw.body && (raw.body.videoUrl || raw.body.src)) ||
                                                    undefined;
                                                const videoType = raw.videoType || raw.type || '';
                                                // Only show custom controls for native HTML5 video (not iframes)
                                                const isNativeVideo = videoUrl &&
                                                    videoType !== 'ted' &&
                                                    videoType !== 'youtube' &&
                                                    videoType !== 'vimeo' &&
                                                    !videoUrl.includes('ted.com') &&
                                                    !videoUrl.includes('youtube.com') &&
                                                    !videoUrl.includes('youtu.be') &&
                                                    !videoUrl.includes('vimeo.com');
                                                return isNativeVideo;
                                            })() && (_jsx(VideoControls, { isPlaying: isPlaying, currentTime: currentTime, duration: duration, volume: volume, isMuted: isMuted, playbackSpeed: playbackSpeed, showControls: showControls, onPlayPause: handlePlayPause, onSeek: handleSeek, onVolumeChange: handleVolumeChange, onToggleMute: toggleMute, onSpeedChange: changePlaybackSpeed, onSkip: skipTime, onFullscreen: () => setIsFullscreen(!isFullscreen), onSettings: () => setShowSettings(!showSettings) }))] })), _jsxs("div", { className: "grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_280px]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-2xl font-semibold text-charcoal", children: currentLesson.title }), currentLesson.description && (_jsx("p", { className: "mt-1 text-sm text-slate/80", children: currentLesson.description }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(IconToggle, { onClick: addBookmark, icon: _jsx(Bookmark, { className: "h-4 w-4" }), label: "Bookmark lesson" }), _jsx(IconToggle, { onClick: () => setShowNotes(!showNotes), icon: _jsx(MessageCircle, { className: "h-4 w-4" }), label: "Toggle notes", active: showNotes }), _jsx(IconToggle, { onClick: () => setShowTranscript(!showTranscript), icon: _jsx(FileText, { className: "h-4 w-4" }), label: "Toggle transcript", active: showTranscript })] })] }), _jsx(LessonContent, { lesson: currentLesson, onComplete: markLessonComplete, onShowQuizModal: setShowQuizModal }), showTranscript && currentLesson.content.transcript && (_jsx(TranscriptPanel, { transcript: currentLesson.content.transcript, currentTime: currentTime, onSeek: handleSeek }))] }), _jsxs("div", { className: "space-y-6", children: [showNotes && (_jsx(NotesPanel, { notes: userNotes.filter((note) => note.lessonId === currentLesson.id), bookmarks: userBookmarks.filter((bookmark) => bookmark.lessonId === currentLesson.id), noteText: noteText, onNoteTextChange: setNoteText, onAddNote: addNote })), _jsx(NavigationPanel, { onPrevious: () => navigateLesson('prev'), onNext: () => navigateLesson('next'), canGoPrevious: canGoPrevious, canGoNext: canGoNext, onMarkComplete: markLessonComplete })] })] })] })] })] }), showQuizModal && currentLesson?.type === 'quiz' && (_jsx(QuizModal, { lesson: currentLesson, answers: quizAnswers, submitted: quizSubmitted, score: quizScore, onAnswerChange: (questionId, answer) => {
                    setQuizAnswers(prev => ({ ...prev, [questionId]: answer }));
                }, onSubmit: () => {
                    // Calculate score
                    const quizData = currentLesson.content;
                    const questions = quizData.questions || [];
                    let correct = 0;
                    questions.forEach((q) => {
                        const selectedAnswer = quizAnswers[q.id];
                        const correctOption = q.options?.find((opt) => opt.correct);
                        if (selectedAnswer === correctOption?.id) {
                            correct++;
                        }
                    });
                    const scorePercent = questions.length > 0 ? (correct / questions.length) * 100 : 0;
                    setQuizScore(scorePercent);
                    setQuizSubmitted(true);
                    // Check if passed
                    const passingScore = quizData.passingScore || 70;
                    if (scorePercent >= passingScore) {
                        // Mark lesson as complete
                        markLessonComplete();
                    }
                }, onRetry: () => {
                    setQuizAnswers({});
                    setQuizSubmitted(false);
                    setQuizScore(null);
                }, onClose: () => {
                    setShowQuizModal(false);
                    setQuizAnswers({});
                    setQuizSubmitted(false);
                    setQuizScore(null);
                } }))] }));
};
// Quiz Modal Component
const QuizModal = ({ lesson, answers, submitted, score, onAnswerChange, onSubmit, onRetry, onClose }) => {
    const quizData = lesson.content;
    const questions = quizData.questions || [];
    const passingScore = quizData.passingScore || 70;
    const passed = score !== null && score >= passingScore;
    // Check if all questions are answered
    const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", children: _jsxs("div", { className: "w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl", children: [_jsx("div", { className: "sticky top-0 bg-white border-b border-mist px-6 py-4 rounded-t-2xl", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-2xl font-semibold text-charcoal", children: lesson.title }), lesson.description && (_jsx("p", { className: "mt-1 text-sm text-slate/80", children: lesson.description }))] }), _jsx("button", { onClick: onClose, className: "text-slate/70 hover:text-charcoal transition-colors", "aria-label": "Close quiz", children: _jsx("span", { className: "text-2xl", children: "\u00D7" }) })] }) }), _jsx("div", { className: "p-6 space-y-6", children: !submitted ? (_jsxs(_Fragment, { children: [questions.map((question, index) => (_jsxs(Card, { tone: "muted", className: "p-4", children: [_jsxs("h3", { className: "font-heading text-lg font-semibold text-charcoal mb-4", children: [index + 1, ". ", question.text] }), _jsx("div", { className: "space-y-2", children: (question.options || []).map((option) => (_jsxs("label", { className: cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all", answers[question.id] === option.id
                                                ? "border-skyblue bg-skyblue/10"
                                                : "border-mist bg-white hover:border-skyblue/50"), children: [_jsx("input", { type: "radio", name: question.id, value: option.id, checked: answers[question.id] === option.id, onChange: () => onAnswerChange(question.id, option.id), className: "text-skyblue focus:ring-skyblue" }), _jsx("span", { className: "text-sm text-charcoal", children: option.text })] }, option.id))) })] }, question.id))), _jsxs("div", { className: "flex justify-end gap-3 pt-4", children: [_jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { onClick: onSubmit, disabled: !allAnswered, className: !allAnswered ? 'opacity-50 cursor-not-allowed' : '', children: "Submit Quiz" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs(Card, { tone: "muted", className: "p-6 text-center", children: [_jsx("div", { className: cn("mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4", passed ? "bg-green-100" : "bg-yellow-100"), children: passed ? (_jsx(CheckCircle, { className: "h-8 w-8 text-green-600" })) : (_jsx(AlertCircle, { className: "h-8 w-8 text-yellow-600" })) }), _jsx("h3", { className: "font-heading text-2xl font-semibold text-charcoal mb-2", children: passed ? "Great job!" : "Keep trying!" }), _jsxs("p", { className: "text-lg text-charcoal mb-2", children: ["Your score: ", _jsxs("span", { className: "font-bold", children: [score?.toFixed(0), "%"] })] }), _jsx("p", { className: "text-sm text-slate/80", children: passed
                                            ? `You've passed! The passing score is ${passingScore}%.`
                                            : `You need ${passingScore}% to pass. Review the material and try again.` })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "font-heading text-lg font-semibold text-charcoal", children: "Answer Review" }), questions.map((question, index) => {
                                        const selectedAnswer = answers[question.id];
                                        const correctOption = question.options?.find((opt) => opt.correct);
                                        const selectedOption = question.options?.find((opt) => opt.id === selectedAnswer);
                                        const isCorrect = selectedAnswer === correctOption?.id;
                                        return (_jsxs(Card, { tone: "muted", className: "p-4", children: [_jsxs("div", { className: "flex items-start gap-3 mb-3", children: [isCorrect ? (_jsx(CheckCircle, { className: "h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" })) : (_jsx(AlertCircle, { className: "h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" })), _jsx("div", { className: "flex-1", children: _jsxs("h4", { className: "font-heading text-base font-semibold text-charcoal", children: [index + 1, ". ", question.text] }) })] }), _jsxs("div", { className: "ml-8 space-y-2 text-sm", children: [_jsxs("p", { children: [_jsx("span", { className: "font-medium", children: "Your answer:" }), ' ', _jsx("span", { className: isCorrect ? 'text-green-600' : 'text-red-600', children: selectedOption?.text || 'No answer' })] }), !isCorrect && (_jsxs("p", { children: [_jsx("span", { className: "font-medium", children: "Correct answer:" }), ' ', _jsx("span", { className: "text-green-600", children: correctOption?.text })] }))] })] }, question.id));
                                    })] }), _jsxs("div", { className: "flex justify-end gap-3 pt-4", children: [!passed && (_jsx(Button, { variant: "outline", onClick: onRetry, leadingIcon: _jsx(RefreshCw, { className: "h-4 w-4" }), children: "Try Again" })), _jsx(Button, { onClick: onClose, children: passed ? 'Continue' : 'Close' })] })] })) })] }) }));
};
// Course Outline Component
const CourseOutline = ({ course, currentLesson, progress, onLessonSelect }) => {
    const [expandedChapters, setExpandedChapters] = useState(() => {
        const firstChapterId = course.chapters?.[0]?.id;
        return firstChapterId ? new Set([firstChapterId]) : new Set();
    });
    const toggleChapter = (chapterId) => {
        const next = new Set(expandedChapters);
        if (next.has(chapterId)) {
            next.delete(chapterId);
        }
        else {
            next.add(chapterId);
        }
        setExpandedChapters(next);
    };
    const getLessonProgress = (lessonId) => progress?.lessonProgress.find((lp) => lp.lessonId === lessonId);
    return (_jsx("div", { className: "space-y-4", children: (course.chapters || []).map((chapter, index) => {
            const expanded = expandedChapters.has(chapter.id);
            return (_jsxs("div", { className: "rounded-2xl bg-white shadow-card-sm", children: [_jsxs("button", { type: "button", onClick: () => toggleChapter(chapter.id), className: "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left", "aria-expanded": expanded, "aria-controls": `${chapter.id}-lessons`, children: [_jsxs("div", { children: [_jsxs("p", { className: "font-heading text-sm font-semibold text-charcoal", children: [index + 1, ". ", chapter.title] }), chapter.description && (_jsx("p", { className: "text-xs text-slate/70", children: chapter.description }))] }), expanded ? (_jsx(ChevronUp, { className: "h-4 w-4 text-slate/70" })) : (_jsx(ChevronDown, { className: "h-4 w-4 text-slate/70" }))] }), expanded && (_jsx("div", { className: "border-t border-mist/60 px-2 py-3", id: `${chapter.id}-lessons`, role: "region", "aria-label": `${chapter.title} lessons`, children: _jsx("div", { className: "space-y-2", children: (chapter.lessons || []).map((lesson, lessonIndex) => {
                                const lessonProgress = getLessonProgress(lesson.id);
                                const isComplete = lessonProgress?.isCompleted || false;
                                const isCurrent = lesson.id === currentLesson.id;
                                return (_jsxs("button", { type: "button", onClick: () => onLessonSelect(lesson), className: `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${isCurrent
                                        ? 'bg-skyblue/10 text-skyblue'
                                        : 'text-slate/80 hover:bg-cloud hover:text-charcoal'}`, "aria-current": isCurrent ? 'page' : undefined, children: [_jsx("span", { className: "flex h-7 w-7 items-center justify-center rounded-full border border-mist text-xs font-semibold", children: lessonIndex + 1 }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "font-heading text-sm font-semibold", children: lesson.title }), _jsx("p", { className: "text-xs text-slate/70", children: lesson.estimatedDuration || lesson.duration || '5 min' })] }), isComplete ? (_jsx(CheckCircle, { className: "h-4 w-4 text-forest" })) : (_jsx(Circle, { className: "h-4 w-4 text-mist" }))] }, lesson.id));
                            }) }) }))] }, chapter.id));
        }) }));
};
// Video Controls Component
const VideoControls = ({ isPlaying, currentTime, duration, volume, isMuted, playbackSpeed, showControls, onPlayPause, onSeek, onVolumeChange, onToggleMute, onSpeedChange, onSkip, onFullscreen, onSettings }) => {
    const formatTime = (timeInSeconds) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    if (!showControls)
        return null;
    return (_jsxs("div", { className: "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4", children: [_jsx("div", { className: "mb-4", children: _jsx("input", { type: "range", min: "0", max: duration, value: currentTime, onChange: (e) => onSeek(Number(e.target.value)), className: "w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer" }) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("button", { onClick: () => onSkip(-10), className: "text-white hover:text-orange-400", children: _jsx(SkipBack, { className: "w-5 h-5" }) }), _jsx("button", { onClick: onPlayPause, className: "text-white hover:text-orange-400", children: isPlaying ? _jsx(Pause, { className: "w-6 h-6" }) : _jsx(Play, { className: "w-6 h-6" }) }), _jsx("button", { onClick: () => onSkip(10), className: "text-white hover:text-orange-400", children: _jsx(SkipForward, { className: "w-5 h-5" }) }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: onToggleMute, className: "text-white hover:text-orange-400", children: isMuted ? _jsx(VolumeX, { className: "w-5 h-5" }) : _jsx(Volume2, { className: "w-5 h-5" }) }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: volume, onChange: (e) => onVolumeChange(Number(e.target.value)), className: "w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer" })] }), _jsxs("div", { className: "text-white text-sm", children: [formatTime(currentTime), " / ", formatTime(duration)] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("select", { value: playbackSpeed, onChange: (e) => onSpeedChange(Number(e.target.value)), className: "bg-transparent text-white text-sm", children: [_jsx("option", { value: 0.5, children: "0.5x" }), _jsx("option", { value: 0.75, children: "0.75x" }), _jsx("option", { value: 1, children: "1x" }), _jsx("option", { value: 1.25, children: "1.25x" }), _jsx("option", { value: 1.5, children: "1.5x" }), _jsx("option", { value: 2, children: "2x" })] }), _jsx("button", { onClick: onSettings, className: "text-white hover:text-orange-400", children: _jsx(Settings, { className: "w-5 h-5" }) }), _jsx("button", { onClick: onFullscreen, className: "text-white hover:text-orange-400", children: _jsx(Maximize, { className: "w-5 h-5" }) })] })] })] }));
};
// Lesson Content Component
const LessonContent = ({ lesson, onComplete, onShowQuizModal }) => {
    const renderFallback = (message) => (_jsxs(Card, { tone: "muted", className: "space-y-3", children: [_jsx("p", { className: "text-sm text-slate/80", children: message }), _jsx(Button, { size: "sm", onClick: onComplete, children: "Mark as complete" })] }));
    const lessonType = lesson.type;
    if (!lesson.content || (typeof lesson.content === 'object' && Object.keys(lesson.content).length === 0)) {
        return renderFallback('Lesson content unavailable. Please check back later.');
    }
    if (lessonType === 'text' || lessonType === 'document') {
        const html = lesson.content.textContent || lesson.content.content || lesson.description || '';
        if (!html.trim()) {
            return renderFallback('Lesson notes will appear here once your facilitator adds them.');
        }
        return (_jsxs("div", { className: "prose max-w-none text-charcoal", children: [_jsx("div", { dangerouslySetInnerHTML: { __html: html } }), _jsx("div", { className: "mt-8 flex justify-end border-t border-mist/60 pt-6", children: _jsx(Button, { onClick: onComplete, trailingIcon: _jsx(CheckCircle, { className: "h-4 w-4" }), children: "Mark as complete" }) })] }));
    }
    if (lessonType === 'quiz') {
        return (_jsxs(Card, { tone: "muted", className: "space-y-3", children: [_jsxs("h3", { className: "font-heading text-lg font-semibold text-charcoal", children: ["Quiz: ", lesson.title] }), _jsx("p", { className: "text-sm text-slate/80", children: lesson.description || 'Check your understanding before moving on.' }), _jsx(Button, { onClick: () => onShowQuizModal(true), children: "Start quiz" })] }));
    }
    if (lessonType === 'interactive') {
        const instructions = lesson.content.instructions || lesson.description || 'Complete the activity to continue.';
        return (_jsxs(Card, { tone: "muted", className: "space-y-4", children: [_jsx("h3", { className: "font-heading text-lg font-semibold text-charcoal", children: "Interactive activity" }), _jsx("p", { className: "text-sm text-slate/80", children: instructions }), _jsx(Button, { onClick: onComplete, trailingIcon: _jsx(CheckCircle, { className: "h-4 w-4" }), children: "Mark activity complete" })] }));
    }
    if (lessonType === 'scenario') {
        const scenarioText = lesson.content.scenarioText || lesson.content.textContent || lesson.description || '';
        const options = lesson.content.options || [];
        return (_jsx("div", { className: "space-y-6", children: _jsxs(Card, { className: "p-6", children: [_jsxs("h3", { className: "font-heading text-xl font-bold text-charcoal mb-4", children: ["Scenario: ", lesson.title] }), scenarioText && (_jsx("div", { className: "prose max-w-none mb-6 p-4 bg-sky-50 rounded-lg border border-sky-100", children: _jsx("div", { dangerouslySetInnerHTML: { __html: scenarioText } }) })), options.length > 0 && (_jsxs("div", { className: "space-y-4", children: [_jsx("h4", { className: "font-semibold text-charcoal", children: "What would you do?" }), options.map((option, index) => (_jsxs(Card, { className: cn('p-4 cursor-pointer transition-colors', option.isCorrect ? 'border-forest bg-forest/5 hover:bg-forest/10' : 'hover:border-skyblue'), children: [_jsx("p", { className: "font-medium text-charcoal mb-2", children: option.text }), option.feedback && (_jsx("p", { className: "text-sm text-slate/70 italic", children: option.feedback }))] }, index)))] })), _jsx("div", { className: "mt-6 flex justify-end", children: _jsx(Button, { onClick: onComplete, trailingIcon: _jsx(CheckCircle, { className: "h-4 w-4" }), children: "Complete Scenario" }) })] }) }));
    }
    if (lessonType === 'resource' || lessonType === 'document') {
        const resource = lesson.content;
        // Try multiple possible field names for the download URL
        const downloadUrl = resource.downloadUrl ||
            resource.url ||
            resource.resourceUrl ||
            resource.src ||
            resource.link;
        const fileSize = resource.fileSize || resource.size;
        const resourceType = resource.resourceType || resource.type || 'file';
        return (_jsxs("div", { className: "space-y-6", children: [_jsx(Card, { className: "border-2 border-skyblue bg-gradient-to-br from-skyblue/5 to-indigo-50/50 p-6", children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "flex-shrink-0 w-16 h-16 bg-skyblue/20 rounded-xl flex items-center justify-center", children: _jsx(Download, { className: "h-8 w-8 text-skyblue" }) }), _jsxs("div", { className: "flex-1 space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-heading text-xl font-bold text-charcoal mb-2", children: lesson.title }), _jsx("p", { className: "text-sm text-slate/80", children: resource.description || lesson.description || 'Download this resource to continue your learning journey.' })] }), (fileSize || resourceType) && (_jsxs("div", { className: "flex items-center gap-4", children: [resourceType && (_jsx(Badge, { className: "bg-skyblue/20 text-skyblue border-skyblue/30", children: _jsx("span", { className: "uppercase font-semibold", children: resourceType }) })), fileSize && (_jsx("span", { className: "text-sm font-medium text-slate/70", children: fileSize }))] })), downloadUrl ? (_jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { size: "lg", className: "bg-skyblue hover:bg-skyblue/90 text-white shadow-lg", asChild: true, leadingIcon: _jsx(Download, { className: "h-5 w-5" }), children: _jsx("a", { href: downloadUrl, target: "_blank", rel: "noopener noreferrer", download: true, children: "Download Resource" }) }), _jsx(Button, { variant: "outline", size: "lg", onClick: onComplete, trailingIcon: _jsx(CheckCircle, { className: "h-5 w-5" }), children: "Mark as Complete" })] })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(AlertCircle, { className: "h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium text-yellow-800", children: "Resource Not Available" }), _jsx("p", { className: "text-xs text-yellow-700 mt-1", children: "The download link for this resource is currently unavailable. Please contact your course administrator." })] })] }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onComplete, children: "Mark as reviewed anyway" })] }))] })] }) }), _jsxs(Card, { tone: "muted", className: "p-4", children: [_jsx("h4", { className: "font-heading text-sm font-semibold text-charcoal mb-2", children: "\uD83D\uDCCB What to do with this resource" }), _jsxs("ul", { className: "text-sm text-slate/80 space-y-1 list-disc list-inside", children: [_jsx("li", { children: "Download the file to your computer" }), _jsx("li", { children: "Review the material at your own pace" }), _jsx("li", { children: "Mark the lesson as complete when you're done" })] })] })] }));
    }
    return renderFallback('This lesson type is not interactive in the preview environment.');
};
// Additional helper components would go here...
const IconToggle = ({ onClick, icon, label, active = false, }) => (_jsx("button", { type: "button", onClick: onClick, "aria-label": label, className: cn('rounded-full border border-transparent p-2 transition', active ? 'bg-skyblue/10 text-skyblue' : 'text-slate/70 hover:bg-cloud hover:text-skyblue'), children: icon }));
const TranscriptPanel = ({ transcript }) => (_jsxs("div", { className: "rounded-2xl border border-mist bg-white p-4 shadow-card-sm", children: [_jsx("h3", { className: "font-heading text-sm font-semibold text-charcoal", children: "Transcript" }), _jsx("div", { className: "mt-2 max-h-64 overflow-y-auto text-sm text-slate/80", children: transcript })] }));
const NotesPanel = ({ notes, bookmarks, noteText, onNoteTextChange, onAddNote }) => (_jsxs("div", { className: "rounded-2xl border border-mist bg-white p-4 shadow-card-sm", children: [_jsx("h3", { className: "font-heading text-sm font-semibold text-charcoal", children: "Notes & bookmarks" }), _jsx("p", { className: "mt-1 text-xs text-slate/70", children: "Capture reflections and jump back to key moments." }), _jsxs("div", { className: "mt-4 space-y-3", children: [_jsx("textarea", { value: noteText, onChange: (event) => onNoteTextChange(event.target.value), placeholder: "Add a note...", className: "w-full rounded-lg border border-mist bg-cloud px-3 py-2 text-sm text-charcoal focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue/40", rows: 3 }), _jsx(Button, { size: "sm", onClick: onAddNote, className: "w-full", children: "Save note" })] }), _jsxs("div", { className: "mt-4 space-y-3", children: [bookmarks.map((bookmark) => (_jsxs("div", { className: "rounded-xl border border-mist bg-cloud px-3 py-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate/70", children: [_jsx("span", { children: "Bookmark" }), _jsxs("span", { children: [Math.floor(bookmark.position / 60), ":", (bookmark.position % 60).toString().padStart(2, '0')] })] }), _jsx("p", { className: "mt-1 text-sm text-charcoal", children: bookmark.note || 'Quick reference saved.' })] }, bookmark.id))), notes.map((note) => (_jsxs("div", { className: "rounded-xl border border-mist bg-cloud px-3 py-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate/70", children: [_jsx("span", { children: "Note" }), _jsx("span", { children: note.position
                                        ? `${Math.floor(note.position / 60)}:${(note.position % 60).toString().padStart(2, '0')}`
                                        : '' })] }), _jsx("p", { className: "mt-1 text-sm text-charcoal", children: note.content })] }, note.id)))] })] }));
const NavigationPanel = ({ onPrevious, onNext, canGoPrevious, canGoNext, onMarkComplete }) => (_jsxs("div", { className: "rounded-2xl border border-mist bg-white p-4 shadow-card-sm", children: [_jsx("h3", { className: "font-heading text-sm font-semibold text-charcoal", children: "Lesson actions" }), _jsx("p", { className: "mt-1 text-xs text-slate/70", children: "Navigate through the module or mark this lesson complete." }), _jsxs("div", { className: "mt-4 flex flex-col gap-3", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: onPrevious, disabled: !canGoPrevious, leadingIcon: _jsx(ArrowLeft, { className: "h-4 w-4" }), className: "flex-1", children: "Previous" }), _jsx(Button, { size: "sm", onClick: onNext, disabled: !canGoNext, trailingIcon: _jsx(ArrowRight, { className: "h-4 w-4" }), className: "flex-1", children: "Next lesson" })] }), _jsx(Button, { variant: "success", size: "sm", onClick: onMarkComplete, leadingIcon: _jsx(CheckCircle, { className: "h-4 w-4" }), children: "Mark as complete" })] })] }));
export default CoursePlayer;
