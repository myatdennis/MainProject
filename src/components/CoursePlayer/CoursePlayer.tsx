import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  FileText
} from 'lucide-react';
import { Course, Lesson, LearnerProgress, UserBookmark, UserNote, Module } from '../../types/courseTypes';
import courseManagementStore from '../../store/courseManagementStore';
import { courseStore } from '../../store/courseStore';

const convertModulesToChapters = (course: Course): Course => {
  if (course.chapters && course.chapters.length > 0) {
    return course;
  }

  const modules: Module[] = course.modules || [];
  if (modules.length === 0) {
    return course;
  }

  const chapters = modules.map((module, moduleIndex) => {
    const chapterId = module.id || `module-${moduleIndex}`;
    const lessons = module.lessons?.map((lesson, lessonIndex) => ({
      ...lesson,
      chapterId,
      order: typeof lesson.order === 'number' ? lesson.order : lessonIndex,
    })) || [];

    const estimatedDuration = lessons.reduce((total, lesson) => {
      if (lesson.estimatedDuration) return total + lesson.estimatedDuration;
      const parsed = typeof lesson.duration === 'string' ? parseInt(lesson.duration, 10) : 0;
      return total + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    return {
      id: chapterId,
      courseId: course.id,
      title: module.title,
      description: module.description,
      order: typeof module.order === 'number' ? module.order : moduleIndex,
      estimatedDuration,
      lessons,
      isLocked: false,
    };
  });

  return {
    ...course,
    chapters,
  };
};

const CoursePlayer: React.FC = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isPreview = searchParams.get('preview') === 'true';

  const buildLessonPath = (id: string) => {
    if (!courseId) {
      return '/lms/courses';
    }
    const basePath = `/lms/course/${courseId}/lesson/${id}`;
    return isPreview ? `${basePath}?preview=true` : basePath;
  };
  
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  
  // Note-taking state
  const [noteText, setNoteText] = useState('');
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [userBookmarks, setUserBookmarks] = useState<UserBookmark[]>([]);

  useEffect(() => {
    if (!courseId) {
      return;
    }

    let resolvedCourse: Course | null = null;

    const courseFromStore = courseManagementStore.getCourse(courseId);

    if (courseFromStore) {
      resolvedCourse = courseFromStore;
      const userProgress = courseManagementStore.getLearnerProgress('user-123', courseId);
      setProgress(userProgress);
    } else if (isPreview) {
      const builderCourse = courseStore.getCourse(courseId);
      if (builderCourse) {
        resolvedCourse = convertModulesToChapters(builderCourse);
        setProgress(null);
      }
    }

    if (resolvedCourse) {
      setCourse(resolvedCourse);

      const targetLesson = lessonId ? findLessonById(resolvedCourse, lessonId) : null;

      if (targetLesson) {
        setCurrentLesson(targetLesson);
      } else {
        const firstLesson = getFirstLesson(resolvedCourse);
        if (firstLesson) {
          setCurrentLesson(firstLesson);
          navigate(buildLessonPath(firstLesson.id), { replace: true });
        } else {
          setCurrentLesson(null);
        }
      }

      loadUserNotesAndBookmarks();
    } else {
      setCourse(null);
      setCurrentLesson(null);
    }

    setIsLoading(false);
  }, [courseId, lessonId, navigate, isPreview]);

  const findLessonById = (course: Course, lessonId: string): Lesson | null => {
    for (const chapter of course.chapters || []) {
      const lesson = chapter.lessons.find(l => l.id === lessonId);
      if (lesson) return lesson;
    }
    return null;
  };

  const getFirstLesson = (course: Course): Lesson | null => {
    return (course.chapters || [])[0]?.lessons[0] || null;
  };

  const loadUserNotesAndBookmarks = () => {
    if (!courseId) return;
    
    const notes = courseManagementStore.getUserNotes('user-123', courseId);
    const bookmarks = courseManagementStore.getUserBookmarks('user-123', courseId);
    
    setUserNotes(notes);
    setUserBookmarks(bookmarks);
  };

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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Update progress
      if (currentLesson && courseId) {
        const progressPercent = (videoRef.current.currentTime / videoRef.current.duration) * 100;
        courseManagementStore.updateLessonProgress('user-123', courseId, currentLesson.id, { progress: progressPercent });
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

  const navigateLesson = (direction: 'prev' | 'next') => {
    if (!course || !currentLesson || !courseId) return;

    const allLessons = (course.chapters || []).flatMap((chapter: { lessons: Lesson[] }) => chapter.lessons);
    const currentIndex = allLessons.findIndex(lesson => lesson.id === currentLesson.id);

    let nextIndex: number;
    if (direction === 'next') {
      nextIndex = currentIndex + 1;
    } else {
      nextIndex = currentIndex - 1;
    }

    if (nextIndex >= 0 && nextIndex < allLessons.length) {
      const nextLesson = allLessons[nextIndex];
      navigate(buildLessonPath(nextLesson.id));
    }
  };

  const markLessonComplete = () => {
    if (currentLesson && courseId) {
      courseManagementStore.markLessonComplete('user-123', courseId, currentLesson.id);
      
      // Refresh progress
      const updatedProgress = courseManagementStore.getLearnerProgress('user-123', courseId);
      setProgress(updatedProgress);
      
      // Auto-navigate to next lesson
      navigateLesson('next');
    }
  };

  const addBookmark = () => {
    if (currentLesson && courseId) {
      const timestamp = Math.floor(currentTime);
      courseManagementStore.addBookmark('user-123', courseId, { 
        lessonId: currentLesson.id, 
        position: timestamp, 
        note: 'Video bookmark' 
      });
      loadUserNotesAndBookmarks();
    }
  };

  const addNote = () => {
    if (noteText.trim() && currentLesson && courseId) {
      const timestamp = Math.floor(currentTime);
      courseManagementStore.addNote('user-123', courseId, { 
        lessonId: currentLesson.id, 
        content: noteText, 
        position: timestamp 
      });
      setNoteText('');
      loadUserNotesAndBookmarks();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Course not found</h2>
          <button
            onClick={() => navigate('/lms/courses')}
            className="text-orange-600 hover:text-orange-800"
          >
            Return to courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-gray-800 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/lms/courses')}
              className="flex items-center text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {!sidebarCollapsed && 'Back to Courses'}
            </button>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-300 hover:text-white"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="mt-3">
              <h1 className="font-semibold text-white">{course.title}</h1>
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm text-gray-300 mb-1">
                  <span>Progress</span>
                  <span>{Math.round((progress?.overallProgress || 0) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(progress?.overallProgress || 0) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <CourseOutline
            course={course}
            currentLesson={currentLesson}
            progress={progress}
            collapsed={sidebarCollapsed}
            onLessonSelect={(lesson) => navigate(buildLessonPath(lesson.id))}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Video Player */}
        {currentLesson.type === 'video' && (
          <div className="relative bg-black">
            <video
              ref={videoRef}
              src={currentLesson.content.videoUrl}
              className="w-full h-auto max-h-96"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
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
          </div>
        )}

        {/* Lesson Content */}
        <div className="flex-1 bg-white text-gray-900">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{currentLesson.title}</h2>
                <p className="text-gray-600 mt-1">{currentLesson.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={addBookmark}
                  className="p-2 text-gray-600 hover:text-orange-600"
                  title="Add bookmark"
                >
                  <Bookmark className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className="p-2 text-gray-600 hover:text-orange-600"
                  title="Toggle notes"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="p-2 text-gray-600 hover:text-orange-600"
                  title="Toggle transcript"
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content Area */}
              <div className="lg:col-span-2">
                <LessonContent 
                  lesson={currentLesson} 
                  onComplete={markLessonComplete}
                  showQuizModal={showQuizModal}
                  onShowQuizModal={setShowQuizModal}
                />
                
                {showTranscript && currentLesson.content.transcript && (
                  <TranscriptPanel 
                    transcript={currentLesson.content.transcript}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                )}
              </div>

              {/* Sidebar Content */}
              <div className="space-y-6">
                {showNotes && (
                  <NotesPanel
                    notes={userNotes.filter(note => note.lessonId === currentLesson.id)}
                    bookmarks={userBookmarks.filter(bookmark => bookmark.lessonId === currentLesson.id)}
                    noteText={noteText}
                    onNoteTextChange={setNoteText}
                    onAddNote={addNote}
                    onSeek={handleSeek}
                  />
                )}
                
                <NavigationPanel
                  onPrevious={() => navigateLesson('prev')}
                  onNext={() => navigateLesson('next')}
                  canGoPrevious={true} // You'd calculate this based on lesson position
                  canGoNext={true}
                />
              </div>
            </div>
          </div>
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
  collapsed: boolean;
  onLessonSelect: (lesson: Lesson) => void;
}> = ({ course, currentLesson, progress, collapsed, onLessonSelect }) => {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  const getLessonProgress = (lessonId: string) => {
    return progress?.lessonProgress.find(lp => lp.lessonId === lessonId);
  };

  if (collapsed) {
    return (
      <div className="p-2">
        {(course.chapters || []).map((chapter) => (
          <div key={chapter.id} className="mb-2">
            <div className="w-3 h-3 bg-gray-600 rounded-full mx-auto"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {(course.chapters || []).map((chapter, chapterIndex) => (
        <div key={chapter.id}>
          <button
            onClick={() => toggleChapter(chapter.id)}
            className="w-full flex items-center justify-between p-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded"
          >
            <span className="font-medium">
              {chapterIndex + 1}. {chapter.title}
            </span>
            {expandedChapters.has(chapter.id) ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {expandedChapters.has(chapter.id) && (
            <div className="ml-4 mt-2 space-y-1">
              {chapter.lessons.map((lesson, lessonIndex) => {
                const lessonProgress = getLessonProgress(lesson.id);
                const isComplete = lessonProgress?.isCompleted || false;
                const isCurrent = lesson.id === currentLesson.id;
                
                return (
                  <button
                    key={lesson.id}
                    onClick={() => onLessonSelect(lesson)}
                    className={`w-full flex items-center p-2 text-left text-sm rounded transition-colors ${
                      isCurrent
                        ? 'bg-orange-600 text-white'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    <div className="mr-3">
                      {isComplete ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {lessonIndex + 1}. {lesson.title}
                      </div>
                      <div className="flex items-center text-xs opacity-75">
                        <Clock className="w-3 h-3 mr-1" />
                        {lesson.estimatedDuration} min
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
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
  showQuizModal: boolean;
  onShowQuizModal: (show: boolean) => void;
}> = ({ lesson, onComplete, showQuizModal: _showQuizModal, onShowQuizModal }) => {
  if (lesson.type === 'text') {
    return (
      <div className="prose max-w-none">
        <div dangerouslySetInnerHTML={{ __html: lesson.content.textContent || '' }} />
        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={onComplete}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Mark as Complete
          </button>
        </div>
      </div>
    );
  }

  if (lesson.type === 'quiz') {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Quiz: {lesson.title}</h3>
        <p className="text-gray-600 mb-6">{lesson.description}</p>
        <button
          onClick={() => onShowQuizModal(true)}
          className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <p className="text-gray-600">Interactive content will be displayed here.</p>
    </div>
  );
};

// Additional helper components would go here...
const TranscriptPanel: React.FC<{
  transcript: string;
  currentTime: number;
  onSeek: (time: number) => void;
}> = ({ transcript }) => (
  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
    <h3 className="font-semibold mb-3">Transcript</h3>
    <div className="prose text-sm">
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
  onSeek: (time: number) => void;
}> = ({ notes, bookmarks, noteText, onNoteTextChange, onAddNote }) => (
  <div className="bg-gray-50 rounded-lg p-4">
    <h3 className="font-semibold mb-3">Notes & Bookmarks</h3>
    
    <div className="space-y-3 mb-4">
      <textarea
        value={noteText}
        onChange={(e) => onNoteTextChange(e.target.value)}
        placeholder="Add a note..."
        className="w-full p-2 border border-gray-300 rounded resize-none"
        rows={3}
      />
      <button
        onClick={onAddNote}
        className="bg-orange-600 text-white px-4 py-1 rounded text-sm hover:bg-orange-700"
      >
        Add Note
      </button>
    </div>

    <div className="space-y-2 max-h-64 overflow-y-auto">
      {bookmarks.map(bookmark => (
        <div key={bookmark.id} className="p-2 bg-white rounded border text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Bookmark</span>
            <span className="text-gray-500">{Math.floor(bookmark.position / 60)}:{(bookmark.position % 60).toString().padStart(2, '0')}</span>
          </div>
          <p className="text-gray-600">{bookmark.note || 'No note'}</p>
        </div>
      ))}
      
      {notes.map(note => (
        <div key={note.id} className="p-2 bg-white rounded border text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">Note</span>
            <span className="text-gray-500">{note.position ? `${Math.floor(note.position / 60)}:${(note.position % 60).toString().padStart(2, '0')}` : ''}</span>
          </div>
          <p className="text-gray-700">{note.content}</p>
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
}> = ({ onPrevious, onNext, canGoPrevious, canGoNext }) => (
  <div className="bg-gray-50 rounded-lg p-4">
    <h3 className="font-semibold mb-3">Navigation</h3>
    <div className="flex space-x-2">
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Previous
      </button>
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className="flex-1 flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-700"
      >
        Next
        <ArrowRight className="w-4 h-4 ml-2" />
      </button>
    </div>
  </div>
);

export default CoursePlayer;