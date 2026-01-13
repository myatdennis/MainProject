import { Navigate, useParams } from 'react-router-dom';

const AdminCourseEdit = () => {
  const { courseId } = useParams();

  if (!courseId) {
    return <Navigate to="/admin/courses" replace />;
  }

  return <Navigate to={`/admin/course-builder/${courseId}`} replace />;
};

export default AdminCourseEdit;
