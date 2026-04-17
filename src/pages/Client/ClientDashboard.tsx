import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRoutePrefetch } from '../../hooks/useRoutePrefetch';
import {
  // ArrowUpRight (unused) removed to silence TS6133 warning
} from 'lucide-react';
import Button from '../../components/ui/Button';
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
import TeamGrowthCard from '../../components/Growth/TeamGrowthCard';
import { fetchOrgGrowthMetrics, type OrgGrowthMetrics } from '../../dal/growth';
import { getUserSession } from '../../lib/secureStorage';
import {
  AssignedCoursesSection,
  AssignedSurveysSection,
  BootDebugOverlay,
  ClientDashboardHero,
  ClientDashboardStatsGrid,
  ContinueLearningCard,
  OnboardingWelcomeCard,
  SharedResourcesCard,
  StayConnectedCard,
  SurveyStatsGrid,
  type BootStepName,
  type BootStepState,
  type BootStepStatus,
  type OnboardingWelcomePayload,
} from './ClientDashboardSections';

const ORDERED_BOOT_STEPS: BootStepName[] = ['session', 'membership', 'courses', 'analytics'];

type CourseStoreAdapter = {
  subscribe: (listener: () => void) => () => void;
  getAllCourses: () => ReturnType<typeof courseStore.getAllCourses>;
  getCourse: (courseId: string) => ReturnType<typeof courseStore.getCourse>;
};

const noop = () => {};
const noopUnsubscribe = () => {};

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
    typeof courseStore.resolveCourse === 'function'
      ? courseStore.resolveCourse
      : typeof courseStore.getCourse === 'function'
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
  const { sessionStatus, membershipStatus, activeOrgId } = useSecureAuth();
  const learnerId = useMemo(() => {
    if (user?.id) return String(user.id).toLowerCase();
    if (user?.email) return user.email.toLowerCase();
    return 'local-user';
  }, [user]);
  const sessionLearnerId = useMemo(() => {
    try {
      const session = getUserSession();
      return session?.id ? String(session.id).toLowerCase() : null;
    } catch {
      return null;
    }
  }, [learnerId]);
  const effectiveSyncUserId = useMemo(() => {
    if (!sessionLearnerId) return learnerId;
    if (sessionLearnerId === learnerId) return learnerId;
    return undefined;
  }, [learnerId, sessionLearnerId]);
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
  const [orgGrowth, setOrgGrowth] = useState<OrgGrowthMetrics | null>(null);
  const [orgGrowthLoading, setOrgGrowthLoading] = useState(false);
  const [orgGrowthMessage, setOrgGrowthMessage] = useState<string | null>(null);
  const showDebugOverlay = useMemo(() => new URLSearchParams(location.search).get('debug') === '1', [location.search]);
  // DEV-only debug: surface auth + boot step state to browser console to help
  // diagnose cases where the dashboard remains stuck on the loading spinner.
  useEffect(() => {
    if (!import.meta.env?.DEV) return;
    console.debug('[ClientDashboard][dev-debug]', {
      sessionStatus,
      membershipStatus,
      bootSteps,
    });
  }, [sessionStatus, membershipStatus, bootSteps]);

  const devDebugPanel = useMemo(() => {
    if (!import.meta.env?.DEV) return null;
    const payload = {
      sessionStatus,
      membershipStatus,
      bootSteps,
      learnerId,
      assignmentsLoading,
      assignmentCount: assignments.length,
    };
    return (
      <div
        aria-hidden
        className="fixed bottom-4 right-4 z-50 w-80 max-h-56 overflow-auto rounded border bg-white p-3 text-xs shadow-lg"
        style={{ fontFamily: 'monospace' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <strong style={{ fontSize: 12 }}>DEV: ClientDashboard</strong>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('huddle_lms_auth');
                console.info('[ClientDashboard][dev-debug] cleared huddle_lms_auth');
              } catch (e) {
                // noop
              }
            }}
            className="text-xxs"
            style={{ fontSize: 10 }}
          >
            Clear E2E Key
          </button>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(payload, null, 2)}</pre>
      </div>
    );
  }, [sessionStatus, membershipStatus, bootSteps, learnerId, assignmentsLoading, assignments]);
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
  const hasResolvedSessionRef = useRef(false);
  const hasResolvedMembershipRef = useRef(false);
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
    if (sessionStatus === 'authenticated') {
      hasResolvedSessionRef.current = true;
    } else if (sessionStatus === 'unauthenticated') {
      hasResolvedSessionRef.current = false;
    }
    if (sessionStatus === 'loading') {
      if (hasResolvedSessionRef.current) {
        return;
      }
      updateBootStep('session', 'running');
    } else if (sessionStatus === 'authenticated') {
      updateBootStep('session', 'success');
    } else if (sessionStatus === 'unauthenticated') {
      updateBootStep('session', 'error', 'Session not authenticated');
    }
  }, [sessionStatus, updateBootStep]);

  useEffect(() => {
    if (membershipStatus === 'ready' || membershipStatus === 'degraded') {
      hasResolvedMembershipRef.current = true;
    } else if (membershipStatus === 'error') {
      hasResolvedMembershipRef.current = false;
    }
    if (membershipStatus === 'idle' || membershipStatus === 'loading') {
      if (hasResolvedMembershipRef.current) {
        return;
      }
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
        const rows = await fetchAssignedSurveysForLearner({ forceRefresh: reason !== 'boot' });
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
    const unsubscribeSurveyAssignments = subscribeSurveyAssignmentsChanged(() => {
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

  const handleRetryBoot = () => {
    setCatalogError(null);
    setAnalyticsError(null);
    setBootAttempt((attempt) => attempt + 1);
    updateBootStep('courses', 'running');
    updateBootStep('analytics', 'running');
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
            userId: effectiveSyncUserId,
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
  }, [courses, effectiveSyncUserId]);

  const courseDetails = useMemo(() => courses.map((course) => {
    const stored = loadStoredCourseProgress(course.slug);
    const snapshot = buildLearnerProgressSnapshot(
      course,
      new Set(stored.completedLessonIds),
      stored.lessonProgress || {},
      stored.lessonPositions || {}
    );
  const assignment = assignments.find((record) => record.courseId === course.id) ?? null;
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
    const resolvedOrgId = activeOrgId ?? user?.organizationId ?? null;
    if (!resolvedOrgId) {
      setResources([]);
      setResourcesError(null);
      return;
    }
    let cancelled = false;
    setResourcesLoading(true);
    setResourcesError(null);
    documentService
      .listDocuments({ organizationId: resolvedOrgId, userId: user?.id ?? undefined })
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
  }, [activeOrgId, user?.id, user?.organizationId]);

  useEffect(() => {
    if (!user?.organizationId) {
      setOrgGrowth(null);
      setOrgGrowthMessage(null);
      return;
    }
    let cancelled = false;
    setOrgGrowthLoading(true);
    setOrgGrowthMessage(null);
    fetchOrgGrowthMetrics()
      .then((res) => {
        if (cancelled) return;
        setOrgGrowth(res ?? null);
        if (!res) {
          setOrgGrowthMessage('Team growth is available to organization admins once an organization is selected.');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setOrgGrowth(null);
        const status = typeof (error as any)?.status === 'number' ? (error as any).status : null;
        const body = (error as any)?.body && typeof (error as any).body === 'object' ? (error as any).body : null;
        const code = body && typeof (body as any).code === 'string' ? (body as any).code : null;
        if (status === 403 && code === 'org_selection_required') {
          setOrgGrowthMessage('Select an organization to view team growth.');
        } else if (status === 403) {
          setOrgGrowthMessage('Team growth is available to organization admins.');
        } else {
          setOrgGrowthMessage('Unable to load team growth right now.');
        }
      })
      .finally(() => {
        if (!cancelled) setOrgGrowthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.organizationId]);

  if (essentialError) {
    return (
      <>
        <div className="min-h-screen bg-softwhite">
        <div className="container-page section text-center">
          <LoadingSpinner size="lg" text={lastCriticalError || 'Unable to initialize session.'} className="py-10" />
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={handleRetryBoot}>
              Retry
            </Button>
          </div>
        </div>
        </div>
  {showDebugOverlay && <BootDebugOverlay orderedBootSteps={ORDERED_BOOT_STEPS} steps={bootSteps} onRetry={handleRetryBoot} />}
  {devDebugPanel}
      </>
    );
  }

  if (!essentialReady) {
    return (
      <>
        <div className="min-h-screen bg-softwhite">
        <div className="container-page section text-center">
          <LoadingSpinner size="lg" text={spinnerLabel} className="py-10" />
        </div>
        </div>
  {showDebugOverlay && <BootDebugOverlay orderedBootSteps={ORDERED_BOOT_STEPS} steps={bootSteps} onRetry={handleRetryBoot} />}
  {devDebugPanel}
      </>
    );
  }

  return (
    <>
      <div className="container-page section page-shell">
      <ClientDashboardHero
        contextualGreeting={contextualGreeting}
        learnerFirstName={learnerFirstName}
        progressSnapshotLabel={progressSnapshotLabel}
        inProgressCount={inProgressCount}
        onOpenLms={() => navigate('/lms/dashboard')}
      />

      {continueLearningEntry && (
        <ContinueLearningCard
          courseTitle={continueLearningEntry.course.title}
          lessonTitle={continueLearningLessonTitle}
          progressPercent={continueLearningEntry.progressPercent}
          onResume={() => {
            if (continueLearningEntry.preferredLessonId) {
              navigate(`/client/courses/${continueLearningEntry.course.slug}/lessons/${continueLearningEntry.preferredLessonId}`);
              return;
            }
            navigate(`/client/courses/${continueLearningEntry.course.slug}`);
          }}
        />
      )}

      <ClientDashboardStatsGrid
        assignedCourseCount={assignedCourseCount}
        completedCount={completedCount}
        inProgressCount={inProgressCount}
        onBrowseCourses={() => navigate('/client/courses')}
        onOpenLms={() => navigate('/lms/dashboard')}
      />

      <TeamGrowthCard metrics={orgGrowth} loading={orgGrowthLoading} message={orgGrowthMessage} />

      {welcomeExperience && (
        <OnboardingWelcomeCard
          welcomeExperience={welcomeExperience}
          userEmail={user?.email}
          onDismiss={() => setWelcomeExperience(null)}
          onStartCourses={() => navigate('/client/courses')}
          onViewSurveys={() => handleNavigateToSurveys()}
          onViewResources={handleNavigateToResources}
        />
      )}

      <SurveyStatsGrid
        total={surveyStats.total}
        completed={surveyStats.completed}
        inProgress={surveyStats.inProgress}
        overdue={surveyStats.overdue}
        nextDueTitle={surveyStats.nextDue?.survey?.title ?? null}
        nextDueDate={surveyStats.nextDue?.assignment.dueDate}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AssignedCoursesSection
          assignmentsLoading={assignmentsLoading}
          hasAssignedCourses={hasAssignedCourses}
          showingFallbackCatalog={showingFallbackCatalog}
          learnerCatalogEmpty={learnerCatalogState.status === 'empty'}
          assignedCourseCount={assignedCourseCount}
          displayedCourseDetails={displayedCourseDetails}
          onBrowseCourses={() => navigate('/client/courses')}
          onVisitLms={() => navigate('/lms/dashboard')}
          onOpenCourse={({ course, preferredLessonId }) => {
            if (preferredLessonId) {
              navigate(`/client/courses/${course.slug}/lessons/${preferredLessonId}`);
              return;
            }
            navigate(`/client/courses/${course.slug}`);
          }}
        />

        <SharedResourcesCard
          resourcesLoading={resourcesLoading}
          resourcesError={resourcesError}
          featuredResources={featuredResources}
          extraResources={extraResources}
          onNavigateToResources={handleNavigateToResources}
        />

        <StayConnectedCard onOpenLms={() => navigate('/lms/dashboard')} />
      </div>

      <AssignedSurveysSection
        surveyAssignmentsLoading={surveyAssignmentsLoading}
        surveyAssignmentsError={surveyAssignmentsError}
        surveyAssignments={surveyAssignments}
        featuredSurveyAssignments={featuredSurveyAssignments}
        onViewAll={() => handleNavigateToSurveys()}
        onReviewSurvey={handleNavigateToSurveys}
      />
    </div>
    {showDebugOverlay && (
      <BootDebugOverlay orderedBootSteps={ORDERED_BOOT_STEPS} steps={bootSteps} onRetry={handleRetryBoot} />
    )}
    {devDebugPanel}
    </>
  );
};

export default ClientDashboard;
