import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import CourseEditModal from '../../components/CourseEditModal';
import { courseStore } from '../../store/courseStore';
import { Course } from '../../types/courseTypes';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/courses';

const AdminCourseCreate = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const syncService = useSyncService();

  const [builderOpen, setBuilderOpen] = useState(true);

  const handleSave = async (course: Course) => {
    try {
      const snapshot = await syncCourseToDatabase({
        ...course,
        status: course.status || 'draft',
        lastUpdated: new Date().toISOString(),
      });
      const created = (snapshot ?? course) as Course;
      courseStore.saveCourse(created, { skipRemoteSync: true });

      syncService.logEvent({
        type: 'course_created',
        data: created,
        timestamp: Date.now(),
      });

      showToast('Course saved successfully', 'success');
      navigate(`/admin/courses/${created.id}/details`);
    } catch (err) {
      if (err instanceof CourseValidationError) {
        showToast(`Save failed: ${err.issues.join(' • ')}`, 'error');
      } else {
        console.error('Failed to save course', err);
        showToast('Could not save course. Please try again.', 'error');
      }
    }
  };

  return (
    <div className="space-y-8">
      <Card tone="muted" className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <Badge tone="info" className="mb-2 bg-skyblue/10 text-skyblue">
              Course Builder
            </Badge>
            <h1 className="font-heading text-3xl font-bold text-charcoal">Create a new learning experience</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate/80">
              Draft the course outline, add lessons, and publish when you’re ready. Autosave keeps edits safe every time you
              pause for more than ten seconds.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button size="sm" leadingIcon={<Sparkles className="h-4 w-4" />} onClick={() => setBuilderOpen(true)}>
            Launch builder
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/courses')}>
            Back to courses
          </Button>
        </div>
      </Card>

      <CourseEditModal isOpen={builderOpen} onClose={() => setBuilderOpen(false)} onSave={handleSave} mode="create" />
    </div>
  );
};

export default AdminCourseCreate;
