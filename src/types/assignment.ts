export type AssignmentAudience = 'organization' | 'user';

export interface CourseAssignmentRecord {
  id: string;
  courseId: string;
  courseTitle: string;
  assigneeType: AssignmentAudience;
  assigneeId: string;
  assigneeName: string;
  assignmentDate: string;
  dueDate?: string;
  status: 'pending' | 'assigned';
  assignedBy?: string;
  message?: string;
  notifyLearners?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseAssignmentSummary {
  courseId: string;
  courseTitle: string;
  totalAssignments: number;
  totalOrganizations: number;
  totalUsers: number;
  newAssignments: number;
  lastAssignedAt?: string;
  lastAssignedBy?: string;
  lastAssigneeName?: string;
  dueDate?: string;
}

export interface CourseAssignmentRequest {
  courseId: string;
  courseTitle: string;
  assignmentDate: string;
  dueDate?: string;
  organizationIds: string[];
  userIds: string[];
  message?: string;
  notifyLearners?: boolean;
  assignedBy?: string;
}

export interface AssignmentTargets {
  organizations: Array<{ id: string; name: string; contactEmail?: string }>;
  users: Array<{ id: string; name: string; email?: string; organization?: string }>; 
}
