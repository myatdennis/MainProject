import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuidedReflectionFlow from '../GuidedReflectionFlow';

const mockFetchLearnerReflection = vi.hoisted(() => vi.fn());
const mockSaveLearnerReflection = vi.hoisted(() => vi.fn());

vi.mock('../../../dal/reflections', () => ({
  reflectionService: {
    fetchLearnerReflection: (...args: any[]) => mockFetchLearnerReflection(...args),
    saveLearnerReflection: (...args: any[]) => mockSaveLearnerReflection(...args),
  },
}));

describe('GuidedReflectionFlow', () => {
  beforeEach(() => {
    mockFetchLearnerReflection.mockReset();
    mockSaveLearnerReflection.mockReset();
    mockFetchLearnerReflection.mockResolvedValue(null);
    mockSaveLearnerReflection.mockResolvedValue({
      id: 'reflection-1',
      organizationId: 'org-1',
      courseId: 'course-1',
      lessonId: 'lesson-1',
      userId: 'local-user',
      responseText: 'Saved',
      responseData: {
        promptResponse: 'Saved',
        deeperReflection1: '',
        deeperReflection2: '',
        deeperReflection3: '',
        actionCommitment: '',
        currentStepId: 'initial',
        submittedAt: null,
      },
      status: 'draft',
      createdAt: '2026-04-08T12:00:00.000Z',
      updatedAt: '2026-04-08T12:01:00.000Z',
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderFlow = () =>
    render(
      <GuidedReflectionFlow
        courseId="course-1"
        learnerId="local-user"
        lessonId="lesson-1"
        lessonTitle="Reflection Lesson"
        lessonContent={{
          prompt: 'What stood out to you most?',
          introText: 'Settle in for a guided reflection.',
          deepenPrompts: ['What shaped this perspective?', 'Where have you seen this before?'],
          actionPrompt: 'What is one action you can take next?',
          confirmationMessage: 'Reflection saved and ready for review.',
        }}
        required={true}
        onComplete={vi.fn()}
      />,
    );

  it('completes the full guided reflection flow', async () => {
    const user = userEvent.setup();
    renderFlow();

    expect(await screen.findByRole('button', { name: /begin reflection/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /begin reflection/i }));
    await user.click(await screen.findByRole('button', { name: /take a moment to think/i }));

    await user.type(await screen.findByPlaceholderText('Write your initial thoughts here…'), 'Initial reflection');
    await waitFor(() => expect(mockSaveLearnerReflection).toHaveBeenCalledTimes(1), { timeout: 2500 });

    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(await screen.findByPlaceholderText('Write a deeper reflection here…'), 'Depth one');
    await waitFor(() => expect(mockSaveLearnerReflection).toHaveBeenCalledTimes(2), { timeout: 2500 });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(await screen.findByPlaceholderText('Write a deeper reflection here…'), 'Depth two');
    await waitFor(() => expect(mockSaveLearnerReflection).toHaveBeenCalledTimes(3), { timeout: 2500 });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(await screen.findByPlaceholderText('Describe one action you can take moving forward…'), 'One action');
    await waitFor(() => expect(mockSaveLearnerReflection).toHaveBeenCalledTimes(4), { timeout: 2500 });
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText('Review & Submit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /submit reflection/i }));

    expect((await screen.findAllByText('Reflection Saved')).length).toBeGreaterThan(0);
    expect(screen.getByText('Reflection saved and ready for review.')).toBeInTheDocument();
  }, 15000);

  it('restores a saved draft and preserves step navigation state', async () => {
    window.localStorage.setItem(
      'reflection-draft:course-1:lesson-1:local-user',
      JSON.stringify({
        data: {
          promptResponse: 'Recovered draft',
          deeperReflection1: '',
          deeperReflection2: '',
          deeperReflection3: '',
          actionCommitment: '',
          currentStepId: 'initial',
          submittedAt: null,
        },
        currentStepId: 'initial',
        updatedAt: '2026-04-08T12:10:00.000Z',
        status: 'draft',
      }),
    );

    const user = userEvent.setup();
    renderFlow();

    expect(await screen.findByDisplayValue('Recovered draft')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(await screen.findByRole('button', { name: /back/i }));
    expect(await screen.findByDisplayValue('Recovered draft')).toBeInTheDocument();
  }, 10000);

  it('does not overlap autosave requests when a prior save is in flight', async () => {
    let resolveFirstSave: (() => void) | null = null;
    mockSaveLearnerReflection
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstSave = () =>
              resolve({
                id: 'reflection-1',
                organizationId: 'org-1',
                courseId: 'course-1',
                lessonId: 'lesson-1',
                userId: 'local-user',
                responseText: 'Initial reflection',
                responseData: {
                  promptResponse: 'Initial reflection',
                  deeperReflection1: '',
                  deeperReflection2: '',
                  deeperReflection3: '',
                  actionCommitment: '',
                  currentStepId: 'initial',
                  submittedAt: null,
                },
                status: 'draft',
                createdAt: '2026-04-08T12:00:00.000Z',
                updatedAt: '2026-04-08T12:01:00.000Z',
              });
          }),
      )
      .mockResolvedValue({
        id: 'reflection-1',
        organizationId: 'org-1',
        courseId: 'course-1',
        lessonId: 'lesson-1',
        userId: 'local-user',
        responseText: 'Initial reflection updated',
        responseData: {
          promptResponse: 'Initial reflection updated',
          deeperReflection1: '',
          deeperReflection2: '',
          deeperReflection3: '',
          actionCommitment: '',
          currentStepId: 'initial',
          submittedAt: null,
        },
        status: 'draft',
        createdAt: '2026-04-08T12:00:00.000Z',
        updatedAt: '2026-04-08T12:02:00.000Z',
      });

    const user = userEvent.setup();
    renderFlow();

    expect(await screen.findByRole('button', { name: /begin reflection/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /begin reflection/i }));
    await user.click(await screen.findByRole('button', { name: /take a moment to think/i }));

    const input = await screen.findByPlaceholderText('Write your initial thoughts here…');
    await user.type(input, 'Initial reflection');
    await waitFor(() => expect(mockSaveLearnerReflection).toHaveBeenCalledTimes(1), { timeout: 2500 });

    await user.type(input, ' updated');
    await new Promise((resolve) => window.setTimeout(resolve, 1300));
    expect(mockSaveLearnerReflection).toHaveBeenCalledTimes(1);

    resolveFirstSave?.();
    await waitFor(() => expect(mockSaveLearnerReflection).toHaveBeenCalledTimes(2), { timeout: 2500 });
  }, 15000);

  it('does not signal completion when submit fails', async () => {
    const onComplete = vi.fn();
    mockSaveLearnerReflection
      .mockResolvedValueOnce({
        id: 'reflection-1',
        organizationId: 'org-1',
        courseId: 'course-1',
        lessonId: 'lesson-1',
        userId: 'local-user',
        responseText: 'Initial reflection',
        responseData: {
          promptResponse: 'Initial reflection',
          deeperReflection1: '',
          deeperReflection2: '',
          deeperReflection3: '',
          actionCommitment: '',
          currentStepId: 'initial',
          submittedAt: null,
        },
        status: 'draft',
        createdAt: '2026-04-08T12:00:00.000Z',
        updatedAt: '2026-04-08T12:01:00.000Z',
      })
      .mockRejectedValueOnce(new Error('submit failed'));

    const user = userEvent.setup();
    render(
      <GuidedReflectionFlow
        courseId="course-1"
        learnerId="local-user"
        lessonId="lesson-1"
        lessonTitle="Reflection Lesson"
        lessonContent={{
          prompt: 'What stood out to you most?',
          deepenPrompts: ['What shaped this perspective?'],
        }}
        required={true}
        onComplete={onComplete}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /begin reflection/i }));
    await user.click(await screen.findByRole('button', { name: /take a moment to think/i }));
    await user.type(await screen.findByPlaceholderText('Write your initial thoughts here…'), 'Initial reflection');
    await waitFor(() => expect(mockSaveLearnerReflection).toHaveBeenCalledTimes(1), { timeout: 2500 });
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /submit reflection/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed. Your draft is still safe on this device.');
    expect(onComplete).not.toHaveBeenCalled();
  }, 12000);
});
