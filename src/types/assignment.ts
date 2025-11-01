export type CourseAssignmentStatus = 'assigned' | 'in-progress' | 'completed';

export interface CourseAssignment {
  id: string;
  courseId: string;
  userId: string;
  status: CourseAssignmentStatus;
  progress: number;
  dueDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedBy?: string | null;
}
