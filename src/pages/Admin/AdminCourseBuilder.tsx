import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  courseStore,
  generateId,
  calculateCourseDuration,
  countTotalLessons,
  createModuleId,
  createLessonId,
  sanitizeModuleGraph,
} from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError, loadCourseFromDatabase, adminPublishCourse } from '../../dal/adminCourses';
import { computeCourseDiff } from '../../utils/courseDiff';
import { slugify } from '../../utils/courseNormalization';
// import type { NormalizedCourse } from '../../utils/courseNormalization';
import { mergePersistedCourse } from '../../utils/adminCourseMerge';
import type { Course, Module, Lesson, LessonVideoAsset } from '../../types/courseTypes';
import { type CourseValidationIntent, type CourseValidationIssue } from '../../validation/courseValidation';
import { getCourseValidationSummary, type CourseValidationSummary } from '../../validation/courseValidationSummary';
import { getUserSession } from '../../lib/secureStorage';
import { ApiError } from '../../utils/apiClient';
import { getVideoEmbedUrl } from '../../utils/videoUtils';
import { uploadLessonVideo, uploadDocumentResource } from '../../dal/media';
import { canonicalizeLessonContent, canonicalizeQuizQuestions } from '../../utils/lessonContent';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Edit, 
  Eye,
  Upload,
  Download,
  Video,
  FileText,
  MessageSquare,
  CheckCircle,
  
  Clock,
  Users,
  BookOpen,
  Target,
  Settings,
  
  X,
  ChevronUp,
  ChevronDown,
  Copy,
  Loader,
  GripVertical,
  Undo2,
  RefreshCcw,
  AlertTriangle,
  WifiOff,
  ShieldCheck
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import LivePreview from '../../components/LivePreview';
import CoursePreviewDock from '../../components/preview/CoursePreviewDock';
import AIContentAssistant from '../../components/AIContentAssistant';
import MobileCourseToolbar from '../../components/Admin/MobileCourseToolbar';
import MobileModuleNavigator from '../../components/Admin/MobileModuleNavigator';
import SortableItem from '../../components/SortableItem';
import useIsMobile from '../../hooks/useIsMobile';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
import useSwipeNavigation from '../../hooks/useSwipeNavigation';
import VersionControl from '../../components/VersionControl';
import { ModuleIssueBadge, LessonIssueTag } from '../../components/Admin/ValidationIssueIndicators';
import { useToast } from '../../context/ToastContext';
import { useSecureAuth } from '../../context/SecureAuthContext';
import type { CourseAssignment } from '../../types/assignment';
import { getDraftSnapshot, deleteDraftSnapshot, markDraftSynced, type DraftSnapshot } from '../../dal/courseDrafts';
import { evaluateRuntimeGate, type RuntimeGateResult, type GateMode, type RuntimeAction } from '../../utils/runtimeGating';
import { createActionIdentifiers, type IdempotentAction } from '../../utils/idempotency';
import { cloneWithCanonicalOrgId, resolveOrgIdFromCarrier, stampCanonicalOrgId } from '../../utils/orgFieldUtils';
import { buildIssueTargets, getIssueTargetsOrEmpty } from '../../utils/validationIssues';
import type { IssueTargets } from '../../utils/validationIssues';

const buildUploadKey = (moduleId: string, lessonId: string) => `${moduleId}::${lessonId}`;
const parseUploadKey = (key: string) => {
  const [moduleId, lessonId] = key.split('::');
  return { moduleId, lessonId };
};

type BuilderConfirmAction = 'discard' | 'reset' | 'delete';
type ConfirmTone = 'info' | 'warning' | 'danger';

type BannerTone = 'warning' | 'danger';

interface BuilderBanner {
  tone: BannerTone;
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmLabel: string;
  tone: ConfirmTone;
}

const confirmToneIconClasses: Record<ConfirmTone, string> = {
  info: 'bg-blue-50 text-blue-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600'
};

const confirmToneButtonClasses: Record<ConfirmTone, string> = {
  info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
};

const bannerToneClasses: Record<BannerTone, { container: string; icon: string; cta: string }> = {
  warning: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'text-amber-600',
    cta: 'border border-amber-200 text-amber-900 hover:bg-amber-100'
  },
  danger: {
    container: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-600',
    cta: 'border border-red-200 text-red-900 hover:bg-red-100'
  }
};

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const VIDEO_UPLOAD_LIMIT_BYTES = Number(import.meta.env.VITE_COURSE_VIDEO_UPLOAD_MAX_BYTES || 750 * 1024 * 1024);
const DOCUMENT_UPLOAD_LIMIT_BYTES = Number(import.meta.env.VITE_DOCUMENT_UPLOAD_MAX_BYTES || 150 * 1024 * 1024);
const VIDEO_UPLOAD_LIMIT_LABEL = (VIDEO_UPLOAD_LIMIT_BYTES / (1024 * 1024)).toFixed(0);
const DOCUMENT_UPLOAD_LIMIT_LABEL = (DOCUMENT_UPLOAD_LIMIT_BYTES / (1024 * 1024)).toFixed(0);

const formatFileSize = (bytes: number) => {
  if (!bytes || Number.isNaN(bytes)) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const resolveUploadAuthor = (): string | null => {
  try {
    const session = getUserSession();
    return session?.id ?? session?.email ?? null;
  } catch {
    return null;
  }
};

const inferDocumentType = (fileName?: string): Lesson['content']['documentType'] => {
  if (!fileName) return undefined;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx', 'key', 'odp', 'pps', 'ppsx'].includes(ext)) return 'slide';
  return 'document';
};

type RemoteIssueMap =
  | Map<string, CourseValidationIssue[]>
  | Record<string, CourseValidationIssue[]>
  | Array<[string, CourseValidationIssue[]]>;

type RemoteIssueTargets =
  | IssueTargets
  | {
      moduleMap?: RemoteIssueMap | null;
      lessonMap?: RemoteIssueMap | null;
    }
  | null
  | undefined;

type ValidationIssuePayload =
  | CourseValidationIssue[]
  | {
      issues?: CourseValidationIssue[] | null;
      issueTargets?: RemoteIssueTargets | null;
    }
  | null
  | undefined;

type ValidationSummary = CourseValidationSummary;

declare global {
  interface Window {
    __huddleShowValidationIssues?: (payload?: ValidationIssuePayload, intent?: CourseValidationIntent) => void;
    showValidationIssues?: (payload?: ValidationIssuePayload, intent?: CourseValidationIntent) => void;
  }
}

const toIssueMap = (input?: RemoteIssueMap | null): Map<string, CourseValidationIssue[]> => {
  if (!input) return new Map();
  if (input instanceof Map) return new Map(input);
  if (Array.isArray(input)) {
    return new Map(
      input
        .filter((entry): entry is [string, CourseValidationIssue[]] => Array.isArray(entry) && typeof entry[0] === 'string')
        .map(([key, value]) => [key, Array.isArray(value) ? value : []]),
    );
  }
  return new Map(
    Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value : []]),
  );
};

const normalizeIssueTargetsPayload = (targets?: RemoteIssueTargets): IssueTargets => {
  if (!targets) {
    return getIssueTargetsOrEmpty();
  }

  const moduleMap = toIssueMap((targets as IssueTargets)?.moduleMap ?? (targets as Record<string, any>)?.moduleMap);
  const lessonMap = toIssueMap((targets as IssueTargets)?.lessonMap ?? (targets as Record<string, any>)?.lessonMap);

  if (moduleMap.size === 0 && lessonMap.size === 0) {
    return getIssueTargetsOrEmpty();
  }

  return { moduleMap, lessonMap };
};

const mapValidationErrorDetails = (error: CourseValidationError, prefix: string): CourseValidationIssue[] => {
  if (Array.isArray(error.details) && error.details.length > 0) {
    return error.details;
  }
  return error.issues.map((message, index) => ({
    code: `${prefix}.${index}`,
    message,
    severity: 'error' as const,
  }));
};

const parseServerValidationPayload = (
  payload: unknown,
): { issues: CourseValidationIssue[]; issueTargets: IssueTargets } => {
  if (!payload || typeof payload !== 'object') {
    return { issues: [], issueTargets: getIssueTargetsOrEmpty() };
  }
  const body = payload as Record<string, unknown>;
  const nested = typeof body.result === 'object' && body.result !== null ? (body.result as Record<string, unknown>) : null;
  const issues = Array.isArray(body.issues)
    ? (body.issues as CourseValidationIssue[])
    : nested && Array.isArray(nested.issues)
    ? (nested.issues as CourseValidationIssue[])
    : [];
  const issueTargets =
    (body.issueTargets as RemoteIssueTargets) ??
    (nested?.issueTargets as RemoteIssueTargets) ??
    null;
  return {
    issues,
    issueTargets: normalizeIssueTargetsPayload(issueTargets),
  };
};

const coerceValidationPayload = (
  payload?: ValidationIssuePayload,
): { issues: CourseValidationIssue[]; issueTargets: IssueTargets } => {
  const issues = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.issues)
    ? (payload?.issues as CourseValidationIssue[])
    : [];
  const providedTargets = Array.isArray(payload) ? null : payload?.issueTargets;
  const issueTargets = providedTargets ? normalizeIssueTargetsPayload(providedTargets) : buildIssueTargets(issues);
  return { issues, issueTargets };
};

const evaluateCourseValidation = (course: Course, intent: CourseValidationIntent): ValidationSummary =>
  getCourseValidationSummary(course, intent);



type UploadStatus = 'idle' | 'uploading' | 'paused' | 'error' | 'success';

const AdminCourseBuilder = () => {
  const { courseId } = useParams();
  const { activeOrgId, user: authUser } = useSecureAuth();
  const navigate = useNavigate();
  const isNewCourseRoute = !courseId || courseId === 'new';
  const isEditing = !isNewCourseRoute;
  
  const [course, setCourse] = useState<Course>(() => {
    if (isEditing && courseId) {
      const existingCourse = courseStore.getCourse(courseId);
      return existingCourse || createEmptyCourse(courseId);
    }
    return createEmptyCourse();
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [expandedModules, setExpandedModules] = useState<{ [key: string]: boolean }>({});
  const [editingLesson, setEditingLesson] = useState<{ moduleId: string; lessonId: string } | null>(null);
  const [uploadingVideos, setUploadingVideos] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | null>>({});
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, { status: UploadStatus; message?: string | null }>>({});
  const uploadControllers = useRef<Record<string, AbortController | null>>({});
  const pendingUploadFiles = useRef<Record<string, File | null>>({});
  const uploadChannels = useRef<Record<string, 'video' | 'document'>>({});
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const lastPersistedRef = useRef<Course | null>(null);
  const [initializing, setInitializing] = useState(isEditing);
  const lastLoadedCourseIdRef = useRef<string | null>(null);
  const draftCheckIdRef = useRef<string | null>(null);
  const isMobile = useIsMobile();
  const runtimeStatus = useRuntimeStatus();
  const supabaseConnected = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const runtimeLastCheckedLabel = runtimeStatus.lastChecked
    ? new Date(runtimeStatus.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'pending';
  const { showToast } = useToast();
  const [activeMobileModuleId, setActiveMobileModuleId] = useState<string | null>(null);
  const [mobileFocusMode, setMobileFocusMode] = useState(true);
  const [statusBanner, setStatusBanner] = useState<BuilderBanner | null>(null);
  const [draftSnapshotPrompt, setDraftSnapshotPrompt] = useState<DraftSnapshot | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [validationIssues, setValidationIssues] = useState<CourseValidationIssue[]>([]);
  const [isValidationModalOpen, setValidationModalOpen] = useState(false);
  const [activeValidationIntent, setActiveValidationIntent] = useState<CourseValidationIntent>('draft');
  const [issueTargetsState, setIssueTargetsState] = useState<IssueTargets>(() => getIssueTargetsOrEmpty());
  const [validationOverride, setValidationOverride] = useState<ValidationSummary | null>(null);
  const [highlightModuleId, setHighlightModuleId] = useState<string | null>(null);
  const validationPanelRef = useRef<HTMLDivElement | null>(null);
  const [validationPanelPulse, setValidationPanelPulse] = useState(false);
  const emphasizeValidationPanel = useCallback(() => {
    setValidationPanelPulse(true);
    if (validationPanelRef.current) {
      validationPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.setTimeout(() => setValidationPanelPulse(false), 1600);
  }, []);
  const clearValidationIssues = useCallback(() => {
    setValidationIssues([]);
    setIssueTargetsState(getIssueTargetsOrEmpty());
    setValidationModalOpen(false);
    setActiveValidationIntent('draft');
    setValidationOverride(null);
  }, [setActiveValidationIntent, setIssueTargetsState, setValidationIssues, setValidationModalOpen]);
  const applyValidationIssues = useCallback(
    (payload?: ValidationIssuePayload, _intent?: CourseValidationIntent) => {
      const { issues: normalizedIssues, issueTargets: normalizedTargets } = coerceValidationPayload(payload);
      if (!normalizedIssues.length) {
        clearValidationIssues();
        return;
      }
      setValidationIssues(normalizedIssues);
      setIssueTargetsState(normalizedTargets);
      setActiveValidationIntent(_intent ?? 'draft');
      setValidationModalOpen(true);
      setValidationOverride({
        intent: _intent ?? 'draft',
        isValid: normalizedIssues.length === 0,
        issues: normalizedIssues,
        issueTargets: normalizedTargets,
      });
    },
    [
      clearValidationIssues,
      setActiveValidationIntent,
      setIssueTargetsState,
      setValidationIssues,
      setValidationModalOpen,
      setValidationOverride,
    ],
  );
  const presentValidationIssues = useCallback(
    (payload?: ValidationIssuePayload, intent?: CourseValidationIntent) => {
      const preview = coerceValidationPayload(payload);
      try {
        applyValidationIssues(payload, intent);
        if (preview.issues.length) {
          emphasizeValidationPanel();
        }
      } catch (error) {
        console.error('[AdminCourseBuilder] failed to present validation issues', {
          error,
          intent,
          hasPayload: Boolean(payload),
        });
        const fallback = coerceValidationPayload(payload);
        if (fallback.issues.length) {
          setValidationIssues(fallback.issues);
          setIssueTargetsState(fallback.issueTargets);
          setValidationModalOpen(true);
          emphasizeValidationPanel();
        }
      }
    },
    [applyValidationIssues, emphasizeValidationPanel, setIssueTargetsState, setValidationIssues],
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__huddleShowValidationIssues = presentValidationIssues;
    window.showValidationIssues = presentValidationIssues;
    return () => {
      if (window.__huddleShowValidationIssues === presentValidationIssues) {
        delete window.__huddleShowValidationIssues;
      }
      if (window.showValidationIssues === presentValidationIssues) {
        delete window.showValidationIssues;
      }
    };
  }, [presentValidationIssues]);
  const publishValidationIntent: CourseValidationIntent = 'publish';
  const localValidationSummary = useMemo(
    () => evaluateCourseValidation(course, publishValidationIntent),
    [course, publishValidationIntent],
  );
  const effectiveValidationSummary = validationOverride ?? localValidationSummary;
  const effectiveIssueTargets = validationOverride?.issueTargets ?? localValidationSummary.issueTargets;
  const visibleIssueTargets = useMemo(() => {
    if (isValidationModalOpen && validationIssues.length > 0) {
      return issueTargetsState;
    }
    return effectiveIssueTargets;
  }, [isValidationModalOpen, issueTargetsState, effectiveIssueTargets, validationIssues.length]);
  const hasCourseModules = (course.modules || []).length > 0;
  const publishDisabled =
    !hasCourseModules || !effectiveValidationSummary.isValid || saveStatus === 'saving';
  const publishIssueCount = effectiveValidationSummary.issues.length;
  const publishButtonTitle = !hasCourseModules
    ? 'Add modules and lessons before publishing'
    : !effectiveValidationSummary.isValid
    ? 'Resolve validation issues before publishing'
    : saveStatus === 'saving'
    ? 'Please wait for the current operation to finish'
    : '';
  const publishDevHint =
    import.meta.env.DEV && !effectiveValidationSummary.isValid && publishIssueCount > 0
      ? `Fix ${publishIssueCount} ${publishIssueCount === 1 ? 'issue' : 'issues'}`
      : null;
  const firstNavigableIssue = useMemo(
    () => effectiveValidationSummary.issues.find((issue) => issue.moduleId || issue.lessonId) ?? null,
    [effectiveValidationSummary.issues],
  );
  const blockingIssueCount = useMemo(
    () => effectiveValidationSummary.issues.filter((issue) => issue.severity === 'error').length,
    [effectiveValidationSummary.issues],
  );
  useEffect(() => {
    setValidationOverride(null);
  }, [course]);
  const requestCourseReload = useCallback(() => {
    lastLoadedCourseIdRef.current = null;
    draftCheckIdRef.current = null;
    setReloadNonce((prev) => prev + 1);
  }, []);
  const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
  const networkFallback = (message: string) =>
    isOffline()
      ? 'Huddle can’t reach the network right now. Your draft stays safe locally until you reconnect.'
      : message;
  const authAlertedRef = useRef(false);
  const handleAuthRequired = useCallback(
    (source: string) => {
      if (authAlertedRef.current) return;
      authAlertedRef.current = true;
      const hasServiceWorker = typeof navigator !== 'undefined' && Boolean((navigator as any).serviceWorker?.controller);
      setStatusBanner({
        tone: 'danger',
        title: 'Session expired',
        description: hasServiceWorker
          ? 'Please refresh and sign in again so we can sync your edits.'
          : 'Please sign in again to continue editing this course.',
        icon: AlertTriangle,
        actionLabel: 'Go to login',
        onAction: () => {
          window.location.href = `/admin/login?reauth=1&from=${encodeURIComponent(window.location.pathname)}`;
        },
      });
      showToast(
        hasServiceWorker
          ? 'Session expired. Hard refresh (Shift+Reload) and sign in again.'
          : 'Session expired. Please sign in again.',
        'warning',
        6000,
      );
      console.warn('[AdminCourseBuilder] Auth required', { source });
    },
    [showToast],
  );

  const [searchParams] = useSearchParams();
  const [highlightLessonId, setHighlightLessonId] = useState<string | null>(null);
  const modules = course.modules || [];
  const hasModules = modules.length > 0;
  const canDiscardChanges = hasPendingChanges || Boolean(lastPersistedRef.current);
  const modulesToRender = isMobile && mobileFocusMode && activeMobileModuleId
    ? modules.filter(module => module.id === activeMobileModuleId)
    : modules;
  const activeUploads = useMemo(() => {
    if (!course.modules) return [];
    return Object.entries(uploadingVideos)
      .filter(([, isActive]) => isActive)
      .map(([key]) => {
        const { moduleId, lessonId } = parseUploadKey(key);
        const module = course.modules?.find((m) => m.id === moduleId);
        const lesson = module?.lessons.find((l) => l.id === lessonId);
        return {
          key,
          moduleTitle: module?.title || 'Untitled module',
          lessonTitle: lesson?.title || 'Untitled lesson',
          progress: Math.round(uploadProgress[key] ?? 0)
        };
      });
  }, [course.modules, uploadingVideos, uploadProgress]);

  const moduleSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile ? { delay: 150, tolerance: 8 } : { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  const lessonSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile ? { delay: 120, tolerance: 6 } : { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    })
  );


  useEffect(() => {
    const moduleQ = searchParams.get('module');
    const lessonQ = searchParams.get('lesson');
    if (!moduleQ || !lessonQ) return;

    // Expand the requested module and open the lesson editor if the lesson exists
    setExpandedModules(prev => ({ ...prev, [moduleQ]: true }));

    const mod = course.modules?.find(m => m.id === moduleQ);
    const lessonExists = mod?.lessons.some(l => l.id === lessonQ);

    if (lessonExists) {
      setEditingLesson({ moduleId: moduleQ, lessonId: lessonQ });
      setHighlightLessonId(lessonQ);

      // remove highlight after a short delay
      setTimeout(() => setHighlightLessonId(null), 2000);

      // Scroll into view after render
      setTimeout(() => {
        const el = document.getElementById(`lesson-${lessonQ}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [searchParams, course.modules]);

  useEffect(() => {
    const currentModules = course.modules || [];
    if (currentModules.length === 0) {
      if (activeMobileModuleId !== null) {
        setActiveMobileModuleId(null);
      }
      return;
    }

    if (!activeMobileModuleId || !currentModules.some(module => module.id === activeMobileModuleId)) {
      setActiveMobileModuleId(currentModules[0].id);
    }
  }, [course.modules, activeMobileModuleId]);

  useEffect(() => {
    if (runtimeStatus.apiAuthRequired) {
      handleAuthRequired('runtime-status');
    } else {
      authAlertedRef.current = false;
    }
  }, [runtimeStatus.apiAuthRequired, handleAuthRequired]);

  useEffect(() => {
    if (!isMobile || !activeMobileModuleId) return;
    const element = typeof document !== 'undefined'
      ? document.getElementById(`module-${activeMobileModuleId}`)
      : null;
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeMobileModuleId, isMobile]);

  const handleMobileModuleSelect = useCallback((moduleId: string) => {
    setActiveMobileModuleId(moduleId);
    setExpandedModules(prev =>
      isMobile
        ? { [moduleId]: true }
        : { ...prev, [moduleId]: true }
    );
  }, [isMobile]);

  const logDev = useCallback((event: string, meta?: Record<string, unknown>) => {
    if (!import.meta.env?.DEV) {
      return;
    }
    if (meta) {
      console.info(`[AdminCourseBuilder] ${event}`, meta);
    } else {
      console.info(`[AdminCourseBuilder] ${event}`);
    }
  }, []);

  const findModuleIdForLesson = useCallback(
    (lessonId?: string | null): string | null => {
      if (!lessonId) return null;
      const modules = course.modules || [];
      for (const module of modules) {
        if (module.lessons?.some((lesson) => lesson.id === lessonId)) {
          return module.id;
        }
      }
      return null;
    },
    [course.modules],
  );

  const focusValidationIssue = useCallback(
    (issue: CourseValidationIssue) => {
      const moduleId = issue.moduleId ?? findModuleIdForLesson(issue.lessonId);
      if (moduleId) {
        setExpandedModules((prev) => ({ ...prev, [moduleId]: true }));
        if (isMobile) {
          setActiveMobileModuleId(moduleId);
        }
        setHighlightModuleId(moduleId);
        window.setTimeout(() => {
          setHighlightModuleId((current) => (current === moduleId ? null : current));
        }, 2000);
        requestAnimationFrame(() => {
          const moduleEl = document.getElementById(`module-${moduleId}`);
          moduleEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }

      if (issue.lessonId && moduleId) {
        setEditingLesson({ moduleId, lessonId: issue.lessonId });
        setHighlightLessonId(issue.lessonId);
        window.setTimeout(() => {
          setHighlightLessonId((current) => (current === issue.lessonId ? null : current));
        }, 2000);
        window.setTimeout(() => {
          const lessonEl = document.getElementById(`lesson-${issue.lessonId}`);
          lessonEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      }
    },
    [
      findModuleIdForLesson,
      isMobile,
      setActiveMobileModuleId,
      setEditingLesson,
      setExpandedModules,
      setHighlightLessonId,
    ],
  );

  const handleNextModule = useCallback(() => {
    if (!modules.length || !activeMobileModuleId) return;
    const currentIndex = modules.findIndex((module) => module.id === activeMobileModuleId);
    const nextModule = modules[(currentIndex + 1) % modules.length];
    if (nextModule) {
      handleMobileModuleSelect(nextModule.id);
    }
  }, [modules, activeMobileModuleId, handleMobileModuleSelect]);

  const handlePreviousModule = useCallback(() => {
    if (!modules.length || !activeMobileModuleId) return;
    const currentIndex = modules.findIndex((module) => module.id === activeMobileModuleId);
    const prevIndex = (currentIndex - 1 + modules.length) % modules.length;
    const prevModule = modules[prevIndex];
    if (prevModule) {
      handleMobileModuleSelect(prevModule.id);
    }
  }, [modules, activeMobileModuleId, handleMobileModuleSelect]);

  const swipeHandlers = useSwipeNavigation({
    disabled: !isMobile || modules.length <= 1,
    onSwipeLeft: handleNextModule,
    onSwipeRight: handlePreviousModule,
  });

  useEffect(() => {
    if (editingLesson?.moduleId) {
      setActiveMobileModuleId(editingLesson.moduleId);
      setExpandedModules(prev => ({ ...prev, [editingLesson.moduleId!]: true }));
    }
  }, [editingLesson]);

  useEffect(() => {
    if (!course.id) return;
    let cancelled = false;

    if (draftCheckIdRef.current === course.id && draftSnapshotPrompt === null) {
      return;
    }

    const inspectDraft = async () => {
      try {
        const snapshot = await getDraftSnapshot(course.id, { dirtyOnly: true });
        if (!snapshot || cancelled) {
          draftCheckIdRef.current = course.id;
          return;
        }
        const lastPersisted = lastPersistedRef.current?.lastUpdated
          ? Date.parse(lastPersistedRef.current.lastUpdated)
          : 0;
        if (snapshot.updatedAt > lastPersisted + 500) {
          setDraftSnapshotPrompt(snapshot);
          setStatusBanner((prev) =>
            prev ?? {
              tone: 'warning',
              title: 'Unsynced draft detected',
              description: 'We found local edits that never reached Supabase. Restore them or discard below.',
              icon: AlertTriangle,
            },
          );
        } else {
          draftCheckIdRef.current = course.id;
        }
      } catch (error) {
        console.warn('[AdminCourseBuilder] Failed to inspect draft snapshot', error);
      }
    };

    inspectDraft();

    return () => {
      cancelled = true;
    };
  }, [course.id, draftSnapshotPrompt]);

  useEffect(() => {
    if (!isEditing || !courseId) {
      setStatusBanner(null);
      if (initializing) {
        setInitializing(false);
      }
      return;
    }

    if (lastLoadedCourseIdRef.current === courseId) {
      if (initializing) {
        setInitializing(false);
      }
      return;
    }

    let cancelled = false;

    const hydrateCourse = async () => {
      setInitializing(true);
      setStatusBanner(null);
      try {
        const existing = courseStore.getCourse(courseId);
        if (existing) {
          if (cancelled) return;
          console.log('COURSE STATE', existing.modules);
          setCourse(existing);
          lastPersistedRef.current = existing;
          lastLoadedCourseIdRef.current = courseId;
          setStatusBanner(null);
          return;
        }

        const remote = await loadCourseFromDatabase(courseId, { includeDrafts: true });
        if (cancelled) return;

        if (remote) {
          setCourse((prev) => {
            const merged = mergePersistedCourse(prev, remote);
            const mergedModules =
              merged.modules && merged.modules.length
                ? merged.modules
                : prev.modules && prev.modules.length
                ? prev.modules
                : merged.modules;
            const nextCourseState = {
              ...prev,
              ...merged,
              modules: mergedModules,
            };
            courseStore.saveCourse(nextCourseState, { skipRemoteSync: true });
            lastPersistedRef.current = nextCourseState;
            console.log('COURSE STATE', nextCourseState.modules);
            return nextCourseState;
          });
          lastLoadedCourseIdRef.current = courseId;
          setStatusBanner(null);
        } else {
          const message = 'Unable to locate this course in Supabase. We’ll keep editing your local draft.';
          setStatusBanner({
            tone: 'warning',
            title: 'Course not found',
            description: message,
            icon: AlertTriangle,
            actionLabel: 'Retry lookup',
            onAction: requestCourseReload,
          });
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          handleAuthRequired('hydrate-course');
          return;
        }
        console.error('Failed to load course details:', error);
        const rawMessage = error instanceof Error ? error.message : 'Unknown error';
        const descriptiveMessage = isOffline()
          ? 'You appear to be offline. We’ll sync again once you reconnect.'
          : `Failed to load course details: ${rawMessage}`;
        setStatusBanner({
          tone: 'danger',
          title: isOffline() ? 'Offline mode' : 'Unable to reach Supabase',
          description: descriptiveMessage,
          icon: isOffline() ? WifiOff : AlertTriangle,
          actionLabel: 'Try again',
          onAction: requestCourseReload,
        });
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    hydrateCourse();

    return () => {
      cancelled = true;
    };
  }, [isEditing, courseId, reloadNonce, requestCourseReload]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
      }
      
      // Escape to close modals
      if (event.key === 'Escape') {
        if (editingLesson) {
          setEditingLesson(null);
        }
        if (showAssignmentModal) {
          setShowAssignmentModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingLesson, showAssignmentModal]);

  // Auto-save course changes with enhanced feedback
  useEffect(() => {
    if (course.id && course.id !== 'new' && course.title?.trim()) {
      if (!course.modules || course.modules.length === 0) {
        return;
      }
      console.log('COURSE STATE', course.modules);
      // Debounce saves to avoid too frequent localStorage writes
      const timeoutId = setTimeout(() => {
        try {
          const updatedCourse = {
            ...course,
            duration: calculateCourseDuration(course.modules || []),
            lessons: countTotalLessons(course.modules || []),
            lastUpdated: new Date().toISOString()
          };
          
          courseStore.saveCourse(updatedCourse, { skipRemoteSync: true });
          // Update local state with calculated fields
          if (course.duration !== updatedCourse.duration || course.lessons !== updatedCourse.lessons) {
            setCourse(updatedCourse);
          }
        } catch (error) {
          console.error('❌ Auto-save failed:', error);
          logDev('autosave_local_failed', {
            id: course.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }, 1500);

      return () => clearTimeout(timeoutId);
    }
  }, [course, logDev]);

  const resolveOrganizationId = useCallback(
    (nextCourse?: Course | null) => {
      let session: Record<string, any> | null = null;
      try {
        session = getUserSession() as Record<string, any>;
      } catch {
        session = null;
      }

      const activeMembership = session?.memberships?.find((membership: any) => membership?.status === 'active');

      return (
        resolveOrgIdFromCarrier(
          nextCourse ?? null,
          lastPersistedRef.current ?? null,
          activeOrgId ?? null,
          session?.activeOrgId ?? null,
          session,
          activeMembership ?? null,
          ...(session?.memberships || [])
        ) ?? null
      );
    },
    [activeOrgId, lastPersistedRef],
  );

  // Debounced remote auto-sync (single upsert). Runs only when there are real changes vs lastPersistedRef.
  useEffect(() => {
    if (!course.id || !course.title?.trim()) return;
    if (autoSaveLockRef.current) return;
    console.log('COURSE STATE', course.modules);
    const diff = computeCourseDiff(lastPersistedRef.current, course);
    if (!diff.hasChanges) return;
    if (!course.modules || course.modules.length === 0) {
      return;
    }

    const gate = evaluateRuntimeGate('course.auto-save', runtimeStatus);
    const isBrowserOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    const apiReachable = runtimeStatus.apiReachable !== false && !runtimeStatus.apiAuthRequired;
    const resolvedOrgId = resolveOrganizationId(course);
    const canAttemptRemote = gate.mode === 'remote' && isBrowserOnline && apiReachable && Boolean(resolvedOrgId);
    const derivedMode: GateMode = canAttemptRemote ? 'remote' : gate.mode === 'remote' ? 'local-only' : gate.mode;

    if (!canAttemptRemote) {
      const reason = !isBrowserOnline
        ? 'offline'
        : !apiReachable
        ? runtimeStatus.apiAuthRequired
          ? 'auth_required'
          : 'api_unreachable'
        : !resolvedOrgId
        ? 'missing_org'
        : gate.mode;
      logDev('autosave_local_only', {
        id: course.id,
        reason,
        gate: gate.mode,
        online: isBrowserOnline,
        apiReachable,
        orgResolved: Boolean(resolvedOrgId),
      });
      lastLocalOnlyReasonRef.current = reason;

      if (lastAutoSaveGateModeRef.current !== derivedMode) {
        const toastMessage = !isBrowserOnline
          ? 'You appear to be offline. Drafts are stored locally and will sync once you reconnect.'
          : gate.reason ?? 'Drafts are stored locally until Huddle reconnects.';
        showToast(toastMessage, gate.tone === 'danger' ? 'error' : 'warning', 6000);
      }
      lastAutoSaveGateModeRef.current = derivedMode;
      return;
    }

    if (lastAutoSaveGateModeRef.current !== 'remote') {
      showToast('Back online. Auto-sync resumed.', 'success', 3000);
    }
    lastAutoSaveGateModeRef.current = 'remote';
    lastLocalOnlyReasonRef.current = null;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveLockRef.current = true;
      setSaveStatus((s) => (s === 'saving' ? s : 'saving'));
      try {
        const result = await persistCourse(course, {
          action: 'course.auto-save',
          gate,
          skipValidation: true,
        });
        if (result.remoteSynced) {
          setSaveStatus('saved');
          setLastSaveTime(new Date());
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('idle');
        }
      } catch (err) {
        if (err && typeof err === 'object' && (err as any).__handledSlugConflict) {
          console.warn('⚠️ Remote auto-sync skipped: slug conflict requires user action.');
        } else {
          console.error('❌ Remote auto-sync failed:', err);
        }
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
      } finally {
        autoSaveLockRef.current = false;
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [course, runtimeStatus, resolveOrganizationId, showToast]);

  useEffect(() => {
    const diff = computeCourseDiff(lastPersistedRef.current, course);
    setHasPendingChanges(diff.hasChanges);
  }, [course]);

  function createEmptyCourse(initialCourseId?: string): Course {
    // Smart defaults based on common course patterns
    const currentDate = new Date().toISOString();
    const suggestedTags = ['Professional Development', 'Leadership', 'Skills Training'];
    const resolvedCourseId = initialCourseId && initialCourseId !== 'new' ? initialCourseId : generateId('course');
    
    return {
      id: resolvedCourseId,
      title: 'New Course',
      description: 'Enter your course description here. What will learners achieve after completing this course?',
      status: 'draft',
      thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
      duration: '30 min', // Smart default duration
      difficulty: 'Beginner',
      enrollments: 0,
      completions: 0,
      completionRate: 0,
      avgRating: 0,
      totalRatings: 0,
      createdBy: 'Mya Dennis',
      createdDate: currentDate,
      lastUpdated: currentDate,
      estimatedTime: '30-45 minutes', // Better default estimate
      prerequisites: [],
      learningObjectives: [
        'Understand key concepts and terminology',
        'Apply learned skills in practical scenarios',
        'Demonstrate proficiency through assessments'
      ],
      certification: {
        available: true, // Enable by default
        name: 'Course Completion Certificate',
        requirements: ['Complete all lessons', 'Pass final assessment with 80% score'],
        validFor: '1 year',
        renewalRequired: false
      },
      tags: suggestedTags,
      keyTakeaways: [
        'Key concept #1',
        'Practical skill #2',
        'Actionable insight #3'
      ],
      type: 'Mixed',
      lessons: 0,
      rating: 0,
      progress: 0,
      modules: [
        // Start with one module template
        {
          id: createModuleId(),
          title: 'Introduction',
          description: 'Course overview and learning objectives',
          duration: '10 min',
          order: 1,
          lessons: [
            {
              id: createLessonId(),
              title: 'Welcome & Overview',
              type: 'video',
              duration: '5 min',
              content: {
                notes: 'Welcome learners and introduce the course objectives'
              },
              completed: false,
              order: 1
            }
          ],
          resources: []
        }
      ]
    };
  }

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveLockRef = useRef<boolean>(false);
  const lastAutoSaveGateModeRef = useRef<GateMode>('remote');
  const lastLocalOnlyReasonRef = useRef<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<BuilderConfirmAction | null>(null);

  const confirmDialogContent = useMemo<ConfirmDialogConfig | null>(() => {
    if (!confirmDialog) return null;
    const savedDescriptor = lastSaveTime
      ? `saved at ${lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : course.lastUpdated
        ? `updated on ${new Date(course.lastUpdated).toLocaleString()}`
        : null;

    switch (confirmDialog) {
      case 'discard':
        return {
          title: 'Discard local changes?',
          description: savedDescriptor
            ? `Revert to the draft ${savedDescriptor}. Any unsaved edits will be lost.`
            : 'Revert to the starter template. Any unsaved edits will be lost.',
          confirmLabel: 'Discard changes',
          tone: 'warning'
        };
      case 'reset':
        return {
          title: 'Reset course to starter template?',
          description: 'All modules, lessons, and settings will be replaced with the default template until you save new changes.',
          confirmLabel: 'Reset to template',
          tone: 'warning'
        };
      case 'delete':
        return {
          title: `Delete "${course.title || 'this course'}"?`,
          description: 'This permanently removes the course and its analytics. Learners will immediately lose access.',
          confirmLabel: 'Delete course',
          tone: 'danger'
        };
      default:
        return null;
    }
  }, [confirmDialog, course.lastUpdated, course.title, lastSaveTime]);

  useEffect(() => {
    if (!confirmDialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmDialog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog]);
  
  // Inline editing state
  const [inlineEditing, setInlineEditing] = useState<{moduleId: string, lessonId: string} | null>(null);
  
  // Live preview state
  const [showPreview, setShowPreview] = useState(false);
  
  // AI Assistant handlers
  const handleApplySuggestion = (suggestion: any) => {
    switch (suggestion.id) {
      case 'desc-enhance':
        setCourse(prev => ({
          ...prev,
          description: prev.description + ' This course is designed to help you develop essential skills through hands-on practice, real-world examples, and interactive exercises. By the end of this course, you will have gained practical knowledge that you can immediately apply in your professional environment.'
        }));
        break;
      case 'objectives-expand':
        setCourse(prev => ({
          ...prev,
          learningObjectives: [
            'Understand and apply key concepts and principles',
            'Demonstrate proficiency through practical exercises',
            'Analyze real-world scenarios and provide solutions', 
            'Evaluate different approaches and methodologies',
            'Create actionable plans for implementation'
          ]
        }));
        break;
      case 'accessibility-transcripts':
        // Auto-enable transcript placeholders for video lessons
        setCourse(prev => ({
          ...prev,
          modules: prev.modules?.map(module => ({
            ...module,
            lessons: module.lessons.map(lesson => 
              lesson.type === 'video' 
                ? { ...lesson, content: { ...lesson.content, transcript: 'Transcript will be automatically generated...' }}
                : lesson
            )
          })) || []
        }));
        break;
      case 'performance-lazy-load':
        // This would be handled at the system level
        console.log('Performance optimization applied');
        break;
    }
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    console.log('Dismissed suggestion:', suggestionId);
  };

  const reorderModules = useCallback((dragIndex: number, hoverIndex: number) => {
    setCourse((prev) => {
      const existingModules = [...(prev.modules || [])];
      if (
        dragIndex === hoverIndex ||
        dragIndex < 0 ||
        hoverIndex < 0 ||
        dragIndex >= existingModules.length ||
        hoverIndex >= existingModules.length
      ) {
        return prev;
      }

      const [draggedModule] = existingModules.splice(dragIndex, 1);
      existingModules.splice(hoverIndex, 0, draggedModule);

      const reorderedModules = existingModules.map((module, index) => ({
        ...module,
        order: index + 1,
      }));

      return {
        ...prev,
        modules: reorderedModules,
      };
    });
  }, []);

  const reorderLessons = useCallback((moduleId: string, dragIndex: number, hoverIndex: number) => {
    setCourse((prev) => {
      return {
        ...prev,
        modules:
          prev.modules?.map((module) => {
            if (module.id !== moduleId) {
              return module;
            }

            const lessons = [...(module.lessons || [])];
            if (
              dragIndex === hoverIndex ||
              dragIndex < 0 ||
              hoverIndex < 0 ||
              dragIndex >= lessons.length ||
              hoverIndex >= lessons.length
            ) {
              return module;
            }

            const [draggedLesson] = lessons.splice(dragIndex, 1);
            lessons.splice(hoverIndex, 0, draggedLesson);

            const reorderedLessons = lessons.map((lesson, index) => ({
              ...lesson,
              order: index + 1,
            }));

            return { ...module, lessons: reorderedLessons };
          }) || [],
      };
    });
  }, []);

  const handleModuleDragEnd = useCallback((event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const fromIndex = modules.findIndex((module) => module.id === event.active.id);
    const toIndex = modules.findIndex((module) => module.id === event.over!.id);
    if (fromIndex < 0 || toIndex < 0) return;
    reorderModules(fromIndex, toIndex);
  }, [modules, reorderModules]);

  const handleLessonDragEnd = useCallback((moduleId: string, event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const module = course.modules?.find((m) => m.id === moduleId);
    if (!module) return;
    const fromIndex = module.lessons.findIndex((lesson) => lesson.id === event.active.id);
    const toIndex = module.lessons.findIndex((lesson) => lesson.id === event.over!.id);
    if (fromIndex < 0 || toIndex < 0) return;
    reorderLessons(moduleId, fromIndex, toIndex);
  }, [course.modules, reorderLessons]);

  // Version control handler
  const handleRestoreVersion = (version: any) => {
    setCourse(version.course);
  };

  useEffect(() => {
    if (course && !lastPersistedRef.current) {
      lastPersistedRef.current = course;
    }
  }, [course]);

  const enforceStableModuleGraph = (input: Course): Course => ({
    ...input,
    modules: sanitizeModuleGraph(input.modules || []),
  });

  type PersistCourseOptions = {
    statusOverride?: 'draft' | 'published';
    intentOverride?: CourseValidationIntent;
    gate?: RuntimeGateResult;
    action?: IdempotentAction;
    skipValidation?: boolean;
  };

  type PersistCourseResult = {
    course: Course;
    gate: RuntimeGateResult;
    remoteSynced: boolean;
  };

  type SlugConflictInfo = {
    suggestion: string;
    message: string;
  };

  const buildLocalSlugSuggestion = (value?: string | null): string => {
    const normalized = slugify(value || '') || '';
    if (!normalized) {
      return `course-${Math.random().toString(36).slice(2, 8)}`;
    }
    const match = normalized.match(/^(.*?)-(\d+)$/);
    if (match) {
      const [, prefix, suffix] = match;
      const next = Number.parseInt(suffix, 10);
      if (Number.isFinite(next)) {
        return `${prefix}-${next + 1}`;
      }
    }
    return `${normalized}-2`;
  };

  const parseSlugConflictError = (error: unknown, fallbackSlug?: string | null): SlugConflictInfo | null => {
    if (!(error instanceof ApiError)) return null;
    if (error.status !== 409) return null;
    const body = (error.body ?? {}) as Record<string, any>;
    const code = (body?.code || body?.error) ?? null;
    if (code !== 'slug_taken') return null;
    const suggestionInput =
      typeof body?.suggestion === 'string' && body.suggestion.trim().length > 0 ? body.suggestion.trim() : null;
    const suggestion = slugify(suggestionInput || '') || buildLocalSlugSuggestion(fallbackSlug);
    const message =
      typeof body?.message === 'string' && body.message.trim().length > 0
        ? body.message.trim()
        : 'Slug is already used. Updated the slug field with a new suggestion.';
    return { suggestion, message };
  };

  const isClientGeneratedId = (value?: string | null): boolean => {
    if (!value) return true;
    return value.startsWith('course-');
  };

  const persistCourse = async (
    nextCourse: Course,
    options?: PersistCourseOptions | 'draft' | 'published'
  ): Promise<PersistCourseResult> => {
    const resolvedOptions: PersistCourseOptions =
      typeof options === 'string' ? { statusOverride: options } : options ?? {};
    const { statusOverride, intentOverride, gate: gateOverride, action, skipValidation } = resolvedOptions;

    const sanitizedNextCourse = enforceStableModuleGraph(nextCourse);

    const resolvedOrgId = resolveOrganizationId(sanitizedNextCourse);

    const preparedCourse: Course = {
      ...sanitizedNextCourse,
      status: statusOverride ?? nextCourse.status ?? 'draft',
      duration: calculateCourseDuration(sanitizedNextCourse.modules || []),
      lessons: countTotalLessons(sanitizedNextCourse.modules || []),
      lastUpdated: new Date().toISOString(),
      publishedDate:
        (statusOverride ?? nextCourse.status) === 'published'
          ? sanitizedNextCourse.publishedDate || new Date().toISOString()
          : sanitizedNextCourse.publishedDate,
    };

    if (resolvedOrgId) {
      preparedCourse.organizationId = resolvedOrgId;
    }
    stampCanonicalOrgId(preparedCourse as Record<string, any>, resolvedOrgId);

    const derivedAction: IdempotentAction =
      action ?? (statusOverride === 'published' ? 'course.publish' : 'course.save');
    const runtimeAction: RuntimeAction = (() => {
      switch (derivedAction) {
        case 'course.publish':
          return 'course.publish';
        case 'course.auto-save':
          return 'course.auto-save';
        case 'course.assign':
          return 'course.assign';
        default:
          return 'course.save';
      }
    })();
    const gate = gateOverride ?? evaluateRuntimeGate(runtimeAction, runtimeStatus);
    const allowRemoteSync = gate.mode === 'remote';

    const diff = computeCourseDiff(lastPersistedRef.current, preparedCourse);

    if (!skipValidation) {
      const validationIntent: CourseValidationIntent =
        intentOverride ?? (preparedCourse.status === 'published' ? 'publish' : 'draft');
      const validationSummary = evaluateCourseValidation(preparedCourse, validationIntent);
      if (!validationSummary.isValid) {
        const blockingIssues = validationSummary.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => issue.message);
        presentValidationIssues(
          { issues: validationSummary.issues, issueTargets: validationSummary.issueTargets },
          validationIntent,
        );
        throw new CourseValidationError('course', blockingIssues, validationSummary.issues);
      }
    }

    if (!diff.hasChanges) {
      courseStore.saveCourse(preparedCourse, { skipRemoteSync: true });
      setCourse(preparedCourse);
      await markDraftSynced(preparedCourse.id, preparedCourse);
      return { course: preparedCourse, gate, remoteSynced: true };
    }

    let merged = preparedCourse;
    let remoteSynced = false;

    if (allowRemoteSync && resolvedOrgId) {
      const isCreateOperation = isClientGeneratedId(lastPersistedRef.current?.id) || !lastPersistedRef.current;
      try {
        const { clone: apiCourse } = cloneWithCanonicalOrgId(preparedCourse, { removeAliases: true });
        const persisted = await syncCourseToDatabase(apiCourse as Course, { action: derivedAction });
        merged = persisted ? mergePersistedCourse(preparedCourse, persisted) : preparedCourse;
        remoteSynced = true;
        logDev(isCreateOperation ? 'autosave_post_success' : 'autosave_put_success', {
          id: merged.id,
        });
      } catch (error) {
        const status = error instanceof ApiError ? error.status : undefined;
        logDev(isCreateOperation ? 'autosave_post_failed' : 'autosave_put_failed', {
          status,
          message: error instanceof Error ? error.message : String(error),
        });
        const slugConflict = parseSlugConflictError(error, preparedCourse.slug);
        if (slugConflict) {
          const nextCourseState = { ...preparedCourse, slug: slugConflict.suggestion };
          courseStore.saveCourse(nextCourseState, { skipRemoteSync: true });
          setCourse(nextCourseState);
          showToast(slugConflict.message, 'warning', 6000);
          if (error && typeof error === 'object') {
            (error as any).__handledSlugConflict = slugConflict;
          }
        }
        throw error;
      }
    } else if (!resolvedOrgId) {
      logDev('autosave_post_failed', {
        status: 'missing_org_id',
        id: preparedCourse.id,
      });
    }

    const mergedWithFallback =
      merged.modules && merged.modules.length > 0 ? merged : { ...merged, modules: preparedCourse.modules };
    courseStore.saveCourse(mergedWithFallback, { skipRemoteSync: true });
    setCourse(mergedWithFallback);
    if (remoteSynced) {
      lastPersistedRef.current = mergedWithFallback;
      await markDraftSynced(mergedWithFallback.id, mergedWithFallback);
    }
    return { course: mergedWithFallback, gate, remoteSynced };
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate save delay
      const gate = evaluateRuntimeGate('course.save', runtimeStatus);
      const result = await persistCourse(course, { gate, action: 'course.save' });

      if (result.remoteSynced) {
        setSaveStatus('saved');
        setLastSaveTime(new Date());
        setHasPendingChanges(false);
        showToast('Draft synced to your Huddle workspace.', 'success');
        clearValidationIssues();
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('idle');
        showToast(
          result.gate.reason ?? 'Draft saved locally. We’ll sync once Huddle reconnects.',
          'warning',
          6000,
        );
      }

      if (isNewCourseRoute) {
        navigate(`/admin/course-builder/${result.course.id}`);
      }
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).__handledSlugConflict) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 5000);
        return;
      }
      if (error instanceof CourseValidationError) {
        console.warn('⚠️ Course validation issues:', error.issues);
        showToast('Validation failed. Resolve highlighted issues before saving.', 'warning', 5000);
        const details = mapValidationErrorDetails(error, 'local.validation');
        presentValidationIssues({ issues: details, issueTargets: buildIssueTargets(details) }, 'draft');
      } else {
        console.error('❌ Error saving course:', error);
        if (error instanceof ApiError && error.status === 401) {
          handleAuthRequired('save-course');
        }
        showToast(networkFallback('Unable to save course. Please try again.'), isOffline() ? 'warning' : 'error', 5000);
      }
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  const handlePublish = async () => {
    const publishOrgId = activeOrgId ?? course.organizationId ?? null;
    const publishContext = {
      courseId: course.id,
      orgId: publishOrgId,
      userId: authUser?.id ?? null,
      moduleCount: course.modules?.length ?? 0,
      lessonCount: countTotalLessons(course.modules || []),
    };
    let publishIdentifiers: { idempotencyKey: string; clientRequestId: string } | null = null;
    const getPublishTelemetry = (issuesCount = 0, requestIdOverride: string | null = null) => ({
      ...publishContext,
      issuesCount,
      requestId: requestIdOverride ?? publishIdentifiers?.clientRequestId ?? null,
    });
    const logPublishGuard = (
      level: 'info' | 'warn' | 'error',
      event: string,
      meta: Record<string, unknown> = {},
      issuesCountOverride?: number,
    ) => {
      const requestId =
        typeof meta.requestId === 'string' ? (meta.requestId as string) : null;
      const payload = {
        event,
        ...getPublishTelemetry(issuesCountOverride ?? 0, requestId),
        ...meta,
      };
      if (level === 'error') {
        console.error(`[AdminCourseBuilder] ${event}`, payload);
      } else if (level === 'warn') {
        console.warn(`[AdminCourseBuilder] ${event}`, payload);
      } else {
        console.info(`[AdminCourseBuilder] ${event}`, payload);
      }
    };

    const publishFailedToast = (detail: string, tone: 'success' | 'info' | 'warning' | 'error' = 'error', duration = 6000) => {
      const message = detail ? `Publish failed. ${detail}` : 'Publish failed.';
      showToast(message, tone, duration);
    };

    const logPublishFailure = (
      status: number | null,
      errorCode: string | null,
      message: string,
      meta: Record<string, unknown> = {},
    ) => {
      console.warn('[AdminCourseBuilder] publish_failure', {
        ...publishContext,
        status,
        errorCode,
        message,
        ...meta,
      });
    };

    if (!effectiveValidationSummary.isValid) {
      logPublishGuard('warn', 'publish_blocked_local_validation', {}, effectiveValidationSummary.issues.length);
      emphasizeValidationPanel();
      publishFailedToast('Resolve validation blockers before publishing.', 'warning', 5000);
      return;
    }

    setSaveStatus('saving');
    setStatusBanner(null);

    try {
      const gate = evaluateRuntimeGate('course.publish', runtimeStatus);
      if (gate.mode !== 'remote') {
        setStatusBanner({
          tone: gate.tone,
          title: 'Publishing paused',
          description: gate.reason ?? 'Publishing requires a healthy connection. Try again once services recover.',
          icon: gate.offline ? WifiOff : AlertTriangle,
        });
        showToast(gate.reason ?? 'Publishing paused until runtime health returns.', 'warning', 6000);
        setSaveStatus('idle');
        return;
      }

      const preparedCourse = {
        ...course,
        lastUpdated: new Date().toISOString(),
      };

      let latestPersisted: Course | null = null;

      try {
        const { course: persistedCourse, remoteSynced } = await persistCourse(preparedCourse, {
          intentOverride: 'publish',
          statusOverride: 'published',
          gate,
          action: 'course.publish',
        });

        if (!remoteSynced) {
          showToast('Unable to reach Supabase. Publishing will resume once we reconnect.', 'warning', 6000);
          setSaveStatus('idle');
          return;
        }

        latestPersisted = lastPersistedRef.current || persistedCourse;
        publishIdentifiers = createActionIdentifiers('course.publish', { courseId: latestPersisted.id });
        const publishVersion =
          typeof (latestPersisted as any)?.version === 'number' ? (latestPersisted as any).version : null;

        const publishResponse = await adminPublishCourse(latestPersisted.id, {
          version: publishVersion,
          idempotencyKey: publishIdentifiers.idempotencyKey,
        });

        const remoteValidation = coerceValidationPayload(publishResponse as ValidationIssuePayload);
        if (remoteValidation.issues.length > 0) {
          const blockerMessage =
            remoteValidation.issues[0]?.message ?? 'Resolve the highlighted publish blockers and try again.';
          setStatusBanner({
            tone: 'danger',
            title: 'Resolve publish blockers',
            description: blockerMessage,
            icon: AlertTriangle,
          });
          logPublishFailure(422, 'validation_failed', blockerMessage, {
            source: 'publish_response',
            issuesCount: remoteValidation.issues.length,
          });
          publishFailedToast(blockerMessage, 'warning');
          presentValidationIssues({
            issues: remoteValidation.issues,
            issueTargets: remoteValidation.issueTargets,
          }, 'publish');
          setSaveStatus('idle');
          return;
        }

        try {
          const refreshed = await loadCourseFromDatabase(latestPersisted.id, { includeDrafts: true });
          if (refreshed) {
            courseStore.saveCourse(refreshed as Course, { skipRemoteSync: true });
            setCourse(refreshed as Course);
            lastPersistedRef.current = refreshed as Course;
            latestPersisted = refreshed as Course;
          }
        } catch (refreshErr) {
          console.warn('Failed to reload course after publish', refreshErr);
        }
      } catch (pipelineError) {
        const validationDetails =
          pipelineError instanceof CourseValidationError
            ? mapValidationErrorDetails(pipelineError, 'publish.validation')
            : null;
        logPublishGuard('warn', 'publish_pipeline_failed', { error: pipelineError }, validationDetails?.length ?? 0);

        if (pipelineError instanceof CourseValidationError) {
          const detailCount = validationDetails?.length ?? pipelineError.issues.length ?? 0;
          logPublishGuard('warn', 'publish_validation_error', { error: pipelineError }, detailCount);
          logPublishFailure(null, 'validation_failed', pipelineError.message ?? 'Validation failed.', {
            source: 'publish_pipeline',
            issuesCount: detailCount,
          });
          publishFailedToast('Resolve validation blockers before publishing.', 'warning');
          const normalizedIssues = validationDetails ?? [];
          presentValidationIssues(
            { issues: normalizedIssues, issueTargets: buildIssueTargets(normalizedIssues) },
            'publish',
          );
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 5000);
          return;
        }

        throw pipelineError;
      }

      if (!latestPersisted) {
        return;
      }

      setSaveStatus('saved');
      setLastSaveTime(new Date());
      setHasPendingChanges(false);
      showToast('Course published to learners via Huddle.', 'success');
      logPublishGuard('info', 'publish_complete');
      clearValidationIssues();
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).__handledSlugConflict) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 5000);
        return;
      }
      if (error instanceof CourseValidationError) {
        logPublishGuard('warn', 'publish_validation_error', { error }, error.issues.length);
        logPublishFailure(null, 'validation_failed', error.message ?? 'Validation failed.', {
          source: 'publish_catch',
          issuesCount: error.issues.length,
        });
        publishFailedToast('Resolve validation blockers before publishing.', 'warning');
        const details = mapValidationErrorDetails(error, 'publish.validation');
        presentValidationIssues({ issues: details, issueTargets: buildIssueTargets(details) }, 'publish');
      } else if (error instanceof ApiError) {
        logPublishGuard('warn', 'publish_request_failed', { status: error.status, error });
        const responseBody = (error.body || {}) as { error?: string; code?: string; issues?: CourseValidationIssue[]; currentVersion?: number };
        const errorCode = error.code || responseBody.code || responseBody.error || null;
        const apiErrorMessage =
          typeof (responseBody as any)?.message === 'string'
            ? ((responseBody as any).message as string)
            : error.message;
        logPublishFailure(error.status ?? null, errorCode, apiErrorMessage || 'Publish request failed.', {
          source: 'publish_api_error',
        });

        if (error.status === 409 && errorCode === 'version_conflict') {
          setStatusBanner({
            tone: 'danger',
            title: 'A newer draft exists',
            description: 'Reload the latest version before publishing again so you do not overwrite changes.',
            icon: RefreshCcw,
            actionLabel: 'Reload latest',
            onAction: () => {
              requestCourseReload();
              setStatusBanner(null);
            }
          });
          publishFailedToast('Reload the latest draft before publishing.', 'warning');
        } else if (error.status === 422 && errorCode === 'validation_failed') {
          const serverValidation = parseServerValidationPayload(responseBody);
          const firstIssue = serverValidation.issues[0]?.message ?? 'Resolve the highlighted publish blockers and try again.';
          setStatusBanner({
            tone: 'danger',
            title: 'Resolve publish blockers',
            description: firstIssue,
            icon: AlertTriangle
          });
          logPublishFailure(error.status ?? null, errorCode, firstIssue, {
            source: 'publish_server_validation',
            issuesCount: serverValidation.issues.length,
          });
          publishFailedToast('Fix the publish blockers and try again.', 'warning');
          if (serverValidation.issues.length) {
            logPublishGuard('warn', 'publish_validation_failed_server', { status: error.status }, serverValidation.issues.length);
            const serverIssues = Array.isArray(serverValidation.issues) ? serverValidation.issues : [];
            const serverTargets = serverValidation.issueTargets ?? getIssueTargetsOrEmpty();
            presentValidationIssues({ issues: serverIssues, issueTargets: serverTargets }, 'publish');
          }
        } else if (errorCode === 'idempotency_conflict') {
          publishFailedToast('Publish request already in progress. Please wait a moment and refresh.', 'info', 4000);
        } else {
          if (error.status === 401) {
            handleAuthRequired('publish-course');
          }
          logPublishGuard('warn', 'publish_request_failed_retryable', { status: error.status });
          const fallbackDetail = networkFallback('Unable to publish course. Please try again.');
          publishFailedToast(fallbackDetail, isOffline() ? 'warning' : 'error', 5000);
        }
      } else {
        logPublishGuard('error', 'publish_unhandled_error', { error });
        const message = error instanceof Error ? error.message : 'Unexpected error';
        logPublishFailure(null, 'unknown_error', message, { source: 'publish_unknown' });
        const fallbackDetail = networkFallback('Unable to publish course. Please try again.');
        publishFailedToast(fallbackDetail, isOffline() ? 'warning' : 'error', 5000);
      }
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  const revertToLastSaved = () => {
    const sourceCourse = lastPersistedRef.current;
    const restored = sourceCourse ? deepClone(sourceCourse) : createEmptyCourse(course.id);
    setCourse(restored);
    courseStore.saveCourse(restored, { skipRemoteSync: true });
    setEditingLesson(null);
    setHasPendingChanges(false);
    setSaveStatus('idle');
    showToast(
      sourceCourse ? 'Reverted to last saved draft.' : 'Reset to starter template.',
      sourceCourse ? 'info' : 'warning'
    );
  };

  const handleConfirmDiscard = () => {
    revertToLastSaved();
    setConfirmDialog(null);
  };

  const handleResetCourseTemplate = () => {
    const template = deepClone(createEmptyCourse(course.id));
    setCourse(template);
    courseStore.saveCourse(template, { skipRemoteSync: true });
    setEditingLesson(null);
    setHasPendingChanges(true);
    setSaveStatus('idle');
    showToast('Course reset to template. Save to apply changes.', 'warning');
    setConfirmDialog(null);
  };

  const handleConfirmDeleteCourse = () => {
    try {
      courseStore.deleteCourse(course.id);
      showToast('Course deleted successfully.', 'success');
      navigate('/admin/courses');
    } catch (error) {
      console.warn('Delete failed', error);
      showToast('Failed to delete course. Please try again.', 'error');
    } finally {
      setConfirmDialog(null);
    }
  };

  const confirmActionHandlers: Record<BuilderConfirmAction, () => void> = {
    discard: handleConfirmDiscard,
    reset: handleResetCourseTemplate,
    delete: handleConfirmDeleteCourse
  };

  const handleConfirmAction = () => {
    if (!confirmDialog) return;
    const action = confirmActionHandlers[confirmDialog];
    if (action) action();
  };

  const handleRestoreDraftSnapshot = useCallback(async () => {
    if (!draftSnapshotPrompt) return;
    if (runtimeStatus.apiAuthRequired) {
      handleAuthRequired('restore-draft');
      return;
    }
    try {
      setCourse(draftSnapshotPrompt.course);
      courseStore.saveCourse(draftSnapshotPrompt.course, { skipRemoteSync: true });
      lastPersistedRef.current = draftSnapshotPrompt.course;
      await markDraftSynced(draftSnapshotPrompt.course.id, draftSnapshotPrompt.course);
      setHasPendingChanges(true);
      showToast('Restored the latest local draft. Continue editing and save when ready.', 'info');
    } catch (error) {
      console.warn('[AdminCourseBuilder] Failed to restore draft snapshot:', error);
      showToast('Unable to restore cached draft. Please try again.', 'error');
    } finally {
      setDraftSnapshotPrompt(null);
      draftCheckIdRef.current = course.id;
    }
  }, [course.id, draftSnapshotPrompt, runtimeStatus.apiAuthRequired, handleAuthRequired, showToast]);

  const handleDiscardDraftSnapshot = useCallback(async () => {
    if (!course.id) return;
    try {
      await deleteDraftSnapshot(course.id);
      setDraftSnapshotPrompt(null);
      showToast('Discarded the local-only draft snapshot.', 'info');
    } catch (error) {
      console.warn('[AdminCourseBuilder] Failed to discard draft snapshot:', error);
      showToast('Could not discard the cached draft. Please retry.', 'error');
    } finally {
      draftCheckIdRef.current = course.id;
    }
  }, [course.id, showToast]);

  const handleAssignmentComplete = (assignments?: CourseAssignment[]) => {
    setShowAssignmentModal(false);
    const count = assignments?.length ?? 0;
    const baseMessage = count > 0
      ? `Assignments sent to ${count} learner${count === 1 ? '' : 's'}.`
      : 'Assignments queued successfully.';
    showToast(`${baseMessage} Learners will see Huddle notifications shortly.`, 'success');
  };

  const addModule = () => {
    const newModule: Module = {
      id: createModuleId(),
      title: `Module ${(course.modules || []).length + 1}`,
      description: '',
      duration: '0 min',
      order: (course.modules || []).length + 1,
      lessons: [],
      resources: []
    };
    
    setCourse(prev => ({
      ...prev,
      modules: [...(prev.modules || []), newModule]
    }));
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setCourse(prev => {
      const updatedCourse = {
        ...prev,
        modules: (prev.modules || []).map(module =>
          module.id === moduleId ? { ...module, ...updates } : module
        )
      };
      
      // Save the updated course to localStorage
      courseStore.saveCourse(updatedCourse, { skipRemoteSync: true });
      
      return updatedCourse;
    });
  };

  const deleteModule = (moduleId: string) => {
    setCourse(prev => ({
      ...prev,
      modules: (prev.modules || []).filter(module => module.id !== moduleId)
    }));
  };

  const addLesson = (moduleId: string) => {
    const module = course.modules?.find(m => m.id === moduleId);
    if (!module) return;

    const newLesson: Lesson = {
      id: createLessonId(),
      title: `Lesson ${module.lessons.length + 1}`,
      type: 'video',
      duration: '10 min',
      content: {},
      completed: false,
      order: module.lessons.length + 1,
      module_id: moduleId,
      moduleId,
    };

    updateModule(moduleId, {
      lessons: [...module.lessons, newLesson]
    });
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    const module = course.modules?.find(m => m.id === moduleId);
    if (!module) return;

    const updatedLessons = module.lessons.map(lesson => {
      if (lesson.id !== lessonId) return lesson;
      const merged: Lesson = {
        ...lesson,
        ...updates,
        module_id: lesson.module_id || (lesson as any).moduleId || moduleId,
        moduleId: lesson.module_id || (lesson as any).moduleId || moduleId,
      };
      if (merged.content) {
        merged.content = canonicalizeLessonContent(merged.content);
      }
      return merged;
    });

    updateModule(moduleId, { lessons: updatedLessons });
  };

  const deleteLesson = (moduleId: string, lessonId: string) => {
    const module = course.modules?.find(m => m.id === moduleId);
    if (!module) return;

    updateModule(moduleId, {
      lessons: module.lessons.filter(lesson => lesson.id !== lessonId)
    });
  };

  const handleVideoUpload = async (moduleId: string, lessonId: string, file: File) => {
    const uploadKey = buildUploadKey(moduleId, lessonId);
    const limitLabel = (VIDEO_UPLOAD_LIMIT_BYTES / (1024 * 1024)).toFixed(0);
    if (file.size > VIDEO_UPLOAD_LIMIT_BYTES) {
      const message = `File size (${formatFileSize(file.size)}) exceeds the ${limitLabel}MB limit.`;
      setUploadErrors((prev) => ({ ...prev, [uploadKey]: message }));
      showToast(message, 'error');
      return;
    }

    pendingUploadFiles.current[uploadKey] = file;
    uploadChannels.current[uploadKey] = 'video';
    const controller = new AbortController();
    uploadControllers.current[uploadKey] = controller;

    setUploadErrors((prev) => ({ ...prev, [uploadKey]: null }));
    setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'uploading' } }));
    setUploadingVideos((prev) => ({ ...prev, [uploadKey]: true }));
    setUploadProgress((prev) => ({ ...prev, [uploadKey]: 1 }));

    const uploadAuthor = resolveUploadAuthor();
    const fileSizeLabel = formatFileSize(file.size);

    try {
      const response = await uploadLessonVideo({
        courseId: course.id,
        moduleId,
        lessonId,
        file,
        signal: controller.signal,
        onProgress: (percent) => {
          setUploadProgress((prev) => ({ ...prev, [uploadKey]: percent }));
        },
      });
      const payload = response?.data;
      if (!payload?.signedUrl) {
        throw new Error('Upload did not return a signed URL');
      }

      const existingContent = course.modules
        ?.find((m) => m.id === moduleId)
        ?.lessons.find((l) => l.id === lessonId)?.content;

      const videoAsset: LessonVideoAsset = {
        assetId: payload.assetId,
        storagePath: payload.storagePath,
        bucket: payload.bucket,
        bytes: payload.fileSize ?? file.size,
        mimeType: payload.mimeType || file.type || 'video/mp4',
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploadAuthor,
        source: 'api',
        status: 'uploaded',
        signedUrl: payload.signedUrl,
        urlExpiresAt: payload.urlExpiresAt,
      };

      updateLesson(moduleId, lessonId, {
        content: {
          ...existingContent,
          videoUrl: payload.signedUrl,
          fileName: file.name,
          fileSize: fileSizeLabel,
          videoAsset,
          videoSourceType: 'internal',
        },
      });

      pendingUploadFiles.current[uploadKey] = null;
      setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'success' } }));
      setUploadProgress((prev) => ({ ...prev, [uploadKey]: 100 }));
      showToast('Video uploaded and secured successfully.', 'success');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'paused', message: 'Upload paused' } }));
      } else {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Upload failed due to an unknown error';
        setUploadErrors((prev) => ({ ...prev, [uploadKey]: message }));
        setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'error', message } }));
        showToast(message, 'error');
      }
    } finally {
      setUploadingVideos((prev) => ({ ...prev, [uploadKey]: false }));
      uploadControllers.current[uploadKey] = null;
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, [uploadKey]: 0 }));
      }, 3000);
    }
  };

  const handleFileUpload = async (moduleId: string, lessonId: string, file: File) => {
    const uploadKey = buildUploadKey(moduleId, lessonId);
    const limitLabel = (DOCUMENT_UPLOAD_LIMIT_BYTES / (1024 * 1024)).toFixed(0);
    if (file.size > DOCUMENT_UPLOAD_LIMIT_BYTES) {
      const message = `File size (${formatFileSize(file.size)}) exceeds the ${limitLabel}MB limit.`;
      setUploadErrors((prev) => ({ ...prev, [uploadKey]: message }));
      setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'error', message } }));
      showToast(message, 'error');
      return;
    }

    pendingUploadFiles.current[uploadKey] = file;
    uploadChannels.current[uploadKey] = 'document';
    const controller = new AbortController();
    uploadControllers.current[uploadKey] = controller;

    setUploadErrors((prev) => ({ ...prev, [uploadKey]: null }));
    setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'uploading' } }));
    setUploadingVideos((prev) => ({ ...prev, [uploadKey]: true }));
    setUploadProgress((prev) => ({ ...prev, [uploadKey]: 1 }));

    const uploadAuthor = resolveUploadAuthor();
    const fileSizeLabel = formatFileSize(file.size);
    const existingLesson = course.modules?.find((m) => m.id === moduleId)?.lessons.find((l) => l.id === lessonId);
    const existingContent = existingLesson?.content;

    try {
      const response = await uploadDocumentResource({
        file,
        documentId: existingContent?.documentId,
        orgId: course.organizationId,
        courseId: course.id,
        moduleId,
        lessonId,
        signal: controller.signal,
        onProgress: (percent) => {
          setUploadProgress((prev) => ({ ...prev, [uploadKey]: percent }));
        },
      });

      const payload = response?.data;
      if (!payload?.signedUrl) {
        throw new Error('Upload did not return a signed URL');
      }

      const documentAsset: LessonVideoAsset = {
        assetId: payload.assetId,
        storagePath: payload.storagePath,
        bucket: payload.bucket || 'course-documents',
        bytes: payload.fileSize ?? file.size,
        mimeType: payload.fileType || file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploadAuthor,
        source: 'api',
        status: 'uploaded',
        signedUrl: payload.signedUrl,
        urlExpiresAt: payload.urlExpiresAt,
      };

      updateLesson(moduleId, lessonId, {
        content: {
          ...existingContent,
          fileUrl: payload.signedUrl,
          documentUrl: payload.signedUrl,
          fileName: file.name,
          fileSize: fileSizeLabel,
          documentAsset,
          documentId: payload.documentId,
          documentType: inferDocumentType(file.name),
        },
      });

      pendingUploadFiles.current[uploadKey] = null;
      setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'success' } }));
      setUploadProgress((prev) => ({ ...prev, [uploadKey]: 100 }));
      showToast('Resource uploaded and secured successfully.', 'success');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'paused', message: 'Upload paused' } }));
      } else {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Upload failed due to an unknown error';
        setUploadErrors((prev) => ({ ...prev, [uploadKey]: message }));
        setUploadStatuses((prev) => ({ ...prev, [uploadKey]: { status: 'error', message } }));
        showToast(message, 'error');
      }
    } finally {
      setUploadingVideos((prev) => ({ ...prev, [uploadKey]: false }));
      uploadControllers.current[uploadKey] = null;
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, [uploadKey]: 0 }));
      }, 3000);
    }
  };

  const toggleModuleExpansion = (moduleId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
    if (isMobile) {
      setActiveMobileModuleId(moduleId);
    }
  };

  const renderLessonEditor = (moduleId: string, lesson: Lesson) => {
    const isEditing = editingLesson?.moduleId === moduleId && editingLesson?.lessonId === lesson.id;
    const uploadKey = buildUploadKey(moduleId, lesson.id);
    const uploadStatus = uploadStatuses[uploadKey];
    const uploadErrorMessage = uploadErrors[uploadKey];
    const isUploading = Boolean(uploadingVideos[uploadKey]);
    const progress = uploadProgress[uploadKey] ?? 0;
  const videoInputId = `video-upload-${lesson.id}`;
  const documentInputId = `file-upload-${lesson.id}`;

    if (!isEditing) {
      return (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full border border-gray-200">
              {lesson.type === 'video' && <Video className="h-4 w-4 text-blue-500" />}
              {lesson.type === 'interactive' && <MessageSquare className="h-4 w-4 text-green-500" />}
              {lesson.type === 'quiz' && <CheckCircle className="h-4 w-4 text-orange-500" />}
              {lesson.type === 'document' && <FileText className="h-4 w-4 text-purple-500" />}
              {lesson.type === 'text' && <BookOpen className="h-4 w-4 text-indigo-500" />}
            </div>
            <div>
              {inlineEditing?.moduleId === moduleId && inlineEditing?.lessonId === lesson.id ? (
                <input
                  type="text"
                  value={lesson.title}
                  onChange={(e) => updateLesson(moduleId, lesson.id, { title: e.target.value })}
                  onBlur={() => setInlineEditing(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setInlineEditing(null);
                    }
                  }}
                  className="font-medium text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <h4
                    className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                    onDoubleClick={() => setInlineEditing({ moduleId, lessonId: lesson.id })}
                    title="Double-click to edit"
                  >
                    {lesson.title}
                  </h4>
                  <LessonIssueTag issueTargets={visibleIssueTargets} lessonId={lesson.id} />
                </div>
              )}
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {lesson.duration}
                </span>
                <span className="capitalize">{lesson.type}</span>
                {lesson.content.videoUrl && lesson.type === 'video' && (
                  <span className="text-green-600 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Video uploaded
                  </span>
                )}
                {lesson.content.fileUrl && lesson.type === 'document' && (
                  <span className="text-green-600 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    File uploaded
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setEditingLesson({ moduleId, lessonId: lesson.id })}
              className="p-1 text-blue-600 hover:text-blue-800"
              title="Edit lesson"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                try {
                  // Preview the specific lesson in LMS context
                  const lessonUrl = `/lms/courses/${course.id}/modules/${moduleId}?lesson=${lesson.id}`;
                  window.open(lessonUrl, '_blank');
                } catch (err) {
                  console.warn('Preview failed', err);
                }
              }}
              className="p-1 text-green-600 hover:text-green-800"
              title="Preview lesson in LMS"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => deleteLesson(moduleId, lesson.id)}
              className="p-1 text-red-600 hover:text-red-800"
              title="Delete lesson"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="border border-gray-300 rounded-lg p-4 bg-white">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lesson Title</label>
              <input
                type="text"
                value={lesson.title}
                onChange={(e) => updateLesson(moduleId, lesson.id, { title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <input
                type="text"
                value={lesson.duration}
                onChange={(e) => updateLesson(moduleId, lesson.id, { duration: e.target.value })}
                placeholder="e.g., 15 min"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lesson Type</label>
            <select
              value={lesson.type}
              onChange={(e) => updateLesson(moduleId, lesson.id, { 
                type: e.target.value as Lesson['type'],
                content: {} // Reset content when type changes
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="video">Video</option>
              <option value="interactive">Interactive Exercise</option>
              <option value="quiz">Quiz</option>
              <option value="document">Download Resource</option>
              <option value="text">Text Content</option>
            </select>
          </div>

          {/* Lesson Content Editor */}
          {lesson.type === 'video' && (
            <div className="space-y-4">
              {/* Video Source Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Video Source</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => updateLesson(moduleId, lesson.id, {
                      content: { ...lesson.content, videoSourceType: 'internal' }
                    })}
                    className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                      (!lesson.content.videoSourceType || lesson.content.videoSourceType === 'internal')
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Upload className="h-6 w-6 mx-auto mb-2" />
                    <span className="text-sm font-medium">Upload File</span>
                  </button>
                  <button
                    onClick={() => updateLesson(moduleId, lesson.id, {
                      content: { ...lesson.content, videoSourceType: 'external' }
                    })}
                    className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                      lesson.content.videoSourceType === 'external'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Video className="h-6 w-6 mx-auto mb-2" />
                    <span className="text-sm font-medium">External URL</span>
                  </button>
                </div>
              </div>

              {/* Video Content */}
              <div>
                {(!lesson.content.videoSourceType || lesson.content.videoSourceType === 'internal') ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Video Upload</label>
                    {lesson.content.videoUrl ? (
                      <div className="space-y-3">
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                          <video 
                            controls 
                            className="w-full h-full"
                            src={lesson.content.videoUrl}
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="text-green-800 font-medium">
                              {lesson.content.fileName || 'Video uploaded'} 
                              {lesson.content.fileSize && ` (${lesson.content.fileSize})`}
                            </span>
                          </div>
                          <button
                            onClick={() => updateLesson(moduleId, lesson.id, {
                              content: { ...lesson.content, videoUrl: '', fileName: '', fileSize: '', videoAsset: undefined }
                            })}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                        {isUploading ? (
                          <div className="text-center">
                            <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-gray-600">
                              {uploadStatus?.status === 'paused'
                                ? uploadStatus.message || 'Upload paused'
                                : progress === 0
                                  ? 'Preparing upload...'
                                  : progress < 50
                                    ? 'Uploading video...'
                                    : progress < 100
                                      ? 'Processing video...'
                                      : 'Upload complete!'}
                            </p>
                            {progress > 0 && (
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            )}
                            {progress > 0 && (
                              <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
                            )}
                          </div>
                        ) : (
                          <div className="text-center">
                            <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">Upload a video file for this lesson</p>
                            <input
                              type="file"
                              accept="video/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleVideoUpload(moduleId, lesson.id, file);
                                }
                              }}
                              className="hidden"
                              id={videoInputId}
                            />
                            <label
                              htmlFor={videoInputId}
                              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 cursor-pointer inline-flex items-center space-x-2"
                            >
                              <Upload className="h-4 w-4" />
                              <span>Choose Video File</span>
                            </label>
                            <p className="text-xs text-gray-500 mt-2">Supported formats: MP4, WebM, MOV (max {VIDEO_UPLOAD_LIMIT_LABEL}MB)</p>
                          </div>
                        )}
                        {uploadErrorMessage && (
                          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-sm text-red-600 mb-2">{uploadErrorMessage}</p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  setUploadErrors((prev) => ({ ...prev, [uploadKey]: null }));
                                  if (typeof document !== 'undefined') {
                                    const input = document.getElementById(videoInputId) as HTMLInputElement | null;
                                    if (input) {
                                      input.value = '';
                                      input.click();
                                    }
                                  }
                                }}
                                className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                              >
                                Try Again
                              </button>
                              <button
                                onClick={() => setUploadErrors((prev) => ({ ...prev, [uploadKey]: null }))}
                                className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Video URL</label>
                    <input
                      type="url"
                      value={lesson.content.videoUrl || ''}
                      onChange={(e) => updateLesson(moduleId, lesson.id, {
                        content: { ...lesson.content, videoUrl: e.target.value }
                      })}
                      placeholder="https://example.com/video.mp4 or YouTube/Vimeo URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    {lesson.content.videoUrl && (
                      <div className="space-y-2">
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                          {(() => {
                            const url = lesson.content.videoUrl || '';
                            const embedUrl = getVideoEmbedUrl(lesson.content);
                            
                            // Check if it's a supported embed URL (YouTube, Vimeo)
                            if (embedUrl && (url.includes('youtube.') || url.includes('youtu.be') || url.includes('vimeo.'))) {
                              return (
                                <iframe
                                  src={embedUrl}
                                  className="w-full h-full"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  title={lesson.title}
                                />
                              );
                            }
                            
                            // Direct video file
                            return (
                              <video 
                                controls 
                                className="w-full h-full"
                                src={lesson.content.videoUrl}
                              >
                                Your browser does not support the video tag.
                              </video>
                            );
                          })()}
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Preview: Video will display like this to learners</span>
                          <button
                            onClick={() => updateLesson(moduleId, lesson.id, {
                              content: { ...lesson.content, videoUrl: '', videoAsset: undefined }
                            })}
                            className="text-red-600 hover:text-red-800 flex items-center space-x-1"
                          >
                            <X className="h-3 w-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      Supports direct video URLs (.mp4, .webm, .mov) and embedded videos (YouTube, Vimeo)
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transcript (Optional)</label>
                <textarea
                  value={lesson.content.transcript || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, transcript: e.target.value }
                  })}
                  rows={4}
                  placeholder="Add video transcript for accessibility..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Key Notes</label>
                <textarea
                  value={lesson.content.notes || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, notes: e.target.value }
                  })}
                  rows={3}
                  placeholder="Important points and takeaways from this video..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {lesson.type === 'interactive' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scenario Text</label>
                <textarea
                  value={lesson.content.scenarioText || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, scenarioText: e.target.value }
                  })}
                  rows={3}
                  placeholder="Describe the scenario or situation..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Response Options</label>
                <div className="space-y-3">
                  {(lesson.content.options || []).map((option, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">Option {index + 1}</span>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={option.isCorrect || false}
                              onChange={(e) => {
                                const updatedOptions = [...(lesson.content.options || [])];
                                updatedOptions[index] = { ...option, isCorrect: e.target.checked };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, options: updatedOptions }
                                });
                              }}
                              className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-green-600">Correct Answer</span>
                          </label>
                          <button
                            onClick={() => {
                              const updatedOptions = (lesson.content.options || []).filter((_, i) => i !== index);
                              updateLesson(moduleId, lesson.id, {
                                content: { ...lesson.content, options: updatedOptions }
                              });
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={option.text || ''}
                        onChange={(e) => {
                          const updatedOptions = [...(lesson.content.options || [])];
                          updatedOptions[index] = { ...option, text: e.target.value };
                          updateLesson(moduleId, lesson.id, {
                            content: { ...lesson.content, options: updatedOptions }
                          });
                        }}
                        placeholder="Option text..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-2"
                      />
                      <textarea
                        value={option.feedback || ''}
                        onChange={(e) => {
                          const updatedOptions = [...(lesson.content.options || [])];
                          updatedOptions[index] = { ...option, feedback: e.target.value };
                          updateLesson(moduleId, lesson.id, {
                            content: { ...lesson.content, options: updatedOptions }
                          });
                        }}
                        placeholder="Feedback for this option..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newOption = { text: '', feedback: '', isCorrect: false };
                      const updatedOptions = [...(lesson.content.options || []), newOption];
                      updateLesson(moduleId, lesson.id, {
                        content: { ...lesson.content, options: updatedOptions }
                      });
                    }}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200"
                  >
                    <Plus className="h-4 w-4 mx-auto" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                <textarea
                  value={lesson.content.instructions || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, instructions: e.target.value }
                  })}
                  rows={2}
                  placeholder="Instructions for completing this exercise..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {lesson.type === 'quiz' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={lesson.content.passingScore || 80}
                    onChange={(e) => updateLesson(moduleId, lesson.id, {
                      content: { ...lesson.content, passingScore: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={lesson.content.allowRetakes || false}
                      onChange={(e) => updateLesson(moduleId, lesson.id, {
                        content: { ...lesson.content, allowRetakes: e.target.checked }
                      })}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Allow Retakes</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={lesson.content.showCorrectAnswers || false}
                      onChange={(e) => updateLesson(moduleId, lesson.id, {
                        content: { ...lesson.content, showCorrectAnswers: e.target.checked }
                      })}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Show Correct Answers</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Questions</label>
                <div className="space-y-4">
                  {(lesson.content.questions || []).map((question, qIndex) => (
                    <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-gray-900">Question {qIndex + 1}</span>
                        <button
                          onClick={() => {
                            const updatedQuestions = (lesson.content.questions || []).filter((_, i) => i !== qIndex);
                            updateLesson(moduleId, lesson.id, {
                              content: { ...lesson.content, questions: updatedQuestions }
                            });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <input
                        type="text"
                        value={question.text}
                        onChange={(e) => {
                          const updatedQuestions = [...(lesson.content.questions || [])];
                          updatedQuestions[qIndex] = { ...question, text: e.target.value };
                          updateLesson(moduleId, lesson.id, {
                            content: { ...lesson.content, questions: updatedQuestions }
                          });
                        }}
                        placeholder="Question text..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3"
                      />

                      <div className="space-y-2">
                        {(question.options || []).map((option: any, oIndex: number) => {
                          const optionId = option?.id || `${question.id}-opt-${oIndex}`;
                          const optionText = typeof option === 'string' ? option : option?.text || '';
                          const isCorrect =
                            typeof question.correctAnswerIndex === 'number'
                              ? question.correctAnswerIndex === oIndex
                              : Boolean(option?.correct || option?.isCorrect);
                          return (
                          <div key={oIndex} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={isCorrect}
                              onChange={() => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                const nextOptions = (question.options || []).map((opt: any, idx: number) => {
                                  const base =
                                    typeof opt === 'object'
                                      ? { ...opt }
                                      : { id: `${question.id}-opt-${idx}`, text: opt };
                                  return idx === oIndex
                                    ? { ...base, correct: true, isCorrect: true }
                                    : { ...base, correct: false, isCorrect: false };
                                });
                                updatedQuestions[qIndex] = {
                                  ...question,
                                  correctAnswerIndex: oIndex,
                                  options: nextOptions,
                                };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, questions: updatedQuestions }
                                });
                              }}
                              className="h-4 w-4 text-green-500 focus:ring-green-500"
                            />
                            <input
                              type="text"
                              value={optionText}
                              onChange={(e) => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                const updatedOptions = [...(question.options || [])];
                                const currentOption = updatedOptions[oIndex];
                                updatedOptions[oIndex] =
                                  typeof currentOption === 'object'
                                    ? { ...currentOption, text: e.target.value }
                                    : { id: optionId, text: e.target.value };
                                updatedQuestions[qIndex] = { ...question, options: updatedOptions };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, questions: updatedQuestions }
                                });
                              }}
                              placeholder={`Option ${oIndex + 1}...`}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                            <button
                              onClick={() => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                const updatedOptions = (question.options || []).filter((_: any, i: number) => i !== oIndex);
                                updatedQuestions[qIndex] = { 
                                  ...question, 
                                  options: updatedOptions,
                                  correctAnswerIndex: (question.correctAnswerIndex || 0) > oIndex
                                    ? (question.correctAnswerIndex || 0) - 1
                                    : (question.correctAnswerIndex || 0)
                                };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, questions: updatedQuestions }
                                });
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )})}
                        <button
                          onClick={() => {
                            const updatedQuestions = [...(lesson.content.questions || [])];
                            const updatedOptions = [
                              ...(question.options || []),
                              { id: `${question.id}-opt-${Date.now()}`, text: '', correct: false, isCorrect: false },
                            ];
                            updatedQuestions[qIndex] = { ...question, options: updatedOptions };
                            updateLesson(moduleId, lesson.id, {
                              content: { ...lesson.content, questions: updatedQuestions }
                            });
                          }}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          + Add Option
                        </button>
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
                        <textarea
                          value={question.explanation || ''}
                          onChange={(e) => {
                            const updatedQuestions = [...(lesson.content.questions || [])];
                            updatedQuestions[qIndex] = { ...question, explanation: e.target.value };
                            updateLesson(moduleId, lesson.id, {
                              content: { ...lesson.content, questions: updatedQuestions }
                            });
                          }}
                          rows={2}
                          placeholder="Explain why this is the correct answer..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => {
                      const [normalizedQuestion] = canonicalizeQuizQuestions([
                        {
                        id: generateId('question'),
                        text: '',
                        options: ['', ''],
                        correctAnswerIndex: 0,
                        explanation: ''
                        }
                      ]);
                      const updatedQuestions = [...(lesson.content.questions || []), normalizedQuestion];
                      updateLesson(moduleId, lesson.id, {
                        content: { ...lesson.content, questions: updatedQuestions }
                      });
                    }}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200"
                  >
                    <Plus className="h-4 w-4 mx-auto mb-1" />
                    <span className="text-sm">Add Question</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {lesson.type === 'document' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resource Title</label>
                <input
                  type="text"
                  value={lesson.content.title || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, title: e.target.value }
                  })}
                  placeholder="e.g., Leadership Assessment Worksheet"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={lesson.content.description || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, description: e.target.value }
                  })}
                  rows={3}
                  placeholder="Describe what this resource contains and how to use it..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">File Upload</label>
                {lesson.content.fileUrl ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-800 font-medium">
                        {lesson.content.fileName} ({lesson.content.fileSize})
                      </span>
                    </div>
                    <button
                      onClick={() => updateLesson(moduleId, lesson.id, {
                        content: {
                          ...lesson.content,
                          fileUrl: '',
                          documentUrl: '',
                          fileName: '',
                          fileSize: '',
                          documentAsset: undefined,
                          documentId: undefined,
                        }
                      })}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    {isUploading ? (
                      <div className="text-center">
                        <Loader className="h-8 w-8 text-purple-500 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {uploadStatus?.status === 'paused'
                            ? uploadStatus.message || 'Upload paused'
                            : progress === 0
                              ? 'Preparing upload...'
                              : progress < 50
                                ? 'Uploading resource...'
                                : progress < 100
                                  ? 'Finalizing upload...'
                                  : 'Upload complete!'}
                        </p>
                        {progress > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                              className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        )}
                        {progress > 0 && <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>}
                      </div>
                    ) : (
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Upload a downloadable resource</p>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(moduleId, lesson.id, file);
                            }
                          }}
                          className="hidden"
                          id={documentInputId}
                        />
                        <label
                          htmlFor={documentInputId}
                          className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors duration-200 cursor-pointer inline-flex items-center space-x-2"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Choose File</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-2">Supported: PDF, DOC, XLS, PPT (max {DOCUMENT_UPLOAD_LIMIT_LABEL}MB)</p>
                      </div>
                    )}
                    {uploadErrorMessage && (
                      <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-600 mb-2">{uploadErrorMessage}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setUploadErrors((prev) => ({ ...prev, [uploadKey]: null }));
                              if (typeof document !== 'undefined') {
                                const input = document.getElementById(documentInputId) as HTMLInputElement | null;
                                if (input) {
                                  input.value = '';
                                  input.click();
                                }
                              }
                            }}
                            className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                          >
                            Try Again
                          </button>
                          <button
                            onClick={() => setUploadErrors((prev) => ({ ...prev, [uploadKey]: null }))}
                            className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                <textarea
                  value={lesson.content.instructions || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, instructions: e.target.value }
                  })}
                  rows={2}
                  placeholder="Instructions for using this resource..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {lesson.type === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content Title</label>
                <input
                  type="text"
                  value={lesson.content.title || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, title: e.target.value }
                  })}
                  placeholder="e.g., Reflection: Leadership Journey"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content Description</label>
                <textarea
                  value={lesson.content.description || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, description: e.target.value }
                  })}
                  rows={3}
                  placeholder="Brief description of this content section..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Main Content</label>
                <textarea
                  value={lesson.content.textContent ?? lesson.content.content ?? ''}
                  onChange={(e) =>
                    updateLesson(moduleId, lesson.id, {
                      content: {
                        ...lesson.content,
                        content: e.target.value,
                        textContent: e.target.value,
                      },
                    })
                  }
                  rows={6}
                  placeholder="Enter the main content, reading material, or instructions..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This content will be displayed to learners. Modules can publish with text-only lessons as long as this section includes the learner-facing material.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reflection Prompt (Optional)</label>
                <textarea
                  value={lesson.content.reflectionPrompt || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, reflectionPrompt: e.target.value }
                  })}
                  rows={4}
                  placeholder="What questions do you want learners to reflect on? e.g., 'How will you apply these concepts in your leadership role?'"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If provided, learners will see a reflection area where they can write and save their thoughts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={lesson.content.allowReflection || false}
                      onChange={(e) => updateLesson(moduleId, lesson.id, {
                        content: { ...lesson.content, allowReflection: e.target.checked }
                      })}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Enable reflection area for learners</span>
                  </label>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={lesson.content.requireReflection || false}
                      onChange={(e) => updateLesson(moduleId, lesson.id, {
                        content: { ...lesson.content, requireReflection: e.target.checked }
                      })}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                      disabled={!lesson.content.allowReflection}
                    />
                    <span className={`text-sm ${!lesson.content.allowReflection ? 'text-gray-400' : 'text-gray-700'}`}>
                      Require reflection to complete lesson
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Additional Content Section - Available for all lesson types */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Plus className="h-5 w-5 mr-2 text-blue-500" />
              Additional Content
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Add quiz questions, additional reading, or notes to enhance any lesson type.
            </p>

            {/* Quiz Questions Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Knowledge Check Questions</label>
                <button
                  onClick={() => {
                    const [normalizedQuestion] = canonicalizeQuizQuestions([
                      {
                        id: generateId('question'),
                        text: '',
                        options: ['', ''],
                        correctAnswerIndex: 0,
                        explanation: ''
                      }
                    ]);
                    const updatedQuestions = [...(lesson.content.questions || []), normalizedQuestion];
                    updateLesson(moduleId, lesson.id, {
                      content: { ...lesson.content, questions: updatedQuestions }
                    });
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Question</span>
                </button>
              </div>

              {(lesson.content.questions || []).length > 0 && (
                <div className="space-y-4">
                  {(lesson.content.questions || []).map((question: any, qIndex: number) => (
                    <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-gray-900">Question {qIndex + 1}</span>
                        <button
                          onClick={() => {
                            const updatedQuestions = (lesson.content.questions || []).filter((_, i) => i !== qIndex);
                            updateLesson(moduleId, lesson.id, {
                              content: { ...lesson.content, questions: updatedQuestions }
                            });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <input
                        type="text"
                        value={question.text}
                        onChange={(e) => {
                          const updatedQuestions = [...(lesson.content.questions || [])];
                          updatedQuestions[qIndex] = { ...question, text: e.target.value };
                          updateLesson(moduleId, lesson.id, {
                            content: { ...lesson.content, questions: updatedQuestions }
                          });
                        }}
                        placeholder="Question text..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3"
                      />

                      <div className="space-y-2">
                        {(question.options || []).map((option: any, oIndex: number) => {
                          const optionId = option?.id || `${question.id}-opt-${oIndex}`;
                          const optionText = typeof option === 'string' ? option : option?.text || '';
                          const isCorrect =
                            typeof question.correctAnswerIndex === 'number'
                              ? question.correctAnswerIndex === oIndex
                              : Boolean(option?.correct || option?.isCorrect);
                          return (
                          <div key={oIndex} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={isCorrect}
                              onChange={() => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                const nextOptions = (question.options || []).map((opt: any, idx: number) => {
                                  const base =
                                    typeof opt === 'object'
                                      ? { ...opt }
                                      : { id: `${question.id}-opt-${idx}`, text: opt };
                                  return idx === oIndex
                                    ? { ...base, correct: true, isCorrect: true }
                                    : { ...base, correct: false, isCorrect: false };
                                });
                                updatedQuestions[qIndex] = {
                                  ...question,
                                  correctAnswerIndex: oIndex,
                                  options: nextOptions,
                                };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, questions: updatedQuestions }
                                });
                              }}
                              className="h-4 w-4 text-green-500 focus:ring-green-500"
                            />
                            <input
                              type="text"
                              value={optionText}
                              onChange={(e) => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                const updatedOptions = [...(question.options || [])];
                                const currentOption = updatedOptions[oIndex];
                                updatedOptions[oIndex] =
                                  typeof currentOption === 'object'
                                    ? { ...currentOption, text: e.target.value }
                                    : { id: optionId, text: e.target.value };
                                updatedQuestions[qIndex] = { ...question, options: updatedOptions };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, questions: updatedQuestions }
                                });
                              }}
                              placeholder={`Option ${oIndex + 1}...`}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                            <button
                              onClick={() => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                const updatedOptions = (question.options || []).filter((_: any, i: number) => i !== oIndex);
                                updatedQuestions[qIndex] = { 
                                  ...question, 
                                  options: updatedOptions,
                                  correctAnswerIndex: (question.correctAnswerIndex || 0) > oIndex ? (question.correctAnswerIndex || 0) - 1 : (question.correctAnswerIndex || 0)
                                };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, questions: updatedQuestions }
                                });
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )})}
                        <button
                          onClick={() => {
                            const updatedQuestions = [...(lesson.content.questions || [])];
                            const updatedOptions = [
                              ...(question.options || []),
                              { id: `${question.id}-opt-${Date.now()}`, text: '', correct: false, isCorrect: false },
                            ];
                            updatedQuestions[qIndex] = { ...question, options: updatedOptions };
                            updateLesson(moduleId, lesson.id, {
                              content: { ...lesson.content, questions: updatedQuestions }
                            });
                          }}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          + Add Option
                        </button>
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
                        <textarea
                          value={question.explanation || ''}
                          onChange={(e) => {
                            const updatedQuestions = [...(lesson.content.questions || [])];
                            updatedQuestions[qIndex] = { ...question, explanation: e.target.value };
                            updateLesson(moduleId, lesson.id, {
                              content: { ...lesson.content, questions: updatedQuestions }
                            });
                          }}
                          rows={2}
                          placeholder="Explain why this is the correct answer..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(lesson.content.questions || []).length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <CheckCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 text-sm mb-2">No quiz questions added</p>
                  <p className="text-gray-500 text-xs">Add quiz questions to test learner comprehension after the main content</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setEditingLesson(null)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => setEditingLesson(null)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Save Lesson
            </button>
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Settings },
    { id: 'content', name: 'Content', icon: BookOpen },
    { id: 'settings', name: 'Settings', icon: Target },
    { id: 'history', name: 'History', icon: Clock }
  ];

  if (initializing && isEditing) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center space-x-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <Loader className="h-5 w-5 animate-spin text-orange-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">Loading course builder…</p>
            <p className="text-xs text-gray-500">Fetching the latest course data.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
            <div className="order-2 xl:order-1 space-y-8">
      {/* Header */}
      <div>
        <Link 
          to="/admin/courses" 
          className="inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course Management
        </Link>
        {statusBanner && (
          <div className={`mb-4 rounded-2xl p-4 text-sm ${bannerToneClasses[statusBanner.tone].container}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <statusBanner.icon className={`h-5 w-5 mt-0.5 ${bannerToneClasses[statusBanner.tone].icon}`} />
                <div>
                  <p className="font-semibold">{statusBanner.title}</p>
              <div
                className={`mb-6 rounded-2xl border p-4 text-sm ${supabaseConnected ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    {supabaseConnected ? (
                      <ShieldCheck className="h-5 w-5 mt-0.5 text-green-600" />
                    ) : (
                      <WifiOff className="h-5 w-5 mt-0.5 text-amber-600" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {supabaseConnected ? 'Secure mode connected' : runtimeStatus.demoModeEnabled ? 'Demo mode active' : 'Supabase connection degraded'}
                      </p>
                      <p className="mt-1 leading-relaxed">
                        {supabaseConnected
                          ? 'Edits sync to Supabase immediately. Publishing, assignments, and analytics reflect your changes in real time.'
                          : runtimeStatus.demoModeEnabled
                            ? 'You are editing in demo mode. Changes stay local until Supabase is re-enabled—export drafts before sharing externally.'
                            : 'Supabase is unreachable right now. Autosave continues locally, but publish/sync calls will retry once connectivity returns.'}
                      </p>
                      {!supabaseConnected && runtimeStatus.lastError && (
                        <p className="mt-2 text-xs opacity-80">Last error: {runtimeStatus.lastError}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${supabaseConnected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      Status: {runtimeStatus.statusLabel}
                    </span>
                    <span className="text-xs opacity-80">Last health check {runtimeLastCheckedLabel}</span>
                  </div>
                </div>
              </div>
                  <p className="mt-1 leading-relaxed">{statusBanner.description}</p>
                </div>
              </div>
              {statusBanner.onAction && (
                <button
                  onClick={statusBanner.onAction}
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${bannerToneClasses[statusBanner.tone].cta}`}
                >
                  {statusBanner.actionLabel || 'Retry'}
                </button>
              )}
            </div>
          </div>
        )}
        {draftSnapshotPrompt && (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">Unsynced local draft available</p>
                <p className="mt-1 leading-relaxed">
                  We saved edits on {new Date(draftSnapshotPrompt.updatedAt).toLocaleString()} when Huddle couldn’t reach Supabase.
                  Restore them to continue where you left off or discard the local copy.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRestoreDraftSnapshot}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  Restore draft
                </button>
                <button
                  onClick={handleDiscardDraftSnapshot}
                  className="inline-flex items-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
                >
                  Discard local copy
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isEditing ? 'Edit Course' : 'Create New Course'}
            </h1>
            <p className="text-gray-600">
              {isEditing ? `Editing: ${course.title}` : 'Build a comprehensive learning experience'}
            </p>
            {isEditing && (
              <div
                className={`mt-2 px-3 py-2 rounded-lg text-sm ${
                  effectiveValidationSummary.isValid
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {effectiveValidationSummary.isValid ? (
                  <span>✅ Course is valid and ready to publish</span>
                ) : (
                  <div>
                    <span>⚠️ {blockingIssueCount} validation issue(s) detected</span>
                    <p className="mt-1 text-xs">Resolve the blockers below before publishing.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex w-full flex-col items-end gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDialog('discard')}
                disabled={!canDiscardChanges}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  canDiscardChanges
                    ? 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    : 'border-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                }`}
                title={canDiscardChanges ? 'Revert to the last saved draft' : 'No saved draft to revert to yet'}
              >
                <Undo2 className="h-4 w-4" />
                <span>Discard</span>
              </button>
              <button
                onClick={() => setConfirmDialog('reset')}
                className="flex items-center gap-2 rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50"
                title="Replace everything with the starter template"
              >
                <RefreshCcw className="h-4 w-4" />
                <span>Reset Template</span>
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors duration-200 flex items-center space-x-2 font-medium"
                title="Preview course as learner"
              >
                <Eye className="h-4 w-4" />
                <span>Live Preview</span>
              </button>
              
              <button
                onClick={handleSave}
                data-save-button
                disabled={saveStatus === 'saving'}
                className={`px-6 py-3 rounded-lg transition-all duration-200 flex items-center space-x-2 font-medium ${
                  saveStatus === 'saved' 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : saveStatus === 'error'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } ${saveStatus === 'saving' ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Saved!</span>
                  </>
                ) : saveStatus === 'error' ? (
                  <>
                    <X className="h-4 w-4" />
                    <span>Retry Save</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Draft</span>
                    <span className="hidden md:inline text-xs opacity-75">⌘S</span>
                  </>
                )}
              </button>
              {course.status === 'draft' && (
              <button
                onClick={() => setShowAssignmentModal(true)}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2"
                disabled={!course.id || (course.modules || []).length === 0}
                title={!course.id || (course.modules || []).length === 0 ? "Save course and add content before assigning" : ""}
              >
                <Users className="h-4 w-4" />
                <span>Assign to Users</span>
              </button>
            )}
            <button
              onClick={handlePublish}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
              disabled={publishDisabled}
              title={publishButtonTitle}
            >
              <CheckCircle className="h-4 w-4" />
              <span>{course.status === 'published' ? 'Update Published' : 'Publish Course'}</span>
              {publishDevHint && (
                <span className="text-xs font-semibold uppercase tracking-wide text-lime-100">
                  {publishDevHint}
                </span>
              )}
            </button>
            <button
              onClick={() => window.open(`/courses/${course.id}`, '_blank')}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => {
                try {
                  const newId = generateId('course');
                  const cloned = { ...course, id: newId, title: `${course.title} (Copy)`, createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString(), enrollments: 0, completions: 0, completionRate: 0 };
                  courseStore.saveCourse(cloned, { skipRemoteSync: true });
                  navigate(`/admin/course-builder/${newId}`);
                } catch (err) {
                  console.warn('Failed to duplicate course', err);
                }
              }}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>Duplicate</span>
            </button>
            <button
              onClick={() => {
                try {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(course, null, 2));
                  const dlAnchor = document.createElement('a');
                  dlAnchor.setAttribute('href', dataStr);
                  dlAnchor.setAttribute('download', `${course.title.replace(/\s+/g, '_').toLowerCase() || 'course'}.json`);
                  document.body.appendChild(dlAnchor);
                  dlAnchor.click();
                  dlAnchor.remove();
                } catch (err) {
                  console.warn('Export failed', err);
                }
              }}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            <button
              onClick={() => setConfirmDialog('delete')}
              className="border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
            </div>

            {/* Auto-save status indicator */}
            <div className="flex flex-col text-sm text-right">
              <span className={`flex items-center justify-end ${hasPendingChanges ? 'text-amber-600' : 'text-green-600'}`}>
                <span className={`mr-2 h-2 w-2 rounded-full ${hasPendingChanges ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                {hasPendingChanges ? 'Local changes pending sync…' : 'Draft synced to Supabase'}
              </span>
              {lastSaveTime && saveStatus === 'idle' && (
                <span className="text-gray-500 flex items-center justify-end">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                  Auto-saved at {lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Title *</label>
                  <input
                    type="text"
                    value={course.title}
                    onChange={(e) => setCourse(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Foundations of Inclusive Leadership"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
                  <select
                    value={course.difficulty}
                    onChange={(e) => setCourse(prev => ({ ...prev, difficulty: e.target.value as Course['difficulty'] }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={course.description}
                  onChange={(e) => setCourse(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="Describe what learners will gain from this course..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Learning Objectives</label>
                <div className="space-y-2">
                  {(course.learningObjectives || []).map((objective, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={objective}
                        onChange={(e) => {
                          const updated = [...(course.learningObjectives || [])];
                          updated[index] = e.target.value;
                          setCourse(prev => ({ ...prev, learningObjectives: updated }));
                        }}
                        placeholder="Learning objective..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          const updated = (course.learningObjectives || []).filter((_, i) => i !== index);
                          setCourse(prev => ({ ...prev, learningObjectives: updated }));
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setCourse(prev => ({ 
                      ...prev, 
                      learningObjectives: [...(prev.learningObjectives || []), ''] 
                    }))}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    + Add Learning Objective
            </button>
          </div>
        </div>

        <div
          ref={validationPanelRef}
          className={`mt-4 rounded-2xl border px-4 py-3 shadow-sm transition-all ${
            effectiveValidationSummary.isValid
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          } ${validationPanelPulse ? 'ring-2 ring-amber-400' : ''}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {effectiveValidationSummary.isValid ? (
                <ShieldCheck className="h-5 w-5 text-green-600" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {effectiveValidationSummary.isValid
                    ? 'All publish checks passed'
                    : `${blockingIssueCount} publish blocker(s)`}
                </p>
                <p className="text-xs opacity-80">
                  {effectiveValidationSummary.isValid
                    ? 'Learners will see the latest content as soon as you publish.'
                    : 'Resolve the issues below before publishing to learners.'}
                </p>
                {!effectiveValidationSummary.isValid && (
                  <p className="text-xs mt-1">
                    Each module needs at least one publish-ready lesson: a video with stored media metadata, a quiz with questions, or a text lesson with learner-facing content.
                  </p>
                )}
              </div>
            </div>
            {!effectiveValidationSummary.isValid && firstNavigableIssue && (
              <button
                onClick={() => focusValidationIssue(firstNavigableIssue)}
                className="inline-flex items-center rounded-lg border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-white/40"
              >
                Focus first issue
              </button>
            )}
          </div>
          {effectiveValidationSummary.issues.length > 0 ? (
            <div className="mt-3 max-h-56 overflow-y-auto pr-1">
              <ul className="space-y-2">
                {effectiveValidationSummary.issues.map((issue, index) => {
                  const canNavigate = Boolean(issue.lessonId || issue.moduleId);
                  return (
                    <li
                      key={`${issue.code}-${issue.lessonId ?? issue.moduleId ?? index}`}
                      className="flex items-start justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-sm shadow-sm ring-1 ring-black/5"
                    >
                      <div>
                        <p className="font-semibold text-amber-900">{issue.message}</p>
                        <p className="text-xs text-amber-600">
                          {issue.severity.toUpperCase()} • {issue.code}
                        </p>
                      </div>
                      {canNavigate && (
                        <button
                          onClick={() => focusValidationIssue(issue)}
                          className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
                        >
                          Jump
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-green-800">
              Publish validation is using stricter checks, and your course passes them all.
            </p>
          )}
        </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Key Takeaways</label>
                <div className="space-y-2">
                  {(course.keyTakeaways || []).map((takeaway, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={takeaway}
                        onChange={(e) => {
                          const updated = [...(course.keyTakeaways || [])];
                          updated[index] = e.target.value;
                          setCourse(prev => ({ ...prev, keyTakeaways: updated }));
                        }}
                        placeholder="Key takeaway..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          const updated = (course.keyTakeaways || []).filter((_, i) => i !== index);
                          setCourse(prev => ({ ...prev, keyTakeaways: updated }));
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setCourse(prev => ({ 
                      ...prev, 
                      keyTakeaways: [...(prev.keyTakeaways || []), ''] 
                    }))}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    + Add Key Takeaway
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(course.tags || []).map((tag, index) => (
                    <span key={index} className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm flex items-center space-x-1">
                      <span>{tag}</span>
                      <button
                        onClick={() => {
                          const updated = (course.tags || []).filter((_, i) => i !== index);
                          setCourse(prev => ({ ...prev, tags: updated }));
                        }}
                        className="text-orange-600 hover:text-orange-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add a tag..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        const tag = input.value.trim();
                        if (tag && !(course.tags || []).includes(tag)) {
                          setCourse(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
                          input.value = '';
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-500">Press Enter to add</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6 pb-20">
              {isMobile && (
                <div className="sticky top-20 z-20 bg-white pb-2">
                  <MobileModuleNavigator
                    modules={modules}
                    activeModuleId={activeMobileModuleId}
                    onSelect={handleMobileModuleSelect}
                    onAddModule={addModule}
                    focusMode={mobileFocusMode}
                    onToggleFocusMode={() => setMobileFocusMode((prev) => !prev)}
                    totalLessons={modules.reduce((count, current) => count + current.lessons.length, 0)}
                    onNext={handleNextModule}
                    onPrevious={handlePreviousModule}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Course Modules</h2>
                <button
                  onClick={addModule}
                  className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Module</span>
                </button>
              </div>

              <div className="space-y-4" {...swipeHandlers}>
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="flex-1 rounded-2xl border border-dashed border-gray-300 bg-white/80 p-4 shadow-sm">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                        <GripVertical className="h-4 w-4 text-gray-500" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-semibold text-gray-900">Drag modules or lessons to reorder</p>
                        <p className="text-xs text-gray-500">Changes save automatically after you drop them, so you can refine structure without modal dialogs.</p>
                      </div>
                    </div>
                  </div>

                  {activeUploads.length > 0 && (
                    <div className="flex-1 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 shadow-sm" role="status" aria-live="polite">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-blue-900">
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <Upload className="h-4 w-4" aria-hidden="true" />
                          Active uploads ({activeUploads.length})
                        </span>
                        <span className="text-xs text-blue-600">Keep editing—videos process in the background</span>
                      </div>
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {activeUploads.map((upload) => (
                          <div key={upload.key} className="rounded-xl bg-white/90 p-3 shadow-sm ring-1 ring-black/5">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span className="font-semibold text-gray-900" title={upload.moduleTitle}>{upload.moduleTitle}</span>
                              <span title={upload.lessonTitle}>{upload.lessonTitle}</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-gray-100" aria-label={`Upload progress ${upload.progress}%`}>
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
                                style={{ width: `${upload.progress}%` }}
                                role="progressbar"
                                aria-valuenow={upload.progress}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                            <div className="mt-1 text-right text-xs font-semibold text-blue-700">{upload.progress}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <DndContext
                  sensors={moduleSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleModuleDragEnd}
                >
                  <SortableContext
                    items={modulesToRender.map((module) => module.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {modulesToRender.map((module) => {
                      const moduleLessons = module.lessons || [];
                      const completionRate = moduleLessons.filter((lesson) => lesson.completed).length;

                      return (
                        <SortableItem key={module.id} id={module.id} className="block">
                          {({ setActivatorNodeRef, attributes, listeners }) => (
                            <div
                              id={`module-${module.id}`}
                              className={`border border-gray-200 rounded-lg bg-white transition-shadow ${
                                (isMobile && module.id === activeMobileModuleId) || module.id === highlightModuleId
                                  ? 'ring-2 ring-orange-200 shadow-lg'
                                  : ''
                              }`}
                            >
                              <div className="p-4 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center space-x-3 flex-1">
                                    <button
                                      onClick={() => toggleModuleExpansion(module.id)}
                                      className="text-gray-600 hover:text-gray-800"
                                      aria-label={expandedModules[module.id] ? 'Collapse module' : 'Expand module'}
                                    >
                                      {expandedModules[module.id] ? (
                                        <ChevronUp className="h-5 w-5" />
                                      ) : (
                                        <ChevronDown className="h-5 w-5" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      <input
                                        type="text"
                                        value={module.title}
                                        onChange={(e) => updateModule(module.id, { title: e.target.value })}
                                        placeholder="Module title..."
                                        className="font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
                                      />
                                      <input
                                        type="text"
                                        value={module.description}
                                        onChange={(e) => updateModule(module.id, { description: e.target.value })}
                                        placeholder="Module description..."
                                        className="text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full mt-1"
                                      />
                                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-3">
                                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-700">
                                          <BookOpen className="mr-1 h-3 w-3" /> {moduleLessons.length} lessons
                                        </span>
                                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-700">
                                          <Clock className="mr-1 h-3 w-3" /> {module.duration || 'Set duration'}
                                        </span>
                                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-700">
                                          <CheckCircle className="mr-1 h-3 w-3 text-green-500" /> {completionRate}/{moduleLessons.length} complete
                                        </span>
                                        <ModuleIssueBadge issueTargets={visibleIssueTargets} moduleId={module.id} />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      ref={setActivatorNodeRef}
                                      {...attributes}
                                      {...listeners}
                                      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-gray-700"
                                      aria-label={`Reorder ${module.title || 'module'}`}
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteModule(module.id)}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {expandedModules[module.id] && (
                                <div className="p-4">
                                  <DndContext
                                    sensors={lessonSensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={(event) => handleLessonDragEnd(module.id, event)}
                                  >
                                    <SortableContext
                                      items={moduleLessons.map((lesson) => lesson.id)}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      <div className="space-y-3 mb-4">
                                        {moduleLessons.map((lesson) => {
                                          const lessonContent = (
                                            <div
                                              id={`lesson-${lesson.id}`}
                                              className={
                                                highlightLessonId === lesson.id
                                                  ? 'transition-all duration-300 ring-2 ring-orange-300 bg-orange-50 rounded-md p-1'
                                                  : ''
                                              }
                                            >
                                              {renderLessonEditor(module.id, lesson)}
                                            </div>
                                          );
                                          const isEditingLesson = editingLesson?.moduleId === module.id && editingLesson.lessonId === lesson.id;

                                          return (
                                            <SortableItem key={lesson.id} id={lesson.id} disabled={isEditingLesson} className="block">
                                              {({ setActivatorNodeRef: setLessonHandleRef, attributes: lessonAttributes, listeners: lessonListeners }) => (
                                                <div className={`relative ${isEditingLesson ? '' : 'pl-10'}`}>
                                                  {!isEditingLesson && (
                                                    <button
                                                      ref={setLessonHandleRef}
                                                      {...lessonAttributes}
                                                      {...lessonListeners}
                                                      className="absolute left-0 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm"
                                                      aria-label={`Reorder ${lesson.title || 'lesson'}`}
                                                    >
                                                      <GripVertical className="h-4 w-4" />
                                                    </button>
                                                  )}
                                                  {lessonContent}
                                                </div>
                                              )}
                                            </SortableItem>
                                          );
                                        })}
                                      </div>
                                    </SortableContext>
                                  </DndContext>

                                  <button
                                    onClick={() => addLesson(module.id)}
                                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200"
                                  >
                                    <Plus className="h-5 w-5 mx-auto mb-2" />
                                    <span className="text-sm">Add Lesson</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </SortableItem>
                      );
                    })}
                  </SortableContext>
                </DndContext>

                {!hasModules && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No modules yet</h3>
                    <p className="text-gray-600 mb-4">Start building your course by adding the first module.</p>
                    <button
                      onClick={addModule}
                      className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200"
                    >
                      Add First Module
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="mt-8">
              <AIContentAssistant
                course={course}
                onApplySuggestion={handleApplySuggestion}
                onDismissSuggestion={handleDismissSuggestion}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
                  <select
                    value={course.type}
                    onChange={(e) => setCourse(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="Video">Video</option>
                    <option value="Interactive">Interactive</option>
                    <option value="Mixed">Mixed</option>
                    <option value="Workshop">Workshop</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Time</label>
                  <input
                    type="text"
                    value={course.estimatedTime}
                    onChange={(e) => setCourse(prev => ({ ...prev, estimatedTime: e.target.value }))}
                    placeholder="e.g., 45-60 minutes"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prerequisites</label>
                <div className="space-y-2">
                  {(course.prerequisites || []).map((prerequisite, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={prerequisite}
                        onChange={(e) => {
                          const updated = [...(course.prerequisites || [])];
                          updated[index] = e.target.value;
                          setCourse(prev => ({ ...prev, prerequisites: updated }));
                        }}
                        placeholder="Prerequisite..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          const updated = (course.prerequisites || []).filter((_, i) => i !== index);
                          setCourse(prev => ({ ...prev, prerequisites: updated }));
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setCourse(prev => ({ 
                      ...prev, 
                      prerequisites: [...(prev.prerequisites || []), ''] 
                    }))}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    + Add Prerequisite
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Certification Settings</label>
                <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={course.certification?.available || false}
                      onChange={(e) => setCourse(prev => ({
                        ...prev,
                        certification: {
                          // ensure a full certification object exists so types remain compatible
                          ...(prev.certification ?? { available: false, name: '', requirements: [], validFor: '1 year', renewalRequired: false }),
                          available: e.target.checked
                        }
                      }))}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Offer certification for this course</span>
                  </label>

                  {course.certification?.available && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Name</label>
                        <input
                          type="text"
                          value={course.certification.name}
                          onChange={(e) => setCourse(prev => ({
                            ...prev,
                            certification: {
                              ...prev.certification!,
                              name: e.target.value
                            }
                          }))}
                          placeholder="e.g., Inclusive Leadership Foundation Certificate"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Requirements</label>
                        <div className="space-y-2">
                          {course.certification.requirements.map((requirement, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={requirement}
                                onChange={(e) => {
                                  const updated = [...course.certification!.requirements];
                                  updated[index] = e.target.value;
                                  setCourse(prev => ({
                                    ...prev,
                                    certification: {
                                      ...prev.certification!,
                                      requirements: updated
                                    }
                                  }));
                                }}
                                placeholder="Certification requirement..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              />
                              <button
                                onClick={() => {
                                  const updated = course.certification!.requirements.filter((_, i) => i !== index);
                                  setCourse(prev => ({
                                    ...prev,
                                    certification: {
                                      ...prev.certification!,
                                      requirements: updated
                                    }
                                  }));
                                }}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setCourse(prev => ({
                              ...prev,
                              certification: {
                                ...prev.certification!,
                                requirements: [...prev.certification!.requirements, '']
                              }
                            }))}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            + Add Requirement
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <VersionControl
                course={course}
                onRestore={handleRestoreVersion}
              />
            </div>
          )}
        </div>
      </div>
            </div>
            <div className="order-1 xl:order-2 w-full">
              <CoursePreviewDock
                course={course}
                activeLessonId={editingLesson?.lessonId ?? null}
                onLaunchFullPreview={() => setShowPreview(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {isMobile && activeTab === 'content' && (
        <MobileCourseToolbar
          onAddModule={addModule}
          onPreview={() => setShowPreview(true)}
          onSave={handleSave}
          onAssign={() => setShowAssignmentModal(true)}
          onPublish={handlePublish}
          saveStatus={saveStatus}
          hasPendingChanges={hasPendingChanges}
          lastSaved={lastSaveTime}
          disabled={initializing}
        />
      )}

      {/* Course Assignment Modal */}
      <CourseAssignmentModal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        onAssignComplete={handleAssignmentComplete}
        selectedUsers={[]}
        course={{ id: course.id, title: course.title, duration: course.duration }}
      />

      {/* Live Preview Modal */}
      <LivePreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        course={course}
        currentModule={editingLesson ? course.modules?.find(m => m.id === editingLesson.moduleId) : undefined}
        currentLesson={editingLesson ? 
          course.modules?.find(m => m.id === editingLesson.moduleId)
            ?.lessons.find(l => l.id === editingLesson.lessonId) : undefined}
      />

      {confirmDialog && confirmDialogContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${confirmToneIconClasses[confirmDialogContent.tone]}`}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{confirmDialogContent.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{confirmDialogContent.description}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmToneButtonClasses[confirmDialogContent.tone]}`}
              >
                {confirmDialogContent.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {isValidationModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => setValidationModalOpen(false)}
          />
          <div className="relative z-50 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-orange-500 font-semibold">
                  {activeValidationIntent === 'publish' ? 'Publish blockers' : 'Draft validation'}
                </p>
                <h2 className="text-xl font-semibold text-gray-900 mt-1">Resolve the highlighted issues</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Review each issue and jump directly to the module or lesson that needs attention.
                </p>
              </div>
              <button
                onClick={() => setValidationModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close validation issues"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3">
              {validationIssues.map((issue, index) => (
                <div
                  key={`${issue.code}-${issue.moduleId ?? 'course'}-${issue.lessonId ?? index}`}
                  className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-red-900">{issue.message}</p>
                    {issue.path && <p className="text-xs text-red-600 mt-1">{issue.path}</p>}
                  </div>
                  <button
                    onClick={() => focusValidationIssue(issue)}
                    className="ml-4 rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-red-700"
                  >
                    Fix
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setValidationModalOpen(false)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminCourseBuilder;
