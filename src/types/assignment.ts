import type { OrganizationId, TextIdentifier } from './entityIds.js';

export type CourseAssignmentStatus = 'assigned' | 'in-progress' | 'completed';
export type AssignmentKind = 'course' | 'survey';

export interface CourseAssignment {
  id: TextIdentifier;
  courseId?: TextIdentifier | null;
  surveyId?: TextIdentifier | null;
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
  metadata?: Record<string, unknown> | null;
  assignmentType?: AssignmentKind;
}
