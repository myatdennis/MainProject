import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { LazyImage } from '../../components/PerformanceComponents';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Search, Filter, ArrowRight, Inbox } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import AsyncStatePanel from '../../components/system/AsyncStatePanel';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { getAssignmentsForUser } from '../../utils/assignmentStorage';
import {
  syncCourseProgressWithRemote,
  buildLearnerProgressSnapshot,
  loadStoredCourseProgress,
} from '../../utils/courseProgress';
import { getPreferredLessonId, getFirstLessonId } from '../../utils/courseNavigation';
import { syncService } from '../../dal/sync';
import type { CourseAssignment } from '../../types/assignment';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useRoutePrefetch } from '../../hooks/useRoutePrefetch';
import { shouldIncludeCourseForLearner } from './clientCoursesUtils';
import { getUserSession } from '../../lib/secureStorage';
import { loadCourse } from '../../dal/courseData';

const ClientCourses = () => {
  // Prefetch critical user flows for fast navigation
  useRoutePrefetch([
    '/client/dashboard',
    '/lms/dashboard',
    '/client/profile',
  ]);
  const { user } = useUserProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'completed' | 'not-started'>('all');
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const learnerId = useMemo(() => {
    if (user?.id) return String(user.id).toLowerCase();
    if (user?.email) return user.email.toLowerCase();
    return 'local-user';
  }, [user]);
  const sessionLearnerId = useMemo(() => {
    try {
      const session = getUserSession();
      return session?.id ? String(session.id).toLowerCase() : null;
    } catch {
      return null;
    }
  }, [learnerId]);
  const effectiveSyncUserId = useMemo(() => {
    if (!sessionLearnerId) return learnerId;
    if (sessionLearnerId === learnerId) return learnerId;
    return undefined;
  }, [learnerId, sessionLearnerId]);
  const showProgressDebug = useMemo(
    () => new URLSearchParams(location.search).get('debugProgress') === '1',
    [location.search],
  );

  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [progressRefreshToken, setProgressRefreshToken] = useState(0);
  const assignmentsRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const assignmentRefreshCooldownUntilRef = useRef(0);
  const assignmentRefreshFailuresRef = useRef(0);
  const adminCatalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getAdminCatalogState);
  const learnerCatalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getLearnerCatalogState);
  const allCourses = useSyncExternalStore(courseStore.subscribe, courseStore.getAllCourses);

  useEffect(() => {
    if (adminCatalogState.phase !== 'idle' || learnerCatalogState.status !== 'idle') {
      return;
    }
    setCoursesError(null);
    courseStore.init().catch((err) => {
      console.warn('Failed to initialize course store:', err);
      const message = err instanceof Error ? err.message : 'Unable to load course catalog right now.';
      setCoursesError(message || 'Unable to load course catalog right now.');
    });
  }, [adminCatalogState.phase, learnerCatalogState.status]);

  const normalizedCoursesAll = useMemo(
    () => allCourses.map((course) => normalizeCourse(course)),
    [allCourses],
  );

  // Learners see published + assigned only
  const assignmentByCourseId = useMemo(() => {
    const map = new Map<string, CourseAssignment>();
    assignments
      .filter((a): a is CourseAssignment & { courseId: string } => typeof a.courseId === 'string' && a.courseId.length > 0)
      .forEach((a) => {
        const resolvedCourse = courseStore.resolveCourse(a.courseId);
        const courseIdKey = resolvedCourse?.id ?? a.courseId;
        map.set(courseIdKey, a);
        if (resolvedCourse?.id && resolvedCourse.id !== a.courseId) {
          map.set(a.courseId, a);
        }
      });
    return map;
  }, [assignments]);
  const normalizedCourses = useMemo(
    () => normalizedCoursesAll.filter((c) => shouldIncludeCourseForLearner(c.id, assignmentByCourseId)),
    [normalizedCoursesAll, assignmentByCourseId],
  );

  useEffect(() => {
    let isMounted = true;
    const syncProgress = async () => {
      if (!normalizedCourses.length) return;
      const results = await Promise.all(
        normalizedCourses.map(async (course) => {
          const lessonIds =
            course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
          if (lessonIds.length === 0) return null;
          return syncCourseProgressWithRemote({
            courseSlug: course.slug,
            courseId: course.id,
            userId: effectiveSyncUserId,
            lessonIds,
          });
        })
      );

      if (!isMounted) return;
      if (results.some((entry) => entry)) {
        setProgressRefreshToken((token) => token + 1);
      }
    };

    void syncProgress();

    return () => {
      isMounted = false;
    };
  }, [normalizedCourses, effectiveSyncUserId]);

  useEffect(() => {
    let isMounted = true;

    const refreshAssignments = async () => {
      if (assignmentsRefreshInFlightRef.current) {
        return assignmentsRefreshInFlightRef.current;
      }

      const now = Date.now();
      if (now < assignmentRefreshCooldownUntilRef.current) {
        return;
      }

      const request = (async () => {
        try {
          const records = await getAssignmentsForUser(learnerId);
          if (isMounted) {
            setAssignments(records);
          }
          assignmentRefreshFailuresRef.current = 0;
          assignmentRefreshCooldownUntilRef.current = 0;
        } catch (error) {
          assignmentRefreshFailuresRef.current += 1;
          const backoffMs = Math.min(30_000, 1_000 * 2 ** assignmentRefreshFailuresRef.current);
          assignmentRefreshCooldownUntilRef.current = Date.now() + backoffMs;
          console.error('Failed to load assignments:', error);
        } finally {
          assignmentsRefreshInFlightRef.current = null;
        }
      })();

      assignmentsRefreshInFlightRef.current = request;
      return request;
    };

    void refreshAssignments();

    const unsubscribeCreate = syncService.subscribe('assignment_created', () => {
      void refreshAssignments();
    });
    const unsubscribeUpdate = syncService.subscribe('assignment_updated', () => {
      void refreshAssignments();
    });
    const unsubscribeDelete = syncService.subscribe('assignment_deleted', () => {
      void refreshAssignments();
    });

    return () => {
      isMounted = false;
      unsubscribeCreate?.();
      unsubscribeUpdate?.();
      unsubscribeDelete?.();
    };
  }, [learnerId]);

  const courseCardModels = useMemo(
    () =>
      normalizedCourses.map((course) => {
        const stored = loadStoredCourseProgress(course.slug);
        const snapshot = buildLearnerProgressSnapshot(course, new Set(stored.completedLessonIds), stored.lessonProgress || {});
        const assignment = assignments.find((record) => record.courseId === course.id);
        const assignmentProgress = Number(assignment?.progress ?? 0);
        const snapshotProgress = Math.round((snapshot.overallProgress || 0) * 100);
        const progress = Math.max(assignmentProgress, snapshotProgress);
        const status =
          assignment?.status === 'completed' || progress >= 100
            ? 'completed'
            : progress > 0
              ? 'in-progress'
              : 'not-started';
        const reason =
          assignment?.status === 'completed'
            ? 'assignment_status_completed'
            : snapshotProgress > assignmentProgress
              ? 'snapshot_wins'
              : assignmentProgress > snapshotProgress
                ? 'assignment_wins'
                : 'equal';

        return {
          course,
          snapshot,
          assignment,
          stored,
          preferredLessonId: getPreferredLessonId(course, stored) ?? getFirstLessonId(course),
          assignmentProgress,
          snapshotProgress,
          progress,
          status,
          reason,
        };
      }),
    [normalizedCourses, assignments, progressRefreshToken],
  );

  useEffect(() => {
    if (!showProgressDebug) return;
    console.info('[ClientCourses.progress_debug] sync_identity', {
      learnerId,
      sessionLearnerId,
      effectiveSyncUserId: effectiveSyncUserId ?? 'session-derived',
      courses: courseCardModels.length,
    });
    courseCardModels.forEach((entry) => {
      console.info('[ClientCourses.progress_debug] card_model', {
        title: entry.course.title,
        courseId: entry.course.id,
        courseSlug: entry.course.slug,
        assignmentCourseId: entry.assignment?.courseId ?? null,
        assignmentProgress: entry.assignmentProgress,
        snapshotProgress: entry.snapshotProgress,
        mergedProgress: entry.progress,
        selectedBranch: entry.reason,
      });
    });
  }, [showProgressDebug, courseCardModels, learnerId, sessionLearnerId, effectiveSyncUserId]);

  const filtered = courseCardModels.filter(({ course, status }) => {
    const searchMatch = course.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (!searchMatch) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'in-progress') return status === 'in-progress';
    if (filterStatus === 'completed') return status === 'completed';
    if (filterStatus === 'not-started') return status === 'not-started';
    return true;
  });

  const handleLaunchCourse = async (courseSlug: string, fallbackLessonId?: string | null) => {
    if (fallbackLessonId) {
      navigate(`/client/courses/${courseSlug}/lessons/${fallbackLessonId}`);
      return;
    }

    try {
      const detail = await loadCourse(courseSlug, { includeDrafts: false, preferRemote: true });
      const resolvedLessonId = detail ? getFirstLessonId(detail.course) : null;
      if (resolvedLessonId) {
        navigate(`/client/courses/${courseSlug}/lessons/${resolvedLessonId}`);
        return;
      }
    } catch (error) {
      console.warn('[ClientCourses] Failed to resolve launch lesson id', { courseSlug, error });
    }

    navigate(`/client/courses/${courseSlug}`);
  };

  const coursesLoading =
    adminCatalogState.phase === 'loading' ||
    (learnerCatalogState.status === 'idle' && normalizedCoursesAll.length === 0);
  const showCatalogError = !coursesLoading && Boolean(coursesError) && normalizedCoursesAll.length === 0;
  const noCoursesAvailable = !coursesLoading && normalizedCourses.length === 0;
  const asyncState = coursesLoading ? 'loading' : showCatalogError ? 'error' : 'ready';

  return (
    <div className="max-w-7xl px-6 py-10 lg:px-12">
      <AsyncStatePanel
        state={asyncState}
        loadingLabel="Loading courses..."
        title="We couldn’t load your courses"
        message={coursesError || undefined}
        onRetry={() => {
          setCoursesError(null);
          void courseStore.init().catch((error) => {
            const message = error instanceof Error ? error.message : 'Unable to load course catalog right now.';
            setCoursesError(message || 'Unable to load course catalog right now.');
          });
        }}
        secondaryActionLabel="Back to dashboard"
        onSecondaryAction={() => navigate('/client/dashboard')}
      >
        <>
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-charcoal">My courses</h1>
            <p className="mt-2 text-sm text-slate/80">Assigned programs appear here along with your progress.</p>
          </div>
          <Card tone="muted" className="mb-8 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <div className="relative w-full md:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/60" />
                  <Input
                    className="pl-9"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search courses"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate/60" />
                  <select
                    value={filterStatus}
                    onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
                    aria-label="Filter courses by progress status"
                    className="rounded-lg border border-mist px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-skyblue"
                  >
                    <option value="all">All</option>
                    <option value="not-started">Not started</option>
                    <option value="in-progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowRight className="h-4 w-4" />}
                onClick={() => navigate('/lms/dashboard')}
              >
                Open full learning hub
              </Button>
            </div>
          </Card>
          {noCoursesAvailable ? (
            <Card tone="muted" className="mt-6 text-center" padding="lg">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cloud text-skyblue">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-charcoal">No programs assigned yet</h3>
              <p className="mt-2 text-sm text-slate/80">
                When your facilitator assigns a course, it will appear here automatically. You can still open the full LMS to browse optional content.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button size="sm" onClick={() => navigate('/lms/dashboard')}>Open LMS</Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/client/dashboard')}>
                  Back to dashboard
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map(({ course, progress, status, preferredLessonId }) => {
                  return (
                    <Card key={course.id} className="flex h-full flex-col gap-4" data-test="client-course-card">
                      <div className="relative overflow-hidden rounded-2xl">
                        <LazyImage
                          src={course.thumbnail}
                          webpSrc={course.thumbnail?.replace(/\.(png|jpg|jpeg)$/i, '.webp')}
                          avifSrc={course.thumbnail?.replace(/\.(png|jpg|jpeg)$/i, '.avif')}
                          fallbackSrc="/placeholder-course.jpg"
                          alt={course.title}
                          className="h-44 w-full object-cover"
                          placeholder={<div className="h-44 w-full bg-mutedgrey animate-pulse" />} 
                        />
                        <Badge tone="info" className="absolute left-4 top-4 bg-white/90 text-skyblue">
                          {status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In progress' : 'Assigned'}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-heading text-xl font-semibold text-charcoal">{course.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-slate/80">{course.description}</p>
                        </div>
                        <ProgressBar value={progress} srLabel={`${course.title} progress`} />
                        <div className="flex items-center gap-3 text-xs text-slate/70">
                          <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />
                            {(course.chapters || []).reduce((total, chapter) => total + chapter.lessons.length, 0)} lessons
                          </span>
                          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {course.duration}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            size="sm"
                            onClick={() => {
                              void handleLaunchCourse(course.slug, preferredLessonId);
                            }}
                            data-test="client-course-primary"
                          >
                            {status === 'completed' ? 'Review course' : status === 'not-started' ? 'Start course' : 'Continue'}
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/client/courses/${course.slug}`}>Details</Link>
                          </Button>
                        </div>
                        {status === 'in-progress' && (
                          <p className="text-xs font-medium text-skyblue">Continue where you left off</p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <Card tone="muted" className="mt-6 text-center" padding="lg">
                  <h3 className="font-heading text-lg font-semibold text-charcoal">No courses match your filters.</h3>
                  <p className="mt-2 text-sm text-slate/80">Clear the filters or explore the LMS dashboard for more content.</p>
                </Card>
              )}
            </>
          )}
        </>
      </AsyncStatePanel>
    </div>
  );
};

export default ClientCourses;
