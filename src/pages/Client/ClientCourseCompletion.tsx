import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { loadStoredCourseProgress } from '../../utils/courseProgress';

const ClientCourseCompletion = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();

  const course = useMemo(() => {
    if (!courseId) return null;
    return courseStore.resolveCourse(courseId);
  }, [courseId]);

  const normalized = useMemo(() => (course ? normalizeCourse(course) : null), [course]);
  const stored = useMemo(() => (normalized ? loadStoredCourseProgress(normalized.slug) : null), [normalized]);

  const percent = useMemo(() => {
    if (!stored || !normalized) return 0;
    const lessonIds = new Set(stored.completedLessonIds);
    const total = normalized.lessons || 0;
    return total > 0 ? Math.round((lessonIds.size / total) * 100) : 0;
  }, [stored, normalized]);

  const goBack = () => navigate('/client/courses');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <SEO title="Course Completion" description="Congrats! You finished your course." />
      <Breadcrumbs items={[{ label: 'My Courses', to: '/client/courses' }, { label: 'Completion', to: `/client/courses/${courseId}/completion` }]} />
      <Card tone="muted" className="mt-4 space-y-3">
        <h1 className="font-heading text-2xl font-bold text-charcoal">{normalized?.title || 'Course'} — Completion</h1>
        <p className="text-sm text-slate/80">Great work! You completed {percent}% of this course.</p>
        <div className="flex gap-2 pt-2">
          <Button onClick={goBack}>Back to My Courses</Button>
          {normalized?.slug && (
            <Button variant="ghost" onClick={() => navigate(`/client/courses/${normalized.slug}`)}>View Course Overview</Button>
          )}
        </div>
      </Card>
      {!normalized && (
        <div className="mt-6">
          <Card tone="muted">
            <p className="text-sm text-slate/80">This course may have been unpublished. You can browse your catalog to continue learning.</p>
            <div className="mt-3">
              <Button variant="ghost" onClick={goBack}>Go to My Courses</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ClientCourseCompletion;
