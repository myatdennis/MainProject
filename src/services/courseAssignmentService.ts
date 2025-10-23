import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import orgService from './orgService';
import profileService from './ProfileService';
import type {
  CourseAssignmentRecord,
  CourseAssignmentRequest,
  CourseAssignmentSummary,
} from '../types/assignment';

const STORAGE_KEY = 'huddle_course_assignments_v1';
const isBrowser = typeof window !== 'undefined';

type AssignmentMap = Record<string, CourseAssignmentRecord>;

const buildKey = (courseId: string, assigneeType: CourseAssignmentRecord['assigneeType'], assigneeId: string) =>
  `${courseId}:${assigneeType}:${assigneeId}`;

const readAssignments = (): AssignmentMap => {
  if (!isBrowser) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CourseAssignmentRecord[];
    return parsed.reduce<AssignmentMap>((acc, assignment) => {
      acc[buildKey(assignment.courseId, assignment.assigneeType, assignment.assigneeId)] = assignment;
      return acc;
    }, {});
  } catch (error) {
    console.warn('[courseAssignmentService] Failed to read assignments from storage', error);
    return {};
  }
};

const writeAssignments = (assignments: AssignmentMap) => {
  if (!isBrowser) return;
  try {
    const values = Object.values(assignments);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch (error) {
    console.warn('[courseAssignmentService] Failed to write assignments to storage', error);
  }
};

const isSupabaseConfigured = () =>
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

const persistAssignmentsToSupabase = async (records: CourseAssignmentRecord[]) => {
  if (!isSupabaseConfigured() || records.length === 0) return;

  try {
    const payload = records.map(record => ({
      id: record.id,
      course_id: record.courseId,
      course_title: record.courseTitle,
      assignee_type: record.assigneeType,
      assignee_id: record.assigneeId,
      assignee_name: record.assigneeName,
      assignment_date: record.assignmentDate,
      due_date: record.dueDate,
      status: record.status,
      assigned_by: record.assignedBy,
      message: record.message,
      notify_learners: record.notifyLearners,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    }));

    const { error } = await supabase.from('course_assignments').upsert(payload, {
      onConflict: 'id',
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('[courseAssignmentService] Failed to persist assignments to Supabase', error);
  }
};

const computeSummary = (assignments: CourseAssignmentRecord[], courseId: string, courseTitle: string, newlyAdded: number): CourseAssignmentSummary => {
  const courseAssignments = assignments.filter(item => item.courseId === courseId);

  const totalOrganizations = courseAssignments.filter(item => item.assigneeType === 'organization').length;
  const totalUsers = courseAssignments.filter(item => item.assigneeType === 'user').length;
  const lastAssigned = courseAssignments
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  return {
    courseId,
    courseTitle,
    totalAssignments: courseAssignments.length,
    totalOrganizations,
    totalUsers,
    newAssignments: newlyAdded,
    lastAssignedAt: lastAssigned?.updatedAt,
    lastAssignedBy: lastAssigned?.assignedBy,
    lastAssigneeName: lastAssigned?.assigneeName,
    dueDate: lastAssigned?.dueDate,
  };
};

export const listAssignmentsByCourse = async (courseId: string): Promise<CourseAssignmentRecord[]> => {
  const assignments = Object.values(readAssignments());
  return assignments.filter(assignment => assignment.courseId === courseId);
};

export const getAssignmentSummary = async (courseId: string, courseTitle: string): Promise<CourseAssignmentSummary> => {
  const assignments = Object.values(readAssignments());
  return computeSummary(assignments, courseId, courseTitle, 0);
};

export const assignCourse = async (
  request: CourseAssignmentRequest,
): Promise<{ assignments: CourseAssignmentRecord[]; summary: CourseAssignmentSummary; newAssignments: CourseAssignmentRecord[] }> => {
  const assignments = readAssignments();
  const now = new Date().toISOString();

  const organizations = await orgService.listOrgs();
  const organizationMap = new Map(organizations.map(org => [org.id, org.name]));

  const userProfiles = await profileService.listUserProfiles();
  const userMap = new Map(userProfiles.map(user => [user.id, user.name]));

  const upserted: CourseAssignmentRecord[] = [];
  const newlyCreated: CourseAssignmentRecord[] = [];

  const upsertAssignment = (assigneeType: CourseAssignmentRecord['assigneeType'], assigneeId: string, assigneeName: string) => {
    const key = buildKey(request.courseId, assigneeType, assigneeId);
    const existing = assignments[key];

    if (existing) {
      const updated: CourseAssignmentRecord = {
        ...existing,
        assignmentDate: request.assignmentDate,
        dueDate: request.dueDate,
        message: request.message,
        notifyLearners: request.notifyLearners,
        assignedBy: request.assignedBy,
        updatedAt: now,
        status: 'assigned',
      };
      assignments[key] = updated;
      upserted.push(updated);
      return;
    }

    const record: CourseAssignmentRecord = {
      id: uuidv4(),
      courseId: request.courseId,
      courseTitle: request.courseTitle,
      assigneeType,
      assigneeId,
      assigneeName,
      assignmentDate: request.assignmentDate,
      dueDate: request.dueDate,
      status: 'assigned',
      assignedBy: request.assignedBy,
      message: request.message,
      notifyLearners: request.notifyLearners,
      createdAt: now,
      updatedAt: now,
    };

    assignments[key] = record;
    upserted.push(record);
    newlyCreated.push(record);
  };

  request.organizationIds.forEach(orgId => {
    const name = organizationMap.get(orgId) || `Organization ${orgId}`;
    upsertAssignment('organization', orgId, name);
  });

  request.userIds.forEach(userId => {
    const name = userMap.get(userId) || `User ${userId}`;
    upsertAssignment('user', userId, name);
  });

  writeAssignments(assignments);

  await persistAssignmentsToSupabase(upserted);

  const summary = computeSummary(Object.values(assignments), request.courseId, request.courseTitle, newlyCreated.length);

  return {
    assignments: upserted,
    summary,
    newAssignments: newlyCreated,
  };
};

export default {
  assignCourse,
  listAssignmentsByCourse,
  getAssignmentSummary,
};
