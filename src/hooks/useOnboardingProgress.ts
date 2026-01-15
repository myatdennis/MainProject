import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDefaultOnboardingProgress,
  getStepOrder,
  ONBOARDING_STEPS,
  OnboardingStepDefinition,
  OnboardingStepId,
  OnboardingStepStatus,
} from '../../shared/onboarding/statuses';
import { getOnboardingProgress } from '../dal/onboarding';

export interface ActivationStepProgress extends OnboardingStepDefinition {
  status: OnboardingStepStatus;
  completedAt?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, any>;
}

export interface ProgressSummary {
  orgId: string;
  orgName: string;
  totalSteps: number;
  completedSteps: number;
  pendingInvites: number;
  acceptedInvites: number;
  staleInvites: number;
  lastSentAt?: string | null;
  orgCreatedAt?: string | null;
  firstLoginAt?: string | null;
}

export interface UseOnboardingProgressOptions {
  pollIntervalMs?: number;
  autoStart?: boolean;
}

interface ProgressPayload {
  summary: ProgressSummary | null;
  steps: ActivationStepProgress[];
  invites: any[];
}

const buildInitialState = (): ProgressPayload => ({
  summary: null,
  steps: getDefaultOnboardingProgress().steps as ActivationStepProgress[],
  invites: [],
});

export const useOnboardingProgress = (orgId?: string, options: UseOnboardingProgressOptions = {}) => {
  const [state, setState] = useState<ProgressPayload>(() => buildInitialState());
  const [loading, setLoading] = useState<boolean>(Boolean(orgId && options.autoStart !== false));
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mapSteps = useCallback((rawSteps: any[] = []): ActivationStepProgress[] => {
    const stepMap = new Map<OnboardingStepId, any>();
    rawSteps.forEach((step) => {
      const key = (step.step as OnboardingStepId) ?? (step.id as OnboardingStepId);
      if (key) {
        stepMap.set(key, step);
      }
    });

    return ONBOARDING_STEPS.map((definition) => {
      const record = stepMap.get(definition.id);
      return {
        ...definition,
        status: (record?.status as OnboardingStepStatus) ?? (definition.autoComplete ? 'completed' : 'pending'),
        completedAt: record?.completedAt ?? record?.completed_at ?? null,
        actorEmail: record?.actorEmail ?? record?.actor_email ?? null,
        metadata: record?.metadata ?? {},
      };
    }).sort((a, b) => getStepOrder(a.id) - getStepOrder(b.id));
  }, []);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getOnboardingProgress(orgId);
      const payload = response?.data;
      if (!payload) {
        setState(buildInitialState());
        return;
      }
      setState({
        summary: payload.summary ?? null,
        steps: mapSteps(payload.steps || []),
        invites: payload.invites || [],
      });
    } catch (err: any) {
      console.error('[useOnboardingProgress] Failed to load progress', err);
      setError(err?.message || 'Unable to fetch onboarding progress');
    } finally {
      setLoading(false);
    }
  }, [mapSteps, orgId]);

  useEffect(() => {
    if (!orgId || options.autoStart === false) {
      setLoading(false);
      return;
    }
    refresh();
  }, [options.autoStart, orgId, refresh]);

  useEffect(() => {
    if (!orgId || !options.pollIntervalMs) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => {
      refresh();
    }, options.pollIntervalMs);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [options.pollIntervalMs, orgId, refresh]);

  const completionPercent = useMemo(() => {
    if (!state.steps.length) return 0;
    const completed = state.steps.filter((step) => step.status === 'completed').length;
    return Math.round((completed / state.steps.length) * 100);
  }, [state.steps]);

  const frictionAlerts = useMemo(() => {
    const alerts: Array<{ id: string; message: string }> = [];
    const summary = state.summary;
    if (summary) {
      if (summary.pendingInvites >= 5 && summary.staleInvites > 0) {
        alerts.push({ id: 'stale_invites', message: `${summary.staleInvites} invites stale for 7+ days` });
      }
      if (summary.completedSteps <= 2 && summary.pendingInvites === 0) {
        alerts.push({ id: 'no_invites', message: 'No invites sent yet. Encourage the client to invite their team.' });
      }
    }
    return alerts;
  }, [state.summary]);

  return {
    loading,
    error,
    summary: state.summary,
    steps: state.steps,
    invites: state.invites,
    completionPercent,
    frictionAlerts,
    refresh,
  };
};

export default useOnboardingProgress;
