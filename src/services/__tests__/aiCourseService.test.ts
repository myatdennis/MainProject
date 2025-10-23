import { describe, it, expect } from 'vitest';
import { AICourseService } from '../aiCourseService';

describe('AICourseService', () => {
  it('caches generated course outlines for repeated prompts', async () => {
    const service = new AICourseService();
    const first = await service.generateCourseOutline({ topic: 'Inclusive Leadership', audience: 'admin' });
    const second = await service.generateCourseOutline({ topic: 'Inclusive Leadership', audience: 'admin' });

    expect(first.metadata.source).toBe('generated');
    expect(second.metadata.source).toBe('cache');
    expect(second.message).toBe(first.message);
  });

  it('enforces rate limiting for conversational replies', async () => {
    const service = new AICourseService();

    await Promise.all(
      Array.from({ length: 6 }).map((_, index) =>
        service.getAssistantReply({ prompt: `Progress check ${index}`, route: 'admin' })
      )
    );

    await expect(
      service.getAssistantReply({ prompt: 'Seventh request should fail', route: 'admin' })
    ).rejects.toThrow(/slow down/i);
  });
});
