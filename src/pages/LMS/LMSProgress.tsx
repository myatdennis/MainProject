import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target, 
  Award,
  Calendar,
  ArrowLeft,
  Play
} from 'lucide-react';
import SEO from '../../components/SEO/SEO';

interface ProgressData {
  overallProgress: {
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    totalHours: number;
    completedHours: number;
    certificatesEarned: number;
    currentStreak: number;
    longestStreak: number;
  };
  courseProgress: CourseProgress[];
  weeklyActivity: WeeklyActivity[];
  goals: LearningGoal[];
  achievements: Achievement[];
}

interface CourseProgress {
  courseId: string;
  title: string;
  category: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  lastAccessed: string;
  estimatedCompletion: string;
  nextLesson?: {
    id: string;
    title: string;
    duration: number;
  };
}

interface WeeklyActivity {
  week: string;
  hoursSpent: number;
  lessonsCompleted: number;
  coursesStarted: number;
}

interface LearningGoal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  status: 'active' | 'completed' | 'overdue';
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  earnedDate: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const LMSProgress: React.FC = () => {
  const navigate = useNavigate();
  
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'goals' | 'achievements'>('overview');

  useEffect(() => {
    loadProgressData();
  }, [selectedPeriod]);

  const loadProgressData = async () => {
    setLoading(true);
    try {
      // Mock progress data - replace with actual API call
      const mockData: ProgressData = {
        overallProgress: {
          totalCourses: 8,
          completedCourses: 3,
          inProgressCourses: 2,
          totalHours: 64,
          completedHours: 36,
          certificatesEarned: 3,
          currentStreak: 7,
          longestStreak: 14
        },
        courseProgress: [
          {
            courseId: 'course_001',
            title: 'Inclusive Leadership Fundamentals',
            category: 'Leadership',
            progress: 100,
            totalLessons: 12,
            completedLessons: 12,
            lastAccessed: '2024-01-15',
            estimatedCompletion: 'Completed'
          },
          {
            courseId: 'course_002',
            title: 'Courageous Conversations',
            category: 'Communication',
            progress: 75,
            totalLessons: 8,
            completedLessons: 6,
            lastAccessed: '2024-01-20',
            estimatedCompletion: '2024-01-25',
            nextLesson: {
              id: 'lesson_007',
              title: 'Handling Resistance to Change',
              duration: 25
            }
          },
          {
            courseId: 'course_003',
            title: 'DEI Metrics and Analytics',
            category: 'Strategy',
            progress: 40,
            totalLessons: 10,
            completedLessons: 4,
            lastAccessed: '2024-01-18',
            estimatedCompletion: '2024-02-05',
            nextLesson: {
              id: 'lesson_005',
              title: 'Data Collection Strategies',
              duration: 30
            }
          }
        ],
        weeklyActivity: [
          { week: 'Jan 1-7', hoursSpent: 8, lessonsCompleted: 6, coursesStarted: 1 },
          { week: 'Jan 8-14', hoursSpent: 12, lessonsCompleted: 8, coursesStarted: 0 },
          { week: 'Jan 15-21', hoursSpent: 6, lessonsCompleted: 4, coursesStarted: 2 },
          { week: 'Jan 22-28', hoursSpent: 10, lessonsCompleted: 7, coursesStarted: 0 }
        ],
        goals: [
          {
            id: 'goal_001',
            title: 'Complete Leadership Track',
            description: 'Finish all 3 leadership courses by end of month',
            targetDate: '2024-01-31',
            progress: 67,
            status: 'active'
          },
          {
            id: 'goal_002', 
            title: 'Earn 5 Certificates',
            description: 'Achieve 5 course completion certificates',
            targetDate: '2024-03-31',
            progress: 60,
            status: 'active'
          }
        ],
        achievements: [
          {
            id: 'ach_001',
            title: 'First Course Completed',
            description: 'Completed your first course',
            earnedDate: '2024-01-15',
            icon: '🎯',
            rarity: 'common'
          },
          {
            id: 'ach_002',
            title: 'Week Warrior',
            description: 'Completed lessons for 7 consecutive days',
            earnedDate: '2024-01-20',
            icon: '🔥',
            rarity: 'rare'
          },
          {
            id: 'ach_003',
            title: 'Leadership Expert',
            description: 'Completed all leadership courses',
            earnedDate: '2024-01-15',
            icon: '👑',
            rarity: 'epic'
          }
        ]
      };

      setProgressData(mockData);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-100 text-gray-800';
      case 'rare': return 'bg-blue-100 text-blue-800';
      case 'epic': return 'bg-purple-100 text-purple-800';
      case 'legendary': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getGoalStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || !progressData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Learning Progress - Learning Platform"
        description="Track your learning journey, goals, and achievements"
        keywords={['progress', 'learning', 'goals', 'achievements', 'analytics']}
      />
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/lms/dashboard')}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </button>
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-6 w-6 text-orange-500" />
                  <h1 className="text-xl font-bold text-gray-900">Learning Progress</h1>
                </div>
              </div>
              
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Progress Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Courses Completed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {progressData.overallProgress.completedCourses}/{progressData.overallProgress.totalCourses}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Hours Learned</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {progressData.overallProgress.completedHours}h
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Certificates</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {progressData.overallProgress.certificatesEarned}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Current Streak</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {progressData.overallProgress.currentStreak} days
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { key: 'overview', label: 'Overview', icon: BarChart3 },
                  { key: 'courses', label: 'Course Progress', icon: Target },
                  { key: 'goals', label: 'Goals', icon: Calendar },
                  { key: 'achievements', label: 'Achievements', icon: Award }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.key
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Weekly Activity Chart */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Weekly Activity</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-4 gap-4">
                        {progressData.weeklyActivity.map(week => (
                          <div key={week.week} className="text-center">
                            <div className="bg-orange-500 rounded-full mx-auto mb-2" 
                                 style={{ height: `${Math.max(week.hoursSpent * 8, 20)}px`, width: '20px' }}></div>
                            <p className="text-xs font-medium text-gray-600">{week.week}</p>
                            <p className="text-xs text-gray-500">{week.hoursSpent}h</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                      <h4 className="font-medium mb-2">Learning Velocity</h4>
                      <p className="text-2xl font-bold">
                        {Math.round(progressData.overallProgress.completedHours / 4)} hrs/week
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                      <h4 className="font-medium mb-2">Completion Rate</h4>
                      <p className="text-2xl font-bold">
                        {Math.round((progressData.overallProgress.completedCourses / progressData.overallProgress.totalCourses) * 100)}%
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                      <h4 className="font-medium mb-2">Longest Streak</h4>
                      <p className="text-2xl font-bold">
                        {progressData.overallProgress.longestStreak} days
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'courses' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Course Progress</h3>
                  {progressData.courseProgress.map(course => (
                    <div key={course.courseId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{course.title}</h4>
                          <p className="text-sm text-gray-500">{course.category}</p>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {course.progress}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div 
                          className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${course.progress}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{course.completedLessons}/{course.totalLessons} lessons</span>
                        <span>Last: {formatDate(course.lastAccessed)}</span>
                      </div>
                      
                      {course.nextLesson && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-700">Next Lesson:</p>
                              <p className="text-sm text-gray-600">{course.nextLesson.title}</p>
                            </div>
                            <button
                              onClick={() => navigate(`/lms/course/${course.courseId}`)}
                              className="flex items-center px-3 py-1 text-sm font-medium text-white bg-orange-600 rounded hover:bg-orange-700"
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Continue
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'goals' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Learning Goals</h3>
                  {progressData.goals.map(goal => (
                    <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{goal.title}</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getGoalStatusColor(goal.status)}`}>
                          {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${goal.progress}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{goal.progress}% complete</span>
                        <span>Due: {formatDate(goal.targetDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'achievements' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Achievements</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {progressData.achievements.map(achievement => (
                      <div key={achievement.id} className="border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-3xl mb-2">{achievement.icon}</div>
                        <h4 className="font-medium text-gray-900 mb-1">{achievement.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getRarityColor(achievement.rarity)}`}>
                          {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
                        </span>
                        <p className="text-xs text-gray-500 mt-2">
                          Earned: {formatDate(achievement.earnedDate)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LMSProgress;