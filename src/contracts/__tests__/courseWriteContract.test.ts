import { describe, expect, it } from 'vitest';
import {
  publishRequestBodySchema,
  toCourseWriteMeta,
  upsertRequestBodySchema,
} from '../courseWriteContract';

describe('courseWriteContract', () => {
  it('accepts valid publish payload', () => {
    const parsed = publishRequestBodySchema.parse({
      version: 3,
      idempotency_key: 'course.publish:abc-12345',
      action: 'course.publish',
    });

    expect(parsed.version).toBe(3);
    expect(parsed.action).toBe('course.publish');
  });

  it('rejects invalid idempotency key characters', () => {
    expect(() =>
      publishRequestBodySchema.parse({
        version: 1,
        idempotency_key: 'bad key with spaces',
      }),
    ).toThrow();
  });

  it('rejects non-publish action for publish payload', () => {
    expect(() =>
      publishRequestBodySchema.parse({
        version: 1,
        idempotency_key: 'course.publish:abc-12345',
        action: 'course.save',
      }),
    ).toThrow();
  });

  it('normalizes write metadata action safely', () => {
    const meta = toCourseWriteMeta({
      idempotencyKey: 'course.save:meta-123456',
      clientEventId: 'evt-12345678',
      action: 'course.save',
    });
    expect(meta.action).toBe('course.save');
    expect(meta.idempotencyKey).toContain('course.save');
  });

  it('accepts upsert envelope with course + modules', () => {
    const parsed = upsertRequestBodySchema.parse({
      course: { id: 'course-1', title: 'Contract test course' },
      modules: [],
      idempotency_key: 'course.save:test-123456',
    });

    expect(parsed.course).toBeTruthy();
    expect(Array.isArray(parsed.modules)).toBe(true);
  });

  it('rejects publish action for upsert envelope', () => {
    expect(() =>
      upsertRequestBodySchema.parse({
        course: { id: 'course-1', title: 'Contract test course' },
        modules: [],
        idempotency_key: 'course.save:test-123456',
        action: 'course.publish',
      }),
    ).toThrow();
  });
});
