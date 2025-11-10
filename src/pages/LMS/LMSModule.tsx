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
import { normalizeCourse, type NormalizedCourse, type NormalizedLesson } from '../../utils/courseNormalization';
import {
  loadStoredCourseProgress,
  saveStoredCourseProgress,
  syncCourseProgressWithRemote,
  type StoredCourseProgress,
} from '../../utils/courseProgress';

type LessonProgressState = {
  percent: number;
  completed: boolean;
};

type LessonSidebarProps = {
  lesson: NormalizedLesson;
  index: number;
  progress: LessonProgressState;
  isActive: boolean;
  onSelect: (lessonId: string) => void;
};

const LessonSidebarButton = memo(({ lesson, index, progress, isActive, onSelect }: LessonSidebarProps) => {
  const statusStyles = isActive
    ? 'bg-skyblue/10 border border-skyblue text-skyblue'
    : progress.completed
      ? 'bg-forest/10 border border-forest text-forest'
      : 'bg-white border border-mist text-charcoal hover:bg-mist/40';

  return (
    <button
      type="button"
      className={`w-full text-left rounded-xl px-4 py-3 transition ${statusStyles}`}
      onClick={() => onSelect(lesson.id)}
      aria-label={`Open lesson ${lesson.title}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-tight">{lesson.title}</p>
          <p className="text-xs text-slate/70 mt-0.5">
            Lesson {index + 1} &middot; {lesson.duration || `${lesson.estimatedDuration ?? 0} min`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate/80">
            {progress.completed ? 'Completed' : `${progress.percent}%`}
          </span>
        </div>
      </div>
    </button>
  );
});

const buildLegacyLearnerId = () => {
  try {
    const raw = localStorage.getItem('huddle_user');
    if (!raw) return 'local-user';
    const parsed = JSON.parse(raw);
    return (parsed.email || parsed.id || 'local-user').toLowerCase();
  } catch (error) {
    console.warn('Failed to parse learner identity (legacy fallback):', error);
    return 'local-user';
  }
};

const deriveModuleContext = (moduleId: string | undefined): {
  course: NormalizedCourse;
  module: NonNullable<NormalizedCourse['modules'][number]>;
} | null => {
  if (!moduleId) return null;
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
  const [error, setError] = useState<string | null>(null);
  const [courseContext, setCourseContext] = useState<{
    course: NormalizedCourse;
    module: NonNullable<NormalizedCourse['modules'][number]>;
    lessons: NormalizedLesson[];
  } | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [lessonProgress, setLessonProgress] = useState<Record<string, number>>({});
  const [lessonPositions, setLessonPositions] = useState<Record<string, number>>({});

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

        const lessons = (context.module.lessons ?? []) as unknown as NormalizedLesson[];
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

        const resolvedLesson =
          (storedProgress.lastLessonId && lessons.some((lesson) => lesson.id === storedProgress.lastLessonId)
            ? storedProgress.lastLessonId
            : lessons[0]?.id) ?? null;
        setCurrentLessonId(resolvedLesson);
      } catch (err) {
        console.error('Failed to load module data:', err);
        setError('We couldn’t load the module right now. Please refresh or try again later.');
        setCourseContext(null);
      } finally {
        setIsLoading(false);
      }
    };
    void loadModule();
  }, [moduleId, learnerId]);

  const persistProgress = useCallback(
    (lastLessonId?: string) => {
      if (!courseContext) return;
      const payload: StoredCourseProgress = {
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
    },
    [courseContext, completedLessons, lessonProgress, lessonPositions, learnerId, currentLessonId]
  );

  useEffect(() => {
    persistProgress();
  }, [persistProgress]);

  const updateLessonProgress = useCallback(
    (lessonId: string, percent: number) => {
      setLessonProgress((prev) => {
        const next = { ...prev, [lessonId]: Math.min(100, Math.max(percent, prev[lessonId] ?? 0)) };
        return next;
      });
    },
    []
  );

  const markLessonComplete = useCallback(
    (lessonId: string) => {
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
    },
    [courseContext?.lessons, persistProgress, updateLessonProgress]
  );

  const handleOpenInPlayer = useCallback(
    (lessonId: string) => {
      if (!courseContext) return;
      navigate(`/lms/course/${courseContext.course.slug}/lesson/${lessonId}`);
    },
    [courseContext, navigate]
  );

  if (isLoading) {
    return (
      <div className="py-24">
  <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !courseContext) {
    return (
      <div className="py-16">
        <Card tone="muted" className="mx-auto max-w-xl space-y-4 text-center">
          <h2 className="font-heading text-xl font-semibold text-charcoal">Module unavailable</h2>
          <p className="text-sm text-slate/80">{error ?? 'We couldn’t load this module right now.'}</p>
          <Button size="sm" onClick={() => navigate('/lms/courses')}>
            Back to courses
          </Button>
        </Card>
      </div>
    );
  }

  const { course, module, lessons } = courseContext;
  const activeLesson = lessons.find((lesson) => lesson.id === currentLessonId) ?? lessons[0];
  const overallPercent =
    lessons.length > 0 ? Math.round((Array.from(completedLessons).length / lessons.length) * 100) : 0;

  return (
    <ClientErrorBoundary>
      <div className="min-h-screen bg-softwhite">
        <div className="container-page section">
          <Breadcrumbs items={[{ label: 'Courses', to: '/lms/courses' }, { label: 'Module' }]} />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex-1 space-y-4">
              <Badge tone="info" className="bg-skyblue/10 text-skyblue">
                Module
              </Badge>
              <h1 className="font-heading text-3xl font-bold text-charcoal">{module.title}</h1>
              <p className="max-w-2xl text-sm text-slate/80">{module.description || course.description}</p>
              <div className="flex flex-wrap gap-4 text-xs text-slate/70">
                <span className="rounded-full bg-white px-4 py-2 shadow-card-sm">
                  {lessons.length} lessons
                </span>
                <span className="rounded-full bg-white px-4 py-2 shadow-card-sm">
                  {module.duration || course.duration}
                </span>
                <span className="rounded-full bg-forest/10 px-4 py-2 text-forest shadow-card-sm">
                  {overallPercent}% complete
                </span>
              </div>
              <ProgressBar value={overallPercent} srLabel="Overall module progress" />
            </div>
            <Card tone="muted" padding="lg" className="w-full max-w-xs self-stretch">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Quick actions</h2>
              <div className="mt-4 space-y-3">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (activeLesson) {
                      handleOpenInPlayer(activeLesson.id);
                    } else {
                      toast.error('Select a lesson to open in the player.');
                    }
                  }}
                >
                  Open in Course Player
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate('/lms/courses')}
                >
                  Back to courses
                </Button>
              </div>
            </Card>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card tone="muted" className="space-y-3 p-4">
              <h3 className="font-heading text-base font-semibold text-charcoal">Lesson outline</h3>
              <div className="space-y-2">
                {lessons.map((lesson, index) => {
                  const percent = lessonProgress[lesson.id] ?? (completedLessons.has(lesson.id) ? 100 : 0);
                  return (
                    <LessonSidebarButton
                      key={lesson.id}
                      lesson={lesson}
                      index={index}
                      isActive={lesson.id === (currentLessonId ?? activeLesson?.id)}
                      progress={{ percent, completed: percent >= 100 }}
                      onSelect={(lessonId) => setCurrentLessonId(lessonId)}
                    />
                  );
                })}
              </div>
            </Card>

            <Card tone="muted" className="space-y-6 p-6">
              {activeLesson ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Badge tone="info" className="bg-sunrise/10 text-sunrise">
                        Lesson
                      </Badge>
                      <h3 className="mt-2 font-heading text-2xl font-semibold text-charcoal">{activeLesson.title}</h3>
                      <p className="text-sm text-slate/70">
                        {activeLesson.duration || `${activeLesson.estimatedDuration ?? 0} min`} •{' '}
                        {activeLesson.type?.toUpperCase()}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-4 py-1 text-sm font-semibold text-slate/80">
                      {lessonProgress[activeLesson.id] ?? (completedLessons.has(activeLesson.id) ? 100 : 0)}%
                    </span>
                  </div>

                  <div className="space-y-4 text-sm leading-relaxed text-slate/80">
                    {activeLesson.content?.textContent
                      ? <p>{activeLesson.content.textContent}</p>
                      : <p>This lesson is best experienced in the full course player.</p>}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button size="sm" onClick={() => markLessonComplete(activeLesson.id)}>
                      {completedLessons.has(activeLesson.id) ? 'Completed' : 'Mark Complete'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenInPlayer(activeLesson.id)}
                    >
                      Resume in Player
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-slate/70">
                  <p>Select a lesson to view details.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </ClientErrorBoundary>
  );
};

export default LMSModule;
