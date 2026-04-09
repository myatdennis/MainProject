import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Circle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  MessageCircle,
  FileText,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Download,
  Loader2,
  AlertTriangle,
  Subtitles,
} from 'lucide-react';
import { Course, Lesson, LearnerProgress, UserBookmark, UserNote, LessonVideoAsset } from '../../types/courseTypes';
import type { NormalizedCourse, NormalizedLesson } from '../../utils/courseNormalization';
import { loadCourse } from '../../dal/courseData';
import {
  loadStoredCourseProgress,
  saveStoredCourseProgress,
  syncCourseProgressWithRemote,
  buildLearnerProgressSnapshot,
  type StoredCourseProgress
} from '../../utils/courseProgress';
import cn from '../../utils/cn';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import LoadingSpinner from '../ui/LoadingSpinner';
import CourseCompletion from '../CourseCompletion';
import { useSyncService } from '../../dal/sync';
import { useToast } from '../../context/ToastContext';
import { resolveLessonVideoPlayback } from '../../utils/videoUtils';
import { getInitialLesson, getNextLesson, getPreviousLesson, isLessonIdInCourse } from '../../utils/courseNavigation';
import {
  updateAssignmentProgress,
} from '../../utils/assignmentStorage';
import { trackCourseCompletion as dalTrackCourseCompletion, trackEvent as dalTrackEvent } from '../../dal/analytics';
import { useUserProfile } from '../../hooks/useUserProfile';
import useSignedMediaUrl from '../../hooks/useSignedMediaUrl';
import { batchService } from '../../dal/batchService';
import { progressService } from '../../dal/progress';
import GuidedReflectionFlow from './GuidedReflectionFlow';
import LearnerSurveyLesson from './LearnerSurveyLesson';

const ScenarioLesson = React.lazy(() => import('./ScenarioLesson'));

const CAPTIONS_PREF_KEY = 'courseplayer:captions-enabled';
const AUTOPLAY_NEXT_PREF_KEY = 'courseplayer:autoplay-next-enabled';
const PROGRESS_SYNC_DEBOUNCE_MS = 4000;

type CaptionCue = {
  start: number;
  end: number;
  text: string;
};

const formatDurationLabel = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return '0:00';
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const remainingSeconds = clamped % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface CoursePlayerProps {
  namespace?: 'admin' | 'client' | 'lms';
}

const CoursePlayer: React.FC<CoursePlayerProps> = ({ namespace = 'admin' }) => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const syncService = useSyncService();
  const { showToast } = useToast();
  const isClientNamespace = namespace === 'client' || namespace === 'lms';
  const coursePathBase = namespace === 'client' ? '/client/courses' : '/lms/courses';
  const lessonPathSegment = namespace === 'client' ? 'lessons' : 'lesson';
  const coursesIndexPath = namespace === 'client' ? '/client/courses' : '/lms/courses';
  const eventSource = namespace === 'client' ? 'client' : namespace === 'lms' ? 'lms' : 'admin';

  const { user } = useUserProfile();
  const learnerId = useMemo(() => {
    if (user?.id) return String(user.id).toLowerCase();
    if (user?.email) return user.email.toLowerCase();
    return 'local-user';
  }, [user]);

  const [courseData, setCourseData] = useState<{ course: NormalizedCourse; lessons: NormalizedLesson[] } | null>(null);
  const [currentLesson, setCurrentLesson] = useState<NormalizedLesson | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, number>>({});
  const [lessonPositions, setLessonPositions] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [completionTimestamp, setCompletionTimestamp] = useState<number | null>(null);
  const [hasLoggedCourseCompletion, setHasLoggedCourseCompletion] = useState(false);
  const hasNavigatedToClientCompletionRef = useRef(false);
  const previousCompletionStateRef = useRef<boolean | null>(null);

  const handleRetry = () => setReloadToken((token) => token + 1);

  const storedProgressRef = useRef<StoredCourseProgress | null>(null);
  const lessonIdRef = useRef<string | undefined>(lessonId);
  const hasTrackedInitialEventRef = useRef(false);
  const lastLoggedErrorRef = useRef<string | null>(null);
  const lastAutoSavePositionRef = useRef<number>(0);

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, _setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoSessionKey, setVideoSessionKey] = useState(0);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [currentCaption, setCurrentCaption] = useState('');
  const [hasCaptionTracks, setHasCaptionTracks] = useState(false);
  const [autoplayNextLesson, setAutoplayNextLesson] = useState(false);
  const [isLessonTransitioning, setIsLessonTransitioning] = useState(false);
  const [completionFeedback, setCompletionFeedback] = useState<{ lessonTitle: string; timestamp: number } | null>(null);
  const captionsRef = useRef<CaptionCue[]>([]);
  const progressSnapshotTimerRef = useRef<number | null>(null);
  const lastSnapshotSignatureRef = useRef<string>('');
  type TestableVideoElement = HTMLVideoElement & {
    __coursePlayerHandleTimeUpdate?: () => void;
    __testDuration?: number;
    __testPosition?: number;
  };

  // UI state
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const latestProgressRef = useRef({ lessonProgressMap, completedLessons, lessonPositions });

  useEffect(() => {
    latestProgressRef.current = { lessonProgressMap, completedLessons, lessonPositions };
  }, [lessonProgressMap, completedLessons, lessonPositions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(CAPTIONS_PREF_KEY);
      if (stored === null) {
        setCaptionsEnabled(false);
      } else {
        setCaptionsEnabled(stored === 'true');
      }
    } catch {
      setCaptionsEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(AUTOPLAY_NEXT_PREF_KEY);
      setAutoplayNextLesson(stored === 'true');
    } catch {
      setAutoplayNextLesson(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(AUTOPLAY_NEXT_PREF_KEY, autoplayNextLesson ? 'true' : 'false');
    } catch {
      // no-op
    }
  }, [autoplayNextLesson]);

  // Note-taking state
  const [noteText, setNoteText] = useState('');
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [userBookmarks, setUserBookmarks] = useState<UserBookmark[]>([]);

  const deriveCourseLessons = useCallback((course: NormalizedCourse, providedLessons?: NormalizedLesson[] | null) => {
    if (Array.isArray(providedLessons) && providedLessons.length > 0) {
      return providedLessons;
    }

    const flattened = (course.modules || []).flatMap((module, moduleIndex) =>
      (module.lessons || []).map((lesson, lessonIndex) => ({
        ...(lesson as NormalizedLesson),
        moduleId: (lesson as any)?.moduleId || module.id,
        moduleTitle: (lesson as any)?.moduleTitle || module.title,
        moduleOrder:
          (lesson as any)?.moduleOrder ??
          (typeof (module as any)?.order_index === 'number' ? (module as any).order_index : module.order ?? moduleIndex),
        absoluteOrder: (lesson as any)?.absoluteOrder ?? moduleIndex * 1000 + lessonIndex + 1,
      }))
    );

    return flattened.sort((left, right) => {
      const leftOrder = typeof left.order_index === 'number' ? left.order_index : left.order ?? 0;
      const rightOrder = typeof right.order_index === 'number' ? right.order_index : right.order ?? 0;
      return leftOrder - rightOrder;
    });
  }, []);

  const progress = useMemo(() => {
    if (!courseData) return null;
    return buildLearnerProgressSnapshot(courseData.course, completedLessons, lessonProgressMap, lessonPositions);
  }, [courseData, completedLessons, lessonProgressMap, lessonPositions]);

  const courseLessons = courseData?.lessons ?? [];
  const course = courseData?.course ?? null;

  useEffect(() => {
    previousCompletionStateRef.current = null;
    hasNavigatedToClientCompletionRef.current = false;
  }, [course?.id]);

  const currentLessonPlayback = useMemo(
    () => resolveLessonVideoPlayback((currentLesson as any)?.content || {}),
    [currentLesson],
  );
  const currentLessonVideoAsset = useMemo<LessonVideoAsset | null>(() => {
    if (!currentLesson || currentLesson.type !== 'video') {
      return null;
    }
    const sourceType = String((currentLesson as any)?.content?.videoSourceType || '').toLowerCase();
    const isExternal =
      sourceType === 'external' ||
      sourceType === 'youtube' ||
      sourceType === 'vimeo' ||
      currentLessonPlayback.provider === 'youtube' ||
      currentLessonPlayback.provider === 'vimeo' ||
      currentLessonPlayback.provider === 'ted' ||
      currentLessonPlayback.provider === 'loom';
    if (isExternal) {
      return null;
    }
    const asset = (currentLesson as any)?.content?.videoAsset as LessonVideoAsset | null | undefined;
    return asset ?? null;
  }, [currentLesson, currentLessonPlayback.provider]);
  const {
    url: securedVideoUrl,
    isLoading: securingVideo,
    error: secureVideoError,
    refresh: refreshVideoSource,
    hasAsset: hasSecuredVideoAsset,
  } = useSignedMediaUrl({
    asset: currentLessonVideoAsset,
    fallbackUrl: currentLessonPlayback.src,
  });
  const previousLesson = currentLesson && course ? getPreviousLesson(currentLesson, course) : null;
  const nextLesson = currentLesson && course ? getNextLesson(currentLesson, course) : null;
  const canGoPrevious = Boolean(previousLesson);
  const canGoNext = Boolean(nextLesson);
  const isReflectionLessonLayout = currentLesson?.type === 'reflection';

  const calculateOverallPercent = useCallback(
    (progressMap: Record<string, number>, completedSet: Set<string>) => {
      if (courseLessons.length === 0) {
        return 0;
      }

      const total = courseLessons.reduce((accumulator, lesson) => {
        if (completedSet.has(lesson.id)) {
          return accumulator + 100;
        }
        const lessonProgress = Math.min(progressMap[lesson.id] ?? 0, 100);
        return accumulator + lessonProgress;
      }, 0);

      return Math.round(total / courseLessons.length);
    },
    [courseLessons]
  );

  useEffect(() => {
    if (isLoading) return;
    if (!course || courseLessons.length === 0) return;

    const allLessonsCompleted = completedLessons.size === courseLessons.length;
    const previousCompletionState = previousCompletionStateRef.current;

    if (previousCompletionState === null) {
      previousCompletionStateRef.current = allLessonsCompleted;
      // Learner reopened an already-completed course: keep them in review mode.
      return;
    }

    const hasJustCompleted = !previousCompletionState && allLessonsCompleted;
    previousCompletionStateRef.current = allLessonsCompleted;

    if (hasJustCompleted) {
      if (!hasLoggedCourseCompletion) {
        const totalTimeSeconds = Object.values(lessonPositions).reduce(
          (sum, value) => sum + Math.max(0, Math.round(value ?? 0)),
          0
        );
        const modulesCompletedCount = Array.isArray((course as any)?.modules)
          ? ((course as any).modules as Array<{ lessons?: Array<{ id: string }> }>).filter(
              (module) =>
                Array.isArray(module?.lessons) &&
                module.lessons.length > 0 &&
                module.lessons.every((moduleLesson) => completedLessons.has(moduleLesson.id))
            ).length
          : 0;

        syncService.logEvent({
          type: 'course_completed',
          courseId: course.id,
          source: eventSource,
          userId: learnerId,
          data: {
            courseId: course.id,
            completedAt: Date.now(),
            overallProgress: 1,
          },
          timestamp: Date.now(),
        });
        dalTrackCourseCompletion(learnerId, course.id, {
          totalTimeSpent: Math.max(0, Math.round(totalTimeSeconds / 60)),
          modulesCompleted: modulesCompletedCount,
          lessonsCompleted: courseLessons.length,
          quizzesPassed: 0,
          certificateGenerated: Boolean(storedProgressRef.current?.lastLessonId),
        });
        setHasLoggedCourseCompletion(true);
      }

      if (isClientNamespace && course?.slug) {
        if (!hasNavigatedToClientCompletionRef.current) {
          hasNavigatedToClientCompletionRef.current = true;
          navigate(`${coursePathBase}/${course.slug}/completion`, {
            state: { source: 'player' },
          });
        }
        return;
      }

      if (completionTimestamp === null) {
        setCompletionTimestamp(Date.now());
        setShowCompletionScreen(true);
      }
      return;
    }

    if (!allLessonsCompleted) {
      if (hasLoggedCourseCompletion) {
        setHasLoggedCourseCompletion(false);
      }
      if (completionTimestamp !== null) {
        setCompletionTimestamp(null);
      }
      if (showCompletionScreen) {
        setShowCompletionScreen(false);
      }
      if (isClientNamespace && hasNavigatedToClientCompletionRef.current) {
        hasNavigatedToClientCompletionRef.current = false;
      }
    }
  }, [
    completedLessons,
    course,
    courseLessons.length,
    eventSource,
    hasLoggedCourseCompletion,
    learnerId,
    syncService,
    completionTimestamp,
    showCompletionScreen,
    isClientNamespace,
    coursePathBase,
    navigate,
    isLoading,
  ]);

  const persistProgress = useCallback(
    (lastLesson?: string) => {
      if (!courseData) return;
      const payload: StoredCourseProgress = {
        completedLessonIds: Array.from(completedLessons),
        lessonProgress: lessonProgressMap,
        lessonPositions,
        lastLessonId: lastLesson ?? storedProgressRef.current?.lastLessonId
      };
      storedProgressRef.current = payload;
      saveStoredCourseProgress(courseData.course.slug, payload, {
        courseId: courseData.course.id,
        userId: learnerId,
        lessonIds: courseLessons.map((lesson) => lesson.id),
      });
    },
    [courseData, completedLessons, lessonProgressMap, lessonPositions, courseLessons, learnerId]
  );

  useEffect(() => {
    if (!courseData || !currentLesson) {
      return;
    }
    persistProgress(currentLesson.id);
  }, [courseData, currentLesson, persistProgress]);

  useEffect(() => {
    if (!courseData) return;
    persistProgress(currentLesson?.id);
  }, [completedLessons, lessonProgressMap, lessonPositions, courseData, currentLesson, persistProgress]);

  const scheduleProgressSnapshot = useCallback(
    (options?: { immediate?: boolean }) => {
      if (!course || !course.id || !learnerId || courseLessons.length === 0) return;
      if (!progressService.isEnabled()) return;

      const trigger = () => {
        const { lessonProgressMap: latestProgressMap, completedLessons: latestCompleted, lessonPositions: latestPositions } =
          latestProgressRef.current;

        const snapshotLessons = courseLessons.map((lesson) => {
          const progressPercent = Math.min(
            100,
            latestProgressMap[lesson.id] ?? (latestCompleted.has(lesson.id) ? 100 : 0)
          );
          return {
            lessonId: lesson.id,
            progressPercent,
            completed: latestCompleted.has(lesson.id),
            positionSeconds: Math.max(0, latestPositions[lesson.id] ?? 0),
            lastAccessedAt: new Date().toISOString(),
          };
        });

        const overallPercent = calculateOverallPercent(latestProgressMap, latestCompleted);
        const signature = JSON.stringify({
          lessons: snapshotLessons.map((lesson) => [lesson.lessonId, lesson.progressPercent, lesson.positionSeconds, lesson.completed]),
          overallPercent,
        });

        if (signature === lastSnapshotSignatureRef.current) {
          return;
        }
        lastSnapshotSignatureRef.current = signature;

        const allLessonsComplete = latestCompleted.size === courseLessons.length;
        const totalTimeSeconds = snapshotLessons.reduce((sum, lesson) => sum + lesson.positionSeconds, 0);

        void progressService
          .syncProgressSnapshot({
            userId: learnerId,
            courseId: course.id,
            lessonIds: snapshotLessons.map((lesson) => lesson.lessonId),
            lessons: snapshotLessons,
            overallPercent,
            completedAt: allLessonsComplete ? new Date().toISOString() : undefined,
            totalTimeSeconds,
            lastLessonId: currentLesson?.id ?? null,
          })
          .catch((error) => {
            console.warn('[CoursePlayer] Failed to sync progress snapshot', error);
          });
      };

      if (options?.immediate) {
        if (progressSnapshotTimerRef.current) {
          window.clearTimeout(progressSnapshotTimerRef.current);
          progressSnapshotTimerRef.current = null;
        }
        trigger();
        return;
      }

      if (progressSnapshotTimerRef.current) {
        window.clearTimeout(progressSnapshotTimerRef.current);
      }
      progressSnapshotTimerRef.current = window.setTimeout(() => {
        progressSnapshotTimerRef.current = null;
        trigger();
      }, PROGRESS_SYNC_DEBOUNCE_MS);
    },
    [course, learnerId, courseLessons, calculateOverallPercent, currentLesson?.id]
  );

  useEffect(() => {
    return () => {
      if (progressSnapshotTimerRef.current) {
        window.clearTimeout(progressSnapshotTimerRef.current);
        progressSnapshotTimerRef.current = null;
      }
      scheduleProgressSnapshot({ immediate: true });
    };
  }, [scheduleProgressSnapshot]);

  useEffect(() => {
    if (!error || !course?.id) {
      if (!error) {
        lastLoggedErrorRef.current = null;
      }
      return;
    }

    if (lastLoggedErrorRef.current === error) {
      return;
    }

    dalTrackEvent(
      'error_occurred',
      learnerId,
      {
        courseId: course.id,
        message: error,
        source: eventSource,
      },
      course.id
    );

    lastLoggedErrorRef.current = error;
  }, [error, course?.id, learnerId, eventSource]);

  useEffect(() => {
    lessonIdRef.current = lessonId;
  }, [lessonId]);

  useEffect(() => {
    if (!currentLesson || currentLesson.type !== 'video') {
      setVideoStatus('idle');
      setVideoError(null);
      return;
    }
    setVideoStatus('loading');
    setVideoError(null);
    setVideoSessionKey((prev) => prev + 1);
  }, [currentLesson?.id, currentLesson?.type]);

  useEffect(() => {
    if (!completionFeedback) return;
    const timer = window.setTimeout(() => {
      setCompletionFeedback(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [completionFeedback]);

  useEffect(() => {
    if (!currentLesson?.id) return;
    setIsLessonTransitioning(true);
    const timer = window.setTimeout(() => {
      setIsLessonTransitioning(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [currentLesson?.id]);

  useEffect(() => {
    if (!currentLesson) {
      captionsRef.current = [];
      setHasCaptionTracks(false);
      setCurrentCaption('');
      return;
    }

    const rawCaptions = (currentLesson as any)?.content?.captions;
    if (!Array.isArray(rawCaptions)) {
      captionsRef.current = [];
      setHasCaptionTracks(false);
      setCurrentCaption('');
      return;
    }

    const parsed: CaptionCue[] = rawCaptions
      .map((entry: any) => {
        const start = typeof entry?.start === 'number' ? entry.start : entry?.startTime;
        const end = typeof entry?.end === 'number' ? entry.end : entry?.endTime;
        const text = typeof entry?.text === 'string' ? entry.text : undefined;
        if (typeof start !== 'number' || typeof end !== 'number' || !text) {
          return null;
        }
        return { start: Math.max(0, start), end: Math.max(start, end), text };
      })
      .filter((cue): cue is CaptionCue => Boolean(cue));

    captionsRef.current = parsed;
    setHasCaptionTracks(parsed.length > 0);
    if (parsed.length === 0) {
      setCurrentCaption('');
    }
  }, [currentLesson]);

  useEffect(() => {
    if (!hasCaptionTracks && captionsEnabled) {
      setCaptionsEnabled(false);
      setCurrentCaption('');
      return;
    }
  }, [hasCaptionTracks, captionsEnabled]);

  const handleToggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CAPTIONS_PREF_KEY, String(next));
        } catch {
          /* ignore */
        }
      }
      if (!next) {
        setCurrentCaption('');
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!currentLesson) return;
    const savedPosition = lessonPositions[currentLesson.id] ?? 0;
    setCurrentTime(savedPosition);
  }, [currentLesson?.id]);

  useEffect(() => {
    if (!courseData) return;
    if (!lessonId) return;

    if (!isLessonIdInCourse(courseData.course, lessonId)) {
      const fallback = getInitialLesson(courseData.course, storedProgressRef.current);
      if (fallback) {
        navigate(`${coursePathBase}/${courseData.course.slug}/${lessonPathSegment}/${fallback.id}`, {
          replace: true,
        });
      }
      return;
    }

    const lesson = courseLessons.find((item) => item.id === lessonId);
    if (lesson) {
      setCurrentLesson(lesson);
    }
  }, [lessonId, courseData, courseLessons, navigate, coursePathBase, lessonPathSegment]);

  useEffect(() => {
    if (isLoading) return;
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, [isLoading, currentLesson?.id, showCompletionScreen, error]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!courseId) {
        setError('Missing course identifier');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await loadCourse(courseId, { includeDrafts: false, preferRemote: true });

        if (!isMounted) return;

        if (!result) {
          setCourseData(null);
          setCurrentLesson(null);
          setError('Course not found.');
          setIsLoading(false);
          return;
        }

        const resolvedLessons = deriveCourseLessons(result.course, result.lessons as NormalizedLesson[]);

        setCourseData({ course: result.course, lessons: resolvedLessons });

        if (learnerId) {
          await syncCourseProgressWithRemote({
            courseSlug: result.course.slug,
            courseId: result.course.id,
            userId: learnerId,
            lessonIds: resolvedLessons.map((lesson) => lesson.id),
          });
        }

        const stored = loadStoredCourseProgress(result.course.slug);
        const validLessonIds = new Set(resolvedLessons.map((lesson) => lesson.id));
        const sanitizedStored: StoredCourseProgress = {
          completedLessonIds: (stored.completedLessonIds || []).filter((lessonKey) => validLessonIds.has(lessonKey)),
          lessonProgress: Object.fromEntries(
            Object.entries(stored.lessonProgress || {}).filter(([lessonKey]) => validLessonIds.has(lessonKey))
          ),
          lessonPositions: Object.fromEntries(
            Object.entries(stored.lessonPositions || {}).filter(([lessonKey]) => validLessonIds.has(lessonKey))
          ),
          lastLessonId: validLessonIds.has(stored.lastLessonId || '') ? stored.lastLessonId : undefined,
        };
        storedProgressRef.current = sanitizedStored;

        setCompletedLessons(new Set(sanitizedStored.completedLessonIds));
        setLessonProgressMap(sanitizedStored.lessonProgress || {});
        setLessonPositions(sanitizedStored.lessonPositions || {});

        const desiredLessonId = lessonIdRef.current;
        const initialLesson = getInitialLesson(result.course, sanitizedStored);
        const startingLesson =
          (desiredLessonId && isLessonIdInCourse(result.course, desiredLessonId)
            ? resolvedLessons.find((lesson) => lesson.id === desiredLessonId)
            : null) ||
          initialLesson ||
          null;

        if (startingLesson) {
          setCurrentLesson(startingLesson as NormalizedLesson);
          if (!lessonId || lessonId !== startingLesson.id || !isLessonIdInCourse(result.course, lessonId)) {
            navigate(
              `${coursePathBase}/${result.course.slug}/${lessonPathSegment}/${startingLesson.id}`,
              { replace: true }
            );
          }
        } else {
          setCurrentLesson(null);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load course data:', err);
        setCourseData(null);
        setCurrentLesson(null);
        setError(err instanceof Error ? err.message : 'Failed to load course data');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [courseId, navigate, reloadToken, learnerId, deriveCourseLessons]);

  useEffect(() => {
    if (!courseData?.course || !learnerId || hasTrackedInitialEventRef.current) {
      return;
    }

    const stored = storedProgressRef.current;
    if (!stored) {
      return;
    }

    const hasAnyProgress =
      stored.completedLessonIds.length > 0 ||
      Object.values(stored.lessonProgress ?? {}).some((value) => (value ?? 0) > 0);

    const eventType = hasAnyProgress ? 'course_resumed' : 'course_started';
    dalTrackEvent(
      eventType,
      learnerId,
      {
        courseSlug: courseData.course.slug,
        source: eventSource,
      },
      courseData.course.id
    );

    hasTrackedInitialEventRef.current = true;
  }, [courseData, learnerId, eventSource]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const logProgress = useCallback(
    (lessonId: string, progressValue: number, position: number) => {
      syncService.logEvent({
        type: 'user_progress',
        source: eventSource,
        courseId: course?.id,
        userId: learnerId,
        data: {
          courseId: course?.id,
          lessonId,
          progress: progressValue,
          position,
        },
        timestamp: Date.now(),
      });

      if (course?.id) {
        const boundedProgress = Math.min(progressValue, 100);
        const nextProgressMap = {
          ...lessonProgressMap,
          [lessonId]: boundedProgress,
        };

        const nextCompleted = new Set(completedLessons);
        if (boundedProgress >= 100) {
          nextCompleted.add(lessonId);
        }

        // Enqueue batched progress event (lesson_progress or lesson_completed)
        try {
          batchService.enqueueProgress({
            type: boundedProgress >= 100 ? 'lesson_completed' : 'lesson_progress',
            courseId: course.id,
            lessonId,
            userId: learnerId,
            percent: boundedProgress,
            position,
          });
        } catch (e) {
          // Non-fatal; batching service will handle retries separately
          console.warn('[CoursePlayer] Failed to enqueue progress batch event', e);
        }

        const overallPercent = calculateOverallPercent(nextProgressMap, nextCompleted);
        void updateAssignmentProgress(course.id, learnerId, overallPercent);
      }
    },
    [
      course?.id,
      learnerId,
      syncService,
      eventSource,
      lessonProgressMap,
      completedLessons,
      calculateOverallPercent,
    ]
  );

  const completeLesson = useCallback(
    async (lesson: NormalizedLesson, position?: number, totalDuration?: number, silent = false) => {
      const nextCompleted = new Set(completedLessons);
      nextCompleted.add(lesson.id);

      const nextProgressMap = {
        ...lessonProgressMap,
        [lesson.id]: 100,
      };

      setCompletedLessons(nextCompleted);
      if ((lessonProgressMap[lesson.id] ?? 0) < 100) {
        setLessonProgressMap(nextProgressMap);
      }

      if (position !== undefined) {
        setLessonPositions((prev) => ({
          ...prev,
          [lesson.id]: totalDuration ? Math.min(position, totalDuration) : position,
        }));
      }

      syncService.logEvent({
        type: 'user_completed',
        source: eventSource,
        courseId: course?.id,
        userId: learnerId,
        data: {
          courseId: course?.id,
          lessonId: lesson.id,
          completedAt: Date.now(),
        },
        timestamp: Date.now(),
      });

      // Enqueue a lesson_completed batched event
      if (course?.id) {
        try {
          batchService.enqueueProgress({
            type: 'lesson_completed',
            courseId: course.id,
            lessonId: lesson.id,
            userId: learnerId,
            percent: 100,
            position,
          });
        } catch (e) {
          console.warn('[CoursePlayer] Failed to enqueue completion batch event', e);
        }
      }

      if (!silent) {
        showToast(`Marked "${lesson.title}" complete`, 'success');
        setCompletionFeedback({ lessonTitle: lesson.title, timestamp: Date.now() });
      }

      if (course?.id) {
        const overallPercent = calculateOverallPercent(nextProgressMap, nextCompleted);
        await updateAssignmentProgress(course.id, learnerId, overallPercent);
      }

      scheduleProgressSnapshot();
    },
    [
      course?.id,
      learnerId,
      showToast,
      syncService,
      eventSource,
      lessonProgressMap,
      completedLessons,
      calculateOverallPercent,
      scheduleProgressSnapshot,
    ]
  );

  // Flush any queued progress events when unmounting (best-effort)
  useEffect(() => {
    return () => {
      try {
        batchService.flushProgress();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Periodically persist/flush lesson playback position to support resumable video
  useEffect(() => {
    if (!currentLesson) return;

    let isActive = true;
    // Tick: read current player position and enqueue a lesson_progress event if position changed
    const tick = () => {
      if (!isActive) return;
      const player = videoRef.current as TestableVideoElement | null;
      if (!player) {
        return;
      }

      const rawDuration = player.duration;
      const testDuration = typeof player.__testDuration === 'number' ? player.__testDuration : null;
      const dataDuration = (() => {
        const value = player.dataset?.testDuration;
        if (typeof value !== 'string') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      })();
      const globalTestDuration = (() => {
        if (typeof window === 'undefined') return null;
        const value = (window as unknown as Record<string, unknown>).__COURSE_PLAYER_TEST_DURATION;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim().length > 0) {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })();
      const fallbackDuration =
        typeof testDuration === 'number' && testDuration > 0
          ? testDuration
          : typeof dataDuration === 'number' && dataDuration > 0
            ? dataDuration
            : typeof globalTestDuration === 'number' && globalTestDuration > 0
              ? globalTestDuration
              : null;
      const effectiveDuration =
        Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : fallbackDuration;

      if (!effectiveDuration) {
        return;
      }

      let position = player.currentTime;
      if (!Number.isFinite(position) || position <= 0) {
        const testPosition = typeof player.__testPosition === 'number' ? player.__testPosition : null;
        const dataPosition = (() => {
          const value = player.dataset?.testPosition;
          if (typeof value !== 'string') return null;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        })();
        const globalTestPosition = (() => {
          if (typeof window === 'undefined') return null;
          const value = (window as unknown as Record<string, unknown>).__COURSE_PLAYER_TEST_POSITION;
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
          }
          return null;
        })();
        const fallbackPosition =
          typeof testPosition === 'number' && testPosition >= 0
            ? testPosition
            : typeof dataPosition === 'number' && dataPosition >= 0
              ? dataPosition
              : typeof globalTestPosition === 'number' && globalTestPosition >= 0
                ? globalTestPosition
                : null;
        if (typeof fallbackPosition === 'number') {
          position = fallbackPosition;
        }
      }

      const previous = lastAutoSavePositionRef.current ?? 0;
      // avoid noisy updates for very small changes
      if (Math.abs(position - previous) < 1) {
        return;
      }
      lastAutoSavePositionRef.current = position;

      const progressPercent = Math.min(100, Math.round((position / effectiveDuration) * 100));

      if (course?.id) {
        try {
          batchService.enqueueProgress({
            type: 'lesson_progress',
            courseId: course.id,
            lessonId: currentLesson.id,
            userId: learnerId,
            percent: progressPercent,
            position,
          });
        } catch (e) {
          console.warn('[CoursePlayer] Failed to enqueue autosave progress', e);
        }
      }

      // Persist locally so reloads pick up the latest position even if batching/network fails
      try {
        persistProgress(currentLesson.id);
      } catch (e) {
        // non-fatal
      }
    };

    // Do an immediate tick and then run every 10s
    tick();
    const id = window.setInterval(tick, 10000);

    return () => {
      isActive = false;
      clearInterval(id);
    };
  }, [currentLesson?.id, course?.id, learnerId, persistProgress]);

  const handleTimeUpdate = () => {
    const videoElement = videoRef.current as TestableVideoElement | null;

    if (!videoElement || !currentLesson) {
      return;
    }

    const player = videoElement;
    const effectiveDuration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : player.__testDuration;

    if (!effectiveDuration || Number.isNaN(effectiveDuration)) {
      return;
    }

    const position = player.currentTime;
    const progressPercent = Math.min(100, Math.round((position / effectiveDuration) * 100));

  setCurrentTime(position);

    if (captionsEnabled && captionsRef.current.length > 0) {
      const cue = captionsRef.current.find((entry) => position >= entry.start && position <= entry.end);
      const nextCaption = cue?.text ?? '';
      if (nextCaption !== currentCaption) {
        setCurrentCaption(nextCaption);
      }
    } else if (!captionsEnabled && currentCaption) {
      setCurrentCaption('');
    }

    setLessonPositions((prev) => {
      const previous = prev[currentLesson.id] ?? 0;
      if (Math.abs(previous - position) < 1) return prev;
      return { ...prev, [currentLesson.id]: position };
    });

    const previousProgress = lessonProgressMap[currentLesson.id] ?? 0;
    if (progressPercent > previousProgress) {
      setLessonProgressMap((prev) => ({
        ...prev,
        [currentLesson.id]: progressPercent,
      }));

      if (progressPercent >= 90 && !completedLessons.has(currentLesson.id)) {
  void completeLesson(currentLesson, position, effectiveDuration, true);
      } else if (progressPercent - previousProgress >= 10) {
        logProgress(currentLesson.id, progressPercent, position);
      }
    }

    scheduleProgressSnapshot();
  };

  const registerVideoRef = useCallback((node: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
    if (node) {
      (node as TestableVideoElement).__coursePlayerHandleTimeUpdate = handleTimeUpdate;
    }
  }, [handleTimeUpdate]);

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      handleSeek(newTime);
    }
  };

  const resumePositionSeconds = currentLesson ? Math.max(0, lessonPositions[currentLesson.id] ?? 0) : 0;
  const canResumePlayback = resumePositionSeconds > 5;

  const handleResumePlayback = useCallback(() => {
    if (!videoRef.current || !canResumePlayback) return;
    videoRef.current.currentTime = resumePositionSeconds;
    videoRef.current.play().catch(() => undefined);
    setIsPlaying(true);
  }, [canResumePlayback, resumePositionSeconds]);

  const handleRetryVideoPlayback = useCallback(() => {
    setVideoError(null);
    setVideoStatus('loading');
    setVideoSessionKey((prev) => prev + 1);
    if (videoRef.current) {
      videoRef.current.load();
      if (canResumePlayback) {
        try {
          videoRef.current.currentTime = resumePositionSeconds;
        } catch {
          /* ignore */
        }
      }
    }
  }, [canResumePlayback, resumePositionSeconds]);

  const navigateLesson = useCallback(
    (direction: 'prev' | 'next') => {
      if (!currentLesson || !courseData?.course) return;

      const targetLesson =
        direction === 'next'
          ? getNextLesson(currentLesson, courseData.course)
          : getPreviousLesson(currentLesson, courseData.course);
      if (!targetLesson) return;

      const courseSlug = courseData?.course.slug || courseId || '';
      if (!courseSlug) return;
      navigate(`${coursePathBase}/${courseSlug}/${lessonPathSegment}/${targetLesson.id}`);
    },
    [currentLesson, navigate, courseData, courseId, coursePathBase, lessonPathSegment]
  );

  const markLessonComplete = async () => {
    if (!currentLesson) return;
    await completeLesson(currentLesson);
    navigateLesson('next');
  };

  const completeLessonAndAdvance = useCallback(
    async (lesson: NormalizedLesson) => {
      await completeLesson(lesson);
      if (nextLesson) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        navigateLesson('next');
      }
    },
    [completeLesson, navigateLesson, nextLesson],
  );

  const addBookmark = () => {
    if (!currentLesson) return;
    const timestamp = Math.floor(currentTime);
    const newBookmark: UserBookmark = {
      id: `bookmark-${Date.now()}`,
      lessonId: currentLesson.id,
      position: timestamp,
      note: 'Video bookmark',
      createdAt: new Date().toISOString()
    };
    setUserBookmarks((prev) => [newBookmark, ...prev]);
  };

  const addNote = () => {
    if (!noteText.trim() || !currentLesson) return;

    const timestamp = Math.floor(currentTime);
    const newNote: UserNote = {
      id: `note-${Date.now()}`,
      lessonId: currentLesson.id,
      position: timestamp,
      content: noteText,
      isPrivate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setUserNotes((prev) => [newNote, ...prev]);
    setNoteText('');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-softwhite py-24">
        <div className="mx-auto max-w-xl px-6">
          <Card tone="muted" padding="lg" className="text-center" role="alert" aria-live="polite">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sunrise/10 text-sunrise">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-semibold text-charcoal">Unable to load course</h2>
            <p className="mt-2 text-sm text-slate/80">{error}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={handleRetry} trailingIcon={<RefreshCw className="h-4 w-4" />}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => navigate(coursesIndexPath)}>
                Back to courses
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (showCompletionScreen && course) {
    const completionModules = (course.modules || []).map((module) => ({
      id: module.id,
      title: module.title,
      lessons: (module.lessons || []).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        completed: completedLessons.has(lesson.id),
      })),
    }));

    const totalSecondsSpent = Object.values(lessonPositions).reduce((sum, value) => {
      if (!Number.isFinite(value)) return sum;
      return sum + value;
    }, 0);

    const fallbackMinutes =
      typeof course.estimatedDuration === 'number' && course.estimatedDuration > 0
        ? course.estimatedDuration
        : 0;
    const timeSpentMinutes =
      totalSecondsSpent > 0 ? Math.round(totalSecondsSpent / 60) : fallbackMinutes;

    const completionCourse = {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      instructor: course.instructorName,
      duration: course.duration,
      modules: completionModules,
    };

    const completionData = {
      completedAt: new Date(completionTimestamp ?? Date.now()),
      timeSpent: Math.max(timeSpentMinutes, 1),
      score: undefined,
      grade: undefined,
      certificateId: undefined,
      certificateUrl: undefined,
    };

    return (
      <div className="bg-softwhite pb-16">
        <CourseCompletion
          course={completionCourse}
          completionData={completionData}
          keyTakeaways={course.keyTakeaways || []}
          nextSteps={[
            {
              title: 'Review lessons',
              description: 'Revisit course modules to reinforce the material.',
              action: () => setShowCompletionScreen(false),
            },
            {
              title: 'Back to my courses',
              description: 'Head back to your course list to pick what is next.',
              action: () => navigate(coursesIndexPath),
            },
          ]}
          recommendedCourses={[]}
          onClose={() => setShowCompletionScreen(false)}
        />
        <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-3 px-6">
          <Button variant="ghost" size="sm" onClick={() => setShowCompletionScreen(false)}>
            Review lessons
          </Button>
          <Button size="sm" onClick={() => navigate(coursesIndexPath)}>
            Back to courses
          </Button>
        </div>
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="bg-softwhite py-24">
        <div className="mx-auto max-w-xl px-6">
          <Card tone="muted" padding="lg" className="text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-skyblue/10 text-skyblue">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-semibold text-charcoal">Course not found</h2>
            <p className="mt-2 text-sm text-slate/80">Return to the catalog to choose another learning experience.</p>
            <Button className="mt-6" onClick={() => navigate(coursesIndexPath)}>
              Back to courses
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const courseProgressPercent = Math.round((progress?.overallProgress || 0) * 100);
  const lessonCountLabel = course.lessons || courseLessons.length;

  return (
    <div className="min-h-screen bg-softwhite pb-16">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(coursesIndexPath)}
          >
            Back to catalog
          </Button>
          <div className="flex items-center gap-2">
            <Badge tone="info" className="bg-skyblue/10 text-skyblue">
              {course.difficulty}
            </Badge>
            <Badge tone={courseProgressPercent >= 100 ? 'positive' : courseProgressPercent > 0 ? 'info' : 'neutral'}>
              {courseProgressPercent >= 100 ? 'Completed' : `${courseProgressPercent}% complete`}
            </Badge>
          </div>
        </div>

        <div className="mt-4">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-3xl font-bold text-charcoal outline-none md:text-4xl focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite"
          >
            {course.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate/80">{course.description}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate/70">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-card-sm">
            <Clock className="h-4 w-4" />
            {course.duration}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-card-sm">
            <BookOpen className="h-4 w-4" />
            {lessonCountLabel} lessons
          </span>
        </div>

        <div className="sticky top-0 z-30 mt-5 rounded-xl border border-mist/70 bg-white/90 px-4 py-3 shadow-card-sm backdrop-blur">
          <div className="flex items-center justify-between text-xs font-medium text-slate/70">
            <span>Course progress</span>
            <span>{courseProgressPercent}% complete</span>
          </div>
          <ProgressBar value={courseProgressPercent} className="mt-2" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px,1fr]">
          <Card tone="muted" className="h-full">
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center justify-between text-sm text-slate/80">
                  <span>Overall progress</span>
                  <span>{courseProgressPercent}%</span>
                </div>
                <ProgressBar value={courseProgressPercent} className="mt-2" />
              </div>
              <CourseOutline
                course={course}
                currentLesson={currentLesson}
                progress={progress}
                onLessonSelect={(lesson) => {
                  const slug = course.slug || courseId || '';
                  setCurrentLesson(lesson as NormalizedLesson);
                  if (!slug) return;
                  navigate(`${coursePathBase}/${slug}/${lessonPathSegment}/${lesson.id}`);
                }}
              />
            </div>
          </Card>

          <Card
            padding="none"
            className={cn(
              'overflow-hidden transition-all duration-200',
              isLessonTransitioning ? 'opacity-90' : 'opacity-100',
            )}
          >
            {currentLesson.type === 'video' && (() => {
              const playback = currentLessonPlayback;
              const videoUrl = playback.mode === 'embed' ? playback.src : securedVideoUrl || playback.src;
              const isNativeVideo = playback.mode !== 'embed';

              const resumeLabel = canResumePlayback
                ? `Resume from ${formatDurationLabel(resumePositionSeconds)}`
                : null;

              const renderIframe = (src: string, allowAttrs: string) => (
                <iframe
                  src={src}
                  className="h-full w-full max-h-[520px] bg-black"
                  style={{ aspectRatio: '16/9' }}
                  frameBorder="0"
                  scrolling="no"
                  allow={allowAttrs}
                  allowFullScreen
                  data-test="video-player"
                />
              );

              const renderVideo = () => {
                if (securingVideo && !videoUrl) {
                  return (
                    <Card tone="muted" className="h-full w-full rounded-none border-none">
                      <div className="space-y-3 p-6" aria-label="Loading lesson video">
                        <div className="h-5 w-40 animate-pulse rounded bg-cloud" />
                        <div className="h-3 w-56 animate-pulse rounded bg-cloud" />
                        <div className="h-52 w-full animate-pulse rounded-2xl bg-cloud" />
                      </div>
                    </Card>
                  );
                }

                if (!videoUrl) {
                  return (
                    <Card tone="muted" className="h-full w-full rounded-none border-none">
                      <div className="space-y-3">
                        <p className="text-sm text-slate/80">
                          {secureVideoError || 'We had trouble loading this video. Your progress is safe — try again below.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              handleRetryVideoPlayback();
                              if (hasSecuredVideoAsset) {
                                void refreshVideoSource(true);
                              }
                            }}
                          >
                            Retry video
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleRetry}>
                            Reload lesson
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                }

                if (playback.mode === 'embed') {
                  return renderIframe(
                    playback.embedUrl || videoUrl,
                    playback.provider === 'youtube'
                      ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                      : playback.provider === 'vimeo'
                      ? 'autoplay; fullscreen; picture-in-picture'
                      : 'fullscreen'
                  );
                }

                return (
                  <video
                    key={`${currentLesson.id}-${videoSessionKey}`}
                    ref={registerVideoRef}
                    src={videoUrl}
                    className="h-full w-full max-h-[520px] bg-black object-cover"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={() => {
                      if (!videoRef.current) return;
                      const metaDuration = videoRef.current.duration || 0;
                      setDuration(metaDuration);
                      const storedPosition = lessonPositions[currentLesson.id] ?? 0;
                      if (storedPosition > 0 && storedPosition < metaDuration) {
                        videoRef.current.currentTime = storedPosition;
                        setCurrentTime(storedPosition);
                      }
                    }}
                    onPlay={() => {
                      setIsPlaying(true);
                      setVideoStatus('ready');
                      setVideoError(null);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onWaiting={() => setVideoStatus('loading')}
                    onCanPlay={() => setVideoStatus('ready')}
                    onPlaying={() => {
                      setVideoStatus('ready');
                      setVideoError(null);
                    }}
                    onStalled={() => setVideoStatus('loading')}
                    onEnded={() => {
                      setIsPlaying(false);
                      scheduleProgressSnapshot({ immediate: true });
                      if (autoplayNextLesson && canGoNext) {
                        window.setTimeout(() => {
                          navigateLesson('next');
                        }, 900);
                      }
                    }}
                    onError={() => {
                      const message = 'We had trouble loading this video. Please try again.';
                      setVideoStatus('error');
                      setVideoError(message);
                      if (hasSecuredVideoAsset) {
                        void refreshVideoSource(true);
                      }
                      showToast(message, 'error', 5000);
                    }}
                    playsInline
                    preload="metadata"
                    data-test="video-player"
                  />
                );
              };

              return (
                <div className="relative bg-ink">
                  {secureVideoError && hasSecuredVideoAsset && (
                    <div className="absolute left-4 top-4 z-20 rounded-md bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-800 shadow">
                      Secure stream refresh failed. Retrying playback…
                    </div>
                  )}
                  {renderVideo()}

                  {isNativeVideo && captionsEnabled && currentCaption && (
                    <div className="pointer-events-none absolute bottom-24 left-1/2 w-[90%] max-w-3xl -translate-x-1/2 rounded-md bg-black/70 px-4 py-2 text-center text-sm text-white shadow-lg">
                      {currentCaption}
                    </div>
                  )}

                  {isNativeVideo && !isPlaying && videoStatus === 'ready' && canResumePlayback && resumeLabel && (
                    <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                      <button
                        onClick={handleResumePlayback}
                        className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-charcoal shadow-lg transition hover:bg-white"
                      >
                        {resumeLabel}
                      </button>
                      <button
                        onClick={() => skipTime(15)}
                        className="rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white transition hover:bg-black/70"
                      >
                        Skip intro 15s
                      </button>
                    </div>
                  )}

                  {isNativeVideo && videoStatus === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
                      <Loader2 className="h-10 w-10 animate-spin" />
                      <p className="text-sm font-medium">Preparing your lesson video…</p>
                    </div>
                  )}

                  {isNativeVideo && videoStatus === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center text-white">
                      <AlertTriangle className="h-12 w-12 text-sunrise" />
                      <div>
                        <p className="text-base font-semibold">We had trouble loading this video</p>
                        <p className="mt-1 text-sm text-white/80">{videoError ?? 'Please check your connection and retry when you’re ready.'}</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        <Button size="sm" onClick={handleRetryVideoPlayback}>
                          Try again
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleRetry}>
                          Reload lesson
                        </Button>
                        {currentLesson.content?.transcript && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowTranscript(true)}
                          >
                            Open transcript
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {isNativeVideo && (
                    <VideoControls
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      duration={duration}
                      volume={volume}
                      isMuted={isMuted}
                      playbackSpeed={playbackSpeed}
                      showControls={showControls}
                      onPlayPause={handlePlayPause}
                      onSeek={handleSeek}
                      onVolumeChange={handleVolumeChange}
                      onToggleMute={toggleMute}
                      onSpeedChange={changePlaybackSpeed}
                      onSkip={skipTime}
                      onFullscreen={() => setIsFullscreen(!isFullscreen)}
                      onSettings={() => setShowSettings(!showSettings)}
                      captionsEnabled={captionsEnabled}
                      canToggleCaptions={hasCaptionTracks}
                      onToggleCaptions={handleToggleCaptions}
                      onToggleTranscript={() => setShowTranscript((prev) => !prev)}
                      isTranscriptOpen={showTranscript}
                    />
                  )}
                </div>
              );
            })()}

            {isReflectionLessonLayout ? (
              <div className="p-6">
                <div className="mx-auto w-full max-w-[900px] space-y-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-heading text-3xl font-bold leading-tight text-charcoal sm:text-4xl">
                        {currentLesson.title}
                      </h2>
                      {currentLesson.description && (
                        <p className="mt-2 text-[15px] leading-7 text-slate/75 sm:text-base">
                          {currentLesson.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <IconToggle onClick={addBookmark} icon={<Bookmark className="h-4 w-4" />} label="Bookmark lesson" />
                      <IconToggle onClick={() => setShowNotes(!showNotes)} icon={<MessageCircle className="h-4 w-4" />} label="Toggle notes" active={showNotes} />
                      <IconToggle onClick={() => setShowTranscript(!showTranscript)} icon={<FileText className="h-4 w-4" />} label="Toggle transcript" active={showTranscript} />
                    </div>
                  </div>

                  <LessonContent
                    lesson={currentLesson}
                    courseId={course.id}
                    learnerId={learnerId}
                    onComplete={() => void markLessonComplete()}
                    onSubmitAndAdvance={
                      currentLesson ? () => completeLessonAndAdvance(currentLesson) : undefined
                    }
                    onShowQuizModal={setShowQuizModal}
                  />

                  {showTranscript && currentLesson.content.transcript && (
                    <TranscriptPanel transcript={currentLesson.content.transcript} currentTime={currentTime} onSeek={handleSeek} />
                  )}

                  {showNotes && (
                    <NotesPanel
                      notes={userNotes.filter((note) => note.lessonId === currentLesson.id)}
                      bookmarks={userBookmarks.filter((bookmark) => bookmark.lessonId === currentLesson.id)}
                      noteText={noteText}
                      onNoteTextChange={setNoteText}
                      onAddNote={addNote}
                    />
                  )}

                  <div className="flex flex-col gap-4 border-t border-mist/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-mist bg-white px-3 py-2 text-xs text-slate/80 sm:text-sm">
                      <span>Autoplay next lesson</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-mist text-skyblue focus:ring-skyblue"
                        checked={autoplayNextLesson}
                        onChange={(event) => setAutoplayNextLesson(event.target.checked)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => navigateLesson('prev')}
                        disabled={!canGoPrevious}
                        leadingIcon={<ArrowLeft className="h-4 w-4" />}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => navigateLesson('next')}
                        disabled={!canGoNext}
                        trailingIcon={<ArrowRight className="h-4 w-4" />}
                      >
                        Next
                      </Button>
                      <Button
                        variant="success"
                        onClick={() => void markLessonComplete()}
                        leadingIcon={<CheckCircle className="h-4 w-4" />}
                      >
                        Mark complete
                      </Button>
                    </div>
                  </div>

                  {nextLesson && (
                    <Card tone="muted" className="border border-skyblue/20 bg-skyblue/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-skyblue">Up next</p>
                      <p className="mt-2 text-sm font-semibold text-charcoal">{nextLesson.title}</p>
                      <p className="mt-1 text-xs text-slate/70">
                        {autoplayNextLesson ? 'Autoplay is on — we’ll move you forward automatically when this lesson ends.' : 'Use “Next” anytime to keep momentum.'}
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-2xl font-semibold text-charcoal">{currentLesson.title}</h2>
                      {currentLesson.description && (
                        <p className="mt-1 text-sm text-slate/80">{currentLesson.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <IconToggle onClick={addBookmark} icon={<Bookmark className="h-4 w-4" />} label="Bookmark lesson" />
                      <IconToggle onClick={() => setShowNotes(!showNotes)} icon={<MessageCircle className="h-4 w-4" />} label="Toggle notes" active={showNotes} />
                      <IconToggle onClick={() => setShowTranscript(!showTranscript)} icon={<FileText className="h-4 w-4" />} label="Toggle transcript" active={showTranscript} />
                    </div>
                  </div>

                  <LessonContent
                    lesson={currentLesson}
                    courseId={course.id}
                    learnerId={learnerId}
                    onComplete={() => void markLessonComplete()}
                    onSubmitAndAdvance={
                      currentLesson ? () => completeLessonAndAdvance(currentLesson) : undefined
                    }
                    onShowQuizModal={setShowQuizModal}
                  />

                  {showTranscript && currentLesson.content.transcript && (
                    <TranscriptPanel transcript={currentLesson.content.transcript} currentTime={currentTime} onSeek={handleSeek} />
                  )}
                </div>

                <div className="space-y-6">
                  {nextLesson && (
                    <Card tone="muted" className="border border-skyblue/20 bg-skyblue/5">
                      <p className="text-xs uppercase tracking-[0.2em] text-skyblue font-semibold">Next step</p>
                      <p className="mt-2 text-sm font-semibold text-charcoal">Up next: {nextLesson.title}</p>
                      <p className="mt-1 text-xs text-slate/70">
                        {autoplayNextLesson ? 'Autoplay is on — we’ll move you forward automatically when this lesson ends.' : 'Use “Next lesson” anytime to keep momentum.'}
                      </p>
                      <Button size="sm" className="mt-3" onClick={() => navigateLesson('next')}>
                        Start next lesson
                      </Button>
                    </Card>
                  )}

                  {showNotes && (
                    <NotesPanel
                      notes={userNotes.filter((note) => note.lessonId === currentLesson.id)}
                      bookmarks={userBookmarks.filter((bookmark) => bookmark.lessonId === currentLesson.id)}
                      noteText={noteText}
                      onNoteTextChange={setNoteText}
                      onAddNote={addNote}
                    />
                  )}

                  <NavigationPanel
                    onPrevious={() => navigateLesson('prev')}
                    onNext={() => navigateLesson('next')}
                    canGoPrevious={canGoPrevious}
                    canGoNext={canGoNext}
                    onMarkComplete={() => void markLessonComplete()}
                    autoplayNextLesson={autoplayNextLesson}
                    onAutoplayNextLessonChange={setAutoplayNextLesson}
                  />
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
      
      {/* Quiz Modal */}
      {showQuizModal && currentLesson?.type === 'quiz' && (
        <QuizModal
          lesson={currentLesson}
          answers={quizAnswers}
          submitted={quizSubmitted}
          score={quizScore}
          onAnswerChange={(questionId, answer) => {
            setQuizAnswers(prev => ({ ...prev, [questionId]: answer }));
          }}
          onSubmit={() => {
            // Calculate score
            const quizData = currentLesson.content as any;
            const questions = quizData.questions || [];
            let correct = 0;
            questions.forEach((q: any) => {
              const selectedAnswer = quizAnswers[q.id];
              const correctOption = q.options?.find((opt: any) => opt.correct);
              if (selectedAnswer === correctOption?.id) {
                correct++;
              }
            });
            const scorePercent = questions.length > 0 ? (correct / questions.length) * 100 : 0;
            setQuizScore(scorePercent);
            setQuizSubmitted(true);
            
            // Check if passed
            const passingScore = quizData.passingScore || 70;
            if (scorePercent >= passingScore) {
              // Mark lesson as complete
              void markLessonComplete();
            }
          }}
          onRetry={() => {
            setQuizAnswers({});
            setQuizSubmitted(false);
            setQuizScore(null);
          }}
          onClose={() => {
            setShowQuizModal(false);
            setQuizAnswers({});
            setQuizSubmitted(false);
            setQuizScore(null);
          }}
        />
      )}

      {completionFeedback && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 animate-pulse rounded-xl border border-emerald-200 bg-white/95 px-4 py-3 shadow-card">
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Nice work — “{completionFeedback.lessonTitle}” completed.</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Quiz Modal Component
const QuizModal: React.FC<{
  lesson: NormalizedLesson;
  answers: Record<string, string>;
  submitted: boolean;
  score: number | null;
  onAnswerChange: (questionId: string, answer: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onClose: () => void;
}> = ({ lesson, answers, submitted, score, onAnswerChange, onSubmit, onRetry, onClose }) => {
  const quizData = lesson.content as any;
  const questions = (quizData.questions || []).map((question: any, questionIndex: number) => {
    const questionId = question?.id || `q_${questionIndex}`;
    if (!Array.isArray(question?.options)) {
      return { ...question, id: questionId };
    }

    const normalizedOptions = question.options.map((option: any, optionIndex: number) => {
      if (typeof option === 'string') {
        const id = `${questionId}-opt-${optionIndex}`;
        return {
          id,
          text: option,
          correct: typeof question.correctAnswerIndex === 'number'
            ? question.correctAnswerIndex === optionIndex
            : false,
        };
      }

      if (option && typeof option === 'object') {
        return {
          ...option,
          id: option.id || `${questionId}-opt-${optionIndex}`,
          text: option.text || option.label || option.value || `Option ${optionIndex + 1}`,
          correct: option.correct ?? option.isCorrect ?? false,
          isCorrect: option.correct ?? option.isCorrect ?? false,
        };
      }

      return option;
    });

    return {
      ...question,
      id: questionId,
      text: question.text || question.question || question.prompt || '',
      options: normalizedOptions,
    };
  });
  const passingScore = quizData.passingScore || 70;
  const passed = score !== null && score >= passingScore;
  
  // Check if all questions are answered
  const allAnswered = questions.length > 0 && questions.every((q: any) => answers[q.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-mist px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-semibold text-charcoal">{lesson.title}</h2>
              {lesson.description && (
                <p className="mt-1 text-sm text-slate/80">{lesson.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate/70 hover:text-charcoal transition-colors"
              aria-label="Close quiz"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!submitted ? (
            <>
              {/* Questions */}
              {questions.map((question: any, index: number) => (
                <Card key={question.id} tone="muted" className="p-4">
                  <h3 className="font-heading text-lg font-semibold text-charcoal mb-4">
                    {index + 1}. {question.text}
                  </h3>
                  <div className="space-y-2">
                    {(question.options || []).map((option: any) => (
                      <label
                        key={option.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition",
                          answers[question.id] === option.id
                            ? "border-skyblue bg-skyblue/10"
                            : "border-mist bg-white hover:border-skyblue/50"
                        )}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.id}
                          checked={answers[question.id] === option.id}
                          onChange={() => onAnswerChange(question.id, option.id)}
                          className="text-skyblue focus:ring-skyblue"
                        />
                        <span className="text-sm text-charcoal">{option.text}</span>
                      </label>
                    ))}
                  </div>
                </Card>
              ))}

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={onSubmit} 
                  disabled={!allAnswered}
                  className={!allAnswered ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  Submit Quiz
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Results */}
              <Card tone="muted" className="p-6 text-center">
                <div className={cn(
                  "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4",
                  passed ? "bg-green-100" : "bg-yellow-100"
                )}>
                  {passed ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-yellow-600" />
                  )}
                </div>
                <h3 className="font-heading text-2xl font-semibold text-charcoal mb-2">
                  {passed ? "Great job!" : "Keep trying!"}
                </h3>
                <p className="text-lg text-charcoal mb-2">
                  Your score: <span className="font-bold">{score?.toFixed(0)}%</span>
                </p>
                <p className="text-sm text-slate/80">
                  {passed 
                    ? `You've passed! The passing score is ${passingScore}%.`
                    : `You need ${passingScore}% to pass. Review the material and try again.`
                  }
                </p>
              </Card>

              {/* Answer Review */}
              <div className="space-y-4">
                <h3 className="font-heading text-lg font-semibold text-charcoal">Answer Review</h3>
                {questions.map((question: any, index: number) => {
                  const selectedAnswer = answers[question.id];
                  const correctOption = question.options?.find((opt: any) => opt.correct);
                  const selectedOption = question.options?.find((opt: any) => opt.id === selectedAnswer);
                  const isCorrect = selectedAnswer === correctOption?.id;

                  return (
                    <Card key={question.id} tone="muted" className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        {isCorrect ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <h4 className="font-heading text-base font-semibold text-charcoal">
                            {index + 1}. {question.text}
                          </h4>
                        </div>
                      </div>
                      <div className="ml-8 space-y-2 text-sm">
                        <p>
                          <span className="font-medium">Your answer:</span>{' '}
                          <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                            {selectedOption?.text || 'No answer'}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p>
                            <span className="font-medium">Correct answer:</span>{' '}
                            <span className="text-green-600">{correctOption?.text}</span>
                          </p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                {!passed && (
                  <Button variant="outline" onClick={onRetry} leadingIcon={<RefreshCw className="h-4 w-4" />}>
                    Try Again
                  </Button>
                )}
                <Button onClick={onClose}>
                  {passed ? 'Continue' : 'Close'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Course Outline Component
const CourseOutline: React.FC<{
  course: Course;
  currentLesson: Lesson;
   progress: LearnerProgress | null;
  onLessonSelect: (lesson: Lesson) => void;
}> = ({ course, currentLesson, progress, onLessonSelect }) => {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    const firstChapterId = course.chapters?.[0]?.id;
    return firstChapterId ? new Set([firstChapterId]) : new Set();
  });

  const toggleChapter = (chapterId: string) => {
    const next = new Set(expandedChapters);
    if (next.has(chapterId)) {
      next.delete(chapterId);
    } else {
      next.add(chapterId);
    }
    setExpandedChapters(next);
  };

  const getLessonProgress = (lessonId: string) =>
    progress?.lessonProgress.find((lp) => lp.lessonId === lessonId);

  return (
    <div className="space-y-4">
      {(course.chapters || []).map((chapter, index) => {
        const expanded = expandedChapters.has(chapter.id);
        return (
          <div key={chapter.id} className="rounded-2xl bg-white shadow-card-sm">
            <button
              type="button"
              onClick={() => toggleChapter(chapter.id)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
              aria-expanded={expanded}
              aria-controls={`${chapter.id}-lessons`}
            >
              <div>
                <p className="font-heading text-sm font-semibold text-charcoal">
                  {index + 1}. {chapter.title}
                </p>
                {chapter.description && (
                  <p className="text-xs text-slate/70">{chapter.description}</p>
                )}
              </div>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-slate/70" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate/70" />
              )}
            </button>
            {expanded && (
              <div
                className="border-t border-mist/60 px-2 py-3"
                id={`${chapter.id}-lessons`}
                role="region"
                aria-label={`${chapter.title} lessons`}
              >
                <div className="space-y-2">
                  {(chapter.lessons || []).map((lesson, lessonIndex) => {
                    const lessonProgress = getLessonProgress(lesson.id);
                    const isComplete = lessonProgress?.isCompleted || false;
                    const isCurrent = lesson.id === currentLesson.id;

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => onLessonSelect(lesson)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                          isCurrent
                            ? 'bg-skyblue/10 text-skyblue'
                            : 'text-slate/80 hover:bg-cloud hover:text-charcoal'
                        }`}
                        aria-current={isCurrent ? 'page' : undefined}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-mist text-xs font-semibold">
                          {lessonIndex + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-heading text-sm font-semibold">{lesson.title}</p>
                          <p className="text-xs text-slate/70">
                            {lesson.estimatedDuration || lesson.duration || '5 min'}
                          </p>
                        </div>
                        {isComplete ? (
                          <CheckCircle className="h-4 w-4 text-forest" />
                        ) : (
                          <Circle className="h-4 w-4 text-mist" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Video Controls Component
const VideoControls: React.FC<{
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  showControls: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onSpeedChange: (speed: number) => void;
  onSkip: (seconds: number) => void;
  onFullscreen: () => void;
  onSettings: () => void;
  captionsEnabled: boolean;
  canToggleCaptions: boolean;
  onToggleCaptions: () => void;
  onToggleTranscript: () => void;
  isTranscriptOpen: boolean;
}> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackSpeed,
  showControls,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onSpeedChange,
  onSkip,
  onFullscreen,
  onSettings,
  captionsEnabled,
  canToggleCaptions,
  onToggleCaptions,
  onToggleTranscript,
  isTranscriptOpen,
}) => {
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!showControls) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
      {/* Progress Bar */}
      <div className="mb-4">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={() => onSkip(-10)} className="text-white hover:text-orange-400">
            <SkipBack className="w-5 h-5" />
          </button>
          <button onClick={onPlayPause} className="text-white hover:text-orange-400">
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>
          <button onClick={() => onSkip(10)} className="text-white hover:text-orange-400">
            <SkipForward className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <button onClick={onToggleMute} className="text-white hover:text-orange-400">
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="text-white text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {canToggleCaptions && (
            <button
              onClick={onToggleCaptions}
              aria-pressed={captionsEnabled}
              className={`text-white transition-colors ${captionsEnabled ? 'text-orange-400' : 'hover:text-orange-400'}`}
              title={captionsEnabled ? 'Disable captions' : 'Enable captions'}
            >
              <Subtitles className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onToggleTranscript}
            aria-pressed={isTranscriptOpen}
            className={`text-white transition-colors ${isTranscriptOpen ? 'text-orange-400' : 'hover:text-orange-400'}`}
            title={isTranscriptOpen ? 'Hide transcript' : 'Show transcript'}
          >
            <FileText className="w-5 h-5" />
          </button>

          <select
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="bg-transparent text-white text-sm"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
          
          <button onClick={onSettings} className="text-white hover:text-orange-400">
            <Settings className="w-5 h-5" />
          </button>
          <button onClick={onFullscreen} className="text-white hover:text-orange-400">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Lesson Content Component
const LessonContent: React.FC<{
  lesson: Lesson;
  courseId: string;
  learnerId: string;
  onComplete: () => void;
  onSubmitAndAdvance?: () => Promise<void>;
  onShowQuizModal: (show: boolean) => void;
}> = ({ lesson, courseId, learnerId, onComplete, onSubmitAndAdvance, onShowQuizModal }) => {
  const lessonType = lesson.type;
  const isReflectionLesson = lessonType === 'reflection';
  const isTextLesson = lessonType === 'text';
  const reflectionPrompt =
    lesson.content?.prompt ||
    lesson.content?.reflectionPrompt ||
    (lesson.content as any)?.question ||
    '';
  const reflectionEnabled =
    isReflectionLesson ||
    lesson.content?.collectResponse === true ||
    Boolean(lesson.content?.allowReflection) ||
    Boolean(reflectionPrompt);
  const reflectionRequired = isReflectionLesson || lesson.content?.requireReflection === true;
  const linkedSurveyId =
    (lesson.content as any)?.surveyId ||
    (lesson.content as any)?.survey_id ||
    (lesson.content as any)?.assignedSurveyId ||
    (lesson.content as any)?.assigned_survey_id ||
    '';

  const documentUrlCandidates = [
    (lesson.content as any)?.downloadUrl,
    (lesson.content as any)?.url,
    (lesson.content as any)?.resourceUrl,
    (lesson.content as any)?.src,
    (lesson.content as any)?.link,
    lesson.content?.fileUrl,
    lesson.content?.documentUrl,
    lesson.content?.documentAsset?.signedUrl,
    lesson.content?.documentAsset?.publicUrl,
    (lesson.content?.documentAsset as any)?.url,
  ];

  const renderFallback = (message: string) => (
    <Card tone="muted" className="space-y-3">
      <p className="text-sm text-slate/80">{message}</p>
      <Button size="sm" onClick={onComplete}>
        Mark as complete
      </Button>
    </Card>
  );

  if (!lesson.content || (typeof lesson.content === 'object' && Object.keys(lesson.content).length === 0)) {
    return renderFallback('Lesson content unavailable. Please check back later.');
  }
  if (isTextLesson || isReflectionLesson) {
    const textBody = lesson.content.textContent || lesson.content.content || lesson.description || '';
    if (!textBody.trim() && !isReflectionLesson && !reflectionPrompt.trim()) {
      return renderFallback(
        isReflectionLesson
          ? 'Reflection prompt will appear here once your facilitator adds it.'
          : 'Lesson notes will appear here once your facilitator adds them.',
      );
    }

    return (
      <div className="max-w-none text-charcoal">
          {isReflectionLesson && (
             <Badge tone="info" className="mb-4 bg-sunrise/10 text-sunrise">
               Reflection
             </Badge>
           )}
        {textBody.trim() && (
          <div className="prose max-w-none text-charcoal" dangerouslySetInnerHTML={{ __html: textBody }} />
        )}
        {reflectionEnabled && (
          courseId && lesson?.id ? (
            <GuidedReflectionFlow
              courseId={courseId}
              learnerId={learnerId}
              lessonId={lesson.id}
              lessonTitle={lesson.title}
              lessonContent={lesson.content as Record<string, unknown>}
              required={reflectionRequired}
              onComplete={onSubmitAndAdvance ?? onComplete}
            />
          ) : null
        )}
        {!reflectionEnabled && (
          <div className="mt-8 flex justify-end border-t border-mist/60 pt-6">
            <Button onClick={onComplete} trailingIcon={<CheckCircle className="h-4 w-4" />}>
              {isReflectionLesson ? 'Complete reflection' : 'Mark as complete'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (lessonType === 'survey') {
    if (!linkedSurveyId.trim()) {
      return renderFallback('This survey lesson is missing its linked survey configuration.');
    }

    return (
      <LearnerSurveyLesson
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        lessonDescription={lesson.description || (lesson.content as any)?.surveyDescription}
        surveyId={linkedSurveyId}
        onSubmitSuccess={onSubmitAndAdvance ?? (async () => onComplete())}
      />
    );
  }

  if (lessonType === 'quiz') {
    return (
      <Card tone="muted" className="space-y-3">
        <h3 className="font-heading text-lg font-semibold text-charcoal mb-4">
          Quiz: {lesson.title}
        </h3>
        <p className="text-sm text-slate/80">{lesson.description || 'Check your understanding before moving on.'}</p>
        <Button onClick={() => onShowQuizModal(true)}>Start quiz</Button>
      </Card>
    );
  }

  if (lessonType === 'interactive') {
    const instructions = lesson.content.instructions || lesson.description || 'Complete the activity to continue.';
    return (
      <Card tone="muted" className="space-y-4">
        <h3 className="font-heading text-lg font-semibold text-charcoal">Interactive activity</h3>
        <p className="text-sm text-slate/80">{instructions}</p>
        <Button onClick={onComplete} trailingIcon={<CheckCircle className="h-4 w-4" />}>
          Mark activity complete
        </Button>
      </Card>
    );
  }

  if (lessonType === 'scenario') {
    if (!courseId || !lesson?.id) {
      return renderFallback('Scenario lesson unavailable. Please check back later.');
    }

    return (
      <React.Suspense fallback={<LoadingSpinner className="mx-auto my-10" />}>
        <ScenarioLesson
          courseId={courseId}
          learnerId={learnerId}
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          lessonContent={lesson.content as Record<string, unknown>}
          onComplete={onSubmitAndAdvance ?? onComplete}
        />
      </React.Suspense>
    );
  }

  if (lessonType === 'resource' || lessonType === 'document' || lessonType === 'download') {
    const resource: any = lesson.content;
    // Try multiple possible field names for the download URL
    const downloadUrl = documentUrlCandidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    const fileSize = resource.fileSize || resource.size;
    const resourceType = resource.resourceType || lessonType || resource.type || 'file';
    
    return (
      <div className="space-y-6">
        {/* Resource Download Card - Made More Prominent */}
        <Card className="border-2 border-skyblue bg-gradient-to-br from-skyblue/5 to-indigo-50/50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-16 h-16 bg-skyblue/20 rounded-xl flex items-center justify-center">
              <Download className="h-8 w-8 text-skyblue" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-heading text-xl font-bold text-charcoal mb-2">
                  {lesson.title}
                </h3>
                <p className="text-sm text-slate/80">
                  {resource.description || lesson.description || 'Download this resource to continue your learning journey.'}
                </p>
              </div>
              
              {(fileSize || resourceType) && (
                <div className="flex items-center gap-4">
                  {resourceType && (
                    <Badge className="bg-skyblue/20 text-skyblue border-skyblue/30">
                      <span className="uppercase font-semibold">{resourceType}</span>
                    </Badge>
                  )}
                  {fileSize && (
                    <span className="text-sm font-medium text-slate/70">{fileSize}</span>
                  )}
                </div>
              )}

              {downloadUrl ? (
                <div className="flex gap-3">
                  <Button 
                    size="lg"
                    className="bg-skyblue hover:bg-skyblue/90 text-white shadow-lg"
                    asChild 
                    leadingIcon={<Download className="h-5 w-5" />}
                  >
                    <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download>
                      Download Resource
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={onComplete}
                    trailingIcon={<CheckCircle className="h-5 w-5" />}
                  >
                    Mark as Complete
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">Resource Not Available</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          The download link for this resource is currently unavailable. Please contact your course administrator.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onComplete}>
                    Mark as reviewed anyway
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Instructions Card */}
        <Card tone="muted" className="p-4">
          <h4 className="font-heading text-sm font-semibold text-charcoal mb-2">
            📋 What to do with this resource
          </h4>
          <ul className="text-sm text-slate/80 space-y-1 list-disc list-inside">
            <li>Download the file to your computer</li>
            <li>Review the material at your own pace</li>
            <li>Mark the lesson as complete when you're done</li>
          </ul>
        </Card>
      </div>
    );
  }

  return renderFallback('This lesson type is not interactive in the preview environment.');
};

// Additional helper components would go here...
const IconToggle = ({
  onClick,
  icon,
  label,
  active = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={cn(
      'rounded-full border border-transparent p-2 transition',
      active ? 'bg-skyblue/10 text-skyblue' : 'text-slate/70 hover:bg-cloud hover:text-skyblue'
    )}
  >
    {icon}
  </button>
);

const TranscriptPanel: React.FC<{
  transcript: string;
  currentTime: number;
  onSeek: (time: number) => void;
}> = ({ transcript }) => (
  <div className="rounded-2xl border border-mist bg-white p-4 shadow-card-sm">
    <h3 className="font-heading text-sm font-semibold text-charcoal">Transcript</h3>
    <div className="mt-2 max-h-64 overflow-y-auto text-sm text-slate/80">
      {transcript}
    </div>
  </div>
);

const NotesPanel: React.FC<{
  notes: UserNote[];
  bookmarks: UserBookmark[];
  noteText: string;
  onNoteTextChange: (text: string) => void;
  onAddNote: () => void;
}> = ({ notes, bookmarks, noteText, onNoteTextChange, onAddNote }) => (
  <div className="rounded-2xl border border-mist bg-white p-4 shadow-card-sm">
    <h3 className="font-heading text-sm font-semibold text-charcoal">Notes & bookmarks</h3>
    <p className="mt-1 text-xs text-slate/70">Capture reflections and jump back to key moments.</p>

    <div className="mt-4 space-y-3">
      <textarea
        value={noteText}
        onChange={(event) => onNoteTextChange(event.target.value)}
        placeholder="Add a note..."
        className="w-full rounded-lg border border-mist bg-cloud px-3 py-2 text-sm text-charcoal focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue/40"
        rows={3}
      />
      <Button size="sm" onClick={onAddNote} className="w-full">
        Save note
      </Button>
    </div>

    <div className="mt-4 space-y-3">
      {bookmarks.map((bookmark) => (
        <div key={bookmark.id} className="rounded-xl border border-mist bg-cloud px-3 py-2 text-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate/70">
            <span>Bookmark</span>
            <span>
              {Math.floor(bookmark.position / 60)}:{(bookmark.position % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <p className="mt-1 text-sm text-charcoal">{bookmark.note || 'Quick reference saved.'}</p>
        </div>
      ))}

      {notes.map((note) => (
        <div key={note.id} className="rounded-xl border border-mist bg-cloud px-3 py-2 text-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate/70">
            <span>Note</span>
            <span>
              {note.position
                ? `${Math.floor(note.position / 60)}:${(note.position % 60).toString().padStart(2, '0')}`
                : ''}
            </span>
          </div>
          <p className="mt-1 text-sm text-charcoal">{note.content}</p>
        </div>
      ))}
    </div>
  </div>
);

const NavigationPanel: React.FC<{
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onMarkComplete: () => void;
  autoplayNextLesson: boolean;
  onAutoplayNextLessonChange: (next: boolean) => void;
}> = ({
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  onMarkComplete,
  autoplayNextLesson,
  onAutoplayNextLessonChange,
}) => (
  <div className="rounded-2xl border border-mist bg-white p-4 shadow-card-sm">
    <h3 className="font-heading text-sm font-semibold text-charcoal">Lesson actions</h3>
    <p className="mt-1 text-xs text-slate/70">Navigate through the module or mark this lesson complete.</p>
    <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-mist px-3 py-2 text-xs text-slate/80">
      <span>Autoplay next lesson</span>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-mist text-skyblue focus:ring-skyblue"
        checked={autoplayNextLesson}
        onChange={(event) => onAutoplayNextLessonChange(event.target.checked)}
      />
    </label>
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={!canGoPrevious} leadingIcon={<ArrowLeft className="h-4 w-4" />} className="flex-1">
          Previous
        </Button>
        <Button size="sm" onClick={onNext} disabled={!canGoNext} trailingIcon={<ArrowRight className="h-4 w-4" />} className="flex-1">
          Next lesson
        </Button>
      </div>
      <Button variant="success" size="sm" onClick={onMarkComplete} leadingIcon={<CheckCircle className="h-4 w-4" />}>
        Mark as complete
      </Button>
    </div>
  </div>
);

export default CoursePlayer;
