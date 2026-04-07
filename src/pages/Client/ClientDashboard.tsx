import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRoutePrefetch } from '../../hooks/useRoutePrefetch';
import {
  ArrowUpRight,
  BookOpen,
  Clock,
  Users,
  Award,
  Inbox,
  Sparkles,
  ClipboardList,
  CalendarClock,
  FileText,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { LoadingSpinner } from '../../components/LoadingComponents';
import { courseStore } from '../../store/courseStore';
import { useUserProfile } from '../../hooks/useUserProfile';
import { normalizeCourse } from '../../utils/courseNormalization';
import { getAssignmentsForUser } from '../../utils/assignmentStorage';
import {
  syncCourseProgressWithRemote,
  loadStoredCourseProgress,
  buildLearnerProgressSnapshot,
  PROGRESS_STORAGE_KEY,
} from '../../utils/courseProgress';
import { getPreferredLessonId, getFirstLessonId } from '../../utils/courseNavigation';
import { syncService } from '../../dal/sync';
import { fetchAssignedSurveysForLearner, type LearnerSurveyAssignment } from '../../dal/surveys';
import { subscribeSurveyAssignmentsChanged } from '../../utils/surveyAssignmentEvents';
import type { CourseAssignment } from '../../types/assignment';
import { isSupabaseOperational, subscribeRuntimeStatus } from '../../state/runtimeStatus';
import apiRequest, { ApiError } from '../../utils/apiClient';
import { useSecureAuth } from '../../context/SecureAuthContext';
import documentService, { type DocumentMeta } from '../../dal/documents';
import useDocumentDownload from '../../hooks/useDocumentDownload';

type BootStepName = 'session' | 'membership' | 'courses' | 'analytics';
type BootStepStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout';

type BootStepState = {
  status: BootStepStatus;
  error: string | null;
};

const ORDERED_BOOT_STEPS: BootStepName[] = ['session', 'membership', 'courses', 'analytics'];

type CourseStoreAdapter = {
  subscribe: (listener: () => void) => () => void;
  getAllCourses: () => ReturnType<typeof courseStore.getAllCourses>;
  getCourse: (courseId: string) => ReturnType<typeof courseStore.getCourse>;
};

const noop = () => {};
const noopUnsubscribe = () => {};

type OnboardingWelcomePayload = {
  orgId?: string | null;
  orgName?: string | null;
  email?: string;
  recordedAt?: string;
  assignments?: {
    courses?: number;
    surveys?: number;
  };
};

const buildCourseStoreAdapter = (): CourseStoreAdapter => {
  const missing: string[] = [];
  const subscribeFn =
    typeof courseStore.subscribe === 'function'
      ? courseStore.subscribe
      : (() => {
          missing.push('subscribe');
          return () => noopUnsubscribe;
        })();
  const getAllCoursesFn =
    typeof courseStore.getAllCourses === 'function'
      ? courseStore.getAllCourses
      : (() => {
          missing.push('getAllCourses');
          return () => [];
        })();
  const getCourseFn =
    typeof courseStore.getCourse === 'function'
      ? courseStore.getCourse
      : (() => {
          missing.push('getCourse');
          return () => null;
        })();

  if (missing.length) {
    console.warn('[ClientDashboard] courseStore adapter missing methods; using safe fallbacks.', {
      missing,
    });
  }

  return {
    subscribe: (listener: () => void) => (listener ? subscribeFn(listener) : subscribeFn(noop)),
    getAllCourses: () => getAllCoursesFn(),
    getCourse: (courseId: string) => getCourseFn(courseId),
  };
};

const ResourceQuickAction = ({ document }: { document: DocumentMeta }) => {
  const { download, isLoading, error } = useDocumentDownload(document);
  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <Button variant="ghost" size="sm" onClick={() => download()} disabled={isLoading || !document.id}>
        {isLoading ? 'Opening…' : 'Open'}
      </Button>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
};

const ClientDashboard = () => {
  // Prefetch critical user flows for fast navigation
  useRoutePrefetch([
    '/client/courses',
    '/client/profile',
    '/lms/dashboard',
  ]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUserProfile();
  const { sessionStatus, membershipStatus } = useSecureAuth();
  const learnerId = useMemo(() => {
    if (user?.id) return String(user.id).toLowerCase();
    if (user?.email) return user.email.toLowerCase();
    return 'local-user';
  }, [user]);
  const learnerFirstName = useMemo(() => {
    const candidate =
      (user as Record<string, unknown> | null)?.firstName ||
      (user as Record<string, unknown> | null)?.first_name ||
      (user as Record<string, unknown> | null)?.name ||
      (user as Record<string, unknown> | null)?.fullName;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim().split(/\s+/)[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'there';
  }, [user]);
  const contextualGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [surveyAssignments, setSurveyAssignments] = useState<LearnerSurveyAssignment[]>([]);
  const [surveyAssignmentsLoading, setSurveyAssignmentsLoading] = useState(true);
  const [surveyAssignmentsError, setSurveyAssignmentsError] = useState<string | null>(null);
  const [courseStoreRevision, setCourseStoreRevision] = useState(0);
  // catalogError and analyticsError are set by async handlers for future use / error surfacing;
  // the read-values are currently unused (errors are surfaced via bootSteps).
  const [, setCatalogError] = useState<string | null>(null);
  const [, setAnalyticsError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [bootSteps, setBootSteps] = useState<Record<BootStepName, BootStepState>>({
    session: { status: 'running', error: null },
    membership: { status: 'idle', error: null },
    courses: { status: 'idle', error: null },
    analytics: { status: 'idle', error: null },
  });
  const [welcomeExperience, setWelcomeExperience] = useState<OnboardingWelcomePayload | null>(null);
  const [resources, setResources] = useState<DocumentMeta[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const showDebugOverlay = useMemo(() => new URLSearchParams(location.search).get('debug') === '1', [location.search]);
  const updateBootStep = useCallback(
    (step: BootStepName, status: BootStepStatus, error: string | null = null) => {
      setBootSteps((prev) => {
        if (prev[step]?.status === status && prev[step]?.error === error) {
          return prev;
        }
        return {
          ...prev,
          [step]: { status, error },
        };
      });
    },
    [],
  );
  const [progressRefreshToken, setProgressRefreshToken] = useState(0);
  const [analyticsRefreshToken, setAnalyticsRefreshToken] = useState(0);
  const courseStoreAdapter = useMemo(buildCourseStoreAdapter, []);
  // Track learner catalog load status so we can show a targeted empty-state when the
  // server confirms there are genuinely no courses available (status === 'empty'), rather
  // than staying silent or showing a stale "loading" indicator indefinitely.
  const [learnerCatalogState, setLearnerCatalogState] = useState(() =>
    courseStore.getLearnerCatalogState(),
  );

  useEffect(() => {
    const unsubscribe = courseStoreAdapter.subscribe(() => {
      setCourseStoreRevision((rev) => rev + 1);
      setLearnerCatalogState(courseStore.getLearnerCatalogState());
    });
    return unsubscribe;
  }, [courseStoreAdapter]);

  useEffect(() => {
    if (sessionStatus === 'loading') {
      updateBootStep('session', 'running');
    } else if (sessionStatus === 'authenticated') {
      updateBootStep('session', 'success');
    } else if (sessionStatus === 'unauthenticated') {
      updateBootStep('session', 'error', 'Session not authenticated');
    }
  }, [sessionStatus, updateBootStep]);

  useEffect(() => {
    if (membershipStatus === 'idle' || membershipStatus === 'loading') {
      updateBootStep('membership', 'running');
      return;
    }
    if (membershipStatus === 'ready' || membershipStatus === 'degraded') {
      updateBootStep('membership', 'success', membershipStatus === 'degraded' ? 'Membership degraded' : null);
      return;
    }
    if (membershipStatus === 'error') {
      updateBootStep('membership', 'error', 'Unable to load memberships');
    }
  }, [membershipStatus, updateBootStep]);

  useEffect(() => {
    const handleProgressStorageChange = (event: StorageEvent) => {
      if (event.key !== PROGRESS_STORAGE_KEY) return;
      setProgressRefreshToken((token) => token + 1);
      setAnalyticsRefreshToken((token) => token + 1);
    };

    window.addEventListener('storage', handleProgressStorageChange);

    return () => {
      window.removeEventListener('storage', handleProgressStorageChange);
    };
  }, []);

  useEffect(() => {
    const handleProgressUpdated = () => {
      setProgressRefreshToken((token) => token + 1);
      setAnalyticsRefreshToken((token) => token + 1);
    };

    const unsubscribeLessonCompleted = syncService.subscribe('user_completed', handleProgressUpdated);
    const unsubscribeCourseCompleted = syncService.subscribe('course_completed', handleProgressUpdated);

    return () => {
      unsubscribeLessonCompleted?.();
      unsubscribeCourseCompleted?.();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let pollHandle: number | null = null;

    const refreshAssignments = async (reason: 'boot' | 'poll' = 'poll') => {
      if (reason === 'boot') {
        updateBootStep('courses', 'running');
        setCatalogError(null);
      }
      try {
        const records = await getAssignmentsForUser(learnerId);
        if (isMounted) {
          setAssignments(records);
        }
        if (reason === 'boot') {
          updateBootStep('courses', 'success');
        }
      } catch (error) {
        console.error('Failed to load assignments:', error);
        const friendlyMessage = 'Assignments unavailable. Retry.';
        updateBootStep('courses', 'error', friendlyMessage);
        if (reason === 'boot' && isMounted) {
          setCatalogError(friendlyMessage);
        }
      } finally {
        if (isMounted) {
          setAssignmentsLoading(false);
        }
      }
    };

    const ensurePolling = (shouldPoll: boolean) => {
      if (shouldPoll && pollHandle === null) {
        pollHandle = window.setInterval(() => {
          void refreshAssignments();
        }, 2500);
      } else if (!shouldPoll && pollHandle !== null) {
        window.clearInterval(pollHandle);
        pollHandle = null;
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refreshAssignments();
        setProgressRefreshToken((token) => token + 1);
      }
    };

    setAssignmentsLoading(true);
    void refreshAssignments('boot');
    ensurePolling(!isSupabaseOperational());
    const runtimeUnsub = subscribeRuntimeStatus((status) => {
      ensurePolling(!(status.supabaseConfigured && status.supabaseHealthy));
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubscribeCreate = syncService.subscribe('assignment_created', () => {
      void refreshAssignments();
    });
    const unsubscribeUpdate = syncService.subscribe('assignment_updated', () => {
      void refreshAssignments();
    });
    const unsubscribeDelete = syncService.subscribe('assignment_deleted', () => {
      void refreshAssignments();
    });

    return () => {
      isMounted = false;
      if (pollHandle !== null) {
        window.clearInterval(pollHandle);
        pollHandle = null;
      }
      runtimeUnsub?.();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribeCreate?.();
      unsubscribeUpdate?.();
      unsubscribeDelete?.();
    };
  }, [learnerId, bootAttempt, updateBootStep]);

  useEffect(() => {
    let cancelled = false;
    let pollHandle: number | null = null;

    const refreshSurveyAssignments = async (reason: 'boot' | 'poll' = 'poll') => {
      if (reason === 'boot') {
        setSurveyAssignmentsLoading(true);
        setSurveyAssignmentsError(null);
      }
      try {
        const rows = await fetchAssignedSurveysForLearner();
        console.info('[ClientDashboard] survey assignments fetched', {
          reason,
          fetchedCount: rows.length,
        });
        if (!cancelled) {
          setSurveyAssignments(rows);
          setSurveyAssignmentsError(null);
        }
      } catch (error) {
        console.error('Failed to load survey assignments:', error);
        if (!cancelled) {
          setSurveyAssignments([]);
          setSurveyAssignmentsError('Surveys unavailable. Please retry soon.');
        }
      } finally {
        if (!cancelled) {
          setSurveyAssignmentsLoading(false);
        }
      }
    };

    void refreshSurveyAssignments('boot');
    const unsubscribeSurveyAssignments = subscribeSurveyAssignmentsChanged((event) => {
      console.info('[ClientDashboard] survey assignments invalidated', event);
      void refreshSurveyAssignments('poll');
    });
    pollHandle = window.setInterval(() => {
      void refreshSurveyAssignments();
    }, 15000);

    return () => {
      cancelled = true;
      if (pollHandle) {
        window.clearInterval(pollHandle);
      }
      unsubscribeSurveyAssignments();
    };
  }, []);

  useEffect(() => {
    console.info('[ClientDashboard] survey assignments rendered', {
      renderedCount: surveyAssignments.length,
      loading: surveyAssignmentsLoading,
      hasError: Boolean(surveyAssignmentsError),
    });
  }, [surveyAssignments.length, surveyAssignmentsLoading, surveyAssignmentsError]);

  const handleRetryBoot = () => {
    setCatalogError(null);
    setAnalyticsError(null);
    setBootAttempt((attempt) => attempt + 1);
    updateBootStep('courses', 'running');
    updateBootStep('analytics', 'running');
  };

  const formatDueDateLabel = (iso?: string | null) => {
    if (!iso) return 'No due date';
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return 'No due date';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(parsed),
    );
  };

  const describeDueDate = (iso?: string | null) => {
    if (!iso) return { label: 'No due date', overdue: false };
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return { label: 'No due date', overdue: false };
    const overdue = parsed < Date.now();
    return {
      label: formatDueDateLabel(iso),
      overdue,
    };
  };

  const isDueSoon = (iso?: string | null) => {
    if (!iso) return false;
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return false;
    const diff = parsed - Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    return diff > 0 && diff <= THREE_DAYS_MS;
  };

  const getSurveyStatusLabel = (assignment: LearnerSurveyAssignment['assignment']) => {
    if (assignment.status === 'completed') return 'Completed';
    const dueInfo = describeDueDate(assignment.dueDate);
    if (dueInfo.overdue) return 'Overdue';
    if (assignment.status === 'in-progress' && isDueSoon(assignment.dueDate)) return 'Due soon';
    if (assignment.status === 'in-progress') return 'In progress';
    return isDueSoon(assignment.dueDate) ? 'Due soon' : 'Not started';
  };

  const getSurveyBadgeTone = (assignment: LearnerSurveyAssignment['assignment'], overdue: boolean): 'positive' | 'info' | 'attention' | 'danger' => {
    if (assignment.status === 'completed') return 'positive';
    if (overdue) return 'danger';
    if (isDueSoon(assignment.dueDate)) return 'attention';
    if (assignment.status === 'in-progress') return 'info';
    return 'attention';
  };

  const handleNavigateToSurveys = (assignmentId?: string, surveyId?: string | null) => {
    const params = new URLSearchParams();
    if (assignmentId) params.set('assignment', assignmentId);
    if (surveyId) params.set('focus', surveyId);
    const suffix = params.toString();
    navigate(suffix ? `/client/surveys?${suffix}` : '/client/surveys');
  };

  const handleNavigateToResources = useCallback(() => {
    navigate('/client/documents');
  }, [navigate]);

  const extractSurveyLink = (assignment: CourseAssignment) => {
    if (!assignment.metadata || typeof assignment.metadata !== 'object') {
      return null;
    }
    const metadata = assignment.metadata as Record<string, unknown>;
    const candidate =
      (typeof metadata.survey_url === 'string' && metadata.survey_url) ||
      (typeof metadata.link === 'string' && metadata.link) ||
      (typeof metadata.url === 'string' && metadata.url);
    if (candidate && typeof candidate === 'string' && candidate.trim().startsWith('http')) {
      return candidate.trim();
    }
    return null;
  };

  const courses = useMemo(
    () =>
      assignments
        .filter((record) => record.courseId != null)
        .map((record) => courseStoreAdapter.getCourse(record.courseId as string))
        .filter(Boolean)
        .map((course) => normalizeCourse(course!)),
    [assignments, courseStoreRevision]
  );

  useEffect(() => {
    let isMounted = true;

    const syncProgress = async () => {
      if (!courses.length) return;
      const results = await Promise.all(
        courses.map(async (course) => {
          const lessonIds =
            course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
          if (lessonIds.length === 0) return null;
          return syncCourseProgressWithRemote({
            courseSlug: course.slug,
            courseId: course.id,
            userId: learnerId,
            lessonIds,
          });
        })
      );

      if (!isMounted) return;
      if (results.some((entry) => entry)) {
        setProgressRefreshToken((token) => token + 1);
      }
    };

    void syncProgress();

    return () => {
      isMounted = false;
    };
  }, [courses, learnerId]);

  const courseDetails = useMemo(() => courses.map((course) => {
    const stored = loadStoredCourseProgress(course.slug);
    const snapshot = buildLearnerProgressSnapshot(
      course,
      new Set(stored.completedLessonIds),
      stored.lessonProgress || {},
      stored.lessonPositions || {}
    );
    const assignment = assignments.find((record) => record.courseId === course.id);
  const assignmentProgress = Number(assignment?.progress ?? 0);
  const snapshotProgress = Math.round((snapshot.overallProgress || 0) * 100);
  const progressPercent = Math.max(assignmentProgress, snapshotProgress);
  const isCompleted = assignment?.status === 'completed' || progressPercent >= 100;
  const isInProgress = !isCompleted && progressPercent > 0;
    const preferredLessonId = getPreferredLessonId(course, stored) ?? getFirstLessonId(course);

    return {
      course,
      snapshot,
      assignment,
      stored,
      progressPercent,
      isCompleted,
      isInProgress,
      preferredLessonId,
    };
  }), [assignments, courses, progressRefreshToken]);

  const fallbackCourseDetails = useMemo(() => {
    if (courses.length > 0) return [];
    const catalogEntries = courseStoreAdapter.getAllCourses();
    return catalogEntries.map((entry) => {
      const normalized = normalizeCourse(entry);
      const stored = loadStoredCourseProgress(normalized.slug);
      const snapshot = buildLearnerProgressSnapshot(
        normalized,
        new Set(stored.completedLessonIds),
        stored.lessonProgress || {},
        stored.lessonPositions || {}
      );
      const progressPercent = Math.round((snapshot.overallProgress || 0) * 100);
      const isCompleted = progressPercent >= 100;
      const isInProgress = progressPercent > 0 && progressPercent < 100;
      const preferredLessonId = getPreferredLessonId(normalized, stored) ?? getFirstLessonId(normalized);
      return {
        course: normalized,
        snapshot,
        assignment: null,
        stored,
        progressPercent,
        isCompleted,
        isInProgress,
        preferredLessonId,
      };
    });
  }, [courses.length, courseStoreRevision, progressRefreshToken]);

  const surveyStats = useMemo(() => {
    if (surveyAssignments.length === 0) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        nextDue: null as LearnerSurveyAssignment | null,
      };
    }
    const now = Date.now();
    const completed = surveyAssignments.filter((entry) => entry.assignment.status === 'completed').length;
    const inProgress = surveyAssignments.filter((entry) => entry.assignment.status === 'in-progress').length;
    const overdue = surveyAssignments.filter((entry) => {
      const due = entry.assignment.dueDate;
      if (!due) return false;
      const parsed = Date.parse(due);
      if (Number.isNaN(parsed)) return false;
      if (entry.assignment.status === 'completed') return false;
      return parsed < now;
    }).length;
    const nextDue =
      [...surveyAssignments]
        .filter((entry) => entry.assignment.dueDate)
        .sort((a, b) => {
          const left = Date.parse(a.assignment.dueDate ?? '');
          const right = Date.parse(b.assignment.dueDate ?? '');
          const safeLeft = Number.isNaN(left) ? Number.POSITIVE_INFINITY : left;
          const safeRight = Number.isNaN(right) ? Number.POSITIVE_INFINITY : right;
          return safeLeft - safeRight;
        })
        .find((entry) => entry.assignment.status !== 'completed') ?? null;

    return {
      total: surveyAssignments.length,
      completed,
      inProgress,
      overdue,
      nextDue,
    };
  }, [surveyAssignments]);

  const pendingSurveyAssignments = useMemo(
    () => surveyAssignments.filter((entry) => entry.assignment.status !== 'completed'),
    [surveyAssignments],
  );

  const featuredSurveyAssignments = useMemo(() => {
    if (pendingSurveyAssignments.length > 0) {
      return pendingSurveyAssignments.slice(0, 3);
    }
    return surveyAssignments.slice(0, 3);
  }, [pendingSurveyAssignments, surveyAssignments]);

  const hasAssignedCourses = courseDetails.length > 0;
  const showingFallbackCatalog = !hasAssignedCourses && fallbackCourseDetails.length > 0;
  const displayedCourseDetails = hasAssignedCourses ? courseDetails : fallbackCourseDetails;
  const continueLearningEntry = useMemo(() => {
    const byPriority = [...displayedCourseDetails].sort((left, right) => {
      const leftActive = left.isInProgress ? 1 : 0;
      const rightActive = right.isInProgress ? 1 : 0;
      if (leftActive !== rightActive) return rightActive - leftActive;
      return (right.progressPercent ?? 0) - (left.progressPercent ?? 0);
    });
    return byPriority.find((entry) => entry.progressPercent > 0 && entry.progressPercent < 100) ?? byPriority[0] ?? null;
  }, [displayedCourseDetails]);
  const continueLearningLessonTitle = useMemo(() => {
    if (!continueLearningEntry?.preferredLessonId) return 'Next available lesson';
    const lessonTitle = (continueLearningEntry.course.chapters || [])
      .flatMap((chapter) => chapter.lessons || [])
      .find((lesson) => lesson.id === continueLearningEntry.preferredLessonId)?.title;
    return lessonTitle || 'Next available lesson';
  }, [continueLearningEntry]);
  const assignedCourseCount = hasAssignedCourses ? assignments.length : fallbackCourseDetails.length;
  const completedCount = displayedCourseDetails.filter((entry) => entry.isCompleted).length;
  const inProgressCount = displayedCourseDetails.filter((entry) => entry.isInProgress).length;
  const lessonSnapshot = useMemo(() => {
    const totalLessons = displayedCourseDetails.reduce((count, entry) => {
      const chapterLessons = (entry.course.chapters || []).reduce(
        (sum, chapter) => sum + (chapter.lessons?.length || 0),
        0,
      );
      return count + chapterLessons;
    }, 0);
    const completedLessonsCount = displayedCourseDetails.reduce(
      (count, entry) => count + (entry.stored?.completedLessonIds?.length || 0),
      0,
    );
    return {
      totalLessons,
      completedLessonsCount,
    };
  }, [displayedCourseDetails]);
  const featuredResources = useMemo(() => resources.slice(0, 3), [resources]);
  const extraResources = Math.max(0, resources.length - featuredResources.length);
  const progressSnapshotLabel =
    lessonSnapshot.totalLessons > 0
      ? `You’ve completed ${Math.min(lessonSnapshot.completedLessonsCount, lessonSnapshot.totalLessons)} of ${lessonSnapshot.totalLessons} lessons this week`
      : 'Your assignments will appear here as soon as your facilitator publishes them';

  const essentialReady =
    bootSteps.session.status === 'success' && bootSteps.membership.status === 'success';
  const essentialError =
    bootSteps.session.status === 'error' || bootSteps.membership.status === 'error';
  const runningStepName = ORDERED_BOOT_STEPS.find((step) => bootSteps[step].status === 'running');
  const loadingLabelMap: Record<BootStepName, string> = {
    session: 'Validating session…',
    membership: 'Resolving organization access…',
    courses: 'Loading assignments…',
    analytics: 'Preparing analytics…',
  };
  const spinnerLabel = runningStepName ? loadingLabelMap[runningStepName] : 'Preparing your portal…';
  const lastCriticalError = bootSteps.session.error || bootSteps.membership.error;

  useEffect(() => {
    if (!essentialReady) {
      updateBootStep('analytics', 'idle');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    updateBootStep('analytics', 'running');
    setAnalyticsError(null);
    (async () => {
      try {
        await apiRequest('/api/analytics/journeys?limit=1', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        if (!cancelled) {
          updateBootStep('analytics', 'success');
        }
      } catch (error) {
        if (cancelled) return;
        const friendlyMessage = 'Analytics unavailable. Showing limited view.';
        if (error instanceof ApiError) {
          updateBootStep('analytics', 'error', error.message || friendlyMessage);
        } else if ((error as Error)?.name === 'AbortError') {
          updateBootStep('analytics', 'timeout', 'Analytics request timed out');
        } else {
          updateBootStep('analytics', 'error', friendlyMessage);
        }
        setAnalyticsError(friendlyMessage);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [essentialReady, bootAttempt, analyticsRefreshToken, updateBootStep]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('onboarding_welcome_payload');
      if (raw) {
        const parsed = JSON.parse(raw) as OnboardingWelcomePayload;
        setWelcomeExperience(parsed);
        window.sessionStorage.removeItem('onboarding_welcome_payload');
      }
    } catch {
      window.sessionStorage.removeItem('onboarding_welcome_payload');
    }
  }, []);

  useEffect(() => {
    if (!user?.organizationId) {
      setResources([]);
      setResourcesError(null);
      return;
    }
    let cancelled = false;
    setResourcesLoading(true);
    setResourcesError(null);
    documentService
      .listDocuments({ organizationId: user.organizationId })
      .then((list) => {
        if (cancelled) return;
        setResources(list);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[ClientDashboard] resources load failed', error);
        setResources([]);
        setResourcesError('Unable to load resources right now.');
      })
      .finally(() => {
        if (!cancelled) setResourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.organizationId]);

  if (essentialError) {
    return (
      <>
        <div className="min-h-screen bg-softwhite">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <LoadingSpinner size="lg" text={lastCriticalError || 'Unable to initialize session.'} className="py-10" />
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={handleRetryBoot}>
              Retry
            </Button>
          </div>
        </div>
        </div>
        {showDebugOverlay && <BootDebugOverlay steps={bootSteps} onRetry={handleRetryBoot} />}
      </>
    );
  }

  if (!essentialReady) {
    return (
      <>
        <div className="min-h-screen bg-softwhite">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <LoadingSpinner size="lg" text={spinnerLabel} className="py-10" />
        </div>
        </div>
        {showDebugOverlay && <BootDebugOverlay steps={bootSteps} onRetry={handleRetryBoot} />}
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl px-6 py-10 lg:px-12">
      <Card tone="gradient" withBorder={false} className="overflow-hidden">
        <div className="relative z-10 flex flex-col gap-4 text-charcoal md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone="info" className="flex items-center gap-2 bg-white/80 text-skyblue">
              <Sparkles className="h-3.5 w-3.5" />
              Client Portal
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold md:text-4xl">{contextualGreeting}, {learnerFirstName}</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate/80">
              {progressSnapshotLabel}
            </p>
            <p className="mt-1 text-sm text-slate/70">{inProgressCount} {inProgressCount === 1 ? 'course' : 'courses'} in progress</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
              onClick={() => navigate('/lms/dashboard')}
            >
              Go to full learning hub
            </Button>
          </div>
        </div>
      </Card>

      {continueLearningEntry && (
        <section aria-label="Continue where you left off" className="mt-6">
        <Card className="border border-skyblue/20 bg-gradient-to-r from-white via-skyblue/5 to-indigo-50/60 shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-skyblue font-semibold">Continue where you left off</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold text-charcoal">{continueLearningEntry.course.title}</h2>
              <p className="mt-1 text-sm text-slate/80">
                Lesson: {continueLearningLessonTitle}
              </p>
              <div className="mt-3 max-w-md">
                <ProgressBar value={continueLearningEntry.progressPercent} srLabel="Resume course progress" />
              </div>
            </div>
            <Button
              size="sm"
              className="shadow-md transition-transform active:scale-[0.98]"
              onClick={() => {
                if (continueLearningEntry.preferredLessonId) {
                  navigate(`/client/courses/${continueLearningEntry.course.slug}/lessons/${continueLearningEntry.preferredLessonId}`);
                  return;
                }
                navigate(`/client/courses/${continueLearningEntry.course.slug}`);
              }}
            >
              Resume now
            </Button>
          </div>
        </Card>
        </section>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card tone="muted" className="text-center py-6 hover:shadow-card transition-all duration-200">
          <div className="font-heading text-3xl font-bold text-charcoal">{assignedCourseCount}</div>
          <p className="text-xs uppercase tracking-wide text-slate/70">Assigned courses</p>
        </Card>
        <Card tone="muted" className="text-center py-6 hover:shadow-card transition-all duration-200">
          <div className="font-heading text-3xl font-bold text-charcoal">{completedCount}</div>
          <p className="text-xs uppercase tracking-wide text-slate/70">Completed</p>
        </Card>
        <Card tone="muted" className="text-center py-6 hover:shadow-card transition-all duration-200">
          <div className="font-heading text-3xl font-bold text-charcoal">{inProgressCount}</div>
          <p className="text-xs uppercase tracking-wide text-slate/70">In progress</p>
        </Card>
        <Card tone="muted" className="space-y-2 py-6">
          <p className="text-xs uppercase tracking-wide text-slate/70">Quick actions</p>
          <Button size="sm" className="w-full" onClick={() => navigate('/client/courses')}>
            Browse courses
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/lms/dashboard')}>
            Continue learning
          </Button>
        </Card>
      </div>

      {welcomeExperience && (
        <Card className="mt-6 space-y-3 border border-emerald-200 bg-emerald-50/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">Onboarding complete</p>
              <h3 className="font-heading text-xl font-semibold text-emerald-900">
                {welcomeExperience.orgName ? `Welcome to ${welcomeExperience.orgName}` : 'Welcome aboard'}
              </h3>
              <p className="text-sm text-emerald-800">
                Sign in with <span className="font-semibold">{welcomeExperience.email ?? user?.email}</span> to access
                your assignments and shared resources immediately.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setWelcomeExperience(null)}>
              Dismiss
            </Button>
          </div>
          <ul className="list-disc pl-5 text-sm text-emerald-900 space-y-1">
            {welcomeExperience.assignments?.courses ? (
              <li>
                {welcomeExperience.assignments.courses} course
                {welcomeExperience.assignments.courses > 1 ? 's' : ''} ready to begin.
              </li>
            ) : (
              <li>Courses will appear on your dashboard as soon as they’re assigned.</li>
            )}
            {welcomeExperience.assignments?.surveys ? (
              <li>
                {welcomeExperience.assignments.surveys} survey
                {welcomeExperience.assignments.surveys > 1 ? 's' : ''} awaiting your input.
              </li>
            ) : (
              <li>Survey invitations will appear here once scheduled.</li>
            )}
            <li>Shared resources and announcements are one click away.</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => navigate('/client/courses')}>
              Start courses
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleNavigateToSurveys()}>
              View surveys
            </Button>
            <Button size="sm" variant="ghost" onClick={handleNavigateToResources}>
              View resources
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card tone="muted" className="text-center py-6">
          <div className="font-heading text-3xl font-bold text-charcoal">{surveyStats.total}</div>
          <p className="text-xs uppercase tracking-wide text-slate/70">Assigned surveys</p>
        </Card>
        <Card tone="muted" className="text-center py-6">
          <div className="font-heading text-3xl font-bold text-charcoal">{surveyStats.completed}</div>
          <p className="text-xs uppercase tracking-wide text-slate/70">Surveys completed</p>
          <p className="text-xs text-slate/60 mt-1">{surveyStats.inProgress} in progress</p>
        </Card>
        <Card tone="muted" className="py-6">
          <p className="text-xs uppercase tracking-wide text-slate/70 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-slate/70" />
            Next survey due
          </p>
          {surveyStats.nextDue ? (
            <div className="mt-2">
              <div className="font-heading text-base font-semibold text-charcoal">
                {surveyStats.nextDue.survey?.title ?? 'Upcoming survey'}
              </div>
              <p className="text-sm text-slate/70">{formatDueDateLabel(surveyStats.nextDue.assignment.dueDate)}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate/70">No upcoming deadlines</p>
          )}
          {surveyStats.overdue > 0 && (
            <Badge tone="danger" className="mt-3 inline-flex">
              {surveyStats.overdue} overdue
            </Badge>
          )}
        </Card>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-label="Assigned courses">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-charcoal">Assigned courses</h2>
            <Badge tone="info" className="bg-skyblue/10 text-skyblue">{assignedCourseCount}</Badge>
          </div>
          {assignmentsLoading ? (
            <div className="space-y-3 py-2" aria-label="Loading assignments">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-mist bg-white/80 p-4 animate-pulse">
                  <div className="h-4 w-1/2 rounded bg-cloud" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-cloud" />
                  <div className="mt-4 h-2 w-full rounded bg-cloud" />
                </div>
              ))}
            </div>
          ) : !hasAssignedCourses && !showingFallbackCatalog && learnerCatalogState.status === 'empty' ? (
            // Catalog confirmed empty by server — no courses are published/available for this org.
            // Show a clear "contact your admin" message so learners don't wait indefinitely.
            <div className="rounded-2xl border border-dashed border-mist bg-cloud/60 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-skyblue">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-heading text-base font-semibold text-charcoal">No courses available yet</h3>
              <p className="mt-2 text-sm text-slate/70">
                Your organization hasn't published any courses yet. Reach out to your administrator to get programs
                scheduled for your account.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate('/lms/dashboard')}>
                  Visit full LMS
                </Button>
              </div>
            </div>
          ) : !hasAssignedCourses && !showingFallbackCatalog ? (
            <div className="rounded-2xl border border-dashed border-mist bg-cloud/60 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-skyblue">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-heading text-base font-semibold text-charcoal">No assignments yet</h3>
              <p className="mt-2 text-sm text-slate/70">
                You’re all set — your learning plan will appear here as soon as your facilitator assigns it.
                You can still browse available content anytime.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button size="sm" onClick={() => navigate('/client/courses')}>
                  Browse courses
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/lms/dashboard')}>
                  Visit full LMS
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {showingFallbackCatalog && (
                <div className="rounded-lg border border-slate/20 bg-slate/30 px-3 py-2 text-xs text-slate/80">
                  No direct assignments yet. Showing published catalog items so you can keep learning.
                </div>
              )}
              {displayedCourseDetails.map(({ course, assignment, progressPercent, preferredLessonId }) => (
                <Card key={course.id} tone="muted" className="space-y-2 hover:shadow-card transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-heading text-sm font-semibold text-charcoal">{course.title}</p>
                      <p className="text-xs text-slate/70">
                        Due {assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (preferredLessonId) {
                          navigate(`/client/courses/${course.slug}/lessons/${preferredLessonId}`);
                        } else {
                          navigate(`/client/courses/${course.slug}`);
                        }
                      }}
                    >
                      {progressPercent > 0 ? 'Continue' : 'Start'}
                    </Button>
                  </div>
                  <ProgressBar value={progressPercent} srLabel={`${course.title} completion`} />
                </Card>
              ))}
            </div>
          )}
  </Card>
  </section>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate/10 text-slate">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-heading text-base font-semibold text-charcoal">Shared resources</h3>
                <p className="text-xs text-slate/70">Latest files and documents from your admin team.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {resourcesError && (
                <Badge tone="attention" className="text-[11px]">
                  {resourcesError}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleNavigateToResources}>
                View all
              </Button>
            </div>
          </div>
          {resourcesLoading ? (
            <div className="space-y-3 py-2" aria-label="Loading resources">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-mist bg-white/80 p-3 animate-pulse">
                  <div className="h-4 w-2/3 rounded bg-cloud" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-cloud" />
                </div>
              ))}
            </div>
          ) : featuredResources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-mist bg-cloud/60 p-4 text-sm text-slate/70">
              No shared documents yet. Your facilitator will add resources soon.
            </div>
          ) : (
            <ul className="space-y-3">
              {featuredResources.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate/20 bg-white/90 p-3"
                >
                  <div>
                    <p className="font-heading text-sm font-semibold text-charcoal">{doc.name}</p>
                    <p className="text-xs text-slate/70">
                      {doc.category} • {doc.visibility === 'org' ? 'Organization' : 'Global'}
                    </p>
                  </div>
                  {doc.url ? <ResourceQuickAction document={doc} /> : <span className="text-xs text-slate/60">No file</span>}
                </li>
              ))}
            </ul>
          )}
          {extraResources > 0 && (
            <Button variant="ghost" size="sm" onClick={handleNavigateToResources}>
              See {extraResources} more
            </Button>
          )}
        </Card>

        <Card tone="muted" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sunrise/10 text-sunrise">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold text-charcoal">Stay connected</h3>
              <p className="text-xs text-slate/70">Use the full LMS to access discussions, resources, and certificates.</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate/80">
            <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> Resume lessons exactly where you left off.</li>
            <li className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Access downloadable resources and transcripts.</li>
            <li className="flex items-center gap-2"><Award className="h-4 w-4" /> Earn certificates when you finish programs.</li>
          </ul>
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            onClick={() => navigate('/lms/dashboard')}
          >
            Go to LMS
          </Button>
        </Card>
      </div>

      <Card className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-charcoal flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate/60" />
              Assigned surveys
            </h2>
            <p className="text-sm text-slate/70">Track listening pulses and feedback requests from your organization.</p>
          </div>
          <div className="flex items-center gap-2">
            {surveyAssignmentsError && !surveyAssignmentsLoading && (
              <Badge tone="attention" className="text-[11px]">
                {surveyAssignmentsError}
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => handleNavigateToSurveys()}>
              View all
            </Button>
          </div>
        </div>
        {surveyAssignmentsLoading ? (
          <div className="space-y-3 py-2" aria-label="Loading surveys">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-mist bg-white/80 p-4 animate-pulse">
                <div className="h-4 w-2/5 rounded bg-cloud" />
                <div className="mt-2 h-3 w-1/4 rounded bg-cloud" />
                <div className="mt-4 h-8 w-28 rounded bg-cloud" />
              </div>
            ))}
          </div>
        ) : surveyAssignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-mist bg-cloud/60 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate/70">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-heading text-base font-semibold text-charcoal">No surveys yet</h3>
            <p className="mt-2 text-sm text-slate/70">
              You’ll see culture and engagement surveys here as soon as they’re assigned.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {featuredSurveyAssignments.map((entry) => {
              const { assignment, survey } = entry;
              const due = describeDueDate(assignment.dueDate);
              const tone = getSurveyBadgeTone(assignment, due.overdue);
              const statusLabel = getSurveyStatusLabel(assignment);
              const surveyLink = extractSurveyLink(assignment);
              return (
                <div
                  key={assignment.id}
                  className="rounded-2xl border border-slate/20 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-base font-semibold text-charcoal">
                        {survey?.title ?? 'Untitled survey'}
                      </p>
                      <p className="text-xs text-slate/70">
                        {due.overdue && assignment.status !== 'completed' ? 'Overdue • ' : ''}
                        {due.label}
                      </p>
                    </div>
                    <Badge tone={tone}>{statusLabel}</Badge>
                  </div>
                  {survey?.description && (
                    <p className="mt-2 text-sm text-slate/70 line-clamp-2">{survey.description}</p>
                  )}
                  {assignment.note && (
                    <p className="mt-2 text-sm text-slate/70 italic">{assignment.note}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate/70">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {due.label}
                    </span>
                    {assignment.assignedBy && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Assigned by {assignment.assignedBy}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button size="sm" onClick={() => handleNavigateToSurveys(assignment.id, survey?.id)}>
                      Review details
                    </Button>
                    {surveyLink && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={surveyLink} target="_blank" rel="noreferrer">
                          Open survey
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {surveyAssignments.length > featuredSurveyAssignments.length && (
              <Button variant="ghost" size="sm" onClick={() => handleNavigateToSurveys()}>
                See {surveyAssignments.length - featuredSurveyAssignments.length} more
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
    {showDebugOverlay && <BootDebugOverlay steps={bootSteps} onRetry={handleRetryBoot} />}
    </>
  );
};
type BootDebugOverlayProps = {
  steps: Record<BootStepName, BootStepState>;
  onRetry: () => void;
};

const statusColorMap: Record<BootStepStatus, string> = {
  idle: 'text-slate-400',
  running: 'text-blue-600',
  success: 'text-emerald-600',
  error: 'text-rose-600',
  timeout: 'text-amber-600',
};

const BootDebugOverlay = ({ steps, onRetry }: BootDebugOverlayProps) => {
  if (!steps) return null;
  const entries = ORDERED_BOOT_STEPS.map((name) => ({ name, ...steps[name] }));
  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md rounded-2xl border border-slate/30 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate/70">Boot Steps</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
      <div className="max-h-72 overflow-y-auto pr-2">
        <ol className="space-y-2 text-xs">
          {entries.map((step) => (
            <li key={step.name} className="rounded-lg border border-slate/20 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize">{step.name}</span>
                <span className={statusColorMap[step.status]}>{step.status}</span>
              </div>
              {step.error && <p className="mt-1 text-[11px] text-rose-700">{step.error}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default ClientDashboard;
