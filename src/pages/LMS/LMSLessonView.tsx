import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { buildLearnerProgressSnapshot, loadStoredCourseProgress } from '../../utils/courseProgress';
import CoursePlayer from '../../components/CoursePlayer/CoursePlayer';

const LMSLessonView = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();

  const resolvedCourse = useMemo(() => {
    if (!courseId) return null;
    return courseStore.resolveCourse(courseId);
  }, [courseId]);

  const normalizedCourse = useMemo(() => {
    return resolvedCourse ? normalizeCourse(resolvedCourse) : null;
  }, [resolvedCourse]);

  const storedProgress = useMemo(() => {
    if (!normalizedCourse) {
      return null;
    }
    return loadStoredCourseProgress(normalizedCourse.slug);
  }, [normalizedCourse]);

  const learnerSnapshot = useMemo(() => {
    if (!normalizedCourse || !storedProgress) {
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

  const handleBackToCourse = () => {
    if (normalizedCourse?.slug) {
      navigate(`/lms/courses/${normalizedCourse.slug}`);
      return;
    }
    navigate('/lms/courses');
  };

  if (!resolvedCourse || !normalizedCourse) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-12 lg:px-12">
        <Card tone="muted" className="space-y-4 text-center">
          <h1 className="font-heading text-2xl font-bold text-charcoal">Course not available</h1>
          <p className="text-sm text-slate/80">
            We couldn’t find the course you were trying to open. It might have been unpublished or reassigned.
          </p>
          <Button size="sm" onClick={() => navigate('/lms/courses')}>
            Browse courses
          </Button>
        </Card>
      </div>
    );
  }

  const lessonCount = (normalizedCourse.modules || []).reduce((count, module) => {
    return count + (module.lessons?.length ?? 0);
  }, 0);
  const durationLabel = normalizedCourse.duration || 'Self-paced';

  return (
    <div className="bg-softwhite">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={handleBackToCourse}
        >
          Back to course
        </Button>

        <Card tone="muted" className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge tone="info" className="bg-sunrise/10 text-sunrise">In progress</Badge>
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

        <div className="mt-8 overflow-hidden rounded-3xl border border-mist bg-white shadow-card-lg">
          <CoursePlayer namespace="admin" />
        </div>
      </div>
    </div>
  );
};

export default LMSLessonView;
