import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Save, 
  Eye, 
  Plus, 
  Trash2, 
  Upload, 
  Video, 
  FileText, 
  HelpCircle, 
  Settings,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Clock,
  Users,
  Award,
  BookOpen,
  Edit3,
  Move,
  Copy
} from 'lucide-react';
import { Course, Chapter, Lesson, LessonContent } from '../../types/courseTypes';
import courseManagementStore from '../../store/courseManagementStore';
import LoadingButton from '../../components/LoadingButton';
import Modal from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import { courseStore } from '../../store/courseStore';
import { formatMinutes, slugify, parseDurationToMinutes } from '../../utils/courseNormalization';
import { clearCourseCache } from '../../services/courseDataLoader';
import { CourseService, CourseValidationError } from '../../services/courseService';
import { computeCourseDiff } from '../../utils/courseDiff';

type LessonUpdate = Partial<Lesson> & {
  content?: Partial<LessonContent>;
};

const generateId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const DRAFT_STORAGE_PREFIX = 'course_builder_draft_';
const AUTOSAVE_DELAY = 800;
const REMOTE_AUTOSAVE_DELAY = 1500;
const isSupabaseReady =
  Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
const remoteDraftTimers = new Map<string, number>();

const readDraftCourse = (id: string): Course | null => {
  try {
    const raw = localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Course;
  } catch (error) {
    console.warn('Failed to parse course draft', error);
    return null;
  }
};

const writeDraftCourse = (id: string, data: Course) => {
  try {
    localStorage.setItem(`${DRAFT_STORAGE_PREFIX}${id}`, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to write course draft', error);
  }
};

const removeDraftCourse = (id: string) => {
  try {
    localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${id}`);
  } catch (error) {
    console.warn('Failed to remove course draft', error);
  }
};

const queueRemoteDraftSync = (course: Course) => {
  if (!isSupabaseReady) {
    return;
  }

  const existingTimer = remoteDraftTimers.get(course.id);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timeoutId = window.setTimeout(() => {
    CourseService.syncCourseToDatabase({
      ...course,
      status: course.status === 'published' ? 'published' : 'draft',
    })
      .catch((error) => {
        if (error instanceof CourseValidationError) {
          console.warn('Autosave skipped due to validation errors:', error.issues);
          return;
        }
        console.error('Failed to autosave course draft to Supabase:', error);
      })
      .finally(() => {
        remoteDraftTimers.delete(course.id);
      });
  }, REMOTE_AUTOSAVE_DELAY);

  remoteDraftTimers.set(course.id, timeoutId);
};

const convertModulesToChapters = (course: Course): Course => {
  if (course.chapters && course.chapters.length > 0) {
    return recalculateCourseDurations(course);
  }

  const modules = course.modules || [];
  const chapters: Chapter[] = modules.map((module, moduleIndex) => {
    const lessons = (module.lessons || []).map((lesson, lessonIndex) => {
      const estimated =
        lesson.estimatedDuration ??
        parseDurationToMinutes(lesson.duration) ??
        (lesson.content?.videoDuration ? Math.round(lesson.content.videoDuration / 60) : 0);

      return {
        ...lesson,
        chapterId: module.id,
        order: lesson.order ?? lessonIndex + 1,
        estimatedDuration: Number.isFinite(estimated) ? estimated : 0,
        content: {
          ...(lesson.content || {}),
        },
      };
    });

    const estimatedDuration = lessons.reduce((total, l) => total + (l.estimatedDuration || 0), 0);

    return {
      id: module.id,
      courseId: course.id,
      title: module.title,
      description: module.description,
      order: module.order ?? moduleIndex + 1,
      estimatedDuration,
      lessons,
    };
  });

  return recalculateCourseDurations({
    ...course,
    chapters,
  });
};

const mergeDraft = (base: Course, draft: Course): Course => {
  if (base.id !== draft.id) {
    return base;
  }

  const merged: Course = {
    ...base,
    ...draft,
    chapters: draft.chapters && draft.chapters.length > 0 ? draft.chapters : base.chapters,
    modules: draft.modules && draft.modules.length > 0 ? draft.modules : base.modules,
  };

  return recalculateCourseDurations(merged);
};

const recalculateCourseDurations = (course: Course): Course => {
  const chapters = (course.chapters || []).map((chapter, chapterIndex) => {
    const lessons = (chapter.lessons || []).map((lesson, lessonIndex) => ({
      ...lesson,
      order: lesson.order ?? lessonIndex + 1,
      estimatedDuration: lesson.estimatedDuration ?? 0,
      content: {
        ...(lesson.content || {}),
      },
    }));

    const estimatedDuration = lessons.reduce((sum, lesson) => {
      return sum + (lesson.estimatedDuration || 0);
    }, 0);

    return {
      ...chapter,
      order: chapter.order ?? chapterIndex + 1,
      lessons,
      estimatedDuration,
    };
  });

  const totalMinutes = chapters.reduce((sum, chapter) => {
    return sum + (chapter.estimatedDuration || 0);
  }, 0);

  return {
    ...course,
    chapters,
    estimatedDuration: totalMinutes,
    duration: formatMinutes(totalMinutes) || `${totalMinutes} min`,
  };
};

const buildModulesFromChapters = (course: Course): Course => {
  const chapters = course.chapters || [];
  const modules = chapters.map((chapter, chapterIndex) => {
    const lessons = (chapter.lessons || []).map((lesson, lessonIndex) => {
      const estimated = lesson.estimatedDuration ?? 0;
      return {
        ...lesson,
        order: lesson.order ?? lessonIndex + 1,
        chapterId: chapter.id,
        duration: lesson.duration || formatMinutes(estimated) || `${estimated} min`,
        content: {
          ...(lesson.content || {}),
        },
      };
    });

    const chapterMinutes = chapter.estimatedDuration ?? lessons.reduce((sum, item) => {
      return sum + (item.estimatedDuration || 0);
    }, 0);

    return {
      id: chapter.id,
      title: chapter.title,
      description: chapter.description,
      order: chapter.order ?? chapterIndex + 1,
      lessons,
      duration: formatMinutes(chapterMinutes) || `${chapterMinutes} min`,
    };
  });

  const totalMinutes = chapters.reduce((sum, chapter) => sum + (chapter.estimatedDuration || 0), 0);
  const totalLessons = modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0);

  return {
    ...course,
    modules,
    chapters,
    estimatedDuration: totalMinutes,
    duration: formatMinutes(totalMinutes) || `${totalMinutes} min`,
    lessons: totalLessons,
  };
};

const validateCourse = (course: Course): string[] => {
  const issues: string[] = [];
  if (!course.title || course.title.trim().length === 0) {
    issues.push('Course title is required.');
  }
  if (!course.description || course.description.trim().length < 20) {
    issues.push('Course description should be at least 20 characters.');
  }
  if (!course.chapters || course.chapters.length === 0) {
    issues.push('Add at least one chapter before saving.');
  } else {
    course.chapters.forEach((chapter, chapterIndex) => {
      if (!chapter.title || chapter.title.trim().length === 0) {
        issues.push(`Chapter ${chapterIndex + 1} needs a title.`);
      }
      if (!chapter.lessons || chapter.lessons.length === 0) {
        issues.push(`Chapter ${chapterIndex + 1} must include at least one lesson.`);
      } else {
        chapter.lessons.forEach((lesson, lessonIndex) => {
          if (!lesson.title || lesson.title.trim().length === 0) {
            issues.push(`Lesson ${lessonIndex + 1} in "${chapter.title}" needs a title.`);
          }
          if (lesson.type === 'video' && !lesson.content?.videoUrl) {
            issues.push(`Lesson "${lesson.title}" requires a video URL.`);
          }
          if (lesson.type === 'text' && !(lesson.content?.textContent || lesson.content?.content)) {
            issues.push(`Lesson "${lesson.title}" requires text content.`);
          }
        });
      }
    });
  }
  return Array.from(new Set(issues));
};

const AdvancedCourseBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isEditing = courseId !== 'new';
  const { showToast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'settings' | 'analytics'>('overview');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const lastPersistedRef = useRef<Course | null>(null);

  useEffect(() => {
    if (isEditing && courseId) {
      const existingCourse = courseManagementStore.getCourse(courseId);
      if (existingCourse) {
        const normalized = recalculateCourseDurations(existingCourse);
        const draft = readDraftCourse(courseId);
        setCourse(draft ? mergeDraft(normalized, draft) : normalized);
        return;
      }

      const resolved =
        typeof courseStore.resolveCourse === 'function'
          ? courseStore.resolveCourse(courseId) || courseStore.getCourse(courseId)
          : courseStore.getCourse(courseId);

      if (resolved) {
        const editableCourse = convertModulesToChapters(resolved);
        courseManagementStore.setCourse(editableCourse);
        const draft = readDraftCourse(resolved.id);
        const initialCourse = draft ? mergeDraft(editableCourse, draft) : editableCourse;
        setCourse(initialCourse);
        lastPersistedRef.current = initialCourse;
      } else {
        showToast('We could not find that course. Redirecting back to the course list.', 'error');
        navigate('/admin/courses');
      }
    } else {
      const newCourse = courseManagementStore.createCourse({
        title: 'New Course',
        description: 'Add a compelling course description to help learners prepare.',
      });
      const normalized = recalculateCourseDurations(newCourse);
      const initialDraft = buildModulesFromChapters({
        ...normalized,
        status: 'draft',
        updatedAt: new Date().toISOString(),
      });
      courseManagementStore.setCourse(initialDraft);
      setCourse(initialDraft);
      lastPersistedRef.current = initialDraft;
      writeDraftCourse(initialDraft.id, initialDraft);
      queueRemoteDraftSync(initialDraft);
    }
  }, [courseId, isEditing, navigate, showToast]);

  useEffect(() => {
    if (course) {
      courseManagementStore.setCourse(course);
    }
  }, [course]);

  const scheduleAutosave = (snapshot: Course | null) => {
    if (!snapshot) return;

    const draftPayload = buildModulesFromChapters(
      recalculateCourseDurations({
        ...snapshot,
        status: snapshot.status === 'published' ? snapshot.status : 'draft',
        updatedAt: new Date().toISOString(),
      })
    );

    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      writeDraftCourse(draftPayload.id, draftPayload);
      queueRemoteDraftSync(draftPayload);
      autosaveTimeoutRef.current = null;
    }, AUTOSAVE_DELAY);
  };

  useEffect(() => {
    scheduleAutosave(course);
  }, [course?.title, course?.description, course?.chapters]);

  const validationErrors = useMemo(() => {
    if (!course) return [];
    return validateCourse(course);
  }, [course]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }

      if (course?.id) {
        const remoteTimer = remoteDraftTimers.get(course.id);
        if (remoteTimer) {
          window.clearTimeout(remoteTimer);
          remoteDraftTimers.delete(course.id);
        }
      }
    };
  }, [course?.id]);

  const persistCourse = async (statusOverride?: 'draft' | 'published') => {
    if (!course) return null;

    setIsLoading(true);
    try {
      const recalculated = recalculateCourseDurations(course);
      const slug = recalculated.slug || slugify(recalculated.title || recalculated.id);
      const status = statusOverride ?? recalculated.status ?? 'draft';
      const publishedAt =
        status === 'published'
          ? recalculated.publishedAt || new Date().toISOString()
          : recalculated.publishedAt;

      const courseForStore = buildModulesFromChapters({
        ...recalculated,
        slug,
        status,
        publishedAt,
        createdAt: recalculated.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const diff = computeCourseDiff(lastPersistedRef.current, recalculated);

      if (!diff.hasChanges) {
        const storePayload = buildModulesFromChapters(recalculated);
        courseManagementStore.setCourse(storePayload);
        courseStore.saveCourse(storePayload, { skipRemoteSync: true });
        clearCourseCache();
        setCourse(recalculated);
        return storePayload;
      }

      let persistedSnapshot = null;
      try {
        persistedSnapshot = await CourseService.syncCourseToDatabase(courseForStore);
      } catch (error) {
        if (error instanceof CourseValidationError) {
          showToast(
            `Save blocked until the following issues are fixed: ${error.issues.join(' • ')}`,
            'error'
          );
          return null;
        }
        throw error;
      }

      const authoritativeCourse = recalculateCourseDurations(
        persistedSnapshot ? convertModulesToChapters(persistedSnapshot as Course) : recalculated
      );

      const storePayload = buildModulesFromChapters(authoritativeCourse);
      courseManagementStore.setCourse(storePayload);
      courseStore.saveCourse(storePayload, { skipRemoteSync: true });
      clearCourseCache();

      setCourse(authoritativeCourse);
      lastPersistedRef.current = authoritativeCourse;

      return storePayload;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCourse = async () => {
    try {
      const saved = await persistCourse();
      if (saved) {
        showToast('Course changes saved.', 'success');
      }
    } catch (error) {
      console.error('Error saving course:', error);
      showToast('Something went wrong while saving. Please try again.', 'error');
    }
  };

  const handlePublishCourse = async () => {
    if (!course) return;

    const confirmed = confirm(
      'Publish this course? Learners assigned to it will immediately see the updated content.'
    );
    if (!confirmed) return;

    try {
      const published = await persistCourse('published');
      if (published) {
        showToast('Course published successfully.', 'success');
      }
    } catch (error) {
      console.error('Error publishing course:', error);
      showToast('We could not publish the course. Please try again.', 'error');
    }
  };

  const addChapter = () => {
    if (!course) return;
    setCourse((current) => {
      if (!current) return current;

      const chapterId = generateId('chapter');
      const newChapter: Chapter = {
        id: chapterId,
        courseId: current.id,
        title: `Chapter ${current.chapters.length + 1}`,
        description: 'New chapter description',
        order: current.chapters.length + 1,
        estimatedDuration: 0,
        lessons: [],
      };

      const nextCourse = recalculateCourseDurations({
        ...current,
        chapters: [...current.chapters, newChapter],
      });

      setExpandedChapters((prev) => new Set([...prev, chapterId]));
      return nextCourse;
    });
    showToast('Chapter added. Start adding lessons to build out the module.', 'success');
  };

  const addLesson = (
    chapterId: string,
    lessonType: 'video' | 'text' | 'quiz' | 'interactive'
  ) => {
    if (!course) return;
    setCourse((current) => {
      if (!current) return current;

      const chapterIndex = current.chapters.findIndex((chapter) => chapter.id === chapterId);
      if (chapterIndex === -1) return current;

      const lessonId = generateId('lesson');
      const newLesson: Lesson = {
        id: lessonId,
        chapterId,
        title: `New ${lessonType.charAt(0).toUpperCase() + lessonType.slice(1)} Lesson`,
        description: `${lessonType} lesson description`,
        type: lessonType,
        order: current.chapters[chapterIndex].lessons.length + 1,
        estimatedDuration: lessonType === 'quiz' ? 10 : 15,
        content: {},
        isRequired: true,
        resources: [],
      };

      const updatedChapters = current.chapters.map((chapter, index) => {
        if (index !== chapterIndex) return chapter;
        return {
          ...chapter,
          lessons: [...chapter.lessons, newLesson],
        };
      });

      const recalculated = recalculateCourseDurations({
        ...current,
        chapters: updatedChapters,
      });

      setEditingLesson(lessonId);
      return recalculated;
    });
    showToast('Lesson added. Update the details below to make it learner-ready.', 'info');
  };

  const toggleChapterExpansion = (chapterId: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  const handleCourseInfoUpdate = (field: string, value: any) => {
    if (!course) return;
    
    const updatedCourse = { ...course, [field]: value };
    setCourse(updatedCourse);
  };

  const updateLesson = (
    chapterId: string,
    lessonId: string,
    updates: LessonUpdate
  ) => {
    setCourse((current) => {
      if (!current) return current;

      const updatedChapters = current.chapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;

        const updatedLessons = chapter.lessons.map((lesson) => {
          if (lesson.id !== lessonId) return lesson;

          const nextContent = updates.content
            ? { ...(lesson.content || {}), ...updates.content }
            : lesson.content;

          const estimatedDuration =
            updates.estimatedDuration !== undefined
              ? updates.estimatedDuration
              : lesson.estimatedDuration;

          return {
            ...lesson,
            ...updates,
            estimatedDuration,
            content: nextContent || {},
          };
        });

        return {
          ...chapter,
          lessons: updatedLessons,
        };
      });

      return recalculateCourseDurations({
        ...current,
        chapters: updatedChapters,
      });
    });
  };

  const deleteLesson = (chapterId: string, lessonId: string) => {
    if (!course) return;
    setCourse((current) => {
      if (!current) return current;

      const updatedChapters = current.chapters.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        const filteredLessons = chapter.lessons
          .filter((lesson) => lesson.id !== lessonId)
          .map((lesson, index) => ({
            ...lesson,
            order: index + 1,
          }));

        return {
          ...chapter,
          lessons: filteredLessons,
        };
      });

      const recalculated = recalculateCourseDurations({
        ...current,
        chapters: updatedChapters,
      });

      setEditingLesson((prev) => (prev === lessonId ? null : prev));
      return recalculated;
    });
    showToast('Lesson removed from the course.', 'success');
  };

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/admin/courses')}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back to Courses
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  course.status === 'published' 
                    ? 'bg-green-100 text-green-800' 
                    : course.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {course.status}
                </span>
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {course.estimatedDuration} min
                </span>
                <span className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {course.enrollmentCount} enrolled
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </button>
            
            <LoadingButton
              onClick={handleSaveCourse}
              isLoading={isLoading}
              variant="secondary"
              className="flex items-center"
              disabled={validationErrors.length > 0}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </LoadingButton>

            {course.status !== 'published' && (
              <LoadingButton
                onClick={handlePublishCourse}
                isLoading={isLoading}
                variant="success"
                className="flex items-center"
                disabled={validationErrors.length > 0}
              >
                <Award className="w-4 h-4 mr-2" />
                Publish
              </LoadingButton>
            )}
      </div>
    </div>

    {validationErrors.length > 0 && (
      <div className="mx-6 mt-4 rounded-lg border border-deepred/30 bg-deepred/10 px-4 py-3 text-sm text-deepred">
        <p className="font-semibold">Resolve the following before saving:</p>
        <ul className="mt-2 space-y-1 list-disc pl-5">
          {validationErrors.slice(0, 4).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
          {validationErrors.length > 4 && (
            <li>+ {validationErrors.length - 4} more issue(s)...</li>
          )}
        </ul>
      </div>
    )}

    {/* Tabs */}
        <div className="mt-4">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BookOpen },
              { id: 'content', label: 'Content', icon: PlayCircle },
              { id: 'settings', label: 'Settings', icon: Settings },
              { id: 'analytics', label: 'Analytics', icon: Users },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-3 py-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="flex-1 px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewTab course={course} onUpdate={handleCourseInfoUpdate} />
        )}
        
        {activeTab === 'content' && (
          <ContentTab
            course={course}
            expandedChapters={expandedChapters}
            onToggleChapter={toggleChapterExpansion}
            onAddChapter={addChapter}
            onAddLesson={addLesson}
            onEditLesson={setEditingLesson}
            onUpdateLesson={updateLesson}
            onDeleteLesson={deleteLesson}
            onCloseLessonEditor={() => setEditingLesson(null)}
            editingLesson={editingLesson}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab course={course} onUpdate={handleCourseInfoUpdate} />
        )}

        {activeTab === 'analytics' && course.status === 'published' && (
          <AnalyticsTab courseId={course.id} />
        )}
      </div>

      {/* Course Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Course Preview"
        maxWidth="2xl"
      >
        <div className="p-4">
          <CoursePreview course={course} />
        </div>
      </Modal>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{ course: Course; onUpdate: (field: string, value: any) => void }> = ({
  course,
  onUpdate
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Course Information</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course Title
            </label>
            <input
              type="text"
              value={course.title}
              onChange={(e) => onUpdate('title', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter course title"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={course.description}
              onChange={(e) => onUpdate('description', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Describe what learners will gain from this course"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={course.category}
              onChange={(e) => onUpdate('category', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Leadership">Leadership</option>
              <option value="Safety & Compliance">Safety & Compliance</option>
              <option value="Technology">Technology</option>
              <option value="Professional Development">Professional Development</option>
              <option value="Soft Skills">Soft Skills</option>
              <option value="Technical Skills">Technical Skills</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <select
              value={course.difficulty}
              onChange={(e) => onUpdate('difficulty', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language
            </label>
            <select
              value={course.language}
              onChange={(e) => onUpdate('language', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Duration (minutes)
            </label>
            <input
              type="number"
              value={course.estimatedDuration}
              onChange={(e) => onUpdate('estimatedDuration', parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              min="1"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Learning Objectives
          </label>
          <LearningObjectivesEditor
            objectives={course.learningObjectives}
            onChange={(objectives) => onUpdate('learningObjectives', objectives)}
          />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Course Thumbnail
          </label>
          <ThumbnailUploader
            currentThumbnail={course.thumbnail}
            onChange={(thumbnail) => onUpdate('thumbnail', thumbnail)}
          />
        </div>
      </div>
    </div>
  );
};

// Content Tab Component
const ContentTab: React.FC<{
  course: Course;
  expandedChapters: Set<string>;
  onToggleChapter: (chapterId: string) => void;
  onAddChapter: () => void;
  onAddLesson: (chapterId: string, type: 'video' | 'text' | 'quiz' | 'interactive') => void;
  onEditLesson: (lessonId: string) => void;
  onUpdateLesson: (chapterId: string, lessonId: string, updates: LessonUpdate) => void;
  onDeleteLesson: (chapterId: string, lessonId: string) => void;
  onCloseLessonEditor: () => void;
  editingLesson: string | null;
}> = ({
  course,
  expandedChapters,
  onToggleChapter,
  onAddChapter,
  onAddLesson,
  onEditLesson,
  onUpdateLesson,
  onDeleteLesson,
  onCloseLessonEditor,
  editingLesson
}) => {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
        <button
          onClick={onAddChapter}
          className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Chapter
        </button>
      </div>

      <div className="space-y-4">
        {course.chapters.map((chapter, chapterIndex) => (
          <ChapterEditor
            key={chapter.id}
            chapter={chapter}
            index={chapterIndex}
            isExpanded={expandedChapters.has(chapter.id)}
            onToggleExpanded={() => onToggleChapter(chapter.id)}
            onAddLesson={(type) => onAddLesson(chapter.id, type)}
            onEditLesson={onEditLesson}
            onUpdateLesson={(lessonId, updates) => onUpdateLesson(chapter.id, lessonId, updates)}
            onDeleteLesson={(lessonId) => onDeleteLesson(chapter.id, lessonId)}
            onCloseLessonEditor={onCloseLessonEditor}
            editingLesson={editingLesson}
          />
        ))}

        {course.chapters.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No chapters yet</h3>
            <p className="text-gray-600 mb-4">Start building your course by adding the first chapter.</p>
            <button
              onClick={onAddChapter}
              className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Chapter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Settings Tab Component
const SettingsTab: React.FC<{ course: Course; onUpdate: (field: string, value: any) => void }> = ({
  course,
  onUpdate
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Accessibility Settings</h2>
        
        <div className="space-y-4">
          <AccessibilityOption
            title="Closed Captions"
            description="Provide text captions for video content"
            checked={course.accessibilityFeatures.hasClosedCaptions}
            onChange={(checked) => onUpdate('accessibilityFeatures', {
              ...course.accessibilityFeatures,
              hasClosedCaptions: checked
            })}
          />
          
          <AccessibilityOption
            title="Transcripts"
            description="Provide full text transcripts for all media"
            checked={course.accessibilityFeatures.hasTranscripts}
            onChange={(checked) => onUpdate('accessibilityFeatures', {
              ...course.accessibilityFeatures,
              hasTranscripts: checked
            })}
          />

          <AccessibilityOption
            title="Audio Descriptions"
            description="Include audio descriptions for visual content"
            checked={course.accessibilityFeatures.hasAudioDescription}
            onChange={(checked) => onUpdate('accessibilityFeatures', {
              ...course.accessibilityFeatures,
              hasAudioDescription: checked
            })}
          />
        </div>
      </div>

      <CertificateSettings course={course} onUpdate={onUpdate} />
    </div>
  );
};

// Analytics Tab Component  
const AnalyticsTab: React.FC<{ courseId: string }> = ({ courseId }) => {
  const analytics = courseManagementStore.getCourseAnalytics(courseId);

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data yet</h3>
        <p className="text-gray-600">Analytics will appear once learners start engaging with your course.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <CourseAnalyticsDashboard analytics={analytics} />
    </div>
  );
};

// Helper Components
const LearningObjectivesEditor: React.FC<{
  objectives: string[];
  onChange: (objectives: string[]) => void;
}> = ({ objectives, onChange }) => {
  const addObjective = () => {
    onChange([...objectives, '']);
  };

  const updateObjective = (index: number, value: string) => {
    const updated = [...objectives];
    updated[index] = value;
    onChange(updated);
  };

  const removeObjective = (index: number) => {
    onChange(objectives.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {objectives.map((objective, index) => (
        <div key={index} className="flex items-center space-x-2">
          <input
            type="text"
            value={objective}
            onChange={(e) => updateObjective(index, e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Enter learning objective"
          />
          <button
            onClick={() => removeObjective(index)}
            className="p-2 text-red-600 hover:text-red-800"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addObjective}
        className="flex items-center px-3 py-2 text-orange-600 hover:text-orange-800"
      >
        <Plus className="w-4 h-4 mr-1" />
        Add Objective
      </button>
    </div>
  );
};

const ThumbnailUploader: React.FC<{
  currentThumbnail: string;
  onChange: (thumbnail: string) => void;
}> = ({ currentThumbnail, onChange }) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, you'd upload to a service and get back a URL
      const fakeUrl = URL.createObjectURL(file);
      onChange(fakeUrl);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <img
        src={currentThumbnail}
        alt="Course thumbnail"
        className="w-24 h-16 object-cover rounded-lg border border-gray-300"
      />
      <label className="cursor-pointer flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        <Upload className="w-4 h-4 mr-2" />
        Upload New
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>
    </div>
  );
};

const ChapterEditor: React.FC<{
  chapter: Chapter;
  index: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onAddLesson: (type: 'video' | 'text' | 'quiz' | 'interactive') => void;
  onEditLesson: (lessonId: string) => void;
  onUpdateLesson: (lessonId: string, updates: LessonUpdate) => void;
  onDeleteLesson: (lessonId: string) => void;
  onCloseLessonEditor: () => void;
  editingLesson: string | null;
}> = ({
  chapter,
  index,
  isExpanded,
  onToggleExpanded,
  onAddLesson,
  onEditLesson,
  onUpdateLesson,
  onDeleteLesson,
  onCloseLessonEditor,
  editingLesson,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onToggleExpanded}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <div>
              <h3 className="font-medium text-gray-900">
                Chapter {index + 1}: {chapter.title}
              </h3>
              <p className="text-sm text-gray-600">
                {chapter.lessons.length} lessons • {chapter.estimatedDuration} min
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-600 hover:text-gray-800">
              <Edit3 className="w-4 h-4" />
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-800">
              <Move className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          <div className="space-y-3 mb-4">
            {chapter.lessons.map((lesson, lessonIndex) => (
              <LessonItem
                key={lesson.id}
                lesson={lesson}
                index={lessonIndex}
                isEditing={editingLesson === lesson.id}
                onEdit={() => onEditLesson(lesson.id)}
                onUpdate={(updates) => onUpdateLesson(lesson.id, updates)}
                onDelete={() => onDeleteLesson(lesson.id)}
                onClose={onCloseLessonEditor}
              />
            ))}
          </div>

          <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-600">Add lesson:</span>
            <button
              onClick={() => onAddLesson('video')}
              className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
            >
              <Video className="w-3 h-3 mr-1" />
              Video
            </button>
            <button
              onClick={() => onAddLesson('text')}
              className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200"
            >
              <FileText className="w-3 h-3 mr-1" />
              Text
            </button>
            <button
              onClick={() => onAddLesson('quiz')}
              className="flex items-center px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200"
            >
              <HelpCircle className="w-3 h-3 mr-1" />
              Quiz
            </button>
            <button
              onClick={() => onAddLesson('interactive')}
              className="flex items-center px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200"
            >
              <Settings className="w-3 h-3 mr-1" />
              Interactive
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LessonItem: React.FC<{
  lesson: Lesson;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: LessonUpdate) => void;
  onDelete: () => void;
  onClose: () => void;
}> = ({ lesson, index, isEditing, onEdit, onUpdate, onDelete, onClose }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4 text-blue-600" />;
      case 'text': return <FileText className="w-4 h-4 text-green-600" />;
      case 'quiz': return <HelpCircle className="w-4 h-4 text-purple-600" />;
      case 'interactive': return <Settings className="w-4 h-4 text-orange-600" />;
      default: return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleDelete = () => {
    const confirmed = confirm('Remove this lesson? This action cannot be undone.');
    if (confirmed) {
      onDelete();
    }
  };

  const handleDurationChange = (value: string) => {
    const minutes = Math.max(0, Number.parseInt(value, 10) || 0);
    onUpdate({ estimatedDuration: minutes });
  };

  if (isEditing) {
    const videoUrl = lesson.content?.videoUrl || '';
    const transcript = lesson.content?.transcript || '';
    const textContent = lesson.content?.textContent || lesson.content?.content || '';
    const interactiveUrl = lesson.content?.interactiveUrl || '';

    return (
      <div className="space-y-4 rounded-lg border border-orange-400 bg-orange-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getTypeIcon(lesson.type)}
            <span className="text-sm font-semibold text-orange-700">
              Editing: Lesson {index + 1}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-sm font-medium text-orange-700 hover:text-orange-900"
          >
            Done
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-orange-800">
              Lesson title
            </label>
            <input
              type="text"
              value={lesson.title}
              onChange={(event) => onUpdate({ title: event.target.value })}
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="Enter lesson title"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-orange-800">
              Description
            </label>
            <textarea
              value={lesson.description || ''}
              onChange={(event) => onUpdate({ description: event.target.value })}
              rows={3}
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="What should learners expect from this lesson?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-orange-800">
              Estimated duration (minutes)
            </label>
            <input
              type="number"
              min={0}
              value={lesson.estimatedDuration ?? 0}
              onChange={(event) => handleDurationChange(event.target.value)}
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id={`lesson-required-${lesson.id}`}
              type="checkbox"
              checked={lesson.isRequired !== false}
              onChange={(event) => onUpdate({ isRequired: event.target.checked })}
              className="h-4 w-4 rounded border-orange-200 text-orange-600 focus:ring-orange-400"
            />
            <label
              htmlFor={`lesson-required-${lesson.id}`}
              className="text-sm text-orange-800"
            >
              Required for course completion
            </label>
          </div>

            {lesson.type === 'video' && (
              <>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-orange-800">
                    Video URL
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(event) =>
                      onUpdate({
                        content: {
                          videoUrl: event.target.value.trim(),
                          videoSourceType: event.target.value ? 'external' : undefined,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="https://"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-orange-800">
                    Transcript (optional)
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(event) =>
                      onUpdate({ content: { transcript: event.target.value } })
                    }
                    rows={3}
                    className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="Paste a transcript or summary learners can read."
                  />
                </div>
              </>
            )}

            {lesson.type === 'text' && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wide text-orange-800">
                  Lesson body
                </label>
                <textarea
                  value={textContent}
                  onChange={(event) =>
                    onUpdate({ content: { textContent: event.target.value, content: event.target.value } })
                  }
                  rows={6}
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="Write or paste the lesson content."
                />
              </div>
            )}

            {lesson.type === 'interactive' && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wide text-orange-800">
                  Interactive content URL
                </label>
                <input
                  type="url"
                  value={interactiveUrl}
                  onChange={(event) =>
                    onUpdate({ content: { interactiveUrl: event.target.value.trim() } })
                  }
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="https://"
                />
              </div>
            )}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Delete lesson
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100"
            >
              Done editing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 border rounded-lg transition-colors ${
      isEditing ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {getTypeIcon(lesson.type)}
            <span className="text-sm font-medium text-gray-900">
              {index + 1}. {lesson.title}
            </span>
          </div>
          <span className="text-xs text-gray-500">{lesson.estimatedDuration} min</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onEdit}
            className="p-1 text-gray-600 hover:text-gray-800"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button className="p-1 text-gray-600 hover:text-gray-800">
            <Copy className="w-3 h-3" />
          </button>
          <button className="p-1 text-gray-600 hover:text-gray-800">
            <Move className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Placeholder components that would be fully implemented
const CoursePreview: React.FC<{ course: Course }> = ({ course }) => (
  <div className="text-center py-8">
    <h3 className="text-lg font-medium mb-2">{course.title}</h3>
    <p className="text-gray-600">Course preview would show the learner experience here.</p>
  </div>
);

const AccessibilityOption: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
    <div>
      <h4 className="font-medium text-gray-900">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
    />
  </div>
);

const CertificateSettings: React.FC<{ course: Course; onUpdate: (field: string, value: any) => void }> = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Certificate Settings</h2>
    <p className="text-gray-600">Certificate configuration options would go here.</p>
  </div>
);

const CourseAnalyticsDashboard: React.FC<{ analytics: any }> = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Analytics</h2>
    <p className="text-gray-600">Detailed analytics dashboard would be implemented here.</p>
  </div>
);

export default AdvancedCourseBuilder;
