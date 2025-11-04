import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { courseStore, generateId, calculateCourseDuration, countTotalLessons } from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError, loadCourseFromDatabase } from '../../dal/courses';
import { computeCourseDiff } from '../../utils/courseDiff';
import type { NormalizedCourse } from '../../utils/courseNormalization';
import { mergePersistedCourse, formatMinutesLabel } from '../../utils/adminCourseMerge';
import type { Course, Module, Lesson } from '../../types/courseTypes';
import { supabase } from '../../lib/supabase';
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
  Loader
} from 'lucide-react';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import LivePreview from '../../components/LivePreview';
import AIContentAssistant from '../../components/AIContentAssistant';
// import DragDropItem from '../../components/DragDropItem'; // TODO: Implement drag drop functionality
import VersionControl from '../../components/VersionControl';


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
  const lastPersistedRef = useRef<Course | null>(null);
  const [initializing, setInitializing] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastLoadedCourseIdRef = useRef<string | null>(null);

  const [searchParams] = useSearchParams();
  const [highlightLessonId, setHighlightLessonId] = useState<string | null>(null);

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
    if (!isEditing || !courseId) {
      setLoadError(prev => (prev ? null : prev));
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
      try {
        const existing = courseStore.getCourse(courseId);
        if (existing) {
          if (cancelled) return;
          setCourse(existing);
          lastPersistedRef.current = existing;
          lastLoadedCourseIdRef.current = courseId;
          setLoadError(null);
          return;
        }

        const remote = await loadCourseFromDatabase(courseId, { includeDrafts: true });
        if (cancelled) return;

        if (remote) {
          setCourse(prev => {
            const merged = mergePersistedCourse(prev, remote);
            courseStore.saveCourse(merged, { skipRemoteSync: true });
            lastPersistedRef.current = merged;
            return merged;
          });
          lastLoadedCourseIdRef.current = courseId;
          setLoadError(null);
        } else {
          setLoadError('Unable to locate this course in the database. Editing local draft only.');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load course details:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        setLoadError(`Failed to load course details: ${message}`);
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
  }, [isEditing, courseId]);

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

  // Drag and drop handlers - TODO: Implement drag and drop functionality
  /*
  const reorderModules = (dragIndex: number, hoverIndex: number) => {
    const modules = [...(course.modules || [])];
    const draggedModule = modules[dragIndex];
    
    modules.splice(dragIndex, 1);
    modules.splice(hoverIndex, 0, draggedModule);
    
    // Update order properties
    const reorderedModules = modules.map((module, index) => ({
      ...module,
      order: index + 1
    }));
    
    setCourse(prev => ({
      ...prev,
      modules: reorderedModules
    }));
  };

  const reorderLessons = (moduleId: string, dragIndex: number, hoverIndex: number) => {
    setCourse(prev => ({
      ...prev,
      modules: prev.modules?.map(module => {
        if (module.id === moduleId) {
          const lessons = [...module.lessons];
          const draggedLesson = lessons[dragIndex];
          
          lessons.splice(dragIndex, 1);
          lessons.splice(hoverIndex, 0, draggedLesson);
          
          // Update order properties
          const reorderedLessons = lessons.map((lesson, index) => ({
            ...lesson,
            order: index + 1
          }));
          
          return { ...module, lessons: reorderedLessons };
        }
        return module;
      }) || []
    }));
  };
  */

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
      
      // Reset to idle after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
      
      if (isNewCourseRoute) {
        navigate(`/admin/course-builder/${updatedCourse.id}`);
      }
    } catch (error) {
      if (error instanceof CourseValidationError) {
        console.warn('⚠️ Course validation issues:', error.issues);
      } else {
        console.error('❌ Error saving course:', error);
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
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      if (error instanceof CourseValidationError) {
        console.warn('⚠️ Course validation issues:', error.issues);
      } else {
        console.error('❌ Error publishing course:', error);
      }
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  const handleAssignmentComplete = () => {
    setShowAssignmentModal(false);
    // Optionally refresh course data or show success message
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
    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      setUploadError(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 50MB limit. Please compress your video or use a smaller file.`);
      return;
    }

    const uploadKey = `${moduleId}-${lessonId}`;
    
    try {
      setUploadingVideos(prev => ({ ...prev, [uploadKey]: true }));
      setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

      // Create unique filename
      const fileExt = file.name.split('.').pop();
  const fileName = `${course.id}/${moduleId}/${lessonId}.${fileExt}`;

      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from('course-videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('course-videos')
        .getPublicUrl(fileName);

      // Update lesson content with video URL
      updateLesson(moduleId, lessonId, {
        content: {
          ...course.modules?.find(m => m.id === moduleId)?.lessons.find(l => l.id === lessonId)?.content,
          videoUrl: publicUrl,
          fileName: file.name,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        }
      });

      setUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
      
    } catch (error) {
      console.error('Error uploading video:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setUploadError(`Upload failed: ${errorMessage}. This could be due to network issues or file format. Please check your connection and try again.`);
    } finally {
      setUploadingVideos(prev => ({ ...prev, [uploadKey]: false }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
      }, 2000);
    }
  };

  const handleFileUpload = async (moduleId: string, lessonId: string, file: File) => {
    const uploadKey = `${moduleId}-${lessonId}`;
    
    try {
      setUploadingVideos(prev => ({ ...prev, [uploadKey]: true }));

      // Create unique filename
      const fileExt = file.name.split('.').pop();
  const fileName = `${course.id}/${moduleId}/${lessonId}-resource.${fileExt}`;

      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from('course-resources')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('course-resources')
        .getPublicUrl(fileName);

      // Update lesson content with file URL
      updateLesson(moduleId, lessonId, {
        content: {
          ...course.modules?.find(m => m.id === moduleId)?.lessons.find(l => l.id === lessonId)?.content,
          fileUrl: publicUrl,
          fileName: file.name,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        }
      });
      
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingVideos(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const toggleModuleExpansion = (moduleId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const renderLessonEditor = (moduleId: string, lesson: Lesson) => {
    const isEditing = editingLesson?.moduleId === moduleId && editingLesson?.lessonId === lesson.id;
    const uploadKey = `${moduleId}-${lesson.id}`;
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
                {lesson.content.videoUrl && (
                  <span className="text-green-600 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Video uploaded
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/admin/courses" 
          className="inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course Management
        </Link>

        {loadError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {loadError}
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
          
          <div className="flex items-center space-x-3">
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
            
            {/* Auto-save status indicator */}
            {lastSaveTime && saveStatus === 'idle' && (
              <span className="text-sm text-gray-500 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                Auto-saved at {lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
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
              onClick={() => {
                if (!confirm('Delete this course? This action cannot be undone.')) return;
                try {
                  courseStore.deleteCourse(course.id);
                  navigate('/admin/courses');
                } catch (err) {
                  console.warn('Delete failed', err);
                }
              }}
              className="border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors duration-200 flex items-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
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
            <div className="space-y-6">
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
                {(course.modules || []).map((module, _moduleIndex) => (
                  <div key={module.id} className="border border-gray-200 rounded-lg">
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
                          {module.lessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              id={`lesson-${lesson.id}`}
                              className={highlightLessonId === lesson.id ? 'transition-all duration-300 ring-2 ring-orange-300 bg-orange-50 rounded-md p-1' : ''}
                            >
                              {renderLessonEditor(module.id, lesson)}
                            </div>
                          ))}
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
                ))}

                {(course.modules || []).length === 0 && (
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

      {/* Course Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Course Preview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <img 
              src={course.thumbnail} 
              alt={course.title}
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{course.title || 'Course Title'}</h3>
            <p className="text-gray-600 mb-4">{course.description || 'Course description will appear here...'}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {calculateCourseDuration(course.modules || [])}
              </span>
              <span className="flex items-center">
                <BookOpen className="h-4 w-4 mr-1" />
                {countTotalLessons(course.modules || [])} lessons
              </span>
              <span className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {course.difficulty}
              </span>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Learning Objectives:</h4>
            <ul className="space-y-2 mb-6">
              {(course.learningObjectives || []).slice(0, 3).map((objective, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <Target className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{objective || 'Learning objective...'}</span>
                </li>
              ))}
              {(course.learningObjectives || []).length > 3 && (
                <li className="text-sm text-gray-500">+{(course.learningObjectives || []).length - 3} more objectives</li>
              )}
            </ul>
            
            <div className="flex flex-wrap gap-2">
              {(course.tags || []).map((tag, index) => (
                <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default AdminCourseBuilder;
