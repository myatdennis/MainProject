// Thin DAL facade over course data loader utilities
export type { LoadCourseOptions, LoadCourseResult } from '../services/courseDataLoader';
export { loadCourse, clearCourseCache } from '../services/courseDataLoader';
