export type OrgContextSnapshot = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  orgId: string | null;
  role: string | null;
  userId: string | null;
};

let resolver: (() => OrgContextSnapshot | null) | null = null;

export const registerCourseStoreOrgResolver = (next: (() => OrgContextSnapshot | null) | null) => {
  resolver = next;
};

export const resolveOrgContextFromBridge = (): OrgContextSnapshot | null => {
  return resolver ? resolver() : null;
};
