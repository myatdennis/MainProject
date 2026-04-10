/**
 * AdminCourses - Admin portal page for managing courses, modules, and assignments.
 * Uses shared UI components and accessibility best practices.
 * Features: catalog sync, search/filter, bulk actions, modals, progress tracking, and summary stats.
 */

import { ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';

// Module-level flag: survives unmount/remount across navigations.
// AdminLayout keys <Outlet> on pathname so the page re-mounts on
// every nav;
// a useRef(false) would reset and re-trigger the full-screen loading gate on
// every revisit.  This module variable persists for the browser session.
let _coursesCatalogEverSucceeded = false;
import { Course } from '../../types/courseTypes';
import type { CourseAssignment } from '../../types/assignment';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/adminCourses';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit,
  Copy,
  Eye,
  Play,
  FileText,
  Video,
  Upload,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import ConfirmationModal from '../../components/ConfirmationModal';
import CourseEditModal from '../../components/CourseEditModal';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import { slugify } from '../../utils/courseNormalization';
import { SlugConflictError } from '../../utils/slugConflict';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/LoadingComponents';

import { LazyImage } from '../../components/PerformanceComponents';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import { logAuthRedirect } from '../../utils/logAuthRedirect';
import { useRouteChangeReset } from '../../hooks/useRouteChangeReset';
import { useNavTrace } from '../../hooks/useNavTrace';

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

const AdminCourses = () => {
  useNavTrace('AdminCourses');
  const { showToast } = useToast();
  const syncService = useSyncService();
  const isE2ERuntime =
    (import.meta.env.VITE_E2E_TEST_MODE ?? '').toString() === 'true' ||
    (import.meta.env.VITE_DEV_FALLBACK ?? '').toString() === 'true';

  // Reset transient UI state whenever we navigate to/from this page.
  const { routeKey } = useRouteChangeReset();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [courseForAssignment, setCourseForAssignment] = useState<Course | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [courseToArchive, setCourseToArchive] = useState<Course | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // useSyncExternalStore gives tear-free reads from the module-scope courseStore singleton.
  // It supersedes the old useState+subscribe pattern which could miss a notification fired
  // between the initial render and the subscribe() call.
  const catalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getAdminCatalogState);

  const navigate = useNavigate();

  // Reset transient modal/selection state on navigation.
  useEffect(() => {
    setSearchTerm('');
    setFilterStatus('all');
    setSelectedCourses([]);
    setShowDeleteModal(false);
    setCourseToDelete(null);
    setShowCreateModal(false);
    setShowAssignmentModal(false);
    setCourseForAssignment(null);
    setShowArchiveModal(false);
    setCourseToArchive(null);
  }, [routeKey]);

  // Get courses from the store via tear-free external subscription
  const courses = useSyncExternalStore(courseStore.subscribe, courseStore.getAllCourses);

  // Kick off catalog initialization if the store hasn't started yet.
  // App.tsx drives the primary bootstrap, but if the store is still idle when
  // this page mounts (e.g. fast navigation before the bootstrap effect fires,
  // or a stale ready-guard that skipped re-fetch) we need to trigger it here
  // so courses are always populated.
  // Guard: only request init once per mount. Subsequent idle transitions
  // (e.g. deferred bootstrap retries, org switches) are handled by App.tsx
  // and AdminLayout forceInit — we must not start a new init on every
  // idle→loading→idle cycle.
  const hasRequestedInitRef = useRef(false);
  useEffect(() => {
    if (catalogState.phase === 'idle' && !hasRequestedInitRef.current) {
      hasRequestedInitRef.current = true;
      console.debug('[COURSE INIT CALLER]', {
        source: 'AdminCourses.tsx',
        phase: catalogState.phase,
        pathname: typeof window !== 'undefined' ? window.location?.pathname : 'ssr',
        ts: Date.now(),
      });
      void courseStore.init();
    }
  }, [catalogState.phase]);

  const persistCourse = async (
    inputCourse: Course,
    statusOverride?: 'draft' | 'published' | 'archived'
  ) => {
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
        const updatedCourse = { ...prepared, slug: error.suggestion };
        courseStore.saveCourse(updatedCourse, { skipRemoteSync: true });
        showToast(error.userMessage, 'warning');
      }
      throw error;
    }
  };

  const filteredCourses = courses.filter((course: Course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (course.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === 'all' || course.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalCourses = courses.length;

  if (import.meta.env.DEV) {
    console.info('[ADMIN COURSES RENDER]', {
      rawCount: courses.length,
      filteredCount: filteredCourses.length,
      status: catalogState.adminLoadStatus,
      phase: catalogState.phase,
      lastError: catalogState.lastError ?? null,
      searchTerm: searchTerm || null,
      filterStatus,
      routeKey,
      ts: Date.now(),
    });
  }

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCourses.length === filteredCourses.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(filteredCourses.map((course: Course) => course.id));
    }
  };


  const handleNavigateToCreateCourse = useCallback(() => {
    console.info('[AdminCourses] navigate_create_course');
    if (isE2ERuntime) {
      setShowCreateModal(true);
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('create', '1');
        return params;
      });
      return;
    }
    navigate('/admin/course-builder/new');
  }, [isE2ERuntime, navigate, setSearchParams]);

  const handleAssignmentComplete = (assignments?: CourseAssignment[]) => {
    setShowAssignmentModal(false);
    setCourseForAssignment(null);
    const count = assignments?.length ?? 0;
    const message = count > 0
      ? `Assignments sent to ${count} learner${count === 1 ? '' : 's'}.`
      : 'Assignments queued successfully.';
    showToast(`${message} Learners will be notified via Huddle.`, 'success');
  };

  const handleSwitchAccount = useCallback(() => {
    logAuthRedirect('AdminCourses.switch_account', { path: '/admin/login' });
    navigate('/admin/login');
  }, [navigate]);

  const handleRetry = useCallback(async () => {
    if (catalogState.phase === 'loading' || retrying) {
      return;
    }
    setRetrying(true);
    try {
      // Use forceInit to bypass the ready-guard so explicit retries always
      // trigger a fresh catalog fetch even when phase is already 'ready'.
      await courseStore.forceInit();
    } catch (error) {
      console.error('[AdminCourses] Admin catalog retry failed', error);
    } finally {
      setRetrying(false);
    }
  }, [catalogState.phase, retrying]);

  const openArchiveModal = (course: Course) => {
    setCourseToArchive(course);
    setShowArchiveModal(true);
  };

  const confirmArchiveCourse = async () => {
    if (!courseToArchive) return;
    setLoading(true);
    try {
      const archived = await persistCourse(
        {
          ...courseToArchive,
          status: 'archived',
        },
        'archived'
      );
      syncService.logEvent({
        type: 'course_updated',
        data: archived,
        timestamp: Date.now(),
      });
      showToast('Course archived successfully.', 'success');
    } catch (error) {
      console.error('[AdminCourses] Failed to archive course:', error);
      showToast('Failed to archive course', 'error');
    } finally {
      setLoading(false);
      setShowArchiveModal(false);
      setCourseToArchive(null);
    }
  };

  const handleCreateCourseSave = (course: Course) => {
    const normalizedSlug = slugify(course.slug || course.title || course.id);
    const created = courseStore.createCourse({
      ...course,
      slug: normalizedSlug,
      status: course.status || 'draft',
      lastUpdated: new Date().toISOString(),
    });

    syncService.logEvent({
      type: 'course_created',
      data: created,
      timestamp: Date.now(),
    });

    showToast('Course created successfully.', 'success');
    closeCreateModal();
    navigate(`/admin/courses/${created.id}/details`);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.delete('create');
      return params;
    });
  };

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'interactive':
        return <Play className="h-4 w-4" />;
      case 'worksheet':
        return <FileText className="h-4 w-4" />;
      case 'case-study':
        return <BookOpen className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'text-blue-600 bg-blue-50';
      case 'interactive':
        return 'text-green-600 bg-green-50';
      case 'worksheet':
        return 'text-orange-600 bg-orange-50';
      case 'case-study':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const duplicateCourse = async (courseId: string) => {
    const original = courseStore.getCourse(courseId);
    if (!original) return;

    // Create a shallow clone with a new id and title
    const newId = `course-${Date.now()}`;
    const cloned = {
      ...original,
      id: newId,
      title: `${original.title} (Copy)`,
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      enrollments: 0,
      completions: 0,
      completionRate: 0,
    };

    // Save to store and navigate to builder
    try {
      const persistedClone = await persistCourse(cloned);
      syncService.logEvent({
        type: 'course_created',
        data: persistedClone,
        timestamp: Date.now()
      });
      navigate(`/admin/course-builder/${persistedClone.id}`);
      showToast('Course duplicated successfully.', 'success');
    } catch (err: any) {
      if (err instanceof CourseValidationError) {
        showToast(`Duplicate failed: ${err.issues.join(' • ')}`, 'error');
      } else {
        console.warn('Failed to duplicate course', err);
        const errorMessage = err?.message || err?.body?.error || 'Could not duplicate course. Please try again.';
        const errorDetails = err?.body?.details;
        const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
        showToast(fullMessage, 'error');
      }
    }
  };

  const publishSelected = async () => {
    if (selectedCourses.length === 0) {
      showToast('No courses selected', 'error');
      return;
    }
    setLoading(true);
    try {
      const publishResults = await Promise.allSettled(
        selectedCourses.map(async (id) => {
          const existing = courseStore.getCourse(id);
          if (!existing) {
            return null;
          }
          const updated = {
            ...existing,
            status: 'published' as const,
            publishedDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          };
          const persisted = await persistCourse(updated, 'published');
          syncService.logEvent({
            type: 'course_updated',
            data: persisted,
            timestamp: Date.now(),
          });
          return persisted;
        }),
      );

      const successes = publishResults.filter((result) => result.status === 'fulfilled').length;
      const validationErrors = publishResults
        .filter((result): result is PromiseRejectedResult & { reason: CourseValidationError } =>
          result.status === 'rejected' && result.reason instanceof CourseValidationError,
        )
        .map((result) => result.reason);

      if (successes > 0) {
        showToast(`${successes} course(s) published successfully!`, 'success');
      }

      if (validationErrors.length > 0) {
        const messages = Array.from(new Set(validationErrors.flatMap((error) => error.issues)));
        showToast(`Some courses failed validation: ${messages.join(' • ')}`, 'error');
      }

      setSelectedCourses([]);
    } catch (error) {
      showToast('Failed to publish courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportCourses = (scope: 'selected' | 'filtered' | 'all' = 'selected') => {
    let toExport = filteredCourses;
    if (scope === 'selected' && selectedCourses.length > 0) {
      toExport = selectedCourses.map(id => courseStore.getCourse(id)).filter(Boolean) as any[];
    } else if (scope === 'all') {
      toExport = courseStore.getAllCourses();
    }

    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(toExport, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute('href', dataStr);
      dlAnchor.setAttribute('download', `courses-export-${Date.now()}.json`);
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
      showToast('Courses exported successfully.', 'success');
    } catch (err) {
      console.warn('Export failed', err);
      showToast('Failed to export courses.', 'error');
    }
  };

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    
    setLoading(true);
    try {
      courseStore.deleteCourse(courseToDelete);
      syncService.logEvent({
        type: 'course_deleted',
        data: { id: courseToDelete },
        timestamp: Date.now()
      });
      setSelectedCourses((prev: string[]) => prev.filter((x: string) => x !== courseToDelete));
      showToast('Course deleted successfully!', 'success');
      setShowDeleteModal(false);
      setCourseToDelete(null);
    } catch (error) {
      showToast('Failed to delete course', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCourses = () => {
    navigate('/admin/courses/import');
  };

  const handleExportCourses = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      exportCourses(selectedCourses.length > 0 ? 'selected' : 'all');
      showToast('Courses exported successfully!', 'success');
    } catch (error) {
      showToast('Failed to export courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const catalogStatus = catalogState.adminLoadStatus;

  // Track whether the catalog has ever succeeded in this session (module-level
  // to survive unmount/remount across route changes).
  useEffect(() => {
    // Unstick on any terminal ready state — not just 'success' — so re-auth
    // after a 401 doesn't leave the flag permanently false.
    if (catalogStatus === 'success' || catalogStatus === 'empty' || catalogState.phase === 'ready') {
      _coursesCatalogEverSucceeded = true;
    }
  }, [catalogStatus, catalogState.phase]);

  // Only show the full-screen loading gate on the very first visit before the
  // catalog has ever resolved.  Subsequent navigations to this page must render
  // the course list immediately — even while a background re-fetch is in flight.
  // phase === 'idle' means no fetch is running — never gate on it.
  const isFirstLoad = !_coursesCatalogEverSucceeded;
  const isCatalogLoading = isFirstLoad && catalogState.phase === 'loading';
  // Only show the "no courses" gate when the API truly returned 0 courses AND
  // the store has no courses from a prior successful load. If courses[] is
  // non-empty (e.g. from a previous fetch that is now stale, or a local draft),
  // render them rather than hiding the entire page behind the empty-state gate.
  const isCatalogEmpty = catalogStatus === 'empty' && courses.length === 0;
  const isCatalogUnauthorized = catalogStatus === 'unauthorized';
  // Similarly, don't hide an existing catalog behind an error gate — only show
  // the error gate when we have nothing to display.
  const isCatalogError = (catalogStatus === 'error' || catalogStatus === 'api_unreachable') && courses.length === 0;
  const lastSyncAttempt = catalogState.lastAttemptAt ? new Date(catalogState.lastAttemptAt).toLocaleString() : null;

  if (import.meta.env.DEV) {
    const renderBranch = isCatalogLoading ? 'loading-gate'
      : isCatalogEmpty ? 'empty-gate'
      : isCatalogUnauthorized ? 'unauthorized-gate'
      : isCatalogError ? 'error-gate'
      : 'normal';
    console.debug('[PAGE GATE AdminCourses]', {
      renderBranch,
      isCatalogLoading,
      isCatalogEmpty,
      isCatalogUnauthorized,
      isCatalogError,
      isFirstLoad,
      phase: catalogState.phase,
      status: catalogStatus,
      courseCount: courses.length,
      filteredCount: filteredCourses.length,
      ts: Date.now(),
    });
  }

  let gateContent: ReactNode | null = null;
  if (isCatalogLoading) {
    gateContent = (
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-3xl border border-mist/40 bg-white px-8 py-16 text-center shadow-card-sm">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-slate/80">Syncing the admin catalog&hellip;</p>
      </div>
    );
  } else if (isCatalogEmpty) {
    gateContent = (
      <div className="flex min-h-[40vh] flex-col justify-center">
        <EmptyState
          title="No courses yet"
          description="Create your first course to start building the catalog for your organization."
          action={
            <Button
              variant="primary"
              type="button"
              onClick={handleNavigateToCreateCourse}
              data-test="admin-new-course"
            >
              Create Course
            </Button>
          }
        />
      </div>
    );
  } else if (isCatalogUnauthorized) {
    gateContent = (
      <Card className="mx-auto max-w-3xl text-center">
        <div className="flex flex-col items-center gap-4 p-10">
          <ShieldCheck className="h-12 w-12 text-skyblue" />
          <h1 className="font-heading text-2xl text-charcoal">Admin access required</h1>
          <p className="max-w-xl text-sm text-slate/80">
            Your session is active, but this account doesn&apos;t have admin privileges yet. Switch to an admin account or contact support to request access.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleSwitchAccount} isFullWidth>
              Switch account
            </Button>
            <Button variant="ghost" asChild isFullWidth>
              <a href="mailto:help@the-huddle.co?subject=Admin%20Access%20Request">Contact support</a>
            </Button>
          </div>
        </div>
      </Card>
    );
  } else if (isCatalogError) {
    const heading = catalogStatus === 'api_unreachable' ? 'Unable to reach admin services' : 'We couldn’t load the admin catalog';
    gateContent = (
      <Card className="mx-auto max-w-3xl text-center">
        <div className="flex flex-col items-center gap-4 p-10">
          <AlertTriangle className="h-12 w-12 text-deepred" />
          <h1 className="font-heading text-2xl text-charcoal">{heading}</h1>
          <p className="max-w-xl text-sm text-slate/80">
            {catalogState.lastError || 'Check your connection or try again in a moment. We paused the courses tab until the admin API responds.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleRetry} loading={retrying} isFullWidth>
              Retry sync
            </Button>
            <Button variant="ghost" onClick={() => navigate('/admin/dashboard')} isFullWidth>
              Go to dashboard
            </Button>
          </div>
          {lastSyncAttempt && (
            <p className="mt-4 text-xs text-slate/60">Last attempt: {lastSyncAttempt}</p>
          )}
        </div>
      </Card>
    );
  }

  const publishCourse = async (course: Course) => {
    setLoading(true);
    try {
      const published = await persistCourse(course, 'published');
      syncService.logEvent({
        type: 'course_updated',
        data: published,
        timestamp: Date.now(),
      });
      showToast(`Published ${course.title}`, 'success');
    } catch (error) {
      showToast('Failed to publish course', 'error');
    } finally {
      setLoading(false);
    }
  };

  const activeLearners = courses.reduce(
    (sum, course: Course) => sum + (course.enrollmentCount ?? course.enrollments ?? 0),
    0,
  );
  const completionAverage = courses.length
    ? Math.round(
        courses.reduce((sum, course: Course) => sum + (course.completionRate ?? 0), 0) / courses.length,
      )
    : 0;
  const draftCount = courses.filter((course: Course) => course.status === 'draft').length;
  const publishedCount = courses.filter((course: Course) => course.status === 'published').length;
  const trendDirection = completionAverage >= 65 ? 'up' : 'flat';
  const trendLabel = completionAverage >= 65 ? 'Momentum rising' : 'Engagement steady';

  const recentCourses = [...courses]
    .sort((a, b) => {
      const aDate = Date.parse(a.lastUpdated ?? a.updatedAt ?? a.publishedAt ?? a.createdAt ?? '') || 0;
      const bDate = Date.parse(b.lastUpdated ?? b.updatedAt ?? b.publishedAt ?? b.createdAt ?? '') || 0;
      return bDate - aDate;
    })
    .slice(0, 3);

  const attentionCourses = courses
    .filter((course: Course) => course.status === 'published' && (course.completionRate ?? 0) < 45)
    .sort((a, b) => (a.completionRate ?? 0) - (b.completionRate ?? 0))
    .slice(0, 3);

  const activeFilterChips = [
    ...(searchTerm ? [{ key: 'search', label: `Search: "${searchTerm}"`, onRemove: () => setSearchTerm('') }] : []),
    ...(filterStatus !== 'all'
      ? [{ key: 'status', label: `Status: ${filterStatus}`, onRemove: () => setFilterStatus('all') }]
      : []),
  ];

  return (
    <>
      {gateContent ? gateContent : (
        <>
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Courses', to: '/admin/courses' }]} />
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Admin Control Center</p>
                  <h1 className="text-3xl font-bold text-gray-900">Course management with clarity and momentum</h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600">
                    See performance at a glance, manage publishing with confidence, and keep your learners moving forward from one place.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="md"
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={handleNavigateToCreateCourse}
                >
                  New course
                </Button>
                <Button variant="secondary" size="md" leadingIcon={<Upload className="h-4 w-4" />} onClick={handleImportCourses}>
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    if (selectedCourses.length === 0) {
                      showToast('Select courses to apply bulk actions.', 'info');
                      return;
                    }
                    navigate(`/admin/courses/bulk?ids=${selectedCourses.join(',')}`);
                  }}
                >
                  Bulk actions
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.8fr_0.95fr]">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <OverviewCard
                    label="Total courses"
                    value={totalCourses}
                    detail={`${publishedCount} live`}
                    icon={<BookOpen className="h-5 w-5 text-skyblue" />}
                  />
                  <OverviewCard
                    label="Active learners"
                    value={activeLearners}
                    detail="Across all courses"
                    icon={<Sparkles className="h-5 w-5 text-forest" />}
                  />
                  <OverviewCard
                    label="Completion rate"
                    value={`${completionAverage}%`}
                    detail={trendLabel}
                    icon={<BarChart3 className="h-5 w-5 text-indigo-600" />}
                  />
                  <OverviewCard
                    label="Draft courses"
                    value={draftCount}
                    detail="Ready to publish"
                    icon={<FileText className="h-5 w-5 text-gold" />}
                  />
                  <OverviewCard
                    label="Engagement trend"
                    value={trendDirection === 'up' ? '+12%' : 'Stable'}
                    detail="Learner momentum"
                    icon={trendDirection === 'up' ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-slate-500" />}
                  />
                </div>

                <Card tone="muted" className="rounded-[28px] border border-mist p-6 shadow-card-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1 max-w-xl">
                          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/500" />
                          <Input
                            className="pl-11"
                            placeholder="Search courses, tags or authors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Filter className="h-5 w-5 text-slate-500" />
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-skyblue focus:ring-2 focus:ring-skyblue/20"
                          >
                            <option value="all">All statuses</option>
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                      </div>
                      {activeFilterChips.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {activeFilterChips.map((chip) => (
                            <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm('');
                              setFilterStatus('all');
                            }}
                            className="text-sm font-medium text-slate-700 underline underline-offset-4 transition hover:text-slate-900"
                          >
                            Clear all
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={viewMode === 'cards' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('cards')}
                      >
                        Card view
                      </Button>
                      <Button
                        variant={viewMode === 'table' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                      >
                        Table view
                      </Button>
                    </div>
                  </div>
                </Card>

                {filteredCourses.length === 0 ? (
                  <div className="mb-8">
                    <EmptyState
                      title={searchTerm || filterStatus !== 'all' ? 'No courses found' : 'No courses yet — let’s build your first learning experience'}
                      description={
                        searchTerm || filterStatus !== 'all'
                          ? 'Try changing your search or filters, or create a new course to get started.'
                          : 'A central course catalog helps your team manage learning programs with speed and confidence.'
                      }
                      action={
                        <Button
                          variant={searchTerm || filterStatus !== 'all' ? 'outline' : 'primary'}
                          onClick={() => {
                            if (searchTerm || filterStatus !== 'all') {
                              setSearchTerm('');
                              setFilterStatus('all');
                            } else {
                              handleNavigateToCreateCourse();
                            }
                          }}
                        >
                          {searchTerm || filterStatus !== 'all' ? 'Reset filters' : 'Create your first course'}
                        </Button>
                      }
                    />
                  </div>
                ) : viewMode === 'cards' ? (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredCourses.map((course: Course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        isSelected={selectedCourses.includes(course.id)}
                        onSelect={handleSelectCourse}
                        onEdit={() => navigate(`/admin/course-builder/${course.id}`)}
                        onPreview={() => navigate(`/admin/courses/${course.id}/details?viewMode=learner`)}
                        onDuplicate={() => void duplicateCourse(course.id)}
                        onPublish={() => void publishCourse(course)}
                        onArchive={() => openArchiveModal(course)}
                      />
                    ))}
                  </div>
                ) : (
                  <Card tone="default" className="overflow-hidden border border-mist bg-white shadow-card-lg">
                    <div className="px-6 py-4 border-b border-mist flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-charcoal">Course catalog</h2>
                        <p className="text-sm text-slate-600">Quickly scan course health, status, and actions in a compact view.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportCourses}>
                          Export
                        </Button>
                        <Button variant="secondary" size="sm" onClick={publishSelected}>
                          Publish selected
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-4">
                              <input
                                type="checkbox"
                                checked={selectedCourses.length === filteredCourses.length && filteredCourses.length > 0}
                                onChange={handleSelectAll}
                                className="h-4 w-4 rounded border-gray-300 text-skyblue focus:ring-skyblue"
                              />
                            </th>
                            <th className="px-4 py-4">Course</th>
                            <th className="px-4 py-4">Type</th>
                            <th className="px-4 py-4 text-center">Enrollments</th>
                            <th className="px-4 py-4 text-center">Completion</th>
                            <th className="px-4 py-4 text-center">Status</th>
                            <th className="px-4 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCourses.map((course: Course) => {
                            const courseEnrollments = course.enrollmentCount ?? course.enrollments ?? 0;
                            const courseCompletion = course.completionRate ?? 0;
                            return (
                              <tr key={course.id} className="transition hover:bg-slate-50">
                                <td className="px-4 py-4 align-top">
                                  <input
                                    type="checkbox"
                                    checked={selectedCourses.includes(course.id)}
                                    onChange={() => handleSelectCourse(course.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-skyblue focus:ring-skyblue"
                                  />
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div className="flex items-start gap-3">
                                    <LazyImage
                                      src={course.thumbnail}
                                      alt={course.title}
                                      className="h-12 w-12 rounded-3xl object-cover"
                                      fallbackSrc="/placeholder-image.png"
                                      placeholder={<div className="h-12 w-12 rounded-3xl bg-slate-200 animate-pulse" />}
                                    />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-slate-900 truncate">{course.title}</div>
                                      <div className="text-xs text-slate-500">{course.lessons ?? course.lessonCount ?? 0} lessons · {course.duration}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${getTypeColor(course.type ?? 'resource')}`}>
                                    {getTypeIcon(course.type || 'resource')}
                                    <span className="capitalize">{course.type || 'Mixed'}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-center align-top">
                                  <div className="font-semibold text-slate-900">{courseEnrollments}</div>
                                  <div className="text-xs text-slate-500">learners</div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                                    <span>{courseCompletion}%</span>
                                    <span>{Math.round(courseCompletion / 20)}/5</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-gradient-to-r from-skyblue to-forest" style={{ width: `${courseCompletion}%` }} />
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center align-top">
                                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(course.status)}`}>
                                    {course.status}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-right align-top">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button type="button" onClick={() => navigate(`/admin/courses/${course.id}/details?viewMode=learner`)} className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200">
                                      <Eye className="h-4 w-4" />
                                    </button>
                                    <button type="button" onClick={() => navigate(`/admin/course-builder/${course.id}`)} className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200">
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button type="button" onClick={() => void duplicateCourse(course.id)} className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200">
                                      <Copy className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>

              <aside className="space-y-4">
                <Card tone="muted" className="rounded-[28px] border border-mist p-6 shadow-card-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Admin pulse</p>
                  <h2 className="mt-3 text-lg font-semibold text-charcoal">Focus areas</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">High-value courses that need your attention and the latest activity from the catalog.</p>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Publishes</p>
                          <p className="mt-1 text-lg font-semibold text-charcoal">{publishedCount} live courses</p>
                        </div>
                        <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-forest">Healthy</span>
                      </div>
                    </div>
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Learner engagement</p>
                          <p className="mt-1 text-lg font-semibold text-charcoal">{activeLearners} active learners</p>
                        </div>
                        <div className="text-right text-sm text-slate-600">
                          <div className="flex items-center gap-1 font-semibold text-forest"><TrendingUp className="h-4 w-4" /> {trendDirection === 'up' ? 'Up' : 'Flat'}</div>
                          <div>{trendLabel}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card tone="default" className="rounded-[28px] border border-mist p-6 shadow-card-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recently edited</p>
                  <div className="mt-4 space-y-3">
                    {recentCourses.length > 0 ? recentCourses.map((course: Course) => (
                      <div key={course.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 truncate">{course.title}</p>
                            <p className="text-xs text-slate-500">Updated {new Date(course.lastUpdated ?? course.updatedAt ?? course.publishedAt ?? course.createdAt ?? '').toLocaleDateString()}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(course.status)}`}>{course.status}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-slate-600">No recent edits yet.</p>
                    )}
                  </div>
                </Card>

                <Card tone="muted" className="rounded-[28px] border border-mist p-6 shadow-card-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Needs attention</p>
                  <div className="mt-4 space-y-3">
                    {attentionCourses.length > 0 ? attentionCourses.map((course: Course) => (
                      <div key={course.id} className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 truncate">{course.title}</p>
                            <p className="text-xs text-slate-600">{course.completionRate ?? 0}% completion</p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Low</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-slate-600">All published courses are on track.</p>
                    )}
                  </div>
                </Card>
              </aside>
            </div>
          </div>
        </>
      )}
      {/* Modals rendered outside the main container for correct JSX structure */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCourseToDelete(null);
        }}
        onConfirm={confirmDeleteCourse}
        title="Delete Course"
        message="Are you sure you want to delete this course? This action cannot be undone and will remove all associated data including enrollments and progress."
        confirmText="Delete Course"
        cancelText="Cancel"
        type="danger"
      />
      <CourseEditModal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        onSave={handleCreateCourseSave}
        mode="create"
      />
      <CourseAssignmentModal
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false);
          setCourseForAssignment(null);
        }}
        selectedUsers={[]}
        course={courseForAssignment ? {
          id: courseForAssignment.id,
          title: courseForAssignment.title,
          duration: courseForAssignment.duration,
          organizationId: courseForAssignment.organizationId ?? null,
        } : undefined}
        onAssignComplete={handleAssignmentComplete}
      />
      <ConfirmationModal
        isOpen={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          setCourseToArchive(null);
        }}
        onConfirm={confirmArchiveCourse}
        title="Archive course"
        message="Archiving hides this course from learners but keeps analytics intact. You can restore it at any time by switching the status back to Draft or Published."
        confirmText="Archive course"
        type="warning"
        loading={loading}
      />
    </>
  );
};

interface OverviewCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}

const OverviewCard = ({ label, value, detail, icon }: OverviewCardProps) => (
  <div className="rounded-[32px] border border-mist bg-white p-5 shadow-card-sm">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-semibold text-charcoal">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-700">
        {icon}
      </div>
    </div>
    <p className="mt-4 text-sm text-slate-600">{detail}</p>
  </div>
);

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

const FilterChip = ({ label, onRemove }: FilterChipProps) => (
  <button
    type="button"
    onClick={onRemove}
    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-200"
  >
    <span>{label}</span>
    <span className="text-slate-500">×</span>
  </button>
);

interface CourseCardProps {
  course: Course;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onPublish: () => void;
  onArchive: () => void;
}

const CourseCard = ({
  course,
  isSelected,
  onSelect,
  onEdit,
  onPreview,
  onDuplicate,
  onPublish,
  onArchive,
}: CourseCardProps) => {
  const enrollmentCount = course.enrollmentCount ?? course.enrollments ?? 0;
  const completionRate = course.completionRate ?? 0;
  const updatedAt = course.lastUpdated ?? course.updatedAt ?? course.publishedAt ?? course.createdAt ?? '';

  return (
    <div className="rounded-[32px] border border-mist bg-white p-5 shadow-card-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onSelect(course.id)}
            className={`mt-1 h-5 w-5 rounded-full border ${isSelected ? 'border-skyblue bg-skyblue/20' : 'border-slate-300 bg-white'}`}
            aria-label={isSelected ? 'Deselect course' : 'Select course'}
          />
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-3xl bg-slate-100">
            <LazyImage
              src={course.thumbnail}
              alt={course.title}
              className="h-full w-full object-cover"
              fallbackSrc="/placeholder-image.png"
              placeholder={<div className="h-full w-full bg-slate-200" />}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-charcoal">{course.title}</h3>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getStatusColor(course.status)}`}>
                {course.status}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{course.description || 'No description available.'}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Completion</p>
          <p className="mt-2 text-2xl font-semibold text-charcoal">{completionRate}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-skyblue to-forest" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Learners</p>
          <p className="mt-2 text-2xl font-semibold text-charcoal">{enrollmentCount}</p>
          <p className="mt-2 text-sm text-slate-600">Enrolled learners</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">Updated {updatedAt ? new Date(updatedAt).toLocaleDateString() : 'N/A'}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPreview}>
            Preview
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="secondary" size="sm" onClick={onPublish}>
            {course.status === 'published' ? 'Republish' : 'Publish'}
          </Button>
          <Button variant="outline" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
        <button type="button" onClick={onArchive} className="rounded-full px-3 py-1 text-slate-600 transition hover:bg-slate-100">
          Archive
        </button>
      </div>
    </div>
  );
};

export default AdminCourses;
