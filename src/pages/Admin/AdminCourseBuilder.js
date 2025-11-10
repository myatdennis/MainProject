import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { courseStore, generateId, calculateCourseDuration, countTotalLessons } from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError, loadCourseFromDatabase } from '../../dal/courses';
import { computeCourseDiff } from '../../utils/courseDiff';
import { mergePersistedCourse } from '../../utils/adminCourseMerge';
import { getSupabase } from '../../lib/supabase';
import { getVideoEmbedUrl } from '../../utils/videoUtils';
import { ArrowLeft, Save, Plus, Trash2, Edit, Eye, Upload, Download, Video, FileText, MessageSquare, CheckCircle, Clock, Users, BookOpen, Target, Settings, X, ChevronUp, ChevronDown, Copy, Loader } from 'lucide-react';
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
    const [course, setCourse] = useState(() => {
        if (isEditing && courseId) {
            const existingCourse = courseStore.getCourse(courseId);
            return existingCourse || createEmptyCourse(courseId);
        }
        return createEmptyCourse();
    });
    const [activeTab, setActiveTab] = useState('overview');
    const [expandedModules, setExpandedModules] = useState({});
    const [editingLesson, setEditingLesson] = useState(null);
    const [uploadingVideos, setUploadingVideos] = useState({});
    const [uploadProgress, setUploadProgress] = useState({});
    const [uploadError, setUploadError] = useState(null);
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const lastPersistedRef = useRef(null);
    const [initializing, setInitializing] = useState(isEditing);
    const [loadError, setLoadError] = useState(null);
    const lastLoadedCourseIdRef = useRef(null);
    const [searchParams] = useSearchParams();
    const [highlightLessonId, setHighlightLessonId] = useState(null);
    useEffect(() => {
        const moduleQ = searchParams.get('module');
        const lessonQ = searchParams.get('lesson');
        if (!moduleQ || !lessonQ)
            return;
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
                if (el)
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                    if (cancelled)
                        return;
                    setCourse(existing);
                    lastPersistedRef.current = existing;
                    lastLoadedCourseIdRef.current = courseId;
                    setLoadError(null);
                    return;
                }
                const remote = await loadCourseFromDatabase(courseId, { includeDrafts: true });
                if (cancelled)
                    return;
                if (remote) {
                    setCourse(prev => {
                        const merged = mergePersistedCourse(prev, remote);
                        courseStore.saveCourse(merged, { skipRemoteSync: true });
                        lastPersistedRef.current = merged;
                        return merged;
                    });
                    lastLoadedCourseIdRef.current = courseId;
                    setLoadError(null);
                }
                else {
                    setLoadError('Unable to locate this course in the database. Editing local draft only.');
                }
            }
            catch (error) {
                if (cancelled)
                    return;
                console.error('Failed to load course details:', error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                setLoadError(`Failed to load course details: ${message}`);
            }
            finally {
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
        const handleKeyDown = (event) => {
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
                        videoLessons: course.modules?.reduce((count, module) => count + module.lessons.filter(lesson => lesson.type === 'video' && lesson.content?.videoUrl).length, 0) || 0
                    });
                    // Update local state with calculated fields
                    if (course.duration !== updatedCourse.duration || course.lessons !== updatedCourse.lessons) {
                        setCourse(updatedCourse);
                    }
                }
                catch (error) {
                    console.error('❌ Auto-save failed:', error);
                }
            }, 1500);
            return () => clearTimeout(timeoutId);
        }
    }, [course]);
    // Debounced remote auto-sync (single upsert). Runs only when there are real changes vs lastPersistedRef.
    useEffect(() => {
        if (!course.id || !course.title?.trim())
            return;
        // Avoid overlapping autosaves
        if (autoSaveLockRef.current)
            return;
        // Check if there are changes since last persist
        const diff = computeCourseDiff(lastPersistedRef.current, course);
        if (!diff.hasChanges)
            return;
        if (autoSaveTimerRef.current)
            clearTimeout(autoSaveTimerRef.current);
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
            }
            catch (err) {
                console.error('❌ Remote auto-sync failed:', err);
                setSaveStatus('error');
                setTimeout(() => setSaveStatus('idle'), 4000);
            }
            finally {
                autoSaveLockRef.current = false;
            }
        }, 1000);
        return () => {
            if (autoSaveTimerRef.current)
                clearTimeout(autoSaveTimerRef.current);
        };
    }, [course]);
    // Course validation function
    const validateCourse = (course) => {
        const issues = [];
        // Basic course info validation
        if (!course.title?.trim())
            issues.push('Course title is required');
        if (!course.description?.trim())
            issues.push('Course description is required');
        if (!course.modules || course.modules.length === 0)
            issues.push('At least one module is required');
        // Module and lesson validation
        course.modules?.forEach((module, mIndex) => {
            if (!module.title?.trim())
                issues.push(`Module ${mIndex + 1}: Title is required`);
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
    function createEmptyCourse(initialCourseId) {
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
    const [saveStatus, setSaveStatus] = useState('idle');
    const [lastSaveTime, setLastSaveTime] = useState(null);
    const autoSaveTimerRef = useRef(null);
    const autoSaveLockRef = useRef(false);
    // Inline editing state
    const [inlineEditing, setInlineEditing] = useState(null);
    // Live preview state
    const [showPreview, setShowPreview] = useState(false);
    // AI Assistant handlers
    const handleApplySuggestion = (suggestion) => {
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
                        lessons: module.lessons.map(lesson => lesson.type === 'video'
                            ? { ...lesson, content: { ...lesson.content, transcript: 'Transcript will be automatically generated...' } }
                            : lesson)
                    })) || []
                }));
                break;
            case 'performance-lazy-load':
                // This would be handled at the system level
                console.log('Performance optimization applied');
                break;
        }
    };
    const handleDismissSuggestion = (suggestionId) => {
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
    const handleRestoreVersion = (version) => {
        setCourse(version.course);
    };
    useEffect(() => {
        if (course && !lastPersistedRef.current) {
            lastPersistedRef.current = course;
        }
    }, [course]);
    const persistCourse = async (nextCourse, statusOverride) => {
        const preparedCourse = {
            ...nextCourse,
            status: statusOverride ?? nextCourse.status ?? 'draft',
            duration: calculateCourseDuration(nextCourse.modules || []),
            lessons: countTotalLessons(nextCourse.modules || []),
            lastUpdated: new Date().toISOString(),
            publishedDate: statusOverride === 'published'
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
        }
        catch (error) {
            if (error instanceof CourseValidationError) {
                console.warn('⚠️ Course validation issues:', error.issues);
            }
            else {
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
                status: 'published',
                publishedDate: new Date().toISOString(),
                duration: calculateCourseDuration(course.modules || []),
                lessons: countTotalLessons(course.modules || []),
                lastUpdated: new Date().toISOString()
            };
            await persistCourse(publishedCourse, 'published');
            setSaveStatus('saved');
            setLastSaveTime(new Date());
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
        catch (error) {
            if (error instanceof CourseValidationError) {
                console.warn('⚠️ Course validation issues:', error.issues);
            }
            else {
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
        const newModule = {
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
    const updateModule = (moduleId, updates) => {
        setCourse(prev => {
            const updatedCourse = {
                ...prev,
                modules: (prev.modules || []).map(module => module.id === moduleId ? { ...module, ...updates } : module)
            };
            // Save the updated course to localStorage
            courseStore.saveCourse(updatedCourse, { skipRemoteSync: true });
            return updatedCourse;
        });
    };
    const deleteModule = (moduleId) => {
        setCourse(prev => ({
            ...prev,
            modules: (prev.modules || []).filter(module => module.id !== moduleId)
        }));
    };
    const addLesson = (moduleId) => {
        const module = course.modules?.find(m => m.id === moduleId);
        if (!module)
            return;
        const newLesson = {
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
    const updateLesson = (moduleId, lessonId, updates) => {
        const module = course.modules?.find(m => m.id === moduleId);
        if (!module)
            return;
        const updatedLessons = module.lessons.map(lesson => lesson.id === lessonId ? { ...lesson, ...updates } : lesson);
        updateModule(moduleId, { lessons: updatedLessons });
    };
    const deleteLesson = (moduleId, lessonId) => {
        const module = course.modules?.find(m => m.id === moduleId);
        if (!module)
            return;
        updateModule(moduleId, {
            lessons: module.lessons.filter(lesson => lesson.id !== lessonId)
        });
    };
    const handleVideoUpload = async (moduleId, lessonId, file) => {
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
            // Try to upload to Supabase Storage if available
            const supabase = await getSupabase();
            if (supabase) {
                const { error } = await supabase.storage
                    .from('course-videos')
                    .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });
                if (error)
                    throw error;
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
            }
            else {
                // Fallback: Use a temporary object URL in demo mode
                const objectUrl = URL.createObjectURL(file);
                updateLesson(moduleId, lessonId, {
                    content: {
                        ...course.modules?.find(m => m.id === moduleId)?.lessons.find(l => l.id === lessonId)?.content,
                        videoUrl: objectUrl,
                        fileName: file.name,
                        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                    }
                });
            }
            setUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
        }
        catch (error) {
            console.error('Error uploading video:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setUploadError(`Upload failed: ${errorMessage}. This could be due to network issues or file format. Please check your connection and try again.`);
        }
        finally {
            setUploadingVideos(prev => ({ ...prev, [uploadKey]: false }));
            setTimeout(() => {
                setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
            }, 2000);
        }
    };
    const handleFileUpload = async (moduleId, lessonId, file) => {
        const uploadKey = `${moduleId}-${lessonId}`;
        try {
            setUploadingVideos(prev => ({ ...prev, [uploadKey]: true }));
            // In demo mode, use a local URL (file will be stored in browser)
            // In production, this would upload to Supabase Storage
            let fileUrl;
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
                    if (error)
                        throw error;
                    const { data: { publicUrl } } = supabase.storage
                        .from('course-resources')
                        .getPublicUrl(fileName);
                    fileUrl = publicUrl;
                }
                else {
                    throw new Error('Supabase not configured');
                }
            }
            catch (err) {
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
        }
        catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload file. Please try again.');
        }
        finally {
            setUploadingVideos(prev => ({ ...prev, [uploadKey]: false }));
        }
    };
    const toggleModuleExpansion = (moduleId) => {
        setExpandedModules(prev => ({
            ...prev,
            [moduleId]: !prev[moduleId]
        }));
    };
    const renderLessonEditor = (moduleId, lesson) => {
        const isEditing = editingLesson?.moduleId === moduleId && editingLesson?.lessonId === lesson.id;
        const uploadKey = `${moduleId}-${lesson.id}`;
        const isUploading = uploadingVideos[uploadKey];
        const progress = uploadProgress[uploadKey];
        if (!isEditing) {
            return (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("div", { className: "flex items-center justify-center w-8 h-8 bg-white rounded-full border border-gray-200", children: [lesson.type === 'video' && _jsx(Video, { className: "h-4 w-4 text-blue-500" }), lesson.type === 'interactive' && _jsx(MessageSquare, { className: "h-4 w-4 text-green-500" }), lesson.type === 'quiz' && _jsx(CheckCircle, { className: "h-4 w-4 text-orange-500" }), lesson.type === 'document' && _jsx(FileText, { className: "h-4 w-4 text-purple-500" }), lesson.type === 'text' && _jsx(BookOpen, { className: "h-4 w-4 text-indigo-500" })] }), _jsxs("div", { children: [inlineEditing?.moduleId === moduleId && inlineEditing?.lessonId === lesson.id ? (_jsx("input", { type: "text", value: lesson.title, onChange: (e) => updateLesson(moduleId, lesson.id, { title: e.target.value }), onBlur: () => setInlineEditing(null), onKeyDown: (e) => {
                                            if (e.key === 'Enter' || e.key === 'Escape') {
                                                setInlineEditing(null);
                                            }
                                        }, className: "font-medium text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent", autoFocus: true })) : (_jsx("h4", { className: "font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors", onDoubleClick: () => setInlineEditing({ moduleId, lessonId: lesson.id }), title: "Double-click to edit", children: lesson.title })), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [_jsxs("span", { className: "flex items-center", children: [_jsx(Clock, { className: "h-3 w-3 mr-1" }), lesson.duration] }), _jsx("span", { className: "capitalize", children: lesson.type }), lesson.content.videoUrl && lesson.type === 'video' && (_jsxs("span", { className: "text-green-600 flex items-center", children: [_jsx(CheckCircle, { className: "h-3 w-3 mr-1" }), "Video uploaded"] })), lesson.content.fileUrl && lesson.type === 'document' && (_jsxs("span", { className: "text-green-600 flex items-center", children: [_jsx(CheckCircle, { className: "h-3 w-3 mr-1" }), "File uploaded"] }))] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => setEditingLesson({ moduleId, lessonId: lesson.id }), className: "p-1 text-blue-600 hover:text-blue-800", title: "Edit lesson", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => {
                                    try {
                                        // Preview the specific lesson in LMS context
                                        const lessonUrl = `/lms/courses/${course.id}/modules/${moduleId}?lesson=${lesson.id}`;
                                        window.open(lessonUrl, '_blank');
                                    }
                                    catch (err) {
                                        console.warn('Preview failed', err);
                                    }
                                }, className: "p-1 text-green-600 hover:text-green-800", title: "Preview lesson in LMS", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => deleteLesson(moduleId, lesson.id), className: "p-1 text-red-600 hover:text-red-800", title: "Delete lesson", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }));
        }
        return (_jsx("div", { className: "border border-gray-300 rounded-lg p-4 bg-white", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Lesson Title" }), _jsx("input", { type: "text", value: lesson.title, onChange: (e) => updateLesson(moduleId, lesson.id, { title: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Duration" }), _jsx("input", { type: "text", value: lesson.duration, onChange: (e) => updateLesson(moduleId, lesson.id, { duration: e.target.value }), placeholder: "e.g., 15 min", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Lesson Type" }), _jsxs("select", { value: lesson.type, onChange: (e) => updateLesson(moduleId, lesson.id, {
                                    type: e.target.value,
                                    content: {} // Reset content when type changes
                                }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "video", children: "Video" }), _jsx("option", { value: "interactive", children: "Interactive Exercise" }), _jsx("option", { value: "quiz", children: "Quiz" }), _jsx("option", { value: "document", children: "Download Resource" }), _jsx("option", { value: "text", children: "Text Content" })] })] }), lesson.type === 'video' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Video Source" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("button", { onClick: () => updateLesson(moduleId, lesson.id, {
                                                    content: { ...lesson.content, videoSourceType: 'internal' }
                                                }), className: `p-4 border-2 rounded-lg transition-all duration-200 ${(!lesson.content.videoSourceType || lesson.content.videoSourceType === 'internal')
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-300 hover:border-gray-400'}`, children: [_jsx(Upload, { className: "h-6 w-6 mx-auto mb-2" }), _jsx("span", { className: "text-sm font-medium", children: "Upload File" })] }), _jsxs("button", { onClick: () => updateLesson(moduleId, lesson.id, {
                                                    content: { ...lesson.content, videoSourceType: 'external' }
                                                }), className: `p-4 border-2 rounded-lg transition-all duration-200 ${lesson.content.videoSourceType === 'external'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-300 hover:border-gray-400'}`, children: [_jsx(Video, { className: "h-6 w-6 mx-auto mb-2" }), _jsx("span", { className: "text-sm font-medium", children: "External URL" })] })] })] }), _jsx("div", { children: (!lesson.content.videoSourceType || lesson.content.videoSourceType === 'internal') ? (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Video Upload" }), lesson.content.videoUrl ? (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "aspect-video bg-gray-900 rounded-lg overflow-hidden", children: _jsx("video", { controls: true, className: "w-full h-full", src: lesson.content.videoUrl, children: "Your browser does not support the video tag." }) }), _jsxs("div", { className: "flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-500" }), _jsxs("span", { className: "text-green-800 font-medium", children: [lesson.content.fileName || 'Video uploaded', lesson.content.fileSize && ` (${lesson.content.fileSize})`] })] }), _jsx("button", { onClick: () => updateLesson(moduleId, lesson.id, {
                                                                content: { ...lesson.content, videoUrl: '', fileName: '', fileSize: '' }
                                                            }), className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] })] })) : (_jsx("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-6", children: isUploading ? (_jsxs("div", { className: "text-center", children: [_jsx(Loader, { className: "h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" }), _jsx("p", { className: "text-sm text-gray-600", children: progress === 0 ? 'Preparing upload...' :
                                                            progress < 50 ? 'Uploading video...' :
                                                                progress < 100 ? 'Processing video...' : 'Upload complete!' }), progress > 0 && (_jsx("div", { className: "w-full bg-gray-200 rounded-full h-2 mt-2", children: _jsx("div", { className: "bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-300", style: { width: `${progress}%` } }) })), progress > 0 && (_jsxs("p", { className: "text-xs text-gray-500 mt-1", children: [progress, "% complete"] })), uploadError && (_jsxs("div", { className: "mt-3 p-3 bg-red-50 rounded-lg border border-red-200", children: [_jsx("p", { className: "text-sm text-red-600 mb-2", children: uploadError }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => {
                                                                            setUploadError(null);
                                                                            const fileInput = document.createElement('input');
                                                                            fileInput.type = 'file';
                                                                            fileInput.accept = 'video/*';
                                                                            fileInput.onchange = (e) => {
                                                                                const file = e.target?.files?.[0];
                                                                                if (file)
                                                                                    handleVideoUpload(moduleId, lesson.id, file);
                                                                            };
                                                                            fileInput.click();
                                                                        }, className: "text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition-colors", children: "Try Again" }), _jsx("button", { onClick: () => setUploadError(null), className: "text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors", children: "Dismiss" })] })] }))] })) : (_jsxs("div", { className: "text-center", children: [_jsx(Video, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Upload a video file for this lesson" }), _jsx("input", { type: "file", accept: "video/*", onChange: (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                handleVideoUpload(moduleId, lesson.id, file);
                                                            }
                                                        }, className: "hidden", id: `video-upload-${lesson.id}` }), _jsxs("label", { htmlFor: `video-upload-${lesson.id}`, className: "bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 cursor-pointer inline-flex items-center space-x-2", children: [_jsx(Upload, { className: "h-4 w-4" }), _jsx("span", { children: "Choose Video File" })] }), _jsx("p", { className: "text-xs text-gray-500 mt-2", children: "Supported formats: MP4, WebM, MOV (max 100MB)" })] })) }))] })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Video URL" }), _jsx("input", { type: "url", value: lesson.content.videoUrl || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                                content: { ...lesson.content, videoUrl: e.target.value }
                                            }), placeholder: "https://example.com/video.mp4 or YouTube/Vimeo URL", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), lesson.content.videoUrl && (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "aspect-video bg-gray-900 rounded-lg overflow-hidden", children: (() => {
                                                        const url = lesson.content.videoUrl || '';
                                                        const embedUrl = getVideoEmbedUrl(lesson.content);
                                                        // Check if it's a supported embed URL (YouTube, Vimeo)
                                                        if (embedUrl && (url.includes('youtube.') || url.includes('youtu.be') || url.includes('vimeo.'))) {
                                                            return (_jsx("iframe", { src: embedUrl, className: "w-full h-full", frameBorder: "0", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowFullScreen: true, title: lesson.title }));
                                                        }
                                                        // Direct video file
                                                        return (_jsx("video", { controls: true, className: "w-full h-full", src: lesson.content.videoUrl, children: "Your browser does not support the video tag." }));
                                                    })() }), _jsxs("div", { className: "flex items-center justify-between text-sm text-gray-600", children: [_jsx("span", { children: "Preview: Video will display like this to learners" }), _jsxs("button", { onClick: () => updateLesson(moduleId, lesson.id, {
                                                                content: { ...lesson.content, videoUrl: '' }
                                                            }), className: "text-red-600 hover:text-red-800 flex items-center space-x-1", children: [_jsx(X, { className: "h-3 w-3" }), _jsx("span", { children: "Remove" })] })] })] })), _jsx("p", { className: "text-xs text-gray-500", children: "Supports direct video URLs (.mp4, .webm, .mov) and embedded videos (YouTube, Vimeo)" })] })) }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Transcript (Optional)" }), _jsx("textarea", { value: lesson.content.transcript || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, transcript: e.target.value }
                                        }), rows: 4, placeholder: "Add video transcript for accessibility...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Key Notes" }), _jsx("textarea", { value: lesson.content.notes || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, notes: e.target.value }
                                        }), rows: 3, placeholder: "Important points and takeaways from this video...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })), lesson.type === 'interactive' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Scenario Text" }), _jsx("textarea", { value: lesson.content.scenarioText || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, scenarioText: e.target.value }
                                        }), rows: 3, placeholder: "Describe the scenario or situation...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Response Options" }), _jsxs("div", { className: "space-y-3", children: [(lesson.content.options || []).map((option, index) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("span", { className: "font-medium text-gray-900", children: ["Option ", index + 1] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: option.isCorrect || false, onChange: (e) => {
                                                                                    const updatedOptions = [...(lesson.content.options || [])];
                                                                                    updatedOptions[index] = { ...option, isCorrect: e.target.checked };
                                                                                    updateLesson(moduleId, lesson.id, {
                                                                                        content: { ...lesson.content, options: updatedOptions }
                                                                                    });
                                                                                }, className: "h-4 w-4 text-green-500 focus:ring-green-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-green-600", children: "Correct Answer" })] }), _jsx("button", { onClick: () => {
                                                                            const updatedOptions = (lesson.content.options || []).filter((_, i) => i !== index);
                                                                            updateLesson(moduleId, lesson.id, {
                                                                                content: { ...lesson.content, options: updatedOptions }
                                                                            });
                                                                        }, className: "text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }), _jsx("input", { type: "text", value: option.text || '', onChange: (e) => {
                                                            const updatedOptions = [...(lesson.content.options || [])];
                                                            updatedOptions[index] = { ...option, text: e.target.value };
                                                            updateLesson(moduleId, lesson.id, {
                                                                content: { ...lesson.content, options: updatedOptions }
                                                            });
                                                        }, placeholder: "Option text...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-2" }), _jsx("textarea", { value: option.feedback || '', onChange: (e) => {
                                                            const updatedOptions = [...(lesson.content.options || [])];
                                                            updatedOptions[index] = { ...option, feedback: e.target.value };
                                                            updateLesson(moduleId, lesson.id, {
                                                                content: { ...lesson.content, options: updatedOptions }
                                                            });
                                                        }, placeholder: "Feedback for this option...", rows: 2, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }, index))), _jsx("button", { onClick: () => {
                                                    const newOption = { text: '', feedback: '', isCorrect: false };
                                                    const updatedOptions = [...(lesson.content.options || []), newOption];
                                                    updateLesson(moduleId, lesson.id, {
                                                        content: { ...lesson.content, options: updatedOptions }
                                                    });
                                                }, className: "w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200", children: _jsx(Plus, { className: "h-4 w-4 mx-auto" }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Instructions" }), _jsx("textarea", { value: lesson.content.instructions || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, instructions: e.target.value }
                                        }), rows: 2, placeholder: "Instructions for completing this exercise...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })), lesson.type === 'quiz' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Passing Score (%)" }), _jsx("input", { type: "number", min: "0", max: "100", value: lesson.content.passingScore || 80, onChange: (e) => updateLesson(moduleId, lesson.id, {
                                                    content: { ...lesson.content, passingScore: parseInt(e.target.value) }
                                                }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: lesson.content.allowRetakes || false, onChange: (e) => updateLesson(moduleId, lesson.id, {
                                                            content: { ...lesson.content, allowRetakes: e.target.checked }
                                                        }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-700", children: "Allow Retakes" })] }), _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: lesson.content.showCorrectAnswers || false, onChange: (e) => updateLesson(moduleId, lesson.id, {
                                                            content: { ...lesson.content, showCorrectAnswers: e.target.checked }
                                                        }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-700", children: "Show Correct Answers" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Questions" }), _jsxs("div", { className: "space-y-4", children: [(lesson.content.questions || []).map((question, qIndex) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("span", { className: "font-medium text-gray-900", children: ["Question ", qIndex + 1] }), _jsx("button", { onClick: () => {
                                                                    const updatedQuestions = (lesson.content.questions || []).filter((_, i) => i !== qIndex);
                                                                    updateLesson(moduleId, lesson.id, {
                                                                        content: { ...lesson.content, questions: updatedQuestions }
                                                                    });
                                                                }, className: "text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }), _jsx("input", { type: "text", value: question.text, onChange: (e) => {
                                                            const updatedQuestions = [...(lesson.content.questions || [])];
                                                            updatedQuestions[qIndex] = { ...question, text: e.target.value };
                                                            updateLesson(moduleId, lesson.id, {
                                                                content: { ...lesson.content, questions: updatedQuestions }
                                                            });
                                                        }, placeholder: "Question text...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3" }), _jsxs("div", { className: "space-y-2", children: [(question.options || []).map((option, oIndex) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", name: `correct-${question.id}`, checked: question.correctAnswerIndex === oIndex, onChange: () => {
                                                                            const updatedQuestions = [...(lesson.content.questions || [])];
                                                                            updatedQuestions[qIndex] = { ...question, correctAnswerIndex: oIndex };
                                                                            updateLesson(moduleId, lesson.id, {
                                                                                content: { ...lesson.content, questions: updatedQuestions }
                                                                            });
                                                                        }, className: "h-4 w-4 text-green-500 focus:ring-green-500" }), _jsx("input", { type: "text", value: option, onChange: (e) => {
                                                                            const updatedQuestions = [...(lesson.content.questions || [])];
                                                                            const updatedOptions = [...(question.options || [])];
                                                                            updatedOptions[oIndex] = e.target.value;
                                                                            updatedQuestions[qIndex] = { ...question, options: updatedOptions };
                                                                            updateLesson(moduleId, lesson.id, {
                                                                                content: { ...lesson.content, questions: updatedQuestions }
                                                                            });
                                                                        }, placeholder: `Option ${oIndex + 1}...`, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("button", { onClick: () => {
                                                                            const updatedQuestions = [...(lesson.content.questions || [])];
                                                                            const updatedOptions = (question.options || []).filter((_, i) => i !== oIndex);
                                                                            updatedQuestions[qIndex] = {
                                                                                ...question,
                                                                                options: updatedOptions,
                                                                                correctAnswerIndex: (question.correctAnswerIndex || 0) > oIndex ? (question.correctAnswerIndex || 0) - 1 : (question.correctAnswerIndex || 0)
                                                                            };
                                                                            updateLesson(moduleId, lesson.id, {
                                                                                content: { ...lesson.content, questions: updatedQuestions }
                                                                            });
                                                                        }, className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] }, oIndex))), _jsx("button", { onClick: () => {
                                                                    const updatedQuestions = [...(lesson.content.questions || [])];
                                                                    const updatedOptions = [...(question.options || []), ''];
                                                                    updatedQuestions[qIndex] = { ...question, options: updatedOptions };
                                                                    updateLesson(moduleId, lesson.id, {
                                                                        content: { ...lesson.content, questions: updatedQuestions }
                                                                    });
                                                                }, className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Option" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Explanation (Optional)" }), _jsx("textarea", { value: question.explanation || '', onChange: (e) => {
                                                                    const updatedQuestions = [...(lesson.content.questions || [])];
                                                                    updatedQuestions[qIndex] = { ...question, explanation: e.target.value };
                                                                    updateLesson(moduleId, lesson.id, {
                                                                        content: { ...lesson.content, questions: updatedQuestions }
                                                                    });
                                                                }, rows: 2, placeholder: "Explain why this is the correct answer...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }, question.id))), _jsxs("button", { onClick: () => {
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
                                                }, className: "w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200", children: [_jsx(Plus, { className: "h-4 w-4 mx-auto mb-1" }), _jsx("span", { className: "text-sm", children: "Add Question" })] })] })] })] })), lesson.type === 'document' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Resource Title" }), _jsx("input", { type: "text", value: lesson.content.title || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, title: e.target.value }
                                        }), placeholder: "e.g., Leadership Assessment Worksheet", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { value: lesson.content.description || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, description: e.target.value }
                                        }), rows: 3, placeholder: "Describe what this resource contains and how to use it...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "File Upload" }), lesson.content.fileUrl ? (_jsxs("div", { className: "flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-500" }), _jsxs("span", { className: "text-green-800 font-medium", children: [lesson.content.fileName, " (", lesson.content.fileSize, ")"] })] }), _jsx("button", { onClick: () => updateLesson(moduleId, lesson.id, {
                                                    content: { ...lesson.content, fileUrl: '', fileName: '', fileSize: '' }
                                                }), className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] })) : (_jsx("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-6", children: isUploading ? (_jsxs("div", { className: "text-center", children: [_jsx(Loader, { className: "h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" }), _jsx("p", { className: "text-sm text-gray-600", children: "Uploading file..." })] })) : (_jsxs("div", { className: "text-center", children: [_jsx(FileText, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Upload a downloadable resource" }), _jsx("input", { type: "file", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx", onChange: (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            handleFileUpload(moduleId, lesson.id, file);
                                                        }
                                                    }, className: "hidden", id: `file-upload-${lesson.id}` }), _jsxs("label", { htmlFor: `file-upload-${lesson.id}`, className: "bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors duration-200 cursor-pointer inline-flex items-center space-x-2", children: [_jsx(Upload, { className: "h-4 w-4" }), _jsx("span", { children: "Choose File" })] }), _jsx("p", { className: "text-xs text-gray-500 mt-2", children: "Supported: PDF, DOC, XLS, PPT (max 50MB)" })] })) }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Instructions" }), _jsx("textarea", { value: lesson.content.instructions || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, instructions: e.target.value }
                                        }), rows: 2, placeholder: "Instructions for using this resource...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })), lesson.type === 'text' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Content Title" }), _jsx("input", { type: "text", value: lesson.content.title || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, title: e.target.value }
                                        }), placeholder: "e.g., Reflection: Leadership Journey", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Content Description" }), _jsx("textarea", { value: lesson.content.description || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, description: e.target.value }
                                        }), rows: 3, placeholder: "Brief description of this content section...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Main Content" }), _jsx("textarea", { value: lesson.content.content || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, content: e.target.value }
                                        }), rows: 6, placeholder: "Enter the main content, reading material, or instructions...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "This content will be displayed to learners. You can include instructions, reading material, or reflection prompts." })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Reflection Prompt (Optional)" }), _jsx("textarea", { value: lesson.content.reflectionPrompt || '', onChange: (e) => updateLesson(moduleId, lesson.id, {
                                            content: { ...lesson.content, reflectionPrompt: e.target.value }
                                        }), rows: 4, placeholder: "What questions do you want learners to reflect on? e.g., 'How will you apply these concepts in your leadership role?'", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "If provided, learners will see a reflection area where they can write and save their thoughts." })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx("div", { children: _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: lesson.content.allowReflection || false, onChange: (e) => updateLesson(moduleId, lesson.id, {
                                                        content: { ...lesson.content, allowReflection: e.target.checked }
                                                    }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-700", children: "Enable reflection area for learners" })] }) }), _jsx("div", { children: _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: lesson.content.requireReflection || false, onChange: (e) => updateLesson(moduleId, lesson.id, {
                                                        content: { ...lesson.content, requireReflection: e.target.checked }
                                                    }), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded", disabled: !lesson.content.allowReflection }), _jsx("span", { className: `text-sm ${!lesson.content.allowReflection ? 'text-gray-400' : 'text-gray-700'}`, children: "Require reflection to complete lesson" })] }) })] })] })), _jsxs("div", { className: "border-t border-gray-200 pt-6 mt-6", children: [_jsxs("h4", { className: "text-lg font-medium text-gray-900 mb-4 flex items-center", children: [_jsx(Plus, { className: "h-5 w-5 mr-2 text-blue-500" }), "Additional Content"] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Add quiz questions, additional reading, or notes to enhance any lesson type." }), _jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Knowledge Check Questions" }), _jsxs("button", { onClick: () => {
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
                                                }, className: "text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1", children: [_jsx(Plus, { className: "h-4 w-4" }), _jsx("span", { children: "Add Question" })] })] }), (lesson.content.questions || []).length > 0 && (_jsx("div", { className: "space-y-4", children: (lesson.content.questions || []).map((question, qIndex) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4 bg-gray-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("span", { className: "font-medium text-gray-900", children: ["Question ", qIndex + 1] }), _jsx("button", { onClick: () => {
                                                                const updatedQuestions = (lesson.content.questions || []).filter((_, i) => i !== qIndex);
                                                                updateLesson(moduleId, lesson.id, {
                                                                    content: { ...lesson.content, questions: updatedQuestions }
                                                                });
                                                            }, className: "text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }), _jsx("input", { type: "text", value: question.text, onChange: (e) => {
                                                        const updatedQuestions = [...(lesson.content.questions || [])];
                                                        updatedQuestions[qIndex] = { ...question, text: e.target.value };
                                                        updateLesson(moduleId, lesson.id, {
                                                            content: { ...lesson.content, questions: updatedQuestions }
                                                        });
                                                    }, placeholder: "Question text...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3" }), _jsxs("div", { className: "space-y-2", children: [(question.options || []).map((option, oIndex) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", name: `correct-${question.id}`, checked: question.correctAnswerIndex === oIndex, onChange: () => {
                                                                        const updatedQuestions = [...(lesson.content.questions || [])];
                                                                        updatedQuestions[qIndex] = { ...question, correctAnswerIndex: oIndex };
                                                                        updateLesson(moduleId, lesson.id, {
                                                                            content: { ...lesson.content, questions: updatedQuestions }
                                                                        });
                                                                    }, className: "h-4 w-4 text-green-500 focus:ring-green-500" }), _jsx("input", { type: "text", value: option, onChange: (e) => {
                                                                        const updatedQuestions = [...(lesson.content.questions || [])];
                                                                        const updatedOptions = [...(question.options || [])];
                                                                        updatedOptions[oIndex] = e.target.value;
                                                                        updatedQuestions[qIndex] = { ...question, options: updatedOptions };
                                                                        updateLesson(moduleId, lesson.id, {
                                                                            content: { ...lesson.content, questions: updatedQuestions }
                                                                        });
                                                                    }, placeholder: `Option ${oIndex + 1}...`, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("button", { onClick: () => {
                                                                        const updatedQuestions = [...(lesson.content.questions || [])];
                                                                        const updatedOptions = (question.options || []).filter((_, i) => i !== oIndex);
                                                                        updatedQuestions[qIndex] = {
                                                                            ...question,
                                                                            options: updatedOptions,
                                                                            correctAnswerIndex: (question.correctAnswerIndex || 0) > oIndex ? (question.correctAnswerIndex || 0) - 1 : (question.correctAnswerIndex || 0)
                                                                        };
                                                                        updateLesson(moduleId, lesson.id, {
                                                                            content: { ...lesson.content, questions: updatedQuestions }
                                                                        });
                                                                    }, className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] }, oIndex))), _jsx("button", { onClick: () => {
                                                                const updatedQuestions = [...(lesson.content.questions || [])];
                                                                const updatedOptions = [...(question.options || []), ''];
                                                                updatedQuestions[qIndex] = { ...question, options: updatedOptions };
                                                                updateLesson(moduleId, lesson.id, {
                                                                    content: { ...lesson.content, questions: updatedQuestions }
                                                                });
                                                            }, className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Option" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Explanation (Optional)" }), _jsx("textarea", { value: question.explanation || '', onChange: (e) => {
                                                                const updatedQuestions = [...(lesson.content.questions || [])];
                                                                updatedQuestions[qIndex] = { ...question, explanation: e.target.value };
                                                                updateLesson(moduleId, lesson.id, {
                                                                    content: { ...lesson.content, questions: updatedQuestions }
                                                                });
                                                            }, rows: 2, placeholder: "Explain why this is the correct answer...", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }, question.id))) })), (lesson.content.questions || []).length === 0 && (_jsxs("div", { className: "text-center py-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50", children: [_jsx(CheckCircle, { className: "h-8 w-8 text-gray-400 mx-auto mb-2" }), _jsx("p", { className: "text-gray-600 text-sm mb-2", children: "No quiz questions added" }), _jsx("p", { className: "text-gray-500 text-xs", children: "Add quiz questions to test learner comprehension after the main content" })] }))] })] }), _jsxs("div", { className: "flex items-center justify-end space-x-3 pt-4 border-t border-gray-200", children: [_jsx("button", { onClick: () => setEditingLesson(null), className: "px-4 py-2 text-gray-600 hover:text-gray-800", children: "Cancel" }), _jsx("button", { onClick: () => setEditingLesson(null), className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200", children: "Save Lesson" })] })] }) }));
    };
    const tabs = [
        { id: 'overview', name: 'Overview', icon: Settings },
        { id: 'content', name: 'Content', icon: BookOpen },
        { id: 'settings', name: 'Settings', icon: Target },
        { id: 'history', name: 'History', icon: Clock }
    ];
    if (initializing && isEditing) {
        return (_jsx("div", { className: "p-6 max-w-4xl mx-auto", children: _jsxs("div", { className: "flex items-center space-x-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm", children: [_jsx(Loader, { className: "h-5 w-5 animate-spin text-orange-500" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: "Loading course builder\u2026" }), _jsx("p", { className: "text-xs text-gray-500", children: "Fetching the latest course data." })] })] }) }));
    }
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsxs(Link, { to: "/admin/courses", className: "inline-flex items-center text-orange-500 hover:text-orange-600 mb-4 font-medium", children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Course Management"] }), loadError && (_jsx("div", { className: "mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800", children: loadError })), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: isEditing ? 'Edit Course' : 'Create New Course' }), _jsx("p", { className: "text-gray-600", children: isEditing ? `Editing: ${course.title}` : 'Build a comprehensive learning experience' }), isEditing && (() => {
                                        const validation = validateCourse(course);
                                        return (_jsx("div", { className: `mt-2 px-3 py-2 rounded-lg text-sm ${validation.isValid
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`, children: validation.isValid ? (_jsx("span", { children: "\u2705 Course is valid and ready to publish" })) : (_jsxs("div", { children: [_jsxs("span", { children: ["\u26A0\uFE0F ", validation.issues.length, " validation issue(s):"] }), _jsxs("ul", { className: "mt-1 text-xs", children: [validation.issues.slice(0, 3).map((issue, index) => (_jsxs("li", { children: ["\u2022 ", issue] }, index))), validation.issues.length > 3 && (_jsxs("li", { children: ["\u2022 ... and ", validation.issues.length - 3, " more"] }))] })] })) }));
                                    })()] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("button", { onClick: () => setShowPreview(true), className: "bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors duration-200 flex items-center space-x-2 font-medium", title: "Preview course as learner", children: [_jsx(Eye, { className: "h-4 w-4" }), _jsx("span", { children: "Live Preview" })] }), _jsx("button", { onClick: handleSave, "data-save-button": true, disabled: saveStatus === 'saving', className: `px-6 py-3 rounded-lg transition-all duration-200 flex items-center space-x-2 font-medium ${saveStatus === 'saved'
                                            ? 'bg-green-500 text-white hover:bg-green-600'
                                            : saveStatus === 'error'
                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                : 'bg-blue-500 text-white hover:bg-blue-600'} ${saveStatus === 'saving' ? 'opacity-75 cursor-not-allowed' : ''}`, children: saveStatus === 'saving' ? (_jsxs(_Fragment, { children: [_jsx(Loader, { className: "h-4 w-4 animate-spin" }), _jsx("span", { children: "Saving..." })] })) : saveStatus === 'saved' ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle, { className: "h-4 w-4" }), _jsx("span", { children: "Saved!" })] })) : saveStatus === 'error' ? (_jsxs(_Fragment, { children: [_jsx(X, { className: "h-4 w-4" }), _jsx("span", { children: "Retry Save" })] })) : (_jsxs(_Fragment, { children: [_jsx(Save, { className: "h-4 w-4" }), _jsx("span", { children: "Save Draft" }), _jsx("span", { className: "hidden md:inline text-xs opacity-75", children: "\u2318S" })] })) }), lastSaveTime && saveStatus === 'idle' && (_jsxs("span", { className: "text-sm text-gray-500 flex items-center", children: [_jsx(CheckCircle, { className: "h-3 w-3 mr-1 text-green-500" }), "Auto-saved at ", lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })] })), course.status === 'draft' && (_jsxs("button", { onClick: () => setShowAssignmentModal(true), className: "bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2", disabled: !course.id || (course.modules || []).length === 0, title: !course.id || (course.modules || []).length === 0 ? "Save course and add content before assigning" : "", children: [_jsx(Users, { className: "h-4 w-4" }), _jsx("span", { children: "Assign to Users" })] })), _jsxs("button", { onClick: handlePublish, className: "bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2", disabled: (course.modules || []).length === 0, title: (course.modules || []).length === 0 ? "Add content before publishing" : "", children: [_jsx(CheckCircle, { className: "h-4 w-4" }), _jsx("span", { children: course.status === 'published' ? 'Update Published' : 'Publish Course' })] }), _jsxs("button", { onClick: () => window.open(`/courses/${course.id}`, '_blank'), className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Eye, { className: "h-4 w-4" }), _jsx("span", { children: "Preview" })] }), _jsxs("button", { onClick: () => {
                                            try {
                                                const newId = generateId('course');
                                                const cloned = { ...course, id: newId, title: `${course.title} (Copy)`, createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString(), enrollments: 0, completions: 0, completionRate: 0 };
                                                courseStore.saveCourse(cloned, { skipRemoteSync: true });
                                                navigate(`/admin/course-builder/${newId}`);
                                            }
                                            catch (err) {
                                                console.warn('Failed to duplicate course', err);
                                            }
                                        }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Copy, { className: "h-4 w-4" }), _jsx("span", { children: "Duplicate" })] }), _jsxs("button", { onClick: () => {
                                            try {
                                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(course, null, 2));
                                                const dlAnchor = document.createElement('a');
                                                dlAnchor.setAttribute('href', dataStr);
                                                dlAnchor.setAttribute('download', `${course.title.replace(/\s+/g, '_').toLowerCase() || 'course'}.json`);
                                                document.body.appendChild(dlAnchor);
                                                dlAnchor.click();
                                                dlAnchor.remove();
                                            }
                                            catch (err) {
                                                console.warn('Export failed', err);
                                            }
                                        }, className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { children: "Export" })] }), _jsxs("button", { onClick: () => {
                                            if (!confirm('Delete this course? This action cannot be undone.'))
                                                return;
                                            try {
                                                courseStore.deleteCourse(course.id);
                                                navigate('/admin/courses');
                                            }
                                            catch (err) {
                                                console.warn('Delete failed', err);
                                            }
                                        }, className: "border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Trash2, { className: "h-4 w-4" }), _jsx("span", { children: "Delete" })] })] })] })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 mb-8", children: [_jsx("div", { className: "border-b border-gray-200", children: _jsx("nav", { className: "flex space-x-8 px-6", children: tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                        ? 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: [_jsx(Icon, { className: "h-4 w-4" }), _jsx("span", { children: tab.name })] }, tab.id));
                            }) }) }), _jsxs("div", { className: "p-6", children: [activeTab === 'overview' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Course Title *" }), _jsx("input", { type: "text", value: course.title, onChange: (e) => setCourse(prev => ({ ...prev, title: e.target.value })), placeholder: "e.g., Foundations of Inclusive Leadership", className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Difficulty Level" }), _jsxs("select", { value: course.difficulty, onChange: (e) => setCourse(prev => ({ ...prev, difficulty: e.target.value })), className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "Beginner", children: "Beginner" }), _jsx("option", { value: "Intermediate", children: "Intermediate" }), _jsx("option", { value: "Advanced", children: "Advanced" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { value: course.description, onChange: (e) => setCourse(prev => ({ ...prev, description: e.target.value })), rows: 4, placeholder: "Describe what learners will gain from this course...", className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Learning Objectives" }), _jsxs("div", { className: "space-y-2", children: [(course.learningObjectives || []).map((objective, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: objective, onChange: (e) => {
                                                                    const updated = [...(course.learningObjectives || [])];
                                                                    updated[index] = e.target.value;
                                                                    setCourse(prev => ({ ...prev, learningObjectives: updated }));
                                                                }, placeholder: "Learning objective...", className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("button", { onClick: () => {
                                                                    const updated = (course.learningObjectives || []).filter((_, i) => i !== index);
                                                                    setCourse(prev => ({ ...prev, learningObjectives: updated }));
                                                                }, className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => setCourse(prev => ({
                                                            ...prev,
                                                            learningObjectives: [...(prev.learningObjectives || []), '']
                                                        })), className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Learning Objective" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Key Takeaways" }), _jsxs("div", { className: "space-y-2", children: [(course.keyTakeaways || []).map((takeaway, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: takeaway, onChange: (e) => {
                                                                    const updated = [...(course.keyTakeaways || [])];
                                                                    updated[index] = e.target.value;
                                                                    setCourse(prev => ({ ...prev, keyTakeaways: updated }));
                                                                }, placeholder: "Key takeaway...", className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("button", { onClick: () => {
                                                                    const updated = (course.keyTakeaways || []).filter((_, i) => i !== index);
                                                                    setCourse(prev => ({ ...prev, keyTakeaways: updated }));
                                                                }, className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => setCourse(prev => ({
                                                            ...prev,
                                                            keyTakeaways: [...(prev.keyTakeaways || []), '']
                                                        })), className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Key Takeaway" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Tags" }), _jsx("div", { className: "flex flex-wrap gap-2 mb-2", children: (course.tags || []).map((tag, index) => (_jsxs("span", { className: "bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm flex items-center space-x-1", children: [_jsx("span", { children: tag }), _jsx("button", { onClick: () => {
                                                                const updated = (course.tags || []).filter((_, i) => i !== index);
                                                                setCourse(prev => ({ ...prev, tags: updated }));
                                                            }, className: "text-orange-600 hover:text-orange-800", children: _jsx(X, { className: "h-3 w-3" }) })] }, index))) }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", placeholder: "Add a tag...", onKeyPress: (e) => {
                                                            if (e.key === 'Enter') {
                                                                const input = e.target;
                                                                const tag = input.value.trim();
                                                                if (tag && !(course.tags || []).includes(tag)) {
                                                                    setCourse(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
                                                                    input.value = '';
                                                                }
                                                            }
                                                        }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("span", { className: "text-sm text-gray-500", children: "Press Enter to add" })] })] })] })), activeTab === 'content' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Course Modules" }), _jsxs("button", { onClick: addModule, className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Plus, { className: "h-4 w-4" }), _jsx("span", { children: "Add Module" })] })] }), _jsxs("div", { className: "space-y-4", children: [(course.modules || []).map((module, _moduleIndex) => (_jsxs("div", { className: "border border-gray-200 rounded-lg", children: [_jsx("div", { className: "p-4 bg-gray-50 border-b border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3 flex-1", children: [_jsx("button", { onClick: () => toggleModuleExpansion(module.id), className: "text-gray-600 hover:text-gray-800", children: expandedModules[module.id] ? (_jsx(ChevronUp, { className: "h-5 w-5" })) : (_jsx(ChevronDown, { className: "h-5 w-5" })) }), _jsxs("div", { className: "flex-1", children: [_jsx("input", { type: "text", value: module.title, onChange: (e) => updateModule(module.id, { title: e.target.value }), placeholder: "Module title...", className: "font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full" }), _jsx("input", { type: "text", value: module.description, onChange: (e) => updateModule(module.id, { description: e.target.value }), placeholder: "Module description...", className: "text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full mt-1" })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("span", { className: "text-sm text-gray-600", children: [module.lessons.length, " lessons"] }), _jsx("button", { onClick: () => deleteModule(module.id), className: "text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }) }), expandedModules[module.id] && (_jsxs("div", { className: "p-4", children: [_jsx("div", { className: "space-y-3 mb-4", children: module.lessons.map((lesson) => (_jsx("div", { id: `lesson-${lesson.id}`, className: highlightLessonId === lesson.id ? 'transition-all duration-300 ring-2 ring-orange-300 bg-orange-50 rounded-md p-1' : '', children: renderLessonEditor(module.id, lesson) }, lesson.id))) }), _jsxs("button", { onClick: () => addLesson(module.id), className: "w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors duration-200", children: [_jsx(Plus, { className: "h-5 w-5 mx-auto mb-2" }), _jsx("span", { className: "text-sm", children: "Add Lesson" })] })] }))] }, module.id))), (course.modules || []).length === 0 && (_jsxs("div", { className: "text-center py-12 border-2 border-dashed border-gray-300 rounded-lg", children: [_jsx(BookOpen, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No modules yet" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Start building your course by adding the first module." }), _jsx("button", { onClick: addModule, className: "bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-200", children: "Add First Module" })] }))] })] })), activeTab === 'overview' && (_jsx("div", { className: "mt-8", children: _jsx(AIContentAssistant, { course: course, onApplySuggestion: handleApplySuggestion, onDismissSuggestion: handleDismissSuggestion }) })), activeTab === 'settings' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Course Type" }), _jsxs("select", { value: course.type, onChange: (e) => setCourse(prev => ({ ...prev, type: e.target.value })), className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "Video", children: "Video" }), _jsx("option", { value: "Interactive", children: "Interactive" }), _jsx("option", { value: "Mixed", children: "Mixed" }), _jsx("option", { value: "Workshop", children: "Workshop" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Estimated Time" }), _jsx("input", { type: "text", value: course.estimatedTime, onChange: (e) => setCourse(prev => ({ ...prev, estimatedTime: e.target.value })), placeholder: "e.g., 45-60 minutes", className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Prerequisites" }), _jsxs("div", { className: "space-y-2", children: [(course.prerequisites || []).map((prerequisite, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: prerequisite, onChange: (e) => {
                                                                    const updated = [...(course.prerequisites || [])];
                                                                    updated[index] = e.target.value;
                                                                    setCourse(prev => ({ ...prev, prerequisites: updated }));
                                                                }, placeholder: "Prerequisite...", className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("button", { onClick: () => {
                                                                    const updated = (course.prerequisites || []).filter((_, i) => i !== index);
                                                                    setCourse(prev => ({ ...prev, prerequisites: updated }));
                                                                }, className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => setCourse(prev => ({
                                                            ...prev,
                                                            prerequisites: [...(prev.prerequisites || []), '']
                                                        })), className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Prerequisite" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Certification Settings" }), _jsxs("div", { className: "space-y-4 p-4 border border-gray-200 rounded-lg", children: [_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: course.certification?.available || false, onChange: (e) => setCourse(prev => ({
                                                                    ...prev,
                                                                    certification: {
                                                                        // ensure a full certification object exists so types remain compatible
                                                                        ...(prev.certification ?? { available: false, name: '', requirements: [], validFor: '1 year', renewalRequired: false }),
                                                                        available: e.target.checked
                                                                    }
                                                                })), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("span", { className: "text-sm text-gray-700", children: "Offer certification for this course" })] }), course.certification?.available && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Certificate Name" }), _jsx("input", { type: "text", value: course.certification.name, onChange: (e) => setCourse(prev => ({
                                                                            ...prev,
                                                                            certification: {
                                                                                ...prev.certification,
                                                                                name: e.target.value
                                                                            }
                                                                        })), placeholder: "e.g., Inclusive Leadership Foundation Certificate", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Requirements" }), _jsxs("div", { className: "space-y-2", children: [course.certification.requirements.map((requirement, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: requirement, onChange: (e) => {
                                                                                            const updated = [...course.certification.requirements];
                                                                                            updated[index] = e.target.value;
                                                                                            setCourse(prev => ({
                                                                                                ...prev,
                                                                                                certification: {
                                                                                                    ...prev.certification,
                                                                                                    requirements: updated
                                                                                                }
                                                                                            }));
                                                                                        }, placeholder: "Certification requirement...", className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("button", { onClick: () => {
                                                                                            const updated = course.certification.requirements.filter((_, i) => i !== index);
                                                                                            setCourse(prev => ({
                                                                                                ...prev,
                                                                                                certification: {
                                                                                                    ...prev.certification,
                                                                                                    requirements: updated
                                                                                                }
                                                                                            }));
                                                                                        }, className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] }, index))), _jsx("button", { onClick: () => setCourse(prev => ({
                                                                                    ...prev,
                                                                                    certification: {
                                                                                        ...prev.certification,
                                                                                        requirements: [...prev.certification.requirements, '']
                                                                                    }
                                                                                })), className: "text-blue-600 hover:text-blue-700 text-sm", children: "+ Add Requirement" })] })] })] }))] })] })] })), activeTab === 'history' && (_jsx("div", { className: "space-y-6", children: _jsx(VersionControl, { course: course, onRestore: handleRestoreVersion }) }))] })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Course Preview" }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { children: [_jsx("img", { src: course.thumbnail, alt: course.title, className: "w-full h-48 object-cover rounded-lg mb-4" }), _jsx("h3", { className: "text-2xl font-bold text-gray-900 mb-2", children: course.title || 'Course Title' }), _jsx("p", { className: "text-gray-600 mb-4", children: course.description || 'Course description will appear here...' }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [_jsxs("span", { className: "flex items-center", children: [_jsx(Clock, { className: "h-4 w-4 mr-1" }), calculateCourseDuration(course.modules || [])] }), _jsxs("span", { className: "flex items-center", children: [_jsx(BookOpen, { className: "h-4 w-4 mr-1" }), countTotalLessons(course.modules || []), " lessons"] }), _jsxs("span", { className: "flex items-center", children: [_jsx(Users, { className: "h-4 w-4 mr-1" }), course.difficulty] })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-gray-900 mb-3", children: "Learning Objectives:" }), _jsxs("ul", { className: "space-y-2 mb-6", children: [(course.learningObjectives || []).slice(0, 3).map((objective, index) => (_jsxs("li", { className: "flex items-start space-x-2", children: [_jsx(Target, { className: "h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" }), _jsx("span", { className: "text-gray-700 text-sm", children: objective || 'Learning objective...' })] }, index))), (course.learningObjectives || []).length > 3 && (_jsxs("li", { className: "text-sm text-gray-500", children: ["+", (course.learningObjectives || []).length - 3, " more objectives"] }))] }), _jsx("div", { className: "flex flex-wrap gap-2", children: (course.tags || []).map((tag, index) => (_jsx("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: tag }, index))) })] })] })] }), _jsx(CourseAssignmentModal, { isOpen: showAssignmentModal, onClose: () => setShowAssignmentModal(false), onAssignComplete: handleAssignmentComplete, selectedUsers: [], course: { id: course.id, title: course.title, duration: course.duration } }), _jsx(LivePreview, { isOpen: showPreview, onClose: () => setShowPreview(false), course: course, currentModule: editingLesson ? course.modules?.find(m => m.id === editingLesson.moduleId) : undefined, currentLesson: editingLesson ?
                    course.modules?.find(m => m.id === editingLesson.moduleId)
                        ?.lessons.find(l => l.id === editingLesson.lessonId) : undefined })] }));
};
export default AdminCourseBuilder;
