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
  Eye,
  Play,
  FileText,
  Video,
  Upload,
  Download,
  AlertTriangle,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import Modal from '../../components/Modal';
import LoadingButton from '../../components/LoadingButton';
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
import Loading from '../../components/ui/Loading';

import { LazyImage } from '../../components/PerformanceComponents';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import { logAuthRedirect } from '../../utils/logAuthRedirect';
import { useRouteChangeReset } from '../../hooks/useRouteChangeReset';
import { useNavTrace } from '../../hooks/useNavTrace';
import { apiRequestRaw } from '../../utils/apiClient';


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
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [courseForAssignment, setCourseForAssignment] = useState<Course | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
    setShowCreateModal(false);
    setShowAssignmentModal(false);
    setCourseForAssignment(null);
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

  const handleBulkDelete = useCallback(async () => {
    setDeleteLoading(true);
    try {
      const resp = await apiRequestRaw('/api/admin/courses/bulk-delete', {
        method: 'POST',
        body: { courseIds: selectedCourses },
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) {
        showToast(result.error || 'Bulk delete failed', 'error');
        return;
      }
      showToast(`Deleted ${selectedCourses.length} course(s)`, 'success');
      setSelectedCourses([]);
      await courseStore.forceInit();
    } catch {
      showToast('Bulk delete failed', 'error');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }, [selectedCourses, showToast]);

  const publishCourse = async (course: Course) => {
    setLoading(true);
    try {
      const updated = {
        ...course,
        status: 'published' as const,
        publishedDate: course.publishedDate || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      const persisted = await persistCourse(updated, 'published');
      syncService.logEvent({
        type: 'course_updated',
        data: persisted,
        timestamp: Date.now(),
      });
      showToast(`Published ${course.title}`, 'success');
    } catch (error) {
      showToast('Failed to publish course', 'error');
    } finally {
      setLoading(false);
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

  const handleExportCourses = () => {
    exportCourses(selectedCourses.length > 0 ? 'selected' : 'all');
  };

  const handleImportCourses = () => {
    navigate('/admin/courses/import');
  };

  const duplicateCourse = async (courseId: string) => {
    const original = courseStore.getCourse(courseId);
    if (!original) return;

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

    try {
      const persistedClone = await persistCourse(cloned);
      syncService.logEvent({
        type: 'course_created',
        data: persistedClone,
        timestamp: Date.now(),
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
    setSearchParams((prev) => {
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

  useEffect(() => {
    const uiState = isCatalogLoading
      ? 'loading'
      : isCatalogUnauthorized
      ? 'unauthorized'
      : isCatalogError
      ? 'error'
      : isCatalogEmpty
      ? 'empty'
      : 'success';
    console.info('[AdminCourses] final_ui_state', {
      route: '/admin/courses',
      requestedOrgId: null,
      uiState,
      courseCount: courses.length,
      filteredCount: filteredCourses.length,
      catalogStatus,
    });
  }, [
    catalogStatus,
    courses.length,
    filteredCourses.length,
    isCatalogEmpty,
    isCatalogError,
    isCatalogLoading,
    isCatalogUnauthorized,
  ]);

  let gateContent: ReactNode | null = null;
  if (isCatalogLoading) {
    gateContent = (
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-3xl border border-mist/40 bg-white px-8 py-16 text-center shadow-card-sm">
  <Loading size="lg" />
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

  const isRefreshing = catalogState.phase === 'loading' && !isFirstLoad;

  return (
    <>
      <div className="container-page section page-shell">
        <div>
          <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Courses', to: '/admin/courses' }]} />
        </div>

        {gateContent ? gateContent : (

          <>
            <div className="page-header">
              <div className="page-header__content">
                  <h1 className="text-3xl font-bold text-gray-900">Course catalog</h1>
                  <p className="text-sm text-slate-500 max-w-2xl">
                    Quickly review course status, progress, and the actions you need to take.
                  </p>
                  <p className="text-sm text-slate-500">
                    {filteredCourses.length} course{filteredCourses.length === 1 ? '' : 's'} available
                  </p>
                </div>
                <div className="page-header__actions">
                  {selectedCourses.length > 0 && (
                    <div className="control-pill bg-slate-100 text-sm font-medium text-slate-700">
                      {selectedCourses.length} selected
                    </div>
                  )}
                  {isRefreshing && (
                    <div className="control-pill border border-slate-200 bg-slate-50 text-sm text-slate-600">
                      Refreshing course catalog…
                    </div>
                  )}
                </div>
              </div>

            <div className="surface-panel">
              <div className="toolbar-row">
                <div className="toolbar-row__group flex-1">
                  <div className="relative flex-1 min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="pl-10"
                      placeholder="Search courses..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-slate-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="h-10 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-skyblue focus:ring-2 focus:ring-skyblue/20"
                    >
                      <option value="all">All statuses</option>
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  {(searchTerm || filterStatus !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-600"
                      onClick={() => {
                        setSearchTerm('');
                        setFilterStatus('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>

                <div className="toolbar-row__group justify-end">
                  {selectedCourses.length > 0 && (
                    <>
                      <Button size="sm" onClick={publishSelected} data-test="admin-publish-selected">
                        Publish selected
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        leadingIcon={<Trash2 className="h-4 w-4" />}
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={loading || deleteLoading}
                        data-test="admin-delete-selected"
                      >
                        Delete selected
                      </Button>
                    </>
                  )}
      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete selected courses?"
      >
        <div className="mb-6">
          Are you sure you want to permanently delete {selectedCourses.length} selected course(s)? This action cannot be undone.
        </div>
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleBulkDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
                  <LoadingButton
                    onClick={handleExportCourses}
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    loading={loading}
                    disabled={loading}
                  >
                    Export
                  </LoadingButton>
                  <Button size="md" onClick={handleNavigateToCreateCourse} leadingIcon={<Plus className="h-4 w-4" />} data-test="admin-new-course">
                    New course
                  </Button>
                  <LoadingButton
                    onClick={handleImportCourses}
                    variant="secondary"
                    icon={Upload}
                    loading={loading}
                    disabled={loading}
                  >
                    Import
                  </LoadingButton>
                </div>
              </div>
            </div>

            {/* Empty state */}
            {filteredCourses.length === 0 && (
              <div>
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

            {/* Course Table */}
            <div className="table-shell">
              <div className="table-shell__header">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Courses</h2>
                  <p className="text-sm text-slate-500 max-w-xl">A calm overview of active learning experiences and the next actions you can take.</p>
                </div>
                <div className="table-shell__meta">
                  <button
                    onClick={handleSelectAll}
                    type="button"
                    className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                  >
                    {selectedCourses.length === filteredCourses.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-slate-700">
                  <thead>
                    <tr>
                      <th className="text-left">
                        <input
                          type="checkbox"
                          checked={selectedCourses.length === filteredCourses.length && filteredCourses.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 border-slate-300 rounded focus:ring-skyblue"
                        />
                      </th>
                      <th className="text-left">Course</th>
                      <th className="text-center">Enrollments</th>
                      <th className="text-center">Progress</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredCourses.map((course: Course) => (
                      <tr key={course.id}>
                        <td className="align-middle">
                          <input
                            type="checkbox"
                            checked={selectedCourses.includes(course.id)}
                            onChange={() => handleSelectCourse(course.id)}
                            className="h-4 w-4 border-slate-300 rounded focus:ring-skyblue"
                          />
                        </td>
                        <td className="align-middle">
                          <div className="flex items-center gap-4 min-w-0">
                            <LazyImage
                              src={course.thumbnail}
                              alt={course.title}
                              className="w-14 h-14 rounded-2xl object-cover"
                              fallbackSrc="/placeholder-image.png"
                              placeholder={<div className="w-14 h-14 rounded-2xl bg-slate-200 animate-pulse" />}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">{course.title}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-500">
                                {course.lessons ?? 0} lessons · {course.duration ?? 'TBD'} · 
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${getTypeColor(course.type || 'mixed')}`}>
                                  {getTypeIcon(course.type || 'mixed')}
                                  <span className="capitalize">{course.type || 'Mixed'}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-center align-middle">
                          <div className="text-sm font-semibold text-slate-900">{course.enrollments ?? 0}</div>
                          <div className="text-xs text-slate-500">learners</div>
                        </td>
                        <td className="text-center align-middle">
                          <div className="mx-auto max-w-[180px] text-left">
                            <div className="mb-2 text-sm font-semibold text-slate-900">{course.completionRate ?? 0}%</div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-skyblue to-forest transition-all"
                                style={{ width: `${course.completionRate ?? 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-center align-middle">
                          <span className={`inline-status ${getStatusColor(course.status)}`}>
                            {course.status}
                          </span>
                        </td>
                        <td className="text-center align-middle">
                          <div className="flex flex-wrap justify-center gap-2">
                            <Link
                              to={`/admin/courses/${course.id}/details?viewMode=learner`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                              title="Preview as participant"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <Link
                              to={`/admin/course-builder/${course.id}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                              title="Edit course"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => void duplicateCourse(course.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                              title="Duplicate course"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            {course.status !== 'published' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void publishCourse(course)}
                                disabled={loading}
                                className="min-w-[96px]"
                              >
                                Publish
                              </Button>
                            )}
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
    </>
  );
};

export default AdminCourses;
