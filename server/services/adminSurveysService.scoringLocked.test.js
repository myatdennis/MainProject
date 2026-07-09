import { describe, it, expect } from 'vitest';
import { validateScoringLockedQuestions } from './adminSurveysService.js';

const lockedQuestion = (overrides = {}) => ({
  id: 'q1',
  title: 'I seek out feedback from people who challenge my thinking.',
  type: 'likert-scale',
  metadata: { scoringLocked: true, stageKey: 'acceptance' },
  ...overrides,
});

const surveyWith = (question) => ({
  sections: [{ id: 'section-1', questions: [question] }],
});

describe('validateScoringLockedQuestions', () => {
  it('allows wording (title/description) edits to a scoring-locked question', () => {
    const existing = surveyWith(lockedQuestion());
    const patch = surveyWith({ ...lockedQuestion(), title: 'I actively seek feedback from people who challenge my thinking.' });

    const result = validateScoringLockedQuestions(existing, patch);
    expect(result.ok).toBe(true);
  });

  it('rejects removing a scoring-locked question', () => {
    const existing = surveyWith(lockedQuestion());
    const patch = { sections: [{ id: 'section-1', questions: [] }] };

    const result = validateScoringLockedQuestions(existing, patch);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({ id: 'q1', reason: 'removed' });
  });

  it('rejects changing the type of a scoring-locked question', () => {
    const existing = surveyWith(lockedQuestion());
    const patch = surveyWith({ ...lockedQuestion(), type: 'open-ended' });

    const result = validateScoringLockedQuestions(existing, patch);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({ id: 'q1', reason: 'type_changed' });
  });

  it('rejects reassigning the stage of a scoring-locked question', () => {
    const existing = surveyWith(lockedQuestion());
    const patch = surveyWith({ ...lockedQuestion(), metadata: { scoringLocked: true, stageKey: 'avoidance' } });

    const result = validateScoringLockedQuestions(existing, patch);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({ id: 'q1', reason: 'stage_changed' });
  });

  it('allows any change to questions that are not scoring-locked', () => {
    const existing = surveyWith({ id: 'q2', title: 'Unlocked', type: 'likert-scale', metadata: {} });
    const patch = { sections: [{ id: 'section-1', questions: [] }] };

    const result = validateScoringLockedQuestions(existing, patch);
    expect(result.ok).toBe(true);
  });
});
