import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, Users, Settings, Tag, BookOpen, FileText, Star, Globe,
  Upload, Link as LinkIcon, Play, PlusCircle, Edit, Trash2,
  Video, HelpCircle, ListChecks, Zap, Download, Eye, Move, Copy,
  CheckCircle, Search, BarChart3, Brain, Lightbulb, Clock,
  TrendingUp, Target, Award, AlertTriangle, CheckCircle2, Sparkles
} from 'lucide-react';
import { Course } from '../types/courseTypes';
import { slugify } from '../utils/courseNormalization';
import apiRequest from '../utils/apiClient';
import { type CourseValidationIssue } from '../validation/courseValidation';
import { getCourseValidationSummary } from '../validation/courseValidationSummary';

const generateCourseId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const randomSuffix = Math.random().toString(16).slice(2, 10);
  return `course-${Date.now()}-${randomSuffix}`;
};

const buildDefaultCourse = (): Course => {
  const now = new Date().toISOString();
  const id = generateCourseId();
  const fallbackSlug = slugify(`course-${id}`);

  return {
    id,
    slug: fallbackSlug,
    title: '',
    description: '',
    status: 'draft',
    thumbnail: '',
    duration: '0 min',
    difficulty: 'Beginner',
    enrollments: 0,
    completions: 0,
    completionRate: 0,
    avgRating: 0,
    totalRatings: 0,
    createdBy: '',
    createdDate: now,
    lastUpdated: now,
    estimatedTime: '30 min',
    prerequisites: [],
    learningObjectives: [],
    tags: [],
    modules: [],
    keyTakeaways: [],
    type: '',
    lessons: 0,
    rating: 0,
    progress: 0
  };
};

interface CourseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: Course) => void;
  course?: Course | null;
  mode: 'create' | 'edit';
}

// Enhanced content type interfaces
interface VideoContent {
  id: string;
  type: 'upload' | 'url';
  title: string;
  description?: string;
  url?: string;
  file?: File;
  thumbnail?: string;
  duration?: number;
  transcript?: string;
  captions?: string;
  transcriptFile?: File;
  captionsFile?: File;
  transcriptName?: string;
  captionsName?: string;
  watchPercentage?: number;
  resumeFromLastPosition?: boolean;
  markAsWatched?: boolean;
  settings: {
    requireWatchPercentage: number;
    resumeFromLastPosition: boolean;
    markAsWatched: boolean;
  };
}

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'multi-select' | 'true-false' | 'short-answer' | 'likert';
  question: string;
  options?: string[];
  correctAnswers: string[];
  explanation?: string;
  points: number;
  required: boolean;
}

interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  settings: {
    timeLimit?: number;
    passingScore: number;
    maxAttempts: number;
    randomizeQuestions: boolean;
    showExplanations: boolean;
  };
}

interface InteractiveElement {
  id: string;
  type: 'drag-drop' | 'branching' | 'scenario' | 'simulation';
  title: string;
  description?: string;
  content: any;
  settings: {
    maxAttempts: number;
    passingScore: number;
    showFeedback: boolean;
  };
}

interface Resource {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'doc' | 'ppt' | 'zip' | 'link';
  url?: string;
  file?: File;
  size?: string;
  downloadable: boolean;
}

interface ReflectionQuestion {
  id: string;
  question: string;
  type: 'text' | 'journal' | 'discussion';
  required: boolean;
  wordLimit?: number;
}

interface LessonContent {
  id: string;
  title: string;
  type: 'video' | 'quiz' | 'interactive' | 'resource' | 'reflection';
  order: number;
  required: boolean;
  estimatedDuration: number;
  content: VideoContent | Quiz | InteractiveElement | Resource | ReflectionQuestion;
}

const CourseEditModal: React.FC<CourseEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  course,
  mode
}) => {
  const [formData, setFormData] = useState<Course>(buildDefaultCourse());

  const [currentTag, setCurrentTag] = useState('');
  const [currentObjective, setCurrentObjective] = useState('');
  const [currentPrerequisite, setCurrentPrerequisite] = useState('');
  const [activeTab, setActiveTab] = useState('basic');

  // Enhanced content management state
  const [lessonContents, setLessonContents] = useState<LessonContent[]>([]);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [contentType, setContentType] = useState<'video' | 'quiz' | 'interactive' | 'resource' | 'reflection'>('video');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autosaveTimer, setAutosaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [modalFormData, setModalFormData] = useState<any>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<LessonContent | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'quiz' | 'interactive' | 'resource' | 'reflection'>('all');
  const [selectedContent, setSelectedContent] = useState<string[]>([]);
  
  // Phase 3: Advanced Analytics & AI Features
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [optimizationScore, setOptimizationScore] = useState(0);
  const [learningPathSuggestions] = useState<any[]>([]);

  useEffect(() => {
    if (course && mode === 'edit') {
      setFormData({ ...course });
    } else if (mode === 'create') {
      const resetCourse = buildDefaultCourse();
      setFormData(resetCourse);
      setLessonContents([]);
      setSelectedContent([]);
      setCurrentTag('');
      setCurrentObjective('');
      setCurrentPrerequisite('');
      setActiveTab('basic');
      setSuccessMessage(null);
      setAiSuggestions([]);
      setSearchFilter('');
      setTypeFilter('all');
    }
  }, [course, mode, isOpen]);



  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const updatedAt = new Date().toISOString();
      if (field === 'title' && mode === 'create') {
        const normalizedSlug = slugify(String(value || prev.slug || prev.id));
        return {
          ...prev,
          title: value,
          slug: normalizedSlug,
          updatedAt
        };
      }
      return {
        ...prev,
        [field]: value,
        updatedAt
      };
    });
    
    // Trigger autosave for any form changes
    if (mode === 'edit') {
      triggerAutosave();
    }
  };



  const addTag = () => {
    if (currentTag.trim() && !(formData.tags || []).includes(currentTag.trim())) {
      handleInputChange('tags', [...(formData.tags || []), currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleInputChange('tags', (formData.tags || []).filter(tag => tag !== tagToRemove));
  };

  const addLearningObjective = () => {
    if (currentObjective.trim()) {
      handleInputChange('learningObjectives', [...(formData.learningObjectives || []), currentObjective.trim()]);
      setCurrentObjective('');
    }
  };

  const removeLearningObjective = (index: number) => {
    handleInputChange('learningObjectives', (formData.learningObjectives || []).filter((_, i) => i !== index));
  };

  const addPrerequisite = () => {
    if (currentPrerequisite.trim()) {
      handleInputChange('prerequisites', [...(formData.prerequisites || []), currentPrerequisite.trim()]);
      setCurrentPrerequisite('');
    }
  };

  const removePrerequisite = (index: number) => {
    handleInputChange('prerequisites', (formData.prerequisites || []).filter((_, i) => i !== index));
  };

  // Enhanced content management functions with debounced autosave
  const triggerAutosave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    
    // Show saving indicator after typing stops
    setAutosaveStatus('saving');
    
    setAutosaveTimer(setTimeout(() => {
      // Auto-save current form data
      if (mode === 'edit' && course) {
        const updatedCourse = {
          ...course,
          ...formData,
          lastUpdated: new Date().toISOString()
        };
        
        try {
          onSave(updatedCourse);
          setAutosaveStatus('saved');
          console.log('✅ Auto-saved course:', updatedCourse.title);
          
          // Clear saved status after 2 seconds
          setTimeout(() => setAutosaveStatus('idle'), 2000);
        } catch (error) {
          setAutosaveStatus('error');
          console.error('❌ Auto-save failed:', error);
          
          // Clear error status after 3 seconds
          setTimeout(() => setAutosaveStatus('idle'), 3000);
        }
      } else {
        setAutosaveStatus('idle');
      }
    }, 10000)); // autosave after 10 seconds of inactivity
  };

  const createContentFromModal = (formData: any) => {
    let newContent: LessonContent;
    
    switch (contentType) {
      case 'video': {
        // Handle file upload
        let videoUrl = formData.videoUrl;
        
        if (formData.videoSource === 'upload' && formData.videoFile) {
          console.log('📹 Processing uploaded video file:', {
            fileName: formData.videoFile.name,
            fileSize: formData.videoFile.size,
            fileType: formData.videoFile.type
          });
          
          // For now, store file metadata but use fallback video in LMS
          // This provides a clear indication that file upload functionality 
          // needs proper cloud storage implementation
          videoUrl = `uploaded:${formData.videoFile.name}`;
          
          console.log('📹 Marked as uploaded video, will use fallback in LMS:', videoUrl);
          
        } else if (!videoUrl || videoUrl.trim() === '') {
          // Don't set a default URL here - let the LMS handle fallback
          videoUrl = undefined;
        }
        
        console.log('🎥 Creating video content with:', {
          videoSource: formData.videoSource,
          videoFile: formData.videoFile?.name,
          videoUrl: formData.videoUrl,
          finalVideoUrl: videoUrl,
          hasFile: !!formData.videoFile
        });
        
        newContent = {
          id: `lesson-${Date.now()}`,
          title: formData.title || 'New Video',
          type: 'video',
          order: lessonContents.length + 1,
          required: true,
          estimatedDuration: formData.duration || 10,
          content: {
            id: `video-${Date.now()}`,
            type: formData.videoSource || 'upload',
            title: formData.title || 'New Video',
            description: formData.description,
            url: videoUrl,
            file: formData.videoSource === 'upload' ? formData.videoFile : undefined,
            thumbnail: formData.thumbnail,
            duration: formData.videoDuration,
            transcriptFile: formData.transcriptFile,
            captionsFile: formData.captionsFile,
            transcriptName: formData.transcriptName,
            captionsName: formData.captionsName,
            watchPercentage: formData.watchPercentage || 80,
            resumeFromLastPosition: formData.resumeFromLastPosition !== false,
            markAsWatched: formData.markAsWatched !== false,
            settings: {
              requireWatchPercentage: formData.watchPercentage || 80,
              resumeFromLastPosition: formData.resumeFromLastPosition !== false,
              markAsWatched: formData.markAsWatched !== false,
            }
          }
        };
        break;
      }
      case 'quiz': {
        newContent = {
          id: `lesson-${Date.now()}`,
          title: formData.title || 'New Quiz',
          type: 'quiz',
          order: lessonContents.length + 1,
          required: true,
          estimatedDuration: formData.duration || 15,
          content: {
            id: `quiz-${Date.now()}`,
            title: formData.title || 'New Quiz',
            description: formData.description,
            questions: [],
            settings: {
              passingScore: formData.passingScore || 80,
              maxAttempts: formData.maxAttempts || 3,
              randomizeQuestions: false,
              showExplanations: true,
            }
          }
        };
        break;
      }
      case 'interactive': {
        newContent = {
          id: `lesson-${Date.now()}`,
          title: formData.title || 'New Interactive',
          type: 'interactive',
          order: lessonContents.length + 1,
          required: true,
          estimatedDuration: formData.duration || 20,
          content: {
            id: `interactive-${Date.now()}`,
            type: formData.interactiveType || 'drag-drop',
            title: formData.title || 'New Interactive',
            description: formData.description,
            content: {},
            settings: {
              maxAttempts: 3,
              passingScore: 80,
              showFeedback: true,
            }
          }
        };
        break;
      }
      case 'resource': {
        newContent = {
          id: `lesson-${Date.now()}`,
          title: formData.title || 'New Resource',
          type: 'resource',
          order: lessonContents.length + 1,
          required: false,
          estimatedDuration: formData.duration || 5,
          content: {
            id: `resource-${Date.now()}`,
            title: formData.title || 'New Resource',
            description: formData.description,
            type: formData.resourceType || 'pdf',
            url: formData.url,
            downloadable: formData.downloadable !== false,
          }
        };
        break;
      }
      case 'reflection': {
        newContent = {
          id: `lesson-${Date.now()}`,
          title: formData.title || 'New Reflection',
          type: 'reflection',
          order: lessonContents.length + 1,
          required: formData.required || false,
          estimatedDuration: formData.duration || 10,
          content: {
            id: `reflection-${Date.now()}`,
            question: formData.question || 'Reflection question',
            type: 'text',
            required: formData.required || false,
            wordLimit: formData.wordLimit || 500,
          }
        };
        break;
      }
      default: {
        return;
      }
    }
    
    // Add content to lesson contents
    setLessonContents(prev => [...prev, newContent]);
    
    // Return the new content for confirmation
    return newContent;
  };

  const removeLessonContent = (id: string) => {
    if (confirm('Are you sure you want to delete this content item?')) {
      setLessonContents(prev => prev.filter(item => item.id !== id));
      triggerAutosave();
      console.log(`🗑️ Removed content item: ${id}`);
    }
  };

  const handleEditContent = (content: LessonContent) => {
    // Populate modal with existing content data for editing
    setContentType(content.type);
    
    // Convert content back to modal form data format
    const editFormData: any = {
      title: content.title,
      duration: content.estimatedDuration,
      required: content.required
    };

    // Add type-specific data
    if (content.type === 'video' && 'url' in content.content) {
      editFormData.videoUrl = content.content.url;
      editFormData.description = content.content.description;
      editFormData.videoSource = content.content.type;
    } else if (content.type === 'quiz' && 'questions' in content.content) {
      editFormData.description = content.content.description;
      editFormData.passingScore = content.content.settings?.passingScore || 80;
      editFormData.maxAttempts = content.content.settings?.maxAttempts || 3;
    } else if (content.type === 'resource' && 'url' in content.content) {
      const resourceContent = content.content as Resource;
      editFormData.description = resourceContent.description;
      editFormData.url = resourceContent.url;
      editFormData.resourceType = resourceContent.type;
      editFormData.downloadable = resourceContent.downloadable;
    } else if (content.type === 'reflection' && 'question' in content.content) {
      editFormData.question = content.content.question;
      editFormData.wordLimit = content.content.wordLimit;
    }

    setModalFormData(editFormData);
    setContentModalOpen(true);
    
    // Remove the original content since we'll replace it when saving
    removeLessonContent(content.id);
  };

  const handlePreviewContent = (content: LessonContent) => {
    // Create a simple preview modal or alert
    const contentInfo = `
Title: ${content.title}
Type: ${content.type.charAt(0).toUpperCase() + content.type.slice(1)}
Duration: ${content.estimatedDuration} minutes
Required: ${content.required ? 'Yes' : 'No'}
${content.type === 'video' && 'url' in content.content ? `\nVideo URL: ${content.content.url}` : ''}
${content.type === 'quiz' && 'questions' in content.content ? `\nQuestions: ${content.content.questions?.length || 0}` : ''}
    `.trim();
    
    alert(`Content Preview:\n\n${contentInfo}`);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, content: LessonContent) => {
    setDraggedItem(content);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetContent: LessonContent) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.id === targetContent.id) return;

    const reorderedContent = [...lessonContents];
    const draggedIndex = reorderedContent.findIndex(item => item.id === draggedItem.id);
    const targetIndex = reorderedContent.findIndex(item => item.id === targetContent.id);

    // Remove dragged item and insert at target position
    reorderedContent.splice(draggedIndex, 1);
    reorderedContent.splice(targetIndex, 0, draggedItem);

    // Update order numbers
    reorderedContent.forEach((item, index) => {
      item.order = index + 1;
    });

    setLessonContents(reorderedContent);
    setDraggedItem(null);
    triggerAutosave();
    
    setSuccessMessage(`✅ Moved "${draggedItem.title}" to position ${targetIndex + 1}`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Filter content based on search and type
  const filteredContent = lessonContents.filter(content => {
    const matchesSearch = content.title.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesType = typeFilter === 'all' || content.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Bulk operations
  const handleBulkDelete = (selectedIds: string[]) => {
    if (selectedIds.length === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedIds.length} content items?`)) {
      setLessonContents(prev => prev.filter(item => !selectedIds.includes(item.id)));
      triggerAutosave();
      setSuccessMessage(`✅ Deleted ${selectedIds.length} content items`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const duplicateContent = (content: LessonContent) => {
    const duplicatedContent: LessonContent = {
      ...content,
      id: `lesson-${Date.now()}`,
      title: `${content.title} (Copy)`,
      order: lessonContents.length + 1
    };
    
    setLessonContents(prev => [...prev, duplicatedContent]);
    triggerAutosave();
    
    setSuccessMessage(`✅ Duplicated "${content.title}"`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleFileUpload = (file: File, type: 'video' | 'resource') => {
    if (type === 'video') {
      const allowedVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
      if (!allowedVideoTypes.includes(file.type)) {
        alert('Please upload a valid video file (MP4, MOV, AVI, WebM)');
        return;
      }
    }
    
    // Create a URL for the file to show preview
    const fileUrl = URL.createObjectURL(file);
    console.log('File uploaded:', file.name, fileUrl);
    // Here you would typically upload to your CDN/storage service
  };

  const openContentModal = (type: 'video' | 'quiz' | 'interactive' | 'resource' | 'reflection') => {
    setContentType(type);
    setModalFormData({});
    setContentModalOpen(true);
  };

  const handleModalInputChange = (field: string, value: any) => {
    setModalFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddContent = () => {
    if (!modalFormData.title?.trim()) {
      alert('Please enter a title');
      return;
    }
    
    // Validate required fields based on content type
    if (contentType === 'video' && modalFormData.videoSource === 'url' && !modalFormData.videoUrl?.trim()) {
      alert('Please enter a video URL');
      return;
    }
    
    if (contentType === 'resource' && !modalFormData.url?.trim()) {
      alert('Please enter a resource URL');
      return;
    }
    
    if (contentType === 'reflection' && !modalFormData.question?.trim()) {
      alert('Please enter a reflection question');
      return;
    }
    
    // Create and add the content
    createContentFromModal(modalFormData);
    
    // Update course metadata
    const newLessonCount = lessonContents.length + 1;
    const totalDuration = lessonContents.reduce((total, item) => total + item.estimatedDuration, 0) + (modalFormData.duration || 10);
    
    handleInputChange('lessons', newLessonCount);
    handleInputChange('duration', `${totalDuration} min`);
    handleInputChange('estimatedTime', `${totalDuration} minutes`);
    
    // Clear modal form data and close modal
    setModalFormData({});
    setContentModalOpen(false);
    
    // Show success message
    const contentTypeName = contentType.charAt(0).toUpperCase() + contentType.slice(1);
    setSuccessMessage(`✅ ${contentTypeName} "${modalFormData.title}" added successfully!`);
    console.log(`✅ Added ${contentType}:`, modalFormData.title);
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000);
    
    // Trigger autosave to persist changes immediately
    triggerAutosave();
  };

  const formatValidationIssues = (issues: CourseValidationIssue[]): string => {
    const blocking = issues.filter((issue) => issue.severity === 'error');
    if (blocking.length === 0) {
      return '';
    }
    return blocking.map((issue, index) => `${index + 1}. ${issue.message}`).join('\n');
  };

  const buildCoursePayload = (overrides: Partial<Course> = {}) => {
    const convertedModules = convertLessonContentsToModules();
    const status = overrides.status ?? formData.status ?? 'draft';
    const normalizedSlug = slugify(
      overrides.slug || formData.slug || formData.title || formData.id,
    );

    return {
      ...formData,
      ...overrides,
      status,
      modules: convertedModules,
      slug: normalizedSlug,
    } as Course;
  };

  const handleSave = () => {
    const coursePayload = buildCoursePayload();
    const summary = getCourseValidationSummary(
      coursePayload,
      coursePayload.status === 'published' ? 'publish' : 'draft',
    );
    const validationIssues = summary.issues ?? [];

    if (!summary.isValid) {
      const message = formatValidationIssues(validationIssues);
      alert(`Please fix the following issues:\n\n${message}`);
      return;
    }

    if (optimizationScore >= 80) {
      setSuccessMessage('🎉 Excellent! Your course meets all quality standards.');
    } else if (optimizationScore >= 60) {
      setSuccessMessage('✅ Good course structure. Consider the optimization suggestions for even better results.');
    } else {
      setSuccessMessage('✅ Course saved. Check the Analytics tab for improvement suggestions.');
    }

    console.log('💾 Saving course with enhanced data:', {
      formData: coursePayload,
      lessonContents,
      convertedModules: coursePayload.modules,
    });

    setTimeout(() => setSuccessMessage(null), 5000);
    onSave(coursePayload);
  };

  // Convert our enhanced lesson contents to courseStore modules format
  const convertLessonContentsToModules = () => {
    if (lessonContents.length === 0) {
      return formData.modules || [];
    }

    // Group content by type for better organization (LinkedIn Learning style)
    const videoContent = lessonContents.filter(c => c.type === 'video');
    const quizContent = lessonContents.filter(c => c.type === 'quiz');
    const interactiveContent = lessonContents.filter(c => c.type === 'interactive');
    const resourceContent = lessonContents.filter(c => c.type === 'resource');
    const reflectionContent = lessonContents.filter(c => c.type === 'reflection');

    const modules: any[] = [];

    // Create main content module
    if (videoContent.length > 0 || interactiveContent.length > 0) {
      modules.push({
        id: `module-content-${Date.now()}`,
        title: 'Course Content',
        description: 'Main learning materials and interactive elements',
        duration: `${Math.max(videoContent.reduce((sum, v) => sum + (v.estimatedDuration || 0), 0) + interactiveContent.reduce((sum, i) => sum + (i.estimatedDuration || 0), 0), 5)} min`,
        order: 1,
        lessons: [...videoContent, ...interactiveContent]
          .sort((a, b) => a.order - b.order)
          .map(content => convertLessonContentToLesson(content)),
        resources: []
      });
    }

    // Create assessment module if there are quizzes
    if (quizContent.length > 0) {
      modules.push({
        id: `module-assessments-${Date.now()}`,
        title: 'Knowledge Assessment',
        description: 'Test your understanding with interactive quizzes',
        duration: `${quizContent.reduce((sum, q) => sum + (q.estimatedDuration || 0), 0)} min`,
        order: 2,
        lessons: quizContent
          .sort((a, b) => a.order - b.order)
          .map(content => convertLessonContentToLesson(content)),
        resources: []
      });
    }

    // Create reflection module if there are reflections
    if (reflectionContent.length > 0) {
      modules.push({
        id: `module-reflection-${Date.now()}`,
        title: 'Reflection & Application',
        description: 'Apply your learning and reflect on key concepts',
        duration: `${reflectionContent.reduce((sum, r) => sum + (r.estimatedDuration || 0), 0)} min`,
        order: 3,
        lessons: reflectionContent
          .sort((a, b) => a.order - b.order)
          .map(content => convertLessonContentToLesson(content)),
        resources: []
      });
    }

    // Convert resources to the resources array
    const convertedResources = resourceContent.map(resource => ({
      id: resource.id,
      title: resource.title,
      type: typeof resource.content === 'object' && resource.content && 'fileUrl' in resource.content ? 'file' : 'link',
      size: '0 MB', // Could be enhanced to track actual file sizes
      downloadUrl: typeof resource.content === 'object' && resource.content && 'fileUrl' in resource.content 
        ? (resource.content as any).fileUrl 
        : typeof resource.content === 'object' && resource.content && 'url' in resource.content 
          ? (resource.content as any).url 
          : '#'
    }));

    // Add resources to the first module or create a resources module
    if (modules.length > 0) {
      modules[0].resources = convertedResources;
    } else if (convertedResources.length > 0) {
      modules.push({
        id: `module-resources-${Date.now()}`,
        title: 'Course Resources',
        description: 'Additional materials and downloads',
        duration: '5 min',
        order: 1,
        lessons: [],
        resources: convertedResources
      });
    }

    return modules;
  };

  // Convert our LessonContent to courseStore Lesson format
  const convertLessonContentToLesson = (content: any) => {
    console.log('🔧 Converting lesson content:', {
      title: content.title,
      type: content.type,
      rawContent: content.content,
      hasContentObject: typeof content.content === 'object' && content.content
    });
    
    const lesson: any = {
      id: content.id,
      title: content.title,
      type: content.type,
      duration: `${content.estimatedDuration || 5} min`,
      completed: false,
      order: content.order,
      content: {}
    };

    // Convert content based on type
    switch (content.type) {
      case 'video':
        if (typeof content.content === 'object' && content.content) {
          const videoContent = content.content as any;
          
          // Check for valid video URLs from various sources
          const videoUrl = videoContent.url || videoContent.videoUrl;
          const hasValidUrl = videoUrl && videoUrl.trim() !== '';
          
          console.log('🎬 Processing video content:', {
            videoContent,
            videoUrl,
            hasValidUrl,
            isBlobUrl: videoUrl?.startsWith('blob:'),
            videoSourceType: videoContent.type
          });
          
          lesson.content = {
            videoUrl: hasValidUrl ? videoUrl : undefined,
            videoSourceType: videoContent.type === 'url' ? 'external' : 'internal',
            transcript: videoContent.transcript || videoContent.transcriptFile || undefined,
            notes: content.description || videoContent.description || 'Video lesson content'
          };
        } else {
          // No video content object - leave videoUrl undefined so fallback is used
          lesson.content = {
            videoUrl: undefined,
            videoSourceType: 'external',
            transcript: undefined,
            notes: content.description || 'Video lesson content'
          };
        }
        break;
      
      case 'quiz':
        if (typeof content.content === 'object' && content.content) {
          lesson.content = {
            questions: (content.content as any).questions || [],
            passingScore: (content.content as any).settings?.passingScore || 80,
            allowRetakes: true,
            showCorrectAnswers: true
          };
        }
        break;
      
      case 'interactive':
        lesson.content = {
          exerciseType: 'scenario',
          instructions: content.description,
          options: [
            { text: 'Continue Learning', feedback: 'Great choice!', isCorrect: true }
          ]
        };
        break;
      
      case 'reflection':
        lesson.content = {
          content: content.description,
          reflectionPrompt: content.title,
          allowReflection: true,
          requireReflection: content.required || false
        };
        lesson.type = 'text'; // Map reflection to text type in courseStore
        break;
    }

    return lesson;
  };

  const handlePublish = () => {
    const coursePayload = buildCoursePayload({ status: 'published' });
    const summary = getCourseValidationSummary(coursePayload, 'publish');
    const validationIssues = summary.issues ?? [];
    if (!summary.isValid) {
      const message = formatValidationIssues(validationIssues);
      alert(`Cannot publish course. Please fix the following:\n\n${message}`);
      return;
    }

    if (!confirm('Are you sure you want to publish this course? This will make it visible to learners.')) return;

    const nextVersion = (formData as any).version ? Number((formData as any).version) + 1 : 1;
    const payload = {
      version: nextVersion,
    };

    (async () => {
      try {
        setAutosaveStatus('saving');
        const result = await apiRequest<{ data: any }>(
          `/api/admin/courses/${encodeURIComponent(formData.id)}/publish`,
          {
            method: 'POST',
            body: payload,
          },
        );
        const saved = result?.data || null;
        if (!saved) throw new Error('Publish returned no course data');

        onSave(saved);
        setSuccessMessage('✅ Course published successfully');
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2000);
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err: any) {
        console.error('Publish error:', err);
        setAutosaveStatus('error');
        alert(`Publish failed: ${err?.message || String(err)}`);
        setTimeout(() => setAutosaveStatus('idle'), 3000);
      }
    })();
  };

  // Calculate content counts by type
  const contentCounts = {
    video: lessonContents.filter(c => c.type === 'video').length,
    quiz: lessonContents.filter(c => c.type === 'quiz').length,
    interactive: lessonContents.filter(c => c.type === 'interactive').length,
    resource: lessonContents.filter(c => c.type === 'resource').length,
    reflection: lessonContents.filter(c => c.type === 'reflection').length
  };

  // Phase 3: Calculate optimization score based on course completeness
  useEffect(() => {
    const calculateOptimizationScore = () => {
      let score = 0;
      
      // Basic info completeness (30 points)
      if (formData.title && formData.title.length > 5) score += 10;
      if (formData.description && formData.description.length > 50) score += 10;
      if (formData.type) score += 5; // Using type instead of category
      if (formData.difficulty) score += 5;
      
      // Content diversity (40 points)
      if (contentCounts.video > 0) score += 10;
      if (contentCounts.quiz > 0) score += 10;
      if (contentCounts.interactive > 0) score += 10;
      if (contentCounts.resource > 0) score += 5;
      if (contentCounts.reflection > 0) score += 5;
      
      // Content quantity (20 points)
      const totalContent = lessonContents.length;
      if (totalContent >= 3) score += 5;
      if (totalContent >= 5) score += 5;
      if (totalContent >= 8) score += 5;
      if (totalContent >= 10) score += 5;
      
      // Learning objectives and structure (10 points)
      if (formData.learningObjectives && formData.learningObjectives.length > 0) score += 5;
      if (formData.prerequisites && formData.prerequisites.length > 0) score += 3;
      if (formData.tags && formData.tags.length > 0) score += 2;
      
      setOptimizationScore(Math.min(score, 100));
    };
    
    calculateOptimizationScore();
  }, [formData, lessonContents, contentCounts]);

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: BookOpen },
    { id: 'content', label: 'Course Content', icon: FileText, count: lessonContents.length },
    { id: 'videos', label: 'Videos', icon: Video, count: contentCounts.video },
    { id: 'quizzes', label: 'Quizzes', icon: ListChecks, count: contentCounts.quiz },
    { id: 'interactive', label: 'Interactive', icon: Zap, count: contentCounts.interactive },
    { id: 'resources', label: 'Resources', icon: Download, count: contentCounts.resource },
    { id: 'reflections', label: 'Reflections', icon: HelpCircle, count: contentCounts.reflection },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, badge: optimizationScore > 0 ? optimizationScore + '%' : undefined },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Brain, badge: aiSuggestions.length > 0 ? aiSuggestions.length : undefined },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'enrollment', label: 'Enrollment', icon: Users },
    { id: 'certification', label: 'Certification', icon: Star }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? 'Create New Course' : 'Edit Course'}
            </h2>
            
            {/* Autosave Status Indicator */}
            {mode === 'edit' && (
              <div className="flex items-center space-x-2">
                {autosaveStatus === 'saving' && (
                  <div className="flex items-center text-blue-600 text-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                    Saving...
                  </div>
                )}
                {autosaveStatus === 'saved' && (
                  <div className="flex items-center text-green-600 text-sm">
                    <div className="h-3 w-3 bg-green-600 rounded-full mr-2"></div>
                    Saved
                  </div>
                )}
                {autosaveStatus === 'error' && (
                  <div className="flex items-center text-red-600 text-sm">
                    <div className="h-3 w-3 bg-red-600 rounded-full mr-2"></div>
                    Save failed
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Global Content Search & Filter */}
        {activeTab !== 'basic' && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search content..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'video' | 'quiz' | 'interactive' | 'resource' | 'reflection')}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="video">Videos</option>
                <option value="quiz">Quizzes</option>
                <option value="resource">Resources</option>
                <option value="reflection">Reflections</option>
                <option value="interactive">Interactive</option>
              </select>

              {selectedContent.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedContent.length} selected
                  </span>
                  <button
                    onClick={() => handleBulkDelete(selectedContent)}
                    className="flex items-center px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                  <button
                    onClick={() => setSelectedContent([])}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-orange-500 rounded-full">
                      {tab.count}
                    </span>
                  )}
                  {(tab as any).badge !== undefined && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-500 rounded-full">
                      {(tab as any).badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Enter course title"
                    data-test="course-modal-title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select Category</option>
                    <option value="DEI">Diversity, Equity & Inclusion</option>
                    <option value="Leadership">Leadership</option>
                    <option value="Communication">Communication</option>
                    <option value="Professional Development">Professional Development</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Technical">Technical Skills</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="video">Video Course</option>
                    <option value="interactive">Interactive</option>
                    <option value="worksheet">Worksheet</option>
                    <option value="case-study">Case Study</option>
                    <option value="assessment">Assessment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => handleInputChange('difficulty', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                  />
                </div>


              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Describe the course content and what learners will gain"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(formData.tags || []).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-orange-600 hover:text-orange-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Add a tag"
                  />
                  <button
                    onClick={addTag}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6">
              {/* Course Content Overview */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Course Content Structure</h3>
                <p className="text-gray-600 mb-4">
                  Build your course with engaging videos, interactive quizzes, resources, and reflection activities.
                </p>
                
                {/* Add Content Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => openContentModal('video')}
                    className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Add Video
                  </button>
                  <button
                    onClick={() => openContentModal('quiz')}
                    className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200"
                  >
                    <ListChecks className="h-4 w-4 mr-2" />
                    Add Quiz
                  </button>
                  <button
                    onClick={() => openContentModal('interactive')}
                    className="flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors duration-200"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Add Interactive
                  </button>
                  <button
                    onClick={() => openContentModal('resource')}
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Add Resource
                  </button>
                  <button
                    onClick={() => openContentModal('reflection')}
                    className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-200"
                  >
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Add Reflection
                  </button>
                </div>
              </div>

              {/* Learning Objectives */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Learning Objectives
                </label>
                <div className="space-y-2 mb-3">
                  {(formData.learningObjectives || []).map((objective, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <span className="text-sm">{objective}</span>
                      <button
                        onClick={() => removeLearningObjective(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentObjective}
                    onChange={(e) => setCurrentObjective(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addLearningObjective()}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Add learning objective"
                  />
                  <button
                    onClick={addLearningObjective}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Success Message */}
              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                  {successMessage}
                </div>
              )}

              {/* Search and Filter Controls */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Search Content</label>
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search by title..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div className="sm:w-48">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="all">All Types</option>
                      <option value="video">Videos</option>
                      <option value="quiz">Quizzes</option>
                      <option value="interactive">Interactive</option>
                      <option value="resource">Resources</option>
                      <option value="reflection">Reflections</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Content Items List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Lesson Content ({filteredContent.length} of {lessonContents.length} items)
                  </h3>
                  {filteredContent.length > 1 && (
                    <p className="text-sm text-gray-500">💡 Tip: Drag items to reorder them</p>
                  )}
                </div>
                {filteredContent.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    {lessonContents.length === 0 ? (
                      <>
                        <p className="text-gray-500 mb-4">No content added yet</p>
                        <p className="text-sm text-gray-400">Use the buttons above to add videos, quizzes, and other content</p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-500 mb-4">No content matches your filters</p>
                        <p className="text-sm text-gray-400">Try adjusting your search or filter settings</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredContent
                      .sort((a, b) => a.order - b.order)
                      .map((content) => (
                        <div 
                          key={content.id} 
                          className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-move"
                          draggable
                          onDragStart={(e) => handleDragStart(e, content)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, content)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2 text-gray-500" title="Drag to reorder">
                                <Move className="h-4 w-4 cursor-move" />
                                <span className="text-sm font-medium">#{content.order}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                {content.type === 'video' && <Video className="h-5 w-5 text-red-500" />}
                                {content.type === 'quiz' && <ListChecks className="h-5 w-5 text-green-500" />}
                                {content.type === 'interactive' && <Zap className="h-5 w-5 text-purple-500" />}
                                {content.type === 'resource' && <Download className="h-5 w-5 text-blue-500" />}
                                {content.type === 'reflection' && <HelpCircle className="h-5 w-5 text-orange-500" />}
                                <div>
                                  <h4 className="font-medium text-gray-900">{content.title}</h4>
                                  <p className="text-sm text-gray-500 capitalize">
                                    {content.type} • {content.estimatedDuration} min
                                    {content.required && <span className="text-red-500"> • Required</span>}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleEditContent(content)}
                                className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-50"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => duplicateContent(content)}
                                className="p-2 text-gray-600 hover:text-purple-600 rounded-lg hover:bg-gray-50"
                                title="Duplicate"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handlePreviewContent(content)}
                                className="p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-50"
                                title="Preview"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => removeLessonContent(content.id)}
                                className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Prerequisites */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prerequisites
                </label>
                <div className="space-y-2 mb-3">
                  {(formData.prerequisites || []).map((prerequisite, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <span className="text-sm">{prerequisite}</span>
                      <button
                        onClick={() => removePrerequisite(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentPrerequisite}
                    onChange={(e) => setCurrentPrerequisite(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPrerequisite()}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Add prerequisite"
                  />
                  <button
                    onClick={addPrerequisite}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Video Content ({contentCounts.video} videos)
                </h3>
                <button
                  onClick={() => openContentModal('video')}
                  className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Video
                </button>
              </div>

              {/* Existing Videos List */}
              {contentCounts.video > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">Current Videos</h4>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {lessonContents
                      .filter(content => content.type === 'video')
                      .sort((a, b) => a.order - b.order)
                      .map((video) => (
                        <div key={video.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-lg">
                                <Video className="h-5 w-5 text-red-600" />
                              </div>
                              <div>
                                <h5 className="font-medium text-gray-900">{video.title}</h5>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  <span>#{video.order}</span>
                                  <span>{video.estimatedDuration} min</span>
                                  {video.required && <span className="text-red-500">Required</span>}
                                  {'url' in video.content && video.content.url && (
                                    <span className="text-green-600">Has video</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleEditContent(video)}
                                className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                                title="Edit Video"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handlePreviewContent(video)}
                                className="p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-100"
                                title="Preview Video"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => removeLessonContent(video.id)}
                                className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100"
                                title="Delete Video"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Video Upload/URL Section */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">Add New Video</h4>
                
                {/* Video Type Selection */}
                <div className="mb-4">
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input type="radio" name="videoType" value="upload" className="mr-2" defaultChecked />
                      <Upload className="h-4 w-4 mr-2 text-gray-600" />
                      Upload Video File
                    </label>
                    <label className="flex items-center">
                      <input type="radio" name="videoType" value="url" className="mr-2" />
                      <LinkIcon className="h-4 w-4 mr-2 text-gray-600" />
                      Video URL
                    </label>
                  </div>
                </div>

                {/* File Upload */}
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/mov,video/avi,video/webm"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'video')}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-red-400 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload video or drag and drop</p>
                    <p className="text-xs text-gray-500 mt-1">MP4, MOV, AVI, WebM up to 500MB</p>
                  </div>
                </div>

                {/* URL Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video URL (YouTube, Vimeo, or direct link)
                  </label>
                  <input
                    type="url"
                    placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Video Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Required Watch %
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="50">50%</option>
                      <option value="75">75%</option>
                      <option value="85" selected>85%</option>
                      <option value="100">100%</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="resume" className="mr-2" defaultChecked />
                    <label htmlFor="resume" className="text-sm text-gray-700">Resume from last position</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="markWatched" className="mr-2" defaultChecked />
                    <label htmlFor="markWatched" className="text-sm text-gray-700">Mark as watched when complete</label>
                  </div>
                </div>

                {/* Caption/Transcript Upload */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transcript (Optional)
                    </label>
                    <input type="file" accept=".txt,.srt" className="w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Captions (VTT)
                    </label>
                    <input type="file" accept=".vtt" className="w-full text-sm" />
                  </div>
                </div>
              </div>

              {/* Video Preview */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
                <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <Play className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Video preview will appear here</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quizzes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Quiz & Assessments ({contentCounts.quiz} quizzes)
                </h3>
                <button
                  onClick={() => openContentModal('quiz')}
                  className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Quiz
                </button>
              </div>

              {/* Existing Quizzes List */}
              {contentCounts.quiz > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">Current Quizzes</h4>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {lessonContents
                      .filter(content => content.type === 'quiz')
                      .sort((a, b) => a.order - b.order)
                      .map((quiz) => (
                        <div key={quiz.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <h5 className="font-medium text-gray-900">{quiz.title}</h5>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  <span>#{quiz.order}</span>
                                  <span>{quiz.estimatedDuration} min</span>
                                  {quiz.required && <span className="text-red-500">Required</span>}
                                  {'questions' in quiz.content && (
                                    <span className="text-green-600">
                                      {Array.isArray(quiz.content.questions) 
                                        ? `${quiz.content.questions.length} questions`
                                        : 'Has questions'
                                      }
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleEditContent(quiz)}
                                className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                                title="Edit Quiz"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handlePreviewContent(quiz)}
                                className="p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-100"
                                title="Preview Quiz"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => duplicateContent(quiz)}
                                className="p-2 text-gray-600 hover:text-purple-600 rounded-lg hover:bg-gray-100"
                                title="Duplicate Quiz"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => removeLessonContent(quiz.id)}
                                className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100"
                                title="Delete Quiz"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Quiz Builder */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">Quiz Builder</h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title</label>
                      <input 
                        type="text" 
                        placeholder="Enter quiz title"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="multi-select">Multi-Select</option>
                        <option value="true-false">True/False</option>
                        <option value="short-answer">Short Answer</option>
                        <option value="likert">Likert Scale</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                    <textarea 
                      rows={3}
                      placeholder="Enter your question"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* Answer Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((num) => (
                        <div key={num} className="flex items-center space-x-2">
                          <input type="radio" name="correct" className="text-green-500" />
                          <input 
                            type="text" 
                            placeholder={`Option ${num}`}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                          <button className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button className="text-green-500 text-sm hover:text-green-700">+ Add Option</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
                    <textarea 
                      rows={2}
                      placeholder="Explain why this is the correct answer"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* Quiz Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time Limit (minutes)</label>
                      <input type="number" placeholder="30" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%)</label>
                      <input type="number" placeholder="80" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Attempts</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3" selected>3</option>
                        <option value="unlimited">Unlimited</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" defaultChecked />
                      <span className="text-sm text-gray-700">Randomize question order</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" defaultChecked />
                      <span className="text-sm text-gray-700">Show explanations after submission</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'interactive' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Interactive Elements</h3>
                <button
                  onClick={() => openContentModal('interactive')}
                  className="flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Interactive
                </button>
              </div>

              {/* Interactive Types */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center mb-4">
                    <Zap className="h-6 w-6 text-purple-500 mr-3" />
                    <h4 className="font-medium text-gray-900">Drag & Drop Exercise</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Create interactive drag-and-drop activities for hands-on learning.</p>
                  <button className="text-purple-500 text-sm font-medium hover:text-purple-700">Create Exercise</button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center mb-4">
                    <HelpCircle className="h-6 w-6 text-blue-500 mr-3" />
                    <h4 className="font-medium text-gray-900">Branching Scenario</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Build decision-based scenarios with multiple pathways and outcomes.</p>
                  <button className="text-blue-500 text-sm font-medium hover:text-blue-700">Create Scenario</button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center mb-4">
                    <Eye className="h-6 w-6 text-green-500 mr-3" />
                    <h4 className="font-medium text-gray-900">Virtual Simulation</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Create immersive simulations for practical skill development.</p>
                  <button className="text-green-500 text-sm font-medium hover:text-green-700">Create Simulation</button>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center mb-4">
                    <ListChecks className="h-6 w-6 text-orange-500 mr-3" />
                    <h4 className="font-medium text-gray-900">Interactive Checklist</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Guide learners through step-by-step processes with interactive checklists.</p>
                  <button className="text-orange-500 text-sm font-medium hover:text-orange-700">Create Checklist</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Learning Resources ({contentCounts.resource} resources)
                </h3>
                <button
                  onClick={() => openContentModal('resource')}
                  className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Resource
                </button>
              </div>

              {/* Existing Resources List */}
              {contentCounts.resource > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">Current Resources</h4>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {lessonContents
                      .filter(content => content.type === 'resource')
                      .sort((a, b) => a.order - b.order)
                      .map((resource) => (
                        <div key={resource.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                                <Download className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h5 className="font-medium text-gray-900">{resource.title}</h5>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  <span>#{resource.order}</span>
                                  {resource.required && <span className="text-red-500">Required</span>}
                                  {typeof resource.content === 'object' && 
                                   resource.content && 
                                   'fileUrl' in resource.content && 
                                   (resource.content as any).fileUrl && (
                                    <span className="text-blue-600">File attached</span>
                                  )}
                                  {typeof resource.content === 'object' && 
                                   resource.content && 
                                   'url' in resource.content && 
                                   (resource.content as any).url && (
                                    <span className="text-green-600">External link</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleEditContent(resource)}
                                className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                                title="Edit Resource"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handlePreviewContent(resource)}
                                className="p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-100"
                                title="Preview Resource"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => duplicateContent(resource)}
                                className="p-2 text-gray-600 hover:text-purple-600 rounded-lg hover:bg-gray-100"
                                title="Duplicate Resource"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => removeLessonContent(resource.id)}
                                className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100"
                                title="Delete Resource"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Resource Upload */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">Add New Resource</h4>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Resource Title</label>
                      <input 
                        type="text" 
                        placeholder="Enter resource title"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                        <option value="pdf">PDF Document</option>
                        <option value="doc">Word Document</option>
                        <option value="ppt">Presentation</option>
                        <option value="zip">Archive/Zip</option>
                        <option value="link">External Link</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea 
                      rows={2}
                      placeholder="Describe this resource"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* File Upload */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Download className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload file or drag and drop</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOC, PPT, ZIP up to 50MB</p>
                  </div>

                  {/* External Link Alternative */}
                  <div className="text-center text-gray-500">or</div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">External Link</label>
                    <input 
                      type="url" 
                      placeholder="https://example.com/resource"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center">
                    <input type="checkbox" id="downloadable" className="mr-2" defaultChecked />
                    <label htmlFor="downloadable" className="text-sm text-gray-700">Allow download</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reflections' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Reflection Questions ({contentCounts.reflection} reflections)
                </h3>
                <button
                  onClick={() => openContentModal('reflection')}
                  className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Reflection
                </button>
              </div>

              {/* Existing Reflections List */}
              {contentCounts.reflection > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">Current Reflection Activities</h4>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {lessonContents
                      .filter(content => content.type === 'reflection')
                      .sort((a, b) => a.order - b.order)
                      .map((reflection) => (
                        <div key={reflection.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-lg">
                                <HelpCircle className="h-5 w-5 text-orange-600" />
                              </div>
                              <div>
                                <h5 className="font-medium text-gray-900">{reflection.title}</h5>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  <span>#{reflection.order}</span>
                                  <span>{reflection.estimatedDuration} min</span>
                                  {reflection.required && <span className="text-red-500">Required</span>}
                                  <span className="text-orange-600">Reflection Activity</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => handleEditContent(reflection)}
                                className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                                title="Edit Reflection"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handlePreviewContent(reflection)}
                                className="p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-100"
                                title="Preview Reflection"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => duplicateContent(reflection)}
                                className="p-2 text-gray-600 hover:text-purple-600 rounded-lg hover:bg-gray-100"
                                title="Duplicate Reflection"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => removeLessonContent(reflection.id)}
                                className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100"
                                title="Delete Reflection"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Reflection Builder */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-4">Reflection Activity Builder</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reflection Type</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="text">Written Reflection</option>
                      <option value="journal">Journal Entry</option>
                      <option value="discussion">Discussion Question</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reflection Question</label>
                    <textarea 
                      rows={4}
                      placeholder="What question would you like learners to reflect on? Example: 'How will you apply the concepts learned in this module to your current role?'"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Word Limit (Optional)</label>
                      <input 
                        type="number" 
                        placeholder="500"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center pt-6">
                      <input type="checkbox" id="required" className="mr-2" />
                      <label htmlFor="required" className="text-sm text-gray-700">Required for completion</label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Guidance Text (Optional)</label>
                    <textarea 
                      rows={2}
                      placeholder="Provide additional guidance or prompts to help learners with their reflection"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Sample Reflection Questions */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h5 className="font-medium text-blue-900 mb-2">Sample Reflection Questions</h5>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• How will you apply these concepts in your daily work?</li>
                  <li>• What was the most surprising thing you learned?</li>
                  <li>• What challenges might you face when implementing these ideas?</li>
                  <li>• How does this relate to your personal experience?</li>
                  <li>• What questions do you still have about this topic?</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Created By
                </label>
                <input
                  type="text"
                  value={formData.createdBy}
                  onChange={(e) => handleInputChange('createdBy', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Time
                </label>
                <input
                  type="text"
                  value={formData.estimatedTime}
                  onChange={(e) => handleInputChange('estimatedTime', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., 2 hours"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate || ''}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {activeTab === 'enrollment' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Enrollment Count
                </label>
                <input
                  type="number"
                  value={formData.enrollments}
                  onChange={(e) => handleInputChange('enrollments', parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="0"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Rating
                  </label>
                  <input
                    type="number"
                    value={formData.rating}
                    onChange={(e) => handleInputChange('rating', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    max="5"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Count
                  </label>
                  <input
                    type="number"
                    value={formData.totalRatings}
                    onChange={(e) => handleInputChange('totalRatings', parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Course Analytics & Optimization</h3>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <Target className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">Optimization Score:</span>
                    <span className="text-lg font-bold text-green-600">{optimizationScore}%</span>
                  </div>
                </div>
              </div>

              {/* Course Health Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">Content Completeness</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {Math.min(Math.round((lessonContents.length / 5) * 100), 100)}%
                      </p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">Engagement Score</p>
                      <p className="text-2xl font-bold text-green-900">
                        {Math.min(Math.round(85 + (contentCounts.quiz * 3) + (contentCounts.interactive * 5)), 100)}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-700">Learning Paths</p>
                      <p className="text-2xl font-bold text-purple-900">{learningPathSuggestions.length}</p>
                    </div>
                    <Lightbulb className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* Content Analysis */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                  Content Distribution Analysis
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(contentCounts).map(([type, count]) => (
                    <div key={type} className="text-center">
                      <div className={`w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-2 ${
                        type === 'video' ? 'bg-red-100 text-red-600' :
                        type === 'quiz' ? 'bg-green-100 text-green-600' :
                        type === 'interactive' ? 'bg-purple-100 text-purple-600' :
                        type === 'resource' ? 'bg-blue-100 text-blue-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        {type === 'video' && <Video className="h-6 w-6" />}
                        {type === 'quiz' && <ListChecks className="h-6 w-6" />}
                        {type === 'interactive' && <Zap className="h-6 w-6" />}
                        {type === 'resource' && <Download className="h-6 w-6" />}
                        {type === 'reflection' && <HelpCircle className="h-6 w-6" />}
                      </div>
                      <p className="text-lg font-bold text-gray-900">{count}</p>
                      <p className="text-sm text-gray-600 capitalize">{type}s</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optimization Recommendations */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-yellow-600" />
                  Optimization Recommendations
                </h4>
                
                <div className="space-y-3">
                  {lessonContents.length === 0 && (
                    <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800">Add Content</p>
                        <p className="text-sm text-yellow-700">Start by adding videos, quizzes, or interactive content to your course.</p>
                      </div>
                    </div>
                  )}
                  
                  {contentCounts.quiz === 0 && lessonContents.length > 0 && (
                    <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800">Add Assessments</p>
                        <p className="text-sm text-blue-700">Include quizzes to test learner knowledge and increase engagement.</p>
                      </div>
                    </div>
                  )}
                  
                  {contentCounts.interactive === 0 && lessonContents.length > 2 && (
                    <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <Zap className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-purple-800">Boost Interactivity</p>
                        <p className="text-sm text-purple-700">Add interactive elements to make learning more engaging and memorable.</p>
                      </div>
                    </div>
                  )}
                  
                  {lessonContents.length > 5 && contentCounts.reflection === 0 && (
                    <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800">Add Reflection Activities</p>
                        <p className="text-sm text-orange-700">Help learners consolidate knowledge with reflection questions.</p>
                      </div>
                    </div>
                  )}
                  
                  {lessonContents.length > 0 && 
                   Object.values(contentCounts).every(count => count > 0) && (
                    <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <Award className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-800">Excellent Course Structure!</p>
                        <p className="text-sm text-green-700">Your course has a well-balanced mix of content types for optimal learning.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai-assistant' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Brain className="h-5 w-5 mr-2 text-blue-600" />
                  AI-Powered Course Assistant
                </h3>
                <button 
                  onClick={() => {
                    // Mock AI suggestions
                    setAiSuggestions([
                      { type: 'content', title: 'Add Video Introduction', priority: 'high' },
                      { type: 'structure', title: 'Optimize Learning Path', priority: 'medium' },
                      { type: 'engagement', title: 'Add Interactive Quiz', priority: 'high' }
                    ]);
                  }}
                  className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Suggestions
                </button>
              </div>

              {/* AI Suggestions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Content Suggestions</h4>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Lightbulb className="h-5 w-5 text-blue-600 mt-1" />
                          <div>
                            <p className="font-medium text-blue-900">Add Course Introduction Video</p>
                            <p className="text-sm text-blue-700 mt-1">Welcome learners with a 2-3 minute introduction explaining what they'll learn and why it matters.</p>
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Apply</button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Target className="h-5 w-5 text-green-600 mt-1" />
                          <div>
                            <p className="font-medium text-green-900">Knowledge Check Quiz</p>
                            <p className="text-sm text-green-700 mt-1">Add a quick quiz after every 2-3 content pieces to reinforce learning.</p>
                          </div>
                        </div>
                        <button className="text-green-600 hover:text-green-800 text-sm font-medium">Apply</button>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Zap className="h-5 w-5 text-purple-600 mt-1" />
                          <div>
                            <p className="font-medium text-purple-900">Interactive Scenario</p>
                            <p className="text-sm text-purple-700 mt-1">Create a real-world scenario where learners can apply their knowledge.</p>
                          </div>
                        </div>
                        <button className="text-purple-600 hover:text-purple-800 text-sm font-medium">Apply</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Structure Optimization</h4>
                  
                  <div className="p-4 bg-white border border-gray-200 rounded-lg">
                    <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-gray-600" />
                      Recommended Learning Path
                    </h5>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                        <span className="text-sm">Course Introduction (Video)</span>
                      </div>
                      <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                        <span className="text-sm">Core Learning Content</span>
                      </div>
                      <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                        <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                        <span className="text-sm">Knowledge Assessment</span>
                      </div>
                      <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                        <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                        <span className="text-sm">Practical Application</span>
                      </div>
                      <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                        <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">5</div>
                        <span className="text-sm">Reflection & Summary</span>
                      </div>
                    </div>
                    
                    <button className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all">
                      Auto-Organize Content
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'certification' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <input
                  type="checkbox"
                  checked={!!formData.certification?.available}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleInputChange('certification', {
                        available: true,
                        name: 'Course Certificate',
                        requirements: ['Complete all modules'],
                        validFor: '1 year',
                        renewalRequired: false
                      });
                    } else {
                      handleInputChange('certification', undefined);
                    }
                  }}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label className="text-sm font-medium text-gray-700">
                  Enable certification
                </label>
              </div>

              {formData.certification && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Certificate Name
                    </label>
                    <input
                      type="text"
                      value={formData.certification.name}
                      onChange={(e) => handleInputChange('certification', {
                        ...formData.certification,
                        name: e.target.value
                      })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Status: </span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              formData.status === 'published' ? 'bg-green-100 text-green-800' :
              formData.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {formData.status}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              data-test="course-modal-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              data-test="course-modal-save"
            >
              <Save className="h-4 w-4" />
              <span>Save as Draft</span>
            </button>
            {formData.status !== 'published' && (
              <button
                onClick={handlePublish}
                className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span>Publish</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Creation Modal */}
      {contentModalOpen && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Add {contentType.charAt(0).toUpperCase() + contentType.slice(1)} Content
              </h3>
              <button
                onClick={() => setContentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              {contentType === 'video' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Video Title *</label>
                    <input
                      type="text"
                      value={modalFormData.title || ''}
                      onChange={(e) => handleModalInputChange('title', e.target.value)}
                      placeholder="Enter video title"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      rows={3}
                      value={modalFormData.description || ''}
                      onChange={(e) => handleModalInputChange('description', e.target.value)}
                      placeholder="Describe what learners will gain from this video"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Video Source</label>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          name="videoSource" 
                          value="upload" 
                          id="upload" 
                          checked={modalFormData.videoSource === 'upload' || !modalFormData.videoSource}
                          onChange={(e) => handleModalInputChange('videoSource', e.target.value)}
                        />
                        <label htmlFor="upload" className="font-medium">Upload video file</label>
                      </div>
                      
                      {(modalFormData.videoSource === 'upload' || !modalFormData.videoSource) && (
                        <div className="ml-6 space-y-3">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="video/mp4,video/mov,video/avi,video/webm"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleModalInputChange('videoFile', file);
                                  handleModalInputChange('fileName', file.name);
                                  handleModalInputChange('fileSize', (file.size / 1024 / 1024).toFixed(2));
                                }
                              }}
                              className="hidden"
                            />
                            <div className="text-center">
                              <Upload className="mx-auto h-12 w-12 text-gray-400" />
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  Choose Video File
                                </button>
                              </div>
                              <p className="mt-2 text-sm text-gray-600">MP4, MOV, AVI, WebM up to 500MB</p>
                            </div>
                          </div>
                          {modalFormData.fileName && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center">
                                <Video className="h-5 w-5 text-green-600 mr-2" />
                                <div>
                                  <p className="text-sm font-medium text-green-800">{modalFormData.fileName}</p>
                                  <p className="text-sm text-green-600">{modalFormData.fileSize} MB</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          name="videoSource" 
                          value="youtube" 
                          id="youtube" 
                          checked={modalFormData.videoSource === 'youtube'}
                          onChange={(e) => handleModalInputChange('videoSource', e.target.value)}
                        />
                        <label htmlFor="youtube" className="font-medium">YouTube URL</label>
                      </div>
                      
                      {modalFormData.videoSource === 'youtube' && (
                        <div className="ml-6 space-y-3">
                          <input
                            type="url"
                            value={modalFormData.videoUrl || ''}
                            onChange={(e) => handleModalInputChange('videoUrl', e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          />
                          {modalFormData.videoUrl && (
                            <div className="bg-gray-50 border rounded-lg p-3">
                              <p className="text-sm text-gray-600 mb-2">Preview:</p>
                              <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                                <Play className="h-12 w-12 text-white opacity-75" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          name="videoSource" 
                          value="vimeo" 
                          id="vimeo" 
                          checked={modalFormData.videoSource === 'vimeo'}
                          onChange={(e) => handleModalInputChange('videoSource', e.target.value)}
                        />
                        <label htmlFor="vimeo" className="font-medium">Vimeo URL</label>
                      </div>
                      
                      {modalFormData.videoSource === 'vimeo' && (
                        <div className="ml-6 space-y-3">
                          <input
                            type="url"
                            value={modalFormData.videoUrl || ''}
                            onChange={(e) => handleModalInputChange('videoUrl', e.target.value)}
                            placeholder="https://vimeo.com/..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          />
                          {modalFormData.videoUrl && (
                            <div className="bg-gray-50 border rounded-lg p-3">
                              <p className="text-sm text-gray-600 mb-2">Preview:</p>
                              <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                                <Play className="h-12 w-12 text-white opacity-75" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          name="videoSource" 
                          value="direct" 
                          id="directUrl" 
                          checked={modalFormData.videoSource === 'direct'}
                          onChange={(e) => handleModalInputChange('videoSource', e.target.value)}
                        />
                        <label htmlFor="directUrl" className="font-medium">Direct Video URL</label>
                      </div>
                      
                      {modalFormData.videoSource === 'direct' && (
                        <div className="ml-6 space-y-3">
                          <input
                            type="url"
                            value={modalFormData.videoUrl || ''}
                            onChange={(e) => handleModalInputChange('videoUrl', e.target.value)}
                            placeholder="https://example.com/video.mp4"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          />
                          <p className="text-sm text-gray-500">Direct link to MP4, WebM, or other video file</p>
                          {modalFormData.videoUrl && (
                            <div className="bg-gray-50 border rounded-lg p-3">
                              <p className="text-sm text-gray-600 mb-2">Preview:</p>
                              <video 
                                className="w-full rounded"
                                controls
                                preload="metadata"
                              >
                                <source src={modalFormData.videoUrl} />
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Duration (minutes)</label>
                    <input
                      type="number"
                      value={modalFormData.duration || ''}
                      onChange={(e) => handleModalInputChange('duration', parseInt(e.target.value) || 0)}
                      placeholder="10"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  {/* Video Playback Settings */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Playback Settings</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Required Watch Percentage
                        </label>
                        <select
                          value={modalFormData.watchPercentage || 80}
                          onChange={(e) => handleModalInputChange('watchPercentage', parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        >
                          <option value={50}>50% - Partial viewing required</option>
                          <option value={75}>75% - Most content required</option>
                          <option value={80}>80% - Nearly complete (recommended)</option>
                          <option value={90}>90% - Almost everything</option>
                          <option value={100}>100% - Complete viewing required</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="resumePosition"
                          checked={modalFormData.resumeFromLastPosition !== false}
                          onChange={(e) => handleModalInputChange('resumeFromLastPosition', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="resumePosition" className="text-sm text-gray-700">
                          Allow resume from last position
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="markAsWatched"
                          checked={modalFormData.markAsWatched !== false}
                          onChange={(e) => handleModalInputChange('markAsWatched', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="markAsWatched" className="text-sm text-gray-700">
                          Auto-mark as completed when finished
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Optional: Transcript and Captions */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Accessibility (Optional)</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Transcript (.txt, .srt)
                        </label>
                        <input
                          type="file"
                          accept=".txt,.srt"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleModalInputChange('transcriptFile', file);
                              handleModalInputChange('transcriptName', file.name);
                            }
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                        {modalFormData.transcriptName && (
                          <p className="text-sm text-green-600 mt-1">✓ {modalFormData.transcriptName}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Captions (.vtt, .srt)
                        </label>
                        <input
                          type="file"
                          accept=".vtt,.srt"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleModalInputChange('captionsFile', file);
                              handleModalInputChange('captionsName', file.name);
                            }
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                        {modalFormData.captionsName && (
                          <p className="text-sm text-green-600 mt-1">✓ {modalFormData.captionsName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {contentType === 'quiz' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title *</label>
                    <input
                      type="text"
                      placeholder="Enter quiz title"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Describe the purpose of this quiz"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%)</label>
                      <input type="number" value="80" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Attempts</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                        <option value="3">3</option>
                        <option value="5">5</option>
                        <option value="unlimited">Unlimited</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {contentType === 'interactive' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Interactive Title *</label>
                    <input
                      type="text"
                      placeholder="Enter interactive element title"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Interactive Type</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="drag-drop">Drag & Drop Exercise</option>
                      <option value="scenario">Branching Scenario</option>
                      <option value="simulation">Virtual Simulation</option>
                      <option value="checklist">Interactive Checklist</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                    <textarea
                      rows={3}
                      placeholder="Provide clear instructions for learners"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {contentType === 'resource' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resource Title *</label>
                    <input
                      type="text"
                      placeholder="Enter resource title"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="pdf">PDF Document</option>
                      <option value="doc">Word Document</option>
                      <option value="ppt">PowerPoint Presentation</option>
                      <option value="link">External Link</option>
                      <option value="zip">Archive/Package</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Describe this resource and how it helps learners"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="downloadableResource" className="mr-2" defaultChecked />
                    <label htmlFor="downloadableResource" className="text-sm text-gray-700">Allow download</label>
                  </div>
                </div>
              )}

              {contentType === 'reflection' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reflection Title *</label>
                    <input
                      type="text"
                      placeholder="Enter reflection activity title"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reflection Question</label>
                    <textarea
                      rows={4}
                      placeholder="What would you like learners to reflect on? Be specific and thought-provoking."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Word Limit</label>
                      <input type="number" placeholder="500" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                    </div>
                    <div className="flex items-center pt-6">
                      <input type="checkbox" id="requiredReflection" className="mr-2" />
                      <label htmlFor="requiredReflection" className="text-sm text-gray-700">Required for completion</label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setContentModalOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContent}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Add Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseEditModal;
