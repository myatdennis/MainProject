import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import Card from '../../../components/ui/Card';
import { useToast } from '../../../context/ToastContext';

const AdminCourseBulkPlaceholder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const selectedIds = searchParams.get('ids');

  useEffect(() => {
    showToast(
      'Bulk course assignment is disabled in production until the workflow is fully implemented. Use the supported Assign action from each course row instead.',
      'info',
      5000,
    );
  }, [showToast]);

  const returnHref = '/admin/courses';

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        to={returnHref}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Courses
      </Link>
      <Card tone="muted" className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 rounded-full p-3">
            <Users className="h-6 w-6 text-orange-600" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-charcoal">Bulk Assignment Unavailable</h1>
        </div>
        <p className="text-sm text-slate/80">
          This route is intentionally disabled in production because the bulk assignment flow is not complete.
          Use the supported <strong>Assign</strong> action from an individual course row instead.
        </p>
        {selectedIds ? (
          <p className="text-xs text-slate/70">
            Ignored selected course ids: <span className="font-mono">{selectedIds}</span>
          </p>
        ) : null}
        <div className="flex gap-3">
          <Link
            to={returnHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            Go to Courses
          </Link>
          <button
            type="button"
            onClick={() => navigate(returnHref, { replace: true })}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </Card>
    </div>
  );
};

export default AdminCourseBulkPlaceholder;
