import { useCallback, useEffect, useMemo, useState } from 'react';
import apiRequest from '../utils/apiClient';
import {
  getEvents,
  getCourseAnalytics,
  getAllJourneys,
  type HourlyUsage,
  type LearnerProgress,
  type EngagementMetrics,
} from '../dal/analytics';
import { syncService } from '../dal/sync';
import { courseStore } from '../store/courseStore';

export type AnalyticsDateRange = 'last-7-days' | 'last-30-days' | 'last-90-days' | 'last-year';

interface AdminOverview {
  totalActiveLearners?: number;
  totalOrgs?: number;
  totalCourses?: number;
  platformAvgProgress?: number;
  platformAvgCompletion?: number;
}

interface AdminAnalyticsResponse {
  overview?: AdminOverview | null;
  courses?: Array<{
    courseId: string;
    totalUsers: number;
    completedCount: number;
    completionPercent: number;
    avgProgress?: number | null;
    engagementScore?: number | null;
  }>;
  dropoffs?: Array<{
    courseId: string;
    lessonId: string;
    startedCount: number;
    completedCount: number;
    dropoffPercent: number;
  }>;
  surveySummary?: Array<{
    courseId: string;
    organizationId: string | null;
    responses: number;
    avgRating: number | null;
  }>;
}

export interface DropoffInsight {
  courseId: string;
  lessonId: string;
  startedCount: number;
  completedCount: number;
  dropoffPercent: number;
  lessonTitle: string;
}

export interface TrendPoint {
  date: string;
  engagement: number;
  completion: number;
}

export interface LearningPathInsight {
  courseId: string;
  path: string;
  success: number;
  avgTime: number;
  satisfaction: number;
}

export interface SkillGapInsight {
  skill: string;
  current: number;
  target: number;
  gap: number;
}

export interface PredictionInsight {
  user: string;
  likelihood: number;
  risk: 'low' | 'medium' | 'high';
  progress: number;
  engagementScore: number;
}

export interface AnalyticsDashboardData {
  overview: AdminOverview | null;
  courses: NonNullable<AdminAnalyticsResponse['courses']>;
  dropoffs: DropoffInsight[];
  surveySummary: NonNullable<AdminAnalyticsResponse['surveySummary']>;
  engagementTrend: TrendPoint[];
  hourlyUsage: HourlyUsage[];
  heatmap: HeatmapDay[];
  courseAnalytics: EngagementMetrics | null;
  learningPaths: LearningPathInsight[];
  skillGaps: SkillGapInsight[];
  predictions: PredictionInsight[];
  strugglingLearners: LearnerProgress[];
}

const DEFAULT_DATA: AnalyticsDashboardData = {
  overview: null,
  courses: [],
  dropoffs: [],
  surveySummary: [],
  engagementTrend: [],
  hourlyUsage: [],
  heatmap: [],
  courseAnalytics: null,
  learningPaths: [],
  skillGaps: [],
  predictions: [],
  strugglingLearners: [],
};

interface UseAnalyticsDashboardOptions {
  courseId?: string;
  dateRange?: AnalyticsDateRange;
}

const RANGE_LOOKUP: Record<AnalyticsDateRange, number> = {
  'last-7-days': 7,
  'last-30-days': 30,
  'last-90-days': 90,
  'last-year': 365,
};

const resolveDateRange = (range: AnalyticsDateRange) => {
  const end = new Date();
  const start = new Date(end);
  const days = RANGE_LOOKUP[range] ?? RANGE_LOOKUP['last-30-days'];
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  start.setDate(start.getDate() - (days - 1));
  return { start, end };
};

const formatDateLabel = (input: Date) =>
  input.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const buildHourlyUsageFallback = (events: ReturnType<typeof getEvents>): HourlyUsage[] => {
  const template: HourlyUsage[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    usage: 0,
    completion: 0,
    engagement: 0,
  }));

  events.forEach((event) => {
    const hour = new Date(event.timestamp).getHours();
    const entry = template[hour];
    entry.usage += 1;
    if (event.type === 'course_completed') {
      entry.completion += 1;
    }
    if (['lesson_completed', 'quiz_passed', 'video_play'].includes(event.type)) {
      entry.engagement += 1;
    }
  });

  return template;
};

const buildTrendPoints = (
  events: ReturnType<typeof getEvents>,
  start: Date,
  end: Date,
): TrendPoint[] => {
  const bucketMap = new Map<string, { date: Date; engagement: number; completion: number }>();
  const cursor = new Date(start);
  while (cursor <= end) {
    const label = formatDateLabel(cursor);
    bucketMap.set(label, { date: new Date(cursor), engagement: 0, completion: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  events.forEach((event) => {
    const timestamp = new Date(event.timestamp);
    if (timestamp < start || timestamp > end) return;
    const label = formatDateLabel(timestamp);
    const bucket = bucketMap.get(label);
    if (!bucket) return;
    if (['lesson_completed', 'quiz_passed', 'video_play'].includes(event.type)) {
      bucket.engagement += 1;
    }
    if (event.type === 'course_completed') {
      bucket.completion += 1;
    }
  });

  const buckets = Array.from(bucketMap.values());
  const engagementMax = buckets.reduce((max, bucket) => Math.max(max, bucket.engagement), 0) || 1;
  const completionMax = buckets.reduce((max, bucket) => Math.max(max, bucket.completion), 0) || 1;

  return buckets.map((bucket) => ({
    date: formatDateLabel(bucket.date),
    engagement: Math.round((bucket.engagement / engagementMax) * 100),
    completion: Math.round((bucket.completion / completionMax) * 100),
  }));
};

export interface HeatmapDay {
  day: string;
  hours: number[];
}

const HEATMAP_BUCKETS = 12;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const buildHeatmap = (
  events: ReturnType<typeof getEvents>,
  start: Date,
  end: Date,
): HeatmapDay[] => {
  const template: Record<string, number[]> = {};
  DAY_LABELS.forEach((day) => {
    template[day] = Array.from({ length: HEATMAP_BUCKETS }, () => 0);
  });

  events.forEach((event) => {
    const timestamp = new Date(event.timestamp);
    if (timestamp < start || timestamp > end) return;
    const dayLabel = DAY_LABELS[timestamp.getDay()];
    const bucketIndex = Math.min(HEATMAP_BUCKETS - 1, Math.floor(timestamp.getHours() / 2));
    template[dayLabel][bucketIndex] += 1;
  });

  return DAY_LABELS.map((day) => ({ day, hours: template[day] }));
};

const resolveCourseTitle = (courseId: string): string => {
  const course = courseStore.getCourse?.(courseId);
  if (course?.title) return course.title;
  return `Course ${courseId.slice(0, 6)}`;
};

const resolveLessonTitle = (courseId: string, lessonId: string): string => {
  const course = courseStore.getCourse?.(courseId);
  const lessons = course?.chapters?.flatMap((chapter) => chapter.lessons ?? []) ?? [];
  const lesson = lessons.find((entry) => entry.id === lessonId);
  return lesson?.title ?? `Lesson ${lessonId.slice(0, 6)}`;
};

export const useAnalyticsDashboard = (options: UseAnalyticsDashboardOptions = {}) => {
  const { courseId, dateRange = 'last-30-days' } = options;
  const [{ start, end }, rangeKey] = useMemo(() => {
    const resolved = resolveDateRange(dateRange);
    return [resolved, `${resolved.start.toISOString()}_${resolved.end.toISOString()}`] as const;
  }, [dateRange]);

  const [apiData, setApiData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [liveToken, setLiveToken] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (courseId) params.set('course_id', courseId);
      params.set('since', start.toISOString());
      params.set('until', end.toISOString());
      const query = params.toString();
      const response = await apiRequest<AdminAnalyticsResponse>(
        query ? `/api/admin/analytics?${query}` : '/api/admin/analytics',
      );
      setApiData(response);
      setLastUpdated(Date.now());
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to load analytics');
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [courseId, start, end, rangeKey]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshCounter]);

  useEffect(() => {
    const unsubProgress = syncService.subscribe('user_progress', () => {
      setLiveToken((token) => token + 1);
    });
    const unsubCompletion = syncService.subscribe('course_completed', () => {
      setLiveToken((token) => token + 1);
      setRefreshCounter((value) => value + 1);
    });
    return () => {
      unsubProgress?.();
      unsubCompletion?.();
    };
  }, []);

  const derived = useMemo<AnalyticsDashboardData>(() => {
    if (!apiData) return DEFAULT_DATA;

    const courses = apiData.courses ?? [];
    const targetCourseId = courseId ?? courses[0]?.courseId ?? null;
  const events = getEvents(targetCourseId ? { courseId: targetCourseId } : undefined);
    const engagementTrend = buildTrendPoints(events, start, end);
    const heatmap = buildHeatmap(events, start, end);

  const courseAnalytics = targetCourseId ? getCourseAnalytics(targetCourseId) : null;
    const hourlyUsage = courseAnalytics?.peakUsageHours?.length
      ? courseAnalytics.peakUsageHours
      : buildHourlyUsageFallback(events);

    const struggling = courseAnalytics?.strugglingLearners ?? [];

    const dropoffs: DropoffInsight[] = (apiData.dropoffs ?? []).map((entry) => ({
      ...entry,
      lessonTitle: resolveLessonTitle(entry.courseId, entry.lessonId),
    }));

    const learningPaths: LearningPathInsight[] = courses.slice(0, 4).map((entry) => ({
      courseId: entry.courseId,
      path: resolveCourseTitle(entry.courseId),
      success: clampPercent(entry.completionPercent ?? 0),
      avgTime: Math.round(entry.avgProgress ?? 0),
      satisfaction: Number((Math.min(5, Math.max(1, (entry.completionPercent ?? 0) / 20))).toFixed(1)),
    }));

    const aggregateActiveRate = courseAnalytics && courseAnalytics.totalLearners > 0
      ? clampPercent((courseAnalytics.activeLastWeek / courseAnalytics.totalLearners) * 100)
      : 0;

    const skillGaps: SkillGapInsight[] = [
      {
        skill: 'Completion Momentum',
        current: clampPercent(courseAnalytics?.completionRate ?? 0),
        target: 90,
        gap: Math.max(0, 90 - clampPercent(courseAnalytics?.completionRate ?? 0)),
      },
      {
        skill: 'Engagement Depth',
        current: clampPercent(courseAnalytics?.engagementScore ?? 0),
        target: 85,
        gap: Math.max(0, 85 - clampPercent(courseAnalytics?.engagementScore ?? 0)),
      },
      {
        skill: 'Learner Activation',
        current: aggregateActiveRate,
        target: 75,
        gap: Math.max(0, 75 - aggregateActiveRate),
      },
      {
        skill: 'Practice Retention',
        current: clampPercent(((courseAnalytics?.averageTimeSpent ?? 0) / 60) * 100),
        target: 70,
        gap: Math.max(0, 70 - clampPercent(((courseAnalytics?.averageTimeSpent ?? 0) / 60) * 100)),
      },
    ];

  const journeys = getAllJourneys();
    const relevantJourneys = targetCourseId
      ? journeys.filter((journey) => journey.courseId === targetCourseId)
      : journeys;

    const predictions: PredictionInsight[] = relevantJourneys
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5)
      .map((journey) => {
        const likelihoodRaw = (journey.progressPercentage * 0.6) + (journey.engagementScore * 0.4);
        const likelihood = clampPercent(likelihoodRaw);
        const risk: PredictionInsight['risk'] = likelihood >= 75 ? 'low' : likelihood >= 50 ? 'medium' : 'high';
        return {
          user: journey.userId,
          likelihood,
          risk,
          progress: clampPercent(journey.progressPercentage),
          engagementScore: clampPercent(journey.engagementScore),
        };
      });

    return {
      overview: apiData.overview ?? null,
      courses,
  dropoffs,
      surveySummary: apiData.surveySummary ?? [],
      engagementTrend,
      hourlyUsage,
      heatmap,
      courseAnalytics,
      learningPaths,
      skillGaps,
      predictions,
      strugglingLearners: struggling,
    };
  }, [apiData, courseId, start, end, liveToken]);

  return {
    data: derived,
    loading,
    error,
    lastUpdated,
    refresh: () => {
      setRefreshCounter((value) => value + 1);
    },
  } as const;
};
