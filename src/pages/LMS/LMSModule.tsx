import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import EnhancedVideoPlayer from '../../components/EnhancedVideoPlayer';
import CourseProgressSidebar from '../../components/CourseProgressSidebar';
import FloatingProgressBar from '../../components/FloatingProgressBar';

const supportedSidebarLessonTypes = ['video', 'interactive', 'quiz', 'resource', 'text'] as const;
type SidebarLessonType = (typeof supportedSidebarLessonTypes)[number];

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
  const params = useParams();
  const moduleIdentifier = params.moduleId ?? params.courseId ?? null;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUserProfile();
  const learnerId = useMemo(() => (user ? (user.email || user.id).toLowerCase() : buildLegacyLearnerId()), [user]);
  const requestedLessonId = searchParams.get('lesson');

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [completionRedirected, setCompletionRedirected] = useState(false);
  useEffect(() => {
    const storageKey = `lms:sidebar-collapsed:${learnerId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setSidebarCollapsed(stored === 'true');
      }
    } catch (error) {
      console.warn('Failed to load sidebar preference:', error);
    }
  }, [learnerId]);

  const handleSidebarCollapsedChange = useCallback(
    (nextValue: boolean) => {
      setSidebarCollapsed(nextValue);
      const storageKey = `lms:sidebar-collapsed:${learnerId}`;
      try {
        localStorage.setItem(storageKey, String(nextValue));
      } catch (error) {
        console.warn('Failed to persist sidebar preference:', error);
      }
    },
    [learnerId]
  );

  const lessonSequence = useMemo(() => {
    if (!courseContext?.course?.modules) return [];
    return courseContext.course.modules.flatMap((courseModule) => {
      const moduleLessons = (courseModule.lessons ?? []) as NormalizedLesson[];
      return moduleLessons.map((lesson) => ({
        moduleId: courseModule.id,
        moduleTitle: courseModule.title,
        lesson,
      }));
    });
  }, [courseContext]);

  const sidebarLessonProgress = useMemo(() => {
    if (!courseContext?.course?.modules) return {};
    const progressMap: Record<
      string,
      {
        lessonId: string;
        completed: boolean;
        progressPercentage: number;
        timeSpent?: number;
      }
    > = {};

    courseContext.course.modules.forEach((courseModule) => {
      const moduleLessons = (courseModule.lessons ?? []) as NormalizedLesson[];
      moduleLessons.forEach((lesson) => {
        const percent = lessonProgress[lesson.id] ?? (completedLessons.has(lesson.id) ? 100 : 0);
        progressMap[lesson.id] = {
          lessonId: lesson.id,
          completed: percent >= 100,
          progressPercentage: percent,
          timeSpent: lessonPositions[lesson.id],
        };
      });
    });

    return progressMap;
  }, [courseContext, lessonProgress, completedLessons, lessonPositions]);

  const progressSummary = useMemo(() => {
    if (!courseContext) {
      return {
        totalCourseLessons: 0,
        modulePercent: 0,
        coursePercent: 0,
        moduleCompletedLessons: 0,
      };
    }

    const moduleLessons = courseContext.lessons;
    const moduleCompletedLessons = moduleLessons.filter((lesson) => completedLessons.has(lesson.id)).length;
    const modulePercent = moduleLessons.length > 0 ? Math.round((moduleCompletedLessons / moduleLessons.length) * 100) : 0;
    const totalCourseLessons =
      courseContext.course.modules?.reduce((sum, mod) => sum + ((mod.lessons?.length) ?? 0), 0) ?? moduleLessons.length;
    const coursePercent =
      totalCourseLessons > 0 ? Math.round((completedLessons.size / totalCourseLessons) * 100) : modulePercent;

    return {
      totalCourseLessons,
      modulePercent,
      coursePercent,
      moduleCompletedLessons,
    };
  }, [courseContext, completedLessons]);

  const {
    totalCourseLessons,
    modulePercent,
    coursePercent: courseProgressPercent,
  } = progressSummary;

  const sidebarCourse = useMemo<ComponentProps<typeof CourseProgressSidebar>['course'] | null>(() => {
    if (!courseContext?.course?.modules) return null;

    const sanitizedModules = courseContext.course.modules.map((courseModule) => ({
      id: courseModule.id,
      title: courseModule.title,
      description: courseModule.description,
      duration: courseModule.duration,
      order: courseModule.order ?? 0,
      lessons: (courseModule.lessons ?? []).map((lesson) => {
        const normalizedType = supportedSidebarLessonTypes.includes(lesson.type as SidebarLessonType)
          ? (lesson.type as SidebarLessonType)
          : 'text';
        const durationLabel = typeof lesson.duration === 'string' && lesson.duration.trim().length > 0
          ? lesson.duration
          : typeof lesson.estimatedDuration === 'number' && !Number.isNaN(lesson.estimatedDuration)
            ? `${lesson.estimatedDuration} min`
            : undefined;
        return {
          id: lesson.id,
          title: lesson.title,
          type: normalizedType,
          duration: durationLabel,
          order: lesson.order ?? 0,
          isLocked: (lesson as any).isLocked ?? false,
        };
      }),
    }));

    return {
      id: courseContext.course.id,
      title: courseContext.course.title,
      description: courseContext.course.description,
      modules: sanitizedModules,
      overallProgress: courseProgressPercent,
    } as ComponentProps<typeof CourseProgressSidebar>['course'];
  }, [courseContext, courseProgressPercent]);

  const focusLesson = useCallback(
    (lessonId: string | null, options?: { replace?: boolean }) => {
      setCurrentLessonId(lessonId);
      if (lessonId) {
        setSearchParams({ lesson: lessonId }, { replace: options?.replace ?? true });
      } else {
        setSearchParams({}, { replace: options?.replace ?? true });
      }
    },
    [setSearchParams]
  );

  useEffect(() => {
    const loadModule = async () => {
      setIsLoading(true);
      setError(null);
      try {
  const context = deriveModuleContext(moduleIdentifier ?? undefined);
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
          focusLesson(null, { replace: true });
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
        focusLesson(resolvedLesson, { replace: true });
      } catch (err) {
        console.error('Failed to load module data:', err);
        setError('We couldn’t load the module right now. Please refresh or try again later.');
        setCourseContext(null);
      } finally {
        setIsLoading(false);
      }
    };
    void loadModule();
  }, [moduleIdentifier, learnerId, focusLesson]);

  useEffect(() => {
    if (!requestedLessonId || !courseContext?.lessons?.length) return;
    const lessonExists = courseContext.lessons.some((lesson) => lesson.id === requestedLessonId);
    if (lessonExists && requestedLessonId !== currentLessonId) {
      setCurrentLessonId(requestedLessonId);
    }
  }, [requestedLessonId, courseContext?.lessons, currentLessonId]);

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

  useEffect(() => {
    if (!courseContext?.course?.id) return;
    if (courseProgressPercent >= 100 && !completionRedirected) {
      setCompletionRedirected(true);
      const completionCourseId = courseContext.course.slug || courseContext.course.id;
      navigate(`/lms/courses/${completionCourseId}/completion`, {
        state: { courseId: completionCourseId },
      });
    }
  }, [courseContext?.course?.id, courseProgressPercent, completionRedirected, navigate]);

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

      const currentIndex = lessonSequence.findIndex((entry) => entry.lesson.id === lessonId);
      const nextEntry = currentIndex >= 0 ? lessonSequence[currentIndex + 1] : undefined;

      if (nextEntry) {
        if (nextEntry.moduleId === courseContext?.module.id) {
          focusLesson(nextEntry.lesson.id);
        } else {
          navigate(`/lms/courses/${nextEntry.moduleId}?lesson=${nextEntry.lesson.id}`);
        }
      }

      persistProgress(nextEntry?.lesson.id ?? lessonId);
    },
    [courseContext?.module?.id, focusLesson, lessonSequence, navigate, persistProgress, updateLessonProgress]
  );

  const handleOpenInPlayer = useCallback(
    (lessonId: string) => {
      if (!courseContext) return;
      const courseSlug = courseContext.course.slug || courseContext.course.id;
      navigate(`/lms/courses/${courseSlug}/lesson/${lessonId}`);
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
  const activeLessonPercent = activeLesson
    ? lessonProgress[activeLesson.id] ?? (completedLessons.has(activeLesson.id) ? 100 : 0)
    : 0;
  const activeLessonCaptions = (Array.isArray(activeLesson?.content?.captions) ? activeLesson.content.captions : [])
    .map((caption: any) => {
      const startValue = typeof caption?.start === 'number' ? caption.start : caption?.startTime;
      const endValue = typeof caption?.end === 'number' ? caption.end : caption?.endTime;
      if (typeof startValue !== 'number' || typeof endValue !== 'number' || typeof caption?.text !== 'string') {
        return null;
      }
      return {
        start: startValue,
        end: endValue,
        text: caption.text,
      };
    })
    .filter((caption): caption is { start: number; end: number; text: string } => Boolean(caption));

  const activeLessonInitialTime = activeLesson ? lessonPositions[activeLesson.id] ?? 0 : 0;
  const activeLessonIndex = activeLesson ? lessonSequence.findIndex((entry) => entry.lesson.id === activeLesson.id) : -1;
  const previousLessonEntry = activeLessonIndex > 0 ? lessonSequence[activeLessonIndex - 1] : undefined;
  const nextLessonEntry =
    activeLessonIndex >= 0 && activeLessonIndex < lessonSequence.length - 1 ? lessonSequence[activeLessonIndex + 1] : undefined;

  const moveToLessonEntry = (entry?: { moduleId: string; lesson: NormalizedLesson }) => {
    if (!entry) return;
    if (entry.moduleId === module.id) {
      focusLesson(entry.lesson.id);
    } else {
      navigate(`/lms/courses/${entry.moduleId}?lesson=${entry.lesson.id}`);
    }
  };

  const handleSidebarLessonSelect = (targetModuleId: string, lessonId: string) => {
    if (targetModuleId === module.id) {
      focusLesson(lessonId);
      return;
    }
    navigate(`/lms/courses/${targetModuleId}?lesson=${lessonId}`);
  };

  const handlePreviousLesson = () => moveToLessonEntry(previousLessonEntry);
  const handleNextLesson = () => moveToLessonEntry(nextLessonEntry);

  const getLessonDurationMinutes = (lesson: NormalizedLesson): number => {
    if (typeof lesson.estimatedDuration === 'number' && !Number.isNaN(lesson.estimatedDuration)) {
      return lesson.estimatedDuration;
    }
    if (typeof lesson.duration === 'number' && !Number.isNaN(lesson.duration)) {
      return lesson.duration;
    }
    if (typeof lesson.duration === 'string') {
      const match = lesson.duration.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 5;
  };

  const estimatedTimeRemaining = (() => {
    if (activeLessonIndex === -1) return null;
    const remainingEntries = lessonSequence
      .slice(activeLessonIndex + 1)
      .filter((entry) => !completedLessons.has(entry.lesson.id));
    const totalMinutes = remainingEntries.reduce((sum, entry) => sum + getLessonDurationMinutes(entry.lesson), 0);
    return totalMinutes > 0 ? `${totalMinutes} min` : null;
  })();

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
                  {modulePercent}% complete
                </span>
              </div>
              <ProgressBar value={modulePercent} srLabel="Module progress" />
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

          <div className="mt-10 flex flex-col gap-8 lg:flex-row">
                <div className="lg:sticky lg:top-24 lg:self-start w-full lg:max-w-xs">
                  {sidebarCourse && (
                    <CourseProgressSidebar
                      course={sidebarCourse}
                      currentLessonId={currentLessonId ?? activeLesson?.id}
                      lessonProgress={sidebarLessonProgress}
                      onLessonSelect={handleSidebarLessonSelect}
                      onLessonOpenInPlayer={handleOpenInPlayer}
                      collapsed={sidebarCollapsed}
                      onCollapsedChange={handleSidebarCollapsedChange}
                    />
                  )}
                </div>

                <div className="flex-1">
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
                            {activeLessonPercent}%
                          </span>
                        </div>

                        {activeLesson.type === 'video' && activeLesson.content?.videoUrl && (
                          <div className="space-y-4">
                            <EnhancedVideoPlayer
                              key={activeLesson.id}
                              src={activeLesson.content.videoUrl}
                              title={activeLesson.title}
                              transcript={activeLesson.content.transcript || ''}
                              captions={activeLessonCaptions}
                              showTranscript={Boolean(activeLesson.content.transcript)}
                              autoPlay
                              initialTime={activeLessonInitialTime}
                              onProgress={(progress) => updateLessonProgress(activeLesson.id, progress)}
                              onComplete={() => markLessonComplete(activeLesson.id)}
                              onTimeUpdate={(seconds) =>
                                setLessonPositions((prev) => {
                                  const previousValue = prev[activeLesson.id] ?? 0;
                                  if (Math.abs(previousValue - seconds) < 0.5) {
                                    return prev;
                                  }
                                  return { ...prev, [activeLesson.id]: seconds };
                                })
                              }
                            />
                          </div>
                        )}

                        {activeLesson.type !== 'video' && (
                          <div className="space-y-3 rounded-xl bg-white/60 p-4">
                            <p className="text-sm text-slate/80">This lesson includes rich interactive content.</p>
                            <Button size="sm" onClick={() => handleOpenInPlayer(activeLesson.id)}>
                              Launch interactive lesson
                            </Button>
                          </div>
                        )}

                        <div className="space-y-4 text-sm leading-relaxed text-slate/80">
                          {activeLesson.content?.textContent ? (
                            <p>{activeLesson.content.textContent}</p>
                          ) : activeLesson.type === 'video' ? (
                            <p className="text-slate/60">
                              Video lessons include transcripts and resources inside the player above.
                            </p>
                          ) : (
                            <p>This lesson is best experienced in the full course player.</p>
                          )}
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
        <FloatingProgressBar
          currentProgress={courseProgressPercent}
          totalLessons={totalCourseLessons || lessons.length}
          completedLessons={completedLessons.size}
          currentLessonTitle={activeLesson?.title ?? 'Current lesson'}
          onPrevious={handlePreviousLesson}
          onNext={handleNextLesson}
          hasPrevious={Boolean(previousLessonEntry)}
          hasNext={Boolean(nextLessonEntry)}
          estimatedTimeRemaining={estimatedTimeRemaining ?? undefined}
          visible
        />
      </div>
    </ClientErrorBoundary>
  );
};

export default LMSModule;
