import { test, expect, request } from '@playwright/test';

// Basic E2E to verify progress batch endpoint accepts events in demo mode

test.describe('Progress Batch Endpoint', () => {
  test('accepts a single lesson_progress event', async () => {
    const apiContext = await request.newContext({
      baseURL: 'http://127.0.0.1:8888',
      extraHTTPHeaders: {
        'x-e2e-bypass': 'true',
        'x-user-role': 'learner',
        'x-org-id': 'demo-sandbox-org',
      },
    });

    const res = await apiContext.post('/api/client/progress/batch', {
      data: {
        events: [
          {
            type: 'lesson_progress',
            userId: 'demo-user',
            courseId: 'foundations',
            lessonId: 'lesson-video',
            percent: 25,
            position: 120,
            clientEventId: 'e2e-batch-1',
            timestamp: Date.now()
          }
        ]
      }
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.accepted).toContain('e2e-batch-1');
  });
});
