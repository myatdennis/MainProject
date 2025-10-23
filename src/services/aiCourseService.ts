import { supabase } from '../lib/supabase';
import { getAnalytics } from './surveyService';
import type { Survey } from '../types/survey';

export interface AssistantReply {
  message: string;
  suggestions: string[];
  metadata: {
    source: 'generated' | 'cache';
    cacheKey: string;
    generatedAt: string;
  };
}

interface CourseOutlineRequest {
  topic: string;
  audience: string;
  outcomes?: string[];
  tone?: 'foundations' | 'advanced' | 'microlearning';
  organizationId?: string;
}

interface AssistantPrompt {
  prompt: string;
  route: 'admin' | 'lms' | 'marketing';
  organizationId?: string;
  userId?: string;
}

type CourseSignal = { courseId: string; completions: number; dropOffRate: number };

export class AICourseService {
  private cache = new Map<string, { expiresAt: number; value: AssistantReply }>();
  private inFlight = new Map<string, Promise<AssistantReply>>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes
  private readonly maxRequestsPerWindow = 6;
  private readonly windowSizeMs = 15_000;
  private readonly recentRequestTimestamps: number[] = [];
  private readonly prohibitedPatterns = [
    /\bself\s*harm\b/i,
    /\bviolence\b/i,
    /\bhate\s*speech\b/i,
  ];

  async getAssistantReply(input: AssistantPrompt): Promise<AssistantReply> {
    this.guardPrompt(input.prompt);
    this.enforceRateLimit();

    const cacheKey = this.createCacheKey('assistant', input);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.value, metadata: { ...cached.value.metadata, source: 'cache' } };
    }

    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const promise = this.resolveAssistantReply(input, cacheKey)
      .then(reply => {
        this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, value: reply });
        return reply;
      })
      .finally(() => this.inFlight.delete(cacheKey));

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  async generateCourseOutline(request: CourseOutlineRequest): Promise<AssistantReply> {
    this.guardPrompt(request.topic);
    this.enforceRateLimit();

    const cacheKey = this.createCacheKey('course-outline', request);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.value, metadata: { ...cached.value.metadata, source: 'cache' } };
    }

    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const promise = this.buildCourseOutline(request, cacheKey)
      .then(reply => {
        this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, value: reply });
        return reply;
      })
      .finally(() => this.inFlight.delete(cacheKey));

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  async summarizeSurveyInsights(survey: Survey, organizationId?: string): Promise<AssistantReply> {
    const cacheKey = this.createCacheKey('survey-summary', { surveyId: survey.id, organizationId });
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.value, metadata: { ...cached.value.metadata, source: 'cache' } };
    }

    const analytics = await getAnalytics(survey.id, organizationId);
    const insights = Array.isArray(analytics?.insights) && analytics.insights.length > 0
      ? analytics.insights
      : ['Collect more responses to unlock AI-assisted insights.'];

    const reply: AssistantReply = {
      message: `Here is the latest intelligence for **${survey.title}**:\n\n- Total responses: ${analytics?.totalResponses ?? 0}\n- Completion rate: ${analytics?.completionRate ?? 0}%\n- Avg. completion time: ${analytics?.avgCompletionTime ?? 0} minutes\n\nKey insights:\n${insights.map(item => `• ${item}`).join('\n')}`,
      suggestions: [
        'View detailed survey analytics',
        'Share a summary with stakeholders',
        'Schedule a listening session with low-scoring teams',
      ],
      metadata: {
        source: 'generated',
        cacheKey,
        generatedAt: new Date().toISOString(),
      },
    };

    this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, value: reply });
    return reply;
  }

  private async resolveAssistantReply(input: AssistantPrompt, cacheKey: string): Promise<AssistantReply> {
    const normalizedPrompt = input.prompt.trim().toLowerCase();
    const generatedAt = new Date().toISOString();

    if (normalizedPrompt.includes('outline') || normalizedPrompt.includes('curriculum')) {
      return this.buildCourseOutline(
        {
          topic: input.prompt,
          audience: input.route === 'lms' ? 'learner' : 'admin',
          organizationId: input.organizationId,
        },
        cacheKey,
      );
    }

    if (normalizedPrompt.includes('completion rate') || normalizedPrompt.includes('progress')) {
      const analytics = await this.fetchCourseSignals(input.organizationId);
      const suggestions = [
        'Open the analytics dashboard',
        'Send nudges to learners who are behind',
        'Review struggling lessons for updates',
      ];

      const leaderboard = analytics
        .slice(0, 3)
        .map(item => `${item.courseId} (${item.completions} completions)`)
        .join(', ');

      const message =
        analytics.length > 0
          ? `Based on the latest completions, the top-performing courses are ${leaderboard}. Consider boosting support for modules with higher drop-offs.`
          : 'I do not have recent completions yet. Once learners begin finishing courses, I will surface the trends here.';

      return {
        message,
        suggestions,
        metadata: {
          source: 'generated',
          cacheKey,
          generatedAt,
        },
      };
    }

    const genericSuggestions = input.route === 'admin'
      ? [
          'Review organization health dashboard',
          'Assign a new learning path',
          'Export a stakeholder-ready report',
        ]
      : input.route === 'lms'
      ? [
          'Show my course progress',
          'Suggest a quick practice activity',
          'Explain a key concept',
        ]
      : [
          'Schedule a discovery call',
          'Explore success stories',
          'Share pricing options',
        ];

    return {
      message: this.buildFriendlyResponse(input.prompt, input.route),
      suggestions: genericSuggestions,
      metadata: {
        source: 'generated',
        cacheKey,
        generatedAt,
      },
    };
  }

  private async buildCourseOutline(request: CourseOutlineRequest, cacheKey: string): Promise<AssistantReply> {
    const generatedAt = new Date().toISOString();
    const topic = request.topic.trim();
    const outcomes = request.outcomes && request.outcomes.length > 0
      ? request.outcomes
      : ['Understand the core concepts', 'Apply strategies in real scenarios', 'Measure impact effectively'];

    const analyticsSignals = await this.fetchCourseSignals(request.organizationId);
    const emphasis = analyticsSignals.find(signal => signal.dropOffRate > 30)?.courseId;

    const modules = [
      {
        title: `Foundations of ${topic}`,
        description: `Establish shared language and expectations for ${topic.toLowerCase()}.`,
        actions: ['Context-setting micro-lecture', 'Reflection prompt', 'Pulse-check poll'],
      },
      {
        title: `Practice ${topic} with Real Scenarios`,
        description: 'Apply the concepts to lived examples and interactive case studies.',
        actions: ['Scenario lab', 'Peer discussion', 'Progress assessment'],
      },
      {
        title: `Sustain and Measure ${topic}`,
        description: 'Embed rituals, metrics, and accountability plans to sustain progress.',
        actions: ['Action planning', 'Measurement toolkit', 'Executive summary'],
      },
    ];

    const emphasisNote = emphasis
      ? `Learners most often pause in **${emphasis}**, so add facilitator guidance or office hours there.`
      : 'Learners maintain momentum through the flow; sustain with quick reflection prompts.';

    return {
      message: `Here is a three-part outline for **${topic}** tailored to ${request.audience} audiences:\n\n${modules
        .map(
          (module, index) =>
            `**Module ${index + 1}: ${module.title}**\n${module.description}\nKey activities: ${module.actions.join(', ')}`,
        )
        .join('\n\n')}\n\nIntended outcomes:\n${outcomes.map(o => `• ${o}`).join('\n')}\n\n${emphasisNote}`,
      suggestions: [
        'Export as a course draft',
        'Generate facilitator notes',
        'Design an assessment for this outline',
      ],
      metadata: {
        source: 'generated',
        cacheKey,
        generatedAt,
      },
    };
  }

  private async fetchCourseSignals(organizationId?: string): Promise<CourseSignal[]> {
    const supabaseConfigured = Boolean(
      import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
    );

    if (!supabaseConfigured) {
      return [];
    }

    const query = supabase
      .from('analytics_events')
      .select('course_id, event_type, payload, occurred_at')
      .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.warn('Unable to load analytics signals for AI assistant', error);
      return [];
    }

    const grouped = new Map<string, { completions: number; dropOffRate: number }>();
    data.forEach(event => {
      if (!event.course_id) return;
      const current = grouped.get(event.course_id) ?? { completions: 0, dropOffRate: 0 };
      if (event.event_type === 'course_completed') {
        current.completions += 1;
      }
      if (event.event_type === 'course_abandoned') {
        current.dropOffRate += 1;
      }
      grouped.set(event.course_id, current);
    });

    return Array.from(grouped.entries()).map(([courseId, stats]) => ({
      courseId,
      completions: stats.completions,
      dropOffRate: stats.dropOffRate,
    }));
  }

  private guardPrompt(text: string): void {
    if (!text) return;
    for (const pattern of this.prohibitedPatterns) {
      if (pattern.test(text)) {
        throw new Error('The requested prompt cannot be processed because it violates safety guardrails.');
      }
    }
  }

  private enforceRateLimit(): void {
    const now = Date.now();
    this.recentRequestTimestamps.push(now);
    while (this.recentRequestTimestamps.length && now - this.recentRequestTimestamps[0] > this.windowSizeMs) {
      this.recentRequestTimestamps.shift();
    }

    if (this.recentRequestTimestamps.length > this.maxRequestsPerWindow) {
      throw new Error('Please slow down a bit — the assistant needs a moment before handling more requests.');
    }
  }

  private createCacheKey(prefix: string, payload: unknown): string {
    return `${prefix}:${JSON.stringify(payload)}`;
  }

  private buildFriendlyResponse(prompt: string, route: AssistantPrompt['route']): string {
    if (route === 'admin') {
      return `I'll help you operationalize that. ${prompt.includes('report') ? 'You can export a ready-to-share PDF from the analytics screen.' : 'Let me know which organization or cohort you want to focus on, and I will surface the right metrics.'}`;
    }
    if (route === 'lms') {
      return `Great question! I can point you to the right lesson or resource. Ask for a refresher, a practice scenario, or a quick summary for "${prompt}".`;
    }
    return `I'd love to help you explore The Huddle Co.'s services. Share a bit more about your goals and I can recommend programs or next steps.`;
  }
}

export const aiCourseService = new AICourseService();
