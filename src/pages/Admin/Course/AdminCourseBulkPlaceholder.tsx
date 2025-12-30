import Card from '../../../components/ui/Card';

const AdminCourseBulkPlaceholder = () => (
  <div className="mx-auto max-w-4xl px-6 py-12">
    <Card tone="muted" className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-charcoal">Bulk assign courses</h1>
      <p className="text-sm text-slate/80">
        This route will host the full bulk-assignment workflow. For now, select courses in the table
        and use the inline "Assign" action to keep learners in sync.
      </p>
    </Card>
  </div>
);

export default AdminCourseBulkPlaceholder;
