import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../../utils/apiClient';

const buildResponse = (data: any, status = 200, headers: Record<string, string> = { 'content-type': 'application/json' }) => {
  return new Response(JSON.stringify(data), { status, headers });
};

describe('apiClient key transform', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('transforms response keys to camelCase by default', async () => {
    const payload = { data: { course_id: '1', meta_json: { foo_bar: 1 } } };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(buildResponse(payload));

    const result = await apiRequest<any>('/test');
    expect(result.data.courseId).toBe('1');
    // nested keys also transform except *_json
    expect(result.data.meta_json).toBeDefined();
    expect(result.data.meta_json.foo_bar).toBe(1);
  });

  it('respects noTransform flag for responses', async () => {
    const payload = { data: { course_id: '1', meta_json: { foo_bar: 1 } } };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(buildResponse(payload));

    const result = await apiRequest<any>('/test', { noTransform: true });
    expect(result.data.course_id).toBe('1');
    expect(result.data.meta_json.foo_bar).toBe(1);
  });

  it('transforms outgoing body to snake_case by default', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(buildResponse({ ok: true }));
    const body = { courseId: 'A', orderIndex: 2, content: { type: 'video', body: { helloWorld: true } } };
    await apiRequest('/out', { method: 'POST', body: JSON.stringify(body) });

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][1] as RequestInit;
    const sent = JSON.parse(String(arg.body));
    expect(sent.course_id).toBe('A');
    expect(sent.order_index).toBe(2);
    // content.body keys are preserved (skip transform for *_json/body)
    expect(sent.content.body.helloWorld).toBe(true);
  });
});
