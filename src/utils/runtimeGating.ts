import type { RuntimeStatus } from '../state/runtimeStatus';

export type RuntimeAction = 'course.save' | 'course.auto-save' | 'course.publish' | 'course.assign';

export type GateMode = 'remote' | 'local-only' | 'queue' | 'blocked';

export interface RuntimeGateResult {
  mode: GateMode;
  reason?: string;
  detail?: string;
  tone: 'warning' | 'danger';
  offline: boolean;
}

const isOffline = () => (typeof navigator !== 'undefined' ? navigator.onLine === false : false);

const DEFAULT_RESULT: RuntimeGateResult = {
  mode: 'remote',
  tone: 'warning',
  offline: false,
};

export const evaluateRuntimeGate = (
  action: RuntimeAction,
  status: RuntimeStatus,
): RuntimeGateResult => {
  const offline = isOffline();
  const supabaseDown = status.supabaseConfigured && !status.supabaseHealthy;
  const apiDown = !status.apiHealthy;
  const demoMode = status.demoModeEnabled && !status.supabaseHealthy;

  const base: RuntimeGateResult = {
    ...DEFAULT_RESULT,
    offline,
  };

  if (action === 'course.publish') {
    if (offline || supabaseDown || apiDown || demoMode) {
      return {
        ...base,
        mode: 'blocked',
        tone: 'danger',
        reason: offline
          ? 'You are offline. Publishing requires a live Supabase connection.'
          : 'Supabase is unavailable, so publish requests are paused.',
        detail: 'Run Sync Diagnostics or retry once runtime health returns to OK.',
      };
    }
    return base;
  }

  if (action === 'course.assign') {
    if (offline || supabaseDown || apiDown || demoMode) {
      return {
        ...base,
        mode: 'queue',
        tone: 'warning',
        reason: offline || supabaseDown
          ? 'Assignments will queue locally until Huddle reconnects.'
          : 'Runtime health is degraded; assignments will send once services recover.',
      };
    }
    return base;
  }

  // Save + autosave degrade to local persistence when runtime is unhealthy
  if (offline || supabaseDown || demoMode) {
    return {
      ...base,
      mode: 'local-only',
      tone: 'warning',
      reason: offline
        ? 'Huddle is offline, so drafts stay local until you reconnect.'
        : 'Supabase is degraded. Drafts sync locally and will retry once services recover.',
    };
  }

  return base;
};
