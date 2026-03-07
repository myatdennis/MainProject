import { describe, it, expect } from 'vitest';
import {
  normalizeLessonForImport,
  normalizeModuleForImport,
  normalizeImportEntries,
  deriveQuizQuestions,
  deriveBranchingElements,
} from './courseImporter.js';

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

    const normalized = normalizeLessonForImport(lesson, { moduleIndex: 0, lessonIndex: 0 });
    expect(Array.isArray(normalized.content?.questions)).toBe(true);
    expect(normalized.content?.questions?.length).toBe(1);
    const [question] = normalized.content?.questions ?? [];
    expect(question?.prompt).toBe('What is empathy?');
    expect(question?.options?.length).toBe(2);
    const correct = question?.options?.find((option) => option.correct);
    expect(correct?.text).toBe('Understanding others');
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

    const normalized = normalizeLessonForImport(lesson, { moduleIndex: 0, lessonIndex: 0 });
    expect(Array.isArray(normalized.content?.branchingElements)).toBe(true);
    const [element] = normalized.content?.branchingElements ?? [];
    expect(element?.prompt).toBe('Choose the branch');
    expect(element?.options?.map((option) => option.nextNodeId)).toEqual(['node-2', 'node-3']);
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
    const questions = deriveQuizQuestions(lesson);
    expect(questions.length).toBe(1);
    expect(questions[0]?.prompt).toBe('Direct prompt');
    expect(questions[0]?.options?.some((option) => option.correct)).toBe(true);
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
    const elements = deriveBranchingElements(lesson);
    expect(elements.length).toBe(1);
    expect(elements[0]?.options?.map((option) => option.nextNodeId)).toEqual(['next-1', 'next-2']);
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
});
