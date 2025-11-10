import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Eye, Plus, Trash2, Upload, Video, FileText, HelpCircle, Settings, ChevronDown, ChevronUp, PlayCircle, Clock, Users, Award, BookOpen, Edit3, Move, Copy } from 'lucide-react';
import courseManagementStore from '../../store/courseManagementStore';
import LoadingButton from '../../components/LoadingButton';
import Modal from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import { courseStore } from '../../store/courseStore';
import { formatMinutes, slugify, parseDurationToMinutes } from '../../utils/courseNormalization';
import { clearCourseCache } from '../../dal/courseData';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/courses';
import { computeCourseDiff } from '../../utils/courseDiff';
const generateId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const DRAFT_STORAGE_PREFIX = 'course_builder_draft_';
const AUTOSAVE_DELAY = 800;
const REMOTE_AUTOSAVE_DELAY = 1500;
const isSupabaseReady = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
const remoteDraftTimers = new Map();
const readDraftCourse = (id) => {
    try {
        const raw = localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${id}`);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch (error) {
        console.warn('Failed to parse course draft', error);
        return null;
    }
};
const writeDraftCourse = (id, data) => {
    try {
        localStorage.setItem(`${DRAFT_STORAGE_PREFIX}${id}`, JSON.stringify(data));
    }
    catch (error) {
        console.warn('Failed to write course draft', error);
    }
};
const queueRemoteDraftSync = (course) => {
    if (!isSupabaseReady) {
        return;
    }
    const existingTimer = remoteDraftTimers.get(course.id);
    if (existingTimer) {
        window.clearTimeout(existingTimer);
    }
    const timeoutId = window.setTimeout(() => {
        syncCourseToDatabase({
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
const convertModulesToChapters = (course) => {
    if (course.chapters && course.chapters.length > 0) {
        return recalculateCourseDurations(course);
    }
    const modules = course.modules || [];
    const chapters = modules.map((module, moduleIndex) => {
        const lessons = (module.lessons || []).map((lesson, lessonIndex) => {
            const estimated = lesson.estimatedDuration ??
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
const mergeDraft = (base, draft) => {
    if (base.id !== draft.id) {
        return base;
    }
    const merged = {
        ...base,
        ...draft,
        chapters: draft.chapters && draft.chapters.length > 0 ? draft.chapters : base.chapters,
        modules: draft.modules && draft.modules.length > 0 ? draft.modules : base.modules,
    };
    return recalculateCourseDurations(merged);
};
const recalculateCourseDurations = (course) => {
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
const buildModulesFromChapters = (course) => {
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
const validateCourse = (course) => {
    const issues = [];
    if (!course.title || course.title.trim().length === 0) {
        issues.push('Course title is required.');
    }
    if (!course.description || course.description.trim().length < 20) {
        issues.push('Course description should be at least 20 characters.');
    }
    if (!course.chapters || course.chapters.length === 0) {
        issues.push('Add at least one chapter before saving.');
    }
    else {
        course.chapters.forEach((chapter, chapterIndex) => {
            if (!chapter.title || chapter.title.trim().length === 0) {
                issues.push(`Chapter ${chapterIndex + 1} needs a title.`);
            }
            if (!chapter.lessons || chapter.lessons.length === 0) {
                issues.push(`Chapter ${chapterIndex + 1} must include at least one lesson.`);
            }
            else {
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
const AdvancedCourseBuilder = () => {
    const navigate = useNavigate();
    const { courseId } = useParams();
    const isEditing = courseId !== 'new';
    const { showToast } = useToast();
    const [course, setCourse] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [expandedChapters, setExpandedChapters] = useState(new Set());
    const [editingLesson, setEditingLesson] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const autosaveTimeoutRef = useRef(null);
    const lastPersistedRef = useRef(null);
    useEffect(() => {
        if (isEditing && courseId) {
            const existingCourse = courseManagementStore.getCourse(courseId);
            if (existingCourse) {
                const normalized = recalculateCourseDurations(existingCourse);
                const draft = readDraftCourse(courseId);
                setCourse(draft ? mergeDraft(normalized, draft) : normalized);
                return;
            }
            const resolved = typeof courseStore.resolveCourse === 'function'
                ? courseStore.resolveCourse(courseId) || courseStore.getCourse(courseId)
                : courseStore.getCourse(courseId);
            if (resolved) {
                const editableCourse = convertModulesToChapters(resolved);
                courseManagementStore.setCourse(editableCourse);
                const draft = readDraftCourse(resolved.id);
                const initialCourse = draft ? mergeDraft(editableCourse, draft) : editableCourse;
                setCourse(initialCourse);
                lastPersistedRef.current = initialCourse;
            }
            else {
                showToast('We could not find that course. Redirecting back to the course list.', 'error');
                navigate('/admin/courses');
            }
        }
        else {
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
    const scheduleAutosave = (snapshot) => {
        if (!snapshot)
            return;
        const draftPayload = buildModulesFromChapters(recalculateCourseDurations({
            ...snapshot,
            status: snapshot.status === 'published' ? snapshot.status : 'draft',
            updatedAt: new Date().toISOString(),
        }));
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
        if (!course)
            return [];
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
    const persistCourse = async (statusOverride) => {
        if (!course)
            return null;
        setIsLoading(true);
        try {
            const recalculated = recalculateCourseDurations(course);
            const slug = recalculated.slug || slugify(recalculated.title || recalculated.id);
            const status = statusOverride ?? recalculated.status ?? 'draft';
            const publishedAt = status === 'published'
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
                persistedSnapshot = await syncCourseToDatabase(courseForStore);
            }
            catch (error) {
                if (error instanceof CourseValidationError) {
                    showToast(`Save blocked until the following issues are fixed: ${error.issues.join(' • ')}`, 'error');
                    return null;
                }
                throw error;
            }
            const authoritativeCourse = recalculateCourseDurations(persistedSnapshot ? convertModulesToChapters(persistedSnapshot) : recalculated);
            const storePayload = buildModulesFromChapters(authoritativeCourse);
            courseManagementStore.setCourse(storePayload);
            courseStore.saveCourse(storePayload, { skipRemoteSync: true });
            clearCourseCache();
            setCourse(authoritativeCourse);
            lastPersistedRef.current = authoritativeCourse;
            return storePayload;
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSaveCourse = async () => {
        try {
            const saved = await persistCourse();
            if (saved) {
                showToast('Course changes saved.', 'success');
            }
        }
        catch (error) {
            console.error('Error saving course:', error);
            showToast('Something went wrong while saving. Please try again.', 'error');
        }
    };
    const handlePublishCourse = async () => {
        if (!course)
            return;
        const confirmed = confirm('Publish this course? Learners assigned to it will immediately see the updated content.');
        if (!confirmed)
            return;
        try {
            const published = await persistCourse('published');
            if (published) {
                showToast('Course published successfully.', 'success');
            }
        }
        catch (error) {
            console.error('Error publishing course:', error);
            showToast('We could not publish the course. Please try again.', 'error');
        }
    };
    const addChapter = () => {
        if (!course)
            return;
        setCourse((current) => {
            if (!current)
                return current;
            const baseChapters = current.chapters || [];
            const chapterId = generateId('chapter');
            const newChapter = {
                id: chapterId,
                courseId: current.id,
                title: `Chapter ${baseChapters.length + 1}`,
                description: 'New chapter description',
                order: baseChapters.length + 1,
                estimatedDuration: 0,
                lessons: [],
            };
            const nextCourse = recalculateCourseDurations({
                ...current,
                chapters: [...baseChapters, newChapter],
            });
            setExpandedChapters((prev) => new Set([...prev, chapterId]));
            return nextCourse;
        });
        showToast('Chapter added. Start adding lessons to build out the module.', 'success');
    };
    const addLesson = (chapterId, lessonType) => {
        if (!course)
            return;
        setCourse((current) => {
            if (!current)
                return current;
            const baseChapters = current.chapters || [];
            const chapterIndex = baseChapters.findIndex((chapter) => chapter.id === chapterId);
            if (chapterIndex === -1)
                return current;
            const lessonId = generateId('lesson');
            const newLesson = {
                id: lessonId,
                chapterId,
                title: `New ${lessonType.charAt(0).toUpperCase() + lessonType.slice(1)} Lesson`,
                description: `${lessonType} lesson description`,
                type: lessonType,
                order: (baseChapters[chapterIndex].lessons?.length || 0) + 1,
                estimatedDuration: lessonType === 'quiz' ? 10 : 15,
                content: {},
                isRequired: true,
                resources: [],
            };
            const updatedChapters = baseChapters.map((chapter, index) => {
                if (index !== chapterIndex)
                    return chapter;
                return {
                    ...chapter,
                    lessons: [...(chapter.lessons || []), newLesson],
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
    const toggleChapterExpansion = (chapterId) => {
        setExpandedChapters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(chapterId)) {
                newSet.delete(chapterId);
            }
            else {
                newSet.add(chapterId);
            }
            return newSet;
        });
    };
    const handleCourseInfoUpdate = (field, value) => {
        if (!course)
            return;
        const updatedCourse = { ...course, [field]: value };
        setCourse(updatedCourse);
    };
    const updateLesson = (chapterId, lessonId, updates) => {
        setCourse((current) => {
            if (!current)
                return current;
            const updatedChapters = (current.chapters || []).map((chapter) => {
                if (chapter.id !== chapterId)
                    return chapter;
                const updatedLessons = chapter.lessons.map((lesson) => {
                    if (lesson.id !== lessonId)
                        return lesson;
                    const nextContent = updates.content
                        ? { ...(lesson.content || {}), ...updates.content }
                        : lesson.content;
                    const estimatedDuration = updates.estimatedDuration !== undefined
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
    const deleteLesson = (chapterId, lessonId) => {
        if (!course)
            return;
        setCourse((current) => {
            if (!current)
                return current;
            const updatedChapters = (current.chapters || []).map((chapter) => {
                if (chapter.id !== chapterId)
                    return chapter;
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
        return (_jsx("div", { className: "flex items-center justify-center min-h-screen", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsxs("div", { className: "bg-white border-b border-gray-200 px-6 py-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("button", { onClick: () => navigate('/admin/courses'), className: "text-gray-600 hover:text-gray-800", children: "\u2190 Back to Courses" }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: course.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [_jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${course.status === 'published'
                                                            ? 'bg-green-100 text-green-800'
                                                            : course.status === 'draft'
                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                : 'bg-gray-100 text-gray-800'}`, children: course.status }), _jsxs("span", { className: "flex items-center", children: [_jsx(Clock, { className: "w-4 h-4 mr-1" }), course.estimatedDuration, " min"] }), _jsxs("span", { className: "flex items-center", children: [_jsx(Users, { className: "w-4 h-4 mr-1" }), course.enrollmentCount, " enrolled"] })] })] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("button", { onClick: () => setShowPreview(true), className: "flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors", children: [_jsx(Eye, { className: "w-4 h-4 mr-2" }), "Preview"] }), _jsxs(LoadingButton, { onClick: handleSaveCourse, loading: isLoading, variant: "secondary", className: "flex items-center", children: [_jsx(Save, { className: "w-4 h-4 mr-2" }), "Save"] }), course.status !== 'published' && (_jsxs(LoadingButton, { onClick: handlePublishCourse, loading: isLoading, variant: "success", className: "flex items-center", disabled: validationErrors.length > 0, children: [_jsx(Award, { className: "w-4 h-4 mr-2" }), "Publish"] }))] })] }), validationErrors.length > 0 && (_jsxs("div", { className: "mx-6 mt-4 rounded-lg border border-deepred/30 bg-deepred/10 px-4 py-3 text-sm text-deepred", children: [_jsx("p", { className: "font-semibold", children: "Resolve the following before publishing (draft saves are allowed):" }), _jsxs("ul", { className: "mt-2 space-y-1 list-disc pl-5", children: [validationErrors.slice(0, 4).map((issue) => (_jsx("li", { children: issue }, issue))), validationErrors.length > 4 && (_jsxs("li", { children: ["+ ", validationErrors.length - 4, " more issue(s)..."] }))] })] })), _jsx("div", { className: "mt-4", children: _jsx("nav", { className: "flex space-x-8", children: [
                                { id: 'overview', label: 'Overview', icon: BookOpen },
                                { id: 'content', label: 'Content', icon: PlayCircle },
                                { id: 'settings', label: 'Settings', icon: Settings },
                                { id: 'analytics', label: 'Analytics', icon: Users },
                            ].map(tab => {
                                const Icon = tab.icon;
                                return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `flex items-center px-3 py-2 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                        ? 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'}`, children: [_jsx(Icon, { className: "w-4 h-4 mr-2" }), tab.label] }, tab.id));
                            }) }) })] }), _jsxs("div", { className: "flex-1 px-6 py-6", children: [activeTab === 'overview' && (_jsx(OverviewTab, { course: course, onUpdate: handleCourseInfoUpdate })), activeTab === 'content' && (_jsx(ContentTab, { course: course, expandedChapters: expandedChapters, onToggleChapter: toggleChapterExpansion, onAddChapter: addChapter, onAddLesson: addLesson, onEditLesson: setEditingLesson, onUpdateLesson: updateLesson, onDeleteLesson: deleteLesson, onCloseLessonEditor: () => setEditingLesson(null), editingLesson: editingLesson })), activeTab === 'settings' && (_jsx(SettingsTab, { course: course, onUpdate: handleCourseInfoUpdate })), activeTab === 'analytics' && course.status === 'published' && (_jsx(AnalyticsTab, { courseId: course.id }))] }), _jsx(Modal, { isOpen: showPreview, onClose: () => setShowPreview(false), title: "Course Preview", maxWidth: "2xl", children: _jsx("div", { className: "p-4", children: _jsx(CoursePreview, { course: course }) }) })] }));
};
// Overview Tab Component
const OverviewTab = ({ course, onUpdate }) => {
    return (_jsx("div", { className: "max-w-4xl mx-auto space-y-8", children: _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900 mb-6", children: "Course Information" }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "lg:col-span-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Course Title" }), _jsx("input", { type: "text", value: course.title, onChange: (e) => onUpdate('title', e.target.value), className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter course title" })] }), _jsxs("div", { className: "lg:col-span-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { value: course.description, onChange: (e) => onUpdate('description', e.target.value), rows: 4, className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Describe what learners will gain from this course" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Category" }), _jsxs("select", { value: course.category, onChange: (e) => onUpdate('category', e.target.value), className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "Leadership", children: "Leadership" }), _jsx("option", { value: "Safety & Compliance", children: "Safety & Compliance" }), _jsx("option", { value: "Technology", children: "Technology" }), _jsx("option", { value: "Professional Development", children: "Professional Development" }), _jsx("option", { value: "Soft Skills", children: "Soft Skills" }), _jsx("option", { value: "Technical Skills", children: "Technical Skills" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Difficulty Level" }), _jsxs("select", { value: course.difficulty, onChange: (e) => onUpdate('difficulty', e.target.value), className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "Beginner", children: "Beginner" }), _jsx("option", { value: "Intermediate", children: "Intermediate" }), _jsx("option", { value: "Advanced", children: "Advanced" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Language" }), _jsxs("select", { value: course.language, onChange: (e) => onUpdate('language', e.target.value), className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "English", children: "English" }), _jsx("option", { value: "Spanish", children: "Spanish" }), _jsx("option", { value: "French", children: "French" }), _jsx("option", { value: "German", children: "German" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Estimated Duration (minutes)" }), _jsx("input", { type: "number", value: course.estimatedDuration, onChange: (e) => onUpdate('estimatedDuration', parseInt(e.target.value)), className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", min: "1" })] })] }), _jsxs("div", { className: "mt-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Learning Objectives" }), _jsx(LearningObjectivesEditor, { objectives: course.learningObjectives || [], onChange: (objectives) => onUpdate('learningObjectives', objectives) })] }), _jsxs("div", { className: "mt-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Course Thumbnail" }), _jsx(ThumbnailUploader, { currentThumbnail: course.thumbnail || '', onChange: (thumbnail) => onUpdate('thumbnail', thumbnail) })] })] }) }));
};
// Content Tab Component
const ContentTab = ({ course, expandedChapters, onToggleChapter, onAddChapter, onAddLesson, onEditLesson, onUpdateLesson, onDeleteLesson, onCloseLessonEditor, editingLesson }) => {
    return (_jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Course Content" }), _jsxs("button", { onClick: onAddChapter, className: "flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Chapter"] })] }), _jsxs("div", { className: "space-y-4", children: [(course.chapters || []).map((chapter, chapterIndex) => (_jsx(ChapterEditor, { chapter: chapter, index: chapterIndex, isExpanded: expandedChapters.has(chapter.id), onToggleExpanded: () => onToggleChapter(chapter.id), onAddLesson: (type) => onAddLesson(chapter.id, type), onEditLesson: onEditLesson, onUpdateLesson: (lessonId, updates) => onUpdateLesson(chapter.id, lessonId, updates), onDeleteLesson: (lessonId) => onDeleteLesson(chapter.id, lessonId), onCloseLessonEditor: onCloseLessonEditor, editingLesson: editingLesson }, chapter.id))), (!course.chapters || course.chapters.length === 0) && (_jsxs("div", { className: "text-center py-12 bg-white rounded-xl border border-gray-200", children: [_jsx(BookOpen, { className: "w-12 h-12 text-gray-400 mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No chapters yet" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Start building your course by adding the first chapter." }), _jsxs("button", { onClick: onAddChapter, className: "inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Your First Chapter"] })] }))] })] }));
};
// Settings Tab Component
const SettingsTab = ({ course, onUpdate }) => {
    return (_jsxs("div", { className: "max-w-4xl mx-auto space-y-8", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900 mb-6", children: "Accessibility Settings" }), _jsxs("div", { className: "space-y-4", children: [_jsx(AccessibilityOption, { title: "Closed Captions", description: "Provide text captions for video content", checked: course.accessibilityFeatures?.hasClosedCaptions ?? false, onChange: (checked) => onUpdate('accessibilityFeatures', {
                                    ...(course.accessibilityFeatures || {}),
                                    hasClosedCaptions: checked
                                }) }), _jsx(AccessibilityOption, { title: "Transcripts", description: "Provide full text transcripts for all media", checked: course.accessibilityFeatures?.hasTranscripts ?? false, onChange: (checked) => onUpdate('accessibilityFeatures', {
                                    ...(course.accessibilityFeatures || {}),
                                    hasTranscripts: checked
                                }) }), _jsx(AccessibilityOption, { title: "Audio Descriptions", description: "Include audio descriptions for visual content", checked: course.accessibilityFeatures?.hasAudioDescription ?? false, onChange: (checked) => onUpdate('accessibilityFeatures', {
                                    ...(course.accessibilityFeatures || {}),
                                    hasAudioDescription: checked
                                }) })] })] }), _jsx(CertificateSettings, { course: course, onUpdate: onUpdate })] }));
};
// Analytics Tab Component  
const AnalyticsTab = ({ courseId }) => {
    const analytics = courseManagementStore.getCourseAnalytics(courseId);
    if (!analytics) {
        return (_jsxs("div", { className: "text-center py-12", children: [_jsx(Users, { className: "w-12 h-12 text-gray-400 mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No analytics data yet" }), _jsx("p", { className: "text-gray-600", children: "Analytics will appear once learners start engaging with your course." })] }));
    }
    return (_jsx("div", { className: "max-w-6xl mx-auto space-y-6", children: _jsx(CourseAnalyticsDashboard, { analytics: analytics }) }));
};
// Helper Components
const LearningObjectivesEditor = ({ objectives, onChange }) => {
    const addObjective = () => {
        onChange([...objectives, '']);
    };
    const updateObjective = (index, value) => {
        const updated = [...objectives];
        updated[index] = value;
        onChange(updated);
    };
    const removeObjective = (index) => {
        onChange(objectives.filter((_, i) => i !== index));
    };
    return (_jsxs("div", { className: "space-y-2", children: [objectives.map((objective, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "text", value: objective, onChange: (e) => updateObjective(index, e.target.value), className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter learning objective" }), _jsx("button", { onClick: () => removeObjective(index), className: "p-2 text-red-600 hover:text-red-800", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, index))), _jsxs("button", { onClick: addObjective, className: "flex items-center px-3 py-2 text-orange-600 hover:text-orange-800", children: [_jsx(Plus, { className: "w-4 h-4 mr-1" }), "Add Objective"] })] }));
};
const ThumbnailUploader = ({ currentThumbnail, onChange }) => {
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // In a real app, you'd upload to a service and get back a URL
            const fakeUrl = URL.createObjectURL(file);
            onChange(fakeUrl);
        }
    };
    return (_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("img", { src: currentThumbnail, alt: "Course thumbnail", className: "w-24 h-16 object-cover rounded-lg border border-gray-300" }), _jsxs("label", { className: "cursor-pointer flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors", children: [_jsx(Upload, { className: "w-4 h-4 mr-2" }), "Upload New", _jsx("input", { type: "file", accept: "image/*", onChange: handleFileUpload, className: "hidden" })] })] }));
};
const ChapterEditor = ({ chapter, index, isExpanded, onToggleExpanded, onAddLesson, onEditLesson, onUpdateLesson, onDeleteLesson, onCloseLessonEditor, editingLesson, }) => {
    return (_jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsx("div", { className: "p-4 border-b border-gray-200 bg-gray-50", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("button", { onClick: onToggleExpanded, className: "p-1 hover:bg-gray-200 rounded", children: isExpanded ? (_jsx(ChevronUp, { className: "w-4 h-4" })) : (_jsx(ChevronDown, { className: "w-4 h-4" })) }), _jsxs("div", { children: [_jsxs("h3", { className: "font-medium text-gray-900", children: ["Chapter ", index + 1, ": ", chapter.title] }), _jsxs("p", { className: "text-sm text-gray-600", children: [chapter.lessons.length, " lessons \u2022 ", chapter.estimatedDuration, " min"] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { className: "p-2 text-gray-600 hover:text-gray-800", children: _jsx(Edit3, { className: "w-4 h-4" }) }), _jsx("button", { className: "p-2 text-gray-600 hover:text-gray-800", children: _jsx(Move, { className: "w-4 h-4" }) })] })] }) }), isExpanded && (_jsxs("div", { className: "p-4", children: [_jsx("div", { className: "space-y-3 mb-4", children: chapter.lessons.map((lesson, lessonIndex) => (_jsx(LessonItem, { lesson: lesson, index: lessonIndex, isEditing: editingLesson === lesson.id, onEdit: () => onEditLesson(lesson.id), onUpdate: (updates) => onUpdateLesson(lesson.id, updates), onDelete: () => onDeleteLesson(lesson.id), onClose: onCloseLessonEditor }, lesson.id))) }), _jsxs("div", { className: "flex items-center space-x-2 pt-4 border-t border-gray-200", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Add lesson:" }), _jsxs("button", { onClick: () => onAddLesson('video'), className: "flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200", children: [_jsx(Video, { className: "w-3 h-3 mr-1" }), "Video"] }), _jsxs("button", { onClick: () => onAddLesson('text'), className: "flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200", children: [_jsx(FileText, { className: "w-3 h-3 mr-1" }), "Text"] }), _jsxs("button", { onClick: () => onAddLesson('quiz'), className: "flex items-center px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200", children: [_jsx(HelpCircle, { className: "w-3 h-3 mr-1" }), "Quiz"] }), _jsxs("button", { onClick: () => onAddLesson('interactive'), className: "flex items-center px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200", children: [_jsx(Settings, { className: "w-3 h-3 mr-1" }), "Interactive"] })] })] }))] }));
};
const LessonItem = ({ lesson, index, isEditing, onEdit, onUpdate, onDelete, onClose }) => {
    const getTypeIcon = (type) => {
        switch (type) {
            case 'video': return _jsx(Video, { className: "w-4 h-4 text-blue-600" });
            case 'text': return _jsx(FileText, { className: "w-4 h-4 text-green-600" });
            case 'quiz': return _jsx(HelpCircle, { className: "w-4 h-4 text-purple-600" });
            case 'interactive': return _jsx(Settings, { className: "w-4 h-4 text-orange-600" });
            default: return _jsx(FileText, { className: "w-4 h-4 text-gray-600" });
        }
    };
    const handleDelete = () => {
        const confirmed = confirm('Remove this lesson? This action cannot be undone.');
        if (confirmed) {
            onDelete();
        }
    };
    const handleDurationChange = (value) => {
        const minutes = Math.max(0, Number.parseInt(value, 10) || 0);
        onUpdate({ estimatedDuration: minutes });
    };
    if (isEditing) {
        const videoUrl = lesson.content?.videoUrl || '';
        const transcript = lesson.content?.transcript || '';
        const textContent = lesson.content?.textContent || lesson.content?.content || '';
        const interactiveUrl = lesson.content?.interactiveUrl || '';
        return (_jsxs("div", { className: "space-y-4 rounded-lg border border-orange-400 bg-orange-50 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [getTypeIcon(lesson.type), _jsxs("span", { className: "text-sm font-semibold text-orange-700", children: ["Editing: Lesson ", index + 1] })] }), _jsx("button", { onClick: onClose, className: "text-sm font-medium text-orange-700 hover:text-orange-900", children: "Done" })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-orange-800", children: "Lesson title" }), _jsx("input", { type: "text", value: lesson.title, onChange: (event) => onUpdate({ title: event.target.value }), className: "w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200", placeholder: "Enter lesson title" })] }), _jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-orange-800", children: "Description" }), _jsx("textarea", { value: lesson.description || '', onChange: (event) => onUpdate({ description: event.target.value }), rows: 3, className: "w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200", placeholder: "What should learners expect from this lesson?" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-orange-800", children: "Estimated duration (minutes)" }), _jsx("input", { type: "number", min: 0, value: lesson.estimatedDuration ?? 0, onChange: (event) => handleDurationChange(event.target.value), className: "w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { id: `lesson-required-${lesson.id}`, type: "checkbox", checked: lesson.isRequired !== false, onChange: (event) => onUpdate({ isRequired: event.target.checked }), className: "h-4 w-4 rounded border-orange-200 text-orange-600 focus:ring-orange-400" }), _jsx("label", { htmlFor: `lesson-required-${lesson.id}`, className: "text-sm text-orange-800", children: "Required for course completion" })] }), lesson.type === 'video' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-orange-800", children: "Video URL" }), _jsx("input", { type: "url", value: videoUrl, onChange: (event) => onUpdate({
                                                content: {
                                                    videoUrl: event.target.value.trim(),
                                                    videoSourceType: event.target.value ? 'external' : undefined,
                                                },
                                            }), className: "w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200", placeholder: "https://" })] }), _jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-orange-800", children: "Transcript (optional)" }), _jsx("textarea", { value: transcript, onChange: (event) => onUpdate({ content: { transcript: event.target.value } }), rows: 3, className: "w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200", placeholder: "Paste a transcript or summary learners can read." })] })] })), lesson.type === 'text' && (_jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-orange-800", children: "Lesson body" }), _jsx("textarea", { value: textContent, onChange: (event) => onUpdate({ content: { textContent: event.target.value, content: event.target.value } }), rows: 6, className: "w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200", placeholder: "Write or paste the lesson content." })] })), lesson.type === 'interactive' && (_jsxs("div", { className: "space-y-2 md:col-span-2", children: [_jsx("label", { className: "text-xs font-medium uppercase tracking-wide text-orange-800", children: "Interactive content URL" }), _jsx("input", { type: "url", value: interactiveUrl, onChange: (event) => onUpdate({ content: { interactiveUrl: event.target.value.trim() } }), className: "w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200", placeholder: "https://" })] }))] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { onClick: handleDelete, className: "text-sm font-medium text-red-600 hover:text-red-700", children: "Delete lesson" }), _jsx("div", { className: "flex items-center space-x-3", children: _jsx("button", { onClick: onClose, className: "rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100", children: "Done editing" }) })] })] }));
    }
    return (_jsx("div", { className: `p-3 border rounded-lg transition-colors ${isEditing ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [getTypeIcon(lesson.type), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [index + 1, ". ", lesson.title] })] }), _jsxs("span", { className: "text-xs text-gray-500", children: [lesson.estimatedDuration, " min"] })] }), _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx("button", { onClick: onEdit, className: "p-1 text-gray-600 hover:text-gray-800", children: _jsx(Edit3, { className: "w-3 h-3" }) }), _jsx("button", { className: "p-1 text-gray-600 hover:text-gray-800", children: _jsx(Copy, { className: "w-3 h-3" }) }), _jsx("button", { className: "p-1 text-gray-600 hover:text-gray-800", children: _jsx(Move, { className: "w-3 h-3" }) })] })] }) }));
};
// Placeholder components that would be fully implemented
const CoursePreview = ({ course }) => (_jsxs("div", { className: "text-center py-8", children: [_jsx("h3", { className: "text-lg font-medium mb-2", children: course.title }), _jsx("p", { className: "text-gray-600", children: "Course preview would show the learner experience here." })] }));
const AccessibilityOption = ({ title, description, checked, onChange }) => (_jsxs("div", { className: "flex items-center justify-between p-4 border border-gray-200 rounded-lg", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: title }), _jsx("p", { className: "text-sm text-gray-600", children: description })] }), _jsx("input", { type: "checkbox", checked: checked, onChange: (e) => onChange(e.target.checked), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" })] }));
const CertificateSettings = () => (_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Certificate Settings" }), _jsx("p", { className: "text-gray-600", children: "Certificate configuration options would go here." })] }));
const CourseAnalyticsDashboard = () => (_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Course Analytics" }), _jsx("p", { className: "text-gray-600", children: "Detailed analytics dashboard would be implemented here." })] }));
export default AdvancedCourseBuilder;
