import { afterAll, describe, expect, it } from 'vitest';
import { startTestServer, stopTestServer, TestServerHandle } from './utils/server.ts';

const withEnv = async (
  envPatch: Record<string, string | undefined>,
  run: (server: TestServerHandle) => Promise<void>,
) => {
  const previous = new Map<string, string | undefined>();
  Object.entries(envPatch).forEach(([key, value]) => {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  let server: TestServerHandle | null = null;
  try {
    server = await startTestServer({ idempotencyFallback: true });
    await run(server);
  } finally {
    await stopTestServer(server);
    Object.entries(envPatch).forEach(([key]) => {
      const prior = previous.get(key);
      if (prior === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prior;
      }
    });
  }
};

describe('Health signal mapping', () => {
  afterAll(() => {
    delete process.env.OFFLINE_QUEUE_BACKLOG;
    delete process.env.OFFLINE_QUEUE_WARN_AT;
  });

  it('returns deterministic healthSignal fields for alert mapping', async () => {
    await withEnv(
      {
        OFFLINE_QUEUE_BACKLOG: '0',
        OFFLINE_QUEUE_WARN_AT: '50',
      },
      async (server) => {
        const res = await server.fetch('/api/health');
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body).toHaveProperty('healthSignal');
        expect(body.healthSignal).toHaveProperty('probeStatus');
        expect(body.healthSignal).toHaveProperty('effectiveStatus');
        expect(body.healthSignal).toHaveProperty('alertLevel');
        expect(Array.isArray(body.healthSignal.reasons)).toBe(true);
        expect(Array.isArray(body.healthSignal.checks)).toBe(true);

        const validAlertLevels = new Set(['info', 'warning', 'critical']);
        expect(validAlertLevels.has(body.healthSignal.alertLevel)).toBe(true);
      },
    );
  });

  it('maps offline queue degradation to warning alert signal in test mode', async () => {
    await withEnv(
      {
        OFFLINE_QUEUE_BACKLOG: '200',
        OFFLINE_QUEUE_WARN_AT: '50',
      },
      async (server) => {
        const res = await server.fetch('/api/health');
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.offlineQueue?.status).toBe('degraded');
        expect(body.healthSignal?.alertLevel).toBe('warning');
        expect(Array.isArray(body.healthSignal?.reasons)).toBe(true);
        expect(body.healthSignal.reasons).toContain('offlineQueue:degraded');
      },
    );
  });
});
