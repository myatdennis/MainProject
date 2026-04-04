import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import {
  startTestServer,
  stopTestServer,
  createAdminAuthHeaders,
  createMemberAuthHeaders,
  type TestServerHandle,
} from './utils/server.ts';

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
};

const summarize = (values: number[]) => ({
  count: values.length,
  minMs: values.length ? Number(Math.min(...values).toFixed(2)) : 0,
  p50Ms: percentile(values, 50),
  p95Ms: percentile(values, 95),
  p99Ms: percentile(values, 99),
  maxMs: values.length ? Number(Math.max(...values).toFixed(2)) : 0,
});

const withJson = (headers: Record<string, string>) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...headers,
});

describe('performance smoke', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  }, 120000);

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('measures core admin and learner API latency percentiles', async () => {
    const adminHeaders = withJson(await createAdminAuthHeaders());
    const learnerId = randomUUID();
    const learnerHeaders = withJson(await createMemberAuthHeaders({
      userId: learnerId,
      email: `perf+${learnerId}@example.com`,
    }));

    const slug = `perf-${randomUUID()}`;
    const moduleId = randomUUID();
    const lessonId = randomUUID();

    const createRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        course: { title: `Perf ${slug}`, slug, status: 'draft' },
        modules: [
          {
            id: moduleId,
            title: 'Perf Module',
            lessons: [
              {
                id: lessonId,
                title: 'Perf Lesson',
                type: 'text',
                content_json: {
                  type: 'text',
                  body: { blocks: [{ type: 'paragraph', data: { text: 'Perf' } }] },
                },
              },
            ],
          },
        ],
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const created = await createRes.json();
    const courseId = created?.data?.id;
    expect(courseId).toBeTruthy();

    const assignRes = await server!.fetch(`/api/admin/courses/${courseId}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        assignedTo: { userIds: [learnerId] },
        status: 'assigned',
      }),
    });
    expect(assignRes.status).toBe(200);

    const measure = async (label: string, task: () => Promise<void>, iterations = 10) => {
      const latencies: number[] = [];
      for (let i = 0; i < iterations; i += 1) {
        const started = performance.now();
        await task();
        latencies.push(Number((performance.now() - started).toFixed(2)));
      }
      return [label, summarize(latencies)] as const;
    };

    const results = Object.fromEntries([
      await measure('health', async () => {
        const res = await server!.fetch('/api/health');
        expect(res.status).toBeGreaterThanOrEqual(200);
        expect(res.status).toBeLessThan(300);
      }),
      await measure('adminMe', async () => {
        const res = await server!.fetch('/api/admin/me', { headers: adminHeaders });
        expect(res.status).toBe(200);
      }),
      await measure('adminCourses', async () => {
        const res = await server!.fetch('/api/admin/courses?includeStructure=true&includeLessons=true', {
          headers: adminHeaders,
        });
        expect(res.status).toBe(200);
      }),
      await measure('learnerAssignments', async () => {
        const res = await server!.fetch('/api/client/assignments?include_completed=true', {
          headers: learnerHeaders,
        });
        expect(res.status).toBe(200);
      }),
      await measure('learnerProgressRead', async () => {
        const res = await server!.fetch(
          `/api/learner/progress?lessonIds=${encodeURIComponent(lessonId)}&userId=${encodeURIComponent(learnerId)}`,
          { headers: learnerHeaders },
        );
        expect(res.status).toBe(200);
      }),
      await measure('publishUpdate', async () => {
        const res = await server!.fetch(`/api/admin/courses/${courseId}`, {
          method: 'PUT',
          headers: adminHeaders,
          body: JSON.stringify({
            course: { id: courseId, title: `Perf ${slug}`, slug, status: 'published' },
            modules: [
              {
                id: moduleId,
                title: 'Perf Module',
                lessons: [
                  {
                    id: lessonId,
                    title: 'Perf Lesson',
                    type: 'text',
                    content_json: {
                      type: 'text',
                      body: { blocks: [{ type: 'paragraph', data: { text: 'Perf updated' } }] },
                    },
                  },
                ],
              },
            ],
          }),
        });
        expect([200, 201]).toContain(res.status);
      }, 5),
    ]);

    expect(results.health.p95Ms).toBeLessThan(1500);
    expect(results.adminMe.p95Ms).toBeLessThan(1500);
    expect(results.adminCourses.p95Ms).toBeLessThan(2000);
    expect(results.learnerAssignments.p95Ms).toBeLessThan(1500);
    expect(results.learnerProgressRead.p95Ms).toBeLessThan(1500);
    expect(results.publishUpdate.p95Ms).toBeLessThan(2500);

    console.info('[performance.smoke]', JSON.stringify(results));
  }, 120000);
});
