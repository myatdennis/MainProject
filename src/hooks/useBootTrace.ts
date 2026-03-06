import { useCallback, useMemo, useState } from 'react';

export type BootStepStatus = 'running' | 'ok' | 'error' | 'timeout';

export type BootStepError = {
  status?: number | null;
  code?: string | null;
  message?: string | null;
  hint?: string | null;
};

export type BootStep = {
  id: string;
  name: string;
  startedAt: number;
  finishedAt: number | null;
  status: BootStepStatus;
  error: BootStepError | null;
};

const createStepId = (name: string) => `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useBootTrace = () => {
  const [steps, setSteps] = useState<BootStep[]>([]);

  const resetTrace = useCallback(() => {
    setSteps([]);
  }, []);

  const startStep = useCallback((name: string) => {
    const id = createStepId(name);
    setSteps((prev) => [
      ...prev,
      {
        id,
        name,
        startedAt: Date.now(),
        finishedAt: null,
        status: 'running',
        error: null,
      },
    ]);
    return id;
  }, []);

  const finishStep = useCallback((id: string, status: BootStepStatus, error: BootStepError | null = null) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== id) return step;
        // Preserve existing error info if step already marked as error.
        const existingError = step.error;
        const nextError = status === 'error' ? error ?? existingError : existingError ?? null;
        return {
          ...step,
          status:
            status === 'error'
              ? 'error'
              : status === 'timeout'
                ? 'timeout'
                : step.status === 'error'
                  ? 'error'
                  : step.status === 'timeout'
                    ? 'timeout'
                    : status,
          finishedAt: Date.now(),
          error: nextError,
        };
      }),
    );
  }, []);

  const markStepSuccess = useCallback(
    (id: string) => {
      setSteps((prev) =>
        prev.map((step) => {
          if (step.id !== id) return step;
          if (step.status === 'error' || step.status === 'timeout') {
            return step;
          }
          return {
            ...step,
            status: 'ok',
            finishedAt: Date.now(),
            error: null,
          };
        }),
      );
    },
    [],
  );

  const markStepError = useCallback((id: string, error: BootStepError) => {
    finishStep(id, 'error', error);
  }, [finishStep]);

  const runningStep = useMemo(() => steps.find((step) => step.status === 'running') ?? null, [steps]);
  const lastErrorStep = useMemo(() => {
    const reversed = [...steps].reverse();
    return reversed.find((step) => step.status === 'error') ?? null;
  }, [steps]);

  return {
    steps,
    resetTrace,
    startStep,
    markStepSuccess,
    markStepError,
    finishStep,
    runningStep,
    lastErrorStep,
  };
};

export const mapErrorToBootMeta = (error: unknown): BootStepError => {
  if (!error || typeof error !== 'object') {
    return {
      status: null,
      code: null,
      message: typeof error === 'string' ? error : null,
      hint: null,
    };
  }
  const anyError = error as Record<string, any>;
  const extract = (key: string) => {
    if (typeof anyError[key] === 'string' || typeof anyError[key] === 'number') {
      return anyError[key];
    }
    if (anyError.body && (typeof anyError.body[key] === 'string' || typeof anyError.body[key] === 'number')) {
      return anyError.body[key];
    }
    return null;
  };

  return {
    status: typeof extract('status') === 'number' ? (extract('status') as number) : anyError.status ?? null,
    code: (extract('code') as string | null) ?? null,
    message: (extract('message') as string | null) ?? anyError.message ?? null,
    hint: (extract('hint') as string | null) ?? null,
  };
};
