// Centralized definition and guards for protected assignment-related tables
const PROTECTED_ASSIGNMENT_TABLES = new Set(['assignments', 'course_assignments', 'survey_assignments']);

export const PROTECTED_TABLES = PROTECTED_ASSIGNMENT_TABLES; // backward/forward-friendly alias

export function isProtectedAssignmentTable(tableName: string | null | undefined): boolean {
  if (!tableName) return false;
  return PROTECTED_ASSIGNMENT_TABLES.has(String(tableName));
}

export function isProtectedTable(tableName: string | null | undefined): boolean {
  return isProtectedAssignmentTable(tableName);
}

export function assertNotProtectedTable(tableName: string | null | undefined) {
  if (typeof window !== 'undefined' && isProtectedAssignmentTable(tableName)) {
    const msg = 'Blocked client-side mutation of protected table';
    // Loud failure during development/tests so regressions are obvious
    console.error(`${msg} ${String(tableName)}`, { tableName });
    throw new Error(msg);
  }
}

export default {
  PROTECTED_ASSIGNMENT_TABLES,
  PROTECTED_TABLES,
  isProtectedAssignmentTable,
  isProtectedTable,
  assertNotProtectedTable,
};
