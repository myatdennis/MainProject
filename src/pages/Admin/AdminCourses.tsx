/**
 * AdminCourses - Admin portal page for managing courses, modules, and assignments.
 * Uses shared UI components and accessibility best practices.
 * Features: catalog sync, search/filter, bulk actions, modals, progress tracking, and summary stats.
 */

import { ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';

// Module-level flag: survives unmount/remount across navigations.
// AdminLayout keys <Outlet> on pathname so the page re-mounts on every nav;
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
  Trash2,
  Eye,
  Play,
  FileText,
  Video,
  Settings,
  Upload,
  Download,
  Archive,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import LoadingButton from '../../components/LoadingButton';
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

  // ...existing code...

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

  const deleteCourse = (id: string) => {
    setCourseToDelete(id);
    setShowDeleteModal(true);
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

  return (
    <>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Courses', to: '/admin/courses' }]} />
        </div>

        {/* ── DEV STATE PANEL ─────────────────────────────────────────────────
            Visible only in development. Pinned below the breadcrumb so it
            renders regardless of whether gateContent or the normal UI is shown.
            Remove or hide with ?devpanel=0 in the URL.
        ──────────────────────────────────────────────────────────────────── */}
        {import.meta.env.DEV && new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('devpanel') !== '0' && (
          <details
            open
            className="mb-4 rounded-xl border border-violet-300 bg-violet-50 text-xs font-mono text-violet-900"
          >
            <summary className="cursor-pointer select-none px-3 py-2 font-semibold tracking-wide">
              🛠 DEV · AdminCourses state
            </summary>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 pb-3 pt-1 sm:grid-cols-3 lg:grid-cols-4">
              <div><span className="text-violet-500">raw store count</span><br /><strong>{courses.length}</strong></div>
              <div><span className="text-violet-500">filtered count</span><br /><strong>{filteredCourses.length}</strong></div>
              <div><span className="text-violet-500">adminLoadStatus</span><br /><strong>{catalogStatus}</strong></div>
              <div><span className="text-violet-500">phase</span><br /><strong>{catalogState.phase}</strong></div>
              <div><span className="text-violet-500">render branch</span><br /><strong>
                {isCatalogLoading ? '⏳ loading-gate'
                  : isCatalogEmpty ? '🈳 empty-gate'
                  : isCatalogUnauthorized ? '🔒 unauthorized-gate'
                  : isCatalogError ? '❌ error-gate'
                  : gateContent ? '⚠ gate(other)'
                  : filteredCourses.length === 0 && courses.length > 0 ? '🔍 filter-empty'
                  : filteredCourses.length === 0 ? '📭 no-courses'
                  : '✅ normal'}
              </strong></div>
              <div><span className="text-violet-500">isFirstLoad</span><br /><strong>{String(isFirstLoad)}</strong></div>
              <div><span className="text-violet-500">search</span><br /><strong>"{searchTerm || '—'}"</strong></div>
              <div><span className="text-violet-500">filter</span><br /><strong>{filterStatus}</strong></div>
              <div className="col-span-2"><span className="text-violet-500">lastError</span><br /><strong className="break-all">{catalogState.lastError ?? '—'}</strong></div>
              <div><span className="text-violet-500">lastAttemptAt</span><br /><strong>{catalogState.lastAttemptAt ? new Date(catalogState.lastAttemptAt).toLocaleTimeString() : '—'}</strong></div>
              <div><span className="text-violet-500">ts</span><br /><strong>{new Date().toLocaleTimeString()}</strong></div>
            </div>
          </details>
        )}

        {gateContent ? gateContent : (

          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Management</h1>
              <p className="text-gray-600">Create, edit, and manage training modules and learning paths</p>
            </div>
            {/* Stale-data banner: shown when the last sync failed/returned empty but
                we still have courses from a prior load to display. */}
            {courses.length > 0 && (catalogStatus === 'error' || catalogStatus === 'api_unreachable') && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  Showing cached courses — the last sync attempt failed.{' '}
                  <button
                    type="button"
                    className="font-medium underline underline-offset-2 hover:text-amber-900"
                    onClick={handleRetry}
                  >
                    Retry sync
                  </button>
                </span>
              </div>
            )}
            {/* Search and Filter Bar */}
            <div className="card-lg card-hover mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/60" />
                    <Input
                      className="pl-9"
                      placeholder="Search courses..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Filter className="h-5 w-5 text-gray-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent"
                    >
                      <option value="all">All Status</option>
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {selectedCourses.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/admin/courses/bulk?ids=${selectedCourses.join(',')}`)}>
                        Bulk Assign ({selectedCourses.length})
                      </Button>
                      <Button size="sm" onClick={publishSelected} data-test="admin-publish-selected">
                        Publish Selected
                      </Button>
                    </div>
                  )}
                  <Button size="md" onClick={handleNavigateToCreateCourse} leadingIcon={<Plus className="h-4 w-4" />} data-test="admin-new-course">
                    New Course
                  </Button>
                  <LoadingButton
                    onClick={handleImportCourses}
                    variant="secondary"
                    icon={Upload}
                    disabled={loading}
                  >
                    Import
                  </LoadingButton>
                </div>
              </div>
            </div>

            {/* Empty state */}
            {filteredCourses.length === 0 && (
              <div className="mb-8">
                <EmptyState
                  title="No courses found"
                  description={
                    searchTerm || filterStatus !== 'all'
                      ? 'Try adjusting your search or filters to find courses.'
                      : "You haven't created any courses yet. Get started by creating your first course."
                  }
                  action={
                    <Button
                      variant={searchTerm || filterStatus !== 'all' ? 'outline' : 'primary'}
                      type="button"
                      onClick={() => {
                        if (searchTerm || filterStatus !== 'all') {
                          setSearchTerm('');
                          setFilterStatus('all');
                        } else {
                          handleNavigateToCreateCourse();
                        }
                      }}
                    >
                      {searchTerm || filterStatus !== 'all' ? 'Reset filters' : 'Create course'}
                    </Button>
                  }
                />
              </div>
            )}

            {/* Course Grid */}
            {filteredCourses.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {filteredCourses.map((course: Course) => (
                  <div
                    key={course.id}
                    className="card-lg card-hover overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--hud-orange)] focus:ring-offset-2"
                    data-test="admin-course-card"
                    role="link"
                    tabIndex={0}
                    onClick={(event) => {
                      const target = event.target as HTMLElement | null;
                      if (target?.closest('a,button,input,select,textarea,label')) {
                        return;
                      }
                      navigate(`/admin/course-builder/${course.id}`);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') {
                        return;
                      }
                      const target = event.target as HTMLElement | null;
                      if (target?.closest('a,button,input,select,textarea,label')) {
                        return;
                      }
                      event.preventDefault();
                      navigate(`/admin/course-builder/${course.id}`);
                    }}
                    aria-label={`Open course builder for ${course.title}`}
                  >
                    {/* ...card content... */}
                  </div>
                ))}
              </div>
            )}

            {/* Course Table */}
            <div className="card-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Course Details</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSelectAll}
                    type="button"
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    {selectedCourses.length === filteredCourses.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <LoadingButton
                    onClick={handleExportCourses}
                    variant="secondary"
                    icon={Download}
                    loading={loading}
                    disabled={loading}
                  >
                    Export
                  </LoadingButton>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-6">
                        <input
                          type="checkbox"
                          checked={selectedCourses.length === filteredCourses.length && filteredCourses.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]"
                        />
                      </th>
                      <th className="text-left py-3 px-6 font-semibold text-gray-900">Course</th>
                      <th className="text-center py-3 px-6 font-semibold text-gray-900">Type</th>
                      <th className="text-center py-3 px-6 font-semibold text-gray-900">Enrollments</th>
                      <th className="text-center py-3 px-6 font-semibold text-gray-900">Completion</th>
                      <th className="text-center py-3 px-6 font-semibold text-gray-900">Rating</th>
                      <th className="text-center py-3 px-6 font-semibold text-gray-900">Status</th>
                      <th className="text-center py-3 px-6 font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((course: Course) => (
                      <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-6">
                          <input
                            type="checkbox"
                            checked={selectedCourses.includes(course.id)}
                            onChange={() => handleSelectCourse(course.id)}
                            className="h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <LazyImage
                              src={course.thumbnail}
                              alt={course.title}
                              className="w-12 h-12 rounded-lg object-cover"
                              fallbackSrc="/placeholder-image.png"
                              placeholder={<div className="w-12 h-12 bg-gray-200 animate-pulse rounded-lg" />}
                            />
                            <div>
                              <div className="font-medium text-gray-900">{course.title}</div>
                              <div className="text-sm text-gray-600">{course.lessons} lessons • {course.duration}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(course.type || 'Mixed')}`}>
                            {getTypeIcon(course.type || 'Mixed')}
                            <span className="capitalize">{course.type}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="font-medium text-gray-900">{course.enrollments}</div>
                          <div className="text-sm text-gray-600">{course.completions} completed</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="font-medium text-gray-900">{course.completionRate}%</div>
                          <div className="w-16 bg-gray-200 rounded-full h-1 mt-1 mx-auto">
                            <div 
                              className="h-1 rounded-full"
                              style={{ width: `${course.completionRate}%`, background: 'var(--gradient-blue-green)' }}
                            ></div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {(course.avgRating || 0) > 0 ? (
                            <div className="flex items-center justify-center space-x-1">
                              <span className="font-medium text-gray-900">{course.avgRating}</span>
                              <div className="text-yellow-400">★</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(course.status)}`}>
                            {course.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <Link 
                              to={`/admin/courses/${course.id}/details?viewMode=learner`}
                              className="p-1 text-blue-600 hover:text-blue-800" 
                              title="Preview as Participant"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <Link
                              to={`/admin/course-builder/${course.id}`}
                              className="p-1 text-gray-600 hover:text-gray-800"
                              title="Edit Course"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                            <button onClick={() => void duplicateCourse(course.id)} className="p-1 text-gray-600 hover:text-gray-800" title="Duplicate">
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openArchiveModal(course)}
                              className="p-1 text-gray-600 hover:text-gray-800"
                              title="Archive course"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => navigate(`/admin/courses/${course.id}/settings`)}
                              className="p-1 text-gray-600 hover:text-gray-800" 
                              title="Settings"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <LoadingButton
                              onClick={() => deleteCourse(course.id)}
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                              loading={loading && courseToDelete === course.id}
                              disabled={loading}
                              title="Delete course"
                            >
                              Delete
                            </LoadingButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
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

export default AdminCourses;
