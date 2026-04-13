import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError, loadCourseFromDatabase } from '../../dal/adminCourses';
import type { Course } from '../../types/courseTypes';
import { useToast } from '../../context/ToastContext';
import { SlugConflictError } from '../../utils/slugConflict';
import { LoadingSpinner } from '../../components/LoadingComponents';
import { useNavTrace } from '../../hooks/useNavTrace';

import { LazyImage } from '../../components/PerformanceComponents';
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
  MessageCircleMore,
  Search,
} from 'lucide-react';
import { reflectionService, type AdminReflectionRow } from '../../dal/reflections';
import { buildReflectionSections } from '../../utils/reflectionPresentation';

const AdminCourseDetail = () => {
  useNavTrace('AdminCourseDetail');
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<'admin' | 'learner'>(
    searchParams.get('viewMode') === 'learner' ? 'learner' : 'admin'
  );
  const [courseReflections, setCourseReflections] = useState<{
    loading: boolean;
    rows: AdminReflectionRow[];
    total: number;
    error: string | null;
  }>({
    loading: false,
    rows: [],
    total: 0,
    error: null,
  });
  const [reflectionLessonFilter, setReflectionLessonFilter] = useState('all');
  const [reflectionSearch, setReflectionSearch] = useState('');

  // Subscribe to catalog state so the component re-renders when init completes.
  const catalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getAdminCatalogState);

  // When navigating directly to a course detail page the store may not have
  // been initialized yet (phase === 'idle').  Trigger init so getCourse()
  // returns the real record once the fetch resolves.
  // Guard: only request init once per mount so we don't fire a second init on
  // every subsequent idle transition (e.g. after forceInit resets phase to idle).
  const hasRequestedInitRef = useRef(false);
  useEffect(() => {
    if (catalogState.phase === 'idle' && !hasRequestedInitRef.current) {
      hasRequestedInitRef.current = true;
      console.debug('[COURSE INIT CALLER]', {
        source: 'AdminCourseDetail.tsx',
        phase: catalogState.phase,
        courseId,
        pathname: typeof window !== 'undefined' ? window.location?.pathname : 'ssr',
        ts: Date.now(),
      });
      void courseStore.init();
    }
  }, [catalogState.phase, courseId]);

  // Direct-fetch fallback: if the store finished loading but doesn't have this
  // course (e.g. it was graph-rejected or navigated to directly), fetch it from
  // the API and hydrate the store so the page can render.
  const directFetchAttemptedRef = useRef(false);
  // Track whether the direct-fetch is still in-flight so the loading skeleton
  // stays visible until the async resolves (prevents a flash of "Course Not Found"
  // between the ref flip and the Promise resolution).
  const [directFetchInFlight, setDirectFetchInFlight] = useState(false);
  const storeIsSettled = catalogState.phase === 'idle' || catalogState.phase === 'loading'
    ? false
    : true; // 'success', 'error', 'empty', 'unauthorized', 'api_unreachable'
  const courseFromStore = courseId ? courseStore.getCourse(courseId) : null;
  useEffect(() => {
    if (!courseId) return;
    if (courseFromStore) return;
    if (!storeIsSettled) return;
    if (directFetchAttemptedRef.current) return;
    directFetchAttemptedRef.current = true;
    setDirectFetchInFlight(true);
    void loadCourseFromDatabase(courseId, { includeDrafts: true }).then((remote) => {
      if (remote) {
        courseStore.saveCourse(remote as Course, { skipRemoteSync: true });
      }
    }).catch(() => {
      // non-fatal — "Course Not Found" UI handles this
    }).finally(() => {
      setDirectFetchInFlight(false);
    });
  }, [courseId, courseFromStore, storeIsSettled]);

  // Get course from store (re-reads after direct-fetch hydration above)
  const course = courseId ? courseStore.getCourse(courseId) : null;

  const resolvedOrgId = useMemo(() => {
    if (!course) return null;
    return course.organizationId ?? (course as any).organization_id ?? (course as any).org_id ?? null;
  }, [course]);

  const reflectionLessons = useMemo(() => {
    if (!course?.modules) return [];
    return course.modules.flatMap((module) =>
      (module.lessons ?? [])
        .filter((lesson) =>
          lesson.type === 'reflection' ||
          lesson.content?.collectResponse === true ||
          lesson.content?.allowReflection === true ||
          Boolean(lesson.content?.prompt || lesson.content?.reflectionPrompt),
        )
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          moduleTitle: module.title,
        })),
    );
  }, [course]);

  useEffect(() => {
    if (viewMode !== 'admin' || !course?.id || !resolvedOrgId) {
      return;
    }

    let isMounted = true;
    setCourseReflections((prev) => ({ ...prev, loading: true, error: null }));
    reflectionService
      .fetchAdminCourseReflections({
        orgId: resolvedOrgId,
        courseId: course.id,
        lessonId: reflectionLessonFilter === 'all' ? undefined : reflectionLessonFilter,
        search: reflectionSearch.trim() || undefined,
        limit: 100,
      })
      .then((payload) => {
        if (!isMounted) return;
        setCourseReflections({
          loading: false,
          rows: payload.rows,
          total: payload.total,
          error: null,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        console.warn('[AdminCourseDetail] Failed to load course reflections', error);
        setCourseReflections({
          loading: false,
          rows: [],
          total: 0,
          error: 'Unable to load reflection responses right now.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [course?.id, reflectionLessonFilter, reflectionSearch, resolvedOrgId, viewMode]);

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
    // Catalog is still initializing, or we just fired the direct-fetch fallback —
    // render the page shell with an inline skeleton so navigation commits
    // immediately and content populates once the store resolves.
    // NEVER return a full-screen spinner: that blocks [PAGE COMMIT].
    //
    // isStillLoading rules:
    //  - phase 'loading'  → init is in-flight, show skeleton
    //  - phase 'idle'     → no init running; if store is unsettled show skeleton,
    //                        but do NOT gate solely on idle (forceInit resets to idle
    //                        briefly before setting 'loading', causing a false spinner)
    //  - directFetchInFlight → direct API rescue is in-flight, show skeleton
    //  - storeIsSettled + directFetchAttemptedRef already set → all paths exhausted,
    //                        show "Course Not Found"
    const isStillLoading =
      catalogState.phase === 'loading' ||
      (!storeIsSettled && !directFetchAttemptedRef.current) ||
      directFetchInFlight;
    if (import.meta.env.DEV) {
      console.debug('[PAGE GATE AdminCourseDetail]', {
        courseId,
        isStillLoading,
        phase: catalogState.phase,
        storeIsSettled,
        directFetchAttempted: directFetchAttemptedRef.current,
        directFetchInFlight,
        courseFound: false,
        ts: Date.now(),
      });
    }
    if (isStillLoading) {
      return (
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to="/admin/courses"
            className="inline-flex items-center mb-6 font-medium text-[var(--hud-orange)] hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course Management
          </Link>
          <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-mist/40 bg-white">
            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-slate/70">Loading course&hellip;</p>
            </div>
          </div>
        </div>
      );
    }
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

  if (import.meta.env.DEV) {
    console.debug('[PAGE GATE AdminCourseDetail]', {
      courseId,
      isStillLoading: false,
      phase: catalogState.phase,
      courseFound: true,
      courseTitle: course.title,
      moduleCount: course.modules?.length ?? 0,
      ts: Date.now(),
    });
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
                  navigator.clipboard
                    ?.writeText(link)
                    .then(() => showToast('Course link copied to clipboard.', 'success'))
                    .catch(() => showToast('Clipboard is unavailable in this browser.', 'error'));
                } catch {
                  showToast('Unable to copy the course link right now.', 'error');
                }
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

          {viewMode === 'admin' && reflectionLessons.length > 0 && (
            <div className="card-lg space-y-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <MessageCircleMore className="h-5 w-5 text-sky-600" />
                    <h2 className="text-xl font-bold text-gray-900">Reflection Responses</h2>
                  </div>
                  <p className="text-sm text-gray-600">
                    Authorized admins can review saved learner reflections for this course.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="flex flex-col text-sm text-gray-600">
                    <span className="mb-1 font-medium text-gray-700">Lesson</span>
                    <select
                      value={reflectionLessonFilter}
                      onChange={(event) => setReflectionLessonFilter(event.target.value)}
                      className="min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="all">All reflection lessons</option>
                      {reflectionLessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.moduleTitle}: {lesson.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col text-sm text-gray-600">
                    <span className="mb-1 font-medium text-gray-700">Learner or response</span>
                    <div className="flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2">
                      <Search className="mr-2 h-4 w-4 text-gray-400" />
                      <input
                        value={reflectionSearch}
                        onChange={(event) => setReflectionSearch(event.target.value)}
                        placeholder="Search name, email, or response"
                        className="w-full border-0 p-0 text-sm text-gray-900 focus:outline-none"
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                {courseReflections.total > 0
                  ? `${courseReflections.total} saved reflection response${courseReflections.total === 1 ? '' : 's'}`
                  : 'No saved reflection responses yet.'}
              </div>

              {courseReflections.loading && <p className="text-sm text-gray-600">Loading reflection responses…</p>}
              {!courseReflections.loading && courseReflections.error && (
                <p className="text-sm text-red-600">{courseReflections.error}</p>
              )}
              {!courseReflections.loading && !courseReflections.error && courseReflections.rows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center text-sm text-gray-600">
                  No responses match the current filters.
                </div>
              )}
              {!courseReflections.loading && !courseReflections.error && courseReflections.rows.length > 0 && (
                <div className="space-y-4">
                  {courseReflections.rows.map((row) => {
                    const sections = buildReflectionSections(row);
                    return (
                    <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {row.learnerName || row.learnerEmail || row.userId}
                          </p>
                          <p className="text-xs text-gray-600">
                            {row.learnerEmail || row.userId}
                            {row.lessonTitle ? ` • ${row.lessonTitle}` : ''}
                            {row.moduleTitle ? ` • ${row.moduleTitle}` : ''}
                          </p>
                        </div>
                        <div className="text-xs text-gray-500">
                          <p>Updated {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : 'Unknown'}</p>
                          <p>Created {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {sections.length > 0 ? (
                          sections.map((section) => (
                            <div key={section.label} className="rounded-2xl bg-gray-50 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{section.label}</p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">
                                {section.value}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl bg-gray-50 px-4 py-3">
                            <p className="text-sm text-gray-600">No structured response saved yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
