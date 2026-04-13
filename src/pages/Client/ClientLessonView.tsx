import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import AsyncStatePanel from '../../components/system/AsyncStatePanel';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse, slugify } from '../../utils/courseNormalization';
import { loadStoredCourseProgress, buildLearnerProgressSnapshot } from '../../utils/courseProgress';
import CoursePlayer from '../../components/CoursePlayer/CoursePlayer';
import { evaluateCourseAvailability } from '../../utils/courseAvailability';
import { loadCourse } from '../../dal/courseData';

const ClientLessonView = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [remoteCourse, setRemoteCourse] = useState<any | null>(null);
  const [remoteCourseLoading, setRemoteCourseLoading] = useState(false);
  const [remoteCourseError, setRemoteCourseError] = useState<string | null>(null);

  const resolvedCourse = useMemo(() => {
    if (!courseId) return null;
    return courseStore.resolveCourse(courseId);
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;

    if (!courseId || resolvedCourse) {
      setRemoteCourse(null);
      setRemoteCourseLoading(false);
      setRemoteCourseError(null);
      return () => {
        cancelled = true;
      };
    }

    setRemoteCourseLoading(true);
    setRemoteCourseError(null);
    void loadCourse(courseId, { includeDrafts: false, preferRemote: true })
      .then((result) => {
        if (cancelled) return;
        setRemoteCourse(result?.course ?? null);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[ClientLessonView] failed to load course from remote source', {
          courseId,
          error: message,
        });
        setRemoteCourse(null);
        setRemoteCourseError(message || 'Unable to load this course right now.');
      })
      .finally(() => {
        if (!cancelled) {
          setRemoteCourseLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, resolvedCourse]);

  const displayCourse = resolvedCourse ?? remoteCourse;

  const normalizedCourse = useMemo(() => {
    return displayCourse ? normalizeCourse(displayCourse) : null;
  }, [displayCourse]);

  const courseSlug = useMemo(() => {
    if (normalizedCourse?.slug) return normalizedCourse.slug;
    if (courseId) return slugify(courseId);
    return undefined;
  }, [normalizedCourse?.slug, courseId]);

  const storedProgress = useMemo(() => {
    return loadStoredCourseProgress(courseSlug);
  }, [courseSlug]);

  const learnerSnapshot = useMemo(() => {
    if (!normalizedCourse) {
      return null;
    }
    return buildLearnerProgressSnapshot(
      normalizedCourse,
      new Set(storedProgress.completedLessonIds),
      storedProgress.lessonProgress || {},
      storedProgress.lessonPositions || {}
    );
  }, [normalizedCourse, storedProgress]);

  const progressPercent = learnerSnapshot ? Math.round((learnerSnapshot.overallProgress || 0) * 100) : 0;

  const availability = useMemo(
    () =>
      evaluateCourseAvailability({
        course: normalizedCourse,
        assignmentStatus:
          displayCourse?.assignmentStatus ??
          (remoteCourse && !resolvedCourse ? 'assigned' : null),
        storedProgress,
      }),
    [displayCourse, normalizedCourse, remoteCourse, resolvedCourse, storedProgress]
  );

  const handleBackToCourse = () => {
    if (normalizedCourse?.slug) {
      navigate(`/client/courses/${normalizedCourse.slug}`);
      return;
    }
    navigate('/client/courses');
  };

  if (remoteCourseLoading && !normalizedCourse) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-12 lg:px-12">
        <AsyncStatePanel state="loading" loadingLabel="Loading lesson..." className="w-full" />
      </div>
    );
  }

  if (remoteCourseError && !normalizedCourse) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-12 lg:px-12">
        <AsyncStatePanel
          state="error"
          title="Unable to load this lesson"
          message="We couldn’t fetch the course details right now. Check your connection and try again."
          retryLabel="Back to courses"
          onRetry={() => navigate('/client/courses')}
          secondaryActionLabel="Refresh page"
          onSecondaryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  if (availability.isUnavailable || !normalizedCourse) {
    const reasonCopy: Record<string, { title: string; body: string }> = {
      missing: {
        title: 'Course not available',
        body: 'We couldn’t find the course you were trying to open. It may have been unpublished or reassigned.',
      },
      unpublished: {
        title: 'Course offline',
        body: 'This course is currently unpublished. Reach out to your facilitator if you still need access.',
      },
      no_history: {
        title: 'Course not assigned',
        body: 'This course isn’t assigned to you yet. Head back to your catalog to continue learning.',
      },
    };
    const copy = reasonCopy[availability.reason ?? 'missing'];
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-12 lg:px-12">
        <Card tone="muted" className="space-y-4">
          <h1 className="font-heading text-2xl font-bold text-charcoal">{copy.title}</h1>
          <p className="text-sm text-slate/80">{copy.body}</p>
          <Button size="sm" onClick={() => navigate('/client/courses')}>
            Browse my courses
          </Button>
        </Card>
      </div>
    );
  }

  const difficultyLabel = normalizedCourse.difficulty || 'Program';
  const lessonCount = (normalizedCourse.chapters || []).reduce(
    (total, chapter) => total + chapter.lessons.length,
    0
  );
  const durationLabel = normalizedCourse.duration || 'Self-paced';

  return (
    <div className="bg-mist/30">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={handleBackToCourse}
        >
          Back to course overview
        </Button>

        <Card tone="muted" className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge tone="info" className="bg-skyblue/10 text-skyblue">{difficultyLabel}</Badge>
            <h1 className="font-heading text-2xl font-bold text-charcoal">{normalizedCourse.title}</h1>
            <div className="flex flex-wrap gap-4 text-xs text-slate/70">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {durationLabel}
              </span>
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {lessonCount} lessons
              </span>
            </div>
          </div>
          <div className="w-full max-w-xs space-y-3 rounded-2xl border border-mist bg-white p-4 shadow-card-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate/70">Overall progress</p>
            <ProgressBar value={progressPercent} srLabel="Course completion progress" />
            <p className="text-xs text-slate/70">
              {progressPercent >= 100 ? 'Completed' : `${progressPercent}% complete`}
            </p>
          </div>
        </Card>

        {availability.isReadOnly && (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">
              {availability.reason === 'unpublished' ? 'This course is no longer active' : 'Course completed'}
            </p>
            <p className="text-emerald-800">
              {availability.reason === 'unpublished'
                ? 'This course is no longer being actively assigned, but you can still revisit every lesson whenever you’d like.'
                : 'You’ve finished this course, but the full content stays available so you can review or rewatch anything at any time.'}
            </p>
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-3xl border border-mist bg-white shadow-card-lg">
          <CoursePlayer namespace="client" />
        </div>
      </div>
    </div>
  );
};

export default ClientLessonView;
