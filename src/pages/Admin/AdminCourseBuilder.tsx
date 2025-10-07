import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { courseStore, generateId, calculateCourseDuration, countTotalLessons } from '../../store/courseStore';
import type { Course, Module, Lesson } from '../../store/courseStore';
import { supabase } from '../../lib/supabase';
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

const AdminCourseBuilder = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const isEditing = courseId !== 'new';
  
  const [course, setCourse] = useState<Course>(() => {
    if (isEditing && courseId) {
      const existingCourse = courseStore.getCourse(courseId);
      return existingCourse || createEmptyCourse();
    }
    return createEmptyCourse();
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [expandedModules, setExpandedModules] = useState<{ [key: string]: boolean }>({});
  const [editingLesson, setEditingLesson] = useState<{ moduleId: string; lessonId: string } | null>(null);
  const [uploadingVideos, setUploadingVideos] = useState<{ [key: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const [highlightLessonId, setHighlightLessonId] = useState<string | null>(null);

  useEffect(() => {
    const moduleQ = searchParams.get('module');
    const lessonQ = searchParams.get('lesson');
    if (!moduleQ || !lessonQ) return;

    // Expand the requested module and open the lesson editor if the lesson exists
    setExpandedModules(prev => ({ ...prev, [moduleQ]: true }));

    const mod = course.modules.find(m => m.id === moduleQ);
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

  function createEmptyCourse(): Course {
    return {
      id: courseId === 'new' ? generateId('course') : courseId || generateId('course'),
      title: '',
      description: '',
      status: 'draft',
      thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
      duration: '0 min',
      difficulty: 'Beginner',
      enrollments: 0,
      completions: 0,
      completionRate: 0,
      avgRating: 0,
      totalRatings: 0,
      createdBy: 'Mya Dennis',
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      estimatedTime: '0 minutes',
      prerequisites: [],
      learningObjectives: [],
      certification: {
        available: false,
        name: '',
        requirements: [],
        validFor: '1 year',
        renewalRequired: false
      },
      tags: [],
      keyTakeaways: [],
      type: 'Mixed',
      lessons: 0,
      rating: 0,
      progress: 0,
      modules: []
    };
  }

  const handleSave = () => {
    // Update calculated fields
    const updatedCourse = {
      ...course,
      duration: calculateCourseDuration(course.modules),
      lessons: countTotalLessons(course.modules),
      lastUpdated: new Date().toISOString()
    };
    
    courseStore.saveCourse(updatedCourse);
    setCourse(updatedCourse);
    
    if (courseId === 'new') {
      navigate(`/admin/course-builder/${updatedCourse.id}`);
    }
  };

  const handlePublish = () => {
    const publishedCourse = {
      ...course,
      status: 'published' as const,
      publishedDate: new Date().toISOString(),
      duration: calculateCourseDuration(course.modules),
      lessons: countTotalLessons(course.modules),
      lastUpdated: new Date().toISOString()
    };
    
    courseStore.saveCourse(publishedCourse);
    setCourse(publishedCourse);
  };

  const addModule = () => {
    const newModule: Module = {
      id: generateId('module'),
      title: `Module ${course.modules.length + 1}`,
      description: '',
      duration: '0 min',
      order: course.modules.length + 1,
      lessons: [],
      resources: []
    };
    
    setCourse(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setCourse(prev => ({
      ...prev,
      modules: prev.modules.map(module =>
        module.id === moduleId ? { ...module, ...updates } : module
      )
    }));
  };

  const deleteModule = (moduleId: string) => {
    setCourse(prev => ({
      ...prev,
      modules: prev.modules.filter(module => module.id !== moduleId)
    }));
  };

  const addLesson = (moduleId: string) => {
    const module = course.modules.find(m => m.id === moduleId);
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
    const module = course.modules.find(m => m.id === moduleId);
    if (!module) return;

    const updatedLessons = module.lessons.map(lesson =>
      lesson.id === lessonId ? { ...lesson, ...updates } : lesson
    );

    updateModule(moduleId, { lessons: updatedLessons });
  };

  const deleteLesson = (moduleId: string, lessonId: string) => {
    const module = course.modules.find(m => m.id === moduleId);
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
      const fileName = `${courseId}/${moduleId}/${lessonId}.${fileExt}`;

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
          ...course.modules.find(m => m.id === moduleId)?.lessons.find(l => l.id === lessonId)?.content,
          videoUrl: publicUrl,
          fileName: file.name,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        }
      });

      setUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
      
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Failed to upload video. Please try again.');
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
      const fileName = `${courseId}/${moduleId}/${lessonId}-resource.${fileExt}`;

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
          ...course.modules.find(m => m.id === moduleId)?.lessons.find(l => l.id === lessonId)?.content,
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
              {lesson.type === 'download' && <FileText className="h-4 w-4 text-purple-500" />}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{lesson.title}</h4>
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
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                try {
                  const url = `/courses/${course.id}`;
                  window.open(url, '_blank');
                } catch (err) {
                  console.warn('Preview failed', err);
                }
              }}
              className="p-1 text-gray-600 hover:text-gray-800"
              title="Preview Lesson"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                try {
                  const lessonUrl = `/courses/${course.id}/modules/${moduleId}/lessons/${lesson.id}`;
                  window.open(lessonUrl, '_blank');
                } catch (err) {
                  console.warn('Start preview failed', err);
                }
              }}
              className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-sm hover:bg-orange-200"
              title="Start Lesson"
            >
              Start
            </button>
            <button
              onClick={() => deleteLesson(moduleId, lesson.id)}
              className="p-1 text-red-600 hover:text-red-800"
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
              <option value="download">Download Resource</option>
              <option value="text">Text Content</option>
            </select>
          </div>

          {/* Lesson Content Editor */}
          {lesson.type === 'video' && (
            <div className="space-y-4">
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
                          {lesson.content.fileName} ({lesson.content.fileSize})
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
                        <p className="text-sm text-gray-600">Uploading video...</p>
                        {progress > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        )}
                        {uploadError && (
                          <p className="text-sm text-red-600 mt-2">{uploadError}</p>
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
                        {question.options.map((option, oIndex) => (
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
                                const updatedOptions = [...question.options];
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
                                const updatedOptions = question.options.filter((_, i) => i !== oIndex);
                                updatedQuestions[qIndex] = { 
                                  ...question, 
                                  options: updatedOptions,
                                  correctAnswerIndex: question.correctAnswerIndex > oIndex ? question.correctAnswerIndex - 1 : question.correctAnswerIndex
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
                            const updatedOptions = [...question.options, ''];
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

          {lesson.type === 'download' && (
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
    { id: 'settings', name: 'Settings', icon: Target }
  ];

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
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isEditing ? 'Edit Course' : 'Create New Course'}
            </h1>
            <p className="text-gray-600">
              {isEditing ? `Editing: ${course.title}` : 'Build a comprehensive learning experience'}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>Save Draft</span>
            </button>
            <button
              onClick={handlePublish}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Publish Course</span>
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
                  courseStore.saveCourse(cloned);
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
                  {course.learningObjectives.map((objective, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={objective}
                        onChange={(e) => {
                          const updated = [...course.learningObjectives];
                          updated[index] = e.target.value;
                          setCourse(prev => ({ ...prev, learningObjectives: updated }));
                        }}
                        placeholder="Learning objective..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          const updated = course.learningObjectives.filter((_, i) => i !== index);
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
                      learningObjectives: [...prev.learningObjectives, ''] 
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
                  {course.keyTakeaways.map((takeaway, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={takeaway}
                        onChange={(e) => {
                          const updated = [...course.keyTakeaways];
                          updated[index] = e.target.value;
                          setCourse(prev => ({ ...prev, keyTakeaways: updated }));
                        }}
                        placeholder="Key takeaway..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          const updated = course.keyTakeaways.filter((_, i) => i !== index);
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
                      keyTakeaways: [...prev.keyTakeaways, ''] 
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
                  {course.tags.map((tag, index) => (
                    <span key={index} className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm flex items-center space-x-1">
                      <span>{tag}</span>
                      <button
                        onClick={() => {
                          const updated = course.tags.filter((_, i) => i !== index);
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
                        if (tag && !course.tags.includes(tag)) {
                          setCourse(prev => ({ ...prev, tags: [...prev.tags, tag] }));
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
                {course.modules.map((module, _moduleIndex) => (
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

                {course.modules.length === 0 && (
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
                  {course.prerequisites.map((prerequisite, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={prerequisite}
                        onChange={(e) => {
                          const updated = [...course.prerequisites];
                          updated[index] = e.target.value;
                          setCourse(prev => ({ ...prev, prerequisites: updated }));
                        }}
                        placeholder="Prerequisite..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => {
                          const updated = course.prerequisites.filter((_, i) => i !== index);
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
                      prerequisites: [...prev.prerequisites, ''] 
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
                {calculateCourseDuration(course.modules)}
              </span>
              <span className="flex items-center">
                <BookOpen className="h-4 w-4 mr-1" />
                {countTotalLessons(course.modules)} lessons
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
              {course.learningObjectives.slice(0, 3).map((objective, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <Target className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{objective || 'Learning objective...'}</span>
                </li>
              ))}
              {course.learningObjectives.length > 3 && (
                <li className="text-sm text-gray-500">+{course.learningObjectives.length - 3} more objectives</li>
              )}
            </ul>
            
            <div className="flex flex-wrap gap-2">
              {course.tags.map((tag, index) => (
                <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCourseBuilder;