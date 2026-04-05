import { useEffect } from 'react';
import AdminCourseBuilder from '../../pages/Admin/AdminCourseBuilder';

/**
 * @deprecated Legacy builder path retained as a compatibility shim.
 * All behavior is now delegated to the canonical AdminCourseBuilder.
 */
const AdvancedCourseBuilder = () => {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn('[AdvancedCourseBuilder] Deprecated shim -> AdminCourseBuilder');
    }
  }, []);

  return <AdminCourseBuilder />;
};

export default AdvancedCourseBuilder;
