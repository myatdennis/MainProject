import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Card from '../../../components/ui/Card';
import Loading from '../../../components/ui/Loading';

/**
 * AdminCourseAssignPlaceholder — redirects to the course detail page
 * where the inline assign modal can be triggered.
 */
const AdminCourseAssignPlaceholder = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (courseId) {
      navigate(`/admin/courses/${courseId}/details`, { replace: true });
    } else {
      navigate('/admin/courses', { replace: true });
    }
  }, [courseId, navigate]);

  const targetHref = courseId ? `/admin/courses/${courseId}/details` : '/admin/courses';

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-6 py-12">
      <Card tone="muted" className="w-full text-center" padding="lg">
        <div className="mx-auto mb-4 flex justify-center">
          <Loading size="md" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-charcoal">Opening assignment workspace</h1>
        <p className="mt-2 text-sm text-slate/75">
          We&apos;re redirecting you to the course details view so you can assign learners and organizations.
        </p>
        <div className="mt-4">
          <Link to={targetHref} className="text-sm font-medium text-skyblue hover:underline">
            Continue manually
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default AdminCourseAssignPlaceholder;

