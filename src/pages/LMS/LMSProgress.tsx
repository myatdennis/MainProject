import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  Award,
  Calendar,
  ArrowLeft,
  Play,
} from 'lucide-react';

import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse, parseDurationToMinutes } from '../../utils/courseNormalization';
import {
  loadStoredCourseProgress,
  syncCourseProgressWithRemote,
} from '../../utils/courseProgress';
import learnerMetricsService from '../../services/learnerMetricsService';

interface ProgressData {
  overallProgress: {
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    totalHours: number;
    completedHours: number;
    certificatesEarned: number;
    currentStreak: number;
    longestStreak: number;
  };
  courseProgress: CourseProgress[];
  weeklyActivity: WeeklyActivity[];
  goals: LearningGoal[];
  achievements: Achievement[];
}

interface CourseProgress {
  courseId: string;
  title: string;
  category: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  lastAccessed: string;
  estimatedCompletion: string;
  nextLesson?: {
    id: string;
    title: string;
    duration: number;
  };
}

interface WeeklyActivity {
  week: string;
  hoursSpent: number;
  lessonsCompleted: number;
  coursesStarted: number;
}

interface LearningGoal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  status: 'active' | 'completed' | 'overdue';
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  earnedDate: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const buildLearnerId = () => {
  try {
    const raw = localStorage.getItem('huddle_user');
    if (!raw) return 'local-user';
    const parsed = JSON.parse(raw);
    return (parsed.email || parsed.id || 'local-user').toLowerCase();
  } catch (error) {
    console.warn('Failed to read learner identity:', error);
    return 'local-user';
  }
};

const formatDate = (isoString: string) => {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
};

const LMSProgress: React.FC = () => {
  const navigate = useNavigate();
  const learnerId = useMemo(() => buildLearnerId(), []);

  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'goals' | 'achievements'>('overview');

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

      await Promise.all(
        normalizedCourses.map(async (course) => {
          const lessonIds =
            course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
          if (lessonIds.length === 0) return null;
          return syncCourseProgressWithRemote({
            courseSlug: course.slug,
            courseId: course.id,
            userId: learnerId,
            lessonIds,
          });
        })
      );

      const aggregateMinutes = {
        total: 0,
        completed: 0,
      };

      const courseProgress: CourseProgress[] = normalizedCourses.map((course) => {
        const lessons =
          course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson) ?? []) ?? [];
        const totalLessons = lessons.length;
        const stored = loadStoredCourseProgress(course.slug);
        const completedLessons = stored.completedLessonIds.length;
        const progressPercent =
          totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        const courseMinutes = lessons.reduce((sum, lesson) => {
          const duration =
            lesson.estimatedDuration ??
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
              duration:
                nextLesson.estimatedDuration ??
                parseDurationToMinutes(nextLesson.duration) ??
                0,
            }
          : undefined;

        const lastAccessed =
          stored.lastLessonId && lessons.some((lesson) => lesson.id === stored.lastLessonId)
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
      const inProgressCourses = courseProgress.filter(
        (course) => course.progress > 0 && course.progress < 100
      ).length;

      const overallProgress: ProgressData['overallProgress'] = {
        totalCourses,
        completedCourses,
        inProgressCourses,
        totalHours: Number((aggregateMinutes.total / 60).toFixed(1)),
        completedHours: Number((aggregateMinutes.completed / 60).toFixed(1)),
        certificatesEarned: completedCourses,
        currentStreak: completedCourses > 0 ? Math.max(3, completedCourses) : 0,
        longestStreak: completedCourses > 0 ? Math.max(5, completedCourses * 2) : 0,
      };

      const weeklyActivity: WeeklyActivity[] =
        courseProgress.length > 0
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

      const derivedGoals: LearningGoal[] =
        courseProgress.length > 0
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

      const derivedAchievements: Achievement[] =
        courseProgress.length > 0
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

      if (learnerMetricsService.isEnabled()) {
        const [remoteGoals, remoteAchievements] = await Promise.all([
          learnerMetricsService.fetchGoals(learnerId),
          learnerMetricsService.fetchAchievements(learnerId),
        ]);

        if (remoteGoals.length > 0) {
          goalsToUse = remoteGoals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            description: goal.description,
            targetDate: goal.targetDate,
            progress: goal.progress,
            status: goal.status,
          }));
        } else {
          const persistableGoals = derivedGoals.map((goal) => ({
            id: goal.id,
            userId: learnerId,
            title: goal.title,
            description: goal.description,
            targetDate: goal.targetDate,
            progress: goal.progress,
            status: goal.status,
          }));
          await learnerMetricsService.upsertGoals(learnerId, persistableGoals);
        }

        if (remoteAchievements.length > 0) {
          achievementsToUse = remoteAchievements.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            earnedDate: item.earnedDate,
            icon: item.icon,
            rarity: item.rarity,
          }));
        } else {
          const persistableAchievements = derivedAchievements.map((item) => ({
            id: item.id,
            userId: learnerId,
            title: item.title,
            description: item.description,
            earnedDate: item.earnedDate,
            icon: item.icon,
            rarity: item.rarity,
          }));
          await learnerMetricsService.upsertAchievements(learnerId, persistableAchievements);
        }
      }

      setProgressData({
        overallProgress,
        courseProgress,
        weeklyActivity,
        goals: goalsToUse,
        achievements: achievementsToUse,
      });
    } catch (error) {
      console.error('Failed to load progress data:', error);
      setProgressData(null);
    } finally {
      setLoading(false);
    }
  }, [learnerId, selectedPeriod]);

  useEffect(() => {
    void loadProgressData();
  }, [loadProgressData]);

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" text="Collecting your progress..." />
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className="py-16">
        <Card tone="muted" className="mx-auto max-w-2xl text-center space-y-4">
          <h2 className="font-heading text-2xl font-bold text-charcoal">No progress yet</h2>
          <p className="text-sm text-slate/80">
            Start a course to see your personalized progress analytics and insights.
          </p>
          <Button size="sm" onClick={() => navigate('/lms/courses')}>
            Browse courses
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO title="Progress Dashboard" description="Track your learning progress across all courses." />
      <div className="min-h-screen bg-softwhite">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-12">
          <div className="flex items-center gap-3 text-sm text-slate/70">
            <button
              type="button"
              onClick={() => navigate('/lms/dashboard')}
              className="inline-flex items-center gap-2 rounded-full border border-mist px-4 py-2 text-slate/80 transition hover:text-charcoal"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </button>
            <span>/</span>
            <span>Progress</span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
            <Card tone="gradient" withBorder={false} className="overflow-hidden">
              <div className="relative z-10 flex flex-col gap-4 text-charcoal">
                <Badge tone="info" className="w-max bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-skyblue">
                  Learning Progress
                </Badge>
                <h1 className="font-heading text-3xl font-bold md:text-4xl">
                  Your learning snapshot
                </h1>
                <p className="max-w-2xl text-sm text-slate/80">
                  Monitor completions, streaks, and milestones as you advance through The Huddle Co. programs.
                </p>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative flex items-center">
                    <Clock className="pointer-events-none absolute left-4 h-5 w-5 text-slate/60" />
                    <select
                      value={selectedPeriod}
                      onChange={(event) => setSelectedPeriod(event.target.value as typeof selectedPeriod)}
                      className="w-full rounded-full border-none bg-white/90 pl-12 pr-6 text-sm shadow-card-sm"
                      aria-label="Select reporting period"
                    >
                      <option value="week">This week</option>
                      <option value="month">This month</option>
                      <option value="year">This year</option>
                    </select>
                  </div>
                  <div className="hidden items-center gap-2 rounded-full bg-white/80 p-1 text-xs font-semibold uppercase tracking-wide text-slate/70 md:flex">
                    {(['overview', 'courses', 'goals', 'achievements'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-full px-4 py-2 transition ${
                          activeTab === tab ? 'bg-skyblue text-white shadow-card-sm' : 'text-slate/80 hover:text-charcoal'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2 text-sm text-slate/80">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-card-sm">
                    <BarChart3 className="h-4 w-4 text-sunrise" />
                    {progressData.overallProgress.completedCourses} / {progressData.overallProgress.totalCourses} courses completed
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-card-sm">
                    <TrendingUp className="h-4 w-4 text-forest" />
                    {progressData.overallProgress.completedHours} hrs learned
                  </span>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-72 translate-x-12 rounded-full bg-gradient-to-br from-sunrise/25 via-skyblue/18 to-forest/18 blur-3xl md:block" />
            </Card>

            <Card tone="muted" padding="lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-charcoal">Summary</h2>
                  <p className="mt-1 text-sm text-slate/80">Where you’re making progress right now.</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Calendar className="h-4 w-4" />}
                  onClick={() => navigate('/lms/courses')}
                >
                  Plan next course
                </Button>
              </div>

              <div className="mt-6 grid gap-3 text-sm font-semibold text-slate/80">
                <div className="rounded-xl border border-mist bg-white px-4 py-3">
                  <p>Total courses</p>
                  <p className="text-2xl font-heading text-charcoal">
                    {progressData.overallProgress.totalCourses}
                  </p>
                </div>
                <div className="rounded-xl border border-mist bg-white px-4 py-3">
                  <p>Certificates earned</p>
                  <p className="text-2xl font-heading text-charcoal">
                    {progressData.overallProgress.certificatesEarned}
                  </p>
                </div>
                <div className="rounded-xl border border-mist bg-white px-4 py-3">
                  <p>Current streak</p>
                  <p className="text-2xl font-heading text-charcoal">
                    {progressData.overallProgress.currentStreak} days
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <section className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <OverviewStat
              icon={<BarChart3 className="h-5 w-5 text-skyblue" />}
              label="Courses in progress"
              value={progressData.overallProgress.inProgressCourses}
              subtext="Keep up the momentum"
            />
            <OverviewStat
              icon={<Clock className="h-5 w-5 text-sunrise" />}
              label="Hours spent learning"
              value={`${progressData.overallProgress.completedHours} / ${progressData.overallProgress.totalHours}`}
              subtext="Completed / Total hours"
            />
            <OverviewStat
              icon={<Target className="h-5 w-5 text-forest" />}
              label="Active goals"
              value={progressData.goals.filter((goal) => goal.status === 'active').length}
              subtext="Goals currently in progress"
            />
            <OverviewStat
              icon={<Award className="h-5 w-5 text-deepred" />}
              label="Achievements unlocked"
              value={progressData.achievements.length}
              subtext="Milestones completed"
            />
          </section>

          <section className="mt-10 grid gap-8 lg:grid-cols-[2fr,1fr]">
            <Card tone="muted" className="space-y-6 p-6">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-xl font-semibold text-charcoal">Course progress</h2>
                  <p className="text-sm text-slate/70">
                    Continue where you left off across your enrolled programs.
                  </p>
                </div>
                <Button variant="ghost" size="sm" trailingIcon={<Play className="h-4 w-4" />} onClick={() => navigate('/lms/courses')}>
                  Browse catalog
                </Button>
              </header>

              <div className="space-y-4">
                {progressData.courseProgress.map((course) => (
                  <div key={course.courseId} className="rounded-xl border border-mist bg-white p-4 shadow-card-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="font-heading text-lg font-semibold text-charcoal">{course.title}</h3>
                        <p className="text-xs uppercase tracking-wide text-slate/60">{course.category}</p>
                      </div>
                      <Badge tone={course.progress >= 100 ? 'success' : 'info'}>
                        {course.progress >= 100 ? 'Completed' : `${course.progress}% complete`}
                      </Badge>
                    </div>
                    <ProgressBar className="mt-3" value={course.progress} srLabel={`${course.title} completion`} />
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate/70">
                      <span>{course.completedLessons}/{course.totalLessons} lessons completed</span>
                      <span>Last accessed: {course.lastAccessed || 'Recently'}</span>
                      <span>Status: {course.estimatedCompletion}</span>
                    </div>
                    {course.nextLesson && (
                      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-mist/40 px-4 py-3 text-sm text-slate/80">
                        <span className="font-semibold text-charcoal">Next lesson:</span>
                        <span>{course.nextLesson.title}</span>
                        <span>·</span>
                        <span>{course.nextLesson.duration} min</span>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => navigate(`/lms/course/${course.courseId}/lesson/${course.nextLesson?.id}`)}
                        >
                          Resume
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card tone="muted" className="space-y-6 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-charcoal">Weekly activity</h2>
                  <p className="text-sm text-slate/70">Recent engagement highlights</p>
                </div>
              </div>

              <div className="space-y-3">
                {progressData.weeklyActivity.map((week) => (
                  <div key={week.week} className="rounded-xl border border-mist bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate/60">{week.week}</p>
                    <p className="mt-1 text-sm text-charcoal">
                      {week.hoursSpent} hrs · {week.lessonsCompleted} lessons · {week.coursesStarted} courses
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card tone="muted" className="space-y-6 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-charcoal">Learning goals</h2>
                  <p className="text-sm text-slate/70">Targets to keep you on track</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/lms/courses')}>
                  Add goal
                </Button>
              </div>

              <div className="space-y-3">
                {progressData.goals.map((goal) => (
                  <div key={goal.id} className="rounded-xl border border-mist bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-heading text-base font-semibold text-charcoal">{goal.title}</p>
                        <p className="text-xs text-slate/60">Target: {formatDate(goal.targetDate)}</p>
                      </div>
                      <Badge tone={goal.progress >= 100 ? 'success' : goal.status === 'overdue' ? 'danger' : 'info'}>
                        {goal.status === 'completed' ? 'Completed' : `${goal.progress}%`}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate/80">{goal.description}</p>
                    <ProgressBar className="mt-3" value={goal.progress} srLabel={`${goal.title} progress`} />
                  </div>
                ))}
              </div>
            </Card>

            <Card tone="muted" className="space-y-6 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-charcoal">Achievements</h2>
                  <p className="text-sm text-slate/70">Milestones you’ve unlocked</p>
                </div>
              </div>

              <div className="space-y-3">
                {progressData.achievements.map((achievement) => (
                  <div key={achievement.id} className="flex items-start gap-3 rounded-xl border border-mist bg-white p-4">
                    <div className="text-2xl">{achievement.icon}</div>
                    <div>
                      <p className="font-heading text-base font-semibold text-charcoal">{achievement.title}</p>
                      <p className="text-xs uppercase tracking-wide text-slate/60">
                        {achievement.rarity} · {formatDate(achievement.earnedDate)}
                      </p>
                      <p className="mt-1 text-sm text-slate/80">{achievement.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </>
  );
};

const OverviewStat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
}> = ({ icon, label, value, subtext }) => (
  <Card tone="muted" className="flex items-center gap-4 p-5">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-card-sm">
      {icon}
    </div>
    <div>
      <p className="text-sm font-semibold text-slate/70">{label}</p>
      <p className="text-lg font-heading text-charcoal">{value}</p>
      <p className="text-xs text-slate/50">{subtext}</p>
    </div>
  </Card>
);

export default LMSProgress;
