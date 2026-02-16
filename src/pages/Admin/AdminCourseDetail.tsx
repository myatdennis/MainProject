import { useState } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/adminCourses';
import type { Course } from '../../types/courseTypes';
import { useToast } from '../../context/ToastContext';
import { SlugConflictError } from '../../utils/slugConflict';

import { LazyImage } from '../../components/PerformanceComponents';
// Removed unused UI imports to satisfy lints
import {
  ArrowLeft,
  Edit,
  Eye,
  Clock,
  Award,
  Calendar,
  CheckCircle,
  Play,
  FileText,
  Video,
  MessageSquare,
  Download,
  Star,
  BarChart3,
  Settings,
  Copy,
  Share,
  BookOpen,
  Target,
  AlertTriangle,
  Info,
  
} from 'lucide-react';

const AdminCourseDetail = () => {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'admin' | 'learner'>(
    searchParams.get('viewMode') === 'learner' ? 'learner' : 'admin'
  );

  // Get course from store
  const course = courseId ? courseStore.getCourse(courseId) : null;

  const persistCourse = async (inputCourse: Course, statusOverride?: 'draft' | 'published') => {
    const prepared: Course = {
      ...inputCourse,
      status: statusOverride ?? inputCourse.status ?? 'draft',
      lastUpdated: new Date().toISOString(),
      publishedDate:
        statusOverride === 'published'
          ? inputCourse.publishedDate || new Date().toISOString()
          : inputCourse.publishedDate,
    };

    try {
      const snapshot = await syncCourseToDatabase(prepared);
      const finalCourse = (snapshot ?? prepared) as Course;
      courseStore.saveCourse(finalCourse, { skipRemoteSync: true });
      return finalCourse;
    } catch (error) {
      if (error instanceof SlugConflictError) {
        const nextCourse = { ...prepared, slug: error.suggestion };
        courseStore.saveCourse(nextCourse, { skipRemoteSync: true });
        showToast(error.userMessage, 'warning');
      }
      throw error;
    }
  };

  const handleDuplicateCourse = async () => {
    if (!course) return;

    try {
      const newId = `course-${Date.now()}`;
      const cloned: Course = {
        ...course,
        id: newId,
        title: `${course.title} (Copy)`,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        enrollments: 0,
        completions: 0,
        completionRate: 0,
      };

      const persistedClone = await persistCourse(cloned);
      showToast('Course duplicated successfully.', 'success');
      navigate(`/admin/course-builder/${persistedClone.id}`);
    } catch (error) {
      if (error instanceof CourseValidationError) {
        showToast(`Duplicate failed: ${error.issues.join(' • ')}`, 'error');
      } else {
        console.warn('Duplicate failed', error);
        showToast('Unable to duplicate course right now.', 'error');
      }
    }
  };

  if (!course) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Course Not Found</h1>
        <p className="text-gray-600 mb-6">The course you're looking for doesn't exist or has been removed.</p>
        <Link 
          to="/admin/courses" 
          className="inline-flex items-center text-orange-500 hover:text-orange-600 font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course Management
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-blue-100 text-blue-800';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-5 w-5 text-blue-500" />;
      case 'interactive':
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case 'quiz':
        return <CheckCircle className="h-5 w-5 text-orange-500" />;
      case 'download':
        return <FileText className="h-5 w-5 text-purple-500" />;
      default:
        return <BookOpen className="h-5 w-5 text-gray-500" />;
    }
  };

  

  const totalLessons = (course.modules ?? []).reduce((acc, module) => acc + (module.lessons?.length ?? 0), 0);
  const totalDuration = (course.modules ?? []).reduce((acc, module) => {
    const moduleDuration = (module.lessons ?? []).reduce((lessonAcc, lesson) => {
      const minutesStr = (lesson.duration ?? '0').toString().split(' ')[0];
      const minutes = parseInt(minutesStr || '0');
      return lessonAcc + (isNaN(minutes) ? 0 : minutes);
    }, 0);
    return acc + moduleDuration;
  }, 0);

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/admin/courses" 
          className="inline-flex items-center mb-4 font-medium text-[var(--hud-orange)] hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course Management
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(course.status)}`}>
                {course.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(course.difficulty)}`}>
                {course.difficulty}
              </span>
            </div>
            <p className="text-gray-600 text-lg mb-4">{course.description}</p>
            
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-sm font-medium text-gray-700">View Mode:</span>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('admin')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                    viewMode === 'admin' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Settings className="h-4 w-4 mr-1 inline" />
                  Admin Preview
                </button>
                <button
                  onClick={() => setViewMode('learner')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
                    viewMode === 'learner' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Eye className="h-4 w-4 mr-1 inline" />
                  Learner View
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link
              to={`/admin/course-builder/${course.id}`}
              className="btn-cta px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Course</span>
            </Link>
            <button onClick={() => void handleDuplicateCourse()} className="btn-outline px-4 py-2 rounded-lg flex items-center space-x-2">
              <Copy className="h-4 w-4" />
              <span>Duplicate</span>
            </button>
            <button onClick={() => {
                try {
                  const link = `${window.location.origin}/courses/${course.id}`;
                  navigator.clipboard?.writeText(link).then(() => console.log('Link copied:', link)).catch(() => console.log('Copy not supported'));
                } catch (err) { console.warn('Share failed', err); }
              }} className="btn-outline px-4 py-2 rounded-lg flex items-center space-x-2">
              <Share className="h-4 w-4" />
              <span>Copy Link</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Course Overview */}
          <div className="card-lg overflow-hidden">
            <LazyImage
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-64 object-cover"
              fallbackSrc="/placeholder-image.png"
              placeholder={<div className="w-full h-64 bg-gray-200 animate-pulse" />}
            />
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalLessons}</div>
                  <div className="text-sm text-gray-600">Lessons</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{totalDuration}m</div>
                  <div className="text-sm text-gray-600">Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{course.enrollments}</div>
                  <div className="text-sm text-gray-600">Enrolled</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{course.avgRating}</div>
                  <div className="text-sm text-gray-600">Rating</div>
                </div>
              </div>

              {viewMode === 'admin' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <Info className="h-5 w-5 text-blue-500" />
                    <span className="font-medium text-blue-900">Admin Information</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Created by:</span>
                      <span className="font-medium text-blue-900 ml-2">{course.createdBy}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Created:</span>
                      <span className="font-medium text-blue-900 ml-2">{new Date(course.createdDate ?? new Date().toISOString()).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Last Updated:</span>
                      <span className="font-medium text-blue-900 ml-2">{new Date(course.lastUpdated ?? new Date().toISOString()).toLocaleDateString()}</span>
                    </div>
                    {course.publishedDate && (
                      <div>
                        <span className="text-blue-700">Published:</span>
                        <span className="font-medium text-blue-900 ml-2">{new Date(course.publishedDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(course.tags ?? []).map((tag, index) => (
                  <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Learning Objectives */}
          <div className="card-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Learning Objectives</h2>
            <ul className="space-y-3">
              {(course.learningObjectives ?? []).map((objective, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <Target className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{objective}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Course Modules */}
          <div className="card-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Course Content</h2>
            <div className="space-y-6">
              {(course.modules ?? []).map((module, _moduleIndex) => (
                <div key={module.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Module {module.order}: {module.title}
                      </h3>
                      <p className="text-gray-600">{module.description}</p>
                    </div>
                    <div className="text-sm text-gray-600 flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {module.duration}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {module.lessons.map((lesson, _lessonIndex) => (
                      <div key={lesson.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full border border-gray-200">
                            {getLessonIcon(lesson.type)}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{lesson.title}</h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {lesson.duration}
                              </span>
                              <span className="capitalize">{lesson.type}</span>
                            </div>
                          </div>
                        </div>
                        
                        {viewMode === 'admin' && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                try {
                                  const lessonUrl = `/courses/${course.id}/modules/${module.id}/lessons/${lesson.id}`;
                                  window.open(lessonUrl, '_blank');
                                } catch (err) {
                                  console.warn('Preview failed', err);
                                }
                              }}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Preview Lesson"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/admin/course-builder/${course.id}?module=${module.id}&lesson=${lesson.id}`)}
                              className="p-1 text-gray-600 hover:text-gray-800"
                              title="Edit Lesson"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/admin/reports?courseId=${course.id}`)}
                              className="p-1 text-gray-600 hover:text-gray-800"
                              title="Analytics"
                            >
                              <BarChart3 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        
                        {viewMode === 'learner' && (
                          <button
                            onClick={() => {
                              try {
                                const lessonUrl = `/courses/${course.id}/modules/${module.id}/lessons/${lesson.id}`;
                                window.open(lessonUrl, '_blank');
                              } catch (err) {
                                console.warn('Start failed', err);
                              }
                            }}
                            className="btn-cta px-4 py-2 rounded-lg flex items-center space-x-2"
                          >
                            <Play className="h-4 w-4" />
                            <span>Start</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          {course.prerequisites && course.prerequisites.length > 0 && (
            <div className="card-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Prerequisites</h2>
              <ul className="space-y-2">
                {course.prerequisites.map((prerequisite, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    <span className="text-gray-700">{prerequisite}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Course Info */}
          <div className="card-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Course Information</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium text-gray-900">{course.estimatedTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Difficulty:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(course.difficulty)}`}>
                  {course.difficulty}
                </span>
              </div>
                  <div className="flex items-center justify-between">
                <span className="text-gray-600">Due Date:</span>
                <span className="font-medium text-gray-900 flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-orange-500" />
                  {course.dueDate ? new Date(course.dueDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Enrolled:</span>
                <span className="font-medium text-gray-900">{course.enrollments} learners</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Completion Rate:</span>
                <span className="font-medium text-green-600">{course.completionRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Rating:</span>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="font-medium text-gray-900">{course.avgRating}</span>
                  <span className="text-sm text-gray-500">({course.totalRatings})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Certification Info */}
          {course.certification && course.certification.available && (
            <div className="card-lg">
              <div className="flex items-center space-x-2 mb-4">
                <Award className="h-5 w-5 text-orange-500" />
                <h3 className="text-lg font-bold text-gray-900">Certification</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">{course.certification.name}</h4>
                  <p className="text-sm text-gray-600">Valid for {course.certification.validFor}</p>
                  {course.certification.renewalRequired && (
                    <p className="text-xs text-yellow-600 mt-1">Renewal required</p>
                  )}
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Requirements:</h4>
                  <ul className="space-y-1">
                    {course.certification.requirements.map((requirement, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{requirement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Admin Analytics */}
          {viewMode === 'admin' && (
            <div className="card-lg">
              <div className="flex items-center space-x-2 mb-4">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-bold text-gray-900">Performance Analytics</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Completion Progress</span>
                    <span className="text-sm font-medium text-gray-900">{course.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full"
                      style={{ width: `${course.completionRate}%`, background: 'var(--gradient-blue-green)' }}
                    ></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{course.completions}</div>
                    <div className="text-xs text-green-700">Completed</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">{(course.enrollments ?? 0) - (course.completions ?? 0)}</div>
                    <div className="text-xs text-blue-700">In Progress</div>
                  </div>
                </div>

                <button className="w-full btn-outline py-2 rounded-lg text-sm">
                  View Detailed Analytics
                </button>
              </div>
            </div>
          )}

          {/* Learner Actions */}
          {viewMode === 'learner' && (
            <div className="rounded-xl p-6" style={{ background: 'var(--gradient-banner)' }}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ready to Start Learning?</h3>
              <p className="text-gray-600 mb-6">
                This course will help you develop essential inclusive leadership skills through interactive lessons, real-world scenarios, and practical exercises.
              </p>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <button className="btn-cta px-6 py-3 rounded-lg flex items-center justify-center space-x-2">
                  <Play className="h-5 w-5" />
                  <span>Start Course</span>
                </button>
                <button className="border border-orange-500 text-orange-500 px-6 py-3 rounded-lg hover:bg-orange-500 hover:text-white transition-all duration-200 flex items-center justify-center space-x-2">
                  <Download className="h-5 w-5" />
                  <span>Download Syllabus</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCourseDetail;
