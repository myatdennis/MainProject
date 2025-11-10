import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Users, Download, Play } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { loadStoredCourseProgress, buildLearnerProgressSnapshot, syncCourseProgressWithRemote } from '../../utils/courseProgress';
import { getAssignment } from '../../utils/assignmentStorage';
import { getPreferredLessonId, getFirstLessonId } from '../../utils/courseNavigation';
import type { CourseAssignment } from '../../types/assignment';
import { useUserProfile } from '../../hooks/useUserProfile';

const ClientCourseDetail = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();

  const { user } = useUserProfile();
  const learnerId = useMemo(() => {
    if (user) return (user.email || user.id).toLowerCase();
    try {
      const raw = localStorage.getItem('huddle_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return (parsed.email || parsed.id || 'local-user').toLowerCase();
      }
    } catch (error) {
      console.warn('Failed to read learner identity (legacy fallback):', error);
    }
    return 'local-user';
  }, [user]);

  const course = courseId ? courseStore.resolveCourse(courseId) : null;
  const normalized = course ? normalizeCourse(course) : null;
  const [assignment, setAssignment] = useState<CourseAssignment | undefined>();
  const normalizedId = normalized?.id;
  const [progressRefreshToken, setProgressRefreshToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchAssignment = async () => {
      if (!normalizedId) return;
      try {
        const record = await getAssignment(normalizedId, learnerId);
        if (isMounted) {
          setAssignment(record);
        }
      } catch (error) {
        console.error('Failed to load assignment:', error);
        if (isMounted) {
          setAssignment(undefined);
        }
      }
    };

    void fetchAssignment();

    return () => {
      isMounted = false;
    };
  }, [normalizedId, learnerId]);

  useEffect(() => {
    let isMounted = true;
    const syncProgress = async () => {
      if (!normalized) return;
      const lessonIds =
        normalized.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
      if (!lessonIds.length) return;

      const result = await syncCourseProgressWithRemote({
        courseSlug: normalized.slug,
        courseId: normalized.id,
        userId: learnerId,
        lessonIds,
      });

      if (isMounted && result) {
        setProgressRefreshToken((token) => token + 1);
      }
    };

    void syncProgress();
    return () => {
      isMounted = false;
    };
  }, [normalized, learnerId]);

  const storedProgress = useMemo(
    () =>
      normalized
        ? loadStoredCourseProgress(normalized.slug)
        : { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} },
    [normalized?.slug, progressRefreshToken]
  );
  const snapshot = useMemo(
    () =>
      normalized
        ? buildLearnerProgressSnapshot(
            normalized,
            new Set(storedProgress.completedLessonIds),
            storedProgress.lessonProgress || {}
          )
        : null,
    [normalized, storedProgress]
  );
  const progressPercent = assignment?.progress ?? Math.round(((snapshot?.overallProgress ?? 0) || 0) * 100);
  const preferredLessonId = normalized
    ? getPreferredLessonId(normalized, storedProgress) ?? getFirstLessonId(normalized)
    : undefined;

  const handleLaunchCourse = () => {
    if (normalized && preferredLessonId) {
      navigate(`/client/courses/${normalized.slug}/lessons/${preferredLessonId}`);
    } else {
      navigate(`/client/courses/${normalized?.slug ?? courseId}`);
    }
  };

  if (!normalized || !snapshot) {
    return (
      <div className="max-w-3xl px-6 py-12 lg:px-12">
        <Card tone="muted" className="space-y-4">
          <h1 className="font-heading text-2xl font-bold text-charcoal">Course not found</h1>
          <p className="text-sm text-slate/80">The course you’re looking for might have been removed or is not published yet.</p>
          <Button size="sm" onClick={() => navigate('/client/courses')}>
            Back to courses
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-10 lg:px-12">
      <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/client/courses')}>
        Back to courses
      </Button>

      <Card tone="muted" className="space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Badge tone="info" className="bg-skyblue/10 text-skyblue">{normalized.difficulty}</Badge>
            <h1 className="font-heading text-3xl font-bold text-charcoal">{normalized.title}</h1>
            <p className="max-w-3xl text-sm text-slate/80">{normalized.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-slate/70">
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {normalized.duration}</span>
              <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {(normalized.chapters || []).reduce((sum, chapter) => sum + chapter.lessons.length, 0)} lessons</span>
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {normalized.enrollments || 0} learners enrolled</span>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-mist bg-white p-4 shadow-card-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate/70">Your progress</p>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl font-bold text-charcoal">{progressPercent}%</span>
              <span className="text-xs text-slate/70">complete</span>
            </div>
            <Button size="sm" className="w-full" onClick={handleLaunchCourse}>
              {assignment?.status === 'completed' ? 'Review lessons' : progressPercent > 0 ? 'Continue learning' : 'Start course'}
            </Button>
          </div>
        </div>
      </Card>

      <Card tone="muted" className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-charcoal">Modules</h2>
        <div className="space-y-3">
          {(normalized.chapters || []).map((chapter) => (
            <Card key={chapter.id} tone="muted" className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading text-sm font-semibold text-charcoal">{chapter.title}</p>
                  <p className="text-xs text-slate/70">{chapter.description}</p>
                </div>
                <Badge tone="info" className="bg-white text-skyblue">{chapter.lessons.length} lessons</Badge>
              </div>
              <ul className="space-y-1 text-xs text-slate/70">
                {chapter.lessons.map((lesson) => (
                  <li key={lesson.id} className="flex items-center gap-2"><Play className="h-3 w-3" /> {lesson.title}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {(normalized.keyTakeaways || []).map((item, index) => (
            <Badge key={index} tone="info" className="bg-sunrise/10 text-sunrise">{item}</Badge>
          ))}
        </div>
        {preferredLessonId && (
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              leadingIcon={<Play className="h-4 w-4" />}
              onClick={handleLaunchCourse}
            >
              Resume lesson
            </Button>
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
              onClick={() => navigate(`/client/courses/${normalized.slug}/lessons/${preferredLessonId}`)}
            >
              Open lesson view
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Download className="h-4 w-4" />}
            onClick={() => navigate(`/lms/course/${normalized.slug}`)}
          >
            Download resources in LMS
          </Button>
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="h-4 w-4" />}
            onClick={() => navigate(`/lms/course/${normalized.slug}`)}
          >
            View full LMS experience
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ClientCourseDetail;
