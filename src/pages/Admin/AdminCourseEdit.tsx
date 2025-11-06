import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, AlertTriangle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import CourseEditModal from '../../components/CourseEditModal';
import { courseStore } from '../../store/courseStore';
import { Course } from '../../types/courseTypes';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/courses';

const AdminCourseEdit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const syncService = useSyncService();

  const [course, setCourse] = useState<Course | null>(null);
  const [builderOpen, setBuilderOpen] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    setCourse(courseStore.getCourse(courseId) || null);
  }, [courseId]);

  const handleSave = async (updatedCourse: Course) => {
    try {
      const snapshot = await syncCourseToDatabase({
        ...updatedCourse,
        lastUpdated: new Date().toISOString(),
      });
      const finalCourse = (snapshot ?? updatedCourse) as Course;
      courseStore.saveCourse(finalCourse, { skipRemoteSync: true });

      syncService.logEvent({
        type: 'course_updated',
        data: finalCourse,
        timestamp: Date.now(),
      });

      showToast('Course updated', 'success');
      setBuilderOpen(false);
      setCourse(courseStore.getCourse(finalCourse.id) || null);
    } catch (err: any) {
      if (err instanceof CourseValidationError) {
        showToast(`Update failed: ${err.issues.join(' • ')}`, 'error');
      } else {
        console.error('Failed to update course', err);
        // Extract detailed error message from API error
        const errorMessage = err?.message || err?.body?.error || 'Could not update course. Please try again.';
        const errorDetails = err?.body?.details;
        const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
        showToast(fullMessage, 'error');
      }
    }
  };

  if (!course) {
    return (
      <Card tone="muted" className="flex flex-col items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sunrise/10 text-sunrise">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold text-charcoal">Course not found</h2>
          <p className="mt-2 text-sm text-slate/80">
            The course you’re trying to edit may have been removed. Return to the course list to create a new one.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/courses')}>
          Back to courses
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card tone="muted" className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white">
            <Pencil className="h-5 w-5" />
          </span>
          <div>
            <Badge tone="info" className="mb-2 bg-skyblue/10 text-skyblue">
              Editing
            </Badge>
            <h1 className="font-heading text-3xl font-bold text-charcoal">{course.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate/80">
              Update the outline, refresh lesson content, or publish changes. Autosave keeps edits safe every ten seconds.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button size="sm" onClick={() => setBuilderOpen(true)}>
            Reopen builder
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/courses/${course.id}/details`)}>
            View course details
          </Button>
        </div>
      </Card>

      <CourseEditModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={handleSave}
        course={course}
        mode="edit"
      />
    </div>
  );
};

export default AdminCourseEdit;
