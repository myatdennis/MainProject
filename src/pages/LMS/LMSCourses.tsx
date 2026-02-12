import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Clock,
  Filter,
  Layers3,
  Search,
  Sparkle,
} from 'lucide-react';

import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import {
  syncCourseProgressWithRemote,
  loadStoredCourseProgress,
} from '../../utils/courseProgress';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import ProgressBar from '../../components/ui/ProgressBar';
import { LazyImage, ImageSkeleton } from '../../components/PerformanceComponents';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useSecureAuth } from '../../context/SecureAuthContext';

type StatusFilter = 'all' | 'not-started' | 'in-progress' | 'completed';

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'completed', label: 'Completed' },
];

const LMSCourses = () => {
  const navigate = useNavigate();
  const { user } = useUserProfile();
  const { sessionStatus, orgResolutionStatus } = useSecureAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [progressRefreshToken, setProgressRefreshToken] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [catalogRetrying, setCatalogRetrying] = useState(false);
  const [learnerCatalogState, setLearnerCatalogState] = useState(courseStore.getLearnerCatalogState());
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRanRef = useRef(false);

  const learnerId = useMemo(() => {
    if (user?.email) return user.email.toLowerCase();
    if (user?.id) return String(user.id).toLowerCase();
    return 'local-user';
  }, [user]);

  useEffect(() => {
    const unsubscribe = courseStore.subscribe(() => {
      setLearnerCatalogState(courseStore.getLearnerCatalogState());
    });
    return unsubscribe;
  }, []);

  const publishedCourses = useMemo(() => {
    return courseStore
      .getAllCourses()
      .filter((course) => course.status === 'published')
      .map((course) => {
        const normalized = normalizeCourse(course);
        const storedProgress =
          loadStoredCourseProgress(normalized.slug) ?? {
            completedLessonIds: [],
            lessonProgress: {},
            lessonPositions: {},
            lastLessonId: undefined,
          };
        const completedLessonIds = new Set(storedProgress.completedLessonIds ?? []);
        const allLessons =
          normalized.modules?.flatMap((module) =>
            (module.lessons ?? []).map((lesson) => ({
              lessonId: lesson.id,
            }))
          ) ?? [];
        const completedLessonCount = completedLessonIds.size;
        const progressPercent =
          normalized.lessons > 0
            ? Math.round((completedLessonCount / normalized.lessons) * 100)
            : 0;

        const lastLessonId = storedProgress.lastLessonId;
        const nextLessonEntry =
          (lastLessonId && allLessons.find((entry) => entry.lessonId === lastLessonId)) ||
          allLessons.find((entry) => !completedLessonIds.has(entry.lessonId)) ||
          allLessons[0];

        return {
          ...normalized,
          progress: progressPercent,
          resumeLessonId: nextLessonEntry?.lessonId ?? null,
        };
      });
  }, [progressRefreshToken]);

  const canSyncProgress = sessionStatus === 'ready' && orgResolutionStatus === 'ready';
  const hasCatalogLoaded = learnerCatalogState.status !== 'idle' || publishedCourses.length > 0;

  const handleRetryCatalog = useCallback(async () => {
    if (catalogRetrying) return;
    setCatalogRetrying(true);
    try {
      if (typeof (courseStore as any).init === 'function') {
        await (courseStore as any).init();
        setProgressRefreshToken((token) => token + 1);
      }
    } catch (error) {
      console.warn('[LMSCourses] Catalog retry failed:', error);
    } finally {
      setCatalogRetrying(false);
    }
  }, [catalogRetrying]);

  // Ensure course store refreshes on landing (always fetch & merge latest)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (typeof (courseStore as any).init === 'function') {
          setIsSyncing(true);
          await (courseStore as any).init();
          if (!active) return;
          // Trigger recompute
          setProgressRefreshToken((t) => t + 1);
        }
      } catch (err) {
        console.warn('[LMSCourses] Failed to initialize course store:', err);
      } finally {
        if (active) setIsSyncing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (syncRanRef.current) {
      return;
    }
    if (!canSyncProgress || !learnerId || !hasCatalogLoaded || publishedCourses.length === 0) {
      return;
    }
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }
    syncDebounceRef.current = window.setTimeout(() => {
      syncRanRef.current = true;
      setIsSyncing(true);
      (async () => {
        const results = await Promise.all(
          publishedCourses.map(async (course) => {
            const lessonIds =
              course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
            if (!lessonIds.length) return null;
            return syncCourseProgressWithRemote({
              courseSlug: course.slug,
              courseId: course.id,
              userId: learnerId,
              lessonIds,
            });
          }),
        );
        if (results.some(Boolean)) {
          setProgressRefreshToken((token) => token + 1);
        }
      })()
        .catch((error) => {
          console.warn('[LMSCourses] Failed to sync learner progress:', error);
        })
        .finally(() => setIsSyncing(false));
    }, 350);
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
        syncDebounceRef.current = null;
      }
    };
  }, [canSyncProgress, hasCatalogLoaded, learnerId, publishedCourses.length]);

  const filteredCourses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return publishedCourses.filter((course) => {
      const matchesSearch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        (course.description || '').toLowerCase().includes(query) ||
        course.category?.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (filterStatus === 'all') return true;
      if (filterStatus === 'completed') return course.progress >= 100;
      if (filterStatus === 'in-progress') return course.progress > 0 && course.progress < 100;
      if (filterStatus === 'not-started') return course.progress === 0;
      return true;
    });
  }, [publishedCourses, searchTerm, filterStatus]);

  const showEmptyCatalogState = !isSyncing && publishedCourses.length === 0;
  const showNoAssignmentsState = showEmptyCatalogState && learnerCatalogState.status === 'empty';
  const showCatalogErrorState = showEmptyCatalogState && learnerCatalogState.status === 'error';

  return (
    <div className="min-h-screen bg-softwhite">
      <div className="container-page section">
        <Breadcrumbs items={[{ label: 'Courses', to: '/lms/courses' }]} />
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card tone="gradient" withBorder={false} className="overflow-hidden">
            <div className="relative z-10 flex flex-col gap-4 text-charcoal">
              <Badge tone="info" className="w-max bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-skyblue">
                Learning Catalog
              </Badge>
              <h1 className="font-heading text-3xl font-bold md:text-4xl">Explore courses crafted for inclusive leaders</h1>
              <p className="max-w-2xl text-sm text-slate/80">
                Browse The Huddle Co. collection to build habits of belonging, courage, and cultural fluency across your organization.
              </p>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-4 h-5 w-5 text-slate/60" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search courses by title, skill, or keyword"
                    className="w-full rounded-full border-none bg-white/90 pl-12 pr-6 text-sm shadow-card-sm"
                    aria-label="Search courses"
                  />
                </div>
                <div className="hidden items-center gap-2 rounded-full bg-white/80 p-1 text-xs font-semibold uppercase tracking-wide text-slate/70 md:flex">
                  {statusFilters.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilterStatus(option.value)}
                      className={`rounded-full px-4 py-2 transition ${
                        filterStatus === option.value
                          ? 'bg-skyblue text-white shadow-card-sm'
                          : 'text-slate/80 hover:text-charcoal'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2 text-sm text-slate/80">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-card-sm">
                  <Layers3 className="h-4 w-4 text-sunrise" />
                  {publishedCourses.length} courses available
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 shadow-card-sm">
                  <Sparkle className="h-4 w-4 text-forest" />
                  Curated for DEI impact
                </span>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-72 translate-x-12 rounded-full bg-gradient-to-br from-sunrise/25 via-skyblue/18 to-forest/18 blur-3xl md:block" />
          </Card>

          <Card tone="muted" padding="lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-charcoal">Filter courses</h2>
                <p className="mt-1 text-sm text-slate/80">Find the next program for you or your team.</p>
              </div>
              <Button variant="ghost" size="sm" leadingIcon={<Filter className="h-4 w-4" />}
                onClick={() => {
                  setFilterStatus('all');
                  setSearchTerm('');
                }}
              >
                Reset
              </Button>
            </div>

            <div className="mt-6 grid gap-2 text-sm font-semibold text-slate/80">
              {statusFilters.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${
                    filterStatus === option.value ? 'border-skyblue bg-skyblue/8 text-skyblue' : 'border-mist bg-white'
                  }`}
                >
                  <div>
                    <p>{option.label}</p>
                    <p className="text-xs font-normal text-slate/70">
                      {getFilterHelper(option.value, publishedCourses)}
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="course-filter"
                    value={option.value}
                    checked={filterStatus === option.value}
                    onChange={() => setFilterStatus(option.value)}
                    className="h-4 w-4 accent-skyblue"
                    aria-label={`Filter ${option.label}`}
                  />
                </label>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 md:hidden">
          <div className="flex gap-2">
            {statusFilters.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilterStatus(option.value)}
                className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  filterStatus === option.value
                    ? 'border-skyblue bg-skyblue/10 text-skyblue'
                    : 'border-mist text-slate/80'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <SectionHeading
          title="Available courses"
          helper={`${filteredCourses.length} of ${publishedCourses.length} courses`}
          actionLabel="View learning plan"
          onAction={() => navigate('/lms/progress')}
        />

        {isSyncing ? (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading courses">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="flex h-full flex-col">
                <Skeleton className="h-44 w-full rounded-2xl" />
                <div className="mt-4 flex flex-1 flex-col gap-4">
                  <Skeleton variant="text" className="h-6 w-3/4" />
                  <Skeleton variant="text" className="h-4 w-full" />
                  <div className="mt-2">
                    <Skeleton className="h-2 w-full rounded-full" />
                    <Skeleton variant="text" className="mt-2 h-3 w-24" />
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <Skeleton className="h-9 w-28 rounded-lg" />
                    <Skeleton className="h-9 w-20 rounded-lg" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : showCatalogErrorState ? (
          <div className="mt-8">
            <EmptyState
              title="We're reconnecting to your catalog"
              description="We couldn't load your assignments from the server. We're showing any cached courses we have. Try again in a moment."
              action={
                <Button
                  onClick={handleRetryCatalog}
                  loading={catalogRetrying}
                  trailingIcon={<ArrowUpRight className="h-4 w-4" />}
                >
                  Retry loading courses
                </Button>
              }
            />
          </div>
        ) : showNoAssignmentsState ? (
          <div className="mt-8">
            <EmptyState
              title="No courses have been assigned yet"
              description="Your learning team hasn’t assigned courses to this workspace. Check back later or contact your administrator if you believe this is an error."
              action={
                <Button
                  onClick={handleRetryCatalog}
                  loading={catalogRetrying}
                  trailingIcon={<ArrowUpRight className="h-4 w-4" />}
                >
                  Refresh catalog
                </Button>
              }
            />
          </div>
        ) : filteredCourses.length === 0 && publishedCourses.length > 0 ? (
          <div className="mt-8">
            <EmptyState
              title="No courses match that search"
              description="Try a different keyword or reset your filters to rediscover The Huddle Co. catalog."
              action={(
                <Button onClick={() => { setSearchTerm(''); setFilterStatus('all'); }} trailingIcon={<ArrowUpRight className="h-4 w-4" />}>Reset search</Button>
              )}
            />
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const getFilterHelper = (filter: StatusFilter, courses: Array<{ progress: number }>) => {
  const count = courses.filter((course) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return course.progress >= 100;
    if (filter === 'in-progress') return course.progress > 0 && course.progress < 100;
    if (filter === 'not-started') return course.progress === 0;
    return true;
  }).length;

  switch (filter) {
    case 'completed':
      return `${count} finished`;
    case 'in-progress':
      return `${count} underway`;
    case 'not-started':
      return `${count} ready to begin`;
    default:
      return `${count} total`;
  }
};

interface SectionHeadingProps {
  title: string;
  helper: string;
  actionLabel: string;
  onAction: () => void;
}

const SectionHeading = ({ title, helper, actionLabel, onAction }: SectionHeadingProps) => (
  <div className="mt-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="font-heading text-2xl font-bold text-charcoal">{title}</h2>
      <p className="mt-1 text-sm text-slate/80">{helper}</p>
    </div>
    <Button variant="ghost" size="sm" trailingIcon={<ArrowUpRight className="h-4 w-4" />} onClick={onAction}>
      {actionLabel}
    </Button>
  </div>
);

interface CourseCardProps {
  course: ReturnType<typeof normalizeCourse> & { progress: number; resumeLessonId?: string | null };
}

const CourseCard = ({ course }: CourseCardProps) => {
  const progressLabel = course.progress >= 100
    ? 'Completed'
    : course.progress > 0
      ? `${course.progress}% complete`
      : 'Ready to start';
  const courseBasePath = `/lms/courses/${course.slug || course.id}`;
  const lessonPath = course.resumeLessonId ? `${courseBasePath}/lesson/${course.resumeLessonId}` : courseBasePath;
  const primaryHref = course.progress >= 100 ? courseBasePath : lessonPath;
  const primaryLabel = course.progress >= 100 ? 'Review course' : course.progress > 0 ? 'Continue' : 'Start course';

  return (
    <Card className="flex h-full flex-col">
      <div className="relative overflow-hidden rounded-2xl">
        <LazyImage
          src={course.thumbnail}
          alt={course.title}
          className="h-44 w-full object-cover"
          placeholder={<ImageSkeleton className="h-44 w-full rounded-2xl" />}
          fallbackSrc="/placeholder-course.jpg"
        />
        <div className="absolute top-4 left-4 flex gap-2">
          <Badge tone="info" className="bg-white/90 text-skyblue">
            {course.difficulty}
          </Badge>
          <Badge tone={course.progress >= 100 ? 'positive' : course.progress > 0 ? 'info' : 'neutral'} className="bg-white/90">
            {progressLabel}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-4">
        <div>
          <h3 className="font-heading text-xl font-semibold text-charcoal">{course.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-slate/80">{course.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate/80">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {course.duration}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            {course.lessons} lessons
          </span>
        </div>

        <div>
          <ProgressBar value={course.progress} srLabel={`${course.title} completion`} />
          <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate/70">
            {progressLabel}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <Button size="sm" className="flex-1" asChild>
            <Link to={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to={courseBasePath}>Details</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default LMSCourses;
