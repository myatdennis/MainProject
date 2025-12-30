import Card from '../../../components/ui/Card';

const AdminCourseImportPlaceholder = () => (
  <div className="max-w-3xl mx-auto px-6 py-10">
    <Card tone="muted" className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-charcoal">Import courses</h1>
      <p className="text-sm text-slate/80">
        Tie this screen into the CSV/import pipeline when ready. For now, admins can use scripts or contact support.
      </p>
    </Card>
  </div>
);

export default AdminCourseImportPlaceholder;
