import { CURRENT_CONTENT_SCHEMA_VERSION } from '../schema/contentSchema';
import type { QuizOption } from '../types/courseTypes';

type LegacyQuizOptionObject = {
  id?: string;
  text?: string;
  label?: string;
  value?: string;
  title?: string;
  correct?: boolean;
  isCorrect?: boolean;
  [key: string]: unknown;
};

// A small migrator utility for lesson content. For now it ensures a schema_version
// key is present and allows future migrations to be applied centrally.

export function migrateLessonContent(raw: any): any {
  const initial = raw && typeof raw === 'object' ? { ...raw } : {};
  const flattened = flattenBody(initial);
  const out = { ...flattened };

  // If schema_version missing, treat as legacy v0 and set to 1
  if (out.schema_version == null) {
    // Apply initial migration steps from legacy shapes into v1 canonical shape
    out.schema_version = CURRENT_CONTENT_SCHEMA_VERSION;

    // Normalize common legacy keys to canonical names used in v1
    // 1) text content alias: `content` -> `textContent`
    if (out.content && !out.textContent) {
      out.textContent = out.content;
      // keep legacy field for backwards compatibility
    }

    // 2) video duration might be stored as a string in legacy imports
    if (out.videoDuration != null && typeof out.videoDuration === 'string') {
      const n = parseInt(out.videoDuration as string, 10);
      if (!Number.isNaN(n)) out.videoDuration = n;
    }

    // 3) captions may use different keys (start/end/text). Normalize to startTime/endTime/text
    if (Array.isArray(out.captions)) {
      out.captions = out.captions.map((c: any) => {
        const start = c.startTime ?? c.start ?? c.from ?? c.s ?? 0;
        const end = c.endTime ?? c.end ?? c.to ?? c.e ?? 0;
        const text = c.text ?? c.content ?? c.caption ?? '';
        return { startTime: start, endTime: end, text };
      });
    }

    // 4) set a rough `type` hint when missing
    if (!out.type) {
      if (out.videoUrl || out.videoDuration) out.type = 'video';
      else if (out.textContent || out.content) out.type = 'text';
    }

    // 5) quiz legacy shapes: questions may be present under `questions` or `quiz.questions`.
    const maybeQuestions = out.questions || (out.quiz && out.quiz.questions) || null;
    if (maybeQuestions && Array.isArray(maybeQuestions)) {
      out.type = out.type || 'quiz';
      out.questions = normalizeQuizQuestions(maybeQuestions);
    }

    // 6) reflection shape: common keys `prompt` or `reflectionPrompt`
    if (!out.type && (out.prompt || out.reflectionPrompt)) {
      out.type = 'reflection';
      out.prompt = out.prompt || out.reflectionPrompt || '';
    }

    // 7) interactive activities: normalize `instructions` or `steps`
    if (!out.type && (out.instructions || out.steps || out.activity)) {
      out.type = 'interactive';
      out.instructions = out.instructions || (typeof out.activity === 'string' ? out.activity : undefined) || '';
      if (Array.isArray(out.steps)) {
        out.steps = out.steps.map((s: any, idx: number) => ({ id: s.id || `step_${idx}`, title: s.title || s.heading || `Step ${idx + 1}`, body: s.body || s.content || s.text || '' }));
      }
    }
  }

  // Ensure quizzes remain canonical on subsequent runs
  if (Array.isArray(out.questions)) {
    out.questions = normalizeQuizQuestions(out.questions);
  }

  // Promote video metadata to canonical object
  maybeDeriveVideo(out);

  // Future migrations can be applied here using switch(out.schema_version) {...}

  return out;
}

export default migrateLessonContent;

function flattenBody(input: Record<string, any>): Record<string, any> {
  if (!input || typeof input !== 'object') return {};
  if (input.body && typeof input.body === 'object') {
    const { body, ...rest } = input;
    return {
      ...rest,
      ...body,
      // Preserve nested schema_version if the wrapper already had it
      schema_version: rest.schema_version ?? body.schema_version ?? rest.schemaVersion ?? body.schemaVersion,
    };
  }
  return input;
}

const isLegacyOptionObject = (value: unknown): value is LegacyQuizOptionObject =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function normalizeQuizQuestions(questions: any[]): any[] {
  return questions.map((question, index) => {
    const id = question?.id || `q_${index}`;
    const text = question?.text || question?.question || question?.prompt || '';
    const rawOptions = Array.isArray(question?.options)
      ? question.options
      : Array.isArray(question?.choices)
      ? question.choices
      : Array.isArray(question?.answers)
      ? question.answers
      : [];

    const normalizedOptions: QuizOption[] = rawOptions
      .map((option: LegacyQuizOptionObject | string, optionIndex: number) => {
        const fallbackId = `${id}_opt_${optionIndex}`;
        if (typeof option === 'string') {
          return {
            id: fallbackId,
            text: option,
            correct: determineStringCorrect(optionIndex, option, question),
            isCorrect: determineStringCorrect(optionIndex, option, question),
          };
        }
        if (!isLegacyOptionObject(option)) return null;

        const optionText =
          option.text ??
          option.label ??
          option.value ??
          option.title ??
          String(option);
        const optionId = option.id || fallbackId;
        const isCorrect =
          option.correct ??
          option.isCorrect ??
          determineStringCorrect(optionIndex, optionText, question);

        return {
          ...option,
          id: optionId,
          text: optionText,
          correct: Boolean(isCorrect),
          isCorrect: Boolean(isCorrect),
        };
      })
      .filter((option: QuizOption | null): option is QuizOption => Boolean(option?.id));

    const correctIndices = normalizedOptions
      .map((opt, optIndex) => (opt.correct || opt.isCorrect ? optIndex : -1))
      .filter((idx) => idx >= 0);
    const canonicalQuestion = {
      ...question,
      id,
      text,
      prompt: question?.prompt || text,
      options: normalizedOptions,
      correctAnswerIndex:
        typeof question?.correctAnswerIndex === 'number'
          ? question.correctAnswerIndex
          : correctIndices.length ? correctIndices[0] : undefined,
      correctOptionIds: normalizedOptions
        .filter((opt) => opt.correct || opt.isCorrect)
        .map((opt) => opt.id),
    };
    return canonicalQuestion;
  });
}

function determineStringCorrect(optionIndex: number, optionText: string, question: any): boolean {
  if (Array.isArray(question?.correctAnswer)) {
    return question.correctAnswer.some((answer: any) => String(answer) === String(optionIndex) || String(answer) === optionText);
  }
  if (typeof question?.correctAnswer === 'number') {
    return optionIndex === question.correctAnswer;
  }
  if (typeof question?.correctAnswer === 'string') {
    return question.correctAnswer === optionText;
  }
  if (typeof question?.correctAnswerIndex === 'number') {
    return optionIndex === question.correctAnswerIndex;
  }
  return false;
}

function maybeDeriveVideo(out: Record<string, any>) {
  const candidateUrl =
    out.video?.url ||
    out.videoUrl ||
    out.src ||
    out.videoSrc ||
    (Array.isArray(out.resources)
      ? out.resources.find((r: any) => typeof r === 'string' && r.includes('mp4'))
      : null);

  if (!candidateUrl) {
    return;
  }

  const provider = out.video?.provider || out.videoProvider || deriveProvider(candidateUrl);
  const sourceType = out.video?.sourceType || out.videoSourceType || deriveSourceType(candidateUrl);
  const videoType = deriveVideoType(candidateUrl, provider);
  const durationSeconds = typeof out.videoDuration === 'number' ? out.videoDuration : out.video?.durationSeconds;
  const thumbnailUrl = out.video?.thumbnailUrl || out.videoThumbnail;

  out.video = {
    type: videoType,
    url: candidateUrl,
    embedUrl: out.video?.embedUrl || deriveEmbedUrl(candidateUrl, videoType),
    provider,
    sourceType,
    thumbnailUrl,
    durationSeconds,
    title: out.video?.title || out.title || out.name,
  };

  out.videoUrl = candidateUrl;
  out.videoProvider = provider;
  out.videoSourceType = sourceType;
  if (durationSeconds != null) {
    out.videoDuration = durationSeconds;
  }
}

function deriveProvider(url: string): string {
  if (!url) return 'external';
  if (url.includes('youtu')) return 'youtube';
  if (url.includes('vimeo')) return 'vimeo';
  if (url.includes('loom')) return 'loom';
  if (url.includes('wistia')) return 'wistia';
  return 'external';
}

function deriveSourceType(url: string): string {
  if (!url) return 'external';
  if (url.startsWith('http')) {
    if (url.includes('youtu')) return 'youtube';
    if (url.includes('vimeo')) return 'vimeo';
  }
  return 'external';
}

function deriveVideoType(url: string, provider?: string): 'youtube' | 'vimeo' | 'loom' | 'native' | 'external' {
  const normalizedProvider = (provider || '').toLowerCase();
  if (normalizedProvider === 'youtube' || url.includes('youtu')) return 'youtube';
  if (normalizedProvider === 'vimeo' || url.includes('vimeo')) return 'vimeo';
  if (normalizedProvider === 'loom' || url.includes('loom.com')) return 'loom';
  if (!url.startsWith('http')) return 'native';
  if (url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm')) return 'native';
  return 'external';
}

function deriveEmbedUrl(url: string, type: string): string | undefined {
  if (!url) return undefined;
  if (type === 'youtube') {
    if (url.includes('watch?v=')) {
      const videoId = url.split('watch?v=')[1]?.split('&')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    return url;
  }
  if (type === 'vimeo') {
    const parts = url.split('vimeo.com/');
    if (parts.length > 1) {
      const videoId = parts[1].split(/[?#]/)[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  }
  return url;
}
