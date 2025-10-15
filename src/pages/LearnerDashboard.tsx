import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Clock, 
  Star, 
  Play, 
  CheckCircle, 
  BarChart3, 
  Search,
  Grid,
  List,
  Award,
  Eye,
  ChevronRight,
  Target
} from 'lucide-react';
import { Course, LearnerProgress } from '../types/courseTypes';

import SEO from '../components/SEO';
import { LoadingSpinner, CourseCardSkeleton } from '../components/LoadingComponents';
import { LazyImage, ImageSkeleton, useDebounce } from '../components/PerformanceComponents';

const LearnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [progressData, setProgressData] = useState<Map<string, LearnerProgress>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'completed' | 'not-started'>('all');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadUserCourses();
  }, []);

  const loadUserCourses = () => {
    setIsLoading(true);
    
    console.log('📚 Loading learner courses - temporarily using mock data to avoid type conflicts');
    
    // Temporary: Use mock courses to avoid type conflicts between courseStore and LearnerDashboard
    // TODO: Fix the Course type conflicts between different stores
    const mockCourses: Course[] = [
      {
        id: 'course-1',
        title: 'Introduction to Workplace Diversity',
        description: 'Learn the fundamentals of creating an inclusive workplace environment.',
        instructorId: 'instructor-1',
        instructorName: 'Dr. Sarah Johnson',
        instructorAvatar: '/avatars/instructor-1.jpg',
        category: 'Diversity & Inclusion',
        difficulty: 'Beginner',
        duration: '120 min',
        estimatedDuration: 120,
        thumbnail: '/images/course-diversity.jpg',

        rating: 4.8,
        enrollmentCount: 156,
        chapters: [],
        learningObjectives: ['Understand diversity concepts', 'Create inclusive environments'],
        prerequisites: [],
        tags: ['diversity', 'inclusion', 'workplace'],
        language: 'English',
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isPublished: true,
        status: 'published'
      }
    ];
    
    setEnrolledCourses(mockCourses);

    // Mock progress data
    const progressMap = new Map<string, LearnerProgress>();
    mockCourses.forEach((course: Course) => {
      const mockProgress: LearnerProgress = {
        id: `progress-${course.id}`,
        learnerId: 'learner-1',
        courseId: course.id,
        overallProgress: Math.random() * 0.8, // Random progress between 0-80%
        timeSpent: Math.floor(Math.random() * 3600), // Random seconds
        lastAccessedAt: new Date().toISOString(),
        enrolledAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
        completedAt: Math.random() > 0.8 ? new Date().toISOString() : undefined,
        chapterProgress: [],
        lessonProgress: [],
        bookmarks: [],
        notes: []
      };
      progressMap.set(course.id, mockProgress);
    });
    setProgressData(progressMap);
    
    setIsLoading(false);
  };

  const getFilteredCourses = () => {
    let filtered = enrolledCourses;

    // Apply search filter with debounced query
    if (debouncedSearchQuery) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        course.category?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(course => {
        const progress = progressData.get(course.id);
        
        switch (filterStatus) {
          case 'completed':
            return progress?.overallProgress === 1;
          case 'in-progress':
            return progress && progress.overallProgress > 0 && progress.overallProgress < 1;
          case 'not-started':
            return !progress || progress.overallProgress === 0;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  const handleCourseClick = (course: Course) => {
    navigate(`/lms/course/${course.id}`);
  };

  const handleContinueCourse = (course: Course) => {
    const progress = progressData.get(course.id);
    if (progress && progress.lessonProgress.length > 0) {
      // Find the next incomplete lesson
      const nextLesson = (course.chapters || [])
        .flatMap(chapter => chapter.lessons)
        .find(lesson => {
          const lessonProg = progress.lessonProgress.find((p: any) => p.lessonId === lesson.id);
          return !lessonProg?.completedAt;
        });
      
      if (nextLesson) {
        navigate(`/lms/course/${course.id}/lesson/${nextLesson.id}`);
      } else {
        navigate(`/lms/course/${course.id}`);
      }
    } else {
      // Start from the beginning
      const firstLesson = course.chapters?.[0]?.lessons[0];
      if (firstLesson) {
        navigate(`/lms/course/${course.id}/lesson/${firstLesson.id}`);
      }
    }
  };

  const getCourseStats = (course: Course) => {
    const progress = progressData.get(course.id);
    const completedLessons = progress?.lessonProgress.filter(lp => lp.isCompleted).length || 0;
    const totalLessons = (course.chapters || []).reduce((total, chapter) => total + chapter.lessons.length, 0);
    
    return {
      progress: progress?.overallProgress || 0,
      completedLessons,
      totalLessons,
      timeSpent: progress?.timeSpent || 0,
      isCompleted: progress?.overallProgress === 1
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SEO 
          title="My Learning Dashboard"
          description="Track your learning progress, continue courses, and discover new educational opportunities."
          keywords="learning dashboard, course progress, online education, skills development"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner size="lg" text="Loading your courses..." className="py-20" />
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CourseCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredCourses = getFilteredCourses();

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO 
        title="My Learning Dashboard"
        description="Track your learning progress, continue courses, and discover new educational opportunities."
        keywords="learning dashboard, course progress, online education, skills development"
      />
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Learning</h1>
              <p className="text-gray-600 mt-1">Continue your learning journey</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <DashboardStats progressData={progressData} enrolledCourses={enrolledCourses} />
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4"
               role="search"
               aria-label="Course search and filters">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                aria-label="Search courses"
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Courses</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="not-started">Not Started</option>
              </select>

              <div className="flex border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-orange-100 text-orange-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-orange-100 text-orange-600' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <QuickActions onCourseSearch={() => navigate('/lms/courses')} />

        {/* Course Grid/List */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              My Courses ({filteredCourses.length})
            </h2>
          </div>

          {filteredCourses.length === 0 ? (
            <EmptyState searchQuery={searchQuery} filterStatus={filterStatus} />
          ) : (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
            }>
              {filteredCourses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  stats={getCourseStats(course)}
                  viewMode={viewMode}
                  onCourseClick={() => handleCourseClick(course)}
                  onContinue={() => handleContinueCourse(course)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Dashboard Stats Component
const DashboardStats: React.FC<{
  progressData: Map<string, LearnerProgress>;
  enrolledCourses: Course[];
}> = ({ progressData }) => {
  const completedCourses = Array.from(progressData.values()).filter(p => p.overallProgress === 1).length;
  const inProgressCourses = Array.from(progressData.values()).filter(p => p.overallProgress > 0 && p.overallProgress < 1).length;
  const totalTime = Array.from(progressData.values()).reduce((total, p) => total + p.timeSpent, 0);

  return (
    <div className="flex items-center space-x-6 text-sm">
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-600">{completedCourses}</div>
        <div className="text-gray-600">Completed</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{inProgressCourses}</div>
        <div className="text-gray-600">In Progress</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">{Math.round(totalTime / 60)}</div>
        <div className="text-gray-600">Hours</div>
      </div>
    </div>
  );
};

// Quick Actions Component
const QuickActions: React.FC<{ onCourseSearch: () => void }> = ({ onCourseSearch }) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <button
        onClick={onCourseSearch}
        className="p-4 bg-white rounded-lg border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all text-left"
      >
        <Search className="w-6 h-6 text-orange-600 mb-2" />
        <h3 className="font-medium text-gray-900">Browse Courses</h3>
        <p className="text-sm text-gray-600">Discover new learning opportunities</p>
      </button>

      <button
        onClick={() => navigate('/lms/certificates')}
        className="p-4 bg-white rounded-lg border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all text-left"
      >
        <Award className="w-6 h-6 text-orange-600 mb-2" />
        <h3 className="font-medium text-gray-900">My Certificates</h3>
        <p className="text-sm text-gray-600">View earned certifications</p>
      </button>

      <button
        onClick={() => navigate('/lms/progress')}
        className="p-4 bg-white rounded-lg border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all text-left"
      >
        <BarChart3 className="w-6 h-6 text-orange-600 mb-2" />
        <h3 className="font-medium text-gray-900">Progress Report</h3>
        <p className="text-sm text-gray-600">Track your learning analytics</p>
      </button>

      <button
        onClick={() => navigate('/lms/goals')}
        className="p-4 bg-white rounded-lg border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all text-left"
      >
        <Target className="w-6 h-6 text-orange-600 mb-2" />
        <h3 className="font-medium text-gray-900">Learning Goals</h3>
        <p className="text-sm text-gray-600">Set and track your objectives</p>
      </button>
    </div>
  );
};

// Course Card Component
const CourseCard: React.FC<{
  course: Course;
  stats: any;
  viewMode: 'grid' | 'list';
  onCourseClick: () => void;
  onContinue: () => void;
}> = ({ course, stats, viewMode, onCourseClick, onContinue }) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 hover:border-orange-300 hover:shadow-md transition-all">
        <div className="flex items-center space-x-6">
          <LazyImage
            src={course.thumbnail}
            alt={course.title}
            className="w-24 h-16 object-cover rounded-lg"
            placeholder={<ImageSkeleton className="rounded-lg" />}
            fallbackSrc="/placeholder-course.jpg"
          />
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{course.title}</h3>
                <p className="text-gray-600 text-sm mb-2 line-clamp-2">{course.description}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <BookOpen className="w-4 h-4 mr-1" />
                    {stats.completedLessons}/{stats.totalLessons} lessons
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {course.estimatedDuration} min
                  </span>
                  {course.rating && (
                    <span className="flex items-center">
                      <Star className="w-4 h-4 mr-1 fill-yellow-400 text-yellow-400" />
                      {course.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className="mb-2">
                  {stats.isCompleted ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Completed
                    </span>
                  ) : stats.progress > 0 ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Play className="w-3 h-3 mr-1" />
                      In Progress
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Not Started
                    </span>
                  )}
                </div>
                
                <button
                  onClick={onContinue}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                >
                  {stats.progress > 0 ? 'Continue' : 'Start Course'}
                </button>
              </div>
            </div>

            {stats.progress > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">{Math.round(stats.progress * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-orange-300 hover:shadow-md transition-all">
      <div className="aspect-video relative">
        <LazyImage
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-full object-cover"
          placeholder={<ImageSkeleton />}
          fallbackSrc="/placeholder-course.jpg"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all cursor-pointer flex items-center justify-center">
          <Play className="w-12 h-12 text-white opacity-0 hover:opacity-100 transition-opacity" />
        </div>
        {stats.isCompleted && (
          <div className="absolute top-2 right-2">
            <div className="bg-green-500 text-white p-1 rounded-full">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{course.title}</h3>
        </div>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{course.description}</p>
        
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <span className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {course.estimatedDuration} min
          </span>
          <span className="flex items-center">
            <BookOpen className="w-4 h-4 mr-1" />
            {stats.totalLessons} lessons
          </span>
          {course.rating && (
            <span className="flex items-center">
              <Star className="w-4 h-4 mr-1 fill-yellow-400 text-yellow-400" />
              {course.rating.toFixed(1)}
            </span>
          )}
        </div>

        {stats.progress > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{Math.round(stats.progress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.progress * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            {stats.progress > 0 ? 'Continue' : 'Start Course'}
          </button>
          <button
            onClick={onCourseClick}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Empty State Component
const EmptyState: React.FC<{
  searchQuery: string;
  filterStatus: string;
}> = ({ searchQuery, filterStatus }) => {
  const navigate = useNavigate();

  if (searchQuery || filterStatus !== 'all') {
    return (
      <div className="text-center py-12">
        <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
        <p className="text-gray-600 mb-4">
          Try adjusting your search or filter criteria
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-orange-600 hover:text-orange-800"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
      <p className="text-gray-600 mb-4">
        Start your learning journey by enrolling in courses
      </p>
      <button
        onClick={() => navigate('/lms/courses')}
        className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
      >
        Browse Courses
        <ChevronRight className="w-4 h-4 ml-2" />
      </button>
    </div>
  );
};

export default LearnerDashboard;