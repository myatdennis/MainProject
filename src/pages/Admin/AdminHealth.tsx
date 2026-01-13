import { useCallback, useMemo, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity } from 'lucide-react';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import apiRequest from '../../utils/apiClient';

interface HealthCheckDefinition {
  id: HealthCheckKey;
  label: string;
  description: string;
  path: string;
  method?: 'GET' | 'POST';
  interpret: (data: unknown) => { status: HealthStatus; message: string };
}

type HealthCheckKey = 'api' | 'auth' | 'supabase';
type HealthStatus = 'pending' | 'ok' | 'warn' | 'error';

interface HealthCheckState {
  status: HealthStatus;
  message: string;
  lastChecked?: string;
  durationMs?: number;
  details?: unknown;
}

const formatMs = (value?: number) => {
  if (typeof value !== 'number') return '';
  if (value < 1000) return `${value.toFixed(0)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
};

const formatTimestamp = (value?: string) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const checks: HealthCheckDefinition[] = [
  {
    id: 'api',
    label: 'API Core',
    description: 'Express heartbeat via /api/health',
    path: '/api/health',
    interpret: (payload: any) => {
      if (payload?.status === 'ok') {
        const uptimeSeconds = typeof payload?.uptime === 'number' ? payload.uptime : undefined;
        const humanUptime = uptimeSeconds ? `${Math.round(uptimeSeconds / 60)} min uptime` : 'Responded OK';
        return { status: 'ok', message: humanUptime };
      }
      return { status: 'warn', message: 'Unexpected payload structure' };
    },
  },
  {
    id: 'auth',
    label: 'Auth & Session',
    description: 'Requires an active admin session (/api/auth/verify)',
    path: '/api/auth/verify',
    interpret: (payload: any) => {
      if (payload?.valid) {
        const user = payload.user;
        const name = user?.email || user?.id || 'authenticated';
        return { status: 'ok', message: `Verified as ${name}` };
      }
      return { status: 'warn', message: 'Received unexpected auth response' };
    },
  },
  {
    id: 'supabase',
    label: 'Supabase Connectivity',
    description: 'Server to Supabase (courses table) via /api/admin/courses/health/supabase',
    path: '/api/admin/courses/health/supabase',
    interpret: (payload: any) => {
      if (payload?.connected) {
        return { status: 'ok', message: 'Course table reachable' };
      }
      if (payload?.error) {
        return { status: 'error', message: payload.error };
      }
      return { status: 'warn', message: 'Connection degraded' };
    },
  },
];

const statusMeta: Record<HealthStatus, { label: string; badge: 'info' | 'positive' | 'attention' | 'danger' }> = {
  pending: { label: 'Waiting', badge: 'info' },
  ok: { label: 'Healthy', badge: 'positive' },
  warn: { label: 'Investigate', badge: 'attention' },
  error: { label: 'Down', badge: 'danger' },
};

const statusIcon: Record<HealthStatus, typeof CheckCircle2> = {
  pending: Activity,
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
};

const AdminHealth = () => {
  const [results, setResults] = useState<Record<HealthCheckKey, HealthCheckState>>({
    api: { status: 'pending', message: 'Not checked yet' },
    auth: { status: 'pending', message: 'Not checked yet' },
    supabase: { status: 'pending', message: 'Not checked yet' },
  });
  const [running, setRunning] = useState(false);

  const runCheck = useCallback(async (check: HealthCheckDefinition) => {
    const startedAt = performance.now();
    try {
      const response = await apiRequest(check.path, {
        method: check.method ?? 'GET',
        allowAnonymous: check.id === 'api',
        requireAuth: check.id !== 'api',
      });
      const interpretation = check.interpret(response);
      setResults((prev) => ({
        ...prev,
        [check.id]: {
          status: interpretation.status,
          message: interpretation.message,
          details: response,
          durationMs: performance.now() - startedAt,
          lastChecked: new Date().toISOString(),
        },
      }));
    } catch (error: any) {
      const message = error?.message || 'Request failed';
      setResults((prev) => ({
        ...prev,
        [check.id]: {
          status: 'error',
          message,
          details: error?.body ?? null,
          durationMs: performance.now() - startedAt,
          lastChecked: new Date().toISOString(),
        },
      }));
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    await Promise.all(checks.map(runCheck));
    setRunning(false);
  }, [runCheck]);

  const aggregateStatus = useMemo<HealthStatus>(() => {
    if (Object.values(results).some((item) => item.status === 'error')) return 'error';
    if (Object.values(results).some((item) => item.status === 'warn')) return 'warn';
    if (Object.values(results).some((item) => item.status === 'pending')) return 'pending';
    return 'ok';
  }, [results]);

  return (
    <>
      <SEO title="Platform Health" description="Live backend & Supabase diagnostics" />
      <div className="container-page section space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="info">Diagnostics</Badge>
            <h1 className="mt-3 font-heading text-3xl font-bold text-charcoal">Platform health status</h1>
            <p className="text-sm text-slate/80 max-w-2xl">
              Run these checks whenever you deploy or resume work. Everything runs against the currently authenticated session
              and mirrors what real admins see.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={runAll} disabled={running}>
              {running ? 'Running...' : 'Run all checks'}
            </Button>
          </div>
        </div>

  <Card tone={aggregateStatus === 'ok' ? 'gradient' : 'muted'} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate/70">Overall status</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-charcoal">{statusMeta[aggregateStatus].label}</h2>
            </div>
            <div className="w-full flex-1 min-w-[200px]">
              <ProgressBar
                value={aggregateStatus === 'ok' ? 100 : aggregateStatus === 'warn' ? 65 : aggregateStatus === 'pending' ? 35 : 5}
                tone={aggregateStatus === 'pending' ? 'info' : 'default'}
                srLabel="overall health"
              />
            </div>
          </div>
          <p className="text-sm text-slate/80">
            Last run: {formatTimestamp(Object.values(results).map((item) => item.lastChecked).filter(Boolean).sort().reverse()[0] as string) || 'never'}
          </p>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {checks.map((check) => {
            const current = results[check.id];
            const meta = statusMeta[current.status];
            const Icon = statusIcon[current.status];
            return (
              <Card key={check.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${current.status === 'ok' ? 'text-emerald-500' : current.status === 'warn' ? 'text-amber-500' : current.status === 'error' ? 'text-rose-500' : 'text-slate/70'}`} />
                    <div>
                      <p className="font-heading text-base font-semibold text-charcoal">{check.label}</p>
                      <p className="text-xs text-slate/70">{check.description}</p>
                    </div>
                  </div>
                  <Badge tone={meta.badge}>{meta.label}</Badge>
                </div>
                <p className="text-sm text-slate/90">{current.message}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate/60">
                  <span>{formatTimestamp(current.lastChecked) || 'Not checked yet'}</span>
                  <span>{formatMs(current.durationMs)}</span>
                </div>
                <div className="rounded-xl bg-cloud px-3 py-2 text-xs text-slate/80">
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(current.details ?? null, null, 2)}</pre>
                </div>
                <Button variant="ghost" size="sm" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={() => runCheck(check)} disabled={running}>
                  Re-run check
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default AdminHealth;
