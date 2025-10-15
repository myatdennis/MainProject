import React, { useState, useEffect } from 'react';
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
import { Course, Chapter, Lesson } from '../../types/courseTypes';
import courseManagementStore from '../../store/courseManagementStore';
import LoadingButton from '../../components/LoadingButton';
import Modal from '../../components/Modal';

const AdvancedCourseBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isEditing = courseId !== 'new';

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'settings' | 'analytics'>('overview');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Modal states
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing && courseId) {
      const existingCourse = courseManagementStore.getCourse(courseId);
      if (existingCourse) {
        setCourse(existingCourse);
      } else {
        navigate('/admin/courses');
      }
    } else {
      // Create new course
      const newCourse = courseManagementStore.createCourse({
        title: 'New Course',
        description: 'Course description',
      });
      setCourse(newCourse);
    }
  }, [courseId, isEditing, navigate]);

  const handleSaveCourse = async () => {
    if (!course) return;

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      if (isEditing) {
        courseManagementStore.updateCourse(course.id, course);
      }
      
      // Show success message
      alert('Course saved successfully!');
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Error saving course. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishCourse = async () => {
    if (!course) return;

    const confirmed = confirm('Are you sure you want to publish this course? It will be available to learners immediately.');
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      const publishedCourse = courseManagementStore.publishCourse(course.id);
      if (publishedCourse) {
        setCourse(publishedCourse);
        alert('Course published successfully!');
      }
    } catch (error) {
      console.error('Error publishing course:', error);
      alert('Error publishing course. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addChapter = () => {
    if (!course) return;
    
    const chapter = courseManagementStore.addChapterToCourse(course.id, {
      title: `Chapter ${course.chapters.length + 1}`,
      description: 'New chapter description',
    });
    
    if (chapter) {
      const updatedCourse = courseManagementStore.getCourse(course.id);
      if (updatedCourse) setCourse(updatedCourse);
      setExpandedChapters((prev: Set<string>) => new Set([...prev, chapter.id]));
    }
  };

  const addLesson = (chapterId: string, lessonType: 'video' | 'text' | 'quiz' | 'interactive') => {
    if (!course) return;

    const lesson = courseManagementStore.addLessonToChapter(course.id, chapterId, {
      title: `New ${lessonType.charAt(0).toUpperCase() + lessonType.slice(1)} Lesson`,
      description: `${lessonType} lesson description`,
      type: lessonType,
      estimatedDuration: lessonType === 'quiz' ? 10 : 15,
    });

    if (lesson) {
      const updatedCourse = courseManagementStore.getCourse(course.id);
      if (updatedCourse) setCourse(updatedCourse);
      setEditingLesson(lesson.id);
    }
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
              >
                <Award className="w-4 h-4 mr-2" />
                Publish
              </LoadingButton>
            )}
          </div>
        </div>

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
  editingLesson: string | null;
}> = ({
  course,
  expandedChapters,
  onToggleChapter,
  onAddChapter,
  onAddLesson,
  onEditLesson,
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
  editingLesson: string | null;
}> = ({ chapter, index, isExpanded, onToggleExpanded, onAddLesson, onEditLesson, editingLesson }) => {
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
}> = ({ lesson, index, isEditing, onEdit }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4 text-blue-600" />;
      case 'text': return <FileText className="w-4 h-4 text-green-600" />;
      case 'quiz': return <HelpCircle className="w-4 h-4 text-purple-600" />;
      case 'interactive': return <Settings className="w-4 h-4 text-orange-600" />;
      default: return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

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