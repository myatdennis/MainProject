import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import ClientErrorBoundary from '../../components/ClientErrorBoundary';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import CourseCompletion from '../../components/CourseCompletion';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse, type NormalizedCourse } from '../../utils/courseNormalization';
import { loadStoredCourseProgress } from '../../utils/courseProgress';
import { trackEvent } from '../../dal/analytics';
import { useUserProfile } from '../../hooks/useUserProfile';

const LMSCourseCompletion = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<NormalizedCourse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { user } = useUserProfile();
  const learnerIdentity = useMemo(() => {
    const fallback = { id: 'local-user', email: 'demo@learner.com', name: 'Learner' };
    if (!user) {
      return fallback;
    }
    const id = (user.email || user.id || fallback.id).toLowerCase();
    const email = user.email || fallback.email;
    const derivedName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const name = derivedName || user.email || fallback.name;
    return { id, email, name };
  }, [user]);
  const learnerId = learnerIdentity.id;

  useEffect(() => {
    const resolveCourse = () => {
      if (!courseId) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      const rawCourse = courseStore.resolveCourse(courseId) || courseStore.getCourse(courseId);
      if (!rawCourse) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setCourse(normalizeCourse(rawCourse));
      setIsLoading(false);
    };

    resolveCourse();
  }, [courseId]);

  const storedProgress = useMemo(() => {
    if (!course) return null;
    return loadStoredCourseProgress(course.slug);
  }, [course]);

  const completedLessonIds = useMemo(() => {
    if (!storedProgress) return new Set<string>();
    return new Set(storedProgress.completedLessonIds);
  }, [storedProgress]);

  const totalLessonCount = useMemo(() => {
    if (!course) return 0;
    return course.modules?.reduce((sum, module) => sum + (module.lessons?.length ?? 0), 0) ?? 0;
  }, [course]);

  const isCourseComplete = totalLessonCount > 0 && completedLessonIds.size >= totalLessonCount;

  const completionCourse = useMemo(() => {
    if (!course) return null;

    return {
      ...course,
      modules: course.modules?.map((module) => ({
        ...module,
        lessons: (module.lessons ?? []).map((lesson) => ({
          ...lesson,
          completed: completedLessonIds.has(lesson.id),
        })),
      })),
    };
  }, [course, completedLessonIds]);

  const completionData = useMemo(() => {
    if (!storedProgress || !course) {
      return null;
    }

    const totalSeconds = Object.values(storedProgress.lessonPositions ?? {}).reduce(
      (sum, value) => sum + Math.max(0, Math.round(value ?? 0)),
      0,
    );

    return {
      completedAt: new Date(),
      timeSpent: Math.max(1, Math.round(totalSeconds / 60)),
      score: undefined,
      grade: undefined,
      certificateId: undefined,
      certificateUrl: undefined,
    } as const;
  }, [storedProgress, course]);

  const keyTakeaways = completionCourse?.keyTakeaways?.length
    ? completionCourse.keyTakeaways
    : [
        'Keep modeling inclusion in every conversation.',
        'Share your learnings with your team this week.',
      ];

  const recommendedCourses = useMemo(() => {
    const publishedCourses = courseStore
      .getAllCourses()
      .filter((entry) => entry.id !== course?.id && entry.status === 'published')
      .slice(0, 3)
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        thumbnail: entry.thumbnail,
        duration: entry.duration,
        difficulty: entry.difficulty,
      }));

    return publishedCourses;
  }, [course?.id]);

  const nextSteps = useMemo(() => [
    {
      title: 'Download your certificate',
      description: 'Head to the Certificates tab any time to grab a fresh copy.',
      action: () => navigate('/lms/certificates'),
    },
    {
      title: 'Pick your next course',
      description: 'Keep your momentum going with another bite-sized program.',
      action: () => navigate('/lms/courses'),
    },
  ], [navigate]);

  const handleCompletionClose = useCallback(() => {
    trackEvent('navigation_click', learnerId, { context: 'completion-exit' }, course?.id);
    navigate('/lms/courses');
  }, [course?.id, learnerId, navigate]);

  const handleCertificateDownload = useCallback(() => {
    trackEvent('download_resource', learnerId, { resource: 'certificate', courseTitle: course?.title }, course?.id);
    navigate('/lms/certificates');
  }, [course?.id, course?.title, learnerId, navigate]);

  const handleShareComplete = useCallback(
    (platform: string) => {
      trackEvent(
        'external_link_click',
        learnerId,
        { context: 'completion-share', platform },
        course?.id,
      );
    },
    [course?.id, learnerId],
  );

  if (isLoading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="container-page section">
        <Card tone="muted" className="mx-auto max-w-xl space-y-4 text-center">
          <h2 className="font-heading text-xl font-semibold text-charcoal">Course not found</h2>
          <p className="text-sm text-slate/80">The completion summary you’re looking for isn’t available.</p>
          <Button size="sm" onClick={() => navigate('/lms/courses')}>
            Back to courses
          </Button>
        </Card>
      </div>
    );
  }

  if (!isCourseComplete || !completionCourse || !completionData) {
  const firstModuleId = completionCourse?.modules?.[0]?.id;
    return (
      <div className="container-page section">
        <Card tone="muted" className="mx-auto max-w-2xl space-y-4 text-center">
          <h2 className="font-heading text-2xl font-semibold text-charcoal">Almost there!</h2>
          <p className="text-sm text-slate/80">
            Finish the remaining lessons to unlock your celebration screen and certificate.
          </p>
          <div className="flex justify-center gap-3">
            <Button size="sm" onClick={() => navigate(firstModuleId ? `/lms/courses/${firstModuleId}` : '/lms/courses')}>
              Resume course
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate('/lms/courses')}>
              Browse courses
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <ClientErrorBoundary>
      <div className="min-h-screen bg-softwhite">
        <div className="container-page section">
          <Breadcrumbs
            items={[
              { label: 'Courses', to: '/lms/courses' },
              { label: course.title, to: `/lms/courses/${completionCourse.modules?.[0]?.id ?? ''}` },
              { label: 'Completion' },
            ]}
          />

          <CourseCompletion
            course={{
              id: completionCourse.id,
              title: completionCourse.title,
              description: completionCourse.description,
              thumbnail: completionCourse.thumbnail,
              instructor: completionCourse.createdBy,
              duration: completionCourse.duration,
              modules: completionCourse.modules?.map((module) => ({
                id: module.id,
                title: module.title,
                lessons: module.lessons?.map((lesson) => ({
                  id: lesson.id,
                  title: lesson.title,
                  completed: completedLessonIds.has(lesson.id),
                })) ?? [],
              })),
            }}
            completionData={{
              completedAt: completionData.completedAt,
              timeSpent: completionData.timeSpent,
              score: completionData.score,
              grade: completionData.grade,
              certificateId: completionData.certificateId,
              certificateUrl: completionData.certificateUrl,
            }}
            keyTakeaways={keyTakeaways}
            nextSteps={nextSteps}
            recommendedCourses={recommendedCourses}
            onClose={handleCompletionClose}
            onCertificateDownload={handleCertificateDownload}
            onShareComplete={handleShareComplete}
            className="mt-10"
          />
        </div>
      </div>
    </ClientErrorBoundary>
  );
};

export default LMSCourseCompletion;
