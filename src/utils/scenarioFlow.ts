export type ScenarioImpactScores = {
  empathy: number;
  inclusion: number;
  effectiveness: number;
};

export type ScenarioCoachFeedback = {
  whatHappened: string;
  howItMayHaveFelt: string;
  inclusiveLeaderConsideration: string;
};

export type ScenarioCharacter = {
  id: string;
  name: string;
  role?: string;
  pronouns?: string;
  avatarUrl?: string;
};

export type ScenarioDialogueLine = {
  id: string;
  speakerId: string | 'narrator';
  text: string;
};

export type ScenarioDecisionOption = {
  id: string;
  label: string;
  nextNodeId?: string | null;
  coach?: Partial<ScenarioCoachFeedback>;
  impact?: Partial<ScenarioImpactScores>;
};

export type ScenarioDecisionNode = {
  id: string;
  title?: string;
  context?: string;
  dialogue?: ScenarioDialogueLine[];
  prompt: string;
  options: ScenarioDecisionOption[];
};

export type ScenarioLesson = {
  version: 1;
  title?: string;
  context: string;
  situation?: string;
  characters: ScenarioCharacter[];
  startNodeId: string;
  nodes: ScenarioDecisionNode[];
  requireReflection?: boolean;
};

const clampScore = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-5, Math.min(5, Math.round(n)));
};

export const defaultScenarioScores = (): ScenarioImpactScores => ({
  empathy: 0,
  inclusion: 0,
  effectiveness: 0,
});

export const normalizeScenarioLesson = (lessonContent: Record<string, any>, lessonTitle?: string): ScenarioLesson => {
  const existing = lessonContent?.scenario;
  if (existing && typeof existing === 'object' && Array.isArray(existing.nodes) && existing.nodes.length > 0) {
    const nodes = existing.nodes
      .filter(Boolean)
      .map((node: any) => ({
        id: String(node.id),
        title: typeof node.title === 'string' ? node.title : undefined,
        context: typeof node.context === 'string' ? node.context : undefined,
        dialogue: Array.isArray(node.dialogue)
          ? node.dialogue
              .filter(Boolean)
              .map((line: any, index: number) => ({
                id: String(line.id ?? `${node.id}:line:${index}`),
                speakerId: (typeof line.speakerId === 'string' ? line.speakerId : 'narrator') as string | 'narrator',
                text: String(line.text ?? ''),
              }))
          : undefined,
        prompt: String(node.prompt ?? 'What do you do?'),
        options: Array.isArray(node.options)
          ? node.options
              .filter(Boolean)
              .map((option: any, index: number) => ({
                id: String(option.id ?? `${node.id}:opt:${index}`),
                label: String(option.label ?? option.text ?? ''),
                nextNodeId:
                  option.nextNodeId === null || option.nextNodeId === undefined
                    ? undefined
                    : String(option.nextNodeId),
                coach: option.coach && typeof option.coach === 'object' ? option.coach : undefined,
                impact: option.impact && typeof option.impact === 'object' ? option.impact : undefined,
              }))
          : [],
      }));

    const startNodeId = String(existing.startNodeId ?? nodes[0]?.id ?? 'start');
    return {
      version: 1,
      title: typeof existing.title === 'string' ? existing.title : lessonTitle,
      context: String(existing.context ?? lessonContent.scenarioText ?? ''),
      situation: typeof existing.situation === 'string' ? existing.situation : undefined,
      characters: Array.isArray(existing.characters)
        ? existing.characters
            .filter(Boolean)
            .map((c: any, index: number) => ({
              id: String(c.id ?? `char:${index}`),
              name: String(c.name ?? 'Someone'),
              role: typeof c.role === 'string' ? c.role : undefined,
              pronouns: typeof c.pronouns === 'string' ? c.pronouns : undefined,
              avatarUrl: typeof c.avatarUrl === 'string' ? c.avatarUrl : undefined,
            }))
        : [],
      startNodeId,
      nodes,
      requireReflection: Boolean(existing.requireReflection),
    };
  }

  const legacyContext = String(lessonContent?.scenarioText ?? lessonContent?.textContent ?? lessonContent?.content ?? '');
  const legacyOptions = Array.isArray(lessonContent?.options) ? lessonContent.options : [];

  return {
    version: 1,
    title: lessonTitle,
    context: legacyContext,
    characters: [],
    startNodeId: 'legacy:root',
    nodes: [
      {
        id: 'legacy:root',
        title: 'In the moment',
        context: legacyContext,
        prompt: 'What do you do?',
        options: legacyOptions.map((option: any, index: number) => ({
          id: String(option.id ?? `legacy:opt:${index}`),
          label: String(option.text ?? ''),
          nextNodeId: null,
          coach: {
            whatHappened: String(option.feedback ?? ''),
            howItMayHaveFelt:
              'Different people may experience this moment in different ways, based on their past experiences and how safe they feel on the team.',
            inclusiveLeaderConsideration:
              'Pause, check assumptions, and make space for others to share what they need—especially those most impacted.',
          },
        })),
      },
    ],
  };
};

export const applyScenarioImpact = (
  scores: ScenarioImpactScores,
  impact: Partial<ScenarioImpactScores> | undefined,
): ScenarioImpactScores => ({
  empathy: clampScore(scores.empathy + clampScore(impact?.empathy ?? 0)),
  inclusion: clampScore(scores.inclusion + clampScore(impact?.inclusion ?? 0)),
  effectiveness: clampScore(scores.effectiveness + clampScore(impact?.effectiveness ?? 0)),
});

export const buildScenarioDraftKey = (courseId: string, lessonId: string, learnerId: string) =>
  `scenario:draft:v1:${courseId}:${lessonId}:${learnerId}`;

export type ScenarioDraft = {
  currentNodeId: string;
  history: Array<{ nodeId: string; optionId: string; ts: string }>;
  scores: ScenarioImpactScores;
  updatedAt: string;
};

export const readScenarioDraft = (courseId: string, lessonId: string, learnerId: string): ScenarioDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(buildScenarioDraftKey(courseId, lessonId, learnerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScenarioDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.currentNodeId !== 'string') return null;
    return {
      currentNodeId: parsed.currentNodeId,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      scores: parsed.scores ?? defaultScenarioScores(),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const writeScenarioDraft = (courseId: string, lessonId: string, learnerId: string, draft: ScenarioDraft) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildScenarioDraftKey(courseId, lessonId, learnerId), JSON.stringify(draft));
  } catch {
    // no-op
  }
};

export const clearScenarioDraft = (courseId: string, lessonId: string, learnerId: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(buildScenarioDraftKey(courseId, lessonId, learnerId));
  } catch {
    // no-op
  }
};

export const scoreLabel = (value: number) => {
  if (value >= 3) return 'Strong';
  if (value >= 1) return 'Growing';
  if (value <= -3) return 'Needs care';
  if (value <= -1) return 'Tense';
  return 'Steady';
};

