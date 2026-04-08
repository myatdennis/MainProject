import { describe, it, expect } from 'vitest';
import { buildReflectionSections } from '../reflectionPresentation';

describe('buildReflectionSections', () => {
  it('returns structured sections for multi-step reflections', () => {
    const sections = buildReflectionSections({
      responseText: '',
      responseData: {
        promptResponse: 'Initial thought',
        deeperReflection1: 'Depth one',
        deeperReflection2: '',
        deeperReflection3: 'Depth three',
        actionCommitment: 'Take one action',
        currentStepId: 'review',
        submittedAt: null,
      },
    });

    expect(sections).toEqual([
      { label: 'Prompt Response', value: 'Initial thought' },
      { label: 'Deeper Reflection 1', value: 'Depth one' },
      { label: 'Deeper Reflection 3', value: 'Depth three' },
      { label: 'Action Commitment', value: 'Take one action' },
    ]);
  });
});
