import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Search, Filter, ArrowRight } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
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

const ClientCourses = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'completed' | 'not-started'>('all');
  const navigate = useNavigate();

  const learnerId = useMemo(() => {
    try {
      const raw = localStorage.getItem('huddle_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return (parsed.email || parsed.id || 'local-user').toLowerCase();
      }
    } catch (error) {
      console.warn('Failed to read learner identity:', error);
    }
    return 'local-user';
  }, []);

  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [storeRefresh, setStoreRefresh] = useState(0);
  const [progressRefreshToken, setProgressRefreshToken] = useState(0);
  // Normalize courses (convert modules to chapters if needed)
  const normalizedCourses = courseStore
    .getAllCourses()
    .map((course) => normalizeCourse(course));
  
  console.log('[ClientCourses] courseStore.getAllCourses():', courseStore.getAllCourses());
  console.log('[ClientCourses] normalizedCourses:', normalizedCourses);

  useEffect(() => {
    const ensureStore = async () => {
      try {
        if (courseStore.getAllCourses().length === 0 && typeof (courseStore as any).init === 'function') {
          await (courseStore as any).init();
          setStoreRefresh((v) => v + 1);
        }
      } catch (err) {
        console.warn('Failed to initialize course store:', err);
      }
    };
    void ensureStore();
  }, []);

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
            userId: learnerId,
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
  }, [normalizedCourses, learnerId]);

  useEffect(() => {
    let isMounted = true;

    const refreshAssignments = async () => {
      try {
        const records = await getAssignmentsForUser(learnerId);
        if (isMounted) {
          setAssignments(records);
        }
      } catch (error) {
        console.error('Failed to load assignments:', error);
      }
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

  const courseSnapshots = useMemo(() => normalizedCourses.map((course) => {
    const stored = loadStoredCourseProgress(course.slug);
    return {
      course,
      snapshot: buildLearnerProgressSnapshot(course, new Set(stored.completedLessonIds), stored.lessonProgress || {}),
      assignment: assignments.find((record) => record.courseId === course.id),
      stored,
      preferredLessonId: getPreferredLessonId(course, stored) ?? getFirstLessonId(course),
    };
  }), [normalizedCourses, assignments, progressRefreshToken]);

  console.log('[ClientCourses] courseSnapshots:', courseSnapshots);
  console.log('[ClientCourses] searchTerm:', searchTerm, 'filterStatus:', filterStatus);

  const filtered = courseSnapshots.filter(({ course, snapshot, assignment }) => {
    const searchMatch = course.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (!searchMatch) return false;
    const status = assignment?.status || (snapshot.overallProgress >= 1 ? 'completed' : snapshot.overallProgress > 0 ? 'in-progress' : 'not-started');
    if (filterStatus === 'all') return true;
    if (filterStatus === 'in-progress') return status === 'in-progress';
    if (filterStatus === 'completed') return status === 'completed';
    if (filterStatus === 'not-started') return status === 'not-started';
    return true;
  });

  console.log('[ClientCourses] filtered:', filtered);

  return (
    <div className="max-w-7xl px-6 py-10 lg:px-12">
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(({ course, snapshot, assignment, preferredLessonId }) => {
          const progress = assignment?.progress ?? Math.round((snapshot.overallProgress || 0) * 100);
          const status = assignment?.status || (snapshot.overallProgress >= 1 ? 'completed' : snapshot.overallProgress > 0 ? 'in-progress' : 'not-started');
          return (
            <Card key={course.id} className="flex h-full flex-col gap-4" data-test="client-course-card">
              <div className="relative overflow-hidden rounded-2xl">
                <img src={course.thumbnail} alt={course.title} className="h-44 w-full object-cover" />
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
                      if (preferredLessonId) {
                        navigate(`/client/courses/${course.slug}/lessons/${preferredLessonId}`);
                      } else {
                        navigate(`/client/courses/${course.slug}`);
                      }
                    }}
                    data-test="client-course-primary"
                  >
                    {status === 'not-started' ? 'Start course' : 'Continue'}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/client/courses/${course.slug}`}>Details</Link>
                  </Button>
                </div>
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
    </div>
  );
};

export default ClientCourses;
