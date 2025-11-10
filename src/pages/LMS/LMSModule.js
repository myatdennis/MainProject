import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useUserProfile } from '../../hooks/useUserProfile';
import ClientErrorBoundary from '../../components/ClientErrorBoundary';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { loadStoredCourseProgress, saveStoredCourseProgress, syncCourseProgressWithRemote, } from '../../utils/courseProgress';
const LessonSidebarButton = memo(({ lesson, index, progress, isActive, onSelect }) => {
    const statusStyles = isActive
        ? 'bg-skyblue/10 border border-skyblue text-skyblue'
        : progress.completed
            ? 'bg-forest/10 border border-forest text-forest'
            : 'bg-white border border-mist text-charcoal hover:bg-mist/40';
    return (_jsx("button", { type: "button", className: `w-full text-left rounded-xl px-4 py-3 transition ${statusStyles}`, onClick: () => onSelect(lesson.id), "aria-label": `Open lesson ${lesson.title}`, children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold leading-tight", children: lesson.title }), _jsxs("p", { className: "text-xs text-slate/70 mt-0.5", children: ["Lesson ", index + 1, " \u00B7 ", lesson.duration || `${lesson.estimatedDuration ?? 0} min`] })] }), _jsx("div", { className: "flex flex-col items-end gap-1", children: _jsx("span", { className: "rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate/80", children: progress.completed ? 'Completed' : `${progress.percent}%` }) })] }) }));
});
const buildLegacyLearnerId = () => {
    try {
        const raw = localStorage.getItem('huddle_user');
        if (!raw)
            return 'local-user';
        const parsed = JSON.parse(raw);
        return (parsed.email || parsed.id || 'local-user').toLowerCase();
    }
    catch (error) {
        console.warn('Failed to parse learner identity (legacy fallback):', error);
        return 'local-user';
    }
};
const deriveModuleContext = (moduleId) => {
    if (!moduleId)
        return null;
    const courses = courseStore.getAllCourses();
    for (const course of courses) {
        const normalized = normalizeCourse(course);
        const targetModule = normalized.modules.find((module) => module.id === moduleId);
        if (targetModule) {
            return { course: normalized, module: targetModule };
        }
    }
    return null;
};
const LMSModule = () => {
    const { moduleId } = useParams();
    const navigate = useNavigate();
    const { user } = useUserProfile();
    const learnerId = useMemo(() => (user ? (user.email || user.id).toLowerCase() : buildLegacyLearnerId()), [user]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [courseContext, setCourseContext] = useState(null);
    const [currentLessonId, setCurrentLessonId] = useState(null);
    const [completedLessons, setCompletedLessons] = useState(new Set());
    const [lessonProgress, setLessonProgress] = useState({});
    const [lessonPositions, setLessonPositions] = useState({});
    useEffect(() => {
        const loadModule = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const context = deriveModuleContext(moduleId);
                if (!context) {
                    setError('Module not found. It may have been unpublished or removed.');
                    setCourseContext(null);
                    setIsLoading(false);
                    return;
                }
                const lessons = (context.module.lessons ?? []);
                if (lessons.length === 0) {
                    setCourseContext({ ...context, lessons: [] });
                    setCompletedLessons(new Set());
                    setLessonProgress({});
                    setLessonPositions({});
                    setCurrentLessonId(null);
                    setIsLoading(false);
                    return;
                }
                await syncCourseProgressWithRemote({
                    courseSlug: context.course.slug,
                    courseId: context.course.id,
                    userId: learnerId,
                    lessonIds: lessons.map((lesson) => lesson.id),
                });
                const storedProgress = loadStoredCourseProgress(context.course.slug);
                const progressSet = new Set(storedProgress.completedLessonIds);
                setCourseContext({ ...context, lessons });
                setCompletedLessons(progressSet);
                setLessonProgress(storedProgress.lessonProgress || {});
                setLessonPositions(storedProgress.lessonPositions || {});
                const resolvedLesson = (storedProgress.lastLessonId && lessons.some((lesson) => lesson.id === storedProgress.lastLessonId)
                    ? storedProgress.lastLessonId
                    : lessons[0]?.id) ?? null;
                setCurrentLessonId(resolvedLesson);
            }
            catch (err) {
                console.error('Failed to load module data:', err);
                setError('We couldn’t load the module right now. Please refresh or try again later.');
                setCourseContext(null);
            }
            finally {
                setIsLoading(false);
            }
        };
        void loadModule();
    }, [moduleId, learnerId]);
    const persistProgress = useCallback((lastLessonId) => {
        if (!courseContext)
            return;
        const payload = {
            completedLessonIds: Array.from(completedLessons),
            lessonProgress,
            lessonPositions,
            lastLessonId: lastLessonId ?? currentLessonId ?? undefined,
        };
        saveStoredCourseProgress(courseContext.course.slug, payload, {
            courseId: courseContext.course.id,
            userId: learnerId,
            lessonIds: courseContext.lessons.map((lesson) => lesson.id),
        });
    }, [courseContext, completedLessons, lessonProgress, lessonPositions, learnerId, currentLessonId]);
    useEffect(() => {
        persistProgress();
    }, [persistProgress]);
    const updateLessonProgress = useCallback((lessonId, percent) => {
        setLessonProgress((prev) => {
            const next = { ...prev, [lessonId]: Math.min(100, Math.max(percent, prev[lessonId] ?? 0)) };
            return next;
        });
    }, []);
    const markLessonComplete = useCallback((lessonId) => {
        setCompletedLessons((prev) => {
            const updated = new Set(prev);
            updated.add(lessonId);
            return updated;
        });
        updateLessonProgress(lessonId, 100);
        toast.success('Marked lesson complete');
        const moduleLessons = courseContext?.lessons ?? [];
        const currentIndex = moduleLessons.findIndex((lesson) => lesson.id === lessonId);
        const nextLesson = moduleLessons[currentIndex + 1];
        if (nextLesson) {
            setCurrentLessonId(nextLesson.id);
        }
        persistProgress(nextLesson?.id ?? lessonId);
    }, [courseContext?.lessons, persistProgress, updateLessonProgress]);
    const handleOpenInPlayer = useCallback((lessonId) => {
        if (!courseContext)
            return;
        navigate(`/lms/course/${courseContext.course.slug}/lesson/${lessonId}`);
    }, [courseContext, navigate]);
    if (isLoading) {
        return (_jsx("div", { className: "py-24", children: _jsx(LoadingSpinner, { size: "lg" }) }));
    }
    if (error || !courseContext) {
        return (_jsx("div", { className: "py-16", children: _jsxs(Card, { tone: "muted", className: "mx-auto max-w-xl space-y-4 text-center", children: [_jsx("h2", { className: "font-heading text-xl font-semibold text-charcoal", children: "Module unavailable" }), _jsx("p", { className: "text-sm text-slate/80", children: error ?? 'We couldn’t load this module right now.' }), _jsx(Button, { size: "sm", onClick: () => navigate('/lms/courses'), children: "Back to courses" })] }) }));
    }
    const { course, module, lessons } = courseContext;
    const activeLesson = lessons.find((lesson) => lesson.id === currentLessonId) ?? lessons[0];
    const overallPercent = lessons.length > 0 ? Math.round((Array.from(completedLessons).length / lessons.length) * 100) : 0;
    return (_jsx(ClientErrorBoundary, { children: _jsx("div", { className: "min-h-screen bg-softwhite", children: _jsxs("div", { className: "container-page section", children: [_jsx(Breadcrumbs, { items: [{ label: 'Courses', to: '/lms/courses' }, { label: 'Module' }] }), _jsxs("div", { className: "flex flex-col gap-6 lg:flex-row lg:items-start", children: [_jsxs("div", { className: "flex-1 space-y-4", children: [_jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: "Module" }), _jsx("h1", { className: "font-heading text-3xl font-bold text-charcoal", children: module.title }), _jsx("p", { className: "max-w-2xl text-sm text-slate/80", children: module.description || course.description }), _jsxs("div", { className: "flex flex-wrap gap-4 text-xs text-slate/70", children: [_jsxs("span", { className: "rounded-full bg-white px-4 py-2 shadow-card-sm", children: [lessons.length, " lessons"] }), _jsx("span", { className: "rounded-full bg-white px-4 py-2 shadow-card-sm", children: module.duration || course.duration }), _jsxs("span", { className: "rounded-full bg-forest/10 px-4 py-2 text-forest shadow-card-sm", children: [overallPercent, "% complete"] })] }), _jsx(ProgressBar, { value: overallPercent, srLabel: "Overall module progress" })] }), _jsxs(Card, { tone: "muted", padding: "lg", className: "w-full max-w-xs self-stretch", children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Quick actions" }), _jsxs("div", { className: "mt-4 space-y-3", children: [_jsx(Button, { size: "sm", className: "w-full", onClick: () => {
                                                    if (activeLesson) {
                                                        handleOpenInPlayer(activeLesson.id);
                                                    }
                                                    else {
                                                        toast.error('Select a lesson to open in the player.');
                                                    }
                                                }, children: "Open in Course Player" }), _jsx(Button, { size: "sm", variant: "ghost", className: "w-full", onClick: () => navigate('/lms/courses'), children: "Back to courses" })] })] })] }), _jsxs("div", { className: "mt-10 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]", children: [_jsxs(Card, { tone: "muted", className: "space-y-3 p-4", children: [_jsx("h3", { className: "font-heading text-base font-semibold text-charcoal", children: "Lesson outline" }), _jsx("div", { className: "space-y-2", children: lessons.map((lesson, index) => {
                                            const percent = lessonProgress[lesson.id] ?? (completedLessons.has(lesson.id) ? 100 : 0);
                                            return (_jsx(LessonSidebarButton, { lesson: lesson, index: index, isActive: lesson.id === (currentLessonId ?? activeLesson?.id), progress: { percent, completed: percent >= 100 }, onSelect: (lessonId) => setCurrentLessonId(lessonId) }, lesson.id));
                                        }) })] }), _jsx(Card, { tone: "muted", className: "space-y-6 p-6", children: activeLesson ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx(Badge, { tone: "info", className: "bg-sunrise/10 text-sunrise", children: "Lesson" }), _jsx("h3", { className: "mt-2 font-heading text-2xl font-semibold text-charcoal", children: activeLesson.title }), _jsxs("p", { className: "text-sm text-slate/70", children: [activeLesson.duration || `${activeLesson.estimatedDuration ?? 0} min`, " \u2022", ' ', activeLesson.type?.toUpperCase()] })] }), _jsxs("span", { className: "rounded-full bg-white px-4 py-1 text-sm font-semibold text-slate/80", children: [lessonProgress[activeLesson.id] ?? (completedLessons.has(activeLesson.id) ? 100 : 0), "%"] })] }), _jsx("div", { className: "space-y-4 text-sm leading-relaxed text-slate/80", children: activeLesson.content?.textContent
                                                ? _jsx("p", { children: activeLesson.content.textContent })
                                                : _jsx("p", { children: "This lesson is best experienced in the full course player." }) }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { size: "sm", onClick: () => markLessonComplete(activeLesson.id), children: completedLessons.has(activeLesson.id) ? 'Completed' : 'Mark Complete' }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleOpenInPlayer(activeLesson.id), children: "Resume in Player" })] })] })) : (_jsx("div", { className: "text-center text-sm text-slate/70", children: _jsx("p", { children: "Select a lesson to view details." }) })) })] })] }) }) }));
};
export default LMSModule;
