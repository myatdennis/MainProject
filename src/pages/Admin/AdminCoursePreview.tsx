import { useParams, Link, useNavigate } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';

const AdminCoursePreview = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SEO title="Admin - Course Preview" description="Preview how this course appears to learners." />
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Courses', to: '/admin/courses' }, { label: 'Preview', to: `/admin/courses/${courseId}/preview` }]} />
      <div className="mt-4">
        <h1 className="text-2xl font-bold text-gray-900">Course Preview</h1>
        <p className="text-sm text-gray-600 mt-1">Quick look at the learner-facing presentation for course <span className="font-mono text-gray-800">{courseId}</span>.</p>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
        <Card tone="muted" className="h-full">
          <div className="space-y-3">
            <p className="text-sm text-slate/80">Use these actions to manage this course.</p>
            <div className="flex flex-col gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link to="/admin/courses">Back to Courses</Link>
              </Button>
              <Button size="sm" onClick={() => navigate(`/admin/courses/${courseId}/edit`)}>Edit Course</Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/courses/${courseId}/assign`)}>Assign Course</Button>
            </div>
          </div>
        </Card>
        <Card padding="lg" className="min-h-[280px]">
          <div className="text-sm text-slate/80">
            This is a lightweight preview placeholder. To view a full learner experience, open the course from the client catalog or use the player routes. You can wire a dedicated preview here later.
          </div>
          <div className="mt-4">
            <Button asChild variant="ghost" size="sm">
              <Link to={`/client/courses/${courseId}`}>Open client course overview →</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminCoursePreview;
