import { describe, it, expect } from 'vitest';
import type { CourseAssignment } from '../../types/assignment';
import { __assignmentStorageInternals } from '../assignmentStorage';

describe('assignmentStorage pruning', () => {
  it('prunes oversized payloads down to fit the byte cap', () => {
    const { pruneRecordsToFit, bytesOf } = __assignmentStorageInternals as any;
    // Build 100 records with large metadata to exceed typical caps
    const records: CourseAssignment[] = Array.from({ length: 100 }).map((_, i) => ({
      id: `assign-${i}`,
      courseId: `course-${i % 5}`,
      userId: `user-${i}`,
      organizationId: null,
      status: 'assigned',
      progress: 0,
      dueDate: null,
      note: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedBy: null,
      active: true,
      metadata: { blob: 'x'.repeat(4096) },
      assignmentType: 'course',
    } as CourseAssignment));

    // Use a small cap for the test to force pruning
    const cap = 30_000; // 30KB
    const pruned = pruneRecordsToFit(records, cap);
    const size = bytesOf(JSON.stringify(pruned));
    expect(size).toBeLessThanOrEqual(cap);
    // Pruned set should be smaller than original
    expect(pruned.length).toBeLessThan(records.length);
  });
});
