import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { 
  BookOpen, 
  Clock, 
  Award, 
  TrendingUp, 
  Play, 
  CheckCircle, 
  Calendar,
  Download,
  MessageSquare
} from 'lucide-react';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { loadStoredCourseProgress } from '../../utils/courseProgress';
import apiRequest from '../../utils/apiClient';

type ProgressSummary = {
  modulesCompleted: number;
  modulesTotal: number;
  overallPercent: number;
  timeInvestedSeconds: number;
  certificatesEarned: number;
  streakDays: number;
};

type ActivityItem = {
  action: string;
  item: string;
  time: string;
  icon: typeof CheckCircle;
  color: string;
};

const formatTimeInvested = (seconds: number): string => {
  if (!seconds || seconds < 60) return '0 min';
  const hours = seconds / 3600;
  if (hours >= 1) return `${hours.toFixed(1)} hrs`;
  return `${Math.round(seconds / 60)} min`;
};

const LMSDashboard = () => {
  const { user } = useSecureAuth();
  const [progressRefreshToken, _setProgressRefreshToken] = useState(0);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const adminCatalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getAdminCatalogState);
  const learnerCatalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getLearnerCatalogState);
  const allCourses = useSyncExternalStore(courseStore.subscribe, courseStore.getAllCourses);

  // Load real progress summary from API
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiRequest<{ data: ProgressSummary }>('/api/client/progress/summary');
        if (active && response?.data) {
          setProgressSummary(response.data);
        }
      } catch (err) {
        // Non-fatal: stats will show defaults
        console.warn('[LMSDashboard] Failed to load progress summary:', err);
      } finally {
        if (active) setStatsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Load real recent activity from API
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiRequest<{ data: Array<{ id: string; action: string; details: Record<string, unknown>; createdAt: string }> }>(
          '/api/client/activity?limit=5'
        );
        if (active && Array.isArray(response?.data) && response.data.length > 0) {
          const mapped: ActivityItem[] = response.data.map((item) => {
            const isComplete = item.action?.includes('complet') || item.action?.includes('finish');
            return {
              action: item.action ?? 'Activity',
              item: (item.details?.courseTitle as string) ?? (item.details?.title as string) ?? item.action ?? '',
              time: item.createdAt
                ? new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : '',
              icon: isComplete ? CheckCircle : Play,
              color: isComplete ? 'text-green-500' : 'text-orange-500',
            };
          });
          setRecentActivity(mapped);
        }
      } catch {
        // Non-fatal: activity feed stays empty
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (adminCatalogState.phase !== 'idle' || learnerCatalogState.status !== 'idle') {
      return;
    }
    courseStore.init().catch((error) => {
      console.warn('[LMSDashboard] Failed to initialize course store:', error);
    });
  }, [adminCatalogState.phase, learnerCatalogState.status]);

  const learningPathCourses = useMemo(() => {
    return allCourses
      .filter((course) => course.status === 'published')
      .map((course) => {
        const normalized = normalizeCourse(course);
        const storedProgress =
          loadStoredCourseProgress(normalized.slug) ?? {
            completedLessonIds: [],
            lessonProgress: {},
            lessonPositions: {},
            lastLessonId: undefined,
          };
        const completedLessonIds = new Set(storedProgress.completedLessonIds ?? []);
        const lessonIds =
          normalized.modules?.flatMap((module) =>
            (module.lessons ?? []).map((lesson) => lesson.id)
          ) ?? [];
        const completedLessonCount = completedLessonIds.size;
        const progressPercent =
          normalized.lessons > 0
            ? Math.round((completedLessonCount / normalized.lessons) * 100)
            : 0;

        const resumeLessonId =
          (storedProgress.lastLessonId &&
            lessonIds.find((lessonId) => lessonId === storedProgress.lastLessonId)) ||
          lessonIds.find((lessonId) => !completedLessonIds.has(lessonId)) ||
          lessonIds[0] ||
          null;

        return {
          ...normalized,
          progress: progressPercent,
          resumeLessonId,
        };
      });
  }, [allCourses, progressRefreshToken]);

  const isLoadingCourses =
    adminCatalogState.phase === 'loading' ||
    (learnerCatalogState.status === 'idle' && learningPathCourses.length === 0);

  const completedValue = progressSummary
    ? `${progressSummary.modulesCompleted}/${Math.max(progressSummary.modulesTotal, progressSummary.modulesCompleted)}`
    : statsLoading ? '…' : '0/0';

  const stats = [
    {
      label: 'Modules Completed',
      value: completedValue,
      icon: BookOpen,
      color: 'text-blue-500',
    },
    {
      label: 'Total Progress',
      value: statsLoading ? '…' : `${progressSummary?.overallPercent ?? 0}%`,
      icon: TrendingUp,
      color: 'text-green-500',
    },
    {
      label: 'Time Invested',
      value: statsLoading ? '…' : formatTimeInvested(progressSummary?.timeInvestedSeconds ?? 0),
      icon: Clock,
      color: 'text-orange-500',
    },
    {
      label: 'Certificates Earned',
      value: statsLoading ? '…' : String(progressSummary?.certificatesEarned ?? 0),
      icon: Award,
      color: 'text-purple-500',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  };

  return (
    <div className="container-page section">
      {/* Welcome Section */}
      <div className="mb-8">
  <h1 className="h1">Welcome back, {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Learner' : 'Learner'}!</h1>
        <p className="lead">Continue your inclusive leadership journey. You're making great progress!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card-lg hover-lift">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate/80">{stat.label}</p>
                  <p className="text-2xl font-bold text-charcoal mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-white/8`}> 
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Course Progress */}
        <div className="lg:col-span-2">
          <div className="card-lg card-hover">
            <div className="flex items-center justify-between mb-6">
              <h2 className="h2">Your Learning Path</h2>
              <Link 
                to="/lms/courses" 
                className="nav-link"
              >
                View All Courses →
              </Link>
            </div>
            
            <div className="space-y-4">
              {isLoadingCourses ? (
                <div className="rounded-lg border border-mist bg-white/60 p-4 text-sm text-slate/70">
                  Syncing your assigned courses...
                </div>
              ) : learningPathCourses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-mist bg-white/40 p-6 text-center text-sm text-slate/70">
                  New learning paths will appear here once courses are published for your cohort.
                </div>
              ) : (
                learningPathCourses.map((course) => {
                  const status = course.progress >= 100 ? 'completed' : course.progress > 0 ? 'in-progress' : 'not-started';
                  const baseCoursePath = `/lms/courses/${course.slug || course.id}`;
                  const resumeLessonHref = course.resumeLessonId ? `${baseCoursePath}/lesson/${course.resumeLessonId}` : baseCoursePath;
                  const ctaHref = status === 'completed' ? baseCoursePath : resumeLessonHref;
                  const ctaLabel = status === 'completed' ? 'Review' : status === 'in-progress' ? 'Continue' : 'Start';

                  return (
                    <div key={course.id} className="border border-gray-200 rounded-lg p-4 hover-lift transition-shadow duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="h3 mb-1">{course.title}</h3>
                          <div className="flex items-center space-x-4 text-sm text-slate/80">
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {course.duration || 'Self-paced'}
                            </span>
                            <span>{course.type || 'Program'}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                            {getStatusText(status)}
                          </span>
                          <Link to={ctaHref} className="btn-cta px-4 py-2 rounded-lg text-sm font-medium">
                            {ctaLabel}
                          </Link>
                        </div>
                      </div>

                      <div className="w-full bg-mist/60 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ width: `${course.progress}%`, backgroundImage: 'var(--gradient-blue-green)' }}
                        />
                      </div>
                      <div className="text-right text-sm text-slate/80 mt-1">
                        {course.progress}% complete
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card-lg card-hover">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/lms/downloads"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
              >
                <Download className="h-5 w-5 text-blue-500 mr-3" />
                <span className="font-medium text-gray-900">Download All Resources</span>
              </Link>
              <Link
                to="/lms/feedback"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
              >
                <MessageSquare className="h-5 w-5 text-green-500 mr-3" />
                <span className="font-medium text-gray-900">Submit Feedback</span>
              </Link>
              <Link
                to="/lms/contact"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
              >
                <Calendar className="h-5 w-5 text-orange-500 mr-3" />
                <span className="font-medium text-gray-900">Book Coaching Call</span>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card-lg card-hover">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-slate/60 py-2">No recent activity yet. Start a course to see your progress here.</p>
              ) : recentActivity.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg bg-gray-50`}>
                      <Icon className={`h-4 w-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action} <span className="font-normal">{activity.item}</span>
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming */}
            <div className="rounded-xl p-6" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--hud-blue) 10%, transparent), color-mix(in srgb, var(--hud-green) 10%, transparent))' }}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Next Coaching Session</h3>
            <p className="text-sm text-gray-600 mb-4">
              Scheduled for March 15, 2025 at 2:00 PM EST
            </p>
            <Link to="/lms/meeting" className="btn-outline">Join Meeting</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LMSDashboard;
