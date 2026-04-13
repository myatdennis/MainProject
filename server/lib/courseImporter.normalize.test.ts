import { describe, it, expect } from 'vitest';
import {
  normalizeLessonForImport,
  normalizeModuleForImport,
  normalizeImportEntries,
  deriveQuizQuestions,
  deriveBranchingElements,
} from './courseImporter.js';

// ---------------------------------------------------------------------------
// Test-local types — satisfy strict-mode inference without touching production JS.
// ---------------------------------------------------------------------------

/** Minimal shape of an option/choice item returned by the normalizer. */
type ItemLike = Record<string, unknown>;

/** Minimal shape of the object returned by normalizeLessonForImport. */
type NormalizedLesson = {
  content?: {
    questions?: Array<{
      prompt?: string;
      options?: ItemLike[];
    }>;
    elements?: Array<{
      data?: Array<{
        text?: string;
        choices?: ItemLike[];
      }>;
    }>;
  };
  content_json?: {
    body?: {
      elements?: Array<{
        data?: Array<{
          text?: string;
        }>;
      }>;
    };
  };
};

/** Shape expected from deriveQuizQuestions. */
type QuestionResult = {
  prompt?: string;
  options?: ItemLike[];
};

/** Shape expected from deriveBranchingElements. */
type ElementResult = {
  data?: Array<{ choices?: ItemLike[] }>;
};

describe('course importer normalization', () => {
  it('normalizes quiz lessons from nested blocks', () => {
    const lesson = {
      type: 'quiz',
      content: {
        blocks: [
          {
            props: {
              prompt: 'What is empathy?',
              choices: [
                { id: 'a', text: 'A feeling', isCorrect: false },
                { id: 'b', text: 'Understanding others', isCorrect: true },
              ],
            },
          },
        ],
      },
    };

    const normalized = normalizeLessonForImport(lesson, { moduleIndex: 0, lessonIndex: 0 }) as NormalizedLesson;
    expect(Array.isArray(normalized.content?.questions)).toBe(true);
    expect(normalized.content?.questions?.length).toBe(1);
    const [question] = normalized.content?.questions ?? [];
    expect(question?.prompt).toBe('What is empathy?');
    expect(question?.options?.length).toBe(2);
    const correct = question?.options?.find((option: ItemLike) => option['correct']);
    expect(correct?.['text']).toBe('Understanding others');
  });

  it('normalizes interactive lessons from nested nodes', () => {
    const lesson = {
      type: 'interactive',
      content_json: {
        nodes: [
          {
            id: 'node-1',
            prompt: 'Choose the branch',
            options: [
              { text: 'Path A', next: 'node-2' },
              { text: 'Path B', next: 'node-3' },
            ],
          },
        ],
      },
    };

    const normalized = normalizeLessonForImport(lesson, { moduleIndex: 0, lessonIndex: 0 }) as NormalizedLesson;
    expect(Array.isArray(normalized.content?.elements)).toBe(true);
    const [element] = normalized.content?.elements ?? [];
    const [node] = element?.data ?? [];
    expect(node?.text).toBe('Choose the branch');
    expect(node?.choices?.map((option: ItemLike) => option['to'])).toEqual(['node-2', 'node-3']);
  });

  it('derives quiz questions directly from helpers', () => {
    const lesson = {
      content: {
        questions: [
          {
            prompt: 'Direct prompt',
            choices: [
              { text: 'Wrong' },
              { text: 'Right', correct: true },
            ],
          },
        ],
      },
    };
    const questions = deriveQuizQuestions(lesson) as QuestionResult[];
    expect(questions.length).toBe(1);
    expect(questions[0]?.prompt).toBe('Direct prompt');
    expect(questions[0]?.options?.some((option: ItemLike) => option['correct'])).toBe(true);
  });

  it('derives branching elements directly from helpers', () => {
    const lesson = {
      nodes: [
        {
          prompt: 'Branch?',
          options: [
            { text: 'Yes', nextNodeId: 'next-1' },
            { text: 'No', nextNodeId: 'next-2' },
          ],
        },
      ],
    };
    const elements = deriveBranchingElements(lesson) as ElementResult[];
    expect(elements.length).toBe(1);
    expect(elements[0]?.data?.[0]?.choices?.map((option: ItemLike) => option['to'])).toEqual(['next-1', 'next-2']);
  });

  it('normalizes builder-style scenario elements for interactive lessons', () => {
    const lesson = {
      type: 'interactive',
      content: {
        elements: [
          {
            id: 'bias-scenario-1',
            type: 'scenario',
            title: 'Hiring Bias Challenge',
            order: 1,
            data: [
              {
                id: 'bias-start',
                title: 'The Hiring Decision',
                text: 'You are reviewing candidates.',
                choices: [
                  {
                    id: 'choice-a',
                    text: 'Trust your instinct',
                    nextScenarioId: 'bias-affinity',
                  },
                  {
                    id: 'choice-b',
                    text: 'Use structured criteria',
                    nextScenarioId: 'bias-structured',
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const normalized = normalizeLessonForImport(lesson, { moduleIndex: 0, lessonIndex: 0 }) as NormalizedLesson;
    expect(Array.isArray(normalized.content?.elements)).toBe(true);
    expect(normalized.content?.elements?.[0]?.data?.[0]?.choices?.map((choice: ItemLike) => choice['to'])).toEqual([
      'bias-affinity',
      'bias-structured',
    ]);
    expect(normalized.content_json?.body?.elements?.[0]?.data?.[0]?.text).toBe('You are reviewing candidates.');
  });

  it('derives quiz questions when the correct answer is provided by option id', () => {
    const lesson = {
      type: 'quiz',
      content_json: {
        questions: [
          {
            id: 'q1',
            question: 'Choose the right answer',
            options: [
              { id: 'a', text: 'Wrong' },
              { id: 'b', text: 'Right' },
            ],
            correctAnswer: 'b',
          },
        ],
      },
    };

    const normalized = normalizeLessonForImport(lesson, { moduleIndex: 0, lessonIndex: 0 }) as NormalizedLesson;
    expect(normalized.content?.questions?.length).toBe(1);
    expect(normalized.content?.questions?.[0]?.options?.find((option: ItemLike) => option['correct'])?.['id']).toBe('b');
  });

  it('derives quiz questions from content.body.quizQuestions', () => {
    const lesson = {
      type: 'quiz',
      content: {
        body: {
          quizQuestions: [
            {
              prompt: 'Nested body quiz question?',
              options: [
                { id: 'opt-a', text: 'No', isCorrect: false },
                { id: 'opt-b', text: 'Yes', isCorrect: true },
              ],
            },
          ],
        },
      },
      content_json: {},
    };

    const normalized = normalizeLessonForImport(lesson, { moduleIndex: 0, lessonIndex: 0 }) as NormalizedLesson;
    expect(normalized.content?.questions?.length).toBe(1);
    expect(normalized.content?.questions?.[0]?.prompt).toBe('Nested body quiz question?');
    expect(normalized.content?.questions?.[0]?.options?.find((option: ItemLike) => option['correct'])?.['id']).toBe('opt-b');
  });

  it('normalizes module lessons consistently', () => {
    const module = {
      title: 'Module 1',
      lessons: [
        {
          id: 'lesson-1',
          type: 'quiz',
          content: {
            blocks: [
              {
                props: {
                  prompt: 'Which letter?',
                  choices: [
                    { text: 'A' },
                    { text: 'B', correct: true },
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const normalized = normalizeModuleForImport(module, { moduleIndex: 0 });
    expect(normalized.lessons?.[0]?.content?.questions?.[0]?.prompt).toBe('Which letter?');
  });

  it('supports top-level payload shapes in normalizeImportEntries', () => {
    const payload = {
      courses: [
        {
          course: { title: 'Course A' },
          modules: [{ title: 'Module A', lessons: [] }],
        },
      ],
    };
    const { entries, sourceLabel } = normalizeImportEntries(payload);
    expect(sourceLabel).toBe('courses');
    expect(entries.length).toBe(1);
    expect(entries[0]?.course?.title).toBe('Course A');
    expect(entries[0]?.modules?.length).toBe(1);
  });

  it('unwraps data envelopes before normalizing entries', () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            course: { title: 'Wrapped Course', slug: 'wrapped' },
            modules: [],
          },
        ],
      },
      meta: { requestId: 'req-123' },
    };
    const { entries, sourceLabel } = normalizeImportEntries(payload);
    expect(sourceLabel).toBe('items');
    expect(entries.length).toBe(1);
    expect(entries[0]?.course?.title).toBe('Wrapped Course');
  });

  it('handles array payload nested in data envelopes', () => {
    const payload = {
      data: [
        {
          title: 'Array Course',
          modules: [{ title: 'M1', lessons: [] }],
        },
      ],
    };
    const { entries } = normalizeImportEntries(payload);
    expect(entries.length).toBe(1);
    expect(entries[0]?.course?.title).toBe('Array Course');
    expect(entries[0]?.modules?.length).toBe(1);
  });

  it('copies nested course slug and title to the normalized import entry root', () => {
    const payload = {
      items: [
        {
          course: { title: 'Nested Course', slug: 'nested-course' },
          modules: [{ title: 'Module A', lessons: [] }],
        },
      ],
    };
    const { entries } = normalizeImportEntries(payload);
    expect(entries.length).toBe(1);
    expect(entries[0]?.course?.slug).toBe('nested-course');
    expect(entries[0]?.slug).toBe('nested-course');
    expect(entries[0]?.course?.title).toBe('Nested Course');
    expect(entries[0]?.title).toBe('Nested Course');
  });
});
