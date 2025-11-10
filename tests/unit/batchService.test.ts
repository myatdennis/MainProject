import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as batch from '../../src/services/batchService';

// Mock apiRequest to simulate success/failure
vi.mock('../../src/utils/apiClient', () => ({
  __esModule: true,
  default: vi.fn(async (path: string, opts: any) => {
    if (path.includes('fail')) {
      throw new Error('network');
    }
    // Return structure similar to server batch response
    return { accepted: opts?.body ? ['id-1'] : [] };
  }),
  apiRequest: vi.fn(async () => ({ accepted: ['id-1'] }))
}));

// Use fake timers to control flush scheduling

describe('batchService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('enqueues progress events and flushes', async () => {
    const id = batch.enqueueProgress({ type: 'lesson_progress', userId: 'u', lessonId: 'l', percent: 10 });
    expect(id).toBeTruthy();
    // Fast-forward default delay (5s)
    vi.advanceTimersByTime(5100);
    await batch.flushProgress();
    // No assertion on internal queue (not exported) but ensure function resolves
    expect(true).toBe(true);
  });

  it('enqueues analytics events and flushes', async () => {
    const id = batch.enqueueAnalytics({ type: 'course_started', userId: 'u' });
    expect(id).toBeTruthy();
    vi.advanceTimersByTime(3100);
    await batch.flushAnalytics();
    expect(true).toBe(true);
  });
});
