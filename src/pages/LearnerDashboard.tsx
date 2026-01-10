import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Play,
  Search,
  Target,
} from 'lucide-react';

import { Course, LearnerProgress } from '../types/courseTypes';
import { courseStore } from '../store/courseStore';
import { normalizeCourse } from '../utils/courseNormalization';
import {
  syncCourseProgressWithRemote,
  buildLearnerProgressSnapshot,
  loadStoredCourseProgress,
} from '../utils/courseProgress';
import { syncService } from '../dal/sync';
import { getAssignmentsForUser } from '../utils/assignmentStorage';
import type { CourseAssignment } from '../types/assignment';

import SEO from '../components/SEO';
import { LoadingSpinner, CourseCardSkeleton } from '../components/LoadingComponents';
import { LazyImage, ImageSkeleton, useDebounce } from '../components/PerformanceComponents';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { useUserProfile } from '../hooks/useUserProfile';

const filterOptions: Array<{ value: 'all' | 'in-progress' | 'not-started' | 'completed'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'completed', label: 'Completed' },
];

type CourseStats = {
  progress: number;
  completedLessons: number;
  totalLessons: number;
  timeSpent: number;
  isCompleted: boolean;
};

const LearnerDashboard = () => {
  const navigate = useNavigate();
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [progressData, setProgressData] = useState<Map<string, LearnerProgress>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'not-started' | 'completed'>('all');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [progressRefreshToken, setProgressRefreshToken] = useState(0);

  const { user } = useUserProfile();
  const learnerId = useMemo(() => {
    if (user?.email) return user.email.toLowerCase();
    if (user?.id) return String(user.id).toLowerCase();
    return 'local-user';
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      try {
        if (courseStore.getAllCourses().length === 0 && typeof courseStore.init === 'function') {
          await courseStore.init();
        }

        const storedCourses = courseStore.getAllCourses();
        const normalizedCourses = storedCourses
          .map((course) => normalizeCourse(course))
          .filter((course) => course.status === 'published');

        const assignmentRecords = await getAssignmentsForUser(learnerId);
        const mergedCourses = [...normalizedCourses];
        assignmentRecords.forEach((record) => {
          if (!mergedCourses.some((course) => course.id === record.courseId)) {
            const fromStore = courseStore.getCourse(record.courseId);
            if (fromStore) {
              mergedCourses.push(normalizeCourse(fromStore));
            }
          }
        });

        if (!isMounted) return;

        setAssignments(assignmentRecords);
        setEnrolledCourses(mergedCourses);

        const progressMap = new Map<string, LearnerProgress>();
        mergedCourses.forEach((course) => {
          const normalized = normalizeCourse(course);
          const storedProgress = loadStoredCourseProgress(normalized.slug);
          const completedSet = new Set(storedProgress.completedLessonIds);
          const snapshot = buildLearnerProgressSnapshot(
            normalized,
            completedSet,
            storedProgress.lessonProgress || {}
          );
          progressMap.set(normalized.id, snapshot);
        });

        setProgressData(progressMap);
      } catch (error) {
        console.error('Failed to load learner courses:', error);
        if (isMounted) {
          setEnrolledCourses([]);
          setProgressData(new Map());
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [learnerId]);

  useEffect(() => {
    let isMounted = true;

    const loadAssignments = async () => {
      try {
        const records = await getAssignmentsForUser(learnerId);
        if (isMounted) {
          setAssignments(records);
        }
      } catch (error) {
        console.error('Failed to load assignments:', error);
      }
    };

    void loadAssignments();

    return () => {
      isMounted = false;
    };
  }, [learnerId]);

  useEffect(() => {
    const refreshAssignments = async () => {
      try {
        const records = await getAssignmentsForUser(learnerId);
        setAssignments(records);
      } catch (error) {
        console.error('Failed to refresh assignments:', error);
      }
    };
    const unsubAssignCreate = syncService.subscribe('assignment_created', () => {
      void refreshAssignments();
    });
    const unsubAssignUpdate = syncService.subscribe('assignment_updated', () => {
      void refreshAssignments();
    });
  const unsubProgress = syncService.subscribe('user_progress', (event: any) => {
      const targetId = event?.userId || event?.data?.userId;
      if (targetId?.toLowerCase?.() === learnerId) {
        void refreshAssignments();
      }
    });
  const unsubComplete = syncService.subscribe('user_completed', (event: any) => {
      const targetId = event?.userId || event?.data?.userId;
      if (targetId?.toLowerCase?.() === learnerId) {
        void refreshAssignments();
      }
    });

    return () => {
      unsubAssignCreate?.();
      unsubAssignUpdate?.();
      unsubProgress?.();
      unsubComplete?.();
    };
  }, [learnerId]);


  useEffect(() => {
    let isMounted = true;
    const syncProgress = async () => {
      if (!enrolledCourses.length) return;

      const results = await Promise.all(
        enrolledCourses.map(async (course) => {
          const normalized = normalizeCourse(course);
          const lessonIds =
            normalized.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
          if (!lessonIds.length) return null;
          return syncCourseProgressWithRemote({
            courseSlug: normalized.slug,
            courseId: normalized.id,
            userId: learnerId,
            lessonIds,
          });
        })
      );

      if (!isMounted) return;
      if (results.some((entry) => entry)) {
        setProgressRefreshToken((token) => token + 1);
        const progressMap = new Map<string, LearnerProgress>();
        enrolledCourses.forEach((course) => {
          const normalized = normalizeCourse(course);
          const storedProgress = loadStoredCourseProgress(normalized.slug);
          const completedSet = new Set(storedProgress.completedLessonIds);
          const snapshot = buildLearnerProgressSnapshot(
            normalized,
            completedSet,
            storedProgress.lessonProgress || {}
          );
          progressMap.set(normalized.id, snapshot);
        });
        setProgressData(progressMap);
      }
    };

    void syncProgress();

    return () => {
      isMounted = false;
    };
  }, [enrolledCourses, learnerId]);

  const filteredCourses = useMemo(() => {
    let courses = [...enrolledCourses];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      courses = courses.filter((course) => {
        const titleMatch = course.title.toLowerCase().includes(query);
        const descriptionMatch = (course.description || '').toLowerCase().includes(query);
        const categoryMatch = course.category?.toLowerCase().includes(query);
        return titleMatch || descriptionMatch || categoryMatch;
      });
    }

    if (filterStatus !== 'all') {
      courses = courses.filter((course) => {
        const progress = progressData.get(course.id);
        switch (filterStatus) {
          case 'in-progress':
            return progress && progress.overallProgress > 0 && progress.overallProgress < 1;
          case 'completed':
            return progress?.overallProgress === 1;
          case 'not-started':
            return !progress || progress.overallProgress === 0;
          default:
            return true;
        }
      });
    }

    return courses;
  }, [enrolledCourses, debouncedSearchQuery, filterStatus, progressData, progressRefreshToken]);

  const handleCourseClick = (course: Course) => {
    navigate(`/lms/course/${course.slug || course.id}`);
  };

  const handleContinueCourse = (course: Course) => {
    const progress = progressData.get(course.id);
    if (progress && progress.lessonProgress.length > 0) {
      const nextLesson = progress.lessonProgress.find((p) => !p.isCompleted);
      if (nextLesson) {
        navigate(`/lms/course/${course.slug || course.id}/lesson/${nextLesson.lessonId}`);
        return;
      }
    }

    const storedProgress = loadStoredCourseProgress(course.slug);
    if (storedProgress.lastLessonId) {
      navigate(`/lms/course/${course.slug || course.id}/lesson/${storedProgress.lastLessonId}`);
      return;
    }

    const firstLesson = course.chapters?.[0]?.lessons?.[0] || course.modules?.[0]?.lessons?.[0];
    if (firstLesson) {
      navigate(`/lms/course/${course.slug || course.id}/lesson/${firstLesson.id}`);
      return;
    }

    navigate(`/lms/course/${course.slug || course.id}`);
  };

  const getCourseStats = (course: Course): CourseStats => {
    const progress = progressData.get(course.id);
    const assignment = assignments.find((record) => record.courseId === course.id);
    const assignmentProgress = assignment ? assignment.progress / 100 : 0;
    const overallProgress = Math.max(progress?.overallProgress || 0, assignmentProgress);

    const totalLessons = (course.chapters || []).reduce(
      (total, chapter) => total + chapter.lessons.length,
      0
    );

    const completedLessons = overallProgress >= 1
      ? totalLessons
      : progress?.lessonProgress.filter((lp) => lp.isCompleted).length || 0;

    return {
      progress: overallProgress,
      completedLessons,
      totalLessons,
      timeSpent: progress?.timeSpent || 0,
      isCompleted: overallProgress >= 1 || assignment?.status === 'completed',
    };
  };

  const activeCourses = filteredCourses.filter((course) => {
    const stats = getCourseStats(course);
    return stats.progress > 0 && !stats.isCompleted;
  });

  const notStartedCourses = filteredCourses.filter((course) => getCourseStats(course).progress === 0);

  const progressValues = filteredCourses.map((course) => getCourseStats(course).progress);
  const completedCount = progressValues.filter((value) => value >= 1).length;
  const inProgressCount = progressValues.filter((value) => value > 0 && value < 1).length;
  const snapshotValues = Array.from(progressData.values());
  const totalSeconds = snapshotValues.reduce((sum, item) => sum + (item.timeSpent || 0), 0);
  const completedLessonAggregate = snapshotValues.reduce(
    (sum, item) => sum + (item.lessonProgress?.filter((lesson) => lesson.isCompleted).length || 0),
    0
  );
  const hoursSpent = Math.floor(totalSeconds / 3600);
  const averageCompletion = progressValues.length
    ? Math.round(
        (progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) *
          100
      )
    : 0;

  const recommendedCourses = notStartedCourses.length > 0 ? notStartedCourses : filteredCourses;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-softwhite">
        <SEO
          title="My Learning Dashboard"
          description="Track your learning progress, continue courses, and discover new educational opportunities."
          keywords="learning dashboard, course progress, online education, skills development"
        />
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-12">
          <LoadingSpinner size="lg" text="Loading your courses..." className="py-20" />
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CourseCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-softwhite pb-20">
      <SEO
        title="My Learning Dashboard"
        description="Track your learning progress, continue courses, and discover new educational opportunities."
        keywords="learning dashboard, course progress, online education, skills development"
      />
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card tone="gradient" withBorder={false} className="overflow-hidden">
            <div className="relative z-10 flex flex-col gap-5 text-charcoal">
              <Badge
                tone="info"
                className="w-max bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-skyblue"
              >
                My Learning Journey
              </Badge>
              <h1 className="font-heading text-3xl font-bold md:text-4xl">
                Welcome back, continue building inclusive leadership skills.
              </h1>
              <p className="max-w-2xl text-base text-slate/80">
                Review your progress, pick up the next lesson, or explore new courses designed to spark
                belonging across your teams.
              </p>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-4 h-5 w-5 text-slate/60" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search your courses"
                    className="w-full rounded-full border-none bg-white/90 pl-12 pr-6 text-sm shadow-card-sm"
                    aria-label="Search courses"
                  />
                </div>
                <div className="hidden rounded-full bg-white/80 p-1 text-sm font-semibold text-slate/70 md:flex">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilterStatus(option.value)}
                      className={`flex-1 rounded-full px-4 py-2 transition ${
                        filterStatus === option.value
                          ? 'bg-sunrise text-white shadow-card-sm'
                          : 'text-slate/70 hover:text-charcoal'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <HeroStat icon={<Play className="h-4 w-4" />} label="Active Courses" value={inProgressCount} />
                <HeroStat icon={<CheckCircle2 className="h-4 w-4" />} label="Completion" value={`${averageCompletion}%`} />
                <HeroStat icon={<Clock className="h-4 w-4" />} label="Hours Learned" value={hoursSpent} />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-64 translate-x-10 rounded-full bg-gradient-to-br from-sunrise/30 via-skyblue/20 to-forest/20 blur-3xl md:block" />
          </Card>

          <Card tone="muted" padding="lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-charcoal">Learning snapshot</h2>
                <p className="mt-1 text-sm text-slate/80">A quick look at your momentum this week.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/lms/progress')}
                trailingIcon={<ArrowUpRight className="h-4 w-4" />}
              >
                View report
              </Button>
            </div>
            <div className="mt-6 space-y-4">
              <SnapshotRow
                icon={<BarChart3 className="h-5 w-5 text-skyblue" />}
                label="Completed courses"
                value={`${completedCount}`}
                helper="All time"
              />
              <SnapshotRow
                icon={<Target className="h-5 w-5 text-forest" />}
                label="Goals in focus"
                value={`${Math.max(inProgressCount, 1)}`}
                helper="Active this month"
              />
              <SnapshotRow
                icon={<BookOpen className="h-5 w-5 text-sunrise" />}
                label="Lessons completed"
                value={`${completedLessonAggregate}`}
                helper="Across all courses"
              />
            </div>
          </Card>
        </div>

        <div className="mt-6 md:hidden">
          <div className="flex gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilterStatus(option.value)}
                className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  filterStatus === option.value
                    ? 'border-sunrise bg-sunrise/10 text-sunrise'
                    : 'border-mist text-slate/80'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <section className="mt-12 space-y-14">
          <div>
            <SectionHeading
              title="Continue learning"
              description="Pick up where you left off in courses that are already underway."
              badgeValue={activeCourses.length}
              actionLabel="Browse all courses"
              onAction={() => navigate('/lms/courses')}
            />
            {activeCourses.length === 0 ? (
              <EmptyState
                title="You're all caught up"
                description="Start a new course to keep building your practice of inclusive leadership."
                actionLabel="Explore catalog"
                onAction={() => navigate('/lms/courses')}
              />
            ) : (
              <CourseGrid>
                {activeCourses.map((course) => (
                  <CourseTile
                    key={course.id}
                    course={course}
                    stats={getCourseStats(course)}
                    assignment={assignments.find((record) => record.courseId === course.id)}
                    onPrimaryAction={() => handleContinueCourse(course)}
                    onSecondaryAction={() => handleCourseClick(course)}
                  />
                ))}
              </CourseGrid>
            )}
          </div>

          <div>
            <SectionHeading
              title="Recommended for you"
              description="Curated programs to deepen your inclusive leadership toolkit."
              badgeValue={recommendedCourses.length}
              actionLabel="View recommendations"
              onAction={() => navigate('/lms/courses')}
            />
            {recommendedCourses.length === 0 ? (
              <EmptyState
                title="No matches just yet"
                description="Adjust your search or filters to discover tailored content."
                actionLabel="Reset filters"
                onAction={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
              />
            ) : (
              <CourseGrid>
                {recommendedCourses.map((course) => (
                  <CourseTile
                    key={course.id}
                    course={course}
                    stats={getCourseStats(course)}
                    assignment={assignments.find((record) => record.courseId === course.id)}
                    isRecommended
                    onPrimaryAction={() => handleCourseClick(course)}
                    onSecondaryAction={() => handleCourseClick(course)}
                  />
                ))}
              </CourseGrid>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

interface HeroStatProps {
  icon: ReactNode;
  label: string;
  value: string | number;
}

const HeroStat = ({ icon, label, value }: HeroStatProps) => (
  <div className="inline-flex min-w-[130px] items-center gap-3 rounded-xl bg-white/70 px-4 py-3 shadow-card-sm">
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-skyblue/12 text-skyblue">
      {icon}
    </span>
    <div>
      <div className="font-heading text-lg font-bold text-charcoal">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate/70">{label}</div>
    </div>
  </div>
);

interface SnapshotRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}

const SnapshotRow = ({ icon, label, value, helper }: SnapshotRowProps) => (
  <div className="flex items-start gap-3 rounded-xl border border-mist/60 bg-white/70 p-4">
    <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-cloud text-slate">
      {icon}
    </span>
    <div className="flex-1">
      <div className="flex items-center justify-between">
        <p className="font-heading text-base font-semibold text-charcoal">{label}</p>
        <span className="font-heading text-lg font-bold text-charcoal">{value}</span>
      </div>
      <p className="text-xs text-slate/70">{helper}</p>
    </div>
  </div>
);

interface SectionHeadingProps {
  title: string;
  description: string;
  badgeValue: number;
  actionLabel: string;
  onAction: () => void;
}

const SectionHeading = ({ title, description, badgeValue, actionLabel, onAction }: SectionHeadingProps) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <div className="flex items-center gap-3">
        <h2 className="font-heading text-2xl font-bold text-charcoal">{title}</h2>
        <Badge tone="info" className="bg-skyblue/10 text-skyblue">
          {badgeValue}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-slate/80">{description}</p>
    </div>
    <Button variant="ghost" size="sm" trailingIcon={<ArrowUpRight className="h-4 w-4" />} onClick={onAction}>
      {actionLabel}
    </Button>
  </div>
);

const CourseGrid = ({ children }: { children: ReactNode }) => (
  <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>
);

interface CourseTileProps {
  course: Course;
  stats: CourseStats;
  assignment?: CourseAssignment;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  isRecommended?: boolean;
}

const CourseTile = ({
  course,
  stats,
  assignment,
  onPrimaryAction,
  onSecondaryAction,
  isRecommended,
}: CourseTileProps) => {
  const progressPercent = Math.round((stats.progress || 0) * 100);
  const statusLabel = assignment?.status === 'completed' || stats.isCompleted
    ? 'Completed'
    : progressPercent > 0
      ? `${progressPercent}% complete`
      : assignment
        ? 'Assigned'
        : 'Ready to start';
  const dueDateLabel = assignment?.dueDate
    ? new Date(assignment.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl">
        <LazyImage
          src={course.thumbnail}
          alt={course.title}
          className="h-44 w-full object-cover"
          placeholder={<ImageSkeleton className="h-44 w-full rounded-2xl" />}
          fallbackSrc="/placeholder-course.jpg"
        />
        {isRecommended && (
          <Badge tone="info" className="absolute left-4 top-4 bg-white/90 text-skyblue">
            Recommended
          </Badge>
        )}
        {assignment && (
          <Badge tone="info" className="absolute right-4 top-4 bg-white/90 text-sunrise">
            {assignment.status === 'completed' ? 'Completed' : 'Assigned'}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-heading text-xl font-semibold text-charcoal">{course.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm text-slate/80">{course.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-slate/80">
          <span className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            {(course.chapters || []).reduce((total, chapter) => total + chapter.lessons.length, 0)} lessons
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {course.estimatedDuration || 0} min
          </span>
        </div>

        {dueDateLabel && (
          <div className="text-xs font-semibold uppercase tracking-wide text-slate/70">
            Due {dueDateLabel}
          </div>
        )}

        <div>
          <ProgressBar value={progressPercent} srLabel={`${course.title} completion`} />
          <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate/70">
            {statusLabel}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <Button onClick={onPrimaryAction} className="flex-1" size="sm">
            {stats.isCompleted ? 'Review course' : progressPercent > 0 ? 'Continue' : 'Start course'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSecondaryAction}>
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
};

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

const EmptyState = ({ title, description, actionLabel, onAction }: EmptyStateProps) => (
  <Card tone="muted" className="mt-6 flex flex-col items-center gap-4 text-center" padding="lg">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sunrise/10 text-sunrise">
      <Target className="h-6 w-6" />
    </div>
    <h3 className="font-heading text-xl font-semibold text-charcoal">{title}</h3>
    <p className="max-w-md text-sm text-slate/80">{description}</p>
    <Button onClick={onAction} trailingIcon={<ArrowUpRight className="h-4 w-4" />}>
      {actionLabel}
    </Button>
  </Card>
);

export default LearnerDashboard;
