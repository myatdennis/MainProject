import { Link } from 'react-router-dom';
import { Users, ArrowLeft } from 'lucide-react';
import Card from '../../../components/ui/Card';

const AdminCourseBulkPlaceholder = () => (
  <div className="mx-auto max-w-2xl px-6 py-12">
    <Link
      to="/admin/courses"
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
        <h1 className="font-heading text-2xl font-bold text-charcoal">Bulk Assign Courses</h1>
      </div>
      <p className="text-sm text-slate/80">
        Bulk assignment is coming soon. In the meantime, you can assign courses to individual learners
        or entire organizations using the inline <strong>Assign</strong> button on each course row.
      </p>
      <Link
        to="/admin/courses"
        className="inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
      >
        Go to Courses →
      </Link>
    </Card>
  </div>
);

export default AdminCourseBulkPlaceholder;

