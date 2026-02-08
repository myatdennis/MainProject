import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { X, Save, Users, Settings, Tag, BookOpen, FileText, Star, Globe, Upload, Link as LinkIcon, Play, PlusCircle, Edit, Trash2, Video, HelpCircle, ListChecks, Zap, Download, Eye, Move, Copy, CheckCircle, Search, BarChart3, Brain, Lightbulb, Clock, TrendingUp, Target, Award, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { slugify } from '../utils/courseNormalization';
const generateCourseId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const randomSuffix = Math.random().toString(16).slice(2, 10);
    return `course-${Date.now()}-${randomSuffix}`;
};
const buildDefaultCourse = () => {
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
const CourseEditModal = ({ isOpen, onClose, onSave, course, mode }) => {
    const [formData, setFormData] = useState(buildDefaultCourse());
    const [currentTag, setCurrentTag] = useState('');
    const [currentObjective, setCurrentObjective] = useState('');
    const [currentPrerequisite, setCurrentPrerequisite] = useState('');
    const [activeTab, setActiveTab] = useState('basic');
    // Enhanced content management state
    const [lessonContents, setLessonContents] = useState([]);
    const [contentModalOpen, setContentModalOpen] = useState(false);
    const [contentType, setContentType] = useState('video');
    const fileInputRef = useRef(null);
    const [autosaveTimer, setAutosaveTimer] = useState(null);
    const [autosaveStatus, setAutosaveStatus] = useState('idle');
    const [modalFormData, setModalFormData] = useState({});
    const [successMessage, setSuccessMessage] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedContent, setSelectedContent] = useState([]);
    // Phase 3: Advanced Analytics & AI Features
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [optimizationScore, setOptimizationScore] = useState(0);
    const [learningPathSuggestions] = useState([]);
    useEffect(() => {
        if (course && mode === 'edit') {
            setFormData({ ...course });
        }
        else if (mode === 'create') {
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
    const handleInputChange = (field, value) => {
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
    const removeTag = (tagToRemove) => {
        handleInputChange('tags', (formData.tags || []).filter(tag => tag !== tagToRemove));
    };
    const addLearningObjective = () => {
        if (currentObjective.trim()) {
            handleInputChange('learningObjectives', [...(formData.learningObjectives || []), currentObjective.trim()]);
            setCurrentObjective('');
        }
    };
    const removeLearningObjective = (index) => {
        handleInputChange('learningObjectives', (formData.learningObjectives || []).filter((_, i) => i !== index));
    };
    const addPrerequisite = () => {
        if (currentPrerequisite.trim()) {
            handleInputChange('prerequisites', [...(formData.prerequisites || []), currentPrerequisite.trim()]);
            setCurrentPrerequisite('');
        }
    };
    const removePrerequisite = (index) => {
        handleInputChange('prerequisites', (formData.prerequisites || []).filter((_, i) => i !== index));
    };
    // Enhanced content management functions with debounced autosave
    const triggerAutosave = () => {
        if (autosaveTimer)
            clearTimeout(autosaveTimer);
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
                }
                catch (error) {
                    setAutosaveStatus('error');
                    console.error('❌ Auto-save failed:', error);
                    // Clear error status after 3 seconds
                    setTimeout(() => setAutosaveStatus('idle'), 3000);
                }
            }
            else {
                setAutosaveStatus('idle');
            }
        }, 10000)); // autosave after 10 seconds of inactivity
    };
    const createContentFromModal = (formData) => {
        let newContent;
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
                }
                else if (!videoUrl || videoUrl.trim() === '') {
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
    const removeLessonContent = (id) => {
        if (confirm('Are you sure you want to delete this content item?')) {
            setLessonContents(prev => prev.filter(item => item.id !== id));
            triggerAutosave();
            console.log(`🗑️ Removed content item: ${id}`);
        }
    };
    const handleEditContent = (content) => {
        // Populate modal with existing content data for editing
        setContentType(content.type);
        // Convert content back to modal form data format
        const editFormData = {
            title: content.title,
            duration: content.estimatedDuration,
            required: content.required
        };
        // Add type-specific data
        if (content.type === 'video' && 'url' in content.content) {
            editFormData.videoUrl = content.content.url;
            editFormData.description = content.content.description;
            editFormData.videoSource = content.content.type;
        }
        else if (content.type === 'quiz' && 'questions' in content.content) {
            editFormData.description = content.content.description;
            editFormData.passingScore = content.content.settings?.passingScore || 80;
            editFormData.maxAttempts = content.content.settings?.maxAttempts || 3;
        }
        else if (content.type === 'resource' && 'url' in content.content) {
            const resourceContent = content.content;
            editFormData.description = resourceContent.description;
            editFormData.url = resourceContent.url;
            editFormData.resourceType = resourceContent.type;
            editFormData.downloadable = resourceContent.downloadable;
        }
        else if (content.type === 'reflection' && 'question' in content.content) {
            editFormData.question = content.content.question;
            editFormData.wordLimit = content.content.wordLimit;
        }
        setModalFormData(editFormData);
        setContentModalOpen(true);
        // Remove the original content since we'll replace it when saving
        removeLessonContent(content.id);
    };
    const handlePreviewContent = (content) => {
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
    const handleDragStart = (e, content) => {
        setDraggedItem(content);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    const handleDrop = (e, targetContent) => {
        e.preventDefault();
        if (!draggedItem)
            return;
        if (draggedItem.id === targetContent.id)
            return;
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
    const handleBulkDelete = (selectedIds) => {
        if (selectedIds.length === 0)
            return;
        if (confirm(`Are you sure you want to delete ${selectedIds.length} content items?`)) {
            setLessonContents(prev => prev.filter(item => !selectedIds.includes(item.id)));
            triggerAutosave();
            setSuccessMessage(`✅ Deleted ${selectedIds.length} content items`);
            setTimeout(() => setSuccessMessage(null), 3000);
        }
    };
    const duplicateContent = (content) => {
        const duplicatedContent = {
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
    const handleFileUpload = (file, type) => {
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
    const openContentModal = (type) => {
        setContentType(type);
        setModalFormData({});
        setContentModalOpen(true);
    };
    const handleModalInputChange = (field, value) => {
        setModalFormData((prev) => ({
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
    const handleSave = () => {
        // Phase 3: Advanced validation with detailed feedback
        const validationErrors = [];
        // Basic validation
        if (!formData.title.trim()) {
            validationErrors.push('Course title is required');
        }
        else if (formData.title.trim().length < 5) {
            validationErrors.push('Course title should be at least 5 characters');
        }
        if (!formData.description.trim()) {
            validationErrors.push('Course description is required');
        }
        else if (formData.description.trim().length < 50) {
            validationErrors.push('Course description should be at least 50 characters for better clarity');
        }
        // Content validation
        if (lessonContents.length === 0) {
            validationErrors.push('Add at least one piece of content before saving');
        }
        else {
            // Check for content diversity
            const hasVideo = contentCounts.video > 0;
            const hasAssessment = contentCounts.quiz > 0 || contentCounts.interactive > 0;
            if (!hasVideo && !hasAssessment) {
                validationErrors.push('Consider adding videos or assessments to improve learning experience');
            }
        }
        // Learning objectives validation
        if (!formData.learningObjectives || formData.learningObjectives.length === 0) {
            validationErrors.push('Add learning objectives to help learners understand what they will achieve');
        }
        // Show validation results
        if (validationErrors.length > 0) {
            const errorMessage = `Please fix the following issues:\n\n${validationErrors.map((error, index) => `${index + 1}. ${error}`).join('\n')}`;
            alert(errorMessage);
            return;
        }
        // Show success message for high-quality courses
        if (optimizationScore >= 80) {
            setSuccessMessage('🎉 Excellent! Your course meets all quality standards.');
        }
        else if (optimizationScore >= 60) {
            setSuccessMessage('✅ Good course structure. Consider the optimization suggestions for even better results.');
        }
        else {
            setSuccessMessage('✅ Course saved. Check the Analytics tab for improvement suggestions.');
        }
        // Convert our lesson contents to proper course modules format
        const convertedModules = convertLessonContentsToModules();
        const enhancedFormData = {
            ...formData,
            modules: convertedModules
        };
        const normalizedSlug = slugify(enhancedFormData.slug || enhancedFormData.title || enhancedFormData.id);
        const coursePayload = {
            ...enhancedFormData,
            slug: normalizedSlug
        };
        console.log('💾 Saving course with enhanced data:', {
            formData: coursePayload,
            lessonContents: lessonContents,
            convertedModules: convertedModules
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
        const modules = [];
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
                ? resource.content.fileUrl
                : typeof resource.content === 'object' && resource.content && 'url' in resource.content
                    ? resource.content.url
                    : '#'
        }));
        // Add resources to the first module or create a resources module
        if (modules.length > 0) {
            modules[0].resources = convertedResources;
        }
        else if (convertedResources.length > 0) {
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
    const convertLessonContentToLesson = (content) => {
        console.log('🔧 Converting lesson content:', {
            title: content.title,
            type: content.type,
            rawContent: content.content,
            hasContentObject: typeof content.content === 'object' && content.content
        });
        const lesson = {
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
                    const videoContent = content.content;
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
                }
                else {
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
                        questions: content.content.questions || [],
                        passingScore: content.content.settings?.passingScore || 80,
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
        // Validate before publishing
        const errors = [];
        if (!formData.title || formData.title.trim().length < 5)
            errors.push('Course title must be at least 5 characters');
        if (!formData.description || formData.description.trim().length < 50)
            errors.push('Course description must be at least 50 characters');
        if (lessonContents.length === 0)
            errors.push('Add at least one lesson before publishing');
        if (errors.length > 0) {
            alert(`Cannot publish course. Please fix the following:\n\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
            return;
        }
        if (!confirm('Are you sure you want to publish this course? This will make it visible to learners.'))
            return;
        // Prepare payload and bump version if present
        const nextVersion = formData.version ? Number(formData.version) + 1 : 1;
        const payload = {
            version: nextVersion
        };
        // Call server publish endpoint so server records published_at and broadcasts updates
        (async () => {
            try {
                setAutosaveStatus('saving');
                const res = await fetch(`/api/admin/courses/${encodeURIComponent(formData.id)}/publish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    throw new Error(errBody?.error || `Publish failed: ${res.status}`);
                }
                const result = await res.json();
                const saved = result?.data || null;
                if (!saved)
                    throw new Error('Publish returned no course data');
                // Inform parent and update UI
                onSave(saved);
                setSuccessMessage('✅ Course published successfully');
                setAutosaveStatus('saved');
                setTimeout(() => setAutosaveStatus('idle'), 2000);
                setTimeout(() => setSuccessMessage(null), 5000);
            }
            catch (err) {
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
            if (formData.title && formData.title.length > 5)
                score += 10;
            if (formData.description && formData.description.length > 50)
                score += 10;
            if (formData.type)
                score += 5; // Using type instead of category
            if (formData.difficulty)
                score += 5;
            // Content diversity (40 points)
            if (contentCounts.video > 0)
                score += 10;
            if (contentCounts.quiz > 0)
                score += 10;
            if (contentCounts.interactive > 0)
                score += 10;
            if (contentCounts.resource > 0)
                score += 5;
            if (contentCounts.reflection > 0)
                score += 5;
            // Content quantity (20 points)
            const totalContent = lessonContents.length;
            if (totalContent >= 3)
                score += 5;
            if (totalContent >= 5)
                score += 5;
            if (totalContent >= 8)
                score += 5;
            if (totalContent >= 10)
                score += 5;
            // Learning objectives and structure (10 points)
            if (formData.learningObjectives && formData.learningObjectives.length > 0)
                score += 5;
            if (formData.prerequisites && formData.prerequisites.length > 0)
                score += 3;
            if (formData.tags && formData.tags.length > 0)
                score += 2;
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
    if (!isOpen)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900", children: mode === 'create' ? 'Create New Course' : 'Edit Course' }), mode === 'edit' && (_jsxs("div", { className: "flex items-center space-x-2", children: [autosaveStatus === 'saving' && (_jsxs("div", { className: "flex items-center text-blue-600 text-sm", children: [_jsx("div", { className: "animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2" }), "Saving..."] })), autosaveStatus === 'saved' && (_jsxs("div", { className: "flex items-center text-green-600 text-sm", children: [_jsx("div", { className: "h-3 w-3 bg-green-600 rounded-full mr-2" }), "Saved"] })), autosaveStatus === 'error' && (_jsxs("div", { className: "flex items-center text-red-600 text-sm", children: [_jsx("div", { className: "h-3 w-3 bg-red-600 rounded-full mr-2" }), "Save failed"] }))] }))] }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600", children: _jsx(X, { className: "h-6 w-6" }) })] }), activeTab !== 'basic' && (_jsx("div", { className: "px-6 py-4 bg-gray-50 border-b border-gray-200", children: _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", placeholder: "Search content...", value: searchFilter, onChange: (e) => setSearchFilter(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), _jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx(Search, { className: "h-5 w-5 text-gray-400" }) })] }) }), _jsxs("select", { value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Types" }), _jsx("option", { value: "video", children: "Videos" }), _jsx("option", { value: "quiz", children: "Quizzes" }), _jsx("option", { value: "resource", children: "Resources" }), _jsx("option", { value: "reflection", children: "Reflections" }), _jsx("option", { value: "interactive", children: "Interactive" })] }), selectedContent.length > 0 && (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("span", { className: "text-sm text-gray-600", children: [selectedContent.length, " selected"] }), _jsxs("button", { onClick: () => handleBulkDelete(selectedContent), className: "flex items-center px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600", children: [_jsx(Trash2, { className: "h-4 w-4 mr-1" }), "Delete"] }), _jsx("button", { onClick: () => setSelectedContent([]), className: "text-sm text-gray-600 hover:text-gray-800", children: "Clear" })] }))] }) })), _jsx("div", { className: "border-b border-gray-200", children: _jsx("nav", { className: "-mb-px flex space-x-8 px-6", children: tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === tab.id
                                        ? 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: [_jsx(Icon, { className: "h-4 w-4" }), _jsx("span", { children: tab.label }), tab.count !== undefined && tab.count > 0 && (_jsx("span", { className: "ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-orange-500 rounded-full", children: tab.count })), tab.badge !== undefined && (_jsx("span", { className: "ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-500 rounded-full", children: tab.badge }))] }, tab.id));
                            }) }) }), _jsxs("div", { className: "p-6 overflow-y-auto max-h-[calc(90vh-200px)]", children: [activeTab === 'basic' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Course Title *" }), _jsx("input", { type: "text", value: formData.title, onChange: (e) => handleInputChange('title', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter course title" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Category" }), _jsxs("select", { value: formData.type, onChange: (e) => handleInputChange('type', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select Category" }), _jsx("option", { value: "DEI", children: "Diversity, Equity & Inclusion" }), _jsx("option", { value: "Leadership", children: "Leadership" }), _jsx("option", { value: "Communication", children: "Communication" }), _jsx("option", { value: "Professional Development", children: "Professional Development" }), _jsx("option", { value: "Compliance", children: "Compliance" }), _jsx("option", { value: "Technical", children: "Technical Skills" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Course Type" }), _jsxs("select", { value: formData.type, onChange: (e) => handleInputChange('type', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "video", children: "Video Course" }), _jsx("option", { value: "interactive", children: "Interactive" }), _jsx("option", { value: "worksheet", children: "Worksheet" }), _jsx("option", { value: "case-study", children: "Case Study" }), _jsx("option", { value: "assessment", children: "Assessment" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Difficulty Level" }), _jsxs("select", { value: formData.difficulty, onChange: (e) => handleInputChange('difficulty', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "Beginner", children: "Beginner" }), _jsx("option", { value: "Intermediate", children: "Intermediate" }), _jsx("option", { value: "Advanced", children: "Advanced" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Duration (minutes)" }), _jsx("input", { type: "number", value: formData.duration, onChange: (e) => handleInputChange('duration', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", min: "0" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description *" }), _jsx("textarea", { value: formData.description, onChange: (e) => handleInputChange('description', e.target.value), rows: 4, className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Describe the course content and what learners will gain" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Tags" }), _jsx("div", { className: "flex flex-wrap gap-2 mb-3", children: (formData.tags || []).map((tag, index) => (_jsxs("span", { className: "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800", children: [tag, _jsx("button", { onClick: () => removeTag(tag), className: "ml-2 text-orange-600 hover:text-orange-800", children: "\u00D7" })] }, index))) }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("input", { type: "text", value: currentTag, onChange: (e) => setCurrentTag(e.target.value), onKeyPress: (e) => e.key === 'Enter' && addTag(), className: "flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Add a tag" }), _jsx("button", { onClick: addTag, className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600", children: _jsx(Tag, { className: "h-4 w-4" }) })] })] })] })), activeTab === 'content' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-800 mb-2", children: "Course Content Structure" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Build your course with engaging videos, interactive quizzes, resources, and reflection activities." }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("button", { onClick: () => openContentModal('video'), className: "flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200", children: [_jsx(Video, { className: "h-4 w-4 mr-2" }), "Add Video"] }), _jsxs("button", { onClick: () => openContentModal('quiz'), className: "flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200", children: [_jsx(ListChecks, { className: "h-4 w-4 mr-2" }), "Add Quiz"] }), _jsxs("button", { onClick: () => openContentModal('interactive'), className: "flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors duration-200", children: [_jsx(Zap, { className: "h-4 w-4 mr-2" }), "Add Interactive"] }), _jsxs("button", { onClick: () => openContentModal('resource'), className: "flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200", children: [_jsx(Download, { className: "h-4 w-4 mr-2" }), "Add Resource"] }), _jsxs("button", { onClick: () => openContentModal('reflection'), className: "flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-200", children: [_jsx(HelpCircle, { className: "h-4 w-4 mr-2" }), "Add Reflection"] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Learning Objectives" }), _jsx("div", { className: "space-y-2 mb-3", children: (formData.learningObjectives || []).map((objective, index) => (_jsxs("div", { className: "flex items-center justify-between bg-gray-50 p-3 rounded-lg", children: [_jsx("span", { className: "text-sm", children: objective }), _jsx("button", { onClick: () => removeLearningObjective(index), className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] }, index))) }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("input", { type: "text", value: currentObjective, onChange: (e) => setCurrentObjective(e.target.value), onKeyPress: (e) => e.key === 'Enter' && addLearningObjective(), className: "flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Add learning objective" }), _jsx("button", { onClick: addLearningObjective, className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600", children: "Add" })] })] }), successMessage && (_jsx("div", { className: "mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm", children: successMessage })), _jsx("div", { className: "bg-gray-50 p-4 rounded-lg mb-4", children: _jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Search Content" }), _jsx("input", { type: "text", value: searchFilter, onChange: (e) => setSearchFilter(e.target.value), placeholder: "Search by title...", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { className: "sm:w-48", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Filter by Type" }), _jsxs("select", { value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Types" }), _jsx("option", { value: "video", children: "Videos" }), _jsx("option", { value: "quiz", children: "Quizzes" }), _jsx("option", { value: "interactive", children: "Interactive" }), _jsx("option", { value: "resource", children: "Resources" }), _jsx("option", { value: "reflection", children: "Reflections" })] })] })] }) }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900", children: ["Lesson Content (", filteredContent.length, " of ", lessonContents.length, " items)"] }), filteredContent.length > 1 && (_jsx("p", { className: "text-sm text-gray-500", children: "\uD83D\uDCA1 Tip: Drag items to reorder them" }))] }), filteredContent.length === 0 ? (_jsxs("div", { className: "text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300", children: [_jsx(FileText, { className: "h-12 w-12 text-gray-400 mx-auto mb-4" }), lessonContents.length === 0 ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-gray-500 mb-4", children: "No content added yet" }), _jsx("p", { className: "text-sm text-gray-400", children: "Use the buttons above to add videos, quizzes, and other content" })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-gray-500 mb-4", children: "No content matches your filters" }), _jsx("p", { className: "text-sm text-gray-400", children: "Try adjusting your search or filter settings" })] }))] })) : (_jsx("div", { className: "space-y-3", children: filteredContent
                                                    .sort((a, b) => a.order - b.order)
                                                    .map((content) => (_jsx("div", { className: "bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-move", draggable: true, onDragStart: (e) => handleDragStart(e, content), onDragOver: handleDragOver, onDrop: (e) => handleDrop(e, content), children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("div", { className: "flex items-center space-x-2 text-gray-500", title: "Drag to reorder", children: [_jsx(Move, { className: "h-4 w-4 cursor-move" }), _jsxs("span", { className: "text-sm font-medium", children: ["#", content.order] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [content.type === 'video' && _jsx(Video, { className: "h-5 w-5 text-red-500" }), content.type === 'quiz' && _jsx(ListChecks, { className: "h-5 w-5 text-green-500" }), content.type === 'interactive' && _jsx(Zap, { className: "h-5 w-5 text-purple-500" }), content.type === 'resource' && _jsx(Download, { className: "h-5 w-5 text-blue-500" }), content.type === 'reflection' && _jsx(HelpCircle, { className: "h-5 w-5 text-orange-500" }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: content.title }), _jsxs("p", { className: "text-sm text-gray-500 capitalize", children: [content.type, " \u2022 ", content.estimatedDuration, " min", content.required && _jsx("span", { className: "text-red-500", children: " \u2022 Required" })] })] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => handleEditContent(content), className: "p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-50", title: "Edit", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => duplicateContent(content), className: "p-2 text-gray-600 hover:text-purple-600 rounded-lg hover:bg-gray-50", title: "Duplicate", children: _jsx(Copy, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handlePreviewContent(content), className: "p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-50", title: "Preview", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => removeLessonContent(content.id), className: "p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-50", title: "Delete", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }) }, content.id))) }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Prerequisites" }), _jsx("div", { className: "space-y-2 mb-3", children: (formData.prerequisites || []).map((prerequisite, index) => (_jsxs("div", { className: "flex items-center justify-between bg-gray-50 p-3 rounded-lg", children: [_jsx("span", { className: "text-sm", children: prerequisite }), _jsx("button", { onClick: () => removePrerequisite(index), className: "text-red-600 hover:text-red-800", children: _jsx(X, { className: "h-4 w-4" }) })] }, index))) }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("input", { type: "text", value: currentPrerequisite, onChange: (e) => setCurrentPrerequisite(e.target.value), onKeyPress: (e) => e.key === 'Enter' && addPrerequisite(), className: "flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Add prerequisite" }), _jsx("button", { onClick: addPrerequisite, className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600", children: "Add" })] })] })] })), activeTab === 'videos' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900", children: ["Video Content (", contentCounts.video, " videos)"] }), _jsxs("button", { onClick: () => openContentModal('video'), className: "flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600", children: [_jsx(PlusCircle, { className: "h-4 w-4 mr-2" }), "Add Video"] })] }), contentCounts.video > 0 && (_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg", children: [_jsx("div", { className: "p-4 border-b border-gray-200", children: _jsx("h4", { className: "font-medium text-gray-900", children: "Current Videos" }) }), _jsx("div", { className: "divide-y divide-gray-200", children: lessonContents
                                                    .filter(content => content.type === 'video')
                                                    .sort((a, b) => a.order - b.order)
                                                    .map((video) => (_jsx("div", { className: "p-4 hover:bg-gray-50", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "flex items-center justify-center w-10 h-10 bg-red-100 rounded-lg", children: _jsx(Video, { className: "h-5 w-5 text-red-600" }) }), _jsxs("div", { children: [_jsx("h5", { className: "font-medium text-gray-900", children: video.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-500", children: [_jsxs("span", { children: ["#", video.order] }), _jsxs("span", { children: [video.estimatedDuration, " min"] }), video.required && _jsx("span", { className: "text-red-500", children: "Required" }), 'url' in video.content && video.content.url && (_jsx("span", { className: "text-green-600", children: "Has video" }))] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => handleEditContent(video), className: "p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100", title: "Edit Video", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handlePreviewContent(video), className: "p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-100", title: "Preview Video", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => removeLessonContent(video.id), className: "p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100", title: "Delete Video", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }) }, video.id))) })] })), _jsxs("div", { className: "bg-gray-50 p-6 rounded-lg border border-gray-200", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-4", children: "Add New Video" }), _jsx("div", { className: "mb-4", children: _jsxs("div", { className: "flex space-x-4", children: [_jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "radio", name: "videoType", value: "upload", className: "mr-2", defaultChecked: true }), _jsx(Upload, { className: "h-4 w-4 mr-2 text-gray-600" }), "Upload Video File"] }), _jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "radio", name: "videoType", value: "url", className: "mr-2" }), _jsx(LinkIcon, { className: "h-4 w-4 mr-2 text-gray-600" }), "Video URL"] })] }) }), _jsxs("div", { className: "mb-4", children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "video/mp4,video/mov,video/avi,video/webm", className: "hidden", onChange: (e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'video') }), _jsxs("div", { onClick: () => fileInputRef.current?.click(), className: "border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-red-400 transition-colors", children: [_jsx(Upload, { className: "h-8 w-8 text-gray-400 mx-auto mb-2" }), _jsx("p", { className: "text-sm text-gray-600", children: "Click to upload video or drag and drop" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "MP4, MOV, AVI, WebM up to 500MB" })] })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Video URL (YouTube, Vimeo, or direct link)" }), _jsx("input", { type: "url", placeholder: "https://youtube.com/watch?v=... or https://vimeo.com/...", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Required Watch %" }), _jsxs("select", { className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "50", children: "50%" }), _jsx("option", { value: "75", children: "75%" }), _jsx("option", { value: "85", selected: true, children: "85%" }), _jsx("option", { value: "100", children: "100%" })] })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "resume", className: "mr-2", defaultChecked: true }), _jsx("label", { htmlFor: "resume", className: "text-sm text-gray-700", children: "Resume from last position" })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "markWatched", className: "mr-2", defaultChecked: true }), _jsx("label", { htmlFor: "markWatched", className: "text-sm text-gray-700", children: "Mark as watched when complete" })] })] }), _jsxs("div", { className: "mt-4 grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Transcript (Optional)" }), _jsx("input", { type: "file", accept: ".txt,.srt", className: "w-full text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Captions (VTT)" }), _jsx("input", { type: "file", accept: ".vtt", className: "w-full text-sm" })] })] })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Preview" }), _jsx("div", { className: "bg-gray-100 rounded-lg aspect-video flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx(Play, { className: "h-12 w-12 text-gray-400 mx-auto mb-2" }), _jsx("p", { className: "text-gray-500", children: "Video preview will appear here" })] }) })] })] })), activeTab === 'quizzes' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900", children: ["Quiz & Assessments (", contentCounts.quiz, " quizzes)"] }), _jsxs("button", { onClick: () => openContentModal('quiz'), className: "flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600", children: [_jsx(PlusCircle, { className: "h-4 w-4 mr-2" }), "Create Quiz"] })] }), contentCounts.quiz > 0 && (_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg", children: [_jsx("div", { className: "p-4 border-b border-gray-200", children: _jsx("h4", { className: "font-medium text-gray-900", children: "Current Quizzes" }) }), _jsx("div", { className: "divide-y divide-gray-200", children: lessonContents
                                                    .filter(content => content.type === 'quiz')
                                                    .sort((a, b) => a.order - b.order)
                                                    .map((quiz) => (_jsx("div", { className: "p-4 hover:bg-gray-50", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg", children: _jsx(CheckCircle, { className: "h-5 w-5 text-green-600" }) }), _jsxs("div", { children: [_jsx("h5", { className: "font-medium text-gray-900", children: quiz.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-500", children: [_jsxs("span", { children: ["#", quiz.order] }), _jsxs("span", { children: [quiz.estimatedDuration, " min"] }), quiz.required && _jsx("span", { className: "text-red-500", children: "Required" }), 'questions' in quiz.content && (_jsx("span", { className: "text-green-600", children: Array.isArray(quiz.content.questions)
                                                                                            ? `${quiz.content.questions.length} questions`
                                                                                            : 'Has questions' }))] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => handleEditContent(quiz), className: "p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100", title: "Edit Quiz", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handlePreviewContent(quiz), className: "p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-100", title: "Preview Quiz", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => duplicateContent(quiz), className: "p-2 text-gray-600 hover:text-purple-600 rounded-lg hover:bg-gray-100", title: "Duplicate Quiz", children: _jsx(Copy, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => removeLessonContent(quiz.id), className: "p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100", title: "Delete Quiz", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }) }, quiz.id))) })] })), _jsxs("div", { className: "bg-gray-50 p-6 rounded-lg border border-gray-200", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-4", children: "Quiz Builder" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Quiz Title" }), _jsx("input", { type: "text", placeholder: "Enter quiz title", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Question Type" }), _jsxs("select", { className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "multiple-choice", children: "Multiple Choice" }), _jsx("option", { value: "multi-select", children: "Multi-Select" }), _jsx("option", { value: "true-false", children: "True/False" }), _jsx("option", { value: "short-answer", children: "Short Answer" }), _jsx("option", { value: "likert", children: "Likert Scale" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Question" }), _jsx("textarea", { rows: 3, placeholder: "Enter your question", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Answer Options" }), _jsxs("div", { className: "space-y-2", children: [[1, 2, 3, 4].map((num) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", name: "correct", className: "text-green-500" }), _jsx("input", { type: "text", placeholder: `Option ${num}`, className: "flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" }), _jsx("button", { className: "text-red-500 hover:text-red-700", children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, num))), _jsx("button", { className: "text-green-500 text-sm hover:text-green-700", children: "+ Add Option" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Explanation (Optional)" }), _jsx("textarea", { rows: 2, placeholder: "Explain why this is the correct answer", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Time Limit (minutes)" }), _jsx("input", { type: "number", placeholder: "30", className: "w-full border border-gray-300 rounded-lg px-3 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Passing Score (%)" }), _jsx("input", { type: "number", placeholder: "80", className: "w-full border border-gray-300 rounded-lg px-3 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Max Attempts" }), _jsxs("select", { className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "1", children: "1" }), _jsx("option", { value: "2", children: "2" }), _jsx("option", { value: "3", selected: true, children: "3" }), _jsx("option", { value: "unlimited", children: "Unlimited" })] })] })] }), _jsxs("div", { className: "flex space-x-4", children: [_jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", className: "mr-2", defaultChecked: true }), _jsx("span", { className: "text-sm text-gray-700", children: "Randomize question order" })] }), _jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", className: "mr-2", defaultChecked: true }), _jsx("span", { className: "text-sm text-gray-700", children: "Show explanations after submission" })] })] })] })] })] })), activeTab === 'interactive' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Interactive Elements" }), _jsxs("button", { onClick: () => openContentModal('interactive'), className: "flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600", children: [_jsx(PlusCircle, { className: "h-4 w-4 mr-2" }), "Add Interactive"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer", children: [_jsxs("div", { className: "flex items-center mb-4", children: [_jsx(Zap, { className: "h-6 w-6 text-purple-500 mr-3" }), _jsx("h4", { className: "font-medium text-gray-900", children: "Drag & Drop Exercise" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Create interactive drag-and-drop activities for hands-on learning." }), _jsx("button", { className: "text-purple-500 text-sm font-medium hover:text-purple-700", children: "Create Exercise" })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer", children: [_jsxs("div", { className: "flex items-center mb-4", children: [_jsx(HelpCircle, { className: "h-6 w-6 text-blue-500 mr-3" }), _jsx("h4", { className: "font-medium text-gray-900", children: "Branching Scenario" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Build decision-based scenarios with multiple pathways and outcomes." }), _jsx("button", { className: "text-blue-500 text-sm font-medium hover:text-blue-700", children: "Create Scenario" })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer", children: [_jsxs("div", { className: "flex items-center mb-4", children: [_jsx(Eye, { className: "h-6 w-6 text-green-500 mr-3" }), _jsx("h4", { className: "font-medium text-gray-900", children: "Virtual Simulation" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Create immersive simulations for practical skill development." }), _jsx("button", { className: "text-green-500 text-sm font-medium hover:text-green-700", children: "Create Simulation" })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer", children: [_jsxs("div", { className: "flex items-center mb-4", children: [_jsx(ListChecks, { className: "h-6 w-6 text-orange-500 mr-3" }), _jsx("h4", { className: "font-medium text-gray-900", children: "Interactive Checklist" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Guide learners through step-by-step processes with interactive checklists." }), _jsx("button", { className: "text-orange-500 text-sm font-medium hover:text-orange-700", children: "Create Checklist" })] })] })] })), activeTab === 'resources' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900", children: ["Learning Resources (", contentCounts.resource, " resources)"] }), _jsxs("button", { onClick: () => openContentModal('resource'), className: "flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: [_jsx(PlusCircle, { className: "h-4 w-4 mr-2" }), "Add Resource"] })] }), contentCounts.resource > 0 && (_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg", children: [_jsx("div", { className: "p-4 border-b border-gray-200", children: _jsx("h4", { className: "font-medium text-gray-900", children: "Current Resources" }) }), _jsx("div", { className: "divide-y divide-gray-200", children: lessonContents
                                                    .filter(content => content.type === 'resource')
                                                    .sort((a, b) => a.order - b.order)
                                                    .map((resource) => (_jsx("div", { className: "p-4 hover:bg-gray-50", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg", children: _jsx(Download, { className: "h-5 w-5 text-blue-600" }) }), _jsxs("div", { children: [_jsx("h5", { className: "font-medium text-gray-900", children: resource.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-500", children: [_jsxs("span", { children: ["#", resource.order] }), resource.required && _jsx("span", { className: "text-red-500", children: "Required" }), typeof resource.content === 'object' &&
                                                                                        resource.content &&
                                                                                        'fileUrl' in resource.content &&
                                                                                        resource.content.fileUrl && (_jsx("span", { className: "text-blue-600", children: "File attached" })), typeof resource.content === 'object' &&
                                                                                        resource.content &&
                                                                                        'url' in resource.content &&
                                                                                        resource.content.url && (_jsx("span", { className: "text-green-600", children: "External link" }))] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => handleEditContent(resource), className: "p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100", title: "Edit Resource", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handlePreviewContent(resource), className: "p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-100", title: "Preview Resource", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => duplicateContent(resource), className: "p-2 text-gray-600 hover:text-purple-600 rounded-lg hover:bg-gray-100", title: "Duplicate Resource", children: _jsx(Copy, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => removeLessonContent(resource.id), className: "p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100", title: "Delete Resource", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }) }, resource.id))) })] })), _jsxs("div", { className: "bg-gray-50 p-6 rounded-lg border border-gray-200", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-4", children: "Add New Resource" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Resource Title" }), _jsx("input", { type: "text", placeholder: "Enter resource title", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Resource Type" }), _jsxs("select", { className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "pdf", children: "PDF Document" }), _jsx("option", { value: "doc", children: "Word Document" }), _jsx("option", { value: "ppt", children: "Presentation" }), _jsx("option", { value: "zip", children: "Archive/Zip" }), _jsx("option", { value: "link", children: "External Link" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { rows: 2, placeholder: "Describe this resource", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-6 text-center", children: [_jsx(Download, { className: "h-8 w-8 text-gray-400 mx-auto mb-2" }), _jsx("p", { className: "text-sm text-gray-600", children: "Click to upload file or drag and drop" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "PDF, DOC, PPT, ZIP up to 50MB" })] }), _jsx("div", { className: "text-center text-gray-500", children: "or" }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "External Link" }), _jsx("input", { type: "url", placeholder: "https://example.com/resource", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "downloadable", className: "mr-2", defaultChecked: true }), _jsx("label", { htmlFor: "downloadable", className: "text-sm text-gray-700", children: "Allow download" })] })] })] })] })), activeTab === 'reflections' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900", children: ["Reflection Questions (", contentCounts.reflection, " reflections)"] }), _jsxs("button", { onClick: () => openContentModal('reflection'), className: "flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600", children: [_jsx(PlusCircle, { className: "h-4 w-4 mr-2" }), "Add Reflection"] })] }), contentCounts.reflection > 0 && (_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg", children: [_jsx("div", { className: "p-4 border-b border-gray-200", children: _jsx("h4", { className: "font-medium text-gray-900", children: "Current Reflection Activities" }) }), _jsx("div", { className: "divide-y divide-gray-200", children: lessonContents
                                                    .filter(content => content.type === 'reflection')
                                                    .sort((a, b) => a.order - b.order)
                                                    .map((reflection) => (_jsx("div", { className: "p-4 hover:bg-gray-50", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "flex items-center justify-center w-10 h-10 bg-orange-100 rounded-lg", children: _jsx(HelpCircle, { className: "h-5 w-5 text-orange-600" }) }), _jsxs("div", { children: [_jsx("h5", { className: "font-medium text-gray-900", children: reflection.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-500", children: [_jsxs("span", { children: ["#", reflection.order] }), _jsxs("span", { children: [reflection.estimatedDuration, " min"] }), reflection.required && _jsx("span", { className: "text-red-500", children: "Required" }), _jsx("span", { className: "text-orange-600", children: "Reflection Activity" })] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => handleEditContent(reflection), className: "p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100", title: "Edit Reflection", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handlePreviewContent(reflection), className: "p-2 text-gray-600 hover:text-green-600 rounded-lg hover:bg-gray-100", title: "Preview Reflection", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => duplicateContent(reflection), className: "p-2 text-gray-600 hover:text-purple-600 rounded-lg hover:bg-gray-100", title: "Duplicate Reflection", children: _jsx(Copy, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => removeLessonContent(reflection.id), className: "p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100", title: "Delete Reflection", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }) }, reflection.id))) })] })), _jsxs("div", { className: "bg-gray-50 p-6 rounded-lg border border-gray-200", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-4", children: "Reflection Activity Builder" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Reflection Type" }), _jsxs("select", { className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "text", children: "Written Reflection" }), _jsx("option", { value: "journal", children: "Journal Entry" }), _jsx("option", { value: "discussion", children: "Discussion Question" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Reflection Question" }), _jsx("textarea", { rows: 4, placeholder: "What question would you like learners to reflect on? Example: 'How will you apply the concepts learned in this module to your current role?'", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Word Limit (Optional)" }), _jsx("input", { type: "number", placeholder: "500", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { className: "flex items-center pt-6", children: [_jsx("input", { type: "checkbox", id: "required", className: "mr-2" }), _jsx("label", { htmlFor: "required", className: "text-sm text-gray-700", children: "Required for completion" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Guidance Text (Optional)" }), _jsx("textarea", { rows: 2, placeholder: "Provide additional guidance or prompts to help learners with their reflection", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })] }), _jsxs("div", { className: "bg-blue-50 p-4 rounded-lg border border-blue-200", children: [_jsx("h5", { className: "font-medium text-blue-900 mb-2", children: "Sample Reflection Questions" }), _jsxs("ul", { className: "text-sm text-blue-800 space-y-1", children: [_jsx("li", { children: "\u2022 How will you apply these concepts in your daily work?" }), _jsx("li", { children: "\u2022 What was the most surprising thing you learned?" }), _jsx("li", { children: "\u2022 What challenges might you face when implementing these ideas?" }), _jsx("li", { children: "\u2022 How does this relate to your personal experience?" }), _jsx("li", { children: "\u2022 What questions do you still have about this topic?" })] })] })] })), activeTab === 'settings' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Created By" }), _jsx("input", { type: "text", value: formData.createdBy, onChange: (e) => handleInputChange('createdBy', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Estimated Time" }), _jsx("input", { type: "text", value: formData.estimatedTime, onChange: (e) => handleInputChange('estimatedTime', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "e.g., 2 hours" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Due Date" }), _jsx("input", { type: "date", value: formData.dueDate || '', onChange: (e) => handleInputChange('dueDate', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] })), activeTab === 'enrollment' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Current Enrollment Count" }), _jsx("input", { type: "number", value: formData.enrollments, onChange: (e) => handleInputChange('enrollments', parseInt(e.target.value) || 0), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", min: "0" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Current Rating" }), _jsx("input", { type: "number", value: formData.rating, onChange: (e) => handleInputChange('rating', parseFloat(e.target.value) || 0), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", min: "0", max: "5", step: "0.1" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Review Count" }), _jsx("input", { type: "number", value: formData.totalRatings, onChange: (e) => handleInputChange('totalRatings', parseInt(e.target.value) || 0), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", min: "0" })] })] })] })), activeTab === 'analytics' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Course Analytics & Optimization" }), _jsx("div", { className: "flex items-center space-x-2", children: _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx(Target, { className: "h-4 w-4 text-green-600" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Optimization Score:" }), _jsxs("span", { className: "text-lg font-bold text-green-600", children: [optimizationScore, "%"] })] }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx("div", { className: "bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-blue-700", children: "Content Completeness" }), _jsxs("p", { className: "text-2xl font-bold text-blue-900", children: [Math.min(Math.round((lessonContents.length / 5) * 100), 100), "%"] })] }), _jsx(CheckCircle2, { className: "h-8 w-8 text-blue-600" })] }) }), _jsx("div", { className: "bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-green-700", children: "Engagement Score" }), _jsxs("p", { className: "text-2xl font-bold text-green-900", children: [Math.min(Math.round(85 + (contentCounts.quiz * 3) + (contentCounts.interactive * 5)), 100), "%"] })] }), _jsx(TrendingUp, { className: "h-8 w-8 text-green-600" })] }) }), _jsx("div", { className: "bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-purple-700", children: "Learning Paths" }), _jsx("p", { className: "text-2xl font-bold text-purple-900", children: learningPathSuggestions.length })] }), _jsx(Lightbulb, { className: "h-8 w-8 text-purple-600" })] }) })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsxs("h4", { className: "font-medium text-gray-900 mb-4 flex items-center", children: [_jsx(BarChart3, { className: "h-5 w-5 mr-2 text-blue-600" }), "Content Distribution Analysis"] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-4", children: Object.entries(contentCounts).map(([type, count]) => (_jsxs("div", { className: "text-center", children: [_jsxs("div", { className: `w-12 h-12 mx-auto rounded-lg flex items-center justify-center mb-2 ${type === 'video' ? 'bg-red-100 text-red-600' :
                                                                type === 'quiz' ? 'bg-green-100 text-green-600' :
                                                                    type === 'interactive' ? 'bg-purple-100 text-purple-600' :
                                                                        type === 'resource' ? 'bg-blue-100 text-blue-600' :
                                                                            'bg-orange-100 text-orange-600'}`, children: [type === 'video' && _jsx(Video, { className: "h-6 w-6" }), type === 'quiz' && _jsx(ListChecks, { className: "h-6 w-6" }), type === 'interactive' && _jsx(Zap, { className: "h-6 w-6" }), type === 'resource' && _jsx(Download, { className: "h-6 w-6" }), type === 'reflection' && _jsx(HelpCircle, { className: "h-6 w-6" })] }), _jsx("p", { className: "text-lg font-bold text-gray-900", children: count }), _jsxs("p", { className: "text-sm text-gray-600 capitalize", children: [type, "s"] })] }, type))) })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsxs("h4", { className: "font-medium text-gray-900 mb-4 flex items-center", children: [_jsx(Sparkles, { className: "h-5 w-5 mr-2 text-yellow-600" }), "Optimization Recommendations"] }), _jsxs("div", { className: "space-y-3", children: [lessonContents.length === 0 && (_jsxs("div", { className: "flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-yellow-600 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-yellow-800", children: "Add Content" }), _jsx("p", { className: "text-sm text-yellow-700", children: "Start by adding videos, quizzes, or interactive content to your course." })] })] })), contentCounts.quiz === 0 && lessonContents.length > 0 && (_jsxs("div", { className: "flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200", children: [_jsx(Lightbulb, { className: "h-5 w-5 text-blue-600 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-blue-800", children: "Add Assessments" }), _jsx("p", { className: "text-sm text-blue-700", children: "Include quizzes to test learner knowledge and increase engagement." })] })] })), contentCounts.interactive === 0 && lessonContents.length > 2 && (_jsxs("div", { className: "flex items-start space-x-3 p-3 bg-purple-50 rounded-lg border border-purple-200", children: [_jsx(Zap, { className: "h-5 w-5 text-purple-600 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-purple-800", children: "Boost Interactivity" }), _jsx("p", { className: "text-sm text-purple-700", children: "Add interactive elements to make learning more engaging and memorable." })] })] })), lessonContents.length > 5 && contentCounts.reflection === 0 && (_jsxs("div", { className: "flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200", children: [_jsx(Clock, { className: "h-5 w-5 text-orange-600 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-orange-800", children: "Add Reflection Activities" }), _jsx("p", { className: "text-sm text-orange-700", children: "Help learners consolidate knowledge with reflection questions." })] })] })), lessonContents.length > 0 &&
                                                        Object.values(contentCounts).every(count => count > 0) && (_jsxs("div", { className: "flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200", children: [_jsx(Award, { className: "h-5 w-5 text-green-600 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-green-800", children: "Excellent Course Structure!" }), _jsx("p", { className: "text-sm text-green-700", children: "Your course has a well-balanced mix of content types for optimal learning." })] })] }))] })] })] })), activeTab === 'ai-assistant' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900 flex items-center", children: [_jsx(Brain, { className: "h-5 w-5 mr-2 text-blue-600" }), "AI-Powered Course Assistant"] }), _jsxs("button", { onClick: () => {
                                                    // Mock AI suggestions
                                                    setAiSuggestions([
                                                        { type: 'content', title: 'Add Video Introduction', priority: 'high' },
                                                        { type: 'structure', title: 'Optimize Learning Path', priority: 'medium' },
                                                        { type: 'engagement', title: 'Add Interactive Quiz', priority: 'high' }
                                                    ]);
                                                }, className: "flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: [_jsx(Sparkles, { className: "h-4 w-4 mr-2" }), "Generate Suggestions"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("h4", { className: "font-medium text-gray-900", children: "Content Suggestions" }), _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx(Lightbulb, { className: "h-5 w-5 text-blue-600 mt-1" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-blue-900", children: "Add Course Introduction Video" }), _jsx("p", { className: "text-sm text-blue-700 mt-1", children: "Welcome learners with a 2-3 minute introduction explaining what they'll learn and why it matters." })] })] }), _jsx("button", { className: "text-blue-600 hover:text-blue-800 text-sm font-medium", children: "Apply" })] }) }), _jsx("div", { className: "p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx(Target, { className: "h-5 w-5 text-green-600 mt-1" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-green-900", children: "Knowledge Check Quiz" }), _jsx("p", { className: "text-sm text-green-700 mt-1", children: "Add a quick quiz after every 2-3 content pieces to reinforce learning." })] })] }), _jsx("button", { className: "text-green-600 hover:text-green-800 text-sm font-medium", children: "Apply" })] }) }), _jsx("div", { className: "p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx(Zap, { className: "h-5 w-5 text-purple-600 mt-1" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-purple-900", children: "Interactive Scenario" }), _jsx("p", { className: "text-sm text-purple-700 mt-1", children: "Create a real-world scenario where learners can apply their knowledge." })] })] }), _jsx("button", { className: "text-purple-600 hover:text-purple-800 text-sm font-medium", children: "Apply" })] }) })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h4", { className: "font-medium text-gray-900", children: "Structure Optimization" }), _jsxs("div", { className: "p-4 bg-white border border-gray-200 rounded-lg", children: [_jsxs("h5", { className: "font-medium text-gray-900 mb-3 flex items-center", children: [_jsx(Clock, { className: "h-4 w-4 mr-2 text-gray-600" }), "Recommended Learning Path"] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center space-x-3 p-2 bg-gray-50 rounded", children: [_jsx("div", { className: "w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold", children: "1" }), _jsx("span", { className: "text-sm", children: "Course Introduction (Video)" })] }), _jsxs("div", { className: "flex items-center space-x-3 p-2 bg-gray-50 rounded", children: [_jsx("div", { className: "w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold", children: "2" }), _jsx("span", { className: "text-sm", children: "Core Learning Content" })] }), _jsxs("div", { className: "flex items-center space-x-3 p-2 bg-gray-50 rounded", children: [_jsx("div", { className: "w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold", children: "3" }), _jsx("span", { className: "text-sm", children: "Knowledge Assessment" })] }), _jsxs("div", { className: "flex items-center space-x-3 p-2 bg-gray-50 rounded", children: [_jsx("div", { className: "w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold", children: "4" }), _jsx("span", { className: "text-sm", children: "Practical Application" })] }), _jsxs("div", { className: "flex items-center space-x-3 p-2 bg-gray-50 rounded", children: [_jsx("div", { className: "w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold", children: "5" }), _jsx("span", { className: "text-sm", children: "Reflection & Summary" })] })] }), _jsx("button", { className: "mt-3 w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all", children: "Auto-Organize Content" })] })] })] })] })), activeTab === 'certification' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("input", { type: "checkbox", checked: !!formData.certification?.available, onChange: (e) => {
                                                    if (e.target.checked) {
                                                        handleInputChange('certification', {
                                                            available: true,
                                                            name: 'Course Certificate',
                                                            requirements: ['Complete all modules'],
                                                            validFor: '1 year',
                                                            renewalRequired: false
                                                        });
                                                    }
                                                    else {
                                                        handleInputChange('certification', undefined);
                                                    }
                                                }, className: "h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("label", { className: "text-sm font-medium text-gray-700", children: "Enable certification" })] }), formData.certification && (_jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Certificate Name" }), _jsx("input", { type: "text", value: formData.certification.name, onChange: (e) => handleInputChange('certification', {
                                                        ...formData.certification,
                                                        name: e.target.value
                                                    }), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }) }))] }))] }), _jsxs("div", { className: "flex items-center justify-between p-6 border-t border-gray-200", children: [_jsxs("div", { className: "flex items-center space-x-2 text-sm text-gray-500", children: [_jsx("span", { children: "Status: " }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs ${formData.status === 'published' ? 'bg-green-100 text-green-800' :
                                            formData.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'}`, children: formData.status })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors", children: "Cancel" }), _jsxs("button", { onClick: handleSave, className: "flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors", children: [_jsx(Save, { className: "h-4 w-4" }), _jsx("span", { children: "Save as Draft" })] }), formData.status !== 'published' && (_jsxs("button", { onClick: handlePublish, className: "flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors", children: [_jsx(Globe, { className: "h-4 w-4" }), _jsx("span", { children: "Publish" })] }))] })] })] }), contentModalOpen && (_jsx("div", { className: "fixed inset-0 z-60 bg-black bg-opacity-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-gray-200", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900", children: ["Add ", contentType.charAt(0).toUpperCase() + contentType.slice(1), " Content"] }), _jsx("button", { onClick: () => setContentModalOpen(false), className: "text-gray-400 hover:text-gray-600", children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "p-6 overflow-y-auto max-h-96", children: [contentType === 'video' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Video Title *" }), _jsx("input", { type: "text", value: modalFormData.title || '', onChange: (e) => handleModalInputChange('title', e.target.value), placeholder: "Enter video title", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { rows: 3, value: modalFormData.description || '', onChange: (e) => handleModalInputChange('description', e.target.value), placeholder: "Describe what learners will gain from this video", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Video Source" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", name: "videoSource", value: "upload", id: "upload", checked: modalFormData.videoSource === 'upload' || !modalFormData.videoSource, onChange: (e) => handleModalInputChange('videoSource', e.target.value) }), _jsx("label", { htmlFor: "upload", className: "font-medium", children: "Upload video file" })] }), (modalFormData.videoSource === 'upload' || !modalFormData.videoSource) && (_jsxs("div", { className: "ml-6 space-y-3", children: [_jsxs("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-6", children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "video/mp4,video/mov,video/avi,video/webm", onChange: (e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) {
                                                                                    handleModalInputChange('videoFile', file);
                                                                                    handleModalInputChange('fileName', file.name);
                                                                                    handleModalInputChange('fileSize', (file.size / 1024 / 1024).toFixed(2));
                                                                                }
                                                                            }, className: "hidden" }), _jsxs("div", { className: "text-center", children: [_jsx(Upload, { className: "mx-auto h-12 w-12 text-gray-400" }), _jsx("div", { className: "mt-4", children: _jsx("button", { type: "button", onClick: () => fileInputRef.current?.click(), className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500", children: "Choose Video File" }) }), _jsx("p", { className: "mt-2 text-sm text-gray-600", children: "MP4, MOV, AVI, WebM up to 500MB" })] })] }), modalFormData.fileName && (_jsx("div", { className: "bg-green-50 border border-green-200 rounded-lg p-3", children: _jsxs("div", { className: "flex items-center", children: [_jsx(Video, { className: "h-5 w-5 text-green-600 mr-2" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-green-800", children: modalFormData.fileName }), _jsxs("p", { className: "text-sm text-green-600", children: [modalFormData.fileSize, " MB"] })] })] }) }))] })), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", name: "videoSource", value: "youtube", id: "youtube", checked: modalFormData.videoSource === 'youtube', onChange: (e) => handleModalInputChange('videoSource', e.target.value) }), _jsx("label", { htmlFor: "youtube", className: "font-medium", children: "YouTube URL" })] }), modalFormData.videoSource === 'youtube' && (_jsxs("div", { className: "ml-6 space-y-3", children: [_jsx("input", { type: "url", value: modalFormData.videoUrl || '', onChange: (e) => handleModalInputChange('videoUrl', e.target.value), placeholder: "https://www.youtube.com/watch?v=...", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" }), modalFormData.videoUrl && (_jsxs("div", { className: "bg-gray-50 border rounded-lg p-3", children: [_jsx("p", { className: "text-sm text-gray-600 mb-2", children: "Preview:" }), _jsx("div", { className: "aspect-video bg-black rounded-lg flex items-center justify-center", children: _jsx(Play, { className: "h-12 w-12 text-white opacity-75" }) })] }))] })), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", name: "videoSource", value: "vimeo", id: "vimeo", checked: modalFormData.videoSource === 'vimeo', onChange: (e) => handleModalInputChange('videoSource', e.target.value) }), _jsx("label", { htmlFor: "vimeo", className: "font-medium", children: "Vimeo URL" })] }), modalFormData.videoSource === 'vimeo' && (_jsxs("div", { className: "ml-6 space-y-3", children: [_jsx("input", { type: "url", value: modalFormData.videoUrl || '', onChange: (e) => handleModalInputChange('videoUrl', e.target.value), placeholder: "https://vimeo.com/...", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" }), modalFormData.videoUrl && (_jsxs("div", { className: "bg-gray-50 border rounded-lg p-3", children: [_jsx("p", { className: "text-sm text-gray-600 mb-2", children: "Preview:" }), _jsx("div", { className: "aspect-video bg-black rounded-lg flex items-center justify-center", children: _jsx(Play, { className: "h-12 w-12 text-white opacity-75" }) })] }))] })), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "radio", name: "videoSource", value: "direct", id: "directUrl", checked: modalFormData.videoSource === 'direct', onChange: (e) => handleModalInputChange('videoSource', e.target.value) }), _jsx("label", { htmlFor: "directUrl", className: "font-medium", children: "Direct Video URL" })] }), modalFormData.videoSource === 'direct' && (_jsxs("div", { className: "ml-6 space-y-3", children: [_jsx("input", { type: "url", value: modalFormData.videoUrl || '', onChange: (e) => handleModalInputChange('videoUrl', e.target.value), placeholder: "https://example.com/video.mp4", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" }), _jsx("p", { className: "text-sm text-gray-500", children: "Direct link to MP4, WebM, or other video file" }), modalFormData.videoUrl && (_jsxs("div", { className: "bg-gray-50 border rounded-lg p-3", children: [_jsx("p", { className: "text-sm text-gray-600 mb-2", children: "Preview:" }), _jsxs("video", { className: "w-full rounded", controls: true, preload: "metadata", children: [_jsx("source", { src: modalFormData.videoUrl }), "Your browser does not support the video tag."] })] }))] }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Estimated Duration (minutes)" }), _jsx("input", { type: "number", value: modalFormData.duration || '', onChange: (e) => handleModalInputChange('duration', parseInt(e.target.value) || 0), placeholder: "10", className: "w-full border border-gray-300 rounded-lg px-3 py-2" })] }), _jsxs("div", { className: "border-t pt-4", children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-3", children: "Playback Settings" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Required Watch Percentage" }), _jsxs("select", { value: modalFormData.watchPercentage || 80, onChange: (e) => handleModalInputChange('watchPercentage', parseInt(e.target.value)), className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: 50, children: "50% - Partial viewing required" }), _jsx("option", { value: 75, children: "75% - Most content required" }), _jsx("option", { value: 80, children: "80% - Nearly complete (recommended)" }), _jsx("option", { value: 90, children: "90% - Almost everything" }), _jsx("option", { value: 100, children: "100% - Complete viewing required" })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", id: "resumePosition", checked: modalFormData.resumeFromLastPosition !== false, onChange: (e) => handleModalInputChange('resumeFromLastPosition', e.target.checked), className: "rounded border-gray-300" }), _jsx("label", { htmlFor: "resumePosition", className: "text-sm text-gray-700", children: "Allow resume from last position" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", id: "markAsWatched", checked: modalFormData.markAsWatched !== false, onChange: (e) => handleModalInputChange('markAsWatched', e.target.checked), className: "rounded border-gray-300" }), _jsx("label", { htmlFor: "markAsWatched", className: "text-sm text-gray-700", children: "Auto-mark as completed when finished" })] })] })] }), _jsxs("div", { className: "border-t pt-4", children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-3", children: "Accessibility (Optional)" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Transcript (.txt, .srt)" }), _jsx("input", { type: "file", accept: ".txt,.srt", onChange: (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            handleModalInputChange('transcriptFile', file);
                                                                            handleModalInputChange('transcriptName', file.name);
                                                                        }
                                                                    }, className: "w-full border border-gray-300 rounded-lg px-3 py-2" }), modalFormData.transcriptName && (_jsxs("p", { className: "text-sm text-green-600 mt-1", children: ["\u2713 ", modalFormData.transcriptName] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Captions (.vtt, .srt)" }), _jsx("input", { type: "file", accept: ".vtt,.srt", onChange: (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            handleModalInputChange('captionsFile', file);
                                                                            handleModalInputChange('captionsName', file.name);
                                                                        }
                                                                    }, className: "w-full border border-gray-300 rounded-lg px-3 py-2" }), modalFormData.captionsName && (_jsxs("p", { className: "text-sm text-green-600 mt-1", children: ["\u2713 ", modalFormData.captionsName] }))] })] })] })] })), contentType === 'quiz' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Quiz Title *" }), _jsx("input", { type: "text", placeholder: "Enter quiz title", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { rows: 2, placeholder: "Describe the purpose of this quiz", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Passing Score (%)" }), _jsx("input", { type: "number", value: "80", className: "w-full border border-gray-300 rounded-lg px-3 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Max Attempts" }), _jsxs("select", { className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "3", children: "3" }), _jsx("option", { value: "5", children: "5" }), _jsx("option", { value: "unlimited", children: "Unlimited" })] })] })] })] })), contentType === 'interactive' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Interactive Title *" }), _jsx("input", { type: "text", placeholder: "Enter interactive element title", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Interactive Type" }), _jsxs("select", { className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "drag-drop", children: "Drag & Drop Exercise" }), _jsx("option", { value: "scenario", children: "Branching Scenario" }), _jsx("option", { value: "simulation", children: "Virtual Simulation" }), _jsx("option", { value: "checklist", children: "Interactive Checklist" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Instructions" }), _jsx("textarea", { rows: 3, placeholder: "Provide clear instructions for learners", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" })] })] })), contentType === 'resource' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Resource Title *" }), _jsx("input", { type: "text", placeholder: "Enter resource title", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Resource Type" }), _jsxs("select", { className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "pdf", children: "PDF Document" }), _jsx("option", { value: "doc", children: "Word Document" }), _jsx("option", { value: "ppt", children: "PowerPoint Presentation" }), _jsx("option", { value: "link", children: "External Link" }), _jsx("option", { value: "zip", children: "Archive/Package" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { rows: 2, placeholder: "Describe this resource and how it helps learners", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "downloadableResource", className: "mr-2", defaultChecked: true }), _jsx("label", { htmlFor: "downloadableResource", className: "text-sm text-gray-700", children: "Allow download" })] })] })), contentType === 'reflection' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Reflection Title *" }), _jsx("input", { type: "text", placeholder: "Enter reflection activity title", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Reflection Question" }), _jsx("textarea", { rows: 4, placeholder: "What would you like learners to reflect on? Be specific and thought-provoking.", className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Word Limit" }), _jsx("input", { type: "number", placeholder: "500", className: "w-full border border-gray-300 rounded-lg px-3 py-2" })] }), _jsxs("div", { className: "flex items-center pt-6", children: [_jsx("input", { type: "checkbox", id: "requiredReflection", className: "mr-2" }), _jsx("label", { htmlFor: "requiredReflection", className: "text-sm text-gray-700", children: "Required for completion" })] })] })] }))] }), _jsxs("div", { className: "flex items-center justify-end space-x-3 p-6 border-t border-gray-200", children: [_jsx("button", { onClick: () => setContentModalOpen(false), className: "px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50", children: "Cancel" }), _jsx("button", { onClick: handleAddContent, className: "px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: "Add Content" })] })] }) }))] }));
};
export default CourseEditModal;
