const randomSuffix = () => {
  const runtimeCrypto = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>).crypto : undefined;
  if (runtimeCrypto && typeof (runtimeCrypto as { randomUUID?: () => string }).randomUUID === 'function') {
    return (runtimeCrypto as { randomUUID: () => string }).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export type IdempotentAction =
  | 'course.save'
  | 'course.publish'
  | 'course.assign'
  | 'course.auto-save'
  | 'course.template'
  | 'generic';

const ACTION_PREFIX: Record<IdempotentAction, string> = {
  'course.save': 'course-save',
  'course.publish': 'course-publish',
  'course.assign': 'course-assign',
  'course.auto-save': 'course-autosave',
  'course.template': 'course-template',
  generic: 'idempotent',
};

const buildSuffixFromParts = (parts: Record<string, string | number | null | undefined>): string => {
  const segment = Object.entries(parts)
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.trim().length > 0)
    .map(([key, value]) => `${key}:${String(value).trim().replace(/\s+/g, '-')}`)
    .join('.');
  return segment;
};

export interface IdempotencyParts {
  courseId?: string;
  orgId?: string;
  userId?: string;
  attempt?: number | string;
  [key: string]: string | number | undefined;
}

export const buildIdempotencyKey = (action: IdempotentAction, parts: IdempotencyParts = {}): string => {
  const prefix = ACTION_PREFIX[action] ?? ACTION_PREFIX.generic;
  const suffix = buildSuffixFromParts(parts);
  const random = randomSuffix();
  return suffix ? `${prefix}_${suffix}_${random}` : `${prefix}_${random}`;
};

export const buildClientRequestId = (action: IdempotentAction, parts: IdempotencyParts = {}): string => {
  const prefix = `${ACTION_PREFIX[action] ?? ACTION_PREFIX.generic}-client`;
  const suffix = buildSuffixFromParts(parts);
  const random = randomSuffix();
  return suffix ? `${prefix}_${suffix}_${random}` : `${prefix}_${random}`;
};

export const createActionIdentifiers = (
  action: IdempotentAction,
  parts: IdempotencyParts = {},
): { idempotencyKey: string; clientRequestId: string } => ({
  idempotencyKey: buildIdempotencyKey(action, parts),
  clientRequestId: buildClientRequestId(action, parts),
});
