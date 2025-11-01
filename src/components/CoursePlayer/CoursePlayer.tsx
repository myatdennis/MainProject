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
  ChevronLeft,
  ChevronRight,
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
  Download
} from 'lucide-react';
import { Course, Lesson, LearnerProgress, UserBookmark, UserNote } from '../../types/courseTypes';
import type { NormalizedCourse, NormalizedLesson } from '../../utils/courseNormalization';
import { loadCourse } from '../../services/courseDataLoader';
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
import { useSyncService } from '../../services/syncService';
import { useToast } from '../../context/ToastContext';
import {
  updateAssignmentProgress,
} from '../../utils/assignmentStorage';
import { analyticsService } from '../../services/analyticsService';

interface CoursePlayerProps {
  namespace?: 'lms' | 'client';
}

const CoursePlayer: React.FC<CoursePlayerProps> = ({ namespace = 'lms' }) => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const syncService = useSyncService();
  const { showToast } = useToast();
  const isClientNamespace = namespace === 'client';
  const coursePathBase = isClientNamespace ? '/client/courses' : '/lms/course';
  const lessonPathSegment = isClientNamespace ? 'lessons' : 'lesson';
  const coursesIndexPath = isClientNamespace ? '/client/courses' : '/lms/courses';
  const eventSource = isClientNamespace ? 'client' : 'lms';

  const learnerId = useMemo(() => {
    try {
      const raw = localStorage.getItem('huddle_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return (parsed.email || parsed.id || 'local-user').toLowerCase();
      }
    } catch (error) {
      console.warn('Failed to read learner identity:', error);
    }
    return 'local-user';
  }, []);

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

  const handleRetry = () => setReloadToken((token) => token + 1);

  const storedProgressRef = useRef<StoredCourseProgress | null>(null);
  const lessonIdRef = useRef<string | undefined>(lessonId);
  const hasTrackedInitialEventRef = useRef(false);
  const lastLoggedErrorRef = useRef<string | null>(null);

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

  // UI state
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);

  // Note-taking state
  const [noteText, setNoteText] = useState('');
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [userBookmarks, setUserBookmarks] = useState<UserBookmark[]>([]);

  const progress = useMemo(() => {
    if (!courseData) return null;
    return buildLearnerProgressSnapshot(courseData.course, completedLessons, lessonProgressMap, lessonPositions);
  }, [courseData, completedLessons, lessonProgressMap, lessonPositions]);

  const courseLessons = courseData?.lessons ?? [];
  const course = courseData?.course ?? null;
  const currentLessonIndex = currentLesson
    ? courseLessons.findIndex((lesson) => lesson.id === currentLesson.id)
    : -1;
  const canGoPrevious = currentLessonIndex > 0;
  const canGoNext = currentLessonIndex !== -1 && currentLessonIndex < courseLessons.length - 1;

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
    if (!course || courseLessons.length === 0) return;

    const allLessonsCompleted = completedLessons.size === courseLessons.length;

    if (allLessonsCompleted) {
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
        analyticsService.trackCourseCompletion(learnerId, course.id, {
          totalTimeSpent: Math.max(0, Math.round(totalTimeSeconds / 60)),
          modulesCompleted: modulesCompletedCount,
          lessonsCompleted: courseLessons.length,
          quizzesPassed: 0,
          certificateGenerated: Boolean(storedProgressRef.current?.lastLessonId),
        });
        setHasLoggedCourseCompletion(true);
      }

      if (completionTimestamp === null) {
        setCompletionTimestamp(Date.now());
        setShowCompletionScreen(true);
      }
    } else {
      if (hasLoggedCourseCompletion) {
        setHasLoggedCourseCompletion(false);
      }
      if (completionTimestamp !== null) {
        setCompletionTimestamp(null);
      }
      if (showCompletionScreen) {
        setShowCompletionScreen(false);
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

    analyticsService.trackEvent(
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
    if (!currentLesson) return;
    const savedPosition = lessonPositions[currentLesson.id] ?? 0;
    setCurrentTime(savedPosition);
  }, [currentLesson?.id]);

  useEffect(() => {
    if (!courseData) return;
    if (!lessonId) return;

    const lesson = courseLessons.find((item) => item.id === lessonId);
    if (lesson) {
      setCurrentLesson(lesson);
    }
  }, [lessonId, courseData, courseLessons]);

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

        setCourseData({ course: result.course, lessons: result.lessons });

        if (learnerId) {
          await syncCourseProgressWithRemote({
            courseSlug: result.course.slug,
            courseId: result.course.id,
            userId: learnerId,
            lessonIds: result.lessons.map((lesson) => lesson.id),
          });
        }

        const stored = loadStoredCourseProgress(result.course.slug);
        storedProgressRef.current = stored;

        setCompletedLessons(new Set(stored.completedLessonIds));
        setLessonProgressMap(stored.lessonProgress || {});
        setLessonPositions(stored.lessonPositions || {});

        const desiredLessonId = lessonIdRef.current || stored.lastLessonId;
        const startingLesson =
          (desiredLessonId && result.lessons.find((lesson) => lesson.id === desiredLessonId)) ||
          result.lessons[0] ||
          null;

        if (startingLesson) {
          setCurrentLesson(startingLesson);
          if (!lessonId || lessonId !== startingLesson.id) {
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
  }, [courseId, navigate, reloadToken, learnerId]);

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
    analyticsService.trackEvent(
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
    (lesson: NormalizedLesson, position?: number, totalDuration?: number, silent = false) => {
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

      if (!silent) {
        showToast(`Marked "${lesson.title}" complete`, 'success');
      }

      if (course?.id) {
        const overallPercent = calculateOverallPercent(nextProgressMap, nextCompleted);
        void updateAssignmentProgress(course.id, learnerId, overallPercent);
      }
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
    ]
  );

  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentLesson) return;

    const player = videoRef.current;
    if (!player.duration || Number.isNaN(player.duration)) return;

    const position = player.currentTime;
    const progressPercent = Math.min(100, Math.round((position / player.duration) * 100));

    setCurrentTime(position);

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
        completeLesson(currentLesson, position, player.duration, true);
      } else if (progressPercent - previousProgress >= 10) {
        logProgress(currentLesson.id, progressPercent, position);
      }
    }
  };

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

  const navigateLesson = useCallback(
    (direction: 'prev' | 'next') => {
      if (!currentLesson || courseLessons.length === 0) return;

      const currentIndex = courseLessons.findIndex((lesson) => lesson.id === currentLesson.id);
      if (currentIndex === -1) return;

      const offset = direction === 'next' ? 1 : -1;
      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= courseLessons.length) return;

      const nextLesson = courseLessons[nextIndex];
      const courseSlug = courseData?.course.slug || courseId || '';
      if (!courseSlug) return;
      navigate(`${coursePathBase}/${courseSlug}/${lessonPathSegment}/${nextLesson.id}`);
    },
    [courseLessons, currentLesson, navigate, courseData, courseId, coursePathBase, lessonPathSegment]
  );

  const markLessonComplete = () => {
    if (!currentLesson) return;
    completeLesson(currentLesson);
    navigateLesson('next');
  };

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
            {course.lessons} lessons
          </span>
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

          <Card padding="none" className="overflow-hidden">
            {currentLesson.type === 'video' && (
              <div className="relative bg-ink">
                {currentLesson.content?.videoUrl ? (
                  <video
                    ref={videoRef}
                    src={currentLesson.content.videoUrl}
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
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                ) : (
                  <Card tone="muted" className="h-full w-full rounded-none border-none">
                    <p className="text-sm text-slate/80">Video source unavailable. Please contact your facilitator.</p>
                  </Card>
                )}

                {currentLesson.content?.videoUrl && (
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
                  />
                )}
              </div>
            )}

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
                  onComplete={markLessonComplete}
                  onShowQuizModal={setShowQuizModal}
                />

                {showTranscript && currentLesson.content.transcript && (
                  <TranscriptPanel transcript={currentLesson.content.transcript} currentTime={currentTime} onSeek={handleSeek} />
                )}
              </div>

              <div className="space-y-6">
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
                  onMarkComplete={markLessonComplete}
                />
              </div>
            </div>
          </Card>
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
  onSettings
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
  onComplete: () => void;
  onShowQuizModal: (show: boolean) => void;
}> = ({ lesson, onComplete, onShowQuizModal }) => {
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

  if (lesson.type === 'text' || lesson.type === 'document') {
    const html = lesson.content.textContent || lesson.content.content || lesson.description || '';
    if (!html.trim()) {
      return renderFallback('Lesson notes will appear here once your facilitator adds them.');
    }
    return (
      <div className="prose max-w-none text-charcoal">
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <div className="mt-8 flex justify-end border-t border-mist/60 pt-6">
          <Button onClick={onComplete} trailingIcon={<CheckCircle className="h-4 w-4" />}>
            Mark as complete
          </Button>
        </div>
      </div>
    );
  }

  if (lesson.type === 'quiz') {
    return (
      <Card tone="muted" className="space-y-3">
        <h3 className="font-heading text-lg font-semibold text-charcoal">Quiz: {lesson.title}</h3>
        <p className="text-sm text-slate/80">{lesson.description || 'Check your understanding before moving on.'}</p>
        <Button onClick={() => onShowQuizModal(true)}>Start quiz</Button>
      </Card>
    );
  }

  if (lesson.type === 'interactive') {
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

  if (lesson.type === 'resource' || lesson.type === 'document') {
    const resource: any = lesson.content;
    const downloadUrl = resource.downloadUrl || resource.url;
    return (
      <Card tone="muted" className="space-y-4">
        <h3 className="font-heading text-lg font-semibold text-charcoal">Resource download</h3>
        <p className="text-sm text-slate/80">{resource.description || lesson.description || 'Access the supporting material below.'}</p>
        {downloadUrl ? (
          <Button asChild leadingIcon={<Download className="h-4 w-4" />}>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              Download resource
            </a>
          </Button>
        ) : (
          <p className="text-xs text-slate/70">Download link not available.</p>
        )}
        <Button variant="ghost" size="sm" onClick={onComplete}>
          Mark as reviewed
        </Button>
      </Card>
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
}> = ({ onPrevious, onNext, canGoPrevious, canGoNext, onMarkComplete }) => (
  <div className="rounded-2xl border border-mist bg-white p-4 shadow-card-sm">
    <h3 className="font-heading text-sm font-semibold text-charcoal">Lesson actions</h3>
    <p className="mt-1 text-xs text-slate/70">Navigate through the module or mark this lesson complete.</p>
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
