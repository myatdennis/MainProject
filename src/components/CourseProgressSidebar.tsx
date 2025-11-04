import React, { useState, useEffect } from 'react';
// import { useNavigate, useLocation } from 'react-router-dom'; // TODO: Implement when needed
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle, 
  Circle, 
  Play,
  Clock,
  FileText,
  Video,
  HelpCircle,
  Download,
  Trophy,
  Lock,
  X,
  Menu
} from 'lucide-react';

interface LessonProgress {
  lessonId: string;
  completed: boolean;
  progressPercentage: number;
  timeSpent?: number;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  duration?: string;
  lessons: Lesson[];
  order: number;
}

interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'interactive' | 'quiz' | 'resource' | 'text';
  duration?: string;
  order: number;
  isLocked?: boolean;
}

interface Course {
  id: string;
  title: string;
  modules: Module[];
  overallProgress?: number;
}

interface CourseProgressSidebarProps {
  course: Course;
  currentLessonId?: string;
  lessonProgress: { [lessonId: string]: LessonProgress };
  onLessonSelect: (moduleId: string, lessonId: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

const CourseProgressSidebar: React.FC<CourseProgressSidebarProps> = ({
  course,
  currentLessonId,
  lessonProgress,
  onLessonSelect,
  collapsed = false,
  onCollapsedChange,
  className = ''
}) => {
  // const navigate = useNavigate(); // TODO: Implement navigation features
  // const location = useLocation(); // TODO: Implement location-based features
  
  const [expandedModules, setExpandedModules] = useState<{ [moduleId: string]: boolean }>({});
  const [isMobile, setIsMobile] = useState(false);

  // Initialize expanded state
  useEffect(() => {
    if (course?.modules) {
      const initialExpanded: { [moduleId: string]: boolean } = {};
      
      // Expand module containing current lesson
      course.modules.forEach(module => {
        const hasCurrentLesson = module.lessons.some(lesson => lesson.id === currentLessonId);
        if (hasCurrentLesson) {
          initialExpanded[module.id] = true;
        } else {
          initialExpanded[module.id] = false;
        }
      });
      
      setExpandedModules(initialExpanded);
    }
  }, [course, currentLessonId]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleModuleExpansion = (moduleId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const getLessonIcon = (lesson: Lesson) => {
    switch (lesson.type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'interactive':
        return <HelpCircle className="h-4 w-4" />;
      case 'quiz':
        return <Circle className="h-4 w-4" />;
      case 'resource':
        return <Download className="h-4 w-4" />;
      case 'text':
        return <FileText className="h-4 w-4" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const getLessonStatusIcon = (lesson: Lesson) => {
    const progress = lessonProgress[lesson.id];
    
    if (lesson.isLocked) {
      return <Lock className="h-4 w-4 text-gray-400" />;
    }
    
    if (progress?.completed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    if (progress && progress.progressPercentage > 0) {
      return (
        <div className="relative w-4 h-4">
          <Circle className="h-4 w-4 text-gray-300" />
          <div 
            className="absolute top-0 left-0 w-4 h-4 rounded-full border-2 border-orange-500"
            style={{
              clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((progress.progressPercentage * 3.6 - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((progress.progressPercentage * 3.6 - 90) * Math.PI / 180)}%, 50% 50%)`
            }}
          />
        </div>
      );
    }
    
    return <Circle className="h-4 w-4 text-gray-300" />;
  };

  const calculateModuleProgress = (module: Module): number => {
    if (!module.lessons.length) return 0;
    
    const completedLessons = module.lessons.filter(lesson => 
      lessonProgress[lesson.id]?.completed
    ).length;
    
    return Math.round((completedLessons / module.lessons.length) * 100);
  };

  const calculateOverallProgress = (): number => {
    if (!course?.modules?.length) return 0;
    
    const totalLessons = course.modules.reduce((acc, module) => acc + module.lessons.length, 0);
    const completedLessons = course.modules.reduce((acc, module) => 
      acc + module.lessons.filter(lesson => lessonProgress[lesson.id]?.completed).length, 0
    );
    
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  };

  const handleLessonClick = (moduleId: string, lesson: Lesson) => {
    if (lesson.isLocked) return;
    
    onLessonSelect(moduleId, lesson.id);
    
    // On mobile, collapse sidebar after selection
    if (isMobile && onCollapsedChange) {
      onCollapsedChange(true);
    }
  };

  const overallProgress = calculateOverallProgress();

  if (collapsed && !isMobile) {
    return (
      <div className={`w-16 bg-white border-r border-gray-200 ${className}`}>
        <div className="p-4">
          <button
            onClick={() => onCollapsedChange?.(false)}
            className="w-full flex justify-center text-gray-600 hover:text-gray-900"
            title="Expand course outline"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        
        {/* Compact progress indicator */}
        <div className="px-2">
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%`, background: 'var(--gradient-blue-green)' }}
            />
          </div>
          <div className="text-xs text-center text-gray-600 font-medium">
            {overallProgress}%
          </div>
        </div>

        {/* Module indicators */}
        <div className="mt-4 px-2 space-y-2">
          {course?.modules?.map((module, index) => {
            const moduleProgress = calculateModuleProgress(module);
            const hasCurrentLesson = module.lessons.some(lesson => lesson.id === currentLessonId);
            
            return (
              <div 
                key={module.id}
                className={`w-full h-8 rounded flex items-center justify-center text-xs font-medium ${
                  hasCurrentLesson 
                    ? 'bg-orange-100 text-orange-800' 
                    : moduleProgress === 100 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                }`}
                title={`Module ${index + 1}: ${module.title} (${moduleProgress}% complete)`}
              >
                {index + 1}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-80 bg-white border-r border-gray-200 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 text-lg">Course Outline</h2>
          <button
            onClick={() => onCollapsedChange?.(!collapsed)}
            className="text-gray-600 hover:text-gray-900"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {isMobile ? <X className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </button>
        </div>
        
        <div className="text-sm text-gray-600 mb-3 line-clamp-2">
          {course?.title}
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-3 rounded-full transition-all duration-500 relative"
              style={{ width: `${overallProgress}%`, background: 'var(--gradient-blue-green)' }}
            >
              {overallProgress > 20 && (
                <div className="absolute inset-0 bg-white bg-opacity-20 animate-pulse" />
              )}
            </div>
          </div>
          {overallProgress === 100 && (
            <div className="flex items-center justify-center text-green-600 text-sm font-medium">
              <Trophy className="h-4 w-4 mr-1" />
              Course Complete!
            </div>
          )}
        </div>
      </div>

      {/* Course Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {course?.modules?.map((module, moduleIndex) => {
            const moduleProgress = calculateModuleProgress(module);
            const isExpanded = expandedModules[module.id];
            const hasCurrentLesson = module.lessons.some(lesson => lesson.id === currentLessonId);

            return (
              <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Module Header */}
                <button
                  onClick={() => toggleModuleExpansion(module.id)}
                  className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                    hasCurrentLesson ? 'bg-orange-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-600" />
                      )}
                      
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          Module {moduleIndex + 1}: {module.title}
                        </div>
                        {module.description && (
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {module.description}
                          </div>
                        )}
                        <div className="flex items-center space-x-3 mt-2">
                          <div className="flex items-center text-xs text-gray-600">
                            <Clock className="h-3 w-3 mr-1" />
                            {module.duration || '~30 min'}
                          </div>
                          <div className="text-xs text-gray-600">
                            {module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-2">
                      <div className="text-xs font-medium text-gray-600">
                        {moduleProgress}%
                      </div>
                      <div className="w-12 bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ width: `${moduleProgress}%`, background: moduleProgress === 100 ? 'var(--hud-green)' : 'var(--gradient-blue-green)' }}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Module Lessons */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {module.lessons.map((lesson, lessonIndex) => {
                      const isCurrentLesson = lesson.id === currentLessonId;
                      const progress = lessonProgress[lesson.id];
                      
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => handleLessonClick(module.id, lesson)}
                          disabled={lesson.isLocked}
                          className={`w-full p-3 text-left hover:bg-white transition-colors border-b border-gray-200 last:border-b-0 ${
                            isCurrentLesson ? 'bg-orange-100 border-orange-200' : ''
                          } ${lesson.isLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              {getLessonStatusIcon(lesson)}
                              {getLessonIcon(lesson)}
                            </div>
                            
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${
                                isCurrentLesson ? 'text-orange-900' : 'text-gray-900'
                              }`}>
                                {lessonIndex + 1}. {lesson.title}
                              </div>
                              
                              <div className="flex items-center space-x-3 mt-1">
                                <div className="text-xs text-gray-600">
                                  {lesson.duration || '5 min'}
                                </div>
                                
                                {progress && progress.progressPercentage > 0 && !progress.completed && (
                                  <div className="text-xs text-orange-600 font-medium">
                                    {progress.progressPercentage}% complete
                                  </div>
                                )}
                                
                                {progress?.completed && (
                                  <div className="text-xs text-green-600 font-medium">
                                    Completed
                                  </div>
                                )}
                              </div>
                            </div>

                            {isCurrentLesson && (
                              <div className="flex items-center text-orange-600">
                                <Play className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {course?.modules?.reduce((acc, m) => acc + m.lessons.filter(l => lessonProgress[l.id]?.completed).length, 0) || 0} of{' '}
            {course?.modules?.reduce((acc, m) => acc + m.lessons.length, 0) || 0} lessons complete
          </span>
          
          {overallProgress === 100 && (
            <button className="text-green-600 hover:text-green-700 font-medium flex items-center space-x-1">
              <Trophy className="h-4 w-4" />
              <span>View Certificate</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseProgressSidebar;