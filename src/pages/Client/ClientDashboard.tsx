import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Clock, Users, Award } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { getAssignmentsForUser } from '../../utils/assignmentStorage';
import {
  syncCourseProgressWithRemote,
  loadStoredCourseProgress,
  buildLearnerProgressSnapshot,
} from '../../utils/courseProgress';
import { getPreferredLessonId, getFirstLessonId } from '../../utils/courseNavigation';
import { syncService } from '../../dal/sync';
import type { CourseAssignment } from '../../types/assignment';

const ClientDashboard = () => {
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
  const [progressRefreshToken, setProgressRefreshToken] = useState(0);

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

  const courses = useMemo(
    () =>
      assignments
        .map((record) => courseStore.getCourse(record.courseId))
        .filter(Boolean)
        .map((course) => normalizeCourse(course!)),
    [assignments]
  );

  useEffect(() => {
    let isMounted = true;

    const syncProgress = async () => {
      if (!courses.length) return;
      const results = await Promise.all(
        courses.map(async (course) => {
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
  }, [courses, learnerId]);

  const courseDetails = useMemo(() => courses.map((course) => {
    const stored = loadStoredCourseProgress(course.slug);
    const snapshot = buildLearnerProgressSnapshot(
      course,
      new Set(stored.completedLessonIds),
      stored.lessonProgress || {},
      stored.lessonPositions || {}
    );
    const assignment = assignments.find((record) => record.courseId === course.id);
    const progressPercent = (assignment?.progress ?? 0) || Math.round((snapshot.overallProgress || 0) * 100);
    const preferredLessonId = getPreferredLessonId(course, stored) ?? getFirstLessonId(course);

    return {
      course,
      snapshot,
      assignment,
      stored,
      progressPercent,
      preferredLessonId,
    };
  }), [assignments, courses, progressRefreshToken]);

  const completedCount = assignments.filter((record) => record.status === 'completed').length;
  const inProgressCount = assignments.filter((record) => record.status === 'in-progress').length;

  return (
    <div className="max-w-7xl px-6 py-10 lg:px-12">
      <Card tone="gradient" withBorder={false} className="overflow-hidden">
        <div className="relative z-10 flex flex-col gap-4 text-charcoal md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone="info" className="bg-white/80 text-skyblue">
              Client Portal
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold md:text-4xl">Welcome back</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate/80">
              Track assigned courses, follow due dates, and jump back into lessons in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
              onClick={() => navigate('/lms/dashboard')}
            >
              Go to full learning hub
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card tone="muted" className="text-center py-6">
          <div className="font-heading text-3xl font-bold text-charcoal">{assignments.length}</div>
          <p className="text-xs uppercase tracking-wide text-slate/70">Assigned courses</p>
        </Card>
        <Card tone="muted" className="text-center py-6">
          <div className="font-heading text-3xl font-bold text-charcoal">{completedCount}</div>
          <p className="text-xs uppercase tracking-wide text-slate/70">Completed</p>
        </Card>
        <Card tone="muted" className="text-center py-6">
          <div className="font-heading text-3xl font-bold text-charcoal">{inProgressCount}</div>
          <p className="text-xs uppercase tracking-wide text-slate/70">In progress</p>
        </Card>
        <Card tone="muted" className="space-y-2 py-6">
          <p className="text-xs uppercase tracking-wide text-slate/70">Quick actions</p>
          <Button size="sm" className="w-full" onClick={() => navigate('/client/courses')}>
            Browse courses
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/lms/dashboard')}>
            Continue learning
          </Button>
        </Card>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-charcoal">Assigned courses</h2>
            <Badge tone="info" className="bg-skyblue/10 text-skyblue">{assignments.length}</Badge>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-slate/70">No assignments yet. Your facilitator will share programs here soon.</p>
          ) : (
            <div className="space-y-3">
              {courseDetails.map(({ course, assignment, progressPercent, preferredLessonId }) => {
                return (
                  <Card key={course.id} tone="muted" className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-heading text-sm font-semibold text-charcoal">{course.title}</p>
                        <p className="text-xs text-slate/70">Due {assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '—'}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (preferredLessonId) {
                            navigate(`/client/courses/${course.slug}/lessons/${preferredLessonId}`);
                          } else {
                            navigate(`/client/courses/${course.slug}`);
                          }
                        }}
                      >
                        Open
                      </Button>
                    </div>
                    <ProgressBar value={progressPercent} srLabel={`${course.title} completion`} />
                  </Card>
                );
              })}
            </div>
          )}
        </Card>

        <Card tone="muted" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sunrise/10 text-sunrise">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold text-charcoal">Stay connected</h3>
              <p className="text-xs text-slate/70">Use the full LMS to access discussions, resources, and certificates.</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate/80">
            <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> Resume lessons exactly where you left off.</li>
            <li className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Access downloadable resources and transcripts.</li>
            <li className="flex items-center gap-2"><Award className="h-4 w-4" /> Earn certificates when you finish programs.</li>
          </ul>
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            onClick={() => navigate('/lms/dashboard')}
          >
            Go to LMS
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default ClientDashboard;
