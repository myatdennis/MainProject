import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DndProvider } from 'react-dnd/dist/core/DndProvider';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { courseStore, generateId, calculateCourseDuration, countTotalLessons } from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError, loadCourseFromDatabase } from '../../dal/adminCourses';
import { computeCourseDiff } from '../../utils/courseDiff';
// import type { NormalizedCourse } from '../../utils/courseNormalization';
import { mergePersistedCourse } from '../../utils/adminCourseMerge';
import type { Course, Module, Lesson } from '../../types/courseTypes';
import { getSupabase } from '../../lib/supabaseClient';
import { getVideoEmbedUrl } from '../../utils/videoUtils';
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
  WifiOff
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import LivePreview from '../../components/LivePreview';
import CoursePreviewDock from '../../components/preview/CoursePreviewDock';
import AIContentAssistant from '../../components/AIContentAssistant';
import MobileCourseToolbar from '../../components/Admin/MobileCourseToolbar';
import MobileModuleNavigator from '../../components/Admin/MobileModuleNavigator';
import useIsMobile from '../../hooks/useIsMobile';
import DragDropItem from '../../components/DragDropItem';
import VersionControl from '../../components/VersionControl';
import { useToast } from '../../context/ToastContext';
import type { CourseAssignment } from '../../types/assignment';

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
  const [uploadingVideos, setUploadingVideos] = useState<{ [key: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const lastPersistedRef = useRef<Course | null>(null);
  const [initializing, setInitializing] = useState(isEditing);
  const lastLoadedCourseIdRef = useRef<string | null>(null);
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const [activeMobileModuleId, setActiveMobileModuleId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<BuilderBanner | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const requestCourseReload = useCallback(() => {
    lastLoadedCourseIdRef.current = null;
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
  const modulesToRender = isMobile && activeMobileModuleId
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

  useEffect(() => {
    if (editingLesson?.moduleId) {
      setActiveMobileModuleId(editingLesson.moduleId);
      setExpandedModules(prev => ({ ...prev, [editingLesson.moduleId!]: true }));
    }
  }, [editingLesson]);

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
    // Avoid overlapping autosaves
    if (autoSaveLockRef.current) return;
    // Check if there are changes since last persist
    const diff = computeCourseDiff(lastPersistedRef.current, course);
    if (!diff.hasChanges) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveLockRef.current = true;
      setSaveStatus((s) => (s === 'saving' ? s : 'saving'));
      try {
        const preparedCourse = {
          ...course,
          duration: calculateCourseDuration(course.modules || []),
          lessons: countTotalLessons(course.modules || []),
          lastUpdated: new Date().toISOString(),
        };
  const persisted = await syncCourseToDatabase(preparedCourse);
        const merged = persisted ? mergePersistedCourse(preparedCourse, persisted) : preparedCourse;
        courseStore.saveCourse(merged, { skipRemoteSync: true });
        setCourse(merged);
        lastPersistedRef.current = merged;
        setSaveStatus('saved');
        setLastSaveTime(new Date());
        setTimeout(() => setSaveStatus('idle'), 2000);
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
  }, [course]);

  useEffect(() => {
    const diff = computeCourseDiff(lastPersistedRef.current, course);
    setHasPendingChanges(diff.hasChanges);
  }, [course]);

  // Course validation function
  const validateCourse = (course: Course) => {
    const issues: string[] = [];
    
    // Basic course info validation
    if (!course.title?.trim()) issues.push('Course title is required');
    if (!course.description?.trim()) issues.push('Course description is required');
    if (!course.modules || course.modules.length === 0) issues.push('At least one module is required');
    
    // Module and lesson validation
    course.modules?.forEach((module, mIndex) => {
      if (!module.title?.trim()) issues.push(`Module ${mIndex + 1}: Title is required`);
      if (!module.lessons || module.lessons.length === 0) {
        issues.push(`Module ${mIndex + 1}: At least one lesson is required`);
      }
      
      module.lessons?.forEach((lesson, lIndex) => {
        if (!lesson.title?.trim()) {
          issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Title is required`);
        }
        
        // Type-specific validation
        switch (lesson.type) {
          case 'video':
            if (!lesson.content?.videoUrl?.trim()) {
              issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Video URL is required`);
            }
            break;
          case 'quiz':
            if (!lesson.content?.questions || lesson.content.questions.length === 0) {
              issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Quiz questions are required`);
            }
            break;
          case 'document':
            if (!lesson.content?.fileUrl?.trim()) {
              issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Document file is required`);
            }
            break;
          case 'text':
            if (!lesson.content?.textContent?.trim()) {
              issues.push(`Module ${mIndex + 1}, Lesson ${lIndex + 1}: Text content is required`);
            }
            break;
        }
      });
    });
    
    return { isValid: issues.length === 0, issues };
  };

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

  // Version control handler
  const handleRestoreVersion = (version: any) => {
    setCourse(version.course);
  };

  useEffect(() => {
    if (course && !lastPersistedRef.current) {
      lastPersistedRef.current = course;
    }
  }, [course]);

  const persistCourse = async (nextCourse: Course, statusOverride?: 'draft' | 'published') => {
    const preparedCourse: Course = {
      ...nextCourse,
      status: statusOverride ?? nextCourse.status ?? 'draft',
      duration: calculateCourseDuration(nextCourse.modules || []),
      lessons: countTotalLessons(nextCourse.modules || []),
      lastUpdated: new Date().toISOString(),
      publishedDate:
        statusOverride === 'published'
          ? nextCourse.publishedDate || new Date().toISOString()
          : nextCourse.publishedDate,
    };

    const diff = computeCourseDiff(lastPersistedRef.current, preparedCourse);

    const validation = validateCourse(preparedCourse);
    if (!validation.isValid) {
      throw new CourseValidationError('course', validation.issues);
    }

    if (!diff.hasChanges) {
      courseStore.saveCourse(preparedCourse, { skipRemoteSync: true });
      setCourse(preparedCourse);
      return preparedCourse;
    }

  const persisted = await syncCourseToDatabase(preparedCourse);
    const merged = persisted ? mergePersistedCourse(preparedCourse, persisted) : preparedCourse;

    courseStore.saveCourse(merged, { skipRemoteSync: true });
    setCourse(merged);
    lastPersistedRef.current = merged;
    return merged;
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    
    try {
      // Update calculated fields
      const updatedCourse = {
        ...course,
        duration: calculateCourseDuration(course.modules || []),
        lessons: countTotalLessons(course.modules || []),
        lastUpdated: new Date().toISOString()
      };
      
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate save delay
    await persistCourse(updatedCourse);

      setSaveStatus('saved');
      setLastSaveTime(new Date());
    setHasPendingChanges(false);
    showToast('Draft synced to your Huddle workspace.', 'success');
      
      // Reset to idle after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
      
      if (isNewCourseRoute) {
        navigate(`/admin/course-builder/${updatedCourse.id}`);
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

    try {
      const publishedCourse = {
        ...course,
        status: 'published' as const,
        publishedDate: new Date().toISOString(),
        duration: calculateCourseDuration(course.modules || []),
        lessons: countTotalLessons(course.modules || []),
        lastUpdated: new Date().toISOString()
      };

      await persistCourse(publishedCourse, 'published');

      setSaveStatus('saved');
      setLastSaveTime(new Date());
      showToast('Course published to learners via Huddle.', 'success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      if (error instanceof CourseValidationError) {
        console.warn('⚠️ Course validation issues:', error.issues);
        showToast('Validation failed. Please resolve issues before publishing.', 'warning', 5000);
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

    const updatedLessons = module.lessons.map(lesson =>
      lesson.id === lessonId ? { ...lesson, ...updates } : lesson
    );

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
    const maxSizeBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setUploadError(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 50MB limit. Please compress your video or use a smaller file.`);
      return;
    }

    const uploadKey = buildUploadKey(moduleId, lessonId);
    const fileSizeLabel = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const existingContent = course.modules
      ?.find((m) => m.id === moduleId)
      ?.lessons.find((l) => l.id === lessonId)?.content;

    const persistLessonVideo = (videoUrl: string) => {
      updateLesson(moduleId, lessonId, {
        content: {
          ...existingContent,
          videoUrl,
          fileName: file.name,
          fileSize: fileSizeLabel,
        },
      });
    };

    const uploadViaApi = async () => {
      const endpoint = `/api/admin/courses/${encodeURIComponent(course.id)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}/video-upload`;
      const body = new FormData();
      body.append('file', file);
      body.append('courseId', course.id);
      body.append('moduleId', moduleId);
      body.append('lessonId', lessonId);

      const response = await fetch(endpoint, {
        method: 'POST',
        body,
        credentials: 'include',
      });

      const rawPayload = await response.text();
      let payload: any = null;
      if (rawPayload) {
        try {
          payload = JSON.parse(rawPayload);
        } catch (parseError) {
          console.warn('Video upload response was not valid JSON:', parseError);
        }
      }

      if (!response.ok) {
        const message = payload?.error || `Upload failed with status ${response.status}`;
        throw new Error(message);
      }

      const videoUrl = payload?.data?.publicUrl;
      if (!videoUrl) {
        throw new Error('Upload response missing video URL');
      }

      return {
        videoUrl,
        storagePath: payload?.data?.storagePath,
      };
    };

    const uploadViaSupabaseClient = async () => {
      const supabase = await getSupabase();
      if (!supabase) {
        throw new Error('Supabase client not configured in browser');
      }

      const fileExt = file.name.includes('.') ? file.name.split('.').pop() : undefined;
      const fileName = `${course.id}/${moduleId}/${lessonId}.${fileExt || 'mp4'}`;

      const { error } = await supabase.storage
        .from('course-videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage.from('course-videos').getPublicUrl(fileName);
      if (!data?.publicUrl) {
        throw new Error('Unable to resolve Supabase public URL');
      }

      return {
        videoUrl: data.publicUrl,
        storagePath: fileName,
      };
    };

    try {
      setUploadError(null);
      setUploadingVideos((prev) => ({ ...prev, [uploadKey]: true }));
      setUploadProgress((prev) => ({ ...prev, [uploadKey]: 10 }));

      let uploadSource: 'api' | 'supabase' | 'local' = 'local';
      let videoUrl: string | null = null;
      let lastError: Error | null = null;

      try {
        const apiResult = await uploadViaApi();
        videoUrl = apiResult.videoUrl;
        uploadSource = 'api';
      } catch (apiError) {
        lastError = apiError instanceof Error ? apiError : new Error(String(apiError));
        console.warn('Video upload API failed, falling back to browser Supabase client:', lastError);
        try {
          const supabaseResult = await uploadViaSupabaseClient();
          videoUrl = supabaseResult.videoUrl;
          uploadSource = 'supabase';
        } catch (supabaseError) {
          lastError = supabaseError instanceof Error ? supabaseError : new Error(String(supabaseError));
          console.warn('Supabase client upload failed, falling back to local object URL:', lastError);
          videoUrl = URL.createObjectURL(file);
          uploadSource = 'local';
        }
      }

      if (!videoUrl) {
        throw lastError || new Error('Unknown upload failure');
      }

      persistLessonVideo(videoUrl);
      setUploadProgress((prev) => ({ ...prev, [uploadKey]: uploadSource === 'local' ? 90 : 100 }));

      if (uploadSource === 'local') {
        setUploadError('Saved to your browser only. Configure Supabase to persist this video.');
        showToast('Video stored locally. Configure Supabase and retry to persist this lesson for learners.', 'warning', 6000);
      } else {
        const description = uploadSource === 'api'
          ? 'Video stored via the admin upload API.'
          : 'Video uploaded directly with your Supabase credentials.';
        showToast(`Video uploaded successfully. ${description}`, 'success');
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setUploadError(`Upload failed: ${errorMessage}. This could be due to network issues or file format. Please check your connection and try again.`);
    } finally {
      setUploadingVideos((prev) => ({ ...prev, [uploadKey]: false }));
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, [uploadKey]: 0 }));
      }, 2000);
    }
  };

  const handleFileUpload = async (moduleId: string, lessonId: string, file: File) => {
  const uploadKey = buildUploadKey(moduleId, lessonId);
    
    try {
      setUploadingVideos(prev => ({ ...prev, [uploadKey]: true }));

      // In demo mode, use a local URL (file will be stored in browser)
      // In production, this would upload to Supabase Storage
      let fileUrl: string;

      // Try Supabase upload first
      try {
        const supabase = await getSupabase();
        if (supabase) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${course.id}/${moduleId}/${lessonId}-resource.${fileExt}`;

          const { error } = await supabase.storage
            .from('course-resources')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('course-resources')
            .getPublicUrl(fileName);
          
          fileUrl = publicUrl;
        } else {
          throw new Error('Supabase not configured');
        }
      } catch (err) {
        console.log('Supabase upload not available, using demo mode with data URL');
        
        // Fallback: Create a data URL for demo purposes
        // This keeps the file in memory/browser storage
        fileUrl = URL.createObjectURL(file);
      }

      // Update lesson content with file URL
      updateLesson(moduleId, lessonId, {
        content: {
          ...course.modules?.find(m => m.id === moduleId)?.lessons.find(l => l.id === lessonId)?.content,
          fileUrl: fileUrl,
          fileName: file.name,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        }
      });
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError('Failed to upload file. Please try again.');
      showToast('Failed to upload file. Please try again.', 'error');
    } finally {
      setUploadingVideos(prev => ({ ...prev, [uploadKey]: false }));
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
    const isUploading = uploadingVideos[uploadKey];
    const progress = uploadProgress[uploadKey];

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
                              content: { ...lesson.content, videoUrl: '', fileName: '', fileSize: '' }
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
                              {progress === 0 ? 'Preparing upload...' : 
                               progress < 50 ? 'Uploading video...' :
                               progress < 100 ? 'Processing video...' : 'Upload complete!'}
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
                            {uploadError && (
                              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                <p className="text-sm text-red-600 mb-2">{uploadError}</p>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => {
                                      setUploadError(null);
                                      const fileInput = document.createElement('input');
                                      fileInput.type = 'file';
                                      fileInput.accept = 'video/*';
                                      fileInput.onchange = (e: any) => {
                                        const file = e.target?.files?.[0];
                                        if (file) handleVideoUpload(moduleId, lesson.id, file);
                                      };
                                      fileInput.click();
                                    }}
                                    className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                                  >
                                    Try Again
                                  </button>
                                  <button
                                    onClick={() => setUploadError(null)}
                                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </div>
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
                              id={`video-upload-${lesson.id}`}
                            />
                            <label
                              htmlFor={`video-upload-${lesson.id}`}
                              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 cursor-pointer inline-flex items-center space-x-2"
                            >
                              <Upload className="h-4 w-4" />
                              <span>Choose Video File</span>
                            </label>
                            <p className="text-xs text-gray-500 mt-2">Supported formats: MP4, WebM, MOV (max 100MB)</p>
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
                              content: { ...lesson.content, videoUrl: '' }
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
                        {(question.options || []).map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={question.correctAnswerIndex === oIndex}
                              onChange={() => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                updatedQuestions[qIndex] = { ...question, correctAnswerIndex: oIndex };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, questions: updatedQuestions }
                                });
                              }}
                              className="h-4 w-4 text-green-500 focus:ring-green-500"
                            />
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                const updatedOptions = [...(question.options || [])];
                                updatedOptions[oIndex] = e.target.value;
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
                                const updatedOptions = (question.options || []).filter((_: string, i: number) => i !== oIndex);
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
                        ))}
                        <button
                          onClick={() => {
                            const updatedQuestions = [...(lesson.content.questions || [])];
                            const updatedOptions = [...(question.options || []), ''];
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
                      const newQuestion = {
                        id: generateId('question'),
                        text: '',
                        options: ['', ''],
                        correctAnswerIndex: 0,
                        explanation: ''
                      };
                      const updatedQuestions = [...(lesson.content.questions || []), newQuestion];
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
                        content: { ...lesson.content, fileUrl: '', fileName: '', fileSize: '' }
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
                        <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Uploading file...</p>
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
                          id={`file-upload-${lesson.id}`}
                        />
                        <label
                          htmlFor={`file-upload-${lesson.id}`}
                          className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors duration-200 cursor-pointer inline-flex items-center space-x-2"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Choose File</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-2">Supported: PDF, DOC, XLS, PPT (max 50MB)</p>
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
                    const newQuestion = {
                      id: generateId('question'),
                      text: '',
                      options: ['', ''],
                      correctAnswerIndex: 0,
                      explanation: ''
                    };
                    const updatedQuestions = [...(lesson.content.questions || []), newQuestion];
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
                        {(question.options || []).map((option: string, oIndex: number) => (
                          <div key={oIndex} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={question.correctAnswerIndex === oIndex}
                              onChange={() => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                updatedQuestions[qIndex] = { ...question, correctAnswerIndex: oIndex };
                                updateLesson(moduleId, lesson.id, {
                                  content: { ...lesson.content, questions: updatedQuestions }
                                });
                              }}
                              className="h-4 w-4 text-green-500 focus:ring-green-500"
                            />
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const updatedQuestions = [...(lesson.content.questions || [])];
                                const updatedOptions = [...(question.options || [])];
                                updatedOptions[oIndex] = e.target.value;
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
                                const updatedOptions = (question.options || []).filter((_: string, i: number) => i !== oIndex);
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
                        ))}
                        <button
                          onClick={() => {
                            const updatedQuestions = [...(lesson.content.questions || [])];
                            const updatedOptions = [...(question.options || []), ''];
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
    <DndProvider backend={HTML5Backend}>
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
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isEditing ? 'Edit Course' : 'Create New Course'}
            </h1>
            <p className="text-gray-600">
              {isEditing ? `Editing: ${course.title}` : 'Build a comprehensive learning experience'}
            </p>
            {isEditing && (() => {
              const validation = validateCourse(course);
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
                      <span>⚠️ {validation.issues.length} validation issue(s):</span>
                      <ul className="mt-1 text-xs">
                        {validation.issues.slice(0, 3).map((issue, index) => (
                          <li key={index}>• {issue}</li>
                        ))}
                        {validation.issues.length > 3 && (
                          <li>• ... and {validation.issues.length - 3} more</li>
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

              <div className="space-y-4">
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

                {modulesToRender.map((module) => {
                  const canonicalIndex = (course.modules || []).findIndex((m) => m.id === module.id);
                  const moduleCard = (
                    <div
                      id={`module-${module.id}`}
                      className={`border border-gray-200 rounded-lg bg-white transition-shadow ${
                        isMobile && module.id === activeMobileModuleId ? 'ring-2 ring-orange-200 shadow-lg' : ''
                      }`}
                    >
                      <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <button
                              onClick={() => toggleModuleExpansion(module.id)}
                              className="text-gray-600 hover:text-gray-800"
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
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">{module.lessons.length} lessons</span>
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
                          <div className="space-y-3 mb-4">
                            {(module.lessons || []).map((lesson, lessonIndex) => {
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

                              if (isMobile) {
                                return (
                                  <div key={lesson.id}>
                                    {lessonContent}
                                  </div>
                                );
                              }

                              return (
                                <DragDropItem
                                  key={lesson.id}
                                  id={lesson.id}
                                  index={lessonIndex}
                                  onReorder={(dragIndex, hoverIndex) => reorderLessons(module.id, dragIndex, hoverIndex)}
                                  className="block"
                                >
                                  {lessonContent}
                                </DragDropItem>
                              );
                            })}
                          </div>
                          
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
                  );

                  if (isMobile || canonicalIndex < 0) {
                    return (
                      <div key={module.id}>
                        {moduleCard}
                      </div>
                    );
                  }

                  return (
                    <DragDropItem
                      key={module.id}
                      id={module.id}
                      index={canonicalIndex}
                      onReorder={reorderModules}
                      className="block"
                    >
                      {moduleCard}
                    </DragDropItem>
                  );
                })}

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
          saveStatus={saveStatus}
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
    </DndProvider>
  );
};

export default AdminCourseBuilder;
