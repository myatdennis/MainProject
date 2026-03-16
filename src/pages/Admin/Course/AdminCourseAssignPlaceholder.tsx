import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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

  return null;
};

export default AdminCourseAssignPlaceholder;

