export type ReflectionResponseData = {
  promptResponse: string;
  deeperReflection1: string;
  deeperReflection2: string;
  deeperReflection3: string;
  actionCommitment: string;
  currentStepId?: string | null;
  submittedAt?: string | null;
};

export type ReflectionDraftPayload = {
  data: ReflectionResponseData;
  currentStepId?: string | null;
  updatedAt: string;
  status?: 'draft' | 'submitted' | null;
};

export type GuidedReflectionConfig = {
  introText: string;
  prompt: string;
  instructions: string;
  thinkPrompt: string;
  deepenPrompts: string[];
  actionPrompt: string;
  confirmationMessage: string;
};

const DEFAULT_DEEPEN_PROMPTS = [
  'What experiences shaped this perspective?',
  'Where have you seen this in your environment?',
  'What might others experience differently?',
];

export const createEmptyReflectionResponseData = (): ReflectionResponseData => ({
  promptResponse: '',
  deeperReflection1: '',
  deeperReflection2: '',
  deeperReflection3: '',
  actionCommitment: '',
  currentStepId: 'intro',
  submittedAt: null,
});

export const normalizeReflectionResponseData = (value: unknown): ReflectionResponseData => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    promptResponse:
      typeof record.promptResponse === 'string'
        ? record.promptResponse
        : typeof record.prompt_response === 'string'
        ? record.prompt_response
        : '',
    deeperReflection1:
      typeof record.deeperReflection1 === 'string'
        ? record.deeperReflection1
        : typeof record.deeper_reflection_1 === 'string'
        ? record.deeper_reflection_1
        : '',
    deeperReflection2:
      typeof record.deeperReflection2 === 'string'
        ? record.deeperReflection2
        : typeof record.deeper_reflection_2 === 'string'
        ? record.deeper_reflection_2
        : '',
    deeperReflection3:
      typeof record.deeperReflection3 === 'string'
        ? record.deeperReflection3
        : typeof record.deeper_reflection_3 === 'string'
        ? record.deeper_reflection_3
        : '',
    actionCommitment:
      typeof record.actionCommitment === 'string'
        ? record.actionCommitment
        : typeof record.action_commitment === 'string'
        ? record.action_commitment
        : '',
    currentStepId:
      typeof record.currentStepId === 'string'
        ? record.currentStepId
        : typeof record.current_step_id === 'string'
        ? record.current_step_id
        : 'intro',
    submittedAt:
      typeof record.submittedAt === 'string'
        ? record.submittedAt
        : typeof record.submitted_at === 'string'
        ? record.submitted_at
        : null,
  };
};

export const normalizeGuidedReflectionConfig = (content: Record<string, unknown> | null | undefined): GuidedReflectionConfig => {
  const record = content && typeof content === 'object' ? content : {};
  const introText =
    typeof record.introText === 'string' && record.introText.trim()
      ? record.introText.trim()
      : 'Create a quiet moment for yourself. This reflection will guide you step by step.';
  const prompt =
    typeof record.prompt === 'string' && record.prompt.trim()
      ? record.prompt.trim()
      : typeof record.reflectionPrompt === 'string' && record.reflectionPrompt.trim()
      ? record.reflectionPrompt.trim()
      : 'Take a moment to reflect on this lesson.';
  const instructions =
    typeof record.instructions === 'string' && record.instructions.trim()
      ? record.instructions.trim()
      : typeof record.description === 'string' && record.description.trim()
      ? record.description.trim()
      : '';
  const thinkPrompt =
    typeof record.thinkPrompt === 'string' && record.thinkPrompt.trim()
      ? record.thinkPrompt.trim()
      : typeof record.think_prompt === 'string' && record.think_prompt.trim()
      ? record.think_prompt.trim()
      : 'Pause for a breath. Notice what is coming up before you begin writing.';
  const deepenPrompts = Array.isArray(record.deepenPrompts)
    ? record.deepenPrompts
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 3)
    : Array.isArray(record.deepen_prompts)
    ? record.deepen_prompts
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const actionPrompt =
    typeof record.actionPrompt === 'string' && record.actionPrompt.trim()
      ? record.actionPrompt.trim()
      : typeof record.action_prompt === 'string' && record.action_prompt.trim()
      ? record.action_prompt.trim()
      : 'What is one action you can take moving forward?';
  const confirmationMessage =
    typeof record.confirmationMessage === 'string' && record.confirmationMessage.trim()
      ? record.confirmationMessage.trim()
      : typeof record.confirmation_message === 'string' && record.confirmation_message.trim()
      ? record.confirmation_message.trim()
      : 'Reflection saved. Carry one clear insight with you into the next lesson.';

  return {
    introText,
    prompt,
    instructions,
    thinkPrompt,
    deepenPrompts: deepenPrompts.length > 0 ? deepenPrompts : DEFAULT_DEEPEN_PROMPTS.slice(0, 2),
    actionPrompt,
    confirmationMessage,
  };
};

export const buildReflectionDraftStorageKey = (courseId: string, lessonId: string, learnerId: string) =>
  `reflection-draft:${courseId}:${lessonId}:${learnerId}`;

export const summarizeReflectionResponse = (data: ReflectionResponseData): string =>
  [data.promptResponse, data.deeperReflection1, data.deeperReflection2, data.deeperReflection3, data.actionCommitment]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n\n');
