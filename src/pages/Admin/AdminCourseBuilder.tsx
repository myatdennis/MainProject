import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { courseStore, generateId, calculateCourseDuration, countTotalLessons } from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError, loadCourseFromDatabase, adminPublishCourse } from '../../dal/adminCourses';
import { computeCourseDiff } from '../../utils/courseDiff';
// import type { NormalizedCourse } from '../../utils/courseNormalization';
import { mergePersistedCourse } from '../../utils/adminCourseMerge';
import type { Course, Module, Lesson, LessonVideoAsset } from '../../types/courseTypes';
import { validateCourse, type CourseValidationIntent, type CourseValidationIssue } from '../../validation/courseValidation';
import { getUserSession } from '../../lib/secureStorage';
import { ApiError } from '../../utils/apiClient';
import { getVideoEmbedUrl } from '../../utils/videoUtils';
import { uploadLessonVideo, uploadDocumentResource } from '../../services/adminMediaUploadService';
import { signMediaAsset, shouldRefreshSignedUrl } from '../../services/mediaClient';
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
import { useToast } from '../../context/ToastContext';
import type { CourseAssignment } from '../../types/assignment';
import { getDraftSnapshot, deleteDraftSnapshot, markDraftSynced, type DraftSnapshot } from '../../services/courseDraftStorage';
import { evaluateRuntimeGate, type RuntimeGateResult, type GateMode, type RuntimeAction } from '../../utils/runtimeGating';
import { createActionIdentifiers, type IdempotentAction } from '../../utils/idempotency';

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

const canonicalizeQuizQuestions = (questions: any[] = []) =>
  questions.map((question: any) => {
    const questionId = question?.id || generateId('question');
    const rawOptions = Array.isArray(question?.options) ? question.options : [''];

    const normalizedOptions = rawOptions.map((option: any, optionIndex: number) => {
      if (typeof option === 'string') {
        return {
          id: `${questionId}-opt-${optionIndex}`,
          text: option,
          correct:
            typeof question?.correctAnswerIndex === 'number'
              ? question.correctAnswerIndex === optionIndex
              : false,
          isCorrect:
            typeof question?.correctAnswerIndex === 'number'
              ? question.correctAnswerIndex === optionIndex
              : false,
        };
      }

      if (option && typeof option === 'object') {
        const optionId = option.id || `${questionId}-opt-${optionIndex}`;
        const isCorrect =
          option.correct ??
          option.isCorrect ??
          (typeof question?.correctAnswerIndex === 'number'
            ? question.correctAnswerIndex === optionIndex
            : false);

        return {
          ...option,
          id: optionId,
          text: option.text || option.label || option.value || `Option ${optionIndex + 1}`,
          correct: Boolean(isCorrect),
          isCorrect: Boolean(isCorrect),
        };
      }

      return {
        id: `${questionId}-opt-${optionIndex}`,
        text: '',
        correct: false,
        isCorrect: false,
      };
    });

    const resolvedIndex =
      typeof question?.correctAnswerIndex === 'number'
        ? question.correctAnswerIndex
        : normalizedOptions.findIndex((option: { correct?: boolean; isCorrect?: boolean }) =>
            Boolean(option.correct || option.isCorrect)
          );

    return {
      ...question,
      id: questionId,
      text: question?.text || question?.question || '',
      options: normalizedOptions,
      correctAnswerIndex: resolvedIndex >= 0 ? resolvedIndex : 0,
    };
  });

const canonicalizeLessonContent = (content?: Lesson['content']): Lesson['content'] => {
  if (!content) return {};
  const next = { ...content };
  if (Array.isArray(next.questions)) {
    next.questions = canonicalizeQuizQuestions(next.questions);
  }
  if (next.video && typeof next.video === 'object' && next.video.url) {
    next.videoUrl = next.videoUrl || next.video.url;
    if (!next.videoProvider) {
      const allowedProviders: Array<Lesson['content']['videoProvider']> = ['youtube', 'vimeo', 'wistia', 'native'];
      const providerCandidate = next.video.provider;
      if (allowedProviders.includes(providerCandidate as Lesson['content']['videoProvider'])) {
        next.videoProvider = providerCandidate as Lesson['content']['videoProvider'];
      }
    }
  }
  return next;
};

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



type UploadStatus = 'idle' | 'uploading' | 'paused' | 'error' | 'success';

const AdminCourseBuilder = () => {
  const { courseId } = useParams();
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
            courseStore.saveCourse(merged, { skipRemoteSync: true });
            lastPersistedRef.current = merged;
            return merged;
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
          console.log('� Auto-saved course:', course.title, {
            id: course.id,
            modules: course.modules?.length || 0,
            totalLessons: updatedCourse.lessons,
            videoLessons: course.modules?.reduce((count, module) => 
              count + module.lessons.filter(lesson => 
                lesson.type === 'video' && lesson.content?.videoUrl
              ).length, 0) || 0
          });
          
          // Update local state with calculated fields
          if (course.duration !== updatedCourse.duration || course.lessons !== updatedCourse.lessons) {
            setCourse(updatedCourse);
          }
        } catch (error) {
          console.error('❌ Auto-save failed:', error);
        }
      }, 1500);

      return () => clearTimeout(timeoutId);
    }
  }, [course]);

  // Debounced remote auto-sync (single upsert). Runs only when there are real changes vs lastPersistedRef.
  useEffect(() => {
    if (!course.id || !course.title?.trim()) return;
    if (autoSaveLockRef.current) return;
    const diff = computeCourseDiff(lastPersistedRef.current, course);
    if (!diff.hasChanges) return;

    const gate = evaluateRuntimeGate('course.auto-save', runtimeStatus);
    if (gate.mode !== 'remote') {
      if (lastAutoSaveGateModeRef.current !== gate.mode) {
        showToast(
          gate.reason ?? 'Drafts are stored locally until Huddle reconnects.',
          gate.tone === 'danger' ? 'error' : 'warning',
          6000,
        );
      }
      lastAutoSaveGateModeRef.current = gate.mode;
      return;
    }

    if (lastAutoSaveGateModeRef.current !== 'remote') {
      showToast('Back online. Auto-sync resumed.', 'success', 3000);
    }
    lastAutoSaveGateModeRef.current = 'remote';

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
        console.error('❌ Remote auto-sync failed:', err);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
      } finally {
        autoSaveLockRef.current = false;
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [course, runtimeStatus, showToast]);

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
          id: generateId('module'),
          title: 'Introduction',
          description: 'Course overview and learning objectives',
          duration: '10 min',
          order: 1,
          lessons: [
            {
              id: generateId('lesson'),
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

  const persistCourse = async (
    nextCourse: Course,
    options?: PersistCourseOptions | 'draft' | 'published'
  ): Promise<PersistCourseResult> => {
    const resolvedOptions: PersistCourseOptions =
      typeof options === 'string' ? { statusOverride: options } : options ?? {};
    const { statusOverride, intentOverride, gate: gateOverride, action, skipValidation } = resolvedOptions;

    const preparedCourse: Course = {
      ...nextCourse,
      status: statusOverride ?? nextCourse.status ?? 'draft',
      duration: calculateCourseDuration(nextCourse.modules || []),
      lessons: countTotalLessons(nextCourse.modules || []),
      lastUpdated: new Date().toISOString(),
      publishedDate:
        (statusOverride ?? nextCourse.status) === 'published'
          ? nextCourse.publishedDate || new Date().toISOString()
          : nextCourse.publishedDate,
    };

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
      const validation = validateCourse(preparedCourse, {
        intent: validationIntent,
      });
      if (!validation.isValid) {
        const blockingIssues = validation.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => issue.message);
        throw new CourseValidationError('course', blockingIssues);
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

    if (allowRemoteSync) {
      const persisted = await syncCourseToDatabase(preparedCourse, { action: derivedAction });
      merged = persisted ? mergePersistedCourse(preparedCourse, persisted) : preparedCourse;
      remoteSynced = true;
    }

    courseStore.saveCourse(merged, { skipRemoteSync: true });
    setCourse(merged);
    if (remoteSynced) {
      lastPersistedRef.current = merged;
      await markDraftSynced(merged.id, merged);
    }
    return { course: merged, gate, remoteSynced };
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
      if (error instanceof CourseValidationError) {
        console.warn('⚠️ Course validation issues:', error.issues);
        showToast('Validation failed. Resolve highlighted issues before saving.', 'warning', 5000);
      } else {
        console.error('❌ Error saving course:', error);
        showToast(networkFallback('Unable to save course. Please try again.'), isOffline() ? 'warning' : 'error', 5000);
      }
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  const handlePublish = async () => {
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
        lastUpdated: new Date().toISOString()
      };

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

      const latestPersisted = lastPersistedRef.current || persistedCourse;
      const publishIdentifiers = createActionIdentifiers('course.publish', { courseId: latestPersisted.id });
      const publishVersion = typeof (latestPersisted as any)?.version === 'number'
        ? (latestPersisted as any).version
        : null;

      await adminPublishCourse(latestPersisted.id, {
        version: publishVersion,
        idempotencyKey: publishIdentifiers.idempotencyKey
      });

      try {
        const refreshed = await loadCourseFromDatabase(latestPersisted.id, { includeDrafts: true });
        if (refreshed) {
          courseStore.saveCourse(refreshed as Course, { skipRemoteSync: true });
          setCourse(refreshed as Course);
          lastPersistedRef.current = refreshed as Course;
        }
      } catch (refreshErr) {
        console.warn('Failed to reload course after publish', refreshErr);
      }

      setSaveStatus('saved');
      setLastSaveTime(new Date());
      setHasPendingChanges(false);
      showToast('Course published to learners via Huddle.', 'success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      if (error instanceof CourseValidationError) {
        console.warn('⚠️ Course validation issues:', error.issues);
        showToast('Validation failed. Please resolve issues before publishing.', 'warning', 5000);
      } else if (error instanceof ApiError) {
        console.warn('Publish request failed', error);
        const responseBody = (error.body || {}) as { error?: string; code?: string; issues?: CourseValidationIssue[]; currentVersion?: number };
        const errorCode = error.code || responseBody.code || responseBody.error;

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
          showToast('Reload the latest draft before publishing.', 'warning', 6000);
        } else if (error.status === 422 && errorCode === 'validation_failed') {
          const issues = Array.isArray(responseBody.issues) ? responseBody.issues : [];
          const firstIssue = issues[0]?.message ?? 'Resolve the highlighted publish blockers and try again.';
          setStatusBanner({
            tone: 'danger',
            title: 'Resolve publish blockers',
            description: firstIssue,
            icon: AlertTriangle
          });
          showToast('Fix the publish blockers and try again.', 'warning', 6000);
        } else if (errorCode === 'idempotency_conflict') {
          showToast('Publish request already in progress. Please wait a moment and refresh.', 'info', 4000);
        } else {
          showToast(networkFallback('Unable to publish course. Please try again.'), isOffline() ? 'warning' : 'error', 5000);
        }
      } else {
        console.error('❌ Error publishing course:', error);
        showToast(networkFallback('Unable to publish course. Please try again.'), isOffline() ? 'warning' : 'error', 5000);
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
  }, [course.id, draftSnapshotPrompt, showToast]);

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
      id: generateId('module'),
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
      id: generateId('lesson'),
      title: `Lesson ${module.lessons.length + 1}`,
      type: 'video',
      duration: '10 min',
      content: {},
      completed: false,
      order: module.lessons.length + 1
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
                <h4 
                  className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  onDoubleClick={() => setInlineEditing({ moduleId, lessonId: lesson.id })}
                  title="Double-click to edit"
                >
                  {lesson.title}
                </h4>
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
                  value={lesson.content.content || ''}
                  onChange={(e) => updateLesson(moduleId, lesson.id, {
                    content: { ...lesson.content, content: e.target.value }
                  })}
                  rows={6}
                  placeholder="Enter the main content, reading material, or instructions..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This content will be displayed to learners. You can include instructions, reading material, or reflection prompts.
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
            {isEditing && (() => {
              const validation = validateCourse(course, {
                intent: course.status === 'published' ? 'publish' : 'draft',
              });
              const blockingIssues = validation.issues.filter((issue) => issue.severity === 'error');
              return (
                <div className={`mt-2 px-3 py-2 rounded-lg text-sm ${
                  validation.isValid 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                }`}>
                  {validation.isValid ? (
                    <span>✅ Course is valid and ready to publish</span>
                  ) : (
                    <div>
                      <span>⚠️ {blockingIssues.length} validation issue(s):</span>
                      <ul className="mt-1 text-xs">
                        {blockingIssues.slice(0, 3).map((issue, index) => (
                          <li key={`${issue.code}-${index}`}>• {issue.message}</li>
                        ))}
                        {blockingIssues.length > 3 && (
                          <li>• ... and {blockingIssues.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
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
              disabled={(course.modules || []).length === 0}
              title={(course.modules || []).length === 0 ? "Add content before publishing" : ""}
            >
              <CheckCircle className="h-4 w-4" />
              <span>{course.status === 'published' ? 'Update Published' : 'Publish Course'}</span>
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
                                isMobile && module.id === activeMobileModuleId ? 'ring-2 ring-orange-200 shadow-lg' : ''
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
    </>
  );
};

export default AdminCourseBuilder;
