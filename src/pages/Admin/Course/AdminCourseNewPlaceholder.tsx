import Card from '../../../components/ui/Card';

const AdminCourseNewPlaceholder = () => (
  <div className="mx-auto max-w-4xl px-6 py-12">
    <Card tone="muted" className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-charcoal">Create a new course</h1>
      <p className="text-sm text-slate/80">
        Use the Course Builder to create full learning experiences. This placeholder keeps the existing
        navigation working while the drag-and-drop builder continues to evolve.
      </p>
    </Card>
  </div>
);

export default AdminCourseNewPlaceholder;
