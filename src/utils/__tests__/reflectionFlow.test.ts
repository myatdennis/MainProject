import { describe, it, expect } from 'vitest';
import { normalizeGuidedReflectionConfig, normalizeReflectionResponseData } from '../reflectionFlow';

describe('reflectionFlow utilities', () => {
  it('normalizes guided reflection lesson content', () => {
    const config = normalizeGuidedReflectionConfig({
      prompt: 'What stood out?',
      deepen_prompts: ['One', 'Two', 'Three', 'Four'],
      action_prompt: 'What next?',
    } as any);

    expect(config.prompt).toBe('What stood out?');
    expect(config.deepenPrompts).toEqual(['One', 'Two', 'Three']);
    expect(config.actionPrompt).toBe('What next?');
  });

  it('normalizes structured response data safely', () => {
    const data = normalizeReflectionResponseData({
      promptResponse: 'Prompt',
      deeper_reflection_1: 'Depth 1',
      action_commitment: 'Act',
    });

    expect(data).toEqual({
      promptResponse: 'Prompt',
      deeperReflection1: 'Depth 1',
      deeperReflection2: '',
      deeperReflection3: '',
      actionCommitment: 'Act',
      currentStepId: 'intro',
      submittedAt: null,
    });
  });
});
