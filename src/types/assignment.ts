import type { OrganizationId, TextIdentifier } from './entityIds.js';

export type CourseAssignmentStatus = 'assigned' | 'in-progress' | 'completed';

export interface CourseAssignment {
  id: TextIdentifier;
  courseId: TextIdentifier;
  userId: string;
  organizationId?: OrganizationId | null;
  status: CourseAssignmentStatus;
  progress: number;
  dueDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedBy?: string | null;
  active?: boolean;
}
