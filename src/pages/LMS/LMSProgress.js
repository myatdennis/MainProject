import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Clock, Target, Award, Calendar, Play, } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse, parseDurationToMinutes } from '../../utils/courseNormalization';
import { loadStoredCourseProgress, syncCourseProgressWithRemote, } from '../../utils/courseProgress';
import { isEnabled as lmIsEnabled, fetchGoals, fetchAchievements, upsertGoals, upsertAchievements } from '../../dal/learnerMetrics';
import { useUserProfile } from '../../hooks/useUserProfile';
const buildLegacyLearnerId = () => {
    try {
        const raw = localStorage.getItem('huddle_user');
        if (!raw)
            return 'local-user';
        const parsed = JSON.parse(raw);
        return (parsed.email || parsed.id || 'local-user').toLowerCase();
    }
    catch (error) {
        console.warn('Failed to read learner identity (legacy fallback):', error);
        return 'local-user';
    }
};
const formatDate = (isoString) => {
    if (!isoString)
        return '';
    try {
        return new Date(isoString).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }
    catch {
        return isoString;
    }
};
const LMSProgress = () => {
    const navigate = useNavigate();
    const { user } = useUserProfile();
    const learnerId = useMemo(() => {
        if (user)
            return (user.email || user.id).toLowerCase();
        return buildLegacyLearnerId();
    }, [user]);
    const [progressData, setProgressData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState('month');
    const [activeTab, setActiveTab] = useState('overview');
    const loadProgressData = useCallback(async () => {
        setLoading(true);
        try {
            if (courseStore.getAllCourses().length === 0 && typeof courseStore.init === 'function') {
                await courseStore.init();
            }
            const normalizedCourses = courseStore
                .getAllCourses()
                .filter((course) => course.status === 'published')
                .map((course) => normalizeCourse(course));
            await Promise.all(normalizedCourses.map(async (course) => {
                const lessonIds = course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
                if (lessonIds.length === 0)
                    return null;
                return syncCourseProgressWithRemote({
                    courseSlug: course.slug,
                    courseId: course.id,
                    userId: learnerId,
                    lessonIds,
                });
            }));
            const aggregateMinutes = {
                total: 0,
                completed: 0,
            };
            const courseProgress = normalizedCourses.map((course) => {
                const lessons = course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson) ?? []) ?? [];
                const totalLessons = lessons.length;
                const stored = loadStoredCourseProgress(course.slug);
                const completedLessons = stored.completedLessonIds.length;
                const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
                const courseMinutes = lessons.reduce((sum, lesson) => {
                    const duration = lesson.estimatedDuration ??
                        parseDurationToMinutes(lesson.duration) ??
                        0;
                    return sum + duration;
                }, 0);
                aggregateMinutes.total += courseMinutes;
                aggregateMinutes.completed += courseMinutes * (progressPercent / 100);
                const nextLesson = lessons.find((lesson) => !stored.completedLessonIds.includes(lesson.id));
                const nextLessonPayload = nextLesson
                    ? {
                        id: nextLesson.id,
                        title: nextLesson.title,
                        duration: nextLesson.estimatedDuration ??
                            parseDurationToMinutes(nextLesson.duration) ??
                            0,
                    }
                    : undefined;
                const lastAccessed = stored.lastLessonId && lessons.some((lesson) => lesson.id === stored.lastLessonId)
                    ? formatDate(new Date().toISOString())
                    : '';
                return {
                    courseId: course.id,
                    title: course.title,
                    category: course.category || course.type || 'Learning Program',
                    progress: progressPercent,
                    totalLessons,
                    completedLessons,
                    lastAccessed,
                    estimatedCompletion: progressPercent >= 100 ? 'Completed' : 'In progress',
                    nextLesson: nextLessonPayload,
                };
            });
            const totalCourses = courseProgress.length;
            const completedCourses = courseProgress.filter((course) => course.progress >= 100).length;
            const inProgressCourses = courseProgress.filter((course) => course.progress > 0 && course.progress < 100).length;
            const overallProgress = {
                totalCourses,
                completedCourses,
                inProgressCourses,
                totalHours: Number((aggregateMinutes.total / 60).toFixed(1)),
                completedHours: Number((aggregateMinutes.completed / 60).toFixed(1)),
                certificatesEarned: completedCourses,
                currentStreak: completedCourses > 0 ? Math.max(3, completedCourses) : 0,
                longestStreak: completedCourses > 0 ? Math.max(5, completedCourses * 2) : 0,
            };
            const weeklyActivity = courseProgress.length > 0
                ? courseProgress.slice(0, 4).map((course, index) => ({
                    week: `Week ${index + 1}`,
                    hoursSpent: Number(((course.progress / 100) * 4).toFixed(1)),
                    lessonsCompleted: course.completedLessons,
                    coursesStarted: course.progress > 0 ? 1 : 0,
                }))
                : [
                    { week: 'Week 1', hoursSpent: 0, lessonsCompleted: 0, coursesStarted: 0 },
                    { week: 'Week 2', hoursSpent: 0, lessonsCompleted: 0, coursesStarted: 0 },
                ];
            const derivedGoals = courseProgress.length > 0
                ? courseProgress
                    .filter((course) => course.progress < 100)
                    .map((course) => ({
                    id: `goal-${course.courseId}`,
                    title: `Complete ${course.title}`,
                    description: `Finish the remaining lessons in ${course.title}.`,
                    targetDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split('T')[0],
                    progress: course.progress,
                    status: 'active',
                }))
                : [
                    {
                        id: 'goal-onboard',
                        title: 'Start your learning journey',
                        description: 'Pick a course that matches your current focus area.',
                        targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                            .toISOString()
                            .split('T')[0],
                        progress: 0,
                        status: 'active',
                    },
                ];
            const derivedAchievements = courseProgress.length > 0
                ? courseProgress
                    .filter((course) => course.progress >= 100)
                    .map((course, index) => ({
                    id: `ach-${course.courseId}`,
                    title: `${course.title} completed`,
                    description: `You successfully finished ${course.title}.`,
                    earnedDate: new Date(Date.now() - index * 24 * 60 * 60 * 1000)
                        .toISOString()
                        .split('T')[0],
                    icon: '🏆',
                    rarity: 'common',
                }))
                : [
                    {
                        id: 'ach-first-step',
                        title: 'First step taken',
                        description: 'Enrolled in your first course.',
                        earnedDate: new Date().toISOString().split('T')[0],
                        icon: '🚀',
                        rarity: 'common',
                    },
                ];
            let goalsToUse = derivedGoals;
            let achievementsToUse = derivedAchievements;
            if (lmIsEnabled()) {
                const [remoteGoals, remoteAchievements] = await Promise.all([
                    fetchGoals(learnerId),
                    fetchAchievements(learnerId),
                ]);
                if (remoteGoals.length > 0) {
                    goalsToUse = remoteGoals.map((goal) => ({
                        id: goal.id,
                        title: goal.title,
                        description: goal.description || '',
                        targetDate: goal.targetDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        progress: goal.progress ?? 0,
                        status: goal.status,
                    }));
                }
                else {
                    const persistableGoals = derivedGoals.map((goal) => ({
                        id: goal.id,
                        userId: learnerId,
                        title: goal.title,
                        description: goal.description,
                        targetDate: goal.targetDate,
                        progress: goal.progress,
                        status: goal.status,
                    }));
                    await upsertGoals(learnerId, persistableGoals);
                }
                if (remoteAchievements.length > 0) {
                    achievementsToUse = remoteAchievements.map((item) => ({
                        id: item.id,
                        title: item.title,
                        description: item.description || '',
                        earnedDate: item.earnedDate || new Date().toISOString().split('T')[0],
                        icon: item.icon || '🏆',
                        rarity: item.rarity,
                    }));
                }
                else {
                    const persistableAchievements = derivedAchievements.map((item) => ({
                        id: item.id,
                        userId: learnerId,
                        title: item.title,
                        description: item.description,
                        earnedDate: item.earnedDate,
                        icon: item.icon,
                        rarity: item.rarity,
                    }));
                    await upsertAchievements(learnerId, persistableAchievements);
                }
            }
            setProgressData({
                overallProgress,
                courseProgress,
                weeklyActivity,
                goals: goalsToUse,
                achievements: achievementsToUse,
            });
        }
        catch (error) {
            console.error('Failed to load progress data:', error);
            setProgressData(null);
        }
        finally {
            setLoading(false);
        }
    }, [learnerId, selectedPeriod]);
    useEffect(() => {
        void loadProgressData();
    }, [loadProgressData]);
    if (loading) {
        return (_jsxs("div", { className: "py-24 flex flex-col items-center gap-3", children: [_jsx(LoadingSpinner, { size: "lg" }), _jsx("p", { className: "text-sm text-slate/80", children: "Collecting your progress\u2026" })] }));
    }
    if (!progressData) {
        return (_jsx("div", { className: "py-16", children: _jsxs(Card, { tone: "muted", className: "mx-auto max-w-2xl text-center space-y-4", children: [_jsx("h2", { className: "font-heading text-2xl font-bold text-charcoal", children: "No progress yet" }), _jsx("p", { className: "text-sm text-slate/80", children: "Start a course to see your personalized progress analytics and insights." }), _jsx(Button, { size: "sm", onClick: () => navigate('/lms/courses'), children: "Browse courses" })] }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(SEO, { title: "Progress Dashboard", description: "Track your learning progress across all courses." }), _jsx("div", { className: "min-h-screen bg-softwhite", children: _jsxs("div", { className: "container-page section", children: [_jsx(Breadcrumbs, { items: [{ label: 'Dashboard', to: '/lms/dashboard' }, { label: 'Progress', to: '/lms/progress' }] }), _jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]", children: [_jsxs(Card, { tone: "gradient", withBorder: false, className: "overflow-hidden", children: [_jsxs("div", { className: "relative z-10 flex flex-col gap-4 text-charcoal", children: [_jsx(Badge, { tone: "info", className: "w-max bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-skyblue", children: "Learning Progress" }), _jsx("h1", { className: "font-heading text-3xl font-bold md:text-4xl", children: "Your learning snapshot" }), _jsx("p", { className: "max-w-2xl text-sm text-slate/80", children: "Monitor completions, streaks, and milestones as you advance through The Huddle Co. programs." }), _jsxs("div", { className: "grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]", children: [_jsxs("div", { className: "relative flex items-center", children: [_jsx(Clock, { className: "pointer-events-none absolute left-4 h-5 w-5 text-slate/60" }), _jsxs("select", { value: selectedPeriod, onChange: (event) => setSelectedPeriod(event.target.value), className: "w-full rounded-full border-none bg-white/90 pl-12 pr-6 text-sm shadow-card-sm", "aria-label": "Select reporting period", children: [_jsx("option", { value: "week", children: "This week" }), _jsx("option", { value: "month", children: "This month" }), _jsx("option", { value: "year", children: "This year" })] })] }), _jsx("div", { className: "hidden items-center gap-2 rounded-full bg-white/80 p-1 text-xs font-semibold uppercase tracking-wide text-slate/70 md:flex", children: ['overview', 'courses', 'goals', 'achievements'].map((tab) => (_jsx("button", { type: "button", onClick: () => setActiveTab(tab), className: `rounded-full px-4 py-2 transition ${activeTab === tab ? 'bg-skyblue text-white shadow-card-sm' : 'text-slate/80 hover:text-charcoal'}`, children: tab }, tab))) })] }), _jsxs("div", { className: "flex flex-wrap gap-4 pt-2 text-sm text-slate/80", children: [_jsxs("span", { className: "inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-card-sm", children: [_jsx(BarChart3, { className: "h-4 w-4 text-sunrise" }), progressData.overallProgress.completedCourses, " / ", progressData.overallProgress.totalCourses, " courses completed"] }), _jsxs("span", { className: "inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-card-sm", children: [_jsx(TrendingUp, { className: "h-4 w-4 text-forest" }), progressData.overallProgress.completedHours, " hrs learned"] })] })] }), _jsx("div", { className: "pointer-events-none absolute inset-y-0 right-0 hidden w-72 translate-x-12 rounded-full bg-gradient-to-br from-sunrise/25 via-skyblue/18 to-forest/18 blur-3xl md:block" })] }), _jsxs(Card, { tone: "muted", padding: "lg", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Summary" }), _jsx("p", { className: "mt-1 text-sm text-slate/80", children: "Where you\u2019re making progress right now." })] }), _jsx(Button, { variant: "ghost", size: "sm", leadingIcon: _jsx(Calendar, { className: "h-4 w-4" }), onClick: () => navigate('/lms/courses'), children: "Plan next course" })] }), _jsxs("div", { className: "mt-6 grid gap-3 text-sm font-semibold text-slate/80", children: [_jsxs("div", { className: "rounded-xl border border-mist bg-white px-4 py-3", children: [_jsx("p", { children: "Total courses" }), _jsx("p", { className: "text-2xl font-heading text-charcoal", children: progressData.overallProgress.totalCourses })] }), _jsxs("div", { className: "rounded-xl border border-mist bg-white px-4 py-3", children: [_jsx("p", { children: "Certificates earned" }), _jsx("p", { className: "text-2xl font-heading text-charcoal", children: progressData.overallProgress.certificatesEarned })] }), _jsxs("div", { className: "rounded-xl border border-mist bg-white px-4 py-3", children: [_jsx("p", { children: "Current streak" }), _jsxs("p", { className: "text-2xl font-heading text-charcoal", children: [progressData.overallProgress.currentStreak, " days"] })] })] })] })] }), _jsxs("section", { className: "mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4", children: [_jsx(OverviewStat, { icon: _jsx(BarChart3, { className: "h-5 w-5 text-skyblue" }), label: "Courses in progress", value: progressData.overallProgress.inProgressCourses, subtext: "Keep up the momentum" }), _jsx(OverviewStat, { icon: _jsx(Clock, { className: "h-5 w-5 text-sunrise" }), label: "Hours spent learning", value: `${progressData.overallProgress.completedHours} / ${progressData.overallProgress.totalHours}`, subtext: "Completed / Total hours" }), _jsx(OverviewStat, { icon: _jsx(Target, { className: "h-5 w-5 text-forest" }), label: "Active goals", value: progressData.goals.filter((goal) => goal.status === 'active').length, subtext: "Goals currently in progress" }), _jsx(OverviewStat, { icon: _jsx(Award, { className: "h-5 w-5 text-deepred" }), label: "Achievements unlocked", value: progressData.achievements.length, subtext: "Milestones completed" })] }), _jsxs("section", { className: "mt-10 grid gap-8 lg:grid-cols-[2fr,1fr]", children: [_jsxs(Card, { tone: "muted", className: "space-y-6 p-6", children: [_jsxs("header", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-xl font-semibold text-charcoal", children: "Course progress" }), _jsx("p", { className: "text-sm text-slate/70", children: "Continue where you left off across your enrolled programs." })] }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(Play, { className: "h-4 w-4" }), onClick: () => navigate('/lms/courses'), children: "Browse catalog" })] }), _jsx("div", { className: "space-y-4", children: progressData.courseProgress.map((course) => (_jsxs("div", { className: "rounded-xl border border-mist bg-white p-4 shadow-card-sm", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-heading text-lg font-semibold text-charcoal", children: course.title }), _jsx("p", { className: "text-xs uppercase tracking-wide text-slate/60", children: course.category })] }), _jsx(Badge, { tone: course.progress >= 100 ? 'positive' : 'info', children: course.progress >= 100 ? 'Completed' : `${course.progress}% complete` })] }), _jsx(ProgressBar, { className: "mt-3", value: course.progress, srLabel: `${course.title} completion` }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-4 text-xs text-slate/70", children: [_jsxs("span", { children: [course.completedLessons, "/", course.totalLessons, " lessons completed"] }), _jsxs("span", { children: ["Last accessed: ", course.lastAccessed || 'Recently'] }), _jsxs("span", { children: ["Status: ", course.estimatedCompletion] })] }), course.nextLesson && (_jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-mist/40 px-4 py-3 text-sm text-slate/80", children: [_jsx("span", { className: "font-semibold text-charcoal", children: "Next lesson:" }), _jsx("span", { children: course.nextLesson.title }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: [course.nextLesson.duration, " min"] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => navigate(`/lms/course/${course.courseId}/lesson/${course.nextLesson?.id}`), children: "Resume" })] }))] }, course.courseId))) })] }), _jsxs(Card, { tone: "muted", className: "space-y-6 p-6", children: [_jsx("div", { className: "flex items-start justify-between gap-3", children: _jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Weekly activity" }), _jsx("p", { className: "text-sm text-slate/70", children: "Recent engagement highlights" })] }) }), _jsx("div", { className: "space-y-3", children: progressData.weeklyActivity.map((week) => (_jsxs("div", { className: "rounded-xl border border-mist bg-white p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate/60", children: week.week }), _jsxs("p", { className: "mt-1 text-sm text-charcoal", children: [week.hoursSpent, " hrs \u00B7 ", week.lessonsCompleted, " lessons \u00B7 ", week.coursesStarted, " courses"] })] }, week.week))) })] })] }), _jsxs("section", { className: "mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]", children: [_jsxs(Card, { tone: "muted", className: "space-y-6 p-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Learning goals" }), _jsx("p", { className: "text-sm text-slate/70", children: "Targets to keep you on track" })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/lms/courses'), children: "Add goal" })] }), _jsx("div", { className: "space-y-3", children: progressData.goals.map((goal) => (_jsxs("div", { className: "rounded-xl border border-mist bg-white p-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-heading text-base font-semibold text-charcoal", children: goal.title }), _jsxs("p", { className: "text-xs text-slate/60", children: ["Target: ", formatDate(goal.targetDate)] })] }), _jsx(Badge, { tone: goal.progress >= 100 ? 'positive' : goal.status === 'overdue' ? 'danger' : 'info', children: goal.status === 'completed' ? 'Completed' : `${goal.progress}%` })] }), _jsx("p", { className: "mt-2 text-sm text-slate/80", children: goal.description }), _jsx(ProgressBar, { className: "mt-3", value: goal.progress, srLabel: `${goal.title} progress` })] }, goal.id))) })] }), _jsxs(Card, { tone: "muted", className: "space-y-6 p-6", children: [_jsx("div", { className: "flex items-start justify-between gap-3", children: _jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Achievements" }), _jsx("p", { className: "text-sm text-slate/70", children: "Milestones you\u2019ve unlocked" })] }) }), _jsx("div", { className: "space-y-3", children: progressData.achievements.map((achievement) => (_jsxs("div", { className: "flex items-start gap-3 rounded-xl border border-mist bg-white p-4", children: [_jsx("div", { className: "text-2xl", children: achievement.icon }), _jsxs("div", { children: [_jsx("p", { className: "font-heading text-base font-semibold text-charcoal", children: achievement.title }), _jsxs("p", { className: "text-xs uppercase tracking-wide text-slate/60", children: [achievement.rarity, " \u00B7 ", formatDate(achievement.earnedDate)] }), _jsx("p", { className: "mt-1 text-sm text-slate/80", children: achievement.description })] })] }, achievement.id))) })] })] })] }) })] }));
};
const OverviewStat = ({ icon, label, value, subtext }) => (_jsxs(Card, { tone: "muted", className: "flex items-center gap-4 p-5", children: [_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-card-sm", children: icon }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate/70", children: label }), _jsx("p", { className: "text-lg font-heading text-charcoal", children: value }), _jsx("p", { className: "text-xs text-slate/50", children: subtext })] })] }));
export default LMSProgress;
