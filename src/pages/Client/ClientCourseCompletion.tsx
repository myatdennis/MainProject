import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Trophy, Clock, BookOpen, Download, Target, Sparkles } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse, type NormalizedCourse, formatMinutes, slugify } from '../../utils/courseNormalization';
import { loadStoredCourseProgress } from '../../utils/courseProgress';
import type { Resource } from '../../types/courseTypes';
import { evaluateCourseAvailability } from '../../utils/courseAvailability';

const DEFAULT_REFLECTIONS = [
  'What is one action you will take this week based on this course?',
  'Who else on your team could benefit from these insights?',
  'How will you keep this learning visible over the next 30 days?'
];

const formatMinutesLabel = (minutes?: number) => {
  if (!minutes || minutes <= 0) return '—';
  return formatMinutes(minutes) ?? `${minutes} min`;
};

const aggregateResources = (course?: NormalizedCourse | null): Resource[] => {
  if (!course) return [];
  const seen = new Map<string, Resource>();

  const push = (resource?: Resource | null) => {
    if (!resource) return;
    const key = resource.id || `${resource.title}-${resource.url ?? resource.downloadUrl ?? ''}`;
    if (!seen.has(key)) {
      seen.set(key, resource);
    }
  };

  (course.modules || []).forEach((module) => {
    (module.resources || []).forEach(push);
    (module.lessons || []).forEach((lesson) => (lesson.resources || []).forEach(push));
  });

  return Array.from(seen.values());
};

const buildLessonTitleMap = (course?: NormalizedCourse | null) => {
  const map = new Map<string, string>();
  if (!course) return map;
  (course.chapters || []).forEach((chapter) => {
    (chapter.lessons || []).forEach((lesson) => {
      map.set(lesson.id, lesson.title);
    });
  });
  return map;
};

const ClientCourseCompletion = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId } = useParams();
  const fromPlayer = location.state?.source === 'player';

  const course = useMemo(() => {
    if (!courseId) return null;
    return courseStore.resolveCourse(courseId);
  }, [courseId]);

  const normalized = useMemo(() => (course ? normalizeCourse(course) : null), [course]);
  const courseSlug = useMemo(() => {
    if (normalized?.slug) return normalized.slug;
    if (courseId) return slugify(courseId);
    return undefined;
  }, [normalized?.slug, courseId]);
  const stored = useMemo(() => (courseSlug ? loadStoredCourseProgress(courseSlug) : null), [courseSlug]);
  const lessonTitleMap = useMemo(() => buildLessonTitleMap(normalized), [normalized]);

  const completionStats = useMemo(() => {
    if (!normalized) {
      return {
        percent: 0,
        completedLessons: 0,
        totalLessons: 0,
        timeSpentLabel: '—',
        lastLessonTitle: undefined,
      };
    }

    const completedLessons = stored?.completedLessonIds?.length ?? 0;
    const totalLessons = normalized.lessons ?? 0;
    const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    const totalSeconds = Object.values(stored?.lessonPositions ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
    const fallbackMinutes = normalized.estimatedDuration ? Math.round(normalized.estimatedDuration) : undefined;
    const timeSpentMinutes = totalSeconds > 0 ? Math.max(1, Math.round(totalSeconds / 60)) : fallbackMinutes;
    const timeSpentLabel = formatMinutesLabel(timeSpentMinutes);

    const lastLessonId = stored?.completedLessonIds?.[stored.completedLessonIds.length - 1];
    const lastLessonTitle = lastLessonId ? lessonTitleMap.get(lastLessonId) : undefined;

    return {
      percent,
      completedLessons,
      totalLessons,
      timeSpentLabel,
      lastLessonTitle,
    };
  }, [normalized, stored, lessonTitleMap]);

  const resources = useMemo(() => aggregateResources(normalized), [normalized]);
  const reflectionPrompts = useMemo(() => {
    if (normalized?.keyTakeaways?.length) {
      return normalized.keyTakeaways.slice(0, 3);
    }
    if (normalized?.learningObjectives?.length) {
      return normalized.learningObjectives.slice(0, 3);
    }
    return DEFAULT_REFLECTIONS;
  }, [normalized]);

  const celebrationCopy = fromPlayer
    ? 'Nice work! Your facilitator can now see this completion and your progress has been synced.'
    : 'Way to go! You can always review lessons or keep the momentum going with the actions below.';

  const availability = useMemo(
    () =>
      evaluateCourseAvailability({
        course: normalized,
        assignmentStatus: course?.assignmentStatus ?? null,
        storedProgress: stored ?? undefined,
      }),
    [normalized, course?.assignmentStatus, stored]
  );

  if (!normalized || availability.isUnavailable) {
    const reasonCopy: Record<string, { title: string; body: string }> = {
      missing: {
        title: 'Course unavailable',
        body: 'The course you’re trying to view may have been unpublished or reassigned. Head back to your catalog to keep learning.',
      },
      unpublished: {
        title: 'Course retired',
        body: 'This course has been unpublished. Your completion is safe, but reach out to your facilitator if you still need access.',
      },
      no_history: {
        title: 'Course not assigned',
        body: 'This completion view is only available for courses assigned to you. Return to your catalog to keep learning.',
      },
    };
    const copy = reasonCopy[availability.reason ?? 'missing'];
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-12">
        <SEO title="Course Completion" description="Congrats! You finished your course." />
        <Breadcrumbs items={[{ label: 'My Courses', to: '/client/courses' }, { label: 'Completion' }]} />
        <Card tone="muted" className="mt-6 space-y-4">
          <h1 className="font-heading text-2xl font-bold text-charcoal">{copy.title}</h1>
          <p className="text-sm text-slate/80">{copy.body}</p>
          <Button size="sm" onClick={() => navigate('/client/courses')}>
            Browse my courses
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-softwhite py-10">
      <SEO title={`Completed • ${normalized.title}`} description="Celebrate your progress and keep the momentum going." />
      <div className="mx-auto max-w-6xl space-y-8 px-6 lg:px-12">
        <Breadcrumbs items={[{ label: 'My Courses', to: '/client/courses' }, { label: normalized.title }, { label: 'Completion' }]} />

        <Card tone="muted" className="rounded-3xl p-6 lg:p-10 space-y-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <Badge tone="info" className="flex w-fit items-center gap-2 bg-skyblue/10 text-skyblue">
                <Sparkles className="h-3.5 w-3.5" />
                Course completion
              </Badge>
              <div>
                <h1 className="font-heading text-3xl font-bold text-charcoal">{normalized.title} is complete</h1>
                <p className="mt-2 text-sm text-slate/80">{celebrationCopy}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate/70">
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {completionStats.timeSpentLabel} invested</span>
                <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {completionStats.completedLessons}/{completionStats.totalLessons} lessons</span>
                {completionStats.lastLessonTitle && (
                  <span className="flex items-center gap-1"><Trophy className="h-4 w-4" /> Last lesson: {completionStats.lastLessonTitle}</span>
                )}
              </div>
            </div>
            <div className="w-full max-w-sm rounded-2xl border border-mist bg-white p-5 shadow-card-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate/60">Overall progress</p>
              <ProgressBar value={completionStats.percent} srLabel="Course completion progress" />
              <div className="mt-3 text-sm text-slate/70 flex items-center justify-between">
                <span>{completionStats.percent}% complete</span>
                <span>{completionStats.completedLessons} lessons</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button size="sm" className="flex-1" onClick={() => navigate('/client/dashboard')}>
                  Go to dashboard
                </Button>
                {normalized.slug && (
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => navigate(`/client/courses/${normalized.slug}`)}>
                    Review course
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {resources.length > 0 && (
          <Card className="space-y-4" tone="muted">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-semibold text-charcoal">Resources to download</h2>
                <p className="text-sm text-slate/70">Keep these materials handy for coaching sessions and team reflections.</p>
              </div>
              <Badge tone="info" className="bg-white text-skyblue">{resources.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {resources.slice(0, 4).map((resource) => (
                <Card key={resource.id ?? resource.title} tone="muted" className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-heading text-sm font-semibold text-charcoal">{resource.title}</p>
                    {resource.description && <p className="text-xs text-slate/70">{resource.description}</p>}
                  </div>
                  {resource.url || resource.downloadUrl ? (
                    <Button asChild size="sm" variant="ghost">
                      <a
                        href={resource.downloadUrl ?? resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  ) : (
                    <Badge tone="neutral">Coming soon</Badge>
                  )}
                </Card>
              ))}
            </div>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card tone="muted" className="space-y-4">
            <h3 className="font-heading text-lg font-semibold text-charcoal">Reflection prompts</h3>
            <ul className="space-y-3">
              {reflectionPrompts.map((prompt, index) => (
                <li key={index} className="flex items-start gap-3 text-sm text-slate/80">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-sunrise/10 text-sunrise">
                    <Target className="h-3.5 w-3.5" />
                  </span>
                  {prompt}
                </li>
              ))}
            </ul>
          </Card>

          <Card tone="muted" className="space-y-4">
            <h3 className="font-heading text-lg font-semibold text-charcoal">What’s next?</h3>
            <ul className="space-y-3 text-sm text-slate/80">
              <li>Share a quick win or takeaway with your facilitator or team.</li>
              <li>Schedule your next coaching session to reinforce the learning.</li>
              <li>Open the LMS dashboard to queue up your next course.</li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={() => navigate('/client/dashboard')}>
                Open dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/lms/dashboard')}>
                Explore LMS
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClientCourseCompletion;
