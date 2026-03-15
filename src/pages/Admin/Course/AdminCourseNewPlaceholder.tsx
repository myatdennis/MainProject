import { Navigate } from 'react-router-dom';

// /admin/courses/new redirects to the full Course Builder
const AdminCourseNewPlaceholder = () => <Navigate to="/admin/course-builder/new" replace />;

export default AdminCourseNewPlaceholder;
